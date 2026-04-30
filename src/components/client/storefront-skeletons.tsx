import { ClientContainer } from "@/components/client/client-container"
import { cn } from "@/lib/utils"

type SkeletonBoxProps = {
  className?: string
}

type StorefrontSkeletonProps = {
  brandSlug?: string
}

function hasBoutiqueSkeleton(brandSlug: string): boolean {
  return brandSlug === "the-spot" || brandSlug === "losos"
}

function SkeletonBox({ className }: SkeletonBoxProps) {
  return (
    <div
      aria-hidden
      className={cn(
        "animate-pulse rounded-[var(--radius-card)] bg-white/75",
        className,
      )}
    />
  )
}

function SkeletonPill({ className }: SkeletonBoxProps) {
  return (
    <div
      aria-hidden
      className={cn("animate-pulse rounded-full bg-white/75", className)}
    />
  )
}

function PromotionSkeleton({ brandSlug = "kitch-pizza" }: StorefrontSkeletonProps) {
  const hasBoutiqueLayout = hasBoutiqueSkeleton(brandSlug)

  return (
    <section
      className={hasBoutiqueLayout ? "mb-5 w-full md:mb-5" : "w-full"}
      aria-hidden
    >
      <div
        className={cn(
          "flex overflow-hidden",
          hasBoutiqueLayout ? "gap-3 md:gap-5" : "gap-3",
        )}
      >
        <SkeletonBox
          className={cn(
            "aspect-[16/9] w-full shrink-0",
            hasBoutiqueLayout
              ? "md:w-auto md:flex-1"
              : "rounded-2xl md:w-[40%] lg:w-[28%]",
          )}
        />
        <SkeletonBox
          className={cn(
            "hidden aspect-[16/9] shrink-0 md:block",
            hasBoutiqueLayout
              ? "flex-1"
              : "rounded-2xl md:w-[40%] lg:w-[28%]",
          )}
        />
        <SkeletonBox
          className={cn(
            "hidden aspect-[16/9] shrink-0 lg:block",
            hasBoutiqueLayout ? "flex-1" : "rounded-2xl lg:w-[28%]",
          )}
        />
      </div>
    </section>
  )
}

function CategoryBarSkeleton() {
  return (
    <div className="sticky top-0 z-30 -mx-4 bg-[var(--color-bg)] px-4 py-3 md:mx-0 md:px-0">
      <div className="flex gap-2 overflow-hidden md:gap-3">
        <SkeletonPill className="h-11 w-28 shrink-0" />
        <SkeletonPill className="h-11 w-24 shrink-0" />
        <SkeletonPill className="h-11 w-32 shrink-0" />
        <SkeletonPill className="h-11 w-24 shrink-0" />
        <SkeletonPill className="hidden h-11 w-28 shrink-0 md:block" />
      </div>
    </div>
  )
}

function FeaturedSkeleton({ brandSlug = "kitch-pizza" }: StorefrontSkeletonProps) {
  if (!hasBoutiqueSkeleton(brandSlug)) return null

  return (
    <section className="mt-9 w-full space-y-6 md:mt-12 md:space-y-9">
      <div className="flex items-center justify-between gap-4">
        <SkeletonBox className="h-8 w-64 max-w-[70%] rounded-full" />
        <div className="flex gap-2">
          <SkeletonPill className="h-11 w-11" />
          <SkeletonPill className="h-11 w-11" />
        </div>
      </div>
      <div className="grid grid-cols-[minmax(0,1fr)_20%] gap-4 overflow-hidden md:grid-cols-3 md:gap-5">
        {Array.from({ length: 3 }).map((_, index) => (
          <SkeletonBox
            key={index}
            className={cn(
              "h-[150px] rounded-[12px] md:h-[170px]",
              index === 2 && "hidden md:block",
            )}
          />
        ))}
      </div>
    </section>
  )
}

function BoutiqueMenuCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-[12px] bg-white">
      <SkeletonBox className="aspect-square rounded-none bg-[var(--color-bg)]/65" />
      <div className="space-y-4 p-4">
        <div className="space-y-2">
          <SkeletonBox className="h-4 w-4/5 rounded-full bg-[var(--color-bg)]/75" />
          <SkeletonBox className="h-4 w-3/5 rounded-full bg-[var(--color-bg)]/75" />
        </div>
        <div className="flex items-center justify-between gap-3">
          <SkeletonBox className="h-4 w-24 rounded-full bg-[var(--color-bg)]/75" />
          <SkeletonPill className="h-9 w-12 bg-[var(--color-bg)]/75" />
        </div>
      </div>
    </div>
  )
}

