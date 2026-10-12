# L2B · Revisión independiente del radio Plano

Ronda 2, 08/09/2026: **aprobado el cierre de los dos hallazgos de este radio**.
No aprueba L2B completo, SQL, copias ni el recorrido real de navegador.

Artefactos: `plano-editor.ts/test` y `editor-plano-sala.tsx/test`, contra el contrato
`l2b-contrato-integracion.md`. En ronda 1 se revisaron también lectores comunes,
panel de rutas, inspector de toma y formulario de bocas.

1. Cambiar solo aforo, o recortar las dimensiones de la sala, conserva Z desconocida
   de una roseta parcial. El recorte de XY continúa funcionando.
2. Un rechazo inválido seguido de props con versión nueva conserva el borrador.
   La adopción automática exige ausencia de cambios y de guardado en curso;
   recargar expresamente después de un conflicto sigue siendo una decisión aparte.

Reproducción independiente en copia aislada: ambas regresiones pasan, 2/2, salida 0.
Revertir exclusivamente la corrección de altura produce 1 fallo/1 aprobada;
revertir exclusivamente la protección del borrador produce 1 fallo/1 aprobada.
Ambos mutantes salen 1 por AssertionError de la invariante correspondiente.

Copias y logs: `output/revisor-l2b-r2-9f2a0afc1db744ceb9bd3a987c85019a/`.
La última copia conserva el mutante de rechazo para inspección; el árbol de trabajo
no se modificó durante las reproducciones. No hubo BD, Git o producción.

En ronda 1 se reprodujeron 165/165 pruebas existentes, crudo
`output/plan40-20260908-083450/revisor-l2b-plano-completo.log`; los dos defectos se
detectaron mediante reproducciones adicionales, no mediante consenso del revisor.
