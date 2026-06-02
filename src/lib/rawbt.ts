export function rawbtPrintText(text: string): void {
  const S = "#Intent;scheme=rawbt;";
  const P = "package=ru.a402d.rawbtprinter;end;";
  const encoded = encodeURI(text);
  window.location.href = "intent:" + encoded + S + P;
}

export function rawbtOpenDrawer(): void {
  // ESC p m t1 t2 — импульс на пин 2
  const drawerCmd = "\x1B\x70\x01\x19\xFA";
  const S = "#Intent;scheme=rawbt;";
  const P = "package=ru.a402d.rawbtprinter;end;";
  const encoded = encodeURI(drawerCmd);
  window.location.href = "intent:" + encoded + S + P;
}
