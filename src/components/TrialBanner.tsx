import { Link } from 'react-router-dom'
import { CalendarPlus, ArrowRight } from 'lucide-react'
import type { SiteContent } from '@/services/siteSettings'
import { BrushDivider } from '@/components/hero/HeroDecor'

/**
 * Faixa de destaque "Aula experimental" na home — vermelho sólido da
 * identidade (#C1272D), sempre visível (pública, sem depender de login), entre
 * o hero e as abas de turmas/produtos. Os textos vêm do conteúdo editável da
 * home (siteSettings); o campo vazio no painel cai no default do merge.
 */
export function TrialBanner({ site }: { site: SiteContent }) {
  return (
    <section
      aria-labelledby="trial-banner-title"
      className="relative bg-[#C1272D] text-white overflow-hidden"
    >
      {/* Sol discreto ao fundo + pincelada na borda, coerente com o hero */}
      <div
        aria-hidden="true"
        className="absolute -right-20 -top-24 w-72 h-72 rounded-full bg-white/8 motion-safe:animate-none pointer-events-none"
      />
      <BrushDivider className="absolute bottom-0 left-0 right-0 w-full text-[#A01E23] rotate-180" />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-9 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 sm:gap-5">
        <div className="flex items-start gap-4">
          <span className="hidden sm:flex w-12 h-12 shrink-0 rounded-full bg-white text-[#C1272D] items-center justify-center shadow-sm">
            <CalendarPlus className="w-6 h-6" aria-hidden="true" />
            <span className="sr-only">Aula experimental</span>
          </span>
          <div>
            <h2
              id="trial-banner-title"
              className="font-brush font-serif font-bold text-lg sm:text-2xl leading-snug [text-shadow:0_1px_0_rgba(160,30,35,0.6)]"
            >
              {site.trial_banner_title}
            </h2>
            <p className="mt-1 sm:mt-1.5 text-sm text-white/90 leading-relaxed max-w-2xl [text-shadow:0_1px_0_rgba(160,30,35,0.6)]">
              {site.trial_banner_text}
            </p>
          </div>
        </div>

        <Link
          to="/aula-experimental"
          className="shrink-0 inline-flex items-center justify-center gap-2 px-5 py-3 min-h-[44px] rounded-lg bg-white text-[#C1272D] text-sm font-bold shadow-sm transition-all duration-200 hover:bg-[#FAF6F0] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#C1272D]"
        >
          <CalendarPlus className="w-4 h-4" aria-hidden="true" />
          {site.trial_banner_button}
          <ArrowRight className="w-4 h-4" aria-hidden="true" />
        </Link>
      </div>
    </section>
  )
}
