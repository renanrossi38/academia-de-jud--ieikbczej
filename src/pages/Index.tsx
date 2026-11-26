import { useEffect, useState } from 'react'
import { useSiteContent, type SiteContent } from '@/services/siteSettings'
import { Link, useLocation } from 'react-router-dom'
import { scrollToSection } from '@/components/homeAnchors'
import pb from '@/lib/pocketbase/client'
import { productsService } from '@/services/products'
import { classLevelLabel, classLevelBadgeClass, classesService } from '@/services/classes'
import { useRealtime } from '@/hooks/use-realtime'
import { Product, ProductCategory, Class } from '@/types'
import { HankoStamp, ProductPlaceholder, OfficialLogo } from '@/components/HankoStamp'
import { ClassCoverFallback } from '@/components/ClassCoverFallback'
import { HeroSun, HeroWaves, HeroPetals, HeroUnderline } from '@/components/hero/HeroDecor'
import { BrushDivider } from '@/components/hero/HeroDecor'
import InstagramSection from '@/components/InstagramSection'
import { HighlightsSection } from '@/components/HighlightsSection'
import { TrialBanner } from '@/components/TrialBanner'
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

/** Categorias exibidas na aba "Kimonos e Acessórios" (sem equipamentos/planos). Rótulos vêm do painel. */
const shopCategories = (
  site: SiteContent,
): { label: string; value: ProductCategory | 'todos' }[] => [
  { label: site.shop_cat_all, value: 'todos' },
  { label: site.shop_cat_uniformes, value: 'uniformes' },
  { label: site.shop_cat_faixas, value: 'faixas' },
  { label: site.shop_cat_camisetas, value: 'camisetas' },
]

const getCategoryLabel = (cat: ProductCategory, site: SiteContent): string => {
  switch (cat) {
    case 'uniformes':
      return site.shop_badge_uniformes
    case 'faixas':
      return site.shop_badge_faixas
    case 'camisetas':
      return site.shop_badge_camisetas
    case 'equipamentos':
      return 'Equipamento'
    case 'planos':
      return 'Plano / Treino'
    default:
      return cat
  }
}

/** Horário plausível quando a turma não tem o campo preenchido (texto vem do painel). */
const scheduleOf = (c: Class, fallback: string): string =>
  c.schedule && c.schedule.trim() !== '' ? c.schedule : fallback

/** Mensalidade plausível quando a turma não tem o campo preenchido. */
const feeOf = (c: Class): number =>
  typeof c.monthly_fee === 'number' && c.monthly_fee > 0 ? c.monthly_fee : 0

const money = (v: number): string =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

/** URL da capa de uma turma (null quando não tem foto gravada). */
const coverUrlOf = (c: Class): string | null => classesService.getCoverUrl(c)

/** Insere ou substitui uma turma pelo id (mesma semântica do painel). */
const upsertClass = (list: Class[], record: Class): Class[] =>
  list.some((c) => c.id === record.id)
    ? list.map((c) => (c.id === record.id ? record : c))
    : [record, ...list]

/**
 * Vagas disponíveis de uma turma (vagas − matrículas em class_students), o
 * mesmo cálculo usado para agendar aula experimental. Devolve null quando a
 * turma não tem limite de vagas definido (comportamento de antes: sem contagem).
 */
const vagasDisponiveisDe = (
  c: Class,
  counts: Record<string, number> | undefined,
): number | null => {
  const vagas = typeof c.vagas === 'number' ? c.vagas : 0
  if (vagas <= 0 || !counts) return null
  return Math.max(0, vagas - (counts[c.id] ?? 0))
}

