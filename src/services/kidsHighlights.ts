import pb from '@/lib/pocketbase/client'

/**
 * Destaques públicos da home ("Alunos destaque do mês").
 *
 * O destaque vigente segue a regra já usada no painel: quem ganhou fica_fica
 * no mês M fica em destaque durante todo o mês M+1 (nextMonthKey, mesma fórmula
 * de AdminClassDetail/ClassRosterList). Como class_medals é admin-only, a home
 * — visitada sem login — não lê a collection direto: consome a rota pública
 * GET /backend/v1/medals-highlights (hook medals_highlights.js), que cruza
 * class_medals × students × classes no servidor e só devolve turmas INFANTIS
 * com destaque vigente.
 */
export interface KidsHighlight {
  /** Id do aluno destaque (class_medals.student). */
  studentId: string
  /** Nome do aluno (students.name). */
  studentName: string
  /** Foto do aluno (users.avatar via students.user), quando houver. */
  avatarUrl: string | null
  /** Nome da turma infantil (classes.name). */
  className: string
  /** Mês concedido ("YYYY-MM" — o fica fica desta medalha). */
  medalMonth: string
  /** Mês em que o aluno ESTÁ em destaque (M+1 em Brasília). */
  highlightMonth: string
}

/** Mês "YYYY-MM" seguinte: destaque concedido em M vale durante M+1. */
export function nextMonthKey(k: string): string {
  const [y, m] = (k || '').split('-').map(Number)
  if (!y || !m) return ''
  return m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, '0')}`
}

/** Mês vigente "YYYY-MM" em horário de Brasília (UTC-3 o ano todo). */
export function brasiliaMonthKeyLocal(): string {
  const now = new Date(Date.now() - 3 * 60 * 60 * 1000)
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`
}

/**
 * Busca os destaques vigentes na rota pública do hook. A lista já vem
 * filtrada pelo servidor (mês M+1, só turma infantil, uma por turma); o
 * reforço da regra M+1 no client descarta resposta defasada numa virada de
 * mês. Qualquer falha devolve [] — a seção some e a home nunca quebra.
 */
export async function fetchKidsHighlights(): Promise<KidsHighlight[]> {
  const data = await pb.send<{ highlights: KidsHighlight[]; currentMonth: string }>(
    '/backend/v1/medals-highlights',
    {},
  )
  const mesVigente = brasiliaMonthKeyLocal()
  return (data?.highlights || []).filter(
    (h) => !!h?.studentId && nextMonthKey(h.medalMonth) === mesVigente,
  )
}
