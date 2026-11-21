import React, { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'
import logoUrl from '@/assets/logo-fundo-transp-4b2b2.png'

/**
 * LOGO OFICIAL (dragão) — única marca do app, em todos os tamanhos.
 *
 * O PNG original tem o texto "JUDÔ TATSU" logo abaixo do dragão, que NÃO
 * deve aparecer. Em vez de porcentagens estimadas, o corte é derivado dos
 * PIXELS reais da imagem: lemos o PNG em um canvas, contamos quantos pixels
 * opacos há em cada linha e procuramos a maior faixa de linhas vazias na
 * metade inferior (a separação entre o dragão e o texto). O PNG recortado
 * (somente o dragão, com transparência preservada) é gerado uma vez e
 * reutilizado por todos os pontos de uso através de um cache de módulo.
 */

const ALPHA_THRESHOLD = 32

/** Índice da primeira linha da maior faixa vazia (abaixo de 30% da altura), com conteúdo abaixo. */
function findCutRow(alpha: Uint8Array, width: number, height: number): number {
  const rowCount = new Uint32Array(height)
  for (let y = 0; y < height; y++) {
    let count = 0
    const base = y * width
    for (let x = 0; x < width; x++) {
      if (alpha[base + x] > ALPHA_THRESHOLD) count++
    }
    rowCount[y] = count
  }
  // Linha "vazia" = no máximo 0,2% da largura com pixels opacos (ruído de borda).
  const emptyLimit = Math.max(1, Math.round(width * 0.002))
  const minStart = Math.round(height * 0.3)

  let bestStart = -1
  let bestLen = 0
  let y = minStart
  while (y < height) {
    if (rowCount[y] > emptyLimit) {
      y++
      continue
    }
    const start = y
    while (y < height && rowCount[y] <= emptyLimit) y++
    const len = y - start
    const hasContentBelow = y < height
    if (hasContentBelow && len > bestLen) {
      bestLen = len
      bestStart = start
    }
  }
  return bestStart > 0 ? bestStart : height
}

let croppedPromise: Promise<string | null> | null = null

/** Gera (uma vez) o PNG somente com o dragão, a partir dos pixels reais. */
function getCroppedDragon(): Promise<string | null> {
  if (croppedPromise) return croppedPromise
  croppedPromise = new Promise<string | null>((resolve) => {
    const img = new Image()
    img.onload = () => {
      try {
        const w = img.naturalWidth
        const h = img.naturalHeight
        const full = document.createElement('canvas')
        full.width = w
        full.height = h
        const fctx = full.getContext('2d', { willReadFrequently: true })
        if (!fctx) return resolve(null)
        fctx.drawImage(img, 0, 0)
        const data = fctx.getImageData(0, 0, w, h).data
        const alpha = new Uint8Array(w * h)
        for (let i = 0; i < w * h; i++) alpha[i] = data[i * 4 + 3]
        const cutRow = findCutRow(alpha, w, h)

        const out = document.createElement('canvas')
        out.width = w
        out.height = cutRow
        const octx = out.getContext('2d')
        if (!octx) return resolve(null)
        octx.drawImage(img, 0, 0, w, cutRow, 0, 0, w, cutRow)
        resolve(out.toDataURL('image/png'))
      } catch {
        resolve(null)
      }
    }
    img.onerror = () => resolve(null)
    img.src = logoUrl
  })
  return croppedPromise
}

export const OfficialLogo: React.FC<{ className?: string; alt?: string }> = ({
  className,
  alt = 'Logo do Judô Tatsu',
}) => {
  const [src, setSrc] = useState<string | null>(null)
  const [fallback, setFallback] = useState(false)

  useEffect(() => {
    let cancelled = false
    getCroppedDragon().then((url) => {
      if (cancelled) return
      if (url) setSrc(url)
      else setFallback(true)
    })
    return () => {
      cancelled = true
    }
  }, [])

  const imgSrc = src ?? (fallback ? logoUrl : null)

  return (
    <span
      className={cn('relative block aspect-square shrink-0 select-none', className)}
      aria-label={alt}
      role="img"
    >
      {imgSrc && (
        <img
          src={imgSrc}
          alt=""
          draggable={false}
          className="absolute inset-0 w-full h-full object-contain"
        />
      )}
    </span>
  )
}

/** URL bruta do PNG oficial (para favicon, og:image etc.). */
export const officialLogoUrl = logoUrl

/** Tamanhos padronizados do logo na interface. */
const sizeMap = {
  sm: 'w-8 h-8',
  md: 'w-10 h-10',
  lg: 'w-14 h-14',
  xl: 'w-20 h-20',
}

interface HankoStampProps {
  size?: 'sm' | 'md' | 'lg' | 'xl'
  className?: string
  /** Mantido por compatibilidade e ignorado. */
  kanji?: string
  /** Texto alternativo (marca da academia). */
  text?: string
}

/**
 * Marca da academia em qualquer tamanho. Exibe o LOGO OFICIAL (dragão) —
 * em nenhum lugar do app o antigo selo hanko substitui o logo.
 */
export const HankoStamp: React.FC<HankoStampProps> = ({ size = 'md', className, text }) => {
  return <OfficialLogo className={cn(sizeMap[size], className)} alt={text || 'Judô Tatsu'} />
}

export const ProductPlaceholder: React.FC<{ name?: string; className?: string }> = ({
  name,
  className,
}) => {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-2 text-[#6B6560] h-full w-full min-h-[180px] bg-[#FAF6F0]',
        className,
      )}
    >
      <OfficialLogo className="w-12 h-12 opacity-80" />
      <span className="font-serif text-xs opacity-80">{name || 'Produto do Judô Tatsu'}</span>
    </div>
  )
}
