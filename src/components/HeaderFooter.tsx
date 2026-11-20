import React, { useState } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { useCart } from '@/context/CartContext'
import { HankoStamp } from '@/components/HankoStamp'
import {
  ShoppingBag,
  User,
  LogOut,
  ClipboardList,
  Menu,
  X,
  ShieldCheck,
  Users,
  CalendarCheck,
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
          <HankoStamp size="md" kanji="柔" className="group-hover:scale-105 transition-transform" />
          <div className="flex flex-col">
            <span className="font-serif font-bold text-xl sm:text-2xl text-[#1C1B1A] tracking-tight leading-none">
              Dojo Nippon
            </span>
            <span className="text-[10px] tracking-widest text-[#C1272D] uppercase font-semibold font-serif mt-0.5">
              Academia de Judô
            </span>
          </div>
        </Link>

        {/* Desktop Navigation Links */}
        <nav className="hidden md:flex items-center gap-6">
          <Link
            to="/"
            className={`text-sm font-medium transition-colors hover:text-[#C1272D] ${
              isActive('/') ? 'text-[#C1272D] font-semibold' : 'text-[#1C1B1A]'
            }`}
          >
            Catálogo
          </Link>

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

          {user && (
            <Link
              to="/minha-presenca"
              className={`text-sm font-medium transition-colors hover:text-[#C1272D] flex items-center gap-1.5 ${
                isActive('/minha-presenca') ? 'text-[#C1272D] font-semibold' : 'text-[#1C1B1A]'
              }`}
            >
              <CalendarCheck className="w-4 h-4" />
              Minha Presença
            </Link>
          )}

          {isAdmin && (
            <Link
              to="/painel/presenca"
              className={`text-sm font-medium transition-colors hover:text-[#C1272D] flex items-center gap-1 px-2.5 py-1 rounded-md bg-[#F7E4E2] text-[#C1272D] border border-[#C1272D]/30 ${
                isActive('/painel/presenca') ? 'ring-2 ring-[#C1272D]' : ''
              }`}
            >
              <CalendarCheck className="w-4 h-4" />
              Presença
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
              to="/painel/pedidos"
              className={`text-sm font-medium transition-colors hover:text-[#C1272D] flex items-center gap-1 px-2.5 py-1 rounded-md bg-[#F7E4E2] text-[#C1272D] border border-[#C1272D]/30 ${
                isActive('/painel/pedidos') ? 'ring-2 ring-[#C1272D]' : ''
              }`}
            >
              <ShieldCheck className="w-4 h-4" />
              Painel de Pedidos
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
                <Button className="text-sm font-medium bg-[#C1272D] hover:bg-[#A01E23] text-white">
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
            Catálogo de Produtos
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
              to="/painel/alunos"
              onClick={() => setMobileMenuOpen(false)}
              className="block py-2 text-base font-semibold text-[#C1272D]"
            >
              Alunos (Admin)
            </Link>
          )}

          {isAdmin && (
            <Link
              to="/painel/presenca"
              onClick={() => setMobileMenuOpen(false)}
              className="block py-2 text-base font-semibold text-[#C1272D]"
            >
              Presença (Admin)
            </Link>
          )}

          {user && (
            <Link
              to="/minha-presenca"
              onClick={() => setMobileMenuOpen(false)}
              className="block py-2 text-base font-medium text-[#1C1B1A] hover:text-[#C1272D]"
            >
              Minha Presença
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
  return (
    <footer className="mt-auto border-t border-[#E8E0D5] bg-[#FAF6F0] py-10 text-[#6B6560]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <HankoStamp size="sm" kanji="柔" />
              <span className="font-serif font-bold text-lg text-[#1C1B1A]">Dojo Nippon</span>
            </div>
            <p className="text-sm leading-relaxed text-[#6B6560]">
              Tradição, disciplina e excelência no ensino do judô. Atendendo judocas de todas as
              idades desde a faixa branca até a preta.
            </p>
          </div>

          <div>
            <h4 className="font-serif font-bold text-sm text-[#1C1B1A] mb-3 uppercase tracking-wider">
              Localização & Contato
            </h4>
            <p className="text-sm leading-relaxed">
              Rua do Dojo, 123 — Bairro Central
              <br />
              São Paulo - SP — CEP 01234-567
              <br />
              WhatsApp: (11) 98765-4321
              <br />
              E-mail: contato@dojonippon.com
            </p>
          </div>

          <div>
            <h4 className="font-serif font-bold text-sm text-[#1C1B1A] mb-3 uppercase tracking-wider">
              Horários de Treino
            </h4>
            <p className="text-sm leading-relaxed">
              Segunda a Sexta: 07h às 21h30
              <br />
              Sábado: 09h às 14h (Treinos Livres & Randori)
              <br />
              Domingo: Fechado
            </p>
            <div className="mt-3 text-xs bg-[#F7E4E2] text-[#C1272D] p-2 rounded-md inline-block font-medium">
              * Retirada de pedidos diretamente no balcão da academia
            </div>
          </div>
        </div>

        <div className="mt-8 pt-6 border-t border-[#E8E0D5] flex flex-col sm:flex-row items-center justify-between text-xs text-[#6B6560]">
          <p>© {new Date().getFullYear()} Dojo Nippon. Todos os direitos reservados.</p>
          <p className="mt-2 sm:mt-0 font-serif">柔道 — O Caminho Suave</p>
        </div>
      </div>
    </footer>
  )
}
