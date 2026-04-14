import { cn } from "@/lib/utils"

export type CheckoutProgressStep = 1 | 2 | 3

type CheckoutProgressStepsProps = {
  activeStep: CheckoutProgressStep
}

export function CheckoutProgressSteps({ activeStep }: CheckoutProgressStepsProps) {
  return (
    <div
      className="flex w-max max-w-full items-center gap-1 overflow-x-auto pb-1 [-webkit-overflow-scrolling:touch] md:gap-3"
      aria-label="Этапы оформления заказа"
    >
      <StepPill n={1} label="Корзина" active={activeStep === 1} />
      <div
        className="h-0 w-6 shrink-0 border-t-2 border-dashed border-[#ccc] md:w-8"
        aria-hidden
      />
      <StepPill n={2} label="Оформление заказа" active={activeStep === 2} />
      <div
        className="h-0 w-6 shrink-0 border-t-2 border-dashed border-[#ccc] md:w-8"
        aria-hidden
      />
      <StepPill n={3} label="Заказ отправлен" active={activeStep === 3} />
    </div>
  )
}

function StepPill({
  n,
  label,
  active,
}: {
  n: number
  label: string
  active: boolean
}) {
  return (
    <div
      className={cn(
        "flex shrink-0 items-center gap-3 rounded-[12px] px-[16px] py-[8px]",
        active
          ? "bg-[#ECFFA1] text-[#5F7600]"
          : "bg-[#f2f2f2] text-[#808080]",
      )}
    >
      <span className="text-[16px] font-bold leading-none">{n}</span>
      <span className="max-w-[100px] text-[12px] font-bold leading-tight sm:max-w-none">
        {label}
      </span>
    </div>
  )
}
