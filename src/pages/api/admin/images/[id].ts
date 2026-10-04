import type { APIRoute } from "astro";
import { getImage, removeImage, saveImage } from "../../../../lib/database";
import { isSameOrigin } from "../../../../lib/auth";
import { cleanAltText, validateImage, validGunplaId } from "../../../../lib/images";
import { buildObjectKey, deleteObject, uploadObject } from "../../../../lib/storage";

export const prerender = false;

const errorResponse = (error: unknown, status = 400) =>
  Response.json({ error: error instanceof Error ? error.message : "Unexpected error" }, { status });

export const POST: APIRoute = async ({ params, request }) => {
  if (!isSameOrigin(request)) return errorResponse("Invalid request origin", 403);
  const gunplaId = params.id || "";
  if (!validGunplaId(gunplaId)) return errorResponse("Unknown Gunpla identifier");

  try {
    const form = await request.formData();
    const file = form.get("image");
    if (!(file instanceof File)) return errorResponse("Select an image first");
    const altText = cleanAltText(form.get("altText"));
    const { bytes, contentType, extension } = await validateImage(file);
    const previous = await getImage(gunplaId);
    const objectKey = buildObjectKey(gunplaId, extension);
    const etag = await uploadObject(objectKey, bytes, contentType);

    try {
      const record = await saveImage({
        gunpla_id: gunplaId,
        object_key: objectKey,
        content_type: contentType,
        alt_text: altText,
        size_bytes: bytes.byteLength,
        etag,
      });
      if (previous?.object_key && previous.object_key !== objectKey) {
        await deleteObject(previous.object_key).catch(() => undefined);
      }
      return Response.json({ ok: true, image: record });
    } catch (error) {
      await deleteObject(objectKey).catch(() => undefined);
      throw error;
    }
  } catch (error) {
    console.error("Image upload failed", error);
    return errorResponse(error, 500);
  }
};

export const DELETE: APIRoute = async ({ params, request }) => {
  if (!isSameOrigin(request)) return errorResponse("Invalid request origin", 403);
  const gunplaId = params.id || "";
  if (!validGunplaId(gunplaId)) return errorResponse("Unknown Gunpla identifier");

  try {
    const current = await getImage(gunplaId);
    if (!current) return Response.json({ ok: true, removed: false });
    await removeImage(gunplaId);
    await deleteObject(current.object_key).catch((error) => console.error("Orphaned image object", error));
    return Response.json({ ok: true, removed: true });
  } catch (error) {
    console.error("Image deletion failed", error);
    return errorResponse(error, 500);
  }
};
