import pb from '@/lib/pocketbase/client'
import { OrderStatus, OrderStatusLog, OrderTrackingStep } from '@/types'

/** Entrada de order_status_log aceita pela timeline (id/created/status/por). */
export type StatusLogEntry = Pick<
  OrderStatusLog,
  'id' | 'created' | 'from_status' | 'to_status'
> & {
  /** Nome de quem registrou (expand.user.name) — ausente = "Sistema". */
  user?: string
  expand?: { user?: { name?: string } }
}

/** Entrada de order_tracking aceita pela timeline (id/created/label/por). */
export type TrackingStepEntry = Pick<OrderTrackingStep, 'id' | 'created' | 'label'> & {
  /** Nome de quem registrou (expand.user.name) — ausente = "Academia". */
  user?: string
  expand?: { user?: { name?: string } }
}

/** Evento único da linha do tempo do pedido (mescla status + etapas). */
export interface TrackingEvent {
  id: string
  /** "status" = mudança de status; "etapa" = etapa personalizada do admin. */
  kind: 'status' | 'etapa'
  at: string // ISO
  /** Quem registrou ("Sistema" quando não há usuário). */
  by: string
  /** Para kind = "status". */
  fromStatus?: string
  toStatus?: string
  /** Para kind = "etapa". */
  label?: string
  /** id do registro em order_tracking (para o admin remover a etapa). */
  trackingId?: string
}

/** Serviço: etapas de rastreio personalizadas do pedido (order_tracking). */
export const orderTrackingService = {
  /** Etapas de um pedido (do mais antigo ao mais recente), com autor expandido. */
  async listByOrder(orderId: string): Promise<OrderTrackingStep[]> {
    try {
      return await pb.collection('order_tracking').getFullList<OrderTrackingStep>({
        filter: `order = "${orderId}"`,
        expand: 'user',
        sort: 'created',
      })
    } catch (_) {
      // Sem permissão ou erro: rastreio vazio (aluno só vê quando permitido).
      return []
    }
  },

  /** Admin: adiciona uma etapa de rastreio ao pedido. O user vem do hook. */
  async addStep(orderId: string, label: string): Promise<OrderTrackingStep> {
    return pb.collection('order_tracking').create<OrderTrackingStep>({
      order: orderId,
      label,
    })
  },

  /** Admin: remove uma etapa registrada por engano. */
  async removeStep(trackingId: string): Promise<void> {
    await pb.collection('order_tracking').delete(trackingId)
  },
}

/** Rótulos legíveis dos status do pedido (compartilhado admin + aluno). */
export const STATUS_LABELS: Record<OrderStatus, string> = {
  novo: 'Novo',
  confirmado: 'Confirmado',
  em_preparacao: 'Em preparação',
  pronto: 'Pronto',
  entregue: 'Entregue',
  cancelado: 'Cancelado',
}

/**
 * Mescla mudanças de status (order_status_log) e etapas personalizadas
 * (order_tracking) numa única linha do tempo, do mais recente ao mais antigo.
 */
export function listTrackingEvents(
  statusLog: StatusLogEntry[],
  tracking: TrackingStepEntry[],
): TrackingEvent[] {
  const events: TrackingEvent[] = []

  for (const entry of statusLog) {
    events.push({
      id: entry.id,
      kind: 'status',
      at: entry.created,
      by: entry.expand?.user?.name || 'Sistema',
      fromStatus: entry.from_status,
      toStatus: entry.to_status,
    })
  }

  for (const step of tracking) {
    events.push({
      id: `trk-${step.id}`,
      kind: 'etapa',
      at: step.created,
      by: step.expand?.user?.name || 'Academia',
      label: step.label,
      trackingId: step.id,
    })
  }

  // Mais recente em cima (empate: etapas personalizadas antes do status).
  events.sort((a, b) => {
    const diff = new Date(b.at).getTime() - new Date(a.at).getTime()
    if (diff !== 0) return diff
    const rank = (e: TrackingEvent) => (e.kind === 'etapa' ? 0 : 1)
    return rank(a) - rank(b)
  })

  return events
}

/**
 * Cor da bolinha do evento na timeline:
 * etapa personalizada = vermelho do tema; mudança de status = cor do status
 * de destino; evento cujo destino é o STATUS ATUAL = destaque cheio.
 */
export function statusEventDot(event: TrackingEvent, currentStatus?: OrderStatus): string {
  if (event.kind === 'etapa') {
    return 'bg-[#C1272D] border-[#C1272D] text-white'
  }
  const to = event.toStatus as OrderStatus | undefined
  if (to && to === currentStatus) {
    return 'bg-[#1C1B1A] border-[#1C1B1A] text-white'
  }
  switch (to) {
    case 'novo':
      return 'bg-[#F7E4E2] border-[#C1272D]/50 text-[#C1272D]'
    case 'confirmado':
      return 'bg-[#FAF3D9] border-[#C9A227]/60 text-[#997300]'
    case 'em_preparacao':
      return 'bg-[#FFF3E0] border-[#B26A00]/50 text-[#B26A00]'
    case 'pronto':
      return 'bg-[#E8F5E9] border-[#2E7D4F]/50 text-[#2E7D4F]'
    case 'entregue':
      return 'bg-[#ECEFF1] border-[#4A5A6A]/50 text-[#4A5A6A]'
    case 'cancelado':
      return 'bg-[#F5F5F5] border-[#8A8580]/50 text-[#8A8580]'
    default:
      return 'bg-[#FAF6F0] border-[#E8E0D5] text-[#6B6560]'
  }
}
