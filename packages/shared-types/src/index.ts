// Shared enums/types consumed by both backend (NestJS) and frontend (Next.js).
// No build step: both consumers resolve this package's TypeScript source directly
// via the npm workspace symlink + tsconfig path mapping. Keep this package to
// types/enums only — no business logic, no runtime dependencies.
//
// See CLAUDE.md in this directory for update discipline: any change here that
// affects a specific module (e.g. OrderStatus) must be reflected in that
// module's CLAUDE.md "Related modules" note in the same change.

export enum UserStatus {
  PendingVerification = 'pending_verification',
  Active = 'active',
  Suspended = 'suspended',
  Banned = 'banned',
}

// The 6 real staff roles per the client's "Staff Management System" docs (2026-07 update) —
// supersedes an earlier 3-role placeholder (super_admin/support_admin/finance_admin). Super Admin
// has unrestricted access to everything; every other role is an explicit subset — see
// SPECIFICATION.md §5.13 for the full per-role CAN/CANNOT catalog, preserved verbatim from source.
// Don't add a 7th role or rename these without updating that section in the same change.
export enum AdminRole {
  SuperAdmin = 'super_admin',
  OperationLead = 'operation_lead',
  MainAdministrator = 'main_administrator',
  MarketplaceCoachingOpsManager = 'marketplace_coaching_ops_manager',
  TrustSafetyOfficer = 'trust_safety_officer',
  SupportSpecialist = 'support_specialist',
}

export enum SellerTier {
  New = 'new',
  Rising = 'rising',
  Pro = 'pro',
  Elite = 'elite',
}

export enum VerificationStatus {
  NotVerified = 'not_verified',
  Pending = 'pending',
  Verified = 'verified',
  Rejected = 'rejected',
}

export enum ListingType {
  Service = 'service',
  Item = 'item',
  // A secret, single-use activation code (Steam key or similar) — see backend/src/listings/CLAUDE.md
  // for why this is a third type rather than a variant of Item (stock is derived from
  // ListingKeyInventory row counts, not a stored stockQuantity; the "item" itself is never shown
  // until purchase).
  DigitalKey = 'digital_key',
}

// listing_key_inventory.status — backend/src/listings/listing-key-inventory.entity.ts. `Revoked` is
// a soft delete (a seller removing an unsold key), never a hard DELETE, so the row stays for audit.
export enum KeyInventoryStatus {
  Available = 'available',
  Sold = 'sold',
  Revoked = 'revoked',
}

// What ListingsService#listKeys returns to a seller viewing their own key inventory — deliberately
// never includes the key value itself, encrypted or not (see key-encryption.util.ts's comment on
// why the plaintext is only ever reconstructed once, for the buyer, via OrdersService#getRevealedKey).
export interface SellerListingKeySummary {
  id: string;
  status: KeyInventoryStatus;
  soldAt: string | null;
  createdAt: string;
}

export enum ListingStatus {
  Draft = 'draft',
  PendingReview = 'pending_review',
  Active = 'active',
  Paused = 'paused',
  Rejected = 'rejected',
}

export enum OrderStatus {
  PendingPayment = 'pending_payment',
  Paid = 'paid',
  InProgress = 'in_progress',
  Delivered = 'delivered',
  Completed = 'completed',
  Cancelled = 'cancelled',
  Refunded = 'refunded',
  Disputed = 'disputed',
  Expired = 'expired',
}

export enum WalletLedgerType {
  Topup = 'topup',
  OrderEscrowHold = 'order_escrow_hold',
  OrderRelease = 'order_release',
  OrderRefund = 'order_refund',
  // Coaching-session equivalents of the three Order* types above — kept structurally identical
  // but distinctly named so a seller/buyer's transaction history can tell an order charge from a
  // session charge apart, rather than sessions silently reusing the Order* types. See
  // backend/src/wallet/CLAUDE.md and backend/src/coaching/CLAUDE.md.
  SessionEscrowHold = 'session_escrow_hold',
  SessionRelease = 'session_release',
  SessionRefund = 'session_refund',
  Withdrawal = 'withdrawal',
  AdminAdjustment = 'admin_adjustment',
  PlatformFee = 'platform_fee',
}

export enum WalletLedgerStatus {
  Pending = 'pending',
  Available = 'available',
  Held = 'held',
  Reversed = 'reversed',
}

export enum WithdrawStatus {
  Pending = 'pending',
  Processing = 'processing',
  Completed = 'completed',
  Rejected = 'rejected',
  Cancelled = 'cancelled',
}

export enum WithdrawMethod {
  BankTransfer = 'bank_transfer',
  PayPal = 'paypal',
  Wise = 'wise',
}

export enum DisputeStatus {
  Open = 'open',
  UnderReview = 'under_review',
  WaitingForEvidence = 'waiting_for_evidence',
  Resolved = 'resolved',
  Closed = 'closed',
}

export enum DisputeResolution {
  ReleaseToSeller = 'release_to_seller',
  RefundBuyer = 'refund_buyer',
  CancelOrder = 'cancel_order',
}

export enum ReviewStatus {
  Published = 'published',
  Hidden = 'hidden',
  Reported = 'reported',
  Deleted = 'deleted',
}

export enum ConversationType {
  Direct = 'direct',
  Order = 'order',
}

