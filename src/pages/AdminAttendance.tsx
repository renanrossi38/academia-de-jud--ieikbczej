import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { HankoStamp } from '@/components/HankoStamp'
import { beltLabel, beltBadgeClass } from '@/components/admin/StudentDialogs'
import { attendanceService, toLocalDateKey, AttendanceDayInput } from '@/services/attendance'
import { studentsService } from '@/services/students'
import { Attendance, AttendanceStatus, User } from '@/types'
import { useRealtime } from '@/hooks/use-realtime'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/hooks/use-toast'
import {
  Loader2,
  CalendarCheck,
  Save,
  Check,
  X,
  FileWarning,
  RotateCcw,
  ShieldAlert,
  Users,
} from 'lucide-react'

const STATUS_OPTIONS: { value: AttendanceStatus; label: string; classes: string }[] = [
  {
    value: 'presente',
    label: 'Presente',
    classes: 'bg-[#E8F5E9] text-[#2E7D4F] border-[#2E7D4F]/20',
  },
  {
    value: 'ausente',
    label: 'Ausente',
    classes: 'bg-[#F7E4E2] text-[#C1272D] border-[#C1272D]/20',
  },
  {
    value: 'justificado',
    label: 'Justificado',
    classes: 'bg-[#FAF6F0] text-[#6B6560] border-[#E8E0D5]',
  },
]

const statusLabel: Record<AttendanceStatus, string> = {
  presente: 'Presente',
  ausente: 'Ausente',
  justificado: 'Justificado',
}

const statusBadgeClass: Record<AttendanceStatus, string> = {
  presente: 'bg-[#E8F5E9] text-[#2E7D4F] border-[#2E7D4F]/20',
  ausente: 'bg-[#F7E4E2] text-[#C1272D] border-[#C1272D]/20',
  justificado: 'bg-[#FAF6F0] text-[#6B6560] border-[#E8E0D5]',
}

/** Conta presenças nos últimos 30 dias por aluno (a partir dos registros carregados). */
function last30PresentCount(attendances: Attendance[], userId: string): number {
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - 30)
  return attendances.filter(
    (a) => a.user === userId && a.status === 'presente' && new Date(a.date) >= cutoff,
  ).length
}

