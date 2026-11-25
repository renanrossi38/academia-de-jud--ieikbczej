import type { FC } from 'react'
import { HeroSun, BrushDivider } from '@/components/hero/HeroDecor'

interface ClassCoverFallbackProps {
  /** Classes extras aplicadas ao contêiner da capa (ex.: zoom no hover). */
  className?: string
}

/**
 * Capa padrão dos cards de turma na home quando o admin não cadastrou foto.
 * Identidade da academia: disco solar vermelho, kanji do judô em branco
 * sobre o vermelho e pétalas de sakura — mesma paleta #C1272D/#1C1B1A do site.
 * O kanji vai como escape unicode (convenção do projeto para caracteres JP).
 */
export const ClassCoverFallback: FC<ClassCoverFallbackProps> = ({ className = '' }) => {
  return (
    <div
      aria-hidden="true"
      className={`relative h-32 sm:h-36 overflow-hidden bg-gradient-to-br from-[#C1272D] via-[#A31B21] to-[#7E1116] ${className}`}
    >
      {/* Disco solar (textura do folder) vazando no canto superior direito */}
      <HeroSun className="absolute -right-10 -top-12 w-44 h-44 opacity-60" />

      {/* Kanji do judô, vertical, branco, centrado */}
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="font-serif font-black text-white/95 leading-none text-5xl sm:text-6xl [writing-mode:vertical-rl] tracking-widest drop-shadow-[0_1px_3px_rgba(28,27,26,0.45)]">
          {'\u67D4'}
        </span>
      </div>

      {/* Pétalas de sakura discretas no canto inferior esquerdo */}
      <svg
        viewBox="0 0 120 60"
        className="absolute left-2 bottom-4 w-24 h-12 text-white/35"
        fill="currentColor"
        aria-hidden="true"
      >
        <path d="M18 42c-6-8-2-18 6-20 6-1.5 12 3 11 10-.8 6.5-9 12-17 10Z" />
        <path d="M52 30c-2-9 6-16 13-13 5 2 7 9 2 14-4.5 4.5-13 4-15-1Z" opacity="0.8" />
        <path d="M84 46c-8-3-9-14-2-18 5-3 12 0 12 7 0 6.5-5 12-10 11Z" opacity="0.6" />
      </svg>

      <BrushDivider className="absolute bottom-0 left-0 right-0 w-full text-[#C1272D]" />
    </div>
  )
}
