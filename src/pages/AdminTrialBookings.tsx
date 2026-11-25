import { useCallback, useMemo, useState } from 'react'
import { CalendarCheck, CalendarX2, Check, Clock, Loader2, Trash2, X } from 'lucide-react'
import {
  AdminEmptyState,
  AdminPageHeader,
  AdminPageLoader,
  AdminRowActions,
  AdminSummary,
} from '@/components/admin/AdminPage'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'
import { useRealtime } from '@/hooks/use-realtime'
import { cn } from '@/lib/utils'
import {
  TrialBooking,
  TrialBookingStatus,
  TRIAL_STATUS_LABEL,
  trialBookingsService,
} from '@/services/trialBookings'

/** Data "2026-12-01 00:00:00.000Z" → "01/12/2026" (sem deslocamento de fuso). */
function dataCurta(value: string): string {
  const m = value?.slice(0, 10)?.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!m) return value
  return `${m[3]}/${m[2]}/${m[1]}`
}

function idadeDe(birthDate: string): number | null {
  const m = birthDate?.slice(0, 10)?.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!m) return null
  const birth = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]))
  const now = new Date()
  let age = now.getFullYear() - birth.getUTCFullYear()
  const md = now.getUTCMonth() - birth.getUTCMonth()
  if (md < 0 || (md === 0 && now.getUTCDate() < birth.getUTCDate())) age--
  return age
}

const statusBadge = (status: TrialBookingStatus): string => {
  switch (status) {
    case 'novo':
      return 'bg-[#FFF8E1] text-[#B45309] border-[#B45309]/20'
    case 'confirmado':
      return 'bg-[#E8F5E9] text-[#2E7D4F] border-[#2E7D4F]/20'
    case 'realizado':
      return 'bg-[#E3F2FD] text-[#1565C0] border-[#1565C0]/20'
    case 'cancelado':
      return 'bg-[#F7E4E2] text-[#C1272D] border-[#C1272D]/20'
  }
}

const NEXT_STATUS: { value: TrialBookingStatus; label: string; icon: React.ReactNode }[] = [
  { value: 'confirmado', label: 'Confirmar', icon: <Check className="h-3.5 w-3.5" /> },
  {
    value: 'realizado',
    label: 'Marcar realizado',
    icon: <CalendarCheck className="h-3.5 w-3.5" />,
  },
  { value: 'cancelado', label: 'Cancelar', icon: <X className="h-3.5 w-3.5" /> },
]

const STATUS_FILTERS: { value: TrialBookingStatus | 'todos'; label: string }[] = [
  { value: 'todos', label: 'Todos os status' },
  { value: 'novo', label: 'Novos' },
  { value: 'confirmado', label: 'Confirmados' },
  { value: 'realizado', label: 'Realizados' },
  { value: 'cancelado', label: 'Cancelados' },
]

const selectClass =
  'h-8 w-full text-xs rounded-md border border-[#E8E0D5] bg-white px-2 text-[#1C1B1A] focus:outline-hidden focus:ring-1 focus:ring-[#C1272D]'

function StatusSelect({
  value,
  onChange,
  disabled,
}: {
  value: TrialBookingStatus
  onChange: (v: TrialBookingStatus) => void
  disabled?: boolean
}) {
  return (
    <select
      aria-label="Status do agendamento"
      value={value}
      onChange={(e) => onChange(e.target.value as TrialBookingStatus)}
      disabled={disabled}
      className={selectClass}
    >
      {(Object.keys(TRIAL_STATUS_LABEL) as TrialBookingStatus[]).map((s) => (
        <option key={s} value={s}>
          {TRIAL_STATUS_LABEL[s]}
        </option>
      ))}
    </select>
  )
}