export enum MessageType {
  Text = 'text',
  Image = 'image',
  File = 'file',
  System = 'system',
}

export enum MessageStatus {
  Sent = 'sent',
  Delivered = 'delivered',
  Seen = 'seen',
}

// The subset of SPECIFICATION.md §5.12's full event catalog that's actually wired up —
// backend/src/notifications/CLAUDE.md's Status section tracks exactly which hook points exist and
// which (account events, marketplace approve/reject/pause events) are deliberately deferred.
export enum NotificationType {
  OrderPaid = 'order_paid',
  OrderStarted = 'order_started',
  OrderDelivered = 'order_delivered',
  OrderRevisionRequested = 'order_revision_requested',
  OrderCompleted = 'order_completed',
  OrderCancelled = 'order_cancelled',
  DisputeOpened = 'dispute_opened',
  DisputeResolved = 'dispute_resolved',
  ReviewPosted = 'review_posted',
  WithdrawalStatusChanged = 'withdrawal_status_changed',
  NewMessage = 'new_message',
  TicketReplied = 'ticket_replied',
  SessionBooked = 'session_booked',
  SessionCompleted = 'session_completed',
  SessionCancelled = 'session_cancelled',
  SubscriptionGranted = 'subscription_granted',
  SubscriptionPastDue = 'subscription_past_due',
  SubscriptionExpiring = 'subscription_expiring',
  SubscriptionCancelled = 'subscription_cancelled',
  SubscriptionExpired = 'subscription_expired',
}

// Support ticketing (build-plan Phase 11d). Categories match SPECIFICATION.md §5.13.6's example
// Saved Replies list verbatim ("payment problem, order status, refund process, verification,
// marketplace, coaching, technical problem"), plus a catch-all `Other`.
export enum TicketCategory {
  Payment = 'payment',
  OrderStatus = 'order_status',
  Refund = 'refund',
  Verification = 'verification',
  Marketplace = 'marketplace',
  Coaching = 'coaching',
  Technical = 'technical',
  Other = 'other',
}

export enum TicketPriority {
  Low = 'low',
  Medium = 'medium',
  High = 'high',
  Urgent = 'urgent',
}

export enum TicketStatus {
  Open = 'open',
  InProgress = 'in_progress',
  Escalated = 'escalated',
  Closed = 'closed',
}

export interface PublicUser {
  id: string;
  username: string;
  firstName: string;
  lastName: string;
  status: UserStatus;
  adminRole: AdminRole | null;
  // The buyer-spendable WaveCoin balance (backend/src/wallet/CLAUDE.md) — a seller's earnings
  // (available/pending/withdrawn) are a separate derived view over the wallet ledger, not this
  // field; this is only ever what the user can spend at checkout.
  wavecoinBalance: number;
  // Uploaded profile photo (Settings page), or null for the initials avatar.
  avatarUrl: string | null;
}

export interface AuthMeResponse {
  user: PublicUser;
}

// --- Marketplace response shapes ---
// These describe what backend/src/listings' endpoints actually return (see
// ListingsService#browseActive / #findPublicById) — not full TypeORM entities, since
// `passwordHash`-style internal fields and unrelated columns shouldn't leak into a public API
// response even when they wouldn't in practice (User.passwordHash is `select: false`, but treat
// that as defense in depth, not a reason to skip typing the public shape explicitly here).

export interface PublicCategory {
  id: string;
  name: string;
  slug: string;
  type: 'service' | 'item' | 'both';
}

export interface PublicGame {
  id: string;
  name: string;
  slug: string;
  iconUrl: string | null;
  // Staff-uploaded art (GET /games returns them; nested `game` objects may omit them).
  coverUrl?: string | null;
  tileUrl?: string | null;
}

// GET /admin/games — every game including hidden ones, with how many listings use it.
export interface AdminGame {
  id: string;
  name: string;
  slug: string;
  iconUrl: string | null;
  coverUrl: string | null;
  tileUrl: string | null;
  isActive: boolean;
  sortOrder: number;
  listingCount: number;
}

export type GameImageKind = 'icon' | 'cover' | 'tile';

export interface PublicSeller {
  id: string;
  username: string;
  firstName: string;
  lastName: string;
  sellerRatingAvg: string | null;
  sellerRatingCount: number;
}

export interface PublicListingImage {
  id: string;
  url: string;
  sortOrder: number;
}

export interface PublicPackage {
  id: string;
  name: string;
  priceWaveCoin: number;
  deliveryTimeDays: number;
  features: string[];
  revisionsIncluded: number;
}

// The shape browseActive returns per item — a Listing with seller/category/game/images joined, no
// packages (see PublicListingDetail for the fuller detail-page shape).
export interface PublicListingSummary {
  id: string;
  type: ListingType;
  title: string;
  status: ListingStatus;
  viewsCount: number;
  ordersCount: number;
  isFeatured: boolean;
  ratingAvg: string | null;
  ratingCount: number;
  priceWaveCoin: number | null;
  stockQuantity: number | null;
  // Always populated for a card display: the item's own `priceWaveCoin` for item listings, or the
  // cheapest package's price for service listings (which price via packages, not the listing
  // itself). Null only if a service listing somehow has zero packages. See
  // ListingsService#browseActive for how this is computed — it's not a stored column.
  startingPriceWaveCoin: number | null;
  seller: PublicSeller;
  category: PublicCategory;
  game: PublicGame | null;
  images: PublicListingImage[];
  // Item listings only (null otherwise): the seller-entered account/skin details the prototype's
  // marketplace cards and detail page show — see ItemAttributes.
  itemAttributes: ItemAttributes | null;
  // How many accounts have this listing in their favourites (the card's ♡ count).
  favoriteCount: number;
}

