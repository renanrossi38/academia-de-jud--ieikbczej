import React, { useEffect, useState } from 'react'
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
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/hooks/use-toast'
import { expensesService } from '@/services/expenses'
import { currentMonthKeyBrasilia } from '@/services/finance'
import { Expense, ExpenseCategory } from '@/types'

/** Rótulos das categorias de despesa (mesma lista do select da collection). */
export const expenseCategoryLabel: Record<ExpenseCategory, string> = {
  aluguel: 'Aluguel',
  energia: 'Energia',
  agua: 'Água',
  internet: 'Internet',
  insumos: 'Insumos',
  equipamento: 'Equipamento',
  salarios: 'Salários',
  impostos: 'Impostos',
  outro: 'Outro',
}

const parseAmount = (raw: string): number | null => {
  const normalized = raw.replace(/\./g, '').replace(',', '.').trim()
  if (!normalized) return null
  const value = Number(normalized)
  return Number.isFinite(value) && value > 0 ? value : null
}

/**
 * Diálogo de nova despesa — descrição, valor, data (retroativa permitida:
 * reflete no mês certo do gráfico), categoria e observação.
 */
export default function ExpenseDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated: (expense: Expense) => void
}) {
  const { toast } = useToast()

  const [description, setDescription] = useState('')
  const [amountInput, setAmountInput] = useState('')
  const [date, setDate] = useState('')
  const [category, setCategory] = useState<ExpenseCategory | ''>('')
  const [notes, setNotes] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  // Ao abrir: data de hoje em Brasília por padrão, campos limpos.
  useEffect(() => {
    if (open) {
      const d = new Date(Date.now() - 3 * 60 * 60 * 1000)
      const todayKey = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`
      setDescription('')
      setAmountInput('')
      setDate(todayKey)
      setCategory('')
      setNotes('')
    }
  }, [open])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const desc = description.trim()
    if (!desc) {
      toast({
        title: 'Informe a descrição',
        description: 'Descreva o que foi pago (ex.: aluguel do galpão).',
        variant: 'destructive',
      })
      return
    }
    const amount = parseAmount(amountInput)
    if (amount == null) {
      toast({
        title: 'Informe o valor',
        description: 'Digite um valor válido maior que zero (ex.: 350,00).',
        variant: 'destructive',
      })
      return
    }
    if (!date) {
      toast({
        title: 'Informe a data',
        description: 'A data define em que mês a despesa entra no painel.',
        variant: 'destructive',
      })
      return
    }
    setIsSaving(true)
    try {
      const created = await expensesService.create({
        description: desc,
        amount,
        date,
        category: category || undefined,
        notes: notes.trim() || undefined,
      })
      toast({
        title: 'Despesa lançada',
        description: `${desc} · ${amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} — entrou no mês de ${date.slice(0, 7)}.`,
      })
      onCreated(created)
      onOpenChange(false)
    } catch (err: any) {
      console.error('Erro ao lançar despesa:', err)
      toast({
        title: 'Erro ao lançar despesa',
        description: err?.message || 'Falha ao salvar no servidor. Tente novamente.',
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
          <DialogTitle className="font-serif text-[#1C1B1A]">Nova despesa</DialogTitle>
          <DialogDescription className="text-[#6B6560] text-xs leading-relaxed">
            A data define o mês do gráfico — dá para lançar despesas retroativas (ex.: a energia do
            mês passado) e o painel encaixa no lugar certo.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="expense-description" className="text-xs font-semibold text-[#1C1B1A]">
              Descrição
            </Label>
            <Input
              id="expense-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Ex.: aluguel do galpão"
              required
              className="h-10 text-sm bg-white border-[#E8E0D5] focus-visible:ring-[#C1272D]"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="expense-amount" className="text-xs font-semibold text-[#1C1B1A]">
                Valor (R$)
              </Label>
              <Input
                id="expense-amount"
                inputMode="decimal"
                placeholder="Ex.: 350,00"
                value={amountInput}
                onChange={(e) => setAmountInput(e.target.value)}
                required
                className="h-10 text-sm bg-white border-[#E8E0D5] focus-visible:ring-[#C1272D]"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="expense-date" className="text-xs font-semibold text-[#1C1B1A]">
                Data
              </Label>
              <Input
                id="expense-date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
                className="h-10 text-sm bg-white border-[#E8E0D5] focus-visible:ring-[#C1272D]"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-[#1C1B1A]">Categoria (opcional)</Label>
            <div className="flex flex-wrap gap-1.5">
              {(Object.keys(expenseCategoryLabel) as ExpenseCategory[]).map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCategory(category === c ? '' : c)}
                  className={`h-8 px-3 rounded-full border text-xs font-semibold transition-colors ${
                    category === c
                      ? 'bg-[#C1272D] border-[#C1272D] text-white'
                      : 'bg-white border-[#E8E0D5] text-[#6B6560] hover:border-[#C1272D]/40'
                  }`}
                >
                  {expenseCategoryLabel[c]}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="expense-notes" className="text-xs font-semibold text-[#1C1B1A]">
              Observação (opcional)
            </Label>
            <Textarea
              id="expense-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Ex.: pago no PIX, nota fiscal nº 123"
              className="text-sm bg-white border-[#E8E0D5] focus-visible:ring-[#C1272D]"
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
                'Lançar despesa'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
