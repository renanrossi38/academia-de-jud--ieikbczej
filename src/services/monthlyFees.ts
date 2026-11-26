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

/** Mês de referência de hoje em Brasília (UTC-3 o ano todo, sem horário de verão). */
export function brasiliaMonthKey(): string {
  const d = new Date(Date.now() - 3 * 60 * 60 * 1000)
  return monthKeyOf(d)
}

/** Dia de hoje em Brasília ("YYYY-MM-DD"), para comparar com a data de vencimento. */
export function brasiliaDayKey(): string {
  const d = new Date(Date.now() - 3 * 60 * 60 * 1000)
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(
    d.getUTCDate(),
  ).padStart(2, '0')}`
}

/** Situação do aluno em relação às mensalidades. */
export type FeeStanding = 'sem_lancamentos' | 'em_dia' | 'inadimplente'

/** Passou do dia 15 do mês corrente, em Brasília (UTC-3 o ano todo)? */
export function isPastFeeDay15(now: Date = new Date()): boolean {
  const b = new Date(now.getTime() - 3 * 60 * 60 * 1000)
  return b.getUTCDate() >= 15
}

/** Mês seguinte a um mês "YYYY-MM" (dezembro → janeiro do ano seguinte). */
export function nextMonthKeyOf(month: string): string {
  const [y, m] = (month || '').split('-').map(Number)
  if (!y || !m) return ''
  // Date normaliza mês 12 como janeiro do ano seguinte (mesmo truque de
  // defaultDueDate).
  const d = new Date(y, m, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

/**
 * Situação de um aluno a partir das mensalidades dele — MESMA regra do hook de
 * e-mail (fee_overdue_notice.js), sempre em Brasília:
 *  - REGRA DO DIA 15 (definida pelo usuário): a partir do dia 15 do mês
 *    corrente, aluno ATIVO sem a mensalidade do mês corrente PAGA é
 *    "inadimplente" — mesmo sem nenhum lançamento para o mês (aqui o
 *    julgamento considera o conjunto de mensalidades do aluno, não uma row
 *    pendente). Antes do dia 15, o mês corrente vazio/pendente não conta;
 *  - REGRA DO MÊS SEGUINTE PAGO (definida pelo usuário): quem JÁ PAGOU a
 *    mensalidade do mês seguinte ao corrente quitou adiantado e não deve a do
 *    mês corrente — não é "inadimplente" por ela (nem pela regra do dia 15,
 *    nem por pendência do PRÓPRIO mês corrente). Pendência de mês ANTERIOR
 *    continua contando;
 *  - mensalidade PENDENTE com mês de referência anterior ao atual OU (mês
 *    corrente com vencimento já passado) → "inadimplente", em qualquer dia;
 *  - sem lançamentos (e sem a regra do dia 15) → "sem_lancamentos" (neutro);
 *  - caso contrário → "em_dia". Mensalidade PAGA nunca é inadimplente.
 *
 * `active` = aluno ativo? A regra do dia 15 vale só para ativos; a pendência
 * vencida conta para qualquer aluno (alinhado ao hook, que não filtra status).
 *
 * `enrolled` = aluno matriculado em PELO MENOS UMA turma (collection
 * class_students)? Regra definida pelo usuário: quem não está em nenhuma turma
 * pode ser só cliente da loja — NUNCA é inadimplente, nem por pendência
 * vencida, nem pela regra do dia 15. "sem_lancamentos" quando não tem
 * mensalidade lançada; "em_dia" quando tem. Quem tem turma segue a regra acima
 * exatamente como antes.
 */
export function feeStanding(
  fees: MonthlyFee[],
  now: Date = new Date(),
  active = true,
  enrolled = true,
): FeeStanding {
  const month = monthKeyOf(now)
  const nextMonthPaid = fees.some(
    (f) => f.reference_month === nextMonthKeyOf(month) && f.status === 'pago',
  )
  const hasOverdue = fees.some((f) => {
    if (f.status !== 'pendente') return false
    if (f.reference_month === month) return isOverdue(f, now) && !nextMonthPaid
    return f.reference_month < month
  })
  if (enrolled) {
    if (hasOverdue) return 'inadimplente'
    const currentMonthPaid = fees.some((f) => f.reference_month === month && f.status === 'pago')
    if (active && isPastFeeDay15(now) && !currentMonthPaid && !nextMonthPaid) return 'inadimplente'
  }
  if (fees.length === 0) return 'sem_lancamentos'
  return 'em_dia'
}

/** Data de vencimento padrão: dia 15 do mês SEGUINTE ao mês de referência ("YYYY-MM"). */
export function defaultDueDate(referenceMonth: string): string {
  const [y, m] = (referenceMonth || '').split('-').map(Number)
  if (!y || !m) return ''
  // Dezembro → janeiro do ano seguinte (Date normaliza mês 12 como jan do y+1).
  const d = new Date(y, m, 15)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-15`
}

