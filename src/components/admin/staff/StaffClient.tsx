"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { Pencil, Plus, Send } from "lucide-react"
import { useRouter } from "next/navigation"
import { useEffect, useMemo, useState, useTransition } from "react"
import { useForm } from "react-hook-form"
import { toast } from "sonner"
import { z } from "zod"
import {
  createStaff,
  generateTelegramLink,
  updateStaff,
  type Staff,
  type StaffRole,
} from "@/lib/actions/staff/staff-actions"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

const ROLE_LABELS: Record<StaffRole, string> = {
  operator: "Оператор",
  cook: "Повар",
  courier: "Курьер",
  manager: "Менеджер",
}

function staffSchema(isCreate: boolean) {
  return z
    .object({
      name: z.string().min(1, "Укажите имя"),
      phone: z.string(),
      role: z.enum(["operator", "cook", "courier", "manager"]),
      pin: z.string(),
      is_active: z.boolean(),
    })
    .superRefine((data, ctx) => {
      const pin = data.pin.trim()
      if (isCreate) {
        if (!/^\d{4}$/.test(pin)) {
          ctx.addIssue({
            code: "custom",
            message: "Укажите PIN из 4 цифр",
            path: ["pin"],
          })
        }
      } else if (pin.length > 0 && !/^\d{4}$/.test(pin)) {
        ctx.addIssue({
          code: "custom",
          message: "PIN — ровно 4 цифры",
          path: ["pin"],
        })
      }
    })
}

type StaffFormValues = z.infer<ReturnType<typeof staffSchema>>

function telegramBadge(row: Staff) {
  if (row.tg_chat_id != null) {
    return (
      <Badge className="bg-emerald-600 hover:bg-emerald-600">Подключён</Badge>
    )
  }
  if (
    row.tg_link_token &&
    row.tg_link_token_expires_at &&
    !Number.isNaN(new Date(row.tg_link_token_expires_at).getTime()) &&
    new Date(row.tg_link_token_expires_at).getTime() > Date.now()
  ) {
    return (
      <Badge
        variant="secondary"
        className="border-amber-500/50 bg-amber-500/15 text-amber-900 dark:text-amber-100"
      >
        Ожидает
      </Badge>
    )
  }
  return <span className="text-muted-foreground text-sm">—</span>
}

type AddEditDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  mode: "create" | "edit"
  staffMember: Staff | null
  onSaved: () => void
}

