import { toPng } from "html-to-image"
import { createClient } from "@/lib/supabase/client"

/** Рендерит уже смонтированный offscreen-узел чека в PNG 576px и печатает через RawBT. */
export async function printReceipt(
  node: HTMLElement,
  orderNumber: string,
): Promise<void> {
  try {
    await (document as any).fonts?.ready

    const dataUrl = await toPng(node, {
      width: 576,
      pixelRatio: 1,
      backgroundColor: "#ffffff",
      cacheBust: true,
    })
    const base64 = dataUrl.split(",")[1]
    const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0))
    const fileName = `receipt-${orderNumber}-${Date.now()}.png`
    const file = new File([bytes], fileName, { type: "image/png" })

    const supabase = createClient()

    const { error } = await supabase.storage.from("receipts").upload(fileName, file, {
      cacheControl: "3600",
      contentType: "image/png",
      upsert: false,
    })
    if (error) {
      alert("UPLOAD: " + error.message)
      throw error
    }

    const { data } = supabase.storage.from("receipts").getPublicUrl(fileName)

    const intent =
      "intent:" +
      encodeURI(data.publicUrl) +
      "#Intent;scheme=rawbt;component=ru.a402d.rawbtprinter.activity.PrintDownloadActivity;package=ru.a402d.rawbtprinter;end;"
    window.location.href = intent
  } catch (e: any) {
    alert("УПАЛО: " + (e?.message || e))
  }
}
