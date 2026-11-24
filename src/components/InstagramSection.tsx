import { useEffect, useState } from 'react'
import { fetchInstagramPosts, legendaCurta, dataCurta, InstagramPost } from '@/services/instagram'
import { useSiteContent } from '@/services/siteSettings'
import { HeroSun, BrushDivider } from '@/components/hero/HeroDecor'
import { HankoStamp } from '@/components/HankoStamp'
import {
  Loader2,
  Instagram as InstagramIcon,
  ArrowUpRight,
  ExternalLink,
  Sparkles,
  CalendarDays,
} from 'lucide-react'

/**
 * Seção de Instagram da home (Judô Tatsu) — identidade oriental vermelho/preto,
 * mesmo padrão das demais seções (washi #FAF6F0, sol HeroSun, traço de pincel).
 *
 * Os TEXTOS da seção (etiqueta, título com parte em vermelho, subtítulo, selo
 * "Mais recente", links e fallbacks) vêm do editor da home (/painel/site) via
 * useSiteContent.
 *
 * O post MAIS RECENTE fica sempre em destaque (card grande, imagem + legenda e
 * data); os demais viram uma grade de miniaturas. Cada card abre o post original
 * no Instagram (permalink), em nova aba. Sem posts ou leitura falha → a seção
 * não renderiza nada (a home nunca quebra).
 */
export default function InstagramSection() {
  const site = useSiteContent()
  const [posts, setPosts] = useState<InstagramPost[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let vivo = true
    fetchInstagramPosts().then((data) => {
      if (vivo) {
        setPosts(data)
        setLoading(false)
      }
    })
    return () => {
      vivo = false
    }
  }, [])

  if (loading) {
    return (
      <section className="bg-[#FAF6F0] border-y border-[#E8E0D5] py-14">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col items-center justify-center text-[#4A443F]">
          <Loader2 className="w-7 h-7 animate-spin text-[#C1272D] mb-3" />
          <p className="font-serif text-sm">{site.news_loading}</p>
        </div>
      </section>
    )
  }

  // Tratamento gracioso: sem posts (ou falha) → nenhuma seção.
  if (posts.length === 0) return null

  const [destaque, ...restantes] = posts
  const miniaturas = restantes.slice(0, 6)

  return (
    <section className="relative bg-[#FAF6F0] border-y border-[#E8E0D5] py-14 overflow-hidden">
      {/* Sol vermelho ao fundo, discreto, ecoando o hero.
          MOBILE: ainda mais discreto (opacity-5) para o cabeçalho não apagar. */}
      <HeroSun className="absolute -left-24 -top-28 w-72 h-72 opacity-5 sm:opacity-15 pointer-events-none" />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Cabeçalho no padrão das outras seções */}
        <div className="text-center max-w-2xl mx-auto mb-10">
          <span className="inline-flex items-center gap-1.5 text-xs font-bold text-[#A31B21] uppercase tracking-widest font-serif">
            <InstagramIcon className="w-3.5 h-3.5" />
            {site.news_tag}
          </span>
          <h2 className="font-serif font-bold text-2xl sm:text-3xl text-[#1C1B1A] mt-1">
            {site.news_title} <span className="text-[#A31B21]">{site.news_title_highlight}</span>
          </h2>
          <p className="text-sm text-[#4A443F] mt-2">{site.news_subtitle}</p>
          <BrushDivider className="w-40 mx-auto mt-4 text-[#C1272D]" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-5 lg:gap-6 items-stretch">
          {/* ===== Post mais recente EM DESTQUE ===== */}
          <a
            href={destaque.permalink}
            target="_blank"
            rel="noopener noreferrer"
            className="group lg:col-span-3 relative bg-white rounded-2xl border border-[#E8E0D5] shadow-xs hover:shadow-md transition-all duration-200 overflow-hidden flex flex-col"
          >
            <div className="relative aspect-4/3 sm:aspect-16/9 w-full bg-[#F7E4E2]/40 overflow-hidden">
              <img
                src={destaque.image}
                alt={legendaCurta(destaque.caption, 80) || 'Post do Instagram do Judô Tatsu'}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                loading="lazy"
              />
              {/* Etiqueta "Mais recente" com clip-path de pincel, na cor da academia */}
              <span className="absolute top-3 left-3 inline-flex items-center gap-1.5 bg-[#C1272D] text-white text-[11px] font-bold uppercase tracking-wider px-3 py-1 [clip-path:polygon(3%_20%,97%_10%,100%_55%,97%_90%,3%_96%,0_50%)]">
                <Sparkles className="w-3 h-3" />
                {site.news_latest_badge}
              </span>
              <div className="absolute top-3 right-3 bg-white/90 backdrop-blur-xs rounded-full p-2 border border-[#E8E0D5] text-[#1C1B1A] group-hover:text-[#C1272D] transition-colors">
                <ArrowUpRight className="w-4 h-4" />
              </div>
            </div>

            <div className="p-5 flex-1 flex flex-col">
              <p className="font-serif text-base text-[#1C1B1A] leading-relaxed line-clamp-3">
                {legendaCurta(destaque.caption, 220) || site.news_fallback_caption}
              </p>
              <div className="mt-auto pt-4 flex items-center justify-between gap-3">
                <span className="text-xs text-[#4A443F] flex items-center gap-1.5">
                  <CalendarDays className="w-3.5 h-3.5" />
                  {dataCurta(destaque.timestamp)}
                </span>
                <span className="text-xs font-semibold text-[#C1272D] flex items-center gap-1 group-hover:underline">
                  <InstagramIcon className="w-3.5 h-3.5" />
                  {site.news_open_label}
                </span>
              </div>
            </div>
          </a>

          {/* ===== Grade de miniaturas (demais posts) ===== */}
          <div className="lg:col-span-2 grid grid-cols-2 gap-4 content-start">
            {miniaturas.map((post) => (
              <a
                key={post.id || post.permalink}
                href={post.permalink}
                target="_blank"
                rel="noopener noreferrer"
                className="group bg-white rounded-xl border border-[#E8E0D5] shadow-xs hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 overflow-hidden flex flex-col"
              >
                <div className="relative aspect-square w-full bg-[#F7E4E2]/40 overflow-hidden">
                  <img
                    src={post.image}
                    alt={legendaCurta(post.caption, 60) || 'Post do Instagram do Judô Tatsu'}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    loading="lazy"
                  />
                  {post.media_type === 'VIDEO' && (
                    <span className="absolute top-2 right-2 bg-[#1C1B1A]/75 text-white rounded-full p-1.5">
                      <ExternalLink className="w-3 h-3" />
                    </span>
                  )}
                </div>
                <div className="p-3 flex-1 flex flex-col justify-between">
                  <p className="text-xs text-[#1C1B1A] font-medium leading-snug line-clamp-2">
                    {legendaCurta(post.caption, 70) || site.news_fallback_thumb}
                  </p>
                  <span className="mt-2 text-[10px] font-semibold text-[#A31B21] flex items-center gap-1">
                    <InstagramIcon className="w-3 h-3 shrink-0" />
                    {dataCurta(post.timestamp)}
                  </span>
                </div>
              </a>
            ))}
          </div>
        </div>

        {/* Rodapé da seção com o hanko (carimbo) da academia */}
        <div className="mt-10 flex justify-center">
          <HankoStamp size="md" />
        </div>
      </div>
    </section>
  )
}
