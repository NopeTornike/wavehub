import { CoachingSessionStatus, KeyInventoryStatus, ListingStatus, ListingType, OrderStatus } from '@wavehub/shared-types'

// Georgian display labels for shared-types enums, so a page never renders a raw enum value
// ("pending_review") to a user.
export const LISTING_TYPE_LABELS: Record<ListingType, string> = {
  [ListingType.Service]: 'სერვისი',
  [ListingType.Item]: 'ანგარიში / სკინი / ნივთი',
  [ListingType.DigitalKey]: 'Steam გასაღები',
}

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
  [CoachingSessionStatus.InProgress]: 'მიმდინარეობს',
  [CoachingSessionStatus.AwaitingConfirmation]: 'ელოდება დადასტურებას',
  [CoachingSessionStatus.Completed]: 'დასრულებულია',
  [CoachingSessionStatus.Cancelled]: 'გაუქმებულია',
  [CoachingSessionStatus.Disputed]: 'დავა განიხილება',
}

// The seller form stores the account delivery time as these values (English, kept as stored so old
// listings still match); shown in Georgian everywhere (client 2026-10-07: "Delivery — Within 24
// hours" stayed English on Georgian pages). Unknown values are shown as entered.
const DELIVERY_TIME_LABELS: Record<string, string> = {
  Instant: 'მყისიერი',
  'Within 1 hour': '1 საათში',
  'Within 6 hours': '6 საათში',
  'Within 24 hours': '24 საათში',
  '1–3 days': '1–3 დღეში',
}
export const DELIVERY_TIME_OPTIONS = ['მყისიერი', 'Within 1 hour', 'Within 6 hours', 'Within 24 hours', '1–3 days']
export function deliveryTimeLabel(value: string): string {
  return DELIVERY_TIME_LABELS[value] ?? value
}
