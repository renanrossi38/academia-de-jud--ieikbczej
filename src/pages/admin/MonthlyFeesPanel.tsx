import React, { useCallback, useEffect, useState } from 'react'
import {
  BadgeCheck,
  CalendarPlus,
  CheckCircle2,
  Clock,
  Info,
  Receipt,
  Trash2,
  Wallet,
} from 'lucide-react'
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
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Loader2 } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { useRealtime } from '@/hooks/use-realtime'
import { fmtBRL, fmtDate, fmtDateTime } from './StudentDetailPanels'
import CreateFeeDialog from '@/components/admin/CreateFeeDialog'
import { MonthlyFee, MonthlyFeeStatus, PaymentMethod } from '@/types'
import {
  feeStanding,
  isOverdue,
  monthlyFeesService,
  monthLabel,
  paidTotalInYear,
  paymentMethodLabel,
  type FeeStanding,
} from '@/services/monthlyFees'
import { Class } from '@/types'

const cardCls = 'bg-white rounded-2xl border border-[#E8E0D5] shadow-xs'

const STATUS_BADGE: Record<MonthlyFeeStatus, string> = {
  pago: 'bg-[#E8F5E9] text-[#2E7D4F] border-[#2E7D4F]/20',
  pendente: 'bg-[#F7E4E2] text-[#C1272D] border-[#C1272D]/20',
}

const METHOD_BADGE: Record<PaymentMethod, string> = {
  pix: 'bg-[#E8EAF6] text-[#283593] border-[#283593]/20',
  dinheiro: 'bg-[#E8F5E9] text-[#2E7D4F] border-[#2E7D4F]/20',
  cartao: 'bg-[#F3E5F5] text-[#6A1B9A] border-[#6A1B9A]/20',
}

const STANDING_META: Record<FeeStanding, { label: string; cls: string; hint: string }> = {
  em_dia: {
    label: 'Em dia',
    cls: 'bg-[#E8F5E9] text-[#2E7D4F] border-[#2E7D4F]/20',
    hint: 'Nenhuma mensalidade pendente vencida até o mês atual.',
  },
  inadimplente: {
    label: 'Inadimplente',
    cls: 'bg-[#F7E4E2] text-[#C1272D] border-[#C1272D]/20',
    hint: 'Há mensalidade pendente com mês de referência já vencido.',
  },
  sem_lancamentos: {
    label: 'Sem lançamentos',
    cls: 'bg-[#FAF6F0] text-[#6B6560] border-[#E8E0D5]',
    hint: 'Nenhuma mensalidade lançada para este aluno ainda.',
  },
}

/**
 * Aba Financeiro — primeira seção: mensalidades por mês de referência
 * (lançadas pelo admin; o pagamento é marcado presencialmente).
 * Abaixo, permanecem as compras da loja.
 */
