#!/usr/bin/env node
/**
 * Prints the SHA-256 hash of a password for VITE_MASTER_ADMIN_PASSWORD_HASH.
 *
 *   npm run admin:hash -- "your password"
 *
 * The password is read from argv, never written to disk. The hash only ever
 * identifies the password inside the admin sign-in check, so keep it in the
 * deployment environment rather than in the repository.
 */
import { createHash } from "node:crypto";

const password = process.argv.slice(2).join(" ");

if (!password) {
  console.error('Usage: npm run admin:hash -- "your password"');
  process.exit(1);
}

if (password.length < 10) {
  console.error("Use at least 10 characters — the panel rejects shorter passwords.");
  process.exit(1);
}

console.log(createHash("sha256").update(password, "utf8").digest("hex"));
