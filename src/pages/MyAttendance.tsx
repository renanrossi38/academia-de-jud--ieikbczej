import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { HankoStamp } from '@/components/HankoStamp'
import { attendanceService, toLocalDateKey } from '@/services/attendance'
import { studentsService } from '@/services/students'
import { Attendance, AttendanceStatus, Class, Student } from '@/types'
import { classesService } from '@/services/classes'
import { useRealtime } from '@/hooks/use-realtime'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Loader2,
  CalendarCheck,
  TrendingUp,
  Check,
  X,
  FileWarning,
  ShoppingBag,
} from 'lucide-react'

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

const statusIcon: Record<AttendanceStatus, React.ReactNode> = {
  presente: <Check className="w-3.5 h-3.5 text-[#2E7D4F]" />,
  ausente: <X className="w-3.5 h-3.5 text-[#C1272D]" />,
  justificado: <FileWarning className="w-3.5 h-3.5 text-[#6B6560]" />,
}

export default function MyAttendance() {
  const { user, isLoading: authLoading } = useAuth()
  const navigate = useNavigate()

  const [records, setRecords] = useState<Attendance[]>([])
  const [student, setStudent] = useState<Student | null>(null)
  const [myClasses, setMyClasses] = useState<Class[]>([])
  const [isLoading, setIsLoading] = useState(true)

  // Presença é vinculada ao registro de aluno (students), não ao usuário.
  const loadHistory = useCallback(async () => {
    if (!user) return
    setIsLoading(true)
    try {
      let me: Student | null = null
      try {
        me = await studentsService.getByUser(user.id)
      } catch {
        me = null
      }
      setStudent(me)
      const data = me ? await attendanceService.listByStudent(me.id) : ([] as Attendance[])
      setRecords(data)
      setMyClasses(me ? await classesService.listClassesOfStudent(me.id).catch(() => []) : [])
    } catch (err) {
      console.error('Erro ao carregar minha presença:', err)
    } finally {
      setIsLoading(false)
    }
  }, [user])

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/entrar?redirect=/minha-presenca')
      return
    }
    if (user) loadHistory()
  }, [user, authLoading, loadHistory])

  // Tempo real: nova marcação do admin aparece na hora (filtrada pelo student resolvido)
  useRealtime<Attendance>('attendance', (e) => {
    if (!student || e.action === 'delete') return
    const rec = e.record
    if (rec.student !== student.id) return
    setRecords((prev) => {
      const exists = prev.some((r) => r.id === rec.id)
      if (exists) return prev.map((r) => (r.id === rec.id ? rec : r))
      return [rec, ...prev].sort((a, b) => (a.date < b.date ? 1 : -1))
    })
  })

  // Resumo do mês atual
  const monthSummary = useMemo(() => {
    const now = new Date()
    const prefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
    const monthRecords = records.filter((r) => toLocalDateKey(new Date(r.date)).startsWith(prefix))
    const presentes = monthRecords.filter((r) => r.status === 'presente').length
    const justificados = monthRecords.filter((r) => r.status === 'justificado').length
    const ausentes = monthRecords.filter((r) => r.status === 'ausente').length
    const total = monthRecords.length
    const rate = total > 0 ? Math.round(((presentes + justificados) / total) * 100) : 0
    return { presentes, justificados, ausentes, total, rate }
  }, [records])

  if (authLoading || isLoading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center text-[#6B6560]">
        <Loader2 className="w-8 h-8 animate-spin text-[#C1272D] mb-3" />
        <p className="font-serif text-sm">Carregando seu histórico de presença...</p>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 animate-fade-rise">
      {/* Cabeçalho */}
      <div className="mb-8">
        <div className="flex items-center gap-2">
          <HankoStamp size="sm" />
          <span className="text-xs font-bold text-[#C1272D] tracking-widest uppercase font-serif">
            Histórico do Aluno
          </span>
        </div>
        <h1 className="font-serif font-bold text-2xl sm:text-3xl text-[#1C1B1A] mt-1">
          Minha Presença
        </h1>
        <p className="text-xs text-[#6B6560] mt-1">
          Acompanhe sua frequência nos treinos do Dojo Nippon. As marcações são feitas pelo
          professor.
        </p>
        {myClasses.length > 0 && (
          <div className="mt-3 flex items-center gap-2 flex-wrap">
            <span className="text-[11px] font-bold text-[#1C1B1A] uppercase tracking-wider font-serif">
              Turmas:
            </span>
            {myClasses.map((c) => (
              <Badge
                key={c.id}
                className="text-[10px] font-bold border bg-[#F7E4E2] text-[#C1272D] border-[#C1272D]/20"
              >
                {c.name}
              </Badge>
            ))}
          </div>
        )}
      </div>

      {/* Resumo do mês */}
      <div className="bg-white rounded-2xl border border-[#E8E0D5] shadow-xs p-5 mb-6">
        <h2 className="font-serif font-bold text-sm text-[#1C1B1A] uppercase tracking-wider mb-4 flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-[#C1272D]" />
          Resumo do Mês
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-[#FAF6F0] rounded-xl border border-[#E8E0D5] p-3 text-center">
            <span className="block text-[10px] font-bold uppercase tracking-wider text-[#6B6560] font-serif">
              Presenças
            </span>
            <strong className="block text-xl font-bold text-[#2E7D4F] font-mono mt-1">
              {monthSummary.presentes}
            </strong>
          </div>
          <div className="bg-[#FAF6F0] rounded-xl border border-[#E8E0D5] p-3 text-center">
            <span className="block text-[10px] font-bold uppercase tracking-wider text-[#6B6560] font-serif">
              Ausências
            </span>
            <strong className="block text-xl font-bold text-[#C1272D] font-mono mt-1">
              {monthSummary.ausentes}
            </strong>
          </div>
          <div className="bg-[#FAF6F0] rounded-xl border border-[#E8E0D5] p-3 text-center">
            <span className="block text-[10px] font-bold uppercase tracking-wider text-[#6B6560] font-serif">
              Justificadas
            </span>
            <strong className="block text-xl font-bold text-[#6B6560] font-mono mt-1">
              {monthSummary.justificados}
            </strong>
          </div>
          <div className="bg-[#F7E4E2] rounded-xl border border-[#C1272D]/20 p-3 text-center">
            <span className="block text-[10px] font-bold uppercase tracking-wider text-[#C1272D] font-serif">
              Frequência
            </span>
            <strong className="block text-xl font-bold text-[#C1272D] font-mono mt-1">
              {monthSummary.rate}%
            </strong>
          </div>
        </div>
        <p className="text-[11px] text-[#6B6560] mt-3">
          {monthSummary.total === 0
            ? 'Nenhum treino registrado neste mês ainda.'
            : `${monthSummary.total} treino(s) registrado(s) neste mês com marcação.`}
        </p>
      </div>

      {/* Histórico */}
      {records.length === 0 ? (
        <div className="bg-white rounded-2xl border border-[#E8E0D5] p-10 text-center max-w-md mx-auto">
          <HankoStamp size="lg" kanji="柔" className="mx-auto mb-4" />
          <h3 className="font-serif font-bold text-lg text-[#1C1B1A]">
            Nenhuma presença registrada ainda
          </h3>
          <p className="text-xs text-[#6B6560] mt-1 mb-6">
            Quando o professor registrar sua presença nos treinos, o histórico aparece aqui.
          </p>
          <Link to="/">
            <Button className="bg-[#C1272D] hover:bg-[#A01E23] text-white text-xs">
              <ShoppingBag className="w-4 h-4 mr-2" />
              Ver Catálogo
            </Button>
          </Link>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-[#E8E0D5] shadow-xs overflow-hidden">
          <div className="divide-y divide-[#E8E0D5]">
            {records.map((rec) => {
              const d = new Date(rec.date)
              const dateFormatted = d.toLocaleDateString('pt-BR', {
                weekday: 'long',
                day: '2-digit',
                month: 'long',
                year: 'numeric',
              })
              const capitalized = dateFormatted.charAt(0).toUpperCase() + dateFormatted.slice(1)
              return (
                <div
                  key={rec.id}
                  className="p-4 flex items-center justify-between gap-3 hover:bg-[#FAF6F0]/40 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-[#FAF6F0] border border-[#E8E0D5] flex items-center justify-center font-serif text-[#C1272D] font-bold shrink-0">
                      {statusIcon[rec.status]}
                    </div>
                    <div>
                      <span className="text-sm font-semibold text-[#1C1B1A] block capitalize">
                        {capitalized}
                      </span>
                      <span className="text-[11px] text-[#6B6560]">
                        Registrado em{' '}
                        {new Date(rec.created).toLocaleDateString('pt-BR', {
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric',
                        })}
                        {myClasses.length > 0 &&
                          ` • via ${myClasses.map((c) => c.name).join(', ')}`}
                      </span>
                    </div>
                  </div>
                  <Badge className={`text-[10px] font-bold border ${statusBadgeClass[rec.status]}`}>
                    {statusLabel[rec.status]}
                  </Badge>
                </div>
              )
            })}
          </div>
        </div>
      )}

      <div className="mt-6 flex items-center gap-2 text-[11px] text-[#6B6560]">
        <CalendarCheck className="w-3.5 h-3.5 shrink-0" />
        <p>
          Frequência considera presenças e faltas justificadas. Em caso de divergência, fale com o
          professor na recepção do dojo.
        </p>
      </div>
    </div>
  )
}
