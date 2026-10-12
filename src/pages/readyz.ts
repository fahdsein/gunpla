import type { APIRoute } from "astro";
import { checkDatabase } from "../lib/database";
import { checkStorage } from "../lib/storage";
import { checkAdminConfiguration } from "../lib/auth";

export const prerender = false;

export const GET: APIRoute = async () => {
  const checks: Record<"database" | "storage" | "admin", "ready" | "unavailable"> = {
    database: "unavailable",
    storage: "unavailable",
    admin: "unavailable",
  };

  try {
    await checkDatabase();
    checks.database = "ready";
  } catch (error) {
    console.error("Database readiness check failed", error);
  }

  try {
    await checkStorage();
    checks.storage = "ready";
  } catch (error) {
    console.error("Object-storage readiness check failed", error);
  }

  try {
    checkAdminConfiguration();
    checks.admin = "ready";
  } catch (error) {
    console.error("Admin-configuration readiness check failed", error);
  }

  const ready = Object.values(checks).every((value) => value === "ready");
  return Response.json(
    { status: ready ? "ready" : "not_ready", checks },
    {
      status: ready ? 200 : 503,
      headers: { "cache-control": "no-store, max-age=0", pragma: "no-cache" },
    },
  );
};
