import React, { useState } from 'react'
import { useSiteContent } from '@/services/siteSettings'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { useCart } from '@/context/CartContext'
import { HankoStamp } from '@/components/HankoStamp'
import { BrushDivider } from '@/components/hero/HeroDecor'
import {
  User,
  LogOut,
  ClipboardList,
  Menu,
  X,
  ShieldCheck,
  ShoppingBag,
  Users,
  GraduationCap,
  Layers,
  Trophy,
  Settings,
  Wallet,
  Home,
} from 'lucide-react'
import { Button } from '@/components/ui/button'

export const Header: React.FC = () => {
  const { user, isAdmin, logout } = useAuth()
  const { itemCount, setIsDrawerOpen, badgeAnimate } = useCart()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const navigate = useNavigate()
  const location = useLocation()

  const handleLogout = () => {
    logout()
    navigate('/')
  }

  const isActive = (path: string) => location.pathname === path

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-[#C1272D]/20 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-18 flex items-center justify-between">
        {/* Brand / Logo */}
        <Link to="/" className="flex items-center gap-3 group">
          <HankoStamp
            size="md"
            className="group-hover:scale-105 group-hover:-rotate-3 transition-transform"
          />
          <div className="flex flex-col">
            <span className="font-serif font-bold text-xl sm:text-2xl text-[#1C1B1A] tracking-tight leading-none">
              Judô Tatsu
            </span>
            <span className="text-[10px] tracking-widest text-[#C1272D] uppercase font-semibold font-serif mt-0.5">
              Academia de Judô
            </span>
          </div>
        </Link>

        {/* Desktop Navigation Links */}
        <nav className="hidden md:flex items-center gap-6">
          {user && (
            <Link
              to="/meus-pedidos"
              className={`text-sm font-medium transition-colors hover:text-[#C1272D] flex items-center gap-1.5 ${
                isActive('/meus-pedidos') ? 'text-[#C1272D] font-semibold' : 'text-[#1C1B1A]'
              }`}
            >
              <ClipboardList className="w-4 h-4" />
              Meus Pedidos
            </Link>
          )}

          {user && !isAdmin && (
            <Link
              to="/area-do-aluno"
              className={`text-sm font-medium transition-colors hover:text-[#C1272D] flex items-center gap-1.5 ${
                isActive('/area-do-aluno') ? 'text-[#C1272D] font-semibold' : 'text-[#1C1B1A]'
              }`}
            >
              <GraduationCap className="w-4 h-4" />
              Área do aluno
            </Link>
          )}

          {isAdmin && (
            <Link
              to="/painel/turmas"
              className={`text-sm font-medium transition-colors hover:text-[#C1272D] flex items-center gap-1 px-2.5 py-1 rounded-md bg-[#F7E4E2] text-[#C1272D] border border-[#C1272D]/30 ${
                isActive('/painel/turmas') || isActive('/painel/turmas/')
                  ? 'ring-2 ring-[#C1272D]'
                  : ''
              }`}
            >
              <Layers className="w-4 h-4" />
              Turmas
            </Link>
          )}

          {isAdmin && (
            <Link
              to="/painel/ranking"
              className={`text-sm font-medium transition-colors hover:text-[#C1272D] flex items-center gap-1 px-2.5 py-1 rounded-md bg-[#F7E4E2] text-[#C1272D] border border-[#C1272D]/30 ${
                isActive('/painel/ranking') ? 'ring-2 ring-[#C1272D]' : ''
              }`}
            >
              <Trophy className="w-4 h-4" />
              Ranking
            </Link>
          )}

          {isAdmin && (
            <Link
              to="/painel/alunos"
              className={`text-sm font-medium transition-colors hover:text-[#C1272D] flex items-center gap-1 px-2.5 py-1 rounded-md bg-[#F7E4E2] text-[#C1272D] border border-[#C1272D]/30 ${
                isActive('/painel/alunos') ? 'ring-2 ring-[#C1272D]' : ''
              }`}
            >
              <Users className="w-4 h-4" />
              Alunos
            </Link>
          )}

          {isAdmin && (
            <Link
              to="/painel/produtos"
              className={`text-sm font-medium transition-colors hover:text-[#C1272D] flex items-center gap-1 px-2.5 py-1 rounded-md bg-[#F7E4E2] text-[#C1272D] border border-[#C1272D]/30 ${
                isActive('/painel/produtos') ? 'ring-2 ring-[#C1272D]' : ''
              }`}
            >
              <ShoppingBag className="w-4 h-4" />
              Loja (Produtos)
            </Link>
          )}

          {isAdmin && (
            <Link
              to="/painel/pedidos"
              className={`text-sm font-medium transition-colors hover:text-[#C1272D] flex items-center gap-1 px-2.5 py-1 rounded-md bg-[#F7E4E2] text-[#C1272D] border border-[#C1272D]/30 ${
                isActive('/painel/pedidos') ? 'ring-2 ring-[#C1272D]' : ''
              }`}
            >
              <ShieldCheck className="w-4 h-4" />
              Painel de Pedidos
            </Link>
          )}

          {isAdmin && (
            <Link
              to="/painel/financeiro"
              className={`text-sm font-medium transition-colors hover:text-[#C1272D] flex items-center gap-1 px-2.5 py-1 rounded-md bg-[#F7E4E2] text-[#C1272D] border border-[#C1272D]/30 ${
                isActive('/painel/financeiro') ? 'ring-2 ring-[#C1272D]' : ''
              }`}
            >
              <Wallet className="w-4 h-4" />
              Financeiro
            </Link>
          )}

          {isAdmin && (
            <Link
              to="/painel/site"
              className={`text-sm font-medium transition-colors hover:text-[#C1272D] flex items-center gap-1 px-2.5 py-1 rounded-md bg-[#F7E4E2] text-[#C1272D] border border-[#C1272D]/30 ${
                isActive('/painel/site') ? 'ring-2 ring-[#C1272D]' : ''
              }`}
            >
              <Home className="w-4 h-4" />
              Página inicial
            </Link>
          )}

          {isAdmin && (
            <Link
              to="/painel/configuracoes"
              className={`text-sm font-medium transition-colors hover:text-[#C1272D] flex items-center gap-1 px-2.5 py-1 rounded-md bg-[#F7E4E2] text-[#C1272D] border border-[#C1272D]/30 ${
                isActive('/painel/configuracoes') ? 'ring-2 ring-[#C1272D]' : ''
              }`}
            >
              <Settings className="w-4 h-4" />
              Configurações
            </Link>
          )}
        </nav>

        {/* Right side: Cart Button + User Account */}
        <div className="flex items-center gap-3">
          {/* Cart Trigger */}
          <button
            onClick={() => setIsDrawerOpen(true)}
            className="relative p-2.5 rounded-full hover:bg-[#F7E4E2] text-[#1C1B1A] transition-colors focus:outline-hidden"
            aria-label="Abrir carrinho"
          >
            <ShoppingBag className="w-6 h-6 text-[#1C1B1A]" />
            {itemCount > 0 && (
              <span
                className={`absolute -top-1 -right-1 bg-[#C1272D] text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center shadow-xs ${
                  badgeAnimate ? 'animate-stamp-pop' : ''
                }`}
              >
                {itemCount}
              </span>
            )}
          </button>

          {/* User auth state */}
          {user ? (
            <div className="hidden sm:flex items-center gap-3 border-l border-[#E8E0D5] pl-3">
              <Link
                to="/conta"
                className="flex items-center gap-2 hover:opacity-80 transition-opacity"
                title="Minha conta"
              >
                <div className="w-8 h-8 rounded-full bg-[#FAF6F0] border border-[#E8E0D5] flex items-center justify-center text-[#1C1B1A] text-xs font-bold font-serif">
                  {user.name ? user.name[0].toUpperCase() : 'U'}
                </div>
                <div className="hidden lg:flex flex-col text-left">
                  <span className="text-xs font-semibold text-[#1C1B1A] truncate max-w-[120px]">
                    {user.name || user.email}
                  </span>
                  <span className="text-[10px] text-[#6B6560] capitalize">
                    {user.role === 'admin' ? 'Administrador' : 'Aluno'}
                  </span>
                </div>
              </Link>
              <button
                onClick={handleLogout}
                className="p-1.5 text-[#6B6560] hover:text-[#B3261E] rounded-md transition-colors"
                title="Sair"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="hidden sm:flex items-center gap-2">
              <Link to="/entrar">
                <Button
                  variant="ghost"
                  className="text-sm font-medium hover:bg-[#FAF6F0] text-[#1C1B1A]"
                >
                  Entrar
                </Button>
              </Link>
              <Link to="/criar-conta">
                <Button className="text-sm font-medium bg-[#C1272D] hover:bg-[#A01E23] text-white [clip-path:polygon(2%_18%,97%_8%,100%_55%,98%_88%,3%_96%,0_60%)]">
                  Criar conta
                </Button>
              </Link>
            </div>
          )}

          {/* Mobile hamburger */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 rounded-lg text-[#1C1B1A] hover:bg-[#FAF6F0]"
            aria-label="Abrir menu"
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-[#E8E0D5] bg-[#FAF6F0] px-4 pt-3 pb-5 space-y-3 animate-in slide-in-from-top-2">
          <Link
            to="/"
            onClick={() => setMobileMenuOpen(false)}
            className="block py-2 text-base font-medium text-[#1C1B1A] hover:text-[#C1272D]"
          >
            Início
          </Link>

          {user && (
            <Link
              to="/meus-pedidos"
              onClick={() => setMobileMenuOpen(false)}
              className="block py-2 text-base font-medium text-[#1C1B1A] hover:text-[#C1272D]"
            >
              Meus Pedidos
            </Link>
          )}

          {isAdmin && (
            <Link
              to="/painel/turmas"
              onClick={() => setMobileMenuOpen(false)}
              className="block py-2 text-base font-semibold text-[#C1272D]"
            >
              Turmas (Admin)
            </Link>
          )}

          {isAdmin && (
            <Link
              to="/painel/produtos"
              onClick={() => setMobileMenuOpen(false)}
              className="block py-2 text-base font-semibold text-[#C1272D]"
            >
              Loja — Produtos (Admin)
            </Link>
          )}

          {isAdmin && (
            <Link
              to="/painel/alunos"
              onClick={() => setMobileMenuOpen(false)}
              className="block py-2 text-base font-semibold text-[#C1272D]"
            >
              Alunos (Admin)
            </Link>
          )}

          {isAdmin && (
            <Link
              to="/painel/ranking"
              onClick={() => setMobileMenuOpen(false)}
              className="block py-2 text-base font-semibold text-[#C1272D]"
            >
              Ranking (Admin)
            </Link>
          )}

          {user && !isAdmin && (
            <Link
              to="/area-do-aluno"
              onClick={() => setMobileMenuOpen(false)}
              className="block py-2 text-base font-medium text-[#1C1B1A] hover:text-[#C1272D]"
            >
              Área do aluno
            </Link>
          )}

          {isAdmin && (
            <Link
              to="/painel/pedidos"
              onClick={() => setMobileMenuOpen(false)}
              className="block py-2 text-base font-semibold text-[#C1272D]"
            >
              Painel de Pedidos (Admin)
            </Link>
          )}

          {isAdmin && (
            <Link
              to="/painel/financeiro"
              onClick={() => setMobileMenuOpen(false)}
              className="block py-2 text-base font-semibold text-[#C1272D]"
            >
              Financeiro (Admin)
            </Link>
          )}

          {isAdmin && (
            <Link
              to="/painel/site"
              onClick={() => setMobileMenuOpen(false)}
              className="block py-2 text-base font-semibold text-[#C1272D]"
            >
              Página inicial (Admin)
            </Link>
          )}

          {isAdmin && (
            <Link
              to="/painel/configuracoes"
              onClick={() => setMobileMenuOpen(false)}
              className="block py-2 text-base font-semibold text-[#C1272D]"
            >
              Configurações (Admin)
            </Link>
          )}

          <div className="border-t border-[#E8E0D5] pt-3">
            {user ? (
              <div className="space-y-2">
                <div className="text-sm font-semibold text-[#1C1B1A]">
                  {user.name || user.email}
                </div>
                <div className="text-xs text-[#6B6560] mb-2">{user.email}</div>
                <div className="flex gap-2">
                  <Link to="/conta" onClick={() => setMobileMenuOpen(false)} className="flex-1">
                    <Button variant="outline" className="w-full text-xs">
                      Minha Conta
                    </Button>
                  </Link>
                  <Button
                    variant="ghost"
                    onClick={() => {
                      setMobileMenuOpen(false)
                      handleLogout()
                    }}
                    className="text-xs text-[#B3261E]"
                  >
                    Sair
                  </Button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                <Link to="/entrar" onClick={() => setMobileMenuOpen(false)}>
                  <Button variant="outline" className="w-full">
                    Entrar
                  </Button>
                </Link>
                <Link to="/criar-conta" onClick={() => setMobileMenuOpen(false)}>
                  <Button className="w-full bg-[#C1272D] text-white">Criar conta</Button>
                </Link>
              </div>
            )}
          </div>
        </div>
      )}
    </header>
  )
}

export const Footer: React.FC = () => {
  const site = useSiteContent()
  return (
    <footer className="mt-auto bg-[#1C1B1A] py-10 text-[#CFC8BE] relative">
      {/* Traço de pincel preto-tinta no topo do rodapé (folder) */}
      <div
        className="absolute -top-3 left-0 right-0 h-6 text-[#1C1B1A] pointer-events-none"
        aria-hidden
      >
        <BrushDivider className="w-full h-full" preserveAspectRatio="none" />
      </div>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div>
            <div className="flex items-center gap-2 mb-3">
              {/* Chip claro atrás do logo: o PNG tem fundo transparente e o rodapé é escuro */}
              <span className="inline-flex items-center justify-center rounded-full bg-[#FAF6F0] p-1">
                <HankoStamp size="sm" />
              </span>
              <span className="font-serif font-bold text-lg text-white">
                {site.footer_about_title}
              </span>
            </div>
            <p className="text-sm leading-relaxed text-[#CFC8BE]">{site.footer_about_text}</p>
          </div>

          <div>
            <h4 className="font-serif font-bold text-sm text-white mb-3 uppercase tracking-wider">
              Localização & Contato
            </h4>
            <p className="text-sm leading-relaxed">
              {site.contact_address_line1}
              <br />
              {site.contact_address_line2}
              <br />
              WhatsApp: {site.contact_whatsapp}
              <br />
              E-mail: {site.contact_email}
            </p>
          </div>

          <div>
            <h4 className="font-serif font-bold text-sm text-white mb-3 uppercase tracking-wider">
              Horários de Treino
            </h4>
            <p className="text-sm leading-relaxed">
              {site.hours.map((h, i) => (
                <React.Fragment key={i}>
                  {i > 0 && <br />}
                  {h.days}: {h.time}
                </React.Fragment>
              ))}
            </p>
            <div className="mt-3 text-xs bg-[#C1272D] text-white p-2 rounded-md inline-block font-medium">
              * Retirada de pedidos diretamente no balcão da academia
            </div>
          </div>
        </div>

        <div className="mt-8 pt-6 border-t border-white/15 flex flex-col sm:flex-row items-center justify-between text-xs text-[#9B948A]">
          <p>© {new Date().getFullYear()} Judô Tatsu. Todos os direitos reservados.</p>
          <p className="mt-2 sm:mt-0 font-serif">柔道 — O Caminho Suave</p>
        </div>
      </div>
    </footer>
  )
}
