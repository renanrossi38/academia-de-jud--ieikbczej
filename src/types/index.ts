export type UserRole = 'admin' | 'aluno'

export type Belt =
  | 'branca'
  | 'cinza'
  | 'amarela'
  | 'laranja'
  | 'verde'
  | 'azul'
  | 'roxa'
  | 'marrom'
  | 'preta'

export interface User {
  id: string
  email: string
  name: string
  avatar?: string
  role: UserRole
  phone?: string
  belt?: Belt
  active?: boolean
  created: string
  updated: string
}

/** Aluno da academia (controle interno). E-mail e conta de acesso são opcionais. */
export interface Student {
  id: string
  name: string
  phone?: string
  belt?: Belt | ''
  email?: string
  active: boolean
  /** Conta de acesso ao site (users), quando já criada. */
  user?: string
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

export type AttendanceStatus = 'presente' | 'ausente' | 'justificado'

export interface Attendance {
  collectionId: string
  collectionName: string
  id: string
  student: string
  date: string
  status: AttendanceStatus
  notes?: string
  created: string
  updated: string
  expand?: {
    student?: Student
  }
}
