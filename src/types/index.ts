export type UserRole = 'admin' | 'aluno'

export interface User {
  id: string
  email: string
  name: string
  avatar?: string
  role: UserRole
  created: string
  updated: string
}

export type ProductCategory = 'uniformes' | 'faixas' | 'equipamentos' | 'planos'

export interface Product {
  id: string
  name: string
  slug: string
  description: string
  price: number
  image?: string
  category: ProductCategory
  active: boolean
  created: string
  updated: string
}

export interface ProductVariation {
  id: string
  product: string
  label: string
  price_delta: number
  stock: number
  created: string
  updated: string
}

export type OrderStatus =
  | 'novo'
  | 'confirmado'
  | 'em_preparacao'
  | 'pronto'
  | 'entregue'
  | 'cancelado'
export type DeliveryType = 'retirada' | 'entrega'

export interface Order {
  id: string
  user: string
  status: OrderStatus
  total: number
  customer_name: string
  phone: string
  delivery_type: DeliveryType
  address?: string
  notes?: string
  created: string
  updated: string
}

export interface OrderItem {
  id: string
  order: string
  product: string
  variation?: string
  product_name: string
  variation_label?: string
  unit_price: number
  quantity: number
  subtotal: number
  created: string
  updated: string
}

export interface CartItem {
  productId: string
  productName: string
  productSlug: string
  productImage?: string
  category: ProductCategory
  variationId?: string
  variationLabel?: string
  unitPrice: number
  quantity: number
}
