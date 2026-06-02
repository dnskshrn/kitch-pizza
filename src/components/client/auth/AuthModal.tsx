"use client"

import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog"
import { useLanguage } from "@/lib/store/language-store"
import { useAuthStore } from "@/lib/store/auth-store"
import { RotateCcw } from "lucide-react"
import { useCallback, useEffect, useRef, useState } from "react"
import { Drawer } from "vaul"

type Step = "phone" | "otp"

const PREFIX = "+373"
const DIGIT_COUNT = 8
const OTP_LEN = 4

async function readApiError(response: Response, fallback: string) {
  try {
    const data = (await response.json()) as { error?: string }
    return data.error ?? fallback
  } catch {
    return fallback
  }
}

function formatMmSs(totalSec: number): string {
  const m = Math.floor(totalSec / 60)
  const s = totalSec % 60
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
}

/** Drawer на мобилке и планшете; Dialog — от `lg` (1024px). */
function useIsDrawerLayout() {
  const [drawer, setDrawer] = useState(false)

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 1023px)")
    setDrawer(mq.matches)
    const handler = (e: MediaQueryListEvent) => setDrawer(e.matches)
    mq.addEventListener("change", handler)
    return () => mq.removeEventListener("change", handler)
  }, [])

  return drawer
}

export function AuthModal() {
  const { t } = useLanguage()
  const isAuthOpen = useAuthStore((s) => s.isAuthOpen)
  const closeAuth = useAuthStore((s) => s.closeAuth)
  const dismissAuth = useAuthStore((s) => s.dismissAuth)
  const fetchMe = useAuthStore((s) => s.fetchMe)

  const isDrawer = useIsDrawerLayout()

  const [step, setStep] = useState<Step>("phone")
  const [digits, setDigits] = useState("")
  const [submittedPhone, setSubmittedPhone] = useState("")
  const [otp, setOtp] = useState(() => Array<string>(OTP_LEN).fill(""))
  const [error, setError] = useState<string | null>(null)
  const [phoneSubmitting, setPhoneSubmitting] = useState(false)
  const [otpSubmitting, setOtpSubmitting] = useState(false)
  const [resendIn, setResendIn] = useState(60)

  const otpRefs = useRef<(HTMLInputElement | null)[]>([])
  const verifyLock = useRef(false)

  useEffect(() => {
    if (!isAuthOpen) {
      setStep("phone")
      setDigits("")
      setSubmittedPhone("")
      setOtp(Array(OTP_LEN).fill(""))
      setError(null)
      setPhoneSubmitting(false)
      setOtpSubmitting(false)
      setResendIn(60)
    }
  }, [isAuthOpen])

  useEffect(() => {
    if (!isAuthOpen || step !== "otp") return
    setResendIn(60)
    const id = window.setInterval(() => {
      setResendIn((v) => Math.max(0, v - 1))
    }, 1000)
    return () => window.clearInterval(id)
  }, [isAuthOpen, step])

  useEffect(() => {
    if (!isAuthOpen || step !== "otp") return
    const t = window.setTimeout(() => otpRefs.current[0]?.focus(), 0)
    return () => window.clearTimeout(t)
  }, [isAuthOpen, step])

  const sendOtpToPhone = useCallback(
    async (phone: string) => {
      const response = await fetch("/api/auth/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone }),
      })
      if (!response.ok) {
        throw new Error(
          await readApiError(response, t.auth.modal.errorSend),
        )
      }
    },
    [t.auth.modal.errorSend],
  )

  async function handlePhoneSubmit(e: React.FormEvent) {
    e.preventDefault()
    const phone = `${PREFIX}${digits}`
    if (digits.length !== DIGIT_COUNT || phoneSubmitting) return

    setError(null)
    setPhoneSubmitting(true)
    try {
      await sendOtpToPhone(phone)
      setSubmittedPhone(phone)
      setOtp(Array(OTP_LEN).fill(""))
      setStep("otp")
    } catch (err) {
      setError(
        err instanceof Error ? err.message : t.auth.modal.errorSend,
      )
    } finally {
      setPhoneSubmitting(false)
    }
  }

  const submitOtpCode = useCallback(
    async (code: string) => {
      if (verifyLock.current || code.length !== OTP_LEN) return
      verifyLock.current = true
      setOtpSubmitting(true)
      setError(null)
      try {
        const response = await fetch("/api/auth/verify-otp", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ phone: submittedPhone, code }),
        })
        if (!response.ok) {
          setOtp(Array(OTP_LEN).fill(""))
          setError(t.auth.modal.errorWrongCode)
          window.requestAnimationFrame(() => otpRefs.current[0]?.focus())
          return
        }
        // TODO: handle welcomeBonus
        await fetchMe()
        closeAuth()
      } catch {
        setOtp(Array(OTP_LEN).fill(""))
        setError(t.auth.modal.errorWrongCode)
        otpRefs.current[0]?.focus()
      } finally {
        setOtpSubmitting(false)
        verifyLock.current = false
      }
    },
    [closeAuth, fetchMe, submittedPhone, t.auth.modal.errorWrongCode],
  )

  function setOtpDigit(index: number, value: string) {
    const d = value.replace(/\D/g, "").slice(-1)
    setOtp((prev) => {
      const next = [...prev]
      next[index] = d
      const joined = next.join("")
      if (
        index === OTP_LEN - 1 &&
        d &&
        joined.length === OTP_LEN &&
        /^\d{4}$/.test(joined)
      ) {
        queueMicrotask(() => void submitOtpCode(joined))
      }
      return next
    })
    if (d && index < OTP_LEN - 1) {
      otpRefs.current[index + 1]?.focus()
    }
  }

  function handleOtpKeyDown(
    index: number,
    e: React.KeyboardEvent<HTMLInputElement>,
  ) {
    if (e.key === "Backspace" && !otp[index] && index > 0) {
      otpRefs.current[index - 1]?.focus()
    }
  }

  function handleOtpPaste(index: number, e: React.ClipboardEvent) {
    e.preventDefault()
    const raw = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, OTP_LEN)
    if (!raw) return

    setOtp((prev) => {
      const next = [...prev]
      for (let i = 0; i < raw.length && index + i < OTP_LEN; i++) {
        next[index + i] = raw[i]!
      }
      const joined = next.join("")
      if (/^\d{4}$/.test(joined)) {
        queueMicrotask(() => void submitOtpCode(joined))
      }
      return next
    })

    const lastFilled = Math.min(index + raw.length - 1, OTP_LEN - 1)
    window.requestAnimationFrame(() => {
      otpRefs.current[lastFilled]?.focus()
    })
  }

  async function handleResend() {
    if (resendIn > 0 || phoneSubmitting || otpSubmitting || !submittedPhone)
      return
    setError(null)
    setPhoneSubmitting(true)
    try {
      await sendOtpToPhone(submittedPhone)
      setOtp(Array(OTP_LEN).fill(""))
      setResendIn(60)
    } catch (err) {
      setError(
        err instanceof Error ? err.message : t.auth.modal.errorSend,
      )
    } finally {
      setPhoneSubmitting(false)
    }
  }

  if (!isAuthOpen) return null

  const legalBlock = (
    <p className="mb-4 text-center text-xs text-gray-400">
      {t.auth.modal.legalConsent}
    </p>
  )

  const continueBtnClass =
    "w-full rounded-2xl bg-[#E8472A] py-4 text-base font-bold text-white disabled:opacity-50"

  const phoneStep = (
    <div className="flex min-h-0 flex-1 flex-col">
      <h2 className="text-center text-2xl font-bold text-gray-900">
        {t.auth.modal.phoneTitle}
      </h2>
      <p className="mb-6 mt-1 text-center text-sm text-gray-400">
        {t.auth.modal.subtitle}
      </p>
      <form
        onSubmit={handlePhoneSubmit}
        className="flex min-h-0 flex-1 flex-col"
      >
        <div className="flex items-center gap-2 rounded-2xl bg-[#F5F5F5] px-4 py-4">
          <span className="shrink-0 select-none font-medium text-gray-900">
            {PREFIX}
          </span>
          <input
            type="tel"
            name="phone-digits"
            inputMode="numeric"
            autoComplete="tel-national"
            maxLength={DIGIT_COUNT}
            value={digits}
            placeholder={t.auth.modal.phonePlaceholder}
            onChange={(e) =>
              setDigits(e.target.value.replace(/\D/g, "").slice(0, DIGIT_COUNT))
            }
            onFocus={(e) =>
              e.target.scrollIntoView({ behavior: "smooth", block: "center" })
            }
            className="min-w-0 flex-1 bg-transparent text-gray-900 outline-none placeholder:text-gray-400"
            aria-label={t.auth.modal.phonePlaceholder}
          />
        </div>
        {error && step === "phone" ? (
          <p className="mt-3 text-center text-sm text-red-600">{error}</p>
        ) : null}
        <div className="mt-auto flex flex-col pt-6">
          {legalBlock}
          <button
            type="submit"
            disabled={phoneSubmitting || digits.length !== DIGIT_COUNT}
            className={continueBtnClass}
          >
            {phoneSubmitting ? "…" : t.auth.modal.continue}
          </button>
        </div>
      </form>
    </div>
  )

  const otpCodeJoined = otp.join("")

  const otpStep = (
    <div className="flex min-h-0 flex-1 flex-col">
      <h2 className="text-center text-2xl font-bold text-gray-900">
        {t.auth.modal.otpTitle}
      </h2>
      <p className="mb-6 mt-1 text-center text-sm text-gray-400">
        {t.auth.modal.subtitle}
      </p>
      <div className="my-6 flex justify-center gap-3">
        {otp.map((digit, i) => (
          <input
            key={i}
            ref={(el) => {
              otpRefs.current[i] = el
            }}
            type="text"
            inputMode="numeric"
            maxLength={1}
            value={digit}
            disabled={otpSubmitting || phoneSubmitting}
            onChange={(e) => setOtpDigit(i, e.target.value)}
            onKeyDown={(e) => handleOtpKeyDown(i, e)}
            onPaste={(e) => handleOtpPaste(i, e)}
            onFocus={(e) =>
              e.target.scrollIntoView({ behavior: "smooth", block: "center" })
            }
            className="h-16 w-16 rounded-2xl bg-[#F5F5F5] text-center text-2xl font-bold tabular-nums text-gray-900 outline-none disabled:opacity-50"
            aria-label={t.auth.modal.otpDigitAria(i + 1)}
          />
        ))}
      </div>
      <div className="flex min-h-[22px] items-center justify-center gap-1.5 text-sm text-gray-400">
        {resendIn > 0 ? (
          <>
            <RotateCcw className="size-3.5 shrink-0" aria-hidden />
            <span className="tabular-nums">{formatMmSs(resendIn)}</span>
          </>
        ) : (
          <button
            type="button"
            onClick={() => void handleResend()}
            disabled={phoneSubmitting || otpSubmitting}
            className="inline-flex cursor-pointer items-center gap-1.5 border-0 bg-transparent text-gray-600 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <RotateCcw className="size-3.5 shrink-0" aria-hidden />
            <span>{t.auth.modal.resend}</span>
          </button>
        )}
      </div>
      {error && step === "otp" ? (
        <p className="mt-3 text-center text-sm text-red-600">{error}</p>
      ) : null}
      <div className="mt-auto flex flex-col pt-6">
        {legalBlock}
        <button
          type="button"
          disabled={
            otpSubmitting ||
            phoneSubmitting ||
            otpCodeJoined.length !== OTP_LEN
          }
          className={continueBtnClass}
          onClick={() => void submitOtpCode(otpCodeJoined)}
        >
          {otpSubmitting ? "…" : t.auth.modal.continue}
        </button>
      </div>
    </div>
  )

  const inner = (
    <div className="flex min-h-0 flex-1 flex-col">{step === "phone" ? phoneStep : otpStep}</div>
  )

  if (isDrawer) {
    return (
      <Drawer.Root
        open={isAuthOpen}
        onOpenChange={(v) => {
          if (!v) dismissAuth()
        }}
      >
        <Drawer.Portal>
          <Drawer.Overlay className="fixed inset-0 z-50 bg-black/40" />
          <Drawer.Content
            className="fixed bottom-0 left-0 right-0 z-50 flex w-full max-h-[90vh] flex-col rounded-t-[24px] bg-white px-5 pt-4 pb-[max(2.5rem,env(safe-area-inset-bottom))] outline-none"
            onOpenAutoFocus={(e) => e.preventDefault()}
          >
            <div className="mx-auto mb-6 h-1 w-10 shrink-0 rounded-full bg-gray-200" />
            <Drawer.Title className="sr-only">
              {step === "phone"
                ? t.auth.modal.a11yPhoneStep
                : t.auth.modal.a11yOtpStep}
            </Drawer.Title>
            {inner}
          </Drawer.Content>
        </Drawer.Portal>
      </Drawer.Root>
    )
  }

  return (
    <Dialog
      open={isAuthOpen}
      onOpenChange={(open) => {
        if (!open) dismissAuth()
      }}
    >
      <DialogContent
        showCloseButton
        className="flex max-h-[90vh] max-w-md flex-col gap-0 overflow-y-auto rounded-2xl border-0 bg-white p-0 sm:max-w-md"
      >
        <DialogTitle className="sr-only">
          {step === "phone"
            ? t.auth.modal.a11yPhoneStep
            : t.auth.modal.a11yOtpStep}
        </DialogTitle>
        <div className="px-5 pt-6 pb-10">{inner}</div>
      </DialogContent>
    </Dialog>
  )
}
