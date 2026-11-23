import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { CustomField, Product, ProductCategory, ProductVariation } from '@/types'
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
import { CustomFieldsSection } from '@/components/admin/CustomFieldsSection'
import { Loader2, Plus, Trash2, Check } from 'lucide-react'

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
  customOptions: CustomField[] | null
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
  customOptions: null,
}

/** Converte o texto do campo em inteiro de estoque. 0 é valor válido — só texto vazio/inválido vira 0. */
const parseStock = (raw: string): number => {
  const parsed = Number.parseInt(raw.trim(), 10)
  if (Number.isNaN(parsed) || parsed < 0) return 0
  return parsed
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
  custom_options: form.customOptions?.length ? form.customOptions : null,
})

interface VariationSectionProps {
  productId: string | null // null = produto novo (ainda sem id)
  variations: VariationDraft[]
  onChange: (next: VariationDraft[]) => void
  onVariationSaved?: (saved: ProductVariation) => void
  onVariationRemoved?: (id: string) => void
  /** Registra a função que salva todas as linhas pendentes (chamada no submit principal). */
  registerSaveAll?: (saveAll: (() => Promise<boolean>) | null) => void
}

/** Seção de variações dentro do diálogo do produto (só edita produto salvo). */
const VariationSection: React.FC<VariationSectionProps> = ({
  productId,
  variations,
  onChange,
  onVariationSaved,
  onVariationRemoved,
  registerSaveAll,
}) => {
  const { toast } = useToast()
  const [saving, setSaving] = useState(false)
  const [loadedFor, setLoadedFor] = useState<string | null>(null)
  /** Última state gravado no servidor por linha — base para detectar linhas alteradas. */
  const baselineRef = useRef<VariationDraft[]>([])

  // O submit principal precisa conseguir salvar as linhas pendentes (o valor
  // digitado em uma linha era descartado se o admin não apertasse o ✓ dela —
  // é daí que vinha o "digitei 0 e o estoque continuou 25").
  useEffect(() => {
    registerSaveAll?.(saveAllPending)
    return () => registerSaveAll?.(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  })

  // Ao abrir a edição de um produto, carrega as variações gravadas dele.
  useEffect(() => {
    if (!productId || loadedFor === productId) return
    setLoadedFor(productId)
    setSaving(true)
    productsService
      .listVariations(productId)
      .then((rows) => {
        const drafts = rows.map((v: ProductVariation) => ({
          id: v.id,
          label: v.label || '',
          price_delta: String(v.price_delta ?? 0),
          stock: String(v.stock ?? 0),
        }))
        baselineRef.current = drafts
        onChange(drafts)
      })
      .catch(() => toast({ title: 'Erro ao carregar variações', variant: 'destructive' }))
      .finally(() => setSaving(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productId])

  const update = (idx: number, patch: Partial<VariationDraft>) =>
    onChange(variations.map((v, i) => (i === idx ? { ...v, ...patch } : v)))

  const addRow = () => onChange([...variations, { label: '', price_delta: '0', stock: '0' }])

  const removeRow = async (idx: number) => {
    const row = variations[idx]
    baselineRef.current.splice(idx, 1)
    onChange(variations.filter((_, i) => i !== idx))
    // Variação já gravada no servidor sai imediatamente (não espera "Salvar").
    if (row.id) {
      try {
        await productsService.deleteVariation(row.id)
        onVariationRemoved?.(row.id)
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

  const saveRow = async (idx: number, silent = false) => {
    if (!productId) return null
    const row = variations[idx]
    if (!row.label.trim()) {
      if (!silent) toast({ title: 'Informe o rótulo da variação', variant: 'destructive' })
      return null
    }
    setSaving(true)
    try {
      const payload = {
        product: productId,
        label: row.label.trim(),
        price_delta: Number(row.price_delta.replace(',', '.')) || 0,
        stock: parseStock(row.stock),
      }
      const saved = row.id
        ? await productsService.updateVariation(row.id, payload)
        : await productsService.createVariation(payload)
      const savedDraft: VariationDraft = {
        id: saved.id,
        label: saved.label,
        price_delta: String(saved.price_delta ?? 0),
        stock: String(saved.stock ?? 0),
      }
      const next = [...variations]
      next[idx] = savedDraft
      baselineRef.current[idx] = savedDraft
      onChange(next)
      onVariationSaved?.(saved)
      if (!silent) {
        toast({
          title: (saved.stock ?? 0) === 0 ? 'Variação salva — esgotada' : 'Variação salva!',
          description:
            (saved.stock ?? 0) === 0
              ? `${saved.label}: estoque 0 — o tamanho aparece como “Esgotado” na loja.`
              : undefined,
        })
      }
      return saved
    } catch (err: any) {
      console.error('Erro ao salvar variação:', err)
      toast({
        title: 'Erro ao salvar variação',
        description: err?.message || 'Tente novamente.',
        variant: 'destructive',
      })
      return null
    } finally {
      setSaving(false)
    }
  }

  /** Linha é nova ou difere do último estado gravado no servidor. */
  const isDirty = (idx: number): boolean => {
    const v = variations[idx]
    if (!v?.id) return true
    const base = baselineRef.current[idx]
    if (!base) return true
    return v.label !== base.label || v.price_delta !== base.price_delta || v.stock !== base.stock
  }

  /**
   * Salva todas as linhas alteradas/pendentes (chamado pelo submit principal).
   * Antes o valor digitado era descartado se o admin não apertasse o ✓ de cada
   * linha — é daí que vinha o "digitei 0 e continuou 25".
   */
  const saveAllPending = async (): Promise<boolean> => {
    if (!productId) return true
    for (let idx = 0; idx < variations.length; idx++) {
      const v = variations[idx]
      // Linha nova nunca preenchida (sem rótulo) não bloqueia o submit.
      if (!v.id && !v.label.trim()) continue
      if (!isDirty(idx)) continue
      const saved = await saveRow(idx, true)
      if (!saved) return false
    }
    return true
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
          className="flex flex-wrap items-end gap-2 p-2 bg-[#FAF6F0] rounded-lg border border-[#E8E0D5]"
        >
          <div className="flex-[2] min-w-[8rem] space-y-0.5">
            <Label className="text-[10px] text-[#6B6560]">Rótulo</Label>
            <Input
              value={v.label}
              onChange={(e) => update(idx, { label: e.target.value })}
              placeholder="Ex.: Tamanho A2"
              className="h-8 text-xs bg-white border-[#E8E0D5]"
            />
          </div>
          <div className="w-20 sm:w-24 space-y-0.5">
            <Label className="text-[10px] text-[#6B6560]">Δ preço (R$)</Label>
            <Input
              value={v.price_delta}
              onChange={(e) => update(idx, { price_delta: e.target.value })}
              inputMode="decimal"
              className="h-8 text-xs bg-white border-[#E8E0D5]"
            />
          </div>
          <div className="w-14 sm:w-16 space-y-0.5">
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
  /** Opcional: mantém o estoque por tamanho em dia na listagem da Loja. */
  onVariationSaved?: (saved: ProductVariation) => void
  onVariationRemoved?: (id: string) => void
}

export const ProductFormDialog: React.FC<ProductFormDialogProps> = ({
  open,
  editing,
  onOpenChange,
  onSaved,
  onVariationSaved,
  onVariationRemoved,
}) => {
  const { toast } = useToast()
  const [form, setForm] = useState<ProductFormState>(emptyForm)
  const [existingImage, setExistingImage] = useState<string | null>(null)
  const [variations, setVariations] = useState<VariationDraft[]>([])
  const [saving, setSaving] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  /** Salvar-tudo das linhas de variação, registrado pela VariationSection. */
  const saveVariationsRef = useRef<(() => Promise<boolean>) | null>(null)
  const registerSaveAll = useCallback((fn: (() => Promise<boolean>) | null) => {
    saveVariationsRef.current = fn
  }, [])

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
              customOptions: editing.custom_options ?? null,
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
      // Salva também as linhas de variação alteradas — antes o estoque digitado
      // era descartado se o admin não apertasse o ✓ de cada linha.
      const variationsOk = await saveVariationsRef.current?.()
      if (variationsOk === false) {
        toast({
          title: 'Produto salvo, mas há variações pendentes',
          description: 'Corrija as linhas destacadas em "Erro ao salvar variação" e salve de novo.',
          variant: 'destructive',
        })
        onSaved(saved)
        return
      }
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
      <DialogContent className="bg-white border border-[#E8E0D5] rounded-2xl sm:max-w-lg max-h-[85dvh] overflow-y-auto">
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

          <CustomFieldsSection
            fields={form.customOptions}
            onChange={(fields) =>
              setForm((f) => ({ ...f, customOptions: fields.length ? fields : null }))
            }
          />

          <VariationSection
            productId={editing?.id || null}
            variations={variations}
            onChange={setVariations}
            onVariationSaved={onVariationSaved}
            onVariationRemoved={onVariationRemoved}
            registerSaveAll={registerSaveAll}
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

interface ProductStockDialogProps {
  open: boolean
  product: Product | null
  variations: ProductVariation[]
  onOpenChange: (open: boolean) => void
  /** Mantém a listagem da Loja em dia ao salvar/remover uma variação aqui. */
  onVariationSaved?: (saved: ProductVariation) => void
  onVariationRemoved?: (id: string) => void
}

/**
 * Diálogo dedicado de ESTOQUE por tamanho (variação) — aberto pelo botão
 * "Estoque" do card na Loja. Cada linha salva direto no servidor.
 */
export const ProductStockDialog: React.FC<ProductStockDialogProps> = ({
  open,
  product,
  variations,
  onOpenChange,
  onVariationSaved,
  onVariationRemoved,
}) => {
  const { toast } = useToast()
  const [savingId, setSavingId] = useState<string | null>(null)
  const [removingId, setRemovingId] = useState<string | null>(null)

  const totalPieces = variations.reduce((sum, v) => sum + (Number(v.stock) || 0), 0)

  const handleSave = async (variation: ProductVariation, value: string) => {
    const stock = Math.max(0, Math.round(Number(value) || 0))
    setSavingId(variation.id)
    try {
      const saved = await productsService.updateVariation(variation.id, { stock })
      onVariationSaved?.(saved)
      toast({
        title: 'Estoque atualizado!',
        description: `${saved.label}: ${saved.stock} peça(s) disponível(is).`,
      })
    } catch (err: any) {
      console.error('Erro ao salvar estoque:', err)
      toast({
        title: 'Erro ao salvar estoque',
        description: err?.message || 'Tente novamente.',
        variant: 'destructive',
      })
    } finally {
      setSavingId(null)
    }
  }

  const handleRemove = async (variation: ProductVariation) => {
    setRemovingId(variation.id)
    try {
      await productsService.deleteVariation(variation.id)
      onVariationRemoved?.(variation.id)
      toast({ title: 'Tamanho removido', description: `"${variation.label}" saiu do produto.` })
    } catch (err: any) {
      console.error('Erro ao remover tamanho:', err)
      toast({
        title: 'Erro ao remover tamanho',
        description: err?.message || 'Tente novamente.',
        variant: 'destructive',
      })
    } finally {
      setRemovingId(null)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-white border border-[#E8E0D5] rounded-2xl sm:max-w-md max-h-[85dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-serif text-[#1C1B1A]">
            Estoque — {product?.name || ''}
          </DialogTitle>
          <DialogDescription className="text-[#6B6560] text-xs">
            Informe quantas peças estão disponíveis para compra em cada tamanho. O total aparece na
            listagem da Loja.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center justify-between rounded-lg border border-[#E8E0D5] bg-[#FAF6F0] px-3 py-2">
          <span className="text-xs font-bold text-[#1C1B1A]">Total de peças</span>
          <span
            className={`text-sm font-bold ${totalPieces === 0 ? 'text-[#B3261E]' : 'text-[#2E7D4F]'}`}
          >
            {totalPieces} {totalPieces === 1 ? 'peça' : 'peças'}
          </span>
        </div>

        {variations.length === 0 ? (
          <p className="text-xs text-[#6B6560]">
            Nenhum tamanho cadastrado. Use “Editar” → Variações para adicionar tamanhos (ex.: A1,
            A2, A3...).
          </p>
        ) : (
          <div className="space-y-2">
            {variations.map((v) => (
              <StockRow
                key={v.id}
                variation={v}
                saving={savingId === v.id}
                removing={removingId === v.id}
                onSave={handleSave}
                onRemove={handleRemove}
              />
            ))}
          </div>
        )}

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="border-[#E8E0D5] text-[#1C1B1A] text-xs font-semibold"
          >
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/** Uma linha de estoque: label + campo de quantidade + salvar/remover. */
const StockRow: React.FC<{
  variation: ProductVariation
  saving: boolean
  removing: boolean
  onSave: (v: ProductVariation, value: string) => void
  onRemove: (v: ProductVariation) => void
}> = ({ variation, saving, removing, onSave, onRemove }) => {
  const [value, setValue] = useState(String(variation.stock ?? 0))

  // Quando o registro muda no servidor (realtime), reflete o valor gravado.
  useEffect(() => {
    setValue(String(variation.stock ?? 0))
  }, [variation.stock])

  return (
    <div className="flex items-center gap-2 p-2 bg-[#FAF6F0] rounded-lg border border-[#E8E0D5]">
      <span className="flex-1 text-xs font-bold text-[#1C1B1A]">{variation.label}</span>
      <Input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        inputMode="numeric"
        className="w-16 h-8 text-xs bg-white border-[#E8E0D5] text-center"
        aria-label={`Estoque de ${variation.label}`}
      />
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => onSave(variation, value)}
        disabled={saving || removing}
        className="h-8 px-2 text-[#2E7D4F] border-[#E8E0D5]"
        title="Salvar estoque"
      >
        {saving ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
        ) : (
          <Check className="w-3.5 h-3.5" />
        )}
      </Button>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => onRemove(variation)}
        disabled={saving || removing}
        className="h-8 px-2 text-[#B3261E] border-[#E8E0D5]"
        title="Remover tamanho"
      >
        {removing ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
        ) : (
          <Trash2 className="w-3.5 h-3.5" />
        )}
      </Button>
    </div>
  )
}