function AddEditDialog({
  open,
  onOpenChange,
  mode,
  staffMember,
  onSaved,
}: AddEditDialogProps) {
  const isCreate = mode === "create"
  const schema = useMemo(() => staffSchema(isCreate), [isCreate])
  const form = useForm<StaffFormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: "",
      phone: "",
      role: "operator",
      pin: "",
      is_active: true,
    },
  })

  useEffect(() => {
    if (!open) return
    if (mode === "edit" && staffMember) {
      form.reset({
        name: staffMember.name,
        phone: staffMember.phone ?? "",
        role: staffMember.role,
        pin: "",
        is_active: staffMember.is_active,
      })
    } else if (mode === "create") {
      form.reset({
        name: "",
        phone: "",
        role: "operator",
        pin: "",
        is_active: true,
      })
    }
  }, [open, mode, staffMember, form])

  const [pending, startTransition] = useTransition()

  function onSubmit(values: StaffFormValues) {
    const phoneTrimmed = values.phone.trim()
    const phone = phoneTrimmed === "" ? null : phoneTrimmed

    startTransition(async () => {
      try {
        if (isCreate) {
          await createStaff({
            name: values.name,
            phone,
            role: values.role,
            pin: values.pin.trim(),
            is_active: values.is_active,
          })
          toast.success("Сотрудник добавлен")
        } else if (staffMember) {
          await updateStaff(staffMember.id, {
            name: values.name,
            phone,
            role: values.role,
            pin: values.pin,
            is_active: values.is_active,
          })
          toast.success("Изменения сохранены")
        }
        onOpenChange(false)
        onSaved()
      } catch (e) {
        console.error(e)
        toast.error(e instanceof Error ? e.message : "Ошибка сохранения")
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isCreate ? "Новый сотрудник" : "Редактировать сотрудника"}
          </DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="grid gap-4 py-2"
          >
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Имя *</FormLabel>
                  <FormControl>
                    <Input placeholder="Имя" autoComplete="name" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="phone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Телефон</FormLabel>
                  <FormControl>
                    <Input
                      type="tel"
                      placeholder="Необязательно"
                      autoComplete="tel"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="role"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Роль *</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Выберите роль" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {(Object.keys(ROLE_LABELS) as StaffRole[]).map((r) => (
                        <SelectItem key={r} value={r}>
                          {ROLE_LABELS[r]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="pin"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    PIN{" "}
                    {isCreate
                      ? "(4 цифры) *"
                      : "(оставьте пустым, чтобы не менять)"}
                  </FormLabel>
                  <FormControl>
                    <Input
                      type="password"
                      inputMode="numeric"
                      maxLength={4}
                      autoComplete="new-password"
                      placeholder="4 цифры"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="is_active"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center gap-3 space-y-0">
                  <FormControl>
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={(v) => field.onChange(v === true)}
                    />
                  </FormControl>
                  <FormLabel className="cursor-pointer font-normal">
                    Активен
                  </FormLabel>
                </FormItem>
              )}
            />
            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Отмена
              </Button>
              <Button type="submit" disabled={pending}>
                {pending ? "Сохранение..." : "Сохранить"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}

type TelegramLinkDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  link: string | null
}

function TelegramLinkDialog({
  open,
  onOpenChange,
  link,
}: TelegramLinkDialogProps) {
  async function copyLink() {
    if (!link) return
    try {
      await navigator.clipboard.writeText(link)
      toast.success("Скопировано")
    } catch {
      toast.error("Не удалось скопировать")
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Ссылка для Telegram</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3 py-2">
          <div className="grid gap-2">
            <Label htmlFor="tg-link" className="sr-only">
              Ссылка
            </Label>
            <Input
              id="tg-link"
              readOnly
              value={link ?? ""}
              className="font-mono text-sm"
            />
          </div>
          <p className="text-muted-foreground text-sm">
            Ссылка действительна 7 дней. Отправьте её курьеру — после перехода
            по ссылке он будет привязан к аккаунту.
          </p>
        </div>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Закрыть
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={() => void copyLink()}
            disabled={!link}
          >
            Скопировать
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function StaffClient({ staff }: { staff: Staff[] }) {
  const router = useRouter()
  const [createOpen, setCreateOpen] = useState(false)
  const [editMember, setEditMember] = useState<Staff | null>(null)
  const [tgDialogOpen, setTgDialogOpen] = useState(false)
  const [tgLink, setTgLink] = useState<string | null>(null)
  const [tgPending, startTg] = useTransition()

  function refresh() {
    router.refresh()
  }

  function openTelegramLink(staffId: string) {
    startTg(async () => {
      try {
        const { link } = await generateTelegramLink(staffId)
        setTgLink(link)
        setTgDialogOpen(true)
        refresh()
      } catch (e) {
        console.error(e)
        toast.error(
          e instanceof Error ? e.message : "Не удалось создать ссылку",
        )
      }
    })
  }

  return (
    <>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Персонал</h1>
        <Button className="gap-2" onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4" />
          Добавить сотрудника
        </Button>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Имя</TableHead>
            <TableHead>Телефон</TableHead>
            <TableHead>Роль</TableHead>
            <TableHead>Статус</TableHead>
            <TableHead>Telegram</TableHead>
            <TableHead className="text-right">Действия</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {staff.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={6}
                className="text-muted-foreground text-center"
              >
                Пока нет сотрудников
              </TableCell>
            </TableRow>
          ) : (
            staff.map((row) => (
              <TableRow key={row.id}>
                <TableCell className="font-medium">{row.name}</TableCell>
                <TableCell className="text-muted-foreground">
                  {row.phone ?? "—"}
                </TableCell>
                <TableCell>{ROLE_LABELS[row.role]}</TableCell>
                <TableCell>
                  {row.is_active ? (
                    <Badge className="bg-emerald-600 hover:bg-emerald-600">
                      Активен
                    </Badge>
                  ) : (
                    <Badge variant="secondary">Неактивен</Badge>
                  )}
                </TableCell>
                <TableCell>{telegramBadge(row)}</TableCell>
                <TableCell className="text-right">
                  <div className="flex flex-wrap items-center justify-end gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="gap-1.5"
                      onClick={() => setEditMember(row)}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                      Изменить
                    </Button>
                    {row.role === "courier" && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="gap-1.5"
                        disabled={tgPending}
                        onClick={() => openTelegramLink(row.id)}
                      >
                        <Send className="h-3.5 w-3.5" />
                        Telegram
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>

      <AddEditDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        mode="create"
        staffMember={null}
        onSaved={refresh}
      />
      <AddEditDialog
        open={!!editMember}
        onOpenChange={(o) => !o && setEditMember(null)}
        mode="edit"
        staffMember={editMember}
        onSaved={refresh}
      />
      <TelegramLinkDialog
        open={tgDialogOpen}
        onOpenChange={(o) => {
          setTgDialogOpen(o)
          if (!o) setTgLink(null)
        }}
        link={tgLink}
      />
    </>
  )
}
