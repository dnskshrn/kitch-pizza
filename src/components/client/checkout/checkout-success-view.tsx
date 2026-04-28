"use client"

import { ClientContainer } from "@/components/client/client-container"
import { CheckoutProgressSteps } from "@/components/client/checkout/checkout-progress-steps"
import { OrderSummary } from "@/components/client/checkout/order-summary"
import type { CartLang } from "@/lib/cart-helpers"
import {
  getCartGrandTotalBani,
  selectCartDiscount,
  selectCartItemCount,
  selectCartSubtotal,
  useCartStore,
} from "@/lib/store/cart-store"
import { useDeliveryStore } from "@/lib/store/delivery-store"
import { cn } from "@/lib/utils"
import { ChevronLeft, Phone } from "lucide-react"
import dynamic from "next/dynamic"
import Image from "next/image"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { useEffect, useState } from "react"

const CheckoutSuccessMap = dynamic(
  () =>
    import("./checkout-success-map").then((m) => ({
      default: m.CheckoutSuccessMap,
    })),
  {
    ssr: false,
    loading: () => (
      <div
        className="h-[300px] w-full animate-pulse rounded-[24px] bg-[#e5e5e5]"
        aria-hidden
      />
    ),
  },
)

const LANG_KEY = "lang"

function readLang(): CartLang {
  if (typeof window === "undefined") return "RU"
  return window.localStorage.getItem(LANG_KEY) === "RO" ? "RO" : "RU"
}

const checkoutCtaMotion =
  "cursor-pointer transition-all duration-200 ease-out hover:brightness-95 active:scale-[0.97]"
const checkoutIconCircle =
  "cursor-pointer transition-all duration-200 ease-out hover:bg-[#e8e8e8] active:scale-[0.96]"

type CheckoutSuccessViewProps = {
  brandName: string
  brandLogo: string
  brandSlug: string
}

