import { Loader2, Package, History, Trash2 } from 'lucide-react'
import { OrderStatus } from '@/types'
import {
  TrackingEvent,
  StatusLogEntry,
  TrackingStepEntry,
  STATUS_LABELS,
  statusEventDot,
  listTrackingEvents,
} from '@/services/orderTracking'
import { cn } from '@/lib/utils'

interface OrderTrackingTimelineProps {
  /** Log de mudanças de status (order_status_log). */
  statusLog: StatusLogEntry[]
  /** Etapas personalizadas do admin (order_tracking). */
  tracking: TrackingStepEntry[]
  /** Status atual do pedido (destaque da etapa mais recente). */
  currentStatus?: OrderStatus
  /** Admin: permite remover etapa personalizada com confirmação (no pai). */
  onDeleteStep?: (trackingId: string, label: string) => void
  /** id da etapa sendo removida (feedback de carregando). */
  deletingStepId?: string | null
  /** Somente leitura (área do aluno): nunca mostra o botão remover. */
  readOnly?: boolean
  emptyText?: string
}

/**
 * Timeline vertical estilo rastreio dos Correios: bolinha + linha conectora,
 * etapa mais recente no topo, com data/hora e "por <nome>" em cada evento.
 * Mistura mudanças de status (order_status_log) e etapas personalizadas
 * (order_tracking) numa única linha do tempo.
 */
export function OrderTrackingTimeline({
  statusLog,
  tracking,
  currentStatus,
  onDeleteStep,
  deletingStepId,
  readOnly = false,
  emptyText = 'Nenhum evento de rastreio ainda.',
}: OrderTrackingTimelineProps) {
  const events = listTrackingEvents(statusLog, tracking)

  if (events.length === 0) {
    return (
      <p className="text-xs text-[#6B6560] italic p-3 border border-dashed border-[#E8E0D5] rounded-xl">
        {emptyText}
      </p>
    )
  }

  return (
    <ol className="relative ml-1 space-y-0">
      {events.map((event, idx) => (
        <li key={event.id} className="relative pl-7 pb-5 last:pb-0">
          {/* Linha conectora */}
          {idx < events.length - 1 && (
            <span className="absolute left-[9px] top-5 bottom-0 w-px bg-[#E8E0D5]" aria-hidden />
          )}
          {/* Bolinha do evento */}
          <span
            className={cn(
              'absolute left-0 top-0.5 w-[19px] h-[19px] rounded-full border-2 flex items-center justify-center',
              statusEventDot(event, currentStatus),
            )}
            aria-hidden
          >
            {event.kind === 'etapa' ? (
              <Package className="w-2.5 h-2.5" strokeWidth={2.5} />
            ) : (
              <History className="w-2.5 h-2.5" strokeWidth={2.5} />
            )}
          </span>

          <div className="min-w-0">
            <p
              className={cn(
                'text-xs leading-snug break-words',
                event.kind === 'etapa' ? 'text-[#1C1B1A] font-semibold' : 'text-[#1C1B1A]',
              )}
            >
              {event.kind === 'etapa' ? (
                event.label
              ) : (
                <>
                  {event.fromStatus ? (
                    <>
                      Status: {STATUS_LABELS[event.fromStatus as OrderStatus] ?? event.fromStatus}{' '}
                      <span className="text-[#6B6560]">→</span>{' '}
                      <strong>
                        {STATUS_LABELS[event.toStatus as OrderStatus] ?? event.toStatus}
                      </strong>
                    </>
                  ) : (
                    <>
                      Status:{' '}
                      <strong>
                        {STATUS_LABELS[event.toStatus as OrderStatus] ?? event.toStatus}
                      </strong>
                    </>
                  )}
                </>
              )}
            </p>
            <p className="text-[11px] text-[#6B6560] mt-0.5">
              {fmtWhen(event.at)} • por <strong className="font-medium">{event.by}</strong>
            </p>

            {/* Admin: remover etapa digitada errada (confirmação feita no pai) */}
            {!readOnly && onDeleteStep && event.kind === 'etapa' && event.trackingId && (
              <button
                type="button"
                onClick={() => onDeleteStep(event.trackingId as string, event.label || '')}
                disabled={deletingStepId === event.trackingId}
                className="mt-1 inline-flex items-center gap-1 text-[10px] font-semibold text-[#C1272D]/80 hover:text-[#C1272D] disabled:opacity-50"
              >
                {deletingStepId === event.trackingId ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <Trash2 className="w-3 h-3" />
                )}
                Remover etapa
              </button>
            )}
          </div>
        </li>
      ))}
    </ol>
  )
}

function fmtWhen(iso: string): string {
  const d = new Date(iso)
  return (
    d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) +
    ' às ' +
    d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  )
}
