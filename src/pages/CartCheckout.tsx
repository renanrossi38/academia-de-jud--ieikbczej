import React, { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useCart } from '@/context/CartContext'
import { useAuth } from '@/context/AuthContext'
import { ordersService } from '@/services/orders'
import { DeliveryType } from '@/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/hooks/use-toast'
import {
  Trash2,
  Plus,
  Minus,
  MapPin,
  Building,
  ShoppingBag,
  ArrowRight,
  ShieldCheck,
  Check,
  Loader2,
  LogIn,
} from 'lucide-react'

export default function CartCheckout() {
  const { items, updateQuantity, removeItem, clearCart, total, itemCount } = useCart()
  const { user } = useAuth()
  const navigate = useNavigate()
  const { toast } = useToast()

  const [deliveryType, setDeliveryType] = useState<DeliveryType>('retirada')
  const [customerName, setCustomerName] = useState(user?.name || '')
  const [phone, setPhone] = useState('')
  const [street, setStreet] = useState('')
  const [number, setNumber] = useState('')
  const [neighborhood, setNeighborhood] = useState('')
  const [city, setCity] = useState('')
  const [notes, setNotes] = useState('')

  const [errors, setErrors] = useState<Record<string, string>>({})
  const [isSubmitting, setIsSubmitting] = useState(false)

  // If user signs in mid-session, update name if empty
  React.useEffect(() => {
    if (user?.name && !customerName) {
      setCustomerName(user.name)
    }
  }, [user])

  const validate = () => {
    const newErrors: Record<string, string> = {}

    if (!customerName.trim()) {
      newErrors.customerName = 'Por favor, informe seu nome completo.'
    }

    if (!phone.trim()) {
      newErrors.phone = 'Informe seu telefone / WhatsApp para combinarmos a entrega/retirada.'
    } else if (phone.trim().length < 8) {
      newErrors.phone = 'Telefone inválido.'
    }

    if (deliveryType === 'entrega') {
      if (!street.trim()) newErrors.street = 'Informe o endereço / rua.'
      if (!number.trim()) newErrors.number = 'Informe o número.'
      if (!neighborhood.trim()) newErrors.neighborhood = 'Informe o bairro.'
      if (!city.trim()) newErrors.city = 'Informe a cidade.'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleCheckout = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!user) {
      toast({
        title: 'Login necessário',
        description: 'Faça login ou crie sua conta para registrar seu pedido.',
      })
      navigate('/entrar?redirect=/carrinho')
      return
    }

    if (items.length === 0) {
      toast({
        title: 'Carrinho vazio',
        description: 'Adicione pelo menos um item para registrar o pedido.',
        variant: 'destructive',
      })
      return
    }

    if (!validate()) {
      toast({
        title: 'Verifique os dados informados',
        description: 'Preencha os campos obrigatórios em destaque.',
        variant: 'destructive',
      })
      return
    }

    setIsSubmitting(true)
    try {
      const fullAddress =
        deliveryType === 'entrega'
          ? `${street}, ${number} - ${neighborhood}, ${city}`
          : 'Retirada na academia (Rua da Sakura, 123 — Bairro Central)'

      const order = await ordersService.createOrder({
        customer_name: customerName.trim(),
        phone: phone.trim(),
        delivery_type: deliveryType,
        address: fullAddress,
        notes: notes.trim(),
        items: items.map((item) => ({
          productId: item.productId,
          productName: item.productName,
          variationId: item.variationId,
          variationLabel: item.variationLabel,
          unitPrice: item.unitPrice,
          quantity: item.quantity,
        })),
      })

      clearCart()
      toast({
        title: 'Pedido registrado com sucesso!',
        description: `Número do pedido #${order.id.substring(0, 8)}`,
      })
      navigate(`/pedido/${order.id}/confirmacao`)
    } catch (err: any) {
      console.error('Erro ao finalizar pedido:', err)
      toast({
        title: 'Erro ao processar pedido',
        description: err?.message || 'Ocorreu um erro no servidor. Tente novamente.',
        variant: 'destructive',
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  if (items.length === 0) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-20 text-center animate-fade-rise">
        <div className="w-20 h-20 rounded-full bg-[#F7E4E2] text-[#C1272D] flex items-center justify-center mx-auto mb-5 font-serif text-3xl font-bold shadow-xs">
          柔
        </div>
        <h2 className="font-serif font-bold text-2xl sm:text-3xl text-[#1C1B1A]">
          Seu carrinho está vazio
        </h2>
        <p className="text-sm text-[#6B6560] mt-2 mb-8 max-w-md mx-auto">
          Adicione kimonos, faixas, proteções ou inscrições em nossos planos para finalizar seu
          pedido.
        </p>
        <Link to="/">
          <Button className="bg-[#C1272D] hover:bg-[#A01E23] text-white px-6 h-12 text-sm font-semibold">
            <ShoppingBag className="w-4 h-4 mr-2" />
            Explorar Catálogo
          </Button>
        </Link>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
      <div className="mb-8">
        <span className="text-xs font-bold text-[#C1272D] tracking-widest uppercase font-serif">
          Finalização do Pedido
        </span>
        <h1 className="font-serif font-bold text-2xl sm:text-3xl text-[#1C1B1A] mt-1">
          Carrinho & Dados de Entrega
        </h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Items List (7 cols desktop) */}
        <div className="lg:col-span-7 space-y-4">
          <div className="bg-white rounded-2xl border border-[#E8E0D5] p-5 shadow-xs">
            <div className="flex items-center justify-between pb-4 border-b border-[#E8E0D5]">
              <h2 className="font-serif font-bold text-base text-[#1C1B1A]">
                Itens selecionados ({itemCount})
              </h2>
              <button
                onClick={clearCart}
                className="text-xs text-[#6B6560] hover:text-[#B3261E] transition-colors"
              >
                Limpar carrinho
              </button>
            </div>

            <div className="divide-y divide-[#E8E0D5]">
              {items.map((item) => (
                <div
                  key={`${item.productId}-${item.variationId || 'base'}`}
                  className="py-4 flex gap-4 items-center"
                >
                  <div className="w-16 h-16 rounded-xl bg-[#FAF6F0] border border-[#E8E0D5] flex items-center justify-center font-serif text-[#C1272D] font-bold text-xl shrink-0 overflow-hidden">
                    {item.productImage ? (
                      <img
                        src={item.productImage}
                        alt={item.productName}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span>柔</span>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <h3 className="font-serif font-semibold text-sm text-[#1C1B1A] truncate">
                      {item.productName}
                    </h3>
                    {item.variationLabel && (
                      <p className="text-xs text-[#6B6560] mt-0.5">{item.variationLabel}</p>
                    )}
                    <p className="text-xs font-bold text-[#C1272D] mt-1">
                      {item.unitPrice.toLocaleString('pt-BR', {
                        style: 'currency',
                        currency: 'BRL',
                      })}
                    </p>

                    <div className="flex items-center gap-3 mt-2">
                      <div className="flex items-center border border-[#E8E0D5] rounded-md bg-white">
                        <button
                          onClick={() =>
                            updateQuantity(item.productId, item.variationId, item.quantity - 1)
                          }
                          className="p-1 hover:bg-[#F7E4E2] text-[#1C1B1A] rounded-l-md transition-colors"
                          aria-label="Diminuir"
                        >
                          <Minus className="w-3.5 h-3.5" />
                        </button>
                        <span className="px-2.5 text-xs font-semibold select-none">
                          {item.quantity}
                        </span>
                        <button
                          onClick={() =>
                            updateQuantity(item.productId, item.variationId, item.quantity + 1)
                          }
                          className="p-1 hover:bg-[#F7E4E2] text-[#1C1B1A] rounded-r-md transition-colors"
                          aria-label="Aumentar"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <span className="text-xs font-medium text-[#1C1B1A]">
                        Subtotal:{' '}
                        {(item.unitPrice * item.quantity).toLocaleString('pt-BR', {
                          style: 'currency',
                          currency: 'BRL',
                        })}
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={() => removeItem(item.productId, item.variationId)}
                    className="p-2 text-[#6B6560] hover:text-[#B3261E] rounded-md hover:bg-[#F7E4E2] transition-colors"
                    title="Remover"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="p-4 bg-[#FAF6F0] rounded-xl border border-[#E8E0D5] text-xs text-[#6B6560] flex items-center gap-3">
            <ShieldCheck className="w-5 h-5 text-[#2E7D4F] shrink-0" />
            <span>
              Ao concluir o pedido, você receberá a confirmação com o número e resumo. O pagamento é
              realizado apenas presencialmente (na retirada ou entrega).
            </span>
          </div>
        </div>

        {/* Right Column: Checkout Form & Total (5 cols desktop) */}
        <div className="lg:col-span-5">
          <form
            onSubmit={handleCheckout}
            className="bg-white rounded-2xl border border-[#E8E0D5] p-6 shadow-xs space-y-5"
          >
            <h2 className="font-serif font-bold text-lg text-[#1C1B1A] pb-3 border-b border-[#E8E0D5]">
              Dados do Pedido
            </h2>

            {/* Auth Notice if not logged in */}
            {!user && (
              <div className="p-3.5 bg-[#F7E4E2] border border-[#C1272D]/30 rounded-xl text-xs text-[#1C1B1A] flex items-start gap-2.5">
                <LogIn className="w-4 h-4 text-[#C1272D] shrink-0 mt-0.5" />
                <div>
                  <strong className="block text-[#C1272D]">Identificação necessária</strong>
                  Você pode preencher seus dados agora; ao clicar em finalizar, solicitaremos o
                  login ou criação da conta (seu carrinho não será perdido).
                </div>
              </div>
            )}

            {/* Customer Name */}
            <div>
              <label className="block text-xs font-bold text-[#1C1B1A] uppercase tracking-wider mb-1 font-serif">
                Nome Completo *
              </label>
              <Input
                type="text"
                placeholder="Ex.: Takeshi Yamada"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                className={
                  errors.customerName ? 'border-[#B3261E] focus-visible:ring-[#B3261E]' : ''
                }
              />
              {errors.customerName && (
                <p className="text-xs text-[#B3261E] mt-1">{errors.customerName}</p>
              )}
            </div>

            {/* Phone */}
            <div>
              <label className="block text-xs font-bold text-[#1C1B1A] uppercase tracking-wider mb-1 font-serif">
                Telefone / WhatsApp *
              </label>
              <Input
                type="tel"
                placeholder="Ex.: (11) 98765-4321"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className={errors.phone ? 'border-[#B3261E] focus-visible:ring-[#B3261E]' : ''}
              />
              {errors.phone && <p className="text-xs text-[#B3261E] mt-1">{errors.phone}</p>}
            </div>

            {/* Delivery Type Option Cards */}
            <div>
              <label className="block text-xs font-bold text-[#1C1B1A] uppercase tracking-wider mb-2 font-serif">
                Forma de Recebimento *
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setDeliveryType('retirada')}
                  className={`p-3.5 rounded-xl border text-left transition-all ${
                    deliveryType === 'retirada'
                      ? 'border-[#C1272D] bg-[#F7E4E2]/40 ring-2 ring-[#C1272D]/20'
                      : 'border-[#E8E0D5] hover:border-[#1C1B1A]'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <Building className="w-4 h-4 text-[#C1272D]" />
                    {deliveryType === 'retirada' && <Check className="w-4 h-4 text-[#C1272D]" />}
                  </div>
                  <strong className="block text-xs text-[#1C1B1A]">Retirar na academia</strong>
                  <span className="text-[11px] text-[#6B6560] block mt-0.5">Sem frete</span>
                </button>

                <button
                  type="button"
                  onClick={() => setDeliveryType('entrega')}
                  className={`p-3.5 rounded-xl border text-left transition-all ${
                    deliveryType === 'entrega'
                      ? 'border-[#C1272D] bg-[#F7E4E2]/40 ring-2 ring-[#C1272D]/20'
                      : 'border-[#E8E0D5] hover:border-[#1C1B1A]'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <MapPin className="w-4 h-4 text-[#C1272D]" />
                    {deliveryType === 'entrega' && <Check className="w-4 h-4 text-[#C1272D]" />}
                  </div>
                  <strong className="block text-xs text-[#1C1B1A]">Receber em casa</strong>
                  <span className="text-[11px] text-[#6B6560] block mt-0.5">Entrega local</span>
                </button>
              </div>
            </div>

            {/* Address fields (if delivery) */}
            {deliveryType === 'entrega' ? (
              <div className="space-y-3 p-4 bg-[#FAF6F0] rounded-xl border border-[#E8E0D5] animate-fade-rise">
                <span className="text-xs font-bold text-[#1C1B1A] font-serif block">
                  Endereço para Entrega
                </span>

                <div className="grid grid-cols-3 gap-2">
                  <div className="col-span-2">
                    <label className="text-[11px] text-[#6B6560] block mb-1">
                      Rua / Logradouro *
                    </label>
                    <Input
                      placeholder="Rua das Acácias"
                      value={street}
                      onChange={(e) => setStreet(e.target.value)}
                      className={errors.street ? 'border-[#B3261E]' : ''}
                    />
                    {errors.street && (
                      <p className="text-[11px] text-[#B3261E] mt-0.5">{errors.street}</p>
                    )}
                  </div>
                  <div>
                    <label className="text-[11px] text-[#6B6560] block mb-1">Número *</label>
                    <Input
                      placeholder="100"
                      value={number}
                      onChange={(e) => setNumber(e.target.value)}
                      className={errors.number ? 'border-[#B3261E]' : ''}
                    />
                    {errors.number && (
                      <p className="text-[11px] text-[#B3261E] mt-0.5">{errors.number}</p>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[11px] text-[#6B6560] block mb-1">Bairro *</label>
                    <Input
                      placeholder="Centro"
                      value={neighborhood}
                      onChange={(e) => setNeighborhood(e.target.value)}
                      className={errors.neighborhood ? 'border-[#B3261E]' : ''}
                    />
                    {errors.neighborhood && (
                      <p className="text-[11px] text-[#B3261E] mt-0.5">{errors.neighborhood}</p>
                    )}
                  </div>
                  <div>
                    <label className="text-[11px] text-[#6B6560] block mb-1">Cidade *</label>
                    <Input
                      placeholder="São Paulo"
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      className={errors.city ? 'border-[#B3261E]' : ''}
                    />
                    {errors.city && (
                      <p className="text-[11px] text-[#B3261E] mt-0.5">{errors.city}</p>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-3 bg-[#FAF6F0] rounded-xl border border-[#E8E0D5] text-xs text-[#6B6560]">
                📍 <strong>Local de retirada:</strong> Rua da Sakura, 123 — Bairro Central (Horário
                de treino: Seg a Sex, das 07h às 21h30).
              </div>
            )}

            {/* Notes */}
            <div>
              <label className="block text-xs font-bold text-[#1C1B1A] uppercase tracking-wider mb-1 font-serif">
                Observações (Opcional)
              </label>
              <Textarea
                rows={2}
                placeholder="Ex.: Pagarei no cartão de crédito na retirada / Horário de preferência..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>

            {/* Total and CTA */}
            <div className="border-t border-[#E8E0D5] pt-4 space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-[#6B6560]">Total do Pedido:</span>
                <span className="font-bold text-2xl text-[#C1272D]">
                  {total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </span>
              </div>
              <p className="text-[11px] text-[#6B6560]">
                * O pagamento é combinado diretamente com a academia (Pix, dinheiro ou cartão na
                entrega/retirada).
              </p>

              <Button
                type="submit"
                disabled={isSubmitting}
                className="w-full h-12 bg-[#C1272D] hover:bg-[#A01E23] text-white font-bold text-sm shadow-md transition-all flex items-center justify-center gap-2"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Registrando Pedido...
                  </>
                ) : (
                  <>
                    Finalizar Pedido
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
