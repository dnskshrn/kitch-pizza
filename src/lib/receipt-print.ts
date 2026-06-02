import { toPng } from "html-to-image"

/** Рендерит offscreen-узел чека в PNG 576px и печатает через RawBT inline (rawbt:data:image). */
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
    alert("PNG длина URL=" + dataUrl.length)

    const payload = "rawbt:" + dataUrl
    const intent =
      "intent:" +
      encodeURIComponent(payload) +
      "#Intent;scheme=rawbt;package=ru.a402d.rawbtprinter;end;"
    window.location.href = intent
  } catch (e: any) {
    alert("УПАЛО: " + (e?.message || e))
  }
}
