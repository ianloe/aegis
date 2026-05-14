// Production stub — setupVite is never called in production.
// This file exists so the build can reference the symbol without bundling
// the real vite.ts (which imports vite, @vitejs/plugin-react, etc.)
import type { Express } from "express";
import type { Server } from "http";

export async function setupVite(_app: Express, _server: Server): Promise<void> {
  throw new Error("setupVite must not be called in production");
}
