import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { HankoStamp } from '@/components/HankoStamp'
import { ProductFormDialog, categoryLabel } from '@/components/admin/ProductDialogs'
import { useProductsPage } from '@/hooks/useProductsPage'
import { Product } from '@/types'
import { productsService } from '@/services/products'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { useToast } from '@/hooks/use-toast'
import {
  Loader2,
  Search,
  Package,
  Pencil,
  ToggleLeft,
  ToggleRight,
  Trash2,
  Plus,
} from 'lucide-react'

const brl = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

export default function AdminProducts() {
  const { user, isAdmin, isLoading: authLoading } = useAuth()
  const navigate = useNavigate()
  const { toast } = useToast()
  const { products, setProducts, isLoading, loadProducts, upsert } = useProductsPage()

  const [search, setSearch] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Product | null>(null)
  const [deleting, setDeleting] = useState<Product | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [togglingId, setTogglingId] = useState<string | null>(null)

  useEffect(() => {
    if (authLoading) return
    if (!user) {
      navigate('/entrar?redirect=/painel/produtos')
      return
    }
    if (!isAdmin) {
      toast({
        title: 'Acesso Restrito',
        description: 'Esta área é exclusiva para administradores da academia.',
        variant: 'destructive',
      })
      navigate('/')
      return
    }
    loadProducts()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, isAdmin, authLoading])

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    if (!term) return products
    return products.filter(
      (p) =>
        p.name.toLowerCase().includes(term) ||
        (p.slug || '').toLowerCase().includes(term) ||
        (p.description || '').toLowerCase().includes(term) ||
        categoryLabel(p.category).toLowerCase().includes(term),
    )
  }, [products, search])

  const handleToggleActive = async (product: Product) => {
    setTogglingId(product.id)
    try {
      const saved = await productsService.update(product.id, {
        active: !(product.active !== false),
      })
      upsert(saved)
    } catch (err: any) {
      console.error('Erro ao alterar status:', err)
      toast({
        title: 'Erro ao alterar status',
        description: err?.message || 'Tente novamente.',
        variant: 'destructive',
      })
    } finally {
      setTogglingId(null)
    }
  }

  const handleDelete = async () => {
    if (!deleting) return
    setIsDeleting(true)
    try {
      await productsService.delete(deleting.id)
      setProducts((prev) => prev.filter((p) => p.id !== deleting.id))
      toast({
        title: 'Produto excluído',
        description: `"${deleting.name}" saiu do catálogo.`,
      })
      setDeleting(null)
    } catch (err: any) {
      console.error('Erro ao excluir produto:', err)
      toast({
        title: 'Erro ao excluir produto',
        description: err?.message || 'Tente novamente.',
        variant: 'destructive',
      })
    } finally {
      setIsDeleting(false)
    }
  }

  if (authLoading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center bg-[#FAF6F0]">
        <Loader2 className="w-8 h-8 animate-spin text-[#C1272D]" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#FAF6F0]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="flex items-start justify-between gap-4 mb-8">
          <div>
            <div className="flex items-center gap-2">
              <HankoStamp size="sm" />
              <span className="text-xs font-bold text-[#C1272D] tracking-widest uppercase font-serif">
                Administração do Judô Tatsu
              </span>
            </div>
            <h1 className="font-serif font-bold text-2xl sm:text-3xl text-[#1C1B1A] mt-1">Loja</h1>
            <p className="text-sm text-[#6B6560] mt-2 max-w-xl">
              Gerencie os itens vendidos pela academia: kimonos, faixas, camisetas, equipamentos e
              planos. Produtos ativos aparecem na aba “Kimonos e Acessórios” da página inicial.
            </p>
          </div>
          <Button
            onClick={() => {
              setEditing(null)
              setFormOpen(true)
            }}
            className="bg-[#C1272D] hover:bg-[#A01E23] text-white text-xs font-semibold shrink-0"
          >
            <Plus className="w-4 h-4 mr-1.5" />
            Novo produto
          </Button>
        </div>

        <div className="relative mb-6">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9A948C]" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nome, slug ou categoria..."
            className="pl-9 h-10 bg-white border-[#E8E0D5]"
          />
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-[#C1272D]" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-2xl border border-[#E8E0D5]">
            <Package className="w-10 h-10 text-[#9A948C] mx-auto mb-3" />
            <p className="text-sm text-[#6B6560]">
              {search
                ? 'Nenhum produto encontrado para a busca.'
                : 'Nenhum produto cadastrado ainda.'}
            </p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((p) => (
              <div
                key={p.id}
                className="bg-white rounded-2xl border border-[#E8E0D5] overflow-hidden flex flex-col"
              >
                {p.image ? (
                  <img
                    src={productsService.getImageUrl(p)}
                    alt={p.name}
                    className="h-36 w-full object-cover border-b border-[#E8E0D5]"
                  />
                ) : (
                  <div className="h-36 w-full bg-[#FAF6F0] border-b border-[#E8E0D5] flex items-center justify-center">
                    <Package className="w-8 h-8 text-[#C8BFAF]" />
                  </div>
                )}
                <div className="p-4 flex-1 flex flex-col gap-2">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-serif text-sm font-bold text-[#1C1B1A] leading-snug">
                      {p.name}
                    </h3>
                    <Badge
                      className={
                        p.active !== false
                          ? 'bg-[#EAF4EC] text-[#2E7D4F] border-[#2E7D4F]/40 shrink-0'
                          : 'bg-[#F3EFE8] text-[#9A948C] border-[#D9D2C7] shrink-0'
                      }
                    >
                      {p.active !== false ? 'Ativo' : 'Inativo'}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className="bg-[#F7E4E2] text-[#C1272D] border-[#C1272D]/30">
                      {categoryLabel(p.category)}
                    </Badge>
                    <span className="text-sm font-bold text-[#C1272D]">{brl(p.price)}</span>
                  </div>
                  {p.description && (
                    <p className="text-xs text-[#6B6560] line-clamp-2">{p.description}</p>
                  )}
                  <p className="text-[10px] text-[#9A948C] font-mono">/{p.slug}</p>
                  <div className="flex gap-2 mt-auto pt-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setEditing(p)
                        setFormOpen(true)
                      }}
                      className="flex-1 text-xs border-[#E8E0D5] text-[#1C1B1A]"
                    >
                      <Pencil className="w-3.5 h-3.5 mr-1" />
                      Editar
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleToggleActive(p)}
                      disabled={togglingId === p.id}
                      className="text-xs border-[#E8E0D5] text-[#1C1B1A]"
                    >
                      {togglingId === p.id ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : p.active !== false ? (
                        <ToggleRight className="w-3.5 h-3.5" />
                      ) : (
                        <ToggleLeft className="w-3.5 h-3.5" />
                      )}
                      {p.active !== false ? 'Desativar' : 'Ativar'}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setDeleting(p)}
                      className="text-xs border-[#E8E0D5] text-[#B3261E] hover:bg-[#F7E4E2]"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <ProductFormDialog
        open={formOpen}
        editing={editing}
        onOpenChange={setFormOpen}
        onSaved={upsert}
      />

      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent className="bg-white border border-[#E8E0D5] rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-serif text-[#1C1B1A]">
              Excluir produto?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-[#6B6560] text-sm">
              Esta ação é definitiva: “{deleting?.name}” será removido junto com suas variações.
              Pedidos antigos não são afetados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel className="border-[#E8E0D5] text-[#1C1B1A] text-xs">
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-[#B3261E] hover:bg-[#8C1D18] text-white text-xs"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" />
                  Excluindo...
                </>
              ) : (
                'Excluir definitivamente'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
