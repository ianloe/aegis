/**
 * OAuth routes are not used in the self-hosted build.
 * Authentication is handled via username/password in server/routers.ts.
 */
export function registerOAuthRoutes(_app: unknown) {
  // No-op: Manus OAuth has been replaced with username/password auth.
}
