"use client"

import { brands } from "@/brands/index"
import type { ReceiptPricingBreakdown } from "@/lib/receipt-pricing-breakdown"
import { forwardRef } from "react"

export type { ReceiptPricingBreakdown } from "@/lib/receipt-pricing-breakdown"

export interface ReceiptProps {
  brandSlug: string
  orderNumber: string
  createdAt: string
  items: {
    name: string
    subtitle?: string
    qty: number
    price: number
    is_gift?: boolean
  }[]
  total: number
  bonusEarned: number
  bonusBalance: number
  channel: string
  customerName?: string
  deliveryAddress?: string
  courierName?: string
  /** Детализация скидок и доставки (предпочтительно). */
  pricing?: ReceiptPricingBreakdown
  /** Legacy fallback, если `pricing` не передан. */
  deliveryFee?: number
  discount?: number
  discountLabel?: string
  bonusRedeemed?: number
}

function formatMdl(amount: number): string {
  return amount.toLocaleString("ru-RU", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

export const ReceiptTemplate = forwardRef<HTMLDivElement, ReceiptProps>(
  function ReceiptTemplate(
    {
      brandSlug,
      orderNumber,
      createdAt,
      items,
      total,
      bonusEarned,
      bonusBalance,
      channel,
      customerName,
      deliveryAddress,
      courierName,
      pricing,
      deliveryFee,
      discount,
      discountLabel,
      bonusRedeemed,
    },
    ref,
  ) {
    const brand = brands.find((b) => b.slug === brandSlug)
      ?? brands.find((b) => b.slug === "losos")!
    const logoUrl = typeof window !== "undefined"
      ? `${window.location.origin}${brand.logo}`
      : brand.logo
    const brandPhone = brand.phone ?? ""
    const brandHours = brand.hours ?? ""
    const brandDomain = brand.domain
    const qrPayload = `https://${brandDomain}/?order=${encodeURIComponent(orderNumber)}`
    const qrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=320x320&margin=10&color=000000&bgcolor=ffffff&data=${encodeURIComponent(qrPayload)}`
    const trimmedCustomerName = customerName?.trim() ?? ""
    const trimmedDeliveryAddress = deliveryAddress?.trim() ?? ""
    const trimmedCourierName = courierName?.trim() ?? ""
    const showCustomerBlock =
      trimmedCustomerName.length > 0 ||
      trimmedDeliveryAddress.length > 0 ||
      trimmedCourierName.length > 0

    const breakdown = pricing ?? null
    const showPricingBreakdown =
      breakdown != null ||
      deliveryFee !== undefined ||
      (discount != null && discount > 0) ||
      (bonusRedeemed != null && bonusRedeemed > 0)

    const receiptRowStyle = {
      display: "flex" as const,
      justifyContent: "space-between" as const,
      gap: 12,
      fontSize: 19,
      fontWeight: 400 as const,
    }

    const receiptDiscountRowStyle = {
      ...receiptRowStyle,
      color: "#c00000",
    }

    return (
      <div
        ref={ref}
        style={{
          width: 576,
          backgroundColor: "#ffffff",
          color: "#000000",
          fontFamily:
            '"Google Sans", "Product Sans", var(--font-sans), Inter, ui-sans-serif, system-ui, sans-serif',
          fontSize: 22,
          lineHeight: 1.35,
          boxSizing: "border-box",
          margin: 0,
          paddingTop: 0,
          paddingBottom: 320,
        }}
      >
        {/* Шапка */}
        <div
          style={{
            color: "#000000",
            padding: "0 32px 20px",
            textAlign: "center",
            borderBottom: "3px solid #000000",
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={logoUrl}
            alt="LOSOS"
            width={360}
            height={88}
            style={{
              display: "block",
              height: 88,
              width: "auto",
              maxWidth: "100%",
            }}
          />
          <div
            style={{
              marginTop: 18,
              fontSize: 18,
              fontWeight: 700,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              color: "#000000",
            }}
          >
            Predcheck / Pre-check
          </div>
          <div
            style={{ marginTop: 8, fontSize: 18, fontWeight: 400, color: "#000000" }}
          >
            {createdAt}
          </div>
          <div
            style={{
              marginTop: 6,
              fontSize: 18,
              fontWeight: 700,
              textTransform: "uppercase",
              color: "#000000",
            }}
          >
            {channel}
          </div>
        </div>

        {/* Номер заказа в рамке */}
        <div style={{ padding: "24px 32px 8px" }}>
          <div
            style={{
              border: "4px solid #000000",
              borderRadius: 16,
              padding: "18px 16px",
              textAlign: "center",
            }}
          >
            <div
              style={{
                fontSize: 16,
                fontWeight: 700,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
              }}
            >
              Comanda / Заказ
            </div>
            <div
              style={{
                marginTop: 8,
                fontSize: 48,
                fontWeight: 700,
                fontFamily: "var(--font-mono), Roboto Mono, ui-monospace, monospace",
                letterSpacing: "0.04em",
              }}
            >
              #{orderNumber}
            </div>
          </div>
        </div>

        {showCustomerBlock ? (
          <div
            style={{
              border: "3px solid #000000",
              borderRadius: 16,
              padding: "16px 18px",
              margin: "8px 32px 0",
            }}
          >
            {trimmedCustomerName.length > 0 ? (
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 12,
                  fontSize: 19,
                }}
              >
                <span>Клиент / Client</span>
                <span>{trimmedCustomerName}</span>
              </div>
            ) : null}
            {trimmedDeliveryAddress.length > 0 ? (
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 12,
                  fontSize: 19,
                  marginTop: trimmedCustomerName.length > 0 ? 10 : 0,
                }}
              >
                <span>Adresă / Адрес</span>
                <span>{trimmedDeliveryAddress}</span>
              </div>
            ) : null}
            {trimmedCourierName.length > 0 ? (
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 12,
                  fontSize: 19,
                  marginTop:
                    trimmedCustomerName.length > 0 ||
                    trimmedDeliveryAddress.length > 0
                      ? 10
                      : 0,
                }}
              >
                <span>Curier / Курьер</span>
                <span>{trimmedCourierName}</span>
              </div>
            ) : null}
          </div>
        ) : null}

        <div
          style={{
            margin: "8px 32px 0",
            borderTop: "3px dashed #000000",
          }}
        />

        {/* Позиции */}
        <div style={{ padding: "20px 32px 8px" }}>
          {items.map((item, index) => (
            <div key={`${item.name}-${index}`}>
              {index > 0 ? (
                <div
                  style={{
                    margin: "14px 0",
                    borderTop: "2px dotted #000000",
                  }}
                />
              ) : null}
              <div
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  justifyContent: "space-between",
                  gap: 16,
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 22 }}>
                    {item.qty} × {item.name}
                    {item.is_gift ? " (Подарок)" : ""}
                  </div>
                  {item.subtitle ? (
                    <div
                      style={{
                        marginTop: 4,
                        fontSize: 17,
                        fontWeight: 400,
                        lineHeight: 1.3,
                      }}
                    >
                      {item.subtitle}
                    </div>
                  ) : null}
                </div>
                <div
                  style={{
                    flexShrink: 0,
                    fontWeight: 700,
                    fontSize: 22,
                    fontFamily:
                      "var(--font-mono), Roboto Mono, ui-monospace, monospace",
                    whiteSpace: "nowrap",
                  }}
                >
                  {formatMdl(item.is_gift ? 0 : item.price)}
                </div>
              </div>
            </div>
          ))}
        </div>

        {showPricingBreakdown ? (
          <div style={{ padding: "8px 32px 0" }}>
            {breakdown ? (
              <>
                <div style={receiptRowStyle}>
                  <span>Sumă fără reduceri / Сумма без скидок</span>
                  <span>{formatMdl(breakdown.subtotalMdl)} MDL</span>
                </div>
                {breakdown.itemDiscountMdl > 0 ? (
                  <div style={{ ...receiptDiscountRowStyle, marginTop: 8 }}>
                    <span>Reducere seturi / Скидка на сеты</span>
                    <span>−{formatMdl(breakdown.itemDiscountMdl)} MDL</span>
                  </div>
                ) : null}
                {breakdown.promoDiscountMdl > 0 ? (
                  <div style={{ ...receiptDiscountRowStyle, marginTop: 8 }}>
                    <span>
                      {breakdown.promoCode
                        ? `Promocod ${breakdown.promoCode} / Промокод ${breakdown.promoCode}`
                        : "Promocod / Промокод"}
                    </span>
                    <span>−{formatMdl(breakdown.promoDiscountMdl)} MDL</span>
                  </div>
                ) : null}
                {breakdown.bonusRedeemedMdl > 0 ? (
                  <div style={{ ...receiptDiscountRowStyle, marginTop: 8 }}>
                    <span>Bonusuri / Бонусы</span>
                    <span>−{formatMdl(breakdown.bonusRedeemedMdl)} MDL</span>
                  </div>
                ) : null}
                {breakdown.showDelivery ? (
                  <div style={{ ...receiptRowStyle, marginTop: 8 }}>
                    <span>Livrare / Доставка</span>
                    <span>
                      {breakdown.deliveryFeeMdl >= 0.01
                        ? `${formatMdl(breakdown.deliveryFeeMdl)} MDL`
                        : "Gratuit / Бесплатно"}
                    </span>
                  </div>
                ) : null}
              </>
            ) : (
              <>
                {deliveryFee !== undefined && deliveryFee >= 1 ? (
                  <div style={receiptRowStyle}>
                    <span>Livrare / Доставка</span>
                    <span>{formatMdl(deliveryFee)} MDL</span>
                  </div>
                ) : null}
                {deliveryFee === 0 ? (
                  <div style={receiptRowStyle}>
                    <span>Livrare / Доставка</span>
                    <span>Gratuit / Бесплатно</span>
                  </div>
                ) : null}
                {discount != null && discount > 0 ? (
                  <div
                    style={{
                      ...receiptDiscountRowStyle,
                      marginTop: deliveryFee !== undefined ? 8 : 0,
                    }}
                  >
                    <span>{discountLabel ?? "Reducere / Скидка"}</span>
                    <span>−{formatMdl(discount)} MDL</span>
                  </div>
                ) : null}
                {bonusRedeemed != null && bonusRedeemed > 0 ? (
                  <div style={{ ...receiptDiscountRowStyle, marginTop: 8 }}>
                    <span>Bonusuri / Бонусы</span>
                    <span>−{formatMdl(bonusRedeemed)} MDL</span>
                  </div>
                ) : null}
              </>
            )}
          </div>
        ) : null}

        <div
          style={{
            margin: "12px 32px 0",
            borderTop: "3px solid #000000",
          }}
        />

        {/* ИТОГО — инверсная плашка */}
        <div style={{ padding: "20px 32px 8px" }}>
          <div
            style={{
              backgroundColor: "#000000",
              color: "#ffffff",
              padding: "18px 20px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 16,
              borderRadius: 16,
            }}
          >
            <span
              style={{
                fontSize: 26,
                fontWeight: 700,
                letterSpacing: "0.06em",
                textTransform: "uppercase",
              }}
            >
              Total / Итого
            </span>
            <span
              style={{
                fontSize: 30,
                fontWeight: 700,
                fontFamily:
                  "var(--font-mono), Roboto Mono, ui-monospace, monospace",
              }}
            >
              {formatMdl(breakdown?.totalMdl ?? total)} MDL
            </span>
          </div>
        </div>

        {/* Бонусы — рамка */}
        <div style={{ padding: "16px 32px 8px" }}>
          <div
            style={{
              border: "3px solid #000000",
              borderRadius: 16,
              padding: "16px 18px",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: 12,
                fontSize: 19,
                fontWeight: 700,
              }}
            >
              <span>Bonus de acumulat / Начислится</span>
              <span
                style={{
                  fontFamily:
                    "var(--font-mono), Roboto Mono, ui-monospace, monospace",
                }}
              >
                +{formatMdl(bonusEarned)}
              </span>
            </div>
            <div
              style={{
                marginTop: 10,
                display: "flex",
                justifyContent: "space-between",
                gap: 12,
                fontSize: 19,
                fontWeight: 700,
              }}
            >
              <span>Sold bonus / Баланс</span>
              <span
                style={{
                  fontFamily:
                    "var(--font-mono), Roboto Mono, ui-monospace, monospace",
                }}
              >
                {formatMdl(bonusBalance)}
              </span>
            </div>
          </div>
        </div>

        {/* QR */}
        <div
          style={{
            padding: "24px 32px 8px",
            textAlign: "center",
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={qrSrc}
            alt="QR"
            width={280}
            height={280}
            style={{
              display: "inline-block",
              width: 280,
              height: 280,
              border: "4px solid #000000",
              borderRadius: 16,
              imageRendering: "pixelated",
            }}
          />
          <div
            style={{
              marginTop: 12,
              fontSize: 16,
              fontWeight: 700,
              letterSpacing: "0.04em",
            }}
          >
            {brandDomain}
          </div>
        </div>

        {/* Футер */}
        <div
          style={{
            marginTop: 8,
            padding: "20px 32px 32px",
            borderTop: "3px dashed #000000",
            textAlign: "center",
          }}
        >
          <div style={{ fontSize: 24, fontWeight: 700 }}>{brandPhone}</div>
          <div style={{ marginTop: 6, fontSize: 18, fontWeight: 400 }}>
            {brandHours}
          </div>
          <div
            style={{
              marginTop: 14,
              fontSize: 17,
              fontWeight: 700,
              lineHeight: 1.4,
            }}
          >
            Mulțumim! / Спасибо!
          </div>
          <div style={{ marginTop: 6, fontSize: 15, fontWeight: 400 }}>
            Sarmalute în foi de vită · Лосось запечённый
          </div>
        </div>
      </div>
    )
  },
)

ReceiptTemplate.displayName = "ReceiptTemplate"
