import { useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ClassWeekday } from '@/services/classes'

/**
 * Calendário do formulário de aula experimental: destaca somente os dias
 * DISPONÍVEIS para agendar a turma selecionada — dia de aula da turma
 * (classes.weekdays), dentro do intervalo consultável (hoje → ~1 ano), e que
 * ainda NÃO tenha agendamento para aquela turma (datas ocupadas vindas da rota
 * pública /backend/v1/trial-availability). Dias indisponíveis (sem aula, já
 * reservado, passado ou além do limite) ficam desabilitados e visualmente
 * distintos (riscados/muted), conforme o pedido do usuário.
 */

/** Domingo = 0 … Sábado = 6 (getDay) → chave da migration 0041. */
const DOW_KEY = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sab'] as const

const SEMANA_CURTA = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'] as const

const MESES = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
]

export type TrialDayState = 'available' | 'occupied' | 'offday' | 'out'

interface TrialCalendarProps {
  /** Dias de aula da turma (classes.weekdays) — vazio = qualquer dia. */
  weekdays: ClassWeekday[]
  /** Datas já com agendamento não-cancelado para a turma ("YYYY-MM-DD"). */
  occupied: string[]
  minDate: string
  maxDate: string
  value: string
  onChange: (date: string) => void
  /** Sem turma selecionada: nenhum dia é clicável. */
  disabled?: boolean
}

function dataLegivel(key: string): string {
  const d = new Date(key + 'T12:00:00')
  return d.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })
}

function chave(y: number, m: number, d: number): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${y}-${pad(m + 1)}-${pad(d)}`
}

export function TrialCalendar({
  weekdays,
  occupied,
  minDate,
  maxDate,
  value,
  onChange,
  disabled = false,
}: TrialCalendarProps) {
  const minChave = minDate.slice(0, 10)
  const maxChave = maxDate.slice(0, 10)

  // Mês exibido: o do valor selecionado, senão o do mínimo (hoje), limitado ao intervalo.
  const [cursor, setCursor] = useState(() => {
    const base = (value || minDate).slice(0, 10)
    const y = +base.slice(0, 4)
    const m = +base.slice(5, 7) - 1
    const minY = +minChave.slice(0, 4)
    const minM = +minChave.slice(5, 7) - 1
    const maxY = +maxChave.slice(0, 4)
    const maxM = +maxChave.slice(5, 7) - 1
    return { y: Math.min(Math.max(y, minY), maxY), m: Math.min(Math.max(m, minM), maxM) }
  })

  const { y, m } = cursor
  const prevDisabled =
    y < +minChave.slice(0, 4) || (y === +minChave.slice(0, 4) && m <= +minChave.slice(5, 7) - 1)
  const nextDisabled =
    y > +maxChave.slice(0, 4) || (y === +maxChave.slice(0, 4) && m >= +maxChave.slice(5, 7) - 1)

  const occupiedSet = useMemo(() => new Set(occupied), [occupied])

  const days = useMemo(() => {
    const firstDow = new Date(y, m, 1).getDay()
    const daysInMonth = new Date(y, m + 1, 0).getDate()
    const out: (null | { key: string; day: number; state: TrialDayState })[] = []
    for (let i = 0; i < firstDow; i++) out.push(null)
    for (let d = 1; d <= daysInMonth; d++) {
      const key = chave(y, m, d)
      let state: TrialDayState
      if (key < minChave || key > maxChave) state = 'out'
      else if (
        weekdays.length > 0 &&
        !weekdays.includes(DOW_KEY[new Date(y, m, d).getDay()] as ClassWeekday)
      )
        state = 'offday'
      else if (occupiedSet.has(key)) state = 'occupied'
      else state = 'available'
      out.push({ key, day: d, state })
    }
    return out
  }, [y, m, weekdays, occupiedSet, minChave, maxChave])

  const movMes = (delta: number) => {
    const nm = m + delta
    setCursor({ y: nm < 0 ? y - 1 : nm > 11 ? y + 1 : y, m: nm < 0 ? 11 : nm > 11 ? 0 : nm })
  }

  return (
    <div className="rounded-xl border border-[#E8E0D5] bg-[#FAF6F0] p-3">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => movMes(-1)}
          disabled={prevDisabled || disabled}
          aria-label="Mês anterior"
          className="rounded-md p-1.5 text-[#6B6560] hover:bg-[#E8E0D5] disabled:opacity-30"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span className="text-sm font-bold text-[#1C1B1A]" aria-live="polite">
          {MESES[m]} de {y}
        </span>
        <button
          type="button"
          onClick={() => movMes(1)}
          disabled={nextDisabled || disabled}
          aria-label="Próximo mês"
          className="rounded-md p-1.5 text-[#6B6560] hover:bg-[#E8E0D5] disabled:opacity-30"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      <div
        className="mt-2 grid grid-cols-7 gap-1 text-center"
        role="group"
        aria-label="Calendário de dias disponíveis para agendar"
      >
        {SEMANA_CURTA.map((s) => (
          <span key={s} aria-hidden className="text-[10px] font-bold uppercase text-[#6B6560]">
            {s}
          </span>
        ))}
        {days.map((cell, i) =>
          cell === null ? (
            <span key={`b-${i}`} aria-hidden />
          ) : (
            <button
              key={cell.key}
              type="button"
              disabled={disabled || cell.state !== 'available'}
              onClick={() => onChange(cell.key)}
              aria-pressed={value === cell.key}
              aria-label={`${dataLegivel(cell.key)} — ${
                cell.state === 'available'
                  ? 'disponível'
                  : cell.state === 'occupied'
                    ? 'já reservado'
                    : 'indisponível'
              }`}
              title={
                cell.state === 'occupied'
                  ? 'Já reservado para esta turma'
                  : cell.state === 'offday'
                    ? 'Dia sem aula desta turma'
                    : undefined
              }
              className={cn(
                'flex h-9 items-center justify-center rounded-md text-xs font-semibold transition-colors',
                cell.state === 'available' &&
                  'border border-[#C1272D]/40 bg-[#F7E4E2] text-[#1C1B1A] hover:bg-[#C1272D] hover:text-white',
                cell.state === 'occupied' &&
                  'cursor-not-allowed bg-[#F3EFE8] text-[#6B6560] line-through decoration-[#C1272D]/60',
                (cell.state === 'offday' || cell.state === 'out') &&
                  'cursor-not-allowed text-[#C4BCB2]',
                value === cell.key && 'bg-[#C1272D] text-white hover:bg-[#A01E23]',
                disabled && 'opacity-50',
              )}
            >
              {cell.day}
            </button>
          ),
        )}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px] text-[#6B6560]">
        <span className="inline-flex items-center gap-1">
          <span
            aria-hidden
            className="inline-block h-2.5 w-2.5 rounded-sm border border-[#C1272D]/40 bg-[#F7E4E2]"
          />
          Disponível
        </span>
        <span className="inline-flex items-center gap-1">
          <span
            aria-hidden
            className="inline-block h-2.5 w-2.5 rounded-sm bg-[#F3EFE8] line-through decoration-[#C1272D]/60"
          />
          Já reservado
        </span>
        <span className="inline-flex items-center gap-1">
          <span
            aria-hidden
            className="inline-block h-2.5 w-2.5 rounded-sm bg-white text-[#C4BCB2]"
          />
          Sem aula da turma / fora do período
        </span>
      </div>
    </div>
  )
}
