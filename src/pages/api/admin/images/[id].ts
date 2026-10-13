import type { APIRoute } from "astro";
import { getImage, removeImage } from "../../../../lib/database";
import { isSameOrigin } from "../../../../lib/auth";
import { validIdentifier } from "../../../../lib/images";
import { deleteObject } from "../../../../lib/storage";

export const prerender = false;

export const DELETE: APIRoute = async ({ params, request }) => {
  if (!isSameOrigin(request)) return Response.json({ error: "Invalid request origin" }, { status: 403 });
  const imageId = params.id || "";
  if (!validIdentifier(imageId)) return Response.json({ error: "Invalid image identifier" }, { status: 400 });
  try {
    const current = await getImage(imageId);
    if (!current) return Response.json({ error: "Image not found" }, { status: 404 });
    await removeImage(imageId);
    await deleteObject(current.object_key).catch((error) => console.error("Orphaned image object", error));
    return Response.json({ ok: true, removed: true });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Image removal failed" }, { status: 500 });
  }
};
