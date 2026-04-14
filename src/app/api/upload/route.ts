import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

/** Загрузка в bucket `menu-images` (как в админке меню). Требуется сессия Supabase. */
export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const formData = await request.formData()
  const file = formData.get("file")
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "No file" }, { status: 400 })
  }

  const safeName = file.name.replace(/[^\w.\-]+/g, "_")
  const path = `${Date.now()}-${safeName}`

  const { error } = await supabase.storage.from("menu-images").upload(path, file, {
    cacheControl: "3600",
    contentType: file.type || undefined,
    upsert: false,
  })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const { data } = supabase.storage.from("menu-images").getPublicUrl(path)
  return NextResponse.json({ url: data.publicUrl })
}
