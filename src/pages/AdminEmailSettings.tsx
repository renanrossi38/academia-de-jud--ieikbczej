import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { useToast } from '@/hooks/use-toast'
import { Loader2, Mail, MessageCircle, RotateCcw, Save, Settings, Info } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { AdminPageHeader, AdminPageLoader } from '@/components/admin/AdminPage'
import { DEFAULT_FEE_OVERDUE_TEMPLATE, appSettingsService } from '@/services/appSettings'
import { DEFAULT_FEE_WHATSAPP_TEMPLATE } from '@/services/whatsapp'

/**
 * Configurações do negócio — os templates de cobrança de mensalidade em
 * atraso: o E-MAIL (assunto + mensagem) e a MENSAGEM DE WHATSAPP (só
 * mensagem — assunto não existe no WhatsApp). O texto salvo é o que os alunos
 * recebem: o backend (fee_overdue_notice.js) lê estas chaves de app_settings
 * antes de enviar, e os botões de wa.me do painel montam a mensagem a partir
 * do mesmo template. Placeholders substituídos no envio:
 *  {saudacao} — Bom dia/Boa tarde/Boa noite (horário de Brasília);
 *  {aluno}    — nome do aluno;
 *  {mes}      — mês de referência em atraso, em português.
 */

/** "YYYY-MM" do mês corrente (amostra da pré-visualização). */
function mesChaveAtual(): string {
  const d = new Date(Date.now() - 3 * 60 * 60 * 1000) // Brasília
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
}