function KitchMenuCardSkeleton() {
  return (
    <div className="client-menu-card border-b border-[#f0f0f0] pb-4 last:border-b-0 md:border-b-0 md:pb-0">
      <div className="flex gap-3 md:block">
        <SkeletonBox className="h-20 w-20 shrink-0 rounded-[12px] md:aspect-square md:h-auto md:w-full md:rounded-[24px] md:bg-[#f2f2f2]" />
        <div className="flex min-h-20 min-w-0 flex-1 flex-col justify-between gap-3 md:mt-4 md:min-h-0">
          <div className="space-y-2">
            <SkeletonBox className="h-4 w-3/4 rounded-full bg-[#f2f2f2]" />
            <SkeletonBox className="h-3 w-full rounded-full bg-[#f2f2f2]" />
            <SkeletonBox className="h-3 w-2/3 rounded-full bg-[#f2f2f2]" />
          </div>
          <div className="flex items-center gap-2">
            <SkeletonBox className="h-4 w-20 rounded-full bg-[#f2f2f2]" />
            <SkeletonPill className="h-8 w-20 bg-[#ecffa1]/80" />
          </div>
        </div>
      </div>
    </div>
  )
}

function MenuSkeleton({ brandSlug = "kitch-pizza" }: StorefrontSkeletonProps) {
  const hasBoutiqueLayout = hasBoutiqueSkeleton(brandSlug)

  return (
    <section
      className={
        hasBoutiqueLayout
          ? "mt-7 space-y-7 md:mt-9 md:space-y-9"
          : "mt-10 space-y-10"
      }
      aria-hidden
    >
      {Array.from({ length: 2 }).map((_, sectionIndex) => (
        <div key={sectionIndex}>
          <SkeletonBox
            className={cn(
              "mb-4 h-8 w-44 rounded-full md:h-9 md:w-56",
              hasBoutiqueLayout ? "md:mb-5" : "bg-[#f2f2f2]",
            )}
          />
          <div
            className={
              hasBoutiqueLayout
                ? "grid grid-cols-2 gap-4 md:grid-cols-3 md:gap-5 xl:grid-cols-4"
                : "client-menu-grid"
            }
          >
            {Array.from({ length: 8 }).map((__, cardIndex) => (
              hasBoutiqueLayout ? (
                <BoutiqueMenuCardSkeleton key={cardIndex} />
              ) : (
                <KitchMenuCardSkeleton key={cardIndex} />
              )
            ))}
          </div>
        </div>
      ))}
    </section>
  )
}

export function StorefrontHomeSkeleton({
  brandSlug = "kitch-pizza",
}: StorefrontSkeletonProps) {
  const hasBoutiqueLayout = hasBoutiqueSkeleton(brandSlug)

  return (
    <ClientContainer
      className={cn(
        hasBoutiqueLayout
          ? "px-4 pb-28 pt-3 md:pb-16 md:pt-2"
          : "py-10",
        brandSlug === "losos" && "max-w-[1180px] xl:px-0",
      )}
      data-brand={brandSlug}
      role="status"
      aria-label="Загрузка меню"
    >
      <PromotionSkeleton brandSlug={brandSlug} />
      {hasBoutiqueLayout ? <CategoryBarSkeleton /> : null}
      <FeaturedSkeleton brandSlug={brandSlug} />
      <MenuSkeleton brandSlug={brandSlug} />
      <span className="sr-only">Загрузка меню…</span>
    </ClientContainer>
  )
}

export function CheckoutSkeleton({
  brandSlug = "kitch-pizza",
}: StorefrontSkeletonProps) {
  const hasBoutiqueLayout = hasBoutiqueSkeleton(brandSlug)

  return (
    <div
      className="flex min-h-screen flex-col pb-[calc(88px+env(safe-area-inset-bottom))] md:pb-0"
      role="status"
      aria-label="Загрузка оформления заказа"
    >
      <ClientContainer>
        <div
          className={cn(
            "pt-4 md:pt-6",
            hasBoutiqueLayout ? "h-[104px] md:h-auto" : "pb-6",
          )}
        >
          <div
            className={cn(
              "flex items-center gap-3",
              hasBoutiqueLayout &&
                "fixed left-5 top-[max(1rem,env(safe-area-inset-top))] z-50 rounded-full bg-[var(--color-bg)] p-2 pr-5 shadow-sm ring-1 ring-black/5 md:static md:bg-transparent md:p-0 md:shadow-none md:ring-0",
            )}
          >
            <SkeletonPill className="size-11" />
            <SkeletonBox
              className={cn(
                "h-10 rounded-full",
                hasBoutiqueLayout ? "w-20" : "w-36 bg-[#f2f2f2]",
              )}
            />
          </div>
        </div>

        <div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_360px] lg:gap-7">
          <div className="storefront-checkout-form-panel space-y-4 rounded-[var(--radius-card)] p-0 md:p-7">
            {Array.from({ length: 4 }).map((_, index) => (
              <SkeletonBox key={index} className="h-32 rounded-[22px] bg-white" />
            ))}
          </div>
          <div className="hidden md:block">
            <SkeletonBox className="h-[520px] rounded-[24px] bg-white" />
          </div>
        </div>
      </ClientContainer>
      <span className="sr-only">Загрузка оформления заказа…</span>
    </div>
  )
}
