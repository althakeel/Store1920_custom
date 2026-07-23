/**
 * @deprecated Prefer `@/lib/apiSecurity` (`checkRateLimit`, `getClientIp`).
 * Kept for backward-compatible imports.
 */
export {
  checkRateLimit as rateLimit,
  getClientIp,
  checkRateLimit,
} from '@/lib/apiSecurity';
