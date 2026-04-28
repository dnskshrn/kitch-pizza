"use server"

import { revalidatePath } from "next/cache"
import { cookies } from "next/headers"

export async function setAdminBrand(slug: string) {
  const cookieStore = await cookies()
  cookieStore.set("admin-brand-slug", slug, {
    path: "/",
    httpOnly: true,
    maxAge: 60 * 60 * 24 * 30, // 30 days
  })
  revalidatePath("/admin", "layout")
}
