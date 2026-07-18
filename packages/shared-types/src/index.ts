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