export const MonthlyFeesPanel: React.FC<{
  studentId: string
  studentName: string
  classes: Class[]
  refreshKey?: number
}> = ({ studentId, studentName, classes, refreshKey = 0 }) => {
  const { toast } = useToast()
  const [fees, setFees] = useState<MonthlyFee[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [createOpen, setCreateOpen] = useState(false)
  const [markingId, setMarkingId] = useState<string | null>(null)
  const [deletingFee, setDeletingFee] = useState<MonthlyFee | null>(null)
  const [deleting, setDeleting] = useState(false)

  const loadFees = useCallback(async () => {
    if (!studentId) return
    try {
      setFees(await monthlyFeesService.listByStudent(studentId))
    } catch (err) {
      console.error('Erro ao carregar mensalidades:', err)
      toast({
        title: 'Erro ao carregar mensalidades',
        description: 'Não foi possível buscar os lançamentos no servidor.',
        variant: 'destructive',
      })
    } finally {
      setIsLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studentId])

  useEffect(() => {
    loadFees()
  }, [loadFees, refreshKey])

  // Tempo real: mensalidades lançadas/marcadas por outro admin aparecem na hora
  useRealtime('monthly_fees', () => {
    loadFees()
  })

  const standing = feeStanding(fees)
  const standingMeta = STANDING_META[standing]
  const paidThisYear = paidTotalInYear(fees, new Date().getFullYear())

  const handleMarkPaid = async (fee: MonthlyFee) => {
    setMarkingId(fee.id)
    try {
      const updated = await monthlyFeesService.markPaid(fee.id)
      setFees((prev) => prev.map((f) => (f.id === updated.id ? updated : f)))
      toast({
        title: 'Mensalidade paga',
        description: `${monthLabel(updated.reference_month)} · ${fmtBRL(updated.amount)} — pagamento registrado presencialmente.`,
      })
    } catch (err: any) {
      console.error('Erro ao marcar mensalidade como paga:', err)
      toast({
        title: 'Erro ao registrar pagamento',
        description: err?.message || 'Falha ao salvar no servidor. Tente novamente.',
        variant: 'destructive',
      })
    } finally {
      setMarkingId(null)
    }
  }

  const handleDelete = async () => {
    if (!deletingFee) return
    setDeleting(true)
    try {
      await monthlyFeesService.remove(deletingFee.id)
      setFees((prev) => prev.filter((f) => f.id !== deletingFee.id))
      toast({
        title: 'Lançamento removido',
        description: `A mensalidade de ${monthLabel(deletingFee.reference_month)} saiu da ficha do aluno.`,
      })
      setDeletingFee(null)
    } catch (err: any) {
      console.error('Erro ao remover mensalidade:', err)
      toast({
        title: 'Erro ao remover',
        description: err?.message || 'Falha ao remover no servidor. Tente novamente.',
        variant: 'destructive',
      })
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* Resumo: situação atual + total pago no ano */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="rounded-xl border px-4 py-3 shadow-xs bg-white border-[#E8E0D5]">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-[#9A948C]">
            Situação atual
          </p>
          <div className="flex items-center gap-2 mt-1.5">
            <Badge className={`text-[11px] font-bold border ${standingMeta.cls}`}>
              {standingMeta.label}
            </Badge>
          </div>
          <p className="text-[10px] text-[#6B6560] mt-1.5 leading-relaxed">{standingMeta.hint}</p>
        </div>
        <div className="rounded-xl border px-4 py-3 shadow-xs bg-white border-[#E8E0D5]">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-[#9A948C] flex items-center gap-1">
            <Wallet className="w-3 h-3" /> Total pago em {new Date().getFullYear()}
          </p>
          <p className="font-serif font-bold text-xl text-[#1C1B1A] mt-1.5">
            {fmtBRL(paidThisYear)}
          </p>
          <p className="text-[10px] text-[#6B6560] mt-1.5 leading-relaxed">
            Soma das mensalidades com pagamento registrado (presencial).
          </p>
        </div>
      </div>

      {/* Tabela de mensalidades */}
      <div className={cardCls}>
        <div className="flex flex-wrap items-center justify-between gap-3 p-5 pb-4">
          <h3 className="font-serif font-bold text-base text-[#1C1B1A] flex items-center gap-2">
            <Receipt className="w-4 h-4 text-[#C1272D]" />
            Mensalidades
          </h3>
          <Button
            size="sm"
            onClick={() => setCreateOpen(true)}
            className="bg-[#C1272D] hover:bg-[#A01E23] text-white text-[11px] font-semibold"
          >
            <CalendarPlus className="w-3.5 h-3.5 mr-1.5" />
            Lançar mensalidade
          </Button>
        </div>

        {isLoading ? (
          <div className="flex items-center gap-2 text-sm text-[#6B6560] px-5 pb-5">
            <Clock className="w-4 h-4 animate-pulse" />
            Carregando mensalidades...
          </div>
        ) : fees.length === 0 ? (
          <div className="rounded-xl border border-dashed border-[#D9D2C7] bg-[#FAF6F0]/50 px-4 py-6 mx-5 mb-5 text-center">
            <p className="text-xs text-[#6B6560] flex items-center justify-center gap-2">
              <Info className="w-3.5 h-3.5 shrink-0" />
              Nenhuma mensalidade lançada — use "Lançar mensalidade" para registrar mês a mês.
            </p>
          </div>
        ) : (
          <>
            {/* Tabela (desktop) */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-t border-[#E8E0D5] bg-[#FAF6F0]/60 text-[#6B6560] font-serif uppercase tracking-wider text-[11px]">
                    <th className="py-3 px-5">Mês de referência</th>
                    <th className="py-3 px-4">Valor</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Vencimento</th>
                    <th className="py-3 px-4">Pagamento</th>
                    <th className="py-3 px-5 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E8E0D5]">
                  {fees.map((fee) => (
                    <tr key={fee.id} className="hover:bg-[#FAF6F0]/50 transition-colors">
                      <td className="py-3.5 px-5 font-semibold text-[#1C1B1A]">
                        {monthLabel(fee.reference_month)}
                      </td>
                      <td className="py-3.5 px-4 text-[#1C1B1A]">{fmtBRL(fee.amount)}</td>
                      <td className="py-3.5 px-4">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <Badge
                            className={`text-[10px] font-bold border ${STATUS_BADGE[fee.status]}`}
                          >
                            {fee.status === 'pago' ? 'Pago' : 'Pendente'}
                          </Badge>
                          {fee.payment_method && (
                            <Badge
                              className={`text-[10px] font-semibold border ${METHOD_BADGE[fee.payment_method]}`}
                            >
                              {paymentMethodLabel[fee.payment_method]}
                            </Badge>
                          )}
                        </div>
                      </td>
                      <td
                        className={`py-3.5 px-4 font-semibold ${
                          isOverdue(fee) ? 'text-[#C1272D]' : 'text-[#6B6560]'
                        }`}
                      >
                        {fee.due_date ? fmtDate(fee.due_date) : '—'}
                        {isOverdue(fee) && ' (vencida)'}
                      </td>
                      <td className="py-3.5 px-4 text-[#6B6560]">
                        {fee.status === 'pago' ? fmtDateTime(fee.paid_at) : '—'}
                      </td>
                      <td className="py-3.5 px-5 text-right">
                        <div className="inline-flex items-center gap-2">
                          {fee.status === 'pendente' && (
                            <button
                              type="button"
                              onClick={() => handleMarkPaid(fee)}
                              disabled={markingId === fee.id}
                              className="text-[#2E7D4F] hover:underline font-semibold text-xs inline-flex items-center gap-1 disabled:opacity-50"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              {markingId === fee.id ? 'Registrando...' : 'Marcar como paga'}
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => setDeletingFee(fee)}
                            className="text-[#6B6560] hover:text-[#C1272D] font-semibold text-xs inline-flex items-center gap-1"
                            title="Excluir lançamento"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Lista (mobile) */}
            <div className="md:hidden divide-y divide-[#E8E0D5] pb-2">
              {fees.map((fee) => (
                <div key={fee.id} className="p-4 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-sm text-[#1C1B1A]">
                      {monthLabel(fee.reference_month)}
                    </span>
                    <div className="flex items-center gap-1.5">
                      {fee.payment_method && (
                        <Badge
                          className={`text-[10px] font-semibold border ${METHOD_BADGE[fee.payment_method]}`}
                        >
                          {paymentMethodLabel[fee.payment_method]}
                        </Badge>
                      )}
                      <Badge className={`text-[10px] font-bold border ${STATUS_BADGE[fee.status]}`}>
                        {fee.status === 'pago' ? 'Pago' : 'Pendente'}
                      </Badge>
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-xs text-[#6B6560]">
                    <span className="font-serif font-bold text-[#1C1B1A]">
                      {fmtBRL(fee.amount)}
                    </span>
                    <span className={isOverdue(fee) ? 'text-[#C1272D] font-semibold' : undefined}>
                      {isOverdue(fee)
                        ? `Venceu em ${fmtDate(fee.due_date)}`
                        : fee.due_date
                          ? `Vence ${fmtDate(fee.due_date)}`
                          : '—'}
                    </span>
                  </div>
                  <div className="flex items-center justify-end text-[11px] text-[#6B6560]">
                    {fee.status === 'pago' ? `Pago em ${fmtDateTime(fee.paid_at)}` : '—'}
                  </div>
                  <div className="flex items-center justify-end gap-3 pt-1">
                    {fee.status === 'pendente' && (
                      <button
                        type="button"
                        onClick={() => handleMarkPaid(fee)}
                        disabled={markingId === fee.id}
                        className="text-[#2E7D4F] hover:underline font-semibold text-xs inline-flex items-center gap-1 disabled:opacity-50"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Marcar como paga
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setDeletingFee(fee)}
                      className="text-[#6B6560] hover:text-[#C1272D] font-semibold text-xs inline-flex items-center gap-1"
                      title="Excluir lançamento"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Excluir
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
        <p className="text-[10px] text-[#6B6560] px-5 py-3 border-t border-[#E8E0D5] flex items-start gap-1.5">
          <BadgeCheck className="w-3.5 h-3.5 shrink-0 mt-0.5 text-[#C1272D]" />
          Sem pagamento online: o pagamento da mensalidade é combinado e confirmado presencialmente
          — o admin marca como paga depois de receber.
        </p>
      </div>

      <CreateFeeDialog
        studentId={studentId}
        studentName={studentName}
        classes={classes}
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={(fee) =>
          setFees((prev) =>
            [fee, ...prev].sort((a, b) => b.reference_month.localeCompare(a.reference_month)),
          )
        }
      />

      {/* Confirmação de exclusão do lançamento */}
      <DeleteFeeDialog
        fee={deletingFee}
        deleting={deleting}
        onOpenChange={(open) => !open && setDeletingFee(null)}
        onConfirm={handleDelete}
      />
    </div>
  )
}

const DeleteFeeDialog: React.FC<{
  fee: MonthlyFee | null
  deleting: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: () => void
}> = ({ fee, deleting, onOpenChange, onConfirm }) => (
  <AlertDialog open={!!fee} onOpenChange={onOpenChange}>
    <AlertDialogContent className="bg-white border border-[#E8E0D5] rounded-2xl max-w-md">
      <AlertDialogHeader>
        <AlertDialogTitle className="font-serif text-[#1C1B1A]">
          Excluir lançamento de mensalidade?
        </AlertDialogTitle>
        <AlertDialogDescription className="text-[#6B6560] text-xs leading-relaxed">
          A mensalidade de{' '}
          <strong className="text-[#1C1B1A]">{fee ? monthLabel(fee.reference_month) : '—'}</strong>{' '}
          ({fee ? fmtBRL(fee.amount) : ''}) sairá da ficha do aluno. Esta ação não pode ser
          desfeita.
        </AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel className="border-[#E8E0D5] text-[#1C1B1A] text-xs font-semibold">
          Cancelar
        </AlertDialogCancel>
        <AlertDialogAction
          onClick={(e) => {
            e.preventDefault()
            onConfirm()
          }}
          disabled={deleting}
          className="bg-[#C1272D] hover:bg-[#A01E23] text-white text-xs font-semibold"
        >
          {deleting ? 'Excluindo...' : 'Sim, excluir'}
        </AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
)
