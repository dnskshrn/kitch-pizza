/** Статусы заказов, которые открываются в режиме мастера POS (правая панель). */
export function isWizardOrderStatus(status: string): boolean {
  return (
    status === "draft" ||
    status === "new" ||
    status === "in_progress" ||
    status === "delivering"
  )
}

/** Только выданный заказ: просмотр без редактирования. */
export function isDeliveredDetailStatus(status: string): boolean {
  return status === "done"
}
