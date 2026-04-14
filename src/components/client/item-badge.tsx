"use client"

import { cn } from "@/lib/utils"
import {
  Flame,
  Leaf,
  Percent,
  Sparkles,
  Sprout,
  TrendingUp,
  type LucideIcon,
} from "lucide-react"

type TagConfig = {
  Icon: LucideIcon
  bg: string
  fg: string
  label: string
}

const TAG_MAP: Record<string, TagConfig> = {
  выгодно: {
    Icon: Percent,
    bg: "#fce7f3",
    fg: "#be185d",
    label: "Выгодно",
  },
  новинка: {
    Icon: Sparkles,
    bg: "#dbeafe",
    fg: "#1d4ed8",
    label: "Новинка",
  },
  хит: {
    Icon: TrendingUp,
    bg: "#ffedd5",
    fg: "#c2410c",
    label: "Хит",
  },
  острое: {
    Icon: Flame,
    bg: "#fee2e2",
    fg: "#dc2626",
    label: "Острое",
  },
  веган: {
    Icon: Leaf,
    bg: "#dcfce7",
    fg: "#15803d",
    label: "Веган",
  },
  постное: {
    Icon: Sprout,
    bg: "#fefce8",
    fg: "#a16207",
    label: "Постное",
  },
}

export type ItemBadgeProps = {
  tag: string | null
  /** Рядом с названием в списке на мобилке — меньше обычного */
  size?: "default" | "compact"
}

export function ItemBadge({ tag, size = "default" }: ItemBadgeProps) {
  if (!tag) return null
  const cfg = TAG_MAP[tag.toLowerCase()]
  if (!cfg) return null
  const { Icon, bg, fg, label } = cfg
  const compact = size === "compact"
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full font-semibold",
        compact
          ? "gap-0.5 px-1.5 py-0.5 text-[10px] leading-tight"
          : "gap-1.5 px-3 py-1 text-sm",
      )}
      style={{ backgroundColor: bg, color: fg }}
    >
      <Icon
        className="shrink-0"
        size={compact ? 12 : 18}
        strokeWidth={2}
        aria-hidden
      />
      {label}
    </span>
  )
}
