import type { APIRoute } from "astro";
import { getImage } from "../../../lib/database";
import { validIdentifier } from "../../../lib/images";
import { fetchObject } from "../../../lib/storage";

export const prerender = false;

export const GET: APIRoute = async ({ params, request }) => {
  const imageId = params.id || "";
  if (!validIdentifier(imageId)) return new Response("Not found", { status: 404 });
  try {
    const record = await getImage(imageId);
    if (!record) return new Response("Not found", { status: 404 });
    const object = await fetchObject(record.object_key);
    if (!object.Body) return new Response("Not found", { status: 404 });
    const headers = new Headers({
      "content-type": object.ContentType || record.content_type,
      "cache-control": "private, max-age=300",
      "x-content-type-options": "nosniff",
    });
    if (object.ContentLength) headers.set("content-length", String(object.ContentLength));
    if (object.ETag) headers.set("etag", object.ETag);
    if (request.headers.get("if-none-match") === object.ETag) return new Response(null, { status: 304, headers });
    return new Response(object.Body.transformToWebStream(), { headers });
  } catch (error) {
    console.error("Public image read failed", error);
    return new Response("Image temporarily unavailable", { status: 503 });
  }
};
