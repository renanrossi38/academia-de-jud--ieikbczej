import { useAuth } from '@/context/AuthContext'
import {
  DEFAULT_SITE_CONTENT,
  loadSiteContent,
  saveSiteContent,
  type SiteContent,
  type SiteHour,
  type SiteHowStep,
} from '@/services/siteSettings'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useToast } from '@/hooks/use-toast'
import {
  AlignLeft,
  Clock,
  Globe,
  Home,
  Info,
  Loader2,
  MapPin,
  MessageCircle,
  PenLine,
  Plus,
  RotateCcw,
  Save,
  Sparkles,
  Trash2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { AdminPageHeader } from '@/components/admin/AdminPage'

/**
 * /painel/site — edição do conteúdo da página inicial (home). Salva em
 * site_settings (JSON), e a home pública reflete em tempo real (useRealtime).
 * Seções: Hero, Contato (endereço/WhatsApp/e-mail), Horários (lista editável
 * de dia(s) + horário) e Outros (seção "Como funciona").
 */

/** Campo textual pequeno com label — o bloco padrão deste formulário. */
const TextField: React.FC<{
  id: string
  label: string
  value: string
  onChange: (v: string) => void
  textarea?: boolean
  rows?: number
  placeholder?: string
  hint?: string
}> = ({ id, label, value, onChange, textarea, rows = 3, placeholder, hint }) => (
  <div className="space-y-1.5">
    <Label htmlFor={id} className="text-xs font-bold text-[#1C1B1A] uppercase tracking-wider">
      {label}
    </Label>
    {textarea ? (
      <Textarea
        id={id}
        value={value}
        rows={rows}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="text-sm bg-white border-[#E8E0D5] focus-visible:ring-[#C1272D] leading-relaxed"
      />
    ) : (
      <Input
        id={id}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="h-10 text-sm bg-white border-[#E8E0D5] focus-visible:ring-[#C1272D]"
      />
    )}
    {hint && <p className="text-[11px] text-[#6B6560]">{hint}</p>}
  </div>
)

/** Título de seção do formulário (mesmo padrão de AdminEmailSettings). */
const SectionTitle: React.FC<{ icon: React.ReactNode; label: string }> = ({ icon, label }) => (
  <p className="font-serif font-bold text-sm text-[#1C1B1A] flex items-center gap-2">
    <span className="text-[#C1272D]">{icon}</span>
    {label}
  </p>
)

export default function AdminSiteSettings() {
  const { user, isAdmin, isLoading: authLoading } = useAuth()
  const navigate = useNavigate()
  const { toast } = useToast()

  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [content, setContent] = useState<SiteContent>(DEFAULT_SITE_CONTENT)

  useEffect(() => {
    if (authLoading) return
    if (!user) {
      navigate('/entrar?redirect=/painel/site')
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
    loadSiteContent()
      .then(setContent)
      .catch(() => {})
      .finally(() => setIsLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, isAdmin, authLoading])

  const set = (key: keyof SiteContent, value: string) => setContent((c) => ({ ...c, [key]: value }))

  const setHour = (i: number, key: keyof SiteHour, value: string) =>
    setContent((c) => ({
      ...c,
      hours: c.hours.map((h, j) => (j === i ? { ...h, [key]: value } : h)),
    }))

  const addHour = () => setContent((c) => ({ ...c, hours: [...c.hours, { days: '', time: '' }] }))

  const removeHour = (i: number) =>
    setContent((c) => ({ ...c, hours: c.hours.filter((_, j) => j !== i) }))

  const setStep = (i: number, key: keyof SiteHowStep, value: string) =>
    setContent((c) => ({
      ...c,
      how_steps: c.how_steps.map((s, j) => (j === i ? { ...s, [key]: value } : s)),
    }))

  const handleSave = async () => {
    if (
      content.hero_title.trim() === '' ||
      (content.hero_title + ' ' + content.hero_highlight).trim() === ''
    ) {
      toast({
        title: 'Título obrigatório',
        description: 'Escreva o texto principal do hero antes de salvar.',
        variant: 'destructive',
      })
      return
    }
    setIsSaving(true)
    try {
      await saveSiteContent(content, user?.name || user?.email)
      toast({
        title: 'Conteúdo salvo',
        description: 'A página inicial já mostra o novo conteúdo — em tempo real.',
      })
    } catch (err: any) {
      console.error('Erro ao salvar conteúdo da home:', err)
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
    setContent(DEFAULT_SITE_CONTENT)
    toast({
      title: 'Textos padrão restaurados',
      description: 'Clique em "Salvar" para aplicar o conteúdo original da home.',
    })
  }

  if (authLoading || isLoading) {
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        <div className="min-h-[40vh] flex flex-col items-center justify-center text-[#6B6560]">
          <Loader2 className="w-8 h-8 animate-spin text-[#C1272D] mb-3" />
          <p className="font-serif text-sm">Carregando conteúdo da página inicial...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 animate-fade-rise">
      <AdminPageHeader
        title="Página inicial"
        breadcrumb="Página inicial"
        breadcrumbTo="/painel/site"
        description="Edite os textos, o endereço, os horários e o contato que aparecem na home pública. Ao salvar, a home atualiza na hora."
        action={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={handleReset}
              disabled={isSaving}
              className="border-[#E8E0D5] text-[#1C1B1A] hover:bg-[#FAF6F0] text-sm font-semibold"
            >
              <RotateCcw className="w-4 h-4 sm:mr-2" />
              <span className="hidden sm:inline">Padrão</span>
            </Button>
            <Button
              onClick={handleSave}
              disabled={isSaving}
              className="bg-[#C1272D] hover:bg-[#A01E23] text-white text-sm font-semibold"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 sm:mr-2 animate-spin" />
                  <span className="hidden sm:inline">Salvando...</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 sm:mr-2" />
                  <span className="hidden sm:inline">Salvar conteúdo</span>
                </>
              )}
            </Button>
          </div>
        }
      />

      <div className="bg-white rounded-2xl border border-[#E8E0D5] shadow-xs p-5 sm:p-6 space-y-6">
        <div className="flex items-start gap-3 bg-[#FAF6F0] border border-[#E8E0D5] rounded-xl p-4">
          <Info className="w-4 h-4 shrink-0 mt-0.5 text-[#C1272D]" />
          <p className="text-xs text-[#6B6560] leading-relaxed">
            O conteúdo salvo aqui aparece na{' '}
            <strong className="text-[#1C1B1A]">home pública</strong> (hero, seção "Como funciona") e
            no <strong className="text-[#1C1B1A]">rodapé</strong> (endereço, contato e horários).
            Campos deixados em branco mostram o texto padrão atual.
          </p>
        </div>

        {/* ── Hero ── */}
        <section className="space-y-4">
          <SectionTitle icon={<Home className="w-4 h-4" />} label="Hero (topo da home)" />
          <TextField
            id="hero-badge"
            label="Selo pequeno acima do título"
            value={content.hero_badge}
            onChange={(v) => set('hero_badge', v)}
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <TextField
              id="hero-title"
              label="Título principal"
              value={content.hero_title}
              onChange={(v) => set('hero_title', v)}
            />
            <TextField
              id="hero-highlight"
              label="Palavra destacada (vermelha)"
              value={content.hero_highlight}
              onChange={(v) => set('hero_highlight', v)}
            />
          </div>
          <TextField
            id="hero-subtitle"
            label="Texto descritivo da academia"
            textarea
            rows={3}
            value={content.hero_subtitle}
            onChange={(v) => set('hero_subtitle', v)}
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <TextField
              id="hero-chip1"
              label="Verificação 1"
              value={content.hero_chip1}
              onChange={(v) => set('hero_chip1', v)}
            />
            <TextField
              id="hero-chip2"
              label="Verificação 2"
              value={content.hero_chip2}
              onChange={(v) => set('hero_chip2', v)}
            />
          </div>
          <TextField
            id="hero-side-label"
            label="Legenda abaixo do logo (coluna direita)"
            value={content.hero_side_label}
            onChange={(v) => set('hero_side_label', v)}
          />
        </section>

        {/* ── Rodapé — primeiro bloco ── */}
        <section className="space-y-4 pt-2 border-t border-[#E8E0D5]">
          <SectionTitle
            icon={<PenLine className="w-4 h-4" />}
            label="Rodapé — bloco sobre a academia"
          />
          <TextField
            id="footer-about-title"
            label="Título (ao lado do logo)"
            value={content.footer_about_title}
            onChange={(v) => set('footer_about_title', v)}
          />
          <TextField
            id="footer-about-text"
            label="Texto de apresentação da academia"
            textarea
            rows={3}
            value={content.footer_about_text}
            onChange={(v) => set('footer_about_text', v)}
          />
        </section>

        {/* ── Contato ── */}
        <section className="space-y-4 pt-2 border-t border-[#E8E0D5]">
          <SectionTitle icon={<MapPin className="w-4 h-4" />} label="Contato e endereço (rodapé)" />
          <TextField
            id="contact-address1"
            label="Endereço — linha 1"
            value={content.contact_address_line1}
            onChange={(v) => set('contact_address_line1', v)}
          />
          <TextField
            id="contact-address2"
            label="Endereço — linha 2 (cidade / CEP)"
            value={content.contact_address_line2}
            onChange={(v) => set('contact_address_line2', v)}
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <TextField
              id="contact-whatsapp"
              label="Telefone / WhatsApp"
              value={content.contact_whatsapp}
              onChange={(v) => set('contact_whatsapp', v)}
            />
            <TextField
              id="contact-email"
              label="E-mail de contato"
              value={content.contact_email}
              onChange={(v) => set('contact_email', v)}
            />
          </div>
        </section>

        {/* ── Horários ── */}
        <section className="space-y-4 pt-2 border-t border-[#E8E0D5]">
          <SectionTitle
            icon={<Clock className="w-4 h-4" />}
            label="Horários de funcionamento (rodapé)"
          />
          <div className="space-y-3">
            {content.hours.map((h, i) => (
              <div
                key={i}
                className="flex flex-col sm:flex-row gap-2 sm:items-center bg-[#FAF6F0] border border-[#E8E0D5] rounded-xl p-3"
              >
                <Input
                  value={h.days}
                  placeholder="Dia(s) — ex.: Segunda a Sexta"
                  onChange={(e) => setHour(i, 'days', e.target.value)}
                  className="h-9 text-sm bg-white border-[#E8E0D5] focus-visible:ring-[#C1272D] sm:max-w-[42%]"
                />
                <Input
                  value={h.time}
                  placeholder="Horário — ex.: 07h às 21h30"
                  onChange={(e) => setHour(i, 'time', e.target.value)}
                  className="h-9 text-sm bg-white border-[#E8E0D5] focus-visible:ring-[#C1272D]"
                />
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => removeHour(i)}
                  disabled={content.hours.length <= 1}
                  aria-label={`Remover horário ${i + 1}`}
                  className="text-[#B3261E] hover:bg-[#F7E4E2] shrink-0 self-end sm:self-auto"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            ))}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={addHour}
            className="border-[#C1272D]/40 text-[#C1272D] hover:bg-[#F7E4E2] text-xs font-semibold"
          >
            <Plus className="w-4 h-4 mr-1.5" />
            Adicionar horário
          </Button>
        </section>

        {/* ── Como funciona ── */}
        <section className="space-y-4 pt-2 border-t border-[#E8E0D5]">
          <SectionTitle
            icon={<AlignLeft className="w-4 h-4" />}
            label={'Seção "Como funciona" (rodapé da home)'}
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <TextField
              id="how-tag"
              label="Etiqueta pequena"
              value={content.how_tag}
              onChange={(v) => set('how_tag', v)}
            />
            <TextField
              id="how-title"
              label="Título da seção"
              value={content.how_title}
              onChange={(v) => set('how_title', v)}
            />
          </div>
          <TextField
            id="how-subtitle"
            label="Subtítulo"
            textarea
            rows={2}
            value={content.how_subtitle}
            onChange={(v) => set('how_subtitle', v)}
          />
          {content.how_steps.map((s, i) => (
            <div key={i} className="bg-[#FAF6F0] border border-[#E8E0D5] rounded-xl p-4 space-y-3">
              <p className="flex items-center gap-2 text-xs font-bold text-[#1C1B1A] uppercase tracking-wider">
                <span className="w-5 h-5 rounded-full bg-[#C1272D] text-white flex items-center justify-center font-serif text-[10px]">
                  {i + 1}
                </span>
                Passo {i + 1}
              </p>
              <TextField
                id={`how-step-${i}-title`}
                label="Título"
                value={s.title}
                onChange={(v) => setStep(i, 'title', v)}
              />
              <TextField
                id={`how-step-${i}-desc`}
                label="Descrição"
                textarea
                rows={2}
                value={s.description}
                onChange={(v) => setStep(i, 'description', v)}
              />
            </div>
          ))}
          <TextField
            id="how-guarantee-label"
            label="Nota de rodapé — título (em negrito)"
            value={content.how_guarantee_label}
            onChange={(v) => set('how_guarantee_label', v)}
          />
          <TextField
            id="how-guarantee-text"
            label="Nota de rodapé — texto"
            textarea
            rows={2}
            value={content.how_guarantee_text}
            onChange={(v) => set('how_guarantee_text', v)}
          />
        </section>
      </div>

      <div className="mt-4 flex items-center justify-between gap-2 text-[11px] text-[#6B6560] px-1">
        <span className="inline-flex items-center gap-1.5">
          <Globe className="w-3.5 h-3.5" />
          Válido para a home pública e o rodapé
        </span>
        <span className="inline-flex items-center gap-1.5">
          <MessageCircle className="w-3.5 h-3.5" />
          Dúvidas? <Sparkles className="w-3 h-3 text-[#C1272D]" />
        </span>
      </div>
    </div>
  )
}
