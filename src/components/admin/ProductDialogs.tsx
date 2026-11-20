import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Product, ProductCategory, ProductVariation } from '@/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useToast } from '@/hooks/use-toast'
import {
  productsService,
  slugify,
  CreateProductInput,
  UpdateProductInput,
} from '@/services/products'
import { Loader2, Plus, Trash2 } from 'lucide-react'

const CATEGORY_OPTIONS: { label: string; value: ProductCategory }[] = [
  { label: 'Uniformes (Gi)', value: 'uniformes' },
  { label: 'Faixas (Obi)', value: 'faixas' },
  { label: 'Camisetas', value: 'camisetas' },
  { label: 'Equipamentos', value: 'equipamentos' },
  { label: 'Planos', value: 'planos' },
]

const selectClass =
  'w-full h-9 text-sm rounded-md border border-[#E8E0D5] bg-white px-3 text-[#1C1B1A] focus:outline-hidden focus:ring-1 focus:ring-[#C1272D]'

export const categoryLabel = (cat: string): string =>
  CATEGORY_OPTIONS.find((c) => c.value === cat)?.label || cat

interface VariationDraft {
  id?: string
  label: string
  price_delta: string
  stock: string
}

interface ProductFormState {
  name: string
  slug: string
  description: string
  price: string
  category: ProductCategory
  active: boolean
  image: File | null
  removeImage: boolean
}

const emptyForm: ProductFormState = {
  name: '',
  slug: '',
  description: '',
  price: '',
  category: 'uniformes',
  active: true,
  image: null,
  removeImage: false,
}

/** Monta o payload do produto (objeto simples — o service cuida do FormData/upload). */
const buildPayload = (form: ProductFormState): CreateProductInput & UpdateProductInput => ({
  name: form.name.trim(),
  slug: form.slug.trim() || slugify(form.name),
  description: form.description.trim(),
  price: Number(form.price.replace(',', '.')) || 0,
  category: form.category,
  active: form.active,
  image: form.image,
  removeImage: form.removeImage,
})

interface VariationSectionProps {
  productId: string | null // null = produto novo (ainda sem id)
  variations: VariationDraft[]
  onChange: (next: VariationDraft[]) => void
}

