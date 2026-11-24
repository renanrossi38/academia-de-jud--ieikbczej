import { useMemo, useState } from 'react'
import { Award, Loader2, Star, Trash2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
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
import { brasiliaDayKey, brasiliaMonthKey, monthLabel } from '@/services/monthlyFees'
import { classMedalsService, MedalKind } from '@/services/classMedals'
import { ClassMedal } from '@/types'

/** Painel "Medalhas do mês 🏅" da turma infantil (aba do AdminClassDetail). */
export function MedalsPanel({
  classId,
  medals,
  medalsLoading,
  onChanged,
  students,
}: {
  classId: string
  medals: ClassMedal[]
  medalsLoading: boolean
  /** Recarrega a lista (usado após criar/editar para manter realtime coerente). */
  onChanged: () => void
  /** Alunos da chamada — [id] → nome, para rotular os registros. */
  students: { id: string; name: string }[]
}) {
  const { toast } = useToast()

  const [medalStudentId, setMedalStudentId] = useState('')
  const [medalKind, setMedalKind] = useState<MedalKind>('dorme_dorme')
  const [medalMonth, setMedalMonth] = useState(() => brasiliaMonthKey())
  // Dia do recebimento — padrão HOJE em horário de Brasília (UTC-3, projeto).
  const [medalDay, setMedalDay] = useState(() => brasiliaDayKey())
  const [isSavingMedal, setIsSavingMedal] = useState(false)
  // Medalha com o dia sendo editado (fluxo: editar data sem recriar o registro).
  const [editingMedal, setEditingMedal] = useState<ClassMedal | null>(null)
  const [editDay, setEditDay] = useState('')
  const [isSavingDate, setIsSavingDate] = useState(false)
  const [removingMedal, setRemovingMedal] = useState<ClassMedal | null>(null)
  const [isRemoving, setIsRemoving] = useState(false)

  const studentName = (id: string) => students.find((s) => s.id === id)?.name || 'Aluno'

  /** "2026-11-24 12:00:00.000Z" (ou vazio em registros antigos) → "24/11". */
  const dayLabel = (m: ClassMedal): string => {
    if (!m.received_at) return ''
    const day = String(m.received_at).split(' ')[0].split('T')[0]
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return ''
    const [, mo, d] = day.split('-')
    return `${d}/${mo}`
  }

  /** Resumo de constância por aluno no mês: quantas dorme dormes e em quais dias. */
  const resumoPorAluno = useMemo(() => {
    const porAluno = new Map<string, string[]>()
    for (const m of medals) {
      if (m.kind !== 'dorme_dorme') continue
      const dias = porAluno.get(m.student) || []
      const dia = dayLabel(m)
      if (dia) dias.push(dia)
      porAluno.set(m.student, dias)
    }
    return [...porAluno.entries()]
      .map(([studentId, dias]) => ({
        studentId,
        name: studentName(studentId),
        count: dias.length,
        dias: dias.join(', '),
      }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'pt-BR'))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [medals, students])

  const handleAddMedal = async () => {
    if (!classId || !medalStudentId) return
    if (medalMonth > brasiliaMonthKey()) {
      toast({
        title: 'Mês inválido',
        description: 'Não é possível atribuir medalha com mês futuro.',
        variant: 'destructive',
      })
      return
    }
    // Dorme dorme precisa do dia do recebimento (desempate de constância).
    if (medalKind === 'dorme_dorme' && !medalDay) {
      toast({
        title: 'Informe o dia',
        description: 'A dorme dorme precisa do dia em que foi recebida.',
        variant: 'destructive',
      })
      return
    }
    setIsSavingMedal(true)
    try {
      await classMedalsService.add({
        classId,
        studentId: medalStudentId,
        month: medalMonth,
        kind: medalKind,
        receivedAt: medalDay || null,
      })
      toast({ title: 'Medalha atribuída!' })
      setMedalStudentId('')
      onChanged()
    } catch (err: any) {
      console.error('Erro ao atribuir medalha:', err)
      toast({
        title: 'Erro ao atribuir medalha',
        description: err?.message || 'Tente novamente.',
        variant: 'destructive',
      })
    } finally {
      setIsSavingMedal(false)
    }
  }

  const handleSaveDate = async () => {
    if (!editingMedal || !editDay) return
    setIsSavingDate(true)
    try {
      await classMedalsService.updateDate(editingMedal.id, editDay)
      toast({ title: 'Dia atualizado!' })
      setEditingMedal(null)
      onChanged()
    } catch (err: any) {
      console.error('Erro ao editar data da medalha:', err)
      toast({
        title: 'Erro ao editar data',
        description: err?.message || 'Tente novamente.',
        variant: 'destructive',
      })
    } finally {
      setIsSavingDate(false)
    }
  }

  const handleRemoveMedal = async () => {
    if (!removingMedal) return
    setIsRemoving(true)
    try {
      await classMedalsService.remove(removingMedal.id)
      toast({ title: 'Medalha removida.' })
      setRemovingMedal(null)
      onChanged()
    } catch (err: any) {
      console.error('Erro ao remover medalha:', err)
      toast({
        title: 'Erro ao remover medalha',
        description: err?.message || 'Tente novamente.',
        variant: 'destructive',
      })
    } finally {
      setIsRemoving(false)
    }
  }

  return (
    <div className="bg-white rounded-2xl border border-[#E8E0D5] shadow-xs p-4 sm:p-5 mb-4">
      <div className="flex items-center gap-2 mb-3">
        <Award className="w-4 h-4 text-[#C1272D]" />
        <span className="text-xs font-bold text-[#1C1B1A] font-serif">Medalhas do mês</span>
        {medalsLoading && (
          <Loader2
            className="w-3.5 h-3.5 animate-spin text-[#C1272D]/60"
            aria-label="Carregando medalhas"
          />
        )}
      </div>
      <p className="text-[11px] text-[#6B6560] mb-3">
        🏅 <b>dorme dorme</b>: medalha levada pelo aluno — aparece apenas no mês vigente. ⭐{' '}
        <b>fica fica</b>: aluno destaque do mês — fica em destaque na lista durante TODO o mês
        seguinte ao concedido.
      </p>
      <div className="flex flex-col gap-2 lg:flex-row lg:items-end mb-3">
        <div className="space-y-1 flex-1 min-w-[140px]">
          <Label className="text-[11px] font-semibold text-[#1C1B1A]">Aluno</Label>
          <Select value={medalStudentId} onValueChange={setMedalStudentId}>
            <SelectTrigger className="h-9 text-sm bg-white border-[#E8E0D5] focus:ring-[#C1272D]">
              <SelectValue placeholder="Selecione o aluno" />
            </SelectTrigger>
            <SelectContent>
              {students.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1 lg:w-44">
          <Label className="text-[11px] font-semibold text-[#1C1B1A]">Medalha</Label>
          <Select value={medalKind} onValueChange={(v) => setMedalKind(v as MedalKind)}>
            <SelectTrigger className="h-9 text-sm bg-white border-[#E8E0D5] focus:ring-[#C1272D]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="dorme_dorme">🏅 Dorme dorme</SelectItem>
              <SelectItem value="fica_fica">⭐ Fica fica</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1 lg:w-40">
          <Label className="text-[11px] font-semibold text-[#1C1B1A]">Mês</Label>
          <Input
            type="month"
            value={medalMonth}
            onChange={(e) => e.target.value && setMedalMonth(e.target.value)}
            className="h-9 text-sm bg-white border-[#E8E0D5] focus-visible:ring-[#C1272D]"
          />
        </div>
        {medalKind === 'dorme_dorme' && (
          <div className="space-y-1 lg:w-36">
            <Label className="text-[11px] font-semibold text-[#1C1B1A]">Dia recebida</Label>
            <Input
              type="date"
              value={medalDay}
              onChange={(e) => setMedalDay(e.target.value)}
              className="h-9 text-sm bg-white border-[#E8E0D5] focus-visible:ring-[#C1272D]"
            />
          </div>
        )}
        <Button
          onClick={handleAddMedal}
          disabled={!medalStudentId || isSavingMedal}
          className="h-9 bg-[#C1272D] hover:bg-[#A01E23] text-white text-xs font-semibold shrink-0"
        >
          {isSavingMedal ? (
            <>
              <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> Salvando...
            </>
          ) : (
            <>
              <Award className="w-3.5 h-3.5 mr-1.5" /> Atribuir
            </>
          )}
        </Button>
      </div>

      {/* Resumo de constância: quantas dorme dormes cada aluno recebeu no mês e em quais dias. */}
      {resumoPorAluno.length > 0 && (
        <div className="mb-3">
          <p className="text-[10px] font-bold uppercase tracking-wider text-[#6B6560] font-serif mb-1.5">
            Constância no mês (dorme dorme)
          </p>
          <div className="flex flex-wrap gap-1.5">
            {resumoPorAluno.map((r) => (
              <Badge
                key={r.studentId}
                className="bg-[#FAF6F0] text-[#1C1B1A] border-[#E8E0D5] text-[11px] font-semibold"
              >
                {r.name} — {r.count}
                {r.dias ? ` (${r.dias})` : ''}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* Lista das medalhas da turma — com o dia de cada dorme dorme e edição/remoção. */}
      <ul className="divide-y divide-[#E8E0D5] border border-[#E8E0D5] rounded-xl overflow-hidden">
        {medals.map((m) => {
          const isDorme = m.kind === 'dorme_dorme'
          const dia = dayLabel(m)
          return (
            <li key={m.id} className="flex items-center gap-2 px-3 py-2 text-sm bg-white">
              <span className="text-base leading-none">{isDorme ? '🏅' : '⭐'}</span>
              <span className="font-semibold text-[#1C1B1A]">{studentName(m.student)}</span>
              <span className="text-[11px] text-[#6B6560]">
                {isDorme ? 'dorme dorme' : 'fica fica'} — {monthLabel(m.month)}
                {isDorme && dia ? ` — recebida em ${dia}` : ''}
                {isDorme && !dia ? ' — sem data' : ''}
              </span>
              {isDorme && (
                <button
                  onClick={() => {
                    const day = m.received_at
                      ? String(m.received_at).split(' ')[0].split('T')[0]
                      : ''
                    setEditDay(/^\d{4}-\d{2}-\d{2}$/.test(day) ? day : '')
                    setEditingMedal(m)
                  }}
                  className="ml-auto text-[11px] font-semibold text-[#6B6560] hover:text-[#C1272D] shrink-0"
                  title="Editar o dia em que foi recebida"
                >
                  Editar dia
                </button>
              )}
              <button
                onClick={() => setRemovingMedal(m)}
                className={`${
                  isDorme ? '' : 'ml-auto '
                }text-[#6B6560] hover:text-[#C1272D] shrink-0`}
                title="Remover medalha"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </li>
          )
        })}
      </ul>

      {/* Dialog: editar o dia de recebimento da dorme dorme */}
      <AlertDialog open={!!editingMedal} onOpenChange={(open) => !open && setEditingMedal(null)}>
        <AlertDialogContent className="bg-white border border-[#E8E0D5] rounded-2xl max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-serif text-[#1C1B1A]">
              Editar dia do recebimento
            </AlertDialogTitle>
            <AlertDialogDescription className="text-[#6B6560] text-xs leading-relaxed">
              {editingMedal && (
                <>
                  🏅 <strong className="text-[#1C1B1A]">{studentName(editingMedal.student)}</strong>{' '}
                  — dorme dorme de {monthLabel(editingMedal.month)}. Informe o dia em que a medalha
                  foi recebida.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-1">
            <Label className="text-[11px] font-semibold text-[#1C1B1A]">Dia recebida</Label>
            <Input
              type="date"
              value={editDay}
              onChange={(e) => setEditDay(e.target.value)}
              className="h-9 text-sm bg-white border-[#E8E0D5] focus-visible:ring-[#C1272D]"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-[#E8E0D5] text-[#1C1B1A] text-xs font-semibold">
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault()
                handleSaveDate()
              }}
              disabled={!editDay || isSavingDate}
              className="bg-[#C1272D] hover:bg-[#A01E23] text-white text-xs font-semibold"
            >
              {isSavingDate ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Salvando...
                </>
              ) : (
                'Salvar'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirmação de remoção da medalha */}
      <AlertDialog open={!!removingMedal} onOpenChange={(open) => !open && setRemovingMedal(null)}>
        <AlertDialogContent className="bg-white border border-[#E8E0D5] rounded-2xl max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-serif text-[#1C1B1A]">
              Remover medalha?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-[#6B6560] text-xs leading-relaxed">
              A {removingMedal?.kind === 'dorme_dorme' ? '🏅 dorme dorme' : '⭐ fica fica'} de{' '}
              <strong className="text-[#1C1B1A]">
                {removingMedal ? studentName(removingMedal.student) : ''}
              </strong>{' '}
              será removida do mês {removingMedal ? monthLabel(removingMedal.month) : ''}. Essa ação
              não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-[#E8E0D5] text-[#1C1B1A] text-xs font-semibold">
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault()
                handleRemoveMedal()
              }}
              disabled={isRemoving}
              className="bg-[#C1272D] hover:bg-[#A01E23] text-white text-xs font-semibold"
            >
              {isRemoving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Removendo...
                </>
              ) : (
                'Remover'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
