import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import * as jose from "jose";
import type { User } from "../../drizzle/schema";
import { getUserById } from "../db";
import { ENV } from "./env";

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: User | null;
};

const SESSION_COOKIE = "aegis_session";

export async function createContext(
  opts: CreateExpressContextOptions
): Promise<TrpcContext> {
  let user: User | null = null;

  try {
    const raw = opts.req.headers.cookie ?? "";
    const cookies = Object.fromEntries(
      raw.split(";").map((c) => {
        const [k, ...v] = c.trim().split("=");
        return [k.trim(), decodeURIComponent(v.join("="))];
      })
    );
    const token = cookies[SESSION_COOKIE];
    if (token) {
      const secret = new TextEncoder().encode(ENV.cookieSecret);
      const { payload } = await jose.jwtVerify(token, secret);
      const userId = payload.sub ? parseInt(payload.sub, 10) : null;
      if (userId) {
        user = await getUserById(userId);
      }
    }
  } catch {
    user = null;
  }

  return { req: opts.req, res: opts.res, user };
}
