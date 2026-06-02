export function rawbtPrintText(text: string): void {
  const S = "#Intent;scheme=rawbt;";
  const P = "package=ru.a402d.rawbtprinter;end;";
  const encoded = encodeURI(text);
  window.location.href = "intent:" + encoded + S + P;
}

function rawbtSendBytes(bytes: number[]): void {
  const binary = String.fromCharCode(...bytes)
  const base64 = btoa(binary)
  window.location.href = `rawbt:data:application/octet-stream;base64,${base64}`
}

export function rawbtOpenDrawer(): void {
  // ESC p m t1 t2 — pin 01
  rawbtSendBytes([0x1b, 0x70, 0x01, 0x19, 0xfa])
}