/** Ano corrente em horário de Brasília (UTC-3 o ano todo, sem horário de verão). */
export function currentYearBrasilia(): number {
  return Number(brasiliaMonthKey().slice(0, 4))
}

/** Rótulo do método de pagamento. */
export const paymentMethodLabel: Record<PaymentMethod, string> = {
  pix: 'Pix',
  dinheiro: 'Dinheiro',
  cartao: 'Cartão',
}

/**
 * A mensalidade venceu (vencimento no passado) e continua pendente?
 *
 * due_date chega como "YYYY-MM-DD HH:mm:ss.SSSZ" (hora UTC meia-noite + 12h) e
 * é comparada por DIA com o dia de hoje em Brasília — nunca com `new Date(...)`
 * de hora local do dispositivo (que, em fuso negativo, empurra a data de
 * vencimento um dia para frente e esconde atrasos).
 */
export function isOverdue(fee: MonthlyFee, now: Date = new Date()): boolean {
  if (fee.status !== 'pendente' || !fee.due_date) return false
  const dueDay = String(fee.due_date).split(' ')[0].split('T')[0]
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dueDay)) return false
  return dueDay < brasiliaDayKey()
}

/** Total pago no ano (YYYY) — soma das mensalidades com status "pago". */
export function paidTotalInYear(fees: MonthlyFee[], year: number): number {
  return fees
    .filter((f) => f.status === 'pago' && (f.reference_month || '').startsWith(String(year)))
    .reduce((sum, f) => sum + (f.amount || 0), 0)
}

export type OverdueNoticeResult = {
  sent: number
  skippedNoEmail: number
  /** Alunos pulados pela trava de 7 dias (só o cron usa; o manual nunca pula). */
  skippedRecent?: number
  failed: number
  /** Nomes dos alunos por desfecho — o painel usa para explicar o resultado. */
  sentNames?: string[]
  skippedNoEmailNames?: string[]
  skippedRecentNames?: string[]
  failedNames?: string[]
}

export const monthlyFeesService = {
  /**
   * Envia o aviso de mensalidade em atraso (Equipe Tatsu) para todos os alunos
   * com mensalidade atrasada e e-mail cadastrado — rota do backend
   * (fee_overdue_notice.js), que exige login de admin.
   */
  async notifyOverdue(): Promise<OverdueNoticeResult> {
    return pb.send('/backend/v1/judo/fees/notify-overdue', { method: 'POST' })
  },
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
   *
   * Regra definida pelo admin: lançar COM forma de pagamento é registrar o
   * pagamento — a mensalidade nasce PAGA (status "pago" + paid_at de agora),
   * sem segunda confirmação no painel. Sem forma de pagamento, nasce pendente
   * e pode ser marcada como paga depois.
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
    // Vencimento: data escolhida ou, por padrão, dia 15 do mês seguinte ao de referência.
    const dueDate = input.dueDate?.trim() || defaultDueDate(month)
    const isPaid = !!input.paymentMethod
    return pb.collection('monthly_fees').create<MonthlyFee>({
      student: input.studentId,
      reference_month: month,
      amount: Math.max(0, Number(input.amount) || 0),
      status: isPaid ? 'pago' : 'pendente',
      ...(isPaid && {
        // PocketBase date: "YYYY-MM-DD HH:mm:ss.SSSZ"
        paid_at: new Date().toISOString().replace('T', ' ').slice(0, 19) + '.000Z',
      }),
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
