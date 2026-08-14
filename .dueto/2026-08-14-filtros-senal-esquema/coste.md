# Coste del ciclo

| Paso | Modelo | Esfuerzo | Duración | Tokens | Nota |
|---|---|---|---|---|---|
| Plan (1) | gpt-5.6-sol | high | ~11 min | sin registrar | Enrutado incorrecto: por la regla actual este encargo es `terra` + medium. El proceso se detuvo tras escribir `plan.json`, antes de la línea de resumen de tokens. |
| Auditoría (1) | gpt-5.6-terra | medium | 118 s | tokens used 68.529 | Veredicto `aprobado`, sin hallazgos, preguntas ni notas fuera de alcance. Una sola vuelta. |

## Aprendizajes de este ciclo

- El plan se lanza siempre en segundo plano: con esfuerzo alto supera el tope de
  una ejecución síncrona.
- Hay que capturar la línea `tokens used` que imprime `codex exec` al terminar.
  Detener el proceso antes de tiempo la pierde.
- La auditoría con `terra` + medium costó 118 s y 68.529 tokens frente a los
  ~11 min del plan con `sol` + high: el enrutado por tamaño del diff se sostiene.
- Un veredicto `aprobado` no cierra nada por sí solo. Lo que cierra esta unidad
  son los 497 tests en verde, el `tsc` limpio, el `build` en 0 y las dos
  mutaciones probadas (`'use client'` y el `senal=` del helper) que sí hacen
  caer sus pruebas.