// Seller-entered details on an item listing (backend/src/listings — `item_details.attributes`).
// Known keys are the ones the prototype's sell form collects; per-game extras use their own keys.
// Values are always short strings / numbers / booleans (validated server-side, see
// IsItemAttributes). Public information by design — never put secrets (logins, emails) here.
export type ItemAttributeValue = string | number | boolean;
export interface ItemAttributes {
  kind?: 'account' | 'skin';
  accountStatus?: 'basic' | 'premium' | 'rare' | 'og' | 'ranked' | 'full-collection';
  accountLevel?: number;
  platform?: string;
  region?: string;
  loginMethod?: string;
  emailChangeable?: boolean;
  linkedAccounts?: string;
  fullAccess?: boolean;
  originalEmail?: boolean;
  twoFactor?: boolean;
  deliveryMethod?: string;
  deliveryTime?: string;
  [key: string]: ItemAttributeValue | undefined;
}

export interface RequirementField {
  key: string;
  label: string;
  type: 'text' | 'dropdown' | 'number' | 'textarea';
  required: boolean;
  options?: string[];
}

export interface FaqEntry {
  q: string;
  a: string;
}

// GET listings/mine/:id (the seller, any status) and GET admin/listings/:id (moderator preview):
// everything needed to edit or review a listing. Never carries seller PII beyond the username.
export interface ListingForEdit {
  id: string;
  type: ListingType;
  status: ListingStatus;
  title: string;
  description: string;
  rejectionReason: string | null;
  priceWaveCoin: number | null;
  category: { id: string; name: string; slug: string };
  game: PublicGame | null;
  sellerUsername: string;
  images: PublicListingImage[];
  packages: PublicPackage[];
  requirementsSchema: RequirementField[];
  faq: FaqEntry[];
  itemAttributes: Record<string, unknown> | null;
  createdAt: string;
}

// What ListingsService#findPublicById returns — a PublicListingSummary plus the fuller detail-page
// fields (description, packages, type-specific extras).
export interface PublicListingDetail extends PublicListingSummary {
  description: string;
  // The seller's completed orders across all their listings (detail page's seller strip).
  sellerCompletedOrders: number;
  packages: PublicPackage[];
  requirementsSchema?: RequirementField[];
  faq?: FaqEntry[];
}

// --- Order response shapes ---
// What backend/src/orders' endpoints actually return (see OrdersService#findMineAsBuyer/
// #findMineAsSeller/#findForParticipant) — both buyer and seller are always included (whichever
// side the viewer isn't is just "the counterparty"), since order participants can already see each
// other's basic identity in this context; there's no restricted-view variant of this shape.

export interface PublicOrderParty {
  id: string;
  username: string;
  firstName: string;
  lastName: string;
}

export interface PublicOrderListingRef {
  id: string;
  title: string;
  type: ListingType;
  // For the order card's thumbnail/meta line: the listing's game (null for a game-less listing) and
  // its first approved image (null → the page shows the game's cover art).
  gameName: string | null;
  gameSlug: string | null;
  imageUrl: string | null;
}

export interface PublicOrderPackageRef {
  id: string;
  name: string;
}

export interface PublicOrderDeliveryFile {
  id: string;
  fileUrl: string;
  fileType: string;
  uploadedBy: string;
  createdAt: string;
}

// The shape findMineAsBuyer/findMineAsSeller return per row — enough for a list card, not the
// full detail (no requirementsAnswers/deliveryFiles — see PublicOrderDetail for that).
export interface PublicOrderSummary {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  listing: PublicOrderListingRef;
  package: PublicOrderPackageRef | null;
  buyer: PublicOrderParty;
  seller: PublicOrderParty;
  priceWaveCoin: number;
  deliveryDueAt: string | null;
  deliveredAt: string | null;
  autoCompleteAt: string | null;
  completedAt: string | null;
  createdAt: string;
}

// What findForParticipant returns — a PublicOrderSummary plus everything a detail page needs to
// render status-specific actions and history.
export interface PublicOrderDetail extends PublicOrderSummary {
  requirementsAnswers: Record<string, unknown> | null;
  platformFeeWaveCoin: number;
  sellerPayoutWaveCoin: number;
  cancelledAt: string | null;
  cancellationReason: string | null;
  revisionReason: string | null;
  deliveryFiles: PublicOrderDeliveryFile[];
}

// What ChatService#listMessages/#postMessage return (backend/src/chat/) — `senderId: null` (with
// `senderUsername: null`) marks a system message (order-lifecycle event), never a real user with
// no name.
export interface PublicMessage {
  id: string;
  type: MessageType;
  body: string;
  status: MessageStatus;
  senderId: string | null;
  senderUsername: string | null;
  createdAt: string;
}

