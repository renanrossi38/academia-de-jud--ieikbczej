import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import pb from '@/lib/pocketbase/client'
import { productsService } from '@/services/products'
import { classLevelLabel, classLevelBadgeClass } from '@/services/classes'
import { Product, ProductCategory, Class } from '@/types'
import { HankoStamp, ProductPlaceholder } from '@/components/HankoStamp'
import { Badge } from '@/components/ui/badge'
import {
  ArrowRight,
  CheckCircle2,
  Shield,
  Sparkles,
  Loader2,
  Clock,
  Users,
  CalendarDays,
} from 'lucide-react'

type HomeTab = 'turmas' | 'kimonos'

/** Categorias exibidas na aba "Kimonos e Acessórios" (sem equipamentos/planos). */
const SHOP_CATEGORIES: { label: string; value: ProductCategory | 'todos' }[] = [
  { label: 'Todos', value: 'todos' },
  { label: 'Uniformes (Gi)', value: 'uniformes' },
  { label: 'Faixas (Obi)', value: 'faixas' },
  { label: 'Camisetas', value: 'camisetas' },
]

const getCategoryLabel = (cat: ProductCategory): string => {
  switch (cat) {
    case 'uniformes':
      return 'Uniforme / Kimono'
    case 'faixas':
      return 'Faixa / Obi'
    case 'camisetas':
      return 'Camiseta'
    case 'equipamentos':
      return 'Equipamento'
    case 'planos':
      return 'Plano / Treino'
    default:
      return cat
  }
}

/** Horário plausível quando a turma não tem o campo preenchido. */
const scheduleOf = (c: Class): string =>
  c.schedule && c.schedule.trim() !== '' ? c.schedule : 'Consulte os horários no dojo'

/** Mensalidade plausível quando a turma não tem o campo preenchido. */
const feeOf = (c: Class): number =>
  typeof c.monthly_fee === 'number' && c.monthly_fee > 0 ? c.monthly_fee : 0

const money = (v: number): string =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

