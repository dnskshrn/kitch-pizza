"use client"

import { useEffect, useState } from "react"

const DEBOUNCE_MS = 100

/** Ширина окна на SSR — совпадает с первым рендером клиента, без рассинхрона гидрации. */
const SSR_WIDTH = 1200

export function useWindowWidth(): number {
  const [width, setWidth] = useState(SSR_WIDTH)

  useEffect(() => {
    setWidth(window.innerWidth)

    let timeoutId: ReturnType<typeof setTimeout> | undefined

    const handleResize = () => {
      if (timeoutId !== undefined) clearTimeout(timeoutId)
      timeoutId = setTimeout(() => {
        setWidth(window.innerWidth)
      }, DEBOUNCE_MS)
    }

    window.addEventListener("resize", handleResize)
    return () => {
      if (timeoutId !== undefined) clearTimeout(timeoutId)
      window.removeEventListener("resize", handleResize)
    }
  }, [])

  return width
}
