import { useMemo } from 'react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import type { AnnualReport } from '@/services/annualReports'
import { FinanceYearData, monthBalance, yearBalance } from '@/services/finance'
import { monthLabel } from '@/services/monthlyFees'
import { fmtBRL } from '@/pages/admin/StudentDetailPanels'
import { Archive, Info, Loader2, X } from 'lucide-react'

/**
 * Relatórios anuais arquivados — lista dos anos já fechados, clicáveis para ver
 * o snapshot salvo daquele ano (mesmo que os dados de origem mudem depois).
 * Arquivar NÃO apaga nem altera mensalidades, pedidos nem despesas.
 * Anti-adulteração: o botão de arquivar SÓ existe no ano corrente (Brasília) —
 * navegar para 2025 ou 2027 não mostra botão, nem o diálogo fica acionável.
 */

export interface SavedReportsSectionProps {
  /** Anos que já têm relatório arquivado (do mais recente para o mais antigo). */
  reports: AnnualReport[]
  /** Ano atualmente aberto na comparação (‹ ano ›). */
  year: number
  /** Ano navegado que corresponde a um relatório salvo (null = nenhum). */
  openReport: AnnualReport | null
  /** Ano corrente em Brasília — só ele pode ser arquivado (nada de retroativo). */
  currentYear: number
  onOpenReport: (report: AnnualReport) => void
  onArchived: () => void
  canArchive: boolean
  isArchiving: boolean
  onArchiveClick: () => void
}

