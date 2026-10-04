import type { APIRoute } from "astro";
import { checkDatabase } from "../lib/database";
import { checkStorage } from "../lib/storage";
import { checkAdminConfiguration } from "../lib/auth";

export const prerender = false;

export const GET: APIRoute = async () => {
  const checks: Record<string, string> = {};
  try {
    await checkDatabase();
    checks.database = "ready";
    await checkStorage();
    checks.storage = "ready";
    checkAdminConfiguration();
    checks.admin = "ready";
    return Response.json({ status: "ready", checks });
  } catch (error) {
    console.error("Readiness check failed", error);
    return Response.json({ status: "not_ready", checks }, { status: 503 });
  }
};
