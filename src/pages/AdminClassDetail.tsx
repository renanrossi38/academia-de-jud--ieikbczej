import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { HankoStamp } from '@/components/HankoStamp'
import { ClassRosterList, STATUS_ORDER } from '@/components/admin/ClassRosterList'
import { monthLabel as monthLabelFromKey } from '@/services/monthlyFees'
import { classesService, classLevelLabel, classLevelBadgeClass, todayKey } from '@/services/classes'
import { attendanceCalendarService, AttendanceDaysMap } from '@/services/attendanceCalendar'
import { studentsService } from '@/services/students'
import { Attendance, AttendanceStatus, Class, ClassStudent, Student } from '@/types'
import { useRealtime } from '@/hooks/use-realtime'
import { classMedalsService, MedalKind, MEDAL_KIND_LABEL } from '@/services/classMedals'
import { ClassMedal } from '@/types'
import { brasiliaMonthKey } from '@/services/monthlyFees'
import { Trash2, Award } from 'lucide-react'
import { AttendanceCalendar } from '@/components/admin/AttendanceCalendar'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
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
import { Label } from '@/components/ui/label'
import { useToast } from '@/hooks/use-toast'
import { Loader2, ArrowLeft, UserPlus, Save, Search, CalendarDays, Users, Ban } from 'lucide-react'