export default function AdminAttendance() {
  const { user, isAdmin, isLoading: authLoading } = useAuth()
  const navigate = useNavigate()
  const { toast } = useToast()

  const [students, setStudents] = useState<User[]>([])
  const [dateKey, setDateKey] = useState<string>(() => toLocalDateKey(new Date()))
  const [markings, setMarkings] = useState<Record<string, AttendanceStatus>>({})
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set())
  const [history, setHistory] = useState<Attendance[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)

  // Alunos ativos (a lista de marcação ignora inativos, como nos alunos do painel)
  const activeStudents = useMemo(() => students.filter((s) => s.active !== false), [students])

  const loadData = useCallback(
    async (key: string) => {
      setIsLoading(true)
      try {
        const [allStudents, dayRecords, last30] = await Promise.all([
          studentsService.listStudents(),
          attendanceService.listByDate(key),
          attendanceService.listRecent(30).catch(() => [] as Attendance[]),
        ])

        setStudents(allStudents)
        setHistory(last30)

        const nextMarkings: Record<string, AttendanceStatus> = {}
        const nextSaved = new Set<string>()
        dayRecords.forEach((r) => {
          nextMarkings[r.user] = r.status
          nextSaved.add(r.user)
        })
        setMarkings(nextMarkings)
        setSavedIds(nextSaved)
      } catch (err) {
        console.error('Erro ao carregar presença:', err)
        toast({
          title: 'Erro ao carregar presença',
          description: 'Não foi possível buscar os dados no servidor.',
          variant: 'destructive',
        })
      } finally {
        setIsLoading(false)
      }
    },
    [toast],
  )

  useEffect(() => {
    if (authLoading) return
    if (!user) {
      navigate('/entrar?redirect=/painel/presenca')
      return
    }
    if (!isAdmin) {
      toast({
        title: 'Acesso Restrito',
        description: 'Esta área é exclusiva para administradores da academia.',
        variant: 'destructive',
      })
      navigate('/')
      return
    }
    loadData(dateKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, isAdmin, authLoading, dateKey])

  // Tempo real: presenças alteradas por outro admin aparecem na hora
  useRealtime<Attendance>('attendance', (e) => {
    if (e.action === 'update' || e.action === 'create') {
      const rec = e.record
      const recKey = toLocalDateKey(new Date(rec.date))
      if (recKey !== dateKey) return
      setMarkings((prev) => ({ ...prev, [rec.user]: rec.status }))
      setSavedIds((prev) => new Set(prev).add(rec.user))
    }
  })

  const handleSetStatus = (userId: string, status: AttendanceStatus | null) => {
    setMarkings((prev) => {
      const next = { ...prev }
      if (status === null) delete next[userId]
      else next[userId] = status
      return next
    })
  }

  const handleSaveAll = async () => {
    const entries: AttendanceDayInput[] = Object.entries(markings).map(([userId, status]) => ({
      userId,
      status,
    }))
    if (entries.length === 0) {
      toast({
        title: 'Nenhuma marcação',
        description: 'Marque ao menos um aluno antes de salvar.',
        variant: 'destructive',
      })
      return
    }
    setIsSaving(true)
    try {
      const { saved, skipped } = await attendanceService.saveBatch(dateKey, entries)
      setSavedIds(new Set(Object.keys(markings)))
      toast({
        title: 'Presenças salvas!',
        description:
          skipped > 0
            ? `${saved} marcação(ões) gravada(s), ${skipped} com erro.`
            : `${saved} marcação(ões) gravada(s) para ${dateKey.split('-').reverse().join('/')}.`,
      })
    } catch (err: any) {
      console.error('Erro ao salvar presenças:', err)
      toast({
        title: 'Erro ao salvar',
        description: err?.message || 'Falha ao gravar as marcações no servidor.',
        variant: 'destructive',
      })
    } finally {
      setIsSaving(false)
    }
  }

  const presentCount = Object.values(markings).filter((s) => s === 'presente').length
  const absentCount = Object.values(markings).filter((s) => s === 'ausente').length
  const justifiedCount = Object.values(markings).filter((s) => s === 'justificado').length

  if (authLoading || isLoading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center text-[#6B6560]">
        <Loader2 className="w-8 h-8 animate-spin text-[#C1272D] mb-3" />
        <p className="font-serif text-sm">Carregando presença do dia...</p>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 animate-fade-rise">
      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <div className="flex items-center gap-2">
            <HankoStamp size="sm" />
            <span className="text-xs font-bold text-[#C1272D] tracking-widest uppercase font-serif">
              Administração do Dojo
            </span>
          </div>
          <h1 className="font-serif font-bold text-2xl sm:text-3xl text-[#1C1B1A] mt-1">
            Controle de Presença
          </h1>
          <p className="text-xs text-[#6B6560] mt-1">
            Marque a presença dos alunos ativos em cada dia de treino e acompanhe a frequência.
          </p>
        </div>
      </div>

      {/* Controles: data + resumo do dia */}
      <div className="bg-white rounded-2xl border border-[#E8E0D5] shadow-xs p-4 sm:p-5 mb-6 flex flex-col sm:flex-row sm:items-end gap-4 justify-between">
        <div className="flex-1 max-w-xs">
          <label className="block text-xs font-bold text-[#1C1B1A] uppercase tracking-wider mb-1 font-serif">
            Data do treino
          </label>
          <Input
            type="date"
            value={dateKey}
            onChange={(e) => e.target.value && setDateKey(e.target.value)}
            className="h-10 text-sm bg-white border-[#E8E0D5] focus-visible:ring-[#C1272D]"
          />
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Badge className="bg-[#E8F5E9] text-[#2E7D4F] border-[#2E7D4F]/20 text-xs font-semibold px-3 py-1">
            Presentes: {presentCount}
          </Badge>
          <Badge className="bg-[#F7E4E2] text-[#C1272D] border-[#C1272D]/20 text-xs font-semibold px-3 py-1">
            Ausentes: {absentCount}
          </Badge>
          <Badge className="bg-[#FAF6F0] text-[#6B6560] border-[#E8E0D5] text-xs font-semibold px-3 py-1">
            Justificados: {justifiedCount}
          </Badge>
          <Badge className="bg-white text-[#1C1B1A] border-[#E8E0D5] text-xs font-semibold px-3 py-1">
            Ativos: {activeStudents.length}
          </Badge>
        </div>
      </div>

      {/* Ações */}
      <div className="flex items-center gap-3 mb-6 flex-wrap">
        <Button
          onClick={handleSaveAll}
          disabled={isSaving || activeStudents.length === 0}
          className="h-10 bg-[#C1272D] hover:bg-[#A01E23] text-white text-sm font-semibold"
        >
          {isSaving ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Salvando...
            </>
          ) : (
            <>
              <Save className="w-4 h-4 mr-2" />
              Salvar Presenças
            </>
          )}
        </Button>
        <Button
          variant="outline"
          onClick={() => loadData(dateKey)}
          disabled={isSaving}
          className="h-10 border-[#E8E0D5] text-sm font-semibold text-[#1C1B1A] hover:bg-[#FAF6F0]"
        >
          <RotateCcw className="w-4 h-4 mr-2" />
          Recarregar
        </Button>
        <p className="text-[11px] text-[#6B6560]">
          As marcações são gravadas em lote — uma por aluno por dia.
        </p>
      </div>

      {/* Lista de alunos ativos */}
      {activeStudents.length === 0 ? (
        <div className="bg-white rounded-2xl border border-[#E8E0D5] p-12 text-center max-w-md mx-auto my-6">
          <HankoStamp size="lg" className="mx-auto mb-4" />
          <h3 className="font-serif font-bold text-lg text-[#1C1B1A]">Nenhum aluno ativo</h3>
          <p className="text-xs text-[#6B6560] mt-1">
            Cadastre e ative alunos na Gestão de Alunos para registrar presença.
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-[#E8E0D5] shadow-xs overflow-hidden">
          {/* Tabela (desktop) */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-[#E8E0D5] bg-[#FAF6F0]/60 text-[#6B6560] font-serif uppercase tracking-wider text-[11px]">
                  <th className="py-3 px-4">Aluno</th>
                  <th className="py-3 px-4">Faixa</th>
                  <th className="py-3 px-4 text-center">Presença do Dia</th>
                  <th className="py-3 px-4 text-center">Presenças (30 dias)</th>
                  <th className="py-3 px-4 text-center">Status Salvo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E8E0D5]">
                {activeStudents.map((student) => {
                  const current = markings[student.id]
                  const isSaved = savedIds.has(student.id)
                  const last30 = last30PresentCount(history, student.id)
                  return (
                    <tr key={student.id} className="hover:bg-[#FAF6F0]/50 transition-colors">
                      <td className="py-3.5 px-4">
                        <strong className="text-[#1C1B1A] block">{student.name || '—'}</strong>
                        <span className="text-[11px] text-[#6B6560]">{student.email}</span>
                      </td>
                      <td className="py-3.5 px-4">
                        <Badge
                          className={`text-[10px] font-bold border ${beltBadgeClass(student.belt)}`}
                        >
                          {beltLabel(student.belt)}
                        </Badge>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="flex items-center justify-center gap-1.5">
                          {STATUS_OPTIONS.map((opt) => (
                            <button
                              key={opt.value}
                              type="button"
                              onClick={() => handleSetStatus(student.id, opt.value)}
                              className={`px-2.5 py-1 rounded-md border text-[11px] font-bold transition-colors ${
                                current === opt.value
                                  ? opt.classes
                                  : 'bg-white text-[#6B6560] border-[#E8E0D5] hover:border-[#C1272D]/40 hover:text-[#1C1B1A]'
                              }`}
                            >
                              {opt.label}
                            </button>
                          ))}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-center font-mono font-semibold text-[#1C1B1A]">
                        {last30}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        {isSaved && current ? (
                          <Badge
                            className={`text-[10px] font-bold border ${statusBadgeClass[current]}`}
                          >
                            {statusLabel[current]}
                          </Badge>
                        ) : (
                          <span className="text-[10px] text-[#6B6560] font-serif uppercase tracking-wider">
                            Não salvo
                          </span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Cartões (mobile) */}
          <div className="md:hidden divide-y divide-[#E8E0D5]">
            {activeStudents.map((student) => {
              const current = markings[student.id]
              const isSaved = savedIds.has(student.id)
              const last30 = last30PresentCount(history, student.id)
              return (
                <div key={student.id} className="p-4 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <h4 className="font-semibold text-sm text-[#1C1B1A]">
                        {student.name || '—'}
                      </h4>
                      <span className="text-[11px] text-[#6B6560]">{student.email}</span>
                    </div>
                    <Badge
                      className={`text-[10px] font-bold border ${beltBadgeClass(student.belt)}`}
                    >
                      {beltLabel(student.belt)}
                    </Badge>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {STATUS_OPTIONS.map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => handleSetStatus(student.id, opt.value)}
                        className={`px-2.5 py-1 rounded-md border text-[11px] font-bold transition-colors ${
                          current === opt.value
                            ? opt.classes
                            : 'bg-white text-[#6B6560] border-[#E8E0D5]'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-[#6B6560]">
                    <span>
                      <strong className="text-[#1C1B1A] font-mono">{last30}</strong> presenças em 30
                      dias
                    </span>
                    {isSaved && current ? (
                      <Badge
                        className={`text-[10px] font-bold border ${statusBadgeClass[current]}`}
                      >
                        Salvo: {statusLabel[current]}
                      </Badge>
                    ) : (
                      <span>Não salvo</span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Legenda */}
      <div className="mt-6 flex items-center gap-4 text-[11px] text-[#6B6560] flex-wrap">
        <span className="inline-flex items-center gap-1">
          <Check className="w-3 h-3 text-[#2E7D4F]" /> Presente
        </span>
        <span className="inline-flex items-center gap-1">
          <X className="w-3 h-3 text-[#C1272D]" /> Ausente
        </span>
        <span className="inline-flex items-center gap-1">
          <FileWarning className="w-3 h-3 text-[#6B6560]" /> Falta justificada
        </span>
      </div>

      {/* Aviso de proteção */}
      <div className="mt-4 flex items-start gap-2 text-[11px] text-[#6B6560]">
        <ShieldAlert className="w-3.5 h-3.5 shrink-0 mt-0.5" />
        <p>
          Apenas administradores podem marcar ou alterar presenças. Alunos acompanham o próprio
          histórico em "Minha Presença" e não podem editá-lo.
        </p>
      </div>
    </div>
  )
}
