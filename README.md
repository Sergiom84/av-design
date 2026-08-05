# AV_design

Aplicación interna del departamento de Audiovisuales para diseñar salas,
**calcular cuántos metros de cable hacen falta** y sacar la lista de material de
una instalación.

Nace de tres problemas concretos: falta material, nadie ha calculado el cable, y
no hay un stock actualizado.

---

## Puesta en marcha

```bash
npm install
```

### 1 · Base de datos

Postgres en Docker. Un solo comando levanta el contenedor, crea las tablas y
carga el catálogo y las plantillas:

```bash
npm run db:reset
```

Por separado: `db:up` (contenedor) · `db:migrate` (`db/schema.sql`) ·
`db:seed` (`db/seed.sql`) · `db:down` (parar).

### 2 · Variables de entorno

```bash
cp .env.example .env.local
```

`DATABASE_URL` ya viene apuntando al contenedor local. Sin esa variable la
aplicación arranca igual y muestra una pantalla con los pasos pendientes, en vez
de romperse.

### 3 · Arrancar

```bash
npm run dev
```

### Migrar a Supabase más adelante

Supabase también es Postgres, así que basta con:

1. Cambiar `DATABASE_URL` por la cadena de conexión del proyecto.
2. Aplicar `db/schema.sql` y `db/seed.sql` en su SQL Editor.
3. Aplicar `db/politicas-supabase.sql`, que añade la tabla de perfiles, el alta
   automática de usuarios y las políticas RLS por rol (TEI, AV, técnico).

Ese fichero no se aplica en local porque depende del esquema `auth`, que solo
existe en Supabase.

---

## Cómo se usa

1. **Plantillas** — rellenas una sola vez las medidas de cada tipología
   (`SALA TP · aforo 8`, `ULTRALIGERA QR · aforo 4`…). Las plantillas y su
   equipamiento salen de vuestro inventario: la primera representa 144 salas
   reales.
2. **Salas** — creas una sala desde su plantilla. Hereda medidas y equipamiento;
   corriges solo lo que cambie.
3. **Equipos y conexiones** — colocas cada equipo con su posición en la sala y
   defines qué conecta con qué.
4. **Resultado** — metros por tirada, desglosados en subida, recorrido
   horizontal, bajada y holguras; y la lista de material con las bobinas o
   latiguillos a pedir.

---

## El cálculo

```
longitud = recorrido por la ruta + holgura origen + holgura destino (+ margen %)
```

- El **recorrido** nunca es la línea recta: va por falso techo, canaleta o suelo
  técnico, con tramos ortogonales. La canaleta rodea por el perímetro.
- Las **holguras** siguen el criterio del departamento: 20–50 cm en el extremo
  que acaba en pantalla, ~10 cm si acaba en proyector. El resto se configura en
  `/parametros`.
- La **canalización** se dimensiona para 3 cables: el previsto más un RJ45 y un
  HDMI de reserva.

Todo esto es lógica pura en `src/lib/calculo-cable.ts`, con 20 pruebas:

```bash
npm test
```

---

## Catálogo

Los CSV de `data/` son la fuente editable. Se abren en Excel, se corrigen y se
regenera el seed:

```bash
npm run seed
```

| Fichero | Qué es |
|---|---|
| `data/catalogo-equipos.csv` | 1.071 referencias extraídas del inventario real, con unidades instaladas |
| `data/catalogo-cable.csv` | Catálogo base de cable y consumibles. **Faltan precios y proveedores: hay que rellenarlos** |
| `data/plantillas-salas.csv` | 17 plantillas con su equipamiento estándar |

---

## Despliegue

Render, desde GitHub. La configuración está en `render.yaml`. `DATABASE_URL` se
carga como variable de entorno del servicio, nunca en el repositorio.

El plan gratuito de Render duerme el servicio tras 15 minutos y el primer acceso
tarda unos segundos. Si la app se va a abrir desde obra, conviene plan de pago.

---

## Documentación

| | |
|---|---|
| `docs/01-analisis-xtenav.md` | Análisis de XTEN-AV: qué copiar y qué no resuelve |
| `docs/02-propuesta-app.md` | Alcance, arquitectura y fases |
| `docs/03-datos-reales.md` | Extracción del inventario: tipologías, plantillas, huecos |
| `design-system/MASTER.md` | Sistema visual |
| `AGENTS.md` | Contrato del proyecto para agentes |
