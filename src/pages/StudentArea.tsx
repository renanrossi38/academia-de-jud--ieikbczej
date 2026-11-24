import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useRealtime } from '@/hooks/use-realtime'
import { useAuth } from '@/context/AuthContext'
import { HankoStamp } from '@/components/HankoStamp'
import { fetchStudentArea, mesPorExtenso } from '@/services/studentArea'
import type {
  StudentAreaData,
  StudentAreaAttendanceMonth,
  StudentAreaOrder,
} from '@/services/studentArea'
import { formatCustomAnswers } from '@/lib/customAnswers'
import { BELT_ORDER } from '@/services/beltPromotions'
import { beltLabel } from '@/components/admin/StudentDialogs'
import type { Belt, OrderStatus } from '@/types'
import { paymentMethodLabel } from '@/services/monthlyFees'
import { OrderStatusChip } from '@/components/OrderStatusChip'
import { OrderTrackingTimeline } from '@/components/orderTrackingTimeline/OrderTrackingTimeline'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { Wallet, ShoppingBag, CalendarCheck, Trophy, Award, KeyRound } from 'lucide-react'
import { Button } from '@/components/ui/button'

const fmtBRL = (v: number) =>
  (v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

const fmtDate = (iso?: string) =>
  iso
    ? new Date(iso).toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      })
    : '—'

function SectionCard({
  title,
  icon,
  children,
  empty,
  emptyText,
}: {
  title: string
  icon: React.ReactNode
  children: React.ReactNode
  empty: boolean
  emptyText: string
}) {
  return (
    <div className="bg-white rounded-2xl border border-[#E8E0D5] shadow-xs p-5">
      <h2 className="font-serif font-bold text-sm text-[#1C1B1A] uppercase tracking-wider mb-4 flex items-center gap-2">
        {icon}
        {title}
      </h2>
      {empty ? <p className="text-xs text-[#6B6560]">{emptyText}</p> : children}
    </div>
  )
}

