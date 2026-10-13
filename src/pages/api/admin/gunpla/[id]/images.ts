import type { APIRoute } from "astro";
import { randomUUID } from "node:crypto";
import { getGunpla, listImages, removeImage, saveImage } from "../../../../../lib/database";
import { isSameOrigin } from "../../../../../lib/auth";
import { cleanAltText, validateImage, validIdentifier } from "../../../../../lib/images";
import { buildObjectKey, deleteObject, uploadObject } from "../../../../../lib/storage";

export const prerender = false;
const MAX_IMAGES = 7;

const fail = (error: unknown, status = 400) =>
  Response.json({ error: error instanceof Error ? error.message : "Unexpected error" }, { status });

export const POST: APIRoute = async ({ params, request }) => {
  if (!isSameOrigin(request)) return fail("Invalid request origin", 403);
  const gunplaId = params.id || "";
  if (!validIdentifier(gunplaId)) return fail("Invalid Gunpla identifier");

  const uploadedKeys: string[] = [];
  const savedIds: string[] = [];
  try {
    const gunpla = await getGunpla(gunplaId);
    if (!gunpla) return fail("Gunpla not found", 404);
    const current = await listImages(gunplaId);
    const form = await request.formData();
    const files = form.getAll("images").filter((value): value is File => value instanceof File && value.size > 0);
    if (!files.length) return fail("Select at least one image");
    if (current.length + files.length > MAX_IMAGES) {
      return fail(`Each Gunpla can contain at most ${MAX_IMAGES} images. ${MAX_IMAGES - current.length} slot(s) remain.`);
    }
    const baseAlt = cleanAltText(form.get("altText"));
    const validated = await Promise.all(files.map(validateImage));
    const records = [];

    for (let index = 0; index < validated.length; index += 1) {
      const file = validated[index];
      const imageId = randomUUID();
      const objectKey = buildObjectKey(gunplaId, file.extension);
      const etag = await uploadObject(objectKey, file.bytes, file.contentType);
      uploadedKeys.push(objectKey);
      const record = await saveImage({
        image_id: imageId,
        gunpla_id: gunplaId,
        position: current.length + index + 1,
        object_key: objectKey,
        content_type: file.contentType,
        alt_text: validated.length === 1 ? baseAlt : `${baseAlt} (${index + 1})`,
        size_bytes: file.bytes.byteLength,
        etag,
      });
      savedIds.push(imageId);
      records.push(record);
    }
    return Response.json({ ok: true, images: records, total: current.length + records.length }, { status: 201 });
  } catch (error) {
    await Promise.allSettled(savedIds.map((imageId) => removeImage(imageId)));
    await Promise.allSettled(uploadedKeys.map((key) => deleteObject(key)));
    console.error("Gallery upload failed", error);
    return fail(error, 500);
  }
};
