import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { productsService } from '@/services/products'
import { Product, ProductCategory } from '@/types'
import { HankoStamp, ProductPlaceholder } from '@/components/HankoStamp'
import { Badge } from '@/components/ui/badge'
import {
  ArrowRight,
  CheckCircle2,
  Shield,
  Sparkles,
  MapPin,
  CreditCard,
  Loader2,
} from 'lucide-react'

const CATEGORIES: { label: string; value: ProductCategory | 'todos' }[] = [
  { label: 'Todos', value: 'todos' },
  { label: 'Uniformes (Gi)', value: 'uniformes' },
  { label: 'Faixas (Obi)', value: 'faixas' },
  { label: 'Equipamentos', value: 'equipamentos' },
  { label: 'Planos & Mensalidades', value: 'planos' },
]

export default function Index() {
  const [products, setProducts] = useState<Product[]>([])
  const [selectedCategory, setSelectedCategory] = useState<ProductCategory | 'todos'>('todos')
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    loadProducts()
  }, [])

  const loadProducts = async () => {
    setIsLoading(true)
    try {
      const data = await productsService.listActive()
      setProducts(data)
    } catch (err) {
      console.error('Erro ao carregar produtos:', err)
    } finally {
      setIsLoading(false)
    }
  }

  const filteredProducts = products.filter((p) => {
    if (selectedCategory === 'todos') return true
    return p.category === selectedCategory
  })

  const getCategoryLabel = (cat: ProductCategory) => {
    switch (cat) {
      case 'uniformes':
        return 'Uniforme / Kimono'
      case 'faixas':
        return 'Faixa / Obi'
      case 'equipamentos':
        return 'Equipamento'
      case 'planos':
        return 'Plano / Treino'
      default:
        return cat
    }
  }

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="relative bg-[#C1272D] text-white py-12 sm:py-16 overflow-hidden">
        {/* Subtle sunburst / concentric circles pattern */}
        <div className="absolute inset-0 bg-sunburst pointer-events-none" />
        <div className="absolute -right-12 -bottom-12 w-64 h-64 rounded-full border-4 border-white/10 pointer-events-none" />
        <div className="absolute -right-24 -bottom-24 w-96 h-96 rounded-full border-4 border-white/5 pointer-events-none" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 flex flex-col md:flex-row items-center justify-between gap-8">
          <div className="max-w-2xl text-center md:text-left">
            <div className="inline-flex items-center gap-2 bg-white/15 px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider mb-4 border border-white/20">
              <Sparkles className="w-3.5 h-3.5" />
              Loja Oficial do Dojo
            </div>
            <h1 className="font-serif font-bold text-3xl sm:text-4xl lg:text-5xl tracking-tight leading-tight">
              Vista-se para o tatame.
            </h1>
            <p className="mt-3 text-base sm:text-lg text-white/90 leading-relaxed font-sans max-w-xl">
              Kimonos reforçados, faixas oficiais, equipamentos de proteção e inscrições nos treinos
              regulares com tradição e honra.
            </p>
            <div className="mt-6 flex flex-wrap items-center justify-center md:justify-start gap-4 text-xs font-medium text-white/80">
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-[#C9A227]" /> Retirada no balcão sem frete
              </span>
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-[#C9A227]" /> Pagamento combinado na entrega
              </span>
            </div>
          </div>

          <div className="shrink-0 flex items-center justify-center">
            <div className="relative p-3 rounded-full bg-white/10 backdrop-blur-xs border border-white/20">
              <div className="w-28 h-28 sm:w-32 sm:h-32 rounded-full bg-white text-[#C1272D] flex flex-col items-center justify-center shadow-2xl font-serif">
                <span className="text-4xl sm:text-5xl font-black leading-none">柔</span>
                <span className="text-[10px] tracking-widest font-bold uppercase mt-1">
                  Dojo Nippon
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Main Content: Filters + Product Grid */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14">
        {/* Category Filter Pills */}
        <div className="flex items-center gap-2 overflow-x-auto pb-4 scrollbar-none">
          {CATEGORIES.map((cat) => {
            const isSelected = selectedCategory === cat.value
            return (
              <button
                key={cat.value}
                onClick={() => setSelectedCategory(cat.value)}
                className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all select-none ${
                  isSelected
                    ? 'bg-[#C1272D] text-white shadow-sm ring-2 ring-[#C1272D]/30'
                    : 'bg-white text-[#1C1B1A] border border-[#E8E0D5] hover:border-[#C1272D]/50 hover:bg-[#F7E4E2]/40'
                }`}
              >
                {cat.label}
              </button>
            )
          })}
        </div>

        {/* Loading state */}
        {isLoading ? (
          <div className="py-20 flex flex-col items-center justify-center text-[#6B6560]">
            <Loader2 className="w-8 h-8 animate-spin text-[#C1272D] mb-3" />
            <p className="font-serif text-sm">Carregando catálogo do dojo...</p>
          </div>
        ) : filteredProducts.length === 0 ? (
          /* Empty state */
          <div className="py-16 text-center bg-white rounded-2xl border border-[#E8E0D5] p-8 max-w-md mx-auto my-6">
            <HankoStamp size="lg" kanji="柔" className="mx-auto mb-4" />
            <h3 className="font-serif font-bold text-lg text-[#1C1B1A]">
              Nenhum produto nesta categoria
            </h3>
            <p className="text-sm text-[#6B6560] mt-1 mb-4">
              Explore outras categorias ou volte para ver todos os itens disponíveis.
            </p>
            <button
              onClick={() => setSelectedCategory('todos')}
              className="text-xs font-semibold text-[#C1272D] hover:underline"
            >
              Ver todos os produtos
            </button>
          </div>
        ) : (
          /* Product Grid */
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mt-6">
            {filteredProducts.map((product) => {
              const imageUrl = productsService.getImageUrl(product)

              return (
                <Link
                  key={product.id}
                  to={`/produto/${product.slug}`}
                  className="group bg-white rounded-xl border border-[#E8E0D5] overflow-hidden shadow-xs hover:shadow-md hover:-translate-y-1 transition-all duration-200 flex flex-col"
                >
                  {/* Image / Graphic Placeholder */}
                  <div className="relative aspect-4/3 w-full bg-[#FAF6F0] overflow-hidden">
                    {imageUrl ? (
                      <img
                        src={imageUrl}
                        alt={product.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    ) : (
                      <ProductPlaceholder name={product.name} className="h-full" />
                    )}

                    <div className="absolute top-3 left-3">
                      <Badge
                        variant="secondary"
                        className="bg-white/90 backdrop-blur-xs text-[#1C1B1A] border border-[#E8E0D5] text-[11px] font-medium"
                      >
                        {getCategoryLabel(product.category)}
                      </Badge>
                    </div>
                  </div>

                  {/* Body */}
                  <div className="p-5 flex-1 flex flex-col justify-between">
                    <div>
                      <h3 className="font-serif font-bold text-lg text-[#1C1B1A] group-hover:text-[#C1272D] transition-colors leading-snug line-clamp-1">
                        {product.name}
                      </h3>
                      <p className="text-xs text-[#6B6560] mt-1.5 line-clamp-2 leading-relaxed">
                        {product.description}
                      </p>
                    </div>

                    <div className="mt-4 pt-3 border-t border-[#E8E0D5] flex items-baseline justify-between">
                      <div>
                        <span className="text-[11px] text-[#6B6560] block">a partir de</span>
                        <span className="font-semibold text-lg text-[#C1272D]">
                          {product.price.toLocaleString('pt-BR', {
                            style: 'currency',
                            currency: 'BRL',
                          })}
                        </span>
                      </div>

                      <span className="text-xs font-semibold text-[#1C1B1A] flex items-center gap-1 group-hover:text-[#C1272D] transition-colors">
                        Ver detalhes
                        <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-1" />
                      </span>
                    </div>
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </section>

      {/* How it works section */}
      <section className="bg-white border-y border-[#E8E0D5] py-14">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-10">
            <span className="text-xs font-bold text-[#C1272D] uppercase tracking-widest font-serif">
              Simples & Transparente
            </span>
            <h2 className="font-serif font-bold text-2xl sm:text-3xl text-[#1C1B1A] mt-1">
              Como funciona o pedido no Dojo
            </h2>
            <p className="text-sm text-[#6B6560] mt-2">
              Faça sua reserva online sem complicações. O pagamento é combinado diretamente com a
              academia.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="flex flex-col items-center text-center p-4">
              <div className="w-12 h-12 rounded-full bg-[#C1272D] text-white flex items-center justify-center font-serif font-bold text-lg mb-4 shadow-sm">
                1
              </div>
              <h3 className="font-serif font-bold text-base text-[#1C1B1A] mb-1">
                Escolha seus itens
              </h3>
              <p className="text-xs text-[#6B6560] leading-relaxed max-w-xs">
                Selecione kimonos no seu tamanho, faixas graduadas, proteções ou seu plano de aulas.
              </p>
            </div>

            <div className="flex flex-col items-center text-center p-4">
              <div className="w-12 h-12 rounded-full bg-[#C1272D] text-white flex items-center justify-center font-serif font-bold text-lg mb-4 shadow-sm">
                2
              </div>
              <h3 className="font-serif font-bold text-base text-[#1C1B1A] mb-1">
                Preencha seus dados
              </h3>
              <p className="text-xs text-[#6B6560] leading-relaxed max-w-xs">
                Informe seu nome, WhatsApp e se prefere retirar no dojo ou receber em seu endereço.
              </p>
            </div>

            <div className="flex flex-col items-center text-center p-4">
              <div className="w-12 h-12 rounded-full bg-[#C1272D] text-white flex items-center justify-center font-serif font-bold text-lg mb-4 shadow-sm">
                3
              </div>
              <h3 className="font-serif font-bold text-base text-[#1C1B1A] mb-1">
                Retire e pague no dojo
              </h3>
              <p className="text-xs text-[#6B6560] leading-relaxed max-w-xs">
                O pedido é reservado imediatamente. Pagamento no balcão via Pix, dinheiro ou cartão
                presencial.
              </p>
            </div>
          </div>

          <div className="mt-8 p-4 rounded-xl bg-[#FAF6F0] border border-[#E8E0D5] max-w-2xl mx-auto flex items-center gap-3 text-xs text-[#6B6560]">
            <Shield className="w-5 h-5 text-[#C9A227] shrink-0" />
            <span>
              <strong>Garantia de ajuste:</strong> se o kimono ou faixa não vestir confortavelmente
              no primeiro treino, trocamos o tamanho diretamente no balcão.
            </span>
          </div>
        </div>
      </section>
    </div>
  )
}
