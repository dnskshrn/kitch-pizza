import { getAdminSession } from "@/lib/admin-session"
import type {
  OcrExtractedData,
  OcrInvoiceResult,
  OcrMatchedItem,
} from "@/lib/admin/inventory/invoice-ocr-types"
import { createServiceSupabaseClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"

const OPENAI_URL = "https://api.openai.com/v1/chat/completions"
const MODEL = "gpt-4o"

const STEP1_PROMPT = `You are an invoice OCR assistant. Extract all line items from this Moldovan invoice or receipt.
The document may be in Romanian, Russian, or mixed with English brand names.

IMPORTANT for Moldovan fiscal invoices (FACTURA FISCALA):
- Use the price WITH VAT (last price column, "cu TVA" / "с НДС")
- Units: "buc" = pieces, "kg" = kilograms, "l" = liters, "шт" = pieces

For supermarket receipts (format: "ProductName\\n qty x price = total"):
- Extract each product line

Return ONLY valid JSON, no markdown, no explanation:
{
  "supplier_name": "string or null",
  "invoice_number": "string or null", 
  "date": "YYYY-MM-DD or null",
  "items": [
    {
      "raw_name": "exact name from document",
      "quantity": number,
      "raw_unit": "as written",
      "unit_price": number,
      "total_price": number
    }
  ]
}`

function imageMimeType(file: File): string {
  if (file.type && file.type.startsWith("image/")) return file.type
  const name = file.name.toLowerCase()
  if (name.endsWith(".png")) return "image/png"
  if (name.endsWith(".webp")) return "image/webp"
  if (name.endsWith(".gif")) return "image/gif"
  return "image/jpeg"
}

async function callOpenAI(
  messages: { role: string; content: string | object[] }[],
  maxTokens: number
): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) throw new Error("OPENAI_API_KEY not configured")

  const res = await fetch(OPENAI_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: maxTokens,
      messages,
    }),
  })

  if (!res.ok) {
    const errText = await res.text()
    throw new Error(`OpenAI API error: ${res.status} ${errText}`)
  }

  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[]
  }
  const content = data.choices?.[0]?.message?.content
  if (!content) throw new Error("Empty OpenAI response")
  return content
}

function extractJson(text: string): string {
  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (fenceMatch) return fenceMatch[1].trim()
  return text.trim()
}

export async function POST(request: Request) {
  const session = await getAdminSession()
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const formData = await request.formData()
    const image = formData.get("image")
    if (!image || !(image instanceof Blob)) {
      return NextResponse.json({ error: "no_image" }, { status: 400 })
    }

    const buffer = Buffer.from(await image.arrayBuffer())
    const base64 = buffer.toString("base64")
    const mime = imageMimeType(image as File)
    const dataUrl = `data:${mime};base64,${base64}`

    const step1Text = await callOpenAI(
      [
        {
          role: "user",
          content: [
            { type: "image_url", image_url: { url: dataUrl } },
            { type: "text", text: STEP1_PROMPT },
          ],
        },
      ],
      2000
    )

    let extracted: OcrExtractedData
    try {
      extracted = JSON.parse(extractJson(step1Text)) as OcrExtractedData
    } catch {
      console.error("JSON parse failed. Raw response:", step1Text)
      return NextResponse.json(
        { error: "ocr_parse_failed", raw: step1Text },
        { status: 500 }
      )
    }
    if (!Array.isArray(extracted.items)) {
      console.error("JSON parse failed. Raw response:", step1Text)
      return NextResponse.json(
        { error: "ocr_parse_failed", raw: step1Text },
        { status: 500 }
      )
    }

    const supabase = createServiceSupabaseClient()

    const [ingredientsRes, suppliersRes] = await Promise.all([
      supabase.from("ingredients").select("id, name, unit").order("name"),
      supabase.from("suppliers").select("id, name").order("name"),
    ])

    if (ingredientsRes.error || suppliersRes.error) {
      return NextResponse.json({ error: "internal" }, { status: 500 })
    }

    const ingredients = ingredientsRes.data ?? []
    const suppliers = suppliersRes.data ?? []

    const step2Prompt = `Match these invoice items to the closest ingredients from our database.
Ingredients may have names in Russian, Romanian, or English brand names.

Invoice items:
${JSON.stringify(extracted.items)}

Available ingredients (id, name, unit):
${JSON.stringify(ingredients)}

Available suppliers:
${JSON.stringify(suppliers)}

Rules:
- "high" confidence: clear match (same product, minor naming difference)
- "medium": likely match but uncertain  
- "low": possible match, significant difference
- "none": no reasonable match found
- For display_quantity: if ingredient.unit is 'g' and invoice qty is in kg, multiply by 1000. If 'ml' and invoice is in liters, multiply by 1000. If 'pcs' keep as is.
- Match supplier by company name similarity

Return ONLY valid JSON:
{
  "matched_supplier_id": "uuid or null",
  "items": [
    {
      "raw_name": "same as input",
      "quantity": number,
      "raw_unit": "same as input",
      "unit_price": number,
      "total_price": number,
      "matched_ingredient_id": "uuid or null",
      "matched_ingredient_name": "string or null",
      "matched_ingredient_unit": "g|ml|pcs or null",
      "display_quantity": number,
      "confidence": "high|medium|low|none"
    }
  ]
}`

    const step2Text = await callOpenAI(
      [{ role: "user", content: step2Prompt }],
      2000
    )

    let matched: {
      matched_supplier_id: string | null
      items: OcrMatchedItem[]
    }
    try {
      matched = JSON.parse(extractJson(step2Text)) as typeof matched
    } catch {
      console.error("JSON parse failed. Raw response:", step2Text)
      return NextResponse.json(
        { error: "match_parse_failed", raw: step2Text },
        { status: 500 }
      )
    }
    if (!Array.isArray(matched.items)) {
      console.error("JSON parse failed. Raw response:", step2Text)
      return NextResponse.json(
        { error: "match_parse_failed", raw: step2Text },
        { status: 500 }
      )
    }

    const result: OcrInvoiceResult = {
      supplier_name: extracted.supplier_name,
      invoice_number: extracted.invoice_number,
      date: extracted.date,
      matched_supplier_id: matched.matched_supplier_id,
      items: matched.items,
    }

    return NextResponse.json(result)
  } catch {
    return NextResponse.json({ error: "internal" }, { status: 500 })
  }
}
