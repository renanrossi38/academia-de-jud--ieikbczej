import React, { useEffect, useMemo, useState } from 'react'
import { Loader2, MessageCircle, Send } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { appSettingsService } from '@/services/appSettings'
import {
  DEFAULT_FEE_WHATSAPP_TEMPLATE,
  nomeMes,
  normalizarTelefone,
  aplicarPlaceholders,
  waMeUrl,
} from '@/services/whatsapp'

/** Abre https://wa.me/<número>?text=... numa nova aba (o envio é manual). */
function abrirWa(url: string) {
  const win = window.open(url, '_blank', 'noopener,noreferrer')
  if (!win) console.warn('Pop-up bloqueado pelo navegador — a URL do WhatsApp não abriu.')
}

/**
 * Diálogo "Cobrar no WhatsApp" da FICHA DO ALUNO (aba Financeiro): a mensagem
 * de cobrança vem do template salvo em Painel → Configurações (fallback =
 * padrão), vem PRE-RENDERIZADA no campo de edição (mesmo padrão do e-mail:
 * {saudacao} por horário de Brasília, {aluno}, {mes} por extenso) e pode ser
 * revisada — o que sai é o que o admin vê. Telefone normalizado com 55.
 */
export const FeeWhatsappDialog: React.FC<{
  fee: { reference_month: string } | null
  studentName: string
  studentPhone: string
  onOpenChange: (open: boolean) => void
}> = ({ fee, studentName, studentPhone, onOpenChange }) => {
  const [template, setTemplate] = useState<string>(DEFAULT_FEE_WHATSAPP_TEMPLATE)
  const [phone, setPhone] = useState<string>(studentPhone || '')
  const [mensagem, setMensagem] = useState('')
  const [carregando, setCarregando] = useState(true)

  // Template salvo em Painel → Configurações (fallback = texto padrão) e
  // mensagem pre-renderizada — recarregados a cada mensalidade escolhida.
  useEffect(() => {
    if (!fee) return
    let cancel = false
    setPhone(studentPhone || '')
    setCarregando(true)
    Promise.all([
      appSettingsService.getFeeWhatsappTemplate().catch(() => DEFAULT_FEE_WHATSAPP_TEMPLATE),
    ])
      .then(([tpl]) => {
        if (cancel) return
        const t = tpl || DEFAULT_FEE_WHATSAPP_TEMPLATE
        setTemplate(t)
        setMensagem(aplicarPlaceholders(t, studentName, fee.reference_month))
      })
      .finally(() => {
        if (!cancel) setCarregando(false)
      })
    return () => {
      cancel = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fee?.reference_month, studentName, studentPhone])

  // Telefone normalizado (55 + dígitos) — "" quando insuficiente p/ wa.me.
  const telNorm = useMemo(() => normalizarTelefone(phone), [phone])

  const url = useMemo(
    () => (telNorm && mensagem.trim() ? waMeUrl(telNorm, mensagem) : ''),
    [telNorm, mensagem],
  )

  const handleOpen = () => {
    if (!url) return
    abrirWa(url)
    onOpenChange(false)
  }

  return (
    <Dialog open={!!fee} onOpenChange={onOpenChange}>
      <DialogContent className="bg-white border border-[#E8E0D5] rounded-2xl max-w-md">
        <DialogHeader>
          <DialogTitle className="font-serif text-[#1C1B1A] flex items-center gap-2">
            <MessageCircle className="w-4 h-4 text-[#128C4B]" />
            Cobrar no WhatsApp
          </DialogTitle>
          <DialogDescription className="text-[#6B6560] text-xs leading-relaxed">
            Mensalidade de{' '}
            <strong className="text-[#1C1B1A]">
              {fee ? nomeMes(fee.reference_month) : '—'}
            </strong> —
            revise o texto e o número antes de abrir a conversa. O envio é feito por você no
            WhatsApp; o app só abre a mensagem pronta.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label
              htmlFor="wa-telefone"
              className="text-[10px] font-bold text-[#1C1B1A] uppercase tracking-wider"
            >
              Telefone (com DDD)
            </Label>
            <Input
              id="wa-telefone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="(11) 91234-5678"
              className="h-9 text-sm bg-white border-[#E8E0D5] focus-visible:ring-[#C1272D]"
            />
            {phone.trim() !== '' && !telNorm && (
              <p className="text-[10px] text-[#C1272D] font-semibold">
                Número incompleto — informe DDD + número (10 a 13 dígitos).
              </p>
            )}
            {telNorm && <p className="text-[10px] text-[#6B6560]">WhatsApp: +{telNorm}</p>}
          </div>
          <div className="space-y-1.5">
            <Label
              htmlFor="wa-mensagem"
              className="text-[10px] font-bold text-[#1C1B1A] uppercase tracking-wider"
            >
              Mensagem
            </Label>
            {carregando ? (
              <div className="flex items-center gap-2 text-[11px] text-[#6B6560] py-4">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Carregando mensagem...
              </div>
            ) : (
              <Textarea
                id="wa-mensagem"
                value={mensagem}
                onChange={(e) => setMensagem(e.target.value)}
                rows={9}
                className="text-sm bg-white border-[#E8E0D5] focus-visible:ring-[#C1272D] leading-relaxed"
              />
            )}
            <p className="text-[10px] text-[#6B6560] leading-relaxed">
              O texto começa com o template salvo em Painel → Configurações; o que você escrever
              aqui vale só para este envio.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="border-[#E8E0D5] text-[#1C1B1A] hover:bg-[#FAF6F0] text-xs font-semibold"
          >
            Cancelar
          </Button>
          <Button
            onClick={handleOpen}
            disabled={!url || carregando}
            className="bg-[#128C4B] hover:bg-[#0E7039] text-white text-xs font-semibold"
          >
            <Send className="w-3.5 h-3.5 mr-1.5" />
            Abrir WhatsApp
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
