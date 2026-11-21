import pb from '@/lib/pocketbase/client'
import { toLocalDateKey } from '@/services/attendance'
import { Attendance, ClassStudent, PointEntry, Student } from '@/types'

/** Linha do ranking: um aluno matriculado em pelo menos uma turma. */
export interface RankingRow {
  student: Student
  /** Turmas em que o aluno está matriculado (nomes). */
  classes: string[]
  /** Presenças (status "presente") — cada uma vale 1 ponto. */
  presences: number
  /** Soma dos lançamentos manuais (competições/eventos). */
  manualPoints: number
  /** Total do ranking = presenças + lançamentos manuais. */
  totalPoints: number
  /** Lançamentos manuais do aluno (para listar e remover). */
  entries: PointEntry[]
}

export interface CreatePointEntryInput {
  studentId: string
  points: number
  description: string
  /** Data do lançamento (YYYY-MM-DD, permite retroativo). Padrão: hoje. */
  date?: string
}

/** Computa as linhas do ranking a partir de matrículas, presenças e lançamentos. */
function buildRows(
  links: ClassStudent[],
  attendance: Attendance[],
  entries: PointEntry[],
): RankingRow[] {
  const byStudent = new Map<string, RankingRow>()

  // Alunos matriculados em turmas (cadastro precisa existir — aluno excluído sai).
  links.forEach((link) => {
    const student = link.expand?.student
    if (!student || student.active === false) return
    const classLabel = link.expand?.class?.name
    if (!classLabel) return

    let row = byStudent.get(student.id)
    if (!row) {
      row = {
        student,
        classes: [],
        presences: 0,
        manualPoints: 0,
        totalPoints: 0,
        entries: [],
      }
      byStudent.set(student.id, row)
    }
    if (!row.classes.includes(classLabel)) row.classes.push(classLabel)
  })

  // Presença "presente" = 1 ponto (ausente/justificado valem 0).
  attendance.forEach((a) => {
    if (a.status !== 'presente') return
    const row = byStudent.get(a.student)
    if (row) row.presences += 1
  })

  // Lançamentos manuais de competição/evento.
  entries.forEach((e) => {
    const row = byStudent.get(e.student)
    if (!row) return
    row.entries.push(e)
    row.manualPoints += e.points || 0
  })

  const rows = Array.from(byStudent.values())
  rows.forEach((r) => {
    r.totalPoints = r.presences + r.manualPoints
    // Mais recente primeiro, pela data do lançamento (retroativos ordenam pela data escolhida).
    r.entries.sort((a, b) => (b.date || b.created || '').localeCompare(a.date || a.created || ''))
  })

  // Maior pontuação primeiro; empate: ordem alfabética.
  rows.sort((a, b) => {
    if (b.totalPoints !== a.totalPoints) return b.totalPoints - a.totalPoints
    return (a.student.name || '').localeCompare(b.student.name || '', 'pt-BR')
  })
  return rows
}

export const rankingService = {
  /**
   * Ranking completo: todos os alunos matriculados em turmas, com presenças
   * (1 ponto cada) + lançamentos manuais. Um pedido por collection.
   */
  async getRanking(): Promise<RankingRow[]> {
    const [links, attendance, entries] = await Promise.all([
      pb.collection('class_students').getFullList<ClassStudent>({
        expand: 'student,class',
      }),
      pb.collection('attendance').getFullList<Attendance>({ filter: `status = "presente"` }),
      pb.collection('points_entries').getFullList<PointEntry>({ sort: '-created' }),
    ])
    return buildRows(links, attendance, entries)
  },

  /** Lançamentos manuais (competições/eventos), mais recentes primeiro. */
  async listEntries(): Promise<PointEntry[]> {
    return pb.collection('points_entries').getFullList<PointEntry>({ sort: '-created' })
  },

  /** Lançamentos de um aluno específico (ficha individual), mais recentes primeiro. */
  async listEntriesByStudent(studentId: string): Promise<PointEntry[]> {
    return pb.collection('points_entries').getFullList<PointEntry>({
      filter: `student = "${studentId}"`,
      sort: '-date',
    })
  },

  /** Cria um lançamento manual de pontuação para um aluno. */
  async createEntry(input: CreatePointEntryInput): Promise<PointEntry> {
    const points = Math.max(0, Math.round(input.points))
    const dateKey = input.date || toLocalDateKey(new Date())
    return pb.collection('points_entries').create<PointEntry>({
      student: input.studentId,
      points,
      description: input.description.trim(),
      date: `${dateKey} 12:00:00.000Z`,
    })
  },

  /** Remove um lançamento manual (some do total do ranking). */
  async deleteEntry(id: string): Promise<void> {
    await pb.collection('points_entries').delete(id)
  },
}
