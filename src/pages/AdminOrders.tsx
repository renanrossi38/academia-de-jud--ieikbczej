import React, { useEffect, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { ordersService } from '@/services/orders'
import { Order, OrderItem, OrderStatus } from '@/types'
import { OrderStatusChip } from '@/components/OrderStatusChip'
import { HankoStamp } from '@/components/HankoStamp'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/hooks/use-toast'
import {
  ShieldAlert,
  Loader2,
  X,
  ExternalLink,
  MessageSquare,
  Building,
  MapPin,
  Calendar,
  Phone,
  User,
  ShoppingBag,
  Filter,
} from 'lucide-react'
import pb from '@/lib/pocketbase/client'

const STATUS_FILTERS: { label: string; value: OrderStatus | 'todos' }[] = [
  { label: 'Todos', value: 'todos' },
  { label: 'Novo', value: 'novo' },
  { label: 'Confirmado', value: 'confirmado' },
  { label: 'Em preparação', value: 'em_preparacao' },
  { label: 'Pronto', value: 'pronto' },
  { label: 'Entregue', value: 'entregue' },
  { label: 'Cancelado', value: 'cancelado' },
]

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
  const [drawerLoading, setDrawerLoading] = useState(false)
  const [updatingStatus, setUpdatingStatus] = useState<string | null>(null)

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

      // Realtime subscription on orders
      pb.collection('orders').subscribe('*', (e) => {
        if (e.action === 'create') {
          setOrders((prev) => [e.record as unknown as Order, ...prev])
          toast({
            title: 'Novo pedido recebido!',
            description: `Cliente: ${(e.record as any).customer_name}`,
          })
        } else if (e.action === 'update') {
          setOrders((prev) =>
            prev.map((o) => (o.id === e.record.id ? (e.record as unknown as Order) : o)),
          )
          if (activeOrder && activeOrder.id === e.record.id) {
            setActiveOrder(e.record as unknown as Order)
          }
        } else if (e.action === 'delete') {
          setOrders((prev) => prev.filter((o) => o.id !== e.record.id))
          if (activeOrder && activeOrder.id === e.record.id) {
            setActiveOrder(null)
          }
        }
      })
    }

    return () => {
      pb.collection('orders').unsubscribe('*')
    }
  }, [user, isAdmin, authLoading])

  const loadOrders = async () => {
    setIsLoading(true)
    try {
      const data = await ordersService.listAllOrders()
      setOrders(data)
    } catch (err) {
      console.error('Erro ao carregar lista de pedidos do painel:', err)
    } finally {
      setIsLoading(false)
    }
  }

  const handleOpenDetail = async (order: Order) => {
    setActiveOrder(order)
    setDrawerLoading(true)
    try {
      const items = await ordersService.getOrderItems(order.id)
      setActiveOrderItems(items)
    } catch (err) {
      console.error('Erro ao carregar itens do drawer:', err)
    } finally {
      setDrawerLoading(false)
    }
  }

  const handleUpdateStatus = async (orderId: string, newStatus: OrderStatus) => {
    setUpdatingStatus(orderId)
    try {
      await ordersService.updateOrderStatus(orderId, newStatus)
      toast({
        title: 'Status atualizado com sucesso',
        description: `Status alterado para: ${newStatus}`,
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

  if (authLoading || isLoading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center text-[#6B6560]">
        <Loader2 className="w-8 h-8 animate-spin text-[#C1272D] mb-3" />
        <p className="font-serif text-sm">Carregando painel de pedidos...</p>
      </div>
    )
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
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <div className="flex items-center gap-2">
            <HankoStamp size="sm" />
            <span className="text-xs font-bold text-[#C1272D] tracking-widest uppercase font-serif">
              Administração do Judô Tatsu
            </span>
          </div>
          <h1 className="font-serif font-bold text-2xl sm:text-3xl text-[#1C1B1A] mt-1">
            Painel de Pedidos
          </h1>
          <p className="text-xs text-[#6B6560] mt-1">
            Gerencie e atualize os pedidos dos alunos em tempo real.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Badge className="bg-[#FAF6F0] text-[#1C1B1A] border-[#E8E0D5] text-xs font-semibold px-3 py-1">
            Total de Pedidos: {orders.length}
          </Badge>
        </div>
      </div>

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
        <div className="bg-white rounded-2xl border border-[#E8E0D5] p-12 text-center max-w-md mx-auto my-6">
          <HankoStamp size="lg" kanji="柔" className="mx-auto mb-4" />
          <h3 className="font-serif font-bold text-lg text-[#1C1B1A]">Nenhum pedido por aqui</h3>
          <p className="text-xs text-[#6B6560] mt-1">
            {selectedStatus === 'todos'
              ? 'Nenhum pedido foi registrado ainda no sistema.'
              : `Não existem pedidos com status "${selectedStatus}".`}
          </p>
        </div>
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
                        <strong className="text-[#1C1B1A] block">{order.customer_name}</strong>
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
                          <option value="novo">Novo</option>
                          <option value="confirmado">Confirmado</option>
                          <option value="em_preparacao">Em preparação</option>
                          <option value="pronto">Pronto</option>
                          <option value="entregue">Entregue</option>
                          <option value="cancelado">Cancelado</option>
                        </select>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            handleOpenDetail(order)
                          }}
                          className="text-[#C1272D] hover:underline font-semibold text-xs"
                        >
                          Ver Detalhes
                        </button>
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
                    <h4 className="font-semibold text-sm text-[#1C1B1A]">{order.customer_name}</h4>
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
                      <option value="novo">Novo</option>
                      <option value="confirmado">Confirmado</option>
                      <option value="em_preparacao">Em preparação</option>
                      <option value="pronto">Pronto</option>
                      <option value="entregue">Entregue</option>
                      <option value="cancelado">Cancelado</option>
                    </select>
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
              <div className="p-3 bg-[#FAF6F0] rounded-xl border border-[#E8E0D5] flex items-center justify-between">
                <div>
                  <span className="text-[11px] text-[#6B6560] block">Status Atual:</span>
                  <OrderStatusChip status={activeOrder.status} className="mt-1" />
                </div>

                <div className="text-right">
                  <span className="text-[11px] text-[#6B6560] block mb-1">Mudar para:</span>
                  <select
                    value={activeOrder.status}
                    onChange={(e) =>
                      handleUpdateStatus(activeOrder.id, e.target.value as OrderStatus)
                    }
                    className="text-xs font-semibold py-1 px-2 rounded-md border border-[#E8E0D5] bg-white text-[#1C1B1A]"
                  >
                    <option value="novo">Novo</option>
                    <option value="confirmado">Confirmado</option>
                    <option value="em_preparacao">Em preparação</option>
                    <option value="pronto">Pronto</option>
                    <option value="entregue">Entregue</option>
                    <option value="cancelado">Cancelado</option>
                  </select>
                </div>
              </div>

              {/* Customer info & WhatsApp CTA */}
              <div className="p-4 rounded-xl border border-[#E8E0D5] space-y-2 text-xs">
                <span className="font-serif font-bold text-xs text-[#1C1B1A] uppercase tracking-wider block">
                  Dados do Aluno
                </span>
                <p>
                  <strong>Nome:</strong> {activeOrder.customer_name}
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

              {/* Items List */}
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
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-[#E8E0D5] bg-[#FAF6F0] flex items-center justify-between">
              <span className="text-sm font-semibold text-[#1C1B1A]">Total do Pedido:</span>
              <span className="text-xl font-bold text-[#C1272D]">
                {activeOrder.total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
