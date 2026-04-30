import { updateProfile } from "@/lib/actions/account/update-profile"
import { getBrandId } from "@/lib/get-brand-id"
import { getStorefrontSession } from "@/lib/storefront-session"
import { createServiceRoleClient } from "@/lib/supabase/service-role"
import { redirect } from "next/navigation"

type ProfileRow = {
  id: string
  phone: string
  name: string | null
}

type OrderRow = {
  id: string
  order_number: number
  created_at: string
  total: number
  status: string
  delivery_mode: string
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(value))
}

function statusLabel(status: string) {
  const labels: Record<string, string> = {
    new: "Новый",
    in_progress: "Готовится",
    delivering: "В доставке",
    done: "Выполнен",
    cancelled: "Отменён",
  }

  return labels[status] ?? status
}

function statusStyle(status: string) {
  const isActive = status !== "done" && status !== "cancelled"

  return {
    borderRadius: "999px",
    background: isActive ? "var(--color-accent)" : "transparent",
    border: isActive ? "1px solid var(--color-accent)" : "1px solid #808080",
    color: isActive ? "var(--color-text)" : "#808080",
    fontSize: "12px",
    fontWeight: 700,
    padding: "6px 10px",
    whiteSpace: "nowrap" as const,
  }
}

async function saveProfileAction(formData: FormData) {
  "use server"

  await updateProfile(formData)
}

export default async function AccountPage() {
  const session = await getStorefrontSession()
  if (!session) {
    redirect("/")
  }

  const supabase = createServiceRoleClient()
  const brandId = await getBrandId()
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, phone, name")
    .eq("id", session.profileId)
    .single<ProfileRow>()

  if (!profile) {
    redirect("/")
  }

  const { data: orders } = await supabase
    .from("orders")
    .select("id, order_number, created_at, total, status, delivery_mode")
    .eq("profile_id", session.profileId)
    .eq("brand_id", brandId)
    .order("created_at", { ascending: false })
    .limit(10)
    .returns<OrderRow[]>()

  return (
    <main
      style={{
        width: "min(960px, calc(100vw - 32px))",
        margin: "0 auto",
        padding: "32px 0 96px",
        color: "var(--color-text)",
      }}
    >
      <div style={{ display: "grid", gap: "20px" }}>
        <section
          style={{
            borderRadius: "24px",
            background: "var(--color-bg)",
            color: "var(--color-text)",
            padding: "24px",
          }}
        >
          <h1 style={{ margin: "0 0 20px", fontSize: "28px" }}>Мои данные</h1>
          <form action={saveProfileAction} style={{ display: "grid", gap: "16px" }}>
            <label style={{ display: "grid", gap: "8px" }}>
              <span style={{ color: "var(--color-muted)", fontSize: "13px" }}>
                Телефон
              </span>
              <span style={{ fontSize: "18px", fontWeight: 700 }}>{profile.phone}</span>
            </label>
            <label style={{ display: "grid", gap: "8px" }}>
              <span style={{ color: "var(--color-muted)", fontSize: "13px" }}>
                Имя
              </span>
              <input
                name="name"
                defaultValue={profile.name ?? ""}
                style={{
                  border: "1px solid var(--color-muted)",
                  borderRadius: "16px",
                  background: "var(--color-bg)",
                  color: "var(--color-text)",
                  fontSize: "16px",
                  outlineColor: "var(--color-accent)",
                  padding: "14px 16px",
                }}
              />
            </label>
            <button
              type="submit"
              style={{
                justifySelf: "start",
                border: 0,
                borderRadius: "999px",
                background: "var(--color-accent)",
                color: "var(--color-text)",
                cursor: "pointer",
                fontWeight: 700,
                padding: "14px 20px",
              }}
            >
              Сохранить
            </button>
          </form>
        </section>

        <section
          style={{
            borderRadius: "24px",
            background: "var(--color-bg)",
            color: "var(--color-text)",
            padding: "24px",
          }}
        >
          <h2 style={{ margin: "0 0 20px", fontSize: "28px" }}>История заказов</h2>
          {orders?.length ? (
            <div style={{ display: "grid", gap: "12px" }}>
              {orders.map((order) => (
                <article
                  key={order.id}
                  style={{
                    alignItems: "center",
                    border: "1px solid var(--color-muted)",
                    borderRadius: "18px",
                    display: "grid",
                    gap: "12px",
                    gridTemplateColumns: "1fr auto",
                    padding: "16px",
                  }}
                >
                  <div style={{ display: "grid", gap: "6px" }}>
                    <strong>Заказ №{order.order_number}</strong>
                    <span style={{ color: "var(--color-muted)", fontSize: "14px" }}>
                      {formatDate(order.created_at)} · {order.delivery_mode}
                    </span>
                    <span style={{ fontWeight: 700 }}>
                      {(order.total / 100).toFixed(2)} лей
                    </span>
                  </div>
                  <span style={statusStyle(order.status)}>
                    {statusLabel(order.status)}
                  </span>
                </article>
              ))}
            </div>
          ) : (
            <p style={{ color: "var(--color-muted)", margin: 0 }}>
              Заказов пока нет
            </p>
          )}
        </section>
      </div>
    </main>
  )
}
