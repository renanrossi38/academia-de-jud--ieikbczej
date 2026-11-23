import { useEffect, useMemo, useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Product } from '@/types'
import { fmtBRL } from '@/pages/admin/StudentDetailPanels'
import { normalizarTelefone } from '@/services/whatsapp'
import { useToast } from '@/hooks/use-toast'

/** URL de produção da loja, para o link dentro da mensagem. */
const STORE_BASE = 'https://academia-de-judo-dc052.goskip.app'

/** Monta a mensagem de venda do produto (nome, preço, descrição e link da loja). */
export function productShareMessage(product: Product): string {
  const preco = fmtBRL(product.price)
  const descricao = (product.description || '').trim()
  const url = `${STORE_BASE}/produto/${product.slug}`
  const partes = [
    `${product.name} — ${preco}`,
    descricao ? descricao : '',
    '',
    `Veja mais em: ${url}`,
    'Academia Judô Tatsu 🥋',
  ]
  return partes.filter((p) => p !== '').join('\n')
}

type Props = {
  product: Product | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

/**
 * Revisão antes de abrir o WhatsApp: mensagem do produto editável e, opcional-
 * mente, um número de contato (do aluno) para já direcionar a conversa — sem
 * número, o wa.me abre a lista de contatos para o usuário escolher.
 */
export function ProductShareDialog({ product, open, onOpenChange }: Props) {
  const { toast } = useToast()
  const [numero, setNumero] = useState('')

  const mensagem = useMemo(() => (product ? productShareMessage(product) : ''), [product])
  const [texto, setTexto] = useState('')
  const valor = texto || mensagem

  // Ao abrir outro produto, solta o rascunho do anterior.
  useEffect(() => {
    if (open) {
      setTexto('')
      setNumero('')
    }
  }, [open, product?.id])

  function abrir() {
    if (!product) return
    const tel = normalizarTelefone(numero)
    if (numero.trim() && !tel) {
      toast({
        title: 'Número inválido',
        description: 'Informe DDD + número (ex.: 11912345678) para abrir a conversa.',
        variant: 'destructive',
      })
      return
    }
    const url = tel
      ? `https://wa.me/${tel}?text=${encodeURIComponent(valor)}`
      : `https://wa.me/?text=${encodeURIComponent(valor)}`
    window.open(url, '_blank', 'noopener,noreferrer')
    onOpenChange(false)
    setTexto('')
    setNumero('')
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Compartilhar no WhatsApp</DialogTitle>
          <DialogDescription>
            Revise a mensagem antes de enviar — ela abre na sua conta do WhatsApp.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="wa-share-message">Mensagem</Label>
            <Textarea
              id="wa-share-message"
              rows={8}
              value={valor}
              onChange={(e) => setTexto(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="wa-share-phone">Número do cliente (opcional)</Label>
            <input
              id="wa-share-phone"
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm placeholder:text-muted-foreground"
              placeholder="(11) 91234-5678"
              value={numero}
              onChange={(e) => setNumero(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Sem número, o WhatsApp abre para você escolher o contato.
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={abrir}>Abrir conversa</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
