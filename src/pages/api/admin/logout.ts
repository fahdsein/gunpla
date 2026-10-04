import type { APIRoute } from "astro";
import { clearSessionCookie, isSameOrigin } from "../../../lib/auth";

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  if (!isSameOrigin(request)) return new Response("Invalid request origin", { status: 403 });
  return new Response(null, {
    status: 303,
    headers: { location: "/admin/login", "set-cookie": clearSessionCookie() },
  });
};
