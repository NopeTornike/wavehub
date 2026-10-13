// Used to validate redirect-target URLs (BOG's successUrl/failUrl) against our own frontend's
// origin before accepting them — an unrestricted redirect target on a post-payment flow is an
// open-redirect that doubles as a plausible phishing setup ("you paid, now here's your receipt" on
// an attacker's page). Returns true/false rather than throwing so callers decide how to surface it.
export function isSameOriginAsFrontend(url: string, frontendUrl: string): boolean {
  try {
    return new URL(url).origin === new URL(frontendUrl).origin;
  } catch {
    return false;
  }
}
