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
}

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

// What ListingsService#findPublicById returns — a PublicListingSummary plus the fuller detail-page
// fields (description, packages, type-specific extras).
export interface PublicListingDetail extends PublicListingSummary {
  description: string;
  packages: PublicPackage[];
  requirementsSchema?: RequirementField[];
  faq?: FaqEntry[];
  itemAttributes?: Record<string, unknown>;
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
