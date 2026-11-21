import React, { useEffect, useMemo, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useToast } from '@/hooks/use-toast'
import { Class, MonthlyFee, PaymentMethod } from '@/types'
import { defaultDueDate, monthlyFeesService, paymentMethodLabel } from '@/services/monthlyFees'

/** Converte a mensalidade de referência da turma em texto de input ("120,00"). */
const formatFeeForInput = (value: number | undefined) =>
  value != null && value > 0 ? String(value).replace('.', ',') : ''

const parseFeeAmount = (raw: string): number | null => {
  const normalized = raw.replace(/\./g, '').replace(',', '.').trim()
  if (!normalized) return null
  const value = Number(normalized)
  return Number.isFinite(value) && value >= 0 ? value : null
}

export default function CreateFeeDialog({
  studentId,
  studentName,
  classes,
  open,
  onOpenChange,
  onCreated,
}: {
  studentId: string
  studentName: string
  classes: Class[]
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated: (fee: MonthlyFee) => void
}) {
  const { toast } = useToast()

  const [month, setMonth] = useState('')
  const [amountInput, setAmountInput] = useState('')
  const [notes, setNotes] = useState('')
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | ''>('')
  const [dueDate, setDueDate] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  // Mensalidade de referência da primeira turma ativa do aluno.
  const suggestedAmount = useMemo(() => {
    const active = classes.filter((c) => c.active)
    return active.length > 0 ? active[0].monthly_fee : undefined
  }, [classes])

  // Ao abrir: mês atual por padrão e valor sugerido da turma (editável).
  useEffect(() => {
    if (open) {
      const now = new Date()
      const key = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
      setMonth(key)
      setAmountInput(formatFeeForInput(suggestedAmount))
      setNotes('')
      setPaymentMethod('')
      setDueDate(defaultDueDate(key))
    }
  }, [open, suggestedAmount])

  // Vencimento padrão acompanha o mês escolhido: dia 15 do reference_month.
  const handleMonthChange = (value: string) => {
    setMonth(value)
    if (value) setDueDate(defaultDueDate(value))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!month) {
      toast({
        title: 'Informe o mês',
        description: 'Selecione o mês de referência da mensalidade.',
        variant: 'destructive',
      })
      return
    }
    const amount = parseFeeAmount(amountInput)
    if (amount == null) {
      toast({
        title: 'Informe o valor',
        description: 'Digite um valor válido para a mensalidade (ex.: 120,00).',
        variant: 'destructive',
      })
      return
    }
    if (!dueDate) {
      toast({
        title: 'Informe o vencimento',
        description: 'Defina a data de vencimento (padrão: dia 15 do mês de referência).',
        variant: 'destructive',
      })
      return
    }
    setIsSaving(true)
    try {
      const created = await monthlyFeesService.create({
        studentId,
        referenceMonth: month,
        amount,
        notes: notes.trim() || undefined,
        paymentMethod: paymentMethod || undefined,
        dueDate,
      })
      toast({
        title: 'Mensalidade lançada',
        description: `${month} · ${amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} para ${studentName}.`,
      })
      onCreated(created)
      onOpenChange(false)
    } catch (err: any) {
      console.error('Erro ao lançar mensalidade:', err)
      const isDuplicate =
        err?.status === 400 &&
        typeof err?.response?.message === 'string' &&
        err.response.message.toLowerCase().includes('unique')
      toast({
        title: isDuplicate ? 'Mês já lançado' : 'Erro ao lançar mensalidade',
        description: isDuplicate
          ? `Já existe uma mensalidade para ${month} deste aluno — nenhum mês pode ser lançado duas vezes.`
          : err?.message || 'Falha ao salvar no servidor. Tente novamente.',
        variant: 'destructive',
      })
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-white border border-[#E8E0D5] rounded-2xl max-w-md">
        <DialogHeader>
          <DialogTitle className="font-serif text-[#1C1B1A]">Lançar mensalidade</DialogTitle>
          <DialogDescription className="text-[#6B6560] text-xs leading-relaxed">
            Registro do mês de referência para {studentName}. O pagamento é confirmado
            presencialmente — depois use "Marcar como paga" na lista.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="fee-month" className="text-xs font-semibold text-[#1C1B1A]">
              Mês de referência
            </Label>
            <Input
              id="fee-month"
              type="month"
              value={month}
              onChange={(e) => handleMonthChange(e.target.value)}
              required
              className="h-10 text-sm bg-white border-[#E8E0D5] focus-visible:ring-[#C1272D]"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="fee-amount" className="text-xs font-semibold text-[#1C1B1A]">
                Valor (R$)
              </Label>
              <Input
                id="fee-amount"
                inputMode="decimal"
                placeholder="Ex.: 120,00"
                value={amountInput}
                onChange={(e) => setAmountInput(e.target.value)}
                required
                className="h-10 text-sm bg-white border-[#E8E0D5] focus-visible:ring-[#C1272D]"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="fee-due" className="text-xs font-semibold text-[#1C1B1A]">
                Vencimento
              </Label>
              <Input
                id="fee-due"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                required
                className="h-10 text-sm bg-white border-[#E8E0D5] focus-visible:ring-[#C1272D]"
              />
              <p className="text-[10px] text-[#6B6560]">Padrão: dia 15 do mês de referência.</p>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-[#1C1B1A]">
              Método de pagamento (opcional)
            </Label>
            <div className="flex flex-wrap gap-1.5">
              {(Object.keys(paymentMethodLabel) as PaymentMethod[]).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setPaymentMethod(paymentMethod === m ? '' : m)}
                  className={`h-8 px-3 rounded-full border text-xs font-semibold transition-colors ${
                    paymentMethod === m
                      ? 'bg-[#C1272D] border-[#C1272D] text-white'
                      : 'bg-white border-[#E8E0D5] text-[#6B6560] hover:border-[#C1272D]/40'
                  }`}
                >
                  {paymentMethodLabel[m]}
                </button>
              ))}
            </div>
            <p className="text-[10px] text-[#6B6560]">
              Como o aluno combinou pagar — pix, dinheiro ou cartão. Pode ficar vazio.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="fee-notes" className="text-xs font-semibold text-[#1C1B1A]">
              Observações (opcional)
            </Label>
            <Input
              id="fee-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ex.: combinado com desconto"
              className="h-10 text-sm bg-white border-[#E8E0D5] focus-visible:ring-[#C1272D]"
            />
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              className="text-[#6B6560] text-xs font-semibold"
              disabled={isSaving}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={isSaving}
              className="bg-[#C1272D] hover:bg-[#A01E23] text-white text-xs font-semibold"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Salvando...
                </>
              ) : (
                'Lançar'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
