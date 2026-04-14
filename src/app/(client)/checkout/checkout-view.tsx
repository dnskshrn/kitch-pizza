"use client"

import { createOrder } from "@/lib/actions/create-order"
import { ClientContainer } from "@/components/client/client-container"
import { CheckoutProgressSteps } from "@/components/client/checkout/checkout-progress-steps"
import { OrderSummary } from "@/components/client/checkout/order-summary"
import { type CartLang } from "@/lib/cart-helpers"
import {
  getCartGrandTotalBani,
  selectCartDiscount,
  selectCartItemCount,
  selectCartSubtotal,
  useCartStore,
} from "@/lib/store/cart-store"
import { useDeliveryStore } from "@/lib/store/delivery-store"
import { useDeliveryModalStore } from "@/lib/store/delivery-modal-store"
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
import { useRouter } from "next/navigation"
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react"

const LANG_KEY = "lang"

function readLang(): CartLang {
  if (typeof window === "undefined") return "RU"
  return window.localStorage.getItem(LANG_KEY) === "RO" ? "RO" : "RU"
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
): string {
  if (mode === "pickup") {
    return "Самовывоз — bd. Dacia 27"
  }
  const base = resolvedAddress?.trim() ?? ""
  const details = `Подъезд ${deliveryDetailOrDash(entrance)}, Этаж ${deliveryDetailOrDash(floor)}, Квартира ${deliveryDetailOrDash(apartment)}, Домофон ${deliveryDetailOrDash(intercom)}`
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

const inputClassName =
  "w-full rounded-[12px] bg-[#f2f2f2] px-[16px] py-[14px] font-medium text-[16px] text-[#242424] placeholder:font-medium placeholder:text-[16px] placeholder:text-[#808080] outline-none focus:ring-2 focus:ring-[#ccff00]"

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
const checkoutLimeCta = `${btnMotion} hover:bg-[#b8f000] active:scale-[0.97]`
const checkoutLimeToggleOn = `${btnMotion} hover:bg-[#b8f000] active:scale-[0.98]`
const checkoutGrayToggle = `${btnMotion} hover:bg-[#e8e8e8] active:scale-[0.98]`
const checkoutIconCircle = `${btnMotion} hover:bg-[#e8e8e8] active:scale-[0.96]`
const checkoutWhiteMini = `${btnMotion} hover:bg-[#f5f5f5] active:scale-[0.98]`
const checkoutDarkSolid = `${btnMotion} hover:opacity-90 active:scale-[0.98]`

type FieldErrors = {
  name?: string
  phone?: string
  phoneRepeat?: string
  address?: string
  zone?: string
}

export function CheckoutView() {
  const router = useRouter()
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

  const [lang, setLang] = useState<CartLang>("RU")
  const [hydrated, setHydrated] = useState(false)

  const [name, setName] = useState("")
  const [phone, setPhone] = useState("")
  const [phoneRepeat, setPhoneRepeat] = useState("")
  const [deliveryTimeMode, setDeliveryTimeMode] = useState<"asap" | "scheduled">(
    "asap",
  )
  const [scheduledTime, setScheduledTime] = useState<string>("")
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

  const timeSlots = useMemo(() => buildDeliveryTimeSlots(), [])

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
    if (!hydrated) return
    if (items.length === 0) router.replace("/")
  }, [hydrated, items.length, router])

  useEffect(() => {
    if (
      deliveryTimeMode === "scheduled" &&
      timeSlots.length > 0 &&
      !scheduledTime
    ) {
      setScheduledTime(timeSlots[0] ?? "")
    }
  }, [deliveryTimeMode, timeSlots, scheduledTime])

  const deliveryFeeBani = getDeliveryFeeBani(subtotal)
  const grandTotal = getCartGrandTotalBani()

  const hasResolvedAddress = Boolean(resolvedAddress?.trim())
  const deliveryAddressCardBg = !hasResolvedAddress
    ? "bg-[#f2f2f2]"
    : selectedZone
      ? "bg-[#ECFFA1]"
      : outOfZone
        ? "bg-[#FFE1D4]"
        : "bg-[#f2f2f2]"

  const validate = useCallback((): FieldErrors => {
    const next: FieldErrors = {}
    if (!name.trim()) next.name = "Укажите имя"
    if (!phone.trim()) next.phone = "Укажите телефон"
    if (!phoneRepeat.trim()) next.phoneRepeat = "Повторите номер"
    else if (phone.trim() !== phoneRepeat.trim()) {
      next.phoneRepeat = "Номера не совпадают"
    }
    if (mode === "delivery") {
      if (!resolvedAddress?.trim()) next.address = "Укажите адрес доставки"
      if (!selectedZone) next.zone = "Выберите адрес в зоне доставки"
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
      setOrderSubmitError("Не удалось отправить заказ")
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

  if (!hydrated || items.length === 0) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-[#808080]">
        Загрузка…
      </div>
    )
  }

  return (
    <div className="flex min-h-screen flex-col pb-[calc(88px+env(safe-area-inset-bottom))] md:pb-0">
      {/* Top bar */}
      <div className="border-b border-transparent pt-4 md:pt-6">
        <ClientContainer>
          <div className="flex w-full items-center gap-3 md:justify-between md:gap-6">
            <div className="flex min-w-0 items-center gap-3 md:gap-6">
              <button
                type="button"
                onClick={handleBackNav}
                className={cn(
                "flex size-11 shrink-0 items-center justify-center rounded-full bg-[#f2f2f2] text-[#242424]",
                checkoutIconCircle,
              )}
                aria-label="Назад в корзину"
              >
                <ChevronLeft className="size-6" strokeWidth={2} />
              </button>

              {/* Мобилка: логотип рядом с «Назад» (без степпера) */}
              <div className="flex shrink-0 items-center md:hidden">
                <Image
                  src="/kitch-pizza-logo.svg"
                  alt="Kitch Pizza"
                  width={220}
                  height={84}
                  className="h-[55px] w-auto max-w-[min(200px,52vw)] object-contain object-left"
                  unoptimized
                />
              </div>

              {/* md+: логотип слева */}
              <div className="hidden shrink-0 md:block">
                <Image
                  src="/kitch-pizza-logo.svg"
                  alt="Kitch Pizza"
                  width={220}
                  height={84}
                  className="h-[55px] w-auto object-contain object-left"
                  unoptimized
                />
              </div>
            </div>

            {/* md+: прогресс компактный, справа */}
            <div className="hidden shrink-0 md:block">
              <CheckoutProgressSteps activeStep={2} />
            </div>
          </div>
        </ClientContainer>
      </div>

      <ClientContainer className="flex-1 py-6 md:py-10">
        <div className="flex flex-col gap-8 md:flex-row md:items-start md:gap-8 lg:gap-12">
          {/* Left column */}
          <div className="flex w-full max-w-full flex-col md:w-[680px] md:max-w-[680px]">
            <h1 className="hidden text-[32px] font-bold leading-tight text-[#242424] md:block">
              Заказ на доставку
            </h1>

            <h2 className="mt-8 text-[24px] font-bold leading-tight text-[#242424] md:mt-0 md:hidden">
              Контактные данные
            </h2>

            <div className="mt-5 flex flex-col gap-5 md:mt-6">
            {/* Contact */}
            <section className="flex flex-col gap-5">
              <h2 className="hidden text-[24px] font-bold text-[#242424] md:block lg:hidden">
                Контактные данные
              </h2>

              <div className="flex flex-col gap-5">
                <div className={checkoutRow}>
                  <label
                    htmlFor="checkout-name"
                    className={checkoutLabel}
                  >
                    Ваше имя
                  </label>
                  <div className="min-w-0 flex-1">
                    <input
                      ref={nameRef}
                      id="checkout-name"
                      name="name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Имя"
                      autoComplete="name"
                      className={inputClassName}
                      aria-invalid={!!errors.name}
                    />
                    {errors.name ? (
                      <p className="mt-1 text-[12px] font-normal text-red-500">
                        {errors.name}
                      </p>
                    ) : null}
                  </div>
                </div>

                <div className={checkoutRow}>
                  <label
                    htmlFor="checkout-phone"
                    className={checkoutLabel}
                  >
                    Номер телефона
                  </label>
                  <div className="min-w-0 flex-1">
                    <input
                      ref={phoneRef}
                      id="checkout-phone"
                      type="tel"
                      inputMode="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="Номер телефона"
                      autoComplete="tel"
                      className={inputClassName}
                      aria-invalid={!!errors.phone}
                    />
                    {errors.phone ? (
                      <p className="mt-1 text-[12px] font-normal text-red-500">
                        {errors.phone}
                      </p>
                    ) : null}
                  </div>
                </div>

                <div className={checkoutRow}>
                  <label
                    htmlFor="checkout-phone-repeat"
                    className={checkoutLabel}
                  >
                    Еще раз номер телефона
                  </label>
                  <div className="min-w-0 flex-1">
                    <input
                      ref={phoneRepeatRef}
                      id="checkout-phone-repeat"
                      type="tel"
                      inputMode="tel"
                      value={phoneRepeat}
                      onChange={(e) => setPhoneRepeat(e.target.value)}
                      placeholder="Еще раз номер телефона"
                      autoComplete="tel"
                      className={inputClassName}
                      aria-invalid={!!errors.phoneRepeat}
                    />
                    {errors.phoneRepeat ? (
                      <p className="mt-1 text-[12px] font-normal text-red-500">
                        {errors.phoneRepeat}
                      </p>
                    ) : null}
                  </div>
                </div>
              </div>
            </section>

            {/* Address */}
            <section ref={addressRef} className={checkoutRowStart}>
              <span className={checkoutLabelTop}>
                {mode === "delivery" ? "Адрес доставки" : "Самовывоз"}
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
                          Подъезд {deliveryDetailOrDash(entrance)}, Этаж{" "}
                          {deliveryDetailOrDash(floor)}, Квартира{" "}
                          {deliveryDetailOrDash(apartment)}, Домофон{" "}
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
                        Изменить
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between gap-3 rounded-[12px] bg-[#f2f2f2] p-[16px]">
                      <p className="min-w-0 flex-1 text-[16px] text-[#808080]">
                        Адрес не указан
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
                        Изменить
                      </button>
                    </div>
                  )
                ) : (
                  <div className="rounded-[12px] bg-[#f2f2f2] p-[16px]">
                    <p className="text-[16px] font-bold text-[#242424]">
                      bd. Dacia 27
                    </p>
                    <p className="mt-1 text-[12px] text-[#808080]">
                      Оформление без адреса доставки
                    </p>
                  </div>
                )}
                {submitAttempted && errors.address ? (
                  <p className="mt-2 text-[12px] font-normal text-red-500">
                    {errors.address}
                  </p>
                ) : null}
                {submitAttempted && errors.zone ? (
                  <p className="mt-2 text-[12px] font-normal text-red-500">
                    {errors.zone}
                  </p>
                ) : null}
              </div>
            </section>

            {/* Delivery time */}
            <section className={checkoutRowStart}>
              <span className={checkoutLabelTop}>Когда доставить?</span>
              <div className="min-w-0 flex-1">
                <div className="flex w-full gap-3">
                  <button
                    type="button"
                    onClick={() => setDeliveryTimeMode("asap")}
                    className={cn(
                      "flex min-h-[48px] min-w-0 flex-1 items-center justify-center gap-2 rounded-[12px] px-3 py-3 text-[14px] font-bold",
                      deliveryTimeMode === "asap"
                        ? cn("bg-[#ccff00] text-[#242424]", checkoutLimeToggleOn)
                        : cn("bg-[#f2f2f2] text-[#242424]", checkoutGrayToggle),
                    )}
                  >
                    <Zap className="size-[14px] shrink-0" strokeWidth={2} />
                    <span className="text-center leading-tight">
                      Как можно скорее
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeliveryTimeMode("scheduled")}
                    className={cn(
                      "flex min-h-[48px] min-w-0 flex-1 items-center justify-center gap-2 rounded-[12px] px-3 py-3 text-[14px] font-bold",
                      deliveryTimeMode === "scheduled"
                        ? cn("bg-[#ccff00] text-[#242424]", checkoutLimeToggleOn)
                        : cn("bg-[#f2f2f2] text-[#242424]", checkoutGrayToggle),
                    )}
                  >
                    <Clock className="size-[14px] shrink-0" strokeWidth={2} />
                    <span className="text-center leading-tight">
                      Указать время
                    </span>
                  </button>
                </div>
                {deliveryTimeMode === "scheduled" ? (
                  <div className="mt-4 w-full">
                    <Select
                      value={scheduledTime}
                      onValueChange={setScheduledTime}
                    >
                      <SelectTrigger className="h-[50px] w-full rounded-[12px] border-0 bg-[#f2f2f2] px-[16px] font-medium text-[16px] text-[#242424] transition-all duration-200 hover:bg-[#e8e8e8] focus:ring-2 focus:ring-[#ccff00]">
                        <SelectValue placeholder="Время доставки" />
                      </SelectTrigger>
                      <SelectContent>
                        {timeSlots.map((slot) => (
                          <SelectItem key={slot} value={slot}>
                            {slot}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ) : null}
              </div>
            </section>

            {/* Promo — как в корзине */}
            <section className={checkoutRowStart}>
              <span className={checkoutLabelTop}>Промокод</span>
              <div className="min-w-0 flex-1">
                {appliedPromo ? (
                  <div className="flex items-center gap-2 rounded-[12px] bg-[#f2f2f2] px-3 py-3">
                    <Check
                      className="size-5 shrink-0 text-[#5F7600]"
                      strokeWidth={2.5}
                      aria-hidden
                    />
                    <p className="min-w-0 flex-1 text-sm font-medium text-[#242424]">
                      Промокод{" "}
                      <span className="font-mono uppercase">{appliedPromo.code}</span>{" "}
                      применён
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
                      aria-label="Убрать промокод"
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
                        placeholder="Промокод"
                        value={promoInput}
                        disabled={promoLoading}
                        onChange={(e) => setPromoInput(e.target.value)}
                        onKeyDown={handlePromoKeyDown}
                        className="min-w-0 flex-1 rounded-[12px] bg-[#f2f2f2] px-4 py-3 font-mono uppercase text-[#242424] placeholder:text-[rgba(36,36,36,0.35)] disabled:opacity-60"
                        aria-label="Промокод"
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
                          "Применить"
                        )}
                      </button>
                    </div>
                    {promoError ? (
                      <p className="text-sm text-red-600" role="alert">
                        {promoError}
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
                Комментарий к заказу
              </label>
              <div className="min-w-0 flex-1">
                <textarea
                  id="checkout-comment"
                  name="comment"
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="Комментарий к заказу"
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
            <section className="mt-10 border-t border-[#f0f0f0] pt-10 md:mt-12 md:pt-12">
              <h3 className="mb-6 text-[24px] font-bold leading-tight text-[#242424] lg:hidden">
                Метод оплаты
              </h3>
              <div className={checkoutRowStart}>
                <span className={cn(checkoutLabelTop, "hidden lg:block")}>
                  Метод оплаты
                </span>
                <div className="min-w-0 flex-1 space-y-6">
                  <div className="flex w-full gap-3">
                    <button
                      type="button"
                      onClick={() => setPayment("cash")}
                      className={cn(
                        "flex min-h-[48px] min-w-0 flex-1 items-center justify-center gap-2 rounded-[12px] px-3 py-3 text-[14px] font-bold",
                        payment === "cash"
                          ? cn("bg-[#ccff00] text-[#242424]", checkoutLimeToggleOn)
                          : cn("bg-[#f2f2f2] text-[#242424]", checkoutGrayToggle),
                      )}
                    >
                      <Banknote className="size-[14px] shrink-0" strokeWidth={2} />
                      <span className="text-center leading-tight">Наличными</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setPayment("card")}
                      className={cn(
                        "flex min-h-[48px] min-w-0 flex-1 items-center justify-center gap-2 rounded-[12px] px-3 py-3 text-[14px] font-bold",
                        payment === "card"
                          ? cn("bg-[#ccff00] text-[#242424]", checkoutLimeToggleOn)
                          : cn("bg-[#f2f2f2] text-[#242424]", checkoutGrayToggle),
                      )}
                    >
                      <CreditCard className="size-[14px] shrink-0" strokeWidth={2} />
                      <span className="text-center leading-tight">
                        Картой курьеру
                      </span>
                    </button>
                  </div>
                  {payment === "cash" ? (
                    <div>
                      <p className="text-[16px] font-bold text-[#242424]">
                        С какой купюры потребуется сдача?
                      </p>
                      <div className="mt-2 flex items-center gap-2">
                        <input
                          type="text"
                          inputMode="numeric"
                          value={changeFrom}
                          onChange={(e) => setChangeFrom(e.target.value)}
                          className="w-[120px] rounded-[12px] bg-[#f2f2f2] px-[16px] py-[14px] font-medium text-[16px] text-[#242424] outline-none focus:ring-2 focus:ring-[#ccff00]"
                          placeholder="0"
                        />
                        <span className="text-[16px] font-medium text-[#242424]">
                          лей
                        </span>
                      </div>
                      <p className="mt-2 text-[12px] font-normal text-[#808080]">
                        Например: 50, 100, 200, 400, 600 и т.д.
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
              "flex h-[54px] w-full items-center justify-center gap-2 rounded-full bg-[#ccff00] text-[20px] font-bold text-[#242424] disabled:opacity-60",
              checkoutLimeCta,
            )}
          >
            {orderSubmitting ? (
              <Loader2 className="size-6 animate-spin" aria-hidden />
            ) : (
              <>
                Оформить заказ
                <ChevronRight className="size-5" strokeWidth={2} />
              </>
            )}
          </button>
        </div>
      </div>

      {/* Desktop footer */}
      <footer className="mt-auto hidden h-[120px] rounded-t-[48px] bg-[#f2f2f2] md:block">
        <ClientContainer className="flex h-full items-center justify-between">
          <Image
            src="/kitch-pizza-logo.svg"
            alt=""
            width={220}
            height={84}
            className="h-[55px] w-auto object-contain object-left"
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
