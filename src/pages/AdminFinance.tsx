import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { useRealtime } from '@/hooks/use-realtime'
import { useToast } from '@/hooks/use-toast'
import {
  AdminPageHeader,
  AdminSummary,
  AdminPageLoader,
  AdminSummaryStat,
} from '@/components/admin/AdminPage'
import ExpenseDialog, { expenseCategoryLabel } from '@/components/admin/ExpenseDialog'
import { expensesService } from '@/services/expenses'
import {
  FinanceMonth,
  FinanceYearData,
  currentMonthKeyBrasilia,
  loadFinanceYear,
  monthBalance,
  monthTotal,
  yearBalance,
  yearTotal,
} from '@/services/finance'
import { monthLabel } from '@/services/monthlyFees'
import { fmtBRL, fmtDate } from '@/pages/admin/StudentDetailPanels'
import { Expense } from '@/types'
import { Button } from '@/components/ui/button'
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
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import {
  ChevronLeft,
  ChevronRight,
  GraduationCap,
  Info,
  Loader2,
  Package,
  Plus,
  Scale,
  Trash2,
  TrendingDown,
  TrendingUp,
  Wallet,
} from 'lucide-react'

/**
 * Painel Financeiro — duas vertentes de ganho (MENSALIDADES × PRODUTOS),
 * despesas do mês e comparativo mês a mês do ano (horário de Brasília).
 *
 * Ganho de mensalidade = mensalidade com status pago (pela data de pagamento
 * `paid_at`; sem ela, cai no mês de referência). Ganho de produto = pedido da
 * loja NÃO cancelado (cancelado não é ganho), na data do pedido.
 * Despesas são lançadas pelo admin e valem pela data da despesa — retroativas
 * aparecem no mês certo do gráfico.
 */

const MES_CURTO = [
  'Jan',
  'Fev',
  'Mar',
  'Abr',
  'Mai',
  'Jun',
  'Jul',
  'Ago',
  'Set',
  'Out',
  'Nov',
  'Dez',
]

const summaryStat = (label: string, value: string, icon: ReactNode): AdminSummaryStat => ({
  label,
  value,
  icon,
})

