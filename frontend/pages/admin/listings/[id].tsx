import { useRouter } from 'next/router'
import { useEffect, useState } from 'react'
import { AdminRole, ListingType } from '@wavehub/shared-types'
import AdminLayout from '../../../components/AdminLayout'
import ListingEditor from '../../../components/ListingEditor'
import { useAuth } from '../../../lib/auth'
import { api } from '../../../lib/api'
import AdminKeyInventory from '../../../components/AdminKeyInventory'

// Super Admin edits any listing (PATCH admin/listings/:id and the admin image/package routes —
// applied without re-review, audit-logged). Other staff can open Admin → Listings but not this.
export default function AdminEditListing() {
  const router = useRouter()
  const { user } = useAuth()
  const id = typeof router.query.id === 'string' ? router.query.id : ''
  // Steam games get a stock panel (client feedback #5).
  const [type, setType] = useState<ListingType | null>(null)
  useEffect(() => {
    if (!id) return
    api
      .adminGetListing(id)
      .then((l) => setType(l.type))
      .catch(() => setType(null))
  }, [id])
  return (
    <AdminLayout title="განცხადების რედაქტირება">
      {user?.adminRole !== AdminRole.SuperAdmin ? (
        <div className="empty-state">განცხადებების რედაქტირება მხოლოდ Super Admin-ს შეუძლია.</div>
      ) : id ? (
        <>
          <ListingEditor listingId={id} mode="admin" />
          {type === ListingType.DigitalKey && <AdminKeyInventory listingId={id} />}
        </>
      ) : null}
    </AdminLayout>
  )
}
