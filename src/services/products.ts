import pb from '@/lib/pocketbase/client'
import { CustomField, Product, ProductCategory, ProductVariation } from '@/types'

/** Gera um slug URL-safe a partir do nome (ex.: "Kimono Branco A2" → "kimono-branco-a2"). */
export const slugify = (name: string): string =>
  name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)

export interface CreateProductInput {
  name: string
  slug?: string
  description?: string
  price: number
  category: ProductCategory
  active?: boolean
  image?: File | null
  /** Campos personalizados (produto sob medida). Vazio/null = produto comum. */
  custom_options?: CustomField[] | null
}

export interface UpdateProductInput {
  name?: string
  slug?: string
  description?: string
  price?: number
  category?: ProductCategory
  active?: boolean
  image?: File | null
  /** Sinaliza remoção da imagem atual (PocketBase: campo "image-"). */
  removeImage?: boolean
  /** Campos personalizados (produto sob medida). Vazio/null = produto comum. */
  custom_options?: CustomField[] | null
}

export interface CreateVariationInput {
  product: string
  label: string
  price_delta?: number
  stock?: number
}

export interface UpdateVariationInput {
  label?: string
  price_delta?: number
  stock?: number
}

export const productsService = {
  async listActive(): Promise<Product[]> {
    const records = await pb.collection('products').getFullList<Product>({
      filter: 'active = true',
      sort: '-created',
    })
    return records
  },

  /** Todos os produtos (inclusive inativos) — uso do painel admin. */
  async listAll(): Promise<Product[]> {
    return pb.collection('products').getFullList<Product>({ sort: '-created' })
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

  async create(input: CreateProductInput): Promise<Product> {
    const payload = new FormData()
    payload.append('name', input.name.trim())
    payload.append('slug', (input.slug?.trim() || slugify(input.name)).toLowerCase())
    payload.append('description', input.description?.trim() || '')
    payload.append('price', String(input.price))
    payload.append('category', input.category)
    payload.append('active', String(input.active ?? true))
    payload.append(
      'custom_options',
      JSON.stringify(input.custom_options?.length ? input.custom_options : null),
    )
    if (input.image) payload.append('image', input.image)
    return pb.collection('products').create<Product>(payload)
  },

  async update(id: string, input: UpdateProductInput): Promise<Product> {
    const payload = new FormData()
    if (input.name !== undefined) payload.append('name', input.name.trim())
    if (input.slug !== undefined)
      payload.append('slug', (input.slug.trim() || slugify(input.name || '')).toLowerCase())
    if (input.description !== undefined) payload.append('description', input.description.trim())
    if (input.price !== undefined) payload.append('price', String(input.price))
    if (input.category !== undefined) payload.append('category', input.category)
    if (input.active !== undefined) payload.append('active', String(input.active))
    if (input.custom_options !== undefined)
      payload.append(
        'custom_options',
        JSON.stringify(input.custom_options?.length ? input.custom_options : null),
      )
    if (input.image) payload.append('image', input.image)
    if (input.removeImage) payload.append('image-', '')
    return pb.collection('products').update<Product>(id, payload)
  },

  async delete(id: string): Promise<void> {
    await pb.collection('products').delete(id)
  },

  /** Todas as variações do catálogo (agrupadas por product na UI) — painel admin. */
  async listAllVariations(): Promise<ProductVariation[]> {
    return pb.collection('product_variations').getFullList<ProductVariation>({
      sort: 'product,price_delta,label',
    })
  },

  async listVariations(productId: string): Promise<ProductVariation[]> {
    const records = await pb.collection('product_variations').getFullList<ProductVariation>({
      filter: `product = "${productId}"`,
      sort: 'price_delta',
    })
    return records
  },

  async createVariation(input: CreateVariationInput): Promise<ProductVariation> {
    return pb.collection('product_variations').create<ProductVariation>({
      product: input.product,
      label: input.label.trim(),
      price_delta: input.price_delta ?? 0,
      stock: input.stock ?? 0,
    })
  },

  async updateVariation(id: string, input: UpdateVariationInput): Promise<ProductVariation> {
    return pb.collection('product_variations').update<ProductVariation>(id, {
      ...input,
      ...(input.label !== undefined ? { label: input.label.trim() } : {}),
    })
  },

  async deleteVariation(id: string): Promise<void> {
    await pb.collection('product_variations').delete(id)
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
