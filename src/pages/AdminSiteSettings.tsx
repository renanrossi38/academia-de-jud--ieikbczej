import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Calendar,
  Eye,
  ExternalLink,
  Footprints,
  History,
  Home,
  ImageIcon,
  Loader2,
  Menu,
  Newspaper,
  Phone,
  Sparkles,
  Trophy,
} from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { useToast } from '@/hooks/use-toast'
import { Button } from '@/components/ui/button'
import { AdminPageHeader, AdminPageLoader } from '@/components/admin/AdminPage'
import {
  SiteContent,
  SiteHour,
  SiteHowStep,
  DEFAULT_SITE_CONTENT,
  saveSiteContent,
  useRawSiteContent,
} from '@/services/siteSettings'
import { SiteInput, SiteSection, SiteTextarea } from '@/pages/admin/SiteFields'

/**
 * Editor da página inicial (/painel/site) — reescrito do zero.
 *
 * Organizado por seções, na mesma ordem em que aparecem na home: Menu, Hero,
 * Turmas, Kimonos, Destaques, Notícias, Como funciona, Rodapé (contato +
 * horários + textos). Todo texto visível da home tem campo aqui; o que é
 * identidade fixa da marca (nome "Judô Tatsu" no cabeçalho, kanji) não é
 * editável por decisão consciente — evita campos que salvam mas não refletem.
 *
 * O save é o upsert robusto de saveSiteContent (valida sessão gravável,
 * recria registro em 404 real, explica 403/400 pelo motivo real).
 */

/** Par valor/onChange enxuto passado a cada seção do editor. */
interface EditorProps {
  content: SiteContent
  set: (key: keyof SiteContent, value: string) => void
}

/* ============================ Seção: Menu ============================ */

const MenuSection = ({ content, set }: EditorProps) => (
  <SiteSection
    title="Menu e abas"
    description="Rótulos do menu no cabeçalho/rodapé e das duas abas do topo da home."
    icon={<Menu className="w-5 h-5" />}
  >
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <SiteInput
        label="Aba Turmas"
        value={content.tab_turmas}
        onChange={(v) => set('tab_turmas', v)}
      />
      <SiteInput
        label="Aba Kimonos e Acessórios"
        value={content.tab_kimonos}
        onChange={(v) => set('tab_kimonos', v)}
      />
    </div>
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <SiteInput
        label="Menu — Turmas"
        value={content.nav_turmas}
        onChange={(v) => set('nav_turmas', v)}
      />
      <SiteInput
        label="Menu — Kimonos"
        value={content.nav_kimonos}
        onChange={(v) => set('nav_kimonos', v)}
      />
      <SiteInput
        label="Menu — Destaques"
        value={content.nav_destaques}
        onChange={(v) => set('nav_destaques', v)}
      />
      <SiteInput
        label="Menu — Notícias"
        value={content.nav_noticias}
        onChange={(v) => set('nav_noticias', v)}
      />
      <SiteInput
        label="Menu — Como funciona"
        value={content.nav_como_funciona}
        onChange={(v) => set('nav_como_funciona', v)}
      />
    </div>
  </SiteSection>
)

/* ============================ Seção: Hero ============================ */

const HeroSection = ({ content, set }: EditorProps) => (
  <SiteSection
    title="Topo (Hero)"
    description="Primeira dobra da home: etiqueta, título com palavra destacada em vermelho e frase de apoio."
    icon={<Home className="w-5 h-5" />}
  >
    <SiteInput
      label="Etiqueta acima do título"
      value={content.hero_badge}
      onChange={(v) => set('hero_badge', v)}
    />
    <div className="grid gap-4 sm:grid-cols-2">
      <SiteInput
        label="Título (parte normal)"
        value={content.hero_title}
        onChange={(v) => set('hero_title', v)}
      />
      <SiteInput
        label="Palavra destacada (em vermelho)"
        value={content.hero_highlight}
        onChange={(v) => set('hero_highlight', v)}
      />
    </div>
    <SiteTextarea
      label="Frase de apoio"
      value={content.hero_subtitle}
      onChange={(v) => set('hero_subtitle', v)}
    />
    <div className="grid gap-4 sm:grid-cols-2">
      <SiteInput label="Selo 1" value={content.hero_chip1} onChange={(v) => set('hero_chip1', v)} />
      <SiteInput label="Selo 2" value={content.hero_chip2} onChange={(v) => set('hero_chip2', v)} />
    </div>
  </SiteSection>
)

