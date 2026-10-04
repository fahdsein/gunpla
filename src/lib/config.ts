const required = (name: string) => {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
};

export const enabled = (value: string | undefined) => /^(1|true|yes|on)$/i.test(value || "");

export const databaseUrl = () => required("DATABASE_URL");

export const storageConfig = () => {
  const accessKeyId = process.env.S3_ACCESS_KEY_ID || process.env.S3_ACCESS_KEY || process.env.AWS_ACCESS_KEY_ID;
  const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY || process.env.S3_SECRET_KEY || process.env.AWS_SECRET_ACCESS_KEY;
  if (!accessKeyId?.trim()) throw new Error("S3_ACCESS_KEY_ID (or a supported access-key alias) is required");
  if (!secretAccessKey?.trim()) throw new Error("S3_SECRET_ACCESS_KEY (or a supported secret-key alias) is required");
  return {
    endpoint: required("S3_ENDPOINT"),
    region: process.env.S3_REGION || "us-east-1",
    bucket: required("S3_BUCKET"),
    prefix: (process.env.S3_PREFIX || "gunpla").replace(/^\/+|\/+$/g, ""),
    forcePathStyle: enabled(process.env.S3_FORCE_PATH_STYLE),
    accessKeyId: accessKeyId.trim(),
    secretAccessKey: secretAccessKey.trim(),
    sessionToken: process.env.S3_SESSION_TOKEN || process.env.AWS_SESSION_TOKEN,
  };
};

export const maximumImageBytes = () => {
  const parsed = Number(process.env.MAX_IMAGE_BYTES || 5 * 1024 * 1024);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 5 * 1024 * 1024;
};

export const adminUsername = () => process.env.ADMIN_USERNAME?.trim() || "admin";

export const sessionSecret = () => {
  const secret = required("SESSION_SECRET");
  if (secret.length < 32) throw new Error("SESSION_SECRET must contain at least 32 characters");
  return secret;
};
