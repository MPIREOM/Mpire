import type { NextConfig } from "next";
import { readFileSync } from "fs";
import { join } from "path";

// Read .env.local at build time so non-NEXT_PUBLIC_ vars can be inlined
// (the runtime environment at /var/task does not have access to .env.local)
function readEnvLocal(key: string): string {
  try {
    const content = readFileSync(join(process.cwd(), ".env.local"), "utf8");
    const match = content.match(new RegExp(`^${key}=(.+)$`, "m"));
    if (match) return match[1].trim();
  } catch {}
  return process.env[key] ?? "";
}

const nextConfig: NextConfig = {
  env: {
    SUPABASE_SERVICE_ROLE_KEY: readEnvLocal("SUPABASE_SERVICE_ROLE_KEY"),
  },
};

export default nextConfig;
