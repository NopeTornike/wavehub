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
  // A redeemed promo code (marketing/): spendable credit, never withdrawable earnings.
  PromoCredit = 'promo_credit',
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
  TournamentTeamAdded = 'tournament_team_added',
  SessionStarting = 'session_starting',
  SessionStarted = 'session_started',
  SessionAwaitingConfirmation = 'session_awaiting_confirmation',
  SessionReviewRequest = 'session_review_request',
  Welcome = 'welcome',
  // 2026-10-02 (client: "notifications on welcome, purchase, etc."): metadata.link is an internal
  // path the notification opens.
  OrderPlaced = 'order_placed',
  WalletTopup = 'wallet_topup',
  WalletAdjusted = 'wallet_adjusted',
  ListingApproved = 'listing_approved',
  ListingRejected = 'listing_rejected',
  CoachApproved = 'coach_approved',
  CoachRejected = 'coach_rejected',
  NewFollower = 'new_follower',
  BadgeGranted = 'badge_granted',
  // An official warning from Trust & Safety (trust/).
  AccountWarning = 'account_warning',
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
  avatarUrl: string | null;
  // Carries the Verified badge (badges/) — set on the listing detail; false on browse cards.
  verified: boolean;
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
  kind?: 'account' | 'skin' | 'item';
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
  // Example answer shown in the empty input (seller-entered, optional).
  placeholder?: string;
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
  // Client feedback #9 (2026-10-04): people are shown by name + photo, with the verified mark.
  avatarUrl: string | null;
  verified: boolean;
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
  platformFeePercent: number;
  sellerPayoutWaveCoin: number;
  // What the buyer paid (price + fee when the buyer carried the fee — orders since 2026-10-03).
  buyerTotalWaveCoin: number;
  feePaidBy: 'buyer' | 'seller';
  cancelledAt: string | null;
  cancellationReason: string | null;
  revisionReason: string | null;
  deliveryFiles: PublicOrderDeliveryFile[];
}

// GET /order-quote — what buying a listing (or one service package) costs right now: the price,
// the marketplace fee the buyer pays on top, and the total debited. The fee % is the platform fee
// after the seller's membership discount.
export interface OrderQuote {
  priceWaveCoin: number;
  feePercent: number;
  feeWaveCoin: number;
  totalWaveCoin: number;
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
  // Client feedback #13: the other person by name + photo, not just @username.
  otherUser: { id: string; username: string; firstName: string; lastName: string; avatarUrl: string | null };
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
  // Shown by name + photo like every other conversation (client 2026-10-07).
  senderFirstName: string;
  senderLastName: string;
  senderAvatarUrl: string | null;
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
  // Design 2026-10-04 (client #9): the reviewer by name + photo + online dot + rank.
  buyer: { id: string; username: string; firstName: string; lastName: string; avatarUrl: string | null; online: boolean };
  // The reviewer's current Wave rank tier name (CommunityService#waveRank), shown under the name.
  buyerRank: string;
  // Who replies (the seller), for the nested reply card.
  seller: { id: string; username: string; firstName: string; lastName: string; avatarUrl: string | null; rank: string };
  // 👍 counts (review_likes) on the review and on the seller's reply.
  likeCount: number;
  replyLikeCount: number;
}

// GET /me/following, /me/followers (client feedback #15).
export interface PublicFollowEntry {
  id: string;
  username: string;
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
  followedAt: string;
}

