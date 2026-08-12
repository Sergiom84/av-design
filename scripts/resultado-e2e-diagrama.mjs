export function resultadoE2eAprobado(codigo, estadisticas) {
  return (
    codigo === 0 &&
    Number.isInteger(estadisticas?.expected) &&
    estadisticas.expected > 0 &&
    estadisticas.skipped === 0 &&
    estadisticas.unexpected === 0 &&
    estadisticas.flaky === 0
  );
}