export default function AdminEmailSettings() {
  const { user, isAdmin, isLoading: authLoading } = useAuth()
  const navigate = useNavigate()
  const { toast } = useToast()

  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState<'email' | 'whatsapp' | null>(null)
  // E-mail
  const [subject, setSubject] = useState('')
  const [template, setTemplate] = useState('')
  // WhatsApp
  const [waTemplate, setWaTemplate] = useState('')

  const load = useCallback(async () => {
    setIsLoading(true)
    try {
      const [tpl, waTpl] = await Promise.all([
        appSettingsService.getFeeOverdueTemplate(),
        appSettingsService.getFeeWhatsappTemplate(),
      ])
      setSubject(tpl.subject)
      setTemplate(tpl.body)
      setWaTemplate(waTpl)
    } catch (err) {
      console.error('Erro ao carregar configurações de cobrança:', err)
      toast({
        title: 'Erro ao carregar configurações',
        description: 'Não foi possível ler os templates atuais no servidor.',
        variant: 'destructive',
      })
    } finally {
      setIsLoading(false)
    }
  }, [toast])

  useEffect(() => {
    if (authLoading) return
    if (!user) {
      navigate('/entrar?redirect=/painel/configuracoes')
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
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, isAdmin, authLoading])

  const emailDirty = subject.trim() !== '' && template.trim() !== ''
  const waDirty = waTemplate.trim() !== ''

  const handleSaveEmail = async () => {
    if (subject.trim() === '') {
      toast({
        title: 'Assunto obrigatório',
        description: 'O e-mail precisa de um assunto — ele aparece na caixa de entrada do aluno.',
        variant: 'destructive',
      })
      return
    }
    if (template.trim() === '') {
      toast({
        title: 'Mensagem obrigatória',
        description: 'Escreva a mensagem do e-mail antes de salvar.',
        variant: 'destructive',
      })
      return
    }
    setIsSaving('email')
    try {
      await appSettingsService.saveFeeOverdueTemplate({ subject, body: template })
      toast({
        title: 'E-mail salvo',
        description:
          'O próximo aviso de mensalidade em atraso (manual ou automático) usará este texto.',
      })
    } catch (err: any) {
      console.error('Erro ao salvar template de e-mail:', err)
      toast({
        title: 'Erro ao salvar',
        description: err?.message || 'Falha ao salvar no servidor. Tente novamente.',
        variant: 'destructive',
      })
    } finally {
      setIsSaving(null)
    }
  }

  const handleSaveWhatsapp = async () => {
    if (waTemplate.trim() === '') {
      toast({
        title: 'Mensagem obrigatória',
        description: 'Escreva a mensagem de WhatsApp antes de salvar.',
        variant: 'destructive',
      })
      return
    }
    setIsSaving('whatsapp')
    try {
      await appSettingsService.saveFeeWhatsappTemplate(waTemplate)
      toast({
        title: 'Mensagem de WhatsApp salva',
        description:
          'Os botões "Cobrar no WhatsApp" do painel e o disparo automático usam este texto.',
      })
    } catch (err: any) {
      console.error('Erro ao salvar template de WhatsApp:', err)
      toast({
        title: 'Erro ao salvar',
        description: err?.message || 'Falha ao salvar no servidor. Tente novamente.',
        variant: 'destructive',
      })
    } finally {
      setIsSaving(null)
    }
  }

  const handleReset = () => {
    setSubject(DEFAULT_FEE_OVERDUE_TEMPLATE.subject)
    setTemplate(DEFAULT_FEE_OVERDUE_TEMPLATE.body)
    setWaTemplate(DEFAULT_FEE_WHATSAPP_TEMPLATE)
    toast({
      title: 'Textos padrão restaurados',
      description: 'Clique em "Salvar" (e-mail e WhatsApp) para aplicá-los aos próximos envios.',
    })
  }

  if (authLoading || isLoading) {
    return <AdminPageLoader label="Carregando configurações..." />
  }

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 animate-fade-rise">
      <AdminPageHeader
        title="Configurações"
        breadcrumb="Configurações"
        breadcrumbTo="/painel/configuracoes"
        description="Textos de aviso de mensalidade em atraso: e-mail (manual e automático) e WhatsApp."
      />

      <div className="bg-white rounded-2xl border border-[#E8E0D5] shadow-xs p-5 sm:p-6 space-y-6">
        <div className="flex items-start gap-3 bg-[#FAF6F0] border border-[#E8E0D5] rounded-xl p-4">
          <Info className="w-4 h-4 shrink-0 mt-0.5 text-[#C1272D]" />
          <div className="text-xs text-[#6B6560] leading-relaxed">
            <p className="font-semibold text-[#1C1B1A] mb-1">Como estes textos são usados</p>
            <p>
              O e-mail vai no disparo automático do{' '}
              <strong className="text-[#1C1B1A]">dia 16</strong> (o vencimento padrão é dia 15) e no
              botão <strong className="text-[#1C1B1A]">"Notificar atrasados"</strong> do painel de
              Alunos. A mensagem de WhatsApp abre a conversa pronta nos botões{' '}
              <strong className="text-[#1C1B1A]">"Cobrar no WhatsApp"</strong> (Alunos e ficha do
              aluno) e também sai no disparo automático. Nos dois, os placeholders abaixo são
              preenchidos automaticamente:
            </p>
            <ul className="mt-2 space-y-1 list-disc list-inside">
              <li>
                <code className="font-mono text-[#C1272D]">{'{saudacao}'}</code> — bom dia, boa
                tarde ou boa noite, conforme o horário de Brasília;
              </li>
              <li>
                <code className="font-mono text-[#C1272D]">{'{aluno}'}</code> — nome do aluno;
              </li>
              <li>
                <code className="font-mono text-[#C1272D]">{'{mes}'}</code> — mês da mensalidade em
                atraso (ex.: novembro de 2026).
              </li>
            </ul>
          </div>
        </div>

        {/* ── E-mail de mensalidade em atraso ── */}
        <section className="space-y-4 pt-2 border-t border-[#E8E0D5]">
          <p className="font-serif font-bold text-sm text-[#1C1B1A] flex items-center gap-2">
            <Mail className="w-4 h-4 text-[#C1272D]" />
            E-mail de mensalidade em atraso
          </p>

          <div className="space-y-2">
            <Label
              htmlFor="email-subject"
              className="text-xs font-bold text-[#1C1B1A] uppercase tracking-wider"
            >
              Assunto do e-mail
            </Label>
            <Input
              id="email-subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Aviso de mensalidade em atraso - Judô Tatsu"
              className="h-10 text-sm bg-white border-[#E8E0D5] focus-visible:ring-[#C1272D]"
            />
          </div>

          <div className="space-y-2">
            <Label
              htmlFor="email-template"
              className="text-xs font-bold text-[#1C1B1A] uppercase tracking-wider"
            >
              Mensagem
            </Label>
            <Textarea
              id="email-template"
              value={template}
              onChange={(e) => setTemplate(e.target.value)}
              rows={10}
              className="text-sm bg-white border-[#E8E0D5] focus-visible:ring-[#C1272D] font-sans leading-relaxed"
            />
          </div>

          {/* Pré-visualização com os placeholders preenchidos */}
          <div className="space-y-2">
            <p className="text-xs font-bold text-[#1C1B1A] uppercase tracking-wider">
              Pré-visualização
            </p>
            <div className="rounded-xl border border-[#E8E0D5] border-t-4 border-t-[#C1272D] p-4 bg-white text-sm text-[#1C1B1A] leading-relaxed whitespace-pre-line">
              {appSettingsService.renderFeeMessage(template, 'Pedro da Silva', mesChaveAtual()) ||
                '—'}
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 pt-2">
            <Button
              onClick={handleSaveEmail}
              disabled={isSaving !== null || !emailDirty}
              className="bg-[#C1272D] hover:bg-[#A01E23] text-white text-sm font-semibold"
            >
              {isSaving === 'email' ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Salvando...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  Salvar e-mail
                </>
              )}
            </Button>
            <span className="sm:ml-auto inline-flex items-center gap-1.5 text-[11px] text-[#6B6560]">
              <Mail className="w-3.5 h-3.5" />
              Válido para o e-mail de mensalidade em atraso
            </span>
          </div>
        </section>

        {/* ── Mensagem de cobrança via WhatsApp ── */}
        <section className="space-y-4 pt-4 border-t border-[#E8E0D5]">
          <p className="font-serif font-bold text-sm text-[#1C1B1A] flex items-center gap-2">
            <MessageCircle className="w-4 h-4 text-[#128C4B]" />
            Mensagem de cobrança via WhatsApp
            <span className="text-[10px] font-sans font-semibold text-[#6B6560] uppercase tracking-wider">
              (sem assunto)
            </span>
          </p>

          <div className="space-y-2">
            <Label
              htmlFor="wa-template"
              className="text-xs font-bold text-[#1C1B1A] uppercase tracking-wider"
            >
              Mensagem
            </Label>
            <Textarea
              id="wa-template"
              value={waTemplate}
              onChange={(e) => setWaTemplate(e.target.value)}
              rows={9}
              placeholder={DEFAULT_FEE_WHATSAPP_TEMPLATE}
              className="text-sm bg-white border-[#E8E0D5] focus-visible:ring-[#C1272D] font-sans leading-relaxed"
            />
          </div>

          {/* Pré-visualização com os placeholders preenchidos */}
          <div className="space-y-2">
            <p className="text-xs font-bold text-[#1C1B1A] uppercase tracking-wider">
              Pré-visualização
            </p>
            <div className="rounded-xl border border-[#E8E0D5] border-t-4 border-t-[#128C4B] p-4 bg-white text-sm text-[#1C1B1A] leading-relaxed whitespace-pre-line">
              {appSettingsService.renderFeeMessage(waTemplate, 'Pedro da Silva', mesChaveAtual()) ||
                '—'}
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 pt-2">
            <Button
              onClick={handleSaveWhatsapp}
              disabled={isSaving !== null || !waDirty}
              className="bg-[#128C4B] hover:bg-[#0E7039] text-white text-sm font-semibold"
            >
              {isSaving === 'whatsapp' ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Salvando...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  Salvar WhatsApp
                </>
              )}
            </Button>
            <span className="sm:ml-auto inline-flex items-center gap-1.5 text-[11px] text-[#6B6560]">
              <MessageCircle className="w-3.5 h-3.5" />
              Válido para os botões de WhatsApp e o disparo automático
            </span>
          </div>
        </section>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 pt-2 border-t border-[#E8E0D5]">
          <Button
            onClick={handleReset}
            variant="outline"
            className="border-[#E8E0D5] text-[#1C1B1A] hover:bg-[#FAF6F0] text-sm font-semibold"
          >
            <RotateCcw className="w-4 h-4 mr-2" />
            Restaurar textos padrão
          </Button>
          <span className="sm:ml-auto inline-flex items-center gap-1.5 text-[11px] text-[#6B6560]">
            <Settings className="w-3.5 h-3.5" />
            Salvos em app_settings — vale para e-mail e WhatsApp
          </span>
        </div>
      </div>
    </div>
  )
}
