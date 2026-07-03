import AdminDashboard from '../admin/AdminDashboard'
import SEO from '../components/SEO'

export default function AdminPage() {
  return (
    <>
      <SEO title="Admin Dashboard" description="Multi-vendor admin and vendor portal for eSoftware Store." />
      <AdminDashboard />
    </>
  )
}
