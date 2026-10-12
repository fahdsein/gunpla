import type { APIRoute } from "astro";

export const prerender = false;
export const GET: APIRoute = () => Response.json(
  { status: "ok", service: "gunpla-archive" },
  { headers: { "cache-control": "no-store, max-age=0", pragma: "no-cache" } },
);
