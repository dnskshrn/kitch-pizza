"use client"

import { brands } from "@/brands/index"
import { forwardRef } from "react"

export interface ReceiptProps {
  orderNumber: string
  createdAt: string
  items: { name: string; subtitle?: string; qty: number; price: number }[]
  total: number
  bonusEarned: number
  bonusBalance: number
  channel: string
}

const LOSOS_LOGO = brands.find((b) => b.slug === "losos")?.logo ?? "/Losos_Logo.svg"
const LOSOS_PHONE = brands.find((b) => b.slug === "losos")?.phone ?? "079 200 190"
const LOSOS_HOURS = brands.find((b) => b.slug === "losos")?.hours ?? "15:00 – 03:00"

function receiptLogoUrl(): string {
  if (typeof window === "undefined") return LOSOS_LOGO
  return `${window.location.origin}${LOSOS_LOGO}`
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
      orderNumber,
      createdAt,
      items,
      total,
      bonusEarned,
      bonusBalance,
      channel,
    },
    ref,
  ) {
    const qrPayload = `https://losos.md/?order=${encodeURIComponent(orderNumber)}`
    const qrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=320x320&margin=10&color=000000&bgcolor=ffffff&data=${encodeURIComponent(qrPayload)}`

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
        }}
      >
        {/* Инверсная шапка */}
        <div
          style={{
            backgroundColor: "#000000",
            color: "#ffffff",
            padding: "28px 32px 24px",
            textAlign: "center",
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={receiptLogoUrl()}
            alt="LOSOS"
            width={248}
            height={56}
            style={{
              display: "inline-block",
              height: 56,
              width: "auto",
              maxWidth: "100%",
              filter: "brightness(0) invert(1)",
            }}
          />
          <div
            style={{
              marginTop: 18,
              fontSize: 18,
              fontWeight: 700,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
            }}
          >
            Predcheck / Pre-check
          </div>
          <div style={{ marginTop: 8, fontSize: 18, fontWeight: 400 }}>
            {createdAt}
          </div>
          <div
            style={{
              marginTop: 6,
              fontSize: 18,
              fontWeight: 700,
              textTransform: "uppercase",
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
                  {formatMdl(item.price)}
                </div>
              </div>
            </div>
          ))}
        </div>

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
              {formatMdl(total)} MDL
            </span>
          </div>
        </div>

        {/* Бонусы — рамка */}
        <div style={{ padding: "16px 32px 8px" }}>
          <div
            style={{
              border: "3px solid #000000",
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
            losos.md
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
          <div style={{ fontSize: 24, fontWeight: 700 }}>{LOSOS_PHONE}</div>
          <div style={{ marginTop: 6, fontSize: 18, fontWeight: 400 }}>
            {LOSOS_HOURS}
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
