import type { APIRoute } from "astro";
import { saveGunpla } from "../../../../lib/database";
import { isSameOrigin } from "../../../../lib/auth";
import { validateGunpla } from "../../../../lib/validation";

export const prerender = false;

const fail = (error: unknown, status = 400) =>
  Response.json({ error: error instanceof Error ? error.message : "Unexpected error" }, { status });

export const POST: APIRoute = async ({ request }) => {
  if (!isSameOrigin(request)) return fail("Invalid request origin", 403);
  try {
    const record = await saveGunpla(validateGunpla(await request.json(), { allowId: false }));
    return Response.json({ ok: true, gunpla: record }, { status: 201 });
  } catch (error) {
    return fail(error);
  }
};
