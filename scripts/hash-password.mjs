import { randomBytes, scryptSync } from "node:crypto";
import { argv, exit } from "node:process";

const password = argv[2];
if (!password || password.length < 12) {
  console.error("Usage: npm run hash-password -- \"a-password-with-at-least-12-characters\"");
  exit(1);
}

const salt = randomBytes(16);
const hash = scryptSync(password, salt, 64);
console.log(`scrypt$${salt.toString("base64url")}$${hash.toString("base64url")}`);
