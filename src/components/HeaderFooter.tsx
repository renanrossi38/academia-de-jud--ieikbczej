import React, { useEffect, useState } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { useCart } from '@/context/CartContext'
import { HankoStamp } from '@/components/HankoStamp'
import { BrushDivider } from '@/components/hero/HeroDecor'
import { HomeAnchor } from '@/components/homeAnchors'
import {
  User,
  LogOut,
  ShoppingBag,
  Menu,
  X,
  ChevronDown,
  LayoutDashboard,
  UserCog,
  Users,
  GraduationCap,
  Calendar,
  Home,
  Settings,
  Mail,
  Package,
  BarChart3,
  UsersRound,
  ShieldCheck,
  Wallet,
  CalendarCheck,
  Trophy,
  Award,
} from 'lucide-react'
import { useSiteContent } from '@/services/siteSettings'
import { hasArea, AdminArea } from '@/lib/adminAreas'
import { AdminRoleBadge } from '@/components/admin/AdminRoleBadge'

const JUDO_KANJI = '\u67D4\u9053' // 柔道 — "o caminho suave" (identidade do rodapé)

/**
 * Itens de navegação do painel (o menu do admin respeita as permissões da
 * área). A área "site" abre DUAS páginas distintas de propósito claro:
 * "Página inicial" (conteúdo da home) e "Configurações" (mensagens de
 * cobrança + Pagamento via Pix).
 */
const PANEL_NAV: { area: AdminArea; to: string; icon: React.ReactNode; label: string }[] = [
  {
    area: 'alunos',
    to: '/painel/alunos',
    icon: <UsersRound className="w-4 h-4" />,
    label: 'Alunos',
  },
  {
    area: 'mensalidades',
    to: '/painel/alunos',
    icon: <Wallet className="w-4 h-4" />,
    label: 'Mensalidades',
  },
  {
    area: 'presencas',
    to: '/painel/turmas',
    icon: <Users className="w-4 h-4" />,
    label: 'Turmas',
  },
  {
    area: 'presencas',
    to: '/painel/ranking',
    icon: <Trophy className="w-4 h-4" />,
    label: 'Ranking',
  },
  {
    area: 'presencas',
    to: '/painel/presenca',
    icon: <CalendarCheck className="w-4 h-4" />,
    label: 'Presenças',
  },
  {
    area: 'destaques',
    to: '/painel/destaques',
    icon: <Award className="w-4 h-4" />,
    label: 'Destaques',
  },
  {
    area: 'produtos',
    to: '/painel/produtos',
    icon: <Package className="w-4 h-4" />,
    label: 'Loja (Produtos)',
  },
  {
    area: 'pedidos',
    to: '/painel/pedidos',
    icon: <ShoppingBag className="w-4 h-4" />,
    label: 'Pedidos',
  },
  {
    area: 'financeiro',
    to: '/painel/financeiro',
    icon: <BarChart3 className="w-4 h-4" />,
    label: 'Financeiro',
  },
  { area: 'site', to: '/painel/site', icon: <Home className="w-4 h-4" />, label: 'Página inicial' },
  {
    area: 'site',
    to: '/painel/configuracoes',
    icon: <Settings className="w-4 h-4" />,
    label: 'Configurações',
  },
]

/** Âncoras da home (rolagem suave descontando o header — homeAnchors.tsx). */
const HOME_SECTIONS: { href: string; label: string }[] = [
  { href: '#turmas', label: 'Turmas' },
  { href: '#kimonos', label: 'Kimonos' },
  { href: '#destaques', label: 'Destaques' },
  { href: '#instagram', label: 'Notícias' },
  { href: '#como-funciona', label: 'Como funciona' },
]

