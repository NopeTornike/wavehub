import { TicketCategory, TicketStatus } from '@wavehub/shared-types'

// Labels + icons shared by the user-facing support pages (pages/support/*).

export const TICKET_CATEGORY_LABELS: Record<TicketCategory, string> = {
  [TicketCategory.Payment]: 'გადახდა',
  [TicketCategory.OrderStatus]: 'შეკვეთის სტატუსი',
  [TicketCategory.Refund]: 'თანხის დაბრუნება',
  [TicketCategory.Verification]: 'ვერიფიკაცია',
  [TicketCategory.Marketplace]: 'მარკეტფლეისი',
  [TicketCategory.Coaching]: 'კოუჩინგი',
  [TicketCategory.Technical]: 'ტექნიკური',
  [TicketCategory.Other]: 'სხვა',
}

export const TICKET_STATUS_LABELS: Record<TicketStatus, string> = {
  [TicketStatus.Open]: 'ღიაა',
  [TicketStatus.InProgress]: 'მუშავდება',
  [TicketStatus.Escalated]: 'ესკალირებულია',
  [TicketStatus.Closed]: 'დახურულია',
}

const CATEGORY_PATHS: Record<TicketCategory, string> = {
  [TicketCategory.Payment]: 'M3 7h18v10H3zM3 11h18M7 15h3',
  [TicketCategory.OrderStatus]: 'm4 7 8-4 8 4-8 4-8-4Zm0 0v10l8 4 8-4V7m-8 4v10',
  [TicketCategory.Refund]: 'M4 12a8 8 0 1 0 2.3-5.7M4 4v4h4',
  [TicketCategory.Verification]: 'M12 3 5 6v5c0 4.5 3 8.3 7 10 4-1.7 7-5.5 7-10V6l-7-3Zm-3 9 2 2 4-4',
  [TicketCategory.Marketplace]: 'M4 5h2l2 10h10l2-7H7m2 12h.01M17 20h.01',
  [TicketCategory.Coaching]: 'M4 13v-2a8 8 0 0 1 16 0v2M4 12H2v5a2 2 0 0 0 2 2h2v-7H4Zm16 0h2v5a2 2 0 0 1-2 2h-2v-7h2Z',
  [TicketCategory.Technical]: 'M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.6 2.6-2.4-.6-.6-2.4 2.6-2.6Z',
  [TicketCategory.Other]: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm-3-11a3 3 0 1 1 4 2.8c-.6.3-1 .9-1 1.5V15m0 3h.01',
}

export function CategoryIcon({ category }: { category: TicketCategory }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d={CATEGORY_PATHS[category]} />
    </svg>
  )
}

export function formatTicketDate(iso: string): string {
  return new Date(iso).toLocaleString('ka-GE', { dateStyle: 'medium', timeStyle: 'short' })
}
