import pb from '@/lib/pocketbase/client'
import { Order } from '@/types'

/**
 * Pedidos da loja de um aluno. A collection "orders" só se vincula à conta de
 * acesso (users), então o painel passa o id do user vinculado ao student.
 */
export const studentOrdersService = {
  async listByUser(userId: string): Promise<Order[]> {
    return pb.collection('orders').getFullList<Order>({
      filter: `user = "${userId}"`,
      sort: '-created',
    })
  },
}
