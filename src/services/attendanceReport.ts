import pb from '@/lib/pocketbase/client'
import { toLocalDateKey } from '@/services/attendance'
import { classesService } from '@/services/classes'
import { ClassStudent, Student } from '@/types'

/**
 * Relatório de presença por período (Painel → Relatório de presença).
 *
 * Os dados vêm da MESMA coleção usada na chamada diária (attendance, uma
 * marcação por aluno/dia, com status presente/ausente/justificado), filtrada
 * pelo intervalo escolhido — nada é estimado: só conta o que foi gravado.
 *
 * Presenças por turma: a marcação é por aluno/dia e não guarda a turma de
 * origem (mesma decisão visível em annotateWithClasses, classes.ts), então o
 * recorte por turma é feito pelas matrículas (class_students) de cada aluno.
 */

/** Dia (YYYY-MM-DD) extraído da data gravada, sem depender do fuso. */
const dayKeyOf = (dateStr: string): string => (dateStr || '').slice(0, 10)

/** Intervalo (início/fim) de um período no formato aceito pelo PocketBase. */
function periodRange(startKey: string, endKey: string): { start: string; end: string } {
  return {
    start: `${startKey} 00:00:00.000Z`,
    end: `${endKey} 23:59:59.999Z`,
  }
}

export interface AttendanceReportRow {
  student: Student
  /** Dias com qualquer marcação gravada (presente, ausente ou justificado). */
  diasComRegistro: number
  presente: number
  ausente: number
  justificado: number
  /** % de presença = presente ÷ dias com registro. */
  taxaPresenca: number
  /** Turmas do aluno no momento (contexto; a marcação não guarda a turma). */
  turmas: string
}

export interface AttendanceReportData {
  rows: AttendanceReportRow[]
  /** Alunos ativos do recorte que NÃO têm nenhuma marcação no período. */
  semRegistro: { student: Student; turmas: string }[]
  /** Dias distintos do período em que houve pelo menos uma marcação. */
  diasComAula: number
  /** Média de marcações gravadas por dia com aula. */
  mediaPresencaPorAula: number
  /** Dia (YYYY-MM-DD) com mais marcações, para contexto do resumo. */
  diaMaisMovimentado: string | null
}

/** Primeiro dia do mês corrente (YYYY-MM-DD). */
export function firstDayOfCurrentMonth(): string {
  const now = new Date()
  return toLocalDateKey(new Date(now.getFullYear(), now.getMonth(), 1))
}

/** Hoje (YYYY-MM-DD). */
export function todayKeyForReport(): string {
  return toLocalDateKey(new Date())
}

/** Formata YYYY-MM-DD como DD/MM/AAAA (exibição). */
export function formatDateKeyBR(key: string): string {
  const [y, m, d] = key.split('-')
  if (!y || !m || !d) return key
  return `${d}/${m}/${y}`
}

/** "novembro de 2026" a partir de YYYY-MM (para o título do PDF). */
export function monthLabelOfKey(key: string): string {
  const [y, m] = key.split('-').map(Number)
  if (!y || !m) return key
  const nome = new Date(y, m - 1, 1).toLocaleDateString('pt-BR', { month: 'long' })
  return `${nome} de ${y}`
}

/**
 * Monta o relatório: busca presenças do período, matrículas (contexto de
 * turma) e alunos ativos, e calcula presenças/ausências/frequência por aluno.
 */
