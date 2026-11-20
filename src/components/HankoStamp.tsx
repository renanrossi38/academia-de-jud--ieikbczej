import React from 'react'

interface HankoStampProps {
  size?: 'sm' | 'md' | 'lg' | 'xl'
  text?: string
  kanji?: string
  className?: string
  variant?: 'solid' | 'outline'
}

export const HankoStamp: React.FC<HankoStampProps> = ({
  size = 'md',
  text,
  kanji = '柔',
  className = '',
  variant = 'solid',
}) => {
  const sizeMap = {
    sm: 'w-8 h-8 text-xs',
    md: 'w-12 h-12 text-base',
    lg: 'w-20 h-20 text-2xl',
    xl: 'w-28 h-28 text-4xl',
  }

  const isSolid = variant === 'solid'

  return (
    <div
      className={`relative inline-flex items-center justify-center rounded-full select-none shrink-0 font-serif font-bold transition-transform ${sizeMap[size]} ${
        isSolid
          ? 'bg-[#C1272D] text-white shadow-sm ring-2 ring-[#C1272D]/20'
          : 'border-2 border-[#C1272D] text-[#C1272D] bg-[#F7E4E2]/40'
      } ${className}`}
      title={text || 'Dojo Nippon'}
    >
      <span className="leading-none pt-0.5">{kanji}</span>
      {text && (
        <span className="absolute -bottom-1 text-[9px] uppercase tracking-wider bg-white px-1 border border-[#C1272D] text-[#C1272D] rounded">
          {text}
        </span>
      )}
    </div>
  )
}

export const ProductPlaceholder: React.FC<{ name?: string; className?: string }> = ({
  name,
  className = 'h-48',
}) => {
  return (
    <div
      className={`w-full bg-[#F7E4E2]/50 flex flex-col items-center justify-center border-b border-[#E8E0D5] relative overflow-hidden ${className}`}
    >
      <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#C1272D_1px,transparent_1px)] [background-size:12px_12px]" />
      <HankoStamp size="lg" kanji="柔" className="animate-stamp-pop" />
      <span className="mt-2 text-xs font-medium text-[#6B6560] tracking-wider uppercase font-serif">
        {name || 'Dojo Nippon'}
      </span>
    </div>
  )
}