// GET /me/review-likes?listingId — which reviews / replies on that listing the viewer has liked.
export interface MyReviewLikes {
  review: string[];
  reply: string[];
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

// A platform coaching package (coaching_packages — Starter / Growth / Elite, the same for every
// coach, edited by staff only). Booking one snapshots its name; price is whole GEL (₾ is UI only).
export interface PublicCoachPackage {
  id: string;
  key: string; // starter | growth | elite — the card's accent follows it
  name: string;
  tagline: string; // the bold question line
  description: string;
  features: string[]; // "რას მოიცავს"
  // Sessions in the package (each durationMinutes long).
  sessionsCount: number;
  durationMinutes: number;
  priceWaveCoin: number;
}

// GET admin/coaching-packages — includes inactive ones.
export interface AdminCoachingPackage extends PublicCoachPackage {
  active: boolean;
  sortOrder: number;
  updatedAt: string;
}

export interface PublicCoachDetail extends PublicCoachSummary {
  bio: string;
  videoUrl: string | null;
  // An uploaded intro video (MP4/WebM) — shown instead of `videoUrl` when present.
  videoFileUrl: string | null;
  packages: PublicCoachPackage[];
  // Questions the buyer answers when booking (same shape as a service listing's requirements).
  bookingQuestions: RequirementField[];
  // Working hours (DEFAULT_COACH_AVAILABILITY until the coach sets their own).
  availability: CoachAvailability;
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
  // The student by name + photo (client feedback #9), like product reviews. Optional so the
  // session-review responses that only carry the username still fit this shape.
  buyerFirstName?: string;
  buyerLastName?: string;
  buyerAvatarUrl?: string | null;
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
  videoFileUrl: string | null;
  bookingQuestions: RequirementField[];
  // null = not set yet (DEFAULT_COACH_AVAILABILITY applies).
  availability: CoachAvailability | null;
}

// --- Coach working hours (coaches.availability, 2026-10-02) ---
// Weekly ranges in Tbilisi local time (UTC+4, no DST) plus whole days off. The backend validates
// every booked slot with `coachAvailabilityProblem` and the booking calendar offers the starts from
// `coachAvailabilityStarts`, so both sides apply exactly the same rules.
export interface CoachAvailabilityRange {
  day: number; // 0 = Sunday … 6 = Saturday (Date#getUTCDay of the Tbilisi local date)
  from: number; // minutes after local midnight, multiple of 30, 0–1410
  to: number; // minutes after local midnight, multiple of 30, 30–1440 (ranges never cross midnight)
}
export interface CoachAvailability {
  weekly: CoachAvailabilityRange[];
  daysOff: string[]; // YYYY-MM-DD (Tbilisi dates)
  noticeHours: number; // minimum hours between booking and the session start, 0–72
}
// Used while a coach hasn't set hours yet: every day 10:00–24:00, an hour's notice.
export const DEFAULT_COACH_AVAILABILITY: CoachAvailability = {
  weekly: [0, 1, 2, 3, 4, 5, 6].map((day) => ({ day, from: 600, to: 1440 })),
  daysOff: [],
  noticeHours: 1,
};
// Sessions can be booked at most this far ahead.
export const COACH_BOOKING_HORIZON_DAYS = 60;
const COACH_TZ_OFFSET_MS = 4 * 3600_000;

// Tbilisi local date (YYYY-MM-DD), weekday and minutes-after-midnight of an instant.
export function tbilisiLocal(ms: number): { date: string; day: number; minutes: number } {
  const local = new Date(ms + COACH_TZ_OFFSET_MS);
  return { date: local.toISOString().slice(0, 10), day: local.getUTCDay(), minutes: local.getUTCHours() * 60 + local.getUTCMinutes() };
}

// The instant of a Tbilisi local date + minutes after midnight.
export function tbilisiInstant(date: string, minutes: number): number {
  return Date.parse(`${date}T00:00:00Z`) - COACH_TZ_OFFSET_MS + minutes * 60_000;
}

// Whether [startMs, startMs + durationMinutes) lies inside working hours. A session may run past
// midnight when the next day's hours continue from 00:00 (e.g. Fri 22:00–24:00 + Sat 00:00–02:00).
function coachHoursCover(availability: CoachAvailability, startMs: number, durationMinutes: number): boolean {
  const endMs = startMs + durationMinutes * 60_000;
  let cursor = startMs;
  while (cursor < endMs) {
    const local = tbilisiLocal(cursor);
    if (availability.daysOff.includes(local.date)) return false;
    const range = availability.weekly.find((r) => r.day === local.day && r.from <= local.minutes && local.minutes < r.to);
    if (!range) return false;
    cursor = tbilisiInstant(local.date, range.to);
  }
  return true;
}

// Why a session starting at `startMs` for `durationMinutes` can't be booked now, or null if it can.
export function coachAvailabilityProblem(
  availability: CoachAvailability,
  startMs: number,
  durationMinutes: number,
  nowMs: number,
): 'notice' | 'horizon' | 'day_off' | 'hours' | null {
  if (startMs <= nowMs || startMs < nowMs + availability.noticeHours * 3600_000) return 'notice';
  if (startMs > nowMs + COACH_BOOKING_HORIZON_DAYS * 86400_000) return 'horizon';
  if (availability.daysOff.includes(tbilisiLocal(startMs).date)) return 'day_off';
  return coachHoursCover(availability, startMs, durationMinutes) ? null : 'hours';
}

// Bookable start instants on a Tbilisi date for a session of `durationMinutes`: every hour from
// each range's start while the whole session still fits (before notice/busy filtering).
export function coachAvailabilityStarts(availability: CoachAvailability, date: string, durationMinutes: number): number[] {
  if (availability.daysOff.includes(date)) return [];
  const day = new Date(`${date}T12:00:00Z`).getUTCDay();
  const starts = new Set<number>();
  for (const r of availability.weekly) {
    if (r.day !== day) continue;
    for (let m = r.from; m < r.to; m += 60) {
      const at = tbilisiInstant(date, m);
      if (coachHoursCover(availability, at, durationMinutes)) starts.add(at);
    }
  }
  return [...starts].sort((a, b) => a - b);
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
  // Shown in the home page's coach section (staff pick).
  isFeatured: boolean;
  rejectionReason: string | null;
  createdAt: string;
}

// --- Support ticketing (backend/src/support/) ---

export interface PublicTicketMessage {
  id: string;
  senderId: string;
  senderUsername: string;
  // The sender by name + photo (client 2026-10-07). `fromSupport` = written by staff (anyone but the
  // ticket's requester) — shown as "WaveHubX Support — First Last"; no role is exposed.
  senderFirstName: string;
  senderLastName: string;
  senderAvatarUrl: string | null;
  fromSupport: boolean;
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
  // Admin-chosen "Featured Items" (home page rail). Optional so older callers keep compiling.
  isFeatured?: boolean;
  priceWaveCoin?: number | null;
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

// GET reviews/order/:orderId — the order's review for its buyer/seller (null before one exists).
export interface OrderReviewState {
  review: PublicReview | null;
  status: ReviewStatus | null;
}

// GET reviews/pending — the caller's completed orders that still have no review.
export interface PendingReview {
  orderId: string;
  orderNumber: string;
  listingId: string;
  listingTitle: string;
  completedAt: string | null;
}

// GET admin/reviews — every product (order) and coach (session) review, for staff moderation and
// Super Admin editing (backend/src/reviews/admin-reviews.controller.ts).
export interface AdminReviewRow {
  id: string;
  kind: 'product' | 'coach';
  rating: number;
  body: string | null;
  // Product reviews: published | hidden | reported | deleted. Coach reviews are always published.
  status: ReviewStatus;
  subjectTitle: string; // listing title, or "@coach" for a coach review
  subjectHref: string;
  buyerUsername: string;
  sellerUsername: string; // the seller, or the coach's username
  sellerReply: string | null;
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
  // Coaching sessions' fee (from the coach), separate from the marketplace fee since 2026-10-04.
  coachingFeePercent: number;
  minWithdrawalWaveCoin: number;
  maintenanceMode: boolean;
  supportPermissions: SupportPermissions;
  updatedAt: string;
}

// Powers SPECIFICATION.md §5.13.6 withholds from Support by default, switchable by Super Admin
// (Admin → Platform settings). Support can never use them on themselves or on other staff.
export interface SupportPermissions {
  walletAdjust: boolean;
  walletAdjustMax: number;
  suspendUsers: boolean;
}

// GET admin/platform-settings/my-permissions — what the calling staff member may do among those
// powers (Super Admin: everything, no cap).
export interface StaffPermissions {
  walletAdjust: boolean;
  walletAdjustMax: number | null;
  suspendUsers: boolean;
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
    latest: Array<{ rating: number; body: string | null; buyerUsername: string; buyerFirstName: string; buyerLastName: string; buyerAvatarUrl: string | null; createdAt: string }>;
  };
  // Earned achievements only — see backend/src/follows/CLAUDE.md for each rule.
  // The owner's badge set (BadgeKey — icon at badgeIcon(key)) plus tournament champion/finalist.
  badges: Array<{ key: string; label: string; description?: string }>;
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
  // Email copies of important notifications (default on).
  emailNotifications: boolean;
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
  // Both sides confirmed the start.
  InProgress = 'in_progress',
  // The coach marked it done; waiting for the student (auto-confirms after 48h).
  AwaitingConfirmation = 'awaiting_confirmation',
  Completed = 'completed',
  Cancelled = 'cancelled',
  // A participant opened a dispute (in progress / awaiting confirmation): frozen until a Super Admin
  // refunds the student (→ cancelled) or pays the coach (→ completed).
  Disputed = 'disputed',
}

export type SessionDisputeResolution = 'refund_student' | 'pay_coach';

export interface PublicSessionDisputeMessage {
  id: string;
  senderUsername: string;
  // Participants by name + photo; staff stay anonymous ("WaveHubX Support", empty names).
  senderFirstName: string;
  senderLastName: string;
  senderAvatarUrl: string | null;
  isStaff: boolean;
  body: string | null;
  fileUrl: string | null;
  fileType: string | null;
  createdAt: string;
}

// GET coaching-sessions/:id/dispute → { dispute } (participants); admin views add the session facts.
export interface PublicSessionDispute {
  id: string;
  sessionId: string;
  openedByUsername: string;
  reason: string;
  status: 'open' | 'resolved';
  resolution: SessionDisputeResolution | null;
  resolutionNote: string | null;
  createdAt: string;
  resolvedAt: string | null;
  messages: PublicSessionDisputeMessage[];
}

export interface AdminSessionDisputeSummary {
  id: string;
  sessionId: string;
  coachUsername: string;
  buyerUsername: string;
  openedByUsername: string;
  priceWaveCoin: number;
  scheduledAt: string;
  reason: string;
  status: 'open' | 'resolved';
  createdAt: string;
}

export interface PublicCoachingSession {
  id: string;
  coachId: string;
  coachUserId: string;
  coachUsername: string;
  coachFirstName: string;
  coachLastName: string;
  // Client feedback #9: both sides shown by name + photo (+ verified mark for the coach).
  coachAvatarUrl: string | null;
  coachVerified: boolean;
  buyerId: string;
  buyerUsername: string;
  buyerFirstName: string;
  buyerLastName: string;
  buyerAvatarUrl: string | null;
  scheduledAt: string;
  durationMinutes: number;
  priceWaveCoin: number;
  buyerMessage: string | null;
  // Booked from a coach package (name snapshot) and the buyer's pre-booking answers.
  packageName: string | null;
  answers: Record<string, string> | null;
  // 6-step booking (2026-10-02): sessions booked together share a bookingGroupId.
  bookingGroupId: string | null;
  goal: string | null;
  challenges: string | null;
  discord: string | null;
  // Lifecycle v2: start/finish confirmations and the deadlines the reminder sweep enforces.
  coachStartConfirmedAt: string | null;
  buyerStartConfirmedAt: string | null;
  startedAt: string | null;
  coachCompletedAt: string | null;
  completedAt: string | null;
  // Until when the start can be confirmed (then it auto-cancels with a refund), and when an
  // unanswered "coach marked done" auto-confirms.
  startDeadline: string;
  autoConfirmAt: string | null;
  // Fee split (snapshot at booking): what the platform keeps and what the coach receives.
  platformFeePercent: number;
  platformFeeWaveCoin: number;
  coachPayoutWaveCoin: number;
  status: CoachingSessionStatus;
  // The server's clock when this was sent — the page times the start window from it, not from the
  // device clock (a phone set to the wrong time showed a Start button the server then refused).
  serverNow: string;
  createdAt: string;
}

// Tournaments — a genuinely new feature, not in the original product spec (confirmed by grep —
// see LAUNCH_PLAN.md §2b). Scoped down from origin/main's static prototype to the structural core:
// admin posts a tournament, users register, no automated bracket/matchmaking/prize-payout — the
// same "ship the core, flag automation as a deliberate follow-up" pattern this repo has used
// throughout (see backend/src/withdrawals/CLAUDE.md's manual-payout precedent).
export enum TournamentStatus {
  // Not published: hidden from every public list/page/endpoint; only staff see and manage it.
  Draft = 'draft',
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
  // The linked WaveHub accounts, roster order (captain first). Teams registered before 2026-10-01
  // list only their captain here; their other players exist only as `members` names.
  players: TournamentTeamPlayer[];
  // Discord invite/username (client feedback #6) — only in staff views and the caller's own team.
  discord?: string | null;
  status: TournamentTeamStatus;
  createdAt: string;
}

export interface TournamentTeamPlayer {
  username: string;
  avatarUrl: string | null;
  inGameName: string;
  isCaptain: boolean;
  // Only in staff views and the caller's own team (GET me/tournaments) — never on the public Teams tab.
  inGameId?: string | null;
}

// GET users/search?q= — public username search (topbar / marketplace). Only what a public profile
// already shows.
export interface PublicUserSearchResult {
  id: string;
  username: string;
  avatarUrl: string | null;
}

// GET tournaments/player-lookup — the captain checks a teammate's account before registering.
export interface TournamentPlayerLookup {
  id: string;
  username: string;
  avatarUrl: string | null;
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

// The facts the prototype's tournament page shows, in its order, with Georgian labels (EN mode
// translates them through frontend/lib/i18n-ka-en.app.json).
export const TOURNAMENT_DETAIL_KEYS: ReadonlyArray<readonly [key: string, label: string]> = [
  ['format', 'ფორმატი'],
  ['mode', 'რეჟიმი'],
  ['region', 'რეგიონი / სერვერი'],
  ['platform', 'პლატფორმა'],
  ['checkInTime', 'Check-in დრო'],
  ['startTime', 'დაწყების დრო'],
  ['endDate', 'დასრულების თარიღი (YYYY-MM-DD)'],
  ['registrationDeadline', 'რეგისტრაციის ბოლო ვადა'],
  ['entryFee', 'შესვლის საფასური'],
  ['teamSize', 'გუნდის ზომა'],
  ['minimumRank', 'მინიმალური რანკი'],
  ['bracketType', 'ბრეკეტის ტიპი'],
  ['matches', 'მატჩები'],
  ['whoCanJoin', 'ვის შეუძლია მონაწილეობა'],
  ['communication', 'კომუნიკაცია'],
  ['organizer', 'ორგანიზატორი'],
  ['slogan', 'სლოგანი'],
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

// Tier names (owner's list, 2026-10-02) with the prototype's thresholds (profile-nav.js
// `waveRanks`). Each tier has an icon: /assets/rank-icons/rank-<n>.png, n = tier index + 1
// (Tornike's rank-icon art, in the same order).
export const WAVE_RANK_TIERS: ReadonlyArray<readonly [string, number]> = [
  ['Starter', 0], ['Bronze Core', 70], ['Silver Vanguard', 140], ['Gold Sovereign', 220],
  ['Platinum Sentinel', 320], ['Diamond Ascendant', 440], ['Obsidian Warlord', 580],
  ['Crimson Monarch', 720], ['Mythic Prime', 860], ['WaveHub Apex', 1000],
];

// The prototype's previous tier names, so an old string still finds its icon.
const LEGACY_RANK_NAMES = ['Wave Spark', 'Wave Scout', 'Wave Rider', 'Wave Surfer', 'Wave Breaker', 'Wave Current', 'Wave Captain', 'Wave Vanguard', 'Wave Legend', 'Wave Apex'];

// Icon path for a tier name (falls back to the first tier's icon).
export function waveRankIcon(name: string | null | undefined): string {
  const value = String(name ?? '').trim().toLowerCase();
  let index = WAVE_RANK_TIERS.findIndex(([tier]) => tier.toLowerCase() === value);
  if (index < 0) index = LEGACY_RANK_NAMES.findIndex((tier) => tier.toLowerCase() === value);
  return `/assets/rank-icons/rank-${Math.max(0, index) + 1}.png`;
}

// Marketplace position of each seller (GET /stats/seller-ranks) — the prototype's
// getMarketplaceSellerWaveRank order: completed sales, then reviews, then active listings, then
// average rating. Keyed by username; sellers with no activity are absent ("unranked").
export type SellerRanks = Record<string, number>;

// GET /admin/analytics?from=YYYY-MM-DD&to=YYYY-MM-DD — Super Admin only
// (backend/src/analytics/). Money is WaveCoin, which is 1:1 GEL; subscription and top-up
// amounts are real GEL charged through BOG. Every figure is computed from real rows.
export interface AnalyticsSalesSummary {
  orders: number; // paid orders placed in range (excludes unpaid/expired)
  gmv: number; // value of those orders that weren't cancelled/refunded
  completedOrders: number;
  completedValue: number;
  platformFees: number; // earned on orders completed in range
  refundedOrders: number;
  refundedValue: number;
  inEscrow: number; // right now: orders paid but not yet completed/refunded
  averageOrder: number;
}

export interface AnalyticsBreakdownRow {
  key: string;
  label: string;
  orders: number;
  gmv: number;
  platformFees: number;
}

export interface AnalyticsTopListing {
  listingId: string;
  title: string;
  type: ListingType;
  game: string | null;
  seller: string;
  orders: number;
  gmv: number;
}

export interface AnalyticsTopSeller {
  username: string;
  orders: number;
  gmv: number;
  platformFees: number;
}

export interface AnalyticsPlanRow {
  planId: string;
  name: string;
  audience: string;
  priceGel: number;
  activeNow: number;
  newInRange: number;
  revenueGel: number;
}

export interface AnalyticsSeriesPoint {
  bucket: string; // ISO date of the bucket start
  gmv: number;
  orders: number;
  topupsGel: number;
  subscriptionsGel: number;
}

export interface AdminAnalytics {
  from: string;
  to: string;
  bucket: 'day' | 'month';
  sales: AnalyticsSalesSummary;
  byGame: AnalyticsBreakdownRow[];
  byType: AnalyticsBreakdownRow[];
  byCategory: AnalyticsBreakdownRow[];
  topListings: AnalyticsTopListing[];
  topSellers: AnalyticsTopSeller[];
  coaching: { sessions: number; completed: number; cancelled: number; value: number; platformFees: number };
  subscriptions: {
    activeNow: number;
    grantedNow: number;
    newInRange: number;
    cancelledInRange: number;
    revenueGel: number;
    monthlyRecurringGel: number; // active paid plans normalised to 30 days
    byPlan: AnalyticsPlanRow[];
  };
  money: { topups: number; topupsGel: number; withdrawalsPaid: number; withdrawalsPaidValue: number; withdrawalsPending: number; withdrawalsPendingValue: number };
  users: { total: number; newInRange: number; verifiedInRange: number; sellersWithSales: number; buyers: number };
  series: AnalyticsSeriesPoint[];
}


// --- Marketing (backend/src/marketing/): promo codes + homepage banners ---

// A promo code adds `amountWaveCoin` of spendable (never withdrawable) credit, once per account.
export interface AdminPromoCode {
  id: string;
  code: string;
  amountWaveCoin: number;
  maxRedemptions: number;
  redeemedCount: number;
  startsAt: string | null;
  expiresAt: string | null;
  active: boolean;
  note: string | null;
  createdAt: string;
}

export interface PromoRedemptionResult {
  code: string;
  amountWaveCoin: number;
  balanceAfter: number;
}

// GET banners — what the homepage shows (active, inside their date window, in order).
// Where a CMS banner shows (owner 2026-10-07: "every banner must be editable from the CMS").
// home_hero replaces the home page's top marketplace cover; home_strip is the rotating strip above
// Coaching & Tournaments; *_top banners appear at the top of that page. A placement with no live
// banner keeps its built-in art (home_hero) or shows nothing.
export enum BannerPlacement {
  HomeHero = 'home_hero',
  HomeStrip = 'home_strip',
  MarketplaceTop = 'marketplace_top',
  ServicesTop = 'services_top',
  SteamTop = 'steam_top',
  CoachingTop = 'coaching_top',
  TournamentsTop = 'tournaments_top',
}

export const BANNER_PLACEMENT_LABELS: Record<BannerPlacement, string> = {
  [BannerPlacement.HomeHero]: 'მთავარი — ზედა დიდი ბანერი',
  [BannerPlacement.HomeStrip]: 'მთავარი — შუა ზოლი',
  [BannerPlacement.MarketplaceTop]: 'მარკეტი — ზედა ბანერი',
  [BannerPlacement.ServicesTop]: 'სერვისები — ზედა ბანერი',
  [BannerPlacement.SteamTop]: 'Steam თამაშები — ზედა ბანერი',
  [BannerPlacement.CoachingTop]: 'ქოუჩინგი — ზედა ბანერი',
  [BannerPlacement.TournamentsTop]: 'ტურნირები — ზედა ბანერი',
};

export interface PublicBanner {
  id: string;
  placement: BannerPlacement;
  title: string;
  subtitle: string | null;
  imageUrl: string | null;
  linkUrl: string | null;
  buttonLabel: string | null;
}

export interface AdminBanner extends PublicBanner {
  active: boolean;
  startsAt: string | null;
  endsAt: string | null;
  sortOrder: number;
  updatedAt: string;
}

// --- Trust & Safety (backend/src/trust/) ---

export type ReportTargetType = 'user' | 'listing' | 'coach' | 'review' | 'message';
export type ReportReason = 'spam' | 'harassment' | 'fraud' | 'scam_listing' | 'fake_account' | 'offensive' | 'other';
export type ReportStatus = 'open' | 'reviewing' | 'actioned' | 'dismissed';

export interface AdminUserReport {
  id: string;
  targetType: ReportTargetType;
  targetId: string;
  targetUserId: string | null;
  targetUsername: string | null;
  targetLabel: string; // listing title, "@coach", review/message excerpt…
  targetHref: string | null;
  reporterUsername: string;
  reason: ReportReason;
  details: string | null;
  // A copy of the reported message / review text at report time (evidence).
  evidence: string | null;
  status: ReportStatus;
  staffNote: string | null;
  createdAt: string;
  handledAt: string | null;
}

export interface RiskFactor {
  key: string;
  label: string; // Georgian, shown to staff
  points: number;
}

export interface RiskAssessment {
  score: number; // 0–100
  level: 'low' | 'medium' | 'high';
  factors: RiskFactor[];
}

export interface TrustUserSummary {
  userId: string;
  username: string;
  status: UserStatus;
  flagged: boolean;
  risk: RiskAssessment;
}

export interface TrustOverview {
  openReports: number;
  reportsByReason: Array<{ reason: ReportReason; count: number }>;
  flaggedUsers: number;
  warnings30d: number;
  suspended: number;
  banned: number;
  newAccounts7d: number;
  sharedNetworkGroups: number; // networks used by 3+ accounts in 30 days
  topRisk: TrustUserSummary[];
}

export interface TrustStaffNote {
  id: string;
  kind: 'note' | 'warning' | 'flag' | 'unflag';
  body: string;
  authorUsername: string;
  createdAt: string;
}

export interface TrustUserDetail {
  userId: string;
  username: string;
  firstName: string;
  lastName: string;
  status: UserStatus;
  emailVerified: boolean;
  flagged: boolean;
  createdAt: string;
  lastSeenAt: string | null;
  risk: RiskAssessment;
  notes: TrustStaffNote[];
  // Network / device are opaque hash prefixes — raw IPs are never stored.
  logins: Array<{ at: string; success: boolean; network: string; device: string }>;
  linkedAccounts: Array<{ userId: string; username: string; status: UserStatus; sharedLogins: number }>;
  reportsAgainst: AdminUserReport[];
  reportsFiled: number;
  stats: { ordersAsBuyer: number; ordersAsSeller: number; cancelledAsSeller: number; disputesAgainst: number; promoRedemptions: number; warnings: number };
}

// --- Badges (backend/src/badges/, owner spec "WaveHubX Badge Assignment Logic", 2026-10-04) ---
// Every badge is stored once per user (user_badges, unique per key) with who/what granted it.
// mode: 'auto' = system trigger only; 'super_admin' = Super Admin only; 'admin' = authorised staff;
// 'coach' = the user's own coach (with a completed session), staff as fallback; 'auto_admin' = system
// trigger, staff may also grant.
export enum BadgeKey {
  Chosen = 'chosen',
  Staff = 'staff',
  FirstOrder = 'first-order',
  OfficialSeller = 'official-seller',
  OfficialCoach = 'official-coach',
  StrongestStudent = 'strongest-student',
  BestCoach = 'best-coach',
  Subscriber = 'subscriber',
  MaxLevel = 'max-level',
  BestSeller = 'best-seller',
  CoachChosenStudent = 'coach-chosen-student',
  Orders100 = 'orders-100',
  Verified = 'verified',
}

export type BadgeMode = 'auto' | 'super_admin' | 'admin' | 'coach' | 'auto_admin';

export const BADGE_CATALOG: Record<BadgeKey, { label: string; description: string; mode: BadgeMode }> = {
  [BadgeKey.Chosen]: { label: 'ვეივჰაბის რჩეული', description: 'WaveHubX-ის ექსკლუზიური ბეიჯი — ანიჭებს მხოლოდ Super Admin.', mode: 'super_admin' },
  [BadgeKey.Staff]: { label: 'სტაფის წევრი', description: 'WaveHubX-ის გუნდის წევრი.', mode: 'super_admin' },
  [BadgeKey.FirstOrder]: { label: 'პირველი დასრულებული შეკვეთა', description: 'პირველი წარმატებით დასრულებული შეკვეთა.', mode: 'auto' },
  [BadgeKey.OfficialSeller]: { label: 'ვეივჰაბის ოფიციალური სელერი', description: 'ადმინისტრაციის მიერ დადასტურებული გამყიდველი.', mode: 'admin' },
  [BadgeKey.OfficialCoach]: { label: 'ვეივჰაბის ოფიციალური ქოუჩი', description: 'ადმინისტრაციის მიერ დადასტურებული ქოუჩი.', mode: 'admin' },
  [BadgeKey.StrongestStudent]: { label: 'საუკეთესო სტუდენტი', description: 'ქოუჩმა საუკეთესო სტუდენტად აღიარა.', mode: 'coach' },
  [BadgeKey.BestCoach]: { label: 'საუკეთესო ქოუჩი', description: 'ადმინისტრაციის მიერ აღიარებული საუკეთესო ქოუჩი.', mode: 'admin' },
  [BadgeKey.Subscriber]: { label: 'საბსქრიბშენის წევრი', description: 'აქტიური გამოწერის მქონე წევრი.', mode: 'auto' },
  [BadgeKey.MaxLevel]: { label: 'ყველაზე მაღალი ლეველი', description: 'მიაღწია WaveHub-ის უმაღლეს რანკს.', mode: 'auto' },
  [BadgeKey.BestSeller]: { label: 'საუკეთესო სელერი', description: 'ადმინისტრაციის მიერ აღიარებული საუკეთესო გამყიდველი.', mode: 'admin' },
  [BadgeKey.CoachChosenStudent]: { label: 'ქოუჩის რჩეული სტუდენტი', description: 'ქოუჩის რჩეული სტუდენტი.', mode: 'coach' },
  [BadgeKey.Orders100]: { label: '100+ შეკვეთა', description: '100 წარმატებით დასრულებული შეკვეთა.', mode: 'auto' },
  [BadgeKey.Verified]: { label: 'ვერიფიცირებული', description: 'ვერიფიკაცია წარმატებით დასრულდა.', mode: 'auto_admin' },
};

export function badgeIcon(key: BadgeKey | string): string {
  return `/assets/badges/${key}.png`;
}

export interface PublicBadge {
  key: BadgeKey;
  label: string;
  description: string;
  grantedAt: string;
}

// Admin/coach view of one grant: who/what granted it.
export interface AdminBadgeGrant extends PublicBadge {
  source: 'system' | 'admin' | 'coach';
  grantedByUsername: string | null;
}