// What ChatService#listMyDirectConversations returns (backend/src/chat/) — one row per Direct
// conversation the caller is part of. `otherUser` is always the *other* participant, resolved
// relative to whoever is asking, never a fixed buyer/seller role (a Direct conversation's
// buyerId/sellerId columns just record who happened to start it — see conversation.entity.ts).
export interface PublicConversationSummary {
  id: string;
  otherUser: { id: string; username: string };
  lastMessage: { body: string; createdAt: string; senderId: string | null } | null;
  createdAt: string;
  // Messages the other participant sent that the viewer hasn't opened yet (status != 'seen').
  unreadCount: number;
}

// --- Dispute response shapes ---
// What backend/src/disputes' endpoints return. `resolution`/`resolutionNote`/`resolvedBy`/
// `resolvedAt` stay null until a dispute is resolved — see DisputesService#resolve.

export interface PublicDisputeMessage {
  id: string;
  senderId: string;
  senderUsername: string;
  body: string;
  createdAt: string;
}

export interface PublicDisputeEvidence {
  id: string;
  fileUrl: string;
  fileType: string;
  uploadedBy: string;
  createdAt: string;
}

export interface PublicDispute {
  id: string;
  orderId: string;
  buyerId: string;
  sellerId: string;
  openedBy: string;
  reason: string;
  status: DisputeStatus;
  resolution: DisputeResolution | null;
  resolutionNote: string | null;
  resolvedBy: string | null;
  resolvedAt: string | null;
  createdAt: string;
  messages: PublicDisputeMessage[];
  evidence: PublicDisputeEvidence[];
}

export interface PublicReview {
  id: string;
  rating: number;
  body: string | null;
  tags: string[];
  sellerReply: string | null;
  sellerRepliedAt: string | null;
  createdAt: string;
  buyer: Pick<PublicUser, 'id' | 'username'>;
}

// --- Wallet & withdrawal response shapes ---
// What backend/src/wallet/'s WalletController and backend/src/withdrawals/'s WithdrawalsController
// return. See WalletService#getBalanceSummary for how these numbers are derived — none of them are
// stored columns, all computed from wallet_ledger_entries at request time.

export interface PublicWalletBalance {
  // Current spendable balance (== users.wavecoinBalance) — what a buyer can actually check out
  // with right now. Already nets out every debit (purchases, withdrawals) and credit (topups,
  // cleared earnings, refunds).
  walletBalance: number;
  // Lifetime gross seller earnings (sum of every OrderRelease ledger entry ever written) —
  // doesn't subtract withdrawals or spending, this is "how much have you ever earned."
  totalEarned: number;
  // Earnings still inside the 7-day hold (availableAt in the future) — not yet withdrawable.
  pendingClearance: number;
  // min(walletBalance, cleared earnings) — the actual ceiling on a new withdrawal request right
  // now. Capped by walletBalance so a seller who already spent earned coins on a purchase can't
  // request a withdrawal against money they no longer have.
  availableToWithdraw: number;
  // Sum of this seller's WithdrawRequests currently in `pending`/`processing` status — already
  // debited from walletBalance (reserved), shown separately so the number isn't "missing."
  pendingWithdrawal: number;
  // Sum of this seller's WithdrawRequests with status `completed`.
  totalWithdrawn: number;
}

export interface PublicWalletTransaction {
  id: string;
  type: WalletLedgerType;
  amountWaveCoin: number;
  status: WalletLedgerStatus;
  orderId: string | null;
  createdAt: string;
}

export interface PublicWithdrawRequest {
  id: string;
  amountWaveCoin: number;
  method: WithdrawMethod;
  status: WithdrawStatus;
  adminNote: string | null;
  createdAt: string;
  processedAt: string | null;
}

// What backend/src/notifications/'s NotificationsController returns. `metadata` carries whatever
// id a frontend needs to deep-link (orderId/disputeId/reviewId/withdrawRequestId) — shape varies
// by `type`, deliberately not broken into a discriminated union yet since nothing renders these
// beyond a flat list today; see notifications/CLAUDE.md.
export interface PublicNotification {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  metadata: Record<string, string> | null;
  readAt: string | null;
  createdAt: string;
}

// --- Coaching (backend/src/coaching/) ---
// A structurally separate concept from Seller/Listing per SPECIFICATION.md §5.13.7 — a Coach has
// its own verification flow and profile. This first slice covers profile + directory + admin
// verification/suspension only; session booking and payment are a deliberately separate follow-up
// (see backend/src/coaching/CLAUDE.md's Status section for why, and see VerificationStatus above
// for the enum this reuses rather than duplicating).

export enum CoachStatus {
  Active = 'active',
  Suspended = 'suspended',
}

export interface PublicCoachSummary {
  id: string;
  // The coach's user id (same exposure as PublicSeller.id) — for "Message Coach".
  userId: string;
  username: string;
  firstName: string;
  lastName: string;
  specialty: string;
  gameName: string | null;
  gameSlug: string | null;
  hourlyRateWaveCoin: number;
  ratingAvg: string | null;
  ratingCount: number;
  // Active Seller/Coach plan's profileBadge perk, if any.
  profileBadge: string | null;
  // Two-letter codes the coach listed (e.g. `ka`, `en`).
  languages: string[];
  avatarUrl: string | null;
  // Seen (made an authenticated request) within the community online window — real presence, not
  // a decoration.
  online: boolean;
  // Coach-entered in-game rank (e.g. "Conqueror").
  rank: string | null;
  // Median minutes the coach took to answer a new message over the last 90 days (order + direct
  // chats); null until there are at least 3 answered messages to measure.
  responseMinutes: number | null;
  completedSessions: number;
}

