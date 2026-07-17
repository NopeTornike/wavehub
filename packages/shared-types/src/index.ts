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
}

export interface AuthMeResponse {
  user: PublicUser;
}
