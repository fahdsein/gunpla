import { defineMiddleware } from "astro:middleware";
import { isAdmin } from "./lib/auth";

export const onRequest = defineMiddleware(async (context, next) => {
  const path = context.url.pathname;
  const adminPage = path === "/admin" || path.startsWith("/admin/");
  const adminApi = path.startsWith("/api/admin/");
  const publicAuthRoute = path === "/admin/login" || path === "/api/admin/login";

  if ((adminPage || adminApi) && !publicAuthRoute && !isAdmin(context.request)) {
    if (adminApi) return Response.json({ error: "Authentication required" }, { status: 401 });
    return context.redirect("/admin/login", 303);
  }

  return next();
});
