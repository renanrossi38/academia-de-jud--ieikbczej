import React, { useEffect, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { ordersService } from '@/services/orders'
import { Order, OrderItem } from '@/types'
import { OrderStatusChip } from '@/components/OrderStatusChip'
import { HankoStamp } from '@/components/HankoStamp'
import { Button } from '@/components/ui/button'
import { ChevronDown, ChevronUp, ShoppingBag, MapPin, Building, Loader2 } from 'lucide-react'
import pb from '@/lib/pocketbase/client'
import { formatCustomAnswers } from '@/lib/customAnswers'

export default function MyOrders() {
  const { user, isLoading: authLoading } = useAuth()
  const navigate = useNavigate()

  const [orders, setOrders] = useState<Order[]>([])
  const [itemsMap, setItemsMap] = useState<Record<string, OrderItem[]>>({})
  const [expandedOrders, setExpandedOrders] = useState<Record<string, boolean>>({})
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/entrar?redirect=/meus-pedidos')
      return
    }

    if (user) {
      loadOrders()

      // Subscribe to realtime changes on orders collection
      pb.collection('orders').subscribe('*', (e) => {
        if (e.action === 'create' && (e.record as unknown as Order).user === user.id) {
          setOrders((prev) => [e.record as unknown as Order, ...prev])
        } else if (e.action === 'update' && (e.record as unknown as Order).user === user.id) {
          setOrders((prev) =>
            prev.map((o) => (o.id === e.record.id ? (e.record as unknown as Order) : o)),
          )
        } else if (e.action === 'delete') {
          setOrders((prev) => prev.filter((o) => o.id !== e.record.id))
        }
      })
    }

    return () => {
      pb.collection('orders').unsubscribe('*')
    }
  }, [user, authLoading])

  const loadOrders = async () => {
    setIsLoading(true)
    try {
      const data = await ordersService.listUserOrders()
      setOrders(data)
    } catch (err) {
      console.error('Erro ao carregar meus pedidos:', err)
    } finally {
      setIsLoading(false)
    }
  }

  const toggleExpand = async (orderId: string) => {
    setExpandedOrders((prev) => ({ ...prev, [orderId]: !prev[orderId] }))

    if (!itemsMap[orderId]) {
      try {
        const items = await ordersService.getOrderItems(orderId)
        setItemsMap((prev) => ({ ...prev, [orderId]: items }))
      } catch (err) {
        console.error('Erro ao carregar itens do pedido:', err)
      }
    }
  }

  if (authLoading || isLoading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center text-[#6B6560]">
        <Loader2 className="w-8 h-8 animate-spin text-[#C1272D] mb-3" />
        <p className="font-serif text-sm">Carregando seus pedidos...</p>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 animate-fade-rise">
      <div className="mb-8">
        <span className="text-xs font-bold text-[#C1272D] tracking-widest uppercase font-serif">
          Histórico do Aluno
        </span>
        <h1 className="font-serif font-bold text-2xl sm:text-3xl text-[#1C1B1A] mt-1">
          Meus Pedidos
        </h1>
        <p className="text-xs text-[#6B6560] mt-1">
          Acompanhe o andamento dos seus pedidos em tempo real.
        </p>
      </div>

      {orders.length === 0 ? (
        <div className="bg-white rounded-2xl border border-[#E8E0D5] p-10 text-center max-w-md mx-auto">
          <HankoStamp size="lg" kanji="柔" className="mx-auto mb-4" />
          <h3 className="font-serif font-bold text-lg text-[#1C1B1A]">
            Nenhum pedido realizado ainda
          </h3>
          <p className="text-xs text-[#6B6560] mt-1 mb-6">
            Você ainda não registrou nenhum pedido na nossa academia.
          </p>
          <Link to="/">
            <Button className="bg-[#C1272D] hover:bg-[#A01E23] text-white text-xs">
              <ShoppingBag className="w-4 h-4 mr-2" />
              Ver Catálogo
            </Button>
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {orders.map((order) => {
            const isExpanded = !!expandedOrders[order.id]
            const orderItems = itemsMap[order.id] || []
            const dateFormatted = new Date(order.created).toLocaleDateString('pt-BR', {
              day: '2-digit',
              month: '2-digit',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            })

            return (
              <div
                key={order.id}
                className="bg-white rounded-2xl border border-[#E8E0D5] shadow-xs overflow-hidden transition-all"
              >
                {/* Order card header */}
                <div
                  onClick={() => toggleExpand(order.id)}
                  className="p-5 cursor-pointer hover:bg-[#FAF6F0]/40 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                >
                  <div className="flex items-start sm:items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-[#FAF6F0] border border-[#E8E0D5] flex items-center justify-center font-serif text-[#C1272D] font-bold shrink-0">
                      柔
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-sm text-[#1C1B1A]">
                          #{order.id.substring(0, 8)}
                        </span>
                        <OrderStatusChip status={order.status} />
                      </div>
                      <span className="text-xs text-[#6B6560] block mt-0.5">
                        Realizado em {dateFormatted}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-4 border-t sm:border-t-0 pt-2 sm:pt-0 border-[#E8E0D5]">
                    <div className="text-left sm:text-right">
                      <span className="text-[11px] text-[#6B6560] block">Valor Total</span>
                      <strong className="text-base font-bold text-[#C1272D]">
                        {order.total.toLocaleString('pt-BR', {
                          style: 'currency',
                          currency: 'BRL',
                        })}
                      </strong>
                    </div>

                    <div className="p-1 rounded-full text-[#6B6560] hover:text-[#1C1B1A]">
                      {isExpanded ? (
                        <ChevronUp className="w-5 h-5" />
                      ) : (
                        <ChevronDown className="w-5 h-5" />
                      )}
                    </div>
                  </div>
                </div>

                {/* Expanded Details */}
                {isExpanded && (
                  <div className="p-5 border-t border-[#E8E0D5] bg-[#FAF6F0]/30 space-y-4 animate-in slide-in-from-top-1">
                    {/* Items */}
                    <div>
                      <h4 className="text-xs font-bold text-[#1C1B1A] uppercase tracking-wider mb-2 font-serif">
                        Itens do Pedido:
                      </h4>

                      {orderItems.length === 0 ? (
                        <div className="py-2 text-xs text-[#6B6560] flex items-center gap-2">
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          Carregando itens...
                        </div>
                      ) : (
                        <div className="space-y-1.5">
                          {orderItems.map((item) => (
                            <div
                              key={item.id}
                              className="text-xs flex items-center justify-between py-1 border-b border-[#E8E0D5]/50"
                            >
                              <span>
                                <strong>{item.quantity}x</strong> {item.product_name}
                                {item.variation_label && (
                                  <span className="text-[#6B6560]"> ({item.variation_label})</span>
                                )}
                                {formatCustomAnswers(item.custom_answers) && (
                                  <span className="text-[#1C1B1A] italic block pl-2">
                                    {formatCustomAnswers(item.custom_answers)}
                                  </span>
                                )}
                              </span>
                              <span className="font-semibold text-[#1C1B1A]">
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

                    {/* Delivery & notes */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs pt-2">
                      <div className="p-3 bg-white rounded-xl border border-[#E8E0D5]">
                        <span className="font-semibold text-[#1C1B1A] block mb-1">
                          {order.delivery_type === 'retirada'
                            ? 'Retirada na academia'
                            : 'Entrega no Endereço'}
                        </span>
                        <p className="text-[#6B6560]">
                          {order.address || 'Rua da Sakura, 123 — Bairro Central'}
                        </p>
                      </div>

                      <div className="p-3 bg-white rounded-xl border border-[#E8E0D5]">
                        <span className="font-semibold text-[#1C1B1A] block mb-1">Contato</span>
                        <p className="text-[#6B6560]">
                          {order.customer_name} • {order.phone}
                        </p>
                      </div>
                    </div>

                    {order.notes && (
                      <div className="p-3 bg-white rounded-xl border border-[#E8E0D5] text-xs text-[#6B6560]">
                        <strong className="text-[#1C1B1A]">Obs:</strong> {order.notes}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
