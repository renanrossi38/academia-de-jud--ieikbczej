import { useCallback, useState } from 'react'
import { Product } from '@/types'
import { productsService } from '@/services/products'
import { useRealtime } from '@/hooks/use-realtime'
import { useToast } from '@/hooks/use-toast'

/** Lista de produtos + realtime (padrão AdminStudents). */
export const useProductsPage = () => {
  const { toast } = useToast()
  const [products, setProducts] = useState<Product[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const loadProducts = useCallback(async () => {
    setIsLoading(true)
    try {
      const data = await productsService.listAll()
      setProducts(data)
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

  useRealtime<Product>('products', (e) => {
    if (e.action === 'delete') {
      setProducts((prev) => prev.filter((p) => p.id !== e.record.id))
      return
    }
    upsert(e.record)
  })

  return { products, setProducts, isLoading, loadProducts, upsert }
}

export default useProductsPage