export default function AdminFinance() {
  const { user, isAdmin, isLoading: authLoading } = useAuth()
  const navigate = useNavigate()
  const { toast } = useToast()

  const todayKey = useMemo(() => currentMonthKeyBrasilia(), [])
  const [year, setYear] = useState(() => Number(todayKey.slice(0, 4)))
  const [data, setData] = useState<FinanceYearData | null>(null)
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [createOpen, setCreateOpen] = useState(false)
  const [deleting, setDeleting] = useState<Expense | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  const load = useCallback(async () => {
    setIsLoading(true)
    try {
      const [yearData, expenseRows] = await Promise.all([
        loadFinanceYear(year),
        expensesService.listByYear(year),
      ])
      setData(yearData)
      setExpenses(expenseRows)
    } catch (err) {
      console.error('Erro ao carregar dados financeiros:', err)
      toast({
        title: 'Erro ao carregar painel financeiro',
        description: 'Não foi possível ler mensalidades, pedidos e despesas no servidor.',
        variant: 'destructive',
      })
    } finally {
      setIsLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year])

  useEffect(() => {
    if (authLoading) return
    if (!user) {
      navigate('/entrar?redirect=/painel/financeiro')
      return
    }
    if (!isAdmin) {
      toast({
        title: 'Acesso Restrito',
        description: 'Esta área é exclusiva para administradores da academia.',
        variant: 'destructive',
      })
      navigate('/')
      return
    }
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, isAdmin, authLoading, load])

  // Tempo real: mensalidade paga, pedido novo ou despesa lançada atualiza na hora.
  useRealtime('monthly_fees', load)
  useRealtime('orders', load)
  useRealtime('expenses', load)

  const currentMonth = data?.months.find((m) => m.key === todayKey)
  const chartData = useMemo(
    () =>
      (data?.months ?? []).map((m) => ({
        mes: MES_CURTO[Number(m.key.slice(5, 7)) - 1],
        Mensalidades: m.fees,
        Produtos: m.products,
        Despesas: m.expenses,
      })),
    [data],
  )

  const expensesOfMonth = expenses.filter((e) => e.date.slice(0, 7) === todayKey)

  const handleDelete = async () => {
    if (!deleting) return
    setIsDeleting(true)
    try {
      await expensesService.remove(deleting.id)
      setExpenses((prev) => prev.filter((e) => e.id !== deleting.id))
      toast({
        title: 'Despesa excluída',
        description: `"${deleting.description}" saiu do painel financeiro.`,
      })
      setDeleting(null)
    } catch (err: any) {
      console.error('Erro ao excluir despesa:', err)
      toast({
        title: 'Erro ao excluir',
        description: err?.message || 'Falha ao remover no servidor. Tente novamente.',
        variant: 'destructive',
      })
    } finally {
      setIsDeleting(false)
    }
  }

  if (authLoading || isLoading) {
    return <AdminPageLoader label="Carregando painel financeiro..." />
  }

  const summary = [
    summaryStat(
      'Ganho do mês — Mensalidades',
      fmtBRL(currentMonth?.fees ?? 0),
      <GraduationCap className="h-4 w-4" />,
    ),
    summaryStat(
      'Ganho do mês — Produtos',
      fmtBRL(currentMonth?.products ?? 0),
      <Package className="h-4 w-4" />,
    ),
    summaryStat(
      'Despesas do mês',
      fmtBRL(currentMonth?.expenses ?? 0),
      <TrendingDown className="h-4 w-4" />,
    ),
    summaryStat(
      'Saldo do mês',
      fmtBRL(currentMonth ? monthBalance(currentMonth) : 0),
      <Scale className="h-4 w-4" />,
    ),
  ]

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 animate-fade-rise">
      <AdminPageHeader
        breadcrumb="Financeiro"
        breadcrumbTo="/painel/financeiro"
        title="Financeiro"
        icon={<Wallet className="w-6 h-6" />}
        description="Ganhos de mensalidades e produtos, despesas e saldo — mês a mês (horário de Brasília)."
        action={
          <Button
            onClick={() => setCreateOpen(true)}
            className="bg-[#C1272D] hover:bg-[#A01E23] text-white text-sm font-semibold"
          >
            <Plus className="w-4 h-4 mr-1.5" />
            Nova despesa
          </Button>
        }
      />

      {/* Resumo do mês corrente (Brasília) */}
      <AdminSummary stats={summary} />

      {/* Comparativo do ano — gráfico + tabela */}
      <section className="mt-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-serif font-bold text-lg text-[#1C1B1A]">Comparativo {year}</h2>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon"
              onClick={() => setYear((y) => y - 1)}
              className="h-8 w-8 border-[#E8E0D5] text-[#1C1B1A] hover:bg-[#FAF6F0]"
              aria-label="Ano anterior"
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <span className="font-serif font-bold text-sm text-[#1C1B1A] w-12 text-center">
              {year}
            </span>
            <Button
              variant="outline"
              size="icon"
              onClick={() => setYear((y) => y + 1)}
              className="h-8 w-8 border-[#E8E0D5] text-[#1C1B1A] hover:bg-[#FAF6F0]"
              aria-label="Ano seguinte"
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>

        <div className="rounded-2xl border border-[#E8E0D5] bg-white shadow-xs p-4 sm:p-5">
          <div className="h-72 sm:h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E8E0D5" vertical={false} />
                <XAxis dataKey="mes" tick={{ fontSize: 11, fill: '#6B6560' }} stroke="#D9D2C7" />
                <YAxis
                  tick={{ fontSize: 11, fill: '#6B6560' }}
                  stroke="#D9D2C7"
                  tickFormatter={(v: number) =>
                    v >= 1000 ? `${(v / 1000).toLocaleString('pt-BR')}k` : String(v)
                  }
                />
                <Tooltip
                  formatter={(value, name) => [fmtBRL(Number(value)), String(name)]}
                  labelStyle={{ color: '#1C1B1A', fontWeight: 700 }}
                  contentStyle={{
                    borderRadius: 12,
                    border: '1px solid #E8E0D5',
                    fontSize: 12,
                  }}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="Mensalidades" stackId="ganho" fill="#C1272D" radius={[0, 0, 0, 0]} />
                <Bar dataKey="Produtos" stackId="ganho" fill="#E8A13C" radius={[3, 3, 0, 0]} />
                <Bar dataKey="Despesas" fill="#6B6560" radius={[3, 3, 0, 0]} fillOpacity={0.55} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <p className="text-[10px] text-[#6B6560] mt-3 flex items-start gap-1.5">
            <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
            Ganho = mensalidades pagas + pedidos não cancelados (empilhados). Despesas saem do saldo
            — pedidos cancelados não contam como ganho. Tudo pelo horário de Brasília.
          </p>
        </div>

        {/* Tabela mês a mês */}
        <div className="rounded-2xl border border-[#E8E0D5] bg-white shadow-xs overflow-hidden">
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
                {(data?.months ?? []).map((m) => {
                  const isCurrent = m.key === todayKey
                  const balance = monthBalance(m)
                  return (
                    <tr
                      key={m.key}
                      className={`transition-colors ${isCurrent ? 'bg-[#F7E4E2]/40' : 'hover:bg-[#FAF6F0]/50'}`}
                    >
                      <td className="py-3 px-4 sm:px-5 font-semibold text-[#1C1B1A]">
                        {monthLabel(m.key)}
                        {isCurrent && (
                          <span className="ml-2 text-[10px] font-sans font-semibold text-[#C1272D]">
                            atual
                          </span>
                        )}
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
                  <td className="py-3 px-4 sm:px-5 text-[#1C1B1A]">Total {year}</td>
                  <td className="py-3 px-3 text-[#1C1B1A]">{fmtBRL(data?.fees ?? 0)}</td>
                  <td className="py-3 px-3 text-[#1C1B1A]">{fmtBRL(data?.products ?? 0)}</td>
                  <td className="py-3 px-3 text-[#6B6560]">{fmtBRL(data?.expenses ?? 0)}</td>
                  <td className="py-3 px-4 sm:px-5 text-right font-serif font-bold text-[#1C1B1A]">
                    {fmtBRL(data ? yearBalance(data) : 0)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Despesas do mês corrente */}
      <section className="mt-6">
        <div className="rounded-2xl border border-[#E8E0D5] bg-white shadow-xs">
          <div className="flex flex-wrap items-center justify-between gap-3 p-5 pb-4">
            <h2 className="font-serif font-bold text-base text-[#1C1B1A] flex items-center gap-2">
              <TrendingDown className="w-4 h-4 text-[#C1272D]" />
              Despesas de {monthLabel(todayKey)}
            </h2>
            <Button
              size="sm"
              onClick={() => setCreateOpen(true)}
              className="bg-[#C1272D] hover:bg-[#A01E23] text-white text-[11px] font-semibold"
            >
              <Plus className="w-3.5 h-3.5 mr-1.5" />
              Nova despesa
            </Button>
          </div>
          {expensesOfMonth.length === 0 ? (
            <div className="rounded-xl border border-dashed border-[#D9D2C7] bg-[#FAF6F0]/50 px-4 py-6 mx-5 mb-5 text-center">
              <p className="text-xs text-[#6B6560] flex items-center justify-center gap-2">
                <Info className="w-3.5 h-3.5 shrink-0" />
                Nenhuma despesa lançada neste mês — use "Nova despesa" para registrar (dá para
                lançar retroativo, com a data do mês que quiser).
              </p>
            </div>
          ) : (
            <div className="divide-y divide-[#E8E0D5] pb-2">
              {expensesOfMonth.map((e) => (
                <div key={e.id} className="flex items-center gap-3 px-5 py-3 hover:bg-[#FAF6F0]/50">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-[#1C1B1A] truncate">{e.description}</p>
                    <p className="text-[11px] text-[#6B6560]">
                      {fmtDate(e.date)}
                      {e.category ? ` · ${expenseCategoryLabel[e.category]}` : ''}
                      {e.notes ? ` · ${e.notes}` : ''}
                    </p>
                  </div>
                  <span className="font-serif font-bold text-sm text-[#C1272D]">
                    -{fmtBRL(e.amount)}
                  </span>
                  <button
                    type="button"
                    onClick={() => setDeleting(e)}
                    className="text-[#6B6560] hover:text-[#C1272D] inline-flex items-center"
                    title="Excluir despesa"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
          <p className="text-[10px] text-[#6B6560] px-5 py-3 border-t border-[#E8E0D5] flex items-start gap-1.5">
            <Wallet className="w-3.5 h-3.5 shrink-0 mt-0.5 text-[#C1272D]" />
            Total de despesas deste mês:{' '}
            <strong className="text-[#1C1B1A]">{fmtBRL(currentMonth?.expenses ?? 0)}</strong>
            {' — '}reflete direto no saldo e no gráfico.
          </p>
        </div>
      </section>

      <ExpenseDialog open={createOpen} onOpenChange={setCreateOpen} onCreated={() => load()} />

      {/* Confirmação de exclusão da despesa */}
      <AlertDialog open={!!deleting} onOpenChange={(open) => !open && setDeleting(null)}>
        <AlertDialogContent className="bg-white border border-[#E8E0D5] rounded-2xl max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-serif text-[#1C1B1A]">
              Excluir despesa?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-[#6B6560] text-xs leading-relaxed">
              A despesa <strong className="text-[#1C1B1A]">"{deleting?.description}"</strong> (
              {fmtBRL(deleting?.amount ?? 0)}) sairá do painel financeiro. Esta ação não pode ser
              desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-[#E8E0D5] text-[#1C1B1A] text-xs font-semibold">
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault()
                handleDelete()
              }}
              disabled={isDeleting}
              className="bg-[#C1272D] hover:bg-[#A01E23] text-white text-xs font-semibold"
            >
              {isDeleting ? 'Excluindo...' : 'Sim, excluir'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
