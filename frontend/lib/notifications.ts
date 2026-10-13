import { NotificationType, type PublicNotification } from '@wavehub/shared-types'
import { kaDateTime } from './dates'

// Shared by the bell panel (components/NotificationCenter.tsx), the pop-up toasts
// (components/NotificationToasts.tsx) and the full list (pages/notifications.tsx).

// Where a notification opens. `metadata.link` (newer hook sites) must be an internal path — never
// follow anything that could leave the site.
export function notificationTarget(notification: PublicNotification): string {
  const metadata = notification.metadata ?? {}
  if (metadata.link && /^\/(?!\/)[\w\-/?=&.%]*$/.test(metadata.link)) return metadata.link
  if (metadata.conversationId) return `/messages?conversation=${metadata.conversationId}`
  if (metadata.orderId) return `/orders/${metadata.orderId}`
  if (metadata.sessionId) return `/coaching-sessions/${metadata.sessionId}`
  if (metadata.ticketId) return `/support/${metadata.ticketId}`
  if (metadata.withdrawRequestId) return '/wallet'
  if (metadata.tournamentId) return `/tournaments/${metadata.tournamentId}`
  if (notification.type.startsWith('subscription_')) return '/plans'
  if (notification.type === NotificationType.Welcome) return '/marketplace'
  return '/notifications'
}

// The owner's notification icon set (2026-10-04, `public/assets/ui/*`), one per kind of event.
export function notificationIcon(type: NotificationType): string {
  const icon = (name: string) => `/assets/ui/${name}.png`
  switch (type) {
    case NotificationType.NewMessage:
      return icon('chat-notify')
    case NotificationType.TicketReplied:
      return icon('headset')
    case NotificationType.NewFollower:
      return icon('user-notify')
    case NotificationType.WithdrawalStatusChanged:
    case NotificationType.WalletTopup:
    case NotificationType.WalletAdjusted:
      return icon('wallet-notify')
    case NotificationType.OrderCompleted:
    case NotificationType.ListingApproved:
    case NotificationType.CoachApproved:
      return icon('check-circle-green')
    case NotificationType.OrderCancelled:
    case NotificationType.ListingRejected:
    case NotificationType.CoachRejected:
    case NotificationType.AccountWarning:
    case NotificationType.SubscriptionPastDue:
      return icon('warning')
    case NotificationType.DisputeOpened:
    case NotificationType.DisputeResolved:
      return icon('gavel-notify')
    case NotificationType.ReviewPosted:
    case NotificationType.SessionReviewRequest:
      return icon('star-notify')
    case NotificationType.TournamentTeamAdded:
      return icon('trophy')
    case NotificationType.BadgeGranted:
      return icon('shield-check-green')
    default:
      if (type.startsWith('order_')) return icon('cart-notify')
      if (type.startsWith('session_')) return icon('calendar-coaching')
      if (type.startsWith('subscription_')) return icon('wallet-notify')
      return icon('bell')
  }
}

// The prototype's four visual kinds (icon letter + accent colour).
export function notificationKind(type: NotificationType): { kind: string; letter: string } {
  switch (type) {
    case NotificationType.NewMessage:
    case NotificationType.TicketReplied:
    case NotificationType.NewFollower:
      return { kind: 'message', letter: type === NotificationType.NewFollower ? '+' : 'M' }
    case NotificationType.WithdrawalStatusChanged:
    case NotificationType.WalletTopup:
    case NotificationType.WalletAdjusted:
      return { kind: 'offer', letter: '₾' }
    case NotificationType.OrderPaid:
    case NotificationType.ReviewPosted:
    case NotificationType.ListingApproved:
    case NotificationType.CoachApproved:
      return { kind: 'sale', letter: type === NotificationType.ReviewPosted ? '★' : 'S' }
    case NotificationType.Welcome:
      return { kind: 'sale', letter: 'W' }
    default:
      if (type.startsWith('subscription_')) return { kind: 'offer', letter: '₾' }
      if (type.startsWith('session_')) return { kind: 'order', letter: 'C' }
      return { kind: 'order', letter: 'O' }
  }
}

export function formatNotificationTime(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  // Georgian months in Tbilisi time like every other date on the site (the browser locale gave
  // "Oct 6, 11:11 AM" on a Georgian page); EN mode translates the month names.
  return kaDateTime(date)
}
