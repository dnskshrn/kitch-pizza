"use client"

import { createOrder } from "@/lib/actions/create-order"
import { ClientContainer } from "@/components/client/client-container"
import { CheckoutProgressSteps } from "@/components/client/checkout/checkout-progress-steps"
import { OrderSummary } from "@/components/client/checkout/order-summary"
import { CheckoutSkeleton } from "@/components/client/storefront-skeletons"
import { promoErrorMessage, type StorefrontMessages } from "@/lib/i18n/storefront"
import {
  getCartGrandTotalBani,
  selectCartDiscount,
  selectCartItemCount,
  selectCartSubtotal,
  useCartStore,
} from "@/lib/store/cart-store"
import { useDeliveryStore } from "@/lib/store/delivery-store"
import { useDeliveryModalStore } from "@/lib/store/delivery-modal-store"
import { useLanguage } from "@/lib/store/language-store"
import { cn } from "@/lib/utils"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Banknote,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  CreditCard,
  Loader2,
  MapPin,
  X,
  Zap,
} from "lucide-react"
import Image from "next/image"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react"

function hasBoutiqueCheckout(brandSlug: string): boolean {
  return brandSlug === "the-spot" || brandSlug === "losos"
}

function getCheckoutLogoSize(brandSlug: string) {
  if (brandSlug === "the-spot") {
    return { width: 80, height: 47, className: "h-[42px]" }
  }

  if (brandSlug === "losos") {
    return { width: 176, height: 56, className: "h-[42px]" }
  }

  return { width: 220, height: 84, className: "h-[55px]" }
}

/** Значение из модалки доставки; пусто → «-». */
function deliveryDetailOrDash(value: string): string {
  const t = value.trim()
  return t.length > 0 ? t : "-"
}

function parseChangeFromLeiToBani(raw: string): number | null {
  const t = raw.trim().replace(",", ".")
  if (!t) return null
  const n = Number.parseFloat(t)
  if (!Number.isFinite(n) || n < 0) return null
  return Math.round(n * 100)
}

function buildCheckoutDeliveryAddress(
  mode: "delivery" | "pickup",
  resolvedAddress: string | null,
  entrance: string,
  floor: string,
  apartment: string,
  intercom: string,
  t: StorefrontMessages,
): string {
  if (mode === "pickup") {
    return t.checkout.deliveryAddress.pickup
  }
  const base = resolvedAddress?.trim() ?? ""
  const labels = t.checkout.deliveryAddress
  const details = `${labels.entrance} ${deliveryDetailOrDash(entrance)}, ${labels.floor} ${deliveryDetailOrDash(floor)}, ${labels.apartment} ${deliveryDetailOrDash(apartment)}, ${labels.intercom} ${deliveryDetailOrDash(intercom)}`
  if (!base) return details
  return `${base}. ${details}`
}

/** Слоты с шагом 30 мин от (сейчас + 1 ч), округление вверх до получаса, до 23:00. */
function buildDeliveryTimeSlots(): string[] {
  const out: string[] = []
  const minTime = Date.now() + 60 * 60 * 1000
  let t = new Date(minTime)
  const m = t.getMinutes()
  if (m === 0) {
    /* ok */
  } else if (m <= 30) {
    t.setMinutes(30, 0, 0)
  } else {
    t.setHours(t.getHours() + 1, 0, 0, 0)
  }

  const end = new Date(t)
  end.setHours(23, 0, 0, 0)

  while (t.getTime() <= end.getTime()) {
    const hh = String(t.getHours()).padStart(2, "0")
    const mm = String(t.getMinutes()).padStart(2, "0")
    out.push(`${hh}:${mm}`)
    t = new Date(t.getTime() + 30 * 60 * 1000)
  }
  return out
}

function roundUpToQuarterHour(date: Date): Date {
  const rounded = new Date(date)
  const minutes = rounded.getMinutes()
  const nextQuarter = Math.ceil(minutes / 15) * 15
  if (nextQuarter === 60) {
    rounded.setHours(rounded.getHours() + 1, 0, 0, 0)
  } else {
    rounded.setMinutes(nextQuarter, 0, 0)
  }
  return rounded
}

function formatTimeSlot(date: Date): string {
  const hh = String(date.getHours()).padStart(2, "0")
  const mm = String(date.getMinutes()).padStart(2, "0")
  return `${hh}:${mm}`
}