/** Seção de variações dentro do diálogo do produto (só edita produto salvo). */
const VariationSection: React.FC<VariationSectionProps> = ({ productId, variations, onChange }) => {
  const { toast } = useToast()
  const [saving, setSaving] = useState(false)
  const [loadedFor, setLoadedFor] = useState<string | null>(null)

  // Ao abrir a edição de um produto, carrega as variações gravadas dele.
  useEffect(() => {
    if (!productId || loadedFor === productId) return
    setLoadedFor(productId)
    setSaving(true)
    productsService
      .listVariations(productId)
      .then((rows) =>
        onChange(
          rows.map((v: ProductVariation) => ({
            id: v.id,
            label: v.label || '',
            price_delta: String(v.price_delta ?? 0),
            stock: String(v.stock ?? 0),
          })),
        ),
      )
      .catch(() => toast({ title: 'Erro ao carregar variações', variant: 'destructive' }))
      .finally(() => setSaving(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productId])

  const update = (idx: number, patch: Partial<VariationDraft>) =>
    onChange(variations.map((v, i) => (i === idx ? { ...v, ...patch } : v)))

  const addRow = () => onChange([...variations, { label: '', price_delta: '0', stock: '0' }])

  const removeRow = async (idx: number) => {
    const row = variations[idx]
    onChange(variations.filter((_, i) => i !== idx))
    // Variação já gravada no servidor sai imediatamente (não espera "Salvar").
    if (row.id) {
      try {
        await productsService.deleteVariation(row.id)
      } catch (err: any) {
        console.error('Erro ao excluir variação:', err)
        toast({
          title: 'Erro ao excluir variação',
          description: err?.message || 'A variação continua no servidor.',
          variant: 'destructive',
        })
      }
    }
  }

  const saveRow = async (idx: number) => {
    if (!productId) return
    const row = variations[idx]
    if (!row.label.trim()) {
      toast({ title: 'Informe o rótulo da variação', variant: 'destructive' })
      return
    }
    setSaving(true)
    try {
      const payload = {
        product: productId,
        label: row.label.trim(),
        price_delta: Number(row.price_delta.replace(',', '.')) || 0,
        stock: Number(row.stock) || 0,
      }
      const saved = row.id
        ? await productsService.updateVariation(row.id, payload)
        : await productsService.createVariation(payload)
      const next = [...variations]
      next[idx] = {
        id: saved.id,
        label: saved.label,
        price_delta: String(saved.price_delta ?? 0),
        stock: String(saved.stock ?? 0),
      }
      onChange(next)
      toast({ title: 'Variação salva!' })
    } catch (err: any) {
      console.error('Erro ao salvar variação:', err)
      toast({
        title: 'Erro ao salvar variação',
        description: err?.message || 'Tente novamente.',
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label className="text-xs font-bold text-[#1C1B1A]">Variações (tamanho, cor...)</Label>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={addRow}
          disabled={!productId}
          className="h-7 text-[11px] border-[#E8E0D5] text-[#C1272D]"
        >
          <Plus className="w-3 h-3 mr-1" />
          Adicionar
        </Button>
      </div>

      {!productId && (
        <p className="text-[11px] text-[#6B6560]">
          Salve o produto primeiro para poder adicionar variações.
        </p>
      )}

      {productId && variations.length === 0 && !saving && (
        <p className="text-[11px] text-[#6B6560]">
          Nenhuma variação. Ex.: "Tamanho A2", delta +30,00, estoque 5.
        </p>
      )}

      {variations.map((v, idx) => (
        <div
          key={v.id || `new-${idx}`}
          className="flex items-end gap-2 p-2 bg-[#FAF6F0] rounded-lg border border-[#E8E0D5]"
        >
          <div className="flex-1 space-y-0.5">
            <Label className="text-[10px] text-[#6B6560]">Rótulo</Label>
            <Input
              value={v.label}
              onChange={(e) => update(idx, { label: e.target.value })}
              placeholder="Ex.: Tamanho A2"
              className="h-8 text-xs bg-white border-[#E8E0D5]"
            />
          </div>
          <div className="w-24 space-y-0.5">
            <Label className="text-[10px] text-[#6B6560]">Δ preço (R$)</Label>
            <Input
              value={v.price_delta}
              onChange={(e) => update(idx, { price_delta: e.target.value })}
              inputMode="decimal"
              className="h-8 text-xs bg-white border-[#E8E0D5]"
            />
          </div>
          <div className="w-16 space-y-0.5">
            <Label className="text-[10px] text-[#6B6560]">Estoque</Label>
            <Input
              value={v.stock}
              onChange={(e) => update(idx, { stock: e.target.value })}
              inputMode="numeric"
              className="h-8 text-xs bg-white border-[#E8E0D5]"
            />
          </div>
          <div className="flex gap-1 pb-0.5">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => saveRow(idx)}
              disabled={saving || !productId}
              className="h-8 w-8 p-0 text-[#2E7D4F] border-[#E8E0D5]"
              title="Salvar variação"
            >
              <Loader2 className={`w-3.5 h-3.5 ${saving ? 'animate-spin' : 'hidden'}`} />
              <span className={`text-xs font-bold ${saving ? 'hidden' : ''}`}>✓</span>
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => removeRow(idx)}
              className="h-8 w-8 p-0 text-[#B3261E] border-[#E8E0D5]"
              title="Remover variação"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      ))}
    </div>
  )
}

interface ProductFormDialogProps {
  open: boolean
  editing: Product | null
  onOpenChange: (open: boolean) => void
  onSaved: (saved: Product) => void
}

export const ProductFormDialog: React.FC<ProductFormDialogProps> = ({
  open,
  editing,
  onOpenChange,
  onSaved,
}) => {
  const { toast } = useToast()
  const [form, setForm] = useState<ProductFormState>(emptyForm)
  const [existingImage, setExistingImage] = useState<string | null>(null)
  const [variations, setVariations] = useState<VariationDraft[]>([])
  const [saving, setSaving] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) {
      setForm(
        editing
          ? {
              name: editing.name || '',
              slug: editing.slug || '',
              description: editing.description || '',
              price: String(editing.price ?? ''),
              category: editing.category,
              active: editing.active !== false,
              image: null,
              removeImage: false,
            }
          : emptyForm,
      )
      setExistingImage(editing?.image ? productsService.getImageUrl(editing) : null)
      setVariations([])
    }
  }, [open, editing])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim()) {
      toast({
        title: 'O nome é obrigatório',
        description: 'Informe um nome para o produto.',
        variant: 'destructive',
      })
      return
    }
    if (form.price === '' || Number.isNaN(Number(form.price.replace(',', '.')))) {
      toast({
        title: 'Preço inválido',
        description: 'Informe um preço numérico (ex.: 249.90).',
        variant: 'destructive',
      })
      return
    }
    setSaving(true)
    try {
      const saved = editing
        ? await productsService.update(editing.id, buildPayload(form))
        : await productsService.create(buildPayload(form))
      onSaved(saved)
      onOpenChange(false)
      toast({
        title: editing ? 'Produto atualizado!' : 'Produto criado!',
        description: `"${saved.name}" já aparece na listagem.`,
      })
    } catch (err: any) {
      console.error('Erro ao salvar produto:', err)
      const fieldErrors = err?.response?.data || {}
      const detail =
        Object.entries(fieldErrors)
          .map(([k, v]) => `${k}: ${(v as { message?: string }).message}`)
          .join(' · ') || err?.message
      toast({
        title: 'Erro ao salvar produto',
        description: detail || 'Falha ao gravar no servidor. Tente novamente.',
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-white border border-[#E8E0D5] rounded-2xl max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-serif text-[#1C1B1A]">
            {editing ? 'Editar produto' : 'Novo produto'}
          </DialogTitle>
          <DialogDescription className="text-[#6B6560] text-xs">
            {editing
              ? 'Atualize os dados do produto da loja.'
              : 'Crie um item da loja (kimono, faixa, camiseta...).'}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="product-name" className="text-xs font-bold text-[#1C1B1A]">
              Nome *
            </Label>
            <Input
              id="product-name"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="Ex.: Kimono Branco Tramado"
              className="h-9 text-sm bg-white border-[#E8E0D5] focus-visible:ring-[#C1272D]"
              maxLength={200}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="product-price" className="text-xs font-bold text-[#1C1B1A]">
                Preço (R$) *
              </Label>
              <Input
                id="product-price"
                value={form.price}
                onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}
                inputMode="decimal"
                placeholder="249.90"
                className="h-9 text-sm bg-white border-[#E8E0D5]"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="product-category" className="text-xs font-bold text-[#1C1B1A]">
                Categoria *
              </Label>
              <select
                id="product-category"
                value={form.category}
                onChange={(e) =>
                  setForm((f) => ({ ...f, category: e.target.value as ProductCategory }))
                }
                className={selectClass}
              >
                {CATEGORY_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="product-description" className="text-xs font-bold text-[#1C1B1A]">
              Descrição
            </Label>
            <textarea
              id="product-description"
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              rows={3}
              placeholder="Trama forte, corte tradicional..."
              className="w-full min-h-[70px] text-sm rounded-md border border-[#E8E0D5] bg-white px-3 py-2 text-[#1C1B1A] focus:outline-hidden focus:ring-1 focus:ring-[#C1272D]"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="product-slug" className="text-xs font-bold text-[#1C1B1A]">
              Slug (URL)
            </Label>
            <Input
              id="product-slug"
              value={form.slug}
              onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))}
              placeholder="Deixe vazio para gerar a partir do nome"
              className="h-9 text-sm bg-white border-[#E8E0D5]"
              maxLength={150}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="product-image" className="text-xs font-bold text-[#1C1B1A]">
              Imagem (png/jpeg/webp)
            </Label>
            {existingImage && !form.removeImage && (
              <div className="flex items-center gap-3 mb-1">
                <img
                  src={existingImage}
                  alt="Imagem atual"
                  className="w-14 h-14 rounded-md object-cover border border-[#E8E0D5]"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setForm((f) => ({ ...f, removeImage: true }))}
                  className="text-[11px] text-[#B3261E] border-[#E8E0D5]"
                >
                  Remover imagem
                </Button>
              </div>
            )}
            <input
              ref={fileRef}
              id="product-image"
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={(e) => setForm((f) => ({ ...f, image: e.target.files?.[0] || null }))}
              className="text-xs text-[#6B6560] file:mr-2 file:py-1 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-[#F7E4E2] file:text-[#C1272D] hover:file:bg-[#F7E4E2]/80"
            />
          </div>

          <label className="flex items-center gap-2 text-xs font-semibold text-[#1C1B1A]">
            <input
              type="checkbox"
              checked={form.active}
              onChange={(e) => setForm((f) => ({ ...f, active: e.target.checked }))}
              className="w-4 h-4 accent-[#C1272D]"
            />
            Produto ativo (visível na loja)
          </label>

          <VariationSection
            productId={editing?.id || null}
            variations={variations}
            onChange={setVariations}
          />

          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="border-[#E8E0D5] text-[#1C1B1A] text-xs font-semibold"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={saving}
              className="bg-[#C1272D] hover:bg-[#A01E23] text-white text-xs font-semibold"
            >
              {saving ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" />
                  Salvando...
                </>
              ) : editing ? (
                'Salvar alterações'
              ) : (
                'Criar produto'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export default ProductFormDialog
