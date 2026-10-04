import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { randomUUID } from "node:crypto";
import { storageConfig } from "./config";

let client: S3Client | undefined;

function target() {
  const config = storageConfig();
  client ||= new S3Client({
    endpoint: config.endpoint,
    region: config.region,
    forcePathStyle: config.forcePathStyle,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
      sessionToken: config.sessionToken,
    },
  });
  return { client, config };
}

export function buildObjectKey(gunplaId: string, extension: string) {
  const { config } = target();
  return `${config.prefix}/${gunplaId}/${Date.now()}-${randomUUID()}.${extension}`;
}

export async function uploadObject(key: string, body: Uint8Array, contentType: string) {
  const { client, config } = target();
  const result = await client.send(new PutObjectCommand({
    Bucket: config.bucket,
    Key: key,
    Body: body,
    ContentType: contentType,
    CacheControl: "public, max-age=31536000, immutable",
  }));
  return result.ETag || null;
}

export async function fetchObject(key: string) {
  const { client, config } = target();
  return client.send(new GetObjectCommand({ Bucket: config.bucket, Key: key }));
}

export async function deleteObject(key: string) {
  const { client, config } = target();
  await client.send(new DeleteObjectCommand({ Bucket: config.bucket, Key: key }));
}

export async function checkStorage() {
  const { client, config } = target();
  await client.send(new HeadBucketCommand({ Bucket: config.bucket }));
}
