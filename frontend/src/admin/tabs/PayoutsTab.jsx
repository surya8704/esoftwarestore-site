import { useCallback, useEffect, useState } from 'react'
import { Check, LoaderCircle, RefreshCw, X } from 'lucide-react'
import { dashboardApi } from '../api'

export default function PayoutsTab({ isAdmin, formatMoney, vendorPermissions }) {
  const canRequestPayout = isAdmin || vendorPermissions?.canManagePayouts !== false
  const [payouts, setPayouts] = useState([])
  const [balance, setBalance] = useState(0)
  const [pendingTotal, setPendingTotal] = useState(0)
  const [paidTotal, setPaidTotal] = useState(0)
  const [amount, setAmount] = useState('')
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState('')

  const load = useCallback(async () => {
    if (isAdmin) {
      const [payoutData, overview] = await Promise.all([
        dashboardApi('/api/admin/payouts'),
        dashboardApi('/api/admin/overview'),
      ])
      setPayouts(payoutData.payouts ?? [])
      setPendingTotal(overview.pendingVendorPayouts ?? 0)
      setPaidTotal(overview.paidVendorPayouts ?? 0)
    } else {
      const [payoutData, me] = await Promise.all([
        dashboardApi('/api/vendor/payouts'),
        dashboardApi('/api/vendor/me'),
      ])
      setPayouts(payoutData.payouts ?? [])
      setBalance(me.availableBalance ?? 0)
      setPendingTotal(me.pendingPayout ?? 0)
      setPaidTotal(me.paidOut ?? 0)
    }
  }, [isAdmin])

  useEffect(() => {
    load().catch(() => {})
  }, [load])

  const requestPayout = async (e) => {
    e.preventDefault()
    setLoading(true)
    setStatus('')
    try {
      await dashboardApi('/api/vendor/payouts/request', {
        method: 'POST',
        body: JSON.stringify({ amount: Number(amount) }),
      })
      setAmount('')
      await load()
      setStatus('Payout requested')
    } catch (err) {
      setStatus(err.message)
    } finally {
      setLoading(false)
    }
  }

  const updateStatus = async (vendorId, payoutId, payoutStatus) => {
    setLoading(true)
    setStatus('')
    try {
      await dashboardApi(`/api/admin/vendors/${vendorId}/payouts/${payoutId}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: payoutStatus }),
      })
      await load()
      setStatus(`Payout marked as ${payoutStatus}`)
    } catch (err) {
      setStatus(err.message)
    } finally {
      setLoading(false)
    }
  }

  const pendingCount = payouts.filter((p) => p.status === 'pending').length

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold">Payouts</h2>
          <p className="mt-1 text-sm text-slate-500">
            {isAdmin
              ? `${pendingCount} pending requests • ${formatMoney(pendingTotal)} awaiting approval`
              : `Available ${formatMoney(balance)} • ${formatMoney(pendingTotal)} pending`}
          </p>
        </div>
        <button
          type="button"
          onClick={() => load().catch(() => {})}
          className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold dark:border-white/10"
        >
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-500/20 dark:bg-amber-500/10">
          <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">Pending</p>
          <p className="mt-1 text-2xl font-bold text-amber-900 dark:text-amber-100">{formatMoney(pendingTotal)}</p>
        </div>
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-500/20 dark:bg-emerald-500/10">
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Paid out</p>
          <p className="mt-1 text-2xl font-bold text-emerald-900 dark:text-emerald-100">{formatMoney(paidTotal)}</p>
        </div>
        {!isAdmin ? (
          <div className="rounded-2xl border border-sky-200 bg-sky-50 p-4 dark:border-sky-500/20 dark:bg-sky-500/10">
            <p className="text-xs font-semibold uppercase tracking-wide text-sky-700">Available</p>
            <p className="mt-1 text-2xl font-bold text-sky-900 dark:text-sky-100">{formatMoney(balance)}</p>
          </div>
        ) : (
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-white/10 dark:bg-white/5">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">Total requests</p>
            <p className="mt-1 text-2xl font-bold">{payouts.length}</p>
          </div>
        )}
      </div>

      {!isAdmin && canRequestPayout ? (
        <div className="mt-4 rounded-2xl bg-sky-50 p-4 dark:bg-sky-500/10">
          <p className="text-sm text-slate-600 dark:text-slate-300">Request a withdrawal from your available balance</p>
          <form onSubmit={requestPayout} className="mt-4 flex gap-2">
            <input
              type="number"
              min="1"
              max={balance}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="Amount"
              className="flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-white/10 dark:bg-white/5"
            />
            <button disabled={loading} className="rounded-full bg-sky-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
              {loading ? <LoaderCircle className="animate-spin" size={16} /> : 'Request'}
            </button>
          </form>
        </div>
      ) : isAdmin ? (
        <p className="mt-4 text-sm text-slate-500">Approve or reject vendor withdrawal requests below.</p>
      ) : (
        <p className="mt-4 text-sm text-amber-700">Payout requests are disabled for your account. Contact the platform admin.</p>
      )}

      <div className="mt-6 space-y-3">
        {payouts.map((p) => (
          <div key={p.id} className="flex flex-col gap-3 rounded-2xl border border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between dark:border-white/10">
            <div>
              <p className="font-semibold">{formatMoney(p.amount)}</p>
              <p className="text-sm text-slate-500">
                {p.vendorName ? `${p.vendorName} • ` : ''}{p.reference ?? `Payout #${p.id}`}
              </p>
              <p className="text-xs text-slate-400">{new Date(p.createdAt).toLocaleString()}</p>
            </div>
            <div className="flex items-center gap-2">
              <span className={`rounded-full px-2 py-0.5 text-xs font-semibold capitalize ${
                p.status === 'paid' ? 'bg-emerald-100 text-emerald-700' :
                p.status === 'rejected' ? 'bg-rose-100 text-rose-700' :
                'bg-amber-100 text-amber-700'
              }`}>
                {p.status}
              </span>
              {isAdmin && p.status === 'pending' ? (
                <>
                  <button
                    type="button"
                    disabled={loading}
                    onClick={() => updateStatus(p.vendorId, p.id, 'paid')}
                    className="rounded-full bg-emerald-500 p-2 text-white disabled:opacity-60"
                    aria-label="Approve payout"
                  >
                    <Check size={14} />
                  </button>
                  <button
                    type="button"
                    disabled={loading}
                    onClick={() => updateStatus(p.vendorId, p.id, 'rejected')}
                    className="rounded-full bg-rose-500 p-2 text-white disabled:opacity-60"
                    aria-label="Reject payout"
                  >
                    <X size={14} />
                  </button>
                </>
              ) : null}
            </div>
          </div>
        ))}
        {payouts.length === 0 ? <p className="text-sm text-slate-500">No payouts yet.</p> : null}
      </div>
      {status ? <p className="mt-4 text-sm text-slate-500">{status}</p> : null}
    </div>
  )
}
