import pb from '@/lib/pocketbase/client'
import { Order, OrderItem, OrderStatus, DeliveryType } from '@/types'

export interface CreateOrderInput {
  customer_name: string
  phone: string
  delivery_type: DeliveryType
  address?: string
  notes?: string
  items: Array<{
    productId: string
    productName: string
    variationId?: string
    variationLabel?: string
    unitPrice: number
    quantity: number
    /** Respostas dos campos personalizados (produto sob medida). */
    customAnswers?: Record<string, string>
  }>
}

export const ordersService = {
  async createOrder(input: CreateOrderInput): Promise<Order> {
    const authUser = pb.authStore.record
    if (!authUser) {
      throw new Error('Usuário precisa estar autenticado para finalizar o pedido')
    }

    const total = input.items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0)

    const orderRecord = await pb.collection('orders').create<Order>({
      user: authUser.id,
      status: 'novo',
      total,
      customer_name: input.customer_name,
      phone: input.phone,
      delivery_type: input.delivery_type,
      address: input.delivery_type === 'entrega' ? input.address : '',
      notes: input.notes || '',
    })

    // Create order items
    for (const item of input.items) {
      const subtotal = item.unitPrice * item.quantity
      await pb.collection('order_items').create<OrderItem>({
        order: orderRecord.id,
        product: item.productId,
        variation: item.variationId || null,
        product_name: item.productName,
        variation_label: item.variationLabel || '',
        unit_price: item.unitPrice,
        quantity: item.quantity,
        subtotal,
        ...(item.customAnswers && Object.keys(item.customAnswers).length > 0
          ? { custom_answers: item.customAnswers }
          : {}),
      })
    }

    return orderRecord
  },

  async getOrderById(id: string): Promise<Order | null> {
    try {
      const order = await pb.collection('orders').getOne<Order>(id)
      return order
    } catch (_) {
      return null
    }
  },

  async getOrderItems(orderId: string): Promise<OrderItem[]> {
    try {
      const items = await pb.collection('order_items').getFullList<OrderItem>({
        filter: `order = "${orderId}"`,
        sort: 'created',
      })
      return items
    } catch (_) {
      return []
    }
  },

  async listUserOrders(): Promise<Order[]> {
    const authUser = pb.authStore.record
    if (!authUser) return []
    try {
      const orders = await pb.collection('orders').getFullList<Order>({
        filter: `user = "${authUser.id}"`,
        sort: '-created',
      })
      return orders
    } catch (_) {
      return []
    }
  },

  async listAllOrders(): Promise<Order[]> {
    const orders = await pb.collection('orders').getFullList<Order>({
      sort: '-created',
    })
    return orders
  },

  async updateOrderStatus(orderId: string, status: OrderStatus): Promise<Order> {
    const updated = await pb.collection('orders').update<Order>(orderId, { status })
    return updated
  },
}
