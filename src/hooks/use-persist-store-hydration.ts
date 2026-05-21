"use client"

import { useEffect, useState } from "react"

type PersistApi = {
  hasHydrated: () => boolean
  onFinishHydration: (fn: () => void) => () => void
  rehydrate: () => Promise<void> | void
}

/** Ждёт zustand persist; при ошибке rehydrate всё равно снимает блокировку UI. */
export function usePersistStoreHydration(
  persist: PersistApi | undefined,
): boolean {
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    if (!persist) {
      setHydrated(true)
      return
    }

    let done = false
    const finish = () => {
      if (done) return
      done = true
      setHydrated(true)
    }

    const unsub = persist.onFinishHydration(finish)
    if (persist.hasHydrated()) {
      finish()
    } else {
      void Promise.resolve(persist.rehydrate()).finally(finish)
    }

    return unsub
  }, [persist])

  return hydrated
}
