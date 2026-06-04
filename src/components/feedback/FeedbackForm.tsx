"use client"

import { getBrandBySlug } from "@/brands"
import { Camera, Check, Loader2, Star, X } from "lucide-react"
import Image from "next/image"
import { useEffect, useRef, useState } from "react"

type Lang = "ro" | "ru"

type FeedbackFormProps = {
  token: string
  brandSlug: string
}

const copy = {
  heading: {
    ro: "Parerea Dumneavoastra conteaza pentru noi",
    ru: "Ваше мнение важно для нас",
  },
  subheading: {
    ro: "Dorim ca fiecare client sa fie multumit. Spuneti-ne cum a fost comanda.",
    ru: "Мы хотим, чтобы каждый клиент остался доволен. Расскажите нам, как прошёл заказ.",
  },
  foodLabel: { ro: "Calitatea preparatelor", ru: "Качество блюд" },
  serviceLabel: { ro: "Viteza și serviciul", ru: "Скорость и сервис" },
  commentPlaceholder: {
    ro: "Comentariu (opțional)",
    ru: "Комментарий (необязательно)",
  },
  submit: { ro: "Trimite", ru: "Отправить" },
  thankYou: { ro: "Mulțumim frumos!", ru: "Спасибо большое!" },
  photoLabel: {
    ro: "Adaugati o poza (optional)",
    ru: "Прикрепите фото (необязательно)",
  },
  photoAdd: { ro: "Adauga poza", ru: "Добавить фото" },
  photoUploading: { ro: "Se incarca…", ru: "Загрузка…" },
  photoTypeError: {
    ro: "Doar imagini (JPEG, PNG, WebP)",
    ru: "Только изображения (JPEG, PNG, WebP)",
  },
  photoSizeError: {
    ro: "Fisierul trebuie sa fie sub 5 MB",
    ru: "Файл должен быть меньше 5 МБ",
  },
  photoUploadError: {
    ro: "Eroare la incarcarea pozei",
    ru: "Ошибка загрузки фото",
  },
} as const

const MAX_PHOTO_BYTES = 5 * 1024 * 1024
const MAX_PHOTOS = 3

type UploadedPhoto = {
  path: string
  previewUrl: string
}

/** Same logo paths/sizes as storefront header (`main-header.tsx`). */
function getFeedbackLogoMeta(brandSlug: string) {
  const brand = getBrandBySlug(brandSlug)
  switch (brand.slug) {
    case "the-spot":
      return {
        src: brand.logo,
        alt: brand.name,
        width: 80,
        height: 47,
        className: "mx-auto max-h-[48px] w-auto object-contain",
      }
    case "losos":
      return {
        src: brand.logo,
        alt: brand.name,
        width: 176,
        height: 56,
        className: "mx-auto max-h-[48px] w-auto object-contain",
      }
    default:
      return {
        src: brand.logo,
        alt: brand.name,
        width: 121,
        height: 56,
        className: "mx-auto max-h-[48px] w-auto object-contain",
      }
  }
}

function BrandLogo({ brandSlug }: { brandSlug: string }) {
  const logo = getFeedbackLogoMeta(brandSlug)
  return (
    <div className="mb-6 flex justify-center">
      <Image
        src={logo.src}
        alt={logo.alt}
        width={logo.width}
        height={logo.height}
        className={logo.className}
        priority
        unoptimized
      />
    </div>
  )
}

type StarRatingProps = {
  label: string
  value: number | null
  hoverValue: number | null
  onChange: (value: number) => void
  onHover: (value: number | null) => void
}

function StarRating({
  label,
  value,
  hoverValue,
  onChange,
  onHover,
}: StarRatingProps) {
  const display = hoverValue ?? value ?? 0

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-[var(--color-text)]">{label}</p>
      <div
        className="flex gap-1"
        onMouseLeave={() => onHover(null)}
        role="group"
        aria-label={label}
      >
        {[1, 2, 3, 4, 5].map((star) => {
          const filled = star <= display
          return (
            <button
              key={star}
              type="button"
              className="rounded p-0.5 transition-transform hover:scale-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
              onClick={() => onChange(star)}
              onMouseEnter={() => onHover(star)}
              aria-label={`${star}`}
            >
              <Star
                className="h-9 w-9"
                strokeWidth={1.5}
                style={{
                  color: filled
                    ? "var(--color-accent)"
                    : "var(--color-muted)",
                  fill: filled ? "var(--color-accent)" : "transparent",
                }}
              />
            </button>
          )
        })}
      </div>
    </div>
  )
}

