/* Main App Component - Handles routing (using react-router-dom), query client and other providers - use this file to add all routes */
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Toaster } from '@/components/ui/toaster'
import { Toaster as Sonner } from '@/components/ui/sonner'
import { TooltipProvider } from '@/components/ui/tooltip'
import { AuthProvider } from '@/context/AuthContext'
import { CartProvider } from '@/context/CartContext'

import Index from './pages/Index'
import ProductDetail from './pages/ProductDetail'
import CartCheckout from './pages/CartCheckout'
import OrderConfirmation from './pages/OrderConfirmation'
import MyOrders from './pages/MyOrders'
import AdminOrders from './pages/AdminOrders'
import AdminProducts from './pages/AdminProducts'
import AdminStudents from './pages/AdminStudents'
import { AdminRoles } from './pages/AdminRoles'
import AdminRanking from './pages/AdminRanking'
import AdminClasses from './pages/AdminClasses'
import AdminClassDetail from './pages/AdminClassDetail'
import AdminStudentDetail from './pages/admin/AdminStudentDetail'
import AdminEmailSettings from './pages/AdminEmailSettings'
import AdminSiteSettings from './pages/AdminSiteSettings'
import AdminFinance from './pages/AdminFinance'
import React from 'react'
import { Navigate, Link } from 'react-router-dom'
import { ShieldAlert } from 'lucide-react'
import { AdminArea, ADMIN_AREA_LABELS } from './lib/adminAreas'
import StudentArea from './pages/StudentArea'
import MyAttendance from './pages/MyAttendance'
import Login from './pages/Login'
import Register from './pages/Register'
import VerifyEmail from './pages/VerifyEmail'
import ForgotPassword from './pages/ForgotPassword'
import ResetPassword from './pages/ResetPassword'
import ConfirmEmailChange from './pages/ConfirmEmailChange'
import Account from './pages/Account'
import ChangePassword from './pages/ChangePassword'
import NotFound from './pages/NotFound'
import Layout from './components/Layout'
import { useAuth } from './context/AuthContext'

/** Painel: qualquer admin (principal ou secundário) acessa. */
function RequireAdmin({ children }: { children: React.ReactElement }) {
  const { isAdmin, isLoading } = useAuth()
  if (isLoading) return null
  if (!isAdmin) return <Navigate to="/" replace />
  return children
}

/**
 * Guarda por ÁREA do painel: além de ser admin, o logado precisa ter a
 * permissão da área (o dono tem sempre; secundário depende de
 * admin_permissions — acesso total quando a lista está vazia).
 * Sem permissão: mostra aviso em vez de redirecionar, para deixar claro
 * por que a página não abriu (acesso direto pela URL).
 */
function RequireArea({ area, children }: { area: AdminArea; children: React.ReactElement }) {
  const { isAdmin, hasArea, isLoading } = useAuth()
  if (isLoading) return null
  if (!isAdmin) return <Navigate to="/" replace />
  if (!hasArea(area)) return <NoPermissionNotice area={area} />
  return children
}

/** Aviso "sem permissão" para rota de área liberada só para outros admins. */
function NoPermissionNotice({ area }: { area: AdminArea }) {
  return (
    <div className="container mx-auto px-4 py-16">
      <div className="mx-auto max-w-md rounded-lg border border-[#C1272D]/30 bg-[#F7E4E2] p-6 text-center">
        <ShieldAlert className="mx-auto mb-3 h-10 w-10 text-[#C1272D]" />
        <h1 className="mb-2 text-xl font-bold text-[#1C1B1A]">Sem permissão</h1>
        <p className="text-sm text-[#6B6560]">
          Sua conta de administrador não tem acesso à área de{' '}
          <strong>{ADMIN_AREA_LABELS[area]}</strong>. Solicite ao administrador principal o acesso a
          esta área.
        </p>
        <Link
          to="/"
          className="mt-4 inline-block rounded-md bg-[#C1272D] px-4 py-2 text-sm font-medium text-white hover:bg-[#A02026]"
        >
          Voltar ao início
        </Link>
      </div>
    </div>
  )
}

/** Página de administradores: SOMENTE o admin principal (dono). */
function RequireOwner({ children }: { children: React.ReactElement }) {
  const { isOwner, isLoading } = useAuth()
  if (isLoading) return null
  if (!isOwner) return <Navigate to="/painel" replace />
  return children
}

const App = () => (
  <BrowserRouter>
    <AuthProvider>
      <CartProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <Routes>
            <Route element={<Layout />}>
              <Route path="/" element={<Index />} />
              <Route path="/produto/:slug" element={<ProductDetail />} />
              <Route path="/carrinho" element={<CartCheckout />} />
              <Route path="/pedido/:id/confirmacao" element={<OrderConfirmation />} />
              <Route path="/meus-pedidos" element={<MyOrders />} />
              <Route
                path="/painel/pedidos"
                element={
                  <RequireArea area="pedidos">
                    <AdminOrders />
                  </RequireArea>
                }
              />
              <Route
                path="/painel/produtos"
                element={
                  <RequireArea area="produtos">
                    <AdminProducts />
                  </RequireArea>
                }
              />
              <Route
                path="/painel/alunos"
                element={
                  <RequireArea area="alunos">
                    <AdminStudents />
                  </RequireArea>
                }
              />
              <Route
                path="/painel/alunos/:id"
                element={
                  <RequireArea area="alunos">
                    <AdminStudentDetail />
                  </RequireArea>
                }
              />
              <Route
                path="/painel/ranking"
                element={
                  <RequireArea area="presencas">
                    <AdminRanking />
                  </RequireArea>
                }
              />
              <Route
                path="/painel/turmas"
                element={
                  <RequireArea area="presencas">
                    <AdminClasses />
                  </RequireArea>
                }
              />
              <Route
                path="/painel/turmas/:classId"
                element={
                  <RequireArea area="presencas">
                    <AdminClassDetail />
                  </RequireArea>
                }
              />
              <Route
                path="/painel/financeiro"
                element={
                  <RequireArea area="financeiro">
                    <AdminFinance />
                  </RequireArea>
                }
              />
              <Route
                path="/painel/configuracoes"
                element={
                  <RequireArea area="site">
                    <AdminEmailSettings />
                  </RequireArea>
                }
              />
              <Route
                path="/painel/site"
                element={
                  <RequireArea area="site">
                    <AdminSiteSettings />
                  </RequireArea>
                }
              />
              <Route
                path="/painel/admins"
                element={
                  <RequireOwner>
                    <AdminRoles />
                  </RequireOwner>
                }
              />
              <Route path="/minha-presenca" element={<Navigate to="/area-do-aluno" replace />} />
              <Route path="/area-do-aluno" element={<StudentArea />} />
              <Route path="/entrar" element={<Login />} />
              <Route path="/criar-conta" element={<Register />} />
              <Route path="/verificar-email" element={<VerifyEmail />} />
              <Route path="/recuperar-senha" element={<ForgotPassword />} />
              <Route path="/redefinir-senha" element={<ResetPassword />} />
              <Route path="/confirmar-troca-email" element={<ConfirmEmailChange />} />
              <Route path="/conta" element={<Account />} />
              <Route path="/alterar-senha" element={<ChangePassword />} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </TooltipProvider>
      </CartProvider>
    </AuthProvider>
  </BrowserRouter>
)

export default App
