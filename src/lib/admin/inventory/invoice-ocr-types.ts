export type OcrRawItem = {
  raw_name: string
  quantity: number
  raw_unit: string
  unit_price: number
  total_price: number
  /** Процент НДС: 20, 8 или 0 */
  vat_rate: number
}

export type OcrExtractedData = {
  supplier_name: string | null
  invoice_number: string | null
  date: string | null
  items: OcrRawItem[]
}

export type OcrMatchedItem = OcrRawItem & {
  matched_ingredient_id: string | null
  matched_ingredient_name: string | null
  matched_ingredient_unit: string | null
  display_quantity: number
  confidence: "high" | "medium" | "low" | "none"
}

export type OcrInvoiceResult = {
  supplier_name: string | null
  invoice_number: string | null
  date: string | null
  matched_supplier_id: string | null
  items: OcrMatchedItem[]
}
