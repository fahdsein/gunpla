import type { APIRoute } from "astro";
import { getGunpla, removeGunpla, saveGunpla } from "../../../../lib/database";
import { isSameOrigin } from "../../../../lib/auth";
import { validIdentifier } from "../../../../lib/images";
import { deleteObject } from "../../../../lib/storage";
import { validateGunpla } from "../../../../lib/validation";

export const prerender = false;

const fail = (error: unknown, status = 400) =>
  Response.json({ error: error instanceof Error ? error.message : "Unexpected error" }, { status });

export const PUT: APIRoute = async ({ params, request }) => {
  if (!isSameOrigin(request)) return fail("Invalid request origin", 403);
  const id = params.id || "";
  if (!validIdentifier(id)) return fail("Invalid Gunpla identifier");
  try {
    if (!(await getGunpla(id))) return fail("Gunpla not found", 404);
    const record = validateGunpla({ ...(await request.json()), id });
    return Response.json({ ok: true, gunpla: await saveGunpla(record) });
  } catch (error) {
    return fail(error);
  }
};

export const DELETE: APIRoute = async ({ params, request }) => {
  if (!isSameOrigin(request)) return fail("Invalid request origin", 403);
  const id = params.id || "";
  if (!validIdentifier(id)) return fail("Invalid Gunpla identifier");
  try {
    const result = await removeGunpla(id);
    if (!result.removed) return fail("Gunpla not found", 404);
    const deleted = await Promise.allSettled(result.images.map((image) => deleteObject(image.object_key)));
    const storageFailures = deleted.filter((item) => item.status === "rejected").length;
    return Response.json({ ok: true, removed: true, images: result.images.length, storageFailures });
  } catch (error) {
    return fail(error, 500);
  }
};
