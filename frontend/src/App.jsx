import { useEffect } from 'react'
import { Route, Routes, useLocation } from 'react-router-dom'
import Layout from './components/Layout'
import { trackPage } from './lib/api'
import HomePage from './pages/HomePage'
import ProductPage from './pages/ProductPage'
import CheckoutPage from './pages/CheckoutPage'
import CheckoutCompletePage from './pages/CheckoutCompletePage'
import AccountPage from './pages/AccountPage'
import OrdersPage from './pages/OrdersPage'
import SupportPage from './pages/SupportPage'
import GuidesPage from './pages/GuidesPage'
import GuidePage from './pages/GuidePage'
import AboutPage from './pages/AboutPage'
import TermsPage from './pages/TermsPage'
import PaymentPolicyPage from './pages/PaymentPolicyPage'
import DeliveryPolicyPage from './pages/DeliveryPolicyPage'
import ReturnsPolicyPage from './pages/ReturnsPolicyPage'
import AdminPage from './pages/AdminPage'

function PageTracker() {
  const location = useLocation()
  useEffect(() => {
    if (location.pathname !== '/') trackPage(location.pathname)
  }, [location.pathname])
  return null
}

export default function App() {
  return (
    <Layout>
      <PageTracker />
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/product/:slug" element={<ProductPage />} />
        <Route path="/checkout" element={<CheckoutPage />} />
        <Route path="/checkout/complete" element={<CheckoutCompletePage />} />
        <Route path="/account" element={<AccountPage />} />
        <Route path="/orders" element={<OrdersPage />} />
        <Route path="/support" element={<SupportPage />} />
        <Route path="/guides" element={<GuidesPage />} />
        <Route path="/guides/:slug" element={<GuidePage />} />
        <Route path="/about" element={<AboutPage />} />
        <Route path="/terms" element={<TermsPage />} />
        <Route path="/payment-policy" element={<PaymentPolicyPage />} />
        <Route path="/delivery-policy" element={<DeliveryPolicyPage />} />
        <Route path="/returns-refunds" element={<ReturnsPolicyPage />} />
        <Route path="/admin" element={<AdminPage />} />
      </Routes>
    </Layout>
  )
}
