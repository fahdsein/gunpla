import type { APIRoute } from "astro";
import { importGunpla } from "../../../../lib/database";
import { isSameOrigin } from "../../../../lib/auth";
import { validateImport } from "../../../../lib/validation";

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  if (!isSameOrigin(request)) return Response.json({ error: "Invalid request origin" }, { status: 403 });
  try {
    const input = validateImport(await request.json());
    const records = await importGunpla(input);
    return Response.json({ ok: true, imported: input.length, total: records.length, strategy: "merge" });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Import failed" }, { status: 400 });
  }
};
