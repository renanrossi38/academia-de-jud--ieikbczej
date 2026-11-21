import { useEffect, useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { toLocalDateKey } from '@/services/attendance'
import { cn } from '@/lib/utils'

const WEEKDAYS = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S']

const MONTHS_PT = [
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

interface AttendanceCalendarProps {
  /** Dia selecionado (YYYY-MM-DD), controlado pela página. */
  value: string
  /** Chamado quando o usuário clica em um dia do calendário. */
  onChange: (dateKey: string) => void
  /** Mapa "YYYY-MM-DD" → nº de marcações (dias com história ficam destacados). */
  daysWithMarkings: Record<string, number>
  /** Avisa a página qual mês está visível (para buscar os dias com marcação). */
  onMonthChange?: (year: number, month0: number) => void
}

/**
 * Calendário mensal do histórico de presenças (Judô Tatsu — branco/vermelho).
 * Clicar em um dia seleciona a data da chamada; dias com marcações ganham um
 * ponto vermelho. Grid próprio, compacto, sem dependência extra.
 */
export function AttendanceCalendar({
  value,
  onChange,
  daysWithMarkings,
  onMonthChange,
}: AttendanceCalendarProps) {
  const today = useMemo(() => toLocalDateKey(new Date()), [])
  const [viewYear, setViewYear] = useState(() => Number(value.slice(0, 4)))
  const [viewMonth0, setViewMonth0] = useState(() => Number(value.slice(5, 7)) - 1)

  // Quando a data muda por fora (input de data / realtime), o calendário segue.
  const valueYear = Number(value.slice(0, 4))
  const valueMonth0 = Number(value.slice(5, 7)) - 1
  useEffect(() => {
    if (valueYear !== viewYear || valueMonth0 !== viewMonth0) {
      setViewYear(valueYear)
      setViewMonth0(valueMonth0)
    }
  }, [valueYear, valueMonth0, viewYear, viewMonth0])

  // Avisa a página qual mês está na tela (inclusive no primeiro render).
  useEffect(() => {
    onMonthChange?.(viewYear, viewMonth0)
  }, [viewYear, viewMonth0, onMonthChange])

  const goPrev = () => {
    setViewMonth0((m) => {
      if (m === 0) {
        setViewYear((y) => y - 1)
        return 11
      }
      return m - 1
    })
  }
  const goNext = () => {
    setViewMonth0((m) => {
      if (m === 11) {
        setViewYear((y) => y + 1)
        return 0
      }
      return m + 1
    })
  }

  const cells = useMemo(() => {
    const firstWeekday = new Date(viewYear, viewMonth0, 1).getDay()
    const daysInMonth = new Date(viewYear, viewMonth0 + 1, 0).getDate()
    const list: { key: string; day: number; inMonth: boolean }[] = []
    // Dias do mês anterior que completam a primeira semana (apenas visuais).
    for (let i = firstWeekday - 1; i >= 0; i--) {
      const d = new Date(viewYear, viewMonth0, -i)
      list.push({ key: toLocalDateKey(d), day: d.getDate(), inMonth: false })
    }
    for (let day = 1; day <= daysInMonth; day++) {
      list.push({
        key: toLocalDateKey(new Date(viewYear, viewMonth0, day)),
        day,
        inMonth: true,
      })
    }
    // Completa a última semana (apenas visuais).
    while (list.length % 7 !== 0) {
      const d = new Date(viewYear, viewMonth0 + 1, (list.length % 7) - firstWeekday + 1)
      list.push({ key: toLocalDateKey(d), day: d.getDate(), inMonth: false })
    }
    return list
  }, [viewYear, viewMonth0])

  return (
    <div className="select-none" aria-label="Calendário de presenças">
      {/* Cabeçalho: mês/ano + navegação */}
      <div className="flex items-center justify-between mb-2">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={goPrev}
          aria-label="Mês anterior"
          className="h-7 w-7 text-[#6B6560] hover:text-[#C1272D] hover:bg-[#F7E4E2]/50"
        >
          <ChevronLeft className="w-4 h-4" />
        </Button>
        <span className="font-serif font-bold text-sm text-[#1C1B1A]">
          {MONTHS_PT[viewMonth0]} {viewYear}
        </span>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={goNext}
          aria-label="Próximo mês"
          className="h-7 w-7 text-[#6B6560] hover:text-[#C1272D] hover:bg-[#F7E4E2]/50"
        >
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>

      {/* Dias da semana */}
      <div className="grid grid-cols-7 gap-0.5 mb-1">
        {WEEKDAYS.map((w, i) => (
          <div
            key={`${w}-${i}`}
            className="text-center text-[10px] font-bold text-[#6B6560] font-serif uppercase"
          >
            {w}
          </div>
        ))}
      </div>

      {/* Grade do mês */}
      <div className="grid grid-cols-7 gap-0.5">
        {cells.map(({ key, day, inMonth }) => {
          const hasMarking = inMonth && !!daysWithMarkings[key]
          const isToday = key === today
          const isSelected = key === value
          return (
            <button
              key={key}
              type="button"
              disabled={!inMonth}
              onClick={() => onChange(key)}
              aria-pressed={isSelected}
              aria-label={`${day} de ${MONTHS_PT[viewMonth0]} de ${viewYear}${hasMarking ? ' — tem chamada registrada' : ''}`}
              className={cn(
                'relative h-8 w-8 sm:h-9 sm:w-9 mx-auto rounded-full text-[11px] sm:text-xs font-semibold transition-colors',
                inMonth ? 'text-[#1C1B1A] hover:bg-[#F7E4E2]/60' : 'text-[#C8BFAF] cursor-default',
                isToday && !isSelected && 'border border-[#C1272D]/40 text-[#C1272D]',
                isSelected && 'bg-[#C1272D] text-white hover:bg-[#A01E23]',
              )}
            >
              {day}
              {hasMarking && (
                <span
                  className={cn(
                    'absolute left-1/2 -translate-x-1/2 bottom-0.5 w-1 h-1 rounded-full',
                    isSelected ? 'bg-white' : 'bg-[#C1272D]',
                  )}
                />
              )}
            </button>
          )
        })}
      </div>

      {/* Legenda */}
      <div className="mt-2 flex items-center gap-1.5 text-[10px] text-[#6B6560]">
        <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#C1272D]" />
        Dia com chamada registrada
      </div>
    </div>
  )
}
