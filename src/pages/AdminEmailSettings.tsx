import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { useToast } from '@/hooks/use-toast'
import { Loader2, Mail, RotateCcw, Save, Settings, Info } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { AdminPageHeader, AdminPageLoader } from '@/components/admin/AdminPage'
import { DEFAULT_FEE_OVERDUE_TEMPLATE, appSettingsService } from '@/services/appSettings'

/**
 * Configurações do negócio — aqui, o template do e-mail de mensalidade em
 * atraso (assunto + mensagem). O texto salvo é o que os alunos recebem: o
 * backend (fee_overdue_notice.js) lê estas chaves de app_settings antes de
 * enviar. Placeholders substituídos no envio:
 *  {saudacao} — Bom dia/Boa tarde/Boa noite (horário do envio, São Paulo);
 *  {aluno}    — nome do aluno;
 *  {mes}      — mês de referência em atraso, em português.
 */

/**
 * Saudação pelo horário de Brasília (America/Sao_Paulo, UTC-3 o ano todo),
 * igual ao cálculo do hook fee_overdue_notice.js — assim a pré-visualização
 * mostra o mesmo {saudacao} que o aluno receberá.
 */
function brasiliaSaudacao(): string {
  const parts = new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    hour: 'numeric',
    hour12: false,
  }).formatToParts(new Date())
  const h = Number(parts.find((p) => p.type === 'hour')?.value ?? 0)
  if (h >= 5 && h < 12) return 'Bom dia'
  if (h >= 12 && h < 18) return 'Boa tarde'
  return 'Boa noite'
}

export default function AdminEmailSettings() {
  const { user, isAdmin, isLoading: authLoading } = useAuth()
  const navigate = useNavigate()
  const { toast } = useToast()

  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [subject, setSubject] = useState('')
  const [template, setTemplate] = useState('')

  const load = useCallback(async () => {
    setIsLoading(true)
    try {
      const tpl = await appSettingsService.getFeeOverdueTemplate()
      setSubject(tpl.subject)
      setTemplate(tpl.body)
    } catch (err) {
      console.error('Erro ao carregar configurações de e-mail:', err)
      toast({
        title: 'Erro ao carregar configurações',
        description: 'Não foi possível ler o template atual no servidor.',
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

  const dirty = subject !== '' && template !== ''

  const handleSave = async () => {
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
    setIsSaving(true)
    try {
      await appSettingsService.saveFeeOverdueTemplate({ subject, body: template })
      toast({
        title: 'Configurações salvas',
        description:
          'O próximo aviso de mensalidade em atraso (manual ou automático) usará este texto.',
      })
    } catch (err: any) {
      console.error('Erro ao salvar configurações de e-mail:', err)
      toast({
        title: 'Erro ao salvar',
        description: err?.message || 'Falha ao salvar no servidor. Tente novamente.',
        variant: 'destructive',
      })
    } finally {
      setIsSaving(false)
    }
  }

  const handleReset = () => {
    setSubject(DEFAULT_FEE_OVERDUE_TEMPLATE.subject)
    setTemplate(DEFAULT_FEE_OVERDUE_TEMPLATE.body)
    toast({
      title: 'Texto padrão restaurado',
      description: 'Clique em "Salvar alterações" para aplicá-lo aos próximos envios.',
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
        description="Texto do e-mail de aviso de mensalidade em atraso, usado no disparo manual e no automático."
      />

      <div className="bg-white rounded-2xl border border-[#E8E0D5] shadow-xs p-5 sm:p-6 space-y-6">
        <div className="flex items-start gap-3 bg-[#FAF6F0] border border-[#E8E0D5] rounded-xl p-4">
          <Info className="w-4 h-4 shrink-0 mt-0.5 text-[#C1272D]" />
          <div className="text-xs text-[#6B6560] leading-relaxed">
            <p className="font-semibold text-[#1C1B1A] mb-1">Como este texto é usado</p>
            <p>
              O envio automático acontece uma vez por mês, no{' '}
              <strong className="text-[#1C1B1A]">dia 16</strong> (o vencimento padrão é dia 15), e o
              botão <strong className="text-[#1C1B1A]">"Notificar atrasados"</strong> do painel de
              Alunos envia na hora. Nos dois casos, os placeholders abaixo são preenchidos
              automaticamente:
            </p>
            <ul className="mt-2 space-y-1 list-disc list-inside">
              <li>
                <code className="font-mono text-[#C1272D]">{'{saudacao}'}</code> — bom dia, boa
                tarde ou boa noite, conforme o horário do envio;
              </li>
              <li>
                <code className="font-mono text-[#C1272D]">{'{aluno}'}</code> — nome do aluno;
              </li>
              <li>
                <code className="font-mono text-[#C1272D]">{'{mes}'}</code> — mês da mensalidade em
                atraso (ex.: novembro).
              </li>
            </ul>
          </div>
        </div>

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
            rows={12}
            className="text-sm bg-white border-[#E8E0D5] focus-visible:ring-[#C1272D] font-sans leading-relaxed"
          />
        </div>

        {/* Pré-visualização com os placeholders preenchidos */}
        <div className="space-y-2">
          <p className="text-xs font-bold text-[#1C1B1A] uppercase tracking-wider">
            Pré-visualização
          </p>
          <div className="rounded-xl border border-[#E8E0D5] border-t-4 border-t-[#C1272D] p-4 bg-white text-sm text-[#1C1B1A] leading-relaxed whitespace-pre-line">
            {template
              .split('{saudacao}')
              .join(brasiliaSaudacao())
              .split('{aluno}')
              .join('Pedro da Silva')
              .split('{mes}')
              .join('novembro') || '—'}
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 pt-2 border-t border-[#E8E0D5]">
          <Button
            onClick={handleSave}
            disabled={isSaving || !dirty}
            className="bg-[#C1272D] hover:bg-[#A01E23] text-white text-sm font-semibold"
          >
            {isSaving ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Salvando...
              </>
            ) : (
              <>
                <Save className="w-4 h-4 mr-2" />
                Salvar alterações
              </>
            )}
          </Button>
          <Button
            onClick={handleReset}
            variant="outline"
            className="border-[#E8E0D5] text-[#1C1B1A] hover:bg-[#FAF6F0] text-sm font-semibold"
          >
            <RotateCcw className="w-4 h-4 mr-2" />
            Restaurar texto padrão
          </Button>
          <span className="sm:ml-auto inline-flex items-center gap-1.5 text-[11px] text-[#6B6560]">
            <Mail className="w-3.5 h-3.5" />
            Válido para o e-mail de mensalidade em atraso
          </span>
        </div>
      </div>
    </div>
  )
}
