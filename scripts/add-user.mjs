/**
 * Add user to Supabase Auth
 *
 * Usage:
 *   node scripts/add-user.mjs
 *
 * Requires NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY
 * in .env.local (or set as environment variables).
 *
 * For admin operations (bypassing email confirmation, listing users),
 * also set SUPABASE_SERVICE_ROLE_KEY.
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Load .env.local
function loadEnv() {
  try {
    const envPath = resolve(__dirname, "..", ".env.local");
    const content = readFileSync(envPath, "utf-8");
    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eqIdx = trimmed.indexOf("=");
      if (eqIdx === -1) continue;
      const key = trimmed.slice(0, eqIdx).trim();
      const value = trimmed.slice(eqIdx + 1).trim();
      if (!process.env[key]) process.env[key] = value;
    }
  } catch {
    // .env.local not found, rely on environment variables
  }
}

loadEnv();

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL) {
  console.error("ERROR: NEXT_PUBLIC_SUPABASE_URL is not set");
  process.exit(1);
}

// User to add
const USER_EMAIL = "almuhannad@mpireom.com";
const USER_PASSWORD = "724293";

async function addUserWithServiceRole() {
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Check if user already exists
  console.log(`Checking if user ${USER_EMAIL} exists...`);
  const { data: existingUsers, error: listError } =
    await supabase.auth.admin.listUsers();

  if (listError) {
    console.error("Error listing users:", listError.message);
    process.exit(1);
  }

  const existing = existingUsers.users.find((u) => u.email === USER_EMAIL);
  if (existing) {
    console.log(`User ${USER_EMAIL} already exists (id: ${existing.id})`);
    console.log(`\nUse this UUID in seed.sql: ${existing.id}`);
    return existing;
  }

  // Create user via admin API (bypasses email confirmation)
  console.log(`Creating user ${USER_EMAIL}...`);
  const { data, error } = await supabase.auth.admin.createUser({
    email: USER_EMAIL,
    password: USER_PASSWORD,
    email_confirm: true, // auto-confirm email
  });

  if (error) {
    console.error("Error creating user:", error.message);
    process.exit(1);
  }

  console.log(`User created successfully!`);
  console.log(`  Email: ${data.user.email}`);
  console.log(`  ID:    ${data.user.id}`);
  console.log(`\nUse this UUID in seed.sql: ${data.user.id}`);
  return data.user;
}

async function addUserWithAnonKey() {
  const supabase = createClient(SUPABASE_URL, ANON_KEY);

  console.log(`Signing up user ${USER_EMAIL}...`);
  const { data, error } = await supabase.auth.signUp({
    email: USER_EMAIL,
    password: USER_PASSWORD,
  });

  if (error) {
    if (error.message.includes("already registered")) {
      console.log(`User ${USER_EMAIL} is already registered.`);
      console.log(
        "To get the user ID, use the Supabase Dashboard or set SUPABASE_SERVICE_ROLE_KEY."
      );
      return null;
    }
    console.error("Error signing up user:", error.message);
    process.exit(1);
  }

  if (data.user) {
    console.log(`User signed up successfully!`);
    console.log(`  Email: ${data.user.email}`);
    console.log(`  ID:    ${data.user.id}`);
    if (data.user.identities?.length === 0) {
      console.log(`\nNote: User already exists (returned empty identities).`);
    } else {
      console.log(`\nUse this UUID in seed.sql: ${data.user.id}`);
    }
    if (!data.session) {
      console.log(
        "\nNote: Email confirmation may be required before the user can log in."
      );
      console.log(
        "To auto-confirm, set SUPABASE_SERVICE_ROLE_KEY and re-run this script."
      );
    }
  }

  return data.user;
}

async function main() {
  console.log("=== MPIRE User Setup ===\n");

  if (SERVICE_ROLE_KEY) {
    console.log("Using service role key (admin API)...\n");
    await addUserWithServiceRole();
  } else if (ANON_KEY) {
    console.log("Using anon key (signUp API)...");
    console.log(
      "Tip: Set SUPABASE_SERVICE_ROLE_KEY for admin operations.\n"
    );
    await addUserWithAnonKey();
  } else {
    console.error(
      "ERROR: Neither SUPABASE_SERVICE_ROLE_KEY nor NEXT_PUBLIC_SUPABASE_ANON_KEY is set"
    );
    process.exit(1);
  }
}

main();
