import pb from '@/lib/pocketbase/client'
import { monthKeyOf } from '@/services/monthlyFees'

/**
 * Motor do painel financeiro: junta as DUAS vertentes de ganho da academia —
 * mensalidades (collection monthly_fees, status pago) e produtos/pedidos da
 * loja (orders + total, pedidos cancelados NÃO contam como ganho) — e as
 * despesas (collection expenses), tudo agrupado por mês de Brasília.
 */

/** "YYYY-MM" de um timestamp ISO, em horário de Brasília (UTC-3, sem DST). */
export function monthKeyOfBrasilia(iso: string | undefined): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return monthKeyOf(new Date(d.getTime() - 3 * 60 * 60 * 1000))
}

/** "YYYY-MM" de uma data crua "YYYY-MM-DD..." (despesas: já é o dia local). */
export function monthKeyOfDate(raw: string | undefined): string {
  if (!raw) return ''
  return raw.slice(0, 7)
}

export interface FinanceMonth {
  /** "2026-01" ... "2026-12" */
  key: string
  fees: number
  products: number
  expenses: number
}

export function emptyMonth(key: string): FinanceMonth {
  return { key, fees: 0, products: 0, expenses: 0 }
}

export const monthTotal = (m: FinanceMonth) => m.fees + m.products
export const monthBalance = (m: FinanceMonth) => monthTotal(m) - m.expenses

export interface FinanceYearData {
  year: number
  /** 12 entradas fixas, na ordem do ano civil. */
  months: FinanceMonth[]
  fees: number
  products: number
  expenses: number
}
export const yearTotal = (y: FinanceYearData) => y.fees + y.products
export const yearBalance = (y: FinanceYearData) => yearTotal(y) - y.expenses

/** Mensalidades PAGAS do ano — por paid_at (data do pagamento) ou reference_month. */
export async function loadFeesForYear(year: number): Promise<Map<string, number>> {
  const rows = await pb
    .collection('monthly_fees')
    .getFullList<{ reference_month: string; amount: number; paid_at?: string; status: string }>({
      filter: `status = "pago"`,
    })
  const byMonth = new Map<string, number>()
  for (const r of rows) {
    // Mês do ganho: quando foi pago (paid_at); sem essa data, o mês de referência.
    const key = monthKeyOfBrasilia(r.paid_at) || r.reference_month || ''
    if (!key.startsWith(`${year}-`)) continue
    byMonth.set(key, (byMonth.get(key) ?? 0) + (r.amount ?? 0))
  }
  return byMonth
}

/** Pedidos NÃO cancelados do ano — o ganho é o total do pedido, na data do pedido. */
export async function loadOrdersForYear(year: number): Promise<Map<string, number>> {
  const rows = await pb
    .collection('orders')
    .getFullList<{ total: number; created: string; status: string }>({
      filter: `status != "cancelado"`,
    })
  const byMonth = new Map<string, number>()
  for (const r of rows) {
    const key = monthKeyOfBrasilia(r.created)
    if (!key.startsWith(`${year}-`)) continue
    byMonth.set(key, (byMonth.get(key) ?? 0) + (r.total ?? 0))
  }
  return byMonth
}

/** Despesas do ano — pela data lançada (pode ser retroativa). */
export async function loadExpensesForYear(year: number): Promise<Map<string, number>> {
  const rows = await pb.collection('expenses').getFullList<{ amount: number; date: string }>({
    filter: `date >= "${year}-01-01 00:00:00.000Z" && date <= "${year}-12-31 23:59:59.999Z"`,
  })
  const byMonth = new Map<string, number>()
  for (const r of rows) {
    const key = monthKeyOfDate(r.date)
    if (!key.startsWith(`${year}-`)) continue
    byMonth.set(key, (byMonth.get(key) ?? 0) + (r.amount ?? 0))
  }
  return byMonth
}

/** Carrega os 12 meses do ano com as três séries (mensalidades, produtos, despesas). */
export async function loadFinanceYear(year: number): Promise<FinanceYearData> {
  const [fees, orders, expenses] = await Promise.all([
    loadFeesForYear(year),
    loadOrdersForYear(year),
    loadExpensesForYear(year),
  ])
  const months = Array.from({ length: 12 }, (_, i) => {
    const key = `${year}-${String(i + 1).padStart(2, '0')}`
    return {
      key,
      fees: fees.get(key) ?? 0,
      products: orders.get(key) ?? 0,
      expenses: expenses.get(key) ?? 0,
    }
  })
  return {
    year,
    months,
    fees: months.reduce((s, m) => s + m.fees, 0),
    products: months.reduce((s, m) => s + m.products, 0),
    expenses: months.reduce((s, m) => s + m.expenses, 0),
  }
}

/** Mês corrente em Brasília ("YYYY-MM"), mesmo padrão de feeStanding/defaultDueDate. */
export function currentMonthKeyBrasilia(): string {
  return monthKeyOf(new Date(Date.now() - 3 * 60 * 60 * 1000))
}
