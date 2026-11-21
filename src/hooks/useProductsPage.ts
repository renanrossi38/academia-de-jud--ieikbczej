import { useCallback, useState } from 'react'
import { Product, ProductVariation } from '@/types'
import { productsService } from '@/services/products'
import { useRealtime } from '@/hooks/use-realtime'
import { useToast } from '@/hooks/use-toast'

/**
 * Lista de produtos + variações (estoque por tamanho) + realtime.
 * Padrão AdminStudents/AdminOrders: um único hook alimenta a página inteira.
 */
export const useProductsPage = () => {
  const { toast } = useToast()
  const [products, setProducts] = useState<Product[]>([])
  const [variations, setVariations] = useState<ProductVariation[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const loadProducts = useCallback(async () => {
    setIsLoading(true)
    try {
      const [data, vars] = await Promise.all([
        productsService.listAll(),
        productsService.listAllVariations(),
      ])
      setProducts(data)
      setVariations(vars)
    } catch (err) {
      console.error('Erro ao carregar produtos:', err)
      toast({
        title: 'Erro ao carregar produtos',
        description: 'Não foi possível buscar a lista de produtos.',
        variant: 'destructive',
      })
    } finally {
      setIsLoading(false)
    }
  }, [toast])

  const upsert = useCallback((record: Product) => {
    setProducts((prev) =>
      prev.some((p) => p.id === record.id)
        ? prev.map((p) => (p.id === record.id ? record : p))
        : [record, ...prev],
    )
  }, [])

  /** Upsert de variação após salvar/remover no diálogo (mantém estoque em dia na listagem). */
  const upsertVariation = useCallback((record: ProductVariation) => {
    setVariations((prev) =>
      prev.some((v) => v.id === record.id)
        ? prev.map((v) => (v.id === record.id ? record : v))
        : [...prev, record],
    )
  }, [])

  /** Remove uma variação da listagem local (exclusão feita no diálogo). */
  const removeVariation = useCallback((id: string) => {
    setVariations((prev) => prev.filter((v) => v.id !== id))
  }, [])

  useRealtime<Product>('products', (e) => {
    if (e.action === 'delete') {
      setProducts((prev) => prev.filter((p) => p.id !== e.record.id))
      return
    }
    upsert(e.record)
  })

  useRealtime<ProductVariation & { collectionId: string; collectionName: string }>(
    'product_variations',
    (e) => {
      if (e.action === 'delete') {
        removeVariation(e.record.id)
        return
      }
      upsertVariation(e.record)
    },
  )

  return {
    products,
    setProducts,
    variations,
    isLoading,
    loadProducts,
    upsert,
    upsertVariation,
    removeVariation,
  }
}

export default useProductsPage