export function SavedReportsSection({
  reports,
  year,
  openReport,
  currentYear,
  onOpenReport,
  onArchived,
  canArchive,
  isArchiving,
  onArchiveClick,
}: SavedReportsSectionProps) {
  const archivedYears = useMemo(() => reports.map((r) => r.year), [reports])
  // Blindagem local (além das da página e do serviço): só renderiza o botão
  // quando o ano exibido é o corrente — ano retroativo/futuro nunca é arquivável.
  const canArchiveHere = canArchive && year === currentYear

  return (
    <section className="mt-6">
      <div className="rounded-2xl border border-[#E8E0D5] bg-white shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-3 p-5 pb-4">
          <h2 className="font-serif font-bold text-base text-[#1C1B1A] flex items-center gap-2">
            <Archive className="w-4 h-4 text-[#C1272D]" />
            Relatórios salvos
          </h2>
          {canArchiveHere ? (
            <Button
              size="sm"
              onClick={onArchiveClick}
              disabled={isArchiving}
              className="bg-[#C1272D] hover:bg-[#A01E23] text-white text-[11px] font-semibold"
            >
              {isArchiving ? (
                <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
              ) : (
                <Archive className="w-3.5 h-3.5 mr-1.5" />
              )}
              {isArchiving ? 'Arquivando...' : `Arquivar relatório de ${year}`}
            </Button>
          ) : (
            <span className="text-[11px] text-[#6B6560]">
              {year < currentYear
                ? 'Ano fechado — não é possível gerar o financeiro de um ano retroativo.'
                : 'Ano em andamento — o arquivamento fica disponível no fechamento.'}
            </span>
          )}
        </div>

        {archivedYears.length === 0 ? (
          <div className="rounded-xl border border-dashed border-[#D9D2C7] bg-[#FAF6F0]/50 px-4 py-6 mx-5 mb-5 text-center">
            <p className="text-xs text-[#6B6560] flex items-center justify-center gap-2">
              <Info className="w-3.5 h-3.5 shrink-0" />
              Nenhum relatório arquivado ainda — ao fechar um ano, clique em "Arquivar relatório de{' '}
              {year}" para guardar o fechamento daquele ano.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-[#E8E0D5] pb-2">
            {reports.map((r) => {
              const isOpen = openReport?.id === r.id
              return (
                <div
                  key={r.id}
                  className={`flex items-center gap-3 px-5 py-3 transition-colors ${
                    isOpen ? 'bg-[#F7E4E2]/40' : 'hover:bg-[#FAF6F0]/50'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => onOpenReport(r)}
                    className="min-w-0 flex-1 text-left"
                    title={`Abrir o relatório arquivado de ${r.year}`}
                  >
                    <p className="text-sm font-semibold text-[#1C1B1A]">
                      Relatório de {r.year}
                      {isOpen && (
                        <span className="ml-2 text-[10px] font-sans font-semibold text-[#C1272D]">
                          aberto
                        </span>
                      )}
                    </p>
                    <p className="text-[11px] text-[#6B6560]">
                      Mensalidades {fmtBRL(r.fees)} · Produtos {fmtBRL(r.products)} · Despesas{' '}
                      {fmtBRL(r.expenses)} · Saldo{' '}
                      <strong className={r.balance < 0 ? 'text-[#C1272D]' : 'text-[#2E7D4F]'}>
                        {fmtBRL(r.balance)}
                      </strong>
                    </p>
                  </button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onOpenReport(r)}
                    className="border-[#E8E0D5] text-[#1C1B1A] text-[11px] font-semibold hover:bg-[#FAF6F0]"
                  >
                    Ver
                  </Button>
                </div>
              )
            })}
          </div>
        )}

        <p className="text-[10px] text-[#6B6560] px-5 py-3 border-t border-[#E8E0D5] flex items-start gap-1.5">
          <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          Arquivar é só o registro do fechamento: NÃO apaga nem altera mensalidades, pedidos nem
          despesas. O ano corrente continua calculado em tempo real — o relatório salvo fica
          guardado, mesmo que os dados de origem mudem depois.
        </p>
      </div>
    </section>
  )
}

export function ArchiveReportDialog({
  open,
  onOpenChange,
  year,
  data,
  onConfirm,
  isArchiving,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  year: number
  data: FinanceYearData | null
  onConfirm: () => void
  isArchiving: boolean
}) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="bg-white border border-[#E8E0D5] rounded-2xl max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle className="font-serif text-[#1C1B1A]">
            Arquivar o relatório de {year}?
          </AlertDialogTitle>
          <AlertDialogDescription className="text-[#6B6560] text-xs leading-relaxed">
            O fechamento do ano é salvo com{' '}
            <strong className="text-[#1C1B1A]">Mensalidades {fmtBRL(data?.fees ?? 0)}</strong>,{' '}
            <strong className="text-[#1C1B1A]">Produtos {fmtBRL(data?.products ?? 0)}</strong>,{' '}
            <strong className="text-[#1C1B1A]">Despesas {fmtBRL(data?.expenses ?? 0)}</strong> e{' '}
            <strong className="text-[#1C1B1A]">Saldo {fmtBRL(data ? yearBalance(data) : 0)}</strong>{' '}
            — os 12 meses vão junto. Mensalidades, pedidos e despesas NÃO são apagados nem
            alterados: os dados de {year} continuam sendo calculados em tempo real das mesmas
            fontes.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel className="border-[#E8E0D5] text-[#1C1B1A] text-xs font-semibold">
            Cancelar
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault()
              onConfirm()
            }}
            disabled={isArchiving}
            className="bg-[#C1272D] hover:bg-[#A01E23] text-white text-xs font-semibold"
          >
            {isArchiving ? 'Arquivando...' : `Salvar relatório de ${year}`}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

/** Cabeçalho do comparativo quando um relatório arquivado está aberto. */
export function ArchivedReportBanner({
  report,
  onClose,
  onNavigateYear,
}: {
  report: AnnualReport
  onClose: () => void
  onNavigateYear: (year: number) => void
}) {
  return (
    <div className="rounded-2xl border border-[#C1272D]/40 bg-[#F7E4E2]/60 p-4 sm:p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-serif font-bold text-lg text-[#1C1B1A] flex items-center gap-2">
          <Archive className="w-4 h-4 text-[#C1272D]" />
          Relatório arquivado de {report.year}
        </h2>
        <Button
          variant="outline"
          size="sm"
          onClick={onClose}
          className="border-[#C1272D]/40 text-[#1C1B1A] text-[11px] font-semibold hover:bg-[#F7E4E2]"
        >
          <X className="w-3.5 h-3.5 mr-1" />
          Fechar
        </Button>
      </div>
      <p className="text-xs text-[#6B6560] mt-1">
        Snapshot salvo no arquivamento — não muda, mesmo que mensalidades, pedidos ou despesas de{' '}
        {report.year} mudem depois.{' '}
        <button
          type="button"
          onClick={() => onNavigateYear(report.year)}
          className="text-[#C1272D] font-semibold underline underline-offset-2"
        >
          Ver {report.year} ao vivo
        </button>
      </p>

      {/* Tabela do snapshot: os 12 meses, do jeito que foram gravados. */}
      <div className="mt-4 rounded-xl border border-[#E8E0D5] bg-white overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-[#E8E0D5] bg-[#FAF6F0]/60 text-[#6B6560] font-serif uppercase tracking-wider text-[11px]">
                <th className="py-3 px-4 sm:px-5">Mês</th>
                <th className="py-3 px-3">Mensalidades</th>
                <th className="py-3 px-3">Produtos</th>
                <th className="py-3 px-3">Despesas</th>
                <th className="py-3 px-4 sm:px-5 text-right">Saldo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E8E0D5]">
              {(report.months ?? []).map((m) => {
                const balance = monthBalance(m)
                return (
                  <tr key={m.key} className="hover:bg-[#FAF6F0]/50 transition-colors">
                    <td className="py-3 px-4 sm:px-5 font-semibold text-[#1C1B1A]">
                      {monthLabel(m.key)}
                    </td>
                    <td className="py-3 px-3 text-[#1C1B1A]">{fmtBRL(m.fees)}</td>
                    <td className="py-3 px-3 text-[#1C1B1A]">{fmtBRL(m.products)}</td>
                    <td className="py-3 px-3 text-[#6B6560]">{fmtBRL(m.expenses)}</td>
                    <td
                      className={`py-3 px-4 sm:px-5 text-right font-serif font-bold ${
                        balance < 0 ? 'text-[#C1272D]' : 'text-[#2E7D4F]'
                      }`}
                    >
                      {fmtBRL(balance)}
                    </td>
                  </tr>
                )
              })}
              <tr className="border-t-2 border-[#E8E0D5] bg-[#FAF6F0]/60 font-bold">
                <td className="py-3 px-4 sm:px-5 text-[#1C1B1A]">Total {report.year}</td>
                <td className="py-3 px-3 text-[#1C1B1A]">{fmtBRL(report.fees)}</td>
                <td className="py-3 px-3 text-[#1C1B1A]">{fmtBRL(report.products)}</td>
                <td className="py-3 px-3 text-[#6B6560]">{fmtBRL(report.expenses)}</td>
                <td className="py-3 px-4 sm:px-5 text-right font-serif font-bold text-[#1C1B1A]">
                  {fmtBRL(report.balance)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
