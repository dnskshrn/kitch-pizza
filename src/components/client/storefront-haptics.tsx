"use client"

import { useEffect } from "react"
import { useWebHaptics } from "web-haptics/react"

const HAPTIC_TARGET_SELECTOR = [
  "button",
  "a[href]",
  "[role='button']",
  "input[type='button']",
  "input[type='submit']",
  "input[type='reset']",
].join(",")

function isDisabledControl(element: Element): boolean {
  if (element.getAttribute("aria-disabled") === "true") return true
  if (element.hasAttribute("disabled")) return true

  return element instanceof HTMLButtonElement || element instanceof HTMLInputElement
    ? element.disabled
    : false
}

export function StorefrontHaptics() {
  const { trigger, isSupported } = useWebHaptics()

  useEffect(() => {
    if (!isSupported) return

    const triggerForTarget = (target: EventTarget | null) => {
      if (!(target instanceof Element)) return

      const hapticTarget = target.closest(HAPTIC_TARGET_SELECTOR)
      if (!hapticTarget || isDisabledControl(hapticTarget)) return
      if (hapticTarget.closest("[data-haptics='off']")) return

      void trigger("selection")
    }

    const handlePointerDown = (event: PointerEvent) => {
      if (event.button !== 0) return
      triggerForTarget(event.target)
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Enter" && event.key !== " ") return
      triggerForTarget(event.target)
    }

    document.addEventListener("pointerdown", handlePointerDown, { passive: true })
    document.addEventListener("keydown", handleKeyDown)

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown)
      document.removeEventListener("keydown", handleKeyDown)
    }
  }, [isSupported, trigger])

  return null
}
