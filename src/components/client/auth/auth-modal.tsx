"use client"

import { useAuthStore } from "@/store/auth-store"
import { useEffect, useState, type FormEvent } from "react"

type AuthStep = "phone" | "otp"

async function readApiError(response: Response, fallback: string) {
  try {
    const data = (await response.json()) as { error?: string }
    return data.error ?? fallback
  } catch {
    return fallback
  }
}

export function AuthModal() {
  const isOpen = useAuthStore((state) => state.isOpen)
  const closeAuth = useAuthStore((state) => state.closeAuth)
  const setProfile = useAuthStore((state) => state.setProfile)
  const [step, setStep] = useState<AuthStep>("phone")
  const [phone, setPhone] = useState("")
  const [code, setCode] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [resendIn, setResendIn] = useState(60)
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    if (!isOpen) return

    setError(null)
  }, [isOpen])

  useEffect(() => {
    const mediaQuery = window.matchMedia("(max-width: 767px)")
    const updateIsMobile = () => setIsMobile(mediaQuery.matches)
    updateIsMobile()
    mediaQuery.addEventListener("change", updateIsMobile)

    return () => mediaQuery.removeEventListener("change", updateIsMobile)
  }, [])

  useEffect(() => {
    if (!isOpen || step !== "otp") return

    setResendIn(60)
    const timer = window.setInterval(() => {
      setResendIn((value) => Math.max(0, value - 1))
    }, 1000)

    return () => window.clearInterval(timer)
  }, [isOpen, step])

  if (!isOpen) return null

  async function sendOtp() {
    const response = await fetch("/api/auth/send-otp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone }),
    })

    if (!response.ok) {
      throw new Error(await readApiError(response, "Ошибка отправки SMS"))
    }
  }

  async function handlePhoneSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setIsSubmitting(true)

    try {
      await sendOtp()
      setCode("")
      setStep("otp")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка отправки SMS")
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleOtpSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setIsSubmitting(true)

    try {
      const response = await fetch("/api/auth/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, code }),
      })

      if (!response.ok) {
        throw new Error(await readApiError(response, "Неверный код"))
      }

      const data = (await response.json()) as {
        profile?: { id?: string; profileId?: string; phone?: string; name?: string }
      }
      const profileId = data.profile?.profileId ?? data.profile?.id
      if (profileId && data.profile?.phone) {
        setProfile({
          profileId,
          phone: data.profile.phone,
          name: data.profile.name,
        })
      }
      closeAuth()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка входа")
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleResend() {
    if (resendIn > 0 || isSubmitting) return

    setError(null)
    setIsSubmitting(true)
    try {
      await sendOtp()
      setResendIn(60)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка отправки SMS")
    } finally {
      setIsSubmitting(false)
    }
  }

  function handleOverlayClick() {
    if (step === "phone") {
      closeAuth()
    }
  }

  const inputStyle = {
    width: "100%",
    borderRadius: "16px",
    border: "1px solid var(--color-muted)",
    background: "var(--color-bg)",
    color: "var(--color-text)",
    padding: "14px 16px",
    fontSize: "16px",
    outlineColor: "var(--color-accent)",
  }

  const buttonStyle = {
    width: "100%",
    border: 0,
    borderRadius: "999px",
    background: "var(--color-accent)",
    color: "var(--color-text)",
    cursor: isSubmitting ? "default" : "pointer",
    fontWeight: 700,
    padding: "14px 18px",
    opacity: isSubmitting ? 0.7 : 1,
  }

  return (
    <div
      onClick={handleOverlayClick}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 140,
        display: "flex",
        alignItems: isMobile ? "flex-end" : "center",
        justifyContent: "center",
        background: "rgba(0,0,0,0.5)",
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        onClick={(event) => event.stopPropagation()}
        style={{
          position: "relative",
          width: isMobile ? "100%" : "min(400px, calc(100vw - 32px))",
          borderRadius: isMobile ? "24px 24px 0 0" : "24px",
          background: "var(--color-bg)",
          color: "var(--color-text)",
          padding: isMobile ? "24px" : "32px",
          boxShadow:
            "0 24px 80px color-mix(in srgb, var(--color-text) 24%, transparent)",
        }}
      >
        <button
            type="button"
            aria-label="Закрыть"
            onClick={closeAuth}
            style={{
              position: "absolute",
              right: "18px",
              top: "18px",
              border: 0,
              background: "transparent",
              color: "var(--color-text)",
              cursor: "pointer",
              fontSize: "28px",
              lineHeight: 1,
            }}
          >
            ×
          </button>

          {step === "phone" ? (
            <form onSubmit={handlePhoneSubmit} style={{ display: "grid", gap: "18px" }}>
              <h2 style={{ margin: 0, paddingRight: "32px", fontSize: "24px" }}>
                Войти или зарегистрироваться
              </h2>
              <input
                type="tel"
                inputMode="numeric"
                placeholder="+373 XX XXX XXX"
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                style={inputStyle}
              />
              {error ? (
                <p style={{ margin: 0, color: "var(--color-accent)", fontSize: "14px" }}>
                  {error}
                </p>
              ) : null}
              <button type="submit" disabled={isSubmitting} style={buttonStyle}>
                {isSubmitting ? "Отправляем..." : "Получить код"}
              </button>
            </form>
          ) : (
            <form onSubmit={handleOtpSubmit} style={{ display: "grid", gap: "18px" }}>
              <div style={{ display: "grid", gap: "8px", paddingRight: "32px" }}>
                <h2 style={{ margin: 0, fontSize: "24px" }}>Введите код из SMS</h2>
                <p style={{ margin: 0, color: "var(--color-muted)", fontSize: "14px" }}>
                  Код отправлен на {phone}{" "}
                  <button
                    type="button"
                    onClick={() => {
                      setStep("phone")
                      setError(null)
                    }}
                    style={{
                      border: 0,
                      background: "transparent",
                      color: "var(--color-accent)",
                      cursor: "pointer",
                      fontWeight: 700,
                      padding: 0,
                    }}
                  >
                    Изменить номер
                  </button>
                </p>
              </div>
              <input
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                value={code}
                onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))}
                style={inputStyle}
              />
              {error ? (
                <p style={{ margin: 0, color: "var(--color-accent)", fontSize: "14px" }}>
                  {error}
                </p>
              ) : null}
              <button type="submit" disabled={isSubmitting} style={buttonStyle}>
                {isSubmitting ? "Проверяем..." : "Войти"}
              </button>
              <button
                type="button"
                disabled={resendIn > 0 || isSubmitting}
                onClick={handleResend}
                style={{
                  border: 0,
                  background: "transparent",
                  color: "var(--color-text)",
                  cursor: resendIn > 0 || isSubmitting ? "default" : "pointer",
                  opacity: resendIn > 0 || isSubmitting ? 0.5 : 1,
                  padding: 0,
                }}
              >
                {resendIn > 0 ? `Отправить повторно через ${resendIn}с` : "Отправить повторно"}
              </button>
            </form>
          )}
      </div>
    </div>
  )
}
