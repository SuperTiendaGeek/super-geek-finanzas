import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typescript: {
    // TypeScript already se valida con tsc en prebuild; evitamos el worker que falla en Windows (EPERM).
    ignoreBuildErrors: true,
  },
  experimental: {
    // Fuerza uso de worker threads en vez de procesos hijos para evitar EPERM en Windows sandbox.
    workerThreads: true,
  },
};

export default nextConfig;