/* ====================== Seção: Turmas (aba ativa) ====================== */

const ClassesSection = ({ content, set }: EditorProps) => (
  <SiteSection
    title="Turmas"
    description="Textos da lista de turmas (aba Turmas do topo da home)."
    icon={<Calendar className="w-5 h-5" />}
  >
    <div className="grid gap-4 sm:grid-cols-2">
      <SiteInput
        label="Texto de carregamento"
        value={content.classes_loading}
        onChange={(v) => set('classes_loading', v)}
      />
      <SiteInput
        label="Rótulo 'Mensalidade:'"
        value={content.class_fee_label}
        onChange={(v) => set('class_fee_label', v)}
      />
      <SiteInput
        label="Rótulo 'Vagas:'"
        value={content.class_vagas_label}
        onChange={(v) => set('class_vagas_label', v)}
      />
      <SiteInput
        label="Texto quando não há horário"
        value={content.class_schedule_fallback}
        onChange={(v) => set('class_schedule_fallback', v)}
      />
      <SiteInput
        label="Link 'Consultar' (mensalidade)"
        value={content.class_fee_consult}
        onChange={(v) => set('class_fee_consult', v)}
      />
      <SiteInput
        label="Botão de matrícula"
        value={content.class_enroll_button}
        onChange={(v) => set('class_enroll_button', v)}
      />
      <SiteInput
        label="Título quando não há turma"
        value={content.classes_empty_title}
        onChange={(v) => set('classes_empty_title', v)}
      />
      <SiteInput
        label="Texto quando não há turma"
        value={content.classes_empty_text}
        onChange={(v) => set('classes_empty_text', v)}
      />
    </div>
  </SiteSection>
)

/* ===================== Seção: Kimonos (aba ativa) ===================== */

const ShopSection = ({ content, set }: EditorProps) => (
  <SiteSection
    title="Kimonos e Acessórios"
    description="Textos da vitrine de produtos (aba Kimonos do topo da home)."
    icon={<ImageIcon className="w-5 h-5" />}
  >
    <SiteInput
      label="Texto de carregamento"
      value={content.shop_loading}
      onChange={(v) => set('shop_loading', v)}
    />
    <div className="grid gap-4 sm:grid-cols-3">
      <SiteInput
        label="Categoria: Todos"
        value={content.shop_cat_all}
        onChange={(v) => set('shop_cat_all', v)}
      />
      <SiteInput
        label="Categoria: Uniformes"
        value={content.shop_cat_uniformes}
        onChange={(v) => set('shop_cat_uniformes', v)}
      />
      <SiteInput
        label="Categoria: Faixas"
        value={content.shop_cat_faixas}
        onChange={(v) => set('shop_cat_faixas', v)}
      />
      <SiteInput
        label="Categoria: Camisetas"
        value={content.shop_cat_camisetas}
        onChange={(v) => set('shop_cat_camisetas', v)}
      />
      <SiteInput
        label="Etiqueta: Uniforme"
        value={content.shop_badge_uniformes}
        onChange={(v) => set('shop_badge_uniformes', v)}
      />
      <SiteInput
        label="Etiqueta: Faixa"
        value={content.shop_badge_faixas}
        onChange={(v) => set('shop_badge_faixas', v)}
      />
      <SiteInput
        label="Etiqueta: Camiseta"
        value={content.shop_badge_camisetas}
        onChange={(v) => set('shop_badge_camisetas', v)}
      />
      <SiteInput
        label="Prefixo de preço"
        value={content.shop_price_prefix}
        onChange={(v) => set('shop_price_prefix', v)}
      />
      <SiteInput
        label="Botão de detalhes"
        value={content.shop_details_button}
        onChange={(v) => set('shop_details_button', v)}
      />
    </div>
    <div className="grid gap-4 sm:grid-cols-2">
      <SiteInput
        label="Título quando não há produto"
        value={content.shop_empty_title}
        onChange={(v) => set('shop_empty_title', v)}
      />
      <SiteInput
        label="Botão 'ver todos'"
        value={content.shop_empty_button}
        onChange={(v) => set('shop_empty_button', v)}
      />
    </div>
    <SiteTextarea
      label="Texto quando não há produto"
      value={content.shop_empty_text}
      onChange={(v) => set('shop_empty_text', v)}
      rows={2}
    />
  </SiteSection>
)

