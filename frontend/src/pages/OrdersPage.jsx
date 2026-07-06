import { useEffect, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { Package } from 'lucide-react'
import { api } from '../lib/api'
import { useApp } from '../context/AppContext'
import OrderCard from '../components/OrderCard'
import SEO from '../components/SEO'

export default function OrdersPage() {
  const { user, currency } = useApp()
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)

  const loadOrders = async () => {
    setLoading(true)
    try {
      const data = await api('/api/orders')
      setOrders(data.orders ?? [])
    } catch {
      setOrders([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (user) loadOrders()
  }, [user])

  if (!user) {
    return <Navigate to="/account" replace />
  }

  return (
    <div className="store-container py-10">
      <SEO title="My Orders" />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-store-heading">My orders</h1>
          <p className="mt-1 text-sm text-store-muted">Track status, payments, and license keys for your purchases.</p>
        </div>
        <button
          type="button"
          onClick={loadOrders}
          disabled={loading}
          className="btn-store-outline text-sm disabled:opacity-60"
        >
          {loading ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      <div className="mt-8 space-y-4">
        {loading && orders.length === 0 ? (
          <p className="text-sm text-store-muted">Loading orders...</p>
        ) : null}

        {!loading && orders.length === 0 ? (
          <div className="store-card border-dashed p-10 text-center">
            <Package size={36} className="mx-auto text-store-muted opacity-50" />
            <p className="mt-4 font-medium text-store-body">No orders yet</p>
            <p className="mt-1 text-sm text-store-muted">
              Orders placed with your account email will appear here after checkout.
            </p>
            <Link to="/" className="btn-store-primary mt-6 inline-flex">
              Browse products
            </Link>
          </div>
        ) : null}

        {orders.map((order) => (
          <OrderCard key={order.id} order={order} currency={currency} />
        ))}
      </div>
    </div>
  )
}
