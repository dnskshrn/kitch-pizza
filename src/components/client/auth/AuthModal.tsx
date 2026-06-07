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

export function AuthModal() {
  const { t } = useLanguage()
  const isAuthOpen = useAuthStore((s) => s.isAuthOpen)
  const closeAuth = useAuthStore((s) => s.closeAuth)
  const dismissAuth = useAuthStore((s) => s.dismissAuth)
  const fetchMe = useAuthStore((s) => s.fetchMe)
  const setWelcomeBonusPending = useAuthStore((s) => s.setWelcomeBonusPending)

  const [step, setStep] = useState<Step>("phone")
  const [digits, setDigits] = useState("")
  const [submittedPhone, setSubmittedPhone] = useState("")
  const [otpCode, setOtpCode] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [phoneSubmitting, setPhoneSubmitting] = useState(false)
  const [otpSubmitting, setOtpSubmitting] = useState(false)
  const [resendIn, setResendIn] = useState(60)

  const otpInputRef = useRef<HTMLInputElement | null>(null)
  const verifyLock = useRef(false)

  useEffect(() => {
    if (!isAuthOpen) {
      setStep("phone")
      setDigits("")
      setSubmittedPhone("")
      setOtpCode("")
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
    const id = window.setTimeout(() => otpInputRef.current?.focus(), 0)
    return () => window.clearTimeout(id)
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
      setOtpCode("")
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
          setOtpCode("")
          setError(t.auth.modal.errorWrongCode)
          window.requestAnimationFrame(() => otpInputRef.current?.focus())
          return
        }
        const data = await response.json()
        await fetchMe()
        closeAuth()
        if (data.welcomeBonus === true) {
          setWelcomeBonusPending(true)
        }
      } catch {
        setOtpCode("")
        setError(t.auth.modal.errorWrongCode)
        otpInputRef.current?.focus()
      } finally {
        setOtpSubmitting(false)
        verifyLock.current = false
      }
    },
    [closeAuth, fetchMe, setWelcomeBonusPending, submittedPhone, t.auth.modal.errorWrongCode],
  )

  const applyOtpCode = useCallback(
    (raw: string) => {
      const code = raw.replace(/\D/g, "").slice(0, OTP_LEN)
      setOtpCode(code)
      if (code.length === OTP_LEN) {
        queueMicrotask(() => void submitOtpCode(code))
      }
    },
    [submitOtpCode],
  )

  useEffect(() => {
    if (!isAuthOpen || step !== "otp") return
    if (!("OTPCredential" in window)) return

    const ac = new AbortController()
    navigator.credentials
      .get({
        otp: { transport: ["sms"] },
        signal: ac.signal,
      } as CredentialRequestOptions)
      .then((cred) => {
        if (cred && "code" in cred && typeof cred.code === "string") {
          applyOtpCode(cred.code)
        }
      })
      .catch(() => {})

    return () => ac.abort()
  }, [isAuthOpen, step, applyOtpCode])

  async function handleResend() {
    if (resendIn > 0 || phoneSubmitting || otpSubmitting || !submittedPhone)
      return
    setError(null)
    setPhoneSubmitting(true)
    try {
      await sendOtpToPhone(submittedPhone)
      setOtpCode("")
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

  const otpStep = (
    <div className="flex min-h-0 flex-1 flex-col">
      <h2 className="text-center text-2xl font-bold text-gray-900">
        {t.auth.modal.otpTitle}
      </h2>
      <p className="mb-6 mt-1 text-center text-sm text-gray-400">
        {t.auth.modal.subtitle}
      </p>
      <div className="relative mx-auto my-6 w-fit">
        <div className="flex gap-3" aria-hidden>
          {Array.from({ length: OTP_LEN }, (_, i) => (
            <div
              key={i}
              className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#F5F5F5] text-2xl font-bold tabular-nums text-gray-900"
            >
              {otpCode[i] ?? ""}
            </div>
          ))}
        </div>
        <input
          ref={otpInputRef}
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={OTP_LEN}
          value={otpCode}
          disabled={otpSubmitting || phoneSubmitting}
          onChange={(e) => applyOtpCode(e.target.value)}
          onPaste={(e) => {
            e.preventDefault()
            applyOtpCode(e.clipboardData.getData("text"))
          }}
          onFocus={(e) =>
            e.target.scrollIntoView({ behavior: "smooth", block: "center" })
          }
          className="absolute inset-0 h-full w-full cursor-text opacity-0"
          aria-label={t.auth.modal.otpTitle}
        />
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
            otpCode.length !== OTP_LEN
          }
          className={continueBtnClass}
          onClick={() => void submitOtpCode(otpCode)}
        >
          {otpSubmitting ? "…" : t.auth.modal.continue}
        </button>
      </div>
    </div>
  )

  const inner = (
    <div className="flex min-h-0 flex-1 flex-col">{step === "phone" ? phoneStep : otpStep}</div>
  )

  return (
    <Dialog
      open={isAuthOpen}
      onOpenChange={(open) => {
        if (!open) dismissAuth()
      }}
    >
      <DialogContent
        showCloseButton
        className="flex max-h-[90dvh] max-w-md flex-col gap-0 overflow-y-auto rounded-2xl border-0 bg-white p-0 sm:max-w-md"
      >
        <DialogTitle className="sr-only">
          {step === "phone"
            ? t.auth.modal.a11yPhoneStep
            : t.auth.modal.a11yOtpStep}
        </DialogTitle>
        <div className="px-5 pt-6 pb-[max(2.5rem,env(safe-area-inset-bottom))]">
          {inner}
        </div>
      </DialogContent>
    </Dialog>
  )
}
