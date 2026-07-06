import { useEffect, useState } from 'react'
import { KeyRound, LoaderCircle, Plus, Trash2, UserPlus } from 'lucide-react'
import { dashboardApi, emptyUserForm } from '../api'

const ROLES = ['customer', 'admin', 'vendor']

function formatDate(value) {
  if (!value) return '—'
  return new Date(value).toLocaleDateString()
}

export default function UsersTab({ currentUserId }) {
  const [users, setUsers] = useState([])
  const [form, setForm] = useState(emptyUserForm)
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [passwordUserId, setPasswordUserId] = useState(null)
  const [newPassword, setNewPassword] = useState('')

  const load = () => dashboardApi('/api/admin/users').then((d) => setUsers(d.users ?? []))

  useEffect(() => {
    load().catch(() => {})
  }, [])

  const submit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setStatus('')
    try {
      await dashboardApi('/api/admin/users', {
        method: 'POST',
        body: JSON.stringify({
          ...form,
          email: form.email.trim().toLowerCase(),
          name: form.name.trim(),
        }),
      })
      setForm(emptyUserForm)
      setShowForm(false)
      await load()
      setStatus('User created')
    } catch (err) {
      setStatus(err.message)
    } finally {
      setLoading(false)
    }
  }

  const updatePassword = async (userId) => {
    if (!newPassword || newPassword.length < 6) {
      setStatus('Password must be at least 6 characters')
      return
    }
    setLoading(true)
    setStatus('')
    try {
      await dashboardApi(`/api/admin/users/${userId}`, {
        method: 'PATCH',
        body: JSON.stringify({ password: newPassword }),
      })
      setPasswordUserId(null)
      setNewPassword('')
      setStatus('Password updated')
    } catch (err) {
      setStatus(err.message)
    } finally {
      setLoading(false)
    }
  }

  const removeUser = async (user) => {
    if (!window.confirm(`Remove user ${user.email}? This cannot be undone.`)) return
    setLoading(true)
    setStatus('')
    try {
      await dashboardApi(`/api/admin/users/${user.id}`, { method: 'DELETE' })
      await load()
      setStatus('User removed')
    } catch (err) {
      setStatus(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold">Users</h2>
          <p className="text-sm text-slate-500">Add customers, admins, and vendors • reset passwords</p>
        </div>
        <button
          type="button"
          onClick={() => setShowForm(!showForm)}
          className="inline-flex items-center gap-2 rounded-full bg-slate-950 px-4 py-2 text-sm font-semibold text-white dark:bg-white dark:text-slate-950"
        >
          <Plus size={16} /> Add user
        </button>
      </div>

      {showForm ? (
        <form onSubmit={submit} className="mt-6 grid gap-3 rounded-2xl border border-dashed border-slate-300 p-5 dark:border-white/10 sm:grid-cols-2">
          <label>
            <span className="mb-1 block text-xs font-medium">Full name</span>
            <input
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-white/10 dark:bg-white/5"
            />
          </label>
          <label>
            <span className="mb-1 block text-xs font-medium">Email</span>
            <input
              required
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-white/10 dark:bg-white/5"
            />
          </label>
          <label>
            <span className="mb-1 block text-xs font-medium">Password</span>
            <input
              required
              type="password"
              minLength={6}
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-white/10 dark:bg-white/5"
            />
          </label>
          <label>
            <span className="mb-1 block text-xs font-medium">Role</span>
            <select
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value })}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-white/10 dark:bg-white/5"
            >
              {ROLES.map((role) => (
                <option key={role} value={role}>{role}</option>
              ))}
            </select>
          </label>
          <div className="flex gap-2 sm:col-span-2">
            <button type="submit" disabled={loading} className="inline-flex items-center gap-2 rounded-full bg-sky-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
              {loading ? <LoaderCircle className="animate-spin" size={16} /> : <UserPlus size={16} />}
              Create user
            </button>
            <button type="button" onClick={() => setShowForm(false)} className="rounded-full border border-slate-200 px-4 py-2 text-sm dark:border-white/10">
              Cancel
            </button>
          </div>
        </form>
      ) : null}

      <div className="mt-6 overflow-x-auto rounded-2xl border border-slate-200 dark:border-white/10">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500 dark:border-white/10 dark:bg-white/5">
            <tr>
              <th className="px-4 py-3">User</th>
              <th className="px-4 py-3">Role</th>
              <th className="px-4 py-3">Joined</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id} className="border-b border-slate-100 dark:border-white/5">
                <td className="px-4 py-3">
                  <p className="font-semibold">{user.name}</p>
                  <p className="text-xs text-slate-500">{user.email}</p>
                </td>
                <td className="px-4 py-3">
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold capitalize dark:bg-white/10">
                    {user.role}
                  </span>
                </td>
                <td className="px-4 py-3 text-slate-500">{formatDate(user.createdAt)}</td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap justify-end gap-2">
                    {passwordUserId === user.id ? (
                      <div className="flex flex-wrap items-center gap-2">
                        <input
                          type="password"
                          minLength={6}
                          placeholder="New password"
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          className="rounded-lg border border-slate-200 px-2 py-1 text-xs dark:border-white/10 dark:bg-white/5"
                        />
                        <button
                          type="button"
                          disabled={loading}
                          onClick={() => updatePassword(user.id)}
                          className="rounded-full bg-sky-600 px-3 py-1 text-xs font-semibold text-white"
                        >
                          Save
                        </button>
                        <button
                          type="button"
                          onClick={() => { setPasswordUserId(null); setNewPassword('') }}
                          className="rounded-full border border-slate-200 px-3 py-1 text-xs dark:border-white/10"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => { setPasswordUserId(user.id); setNewPassword('') }}
                        className="inline-flex items-center gap-1 rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold dark:border-white/10"
                      >
                        <KeyRound size={12} /> Password
                      </button>
                    )}
                    <button
                      type="button"
                      disabled={loading || user.id === currentUserId}
                      onClick={() => removeUser(user)}
                      className="inline-flex items-center gap-1 rounded-full border border-rose-200 px-3 py-1.5 text-xs font-semibold text-rose-700 disabled:opacity-40"
                      title={user.id === currentUserId ? 'You cannot remove your own account' : 'Remove user'}
                    >
                      <Trash2 size={12} /> Remove
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {users.length === 0 ? <p className="p-6 text-sm text-slate-500">No users found.</p> : null}
      </div>

      {status ? <p className="mt-4 text-sm text-slate-500">{status}</p> : null}
    </div>
  )
}
