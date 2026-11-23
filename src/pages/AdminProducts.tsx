import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import {
  AdminPageHeader,
  AdminSummary,
  AdminEmptyState,
  AdminPageLoader,
} from '@/components/admin/AdminPage'
import {
  ProductFormDialog,
  ProductStockDialog,
  categoryLabel,
} from '@/components/admin/ProductDialogs'
import { ProductShareDialog } from '@/components/admin/ProductShareDialog'
import { useProductsPage } from '@/hooks/useProductsPage'
import { Product, ProductVariation } from '@/types'
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
  Boxes,
  MessageCircle,
} from 'lucide-react'

const brl = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

/** Soma o estoque de todas as variações de um produto (0 quando não há variações). */
const totalPieces = (vars: ProductVariation[]) =>
  vars.reduce((sum, v) => sum + (Number(v.stock) || 0), 0)

export default function AdminProducts() {
  const { user, isAdmin, isLoading: authLoading } = useAuth()
  const navigate = useNavigate()
  const { toast } = useToast()
  const {
    products,
    setProducts,
    variations,
    isLoading,
    loadProducts,
    upsert,
    upsertVariation,
    removeVariation,
  } = useProductsPage()

  const [search, setSearch] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [stockOpen, setStockOpen] = useState(false)
  const [editing, setEditing] = useState<Product | null>(null)
  const [stockOf, setStockOf] = useState<Product | null>(null)
  const [deleting, setDeleting] = useState<Product | null>(null)
  const [shareOf, setShareOf] = useState<Product | null>(null)
  const [shareOpen, setShareOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [togglingId, setTogglingId] = useState<string | null>(null)

  // Variações agrupadas por produto, uma única vez para a página inteira.
  const varsByProduct = useMemo(() => {
    const map = new Map<string, ProductVariation[]>()
    for (const v of variations) {
      const list = map.get(v.product) || []
      list.push(v)
      map.set(v.product, list)
    }
    return map
  }, [variations])

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
    return <AdminPageLoader label="Carregando loja..." />
  }

  const activeProducts = products.filter((p) => p.active !== false).length
  const totalPiecesInStock = products.reduce(
    (sum, p) => sum + totalPieces(varsByProduct.get(p.id) || []),
    0,
  )

  return (
    <div className="min-h-screen bg-[#FAF6F0]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 animate-fade-rise">
        <AdminPageHeader
          title="Loja — Gerenciar Produtos"
          breadcrumb="Loja"
          breadcrumbTo="/painel/produtos"
          description="Adicione e remova produtos, ative/desative itens e controle o estoque de cada tamanho (variação). Produtos ativos aparecem na aba “Kimonos e Acessórios” da página inicial."
          icon={<Package className="w-6 h-6" />}
          action={
            <Button
              onClick={() => {
                setEditing(null)
                setFormOpen(true)
              }}
              className="h-10 bg-[#C1272D] hover:bg-[#A01E23] text-white text-sm font-semibold shrink-0"
            >
              <Plus className="w-4 h-4 mr-1.5" />
              Novo produto
            </Button>
          }
        />

        <AdminSummary
          stats={[
            {
              label: 'Total de produtos',
              value: products.length,
              icon: <Package className="w-4 h-4" />,
            },
            {
              label: 'Ativos',
              value: activeProducts,
              icon: <ToggleRight className="w-4 h-4" />,
              tone: 'green',
            },
            {
              label: 'Peças em estoque',
              value: totalPiecesInStock,
              icon: <Boxes className="w-4 h-4" />,
              tone: totalPiecesInStock === 0 ? 'red' : 'neutral',
            },
          ]}
        />

        <div className="relative mb-6">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9A948C]" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nome, slug ou categoria..."
            className="pl-9 h-10 bg-white border-[#E8E0D5]"
          />
        </div>

        {filtered.length === 0 ? (
          <AdminEmptyState
            icon={<Package className="w-10 h-10" />}
            title={search ? 'Nenhum produto encontrado' : 'Loja vazia'}
            description={
              search
                ? 'Nenhum produto corresponde a essa busca — tente outro nome, slug ou categoria.'
                : 'Nenhum produto cadastrado ainda. Use “Novo produto” para começar a montar o catálogo.'
            }
            action={
              !search ? (
                <Button
                  onClick={() => {
                    setEditing(null)
                    setFormOpen(true)
                  }}
                  className="bg-[#C1272D] hover:bg-[#A01E23] text-white text-xs font-semibold"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Cadastrar primeiro produto
                </Button>
              ) : undefined
            }
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((p) => {
              const vars = varsByProduct.get(p.id) || []
              const pieces = totalPieces(vars)

              return (
                <div
                  key={p.id}
                  className="bg-white rounded-2xl border border-[#E8E0D5] overflow-hidden flex flex-col"
                >
                  {p.image ? (
                    <img
                      src={productsService.getImageUrl(p) || undefined}
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

                    {/* Estoque por tamanho/variação — sempre visível no card */}
                    <div className="rounded-lg border border-[#E8E0D5] bg-[#FAF6F0] p-2">
                      <div className="flex items-center justify-between gap-2 mb-1.5">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-[#6B6560] flex items-center gap-1">
                          <Boxes className="w-3 h-3 text-[#C1272D]" />
                          Estoque por tamanho
                        </span>
                        <span className="text-[10px] font-bold text-[#1C1B1A]">
                          Total:{' '}
                          <span className={pieces === 0 ? 'text-[#B3261E]' : 'text-[#2E7D4F]'}>
                            {pieces} {pieces === 1 ? 'peça' : 'peças'}
                          </span>
                        </span>
                      </div>
                      {vars.length === 0 ? (
                        <p className="text-[10px] text-[#9A948C]">
                          Sem variações — use “Estoque” para adicionar tamanhos.
                        </p>
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {vars.map((v) => (
                            <span
                              key={v.id}
                              title={`${v.label} — ${v.stock} em estoque`}
                              className={`px-1.5 py-0.5 rounded-md border text-[10px] font-semibold ${
                                (Number(v.stock) || 0) === 0
                                  ? 'bg-[#F7E4E2] text-[#B3261E] border-[#B3261E]/30'
                                  : 'bg-white text-[#1C1B1A] border-[#D9D2C7]'
                              }`}
                            >
                              {v.label}: {v.stock}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    {p.description && (
                      <p className="text-xs text-[#6B6560] line-clamp-2">{p.description}</p>
                    )}
                    <p className="text-[10px] text-[#9A948C] font-mono">/{p.slug}</p>
                    <div className="flex flex-wrap gap-2 mt-auto pt-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setEditing(p)
                          setFormOpen(true)
                        }}
                        className="flex-1 min-w-[7rem] sm:min-w-0 text-xs border-[#E8E0D5] text-[#1C1B1A]"
                      >
                        <Pencil className="w-3.5 h-3.5 mr-1" />
                        Editar
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setStockOf(p)
                          setStockOpen(true)
                        }}
                        className="flex-1 min-w-[7rem] sm:min-w-0 text-xs border-[#E8E0D5] text-[#C1272D] hover:bg-[#F7E4E2]"
                      >
                        <Boxes className="w-3.5 h-3.5 mr-1" />
                        Estoque
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setShareOf(p)
                          setShareOpen(true)
                        }}
                        className="flex-1 min-w-[7rem] sm:min-w-0 text-xs border-[#E8E0D5] text-[#128C4B] hover:bg-[#E8F5EE]"
                        title="Compartilhar no WhatsApp"
                      >
                        <MessageCircle className="w-3.5 h-3.5 mr-1" />
                        WhatsApp
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleToggleActive(p)}
                        disabled={togglingId === p.id}
                        className="flex-1 min-w-[7rem] sm:min-w-0 text-xs border-[#E8E0D5] text-[#1C1B1A]"
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
                        className="min-w-[2.5rem] flex-1 sm:flex-none text-xs border-[#E8E0D5] text-[#B3261E] hover:bg-[#F7E4E2]"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      <ProductFormDialog
        open={formOpen}
        editing={editing}
        onOpenChange={setFormOpen}
        onSaved={upsert}
        onVariationSaved={upsertVariation}
        onVariationRemoved={removeVariation}
      />

      <ProductStockDialog
        open={stockOpen}
        product={stockOf}
        variations={stockOf ? varsByProduct.get(stockOf.id) || [] : []}
        onOpenChange={(open) => {
          setStockOpen(open)
          if (!open) setStockOf(null)
        }}
        onVariationSaved={upsertVariation}
        onVariationRemoved={removeVariation}
      />

      <ProductShareDialog
        open={shareOpen}
        product={shareOf}
        onOpenChange={(open) => {
          setShareOpen(open)
          if (!open) setShareOf(null)
        }}
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
