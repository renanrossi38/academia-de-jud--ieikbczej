import React from 'react'
import { OrderStatus } from '@/types'

interface OrderStatusChipProps {
  status: OrderStatus
  className?: string
}

export const OrderStatusChip: React.FC<OrderStatusChipProps> = ({ status, className = '' }) => {
  const configMap: Record<
    OrderStatus,
    { label: string; bg: string; text: string; border: string }
  > = {
    novo: {
      label: 'Novo',
      bg: 'bg-[#F7E4E2]',
      text: 'text-[#C1272D]',
      border: 'border-[#C1272D]/30',
    },
    confirmado: {
      label: 'Confirmado',
      bg: 'bg-[#FAF3D9]',
      text: 'text-[#997300]',
      border: 'border-[#C9A227]/40',
    },
    em_preparacao: {
      label: 'Em preparação',
      bg: 'bg-[#FFF3E0]',
      text: 'text-[#B26A00]',
      border: 'border-[#B26A00]/30',
    },
    pronto: {
      label: 'Pronto',
      bg: 'bg-[#E8F5E9]',
      text: 'text-[#2E7D4F]',
      border: 'border-[#2E7D4F]/30',
    },
    entregue: {
      label: 'Entregue',
      bg: 'bg-[#ECEFF1]',
      text: 'text-[#4A5A6A]',
      border: 'border-[#4A5A6A]/30',
    },
    cancelado: {
      label: 'Cancelado',
      bg: 'bg-[#F5F5F5]',
      text: 'text-[#8A8580]',
      border: 'border-[#8A8580]/30',
    },
  }

  const current = configMap[status] || configMap.novo

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border transition-all select-none ${current.bg} ${current.text} ${current.border} ${className}`}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-current mr-1.5 opacity-80" />
      {current.label}
    </span>
  )
}