function buildQuickDeliveryTimeSlots(): string[] {
  const now = Date.now()
  const end = new Date(now)
  end.setHours(23, 0, 0, 0)

  const offsetsMinutes = [60, 75, 90, 105, 120]
  return Array.from(
    new Set(
      offsetsMinutes
        .map((offset) => roundUpToQuarterHour(new Date(now + offset * 60 * 1000)))
        .filter((slot) => slot.getTime() <= end.getTime())
        .map(formatTimeSlot),
    ),
  )
}

const inputClassName =
  "storefront-modal-field w-full rounded-[12px] px-[16px] py-[14px] font-medium text-[16px] text-[#242424] placeholder:font-medium placeholder:text-[16px] placeholder:text-[#808080] outline-none focus:ring-2 focus:ring-[var(--color-accent)]"

/** lg+: подпись 240px слева, контент справа; уже lg — колонка с заголовком над полем (в т.ч. мобилка). */
const checkoutRow =
  "flex flex-col gap-2 lg:flex-row lg:items-center lg:gap-6"
const checkoutRowStart =
  "flex flex-col gap-2 lg:flex-row lg:items-start lg:gap-6"
const checkoutLabel =
  "block w-full shrink-0 text-[16px] font-bold leading-tight text-[#242424] lg:w-[240px]"
const checkoutLabelTop =
  "block w-full shrink-0 text-[16px] font-bold leading-tight text-[#242424] lg:w-[240px] lg:pt-[14px]"

/** Как на витрине (корзина в меню, CTA): плавный ховер + лёгкий press */
const btnMotion = "cursor-pointer transition-all duration-200 ease-out"
const checkoutCtaMotion = `${btnMotion} hover:brightness-95 active:scale-[0.97]`
const checkoutActiveToggle = `${btnMotion} hover:brightness-95 active:scale-[0.98]`
const checkoutGrayToggle = `${btnMotion} hover:bg-[#e8e8e8] active:scale-[0.98]`
const checkoutIconCircle = `${btnMotion} hover:bg-[#e8e8e8] active:scale-[0.96]`
const checkoutWhiteMini = `${btnMotion} hover:bg-[#f5f5f5] active:scale-[0.98]`
const checkoutDarkSolid = `${btnMotion} hover:opacity-90 active:scale-[0.98]`

type FieldErrors = {
  name?: keyof StorefrontMessages["checkout"]["validation"]
  phone?: keyof StorefrontMessages["checkout"]["validation"]
  phoneRepeat?: keyof StorefrontMessages["checkout"]["validation"]
  address?: keyof StorefrontMessages["checkout"]["validation"]
  zone?: keyof StorefrontMessages["checkout"]["validation"]
}

type CheckoutViewProps = {
  brandName: string
  brandLogo: string
  brandSlug: string
}

