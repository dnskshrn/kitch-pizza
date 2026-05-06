/** Статусы заказов, которые открываются в режиме мастера POS (правая панель). */
export function isWizardOrderStatus(status: string): boolean {
  return (
    status === "draft" ||
    status === "new" ||
    status === "confirmed" ||
    status === "cooking" ||
    status === "ready" ||
    status === "delivery"
  )
}

/** Только выданный заказ: просмотр без редактирования. */
export function isDeliveredDetailStatus(status: string): boolean {
  return status === "done"
}
