import { toPng } from "html-to-image"
import { createClient } from "@/lib/supabase/client"

/** Рендерит уже смонтированный offscreen-узел чека в PNG 576px и печатает через RawBT. */
export async function printReceipt(
  node: HTMLElement,
  orderNumber: string,
): Promise<void> {
  const supabase = createClient()

  try {
    alert("1: старт, жду шрифты")
    await (document as any).fonts?.ready

    alert("2: рендерю PNG")
    const dataUrl = await toPng(node, {
      width: 576,
      pixelRatio: 1,
      backgroundColor: "#ffffff",
      cacheBust: true,
    })

    alert("3: PNG готов, длина=" + dataUrl.length + ", заливаю в Storage")
    const base64 = dataUrl.split(",")[1]
    const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0))
    const fileName = `receipt-${orderNumber}-${Date.now()}.png`
    const { data: sess } = await supabase.auth.getSession()
    alert(
      "РОЛЬ: " +
        (sess?.session
          ? "authenticated " + sess.session.user.email
          : "АНОН — нет сессии"),
    )
    const { error } = await supabase.storage
      .from("receipts")
      .upload(fileName, bytes, { contentType: "image/png", upsert: true })
    if (error) {
      alert("ОШИБКА UPLOAD: " + error.message)
      throw error
    }

    const { data } = supabase.storage.from("receipts").getPublicUrl(fileName)
    alert("4: залито. URL=" + data.publicUrl + " — открываю RawBT")

    const intent =
      "intent:" +
      encodeURI(data.publicUrl) +
      "#Intent;scheme=rawbt;component=ru.a402d.rawbtprinter.activity.PrintDownloadActivity;package=ru.a402d.rawbtprinter;end;"
    window.location.href = intent
  } catch (e: any) {
    alert("УПАЛО: " + (e?.message || e))
  }
}