export default function Index() {
  const [activeTab, setActiveTab] = useState<HomeTab>('turmas')

  const [classes, setClasses] = useState<Class[]>([])
  const [classesLoading, setClassesLoading] = useState(true)

  const [products, setProducts] = useState<Product[]>([])
  const [productsLoading, setProductsLoading] = useState(false)
  const [productsLoaded, setProductsLoaded] = useState(false)
  const [selectedCategory, setSelectedCategory] = useState<ProductCategory | 'todos'>('todos')

  useEffect(() => {
    // A aba de turmas é a inicial: produtos carregam só quando ela abre.
    loadClasses()
  }, [])

  useEffect(() => {
    if (activeTab === 'kimonos' && !productsLoaded) {
      loadProducts()
    }
  }, [activeTab])

  const loadClasses = async () => {
    setClassesLoading(true)
    try {
      // Regra pública: visitante só recebe turmas ativas.
      const data = await pb.collection('classes').getFullList<Class>({
        filter: 'active = true',
        sort: 'level',
      })
      setClasses(data)
    } catch (err) {
      console.error('Erro ao carregar turmas:', err)
    } finally {
      setClassesLoading(false)
    }
  }

  const loadProducts = async () => {
    setProductsLoading(true)
    try {
      const data = await productsService.listActive()
      // Mantém só kimonos, faixas e camisetas (exclui equipamentos e planos).
      const shopItems = data.filter((p) =>
        (['uniformes', 'faixas', 'camisetas'] as ProductCategory[]).includes(p.category),
      )
      setProducts(shopItems)
      setProductsLoaded(true)
    } catch (err) {
      console.error('Erro ao carregar produtos:', err)
    } finally {
      setProductsLoading(false)
    }
  }

  const filteredProducts = products.filter((p) => {
    if (selectedCategory === 'todos') return true
    return p.category === selectedCategory
  })

  const tabClass = (tab: HomeTab) =>
    `flex-1 sm:flex-none sm:min-w-[220px] px-4 sm:px-6 py-3.5 rounded-xl text-sm sm:text-base font-semibold font-serif transition-all flex items-center justify-center gap-2 select-none ${
      activeTab === tab
        ? 'bg-[#C1272D] text-white shadow-sm ring-2 ring-[#C1272D]/25'
        : 'bg-white text-[#1C1B1A] border border-[#E8E0D5] hover:border-[#C1272D]/50 hover:bg-[#F7E4E2]/40'
    }`

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="relative bg-[#C1272D] text-white py-12 sm:py-16 overflow-hidden">
        {/* Círculos concêntricos sutis (padrão de sol nascente) */}
        <div className="absolute -right-12 -bottom-12 w-64 h-64 rounded-full border-4 border-white/10 pointer-events-none" />
        <div className="absolute -right-24 -bottom-24 w-96 h-96 rounded-full border-4 border-white/5 pointer-events-none" />
        <div className="absolute -left-16 -top-16 w-48 h-48 rounded-full border-4 border-white/5 pointer-events-none" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 flex flex-col md:flex-row items-center justify-between gap-8">
          <div className="max-w-2xl text-center md:text-left">
            <div className="inline-flex items-center gap-2 bg-white/15 px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider mb-4 border border-white/20">
              <Sparkles className="w-3.5 h-3.5" />
              Bem-vindo ao Dojo Nippon
            </div>
            <h1 className="font-serif font-bold text-3xl sm:text-4xl lg:text-5xl tracking-tight leading-tight">
              Vista-se para o tatame.
            </h1>
            <p className="mt-3 text-base sm:text-lg text-white/90 leading-relaxed font-sans max-w-xl">
              Conheça nossas turmas, escolha um horário para começar e adquira seu kimono, faixa e
              acessórios oficiais com tradição e honra.
            </p>
            <div className="mt-6 flex flex-wrap items-center justify-center md:justify-start gap-4 text-xs font-medium text-white/80">
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4" /> Aulas para todas as idades
              </span>
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4" /> Matrícula aberta todo mês
              </span>
            </div>
          </div>

          <div className="shrink-0 flex items-center justify-center">
            <div className="p-3 rounded-full bg-white/10 backdrop-blur-xs border border-white/20">
              {/* Selo hanko com o kanji do dojo (componente já existente) */}
              <HankoStamp size="xl" className="bg-white text-[#C1272D] !ring-white/40" />
            </div>
          </div>
        </div>
      </section>

      {/* Abas: Turmas | Kimonos e Acessórios */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 sm:pt-10">
        <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 max-w-2xl mx-auto">
          <button onClick={() => setActiveTab('turmas')} className={tabClass('turmas')}>
            <Users className="w-4 h-4" />
            Turmas
          </button>
          <button onClick={() => setActiveTab('kimonos')} className={tabClass('kimonos')}>
            <Sparkles className="w-4 h-4" />
            Kimonos e Acessórios
          </button>
        </div>
      </section>

      {/* ===== Aba Turmas ===== */}
      {activeTab === 'turmas' && (
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-12">
          {classesLoading ? (
            <div className="py-20 flex flex-col items-center justify-center text-[#6B6560]">
              <Loader2 className="w-8 h-8 animate-spin text-[#C1272D] mb-3" />
              <p className="font-serif text-sm">Carregando turmas do dojo...</p>
            </div>
          ) : classes.length === 0 ? (
            <div className="py-16 text-center bg-white rounded-2xl border border-[#E8E0D5] p-8 max-w-md mx-auto my-6">
              <HankoStamp size="lg" className="mx-auto mb-4" />
              <h3 className="font-serif font-bold text-lg text-[#1C1B1A]">
                Nenhuma turma ativa no momento
              </h3>
              <p className="text-sm text-[#6B6560] mt-1">
                Fale com a recepção para conhecer os horários disponíveis.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {classes.map((c) => (
                <div
                  key={c.id}
                  className="bg-white rounded-2xl border border-[#E8E0D5] shadow-xs hover:shadow-md transition-all duration-200 flex flex-col overflow-hidden"
                >
                  {/* Faixa superior vermelha com o selo do dojo */}
                  <div className="relative bg-[#C1272D] h-20 flex items-center justify-center overflow-hidden">
                    <div className="absolute inset-0 opacity-20 bg-[radial-gradient(white_1px,transparent_1px)] [background-size:14px_14px] pointer-events-none" />
                    <HankoStamp size="md" className="bg-white text-[#C1272D] !ring-white/40" />
                  </div>

                  <div className="p-5 flex-1 flex flex-col">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-serif font-bold text-lg text-[#1C1B1A] leading-snug">
                        {c.name}
                      </h3>
                      <Badge
                        className={`shrink-0 text-[10px] font-bold border ${classLevelBadgeClass(c.level)}`}
                      >
                        {classLevelLabel(c.level)}
                      </Badge>
                    </div>

                    <div className="mt-4 space-y-2.5 text-sm">
                      <span className="flex items-center gap-2 text-[#1C1B1A]">
                        <Clock className="w-4 h-4 text-[#C1272D] shrink-0" />
                        {scheduleOf(c)}
                      </span>
                      <span className="flex items-center gap-2 text-[#1C1B1A]">
                        <CalendarDays className="w-4 h-4 text-[#C1272D] shrink-0" />
                        <span>
                          Mensalidade:{' '}
                          <strong className="text-[#C1272D] font-semibold">
                            {feeOf(c) > 0 ? money(feeOf(c)) : 'Consultar'}
                          </strong>
                        </span>
                      </span>
                    </div>

                    <Link
                      to="/criar-conta"
                      className="mt-5 pt-0 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-[#C1272D] text-white text-sm font-semibold hover:bg-[#A01E23] transition-colors mt-auto"
                    >
                      Quero me matricular
                      <ArrowRight className="w-4 h-4" />
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* ===== Aba Kimonos e Acessórios ===== */}
      {activeTab === 'kimonos' && (
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-12">
          {/* Filtros de categoria */}
          <div className="flex items-center gap-2 overflow-x-auto pb-4">
            {SHOP_CATEGORIES.map((cat) => {
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

          {/* Carregando */}
          {productsLoading ? (
            <div className="py-20 flex flex-col items-center justify-center text-[#6B6560]">
              <Loader2 className="w-8 h-8 animate-spin text-[#C1272D] mb-3" />
              <p className="font-serif text-sm">Carregando catálogo do dojo...</p>
            </div>
          ) : filteredProducts.length === 0 ? (
            /* Vazio */
            <div className="py-16 text-center bg-white rounded-2xl border border-[#E8E0D5] p-8 max-w-md mx-auto my-6">
              <HankoStamp size="lg" className="mx-auto mb-4" />
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
            /* Grade de produtos */
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mt-4">
              {filteredProducts.map((product) => {
                const imageUrl = productsService.getImageUrl(product)

                return (
                  <Link
                    key={product.id}
                    to={`/produto/${product.slug}`}
                    className="group bg-white rounded-xl border border-[#E8E0D5] overflow-hidden shadow-xs hover:shadow-md hover:-translate-y-1 transition-all duration-200 flex flex-col"
                  >
                    {/* Imagem / marcador gráfico */}
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

                    {/* Corpo */}
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
                            {money(product.price)}
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
      )}

      {/* Como funciona */}
      <section className="bg-white border-y border-[#E8E0D5] py-14">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-10">
            <span className="text-xs font-bold text-[#C1272D] uppercase tracking-widest font-serif">
              Simples & Transparente
            </span>
            <h2 className="font-serif font-bold text-2xl sm:text-3xl text-[#1C1B1A] mt-1">
              Como funciona a matrícula e as compras no Dojo
            </h2>
            <p className="text-sm text-[#6B6560] mt-2">
              Escolha sua turma, crie sua conta e reserve online. O pagamento é combinado
              diretamente com a academia.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="flex flex-col items-center text-center p-4">
              <div className="w-12 h-12 rounded-full bg-[#C1272D] text-white flex items-center justify-center font-serif font-bold text-lg mb-4 shadow-sm">
                1
              </div>
              <h3 className="font-serif font-bold text-base text-[#1C1B1A] mb-1">
                Escolha sua turma
              </h3>
              <p className="text-xs text-[#6B6560] leading-relaxed max-w-xs">
                Veja os horários e a mensalidade na aba de turmas e escolha o nível certo para você.
              </p>
            </div>

            <div className="flex flex-col items-center text-center p-4">
              <div className="w-12 h-12 rounded-full bg-[#C1272D] text-white flex items-center justify-center font-serif font-bold text-lg mb-4 shadow-sm">
                2
              </div>
              <h3 className="font-serif font-bold text-base text-[#1C1B1A] mb-1">
                Monte seu kit de treino
              </h3>
              <p className="text-xs text-[#6B6560] leading-relaxed max-w-xs">
                Kimonos no seu tamanho, faixas graduadas e camisetas oficiais na aba de produtos.
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
            <Shield className="w-5 h-5 shrink-0" />
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
