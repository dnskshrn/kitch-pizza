export function rawbtPrintText(text: string): void {
  const S = "#Intent;scheme=rawbt;";
  const P = "package=ru.a402d.rawbtprinter;end;";
  const encoded = encodeURI(text);
  window.location.href = "intent:" + encoded + S + P;
}