const cardClassName =
  "w-full max-w-sm rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--color-bg)] p-6 text-[var(--color-text)] shadow-sm"

export function FeedbackForm({ token, brandSlug }: FeedbackFormProps) {
  const [lang, setLang] = useState<Lang>("ro")
  const [foodRating, setFoodRating] = useState<number | null>(null)
  const [serviceRating, setServiceRating] = useState<number | null>(null)
  const [foodHover, setFoodHover] = useState<number | null>(null)
  const [serviceHover, setServiceHover] = useState<number | null>(null)
  const [comment, setComment] = useState("")
  const [loading, setLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [uploadedPhotos, setUploadedPhotos] = useState<UploadedPhoto[]>([])
  const [uploading, setUploading] = useState(false)
  const [photoError, setPhotoError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const previewUrlsRef = useRef<string[]>([])

  const uploadedPaths = uploadedPhotos.map((p) => p.path)
  const canAddPhoto = uploadedPhotos.length < MAX_PHOTOS && !uploading

  useEffect(() => {
    previewUrlsRef.current = uploadedPhotos.map((p) => p.previewUrl)
  }, [uploadedPhotos])

  useEffect(() => {
    return () => {
      for (const url of previewUrlsRef.current) {
        URL.revokeObjectURL(url)
      }
    }
  }, [])

  async function handlePhotoFile(file: File) {
    if (!file.type.startsWith("image/")) {
      setPhotoError(copy.photoTypeError[lang])
      return
    }
    if (file.size > MAX_PHOTO_BYTES) {
      setPhotoError(copy.photoSizeError[lang])
      return
    }

    setPhotoError(null)
    setUploading(true)

    const previewUrl = URL.createObjectURL(file)
    const formData = new FormData()
    formData.set("file", file)

    try {
      const res = await fetch(`/api/feedback/${token}/upload`, {
        method: "POST",
        body: formData,
      })

      if (!res.ok) {
        URL.revokeObjectURL(previewUrl)
        const data = (await res.json().catch(() => null)) as {
          error?: string
        } | null
        setPhotoError(data?.error ?? copy.photoUploadError[lang])
        return
      }

      const data = (await res.json()) as { url?: string }
      if (!data.url) {
        URL.revokeObjectURL(previewUrl)
        setPhotoError(copy.photoUploadError[lang])
        return
      }

      setUploadedPhotos((prev) => [
        ...prev,
        { path: data.url!, previewUrl },
      ])
    } catch {
      URL.revokeObjectURL(previewUrl)
      setPhotoError(copy.photoUploadError[lang])
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ""
    }
  }

  function handlePhotoInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) void handlePhotoFile(file)
  }

  function handlePhotoDrop(e: React.DragEvent) {
    e.preventDefault()
    if (!canAddPhoto) return
    const file = e.dataTransfer.files?.[0]
    if (file) void handlePhotoFile(file)
  }

  function removePhoto(path: string) {
    setUploadedPhotos((prev) => {
      const removed = prev.find((p) => p.path === path)
      if (removed) URL.revokeObjectURL(removed.previewUrl)
      return prev.filter((p) => p.path !== path)
    })
  }

  const canSubmit =
    foodRating != null && serviceRating != null && !loading && !uploading

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!canSubmit || foodRating == null || serviceRating == null) return

    setLoading(true)
    setError(null)

    try {
      const res = await fetch(`/api/feedback/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          food_rating: foodRating,
          service_rating: serviceRating,
          comment: comment.trim() || undefined,
          ...(uploadedPaths.length > 0 ? { photo_urls: uploadedPaths } : {}),
        }),
      })

      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as {
          error?: string
          status?: string
        } | null
        if (data?.status === "expired") {
          setError(lang === "ro" ? "Link expirat" : "Ссылка устарела")
        } else if (data?.status === "already_submitted") {
          setSubmitted(true)
        } else {
          setError(
            data?.error ??
              (lang === "ro" ? "Eroare la trimitere" : "Ошибка отправки"),
          )
        }
        return
      }

      setSubmitted(true)
    } catch {
      setError(lang === "ro" ? "Eroare la trimitere" : "Ошибка отправки")
    } finally {
      setLoading(false)
    }
  }

  if (submitted) {
    return (
      <div className={`${cardClassName} p-8 text-center`}>
        <BrandLogo brandSlug={brandSlug} />
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[var(--color-accent)] text-[var(--color-accent-text)]">
          <Check className="h-10 w-10" strokeWidth={2.5} />
        </div>
        <p className="text-xl font-semibold text-[var(--color-text)]">
          {copy.thankYou[lang]} 🙏
        </p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className={`relative ${cardClassName}`}>
      <BrandLogo brandSlug={brandSlug} />

      <div className="absolute right-4 top-4 flex gap-1">
        {(["ro", "ru"] as const).map((code) => (
          <button
            key={code}
            type="button"
            onClick={() => setLang(code)}
            className={
              lang === code
                ? "rounded bg-[var(--color-accent)] px-2 py-0.5 text-xs font-semibold uppercase text-[var(--color-accent-text)]"
                : "rounded px-2 py-0.5 text-xs font-semibold uppercase text-[var(--color-muted)] transition-colors hover:text-[var(--color-text)]"
            }
          >
            {code}
          </button>
        ))}
      </div>

      <div className="pr-16">
        <h1 className="text-xl font-bold leading-tight text-[var(--color-text)]">
          {copy.heading[lang]}
        </h1>
        <p className="mt-2 text-sm leading-snug text-[var(--color-muted)]">
          {copy.subheading[lang]}
        </p>
      </div>

      <div className="mt-8 space-y-6">
        <StarRating
          label={copy.foodLabel[lang]}
          value={foodRating}
          hoverValue={foodHover}
          onChange={setFoodRating}
          onHover={setFoodHover}
        />
        <StarRating
          label={copy.serviceLabel[lang]}
          value={serviceRating}
          hoverValue={serviceHover}
          onChange={setServiceRating}
          onHover={setServiceHover}
        />

        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value.slice(0, 500))}
          rows={4}
          maxLength={500}
          placeholder={copy.commentPlaceholder[lang]}
          className="w-full resize-none rounded-[var(--radius-input)] border border-[var(--border)] bg-[var(--color-input-bg)] px-3 py-2.5 text-sm text-[var(--color-text)] placeholder:text-[var(--color-muted)] outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
        />

        <div className="space-y-2">
          <p className="text-sm font-medium text-[var(--color-text)]">
            {copy.photoLabel[lang]}
          </p>

          {uploadedPhotos.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {uploadedPhotos.map((photo) => (
                <div
                  key={photo.path}
                  className="relative size-20 overflow-hidden rounded-[var(--radius-input)] border border-[var(--border)]"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={photo.previewUrl}
                    alt=""
                    className="size-full object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => removePhoto(photo.path)}
                    className="absolute right-1 top-1 flex size-6 items-center justify-center rounded-full bg-[#242424]/80 text-white"
                    aria-label={lang === "ro" ? "Sterge poza" : "Удалить фото"}
                  >
                    <X className="size-3.5" />
                  </button>
                </div>
              ))}
            </div>
          ) : null}

          {canAddPhoto ? (
            <div
              role="button"
              tabIndex={0}
              onDragOver={(e) => e.preventDefault()}
              onDrop={handlePhotoDrop}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault()
                  fileInputRef.current?.click()
                }
              }}
              className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-[var(--radius-input)] border border-dashed border-[var(--border)] bg-[var(--color-input-bg)] px-4 py-6 transition-colors hover:border-[var(--color-accent)]"
              onClick={() => fileInputRef.current?.click()}
            >
              {uploading ? (
                <Loader2 className="size-8 animate-spin text-[var(--color-muted)]" />
              ) : (
                <Camera className="size-8 text-[var(--color-muted)]" />
              )}
              <span className="text-sm text-[var(--color-muted)]">
                {uploading ? copy.photoUploading[lang] : copy.photoAdd[lang]}
              </span>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/*"
                className="sr-only"
                onChange={handlePhotoInputChange}
              />
            </div>
          ) : null}

          {photoError ? (
            <p className="text-sm text-destructive" role="alert">
              {photoError}
            </p>
          ) : null}
        </div>

        {error ? (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={!canSubmit}
          className="w-full rounded-[var(--radius-button)] bg-[var(--color-accent)] px-6 py-3 text-base font-semibold text-[var(--color-accent-text)] transition-opacity disabled:cursor-not-allowed disabled:opacity-45"
        >
          {loading
            ? lang === "ro"
              ? "Se trimite…"
              : "Отправка…"
            : copy.submit[lang]}
        </button>
      </div>

      <input type="hidden" name="brand" value={brandSlug} readOnly />
    </form>
  )
}
