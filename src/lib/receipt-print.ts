import { toPng } from "html-to-image"

export async function printReceipt(node: HTMLElement): Promise<void> {
  try {
    await document.fonts?.ready

    const dataUrl = await toPng(node, {
      width: 576,
      pixelRatio: 0.75,          // было 1 → PNG ~40% легче, на термоленте разницы нет
      backgroundColor: "#ffffff",
      cacheBust: true,
    })

    // dataUrl = "data:image/png;base64,XXXX..."
    // Убираем префикс, оставляем только base64
    const base64 = dataUrl.slice("data:image/png;base64,".length)

    // Прямой вызов rawbt: без encodeURIComponent и лишнего intent-враппера
    window.location.href = `rawbt:data:image/png;base64,${base64}`

  } catch (e: unknown) {
    alert("УПАЛО: " + (e instanceof Error ? e.message : String(e)))
  }
}
