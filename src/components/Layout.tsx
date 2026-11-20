import { Outlet } from 'react-router-dom'
import { Header, Footer } from './HeaderFooter'
import { CartDrawer } from './CartDrawer'

export default function Layout() {
  return (
    <div className="flex flex-col min-h-screen bg-[#FAF6F0] text-[#1C1B1A]">
      <Header />
      <CartDrawer />
      <main className="flex-1">
        <Outlet />
      </main>
      <Footer />
    </div>
  )
}
