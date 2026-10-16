import { ErrorPropuesta } from './modelo';
export const VARIABLES = ['propuesta.titulo', 'proyecto.nombre', 'proyecto.codigo', 'sala.nombre', 'sala.codigo', 'salas.listado', 'destinatario.nombre', 'revision.fecha'] as const;
export function validarVariables(texto: string): void {
    const resto = texto.replace(/\{\{([^{}]+)\}\}/g, (_todo, clave: string) => {
        if (!(VARIABLES as readonly string[]).includes(clave))
            throw new ErrorPropuesta(`Variable no permitida: ${clave}.`, 422);
        return '';
    });
    if (resto.includes('{{') || resto.includes('}}'))
        throw new ErrorPropuesta('Sintaxis de variable inválida.', 422);
}
export function resolverVariables(texto: string, valores: Record<string, string | null>): {
    texto: string;
    ausencias: string[];
} {
    validarVariables(texto);
    const ausencias: string[] = [];
    const resuelto = texto.replace(/\{\{([^{}]+)\}\}/g, (_todo, clave: string) => {
        const valor = valores[clave];
        if (valor === null || valor === undefined || valor === '') {
            ausencias.push(clave);
            return `[Sin dato: ${clave}]`;
        }
        return valor;
    });
    return { texto: resuelto, ausencias: [...new Set(ausencias)] };
}
