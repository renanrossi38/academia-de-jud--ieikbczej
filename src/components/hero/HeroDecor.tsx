import React from 'react'

/**
 * Elementos decorativos do hero da Home — inspirados no folder do exame de
 * graduação: sol vermelho texturizado, ondas sumi-e, pétalas de sakura e
 * sublinhado de pincel. São DECORAÇÃO (aria-hidden), nunca conteúdo.
 */

/** Grande círculo de sol vermelho com textura de pincel (só CSS/SVG). */
export const HeroSun: React.FC<{ className?: string }> = ({ className }) => (
  <svg viewBox="0 0 400 400" aria-hidden="true" className={className}>
    <defs>
      <radialGradient id="hero-sun" cx="42%" cy="38%" r="75%">
        <stop offset="0%" stopColor="#D8434A" />
        <stop offset="55%" stopColor="#C1272D" />
        <stop offset="100%" stopColor="#A31B21" />
      </radialGradient>
      <radialGradient id="hero-sun-halo" cx="50%" cy="50%" r="50%">
        <stop offset="70%" stopColor="#C1272D" stopOpacity="0" />
        <stop offset="100%" stopColor="#C1272D" stopOpacity="0.12" />
      </radialGradient>
    </defs>
    {/* Halo suave em volta do disco */}
    <circle cx="200" cy="200" r="196" fill="url(#hero-sun-halo)" />
    {/* Disco do sol */}
    <circle cx="200" cy="200" r="150" fill="url(#hero-sun)" />
    {/* Textura de pinceladas: arcos claros e manchas, como no folder */}
    <g stroke="#E4636A" strokeLinecap="round" fill="none" opacity="0.5">
      <path d="M120 130c30-26 74-38 116-30" strokeWidth="3.5" />
      <path d="M100 180c8-30 26-56 52-74" strokeWidth="2.5" />
      <path d="M290 150c18 22 27 50 25 80" strokeWidth="3" />
      <path d="M150 300c34 20 78 22 114 4" strokeWidth="2.5" />
    </g>
    <g fill="#E4636A" opacity="0.35">
      <ellipse cx="150" cy="110" rx="26" ry="10" transform="rotate(-18 150 110)" />
      <ellipse cx="272" cy="140" rx="20" ry="8" transform="rotate(22 272 140)" />
      <ellipse cx="120" cy="230" rx="22" ry="9" transform="rotate(14 120 230)" />
      <ellipse cx="285" cy="255" rx="24" ry="9" transform="rotate(-12 285 255)" />
      <ellipse cx="210" cy="315" rx="28" ry="10" transform="rotate(4 210 315)" />
    </g>
    <g fill="#8E1519" opacity="0.3">
      <ellipse cx="185" cy="95" rx="18" ry="7" transform="rotate(-8 185 95)" />
      <ellipse cx="250" cy="300" rx="20" ry="8" transform="rotate(-16 250 300)" />
      <ellipse cx="130" cy="180" rx="14" ry="6" transform="rotate(30 130 180)" />
    </g>
    {/* Bordas irregulares: pequenas falhas na tinta da circunferência */}
    <g fill="#FAF6F0" opacity="0.5">
      <circle cx="200" cy="50" r="5" />
      <circle cx="330" cy="180" r="4" />
      <circle cx="90" cy="270" r="5" />
      <circle cx="235" cy="348" r="4" />
    </g>
  </svg>
)

/** Ondas estilo sumi-e (tinta preta) na base do hero. */
export const HeroWaves: React.FC<{ className?: string }> = ({ className }) => (
  <svg viewBox="0 0 1200 110" preserveAspectRatio="none" aria-hidden="true" className={className}>
    <g fill="none" stroke="#1C1B1A" strokeLinecap="round" opacity="0.85">
      <path
        d="M0 84c60-42 120-42 180 0s120 42 180 0 120-42 180 0 120 42 180 0 120-42 180 0 120 42 180 0 120-42 120-42"
        strokeWidth="7"
        opacity="0.9"
      />
      <path
        d="M-20 100c60-36 130-36 190 0s130 36 190 0 130-36 190 0 130 36 190 0 130-36 190 0 130 36 190 0"
        strokeWidth="4"
        opacity="0.55"
      />
      <path
        d="M-10 66c70-26 140-26 210 0s140 26 210 0 140-26 210 0 140 26 210 0 140-26 210 0"
        strokeWidth="2"
        opacity="0.3"
      />
    </g>
    {/* Respingos de tinta das cristas das ondas */}
    <g fill="#1C1B1A" opacity="0.6">
      <circle cx="180" cy="52" r="2.5" />
      <circle cx="196" cy="44" r="1.8" />
      <circle cx="540" cy="50" r="2.2" />
      <circle cx="556" cy="42" r="1.5" />
      <circle cx="900" cy="54" r="2.5" />
      <circle cx="916" cy="46" r="1.7" />
    </g>
  </svg>
)

