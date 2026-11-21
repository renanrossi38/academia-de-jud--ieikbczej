import pb from '@/lib/pocketbase/client'
import { MonthlyFee, PaymentMethod } from '@/types'

/** Mês de referência (YYYY-MM) de hoje, no fuso local. */
export function currentMonthKey(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

/** Rótulo do mês de referência: "2026-05" → "mai/2026". */
export function monthLabel(referenceMonth: string): string {
  const [y, m] = (referenceMonth || '').split('-').map(Number)
  if (!y || !m) return referenceMonth || '—'
  const d = new Date(y, m - 1, 1)
  if (Number.isNaN(d.getTime())) return referenceMonth
  return d.toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' }).replace('de ', '')
}

/** Comparação lexicográfica de "YYYY-MM" — serve para saber se um mês venceu. */
export function monthKeyOf(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

/** Situação do aluno em relação às mensalidades. */
export type FeeStanding = 'sem_lancamentos' | 'em_dia' | 'inadimplente'

/**
 * Situação de um aluno a partir das mensalidades dele:
 *  - sem lançamentos → "sem_lancamentos" (neutro, sem alarme);
 *  - há pendente com mês de referência <= mês atual → "inadimplente";
 *  - caso contrário → "em_dia".
 */
export function feeStanding(fees: MonthlyFee[], now: Date = new Date()): FeeStanding {
  if (fees.length === 0) return 'sem_lancamentos'
  const thisMonth = monthKeyOf(now)
  const hasOverdue = fees.some((f) => f.status === 'pendente' && f.reference_month <= thisMonth)
  return hasOverdue ? 'inadimplente' : 'em_dia'
}

/** Data de vencimento padrão: dia 15 do mês de referência ("YYYY-MM"). */
export function defaultDueDate(referenceMonth: string): string {
  const [y, m] = (referenceMonth || '').split('-').map(Number)
  if (!y || !m) return ''
  return `${y}-${String(m).padStart(2, '0')}-15`
}

/** Rótulo do método de pagamento. */
export const paymentMethodLabel: Record<PaymentMethod, string> = {
  pix: 'Pix',
  dinheiro: 'Dinheiro',
  cartao: 'Cartão',
}

/** A mensalidade venceu (vencimento no passado) e continua pendente? */
export function isOverdue(fee: MonthlyFee, now: Date = new Date()): boolean {
  if (fee.status !== 'pendente' || !fee.due_date) return false
  const due = new Date(fee.due_date)
  if (Number.isNaN(due.getTime())) return false
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  return due.getTime() < today.getTime()
}

/** Total pago no ano (YYYY) — soma das mensalidades com status "pago". */
export function paidTotalInYear(fees: MonthlyFee[], year: number): number {
  return fees
    .filter((f) => f.status === 'pago' && (f.reference_month || '').startsWith(String(year)))
    .reduce((sum, f) => sum + (f.amount || 0), 0)
}

export const monthlyFeesService = {
  /** Todas as mensalidades de um aluno (mês mais recente primeiro). */
  async listByStudent(studentId: string): Promise<MonthlyFee[]> {
    return pb.collection('monthly_fees').getFullList<MonthlyFee>({
      filter: `student = "${studentId}"`,
      sort: '-reference_month',
    })
  },

  /** Todas as mensalidades (painel de alunos: situação por aluno). */
  async listAll(): Promise<MonthlyFee[]> {
    return pb.collection('monthly_fees').getFullList<MonthlyFee>({
      sort: '-reference_month',
    })
  },

  /**
   * Lança uma mensalidade. Bloqueia mês duplicado para o mesmo aluno
   * (índice único no banco + verificação amigável aqui).
   */
  async create(input: {
    studentId: string
    referenceMonth: string
    amount: number
    notes?: string
    paymentMethod?: PaymentMethod
    dueDate?: string
  }): Promise<MonthlyFee> {
    const month = (input.referenceMonth || '').trim()
    if (!/^\d{4}-\d{2}$/.test(month)) {
      throw new Error('Mês de referência inválido — use o formato AAAA-MM.')
    }
    const existing = await pb.collection('monthly_fees').getList(1, 1, {
      filter: `student = "${input.studentId}" && reference_month = "${month}"`,
    })
    if (existing.items.length > 0) {
      throw new Error(`Já existe uma mensalidade lançada para ${monthLabel(month)}.`)
    }
    // Vencimento: data escolhida ou, por padrão, dia 15 do mês de referência.
    const dueDate = input.dueDate?.trim() || defaultDueDate(month)
    return pb.collection('monthly_fees').create<MonthlyFee>({
      student: input.studentId,
      reference_month: month,
      amount: Math.max(0, Number(input.amount) || 0),
      status: 'pendente',
      notes: input.notes?.trim() || '',
      payment_method: input.paymentMethod || '',
      // PocketBase date: "YYYY-MM-DD HH:mm:ss.SSSZ"
      due_date: dueDate ? `${dueDate} 12:00:00.000Z` : '',
    })
  },

  /** Marca como paga: status "pago" + paid_at = agora. */
  async markPaid(id: string): Promise<MonthlyFee> {
    return pb.collection('monthly_fees').update<MonthlyFee>(id, {
      status: 'pago',
      paid_at: new Date().toISOString().replace('T', ' ').slice(0, 19) + '.000Z',
    })
  },

  /** Exclui o lançamento (não pode ser desfeito). */
  async remove(id: string): Promise<void> {
    await pb.collection('monthly_fees').delete(id)
  },
}
