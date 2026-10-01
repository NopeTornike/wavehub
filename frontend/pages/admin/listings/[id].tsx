import { useRouter } from 'next/router'
import { AdminRole } from '@wavehub/shared-types'
import AdminLayout from '../../../components/AdminLayout'
import ListingEditor from '../../../components/ListingEditor'
import { useAuth } from '../../../lib/auth'

// Super Admin edits any listing (PATCH admin/listings/:id and the admin image/package routes —
// applied without re-review, audit-logged). Other staff can open Admin → Listings but not this.
export default function AdminEditListing() {
  const router = useRouter()
  const { user } = useAuth()
  const id = typeof router.query.id === 'string' ? router.query.id : ''
  return (
    <AdminLayout title="განცხადების რედაქტირება">
      {user?.adminRole !== AdminRole.SuperAdmin ? (
        <div className="empty-state">განცხადებების რედაქტირება მხოლოდ Super Admin-ს შეუძლია.</div>
      ) : id ? (
        <ListingEditor listingId={id} mode="admin" />
      ) : null}
    </AdminLayout>
  )
}