export const Header: React.FC = () => {
  const { user, isAdmin, isOwner, hasArea, logout } = useAuth()
  const { itemCount, setIsDrawerOpen, badgeAnimate } = useCart()
  const navigate = useNavigate()
  const location = useLocation()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [accountOpen, setAccountOpen] = useState(false)
  const [panelOpen, setPanelOpen] = useState(false)

  // Fecha qualquer menu aberto quando a rota muda (navegação sempre "limpa").
  useEffect(() => {
    setMobileOpen(false)
    setAccountOpen(false)
    setPanelOpen(false)
  }, [location.pathname, location.hash])

  const handleLogout = () => {
    logout()
    setAccountOpen(false)
    setMobileOpen(false)
    navigate('/')
  }

  /**
   * Itens de navegação liberados para o admin logado (a permissão da área
   * controla o par "Página inicial" + "Configurações" juntos).
   */
  const allowedNav = PANEL_NAV.filter((item) => hasArea(item.area))

  return (
    <header className="sticky top-0 z-40 bg-[#FAF6F0]/95 backdrop-blur-sm border-b border-[#E8E0D5] shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 lg:h-[72px]">
          {/* ===== Logo (dragão oficial) ===== */}
          <Link
            to="/"
            className="flex items-center gap-2.5 shrink-0"
            aria-label="Judô Tatsu — início"
          >
            <HankoStamp size="md" className="lg:w-12 lg:h-12" />
            <span className="hidden sm:flex flex-col leading-none">
              <span className="font-serif font-black text-lg text-[#1C1B1A] tracking-tight">
                Judô Tatsu
              </span>
              <span className="text-[10px] font-bold uppercase tracking-[0.3em] text-[#C1272D]">
                Academia
              </span>
            </span>
          </Link>

          {/* ===== Menu desktop ===== */}
          <nav className="hidden md:flex items-center gap-1" aria-label="Navegação principal">
            {HOME_SECTIONS.map((s) => (
              <HomeAnchor
                key={s.href}
                href={s.href}
                className="px-3 py-2 text-sm font-medium text-[#4A443F] hover:text-[#C1272D] transition-colors rounded-md hover:bg-[#F7E4E2]/50 select-none"
              >
                {s.label}
              </HomeAnchor>
            ))}
          </nav>

          {/* ===== Ações (conta + carrinho + hambúrguer) ===== */}
          <div className="flex items-center gap-1.5 sm:gap-2">
            {isAdmin && (
              <div className="hidden md:block relative">
                <button
                  onClick={() => {
                    setPanelOpen((v) => !v)
                    setAccountOpen(false)
                  }}
                  className="flex items-center gap-1.5 px-3 py-2 text-sm font-semibold text-[#C1272D] hover:bg-[#F7E4E2]/60 rounded-md transition-colors select-none"
                  aria-expanded={panelOpen}
                  aria-haspopup="menu"
                >
                  <LayoutDashboard className="w-4 h-4" />
                  Painel
                  <ChevronDown
                    className={`w-3.5 h-3.5 transition-transform ${panelOpen ? 'rotate-180' : ''}`}
                  />
                </button>
                {panelOpen && (
                  <div
                    className="absolute right-0 top-full mt-1 w-60 bg-white rounded-xl border border-[#E8E0D5] shadow-lg py-1.5 z-50"
                    role="menu"
                  >
                    {allowedNav.map((item) => (
                      <Link
                        key={item.to}
                        to={item.to}
                        role="menuitem"
                        className="flex items-center gap-2.5 px-3 py-2 text-sm text-[#1C1B1A] hover:bg-[#FAF6F0] hover:text-[#C1272D] transition-colors"
                        onClick={() => setPanelOpen(false)}
                      >
                        <span className="text-[#C1272D]">{item.icon}</span>
                        {item.label}
                      </Link>
                    ))}
                    <div className="border-t border-[#E8E0D5] mt-1.5 pt-1.5">
                      {isOwner && (
                        <Link
                          to="/painel/admins"
                          role="menuitem"
                          className="flex items-center gap-2.5 px-3 py-2 text-sm text-[#1C1B1A] hover:bg-[#FAF6F0] hover:text-[#C1272D] transition-colors"
                          onClick={() => setPanelOpen(false)}
                        >
                          <ShieldCheck className="w-4 h-4 text-[#C1272D]" />
                          Administradores
                        </Link>
                      )}
                      <Link
                        to="/painel/configuracoes"
                        role="menuitem"
                        className="flex items-center gap-2.5 px-3 py-2 text-sm text-[#1C1B1A] hover:bg-[#FAF6F0] hover:text-[#C1272D] transition-colors"
                        onClick={() => setPanelOpen(false)}
                      >
                        <Mail className="w-4 h-4 text-[#C1272D]" />
                        Mensagens de cobrança
                      </Link>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Conta (desktop): ícone + dropdown */}
            <div className="hidden md:block relative">
              {user ? (
                <>
                  <button
                    onClick={() => {
                      setAccountOpen((v) => !v)
                      setPanelOpen(false)
                    }}
                    className="flex items-center gap-1.5 pl-1.5 pr-2.5 py-1.5 rounded-full hover:bg-[#F7E4E2]/60 transition-colors select-none"
                    aria-expanded={accountOpen}
                    aria-haspopup="menu"
                  >
                    <span className="w-8 h-8 rounded-full bg-[#C1272D] text-white flex items-center justify-center font-serif font-bold text-sm overflow-hidden">
                      {user.name ? user.name[0].toUpperCase() : JUDO_KANJI[0]}
                    </span>
                    <ChevronDown
                      className={`w-3.5 h-3.5 text-[#6B6560] transition-transform ${
                        accountOpen ? 'rotate-180' : ''
                      }`}
                    />
                  </button>
                  {accountOpen && (
                    <div
                      className="absolute right-0 top-full mt-1.5 w-64 bg-white rounded-xl border border-[#E8E0D5] shadow-lg py-2 z-50"
                      role="menu"
                    >
                      <div className="px-3.5 pb-2 border-b border-[#E8E0D5]">
                        <p className="text-sm font-bold text-[#1C1B1A] truncate flex items-center gap-1.5 flex-wrap">
                          <span className="truncate">{user.name || 'Sem nome'}</span>
                          {isAdmin && <AdminRoleBadge isOwner={isOwner} />}
                        </p>
                        <p className="text-xs text-[#6B6560] truncate mt-0.5">{user.email}</p>
                      </div>
                      <Link
                        to="/conta"
                        role="menuitem"
                        className="flex items-center gap-2.5 px-3.5 py-2 text-sm text-[#1C1B1A] hover:bg-[#FAF6F0] hover:text-[#C1272D] transition-colors"
                        onClick={() => setAccountOpen(false)}
                      >
                        <UserCog className="w-4 h-4 text-[#6B6560]" />
                        Minha conta
                      </Link>
                      {isAdmin ? (
                        <Link
                          to="/area-do-aluno"
                          role="menuitem"
                          className="flex items-center gap-2.5 px-3.5 py-2 text-sm text-[#1C1B1A] hover:bg-[#FAF6F0] hover:text-[#C1272D] transition-colors"
                          onClick={() => setAccountOpen(false)}
                        >
                          <GraduationCap className="w-4 h-4 text-[#6B6560]" />
                          Área do aluno
                        </Link>
                      ) : (
                        <>
                          <Link
                            to="/meus-pedidos"
                            role="menuitem"
                            className="flex items-center gap-2.5 px-3.5 py-2 text-sm text-[#1C1B1A] hover:bg-[#FAF6F0] hover:text-[#C1272D] transition-colors"
                            onClick={() => setAccountOpen(false)}
                          >
                            <Package className="w-4 h-4 text-[#6B6560]" />
                            Meus pedidos
                          </Link>
                          <Link
                            to="/area-do-aluno"
                            role="menuitem"
                            className="flex items-center gap-2.5 px-3.5 py-2 text-sm text-[#1C1B1A] hover:bg-[#FAF6F0] hover:text-[#C1272D] transition-colors"
                            onClick={() => setAccountOpen(false)}
                          >
                            <GraduationCap className="w-4 h-4 text-[#6B6560]" />
                            Área do aluno
                          </Link>
                        </>
                      )}
                      <button
                        onClick={handleLogout}
                        role="menuitem"
                        className="w-full flex items-center gap-2.5 px-3.5 py-2 text-sm text-[#B3261E] hover:bg-[#F7E4E2] transition-colors text-left"
                      >
                        <LogOut className="w-4 h-4" />
                        Sair
                      </button>
                    </div>
                  )}
                </>
              ) : (
                <Link
                  to="/entrar"
                  className="flex items-center gap-1.5 px-3 py-2 text-sm font-semibold text-[#1C1B1A] hover:text-[#C1272D] transition-colors rounded-md hover:bg-[#F7E4E2]/60 select-none"
                >
                  <User className="w-4 h-4" />
                  Entrar
                </Link>
              )}
            </div>

            {/* Carrinho (todas as telas) */}
            <button
              onClick={() => setIsDrawerOpen(true)}
              className="relative p-2 rounded-full text-[#1C1B1A] hover:text-[#C1272D] hover:bg-[#F7E4E2]/60 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C1272D]/40 focus-visible:ring-offset-2 focus-visible:ring-offset-[#FAF6F0]"
              aria-label={`Abrir carrinho (${itemCount} ${itemCount === 1 ? 'item' : 'itens'})`}
            >
              <ShoppingBag className="w-5 h-5" />
              {itemCount > 0 && (
                <span
                  className={`absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-[#C1272D] text-white text-[10px] font-bold flex items-center justify-center ${
                    badgeAnimate ? 'animate-badge-pop' : ''
                  }`}
                >
                  {itemCount > 9 ? '9+' : itemCount}
                </span>
              )}
            </button>

            {/* Hambúrguer (mobile) */}
            <button
              onClick={() => setMobileOpen((v) => !v)}
              className="md:hidden p-2 rounded-full text-[#1C1B1A] hover:bg-[#F7E4E2]/60 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C1272D]/40 focus-visible:ring-offset-2 focus-visible:ring-offset-[#FAF6F0]"
              aria-label={mobileOpen ? 'Fechar menu' : 'Abrir menu'}
              aria-expanded={mobileOpen}
            >
              {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>

      {/* ===== Menu mobile (painel abaixo do header, mesma largura da tela) ===== */}
      {mobileOpen && (
        <div className="md:hidden border-t border-[#E8E0D5] bg-[#FAF6F0] max-h-[calc(100dvh-64px)] overflow-y-auto">
          <div className="px-4 py-3 space-y-1">
            {HOME_SECTIONS.map((s) => (
              <HomeAnchor
                key={s.href}
                href={s.href}
                onClick={() => setMobileOpen(false)}
                className="block px-3 py-2.5 text-base font-medium text-[#1C1B1A] hover:bg-[#F7E4E2]/60 hover:text-[#C1272D] rounded-lg transition-colors select-none"
              >
                {s.label}
              </HomeAnchor>
            ))}

            {isAdmin && (
              <div className="pt-2 border-t border-[#E8E0D5] mt-2">
                <p className="px-3 pt-2 pb-1 text-[10px] font-bold uppercase tracking-[0.2em] text-[#9A948C]">
                  Painel
                </p>
                {allowedNav.map((item) => (
                  <Link
                    key={item.to}
                    to={item.to}
                    className="flex items-center gap-2.5 px-3 py-2.5 text-sm font-medium text-[#1C1B1A] hover:bg-[#F7E4E2]/60 hover:text-[#C1272D] rounded-lg transition-colors"
                    onClick={() => setMobileOpen(false)}
                  >
                    <span className="text-[#C1272D]">{item.icon}</span>
                    {item.label}
                  </Link>
                ))}
                {isOwner && (
                  <Link
                    to="/painel/admins"
                    className="flex items-center gap-2.5 px-3 py-2.5 text-sm font-medium text-[#1C1B1A] hover:bg-[#F7E4E2]/60 hover:text-[#C1272D] rounded-lg transition-colors"
                    onClick={() => setMobileOpen(false)}
                  >
                    <ShieldCheck className="w-4 h-4 text-[#C1272D]" />
                    Administradores
                  </Link>
                )}
              </div>
            )}

            {/* Conta no mobile */}
            <div className="pt-2 border-t border-[#E8E0D5] mt-2">
              {user ? (
                <>
                  <div className="flex items-center gap-3 px-3 py-2.5">
                    <span className="w-9 h-9 rounded-full bg-[#C1272D] text-white flex items-center justify-center font-serif font-bold text-sm overflow-hidden shrink-0">
                      {user.name ? user.name[0].toUpperCase() : JUDO_KANJI[0]}
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-[#1C1B1A] truncate flex items-center gap-1.5 flex-wrap">
                        <span className="truncate">{user.name || 'Sem nome'}</span>
                        {isAdmin && <AdminRoleBadge isOwner={isOwner} />}
                      </p>
                      <p className="text-[11px] text-[#6B6560] truncate">
                        {user.role === 'admin' ? 'Administrador' : 'Aluno'} · {user.email}
                      </p>
                    </div>
                  </div>
                  <Link
                    to="/conta"
                    className="flex items-center gap-2.5 px-3 py-2.5 text-sm font-medium text-[#1C1B1A] hover:bg-[#F7E4E2]/60 hover:text-[#C1272D] rounded-lg transition-colors"
                    onClick={() => setMobileOpen(false)}
                  >
                    <UserCog className="w-4 h-4 text-[#6B6560]" />
                    Minha conta
                  </Link>
                  <Link
                    to="/meus-pedidos"
                    className="flex items-center gap-2.5 px-3 py-2.5 text-sm font-medium text-[#1C1B1A] hover:bg-[#F7E4E2]/60 hover:text-[#C1272D] rounded-lg transition-colors"
                    onClick={() => setMobileOpen(false)}
                  >
                    <Package className="w-4 h-4 text-[#6B6560]" />
                    Meus pedidos
                  </Link>
                  <Link
                    to="/area-do-aluno"
                    className="flex items-center gap-2.5 px-3 py-2.5 text-sm font-medium text-[#1C1B1A] hover:bg-[#F7E4E2]/60 hover:text-[#C1272D] rounded-lg transition-colors"
                    onClick={() => setMobileOpen(false)}
                  >
                    <GraduationCap className="w-4 h-4 text-[#6B6560]" />
                    Área do aluno
                  </Link>
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm font-medium text-[#B3261E] hover:bg-[#F7E4E2] rounded-lg transition-colors text-left"
                  >
                    <LogOut className="w-4 h-4" />
                    Sair
                  </button>
                </>
              ) : (
                <div className="flex flex-col gap-2 px-3 py-2">
                  <Link
                    to="/entrar"
                    className="flex items-center justify-center gap-2 px-4 py-2.5 bg-[#C1272D] text-white text-sm font-semibold rounded-lg hover:bg-[#A01E23] transition-colors"
                    onClick={() => setMobileOpen(false)}
                  >
                    <User className="w-4 h-4" />
                    Entrar
                  </Link>
                  <Link
                    to="/criar-conta"
                    className="flex items-center justify-center gap-2 px-4 py-2.5 border border-[#C1272D] text-[#C1272D] text-sm font-semibold rounded-lg hover:bg-[#F7E4E2] transition-colors"
                    onClick={() => setMobileOpen(false)}
                  >
                    Criar conta
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </header>
  )
}

export const Footer: React.FC = () => {
  const site = useSiteContent()

  return (
    <footer className="bg-[#1C1B1A] text-[#FAF6F0]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
          {/* ===== Bloco 1: logo + nome + texto sobre a academia (editável) ===== */}
          <div>
            <div className="flex items-center gap-3 mb-4">
              <HankoStamp size="lg" className="brightness-0 invert" />
              <div>
                <p className="font-serif font-black text-xl text-[#FAF6F0] leading-tight">
                  {site.footer_about_title}
                </p>
                <span className="text-[10px] font-bold uppercase tracking-[0.3em] text-[#D8434A]">
                  Academia de Judô
                </span>
              </div>
            </div>
            <p className="text-sm text-[#B8B2A8] leading-relaxed">{site.footer_about_text}</p>
            {/* Kanji do judô (柔道) — assinatura da identidade no rodapé */}
            <p
              className="mt-5 font-serif font-black text-3xl text-[#C1272D] leading-none tracking-widest select-none"
              aria-hidden="true"
            >
              {JUDO_KANJI}
            </p>
          </div>

          {/* ===== Bloco 2: horários de funcionamento ===== */}
          <div>
            <h3 className="font-serif font-bold text-base text-[#FAF6F0] mb-4 flex items-center gap-2">
              <Calendar className="w-4 h-4 text-[#D8434A]" />
              Horários
            </h3>
            <BrushDivider className="w-16 h-1.5 mb-4 text-[#C1272D]" />
            <ul className="space-y-2.5">
              {site.hours.map((h, i) => (
                <li key={i} className="text-sm">
                  <span className="font-semibold text-[#FAF6F0]">{h.days}</span>
                  <span className="block text-xs text-[#B8B2A8] mt-0.5">{h.time}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* ===== Bloco 3: contato ===== */}
          <div>
            <h3 className="font-serif font-bold text-base text-[#FAF6F0] mb-4 flex items-center gap-2">
              <Mail className="w-4 h-4 text-[#D8434A]" />
              Contato
            </h3>
            <BrushDivider className="w-16 h-1.5 mb-4 text-[#C1272D]" />
            <ul className="space-y-2.5 text-sm text-[#B8B2A8]">
              <li>
                {site.contact_address_line1}
                <span className="block text-xs mt-0.5">{site.contact_address_line2}</span>
              </li>
              <li>
                <a
                  href={`https://wa.me/55${site.contact_whatsapp.replace(/\D+/g, '')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-[#FAF6F0] transition-colors inline-flex items-center gap-1.5"
                >
                  <Users className="w-3.5 h-3.5 text-[#D8434A]" />
                  {site.contact_whatsapp}
                </a>
              </li>
              <li>
                <a
                  href={`mailto:${site.contact_email}`}
                  className="hover:text-[#FAF6F0] transition-colors inline-flex items-center gap-1.5"
                >
                  <Mail className="w-3.5 h-3.5 text-[#D8434A]" />
                  {site.contact_email}
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* ===== Barra inferior ===== */}
        <div className="mt-10 pt-6 border-t border-[#3A3630] flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-xs text-[#9A948C] text-center sm:text-left">
            © {new Date().getFullYear()} {site.footer_about_title}. Todos os direitos reservados.
          </p>
          <nav className="flex items-center gap-4" aria-label="Seções da home">
            {HOME_SECTIONS.map((s) => (
              <HomeAnchor
                key={s.href}
                href={s.href}
                className="text-xs text-[#9A948C] hover:text-[#FAF6F0] transition-colors select-none"
              >
                {s.label}
              </HomeAnchor>
            ))}
          </nav>
        </div>
      </div>
    </footer>
  )
}
