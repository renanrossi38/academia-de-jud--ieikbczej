import pb from '@/lib/pocketbase/client'
import { Expense } from '@/types'

/** Despesas da academia — CRUD admin (collection `expenses`, migration 0021). */
export const expensesService = {
  /** Todas as despesas de um ano civil (ordenadas pela data). */
  async listByYear(year: number): Promise<Expense[]> {
    return pb.collection('expenses').getFullList<Expense>({
      filter: `date >= "${year}-01-01 00:00:00.000Z" && date <= "${year}-12-31 23:59:59.999Z"`,
      sort: 'date,created',
    })
  },

  async create(input: {
    description: string
    amount: number
    date: string
    category?: string
    notes?: string
  }): Promise<Expense> {
    return pb.collection('expenses').create<Expense>(input)
  },

  async remove(id: string): Promise<void> {
    await pb.collection('expenses').delete(id)
  },
}
