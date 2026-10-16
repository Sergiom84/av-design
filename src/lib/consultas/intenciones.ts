import { MOTOR_CONSULTA, type ClasificacionConsulta } from './modelo';
export const EJEMPLOS_CONSULTA = ['¿Qué medidas tiene esta sala?', '¿Qué equipos hay?', '¿Qué conecta HD-1000?', '¿Cuántos metros calcula?', '¿Qué material necesita?', 'Buscar pantallas de mis marcas', '¿Qué documentos puedo abrir?', 'Preparar informe de estado actual'] as const;
const excluir = /\b(?:costes?|precios?|cuesta\w*|vale[n]?|presupuest\w*|tarifas?|salarios?|n[oó]minas?|beneficios?|ingresos?|m[aá]rgenes?|impuestos?|pagos?|facturas?|rentabilidad|sustituy\w*|sustitu\w*|equivalen\w*|reemplaz\w*|compr[ae]\w*|elimin[ae]\w*|borr[ae]\w*|quita\w*|a[ñn]ade\w*|modifica\w*|mueve\w*|instal[ae]\w*|configur[ae]\w*|recomienda\w*|garant[ií]\w*|compatible\w*|contrase[ñn]\w*|salario\w*|credencial\w*|ayer|antes|hist[oó]rico|stock|existencias?|reservas?|carga|almac[eé]n|sql|select|insert|delete|update|drop|ejecuta\w*)\b/u;
/** Diccionario cerrado local-1. No resuelve entidades por parecido ni ejecuta el texto. */
export function clasificarConsulta(pregunta: string): ClasificacionConsulta {
    const t = pregunta.normalize('NFC').toLocaleLowerCase('es').trim();
    const r = (intent: ClasificacionConsulta['intent'], motivo?: string): ClasificacionConsulta => ({ motor: MOTOR_CONSULTA, intent, ...(motivo ? { motivo } : {}) });
    if (excluir.test(t))
        return r('no_disponible', 'La consulta local sólo muestra datos técnicos registrados. Separa las preguntas y usa la pantalla correspondiente para operaciones, stock o valoraciones.');
    if (/\b(?:lo anterior|aquello|esa respuesta|el anterior)\b/u.test(t))
        return r('no_disponible', 'Cada pregunta es independiente. Indica la consulta completa y su ámbito.');
    const encontrados: ClasificacionConsulta['intent'][] = [];
    if (/\binformes?\b/u.test(t)) {
        if (!/\bestado actual\b/u.test(t) || /\b(?:semanal|mensual|movimientos|rango|desde|hasta)\b/u.test(t))
            return r('no_disponible', 'Indica informe de estado actual para preparar su ámbito y período actual. Para otro informe, abre Informes y elige definición, período y formato.');
        encontrados.push('informe');
    }
    else if (/\b(?:documentos?|documentaci[oó]n|pdf)\b/u.test(t))
        encontrados.push('documentos');
    else if (/\b(?:necesita|necesidad|material(?:es)?|bom)\b/u.test(t))
        encontrados.push('necesidad');
    else if (/\b(?:cat[aá]logo|buscar|busca|marcas?|ficha)\b/u.test(t))
        encontrados.push('catalogo');
    else {
        if (/\b(?:metros?|longitud(?:es)?|calcula|cableado)\b/u.test(t))
            encontrados.push('cables');
        else if (/\b(?:conecta|conexiones?|puertos?|cables?)\b/u.test(t))
            encontrados.push('conexiones');
        if (/\b(?:medidas?|dimensiones?|largo|ancho|alto|mesa)\b/u.test(t))
            encontrados.push('medidas');
        if (/\b(?:equipos?|equipamiento)\b/u.test(t))
            encontrados.push('equipos');
    }
    if (encontrados.length !== 1)
        return r('no_disponible', encontrados.length ? 'Separa la pregunta: medidas, equipos, conexiones o metros.' : 'Elige medidas, equipos, conexiones, metros, material, catálogo, documentos o informes del ámbito elegido.');
    const intent = encontrados[0];
    const codigos = pregunta.match(/\b[A-ZÁÉÍÓÚÑ]{2,6}-[1-9]\d{3,}\b/gu) ?? [];
    if (codigos.length > 1)
        return r('no_disponible', 'Indica un único identificador de cable.');
    return { ...r(intent), ...(intent === 'conexiones' && codigos[0] ? { cableId: codigos[0] } : {}) };
}
