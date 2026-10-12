# L1B · hechos técnicos y presentación

08/09/2026. Entrega para revisión independiente; no autoaprobada.

## Contrato y archivos

Modelo puro por hecho y fuente, con estados verificado/parcial/sin documentar.
Sin modificar catálogo, generador, lectores, páginas ni BD.

- `src/lib/ficha-tecnica.ts`: `esquemaDatoTecnico`, tipo `DatoTecnico`,
  `presentarDatoTecnico` y etiquetas `ESTADO_DATO_TECNICO`/`TIPO_DATO_TECNICO`.
- `src/lib/ficha-tecnica.test.ts`: siete pruebas de dominio.
- `src/components/catalogo/ficha-tecnica.tsx`: `FichaTecnica({datos})`, lista
  dentro de la Tarjeta existente con estado, descripción y fuente por fila.
- `src/components/catalogo/ficha-tecnica.test.tsx`: dos pruebas de render DOM.

Integración prevista: el lector valida con `esquemaDatoTecnico.parse`/`safeParse`
antes de entregar datos al componente. Este componente recibe datos tipados y
no realiza consultas ni edición. La integración queda en manos del director.

## Criterios y evidencia

El discriminador `tipo` verifica seis estructuras independientes; objetos con
campos ajenos se rechazan. Verificado/parcial exigen valor, URL HTTPS sin
credenciales, documento, apartado y fecha real de calendario. Sin documentar
exige valor nulo; procedencia opcional sigue validándose si existe. Fechas como
2026-02-29/2026-04-31 se rechazan; 2024-02-29 se acepta.

Cantidad/total son enteros positivos; longitud positiva o desconocida. Vatios
no negativos o desconocidos. La ausencia nunca se convierte en captación
integrada ni compatibilidad. `captacion: externa` se presenta como necesidad de
micrófono del codec; no es el perfil de un micrófono periférico.

Comandos ejecutados:

```powershell
node --import tsx --test src/lib/ficha-tecnica.test.ts src/components/catalogo/ficha-tecnica.test.tsx
npx.cmd eslint src/lib/ficha-tecnica.ts src/lib/ficha-tecnica.test.ts src/components/catalogo/ficha-tecnica.tsx src/components/catalogo/ficha-tecnica.test.tsx
npx.cmd tsc --noEmit --incremental false
```

Pruebas: **9/9 correctas**, cero omitidas. Lint y tipos: salida 0 en la primera
ejecución. Se repitieron tras reutilizar las etiquetas de señal/sentido existentes.
Log de pruebas: `output/plan40-20260908-083450/l1b-puro-tests.log`.
La prueba DOM comprueba estado y fuente de cada fila, URL, fecha semántica,
ausencia de formularios/controles de edición y mensaje de ficha vacía.

## Alcance de comprobación y reversión

Leída guía local Next `use-client.md`: componente estático sin estado ni API del
navegador, por lo que no añade directiva de cliente. Reutiliza Tarjeta, tokens
actuales, etiquetas de señal/sentido y foco visible; no introduce animación.
Render estático verificado, recorrido visual desktop/móvil pendiente de integrar.
No se acredita ausencia de overflow real con la prueba de DOM.

Es una capacidad nueva, no un arreglo con versión anterior funcional para una
reversión causal. No se atribuyen fallos de mutación no ejecutados. La revisión
recibe este contrato y los archivos/pruebas. No hubo cambios de infraestructura.
Para revertir, retirar exclusivamente estos cuatro archivos nuevos antes de su
integración; nunca restaurar otros archivos del árbol compartido.

Decisión solicitada: revisar validación y presentación contra contrato e indicar
cambios o aprobación explícita antes de integrar lectores/páginas.
