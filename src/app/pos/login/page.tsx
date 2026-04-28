"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { ArrowLeft, CornerDownLeft, Loader2 } from "lucide-react"
import { verifyPin } from "@/lib/actions/pos/auth"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

const inputBoxClass =
  "pointer-events-none h-12 w-12 shrink-0 rounded-lg border border-input bg-transparent p-0 text-center text-base font-medium tabular-nums md:text-sm"

export default function PosLoginPage() {
  const router = useRouter()
  const [pin, setPin] = useState("")
  const [loading, setLoading] = useState(false)
  const [showError, setShowError] = useState(false)
  const submitLock = useRef(false)

  const runVerify = useCallback(async (digits: string) => {
    if (submitLock.current) return
    submitLock.current = true
    setLoading(true)
    setShowError(false)
    const res = await verifyPin(digits)
    if (res.success) {
      router.push("/pos")
      router.refresh()
      return
    }
    setShowError(true)
    setPin("")
    setLoading(false)
    submitLock.current = false
  }, [router])

  useEffect(() => {
    if (pin.length !== 4) {
      submitLock.current = false
      return
    }
    void runVerify(pin)
  }, [pin, runVerify])

  function appendDigit(d: string) {
    if (loading) return
    setShowError(false)
    setPin((p) => (p.length >= 4 ? p : p + d))
  }

  function backspace() {
    if (loading) return
    setShowError(false)
    setPin((p) => p.slice(0, -1))
  }

  function onEnter() {
    if (loading || pin.length !== 4) return
    void runVerify(pin)
  }

  const digits = [1, 2, 3, 4, 5, 6, 7, 8, 9] as const

  return (
    <div className="bg-background flex min-h-dvh items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Kitch POS</CardTitle>
          <CardDescription>Введите PIN для входа</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          <div className="flex justify-center gap-2">
            {Array.from({ length: 4 }, (_, i) => (
              <Input
                key={i}
                readOnly
                tabIndex={-1}
                aria-hidden
                value={i < pin.length ? "•" : ""}
                className={cn(inputBoxClass)}
              />
            ))}
          </div>

          <div className="mx-auto grid max-w-[14rem] grid-cols-3 gap-2">
            {digits.map((d) => (
              <Button
                key={d}
                type="button"
                variant="outline"
                size="lg"
                disabled={loading}
                className="h-16 w-16 text-xl"
                onClick={() => appendDigit(String(d))}
              >
                {d}
              </Button>
            ))}
            <Button
              type="button"
              variant="outline"
              size="lg"
              disabled={loading}
              className="h-16 w-16 text-xl"
              onClick={backspace}
              aria-label="Удалить"
            >
              <ArrowLeft className="mx-auto size-5" />
            </Button>
            <Button
              type="button"
              variant="outline"
              size="lg"
              disabled={loading}
              className="h-16 w-16 text-xl"
              onClick={() => appendDigit("0")}
            >
              0
            </Button>
            <Button
              type="button"
              variant="outline"
              size="lg"
              disabled={loading || pin.length !== 4}
              className="relative h-16 w-16 text-xl"
              onClick={onEnter}
              aria-label="Войти"
            >
              {loading ? (
                <Loader2 className="mx-auto size-6 animate-spin" aria-hidden />
              ) : (
                <CornerDownLeft className="mx-auto size-5" />
              )}
            </Button>
          </div>

          {showError ? (
            <Alert variant="destructive">
              <AlertDescription>Неверный PIN</AlertDescription>
            </Alert>
          ) : null}
        </CardContent>
      </Card>
    </div>
  )
}
