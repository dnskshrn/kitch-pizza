import { cn } from "@/lib/utils"
import type { ComponentProps } from "react"

/** Обёртка с классом `client-container` (max-width 1280px, px-4 / md:px-6 / lg:px-8). */
export function ClientContainer({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("client-container", className)} {...props} />
}
