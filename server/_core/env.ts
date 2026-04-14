export const ENV = {
  cookieSecret: process.env.JWT_SECRET ?? "change_me_jwt_secret",
  databaseUrl: process.env.DATABASE_URL ?? "",
  isProduction: process.env.NODE_ENV === "production",
  // Optional: LLM integration (set OPENAI_API_KEY or compatible endpoint)
  llmApiUrl: process.env.LLM_API_URL ?? "",
  llmApiKey: process.env.LLM_API_KEY ?? "",
  // Forge/storage API (used by file storage helpers)
  forgeApiUrl: process.env.FORGE_API_URL ?? process.env.BUILT_IN_FORGE_API_URL ?? "",
  forgeApiKey: process.env.FORGE_API_KEY ?? process.env.BUILT_IN_FORGE_API_KEY ?? "",
};
