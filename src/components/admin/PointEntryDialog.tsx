import { useEffect, useState } from 'react'
import { rankingService } from '@/services/ranking'
import { toLocalDateKey } from '@/services/attendance'
import { PointEntry, Student } from '@/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useToast } from '@/hooks/use-toast'
import { Loader2, Award } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

interface PointEntryDialogProps {
  open: boolean
  student: Student | null
  onOpenChange: (open: boolean) => void
  onSaved: (entry: PointEntry) => void
}

/** Data em formato brasileiro a partir de "YYYY-MM-DD". */
const fmtDate = (v?: string) => {
  if (!v) return ''
  const [y, m, d] = v.split('-')
  if (!y || !m || !d) return ''
  return `${d}/${m}/${y}`
}

/** Diálogo "Adicionar pontuação": lançamento manual de competição/evento. */
const PointEntryDialog: React.FC<PointEntryDialogProps> = ({
  open,
  student,
  onOpenChange,
  onSaved,
}) => {
  const { toast } = useToast()
  const [points, setPoints] = useState('')
  const [description, setDescription] = useState('')
  const [date, setDate] = useState(() => toLocalDateKey(new Date()))
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open) {
      setPoints('')
      setDescription('')
      // Lançamento retroativo: a data começa em hoje e pode voltar no tempo.
      setDate(toLocalDateKey(new Date()))
    }
  }, [open, student])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!student) return
    const pointsNum = Number(points)
    if (!Number.isFinite(pointsNum) || pointsNum <= 0) {
      toast({
        title: 'Pontos inválidos',
        description: 'Informe a quantidade de pontos da competição (maior que zero).',
        variant: 'destructive',
      })
      return
    }
    if (!description.trim()) {
      toast({
        title: 'Descrição obrigatória',
        description: 'Descreva a competição ou o evento que originou os pontos.',
        variant: 'destructive',
      })
      return
    }
    setSaving(true)
    try {
      const entry = await rankingService.createEntry({
        studentId: student.id,
        points: pointsNum,
        description: description.trim(),
        date,
      })
      onSaved(entry)
      onOpenChange(false)
      toast({
        title: 'Pontuação lançada!',
        description: `${pointsNum} ponto(s) para ${student.name} — "${description.trim()}" (${fmtDate(
          date,
        )}).`,
      })
    } catch (err: any) {
      console.error('Erro ao lançar pontuação:', err)
      toast({
        title: 'Erro ao lançar pontuação',
        description: err?.message || 'Falha ao gravar no servidor. Tente novamente.',
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-white border border-[#E8E0D5] rounded-2xl max-w-md">
        <DialogHeader>
          <DialogTitle className="font-serif text-[#1C1B1A]">Adicionar pontuação</DialogTitle>
          <DialogDescription className="text-[#6B6560] text-xs">
            Lançamento manual de competição/evento para{' '}
            <strong className="text-[#1C1B1A]">{student?.name || '—'}</strong>. Os pontos somam ao
            total do ranking.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="entry-date" className="text-xs font-bold text-[#1C1B1A]">
              Data da competição / evento *
            </Label>
            <Input
              id="entry-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="h-9 text-sm bg-white border-[#E8E0D5]"
            />
            <p className="text-[10px] text-[#6B6560]">
              Padrão: hoje. Pode ser uma data passada (ex.: competição do mês anterior).
            </p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="entry-points" className="text-xs font-bold text-[#1C1B1A]">
              Pontos *
            </Label>
            <Input
              id="entry-points"
              value={points}
              onChange={(e) => setPoints(e.target.value)}
              inputMode="numeric"
              placeholder="Ex.: 10"
              className="h-9 text-sm bg-white border-[#E8E0D5]"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="entry-description" className="text-xs font-bold text-[#1C1B1A]">
              Competição / evento *
            </Label>
            <Input
              id="entry-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Ex.: Campeonato Regional — 2º lugar"
              className="h-9 text-sm bg-white border-[#E8E0D5]"
              maxLength={200}
            />
          </div>
          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="border-[#E8E0D5] text-[#1C1B1A] text-xs font-semibold"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={saving}
              className="bg-[#C1272D] hover:bg-[#A01E23] text-white text-xs font-semibold"
            >
              {saving ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" />
                  Salvando...
                </>
              ) : (
                <>
                  <Award className="w-3.5 h-3.5 mr-2" />
                  Lançar pontos
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export default PointEntryDialog
