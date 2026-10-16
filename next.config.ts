import type { NextConfig } from "next";

const archivosParser = [
  'src/lib/requisitos/parser-worker.mjs',
  'node_modules/pdfjs-dist/legacy/build/*.mjs',
  'node_modules/@napi-rs/canvas/**/*',
  'node_modules/@napi-rs/canvas-*/**/*',
];
const nextConfig: NextConfig = {
  // El gate E2E de Diagrama puede convivir con el servidor de desarrollo que
  // usa una persona: un distDir separado evita compartir su lock y su caché.
  ...(process.env.NEXT_DIST_DIR ? { distDir: process.env.NEXT_DIST_DIR } : {}),
  // La ficha de sala son cinco rutas anidadas: con esto un enlace roto a una
  // pestaña lo caza `next build`, no un técnico en la obra.
  typedRoutes: true,
  serverExternalPackages: ['pdfkit', 'pdfjs-dist'],
  outputFileTracingIncludes: {
    '/api/requisitos': archivosParser,
    '/api/requisitos/**': archivosParser,
  },
};

export default nextConfig;