export function CheckoutView({
  brandName,
  brandLogo,
  brandSlug,
}: CheckoutViewProps) {
  const { lang, t } = useLanguage()
  const router = useRouter()
  const hasBoutiqueLayout = hasBoutiqueCheckout(brandSlug)
  const checkoutLogoSize = getCheckoutLogoSize(brandSlug)
  const openDeliveryModal = useDeliveryModalStore((s) => s.open)
  const openCart = useCartStore((s) => s.openCart)

  const items = useCartStore((s) => s.items)
  const appliedPromo = useCartStore((s) => s.appliedPromo)
  const promoError = useCartStore((s) => s.promoError)
  const promoLoading = useCartStore((s) => s.promoLoading)
  const applyPromo = useCartStore((s) => s.applyPromo)
  const removePromo = useCartStore((s) => s.removePromo)

  const subtotal = useCartStore(selectCartSubtotal)
  const discount = useCartStore(selectCartDiscount)
  const itemCount = useCartStore(selectCartItemCount)

  const mode = useDeliveryStore((s) => s.mode)
  const resolvedAddress = useDeliveryStore((s) => s.resolvedAddress)
  const selectedZone = useDeliveryStore((s) => s.selectedZone)
  const outOfZone = useDeliveryStore((s) => s.outOfZone)
  const entrance = useDeliveryStore((s) => s.entrance)
  const floor = useDeliveryStore((s) => s.floor)
  const apartment = useDeliveryStore((s) => s.apartment)
  const intercom = useDeliveryStore((s) => s.intercom)
  const getDeliveryFeeBani = useDeliveryStore((s) => s.getDeliveryFeeBani)

  const [hydrated, setHydrated] = useState(false)

  const [name, setName] = useState("")
  const [phone, setPhone] = useState("")
  const [phoneRepeat, setPhoneRepeat] = useState("")
  const [deliveryTimeMode, setDeliveryTimeMode] = useState<"asap" | "scheduled">(
    "asap",
  )
  const [scheduledTime, setScheduledTime] = useState<string>("")
  const [showCustomTimeSelect, setShowCustomTimeSelect] = useState(false)
  const [promoInput, setPromoInput] = useState("")
  const [comment, setComment] = useState("")
  const [payment, setPayment] = useState<"cash" | "card">("cash")
  const [changeFrom, setChangeFrom] = useState("")

  const [errors, setErrors] = useState<FieldErrors>({})
  const [submitAttempted, setSubmitAttempted] = useState(false)
  const [orderSubmitError, setOrderSubmitError] = useState<string | null>(null)
  const [orderSubmitting, setOrderSubmitting] = useState(false)

  const nameRef = useRef<HTMLInputElement>(null)
  const phoneRef = useRef<HTMLInputElement>(null)
  const phoneRepeatRef = useRef<HTMLInputElement>(null)
  const addressRef = useRef<HTMLDivElement>(null)

  const quickTimeSlots = useMemo(() => buildQuickDeliveryTimeSlots(), [])
  const timeSlots = useMemo(() => buildDeliveryTimeSlots(), [])

  useEffect(() => {
    if (useCartStore.persist.hasHydrated()) setHydrated(true)
    const unsub = useCartStore.persist.onFinishHydration(() =>
      setHydrated(true),
    )
    return unsub
  }, [])

  useEffect(() => {
    if (!hydrated) return
    if (items.length === 0) router.replace("/")
  }, [hydrated, items.length, router])

  useEffect(() => {
    if (
      deliveryTimeMode === "scheduled" &&
      (quickTimeSlots.length > 0 || timeSlots.length > 0) &&
      !scheduledTime
    ) {
      setScheduledTime(quickTimeSlots[0] ?? timeSlots[0] ?? "")
    }
  }, [deliveryTimeMode, quickTimeSlots, timeSlots, scheduledTime])

  const showTimeSelect = showCustomTimeSelect || quickTimeSlots.length === 0

  const deliveryFeeBani = getDeliveryFeeBani(subtotal)
  const grandTotal = getCartGrandTotalBani()

  const hasResolvedAddress = Boolean(resolvedAddress?.trim())
  const deliveryAddressCardBg = !hasResolvedAddress
    ? "storefront-checkout-address-empty"
    : selectedZone
      ? "storefront-checkout-address-ok"
      : outOfZone
        ? "storefront-checkout-address-bad"
        : "storefront-checkout-address-empty"

  const validate = useCallback((): FieldErrors => {
    const next: FieldErrors = {}
    if (!name.trim()) next.name = "nameRequired"
    if (!phone.trim()) next.phone = "phoneRequired"
    if (!phoneRepeat.trim()) next.phoneRepeat = "phoneRepeatRequired"
    else if (phone.trim() !== phoneRepeat.trim()) {
      next.phoneRepeat = "phoneMismatch"
    }
    if (mode === "delivery") {
      if (!resolvedAddress?.trim()) next.address = "addressRequired"
      if (!selectedZone) next.zone = "zoneRequired"
    }
    return next
  }, [name, phone, phoneRepeat, mode, resolvedAddress, selectedZone])

  const scrollToFirstError = useCallback((e: FieldErrors) => {
    if (e.name) {
      nameRef.current?.scrollIntoView({ behavior: "smooth", block: "center" })
      return
    }
    if (e.phone) {
      phoneRef.current?.scrollIntoView({ behavior: "smooth", block: "center" })
      return
    }
    if (e.phoneRepeat) {
      phoneRepeatRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      })
      return
    }
    if (e.address || e.zone) {
      addressRef.current?.scrollIntoView({ behavior: "smooth", block: "center" })
    }
  }, [])

  async function handleSubmit() {
    setSubmitAttempted(true)
    const next = validate()
    setErrors(next)
    if (Object.keys(next).length > 0) {
      scrollToFirstError(next)
      return
    }
    setOrderSubmitError(null)
    setOrderSubmitting(true)
    try {
      const changeFromBani =
        payment === "cash" ? parseChangeFromLeiToBani(changeFrom) : null
      const result = await createOrder({
        lang,
        userName: name.trim(),
        userPhone: phone.trim(),
        deliveryMode: mode,
        deliveryAddress: buildCheckoutDeliveryAddress(
          mode,
          resolvedAddress,
          entrance,
          floor,
          apartment,
          intercom,
          t,
        ),
        paymentMethod: payment,
        changeFromBani,
        deliveryTimeMode,
        scheduledTimeSlot:
          deliveryTimeMode === "scheduled" ? scheduledTime : null,
        comment: comment.trim() || null,
        promoCode: appliedPromo?.code ?? null,
        subtotalBani: subtotal,
        discountBani: discount,
        deliveryFeeBani,
        grandTotalBani: grandTotal,
        items,
      })
      if (result.success) {
        router.push(
          `/checkout/success?name=${encodeURIComponent(name.trim())}&order=${result.orderNumber}`,
        )
      } else {
        setOrderSubmitError(result.error)
      }
    } catch {
      setOrderSubmitError(t.checkout.submitFailed)
    } finally {
      setOrderSubmitting(false)
    }
  }

  function handleBackNav() {
    router.push("/")
    openCart()
  }

  async function handleApplyPromo() {
    await applyPromo(promoInput)
  }

  function handlePromoKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault()
      void handleApplyPromo()
    }
  }

  if (!hydrated) {
    return <CheckoutSkeleton brandSlug={brandSlug} />
  }

  if (items.length === 0) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-[#808080]">
        {t.checkout.loading}
      </div>
    )
  }

  return (
    <div className="flex min-h-screen flex-col pb-[calc(88px+env(safe-area-inset-bottom))] md:pb-0">
      {/* Top bar */}
      <div
        className={cn(
          "border-b border-transparent pt-4 md:pt-6",
          hasBoutiqueLayout && "h-[104px] md:h-auto",
        )}
      >
        <ClientContainer>
          <div className="flex w-full items-center gap-3 md:justify-between md:gap-6">
            <div
              className={cn(
                "flex min-w-0 items-center gap-3 md:gap-6",
                hasBoutiqueLayout &&
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
                aria-label={t.checkout.backToCart}
              >
                <ChevronLeft className="size-6" strokeWidth={2} />
              </button>

              {/* Мобилка: логотип рядом с «Назад» (без степпера) */}
              <Link
                href="/"
                className="flex shrink-0 items-center md:hidden"
                aria-label={t.common.brandHome(brandName)}
              >
                <Image
                  src={brandLogo}
                  alt={brandName}
                  width={checkoutLogoSize.width}
                  height={checkoutLogoSize.height}
                  className={cn(
                    "w-auto max-w-[min(200px,52vw)] object-contain object-left",
                    checkoutLogoSize.className,
                  )}
                  unoptimized
                />
              </Link>

              {/* md+: логотип слева */}
              <Link
                href="/"
                className="hidden shrink-0 md:block"
                aria-label={t.common.brandHome(brandName)}
              >
                <Image
                  src={brandLogo}
                  alt={brandName}
                  width={checkoutLogoSize.width}
                  height={checkoutLogoSize.height}
                  className={cn(
                    "w-auto object-contain object-left",
                    checkoutLogoSize.className,
                  )}
                  unoptimized
                />
              </Link>
            </div>

            {/* md+: прогресс компактный, справа */}
            <div className="hidden shrink-0 md:block">
              <CheckoutProgressSteps activeStep={2} />
            </div>
          </div>
        </ClientContainer>
      </div>

      <ClientContainer
        className={cn(
          "flex-1 py-6 md:py-10",
          hasBoutiqueLayout && "max-md:py-4",
        )}
      >
        <div
          className={cn(
            "flex flex-col gap-8 md:flex-row md:items-start md:gap-8 lg:gap-12",
            hasBoutiqueLayout && "max-md:gap-5",
          )}
        >
          {/* Left column */}
          <div className="storefront-checkout-form-panel flex w-full max-w-full flex-col md:w-[680px] md:max-w-[680px]">
            <h1 className="hidden text-[32px] font-bold leading-tight text-[#242424] md:block">
              {t.checkout.addressTitle}
            </h1>

            <h2
              className={cn(
                "mt-8 text-[24px] font-bold leading-tight text-[#242424] md:mt-0 md:hidden",
                hasBoutiqueLayout && "max-md:mt-3",
              )}
            >
              {t.checkout.contactTitle}
            </h2>

            <div
              className={cn(
                "mt-5 flex flex-col gap-5 md:mt-6",
                hasBoutiqueLayout && "max-md:mt-4",
              )}
            >
            {/* Contact */}
            <section className="flex flex-col gap-5">
              <h2 className="hidden text-[24px] font-bold text-[#242424] md:block lg:hidden">
                {t.checkout.contactTitle}
              </h2>

              <div className="flex flex-col gap-5">
                <div className={checkoutRow}>
                  <label
                    htmlFor="checkout-name"
                    className={checkoutLabel}
                  >
                    {t.checkout.nameLabel}
                  </label>
                  <div className="min-w-0 flex-1">
                    <input
                      ref={nameRef}
                      id="checkout-name"
                      name="name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder={t.checkout.namePlaceholder}
                      autoComplete="name"
                      className={inputClassName}
                      aria-invalid={!!errors.name}
                    />
                    {errors.name ? (
                      <p className="mt-1 text-[12px] font-normal text-red-500">
                        {t.checkout.validation[errors.name]}
                      </p>
                    ) : null}
                  </div>
                </div>

                <div className={checkoutRow}>
                  <label
                    htmlFor="checkout-phone"
                    className={checkoutLabel}
                  >
                    {t.checkout.phoneLabel}
                  </label>
                  <div className="min-w-0 flex-1">
                    <input
                      ref={phoneRef}
                      id="checkout-phone"
                      type="tel"
                      inputMode="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder={t.checkout.phonePlaceholder}
                      autoComplete="tel"
                      className={inputClassName}
                      aria-invalid={!!errors.phone}
                    />
                    {errors.phone ? (
                      <p className="mt-1 text-[12px] font-normal text-red-500">
                        {t.checkout.validation[errors.phone]}
                      </p>
                    ) : null}
                  </div>
                </div>

                <div className={checkoutRow}>
                  <label
                    htmlFor="checkout-phone-repeat"
                    className={checkoutLabel}
                  >
                    {t.checkout.phoneRepeatLabel}
                  </label>
                  <div className="min-w-0 flex-1">
                    <input
                      ref={phoneRepeatRef}
                      id="checkout-phone-repeat"
                      type="tel"
                      inputMode="tel"
                      value={phoneRepeat}
                      onChange={(e) => setPhoneRepeat(e.target.value)}
                      placeholder={t.checkout.phoneRepeatPlaceholder}
                      autoComplete="tel"
                      className={inputClassName}
                      aria-invalid={!!errors.phoneRepeat}
                    />
                    {errors.phoneRepeat ? (
                      <p className="mt-1 text-[12px] font-normal text-red-500">
                        {t.checkout.validation[errors.phoneRepeat]}
                      </p>
                    ) : null}
                  </div>
                </div>
              </div>
            </section>

            {/* Address */}
            <section ref={addressRef} className={checkoutRowStart}>
              <span className={checkoutLabelTop}>
                {mode === "delivery" ? t.checkout.addressTitle : t.checkout.pickupTitle}
              </span>
              <div className="min-w-0 flex-1">
                {mode === "delivery" ? (
                  resolvedAddress ? (
                    <div
                      className={cn(
                        "flex items-start justify-between gap-3 rounded-[12px] p-[16px]",
                        deliveryAddressCardBg,
                      )}
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-[16px] font-bold text-[#242424]">
                          {resolvedAddress}
                        </p>
                        <p className="mt-1 text-[13px] font-normal leading-snug text-[#242424]">
                          {t.checkout.deliveryAddress.entrance}{" "}
                          {deliveryDetailOrDash(entrance)},{" "}
                          {t.checkout.deliveryAddress.floor}{" "}
                          {deliveryDetailOrDash(floor)},{" "}
                          {t.checkout.deliveryAddress.apartment}{" "}
                          {deliveryDetailOrDash(apartment)},{" "}
                          {t.checkout.deliveryAddress.intercom}{" "}
                          {deliveryDetailOrDash(intercom)}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => openDeliveryModal()}
                        className={cn(
                          "flex shrink-0 items-center gap-1.5 rounded-[8px] bg-white px-[16px] py-[8px] text-[14px] font-medium text-[#242424]",
                          checkoutWhiteMini,
                        )}
                      >
                        <MapPin className="size-4 shrink-0" strokeWidth={2} />
                        {t.checkout.changeAddress}
                      </button>
                    </div>
                  ) : (
                    <div className="storefront-checkout-address-empty flex items-center justify-between gap-3 rounded-[12px] p-[16px]">
                      <p className="min-w-0 flex-1 text-[16px] text-[#808080]">
                        {t.checkout.validation.addressRequired}
                      </p>
                      <button
                        type="button"
                        onClick={() => openDeliveryModal()}
                        className={cn(
                          "flex shrink-0 items-center gap-1.5 rounded-[8px] bg-white px-[16px] py-[8px] text-[14px] font-medium text-[#242424]",
                          checkoutWhiteMini,
                        )}
                      >
                        <MapPin className="size-4 shrink-0" strokeWidth={2} />
                        {t.checkout.changeAddress}
                      </button>
                    </div>
                  )
                ) : (
                  <div className="storefront-checkout-address-empty rounded-[12px] p-[16px]">
                    <p className="text-[16px] font-bold text-[#242424]">
                      bd. Dacia 27
                    </p>
                    <p className="mt-1 text-[12px] text-[#808080]">
                      {t.checkout.pickupTitle}
                    </p>
                  </div>
                )}
                {submitAttempted && errors.address ? (
                  <p className="mt-2 text-[12px] font-normal text-red-500">
                    {t.checkout.validation[errors.address]}
                  </p>
                ) : null}
                {submitAttempted && errors.zone ? (
                  <p className="mt-2 text-[12px] font-normal text-red-500">
                    {t.checkout.validation[errors.zone]}
                  </p>
                ) : null}
              </div>
            </section>

            {/* Delivery time */}
            <section className={checkoutRowStart}>
              <span className={checkoutLabelTop}>{t.checkout.deliveryTimeTitle}</span>
              <div className="min-w-0 flex-1">
                <div className="flex w-full gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setDeliveryTimeMode("asap")
                      setShowCustomTimeSelect(false)
                    }}
                    className={cn(
                      "flex min-h-[48px] min-w-0 flex-1 items-center justify-center gap-2 rounded-[12px] px-3 py-3 text-[14px] font-bold",
                      deliveryTimeMode === "asap"
                        ? cn("storefront-checkout-toggle-active", checkoutActiveToggle)
                        : cn("storefront-modal-field text-[#242424]", checkoutGrayToggle),
                    )}
                  >
                    <Zap className="size-[14px] shrink-0" strokeWidth={2} />
                    <span className="text-center leading-tight">
                      {t.checkout.asap}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setDeliveryTimeMode("scheduled")
                      setShowCustomTimeSelect(false)
                      setScheduledTime((current) =>
                        current || quickTimeSlots[0] || timeSlots[0] || "",
                      )
                    }}
                    className={cn(
                      "flex min-h-[48px] min-w-0 flex-1 items-center justify-center gap-2 rounded-[12px] px-3 py-3 text-[14px] font-bold",
                      deliveryTimeMode === "scheduled"
                        ? cn("storefront-checkout-toggle-active", checkoutActiveToggle)
                        : cn("storefront-modal-field text-[#242424]", checkoutGrayToggle),
                    )}
                  >
                    <Clock className="size-[14px] shrink-0" strokeWidth={2} />
                    <span className="text-center leading-tight">
                      {t.checkout.scheduled}
                    </span>
                  </button>
                </div>
                {deliveryTimeMode === "scheduled" ? (
                  <div className="mt-4 flex w-full flex-col gap-3">
                    {quickTimeSlots.length > 0 ? (
                      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                        {quickTimeSlots.map((slot) => {
                          const isSelected =
                            scheduledTime === slot && !showCustomTimeSelect
                          return (
                            <button
                              key={slot}
                              type="button"
                              onClick={() => {
                                setScheduledTime(slot)
                                setShowCustomTimeSelect(false)
                              }}
                              className={cn(
                                "min-h-[44px] rounded-[12px] px-3 text-[15px] font-bold tabular-nums",
                                isSelected
                                  ? cn(
                                      "storefront-checkout-toggle-active",
                                      checkoutActiveToggle,
                                    )
                                  : cn(
                                      "storefront-modal-field text-[#242424]",
                                      checkoutGrayToggle,
                                    ),
                              )}
                            >
                              {slot}
                            </button>
                          )
                        })}
                        <button
                          type="button"
                          onClick={() => {
                            setShowCustomTimeSelect(true)
                            setScheduledTime((current) =>
                              timeSlots.includes(current)
                                ? current
                                : timeSlots[0] || current,
                            )
                          }}
                          className={cn(
                            "min-h-[44px] rounded-[12px] px-3 text-[15px] font-bold",
                            showCustomTimeSelect
                              ? cn(
                                  "storefront-checkout-toggle-active",
                                  checkoutActiveToggle,
                                )
                              : cn(
                                  "storefront-modal-field text-[#242424]",
                                  checkoutGrayToggle,
                                ),
                          )}
                        >
                          {t.checkout.chooseTime}
                        </button>
                      </div>
                    ) : null}

                    {showTimeSelect ? (
                      <Select
                        value={scheduledTime}
                        onValueChange={setScheduledTime}
                      >
                        <SelectTrigger className="storefront-modal-field h-[50px] w-full rounded-[12px] border-0 px-[16px] font-medium text-[16px] text-[#242424] transition-all duration-200 hover:bg-[#e8e8e8] focus:ring-2 focus:ring-[var(--color-accent)]">
                          <SelectValue placeholder={t.checkout.deliveryTimeTitle} />
                        </SelectTrigger>
                        <SelectContent>
                          {timeSlots.map((slot) => (
                            <SelectItem key={slot} value={slot}>
                              {slot}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </section>

            {/* Promo — как в корзине */}
            <section className={checkoutRowStart}>
              <span className={checkoutLabelTop}>{t.checkout.promoTitle}</span>
              <div className="min-w-0 flex-1">
                {appliedPromo ? (
                  <div className="storefront-modal-field flex items-center gap-2 rounded-[12px] px-3 py-3">
                    <Check
                      className="storefront-modal-accent size-5 shrink-0"
                      strokeWidth={2.5}
                      aria-hidden
                    />
                    <p className="min-w-0 flex-1 text-sm font-medium text-[#242424]">
                      {t.cart.promoApplied(appliedPromo.code)}
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        removePromo()
                        setPromoInput("")
                      }}
                      className={cn(
                        "flex size-9 shrink-0 items-center justify-center rounded-full text-[#242424] hover:bg-black/10",
                        btnMotion,
                        "active:scale-95",
                      )}
                      aria-label={t.cart.removePromo}
                    >
                      <X className="size-4" strokeWidth={2.5} />
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-col gap-2">
                    <div className="flex gap-2">
                      <input
                        type="text"
                        name="promo"
                        placeholder={t.cart.promoPlaceholder}
                        value={promoInput}
                        disabled={promoLoading}
                        onChange={(e) => setPromoInput(e.target.value)}
                        onKeyDown={handlePromoKeyDown}
                        className="storefront-modal-field min-w-0 flex-1 rounded-[12px] px-4 py-3 font-mono uppercase text-[#242424] placeholder:text-[rgba(36,36,36,0.35)] disabled:opacity-60"
                        aria-label={t.cart.promoAria}
                        autoComplete="off"
                      />
                      <button
                        type="button"
                        onClick={() => void handleApplyPromo()}
                        disabled={promoLoading || !promoInput.trim()}
                        className={cn(
                          "shrink-0 rounded-[12px] bg-[#242424] px-4 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40",
                          checkoutDarkSolid,
                        )}
                      >
                        {promoLoading ? (
                          <Loader2 className="size-5 animate-spin" aria-hidden />
                        ) : (
                          t.cart.applyPromo
                        )}
                      </button>
                    </div>
                    {promoError ? (
                      <p className="text-sm text-red-600" role="alert">
                        {promoErrorMessage(promoError, lang)}
                      </p>
                    ) : null}
                  </div>
                )}
              </div>
            </section>

            {/* Comment */}
            <section className={checkoutRowStart}>
              <label
                htmlFor="checkout-comment"
                className={checkoutLabelTop}
              >
                {t.checkout.commentTitle}
              </label>
              <div className="min-w-0 flex-1">
                <textarea
                  id="checkout-comment"
                  name="comment"
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder={t.checkout.commentPlaceholder}
                  rows={4}
                  className={cn(
                    inputClassName,
                    "h-[120px] resize-none",
                  )}
                />
              </div>
            </section>
            </div>

            {/* Payment — визуально отдельный блок */}
            <section
              className={cn(
                "mt-10 border-t border-[#f0f0f0] pt-10 md:mt-12 md:pt-12",
                hasBoutiqueLayout &&
                  "max-md:mt-8 max-md:border-[rgb(36_36_36/0.08)] max-md:pt-8",
              )}
            >
              <h3 className="mb-6 text-[24px] font-bold leading-tight text-[#242424] lg:hidden">
                {t.checkout.paymentTitle}
              </h3>
              <div className={checkoutRowStart}>
                <span className={cn(checkoutLabelTop, "hidden lg:block")}>
                  {t.checkout.paymentTitle}
                </span>
                <div className="min-w-0 flex-1 space-y-6">
                  <div className="flex w-full gap-3">
                    <button
                      type="button"
                      onClick={() => setPayment("cash")}
                      className={cn(
                        "flex min-h-[48px] min-w-0 flex-1 items-center justify-center gap-2 rounded-[12px] px-3 py-3 text-[14px] font-bold",
                        payment === "cash"
                          ? cn("storefront-checkout-toggle-active", checkoutActiveToggle)
                          : cn("storefront-modal-field text-[#242424]", checkoutGrayToggle),
                      )}
                    >
                      <Banknote className="size-[14px] shrink-0" strokeWidth={2} />
                      <span className="text-center leading-tight">{t.checkout.cash}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setPayment("card")}
                      className={cn(
                        "flex min-h-[48px] min-w-0 flex-1 items-center justify-center gap-2 rounded-[12px] px-3 py-3 text-[14px] font-bold",
                        payment === "card"
                          ? cn("storefront-checkout-toggle-active", checkoutActiveToggle)
                          : cn("storefront-modal-field text-[#242424]", checkoutGrayToggle),
                      )}
                    >
                      <CreditCard className="size-[14px] shrink-0" strokeWidth={2} />
                      <span className="text-center leading-tight">
                        {t.checkout.card}
                      </span>
                    </button>
                  </div>
                  {payment === "cash" ? (
                    <div>
                      <p className="text-[16px] font-bold text-[#242424]">
                        {t.checkout.changeQuestion}
                      </p>
                      <div className="mt-2 flex items-center gap-2">
                        <input
                          type="text"
                          inputMode="numeric"
                          value={changeFrom}
                          onChange={(e) => setChangeFrom(e.target.value)}
                          className="storefront-modal-field w-[120px] rounded-[12px] px-[16px] py-[14px] font-medium text-[16px] text-[#242424] outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
                          placeholder={t.checkout.changePlaceholder}
                        />
                        <span className="text-[16px] font-medium text-[#242424]">
                          {lang === "RO" ? "lei" : "лей"}
                        </span>
                      </div>
                      <p className="mt-2 text-[12px] font-normal text-[#808080]">
                        {lang === "RO"
                          ? "De exemplu: 50, 100, 200, 400, 600 etc."
                          : "Например: 50, 100, 200, 400, 600 и т.д."}
                      </p>
                    </div>
                  ) : null}
                </div>
              </div>
            </section>
          </div>

          {/* Right column — summary */}
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
              onCheckout={handleSubmit}
              checkoutSubmitting={orderSubmitting}
              checkoutError={orderSubmitError}
            />
          </aside>
        </div>
      </ClientContainer>

      {/* Mobile sticky CTA */}
      <div className="fixed bottom-0 left-0 right-0 z-40 md:hidden">
        <div className="border-t border-[#eee] bg-white/95 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur-sm">
          {orderSubmitError ? (
            <p className="mb-2 text-center text-[13px] text-red-600" role="alert">
              {orderSubmitError}
            </p>
          ) : null}
          <button
            type="button"
            onClick={() => void handleSubmit()}
            disabled={orderSubmitting}
            className={cn(
              "storefront-modal-cta flex h-[54px] w-full items-center justify-center gap-2 rounded-full text-[20px] font-bold disabled:opacity-60",
              checkoutCtaMotion,
            )}
          >
            {orderSubmitting ? (
              <Loader2 className="size-6 animate-spin" aria-hidden />
            ) : (
              <>
                {t.checkout.submit}
                <ChevronRight className="size-5" strokeWidth={2} />
              </>
            )}
          </button>
        </div>
      </div>

      {/* Desktop footer */}
      <footer className="storefront-modal-field mt-auto hidden h-[120px] rounded-t-[48px] md:block">
        <ClientContainer className="flex h-full items-center justify-between">
          <Image
            src={brandLogo}
            alt=""
            width={checkoutLogoSize.width}
            height={checkoutLogoSize.height}
            className={cn(
              "w-auto object-contain object-left",
              checkoutLogoSize.className,
            )}
            unoptimized
          />
          <a
            href="mailto:feedback@kitch.md"
            className="text-[20px] font-medium text-[#808080] hover:underline"
          >
            feedback@kitch.md
          </a>
        </ClientContainer>
      </footer>
    </div>
  )
}
