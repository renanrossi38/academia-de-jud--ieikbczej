import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { ordersService } from '@/services/orders'
import { orderTrackingService } from '@/services/orderTracking'
import { Order, OrderItem, OrderStatus, OrderStatusLog, OrderTrackingStep } from '@/types'
import { formatCustomAnswers } from '@/lib/customAnswers'
import { OrderStatusChip } from '@/components/OrderStatusChip'
import { OrderTrackingTimeline } from '@/components/orderTrackingTimeline/OrderTrackingTimeline'
import {
  AdminPageHeader,
  AdminSummary,
  AdminEmptyState,
  AdminPageLoader,
  AdminRowActions,
} from '@/components/admin/AdminPage'
import { useToast } from '@/hooks/use-toast'
import { useRealtime } from '@/hooks/use-realtime'
import {
  Loader2,
  X,
  MessageSquare,
  ShoppingBag,
  Filter,
  CheckCircle2,
  Plus,
  Package,
} from 'lucide-react'
import { cn } from '@/lib/utils'

const STATUS_FILTERS: { label: string; value: OrderStatus | 'todos' }[] = [
  { label: 'Todos', value: 'todos' },
  { label: 'Novo', value: 'novo' },
  { label: 'Confirmado', value: 'confirmado' },
  { label: 'Em preparação', value: 'em_preparacao' },
  { label: 'Pronto', value: 'pronto' },
  { label: 'Entregue', value: 'entregue' },
  { label: 'Cancelado', value: 'cancelado' },
]

const STATUS_LABELS: Record<OrderStatus, string> = {
  novo: 'Novo',
  confirmado: 'Confirmado',
  em_preparacao: 'Em preparação',
  pronto: 'Pronto',
  entregue: 'Entregue',
  cancelado: 'Cancelado',
}

/** Nome do comprador exibido: quando a conta foi excluída, "Aluno removido". */
function buyerName(order: Order): { name: string; removed: boolean } {
  if (order.expand?.user?.name) return { name: order.expand.user.name, removed: false }
  if (order.user) return { name: order.customer_name, removed: false }
  return { name: 'Aluno removido', removed: true }
}

function fmtDateTime(iso: string): string {
  const d = new Date(iso)
  return (
    d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) +
    ' às ' +
    d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  )
}