/** Pétalas de sakura vermelhas caindo (SVG inline, sem imagem). */
export const HeroPetals: React.FC<{ className?: string }> = ({ className }) => {
  // Pétalas fixas (sem aleatoriedade no render): posições/tamanhos equilibrados
  const petals = [
    { cx: '8%', top: '22%', s: 1, o: 0.75, r: -20 },
    { cx: '13%', top: '58%', s: 0.7, o: 0.55, r: 40 },
    { cx: '30%', top: '12%', s: 0.85, o: 0.65, r: 65 },
    { cx: '38%', top: '70%', s: 0.6, o: 0.45, r: -45 },
    { cx: '52%', top: '8%', s: 1, o: 0.7, r: 15 },
    { cx: '61%', top: '38%', s: 0.75, o: 0.55, r: -70 },
    { cx: '78%', top: '14%', s: 0.9, o: 0.6, r: 30 },
    { cx: '88%', top: '48%', s: 1.1, o: 0.75, r: -30 },
    { cx: '94%', top: '24%', s: 0.65, o: 0.5, r: 80 },
    { cx: '70%', top: '78%', s: 0.7, o: 0.4, r: -10 },
  ]

  return (
    <div aria-hidden="true" className={`absolute inset-0 pointer-events-none ${className || ''}`}>
      {petals.map((p, i) => (
        <svg
          key={i}
          viewBox="0 0 20 20"
          className="absolute animate-petal-fall"
          style={{
            left: p.cx,
            top: p.top,
            width: `${20 * p.s}px`,
            height: `${20 * p.s}px`,
            opacity: p.o,
            animationDelay: `${(i % 5) * 1.6}s`,
            animationDuration: `${9 + (i % 4) * 2.5}s`,
            transform: `rotate(${p.r}deg)`,
          }}
        >
          {/* Pétalas em "V" invertido, características da sakura */}
          <path
            d="M10 18C6.5 15.5 3.5 12.5 3 9.2 2.7 7 4 5 6 5c1.6 0 3 1 4 2.4C11 6 12.4 5 14 5c2 0 3.3 2 3 4.2-.5 3.3-3.5 6.3-7 8.8z"
            fill="#D8434A"
          />
          <path d="M10 8v8" stroke="#B01E24" strokeWidth="0.8" strokeLinecap="round" />
        </svg>
      ))}
    </div>
  )
}

/** Sublinhado de pincelada vermelha (como no título do folder). */
export const HeroUnderline: React.FC<{ className?: string }> = ({ className }) => (
  <svg viewBox="0 0 120 10" preserveAspectRatio="none" aria-hidden="true" className={className}>
    <path
      d="M2 6c20-4 44-5 60-4 20 1 40 0 56-2-14 3-34 5-52 5-24 0-46 1-64 1z"
      fill="#C1272D"
      opacity="0.85"
    />
  </svg>
)

/**
 * Traço/faixa de pincel horizontal com pontas irregulares — a faixa vermelha
 * da base do folder. Herda a cor via `currentColor`; usado como divisor
 * decorativo em cards, headers e rodapé.
 */
export const BrushDivider: React.FC<{
  className?: string
  preserveAspectRatio?: string
}> = ({ className, preserveAspectRatio = 'none' }) => (
  <svg
    viewBox="0 0 300 12"
    preserveAspectRatio={preserveAspectRatio}
    aria-hidden="true"
    className={className}
  >
    <path
      d="M2 8.5C10 4.5 26 3.2 48 3.6c30 .5 58-1.4 92-1.2 36 .2 72-1.6 104-.8 26 .6 44 1.8 54 3.4-8 2.6-26 4.2-52 4.8-34 .8-70 2.2-104 2-34-.2-66 1-96 .2C22 11.6 8 10.6 2 8.5z"
      fill="currentColor"
    />
    {/* Respingos de tinta nas pontas */}
    <circle cx="4" cy="5" r="1.6" fill="currentColor" opacity="0.7" />
    <circle cx="296" cy="7" r="1.4" fill="currentColor" opacity="0.6" />
  </svg>
)
