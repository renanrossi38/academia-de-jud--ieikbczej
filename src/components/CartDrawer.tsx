import React from 'react'
import { useCart } from '@/context/CartContext'
import { Button } from '@/components/ui/button'
import { BrushDivider } from '@/components/hero/HeroDecor'
import { X, Trash2, Plus, Minus, ShoppingBag, ArrowRight } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'

export const CartDrawer: React.FC = () => {
  const { isDrawerOpen, setIsDrawerOpen, items, updateQuantity, removeItem, total, itemCount } =
    useCart()
  const navigate = useNavigate()

  if (!isDrawerOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Overlay */}
      <div
        className="fixed inset-0 bg-black/40 backdrop-blur-xs transition-opacity duration-200"
        onClick={() => setIsDrawerOpen(false)}
      />

      {/* Drawer */}
      <div className="relative w-full max-w-md bg-white h-full shadow-2xl flex flex-col z-10 animate-in slide-in-from-right duration-250 border-l border-[#E8E0D5]">
        {/* Header */}
        <div className="p-4 border-b border-[#E8E0D5] flex items-center justify-between bg-[#FAF6F0] relative overflow-hidden">
          {/* Traço de pincel vermelho na base do cabeçalho do carrinho (identidade do folder) */}
          <div
            className="absolute bottom-0 left-0 right-0 h-1.5 text-[#C1272D] pointer-events-none"
            aria-hidden
          >
            <BrushDivider className="w-full h-full" preserveAspectRatio="none" />
          </div>
          <div className="flex items-center gap-2">
            <ShoppingBag className="w-5 h-5 text-[#C1272D]" />
            <h2 className="font-serif font-bold text-lg text-[#1C1B1A]">Seu Carrinho</h2>
            <span className="text-xs bg-[#F7E4E2] text-[#C1272D] font-bold px-2 py-0.5 rounded-full">
              {itemCount} {itemCount === 1 ? 'item' : 'itens'}
            </span>
          </div>
          <button
            onClick={() => setIsDrawerOpen(false)}
            className="p-1 rounded-full text-[#6B6560] hover:text-[#1C1B1A] hover:bg-[#E8E0D5]/50 transition-colors"
            aria-label="Fechar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Item list */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {items.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-6 text-[#6B6560]">
              <div className="w-16 h-16 rounded-full bg-[#F7E4E2] flex items-center justify-center text-[#C1272D] mb-3">
                <ShoppingBag className="w-8 h-8" />
              </div>
              <p className="font-serif font-semibold text-lg text-[#1C1B1A] mb-1">
                Seu carrinho está vazio
              </p>
              <p className="text-sm mb-4">Explore os kimonos, faixas e planos do nosso catálogo.</p>
              <Button
                variant="outline"
                className="border-[#C1272D] text-[#C1272D] hover:bg-[#F7E4E2]"
                onClick={() => {
                  setIsDrawerOpen(false)
                  navigate('/')
                }}
              >
                Ver Catálogo
              </Button>
            </div>
          ) : (
            items.map((item) => (
              <div
                key={`${item.productId}-${item.variationId || 'base'}`}
                className="p-3 border border-[#E8E0D5] rounded-xl flex items-start gap-3 bg-[#FAF6F0]/40 transition-all"
              >
                {/* Visual miniature */}
                <div className="w-14 h-14 rounded-lg bg-[#F7E4E2] border border-[#E8E0D5] flex items-center justify-center font-serif text-[#C1272D] font-bold text-lg shrink-0 overflow-hidden">
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
                  <h4 className="font-semibold text-sm text-[#1C1B1A] truncate">
                    {item.productName}
                  </h4>
                  {item.variationLabel && (
                    <p className="text-xs text-[#6B6560] mt-0.5 truncate">{item.variationLabel}</p>
                  )}
                  <p className="text-xs font-semibold text-[#C1272D] mt-1">
                    {item.unitPrice.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </p>

                  {/* Quantity Stepper */}
                  <div className="flex items-center gap-2 mt-2">
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
                      <span className="px-2 text-xs font-semibold select-none">
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

                    <span className="text-xs font-medium text-[#6B6560] ml-auto">
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
                  className="p-1 text-[#6B6560] hover:text-[#B3261E] rounded transition-colors"
                  title="Remover item"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))
          )}
        </div>

        {/* Footer with subtotal and checkout buttons */}
        {items.length > 0 && (
          <div className="p-4 border-t border-[#E8E0D5] bg-[#FAF6F0] space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-[#6B6560]">Subtotal:</span>
              <span className="font-semibold text-base text-[#1C1B1A]">
                {total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </span>
            </div>
            <div className="text-xs text-[#6B6560]">
              * Pagamento combinado na retirada ou entrega (dinheiro, Pix ou cartão presencial).
            </div>

            <div className="grid grid-cols-2 gap-2 pt-1">
              <Button
                variant="outline"
                className="border-[#1C1B1A] text-[#1C1B1A] hover:bg-white"
                onClick={() => {
                  setIsDrawerOpen(false)
                  navigate('/carrinho')
                }}
              >
                Ver Carrinho
              </Button>
              <Button
                className="bg-[#C1272D] hover:bg-[#A01E23] text-white flex items-center justify-center gap-1.5"
                onClick={() => {
                  setIsDrawerOpen(false)
                  navigate('/carrinho')
                }}
              >
                Fechar Pedido
                <ArrowRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
