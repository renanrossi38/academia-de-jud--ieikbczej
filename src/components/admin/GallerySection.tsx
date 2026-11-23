import React, { useEffect, useRef, useState } from 'react'
import { ImagePlus, Loader2, Star, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import pb from '@/lib/pocketbase/client'
import { Product } from '@/types'
import { productsService } from '@/services/products'
import { useToast } from '@/hooks/use-toast'

interface GallerySectionProps {
  /** null = produto novo (a galeria fica habilitada após o primeiro "Salvar"). */
  productId: string | null
  product: Product | null
  /** Registra a função que salva as mudanças pendentes da galeria no submit principal. */
  registerGallerySave?: (fn: (() => Promise<boolean>) | null) => void
}

/**
 * Seção de galeria de fotos do produto (campo file múltiplo "gallery",
 * migration 0028). Upload múltiplo anexa ao final; "tornar principal"
 * reordena (1ª posição = principal); cada foto tem botão de remover.
 * As mudanças ficam pendentes e são gravadas pelo submit do diálogo
 * (productsService.updateGallery) — sem upload solto fora do "Salvar".
 */
export const GallerySection: React.FC<GallerySectionProps> = ({
  productId,
  product,
  registerGallerySave,
}) => {
  const { toast } = useToast()
  /** Nomes de arquivo já gravados no servidor, na ordem atual. */
  const [names, setNames] = useState<string[]>([])
  /** Arquivos novos escolhidos ainda não enviados. */
  const [pendingFiles, setPendingFiles] = useState<File[]>([])
  /** Pré-visualização local dos arquivos novos (blob URLs). */
  const [previews, setPreviews] = useState<string[]>([])
  /** Nomes marcados para remoção (gravados) nesta edição. */
  const [removing, setRemoving] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  /** Nomes gravados no servidor quando a seção abriu — base de comparação. */
  const baselineRef = useRef<string[]>([])

  // (Re)carrega a galeria do produto quando o diálogo abre/troca de produto.
  useEffect(() => {
    if (!productId || !product) {
      setNames([])
      setPendingFiles([])
      setPreviews([])
      setRemoving([])
      baselineRef.current = []
      return
    }
    const current = product.gallery?.length
      ? [...product.gallery]
      : product.image
        ? [product.image]
        : []
    setNames(current)
    baselineRef.current = [...current]
    setPendingFiles([])
    setPreviews([])
    setRemoving([])
  }, [productId, product])

  // Limpa blob URLs de pré-visualização ao desmontar.
  useEffect(() => {
    return () => previews.forEach((url) => URL.revokeObjectURL(url))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Registra o salvar-pendente para o submit principal do diálogo.
  useEffect(() => {
    registerGallerySave?.(savePending)
    return () => registerGallerySave?.(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  })

  const addFiles = (list: FileList | null) => {
    if (!list?.length) return
    const accepted = Array.from(list).filter((f) => {
      const ok =
        ['image/jpeg', 'image/png', 'image/webp'].includes(f.type) && f.size <= 5 * 1024 * 1024
      if (!ok)
        toast({
          title: 'Arquivo ignorado',
          description: `${f.name}: use JPG, PNG ou WebP de até 5 MB.`,
          variant: 'destructive',
        })
      return ok
    })
    if (!accepted.length) return
    setPendingFiles((prev) => [...prev, ...accepted])
    setPreviews((prev) => [...prev, ...accepted.map((f) => URL.createObjectURL(f))])
    if (inputRef.current) inputRef.current.value = ''
  }

  const removePendingFile = (idx: number) => {
    setPendingFiles((prev) => prev.filter((_, i) => i !== idx))
    setPreviews((prev) => {
      URL.revokeObjectURL(prev[idx])
      return prev.filter((_, i) => i !== idx)
    })
  }

  const markRemove = (name: string) => {
    setRemoving((prev) => (prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name]))
  }

  const moveToFront = (idx: number) => {
    if (idx <= 0) return
    setNames((prev) => {
      const next = [...prev]
      const [picked] = next.splice(idx, 1)
      next.unshift(picked)
      return next
    })
  }

  /** Ordem final: nomes (reordenados, sem os removidos) + arquivos novos. */
  const finalOrder = (): string[] => [...names.filter((n) => !removing.includes(n))]

  /** true quando há algo pendente para gravar. */
  const hasPending = (): boolean => {
    if (pendingFiles.length > 0) return true
    if (removing.length > 0) return true
    const kept = names.filter((n) => !removing.includes(n))
    const baseline = baselineRef.current
    if (kept.length !== baseline.length) return true
    return kept.some((n, i) => n !== baseline[i])
  }

  const savePending = async (): Promise<boolean> => {
    if (!productId || !hasPending()) return true
    setSaving(true)
    try {
      const saved = await productsService.updateGallery(productId, {
        remove: removing,
        reorder: finalOrder(),
        append: pendingFiles,
      })
      const current = saved.gallery?.length ? [...saved.gallery] : saved.image ? [saved.image] : []
      setNames(current)
      baselineRef.current = [...current]
      setPendingFiles([])
      setPreviews((prev) => {
        prev.forEach((url) => URL.revokeObjectURL(url))
        return []
      })
      setRemoving([])
      return true
    } catch (err: any) {
      console.error('Erro ao salvar galeria:', err)
      toast({
        title: 'Erro ao salvar fotos',
        description: err?.message || 'Tente novamente.',
        variant: 'destructive',
      })
      return false
    } finally {
      setSaving(false)
    }
  }

  const thumbUrl = (name: string): string =>
    pb.files.getURL(
      product ?? ({ id: productId, collectionName: 'products' } as unknown as Product),
      name,
    )

  // Grade: fotos gravadas (com estado de remoção) + pré-visualizações novas.
  const gridItems: React.ReactNode[] = []
  names.forEach((name, idx) => {
    const isRemoving = removing.includes(name)
    const isMain = idx === 0 && !isRemoving
    gridItems.push(
      <div
        key={`saved-${name}`}
        className={`group relative aspect-square rounded-lg border overflow-hidden ${
          isRemoving ? 'opacity-40 grayscale' : 'border-[#E8E0D5]'
        } ${isMain ? 'ring-2 ring-[#C1272D]' : ''}`}
      >
        <img src={thumbUrl(name)} alt={`Foto ${idx + 1}`} className="w-full h-full object-cover" />
        {isMain && (
          <span className="absolute top-1 left-1 bg-[#C1272D] text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full">
            Principal
          </span>
        )}
        <div className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-1 p-1 bg-black/45 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={isMain || isRemoving || saving}
            onClick={() => moveToFront(idx)}
            className="h-6 px-1.5 text-[9px] bg-white/90 border-white/60 text-[#1C1B1A]"
            title="Tornar principal"
          >
            <Star className="w-3 h-3" />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={isRemoving || saving}
            onClick={() => markRemove(name)}
            className="h-6 px-1.5 text-[9px] bg-white/90 border-white/60 text-[#B3261E]"
            title="Remover foto"
          >
            <X className="w-3 h-3" />
          </Button>
        </div>
        {isRemoving && (
          <button
            type="button"
            onClick={() => markRemove(name)}
            className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-white bg-black/30"
          >
            será removida — clique para desfazer
          </button>
        )}
      </div>,
    )
  })
  previews.forEach((url, idx) => {
    gridItems.push(
      <div
        key={`new-${idx}`}
        className="group relative aspect-square rounded-lg border border-dashed border-[#C1272D]/60 overflow-hidden"
      >
        <img src={url} alt={`Nova foto ${idx + 1}`} className="w-full h-full object-cover" />
        <span className="absolute top-1 left-1 bg-white/90 text-[#C1272D] text-[9px] font-bold px-1.5 py-0.5 rounded-full border border-[#C1272D]/40">
          Nova
        </span>
        <button
          type="button"
          onClick={() => removePendingFile(idx)}
          className="absolute top-1 right-1 w-5 h-5 flex items-center justify-center rounded-full bg-black/60 text-white"
          title="Descartar foto nova"
        >
          <X className="w-3 h-3" />
        </button>
      </div>,
    )
  })

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <Label className="text-xs font-bold text-[#1C1B1A]">Fotos do produto</Label>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => inputRef.current?.click()}
          disabled={!productId || saving}
          className="h-7 text-[11px] border-[#E8E0D5] text-[#C1272D]"
        >
          {saving ? (
            <Loader2 className="w-3 h-3 mr-1 animate-spin" />
          ) : (
            <ImagePlus className="w-3 h-3 mr-1" />
          )}
          Adicionar fotos
        </Button>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        className="hidden"
        onChange={(e) => addFiles(e.target.files)}
      />

      {!productId && (
        <p className="text-[11px] text-[#6B6560]">
          Salve o produto primeiro para poder adicionar fotos.
        </p>
      )}

      {productId && gridItems.length === 0 && (
        <p className="text-[11px] text-[#6B6560]">
          Nenhuma foto ainda. A primeira foto é a principal (capa na loja).
        </p>
      )}

      {gridItems.length > 0 && (
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">{gridItems}</div>
      )}

      <p className="text-[10px] text-[#6B6560]">
        JPG, PNG ou WebP, até 5 MB por foto. A primeira foto aparece na loja como imagem principal.
      </p>
    </div>
  )
}

export default GallerySection
