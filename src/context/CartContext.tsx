import React, { createContext, useContext, useEffect, useState } from 'react'
import { CartItem } from '@/types'
import { useToast } from '@/hooks/use-toast'

interface CartContextType {
  items: CartItem[]
  addItem: (item: CartItem) => void
  removeItem: (
    productId: string,
    variationId?: string,
    customAnswers?: Record<string, string>,
  ) => void
  updateQuantity: (
    productId: string,
    variationId: string | undefined,
    quantity: number,
    customAnswers?: Record<string, string>,
  ) => void
  clearCart: () => void
  itemCount: number
  total: number
  isDrawerOpen: boolean
  setIsDrawerOpen: (open: boolean) => void
  badgeAnimate: boolean
}

const CartContext = createContext<CartContextType | undefined>(undefined)

const CART_STORAGE_KEY = 'judo_tatsu_cart_v1'

/** Chave de identidade do item: produto + variação + respostas sob medida. */
const itemKey = (item: Pick<CartItem, 'productId' | 'variationId' | 'customAnswers'>): string => {
  const answers = item.customAnswers
    ? Object.keys(item.customAnswers)
        .sort()
        .map((k) => `${k}=${item.customAnswers![k]}`)
        .join('&')
    : ''
  return `${item.productId}|${item.variationId || ''}|${answers}`
}

/** Resumo curto das respostas sob medida para exibir em toasts. */
const answersSummary = (item: CartItem): string =>
  item.customAnswers && Object.keys(item.customAnswers).length > 0
    ? ' — ' +
      Object.entries(item.customAnswers)
        .map(([k, v]) => `${k}: ${v}`)
        .join(', ')
    : ''

export const CartProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [items, setItems] = useState<CartItem[]>(() => {
    try {
      const saved = localStorage.getItem(CART_STORAGE_KEY)
      return saved ? JSON.parse(saved) : []
    } catch (_) {
      return []
    }
  })

  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
  const [badgeAnimate, setBadgeAnimate] = useState(false)
  const { toast } = useToast()

  useEffect(() => {
    try {
      localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items))
    } catch {
      /* intentionally ignored */
    }
  }, [items])

  const triggerBadgePop = () => {
    setBadgeAnimate(true)
    setTimeout(() => setBadgeAnimate(false), 300)
  }

  const addItem = (item: CartItem) => {
    setItems((prev) => {
      const existingIdx = prev.findIndex((i) => itemKey(i) === itemKey(item))

      if (existingIdx >= 0) {
        const updated = [...prev]
        updated[existingIdx].quantity += item.quantity
        return updated
      }
      return [...prev, item]
    })

    triggerBadgePop()
    setIsDrawerOpen(true)
    toast({
      title: 'Item adicionado ao carrinho',
      description: `${item.productName}${item.variationLabel ? ` (${item.variationLabel})` : ''}${answersSummary(item)}`,
    })
  }

  const removeItem = (
    productId: string,
    variationId?: string,
    customAnswers?: Record<string, string>,
  ) => {
    setItems((prev) =>
      prev.filter((i) => itemKey(i) !== itemKey({ productId, variationId, customAnswers })),
    )
    triggerBadgePop()
  }

  const updateQuantity = (
    productId: string,
    variationId: string | undefined,
    quantity: number,
    customAnswers?: Record<string, string>,
  ) => {
    if (quantity <= 0) {
      removeItem(productId, variationId, customAnswers)
      return
    }
    setItems((prev) =>
      prev.map((i) => {
        if (itemKey(i) === itemKey({ productId, variationId, customAnswers })) {
          return { ...i, quantity }
        }
        return i
      }),
    )
    triggerBadgePop()
  }

  const clearCart = () => {
    setItems([])
    try {
      localStorage.removeItem(CART_STORAGE_KEY)
    } catch {
      /* intentionally ignored */
    }
  }

  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0)
  const total = items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0)

  return (
    <CartContext.Provider
      value={{
        items,
        addItem,
        removeItem,
        updateQuantity,
        clearCart,
        itemCount,
        total,
        isDrawerOpen,
        setIsDrawerOpen,
        badgeAnimate,
      }}
    >
      {children}
    </CartContext.Provider>
  )
}

export const useCart = () => {
  const context = useContext(CartContext)
  if (!context) {
    throw new Error('useCart must be used within a CartProvider')
  }
  return context
}
