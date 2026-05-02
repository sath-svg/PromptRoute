export const PMTPK_API = "https://api.pmtpk.com";
export const CONVEX_URL = "https://determined-lark-313.convex.site";
export const DESKTOP_AUTH_URL = "https://pmtpk.com/desktop-auth";

export const FREE_CHAT_LIMIT = 3;
export const PRO_CHAT_LIMIT = 200;
export const STUDIO_CHAT_LIMIT = 2000;

export type Tier = "free" | "pro" | "studio";

export function chatLimitFor(tier: Tier): number {
  if (tier === "studio") return STUDIO_CHAT_LIMIT;
  if (tier === "pro") return PRO_CHAT_LIMIT;
  return FREE_CHAT_LIMIT;
}
