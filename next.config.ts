import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Explicitly expose server-side env vars for Route Handlers (Turbopack compatibility)
  env: {
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  },
};

export default nextConfig;
