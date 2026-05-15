import { getIngredientCategories } from "@/lib/actions/inventory/ingredient-categories"
import { IngredientCategoriesTable } from "./ingredient-categories-table"

export const dynamic = "force-dynamic"

export default async function AdminIngredientCategoriesPage() {
  const result = await getIngredientCategories()
  if ("error" in result) {
    return (
      <p className="text-destructive">
        Не удалось загрузить категории: {result.error}
      </p>
    )
  }

  return <IngredientCategoriesTable categories={result.data} />
}
