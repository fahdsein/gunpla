import type { APIRoute } from "astro";
import { createSessionCookie, isSameOrigin, verifyAdminPassword } from "../../../lib/auth";

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  if (!isSameOrigin(request)) return new Response("Invalid request origin", { status: 403 });
  const form = await request.formData();
  const username = String(form.get("username") || "");
  const password = String(form.get("password") || "");

  if (!verifyAdminPassword(username, password)) {
    return new Response(null, { status: 303, headers: { location: "/admin/login?error=1" } });
  }

  return new Response(null, {
    status: 303,
    headers: { location: "/admin", "set-cookie": createSessionCookie() },
  });
};
