import { CoachingSessionStatus, KeyInventoryStatus, ListingStatus, OrderStatus } from '@wavehub/shared-types'

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

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  [OrderStatus.PendingPayment]: 'გადახდის მოლოდინში',
  [OrderStatus.Paid]: 'გადახდილია',
  [OrderStatus.InProgress]: 'მიმდინარეობს',
  [OrderStatus.Delivered]: 'მიწოდებულია',
  [OrderStatus.Completed]: 'დასრულებულია',
  [OrderStatus.Cancelled]: 'გაუქმებულია',
  [OrderStatus.Refunded]: 'თანხა დაბრუნებულია',
  [OrderStatus.Disputed]: 'დავის პროცესშია',
  [OrderStatus.Expired]: 'ვადაგასულია',
}

export const SESSION_STATUS_LABELS: Record<CoachingSessionStatus, string> = {
  [CoachingSessionStatus.Scheduled]: 'დაგეგმილია',
  [CoachingSessionStatus.Completed]: 'დასრულებულია',
  [CoachingSessionStatus.Cancelled]: 'გაუქმებულია',
}
