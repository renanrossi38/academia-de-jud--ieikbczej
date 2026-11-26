import React from 'react'
import { UserRound } from 'lucide-react'
import { cn } from '@/lib/utils'
import { beltLabel } from '@/components/admin/StudentDialogs'
import type { StudentAreaChild } from '@/services/studentArea'

interface ChildSwitcherProps {
  /** Alunos vinculados à conta do responsável (2+). */
  children: StudentAreaChild[]
  /** Id do aluno cujos dados estão sendo exibidos agora. */
  selectedId: string
  /** Troca o dependente: recarrega mensalidades, pedidos, presenças e ranking. */
  onSelect: (child: StudentAreaChild) => void
  className?: string
}

/**
 * "Qual filho você quer ver?" — chips de dependente para contas de responsável
 * com mais de um filho vinculado. A escolha persiste no localStorage
 * (chave em src/services/selectedChild.ts).
 */
export const ChildSwitcher: React.FC<ChildSwitcherProps> = ({
  children,
  selectedId,
  onSelect,
  className,
}) => {
  if (children.length < 2) return null

  return (
    <section
      aria-label="Selecionar dependente"
      className={cn(
        'bg-white rounded-2xl border border-[#C1272D]/25 shadow-xs p-4 sm:p-5',
        className,
      )}
    >
      <h2 className="font-serif font-bold text-sm text-[#1C1B1A] flex items-center gap-2 mb-3">
        <UserRound className="w-4 h-4 text-[#C1272D]" />
        Qual filho você quer ver?
      </h2>
      <div role="group" className="flex flex-wrap gap-2">
        {children.map((child) => {
          const isSel = child.id === selectedId
          return (
            <button
              key={child.id}
              type="button"
              aria-pressed={isSel}
              onClick={() => !isSel && onSelect(child)}
              className={cn(
                'rounded-full border px-4 py-2 text-xs font-semibold transition-colors',
                'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#C1272D]',
                isSel
                  ? 'bg-[#C1272D] border-[#C1272D] text-white shadow-sm'
                  : 'bg-white border-[#E8E0D5] text-[#1C1B1A] hover:border-[#C1272D]/50 hover:bg-[#F7E4E2]/60',
              )}
            >
              <span className="block leading-tight">{child.name}</span>
              <span
                className={cn(
                  'block text-[10px] font-bold uppercase tracking-wider leading-tight',
                  isSel ? 'text-white/85' : 'text-[#C1272D]',
                )}
              >
                {beltLabel(child.belt)}
              </span>
            </button>
          )
        })}
      </div>
    </section>
  )
}
