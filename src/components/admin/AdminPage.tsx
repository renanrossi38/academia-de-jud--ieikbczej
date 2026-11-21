import { Loader2 } from 'lucide-react'
import React from 'react'
import { Link } from 'react-router-dom'
import { HankoStamp } from '@/components/HankoStamp'
import { HeroUnderline } from '@/components/hero/HeroDecor'
import { cn } from '@/lib/utils'

/**
 * Padrão visual do painel administrativo (vermelho/preto/branco, tema oriental).
 *
 * Toda página do painel usa a mesma espinha:
 *  - AdminPageHeader: trilha "Painel", título com pincelada, descrição e
 *    a ação principal alinhada à direita.
 *  - AdminSummary: contagem/resumo no topo (chips com número + legenda).
 *  - AdminEmptyState: estado vazio com orientação do que fazer.
 *  - AdminPageLoader: carregamento consistente entre páginas.
 */

const PANEL_LINKS = [
  { to: '/painel/alunos', label: 'Alunos' },
  { to: '/painel/turmas', label: 'Turmas' },
  { to: '/painel/ranking', label: 'Ranking' },
  { to: '/painel/produtos', label: 'Loja' },
  { to: '/painel/pedidos', label: 'Pedidos' },
  { to: '/painel/configuracoes', label: 'Configurações' },
]

/** Trilha de navegação entre as páginas do painel (links + página atual). */
export const AdminBreadcrumbs: React.FC<{ current: string; currentTo?: string }> = ({
  current,
  currentTo,
}) => (
  <nav
    aria-label="Navegação do painel"
    className="flex items-center flex-wrap gap-x-1 gap-y-1 text-[11px] text-[#9A948C]"
  >
    {PANEL_LINKS.filter((l) => l.to !== currentTo).map((l, i) => (
      <React.Fragment key={l.to}>
        {i > 0 && <span aria-hidden>·</span>}
        <Link to={l.to} className="hover:text-[#C1272D] transition-colors font-medium">
          {l.label}
        </Link>
      </React.Fragment>
    ))}
    {current && (
      <>
        <span aria-hidden>·</span>
        <span className="text-[#C1272D] font-bold uppercase tracking-wider">{current}</span>
      </>
    )}
  </nav>
)

export interface AdminPageHeaderProps {
  title: string
  description?: string
  breadcrumb: string
  breadcrumbTo?: string
  icon?: React.ReactNode
  /** Ação principal (botão vermelho) alinhada à direita. */
  action?: React.ReactNode
}

export const AdminPageHeader: React.FC<AdminPageHeaderProps> = ({
  title,
  description,
  breadcrumb,
  breadcrumbTo,
  icon,
  action,
}) => (
  <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-6">
    <div className="min-w-0">
      <AdminBreadcrumbs current={breadcrumb} currentTo={breadcrumbTo} />
      <h1 className="font-serif font-bold text-2xl sm:text-3xl text-[#1C1B1A] mt-2 flex items-center gap-2.5">
        {icon && <span className="text-[#C1272D] shrink-0">{icon}</span>}
        <span className="truncate">{title}</span>
      </h1>
      <HeroUnderline className="w-28 h-2.5 mt-1.5" />
      {description && (
        <p className="text-xs sm:text-sm text-[#6B6560] mt-2 max-w-xl leading-relaxed">
          {description}
        </p>
      )}
    </div>
    {action && <div className="shrink-0">{action}</div>}
  </div>
)

export interface AdminSummaryStat {
  /** Valor grande (número). */
  value: React.ReactNode
  /** Legenda curta embaixo do número. */
  label: string
  /** Variante de cor do chip. */
  tone?: 'neutral' | 'red' | 'green' | 'ink'
  /** Ícone opcional à esquerda. */
  icon?: React.ReactNode
}

const TONE_CLASS: Record<NonNullable<AdminSummaryStat['tone']>, string> = {
  neutral: 'bg-white text-[#1C1B1A] border-[#E8E0D5]',
  red: 'bg-[#F7E4E2] text-[#8E1519] border-[#C1272D]/25',
  green: 'bg-[#EAF4EC] text-[#2E7D4F] border-[#2E7D4F]/25',
  ink: 'bg-[#1C1B1A] text-[#FAF6F0] border-[#1C1B1A]',
}

export const AdminSummary: React.FC<{ stats: AdminSummaryStat[]; className?: string }> = ({
  stats,
  className,
}) => (
  <div className={cn('grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 mb-6', className)}>
    {stats.map((s, i) => (
      <div
        key={i}
        className={cn(
          'rounded-xl border px-4 py-3 flex items-center gap-3 shadow-xs',
          TONE_CLASS[s.tone ?? 'neutral'],
        )}
      >
        {s.icon && <span className="shrink-0 opacity-80">{s.icon}</span>}
        <div className="min-w-0">
          <p className="font-serif font-bold text-xl leading-none truncate">{s.value}</p>
          <p className="text-[10px] font-semibold uppercase tracking-wider opacity-70 mt-1 truncate">
            {s.label}
          </p>
        </div>
      </div>
    ))}
  </div>
)

export const AdminEmptyState: React.FC<{
  title: string
  description: string
  /** Ação sugerida (ex.: botão de cadastro). */
  action?: React.ReactNode
  icon?: React.ReactNode
  className?: string
}> = ({ title, description, action, icon, className }) => (
  <div
    className={cn(
      'bg-white rounded-2xl border border-dashed border-[#D9D2C7] p-10 sm:p-12 text-center max-w-lg mx-auto my-6',
      className,
    )}
  >
    {icon ? (
      <div className="mx-auto mb-4 text-[#C8BFAF]">{icon}</div>
    ) : (
      <HankoStamp size="lg" className="mx-auto mb-4" />
    )}
    <h3 className="font-serif font-bold text-lg text-[#1C1B1A]">{title}</h3>
    <p className="text-xs text-[#6B6560] mt-1.5 leading-relaxed max-w-sm mx-auto">{description}</p>
    {action && <div className="mt-5">{action}</div>}
  </div>
)

export const AdminPageLoader: React.FC<{ label?: string }> = ({ label }) => (
  <div className="min-h-[60vh] flex flex-col items-center justify-center text-[#6B6560]">
    <span className="relative inline-flex mb-4">
      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#C1272D] opacity-20" />
      <Loader2 className="w-8 h-8 text-[#C1272D] animate-spin" />
    </span>
    <p className="font-serif text-sm">{label || 'Carregando...'}</p>
  </div>
)

/** Grupo de ações de linha/tabela, sempre à direita e sem espalhar. */
export const AdminRowActions: React.FC<{ children: React.ReactNode; className?: string }> = ({
  children,
  className,
}) => (
  <div className={cn('flex items-center justify-end gap-1.5 flex-wrap', className)}>{children}</div>
)