export async function fetchAttendanceReport(opts: {
  startKey: string
  endKey: string
  /** Quando informado, só entram os alunos matriculados nesta turma. */
  classId?: string | null
}): Promise<AttendanceReportData> {
  const { startKey, endKey, classId } = opts
  const { start, end } = periodRange(startKey, endKey)

  const [records, links, students] = await Promise.all([
    pb.collection('attendance').getFullList({
      filter: `date >= "${start}" && date <= "${end}"`,
      sort: 'date',
    }),
    pb.collection('class_students').getFullList<ClassStudent>({}),
    pb.collection('students').getFullList<Student>({ filter: 'active = true', sort: 'name' }),
  ])

  // Matrículas por aluno (contexto de turma exibido em cada linha).
  const classNames = new Map<string, string>()
  try {
    const allClasses = await classesService.listClasses()
    allClasses.forEach((c) => classNames.set(c.id, c.name))
  } catch {
    // Sem nomes de turma, mostra as matrículas mesmo assim.
  }

  const classesByStudent = new Map<string, string[]>()
  links.forEach((l) => {
    if (!l.student) return
    const list = classesByStudent.get(l.student) ?? []
    const name = classNames.get(l.class)
    if (name) list.push(name)
    classesByStudent.set(l.student, list)
  })

  const turmasOf = (studentId: string): string => {
    const list = (classesByStudent.get(studentId) ?? []).sort((a, b) => a.localeCompare(b, 'pt-BR'))
    return list.length > 0 ? list.join(', ') : '—'
  }

  // Recorte por turma: só quem está matriculado nela.
  let allowedStudents: Set<string> | null = null
  if (classId) {
    allowedStudents = new Set(links.filter((l) => l.class === classId).map((l) => l.student))
  }
  const studentsInScope = allowedStudents
    ? students.filter((s) => allowedStudents!.has(s.id))
    : students

  // Marcações dentro do escopo (aluno + período).
  const recordsByStudent = new Map<
    string,
    { presente: number; ausente: number; justificado: number }
  >()
  const daysWithRecords = new Set<string>()
  const markingsPerDay = new Map<string, number>()

  interface Marking {
    student: string
    date: string
    status: string
  }
  records.forEach((raw) => {
    const r = raw as unknown as Marking
    if (allowedStudents && !allowedStudents.has(r.student)) return
    const day = dayKeyOf(r.date)
    if (day < startKey || day > endKey) return

    const agg = recordsByStudent.get(r.student) ?? { presente: 0, ausente: 0, justificado: 0 }
    if (r.status === 'presente') agg.presente += 1
    else if (r.status === 'ausente') agg.ausente += 1
    else agg.justificado += 1
    recordsByStudent.set(r.student, agg)

    if (day) {
      daysWithRecords.add(day)
      markingsPerDay.set(day, (markingsPerDay.get(day) ?? 0) + 1)
    }
  })

  const rows: AttendanceReportRow[] = []
  const semRegistro: { student: Student; turmas: string }[] = []

  studentsInScope.forEach((student) => {
    const agg = recordsByStudent.get(student.id)
    if (!agg) {
      semRegistro.push({ student, turmas: turmasOf(student.id) })
      return
    }
    const diasComRegistro = agg.presente + agg.ausente + agg.justificado
    const taxaPresenca = diasComRegistro > 0 ? (agg.presente / diasComRegistro) * 100 : 0
    rows.push({
      student,
      diasComRegistro,
      presente: agg.presente,
      ausente: agg.ausente,
      justificado: agg.justificado,
      taxaPresenca,
      turmas: turmasOf(student.id),
    })
  })

  rows.sort((a, b) => {
    const byRate = b.taxaPresenca - a.taxaPresenca
    if (Math.abs(byRate) > 0.001) return byRate
    const byName = (a.student.name || '').localeCompare(b.student.name || '', 'pt-BR')
    if (byName !== 0) return byName
    return b.diasComRegistro - a.diasComRegistro
  })
  semRegistro.sort((a, b) => (a.student.name || '').localeCompare(b.student.name || '', 'pt-BR'))

  const diasComAula = daysWithRecords.size
  const totalMarkings = [...markingsPerDay.values()].reduce((acc, n) => acc + n, 0)
  const mediaPresencaPorAula = diasComAula > 0 ? totalMarkings / diasComAula : 0

  let diaMaisMovimentado: string | null = null
  let maxMarkings = 0
  markingsPerDay.forEach((count, day) => {
    if (count > maxMarkings) {
      maxMarkings = count
      diaMaisMovimentado = day
    }
  })

  return { rows, semRegistro, diasComAula, mediaPresencaPorAula, diaMaisMovimentado }
}
