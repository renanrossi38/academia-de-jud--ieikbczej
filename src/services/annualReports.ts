import pb from '@/lib/pocketbase/client'
import { FinanceYearData, yearBalance } from '@/services/finance'
import { currentYearBrasilia } from '@/services/monthlyFees'

/**
 * Relatórios anuais arquivados (collection `annual_reports`, migration 0022).
 *
 * Cada registro é um SNAPSHOT do fechamento do ano — calculado pelo mesmo motor
 * de src/services/finance.ts (mensalidades por paid_at, produtos por pedidos
 * não cancelados, despesas lançadas; horário de Brasília). Arquivar é só o
 * registro do fechamento: NÃO apaga nem altera mensalidades, pedidos nem
 * despesas — os dados do ano corrente continuam sendo calculados em tempo real.
 *
 * Regra anti-adulteração: só o ANO CORRENTE (Brasília) pode ser arquivado —
 * gerar o financeiro de um ano retroativo permitiria criar um fechamento
 * "oficial" com dados inventados. A regra vale aqui E no servidor
 * (pocketbase/hooks/annual_reports_guard.js), para qualquer chamada direta à API.
 */

const ERRO_ANO_RETROATIVO = 'Só é possível arquivar o relatório do ano corrente.'

export interface AnnualReport {
  collectionId: string
  collectionName: string
  id: string
  year: number
  fees: number
  products: number
  expenses: number
  /** Total do ano menos despesas (calculado no arquivamento). */
  balance: number
  /** Os 12 meses na ordem do ano civil — mesma forma de FinanceMonth[]. */
  months: FinanceYearData['months']
  archived_by?: string
  created: string
  updated: string
}

export const annualReportsService = {
  /** Todos os relatórios salvos, do ano mais recente para o mais antigo. */
  async list(): Promise<AnnualReport[]> {
    return pb.collection('annual_reports').getFullList<AnnualReport>({
      sort: '-year',
    })
  },

  /** O relatório arquivado de um ano, ou null se ainda não foi arquivado. */
  async getByYear(year: number): Promise<AnnualReport | null> {
    const rows = await pb.collection('annual_reports').getList<AnnualReport>(1, 1, {
      filter: `year = ${year}`,
    })
    return rows.items[0] ?? null
  },

  /**
   * Salva (ou substitui) o fechamento do ano. `data` é calculado pelo motor de
   * finance.ts no momento do clique — fica gravado como está, mesmo que as
   * fontes mudem depois. Recusa anos retroativos/futuros: só o ano corrente
   * (Brasília) pode ser arquivado.
   */
  async archive(data: FinanceYearData, archivedBy?: string): Promise<AnnualReport> {
    if (data.year !== currentYearBrasilia()) {
      throw new Error(ERRO_ANO_RETROATIVO)
    }
    const payload = {
      year: data.year,
      fees: data.fees,
      products: data.products,
      expenses: data.expenses,
      balance: yearBalance(data),
      months: data.months,
      archived_by: archivedBy || '',
    }
    // Um fechamento por ano (índice único): substitui o relatório existente.
    const existing = await annualReportsService.getByYear(data.year)
    if (existing) {
      return pb.collection('annual_reports').update<AnnualReport>(existing.id, payload)
    }
    return pb.collection('annual_reports').create<AnnualReport>(payload)
  },

  /** Apaga o relatório arquivado do ano (não toca em mensalidades/pedidos/despesas). */
  async remove(id: string): Promise<void> {
    await pb.collection('annual_reports').delete(id)
  },
}
