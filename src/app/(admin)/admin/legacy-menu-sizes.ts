/**
 * Колонки S/L удалены из `MenuItem` в пользу `menu_item_variants`.
 * На время перехода часть клиентских типов добавляет их опционально, чтобы
 * сохранённые формы продолжали компилироваться; источники данных могут их не вернуть.
 */
export type LegacyMenuSizeColumns = {
  size_s_price?: number | null
  size_l_price?: number | null
  size_s_weight?: number | null
  size_l_weight?: number | null
  size_s_label?: string | null
  size_l_label?: string | null
}
