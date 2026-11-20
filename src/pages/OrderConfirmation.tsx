import React, { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { ordersService } from '@/services/orders'
import { Order, OrderItem } from '@/types'
import { HankoStamp } from '@/components/HankoStamp'
import { Button } from '@/components/ui/button'
import {
  ArrowLeft,
  CheckCircle2,
  ClipboardList,
  MapPin,
  Building,
  Phone,
  Mail,
  Loader2,
} from 'lucide-react'

export default function OrderConfirmation() {
  const { id } = useParams<{ id: string }>()
  const [order, setOrder] = useState<Order | null>(null)
  const [items, setItems] = useState<OrderItem[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (!id) return
    loadOrderDetails(id)
  }, [id])

  const loadOrderDetails = async (orderId: string) => {
    setIsLoading(true)
    try {
      const orderData = await ordersService.getOrderById(orderId)
      if (orderData) {
        setOrder(orderData)
        const itemsData = await ordersService.getOrderItems(orderId)
        setItems(itemsData)
      }
    } catch (err) {
      console.error('Erro ao carregar confirmação do pedido:', err)
    } finally {
      setIsLoading(false)
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center text-[#6B6560]">
        <Loader2 className="w-8 h-8 animate-spin text-[#C1272D] mb-3" />
        <p className="font-serif text-sm">Carregando confirmação do pedido...</p>
      </div>
    )
  }

  if (!order) {
    return (
      <div className="max-w-xl mx-auto px-4 py-20 text-center animate-fade-rise">
        <HankoStamp size="lg" kanji="柔" className="mx-auto mb-4" />
        <h2 className="font-serif font-bold text-2xl text-[#1C1B1A]">Pedido não localizado</h2>
        <p className="text-sm text-[#6B6560] mt-2 mb-6">
          Não conseguimos encontrar este pedido ou ele não pertence à sua conta.
        </p>
        <Link to="/">
          <Button className="bg-[#C1272D] hover:bg-[#A01E23] text-white">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Voltar ao Catálogo
          </Button>
        </Link>
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-16 animate-fade-rise">
      {/* Oriental Certificate Style Card */}
      <div className="bg-white rounded-3xl border-2 border-[#C1272D] p-6 sm:p-10 shadow-xl relative overflow-hidden ring-4 ring-[#FAF6F0] outline-2 outline-[#E8E0D5]">
        {/* Subtle decorative corners */}
        <div className="absolute top-2 left-2 w-4 h-4 border-t-2 border-l-2 border-[#C1272D]" />
        <div className="absolute top-2 right-2 w-4 h-4 border-t-2 border-r-2 border-[#C1272D]" />
        <div className="absolute bottom-2 left-2 w-4 h-4 border-b-2 border-l-2 border-[#C1272D]" />
        <div className="absolute bottom-2 right-2 w-4 h-4 border-b-2 border-r-2 border-[#C1272D]" />

        {/* Hanko Stamp celebration with seal-spin animation */}
        <div className="flex flex-col items-center text-center">
          <div className="p-2 rounded-full border-2 border-[#C1272D]/30 mb-3 bg-[#FAF6F0]">
            <HankoStamp size="xl" kanji="柔" className="animate-seal-spin" />
          </div>

          <span className="text-xs font-bold text-[#C1272D] tracking-widest uppercase font-serif">
            Judô Tatsu — Registro de Pedido
          </span>
          <h1 className="font-serif font-bold text-2xl sm:text-3xl text-[#1C1B1A] mt-1">
            Pedido Registrado com Sucesso!
          </h1>
          <p className="text-sm text-[#6B6560] mt-1">
            Número de registro:{' '}
            <span className="font-mono font-bold text-[#C1272D]">#{order.id.substring(0, 8)}</span>
          </p>
        </div>

        {/* Business notification note */}
        <div className="mt-6 p-4 rounded-xl bg-[#F7E4E2]/60 border border-[#C1272D]/20 text-xs text-[#1C1B1A] space-y-1 text-center sm:text-left">
          <p className="font-semibold text-[#C1272D] flex items-center justify-center sm:justify-start gap-1.5">
            <Mail className="w-4 h-4" />
            Aviso para o negócio enviado com sucesso
          </p>
          <p className="text-[#6B6560] leading-relaxed">
            A academia recebeu uma notificação com o resumo da sua solicitação. Entraremos em
            contato pelo telefone/WhatsApp informado ({order.phone}) para confirmar a
            disponibilidade e combinar o pagamento.
          </p>
        </div>

        {/* Order status banner */}
        <div className="mt-6 p-3 rounded-lg bg-[#FAF6F0] border border-[#E8E0D5] flex items-center justify-between text-xs">
          <span className="text-[#6B6560]">Status atual:</span>
          <span className="px-2.5 py-1 rounded-full font-bold bg-[#F7E4E2] text-[#C1272D] uppercase tracking-wider text-[11px]">
            {order.status === 'novo' ? 'Novo — Aguardando Confirmação' : order.status}
          </span>
        </div>

        {/* Items summary */}
        <div className="mt-6 border-t border-[#E8E0D5] pt-6">
          <h3 className="font-serif font-bold text-base text-[#1C1B1A] mb-3">Resumo dos Itens</h3>

          <div className="divide-y divide-[#E8E0D5]">
            {items.map((item) => (
              <div
                key={item.id}
                className="py-3 flex items-center justify-between text-xs sm:text-sm"
              >
                <div>
                  <strong className="text-[#1C1B1A] block">{item.product_name}</strong>
                  {item.variation_label && (
                    <span className="text-[#6B6560] text-xs block">{item.variation_label}</span>
                  )}
                  <span className="text-[#6B6560] text-xs">
                    {item.quantity}x{' '}
                    {item.unit_price.toLocaleString('pt-BR', {
                      style: 'currency',
                      currency: 'BRL',
                    })}
                  </span>
                </div>
                <span className="font-semibold text-[#1C1B1A]">
                  {item.subtotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </span>
              </div>
            ))}
          </div>

          <div className="mt-4 pt-4 border-t border-[#E8E0D5] flex items-center justify-between text-base">
            <strong className="text-[#1C1B1A] font-serif">Total Geral:</strong>
            <strong className="text-xl font-bold text-[#C1272D]">
              {order.total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
            </strong>
          </div>
        </div>

        {/* Delivery / Pickup Details */}
        <div className="mt-6 border-t border-[#E8E0D5] pt-6 grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div className="p-3 bg-[#FAF6F0] rounded-xl border border-[#E8E0D5]">
            <span className="font-serif font-bold text-[#1C1B1A] block mb-1">Destinatário</span>
            <p className="text-[#6B6560]">
              <strong>Nome:</strong> {order.customer_name}
              <br />
              <strong>Telefone:</strong> {order.phone}
            </p>
          </div>

          <div className="p-3 bg-[#FAF6F0] rounded-xl border border-[#E8E0D5]">
            <span className="font-serif font-bold text-[#1C1B1A] block mb-1">
              Forma de Recebimento
            </span>
            <p className="text-[#6B6560]">
              <strong>Tipo:</strong>{' '}
              {order.delivery_type === 'retirada'
                ? 'Retirada no balcão da academia'
                : 'Entrega em domicílio'}
              <br />
              {order.address && (
                <>
                  <strong>Local:</strong> {order.address}
                </>
              )}
            </p>
          </div>
        </div>

        {order.notes && (
          <div className="mt-4 p-3 bg-[#FAF6F0] rounded-xl border border-[#E8E0D5] text-xs text-[#6B6560]">
            <strong className="text-[#1C1B1A] block mb-0.5">Observações:</strong>
            {order.notes}
          </div>
        )}

        {/* Action Buttons */}
        <div className="mt-8 pt-6 border-t border-[#E8E0D5] flex flex-col sm:flex-row gap-3">
          <Link to="/meus-pedidos" className="flex-1">
            <Button
              variant="outline"
              className="w-full h-11 border-[#1C1B1A] text-[#1C1B1A] hover:bg-[#FAF6F0] font-semibold text-xs"
            >
              <ClipboardList className="w-4 h-4 mr-2" />
              Acompanhar Meus Pedidos
            </Button>
          </Link>
          <Link to="/" className="flex-1">
            <Button className="w-full h-11 bg-[#C1272D] hover:bg-[#A01E23] text-white font-semibold text-xs">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Voltar ao Catálogo
            </Button>
          </Link>
        </div>
      </div>
    </div>
  )
}
