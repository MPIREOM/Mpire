import type { NextConfig } from "next";
import { loadEnvConfig } from "@next/env";

// Ensure .env.local is loaded before config evaluation (Turbopack compatibility)
loadEnvConfig(process.cwd());

const nextConfig: NextConfig = {
  env: {
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  },
};

export default nextConfig;