export function CheckoutSuccessView({
  brandName,
  brandLogo,
  brandSlug,
}: CheckoutSuccessViewProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const rawName = searchParams.get("name") ?? ""
  const customerName = rawName.trim()

  const items = useCartStore((s) => s.items)
  const subtotal = useCartStore(selectCartSubtotal)
  const discount = useCartStore(selectCartDiscount)
  const itemCount = useCartStore(selectCartItemCount)

  const mode = useDeliveryStore((s) => s.mode)
  const mapLat = useDeliveryStore((s) => s.lat)
  const mapLng = useDeliveryStore((s) => s.lng)
  const selectedZone = useDeliveryStore((s) => s.selectedZone)
  const getDeliveryFeeBani = useDeliveryStore((s) => s.getDeliveryFeeBani)

  const [lang, setLang] = useState<CartLang>("RU")
  const [hydrated, setHydrated] = useState(false)
  const [deliveryHydrated, setDeliveryHydrated] = useState(false)

  useEffect(() => {
    setLang(readLang())
    const onStorage = (e: StorageEvent) => {
      if (e.key === LANG_KEY) setLang(readLang())
    }
    window.addEventListener("storage", onStorage)
    return () => window.removeEventListener("storage", onStorage)
  }, [])

  useEffect(() => {
    if (useCartStore.persist.hasHydrated()) setHydrated(true)
    const unsub = useCartStore.persist.onFinishHydration(() =>
      setHydrated(true),
    )
    return unsub
  }, [])

  useEffect(() => {
    if (useDeliveryStore.persist.hasHydrated()) setDeliveryHydrated(true)
    const unsub = useDeliveryStore.persist.onFinishHydration(() =>
      setDeliveryHydrated(true),
    )
    return unsub
  }, [])

  const deliveryFeeBani = getDeliveryFeeBani(subtotal)
  const grandTotal = getCartGrandTotalBani()

  function handleBackNav() {
    router.push("/")
  }

  if (!hydrated || !deliveryHydrated) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-[#808080]">
        Загрузка…
      </div>
    )
  }

  return (
    <div className="flex min-h-screen flex-col pb-[calc(88px+env(safe-area-inset-bottom))] md:pb-0">
      <div
        className={cn(
          "border-b border-transparent pt-4 md:pt-6",
          brandSlug === "the-spot" && "h-[128px] md:h-auto",
        )}
      >
        <ClientContainer>
          <div className="flex w-full items-center gap-3 md:justify-between md:gap-6">
            <div
              className={cn(
                "flex min-w-0 items-center gap-3 md:gap-6",
                brandSlug === "the-spot" &&
                  "fixed left-5 top-[max(1rem,env(safe-area-inset-top))] z-50 rounded-full bg-[var(--color-bg)] p-2 pr-5 shadow-sm ring-1 ring-black/5 md:static md:rounded-none md:bg-transparent md:p-0 md:pr-0 md:shadow-none md:ring-0",
              )}
            >
              <button
                type="button"
                onClick={handleBackNav}
                className={cn(
                  "storefront-modal-surface flex size-11 shrink-0 items-center justify-center rounded-full text-[#242424]",
                  checkoutIconCircle,
                )}
                aria-label="На главную"
              >
                <ChevronLeft className="size-6" strokeWidth={2} />
              </button>

              <Link
                href="/"
                className="flex shrink-0 items-center md:hidden"
                aria-label={`${brandName} — на главную`}
              >
                <Image
                  src={brandLogo}
                  alt={brandName}
                  width={brandSlug === "the-spot" ? 80 : 220}
                  height={brandSlug === "the-spot" ? 47 : 84}
                  className={cn(
                    "w-auto max-w-[min(200px,52vw)] object-contain object-left",
                    brandSlug === "the-spot" ? "h-[42px]" : "h-[55px]",
                  )}
                  unoptimized
                />
              </Link>

              <Link
                href="/"
                className="hidden shrink-0 md:block"
                aria-label={`${brandName} — на главную`}
              >
                <Image
                  src={brandLogo}
                  alt={brandName}
                  width={brandSlug === "the-spot" ? 80 : 220}
                  height={brandSlug === "the-spot" ? 47 : 84}
                  className={cn(
                    "w-auto object-contain object-left",
                    brandSlug === "the-spot" ? "h-[42px]" : "h-[55px]",
                  )}
                  unoptimized
                />
              </Link>
            </div>

            <div className="hidden shrink-0 md:block">
              <CheckoutProgressSteps activeStep={3} />
            </div>
          </div>
        </ClientContainer>
      </div>

      <ClientContainer className="flex-1 py-6 md:py-10">
        <div className="flex flex-col gap-8 md:flex-row md:items-start md:gap-8 lg:gap-12">
          <div className="flex w-full max-w-full flex-col gap-3 md:w-[680px] md:max-w-[680px]">
            <div className="storefront-checkout-success-hero storefront-modal-card-radius relative z-0 mb-3 overflow-visible rounded-[24px] p-6 pb-8 md:mb-4 md:p-8 md:pb-10">
              <div className="max-w-[min(100%,420px)] pr-[100px] sm:pr-[120px] md:pr-44 lg:pr-52">
                <h1 className="text-[22px] font-bold leading-tight text-[#242424] md:text-[24px]">
                  {customerName
                    ? `Заказ отправлен, ${customerName}!`
                    : "Заказ отправлен!"}
                </h1>
                {/* TODO: при появлении постоянного хранения имени заказа — подставлять из стора, search — fallback */}
                <p className="mt-2 text-[14px] font-normal text-[#242424]">
                  Скоро наберем
                </p>
                <a
                  href="tel:+37379700290"
                  className="mt-4 inline-flex items-center gap-2 rounded-full bg-white px-4 py-2.5 text-[14px] font-bold text-[#242424] shadow-sm transition-opacity hover:opacity-90"
                >
                  <Phone className="size-5 shrink-0" strokeWidth={2} aria-hidden />
                  079 700 290
                </a>
                <p className="mt-3 max-w-sm text-[13px] leading-snug text-[#5c5c5c]">
                  Вот наш номер телефона, если вдруг возникнут вопросы!
                </p>
              </div>
              <div
                className="pointer-events-none absolute -bottom-3 -right-2 z-10 flex h-[200px] w-[170px] items-end justify-end sm:h-[240px] sm:w-[200px] md:-bottom-8 md:-right-5 md:h-[min(320px,42vh)] md:w-[min(300px,46%)] lg:h-[340px] lg:w-[320px]"
                aria-hidden
              >
                <Image
                  src="/Vector.svg"
                  alt=""
                  width={324}
                  height={340}
                  className="h-full w-full max-w-none object-contain object-right object-bottom drop-shadow-sm"
                  unoptimized
                />
              </div>
            </div>

            <div className="overflow-hidden rounded-[24px] [&_.leaflet-control-attribution]:text-[11px]">
              <CheckoutSuccessMap
                mode={mode}
                lat={mapLat}
                lng={mapLng}
                className="h-[300px] rounded-[24px]"
              />
            </div>
          </div>

          <aside className="w-full shrink-0 md:w-[480px] md:max-w-[480px] md:sticky md:top-10 md:self-start">
            <OrderSummary
              lang={lang}
              items={items}
              itemCount={itemCount}
              subtotal={subtotal}
              discount={discount}
              deliveryFeeBani={deliveryFeeBani}
              mode={mode}
              selectedZone={selectedZone}
              grandTotal={grandTotal}
            />
          </aside>
        </div>
      </ClientContainer>

      <div className="fixed bottom-0 left-0 right-0 z-40 md:hidden">
        <div className="border-t border-[#eee] bg-white/95 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur-sm">
          <Link
            href="/"
            className={cn(
              "storefront-modal-cta flex h-12 w-full items-center justify-center rounded-full text-[16px] font-bold",
              checkoutCtaMotion,
            )}
          >
            Вернуться в меню
          </Link>
        </div>
      </div>

      <footer className="storefront-modal-field mt-auto hidden h-[120px] rounded-t-[48px] md:block">
        <ClientContainer className="flex h-full items-center justify-between">
          <Image
            src={brandLogo}
            alt=""
            width={brandSlug === "the-spot" ? 80 : 220}
            height={brandSlug === "the-spot" ? 47 : 84}
            className={cn(
              "w-auto object-contain object-left",
              brandSlug === "the-spot" ? "h-[42px]" : "h-[55px]",
            )}
            unoptimized
          />
          <a
            href="mailto:feedback@kitch.md"
            className="text-[14px] font-normal text-[#808080] hover:underline"
          >
            feedback@kitch.md
          </a>
        </ClientContainer>
      </footer>
    </div>
  )
}
