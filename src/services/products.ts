import pb from '@/lib/pocketbase/client'
import { Product, ProductVariation } from '@/types'

export const productsService = {
  async listActive(): Promise<Product[]> {
    const records = await pb.collection('products').getFullList<Product>({
      filter: 'active = true',
      sort: '-created',
    })
    return records
  },

  async getBySlug(slug: string): Promise<Product | null> {
    try {
      const record = await pb
        .collection('products')
        .getFirstListItem<Product>(`slug = "${slug}" && active = true`)
      return record
    } catch (_) {
      return null
    }
  },

  async getById(id: string): Promise<Product | null> {
    try {
      const record = await pb.collection('products').getOne<Product>(id)
      return record
    } catch (_) {
      return null
    }
  },

  async listVariations(productId: string): Promise<ProductVariation[]> {
    const records = await pb.collection('product_variations').getFullList<ProductVariation>({
      filter: `product = "${productId}"`,
      sort: 'price_delta',
    })
    return records
  },

  async listRelated(category: string, currentProductId: string, limit = 3): Promise<Product[]> {
    try {
      const records = await pb.collection('products').getList<Product>(1, limit, {
        filter: `category = "${category}" && id != "${currentProductId}" && active = true`,
        sort: '-created',
      })
      return records.items
    } catch (_) {
      return []
    }
  },

  getImageUrl(product: Product): string | null {
    if (!product.image) return null
    return pb.files.getURL(product, product.image)
  },
}