export default function StudentArea() {
  const { user, isLoading: authLoading } = useAuth()
  const navigate = useNavigate()
  const [data, setData] = useState<StudentAreaData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    if (!user) return
    setIsLoading(true)
    setError('')
    try {
      const res = await fetchStudentArea()
      setData(res)
    } catch (err) {
      console.error('Erro ao carregar área do aluno:', err)
      setError('Não foi possível carregar seus dados. Tente novamente mais tarde.')
    } finally {
      setIsLoading(false)
    }
  }, [user])

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/entrar?redirect=/area-do-aluno')
      return
    }
    if (user) load()
  }, [user, authLoading, load])

  // Dados frescos quando o aluno volta para a aba (presença nova, promoção nova).
  useEffect(() => {
    const onFocus = () => {
      if (user && document.visibilityState === 'visible') load()
    }
    document.addEventListener('visibilitychange', onFocus)
    return () => document.removeEventListener('visibilitychange', onFocus)
  }, [user, load])

  const months: StudentAreaAttendanceMonth[] = data?.attendanceMonth ?? []

  // Rastreio ao vivo: quando o admin muda o status ou registra uma etapa
  // (ex.: "Em produção"), a área do aluno atualiza sem recarregar a página.
  useRealtime('orders', () => load())
  useRealtime('order_status_log', (e) => {
    const oid = (e.record as { order?: string }).order
    if (oid && data?.orders.some((o) => o.id === oid)) load()
  })
  useRealtime('order_tracking', (e) => {
    const oid = (e.record as { order?: string }).order
    if (oid && data?.orders.some((o) => o.id === oid)) load()
  })

  if (authLoading || isLoading) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 space-y-4 animate-fade-rise">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-28 w-full rounded-2xl" />
        <Skeleton className="h-40 w-full rounded-2xl" />
        <Skeleton className="h-40 w-full rounded-2xl" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center">
        <HankoStamp size="lg" className="mx-auto mb-4" />
        <p className="text-sm text-[#6B6560]">{error}</p>
      </div>
    )
  }

  const paidFees = data?.paidFees ?? []
  const orders = (data?.orders ?? []).filter((o) => o.status !== 'cancelado')
  const beltHistory = data?.beltHistory ?? []
  const hasAny =
    paidFees.length > 0 || orders.length > 0 || months.length > 0 || beltHistory.length > 0

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 animate-fade-rise">
      {/* Cabeçalho */}
      <div className="mb-8">
        <div className="flex items-center gap-2">
          <HankoStamp size="sm" />
          <span className="text-xs font-bold text-[#C1272D] tracking-widest uppercase font-serif">
            Judô Tatsu
          </span>
        </div>
        <h1 className="font-serif font-bold text-2xl sm:text-3xl text-[#1C1B1A] mt-1">
          Área do aluno
        </h1>
        <p className="text-xs text-[#6B6560] mt-1">
          Olá{data?.student?.name ? `, ${data.student.name}` : ''}! Aqui está um resumo da sua vida
          na academia.
        </p>
        {data?.currentBelt && (
          <div className="mt-3 flex items-center gap-2 flex-wrap">
            <span className="text-[11px] font-bold text-[#1C1B1A] uppercase tracking-wider font-serif">
              Faixa atual:
            </span>
            <Badge className="text-[10px] font-bold border bg-[#F7E4E2] text-[#C1272D] border-[#C1272D]/20">
              {beltLabel(data.currentBelt)}
            </Badge>
          </div>
        )}
      </div>

      {/* Atalho para trocar a senha inicial por uma própria */}
      <div className="mb-6 bg-white rounded-2xl border border-[#C1272D]/25 shadow-xs p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-[#F7E4E2] border border-[#C1272D]/20 flex items-center justify-center shrink-0">
            <KeyRound className="w-4.5 h-4.5 text-[#C1272D]" />
          </div>
          <div>
            <h2 className="font-serif font-bold text-sm text-[#1C1B1A]">
              Ainda usando a senha inicial?
            </h2>
            <p className="text-xs text-[#6B6560] mt-0.5">
              Troque por uma senha sua e ganhe mais segurança — sem depender da academia.
            </p>
          </div>
        </div>
        <Button
          onClick={() => navigate('/alterar-senha')}
          className="bg-[#C1272D] hover:bg-[#A01E23] text-white text-xs font-semibold shrink-0"
        >
          <KeyRound className="w-3.5 h-3.5 mr-1.5" />
          Alterar senha
        </Button>
      </div>

      {!hasAny && (
        <div className="bg-white rounded-2xl border border-[#E8E0D5] p-10 text-center mb-6 max-w-md mx-auto">
          <HankoStamp size="lg" className="mx-auto mb-4" />
          <h3 className="font-serif font-bold text-lg text-[#1C1B1A]">Nada por aqui ainda</h3>
          <p className="text-xs text-[#6B6560] mt-1">
            Quando houver mensalidades pagas, pedidos, presenças ou promoções, elas aparecem nesta
            página.
          </p>
        </div>
      )}

      <div className="space-y-6">
        {/* Mensalidades pagas */}
        <SectionCard
          title="Mensalidades pagas"
          icon={<Wallet className="w-4 h-4 text-[#C1272D]" />}
          empty={paidFees.length === 0}
          emptyText="Nenhuma mensalidade paga registrada ainda."
        >
          <div className="divide-y divide-[#E8E0D5]">
            {paidFees.map((fee) => (
              <div key={fee.id} className="py-3 flex items-center justify-between gap-3">
                <div>
                  <span className="text-sm font-semibold text-[#1C1B1A] block capitalize">
                    {mesPorExtenso(fee.reference_month)}
                  </span>
                  <span className="text-[11px] text-[#6B6560]">
                    Pago em {fmtDate(fee.paid_at)}
                    {fee.payment_method
                      ? ` • ${paymentMethodLabel[fee.payment_method as keyof typeof paymentMethodLabel] ?? fee.payment_method}`
                      : ''}
                  </span>
                </div>
                <strong className="text-sm font-bold text-[#2E7D4F] font-mono">
                  {fmtBRL(fee.amount)}
                </strong>
              </div>
            ))}
          </div>
        </SectionCard>

        {/* Pedidos (produtos comprados) */}
        <SectionCard
          title="Produtos comprados"
          icon={<ShoppingBag className="w-4 h-4 text-[#C1272D]" />}
          empty={orders.length === 0}
          emptyText="Nenhum pedido na loja ainda. Confira nosso catálogo!"
        >
          <div className="space-y-3">
            {orders.map((order: StudentAreaOrder) => (
              <div
                key={order.id}
                className="rounded-xl border border-[#E8E0D5] p-3 bg-[#FAF6F0]/40"
              >
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <span className="text-sm font-semibold text-[#1C1B1A] block">
                      Pedido de {fmtDate(order.created)}
                    </span>
                    <span className="text-[11px] text-[#6B6560]">
                      {order.items.length} item(ns)
                    </span>
                  </div>
                  <div className="text-right">
                    <OrderStatusChip
                      status={order.status as Parameters<typeof OrderStatusChip>[0]['status']}
                    />
                    <strong className="block text-sm font-bold text-[#1C1B1A] font-mono mt-1">
                      {fmtBRL(order.total)}
                    </strong>
                  </div>
                </div>
                <div className="mt-2 space-y-1">
                  {order.items.map((item, idx) => {
                    const extra = formatCustomAnswers(item.custom_answers)
                    return (
                      <div key={idx} className="text-[11px] text-[#6B6560]">
                        <span className="font-semibold text-[#1C1B1A]">
                          {item.quantity}× {item.product_name}
                        </span>
                        {item.variation_label ? ` — ${item.variation_label}` : ''}
                        {extra ? ` • ${extra}` : ''}
                      </div>
                    )
                  })}
                </div>

                {/* Rastreio do pedido (status + etapas do admin, estilo Correios) */}
                <div className="mt-3 pt-3 border-t border-[#E8E0D5]/80">
                  <p className="text-[11px] font-bold text-[#1C1B1A] uppercase tracking-wider font-serif mb-2">
                    Rastreio do pedido
                  </p>
                  <OrderTrackingTimeline
                    statusLog={(order.tracking ?? [])
                      .filter((ev) => ev.kind === 'status')
                      .map((ev) => ({
                        id: `${order.id}-${ev.at}-status`,
                        created: ev.at,
                        from_status: (ev.from_status || '') as OrderStatus | '',
                        to_status: (ev.to_status || 'novo') as OrderStatus,
                        expand: { user: { name: ev.by } },
                      }))}
                    tracking={(order.tracking ?? [])
                      .filter((ev) => ev.kind === 'etapa')
                      .map((ev) => ({
                        id: `${order.id}-${ev.at}-etapa`,
                        created: ev.at,
                        label: ev.label || '',
                        expand: { user: { name: ev.by } },
                      }))}
                    currentStatus={order.status as Parameters<typeof OrderStatusChip>[0]['status']}
                    readOnly
                  />
                </div>
              </div>
            ))}
          </div>
        </SectionCard>

        {/* Presenças por mês */}
        <SectionCard
          title="Presenças"
          icon={<CalendarCheck className="w-4 h-4 text-[#C1272D]" />}
          empty={months.length === 0}
          emptyText="Nenhuma presença registrada ainda. Quando o professor fizer a chamada, seu histórico aparece aqui."
        >
          <div className="space-y-3">
            {months.map((m) => (
              <div key={m.month} className="rounded-xl border border-[#E8E0D5] p-3 bg-[#FAF6F0]/40">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold text-[#1C1B1A] capitalize">
                    {mesPorExtenso(m.month)}
                  </span>
                  <Badge className="text-[10px] font-bold border bg-[#F7E4E2] text-[#C1272D] border-[#C1272D]/20">
                    {m.percentual}% de presença
                  </Badge>
                </div>
                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-[#6B6560]">
                  <span className="text-[#2E7D4F] font-semibold">{m.presencas} presença(s)</span>
                  <span className="text-[#C1272D] font-semibold">{m.ausentes} falta(s)</span>
                  <span>{m.justificados} justificada(s)</span>
                </div>
              </div>
            ))}
          </div>
        </SectionCard>

        {/* Ranking */}
        <SectionCard
          title="Ranking do ano"
          icon={<Trophy className="w-4 h-4 text-[#C1272D]" />}
          empty={data?.rankingPosition == null}
          emptyText="Você ainda não pontuou no ranking deste ano (presenças + competições)."
        >
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-full bg-[#C1272D] text-white flex items-center justify-center font-serif font-bold text-xl shrink-0">
              {data?.rankingPosition}º
            </div>
            <div className="text-xs text-[#6B6560]">
              <p>
                <strong className="text-[#1C1B1A] text-sm font-serif">
                  {data?.rankingPosition}º lugar
                </strong>{' '}
                de {data?.rankingTotal} aluno(s) classificado(s).
              </p>
              <p className="mt-1">
                Com <strong className="text-[#C1272D]">{data?.rankingPoints} ponto(s)</strong> —
                presenças valem 1 ponto cada, além dos pontos de competições e eventos.
              </p>
            </div>
          </div>
        </SectionCard>

        {/* Faixas */}
        <SectionCard
          title="Histórico de faixas"
          icon={<Award className="w-4 h-4 text-[#C1272D]" />}
          empty={beltHistory.length === 0}
          emptyText="Nenhuma promoção registrada ainda. Continue treinando!"
        >
          <div className="divide-y divide-[#E8E0D5]">
            {beltHistory.map((belt, idx) => {
              const pos = BELT_ORDER.indexOf(belt.belt as Belt)
              return (
                <div key={belt.id} className="py-3 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-[#F7E4E2] border border-[#C1272D]/20 flex items-center justify-center font-serif text-[#C1272D] font-bold text-xs shrink-0">
                      {pos >= 0 ? pos + 1 : '?'}
                    </div>
                    <div>
                      <span className="text-sm font-semibold text-[#1C1B1A] block">
                        {beltLabel(belt.belt)}
                      </span>
                      <span className="text-[11px] text-[#6B6560]">
                        Promovido em {fmtDate(belt.promoted_at)}
                        {idx === 0 ? ' • faixa atual' : ''}
                      </span>
                    </div>
                  </div>
                  {typeof belt.exam_score === 'number' && (
                    <Badge
                      className="text-[10px] font-bold border bg-[#F7E4E2] text-[#C1272D] border-[#C1272D]/20 shrink-0"
                      title="Nota do exame de graduação"
                    >
                      Nota {String(belt.exam_score).replace('.', ',')}
                    </Badge>
                  )}
                  {idx === 0 && (
                    <Badge className="text-[10px] font-bold border bg-[#F7E4E2] text-[#C1272D] border-[#C1272D]/20">
                      Atual
                    </Badge>
                  )}
                </div>
              )
            })}
          </div>
        </SectionCard>
      </div>
    </div>
  )
}
