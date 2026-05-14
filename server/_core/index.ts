import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic } from "./static";
import { getAgentByApiKey, createAuditLog } from "../db";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function startServer() {
  const app = express();
  const server = createServer(app);
  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );
  // ─── Public REST ingest endpoint ─────────────────────────────────────────────
  // POST /api/ingest/audit-log
  // Authorization: Bearer <agent-api-key>
  app.post("/api/ingest/audit-log", async (req, res) => {
    try {
      const auth = req.headers.authorization ?? "";
      if (!auth.startsWith("Bearer ")) {
        res.status(401).json({ error: "Missing or invalid Authorization header" });
        return;
      }
      const apiKey = auth.slice(7).trim();
      const agent = await getAgentByApiKey(apiKey);
      if (!agent) {
        res.status(403).json({ error: "Invalid API key" });
        return;
      }
      const { actionType, summary, dataTier, userName, metadata } = req.body ?? {};
      if (!actionType || !summary) {
        res.status(400).json({ error: "actionType and summary are required" });
        return;
      }
      await createAuditLog({
        tenantId: agent.tenantId,
        agentId: agent.id,
        agentName: agent.name,
        userName: userName ?? "external",
        actionType,
        summary,
        dataTier: dataTier ?? agent.maxDataTier,
      });
      res.status(201).json({ ok: true });
    } catch (err) {
      console.error("[ingest] error:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    const { setupVite } = await import("./vite");
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });
}

startServer().catch(console.error);
