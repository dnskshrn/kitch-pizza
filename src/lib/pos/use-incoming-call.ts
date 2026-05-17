"use client"

import { createBrowserSupabaseClient } from "@/lib/supabase/client"
import { useEffect } from "react"

export type IncomingCallEvent = {
  id: string
  callid: string | null
  event_type: string | null
  caller: string | null
  profile_id: string | null
  /** Из contact-строки по тому же callid или из `profiles.name`. */
  profile_name: string | null
  /** Линия ОАТС (diversion) → slug бренда, см. `pbx_calls.brand_slug`. */
  brand_slug: string | null
  created_at: string
}

type DbPbxCallsRow = {
  id: string
  callid?: string | null
  cmd?: string
  event_type?: string | null
  caller?: string | null
  profile_id?: string | null
  brand_slug?: string | null
  created_at: string
}

export function useIncomingCall({
  onIncoming,
  onDismiss,
}: {
  onIncoming: (event: IncomingCallEvent) => void
  onDismiss: (callid: string) => void
}) {
  useEffect(() => {
    let unsubscribed = false
    const supabase = createBrowserSupabaseClient()
    const channel = supabase
      .channel("pbx-realtime")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "pbx_calls" },
        (payload) => {
          const row = payload.new as DbPbxCallsRow & { cmd: string }
          if (row.cmd !== "event") return

          const eventType = row.event_type ?? ""

          if (eventType === "INCOMING") {
            const callid =
              typeof row.callid === "string" && row.callid.trim()
                ? row.callid.trim()
                : ""
            if (!callid) return

            void (async () => {
              try {
                const { data } = await supabase
                  .from("pbx_calls")
                  .select("profile_id, brand_slug, profiles(name)")
                  .eq("callid", callid)
                  .eq("cmd", "contact")
                  .maybeSingle()

                if (unsubscribed) return

                const rowBrandSlug =
                  typeof row.brand_slug === "string" && row.brand_slug.trim()
                    ? row.brand_slug.trim()
                    : null

                const embedded = data?.profiles as unknown
                let profileName: string | null = null
                if (embedded && typeof embedded === "object" && embedded !== null) {
                  const n = (embedded as { name?: unknown }).name
                  profileName =
                    typeof n === "string" && n.trim() ? n.trim() : null
                }

                const profileIdRaw = data?.profile_id
                let profileId =
                  typeof profileIdRaw === "string" && profileIdRaw.trim()
                    ? profileIdRaw.trim()
                    : null

                const rowPid =
                  typeof row.profile_id === "string" && row.profile_id.trim()
                    ? row.profile_id.trim()
                    : null
                profileId = profileId ?? rowPid ?? null

                if (profileId && profileName === null) {
                  const r = await supabase
                    .from("profiles")
                    .select("name")
                    .eq("id", profileId)
                    .maybeSingle()
                  if (unsubscribed) return
                  const nm = r.data?.name
                  profileName =
                    typeof nm === "string" && nm.trim() ? nm.trim() : null
                }

                if (unsubscribed) return

                const contactRow = data as {
                  brand_slug?: string | null
                } | null
                const cSlug = contactRow?.brand_slug
                const contactBrandSlug =
                  typeof cSlug === "string" && cSlug.trim() ? cSlug.trim() : null

                const brandSlug = rowBrandSlug ?? contactBrandSlug ?? null

                onIncoming({
                  id: row.id,
                  callid,
                  event_type: row.event_type ?? null,
                  caller: row.caller ?? null,
                  profile_id: profileId,
                  profile_name: profileName,
                  brand_slug: brandSlug,
                  created_at: row.created_at,
                })
              } catch (e) {
                console.error("[useIncomingCall] INCOMING enrich failed", e)
                if (unsubscribed) return
                const fallbackSlug =
                  typeof row.brand_slug === "string" && row.brand_slug.trim()
                    ? row.brand_slug.trim()
                    : null
                onIncoming({
                  id: row.id,
                  callid,
                  event_type: row.event_type ?? null,
                  caller: row.caller ?? null,
                  profile_id:
                    typeof row.profile_id === "string" && row.profile_id.trim()
                      ? row.profile_id.trim()
                      : null,
                  profile_name: null,
                  brand_slug: fallbackSlug,
                  created_at: row.created_at,
                })
              }
            })()

            return
          }

          if (["ACCEPTED", "COMPLETED", "CANCELLED"].includes(eventType)) {
            const cid =
              typeof row.callid === "string" && row.callid.trim()
                ? row.callid.trim()
                : ""
            if (cid) onDismiss(cid)
          }
        },
      )
      .subscribe()

    return () => {
      unsubscribed = true
      void supabase.removeChannel(channel)
    }
  }, [onIncoming, onDismiss])
}
