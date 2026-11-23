import React from 'react'
import { Crown, ShieldCheck } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

/**
 * Selo visual do cargo de administrador, na identidade da academia
 * (vermelho/preto, tema oriental):
 *  - Principal (is_owner): escudo sólido vermelho com coroa.
 *  - Secundário: contorno suave em vermelho com escudo.
 *
 * Uso sempre inline ao lado do nome: `whitespace-nowrap` impede quebra
 * interna do rótulo e o container da linha usa flex-wrap, então em telas
 * estreitas o badge acompanha o nome ou desce inteiro, sem quebrar o layout.
 */
export const AdminRoleBadge: React.FC<{
  isOwner?: boolean
  className?: string
}> = ({ isOwner = false, className }) => (
  <Badge
    className={cn(
      'inline-flex max-w-full items-center gap-1 whitespace-nowrap text-[10px] font-bold px-1.5 py-0',
      isOwner
        ? 'bg-[#C1272D] text-white border-[#A01E23] shadow-sm'
        : 'bg-[#F7E4E2] text-[#8E1519] border-[#C1272D]/30',
      className,
    )}
    title={
      isOwner ? 'Administrador principal (dono da academia)' : 'Administrador secundário do painel'
    }
  >
    {isOwner ? (
      <Crown className="w-3 h-3 shrink-0" aria-hidden />
    ) : (
      <ShieldCheck className="w-3 h-3 shrink-0" aria-hidden />
    )}
    {isOwner ? 'Admin principal' : 'Admin'}
  </Badge>
)
