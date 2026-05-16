"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { PosFoodServiceLogo } from "@/components/pos/pos-food-service-logo"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export default function PosManagerLoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [checkingSession, setCheckingSession] = useState(true)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        router.replace("/pos/login")
        return
      }
      setCheckingSession(false)
    })
  }, [router])

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const supabase = createClient()
      const { error: signError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      })
      if (signError) {
        setError(signError.message || "Не удалось войти")
        return
      }
      router.push("/pos/login")
      router.refresh()
    } finally {
      setLoading(false)
    }
  }

  if (checkingSession) {
    return (
      <div className="bg-background flex min-h-dvh items-center justify-center p-4">
        <Loader2 className="text-muted-foreground size-8 animate-spin" aria-hidden />
      </div>
    )
  }

  return (
    <div className="bg-background flex min-h-dvh items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-3">
          <div className="flex justify-center pt-1">
            <PosFoodServiceLogo className="mx-auto h-10 max-w-[min(280px,85vw)] object-center sm:h-11" />
          </div>
          <CardDescription className="text-center">
            Вход менеджера (email и пароль)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="pos-manager-email">Email</Label>
              <Input
                id="pos-manager-email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(ev) => setEmail(ev.target.value)}
                disabled={loading}
                required
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="pos-manager-password">Пароль</Label>
              <Input
                id="pos-manager-password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(ev) => setPassword(ev.target.value)}
                disabled={loading}
                required
              />
            </div>

            {error ? (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            ) : null}

            <Button
              type="submit"
              className="w-full bg-[#ccff00] font-semibold text-[#242424] hover:bg-[#ccff00]/90"
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />
                  Вход…
                </>
              ) : (
                "Далее к PIN"
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
