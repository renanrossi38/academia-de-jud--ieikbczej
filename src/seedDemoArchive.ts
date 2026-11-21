import pb from '@/lib/pocketbase/client'
import { RankingRow } from '@/services/ranking'

/**
 * Semente de demonstração: arquiva o ranking do ano ANTERIOR ao corrente usando
 * os dados reais (presenças + lançamentos daquele ano), sem inventar alunos.
 * Executado via console do app logado como admin:
 *   import('./src/seedDemoArchive')
 */
export async function seedDemoArchive(): Promise<void> {
  const year = new Date().getFullYear() - 1
  const rows: RankingRow[] = []
  const yearStart = `${year}-01-01 00:00:00.000Z`
  const yearEnd = `${year}-12-31 23:59:59.999Z`

  const [links, attendance, entries] = await Promise.all([
    pb.collection('class_students').getFullList({ expand: 'student,class' }),
    pb.collection('attendance').getFullList({
      filter: `status = "presente" && date >= "${yearStart}" && date <= "${yearEnd}"`,
    }),
    pb
      .collection('points_entries')
      .getFullList({ filter: `date >= "${yearStart}" && date <= "${yearEnd}"` }),
  ])

  const byStudent = new Map<string, RankingRow>()
  links.forEach((l: any) => {
    const s = l.expand?.student
    if (!s || s.active === false) return
    if (!byStudent.has(s.id)) {
      byStudent.set(s.id, {
        student: s,
        classes: [],
        presences: 0,
        manualPoints: 0,
        totalPoints: 0,
        entries: [],
      })
    }
  })
  attendance.forEach((a: any) => {
    const row = byStudent.get(a.student)
    if (row) row.presences += 1
  })
  entries.forEach((e: any) => {
    const row = byStudent.get(e.student)
    if (row) row.manualPoints += e.points || 0
  })
  rows.push(...byStudent.values())
  rows.forEach((r) => (r.totalPoints = r.presences + r.manualPoints))
  rows.sort((a, b) => b.totalPoints - a.totalPoints)

  const existing = await pb.collection('ranking_archives').getFullList({ filter: `year = ${year}` })
  await Promise.all(existing.map((r: any) => pb.collection('ranking_archives').delete(r.id)))
  await Promise.all(
    rows.map((row, i) =>
      pb.collection('ranking_archives').create({
        year,
        rank: i + 1,
        student_id: row.student.id,
        student_name: row.student.name || '—',
        belt: row.student.belt || '',
        total_points: row.totalPoints,
        presences: row.presences,
        manual_points: row.manualPoints,
      }),
    ),
  )
  console.log(`Seed OK: ${rows.length} aluno(s) arquivado(s) para o ano ${year}.`)
}
