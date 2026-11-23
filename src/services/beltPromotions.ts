import pb from '@/lib/pocketbase/client'
import { Belt, BeltPromotion } from '@/types'

/**
 * Histórico de promoções de faixa (collection `belt_promotions`, migration
 * 0023). Cada registro é uma graduação conquistada: a nova faixa, a data do
 * exame/promoção (permitido retroativo) e uma observação opcional.
 *
 * A faixa ATUAL do aluno é derivada daqui — a promoção mais recente por
 * promoted_at (desempate por created) — enquanto o campo manual `belt` do
 * cadastro continua como fallback quando o aluno ainda não tem histórico.
 */

export interface CreateBeltPromotionInput {
  studentId: string
  belt: Belt
  /** Data da promoção (YYYY-MM-DD). Padrão: hoje em Brasília. */
  date?: string
  notes?: string
}

/** Ordem oficial das faixas do judô (da menor para a maior). */
export const BELT_ORDER: Belt[] = [
  'branca',
  'cinza',
  'azul',
  'amarela',
  'laranja',
  'verde',
  'roxa',
  'marrom',
  'preta',
]

/**
 * Próxima faixa da sequência a partir da atual — a sugestão do diálogo de
 * promoção. Na faixa preta (última) devolve null (sem sugestão).
 */
export function nextBelt(current?: string | null): Belt | null {
  const idx = BELT_ORDER.indexOf((current || '') as Belt)
  if (idx < 0 || idx >= BELT_ORDER.length - 1) return null
  return BELT_ORDER[idx + 1]
}

/** Data de hoje (YYYY-MM-DD) em horário de Brasília (UTC-3 o ano todo). */
export function todayKeyBrasilia(): string {
  const d = new Date(Date.now() - 3 * 60 * 60 * 1000)
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(
    d.getUTCDate(),
  ).padStart(2, '0')}`
}

/** Faixa atual a partir do histórico: a promoção mais recente (null sem histórico). */
export function latestBeltFrom(promotions: BeltPromotion[]): BeltPromotion | null {
  const sorted = [...promotions].sort((a, b) => {
    const byDate = (a.promoted_at || '').localeCompare(b.promoted_at || '')
    if (byDate !== 0) return byDate
    return (a.created || '').localeCompare(b.created || '')
  })
  return sorted[sorted.length - 1] ?? null
}

/** Faixa em vigor derivada do histórico (alias legível de latestBeltFrom). */
export function currentBeltFrom(promotions: BeltPromotion[]): Belt | undefined {
  return latestBeltFrom(promotions)?.belt
}

/**
 * Última faixa promovida de TODOS os alunos de uma vez — usado para derivar a
 * faixa exibida na lista de alunos sem N consultas.
 */
export async function latestBeltMap(): Promise<Map<string, Belt>> {
  const all = await pb.collection('belt_promotions').getFullList<BeltPromotion>({
    sort: 'promoted_at,created',
  })
  const map = new Map<string, Belt>()
  for (const p of all) {
    if (p.student && p.belt) map.set(p.student, p.belt)
  }
  return map
}

/** Faixa em vigor (última promoção) ou fallback no campo manual do cadastro. */
export function effectiveBelt(
  promotions: BeltPromotion[],
  fallbackBelt?: string | null,
): Belt | '' {
  const latest = latestBeltFrom(promotions)
  return (latest?.belt ?? fallbackBelt ?? '') as Belt | ''
}

/** "nesta faixa há X" — meses quando < 2 anos, anos + meses depois disso. */
export function timeInBeltLabel(promotedAt: string, now: Date = new Date()): string {
  const start = new Date(promotedAt)
  if (Number.isNaN(start.getTime())) return ''
  const nowB = new Date(now.getTime() - 3 * 60 * 60 * 1000)
  // Diferença em meses inteiros entre as duas datas (calendário, em Brasília).
  let months =
    (nowB.getUTCFullYear() - start.getUTCFullYear()) * 12 +
    (nowB.getUTCMonth() - start.getUTCMonth())
  // Se o dia do mês ainda não chegou, conta o mês incompleto como não completo.
  if (nowB.getUTCDate() < start.getUTCDate()) months -= 1
  if (months < 1) return 'nesta faixa há menos de 1 mês'
  if (months < 24) return `nesta faixa há ${months} ${months === 1 ? 'mês' : 'meses'}`
  const years = Math.floor(months / 12)
  const rest = months % 12
  const anos = `${years} ${years === 1 ? 'ano' : 'anos'}`
  return rest === 0
    ? `nesta faixa há ${anos}`
    : `nesta faixa há ${anos} e ${rest} ${rest === 1 ? 'mês' : 'meses'}`
}

export const beltPromotionsService = {
  /** Histórico do aluno, da promoção mais recente para a mais antiga. */
  async listByStudent(studentId: string): Promise<BeltPromotion[]> {
    return pb.collection('belt_promotions').getFullList<BeltPromotion>({
      filter: `student = "${studentId}"`,
      sort: '-promoted_at,-created',
    })
  },

  /** Registra uma promoção de faixa (nova faixa, data e observação opcional). */
  async create(input: CreateBeltPromotionInput): Promise<BeltPromotion> {
    const dateKey = input.date || todayKeyBrasilia()
    return pb.collection('belt_promotions').create<BeltPromotion>({
      student: input.studentId,
      belt: input.belt,
      // Meio-dia UTC: a data não desloca um dia para trás no fuso de Brasília.
      promoted_at: `${dateKey} 12:00:00.000Z`,
      notes: input.notes?.trim() || '',
    })
  },

  /** Remove um lançamento errado (o restante do histórico fica intacto). */
  async remove(id: string): Promise<void> {
    await pb.collection('belt_promotions').delete(id)
  },
}