export interface PublicCoachGame {
  id: string;
  name: string;
  slug: string;
  main: boolean;
}

export interface PublicCoachDetail extends PublicCoachSummary {
  bio: string;
  videoUrl: string | null;
  quote: string | null;
  coachingStyle: string[];
  games: PublicCoachGame[];
  // Distinct buyers of completed sessions, completed sessions, and completed / (completed +
  // cancelled) as a percentage (null before any session finished either way).
  stats: { students: number; sessions: number; successRate: number | null };
  // The coach account's Wave rank (community/ — same formula as the topbar), scaled to 0–100.
  waveScore: { score: number; tier: string };
}

export interface PublicCoachReview {
  id: string;
  rating: number;
  body: string | null;
  buyerUsername: string;
  createdAt: string;
}

// GET coaches/mine/profile — what the coach can edit on their profile.
export interface MyCoachProfile {
  id: string;
  gameId: string | null;
  specialty: string;
  bio: string;
  languages: string[];
  hourlyRateWaveCoin: number;
  rank: string | null;
  videoUrl: string | null;
  quote: string | null;
  coachingStyle: string[];
  extraGameIds: string[];
  verificationStatus: VerificationStatus;
}

// What CoachesService.listPendingVerification() / listAll() return for the admin queue.
export interface AdminCoachSummary {
  id: string;
  userId: string;
  username: string;
  specialty: string;
  gameName: string | null;
  hourlyRateWaveCoin: number;
  verificationStatus: VerificationStatus;
  status: CoachStatus;
  rejectionReason: string | null;
  createdAt: string;
}

// --- Support ticketing (backend/src/support/) ---

export interface PublicTicketMessage {
  id: string;
  senderId: string;
  senderUsername: string;
  body: string;
  // Internal notes are staff-only — never present in a response returned to the ticket's
  // requester (see SupportService#getMine, which filters these out server-side rather than
  // relying on the frontend to hide them).
  isInternalNote: boolean;
  createdAt: string;
}

export interface PublicTicket {
  id: string;
  requesterId: string;
  subject: string;
  category: TicketCategory;
  priority: TicketPriority;
  status: TicketStatus;
  orderId: string | null;
  assignedToId: string | null;
  createdAt: string;
  updatedAt: string;
  closedAt: string | null;
  messages: PublicTicketMessage[];
}

