"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import {
  format as formatDate,
  parseISO,
} from "date-fns"
import { Plus, ReceiptText, Trash2 } from "lucide-react"
import Link from "next/link"
import {
  usePathname,
  useRouter,
  useSearchParams,
} from "next/navigation"
import { useEffect, useState, useTransition } from "react"
import { useForm, useWatch } from "react-hook-form"
import { toast } from "sonner"
import { z } from "zod"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Textarea } from "@/components/ui/textarea"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  createGlovoSettlement,
  deleteGlovoSettlement,
} from "@/lib/actions/admin/finance"
import { formatMdl } from "@/lib/format-mdl"
import type { GlovoSettlement, PnLData } from "@/types/finance"

type GlovoClientProps = {
  settlements: GlovoSettlement[]
  pnlData: PnLData
  initialFrom: string
  initialTo: string
}

type NavItem = {
  href: string
  label: string
}

const NAV_ITEMS: NavItem[] = [
  { href: "/admin/finances", label: "P&L" },
  { href: "/admin/finances/expenses", label: "Расходы" },
  { href: "/admin/finances/glovo", label: "Glovo" },
]

const glovoFormSchema = z
  .object({
    period_start: z.string().min(1, "Укажите дату начала периода"),
    period_end: z.string().min(1, "Укажите дату окончания периода"),
    gross_amount: z
      .number({ invalid_type_error: "Введите gross сумму" })
      .refine((value) => Number.isFinite(value), "Введите gross сумму")
      .positive("Сумма должна быть больше 0"),
    commission: z
      .number({ invalid_type_error: "Введите комиссию" })
      .refine((value) => Number.isFinite(value), "Введите комиссию")
      .min(0, "Комиссия не может быть отрицательной"),
    vat: z
      .number({ invalid_type_error: "Введите НДС" })
      .refine((value) => Number.isFinite(value), "Введите НДС")
      .min(0, "НДС не может быть отрицательным"),
    net_received: z
      .number({ invalid_type_error: "Введите итог получено" })
      .refine((value) => Number.isFinite(value), "Введите итог получено")
      .min(0, "Сумма получено не может быть отрицательной"),
    received_at: z.string().optional(),
    bank_reference: z.string().optional(),
    notes: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.period_start && data.period_end && data.period_start > data.period_end) {
      ctx.addIssue({
        code: "custom",
        path: ["period_end"],
        message: "Дата начала периода не может быть позже даты окончания",
      })
    }
  })

type GlovoFormValues = z.infer<typeof glovoFormSchema>

function recordsLabel(count: number): string {
  const mod10 = count % 10
  const mod100 = count % 100

  if (mod10 === 1 && mod100 !== 11) return "выплата"
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) {
    return "выплаты"
  }
  return "выплат"
}

function formatPeriodRange(start: string, end: string): string {
  return `${formatDate(parseISO(start), "dd.MM")}–${formatDate(parseISO(end), "dd.MM.yyyy")}`
}

function formatSettlementDate(value: string | null): string {
  if (!value) return "—"
  return formatDate(parseISO(value), "dd.MM.yyyy")
}

function buildSectionHref(
  href: string,
  searchParams: ReturnType<typeof useSearchParams>,
): string {
  const from = searchParams.get("from")
  const to = searchParams.get("to")

  if (!from || !to) return href

  const params = new URLSearchParams()
  params.set("from", from)
  params.set("to", to)
  return `${href}?${params.toString()}`
}

function truncateText(value: string, maxLength = 12): string {
  if (value.length <= maxLength) return value
  return `${value.slice(0, maxLength - 1)}…`
}

function safeNumber(value: number): number {
  return Number.isFinite(value) ? value : 0
}

function computeNetReceived(grossAmount: number, commission: number, vat: number): number {
  return safeNumber(grossAmount) - safeNumber(commission) - safeNumber(vat)
}

function formatDifferenceAmount(value: number): string {
  if (value > 0) return `+${formatMdl(value)}`
  if (value < 0) return `-${formatMdl(Math.abs(value))}`
  return formatMdl(0)
}

function differenceToneClass(value: number): string {
  if (value < 0) return "text-green-600"
  if (value > 0) return "text-red-600"
  return "text-muted-foreground"
}