export default function AdminTrialBookings() {
  const { toast } = useToast()
  const [bookings, setBookings] = useState<TrialBooking[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<TrialBookingStatus | 'todos'>('todos')
  const [deleting, setDeleting] = useState<TrialBooking | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [savingId, setSavingId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setIsLoading(true)
    try {
      setBookings(await trialBookingsService.list())
    } catch (err) {
      console.error('Erro ao carregar agendamentos experimentais:', err)
      toast({
        title: 'Erro ao carregar agendamentos',
        description: 'Não foi possível buscar os agendamentos no servidor.',
        variant: 'destructive',
      })
    } finally {
      setIsLoading(false)
    }
  }, [toast])

  // Primeira carga feita por efeito, com realtime mantendo a lista viva.
  useRealtime<TrialBooking>('trial_bookings', (e) => {
    setBookings((prev) => {
      if (e.action === 'delete') return prev.filter((b) => b.id !== e.record.id)
      const exists = prev.some((b) => b.id === e.record.id)
      if (exists) return prev.map((b) => (b.id === e.record.id ? e.record : b))
      return [e.record, ...prev]
    })
  })
  useMemo(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const filtered = useMemo(
    () => (statusFilter === 'todos' ? bookings : bookings.filter((b) => b.status === statusFilter)),
    [bookings, statusFilter],
  )

  const counts = useMemo(() => {
    const c: Record<string, number> = { novo: 0, confirmado: 0, realizado: 0, cancelado: 0 }
    bookings.forEach((b) => {
      c[b.status] = (c[b.status] ?? 0) + 1
    })
    return c
  }, [bookings])

  const changeStatus = async (booking: TrialBooking, status: TrialBookingStatus) => {
    setSavingId(booking.id)
    try {
      const saved = await trialBookingsService.updateStatus(booking.id, status)
      setBookings((prev) => prev.map((b) => (b.id === saved.id ? saved : b)))
      toast({ title: `Agendamento marcado como ${TRIAL_STATUS_LABEL[status].toLowerCase()}` })
    } catch (err: any) {
      console.error('Erro ao mudar status:', err)
      toast({
        title: 'Erro ao mudar status',
        description: err?.message || 'Tente novamente.',
        variant: 'destructive',
      })
    } finally {
      setSavingId(null)
    }
  }

  const handleDelete = async () => {
    if (!deleting) return
    setIsDeleting(true)
    try {
      await trialBookingsService.remove(deleting.id)
      setBookings((prev) => prev.filter((b) => b.id !== deleting.id))
      toast({ title: 'Agendamento excluído' })
      setDeleting(null)
    } catch (err: any) {
      console.error('Erro ao excluir agendamento:', err)
      toast({
        title: 'Erro ao excluir',
        description: err?.message || 'Tente novamente.',
        variant: 'destructive',
      })
    } finally {
      setIsDeleting(false)
    }
  }

  if (isLoading && bookings.length === 0) {
    return <AdminPageLoader label="Carregando agendamentos..." />
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-12 lg:px-8">
      <AdminPageHeader
        title="Aulas experimentais"
        breadcrumb="Aulas experimentais"
        breadcrumbTo="/painel/experimentais"
        description="Agendamentos feitos por visitantes no site. Confirme a vaga, acompanhe a aula e registre o resultado."
        action={
          <Select
            value={statusFilter}
            onValueChange={(v) => setStatusFilter(v as TrialBookingStatus | 'todos')}
          >
            <SelectTrigger className="h-10 w-44 border-[#E8E0D5] text-xs font-semibold text-[#1C1B1A]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATUS_FILTERS.map((f) => (
                <SelectItem key={f.value} value={f.value}>
                  {f.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        }
      />

      <AdminSummary
        stats={[
          { label: 'Total', value: bookings.length, icon: <CalendarCheck className="h-4 w-4" /> },
          {
            label: 'Aguardando confirmação',
            value: counts.novo,
            icon: <Clock className="h-4 w-4" />,
            tone: counts.novo > 0 ? 'red' : 'neutral',
          },
          {
            label: 'Confirmados',
            value: counts.confirmado,
            icon: <Check className="h-4 w-4" />,
            tone: 'green',
          },
          {
            label: 'Realizados',
            value: counts.realizado,
            icon: <CalendarCheck className="h-4 w-4" />,
            tone: 'green',
          },
        ]}
      />

      {filtered.length === 0 ? (
        <AdminEmptyState
          title={
            bookings.length === 0 ? 'Nenhum agendamento ainda' : 'Nenhum agendamento neste filtro'
          }
          description={
            bookings.length === 0
              ? 'Assim que um visitante agendar uma aula experimental no site, o pedido aparece aqui em tempo real.'
              : 'Tente outro status no filtro acima.'
          }
        />
      ) : (
        <div className="space-y-3">
          {filtered.map((b) => {
            const idade = idadeDe(b.birth_date)
            return (
              <div
                key={b.id}
                className={cn(
                  'rounded-2xl border bg-white p-4 shadow-xs',
                  b.status === 'novo' ? 'border-[#C1272D]/40' : 'border-[#E8E0D5]',
                )}
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-serif text-base font-bold text-[#1C1B1A]">
                        {b.student_name}
                      </h3>
                      <Badge className={cn('text-[10px] font-bold border', statusBadge(b.status))}>
                        {TRIAL_STATUS_LABEL[b.status]}
                      </Badge>
                      {b.status === 'novo' && (
                        <span className="text-[10px] font-bold text-[#C1272D]">
                          Aguardando ação
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-xs text-[#6B6560]">
                      Nascimento: {dataCurta(b.birth_date)}
                      {idade != null ? ` (${idade} anos)` : ''}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="inline-flex items-center gap-1 text-xs font-bold text-[#1C1B1A]">
                      <CalendarCheck className="h-3.5 w-3.5 text-[#C1272D]" />
                      {dataCurta(b.date)}
                    </p>
                    <p className="mt-0.5 text-[11px] text-[#6B6560]">
                      {b.expand?.class?.name || 'Turma removida'}
                      {b.expand?.class?.schedule ? ` — ${b.expand.class.schedule}` : ''}
                    </p>
                  </div>
                </div>

                <div className="mt-2 text-xs text-[#6B6560]">
                  <p>
                    Contato: <strong className="text-[#1C1B1A]">{b.contact}</strong>
                  </p>
                  {b.notes && <p className="mt-1 italic">“{b.notes}”</p>}
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-[#E8E0D5] pt-3">
                  <StatusSelect
                    value={b.status}
                    onChange={(s) => changeStatus(b, s)}
                    disabled={savingId === b.id}
                  />
                  {NEXT_STATUS.filter((n) => n.value !== b.status)
                    .slice(0, b.status === 'novo' ? 2 : 3)
                    .map((n) => (
                      <Button
                        key={n.value}
                        variant="outline"
                        size="sm"
                        onClick={() => changeStatus(b, n.value)}
                        disabled={savingId === b.id}
                        className="h-8 border-[#E8E0D5] px-2 text-xs font-semibold text-[#1C1B1A]"
                      >
                        {n.icon}
                        {n.label}
                      </Button>
                    ))}
                  <AdminRowActions className="ml-auto">
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Excluir agendamento de ${b.student_name}`}
                      onClick={() => setDeleting(b)}
                      className="h-8 w-8 text-[#C1272D] hover:bg-[#F7E4E2] hover:text-[#A01E23]"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </AdminRowActions>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <AlertDialog open={!!deleting} onOpenChange={(open) => !open && setDeleting(null)}>
        <AlertDialogContent className="max-w-md rounded-2xl border border-[#E8E0D5] bg-white">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-serif text-[#1C1B1A]">
              Excluir agendamento?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs leading-relaxed text-[#6B6560]">
              O agendamento de <strong className="text-[#1C1B1A]">{deleting?.student_name}</strong>{' '}
              será apagado para sempre. Se a aula apenas não vai acontecer, prefira marcar como{' '}
              <strong className="text-[#1C1B1A]">cancelado</strong> para manter o histórico.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-[#E8E0D5] text-xs font-semibold text-[#1C1B1A]">
              Voltar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault()
                handleDelete()
              }}
              disabled={isDeleting}
              className="bg-[#C1272D] text-xs font-semibold text-white hover:bg-[#A01E23]"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Excluindo...
                </>
              ) : (
                'Excluir'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
