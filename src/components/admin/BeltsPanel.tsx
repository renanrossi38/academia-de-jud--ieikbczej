import React, { useEffect, useMemo, useState } from 'react'
import { ArrowDown, ArrowUp, Loader2, Medal, RotateCcw, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
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
import { useToast } from '@/hooks/use-toast'
import { useRealtime } from '@/hooks/use-realtime'
import { beltBadgeClass, beltLabel, useBeltOptions } from '@/components/admin/StudentDialogs'
import { fmtDate } from '@/pages/admin/StudentDetailPanels'
import {
  CreateBeltPromotionInput,
  BELT_ORDER,
  beltPromotionsService,
  nextBelt,
  timeInBeltLabel,
  todayKeyBrasilia,
} from '@/services/beltPromotions'
import { loadBeltOrder, resetBeltOrder, saveBeltOrder } from '@/services/beltOrder'
import { Belt, BeltPromotion } from '@/types'

const selectClass =
  'w-full h-9 text-sm rounded-md border border-[#E8E0D5] bg-white px-3 text-[#1C1B1A] focus:outline-hidden focus:ring-1 focus:ring-[#C1272D]'

/**
 * Painel de faixas da ficha do aluno (/painel/alunos/:id, aba "Faixas").
 * Lança promoções (com data, retroativo permitido), mostra o histórico da
 * faixa atual para trás e há quanto tempo o aluno está na faixa — base para
 * planejar o próximo exame.
 */
export default function BeltsPanel({ studentId }: { studentId: string }) {
  const { toast } = useToast()

  const [promotions, setPromotions] = useState<BeltPromotion[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [deleting, setDeleting] = useState<BeltPromotion | null>(null)
  const [isRemoving, setIsRemoving] = useState(false)

  const load = React.useCallback(async () => {
    try {
      setPromotions(await beltPromotionsService.listByStudent(studentId))
    } catch (err) {
      console.error('Erro ao carregar histórico de faixas:', err)
      toast({
        title: 'Erro ao carregar histórico de faixas',
        description: 'Não foi possível buscar os dados no servidor.',
        variant: 'destructive',
      })
    } finally {
      setIsLoading(false)
    }
  }, [studentId, toast])

  useEffect(() => {
    void load()
  }, [load])

  // Atualização ao vivo: promoções lançadas de outro lugar aparecem na hora.
  useRealtime('belt_promotions', () => void load())

  // A promoção mais recente define a faixa atual (e o tempo nela).
  const latest = useMemo(
    () =>
      [...promotions]
        .sort(
          (a, b) =>
            (a.promoted_at || '').localeCompare(b.promoted_at || '') ||
            (a.created || '').localeCompare(b.created || ''),
        )
        .pop() ?? null,
    [promotions],
  )

  const handleDelete = async () => {
    if (!deleting) return
    setIsRemoving(true)
    try {
      await beltPromotionsService.remove(deleting.id)
      setPromotions((prev) => prev.filter((p) => p.id !== deleting.id))
      toast({
        title: 'Lançamento removido',
        description: `A promoção de ${fmtDate(deleting.promoted_at)} saiu do histórico.`,
      })
      setDeleting(null)
    } catch (err: any) {
      console.error('Erro ao remover promoção:', err)
      toast({
        title: 'Erro ao remover',
        description: err?.message || 'Falha ao remover no servidor. Tente novamente.',
        variant: 'destructive',
      })
    } finally {
      setIsRemoving(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* Faixa atual + tempo nela */}
      <div className="bg-white rounded-2xl border border-[#E8E0D5] shadow-xs p-5">
        <div className="flex items-center justify-between gap-3 mb-4">
          <h3 className="font-serif font-bold text-base text-[#1C1B1A] flex items-center gap-2">
            <Medal className="w-4 h-4 text-[#C1272D]" />
            Faixa atual
          </h3>
          <Button
            size="sm"
            onClick={() => setDialogOpen(true)}
            className="bg-[#C1272D] hover:bg-[#A01E23] text-white text-[11px] font-semibold"
          >
            Promover faixa
          </Button>
        </div>

        {latest ? (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            {latest.exam_score != null && (
              <Badge className="bg-[#F7E4E2] text-[#C1272D] border-[#C1272D]/20 text-[11px] font-bold">
                Nota {String(latest.exam_score).replace('.', ',')}
              </Badge>
            )}
            <Badge className={`text-xs font-bold border ${beltBadgeClass(latest.belt)}`}>
              Faixa {beltLabel(latest.belt)}
            </Badge>
            <span className="text-sm text-[#1C1B1A] font-semibold">
              promovido em {fmtDate(latest.promoted_at)}
            </span>
            <Badge className="bg-[#FAF6F0] text-[#6B6560] border-[#E8E0D5] text-[11px] font-semibold">
              {timeInBeltLabel(latest.promoted_at)}
            </Badge>
            {latest.notes && (
              <p className="w-full text-[11px] text-[#6B6560] italic">“{latest.notes}”</p>
            )}
          </div>
        ) : (
          <p className="text-xs text-[#6B6560]">
            Nenhuma promoção lançada ainda — a faixa exibida no sistema é a do cadastro manual. Use
            "Promover faixa" para começar o histórico.
          </p>
        )}
      </div>

      {/* Histórico de promoções, da atual para trás */}
      <div className="bg-white rounded-2xl border border-[#E8E0D5] shadow-xs p-5">
        <h3 className="font-serif font-bold text-base text-[#1C1B1A] mb-4">
          Histórico de promoções
        </h3>
        {isLoading ? (
          <p className="text-xs text-[#6B6560] flex items-center gap-2">
            <Loader2 className="w-3.5 h-3.5 animate-spin" /> Carregando...
          </p>
        ) : promotions.length === 0 ? (
          <p className="text-xs text-[#6B6560]">
            Nenhuma promoção registrada — o histórico começa no primeiro lançamento.
          </p>
        ) : (
          <ul className="divide-y divide-[#E8E0D5]">
            {promotions.map((p, idx) => (
              <li key={p.id} className="py-3 flex flex-wrap items-center gap-x-3 gap-y-1.5">
                <span className="w-6 h-6 rounded-full bg-[#FAF6F0] border border-[#E8E0D5] text-[10px] font-bold text-[#6B6560] flex items-center justify-center shrink-0">
                  {promotions.length - idx}
                </span>
                <Badge className={`text-[10px] font-bold border ${beltBadgeClass(p.belt)}`}>
                  {beltLabel(p.belt)}
                </Badge>
                <span className="text-sm font-semibold text-[#1C1B1A] inline-flex items-center gap-1.5">
                  promovido em {fmtDate(p.promoted_at)}
                </span>
                {idx === 0 && (
                  <Badge className="bg-[#F7E4E2] text-[#C1272D] border-[#C1272D]/20 text-[10px] font-bold">
                    atual
                  </Badge>
                )}
                {p.exam_score != null && (
                  <Badge className="bg-[#FAF6F0] text-[#1C1B1A] border-[#E8E0D5] text-[10px] font-bold">
                    Nota {String(p.exam_score).replace('.', ',')}
                  </Badge>
                )}
                {p.notes && <span className="text-[11px] text-[#6B6560]">{p.notes}</span>}
                <button
                  onClick={() => setDeleting(p)}
                  className="ml-auto text-[#6B6560] hover:text-[#C1272D] font-semibold text-xs inline-flex items-center gap-1 shrink-0"
                  title="Remover este lançamento do histórico"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Remover
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <PromoteBeltDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        studentId={studentId}
        currentBelt={latest?.belt}
        onCreated={(p) => setPromotions((prev) => [p, ...prev])}
      />

      {/* Editor da ordem das faixas (salva em app_settings, vale no sistema todo) */}
      <BeltOrderEditor />

      {/* Confirmação de remoção de lançamento errado */}
      <AlertDialog open={!!deleting} onOpenChange={(open) => !open && setDeleting(null)}>
        <AlertDialogContent className="bg-white border border-[#E8E0D5] rounded-2xl max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-serif text-[#1C1B1A]">
              Remover lançamento?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-[#6B6560] text-xs leading-relaxed">
              A promoção de <strong className="text-[#1C1B1A]">{beltLabel(deleting?.belt)}</strong>{' '}
              em {fmtDate(deleting?.promoted_at || '')} sairá do histórico. O lançamento errado não
              pode ser editado — remova e cadastre de novo com os dados certos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-[#E8E0D5] text-[#1C1B1A] text-xs font-semibold">
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault()
                handleDelete()
              }}
              disabled={isRemoving}
              className="bg-[#C1272D] hover:bg-[#A01E23] text-white text-xs font-semibold"
            >
              {isRemoving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Removendo...
                </>
              ) : (
                'Sim, remover'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

/**
 * Diálogo de promoção: nova faixa (sugerindo a próxima da sequência), data
 * (padrão hoje em Brasília, editável para retroativo) e observação opcional.
 */
function PromoteBeltDialog({
  open,
  onOpenChange,
  studentId,
  currentBelt,
  onCreated,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  studentId: string
  currentBelt?: Belt
  onCreated: (promotion: BeltPromotion) => void
}) {
  const { toast } = useToast()
  const beltOptions = useBeltOptions()
  const suggested = nextBelt(currentBelt)

  const [belt, setBelt] = useState<Belt | ''>('')
  const [date, setDate] = useState('')
  const [notes, setNotes] = useState('')
  // Nota do exame: string para permitir campo vazio; vira número ou é omitida.
  const [examScore, setExamScore] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  // Ao abrir: sugere a próxima faixa da sequência e a data de hoje (Brasília).
  useEffect(() => {
    if (open) {
      setBelt(suggested || '')
      setDate(todayKeyBrasilia())
      setNotes('')
      setExamScore('')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!belt) {
      toast({
        title: 'Escolha a nova faixa',
        description: 'Selecione a faixa conquistada na promoção.',
        variant: 'destructive',
      })
      return
    }
    if (!date) {
      toast({
        title: 'Informe a data',
        description: 'A data da promoção entra no histórico e conta o tempo na faixa.',
        variant: 'destructive',
      })
      return
    }
    setIsSaving(true)
    try {
      const input: CreateBeltPromotionInput = {
        studentId,
        belt,
        date,
        examScore: examScore.trim() === '' ? undefined : Number(examScore.replace(',', '.')),
        notes: notes.trim() || undefined,
      }
      const created = await beltPromotionsService.create(input)
      toast({
        title: 'Promoção registrada!',
        description: `Aluno promovido para faixa ${beltLabel(belt)} em ${fmtDate(created.promoted_at)}.`,
      })
      onCreated(created)
      onOpenChange(false)
    } catch (err: any) {
      console.error('Erro ao registrar promoção:', err)
      toast({
        title: 'Erro ao registrar promoção',
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
          <DialogTitle className="font-serif text-[#1C1B1A]">Promover faixa</DialogTitle>
          <DialogDescription className="text-[#6B6560] text-xs leading-relaxed">
            A nova faixa entra no histórico e passa a ser a faixa exibida do aluno em todo o
            sistema. A data pode ser retroativa (ex.: exame do mês passado).
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="belt-new" className="text-xs font-semibold text-[#1C1B1A]">
              Nova faixa
            </Label>
            <select
              id="belt-new"
              value={belt}
              onChange={(e) => setBelt(e.target.value as Belt)}
              required
              className={selectClass}
            >
              <option value="">Selecione…</option>
              {(suggested
                ? [
                    { label: beltLabel(suggested), value: suggested },
                    ...beltOptions.filter((b) => b.value !== suggested),
                  ]
                : beltOptions
              ).map((b) => (
                <option key={b.value} value={b.value}>
                  Faixa {b.label}
                  {b.value === suggested ? ' (sugerida)' : ''}
                </option>
              ))}
            </select>
            {suggested && (
              <p className="text-[11px] text-[#6B6560]">
                Sugestão: a próxima da sequência depois da faixa atual.
              </p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="belt-date" className="text-xs font-semibold text-[#1C1B1A]">
              Data da promoção
            </Label>
            <Input
              id="belt-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
              className="h-10 text-sm bg-white border-[#E8E0D5] focus-visible:ring-[#C1272D]"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="belt-exam-score" className="text-xs font-semibold text-[#1C1B1A]">
              Nota do exame (opcional)
            </Label>
            <Input
              id="belt-exam-score"
              type="number"
              min={0}
              max={10}
              step={0.5}
              value={examScore}
              onChange={(e) => setExamScore(e.target.value)}
              placeholder="Ex.: 8.5"
              className="h-10 text-sm bg-white border-[#E8E0D5] focus-visible:ring-[#C1272D]"
            />
            <p className="text-[11px] text-[#6B6560]">
              De 0 a 10 — aparece no histórico de graduações e na Área do aluno.
            </p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="belt-notes" className="text-xs font-semibold text-[#1C1B1A]">
              Observação (opcional)
            </Label>
            <Textarea
              id="belt-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Ex.: exame realizado na filial, graduação dupla"
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
                'Registrar promoção'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

/**
 * Editor da ordem das faixas: sobe/desce cada faixa e salva em app_settings
 * ("belt_order"). A ordem vale para os selects e listagens do sistema; a faixa
 * ATUAL de cada aluno não muda (ela vem da última promoção, currentBeltFrom).
 */
function BeltOrderEditor({ onSaved }: { onSaved?: () => void }) {
  const { toast } = useToast()
  const [order, setOrder] = useState<Belt[]>(BELT_ORDER)
  const [isSaving, setIsSaving] = useState(false)
  const [dirty, setDirty] = useState(false)

  useEffect(() => {
    let cancelled = false
    loadBeltOrder().then((saved) => {
      if (!cancelled) setOrder(saved)
    })
    return () => {
      cancelled = true
    }
  }, [])

  const move = (index: number, dir: -1 | 1) => {
    setOrder((prev) => {
      const next = [...prev]
      const target = index + dir
      if (target < 0 || target >= next.length) return prev
      ;[next[index], next[target]] = [next[target], next[index]]
      return next
    })
    setDirty(true)
  }

  const handleSave = async () => {
    setIsSaving(true)
    try {
      await saveBeltOrder(order)
      setDirty(false)
      toast({ title: 'Ordem das faixas salva!' })
      onSaved?.()
    } catch (err: any) {
      console.error('Erro ao salvar ordem das faixas:', err)
      toast({
        title: 'Erro ao salvar ordem',
        description: err?.message || 'Tente novamente em instantes.',
        variant: 'destructive',
      })
    } finally {
      setIsSaving(false)
    }
  }

  const handleReset = async () => {
    setIsSaving(true)
    try {
      await resetBeltOrder()
      setOrder(BELT_ORDER)
      setDirty(false)
      toast({ title: 'Ordem padrão restaurada', description: 'Sequência oficial do judô.' })
      onSaved?.()
    } catch (err: any) {
      console.error('Erro ao restaurar ordem:', err)
      toast({
        title: 'Erro ao restaurar',
        description: err?.message || 'Tente novamente em instantes.',
        variant: 'destructive',
      })
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="bg-white rounded-2xl border border-[#E8E0D5] shadow-xs p-5">
      <h3 className="font-serif font-bold text-base text-[#1C1B1A] mb-1">Ordem das faixas</h3>
      <p className="text-[11px] text-[#6B6560] mb-4">
        Ordem usada nos selects e listagens do sistema. Reordenar NÃO altera a faixa atual de nenhum
        aluno — ela continua vindo da última promoção registrada.
      </p>
      <ul className="divide-y divide-[#E8E0D5] mb-4">
        {order.map((belt, idx) => (
          <li key={belt} className="py-2 flex items-center gap-3">
            <span className="w-6 h-6 rounded-full bg-[#FAF6F0] border border-[#E8E0D5] text-[10px] font-bold text-[#6B6560] flex items-center justify-center shrink-0">
              {idx + 1}
            </span>
            <Badge className={`text-[10px] font-bold border ${beltBadgeClass(belt)}`}>
              Faixa {beltLabel(belt)}
            </Badge>
            <span className="ml-auto inline-flex items-center gap-1">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => move(idx, -1)}
                disabled={idx === 0 || isSaving}
                className="h-7 w-7 p-0 border-[#E8E0D5] text-[#1C1B1A]"
                title="Mover para cima"
              >
                <ArrowUp className="w-3.5 h-3.5" />
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => move(idx, 1)}
                disabled={idx === order.length - 1 || isSaving}
                className="h-7 w-7 p-0 border-[#E8E0D5] text-[#1C1B1A]"
                title="Mover para baixo"
              >
                <ArrowDown className="w-3.5 h-3.5" />
              </Button>
            </span>
          </li>
        ))}
      </ul>
      <div className="flex items-center gap-2">
        <Button
          onClick={handleSave}
          disabled={isSaving || !dirty}
          className="bg-[#C1272D] hover:bg-[#A01E23] text-white text-[11px] font-semibold"
        >
          {isSaving ? (
            <>
              <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" />
              Salvando...
            </>
          ) : (
            'Salvar ordem'
          )}
        </Button>
        <Button
          variant="outline"
          onClick={handleReset}
          disabled={isSaving}
          className="border-[#E8E0D5] text-[#1C1B1A] text-[11px] font-semibold hover:bg-[#FAF6F0]"
        >
          <RotateCcw className="w-3.5 h-3.5 mr-1.5" />
          Restaurar padrão
        </Button>
        {!dirty && (
          <span className="text-[11px] text-[#6B6560]">Ordem atual salva no sistema.</span>
        )}
      </div>
    </div>
  )
}