function buildDefaultSettlementValues(
  periodStart: string,
  periodEnd: string,
): GlovoFormValues {
  return {
    period_start: periodStart,
    period_end: periodEnd,
    gross_amount: Number.NaN,
    commission: Number.NaN,
    vat: Number.NaN,
    net_received: 0,
    received_at: "",
    bank_reference: "",
    notes: "",
  }
}

export function GlovoClient({
  settlements,
  pnlData,
  initialFrom,
  initialTo,
}: GlovoClientProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const [sheetOpen, setSheetOpen] = useState(false)
  const [manualNetReceived, setManualNetReceived] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [isCreating, startCreateTransition] = useTransition()

  const form = useForm<GlovoFormValues>({
    resolver: zodResolver(glovoFormSchema),
    defaultValues: buildDefaultSettlementValues(initialFrom, initialTo),
  })

  const grossAmount = useWatch({ control: form.control, name: "gross_amount" })
  const commissionAmount = useWatch({ control: form.control, name: "commission" })
  const vatAmount = useWatch({ control: form.control, name: "vat" })

  useEffect(() => {
    if (!sheetOpen) {
      form.reset(buildDefaultSettlementValues(initialFrom, initialTo))
      setManualNetReceived(false)
    }
  }, [form, initialFrom, initialTo, sheetOpen])

  useEffect(() => {
    if (manualNetReceived) return

    form.setValue(
      "net_received",
      computeNetReceived(grossAmount, commissionAmount, vatAmount),
      { shouldValidate: true, shouldDirty: true },
    )
  }, [commissionAmount, form, grossAmount, manualNetReceived, vatAmount])

  const glovoGross =
    pnlData.revenue.glovoCashGross + pnlData.revenue.glovoCardGross
  const calculatedCommission = pnlData.commissions.glovoCalculated
  const calculatedRatePct =
    glovoGross > 0 ? (calculatedCommission / glovoGross) * 100 : 0
  const factTotal = settlements.reduce((sum, settlement) => {
    return sum + settlement.commission_bani + settlement.vat_bani
  }, 0)
  const discrepancy = factTotal - calculatedCommission

  function handleSheetOpenChange(nextOpen: boolean): void {
    setSheetOpen(nextOpen)
    if (!nextOpen) {
      form.reset(buildDefaultSettlementValues(initialFrom, initialTo))
      setManualNetReceived(false)
    }
  }

  async function handleDeleteSettlement(id: string): Promise<void> {
    setDeletingId(id)
    try {
      const result = await deleteGlovoSettlement(id)
      if (!result.success) {
        toast.error(result.error ?? "Не удалось удалить выплату Glovo")
        return
      }

      toast.success("Выплата Glovo удалена")
      router.refresh()
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Не удалось удалить выплату Glovo",
      )
    } finally {
      setDeletingId(null)
    }
  }

  function onSubmit(values: GlovoFormValues): void {
    startCreateTransition(async () => {
      try {
        const result = await createGlovoSettlement({
          period_start: values.period_start,
          period_end: values.period_end,
          gross_amount_bani: Math.round(values.gross_amount * 100),
          commission_bani: Math.round(values.commission * 100),
          vat_bani: Math.round(values.vat * 100),
          net_received_bani: Math.round(values.net_received * 100),
          received_at: values.received_at?.trim() || null,
          bank_reference: values.bank_reference?.trim() || null,
          notes: values.notes?.trim() || null,
        })

        if (!result.success) {
          toast.error(result.error ?? "Не удалось сохранить выплату Glovo")
          return
        }

        toast.success("Выплата Glovo внесена")
        handleSheetOpenChange(false)
        router.refresh()
      } catch (error) {
        toast.error(
          error instanceof Error
            ? error.message
            : "Не удалось сохранить выплату Glovo",
        )
      }
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2 rounded-xl border border-border bg-muted/30 p-1">
        {NAV_ITEMS.map((item) => {
          const isActive = pathname === item.href
          return (
            <Link
              key={item.href}
              href={buildSectionHref(item.href, searchParams)}
              className={
                isActive
                  ? "rounded-lg border border-border bg-background px-4 py-2 text-sm font-medium text-foreground shadow-sm"
                  : "rounded-lg px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-background/70 hover:text-foreground"
              }
            >
              {item.label}
            </Link>
          )
        })}
      </div>

      <div
        className={`grid gap-4 md:grid-cols-2 ${
          settlements.length > 0 ? "xl:grid-cols-4" : "xl:grid-cols-3"
        }`}
      >
        <Card>
          <CardHeader className="pb-1">
            <CardDescription>Gross выручка</CardDescription>
            <CardTitle className="text-2xl">{formatMdl(glovoGross)}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">из заказов</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-1">
            <CardDescription>Расчётная комиссия</CardDescription>
            <CardTitle className="text-2xl">~{formatMdl(calculatedCommission)}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              ~{calculatedRatePct.toFixed(1)}% оценка
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-1">
            <CardDescription>Внесено (факт)</CardDescription>
            <CardTitle className="text-2xl">{formatMdl(factTotal)}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              {settlements.length} {recordsLabel(settlements.length)}
            </p>
          </CardContent>
        </Card>

        {settlements.length > 0 ? (
          <Card>
            <CardHeader className="pb-1">
              <CardDescription>Расхождение</CardDescription>
              <CardTitle
                className={`text-2xl ${differenceToneClass(discrepancy)}`}
              >
                {formatDifferenceAmount(discrepancy)}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">факт - расчёт</p>
            </CardContent>
          </Card>
        ) : null}
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4 border-b">
          <div className="space-y-1">
            <CardTitle>Выплаты Glovo</CardTitle>
            <CardDescription>
              Реестр выплат, комиссий и зачислений по периодам
            </CardDescription>
          </div>

          <Button type="button" onClick={() => setSheetOpen(true)}>
            <Plus className="mr-1 size-4" />
            Внести выплату
          </Button>
        </CardHeader>
        <CardContent className="pt-4">
          {settlements.length === 0 ? (
            <Alert>
              <ReceiptText className="size-4" />
              <AlertTitle>Выплаты Glovo за период не внесены</AlertTitle>
              <AlertDescription>
                Добавьте первую выплату через форму «Внести выплату».
              </AlertDescription>
            </Alert>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Период</TableHead>
                  <TableHead className="text-right">Gross</TableHead>
                  <TableHead className="text-right">Комиссия</TableHead>
                  <TableHead className="text-right">НДС</TableHead>
                  <TableHead className="text-right">Получено</TableHead>
                  <TableHead>Дата получения</TableHead>
                  <TableHead>Ref</TableHead>
                  <TableHead className="text-right">Удалить</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {settlements.map((settlement) => {
                  const bankReference = settlement.bank_reference?.trim() || ""

                  return (
                    <TableRow key={settlement.id}>
                      <TableCell>
                        {formatPeriodRange(
                          settlement.period_start,
                          settlement.period_end,
                        )}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatMdl(settlement.gross_amount_bani)}
                      </TableCell>
                      <TableCell className="text-right text-red-600">
                        {formatMdl(settlement.commission_bani)}
                      </TableCell>
                      <TableCell className="text-right text-red-600">
                        {formatMdl(settlement.vat_bani)}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatMdl(settlement.net_received_bani)}
                      </TableCell>
                      <TableCell>{formatSettlementDate(settlement.received_at)}</TableCell>
                      <TableCell className="max-w-[160px]">
                        {bankReference ? (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="block cursor-help truncate">
                                {truncateText(bankReference)}
                              </span>
                            </TooltipTrigger>
                            <TooltipContent side="top">
                              {bankReference}
                            </TooltipContent>
                          </Tooltip>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          aria-label="Удалить выплату Glovo"
                          className="text-destructive hover:text-destructive"
                          disabled={deletingId === settlement.id}
                          onClick={() => void handleDeleteSettlement(settlement.id)}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Sheet open={sheetOpen} onOpenChange={handleSheetOpenChange}>
        <SheetContent side="right" className="w-full gap-0 p-0 sm:max-w-xl">
          <Form {...form}>
            <form
              onSubmit={form.handleSubmit(onSubmit)}
              className="flex h-full flex-col overflow-hidden"
            >
              <SheetHeader className="shrink-0 border-b px-6 py-5">
                <SheetTitle>Внести выплату Glovo</SheetTitle>
                <SheetDescription>
                  Заполните данные по выплате и комиссии за выбранный период.
                </SheetDescription>
              </SheetHeader>

              <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5">
                <div className="space-y-3">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <FormField
                      control={form.control}
                      name="period_start"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>С</FormLabel>
                          <FormControl>
                            <Input type="date" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="period_end"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>По</FormLabel>
                          <FormControl>
                            <Input type="date" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <p className="text-sm text-muted-foreground">
                    За заказы 1–15: выплата ~23–25 числа. За заказы 16–30: выплата
                    ~8–10 следующего месяца.
                  </p>
                </div>

                <FormField
                  control={form.control}
                  name="gross_amount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Gross сумма заказов (MDL)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min={0.01}
                          step={0.01}
                          placeholder="0"
                          value={Number.isFinite(field.value) ? String(field.value) : ""}
                          onChange={(event) => {
                            const nextValue = event.target.value
                            field.onChange(
                              nextValue === "" ? Number.NaN : Number(nextValue),
                            )
                          }}
                        />
                      </FormControl>
                      <FormDescription>
                        Сумма всех заказов Glovo за период до вычета комиссии
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="commission"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Комиссия Glovo (MDL)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min={0}
                          step={0.01}
                          placeholder="0"
                          value={Number.isFinite(field.value) ? String(field.value) : ""}
                          onChange={(event) => {
                            const nextValue = event.target.value
                            field.onChange(
                              nextValue === "" ? Number.NaN : Number(nextValue),
                            )
                          }}
                        />
                      </FormControl>
                      <FormDescription>Комиссия без НДС</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="vat"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>НДС на комиссию (MDL)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min={0}
                          step={0.01}
                          placeholder="0"
                          value={Number.isFinite(field.value) ? String(field.value) : ""}
                          onChange={(event) => {
                            const nextValue = event.target.value
                            field.onChange(
                              nextValue === "" ? Number.NaN : Number(nextValue),
                            )
                          }}
                        />
                      </FormControl>
                      <FormDescription>НДС 20% на сумму комиссии</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="net_received"
                  render={({ field }) => (
                    <FormItem>
                      <div className="flex items-center justify-between gap-4">
                        <FormLabel>Итого получено (MDL)</FormLabel>
                        <label className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Checkbox
                            checked={manualNetReceived}
                            onCheckedChange={(checked) => {
                              const nextManual = checked === true
                              setManualNetReceived(nextManual)
                              if (!nextManual) {
                                form.setValue(
                                  "net_received",
                                  computeNetReceived(
                                    grossAmount,
                                    commissionAmount,
                                    vatAmount,
                                  ),
                                  { shouldValidate: true, shouldDirty: true },
                                )
                              }
                            }}
                          />
                          <span>Указать вручную</span>
                        </label>
                      </div>
                      <FormControl>
                        <Input
                          type="number"
                          min={0}
                          step={0.01}
                          placeholder="0"
                          readOnly={!manualNetReceived}
                          className={
                            manualNetReceived ? "" : "bg-muted font-medium"
                          }
                          value={Number.isFinite(field.value) ? String(field.value) : ""}
                          onChange={(event) => {
                            const nextValue = event.target.value
                            field.onChange(
                              nextValue === "" ? Number.NaN : Number(nextValue),
                            )
                          }}
                        />
                      </FormControl>
                      <FormDescription>
                        Автоматически считается как gross − комиссия − НДС
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="received_at"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Дата получения</FormLabel>
                      <FormControl>
                        <Input type="date" value={field.value ?? ""} onChange={field.onChange} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="bank_reference"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Номер перевода</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Ref / номер платежа"
                          value={field.value ?? ""}
                          onChange={field.onChange}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="notes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Примечание</FormLabel>
                      <FormControl>
                        <Textarea
                          rows={4}
                          placeholder="Дополнительные детали по выплате"
                          value={field.value ?? ""}
                          onChange={field.onChange}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <SheetFooter className="shrink-0 border-t px-6 py-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => handleSheetOpenChange(false)}
                  disabled={isCreating}
                >
                  Отмена
                </Button>
                <Button type="submit" disabled={isCreating}>
                  {isCreating ? "Сохраняем…" : "Сохранить выплату"}
                </Button>
              </SheetFooter>
            </form>
          </Form>
        </SheetContent>
      </Sheet>
    </div>
  )
}
