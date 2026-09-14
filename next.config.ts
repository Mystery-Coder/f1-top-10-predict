import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["192.168.0.171", "192.168.*.*", "10.0.*.*"],
};

export default nextConfig;
