# Prompt para continuar en una conversación nueva

Copia todo lo que hay entre las líneas.

---

Trabajo en `C:\Users\sergi\Desktop\Aplicaciones\AV_design`. Lee primero
`AGENTS.md` y luego `docs/01-analisis-xtenav.md`, `docs/02-propuesta-app.md` y
`docs/03-datos-reales.md`. No hace falta que vuelvas a mirar la web de XTEN-AV:
ya está analizada en el documento 01.

**Qué es.** Aplicación interna del departamento de Audiovisuales que llevo. La
hicimos porque en las instalaciones fallan siempre tres cosas: falta material,
nadie ha calculado cuánto cable hace falta, y no hay stock actualizado. Va a
sustituir por completo a XTEN-AV, que era la referencia.

**Estado.** Fase 1 terminada y funcionando: catálogo navegable por marca,
plantillas de sala, salas con medidas, cálculo de metros de cable y lista de
material. Repositorio privado `Sergiom84/AV_design`, rama `main`.

**Cómo se arranca:**

```bash
npm install
npm run db:reset   # Postgres en Docker + esquema + catálogo sembrado
npm run dev
```

**Lo que ya está hecho, para que no lo repitas:**

- Next.js 16 (App Router) + TypeScript + Tailwind 4. Postgres en Docker
  (`docker-compose.yml`), acceso con `postgres.js` en `src/lib/db.ts`. Se
  migrará a Supabase cuando esté maduro: bastará con cambiar `DATABASE_URL` y
  aplicar además `db/politicas-supabase.sql`.
- Despliegue previsto en Render desde GitHub (`render.yaml`). Todavía no se ha
  desplegado.
- El cálculo de cable está en `src/lib/calculo-cable.ts`, es lógica pura y tiene
  20 pruebas (`npm test`). Recorrido por falso techo, canaleta (rodeando por el
  perímetro) o suelo técnico, nunca en línea recta, más las holguras de mi
  criterio: 20–50 cm en el extremo que va a pantalla, unos 10 cm si va a
  proyector. La canalización se dimensiona para 3 cables, el previsto más un
  RJ45 y un HDMI de reserva. Las holguras se editan en `/parametros`, no están
  cableadas en el código.
- El catálogo salió de nuestro inventario real: 839 referencias, 149 marcas,
  5.685 unidades instaladas. Ya está limpio de duplicados y erratas
  (`scripts/normalizacion.mjs`, informe en `docs/04-limpieza-catalogo.md`).
- 16 plantillas de sala deducidas de 390 salas reales. La más repetida,
  `SALA TP · aforo 8`, representa 144 salas.
- El aspecto lo manda `design-system/MASTER.md`: Cormorant Garamond +
  JetBrains Mono, sin emojis.

**Lo que quiero hacer ahora** (por orden, dime si ves mejor otro orden):

1. Cargar los precios. Tengo una lista de precios de equipos y otra de cable y
   consumibles; te las paso y las importas contra el catálogo cruzando por
   marca y modelo, sin teclear nada a mano.
2. Rellenar las medidas de las plantillas de sala. Las cinco primeras cubren
   268 de las 390 salas, así que empezamos por ahí.
3. Fase 2: stock de almacén, reservas de material para una obra, lista de
   compra por proveedor y lista de carga para la furgoneta.

**Cosas pendientes que ya conozco:**

- 41 referencias quedaron en una sección que no era evidente al fundir
  duplicados. Están listadas al final de `docs/04-limpieza-catalogo.md` y se
  corrigen desde la ficha de cada artículo.
- Falta comprobar la app en móvil. Las tablas llevan scroll horizontal pero no
  se ha verificado en un teléfono.
- La holgura de rack (1,0 m) y la de caja de conexiones (0,5 m) las puso Claude,
  no yo. Hay que revisarlas.
- Falta validar la fórmula del cable contra una instalación real: lo que se
  pidió y lo que de verdad hizo falta.
- Los `.xlsx` de inventario están en `docs/` pero fuera del repositorio a
  propósito: llevan IPs, MAC y números de serie de la red corporativa.

**Cómo quiero que trabajes:** en español, el dominio también en español (sala,
tipología, aforo, caja de conexiones, canaleta, falso techo, tirada, holgura,
bobina, latiguillo). Verifica lo que construyas antes de decir que funciona, y
si rompes algo dímelo. Los CSV de `data/` son la fuente editable del catálogo:
se corrigen y se regenera con `npm run seed`; `db/seed.sql` no se toca a mano.

---
