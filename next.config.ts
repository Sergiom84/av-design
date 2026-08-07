import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // La ficha de sala son cinco rutas anidadas: con esto un enlace roto a una
  // pestaña lo caza `next build`, no un técnico en la obra.
  typedRoutes: true,
};

export default nextConfig;