export default function AdminClassDetail() {
  const { classId } = useParams<{ classId: string }>()
  const { user, isAdmin, isLoading: authLoading } = useAuth()
  const navigate = useNavigate()
  const { toast } = useToast()

  const [turma, setTurma] = useState<Class | null>(null)
  const [links, setLinks] = useState<ClassStudent[]>([])
  const [dateKey, setDateKey] = useState(todayKey())
  const [markings, setMarkings] = useState<Record<string, AttendanceStatus>>({})
  // Mês visível no calendário (viewYear, viewMonth0 com Janeiro = 0)
  const [calMonth, setCalMonth] = useState(() => {
    const k = todayKey()
    return { year: Number(k.slice(0, 4)), month0: Number(k.slice(5, 7)) - 1 }
  })
  // Dias que têm alguma marcação de presença, no mês visível do calendário
  const [calendarDays, setCalendarDays] = useState<AttendanceDaysMap>({})
  const [isLoadingCalendar, setIsLoadingCalendar] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isSavingRoll, setIsSavingRoll] = useState(false)

  // matrícula
  const [addOpen, setAddOpen] = useState(false)
  const [candidates, setCandidates] = useState<Student[]>([])
  const [candidateSearch, setCandidateSearch] = useState('')
  const [isLoadingCandidates, setIsLoadingCandidates] = useState(false)
  const [addingStudentId, setAddingStudentId] = useState<string | null>(null)
  const [removingLink, setRemovingLink] = useState<ClassStudent | null>(null)
  const [isRemoving, setIsRemoving] = useState(false)

  // Medalhas da turma infantil (dorme dorme / fica fica)
  const [medals, setMedals] = useState<ClassMedal[]>([])
  const [medalStudentId, setMedalStudentId] = useState('')
  const [medalKind, setMedalKind] = useState<MedalKind>('dorme_dorme')
  const [medalMonth, setMedalMonth] = useState(() => brasiliaMonthKey())
  const [isSavingMedal, setIsSavingMedal] = useState(false)
  const [medalsLoading, setMedalsLoading] = useState(false)

  const isFull = !!turma?.vagas && links.length >= turma.vagas
  const isKidsClass = turma?.is_kids === true

  const loadTurma = useCallback(async () => {
    if (!classId) return
    try {
      setTurma(await classesService.getClass(classId))
    } catch {
      toast({
        title: 'Turma não encontrada',
        description: 'Ela pode ter sido excluída por outro administrador.',
        variant: 'destructive',
      })
      navigate('/painel/turmas', { replace: true })
    }
  }, [classId, navigate, toast])

  const loadRoll = useCallback(async () => {
    if (!classId) return
    setIsLoading(true)
    try {
      const { students, markings: m } = await classesService.listDayRoll(classId, dateKey)
      setLinks(
        students.map(
          (s) => ({ id: s.id, student: s.id, expand: { student: s } }) as unknown as ClassStudent,
        ),
      )
      setMarkings(m)
    } catch (err) {
      console.error('Erro ao carregar chamada:', err)
      toast({
        title: 'Erro ao carregar chamada',
        description: 'Não foi possível buscar os alunos e as marcações do dia.',
        variant: 'destructive',
      })
    } finally {
      setIsLoading(false)
    }
  }, [classId, dateKey, toast])

  useEffect(() => {
    if (authLoading) return
    if (!user) {
      navigate('/entrar?redirect=/painel/turmas')
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
    loadTurma()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, isAdmin, authLoading, classId])

  useEffect(() => {
    if (user && isAdmin) loadRoll()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, isAdmin, dateKey])

  // Realtime: matrícula criada/removida por outro admin atualiza a chamada na hora
  useRealtime<ClassStudent>('class_students', (e) => {
    if (!classId || e.record.class !== classId) return
    if (e.action === 'delete') {
      setLinks((prev) => prev.filter((l) => l.id !== e.record.id))
      return
    }
    loadRoll()
  })
  // Realtime: marcação de presença alterada em outra sessão
  useRealtime<Attendance>('attendance', (e) => {
    if (!classId) return
    const studentId = e.record.student
    if (!studentId) return
    if (e.action === 'delete') {
      setMarkings((prev) => {
        const next = { ...prev }
        delete next[studentId]
        return next
      })
      return
    }
    if (e.record.status) {
      setMarkings((prev) => ({ ...prev, [studentId]: e.record.status }))
    }
  })

  const filteredLinks = useMemo(() => {
    const q = candidateSearch.trim().toLowerCase()
    if (!q) return links
    return links.filter((l) => (l.expand?.student?.name || '').toLowerCase().includes(q))
  }, [links, candidateSearch])

  const daySummary = useMemo(() => {
    const counts = { presente: 0, ausente: 0, justificado: 0 }
    links.forEach((l) => {
      const st = markings[l.student]
      if (st) counts[st]++
    })
    const unmarked = links.length - counts.presente - counts.ausente - counts.justificado
    return { ...counts, unmarked, total: links.length }
  }, [links, markings])

  const openAddDialog = async () => {
    setAddOpen(true)
    setIsLoadingCandidates(true)
    try {
      const [all, members] = await Promise.all([
        studentsService.listActive(),
        classesService.listClassStudents(classId!),
      ])
      const memberIds = new Set(members.map((m) => m.student))
      setCandidates(all.filter((s) => !memberIds.has(s.id)))
    } catch (err) {
      console.error('Erro ao carregar alunos:', err)
      toast({
        title: 'Erro ao carregar alunos',
        description: 'Não foi possível buscar a lista de alunos ativos.',
        variant: 'destructive',
      })
    } finally {
      setIsLoadingCandidates(false)
    }
  }

  const handleAdd = async (studentId: string) => {
    setAddingStudentId(studentId)
    try {
      await classesService.addStudent(classId!, studentId)
      const added = candidates.find((s) => s.id === studentId)
      if (added) {
        setLinks((prev) =>
          [
            ...prev,
            {
              id: `tmp-${studentId}`,
              student: added.id,
              expand: { student: added },
            } as unknown as ClassStudent,
          ].sort((a, b) =>
            (a.expand?.student?.name || '').localeCompare(b.expand?.student?.name || '', 'pt-BR'),
          ),
        )
        setCandidates((prev) => prev.filter((s) => s.id !== studentId))
      }
      toast({ title: 'Aluno adicionado à turma' })
    } catch (err: any) {
      console.error('Erro ao matricular aluno:', err)
      toast({
        title: 'Erro ao adicionar aluno',
        description: err?.message || 'Tente novamente.',
        variant: 'destructive',
      })
    } finally {
      setAddingStudentId(null)
    }
  }

  const handleRemove = async () => {
    if (!removingLink) return
    setIsRemoving(true)
    try {
      await classesService.removeStudent(classId!, removingLink.student)
      setLinks((prev) => prev.filter((l) => l.student !== removingLink.student))
      toast({
        title: 'Aluno removido da turma',
        description: 'O histórico de presença dele permanece em "Minha Presença".',
      })
      setRemovingLink(null)
    } catch (err: any) {
      console.error('Erro ao remover aluno:', err)
      toast({
        title: 'Erro ao remover aluno',
        description: err?.message || 'Tente novamente.',
        variant: 'destructive',
      })
    } finally {
      setIsRemoving(false)
    }
  }

  // Busca os dias com marcações do mês visível no calendário.
  const loadCalendarDays = useCallback(async () => {
    if (!classId) return
    setIsLoadingCalendar(true)
    try {
      setCalendarDays(
        await attendanceCalendarService.listDaysWithMarkings(calMonth.year, calMonth.month0),
      )
    } catch (err) {
      console.error('Erro ao carregar dias com chamada:', err)
      setCalendarDays({})
    } finally {
      setIsLoadingCalendar(false)
    }
  }, [classId, calMonth])

  useEffect(() => {
    loadCalendarDays()
  }, [loadCalendarDays])

  // Recarrega os destaques do calendário quando uma marcação é gravada/alterada
  useRealtime<Attendance>('attendance', () => {
    loadCalendarDays()
  })

  // Medalhas do mês + histórico de "fica fica" da turma infantil
  const loadMedals = useCallback(async () => {
    if (!classId) return
    setMedalsLoading(true)
    try {
      setMedals(await classMedalsService.listByClass(classId))
    } catch (err) {
      console.error('Erro ao carregar medalhas:', err)
      setMedals([])
    } finally {
      setMedalsLoading(false)
    }
  }, [classId])

  useEffect(() => {
    if (user && isAdmin && isKidsClass) void loadMedals()
  }, [user, isAdmin, isKidsClass, loadMedals])

  useRealtime<ClassMedal>('class_medals', (e) => {
    if (!classId || e.record.class !== classId) return
    if (e.action === 'delete') {
      setMedals((prev) => prev.filter((m) => m.id !== e.record.id))
      return
    }
    loadMedals()
  })

  const handleAddMedal = async () => {
    if (!classId || !medalStudentId) return
    setIsSavingMedal(true)
    try {
      await classMedalsService.add({
        classId,
        studentId: medalStudentId,
        month: medalMonth,
        kind: medalKind,
      })
      toast({ title: 'Medalha atribuída!' })
      setMedalStudentId('')
      loadMedals()
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

  const handleRemoveMedal = async (id: string) => {
    try {
      await classMedalsService.remove(id)
      setMedals((prev) => prev.filter((m) => m.id !== id))
    } catch (err: any) {
      console.error('Erro ao remover medalha:', err)
      toast({
        title: 'Erro ao remover medalha',
        description: err?.message || 'Tente novamente.',
        variant: 'destructive',
      })
    }
  }

  const handleMonthChange = useCallback((year: number, month0: number) => {
    setCalMonth((prev) => (prev.year === year && prev.month0 === month0 ? prev : { year, month0 }))
  }, [])

  const handleCalendarPick = useCallback((key: string) => {
    setDateKey(key)
  }, [])

  const handleSaveRoll = async () => {
    setIsSavingRoll(true)
    try {
      const entries = links
        .map((l) => ({ studentId: l.student, status: markings[l.student] }))
        .filter((e): e is { studentId: string; status: AttendanceStatus } => !!e.status)
      const { saved, skipped } = await classesService.saveDayRoll(dateKey, entries)
      toast({
        title: 'Chamada salva',
        description: `${saved} marcação(ões) gravada(s) para ${new Date(
          dateKey + 'T12:00:00',
        ).toLocaleDateString('pt-BR')}${skipped > 0 ? ` · ${skipped} falha(s)` : ''}.`,
      })
    } catch (err: any) {
      console.error('Erro ao salvar chamada:', err)
      toast({
        title: 'Erro ao salvar chamada',
        description: err?.message || 'Tente novamente.',
        variant: 'destructive',
      })
    } finally {
      setIsSavingRoll(false)
    }
  }

  const cycleStatus = (studentId: string) => {
    setMarkings((prev) => {
      const current = prev[studentId]
      const idx = current ? STATUS_ORDER.indexOf(current) : -1
      const next = STATUS_ORDER[(idx + 1) % STATUS_ORDER.length]
      return { ...prev, [studentId]: next }
    })
  }

  if (authLoading || isLoading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center text-[#6B6560]">
        <Loader2 className="w-8 h-8 animate-spin text-[#C1272D] mb-3" />
        <p className="font-serif text-sm">Carregando turma...</p>
      </div>
    )
  }

  if (!turma) return null

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 animate-fade-rise">
      {/* Cabeçalho */}
      <Link
        to="/painel/turmas"
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#6B6560] hover:text-[#C1272D] mb-4"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        Voltar para turmas
      </Link>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="font-serif font-bold text-2xl sm:text-3xl text-[#1C1B1A]">
              {turma.name}
            </h1>
            <Badge className={`text-[10px] font-bold border ${classLevelBadgeClass(turma.level)}`}>
              {classLevelLabel(turma.level)}
            </Badge>
            <Badge
              className={`text-[10px] font-bold border ${
                turma.active !== false
                  ? 'bg-[#E8F5E9] text-[#2E7D4F] border-[#2E7D4F]/20'
                  : 'bg-[#F7E4E2] text-[#C1272D] border-[#C1272D]/20'
              }`}
            >
              {turma.active !== false ? 'Ativa' : 'Inativa'}
            </Badge>
          </div>
          <p className="text-xs text-[#6B6560] mt-1 flex items-center gap-1.5">
            <Users className="w-3.5 h-3.5" />
            {links.length}/{turma.vagas ?? '—'} vagas ocupadas — faça a chamada do dia abaixo.
          </p>
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          <Button
            onClick={openAddDialog}
            disabled={!!turma.vagas && links.length >= turma.vagas}
            title={
              !!turma.vagas && links.length >= turma.vagas
                ? 'Turma lotada — sem vagas disponíveis'
                : undefined
            }
            className="h-10 bg-[#C1272D] hover:bg-[#A01E23] text-white text-sm font-semibold"
          >
            {isFull ? <Ban className="w-4 h-4 mr-2" /> : <UserPlus className="w-4 h-4 mr-2" />}
            {isFull ? 'Turma lotada' : 'Adicionar aluno'}
          </Button>
          {isFull && (
            <span className="text-[11px] font-bold text-[#C1272D]">
              Turma lotada — sem vagas disponíveis
            </span>
          )}
        </div>
      </div>

      {/* Calendário do histórico + seleção de data + resumo */}
      <div className="grid gap-4 lg:grid-cols-[auto_1fr] mb-4 items-start">
        <div className="bg-white rounded-2xl border border-[#E8E0D5] shadow-xs p-3 sm:p-4 w-full max-w-xs mx-auto lg:mx-0">
          <div className="flex items-center gap-2 mb-2">
            <CalendarDays className="w-4 h-4 text-[#C1272D]" />
            <span className="text-xs font-bold text-[#1C1B1A] font-serif">
              Histórico de presenças
            </span>
          </div>
          <AttendanceCalendar
            value={dateKey}
            onChange={handleCalendarPick}
            daysWithMarkings={calendarDays}
            onMonthChange={handleMonthChange}
          />
        </div>

        <div className="bg-white rounded-2xl border border-[#E8E0D5] shadow-xs p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-6">
          <div className="flex items-center gap-2">
            <Label htmlFor="roll-date" className="text-xs font-bold text-[#1C1B1A] shrink-0">
              Data da chamada
            </Label>
            <input
              id="roll-date"
              type="date"
              value={dateKey}
              onChange={(e) => e.target.value && setDateKey(e.target.value)}
              className="h-9 text-sm rounded-md border border-[#E8E0D5] bg-white px-2.5 text-[#1C1B1A] focus:outline-hidden focus:ring-1 focus:ring-[#C1272D]"
            />
          </div>
          <div className="flex items-center gap-2 flex-wrap sm:ml-auto">
            <Badge className="bg-[#E8F5E9] text-[#2E7D4F] border-[#2E7D4F]/20 text-xs font-semibold">
              Presentes: {daySummary.presente}
            </Badge>
            <Badge className="bg-[#F7E4E2] text-[#C1272D] border-[#C1272D]/20 text-xs font-semibold">
              Ausentes: {daySummary.ausente}
            </Badge>
            <Badge className="bg-[#FAF6F0] text-[#6B6560] border-[#E8E0D5] text-xs font-semibold">
              Justificados: {daySummary.justificado}
            </Badge>
            {isLoadingCalendar && (
              <Loader2
                className="w-3.5 h-3.5 animate-spin text-[#C1272D]/60"
                aria-label="Atualizando calendário"
              />
            )}
          </div>
        </div>
      </div>

      {/* Medalhas — só em turma infantil */}
      {isKidsClass && (
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
            <b>fica fica</b>: aluno destaque do mês — destaque permanente.
          </p>
          <div className="flex flex-col sm:flex-row gap-2 sm:items-end mb-3">
            <div className="space-y-1 flex-1 min-w-[140px]">
              <Label className="text-[11px] font-semibold text-[#1C1B1A]">Aluno</Label>
              <Select value={medalStudentId} onValueChange={setMedalStudentId}>
                <SelectTrigger className="h-9 text-sm bg-white border-[#E8E0D5] focus:ring-[#C1272D]">
                  <SelectValue placeholder="Selecione o aluno" />
                </SelectTrigger>
                <SelectContent>
                  {links.map((l) => (
                    <SelectItem key={l.id} value={l.student}>
                      {l.expand?.student?.name || 'Aluno'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1 sm:w-44">
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
            <div className="space-y-1 sm:w-40">
              <Label className="text-[11px] font-semibold text-[#1C1B1A]">Mês</Label>
              <Input
                type="month"
                value={medalMonth}
                onChange={(e) => e.target.value && setMedalMonth(e.target.value)}
                className="h-9 text-sm bg-white border-[#E8E0D5] focus-visible:ring-[#C1272D]"
              />
            </div>
            <Button
              onClick={handleAddMedal}
              disabled={!medalStudentId || isSavingMedal}
              className="h-9 bg-[#C1272D] hover:bg-[#A01E23] text-white text-xs font-semibold"
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
          {medals.length === 0 ? (
            <p className="text-xs text-[#6B6560]">Nenhuma medalha atribuída nesta turma ainda.</p>
          ) : (
            <ul className="divide-y divide-[#E8E0D5] border border-[#E8E0D5] rounded-xl overflow-hidden">
              {medals.map((m) => {
                const studentName =
                  links.find((l) => l.student === m.student)?.expand?.student?.name || 'Aluno'
                return (
                  <li key={m.id} className="flex items-center gap-2 px-3 py-2 text-sm bg-white">
                    <span className="text-base leading-none">
                      {m.kind === 'dorme_dorme' ? '🏅' : '⭐'}
                    </span>
                    <span className="font-semibold text-[#1C1B1A]">{studentName}</span>
                    <span className="text-[11px] text-[#6B6560]">
                      {m.kind === 'dorme_dorme' ? 'dorme dorme' : 'fica fica'} —{' '}
                      {monthLabelFromKey(m.month)}
                    </span>
                    <button
                      onClick={() => handleRemoveMedal(m.id)}
                      className="ml-auto text-[#6B6560] hover:text-[#C1272D]"
                      title="Remover medalha"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      )}

      {/* Chamada */}
      {links.length === 0 ? (
        <div className="bg-white rounded-2xl border border-[#E8E0D5] p-10 text-center">
          <HankoStamp size="lg" className="mx-auto mb-4" />
          <h3 className="font-serif font-bold text-lg text-[#1C1B1A]">Turma sem alunos</h3>
          <p className="text-xs text-[#6B6560] mt-1 mb-6">
            Adicione alunos ativos para começar a fazer a chamada de presença.
          </p>
          <Button
            onClick={openAddDialog}
            className="bg-[#C1272D] hover:bg-[#A01E23] text-white text-xs font-semibold"
          >
            <UserPlus className="w-4 h-4 mr-2" />
            Adicionar aluno
          </Button>
        </div>
      ) : (
        <>
          <div className="bg-white rounded-2xl border border-[#E8E0D5] shadow-xs overflow-hidden mb-4">
            <div className="px-4 py-3 border-b border-[#E8E0D5] bg-[#FAF6F0]/60">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6B6560]" />
                <Input
                  value={candidateSearch}
                  onChange={(e) => setCandidateSearch(e.target.value)}
                  placeholder="Buscar aluno na turma..."
                  className="pl-9 h-9 text-sm bg-white border-[#E8E0D5] focus-visible:ring-[#C1272D]"
                />
              </div>
            </div>
            <ClassRosterList
              links={filteredLinks}
              markings={markings}
              onMark={(studentId, status) =>
                setMarkings((prev) => ({ ...prev, [studentId]: status }))
              }
              medals={(() => {
                const currentMonth = brasiliaMonthKey()
                return {
                  dormeDormeMesAtual: new Set(
                    medals
                      .filter((m) => m.kind === 'dorme_dorme' && m.month === currentMonth)
                      .map((m) => m.student),
                  ),
                  everFicaFica: new Set(
                    medals.filter((m) => m.kind === 'fica_fica').map((m) => m.student),
                  ),
                }
              })()}
              onRemove={(link) => setRemovingLink(link)}
            />
          </div>

          <div className="flex justify-end">
            <Button
              onClick={handleSaveRoll}
              disabled={isSavingRoll || daySummary.total === 0}
              className="bg-[#1C1B1A] hover:bg-black text-white text-xs font-semibold"
            >
              {isSavingRoll ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Salvando...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  Salvar chamada do dia
                </>
              )}
            </Button>
          </div>
        </>
      )}

      {/* Dialog: adicionar aluno */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="bg-white border border-[#E8E0D5] rounded-2xl max-w-lg max-h-[85dvh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="font-serif text-[#1C1B1A]">Adicionar aluno</DialogTitle>
            <DialogDescription className="text-[#6B6560] text-xs">
              Selecione entre os alunos ativos ainda não matriculados em "{turma.name}".
              {!!turma.vagas && ` Vagas ocupadas: ${links.length}/${turma.vagas}.`}
            </DialogDescription>
          </DialogHeader>
          <div className="relative mb-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6B6560]" />
            <Input
              value={candidateSearch}
              onChange={(e) => setCandidateSearch(e.target.value)}
              placeholder="Buscar aluno ativo..."
              className="pl-9 h-9 text-sm bg-white border-[#E8E0D5] focus-visible:ring-[#C1272D]"
            />
          </div>
          <div className="overflow-y-auto divide-y divide-[#E8E0D5] border border-[#E8E0D5] rounded-xl min-h-[100px]">
            {isLoadingCandidates ? (
              <div className="p-6 flex justify-center">
                <Loader2 className="w-5 h-5 animate-spin text-[#C1272D]" />
              </div>
            ) : candidates.length === 0 ? (
              <div className="p-6 text-center text-xs text-[#6B6560]">
                Nenhum aluno ativo disponível para matricular.
              </div>
            ) : isFull ? (
              <div className="p-6 text-center">
                <Ban className="w-6 h-6 text-[#C1272D] mx-auto mb-2" />
                <p className="text-xs font-bold text-[#C1272D]">
                  Turma lotada — sem vagas disponíveis
                </p>
                <p className="text-[11px] text-[#6B6560] mt-1">
                  Aumente o número de vagas na edição da turma para matricular mais alunos.
                </p>
              </div>
            ) : (
              candidates
                .filter((s) =>
                  (s.name || '').toLowerCase().includes(candidateSearch.trim().toLowerCase()),
                )
                .map((s) => (
                  <div key={s.id} className="p-3 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <span className="text-sm font-semibold text-[#1C1B1A] block truncate">
                        {s.name}
                      </span>
                      <span className="text-[11px] text-[#6B6560] capitalize">
                        {s.belt ? `Faixa ${s.belt}` : 'Sem faixa'}
                      </span>
                    </div>
                    <Button
                      size="sm"
                      disabled={addingStudentId === s.id || isFull}
                      onClick={() => handleAdd(s.id)}
                      className="bg-[#C1272D] hover:bg-[#A01E23] text-white text-xs font-semibold shrink-0"
                    >
                      {addingStudentId === s.id ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <>
                          <UserPlus className="w-3.5 h-3.5 mr-1" />
                          Adicionar
                        </>
                      )}
                    </Button>
                  </div>
                ))
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Confirmação de remoção */}
      <AlertDialog open={!!removingLink} onOpenChange={(open) => !open && setRemovingLink(null)}>
        <AlertDialogContent className="bg-white border border-[#E8E0D5] rounded-2xl max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-serif text-[#1C1B1A]">
              Remover da turma?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-[#6B6560] text-xs leading-relaxed">
              <strong className="text-[#1C1B1A]">{removingLink?.expand?.student?.name}</strong>{' '}
              deixará de aparecer na chamada desta turma. O histórico de presença dele permanece
              intacto em "Minha Presença".
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-[#E8E0D5] text-[#1C1B1A] text-xs font-semibold">
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault()
                handleRemove()
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
                'Remover'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
