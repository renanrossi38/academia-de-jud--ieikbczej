import pb from '@/lib/pocketbase/client'
import { toLocalDateKey } from '@/services/attendance'
import { Attendance, ClassStudent, PointEntry, RankingArchiveRow, Student } from '@/types'

/** Ano corrente (fuso local). */
export function currentYear(): number {
  return new Date().getFullYear()
}

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

/** Extrai o ano (local) de uma data em formato PocketBase (UTC). */
function yearOf(value?: string): number {
  if (!value) return 0
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? 0 : d.getFullYear()
}

export const rankingService = {
  /**
   * Ranking do ano corrente: presenças e lançamentos de anos anteriores NÃO
   * contam — só o que aconteceu no ano corrente pontua aqui. Consulte o
   * histórico completo em `listEntriesByStudent` e os anos encerrados em
   * `listArchives`.
   */
  async getRanking(year: number = currentYear()): Promise<RankingRow[]> {
    const yearStart = `${year}-01-01 00:00:00.000Z`
    const yearEnd = `${year}-12-31 23:59:59.999Z`
    const [links, attendance, entries] = await Promise.all([
      pb.collection('class_students').getFullList<ClassStudent>({
        expand: 'student,class',
      }),
      pb.collection('attendance').getFullList<Attendance>({
        filter: `status = "presente" && date >= "${yearStart}" && date <= "${yearEnd}"`,
      }),
      pb.collection('points_entries').getFullList<PointEntry>({
        filter: `date >= "${yearStart}" && date <= "${yearEnd}" && year = ${year}`,
        sort: '-created',
      }),
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
    const year = Number(dateKey.slice(0, 4))
    return pb.collection('points_entries').create<PointEntry>({
      student: input.studentId,
      points,
      description: input.description.trim(),
      date: `${dateKey} 12:00:00.000Z`,
      year,
    })
  },

  /** Remove um lançamento manual (some do total do ranking). */
  async deleteEntry(id: string): Promise<void> {
    await pb.collection('points_entries').delete(id)
  },

  /** Anos que já têm ranking arquivado (mais recente primeiro). */
  async listArchiveYears(): Promise<number[]> {
    const rows = await pb.collection('ranking_archives').getFullList<RankingArchiveRow>({
      sort: '-year',
    })
    return Array.from(new Set(rows.map((r) => r.year))).sort((a, b) => b - a)
  },

  /** Snapshot do ranking final de um ano arquivado, do 1º ao último lugar. */
  async getArchive(year: number): Promise<RankingArchiveRow[]> {
    return pb.collection('ranking_archives').getFullList<RankingArchiveRow>({
      filter: `year = ${year}`,
      sort: 'rank',
    })
  },

  /**
   * Arquiva o ranking de um ano (snapshot do pódio final + todos os alunos
   * classificados) e zera o ranking corrente. Chame SEMPRE com o ano corrente
   * — é o ano que está sendo encerrado. Idempotente por ano: rearquivar o
   * mesmo ano substitui o snapshot anterior (nunca soma).
   */
  async archiveYear(year: number): Promise<number> {
    const rows = await rankingService.getRanking(year)
    const existing = await pb
      .collection('ranking_archives')
      .getFullList<RankingArchiveRow>({ filter: `year = ${year}` })
    await Promise.all(existing.map((r) => pb.collection('ranking_archives').delete(r.id)))

    let archived = 0
    // Pequenos lotes para não estourar com muitos alunos.
    for (let i = 0; i < rows.length; i += 40) {
      const batch = rows.slice(i, i + 40)
      await Promise.all(
        batch.map((row, idx) =>
          pb.collection('ranking_archives').create<RankingArchiveRow>({
            year,
            rank: i + idx + 1,
            student_id: row.student.id,
            student_name: row.student.name || '—',
            belt: row.student.belt || '',
            total_points: row.totalPoints,
            presences: row.presences,
            manual_points: row.manualPoints,
          }),
        ),
      )
      archived += batch.length
    }
    return archived
  },
}
