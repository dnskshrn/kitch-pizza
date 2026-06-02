import { toPng } from "html-to-image"
import { createClient } from "@/lib/supabase/client"

async function waitForReceiptImages(node: HTMLElement): Promise<void> {
  const images = Array.from(node.querySelectorAll("img"))
  await Promise.all(
    images.map(
      (img) =>
        new Promise<void>((resolve) => {
          if (img.complete) {
            resolve()
            return
          }
          img.onload = () => resolve()
          img.onerror = () => resolve()
        }),
    ),
  )
}

/** Рендерит уже смонтированный offscreen-узел чека в PNG 576px и печатает через RawBT. */
export async function printReceipt(
  node: HTMLElement,
  orderNumber: string,
): Promise<void> {
  await (document as Document & { fonts?: FontFaceSet }).fonts?.ready

  await waitForReceiptImages(node)

  const dataUrl = await toPng(node, {
    width: 576,
    pixelRatio: 1,
    backgroundColor: "#ffffff",
    cacheBust: true,
  })

  const base64 = dataUrl.split(",")[1]
  if (!base64) throw new Error("Не удалось сгенерировать PNG чека")

  const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0))

  const fileName = `receipt-${orderNumber}-${Date.now()}.png`
  const supabase = createClient()
  const { error } = await supabase.storage
    .from("receipts")
    .upload(fileName, bytes, { contentType: "image/png", upsert: true })
  if (error) throw error

  const { data } = supabase.storage.from("receipts").getPublicUrl(fileName)
  const publicUrl = data.publicUrl

  const intent =
    "intent:" +
    encodeURI(publicUrl) +
    "#Intent;scheme=rawbt;" +
    "component=ru.a402d.rawbtprinter.activity.PrintDownloadActivity;" +
    "package=ru.a402d.rawbtprinter;end;"

  window.location.href = intent
}
