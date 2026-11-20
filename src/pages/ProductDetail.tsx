import React, { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { productsService } from '@/services/products'
import { Product, ProductVariation } from '@/types'
import { useCart } from '@/context/CartContext'
import { ProductPlaceholder } from '@/components/HankoStamp'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  ArrowLeft,
  Plus,
  Minus,
  ShoppingBag,
  ShieldCheck,
  MapPin,
  CreditCard,
  HelpCircle,
  Loader2,
} from 'lucide-react'

export default function ProductDetail() {
  const { slug } = useParams<{ slug: string }>()
  const navigate = useNavigate()
  const { addItem } = useCart()

  const [product, setProduct] = useState<Product | null>(null)
  const [variations, setVariations] = useState<ProductVariation[]>([])
  const [selectedVariation, setSelectedVariation] = useState<ProductVariation | null>(null)
  const [quantity, setQuantity] = useState(1)
  const [related, setRelated] = useState<Product[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isAdding, setIsAdding] = useState(false)

  useEffect(() => {
    if (!slug) return
    loadProduct(slug)
  }, [slug])

  const loadProduct = async (productSlug: string) => {
    setIsLoading(true)
    try {
      const data = await productsService.getBySlug(productSlug)
      if (!data) {
        setProduct(null)
        setIsLoading(false)
        return
      }
      setProduct(data)

      // Load variations
      const vars = await productsService.listVariations(data.id)
      setVariations(vars)
      if (vars.length > 0) {
        setSelectedVariation(vars[0])
      } else {
        setSelectedVariation(null)
      }

      // Load related products
      const rel = await productsService.listRelated(data.category, data.id, 3)
      setRelated(rel)
    } catch (err) {
      console.error('Erro ao buscar produto:', err)
    } finally {
      setIsLoading(false)
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center text-[#6B6560]">
        <Loader2 className="w-8 h-8 animate-spin text-[#C1272D] mb-3" />
        <p className="font-serif text-sm">Carregando detalhes do produto...</p>
      </div>
    )
  }

  if (!product) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <div className="w-16 h-16 rounded-full bg-[#F7E4E2] text-[#C1272D] flex items-center justify-center mx-auto mb-4 font-serif text-2xl font-bold">
          柔
        </div>
        <h2 className="font-serif font-bold text-2xl text-[#1C1B1A]">Produto não encontrado</h2>
        <p className="text-sm text-[#6B6560] mt-2 mb-6">
          O item que você procura pode ter sido removido ou o link está incorreto.
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

  // Calculate final unit price
  const basePrice = product.price
  const delta = selectedVariation ? selectedVariation.price_delta : 0
  const currentUnitPrice = Math.max(0, basePrice + delta)
  const totalPrice = currentUnitPrice * quantity

  const imageUrl = productsService.getImageUrl(product)

  const handleAddToCart = () => {
    setIsAdding(true)
    addItem({
      productId: product.id,
      productName: product.name,
      productSlug: product.slug,
      productImage: imageUrl || undefined,
      category: product.category,
      variationId: selectedVariation?.id,
      variationLabel: selectedVariation?.label,
      unitPrice: currentUnitPrice,
      quantity,
    })

    setTimeout(() => {
      setIsAdding(false)
    }, 200)
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 animate-fade-rise">
      {/* Breadcrumb / Back button */}
      <div className="mb-6">
        <Link
          to="/"
          className="inline-flex items-center text-xs font-semibold text-[#6B6560] hover:text-[#C1272D] transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5 mr-1" />
          Voltar para o catálogo
        </Link>
      </div>

      {/* Main product presentation: 2 columns desktop */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-start">
        {/* Left: Product photo / visual */}
        <div className="bg-white rounded-2xl border border-[#E8E0D5] overflow-hidden shadow-xs relative">
          <div className="aspect-square w-full bg-[#FAF6F0] flex items-center justify-center overflow-hidden">
            {imageUrl ? (
              <img src={imageUrl} alt={product.name} className="w-full h-full object-cover" />
            ) : (
              <ProductPlaceholder name={product.name} className="h-full" />
            )}
          </div>
          <div className="absolute top-4 left-4">
            <Badge className="bg-white/95 text-[#1C1B1A] border border-[#E8E0D5] font-medium text-xs shadow-xs">
              {product.category.toUpperCase()}
            </Badge>
          </div>
        </div>

        {/* Right: Info, Variations & Order CTA */}
        <div className="space-y-6">
          <div>
            <span className="text-xs font-bold text-[#C1272D] tracking-wider uppercase font-serif">
              Judô Tatsu Oficial
            </span>
            <h1 className="font-serif font-bold text-2xl sm:text-3xl lg:text-4xl text-[#1C1B1A] mt-1 leading-tight">
              {product.name}
            </h1>

            {/* Dynamic Price */}
            <div className="mt-4 flex items-baseline gap-3">
              <span className="text-3xl font-bold text-[#C1272D] transition-all">
                {currentUnitPrice.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </span>
              {selectedVariation && selectedVariation.price_delta !== 0 && (
                <span className="text-xs text-[#6B6560]">
                  (Preço base:{' '}
                  {basePrice.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })})
                </span>
              )}
            </div>
          </div>

          <div className="border-t border-[#E8E0D5] pt-4">
            <p className="text-sm text-[#1C1B1A]/80 leading-relaxed font-sans">
              {product.description}
            </p>
          </div>

          {/* Variations selector */}
          {variations.length > 0 && (
            <div className="border-t border-[#E8E0D5] pt-4 space-y-2.5">
              <label className="block text-xs font-bold text-[#1C1B1A] uppercase tracking-wider font-serif">
                Selecione a Opção / Tamanho:
              </label>
              <div className="flex flex-wrap gap-2">
                {variations.map((v) => {
                  const isSelected = selectedVariation?.id === v.id
                  const finalVarPrice = Math.max(0, basePrice + v.price_delta)

                  return (
                    <button
                      key={v.id}
                      onClick={() => setSelectedVariation(v)}
                      className={`px-3.5 py-2 rounded-lg text-xs font-semibold transition-all border flex items-center gap-2 ${
                        isSelected
                          ? 'bg-[#C1272D] text-white border-[#C1272D] shadow-xs'
                          : 'bg-white text-[#1C1B1A] border-[#E8E0D5] hover:border-[#C1272D]/50 hover:bg-[#F7E4E2]/30'
                      }`}
                    >
                      <span>{v.label}</span>
                      {v.price_delta !== 0 && (
                        <span
                          className={`text-[10px] px-1.5 py-0.5 rounded ${
                            isSelected ? 'bg-white/20 text-white' : 'bg-[#FAF6F0] text-[#6B6560]'
                          }`}
                        >
                          {finalVarPrice.toLocaleString('pt-BR', {
                            style: 'currency',
                            currency: 'BRL',
                          })}
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* Quantity Stepper & Add to Cart button */}
          <div className="border-t border-[#E8E0D5] pt-5 space-y-4">
            <div className="flex items-center gap-4">
              <div className="flex items-center border border-[#E8E0D5] rounded-lg bg-white p-1">
                <button
                  onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  disabled={quantity <= 1}
                  className="p-2 text-[#1C1B1A] hover:bg-[#F7E4E2] rounded disabled:opacity-40 transition-colors"
                  aria-label="Diminuir quantidade"
                >
                  <Minus className="w-4 h-4" />
                </button>
                <span className="w-10 text-center font-semibold text-sm select-none">
                  {quantity}
                </span>
                <button
                  onClick={() => setQuantity(Math.min(10, quantity + 1))}
                  disabled={quantity >= 10}
                  className="p-2 text-[#1C1B1A] hover:bg-[#F7E4E2] rounded disabled:opacity-40 transition-colors"
                  aria-label="Aumentar quantidade"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>

              <Button
                onClick={handleAddToCart}
                disabled={isAdding}
                className="flex-1 h-12 bg-[#C1272D] hover:bg-[#A01E23] text-white font-semibold text-sm shadow-md transition-all active:scale-95 flex items-center justify-center gap-2"
              >
                <ShoppingBag className="w-5 h-5" />
                Adicionar ao Carrinho •{' '}
                {totalPrice.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </Button>
            </div>
          </div>

          {/* Fixed Information badges */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
            <div className="p-3 bg-white rounded-xl border border-[#E8E0D5] flex items-center gap-2.5">
              <MapPin className="w-4 h-4 text-[#C1272D] shrink-0" />
              <div className="text-[11px] leading-tight text-[#1C1B1A]">
                <strong>Retirada na academia</strong>
                <span className="text-[#6B6560] block">Sem custo de frete</span>
              </div>
            </div>

            <div className="p-3 bg-white rounded-xl border border-[#E8E0D5] flex items-center gap-2.5">
              <CreditCard className="w-4 h-4 text-[#C9A227] shrink-0" />
              <div className="text-[11px] leading-tight text-[#1C1B1A]">
                <strong>Pagamento Seguro</strong>
                <span className="text-[#6B6560] block">Na entrega ou balcão</span>
              </div>
            </div>

            <div className="p-3 bg-white rounded-xl border border-[#E8E0D5] flex items-center gap-2.5">
              <HelpCircle className="w-4 h-4 text-[#2E7D4F] shrink-0" />
              <div className="text-[11px] leading-tight text-[#1C1B1A]">
                <strong>Dúvidas de Tamanho?</strong>
                <span className="text-[#6B6560] block">Fale com o Sensei</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Related Products */}
      {related.length > 0 && (
        <section className="mt-16 pt-10 border-t border-[#E8E0D5]">
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-serif font-bold text-xl text-[#1C1B1A]">
              Você também pode precisar
            </h3>
            <Link to="/" className="text-xs font-semibold text-[#C1272D] hover:underline">
              Ver todo o catálogo →
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            {related.map((relItem) => {
              const relImage = productsService.getImageUrl(relItem)
              return (
                <Link
                  key={relItem.id}
                  to={`/produto/${relItem.slug}`}
                  className="group bg-white rounded-xl border border-[#E8E0D5] p-4 flex gap-4 items-center hover:shadow-md transition-all"
                >
                  <div className="w-16 h-16 rounded-lg bg-[#FAF6F0] border border-[#E8E0D5] flex items-center justify-center font-serif text-[#C1272D] font-bold shrink-0 overflow-hidden">
                    {relImage ? (
                      <img
                        src={relImage}
                        alt={relItem.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span>柔</span>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h4 className="font-serif font-semibold text-sm text-[#1C1B1A] group-hover:text-[#C1272D] transition-colors truncate">
                      {relItem.name}
                    </h4>
                    <span className="text-xs font-bold text-[#C1272D] mt-1 block">
                      {relItem.price.toLocaleString('pt-BR', {
                        style: 'currency',
                        currency: 'BRL',
                      })}
                    </span>
                  </div>
                </Link>
              )
            })}
          </div>
        </section>
      )}
    </div>
  )
}