/* ========================= Seção: Destaques ========================= */

const HighlightsSection = ({ content, set }: EditorProps) => (
  <SiteSection
    title="Destaques"
    description="Rótulos da seção de destaques de alunos e competições. O CONTEÚDO dos destaques (fotos, alunos, medalhas) continua no painel 'Destaques'."
    icon={<Trophy className="w-5 h-5" />}
  >
    <div className="grid gap-4 sm:grid-cols-2">
      <SiteInput
        label="Etiqueta acima do título"
        value={content.highlights_tag}
        onChange={(v) => set('highlights_tag', v)}
      />
      <SiteInput
        label="Título da seção"
        value={content.highlights_title}
        onChange={(v) => set('highlights_title', v)}
      />
    </div>
    <SiteTextarea
      label="Frase de apoio"
      value={content.highlights_subtitle}
      onChange={(v) => set('highlights_subtitle', v)}
      rows={2}
    />
    <div className="grid gap-4 sm:grid-cols-2">
      <SiteInput
        label="Subtítulo do bloco do mês"
        value={content.highlights_month_title}
        onChange={(v) => set('highlights_month_title', v)}
      />
      <SiteInput
        label="Subtítulo do bloco de competições"
        value={content.highlights_comp_title}
        onChange={(v) => set('highlights_comp_title', v)}
      />
    </div>
  </SiteSection>
)

/* ========================= Seção: Notícias ========================= */

const NewsSection = ({ content, set }: EditorProps) => (
  <SiteSection
    title="Notícias"
    description="Rótulos da seção de notícias (feed do Instagram). O título tem uma parte em vermelho."
    icon={<Newspaper className="w-5 h-5" />}
  >
    <SiteInput
      label="Etiqueta acima do título"
      value={content.news_tag}
      onChange={(v) => set('news_tag', v)}
    />
    <div className="grid gap-4 sm:grid-cols-2">
      <SiteInput
        label="Título (parte normal)"
        value={content.news_title}
        onChange={(v) => set('news_title', v)}
      />
      <SiteInput
        label="Título (parte em vermelho)"
        value={content.news_title_highlight}
        onChange={(v) => set('news_title_highlight', v)}
      />
    </div>
    <SiteTextarea
      label="Frase de apoio"
      value={content.news_subtitle}
      onChange={(v) => set('news_subtitle', v)}
      rows={2}
    />
    <div className="grid gap-4 sm:grid-cols-2">
      <SiteInput
        label="Texto de carregamento"
        value={content.news_loading}
        onChange={(v) => set('news_loading', v)}
      />
      <SiteInput
        label="Selo 'Mais recente'"
        value={content.news_latest_badge}
        onChange={(v) => set('news_latest_badge', v)}
      />
      <SiteInput
        label="Link 'Ver no Instagram'"
        value={content.news_open_label}
        onChange={(v) => set('news_open_label', v)}
      />
      <SiteInput
        label="Texto quando a publicação não tem legenda"
        value={content.news_fallback_caption}
        onChange={(v) => set('news_fallback_caption', v)}
      />
      <SiteInput
        label="Texto nos cartões pequenos sem legenda"
        value={content.news_fallback_thumb}
        onChange={(v) => set('news_fallback_thumb', v)}
      />
    </div>
  </SiteSection>
)

/* ====================== Seção: Como funciona ====================== */