export default function Index() {
  const site = useSiteContent()
  const location = useLocation()
  const [activeTab, setActiveTab] = useState<HomeTab>('turmas')

  const [classes, setClasses] = useState<Class[]>([])
  const [classesLoading, setClassesLoading] = useState(true)
  /** Matrículas por turma (class_students) — para calcular vagas disponíveis. */
  const [enrollmentCounts, setEnrollmentCounts] = useState<Record<string, number>>({})

  const [products, setProducts] = useState<Product[]>([])
  const [productsLoading, setProductsLoading] = useState(false)
  const [productsLoaded, setProductsLoaded] = useState(false)
  const [selectedCategory, setSelectedCategory] = useState<ProductCategory | 'todos'>('todos')

  useEffect(() => {
    // A aba de turmas é a inicial: produtos carregam só quando ela abre.
    loadClasses()
    loadEnrollmentCounts()
  }, [])

  // Âncoras do menu (#turmas / #kimonos): não existem como seção com id —
  // são o estado das abas da home. O menu navega para "/#kimonos" etc.
  // (homeAnchors.tsx) e aqui a aba certa é ativada + rola até a barra de abas.
  useEffect(() => {
    const hash = location.hash.replace(/^#/, '')
    if (hash !== 'turmas' && hash !== 'kimonos') return
    setActiveTab(hash as HomeTab)
    // Espera o paint (e o conteúdo da aba trocar) antes de medir a posição.
    const timer = window.setTimeout(() => scrollToSection('turmas'), 80)
    return () => window.clearTimeout(timer)
    // location.key muda também em cliques repetidos na mesma âncora.
  }, [location.key, location.hash])

  // Realtime: matrícula/remoção na turma reflete nas vagas disponíveis na hora.
  useRealtime('class_students', () => {
    loadEnrollmentCounts()
  })

  // Realtime: capa nova na turma (ou turma criada/removida no painel) reflete na home na hora.
  useRealtime<Class>('classes', (e) => {
    const cls = e.record
    if (e.action === 'create') {
      setClasses((prev) => (cls.active === false ? prev : upsertClass(prev, cls)))
    } else if (e.action === 'update') {
      setClasses((prev) =>
        cls.active === false ? prev.filter((c) => c.id !== cls.id) : upsertClass(prev, cls),
      )
    } else if (e.action === 'delete') {
      setClasses((prev) => prev.filter((c) => c.id !== cls.id))
    }
  })

  // Realtime: galeria de fotos do produto salva no painel reflete nos cards da loja.
  useRealtime<Product>('products', (e) => {
    const prod = e.record
    if (e.action === 'delete') {
      setProducts((prev) => prev.filter((p) => p.id !== prod.id))
    } else {
      setProducts((prev) => prev.map((p) => (p.id === prod.id ? prod : p)))
    }
  })

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

  /** Matrículas por turma (um pedido só — mesmo método da aula experimental). */
  const loadEnrollmentCounts = async () => {
    try {
      setEnrollmentCounts(await classesService.countStudentsByClass())
    } catch (err) {
      console.error('Erro ao carregar matrículas das turmas:', err)
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
    `flex-1 sm:flex-none sm:min-w-[220px] px-4 sm:px-6 py-3.5 text-sm sm:text-base font-semibold font-brush font-serif transition-all duration-200 flex items-center justify-center gap-2 select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C1272D]/40 focus-visible:ring-offset-2 active:scale-[0.98] ${
      activeTab === tab
        ? 'bg-[#C1272D] text-white shadow-sm ring-2 ring-[#C1272D]/25 [clip-path:polygon(2%_18%,97%_8%,100%_55%,98%_88%,3%_96%,0_60%)]'
        : 'bg-white text-[#1C1B1A] border border-[#E8E0D5] hover:border-[#C1272D]/50 hover:bg-[#F7E4E2]/40 rounded-xl'
    }`

  return (
    <div className="min-h-screen">
      {/* Hero Section — inspirado no folder: papel branco, sol vermelho texturizado, kanji vertical */}
      <section
        id="hero"
        className="relative bg-[#FAF6F0] text-[#1C1B1A] py-12 sm:py-20 overflow-hidden"
      >
        {/* Sol vermelho texturizado (sem imagem externa).
            MOBILE: sobe para o topo/direita e fica MENOR e mais transparente,
            longe do bloco de texto central — era ele que "apagava" o texto. */}
        {/* Sol + kanji no MESMO contêiner: o kanji fica EXATAMENTE no centro
            do disco (flex center sobre inset-0) em qualquer breakpoint, porque
            o contêiner tem o mesmo tamanho/posição do sol.
            MOBILE: o sol sobe para o topo/direita, menor e translúcido, e o
            kanji some junto (hidden sm:flex) — comportamento mantido. */}
        <div className="absolute -right-20 -top-12 w-[210px] h-[210px] pointer-events-none sm:top-1/2 sm:-translate-y-1/2 sm:right-[-10%] sm:w-[420px] sm:h-[420px] md:right-[4%] md:w-[460px] md:h-[460px]">
          <HeroSun className="absolute inset-0 w-full h-full opacity-40 sm:opacity-100" />
          {/* Kanji centrado no disco: branco, vertical, com sombra suave.
              Fonte proporcional ao sol (sol 420/460px → kanji 60/72px). */}
          <div className="absolute inset-0 hidden sm:flex items-center justify-center z-[5]">
            <span className="text-white/95 drop-shadow-[0_1px_2px_rgba(28,27,26,0.35)] font-serif font-black leading-none text-6xl lg:text-7xl [writing-mode:vertical-rl] tracking-widest">
              {'\u67D4\u9053'}
            </span>
          </div>
        </div>

        {/* Ondas sumi-e na base (tinta preta) */}
        <HeroWaves className="absolute bottom-0 left-0 right-0 w-full pointer-events-none" />

        {/* Pétalas de sakura caindo */}
        <HeroPetals />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 flex flex-col md:flex-row items-center justify-between gap-6 md:gap-10">
          <div className="relative z-10 max-w-2xl text-center md:text-left">
            {/* Chip do topo: fundo sólido (não mais translúcido) para o texto
                não "apagar" sobre o sol/papel em telas pequenas. */}
            <div className="inline-flex items-center gap-2 bg-white px-3 py-1 text-[11px] font-bold uppercase tracking-[0.22em] mb-4 sm:mb-5 border border-[#C1272D]/40 text-[#A31B21] shadow-xs [clip-path:polygon(3%_20%,97%_10%,100%_55%,97%_90%,3%_96%,0_50%)]">
              <Sparkles className="w-3.5 h-3.5" />
              {site.hero_badge}
            </div>
            {/* Título/subtítulo ganham text-shadow branco suave: recorte do
                texto contra o papel washi e contra o vermelho do sol. */}
            <h1 className="font-brush text-4xl sm:text-5xl lg:text-6xl tracking-tight leading-[1.08] text-[#1C1B1A] [text-shadow:0_1px_0_rgba(250,246,240,0.9),0_0_18px_rgba(250,246,240,0.85)]">
              {site.hero_title}{' '}
              <span className="relative inline-block text-[#C1272D] [text-shadow:0_1px_0_rgba(250,246,240,0.9),0_0_18px_rgba(250,246,240,0.85)]">
                {site.hero_highlight}
                <HeroUnderline className="absolute left-0 right-0 -bottom-2 sm:-bottom-3 w-full h-3 sm:h-4" />
              </span>
              .
            </h1>
            <p className="mt-4 sm:mt-5 text-base sm:text-lg text-[#3E3A36] leading-relaxed font-sans max-w-xl [text-shadow:0_1px_0_rgba(250,246,240,0.9)]">
              {site.hero_subtitle}
            </p>
            <div className="mt-5 sm:mt-6 flex flex-wrap items-center justify-center md:justify-start gap-3 sm:gap-4 text-xs font-semibold text-[#1C1B1A]">
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-[#A31B21]" /> {site.hero_chip1}
              </span>
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-[#A31B21]" /> {site.hero_chip2}
              </span>
            </div>
          </div>

          <div className="shrink-0 hidden md:flex items-center justify-center relative z-10">
            <div className="relative flex flex-col items-center">
              <HeroSun className="absolute -inset-10 w-[calc(100%+80px)] h-[calc(100%+80px)] opacity-20" />
              {/* Logo oficial (dragão) em tamanho grande, sem cortes no texto.
                  O rótulo "Academia de Judô" foi removido: caía no meio do
                  disco do sol, sobre o kanji. */}
              <OfficialLogo className="relative w-72 lg:w-80 h-auto drop-shadow-sm" />
            </div>
          </div>
        </div>
      </section>

      {/* Faixa "Aula experimental" — destaque público, sempre visível */}
      <TrialBanner site={site} />

      {/* Abas: Turmas | Kimonos e Acessórios */}
      <section
        id="turmas"
        className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 sm:pt-10 scroll-mt-24"
      >
        <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 max-w-2xl mx-auto">
          <button onClick={() => setActiveTab('turmas')} className={tabClass('turmas')}>
            <Users className="w-4 h-4" />
            {site.tab_turmas}
          </button>
          <button onClick={() => setActiveTab('kimonos')} className={tabClass('kimonos')}>
            <Sparkles className="w-4 h-4" />
            {site.tab_kimonos}
          </button>
        </div>
      </section>

      {/* ===== Aba Turmas ===== */}
      {activeTab === 'turmas' && (
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
          {classesLoading ? (
            <div className="py-20 flex flex-col items-center justify-center text-[#4A443F]">
              <Loader2 className="w-8 h-8 animate-spin text-[#C1272D] mb-3" />
              <p className="font-serif text-sm">{site.classes_loading}</p>
            </div>
          ) : classes.length === 0 ? (
            <div className="py-16 text-center bg-white rounded-2xl border border-[#E8E0D5] p-8 max-w-md mx-auto my-6">
              <HankoStamp size="lg" className="mx-auto mb-4" />
              <h3 className="font-serif font-bold text-lg text-[#1C1B1A]">
                {site.classes_empty_title}
              </h3>
              <p className="text-sm text-[#4A443F] mt-1">{site.classes_empty_text}</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5 sm:gap-6">
              {classes.map((c) => (
                <div
                  key={c.id}
                  className="group relative bg-white rounded-2xl border border-[#E8E0D5] shadow-xs hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 flex flex-col overflow-hidden"
                >
                  {/* Capa da turma quando houver foto; senão, cabeçalho washi com sol + hanko */}
                  {coverUrlOf(c) ? (
                    <div className="relative h-32 sm:h-36 overflow-hidden">
                      <img
                        src={coverUrlOf(c) as string}
                        alt={`Turma ${c.name}`}
                        className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                      />
                      <BrushDivider className="absolute bottom-0 left-0 right-0 w-full text-[#C1272D]" />
                    </div>
                  ) : (
                    <ClassCoverFallback className="transition-transform duration-300 group-hover:scale-105" />
                  )}

                  <div className="p-4 sm:p-5 flex-1 flex flex-col">
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
                        {scheduleOf(c, site.class_schedule_fallback)}
                      </span>
                      <span className="flex items-center gap-2 text-[#1C1B1A]">
                        <CalendarDays className="w-4 h-4 text-[#C1272D] shrink-0" />
                        <span>
                          {site.class_fee_label}{' '}
                          <strong className="text-[#C1272D] font-semibold">
                            {feeOf(c) > 0 ? money(feeOf(c)) : site.class_fee_consult}
                          </strong>
                        </span>
                      </span>
                      {!!c.vagas && vagasDisponiveisDe(c, enrollmentCounts) !== null && (
                        <span className="flex items-center gap-2 text-[#1C1B1A]">
                          <Users className="w-4 h-4 text-[#C1272D] shrink-0" />
                          {(() => {
                            const restantes = vagasDisponiveisDe(c, enrollmentCounts) as number
                            return restantes <= 0 ? (
                              <Badge className="text-[11px] font-bold border bg-[#F7E4E2] text-[#C1272D] border-[#C1272D]/30">
                                Turma lotada
                              </Badge>
                            ) : (
                              <span>
                                {site.class_vagas_label}{' '}
                                <strong className="font-semibold">
                                  {restantes}{' '}
                                  {restantes === 1 ? 'vaga disponível' : 'vagas disponíveis'}
                                </strong>
                              </span>
                            )
                          })()}
                        </span>
                      )}
                    </div>

                    <Link
                      to="/criar-conta"
                      className="mt-5 inline-flex items-center justify-center gap-2 px-4 py-3 min-h-[44px] text-white text-sm font-semibold transition-all duration-200 mt-auto bg-[#C1272D] hover:bg-[#A01E23] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C1272D]/40 focus-visible:ring-offset-2 [clip-path:polygon(2%_18%,97%_8%,100%_55%,98%_88%,3%_96%,0_60%)] hover:[clip-path:polygon(1%_12%,98%_14%,100%_60%,97%_92%,2%_90%,0_55%)]"
                    >
                      {site.class_enroll_button}
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
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
          {/* Filtros de categoria */}
          <div className="flex items-center gap-2 overflow-x-auto pb-4">
            {shopCategories(site).map((cat) => {
              const isSelected = selectedCategory === cat.value
              return (
                <button
                  key={cat.value}
                  onClick={() => setSelectedCategory(cat.value)}
                  className={`px-4 py-2 min-h-[40px] rounded-full text-sm font-medium whitespace-nowrap transition-all duration-200 select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C1272D]/40 focus-visible:ring-offset-2 active:scale-[0.97] ${
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
            <div className="py-20 flex flex-col items-center justify-center text-[#4A443F]">
              <Loader2 className="w-8 h-8 animate-spin text-[#C1272D] mb-3" />
              <p className="font-serif text-sm">{site.shop_loading}</p>
            </div>
          ) : filteredProducts.length === 0 ? (
            /* Vazio */
            <div className="py-16 text-center bg-white rounded-2xl border border-[#E8E0D5] p-8 max-w-md mx-auto my-6">
              <HankoStamp size="lg" className="mx-auto mb-4" />
              <h3 className="font-serif font-bold text-lg text-[#1C1B1A]">
                {site.shop_empty_title}
              </h3>
              <p className="text-sm text-[#4A443F] mt-1 mb-4">{site.shop_empty_text}</p>
              <button
                onClick={() => setSelectedCategory('todos')}
                className="min-h-[44px] inline-flex items-center justify-center w-full sm:w-auto px-5 py-2 rounded-lg text-sm font-semibold text-[#C1272D] hover:underline hover:bg-[#F7E4E2]/40 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C1272D]/40 focus-visible:ring-offset-2"
              >
                {site.shop_empty_button}
              </button>
            </div>
          ) : (
            /* Grade de produtos */
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6 mt-2 sm:mt-4">
              {filteredProducts.map((product) => {
                const imageUrl = productsService.getImageUrl(product)

                return (
                  <Link
                    key={product.id}
                    to={`/produto/${product.slug}`}
                    className="group bg-white rounded-2xl border border-[#E8E0D5] overflow-hidden shadow-xs hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 flex flex-col focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C1272D]/40 focus-visible:ring-offset-2"
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
                          {getCategoryLabel(product.category, site)}
                        </Badge>
                      </div>
                    </div>

                    {/* Corpo */}
                    <div className="p-4 sm:p-5 flex-1 flex flex-col justify-between">
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
                          <span className="text-[11px] text-[#6B6560] block">
                            {site.shop_price_prefix}
                          </span>
                          <span className="font-semibold text-lg text-[#C1272D]">
                            {money(product.price)}
                          </span>
                        </div>

                        <span className="text-xs font-semibold text-[#1C1B1A] flex items-center gap-1 group-hover:text-[#C1272D] transition-colors">
                          {site.shop_details_button}
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

      {/* Destaques — medalha fica fica vigente + destaques de competição (some se vazio) */}
      <HighlightsSection />

      {/* Instagram: post mais recente em destaque + grade (some sozinho se falhar) */}
      <div id="instagram" className="scroll-mt-24">
        <InstagramSection />
      </div>

      {/* Como funciona */}
      <section
        id="como-funciona"
        className="bg-white border-y border-[#E8E0D5] py-12 sm:py-16 scroll-mt-24"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-8 sm:mb-10">
            {/* Mesmo padrão de cabeçalho das demais seções (chip com ícone + pincel) */}
            <span className="inline-flex items-center gap-1.5 text-xs font-bold text-[#A31B21] uppercase tracking-widest font-serif">
              <Sparkles className="w-3.5 h-3.5" />
              {site.how_tag}
            </span>
            <h2 className="font-serif font-bold text-2xl sm:text-3xl text-[#1C1B1A] mt-1">
              {site.how_title}
            </h2>
            <p className="text-sm text-[#4A443F] mt-2">{site.how_subtitle}</p>
            <BrushDivider className="w-40 mx-auto mt-4 text-[#C1272D]" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8">
            {site.how_steps.map((step, i) => (
              <div key={i} className="flex flex-col items-center text-center p-4">
                <div className="w-12 h-12 rounded-full bg-[#C1272D] text-white flex items-center justify-center font-serif font-bold text-lg mb-4 shadow-sm">
                  {i + 1}
                </div>
                <h3 className="font-serif font-bold text-base text-[#1C1B1A] mb-1">{step.title}</h3>
                <p className="text-xs text-[#4A443F] leading-relaxed max-w-xs sm:text-sm">
                  {step.description}
                </p>
              </div>
            ))}
          </div>

          <div className="mt-8 p-4 rounded-xl bg-[#FAF6F0] border border-[#E8E0D5] max-w-2xl mx-auto flex items-center gap-3 text-xs text-[#4A443F]">
            <Shield className="w-5 h-5 shrink-0" />
            <span>
              <strong>{site.how_guarantee_label}</strong> {site.how_guarantee_text}
            </span>
          </div>
        </div>
      </section>
    </div>
  )
}
