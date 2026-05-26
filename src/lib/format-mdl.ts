export function formatMdl(bani: number): string {
  return `${(bani / 100).toLocaleString("ru-MD")} MDL`
}