const HowSection = ({ content, set }: EditorProps) => {
  const steps = content.how_steps
  const setStep = (i: number, patch: Partial<SiteHowStep>) => {
    const next = steps.map((s, j) => (j === i ? { ...s, ...patch } : s))
    set('how_steps', JSON.stringify(next))
  }
  return (
    <SiteSection
      title="Como funciona"
      description="Os três passos de matrícula/compra e a nota de garantia."
      icon={<Footprints className="w-5 h-5" />}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <SiteInput label="Etiqueta" value={content.how_tag} onChange={(v) => set('how_tag', v)} />
        <SiteInput label="Título" value={content.how_title} onChange={(v) => set('how_title', v)} />
      </div>
      <SiteTextarea
        label="Frase de apoio"
        value={content.how_subtitle}
        onChange={(v) => set('how_subtitle', v)}
        rows={2}
      />
      <div className="space-y-3">
        {steps.map((step, i) => (
          <div key={i} className="rounded-lg border p-4 space-y-3">
            <SiteInput
              label={'Passo ' + (i + 1) + ' — título'}
              value={step.title}
              onChange={(v) => setStep(i, { title: v })}
            />
            <SiteTextarea
              label={'Passo ' + (i + 1) + ' — descrição'}
              value={step.description}
              onChange={(v) => setStep(i, { description: v })}
              rows={2}
            />
          </div>
        ))}
      </div>
      <div className="grid gap-4 sm:grid-cols-[auto_1fr] items-start">
        <SiteInput
          label="Garantia — rótulo em negrito"
          value={content.how_guarantee_label}
          onChange={(v) => set('how_guarantee_label', v)}
        />
        <SiteInput
          label="Garantia — texto"
          value={content.how_guarantee_text}
          onChange={(v) => set('how_guarantee_text', v)}
        />
      </div>
    </SiteSection>
  )
}

/* ================== Seção: Rodapé (contato e horários) ================== */

const FooterSection = ({ content, set }: EditorProps) => {
  const hours = content.hours
  const setHour = (i: number, patch: Partial<SiteHour>) => {
    const next = hours.map((h, j) => (j === i ? { ...h, ...patch } : h))
    set('hours', JSON.stringify(next))
  }
  return (
    <SiteSection
      title="Rodapé, contato e horários"
      description="Textos das três colunas do rodapé e os dados de contato exibidos nele."
      icon={<Phone className="w-5 h-5" />}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <SiteInput
          label="Nome da academia (rodapé)"
          value={content.footer_about_title}
          onChange={(v) => set('footer_about_title', v)}
        />
        <SiteInput
          label="Etiqueta abaixo do nome"
          value={content.footer_brand_tag}
          onChange={(v) => set('footer_brand_tag', v)}
        />
      </div>
      <SiteTextarea
        label="Texto sobre a academia"
        value={content.footer_about_text}
        onChange={(v) => set('footer_about_text', v)}
        rows={3}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <SiteInput
          label="Título da coluna Horários"
          value={content.footer_hours_title}
          onChange={(v) => set('footer_hours_title', v)}
        />
        <SiteInput
          label="Título da coluna Contato"
          value={content.footer_contact_title}
          onChange={(v) => set('footer_contact_title', v)}
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <SiteInput
          label="WhatsApp exibido"
          value={content.contact_whatsapp}
          onChange={(v) => set('contact_whatsapp', v)}
        />
        <SiteInput
          label="E-mail exibido"
          value={content.contact_email}
          onChange={(v) => set('contact_email', v)}
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <SiteInput
          label="Endereço — linha 1"
          value={content.contact_address_line1}
          onChange={(v) => set('contact_address_line1', v)}
        />
        <SiteInput
          label="Endereço — linha 2"
          value={content.contact_address_line2}
          onChange={(v) => set('contact_address_line2', v)}
        />
      </div>
      <div>
        <p className="text-sm font-medium mb-2">Horários de funcionamento</p>
        <div className="space-y-2">
          {hours.map((h, i) => (
            <div key={i} className="grid gap-2 sm:grid-cols-[1fr_1fr]">
              <SiteInput
                label={'Linha ' + (i + 1) + ' — dia(s)'}
                value={h.days}
                onChange={(v) => setHour(i, { days: v })}
              />
              <SiteInput
                label={'Linha ' + (i + 1) + ' — horário'}
                value={h.time}
                onChange={(v) => setHour(i, { time: v })}
              />
            </div>
          ))}
        </div>
      </div>
      <SiteInput
        label="Frase de direitos autorais"
        value={content.footer_rights}
        onChange={(v) => set('footer_rights', v)}
      />
    </SiteSection>
  )
}