// The admin ticket-list queue — lighter than PublicTicket (no messages), plus requester/assignee
// usernames a staff member needs to triage without a follow-up lookup.
export interface AdminTicketSummary {
  id: string;
  requesterId: string;
  requesterUsername: string;
  subject: string;
  category: TicketCategory;
  priority: TicketPriority;
  status: TicketStatus;
  assignedToId: string | null;
  assignedToUsername: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PublicSavedReply {
  id: string;
  category: TicketCategory;
  title: string;
  body: string;
}

// --- Admin panel response shapes ---

// What ListingsService.listPendingReview() returns for the admin `GET listings/pending-review`
// queue — a purpose-built projection, not the raw Listing entity (which would carry the full
// joined `seller`/`category`/`game` rows, including seller fields like email/wavecoinBalance an
// approval-queue table has no reason to expose).
export interface AdminListingSummary {
  id: string;
  title: string;
  type: ListingType;
  sellerId: string;
  sellerUsername: string;
  categoryName: string;
  gameName: string | null;
  status: ListingStatus;
  createdAt: string;
}

// What ReviewsService.listReported() returns for the admin `GET reviews/reported` queue — same
// "purpose-built projection, not the raw entity" reasoning as AdminListingSummary above.
export interface AdminReviewSummary {
  id: string;
  listingId: string;
  listingTitle: string;
  buyerUsername: string;
  sellerUsername: string;
  rating: number;
  body: string | null;
  status: ReviewStatus;
  createdAt: string;
}

// What DisputesService.listOpen() returns for the admin `GET disputes` queue — deliberately
// lighter than PublicDispute (no messages/evidence array), since the list view only needs enough
// to route to the right order's full dispute UI (frontend/pages/orders/[id].tsx), not the full
// thread.
export interface AdminDisputeSummary {
  id: string;
  orderId: string;
  orderNumber: string;
  buyerId: string;
  sellerId: string;
  status: DisputeStatus;
  reason: string;
  createdAt: string;
}

// What WithdrawalsService.listPending() returns for the admin `GET withdrawals/pending` queue —
// unlike PublicWithdrawRequest (the seller's own view), this includes `sellerId`/`sellerUsername`
// (whose request is it) and `payoutDetails` (an admin actually paying this out manually needs the
// PayPal email/Wise account/bank details, not just the amount).
export interface AdminWithdrawRequestSummary {
  id: string;
  sellerId: string;
  sellerUsername: string;
  amountWaveCoin: number;
  method: WithdrawMethod;
  payoutDetails: Record<string, string>;
  status: WithdrawStatus;
  createdAt: string;
}

// What backend/src/settings/platform-settings.controller.ts returns (GET and POST both return
// the full current row). `maintenanceMode` is stored but not yet enforced anywhere — see
// settings/CLAUDE.md.
export interface PublicPlatformSettings {
  id: string;
  platformFeePercent: number;
  minWithdrawalWaveCoin: number;
  maintenanceMode: boolean;
  updatedAt: string;
}

// What backend/src/users/admin-users.controller.ts returns — a superset of PublicUser (adds
// email, role, createdAt, moderationReason) that only ever goes to an admin-guarded route, never
// to the user themselves or the public. Keep this list distinct from PublicUser rather than
// widening PublicUser itself — email/moderationReason are not meant to leak to a non-admin caller.
export interface AdminUserSummary {
  id: string;
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  role: 'buyer' | 'seller';
  status: UserStatus;
  adminRole: AdminRole | null;
  wavecoinBalance: number;
  moderationReason: string | null;
  createdAt: string;
}

// Static/legal page CMS — scoped to what Footer.tsx actually links to (About/Contact/Terms/
// Privacy/Refund), not the broader banners/news/categories/badges/tags/promo-code "Content
// Management" catalog from SPECIFICATION.md §5.13 (that's real future scope, Phase 11f).
export enum ContentPageStatus {
  Draft = 'draft',
  Published = 'published',
}

// What GET /content/:slug returns — public, published pages only.
export interface PublicContentPage {
  slug: string;
  title: string;
  body: string;
  updatedAt: string;
}

// What the admin content-pages endpoints return/accept — includes draft pages and status, unlike
// PublicContentPage which only ever exposes published ones.
export interface AdminContentPage {
  id: string;
  slug: string;
  title: string;
  body: string;
  status: ContentPageStatus;
  createdAt: string;
  updatedAt: string;
}

// What GET /users/:username returns — a public seller-profile view. Deliberately excludes
// email/wavecoinBalance/adminRole/status (see AdminUserSummary for the admin-only superset) —
// this is served to unauthenticated visitors.
export interface PublicUserProfile {
  // Same exposure as PublicSeller.id — used by "Message".
  userId: string;
  username: string;
  firstName: string;
  lastName: string;
  sellerRatingAvg: string | null;
  sellerRatingCount: number;
  activeListingCount: number;
  createdAt: string;
  // From an active (or past_due-grace) subscription's `perks.profileBadge` — the Seller/Coach
  // Visibility plan's badge takes priority over a Buyer Membership one if a user somehow holds
  // both, since a public seller-profile page is inherently seller-context. Null if the user has
  // no subscription with this perk. See backend/src/subscriptions/CLAUDE.md.
  profileBadge: string | null;
  bio: string | null;
  avatarUrl: string | null;
  mainGames: Array<{ name: string; slug: string }>;
  // docs/design-mockups/12 additions. Self-entered: location, tagline, platform, preferredRole,
  // achievement. Everything else is computed from real rows.
  shortId: string;
  role: 'coach' | 'seller' | 'player';
  location: string | null;
  tagline: string | null;
  platform: string | null;
  preferredRole: string | null;
  achievement: string | null;
  online: boolean;
  followers: number;
  following: number;
  waveRank: WaveRank;
  completedDeals: number;
  // Buyer reviews of this user as seller and as coach, together.
  reviews: {
    count: number;
    average: number | null;
    // Index 0 = 5 stars … index 4 = 1 star.
    distribution: [number, number, number, number, number];
    latest: Array<{ rating: number; body: string | null; buyerUsername: string; createdAt: string }>;
  };
  // Earned achievements only — see backend/src/follows/CLAUDE.md for each rule.
  badges: Array<{ key: string; label: string }>;
  coachId: string | null;
}

// The signed-in user's own editable profile (GET/PATCH /me/profile).
export interface MyProfile {
  username: string;
  firstName: string;
  lastName: string;
  bio: string | null;
  avatarUrl: string | null;
  mainGameIds: string[];
  location: string | null;
  tagline: string | null;
  platform: string | null;
  preferredRole: string | null;
  achievement: string | null;
}

// Coaching session booking + escrow payment (build-plan Phase 11b follow-up — see
// backend/src/coaching/CLAUDE.md's Status section for why this was cut from the original
// profile+directory+verification slice). Deliberately simple compared to the static prototype's
// coach-book-session.js mock: a buyer requests a session at a specific date/time and pays
// immediately (same "debit at request time" pattern as an order purchase) — no coach
// accept/decline step, no availability calendar. The coach marks it Completed after the session
// happens (releases escrow, same 7-day hold as an order) or either party can Cancel while still
// Scheduled (refunds the buyer).
export enum CoachingSessionStatus {
  Scheduled = 'scheduled',
  Completed = 'completed',
  Cancelled = 'cancelled',
}

export interface PublicCoachingSession {
  id: string;
  coachId: string;
  coachUserId: string;
  coachUsername: string;
  coachFirstName: string;
  coachLastName: string;
  buyerId: string;
  buyerUsername: string;
  scheduledAt: string;
  durationMinutes: number;
  priceWaveCoin: number;
  buyerMessage: string | null;
  status: CoachingSessionStatus;
  createdAt: string;
}

// Tournaments — a genuinely new feature, not in the original product spec (confirmed by grep —
// see LAUNCH_PLAN.md §2b). Scoped down from origin/main's static prototype to the structural core:
// admin posts a tournament, users register, no automated bracket/matchmaking/prize-payout — the
// same "ship the core, flag automation as a deliberate follow-up" pattern this repo has used
// throughout (see backend/src/withdrawals/CLAUDE.md's manual-payout precedent).
export enum TournamentStatus {
  Open = 'open',
  Upcoming = 'upcoming',
  // Registration closed, matches being played (the design's "IN PROGRESS" / Active group).
  InProgress = 'in_progress',
  Completed = 'completed',
}

// Every registration is a team (a solo tournament's team is one player, auto-verified). Squad
// teams start Pending until tournament staff verify them.
export enum TournamentTeamStatus {
  Pending = 'pending',
  Verified = 'verified',
  Rejected = 'rejected',
}

export enum TournamentMatchStage {
  Group = 'group',
  Round = 'round',
  QuarterFinal = 'quarterfinal',
  SemiFinal = 'semifinal',
  Final = 'final',
}

export enum TournamentMatchStatus {
  Scheduled = 'scheduled',
  Live = 'live',
  Completed = 'completed',
}

// Admin-entered prize breakdown (the design's Prize Pool tab). Free text amounts, like `prize` —
// payouts are not automated.
export interface TournamentPrizePlace {
  place: string;
  amount: string;
  rewards: string[];
}

export interface TournamentPrizes {
  places: TournamentPrizePlace[];
  specialRewards: string[];
  note: string | null;
}

export interface PublicTournamentTeam {
  id: string;
  tournamentId: string;
  name: string;
  tag: string | null;
  logoUrl: string | null;
  captainUsername: string;
  coachName: string | null;
  // In-game names as the captain entered them (exactly `teamSize` of them).
  members: string[];
  status: TournamentTeamStatus;
  createdAt: string;
}

export interface TournamentTeamRef {
  id: string;
  name: string;
  tag: string | null;
  logoUrl: string | null;
}

// Admin-entered per-player match line. Any stat may be missing (null) — the page shows "—".
export interface MatchPlayerStat {
  name: string;
  kills: number | null;
  kd: number | null;
  damage: number | null;
  rating: number | null;
  assists: number | null;
  mvp: boolean;
}

export interface MatchTeamStats {
  coach: string | null;
  players: MatchPlayerStat[];
}

export interface PublicTournamentMatch {
  id: string;
  tournamentId: string;
  tournamentName: string;
  stage: TournamentMatchStage;
  groupName: string | null;
  roundLabel: string | null;
  teamA: TournamentTeamRef | null;
  teamB: TournamentTeamRef | null;
  map: string | null;
  bestOf: number;
  scheduledAt: string | null;
  status: TournamentMatchStatus;
  scoreA: number | null;
  scoreB: number | null;
  stats: { a: MatchTeamStats | null; b: MatchTeamStats | null };
}

// GET /me/tournaments — one row per tournament the caller registered a team for.
export interface MyTournamentEntry {
  tournament: PublicTournamentSummary;
  team: PublicTournamentTeam;
  registeredAt: string;
}

// Deliberately NOT personalized (no "am I registered" field) — this app keeps public endpoints
// fully public and has the frontend cross-reference GET tournaments/mine (an authenticated,
// separate call returning just the caller's own registered tournament IDs) instead of an
// optional-auth pattern, which doesn't exist anywhere else in this codebase (AuthGuard always
// requires a valid session).
export interface PublicTournamentSummary {
  id: string;
  gameId: string;
  gameName: string;
  name: string;
  description: string;
  prize: string;
  status: TournamentStatus;
  startDate: string;
  maxPlayers: number;
  registeredCount: number;
  coverImageUrl: string | null;
  createdAt: string;
  // Admin-entered facts (keys: TOURNAMENT_DETAIL_KEYS); missing ones show "To be announced".
  details: Record<string, string>;
  // One rule per line, "Title: description" (the Rules tab's numbered rows).
  rules: string | null;
  // Players per team (1 = solo). `registeredCount` counts players across non-rejected teams;
  // `maxTeams` = floor(maxPlayers / teamSize).
  teamSize: number;
  teamCount: number;
  maxTeams: number;
  prizes: TournamentPrizes;
}

// Seller-entered Steam game facts on a digital-key listing (docs/design-mockups 04/05), stored in the
// listing's attributes: tagline, genre (a STEAM_GENRES key), region, edition, language,
// compareAtPrice (the "was" price — must be above the real price) and trailerUrl (YouTube/Vimeo).
export const STEAM_GENRES: ReadonlyArray<readonly [key: string, label: string]> = [
  ['action', 'Action'],
  ['adventure', 'Adventure'],
  ['rpg', 'RPG'],
  ['shooter', 'Shooter'],
  ['strategy', 'Strategy'],
  ['sports', 'Sports'],
  ['simulation', 'Simulation'],
  ['racing', 'Racing'],
  ['horror', 'Horror'],
  ['indie', 'Indie'],
];

// The facts the prototype's tournament page shows, in its order, with its labels.
export const TOURNAMENT_DETAIL_KEYS: ReadonlyArray<readonly [key: string, label: string]> = [
  ['format', 'Format'],
  ['mode', 'Mode'],
  ['region', 'Region / Server'],
  ['platform', 'პლატფორმა'],
  ['checkInTime', 'Check-in Time'],
  ['startTime', 'Start Time'],
  ['endDate', 'End Date (YYYY-MM-DD)'],
  ['registrationDeadline', 'Registration Deadline'],
  ['entryFee', 'შესვლის საფასური'],
  ['teamSize', 'Team Size'],
  ['minimumRank', 'Minimum Rank'],
  ['bracketType', 'Bracket Type'],
  ['matches', 'Matches'],
  ['whoCanJoin', 'Who Can Join'],
  ['communication', 'Communication'],
  ['organizer', 'Organizer'],
  ['slogan', 'Hero slogan'],
];

export type PublicTournamentDetail = PublicTournamentSummary;

// BOG subscription + membership/visibility plans (LAUNCH_PLAN.md §3) — two separate subscription
// products (Buyer Membership, Seller/Coach Visibility) sharing one `plans` table distinguished by
// `audience`, same reasoning as `Listing` covering both Service/Item/DigitalKey with one table.
export enum SubscriptionAudience {
  Buyer = 'buyer',
  SellerCoach = 'seller_coach',
}

// `UserSubscription.status`. `PastDue` still carries perks (a deliberate grace period — a single
// declined recharge shouldn't be an instant perk cutoff, see backend/src/subscriptions/CLAUDE.md);
// only `Cancelled`/`Expired` do not. `Cancelled` is buyer-initiated (cancelAtPeriodEnd, perks last
// until the period actually ends); `Expired` is system-initiated (grace period ran out with no
// successful recharge).
export enum SubscriptionStatus {
  Active = 'active',
  PastDue = 'past_due',
  Cancelled = 'cancelled',
  Expired = 'expired',
}

// `SubscriptionPlan.perks` — a jsonb bag (§3b), not one column per perk, so a new perk never needs
// a migration. Every key is optional; see backend/src/subscriptions/CLAUDE.md for exactly which
// modules read which key and how. Add new keys here as they're confirmed, not speculatively.
export interface SubscriptionPerks {
  platformFeeDiscountPercent?: number;
  featuredListings?: boolean;
  prioritySupport?: boolean;
  profileBadge?: string;
}

export interface PublicSubscriptionPlan {
  id: string;
  audience: SubscriptionAudience;
  tier: string;
  name: string;
  description: string;
  priceGel: number;
  billingPeriodDays: number;
  perks: SubscriptionPerks;
  sortOrder: number;
}

export interface PublicUserSubscription {
  id: string;
  plan: PublicSubscriptionPlan;
  status: SubscriptionStatus;
  currentPeriodEnd: string;
  cancelAtPeriodEnd: boolean;
  // True when an admin granted this subscription manually: no BOG card on file, never auto-renews,
  // simply expires at `currentPeriodEnd`.
  isGranted: boolean;
  createdAt: string;
}

// What the admin plan-management list returns — PublicSubscriptionPlan plus isActive, since an
// admin needs to see (and toggle) inactive plans too, unlike the public browse endpoint which only
// ever returns active ones.
export interface AdminSubscriptionPlanSummary extends PublicSubscriptionPlan {
  isActive: boolean;
}

// Admin view of a user's live/past subscription — PublicUserSubscription plus who owns it.
export interface AdminUserSubscriptionSummary extends PublicUserSubscription {
  user: { id: string; username: string; email: string };
}

// --- Community / site-shell shapes (backend/src/community/) ---
// Real replacements for the static prototype's client-side counters: "N online" in the sidebar,
// per-game listing counts on the home grid and marketplace menu, and the profile dropdown's
// "Wave rank" tier — all computed server-side from real rows, never randomised.

export interface OnlineStats {
  // Distinct accounts that made an authenticated request in the last ONLINE_WINDOW_MINUTES.
  count: number;
}

export interface GameListingCount {
  gameId: string;
  slug: string;
  name: string;
  activeListingCount: number;
  iconUrl: string | null;
  coverUrl: string | null;
  tileUrl: string | null;
}

export interface WaveRank {
  score: number; // 0..1000
  tierIndex: number; // 0..9, index into WAVE_RANK_TIERS
  name: string;
  nextName: string;
  level: number; // tierIndex + 1
  progressToNext: number; // 0..100
}

// Same tier names/thresholds as the prototype's profile-nav.js `waveRanks`.
export const WAVE_RANK_TIERS: ReadonlyArray<readonly [string, number]> = [
  ['Wave Spark', 0], ['Wave Scout', 70], ['Wave Rider', 140], ['Wave Surfer', 220],
  ['Wave Breaker', 320], ['Wave Current', 440], ['Wave Captain', 580],
  ['Wave Vanguard', 720], ['Wave Legend', 860], ['Wave Apex', 1000],
];

// Marketplace position of each seller (GET /stats/seller-ranks) — the prototype's
// getMarketplaceSellerWaveRank order: completed sales, then reviews, then active listings, then
// average rating. Keyed by username; sellers with no activity are absent ("unranked").
export type SellerRanks = Record<string, number>;
