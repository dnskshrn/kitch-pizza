"use server"

import { getAdminBrandId } from "@/lib/get-admin-brand-id"
import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"

export type ProductRecipeLineInput = {
  ingredient_id: string | null
  semi_finished_id: string | null
  quantity: number
}

export type ProductRecipeMetaInput = {
  output_qty: number
  output_unit: "g" | "ml" | "pcs"
}

function validateLines(lines: ProductRecipeLineInput[]) {
  for (const l of lines) {
    const hasIng = (l.ingredient_id ?? "").trim() !== ""
    const hasSemi = (l.semi_finished_id ?? "").trim() !== ""
    if (hasIng === hasSemi) {
      throw new Error("Каждая строка должна содержать либо ингредиент, либо полуфабрикат")
    }
    if (!Number.isFinite(l.quantity) || l.quantity <= 0) {
      throw new Error("Укажите положительное количество для каждого компонента")
    }
  }
}

export async function saveProductRecipe(
  menuItemId: string,
  variantId: string | null,
  lines: ProductRecipeLineInput[],
  recipeMeta: ProductRecipeMetaInput | null
) {
  validateLines(lines)
  const brandId = await getAdminBrandId()
  const supabase = await createClient()

  const { data: item, error: itemErr } = await supabase
    .from("menu_items")
    .select("id")
    .eq("id", menuItemId)
    .eq("brand_id", brandId)
    .single()

  if (itemErr || !item) {
    throw new Error("Позиция меню не найдена")
  }

  let del = supabase
    .from("product_recipes")
    .delete()
    .eq("menu_item_id", menuItemId)

  if (variantId == null) {
    del = del.is("variant_id", null)
  } else {
    del = del.eq("variant_id", variantId)
  }

  const { error: delError } = await del
  if (delError) throw new Error(delError.message)

  if (lines.length > 0) {
    const inserts = lines.map((l) => ({
      menu_item_id: menuItemId,
      variant_id: variantId,
      ingredient_id: l.ingredient_id?.trim() ? l.ingredient_id : null,
      semi_finished_id: l.semi_finished_id?.trim() ? l.semi_finished_id : null,
      quantity: l.quantity,
    }))

    const { error: insError } = await supabase.from("product_recipes").insert(inserts)
    if (insError) throw new Error(insError.message)
  }

  if (recipeMeta != null && recipeMeta.output_qty > 0) {
    const { error: metaErr } = await supabase.from("product_recipe_meta").upsert(
      {
        menu_item_id: menuItemId,
        variant_id: variantId,
        output_qty: recipeMeta.output_qty,
        output_unit: recipeMeta.output_unit,
      },
      { onConflict: "menu_item_id,variant_id" }
    )
    if (metaErr) throw new Error(metaErr.message)
  } else {
    let metaDel = supabase
      .from("product_recipe_meta")
      .delete()
      .eq("menu_item_id", menuItemId)
    metaDel =
      variantId == null
        ? metaDel.is("variant_id", null)
        : metaDel.eq("variant_id", variantId)
    const { error: metaDelErr } = await metaDel
    if (metaDelErr) throw new Error(metaDelErr.message)
  }

  revalidatePath("/admin/inventory/tech-cards")
}
