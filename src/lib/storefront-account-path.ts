/** Путь страницы аккаунта с учётом префикса бренда в URL (как checkout). */
export function storefrontAccountPath(brandSlug: string): string {
  if (brandSlug === "kitch-pizza") return "/account"
  if (brandSlug === "the-spot") return "/thespot/account"
  return `/${brandSlug}/account`
}
