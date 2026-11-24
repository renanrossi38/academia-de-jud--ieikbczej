import { ReactNode, useId } from 'react'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'

/**
 * Campos de formulário reutilizáveis do editor da home (/painel/site).
 * Mantidos num módulo próprio para que a página fique só com a organização
 * em seções e a lógica de salvar.
 */

export type SiteForm = Record<string, string>

interface FieldBaseProps {
  label: string
  value: string
  onChange: (v: string) => void
  hint?: string
  placeholder?: string
}

export const SiteInput = ({
  label,
  value,
  onChange,
  hint,
  placeholder,
  maxLength = 120,
}: FieldBaseProps & { maxLength?: number }) => {
  const id = useId()
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-sm font-medium">
        {label}
      </Label>
      <Input
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        maxLength={maxLength}
      />
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  )
}

export const SiteTextarea = ({
  label,
  value,
  onChange,
  hint,
  placeholder,
  rows = 3,
  maxLength = 400,
}: FieldBaseProps & { rows?: number }) => {
  const id = useId()
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-sm font-medium">
        {label}
      </Label>
      <Textarea
        id={id}
        value={value}
        rows={rows}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        maxLength={maxLength}
      />
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  )
}

/** Uma seção do editor: título, descrição opcional e os campos. */
export const SiteSection = ({
  title,
  description,
  icon,
  children,
}: {
  title: string
  description?: string
  icon?: ReactNode
  children: ReactNode
}) => (
  <section className="rounded-xl border bg-card p-5 space-y-4">
    <div className="flex items-start gap-3">
      {icon && (
        <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#C1272D]/10 text-[#C1272D]">
          {icon}
        </span>
      )}
      <div>
        <h2 className="font-serif font-bold text-lg leading-tight">{title}</h2>
        {description && <p className="text-xs text-muted-foreground mt-0.5">{description}</p>}
      </div>
    </div>
    {children}
  </section>
)
