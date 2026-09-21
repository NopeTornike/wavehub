import { KeyInventoryStatus, ListingStatus } from '@wavehub/shared-types'

// Georgian display labels for shared-types enums, so a page never renders a raw enum value
// ("pending_review") to a user.
export const LISTING_STATUS_LABELS: Record<ListingStatus, string> = {
  [ListingStatus.Draft]: 'დრაფტი',
  [ListingStatus.PendingReview]: 'განხილვაშია',
  [ListingStatus.Active]: 'აქტიური',
  [ListingStatus.Paused]: 'შეჩერებული',
  [ListingStatus.Rejected]: 'უარყოფილი',
}

export const KEY_STATUS_LABELS: Record<KeyInventoryStatus, string> = {
  [KeyInventoryStatus.Available]: 'ხელმისაწვდომი',
  [KeyInventoryStatus.Sold]: 'გაყიდულია',
  [KeyInventoryStatus.Revoked]: 'გაუქმებულია',
}