export default function AdminOrders() {
  const { user, isAdmin, isLoading: authLoading } = useAuth()
  const navigate = useNavigate()
  const { toast } = useToast()

  const [orders, setOrders] = useState<Order[]>([])
  const [selectedStatus, setSelectedStatus] = useState<OrderStatus | 'todos'>('todos')
  const [isLoading, setIsLoading] = useState(true)

  // Drawer for order detail
  const [activeOrder, setActiveOrder] = useState<Order | null>(null)
  const [activeOrderItems, setActiveOrderItems] = useState<OrderItem[]>([])
  const [activeOrderLog, setActiveOrderLog] = useState<OrderStatusLog[]>([])
  const [activeOrderTracking, setActiveOrderTracking] = useState<OrderTrackingStep[]>([])
  const [drawerLoading, setDrawerLoading] = useState(false)
  const [updatingStatus, setUpdatingStatus] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [newStepLabel, setNewStepLabel] = useState('')
  const [addingStep, setAddingStep] = useState(false)
  const [deletingStepId, setDeletingStepId] = useState<string | null>(null)

  const loadOrders = useCallback(async () => {
    setIsLoading(true)
    try {
      const data = await ordersService.listAllOrders()
      setOrders(data)
    } catch (err) {
      console.error('Erro ao carregar lista de pedidos do painel:', err)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!authLoading) {
      if (!user) {
        navigate('/entrar?redirect=/painel/pedidos')
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

      loadOrders()
    }
  }, [user, isAdmin, authLoading, loadOrders, toast])

  // Realtime: orders
  useRealtime<Order>(
    'orders',
    (e) => {
      if (e.action === 'create') {
        setOrders((prev) => [{ ...e.record } as Order, ...prev])
        toast({
          title: 'Novo pedido recebido!',
          description: `Cliente: ${e.record.customer_name}`,
        })
      } else if (e.action === 'update') {
        // O registro do realtime não vem com expand — preserva o expand=user
        // (nome/e-mail do comprador) que a listagem já carregou.
        setOrders((prev) =>
          prev.map((o) =>
            o.id === e.record.id ? ({ ...e.record, expand: o.expand } as Order) : o,
          ),
        )
        setActiveOrder((cur) =>
          cur && cur.id === e.record.id ? ({ ...e.record, expand: cur.expand } as Order) : cur,
        )
      } else if (e.action === 'delete') {
        setOrders((prev) => prev.filter((o) => o.id !== e.record.id))
        setActiveOrder((cur) => (cur && cur.id === e.record.id ? null : cur))
      }
    },
    !!user && isAdmin && !authLoading,
  )

  // Realtime: log de etapas do pedido aberto no drawer
  useRealtime<OrderStatusLog>(
    'order_status_log',
    (e) => {
      if (!activeOrder || e.record.order !== activeOrder.id) return
      if (e.action === 'create') {
        setActiveOrderLog((prev) => [...prev, { ...e.record } as OrderStatusLog])
      }
    },
    !!activeOrder,
  )

  // Realtime: etapas de rastreio personalizadas (order_tracking) do pedido aberto
  useRealtime<OrderTrackingStep>(
    'order_tracking',
    (e) => {
      if (!activeOrder || e.record.order !== activeOrder.id) return
      if (e.action === 'create') {
        setActiveOrderTracking((prev) =>
          prev.some((t) => t.id === e.record.id)
            ? prev
            : [...prev, { ...e.record } as OrderTrackingStep],
        )
      } else if (e.action === 'delete') {
        setActiveOrderTracking((prev) => prev.filter((t) => t.id !== e.record.id))
      }
    },
    !!activeOrder,
  )

  const handleOpenDetail = async (order: Order) => {
    setActiveOrder(order)
    setDrawerLoading(true)
    setActiveOrderLog([])
    setActiveOrderTracking([])
    try {
      const [items, log, tracking] = await Promise.all([
        ordersService.getOrderItems(order.id),
        ordersService.listStatusLog(order.id),
        orderTrackingService.listByOrder(order.id),
      ])
      setActiveOrderItems(items)
      setActiveOrderLog(log)
      setActiveOrderTracking(tracking)
    } catch (err) {
      console.error('Erro ao carregar detalhes do pedido:', err)
    } finally {
      setDrawerLoading(false)
    }
  }

  /** Admin: adiciona etapa de rastreio personalizada (ex.: "Em produção"). */
  const handleAddTrackingStep = async () => {
    if (!activeOrder) return
    const label = newStepLabel.trim()
    if (label.length < 2) {
      toast({
        title: 'Descreva a etapa',
        description: 'Escreva o texto da etapa (ex.: "Encomendado na fábrica").',
        variant: 'destructive',
      })
      return
    }
    setAddingStep(true)
    try {
      await orderTrackingService.addStep(activeOrder.id, label)
      setNewStepLabel('')
      toast({ title: 'Etapa de rastreio adicionada' })
    } catch (err: any) {
      console.error('Erro ao adicionar etapa de rastreio:', err)
      toast({
        title: 'Erro ao adicionar etapa',
        description: err?.message || 'Falha ao salvar no servidor.',
        variant: 'destructive',
      })
    } finally {
      setAddingStep(false)
    }
  }

  /** Admin: remove uma etapa registrada por engano (com confirmação). */
  const handleDeleteTrackingStep = async (trackingId: string, label: string) => {
    if (!activeOrder) return
    if (!window.confirm(`Remover a etapa "${label}" do rastreio deste pedido?`)) return
    setDeletingStepId(trackingId)
    try {
      await orderTrackingService.removeStep(trackingId)
      setActiveOrderTracking((prev) => prev.filter((t) => t.id !== trackingId))
      toast({ title: 'Etapa removida do rastreio' })
    } catch (err: any) {
      console.error('Erro ao remover etapa de rastreio:', err)
      toast({
        title: 'Erro ao remover etapa',
        description: err?.message || 'Falha ao salvar no servidor.',
        variant: 'destructive',
      })
    } finally {
      setDeletingStepId(null)
    }
  }

  const handleUpdateStatus = async (orderId: string, newStatus: OrderStatus) => {
    setUpdatingStatus(orderId)
    try {
      await ordersService.updateOrderStatus(orderId, newStatus)
      toast({
        title: 'Status atualizado com sucesso',
        description: `Status alterado para: ${STATUS_LABELS[newStatus]}`,
      })
    } catch (err: any) {
      console.error('Erro ao atualizar status:', err)
      toast({
        title: 'Erro ao alterar status',
        description: err?.message || 'Falha ao salvar no servidor.',
        variant: 'destructive',
      })
    } finally {
      setUpdatingStatus(null)
    }
  }

  const handleDeleteOrder = async (order: Order) => {
    if (
      !window.confirm(
        `Excluir o pedido #${order.id.substring(0, 8)} de ${buyerName(order).name}? Essa ação não pode ser desfeita.`,
      )
    ) {
      return
    }
    setDeletingId(order.id)
    try {
      await ordersService.deleteOrder(order.id)
      toast({ title: 'Pedido excluído' })
    } catch (err: any) {
      console.error('Erro ao excluir pedido:', err)
      toast({
        title: 'Erro ao excluir pedido',
        description: err?.message || 'Falha ao salvar no servidor.',
        variant: 'destructive',
      })
    } finally {
      setDeletingId(null)
    }
  }

  if (authLoading || isLoading) {
    return <AdminPageLoader label="Carregando pedidos..." />
  }

  // Filtered list
  const filteredOrders = orders.filter((o) => {
    if (selectedStatus === 'todos') return true
    return o.status === selectedStatus
  })

  // Status counts
  const countsByStatus = orders.reduce(
    (acc, order) => {
      acc[order.status] = (acc[order.status] || 0) + 1
      return acc
    },
    {} as Record<string, number>,
  )

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 animate-fade-rise">
      <AdminPageHeader
        title="Pedidos"
        breadcrumb="Pedidos"
        breadcrumbTo="/painel/pedidos"
        description="Gerencie e atualize os pedidos dos alunos em tempo real."
      />

      <AdminSummary
        stats={[
          {
            label: 'Total de pedidos',
            value: orders.length,
            icon: <ShoppingBag className="w-4 h-4" />,
          },
          {
            label: 'Novos (aguardando)',
            value: countsByStatus['novo'] || 0,
            icon: <Filter className="w-4 h-4" />,
            tone: 'red',
          },
          {
            label: 'Em preparação',
            value: countsByStatus['em_preparacao'] || 0,
            icon: <Loader2 className="w-4 h-4" />,
          },
          {
            label: 'Entregues',
            value: countsByStatus['entregue'] || 0,
            icon: <CheckCircle2 className="w-4 h-4" />,
            tone: 'green',
          },
        ]}
      />

      {/* Status Filter Chips */}
      <div className="flex items-center gap-2 overflow-x-auto pb-4 scrollbar-none">
        {STATUS_FILTERS.map((f) => {
          const isSelected = selectedStatus === f.value
          const count = f.value === 'todos' ? orders.length : countsByStatus[f.value] || 0

          return (
            <button
              key={f.value}
              onClick={() => setSelectedStatus(f.value)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 border select-none ${
                isSelected
                  ? 'bg-[#C1272D] text-white border-[#C1272D] shadow-xs'
                  : 'bg-white text-[#1C1B1A] border-[#E8E0D5] hover:border-[#C1272D]/40'
              }`}
            >
              <span>{f.label}</span>
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                  isSelected ? 'bg-white/25 text-white' : 'bg-[#FAF6F0] text-[#6B6560]'
                }`}
              >
                {count}
              </span>
            </button>
          )
        })}
      </div>

      {/* Orders View: Desktop Table / Mobile Cards */}
      {filteredOrders.length === 0 ? (
        <AdminEmptyState
          title="Nenhum pedido por aqui"
          description={
            selectedStatus === 'todos'
              ? 'Nenhum pedido foi registrado ainda. Assim que um aluno finalizar a compra na loja, ele aparece aqui automaticamente.'
              : 'Não existem pedidos com esse status. Troque o filtro acima para ver os outros pedidos.'
          }
        />
      ) : (
        <div className="bg-white rounded-2xl border border-[#E8E0D5] shadow-xs overflow-hidden">
          {/* Desktop Table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-[#E8E0D5] bg-[#FAF6F0]/60 text-[#6B6560] font-serif uppercase tracking-wider text-[11px]">
                  <th className="py-3 px-4">Nº Pedido</th>
                  <th className="py-3 px-4">Cliente / Contato</th>
                  <th className="py-3 px-4">Recebimento</th>
                  <th className="py-3 px-4">Data</th>
                  <th className="py-3 px-4">Total</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E8E0D5]">
                {filteredOrders.map((order) => {
                  const dateFormatted = new Date(order.created).toLocaleDateString('pt-BR', {
                    day: '2-digit',
                    month: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit',
                  })
                  const buyer = buyerName(order)

                  return (
                    <tr
                      key={order.id}
                      className="hover:bg-[#FAF6F0]/50 transition-colors cursor-pointer"
                      onClick={() => handleOpenDetail(order)}
                    >
                      <td className="py-3.5 px-4 font-mono font-bold text-[#1C1B1A]">
                        #{order.id.substring(0, 8)}
                      </td>
                      <td className="py-3.5 px-4">
                        {buyer.removed ? (
                          <span className="inline-flex items-center gap-1.5">
                            <strong className="text-[#8A8580] block italic">Aluno removido</strong>
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[#F5F5F5] text-[#8A8580] border border-[#8A8580]/20">
                              conta excluída
                            </span>
                          </span>
                        ) : (
                          <strong className="text-[#1C1B1A] block">{buyer.name}</strong>
                        )}
                        <span className="text-[#6B6560] text-[11px]">{order.phone}</span>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="text-[#1C1B1A] font-medium capitalize">
                          {order.delivery_type === 'retirada' ? 'Retirada na academia' : 'Entrega'}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-[#6B6560]">{dateFormatted}</td>
                      <td className="py-3.5 px-4 font-bold text-[#C1272D]">
                        {order.total.toLocaleString('pt-BR', {
                          style: 'currency',
                          currency: 'BRL',
                        })}
                      </td>
                      <td className="py-3.5 px-4" onClick={(e) => e.stopPropagation()}>
                        <select
                          value={order.status}
                          disabled={updatingStatus === order.id}
                          onChange={(e) =>
                            handleUpdateStatus(order.id, e.target.value as OrderStatus)
                          }
                          className="text-xs font-semibold py-1 px-2 rounded-md border border-[#E8E0D5] bg-white text-[#1C1B1A] focus:outline-hidden focus:ring-1 focus:ring-[#C1272D]"
                        >
                          {Object.entries(STATUS_LABELS).map(([value, label]) => (
                            <option key={value} value={value}>
                              {label}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="py-3.5 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                        <AdminRowActions>
                          <button
                            onClick={() => handleOpenDetail(order)}
                            className="text-[11px] font-semibold text-[#1C1B1A] border border-[#E8E0D5] rounded-md px-2 py-1 hover:border-[#C1272D]/40"
                          >
                            Detalhes
                          </button>
                          <button
                            onClick={() => handleDeleteOrder(order)}
                            disabled={deletingId === order.id}
                            className="text-[11px] font-semibold text-[#C1272D] border border-[#C1272D]/40 rounded-md px-2 py-1 hover:bg-[#C1272D]/5 disabled:opacity-50"
                          >
                            {deletingId === order.id ? 'Excluindo…' : 'Excluir'}
                          </button>
                        </AdminRowActions>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile Stacked Cards */}
          <div className="md:hidden divide-y divide-[#E8E0D5]">
            {filteredOrders.map((order) => {
              const dateFormatted = new Date(order.created).toLocaleDateString('pt-BR', {
                day: '2-digit',
                month: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
              })
              const buyer = buyerName(order)

              return (
                <div
                  key={order.id}
                  onClick={() => handleOpenDetail(order)}
                  className="p-4 space-y-3 hover:bg-[#FAF6F0]/40 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-bold text-xs text-[#1C1B1A]">
                      #{order.id.substring(0, 8)}
                    </span>
                    <OrderStatusChip status={order.status} />
                  </div>

                  <div>
                    <h4
                      className={cn(
                        'font-semibold text-sm',
                        buyer.removed ? 'text-[#8A8580] italic' : 'text-[#1C1B1A]',
                      )}
                    >
                      {buyer.name}
                    </h4>
                    <span className="text-xs text-[#6B6560]">
                      {order.phone} • {order.delivery_type === 'retirada' ? 'Retirada' : 'Entrega'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-[#E8E0D5] text-xs">
                    <span className="text-[#6B6560]">{dateFormatted}</span>
                    <strong className="text-sm font-bold text-[#C1272D]">
                      {order.total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </strong>
                  </div>

                  <div
                    className="pt-1 flex items-center justify-between gap-2"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <label className="text-[11px] text-[#6B6560]">Status:</label>
                    <select
                      value={order.status}
                      disabled={updatingStatus === order.id}
                      onChange={(e) => handleUpdateStatus(order.id, e.target.value as OrderStatus)}
                      className="text-xs font-semibold py-1 px-2 rounded-md border border-[#E8E0D5] bg-white text-[#1C1B1A]"
                    >
                      {Object.entries(STATUS_LABELS).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                    <button
                      onClick={() => handleDeleteOrder(order)}
                      disabled={deletingId === order.id}
                      className="text-[11px] font-semibold text-[#C1272D] disabled:opacity-50"
                    >
                      {deletingId === order.id ? 'Excluindo…' : 'Excluir'}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Drawer: Detailed Order Side Panel */}
      {activeOrder && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div
            className="fixed inset-0 bg-black/40 backdrop-blur-xs"
            onClick={() => setActiveOrder(null)}
          />

          <div className="relative w-full max-w-lg bg-white h-full shadow-2xl flex flex-col z-10 animate-in slide-in-from-right duration-250 border-l border-[#E8E0D5]">
            {/* Header */}
            <div className="p-4 border-b border-[#E8E0D5] flex items-center justify-between bg-[#FAF6F0]">
              <div>
                <span className="text-[10px] font-bold text-[#C1272D] uppercase tracking-wider font-serif">
                  Detalhes do Pedido
                </span>
                <h3 className="font-serif font-bold text-lg text-[#1C1B1A]">
                  #{activeOrder.id.substring(0, 8)}
                </h3>
              </div>
              <button
                onClick={() => setActiveOrder(null)}
                className="p-1 rounded-full text-[#6B6560] hover:text-[#1C1B1A]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-5 space-y-5">
              {/* Quick Status updater */}
              <div className="p-3 bg-[#FAF6F0] rounded-xl border border-[#E8E0D5] flex flex-wrap items-center justify-between gap-2">
                <div>
                  <span className="text-[11px] text-[#6B6560] block">Status Atual:</span>
                  <OrderStatusChip status={activeOrder.status} className="mt-1" />
                </div>

                <div className="text-right">
                  <span className="text-[11px] text-[#6B6560] block mb-1">Mudar para:</span>
                  <select
                    value={activeOrder.status}
                    disabled={updatingStatus === activeOrder.id}
                    onChange={(e) =>
                      handleUpdateStatus(activeOrder.id, e.target.value as OrderStatus)
                    }
                    className="text-xs font-semibold py-1 px-2 rounded-md border border-[#E8E0D5] bg-white text-[#1C1B1A]"
                  >
                    {Object.entries(STATUS_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Customer info & WhatsApp CTA */}
              <div className="p-4 rounded-xl border border-[#E8E0D5] space-y-2 text-xs">
                <span className="font-serif font-bold text-xs text-[#1C1B1A] uppercase tracking-wider block">
                  Dados do Aluno
                </span>
                <p>
                  <strong>Nome:</strong>{' '}
                  {buyerName(activeOrder).removed ? (
                    <em className="text-[#8A8580]">Aluno removido</em>
                  ) : (
                    buyerName(activeOrder).name
                  )}
                </p>
                <p className="flex items-center gap-2">
                  <strong>Telefone:</strong> {activeOrder.phone}
                  <a
                    href={`https://wa.me/${activeOrder.phone.replace(/\D/g, '')}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-[11px] bg-[#2E7D4F] text-white px-2 py-0.5 rounded hover:bg-[#23603d] font-semibold"
                  >
                    <MessageSquare className="w-3 h-3" />
                    Abrir WhatsApp
                  </a>
                </p>
                <p>
                  <strong>Recebimento:</strong>{' '}
                  {activeOrder.delivery_type === 'retirada'
                    ? 'Retirada presencial na academia'
                    : 'Entrega em domicílio'}
                </p>
                {activeOrder.address && (
                  <p>
                    <strong>Endereço:</strong> {activeOrder.address}
                  </p>
                )}
                {activeOrder.notes && (
                  <div className="pt-2 border-t border-[#E8E0D5] text-[#6B6560]">
                    <strong>Observações do cliente:</strong> {activeOrder.notes}
                  </div>
                )}
              </div>

              {/* Itens */}
              <div>
                <h4 className="font-serif font-bold text-sm text-[#1C1B1A] mb-2 uppercase tracking-wider">
                  Itens Comprados
                </h4>

                {drawerLoading ? (
                  <div className="py-6 flex items-center justify-center text-[#6B6560] text-xs">
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    Carregando itens do pedido...
                  </div>
                ) : (
                  <div className="divide-y divide-[#E8E0D5] border border-[#E8E0D5] rounded-xl overflow-hidden bg-white">
                    {activeOrderItems.map((item) => (
                      <div key={item.id} className="p-3 text-xs flex justify-between items-center">
                        <div>
                          <strong className="text-[#1C1B1A] block">{item.product_name}</strong>
                          {item.variation_label && (
                            <span className="text-[#6B6560] block">{item.variation_label}</span>
                          )}
                          {formatCustomAnswers(item.custom_answers) && (
                            <span className="text-[#1C1B1A] block italic">
                              {formatCustomAnswers(item.custom_answers)}
                            </span>
                          )}
                          <span className="text-[#6B6560]">
                            {item.quantity} un. x{' '}
                            {item.unit_price.toLocaleString('pt-BR', {
                              style: 'currency',
                              currency: 'BRL',
                            })}
                          </span>
                        </div>
                        <span className="font-bold text-sm text-[#1C1B1A]">
                          {item.subtotal.toLocaleString('pt-BR', {
                            style: 'currency',
                            currency: 'BRL',
                          })}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Rastreio do pedido (timeline estilo Correios) */}
              <div>
                <h4 className="font-serif font-bold text-sm text-[#1C1B1A] mb-2 uppercase tracking-wider flex items-center gap-2">
                  <Package className="w-4 h-4 text-[#C1272D]" />
                  Rastreio do Pedido
                </h4>

                {drawerLoading ? (
                  <div className="py-4 text-[#6B6560] text-xs flex items-center">
                    <Loader2 className="w-3 h-3 animate-spin mr-2" />
                    Carregando rastreio...
                  </div>
                ) : (
                  <OrderTrackingTimeline
                    statusLog={activeOrderLog}
                    tracking={activeOrderTracking}
                    currentStatus={activeOrder.status}
                    onDeleteStep={handleDeleteTrackingStep}
                    deletingStepId={deletingStepId}
                    emptyText="Nenhum evento ainda. Mude o status ou registre uma etapa de rastreio abaixo (ex.: “Encomendado na fábrica”)."
                  />
                )}

                {/* Admin: adicionar etapa de rastreio personalizada */}
                <form
                  onSubmit={(e) => {
                    e.preventDefault()
                    handleAddTrackingStep()
                  }}
                  className="mt-3 flex items-start gap-2"
                >
                  <input
                    type="text"
                    value={newStepLabel}
                    onChange={(e) => setNewStepLabel(e.target.value)}
                    maxLength={200}
                    placeholder='Nova etapa (ex.: "Encomendado na fábrica")'
                    className="flex-1 min-w-0 text-xs rounded-lg border border-[#E8E0D5] bg-white px-3 py-2 text-[#1C1B1A] placeholder:text-[#A8A099] focus:outline-none focus:ring-1 focus:ring-[#C1272D]"
                  />
                  <button
                    type="submit"
                    disabled={addingStep || newStepLabel.trim().length < 2}
                    className="inline-flex items-center gap-1 text-xs font-semibold bg-[#C1272D] text-white rounded-lg px-3 py-2 hover:bg-[#A51E24] disabled:opacity-50 shrink-0"
                  >
                    {addingStep ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Plus className="w-3.5 h-3.5" />
                    )}
                    Etapa
                  </button>
                </form>
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-[#E8E0D5] bg-[#FAF6F0] flex items-center justify-between gap-3">
              <div>
                <span className="text-sm font-semibold text-[#1C1B1A]">Total do Pedido:</span>
                <span className="text-xl font-bold text-[#C1272D] ml-2">
                  {activeOrder.total.toLocaleString('pt-BR', {
                    style: 'currency',
                    currency: 'BRL',
                  })}
                </span>
              </div>
              <button
                onClick={() => handleDeleteOrder(activeOrder)}
                disabled={deletingId === activeOrder.id}
                className="text-xs font-semibold text-[#C1272D] border border-[#C1272D]/40 rounded-lg px-3 py-1.5 hover:bg-[#C1272D]/5 disabled:opacity-50"
              >
                {deletingId === activeOrder.id ? 'Excluindo…' : 'Excluir pedido'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
