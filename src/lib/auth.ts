import { createHmac, scryptSync, timingSafeEqual } from "node:crypto";
import { adminUsername, sessionSecret } from "./config";

const COOKIE_NAME = "gunpla_admin_session";
const ONE_DAY = 60 * 60 * 24;

function encode(value: string | Buffer) {
  return Buffer.from(value).toString("base64url");
}

function sign(payload: string) {
  return createHmac("sha256", sessionSecret()).update(payload).digest("base64url");
}

function readCookie(request: Request, name: string) {
  const cookie = request.headers.get("cookie") || "";
  for (const part of cookie.split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) return rest.join("=");
  }
  return null;
}

export function verifyAdminPassword(username: string, password: string) {
  if (username !== adminUsername()) return false;
  const stored = process.env.ADMIN_PASSWORD_HASH || "";
  const [algorithm, salt, expected] = stored.split("$");
  if (algorithm !== "scrypt" || !salt || !expected) return false;
  const actual = scryptSync(password, Buffer.from(salt, "base64url"), 64);
  const expectedBuffer = Buffer.from(expected, "base64url");
  return actual.length === expectedBuffer.length && timingSafeEqual(actual, expectedBuffer);
}

export function createSessionCookie() {
  const payload = encode(JSON.stringify({ sub: adminUsername(), exp: Math.floor(Date.now() / 1000) + ONE_DAY }));
  const token = `${payload}.${sign(payload)}`;
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${COOKIE_NAME}=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${ONE_DAY}${secure}`;
}

export function clearSessionCookie() {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0${secure}`;
}

export function isAdmin(request: Request) {
  const token = readCookie(request, COOKIE_NAME);
  if (!token) return false;
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return false;
  const expected = sign(payload);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return false;
  try {
    const value = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    return value.sub === adminUsername() && Number(value.exp) > Math.floor(Date.now() / 1000);
  } catch {
    return false;
  }
}

export function isSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  try {
    const requestUrl = new URL(request.url);
    const forwardedHost = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
    const forwardedProtocol = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
    const expectedHost = forwardedHost || request.headers.get("host") || requestUrl.host;
    const expectedProtocol = forwardedProtocol || requestUrl.protocol.replace(":", "");
    const supplied = new URL(origin);
    return supplied.host === expectedHost && supplied.protocol === `${expectedProtocol}:`;
  } catch {
    return false;
  }
}

export function checkAdminConfiguration() {
  sessionSecret();
  const [algorithm, salt, expected] = (process.env.ADMIN_PASSWORD_HASH || "").split("$");
  if (algorithm !== "scrypt" || !salt || !expected) {
    throw new Error("ADMIN_PASSWORD_HASH is missing or invalid");
  }
}
