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
import AdminRanking from './pages/AdminRanking'
import AdminClasses from './pages/AdminClasses'
import AdminClassDetail from './pages/AdminClassDetail'
import AdminStudentDetail from './pages/admin/AdminStudentDetail'
import AdminEmailSettings from './pages/AdminEmailSettings'
import MyAttendance from './pages/MyAttendance'
import Login from './pages/Login'
import Register from './pages/Register'
import VerifyEmail from './pages/VerifyEmail'
import ForgotPassword from './pages/ForgotPassword'
import ResetPassword from './pages/ResetPassword'
import ConfirmEmailChange from './pages/ConfirmEmailChange'
import Account from './pages/Account'
import NotFound from './pages/NotFound'
import Layout from './components/Layout'

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
              <Route path="/painel/pedidos" element={<AdminOrders />} />
              <Route path="/painel/produtos" element={<AdminProducts />} />
              <Route path="/painel/alunos" element={<AdminStudents />} />
              <Route path="/painel/alunos/:id" element={<AdminStudentDetail />} />
              <Route path="/painel/ranking" element={<AdminRanking />} />
              <Route path="/painel/turmas" element={<AdminClasses />} />
              <Route path="/painel/turmas/:classId" element={<AdminClassDetail />} />
              <Route path="/painel/configuracoes" element={<AdminEmailSettings />} />
              <Route path="/minha-presenca" element={<MyAttendance />} />
              <Route path="/entrar" element={<Login />} />
              <Route path="/criar-conta" element={<Register />} />
              <Route path="/verificar-email" element={<VerifyEmail />} />
              <Route path="/recuperar-senha" element={<ForgotPassword />} />
              <Route path="/redefinir-senha" element={<ResetPassword />} />
              <Route path="/confirmar-troca-email" element={<ConfirmEmailChange />} />
              <Route path="/conta" element={<Account />} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </TooltipProvider>
      </CartProvider>
    </AuthProvider>
  </BrowserRouter>
)

export default App