const SECTIONS = [
  MenuSection,
  HeroSection,
  ClassesSection,
  ShopSection,
  HighlightsSection,
  NewsSection,
  HowSection,
  FooterSection,
]

/* ============================== Página ============================== */

export default function AdminSiteSettings() {
  const { user } = useAuth()
  const { toast } = useToast()
  const navigate = useNavigate()
  const { raw, isLoading, refresh } = useRawSiteContent()
  const [content, setContent] = useState<SiteContent | null>(null)
  const [saving, setSaving] = useState(false)

  // O formulário abre com o JSON BRUTO salvo (defaults só onde nada foi salvo),
  // mas NÃO segue realtime: edits locais não são sobrescritos no meio da edição.
  useEffect(() => {
    if (content === null && raw !== null) {
      setContent({ ...DEFAULT_SITE_CONTENT, ...raw } as SiteContent)
    }
  }, [raw, content])

  const set = useCallback((key: keyof SiteContent, value: string) => {
    setContent((prev) => {
      if (!prev) return prev
      // Campos array (how_steps, hours) chegam como JSON string.
      if (key === 'how_steps' || key === 'hours') {
        try {
          return { ...prev, [key]: JSON.parse(value) }
        } catch {
          return prev
        }
      }
      return { ...prev, [key]: value }
    })
  }, [])

  const dirty = useMemo(
    () =>
      !!content && JSON.stringify(content) !== JSON.stringify({ ...DEFAULT_SITE_CONTENT, ...raw }),
    [content, raw],
  )

  const handleSave = async () => {
    if (!content) return
    setSaving(true)
    try {
      await saveSiteContent(content, user?.name)
      toast({
        title: 'Conteúdo atualizado!',
        description: 'A página inicial já mostra os novos textos.',
      })
      await refresh()
    } catch (err) {
      toast({
        title: 'Erro ao salvar',
        description: err instanceof Error ? err.message : 'Tente novamente.',
        variant: 'destructive',
      })
      // Sessão morta: saveSiteContent já limpou o authStore; manda para o login.
      const msg = err instanceof Error ? err.message : ''
      if (msg.includes('não é mais válida') || msg.includes('expirou')) {
        navigate('/entrar')
        return
      }
    } finally {
      setSaving(false)
    }
  }

  if (isLoading || content === null) {
    return (
      <div className="p-4 sm:p-6 lg:p-8">
        <AdminPageHeader
          breadcrumb="Página inicial"
          breadcrumbTo="/painel/site"
          title="Editar página inicial"
          description="Todos os textos da home, organizados por seção."
          icon={<Eye className="w-6 h-6" />}
        />
        <AdminPageLoader label="Carregando conteúdo da página inicial..." />
      </div>
    )
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 pb-28">
      <AdminPageHeader
        breadcrumb="Página inicial"
        breadcrumbTo="/painel/site"
        title="Editar página inicial"
        description="Todos os textos da home, organizados por seção. Ao salvar, a home aberta atualiza na hora (tempo real)."
        icon={<Eye className="w-6 h-6" />}
        action={
          <div className="flex items-center gap-2">
            <Button variant="outline" asChild>
              <a href="/" target="_blank" rel="noreferrer">
                <ExternalLink className="w-4 h-4 mr-2" />
                Ver home
              </a>
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Salvando...
                </>
              ) : (
                'Salvar'
              )}
            </Button>
            {dirty && <span className="text-xs text-amber-600">alterações não salvas</span>}
          </div>
        }
      />

      <div className="space-y-5 max-w-4xl">
        {SECTIONS.map((S, i) => (
          <S key={i} content={content} set={set} />
        ))}
      </div>

      {/* Barra de ação fixa (sempre acessível com a página longa) */}
      <div className="fixed bottom-0 left-0 right-0 z-30 border-t bg-background/95 backdrop-blur-sm p-3">
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-3">
          <span className="text-xs text-muted-foreground truncate">
            {dirty ? 'Você tem alterações não salvas' : 'Tudo salvo'}
          </span>
          <div className="flex items-center gap-2 shrink-0">
            <Button variant="outline" asChild>
              <a href="/" target="_blank" rel="noreferrer">
                <Eye className="w-4 h-4 mr-2" />
                Ver home
              </a>
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Salvando...
                </>
              ) : (
                'Salvar'
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
