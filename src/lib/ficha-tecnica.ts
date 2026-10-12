import { z } from 'zod';
import { ETIQUETA_SENAL, ETIQUETA_SENTIDO } from './tipos';

const texto = z.string().trim().min(1);
const fechaReal = texto.refine((valor) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(valor) || Number(valor.slice(0, 4)) < 1) return false;
  const fecha = new Date(`${valor}T00:00:00.000Z`);
  return Number.isFinite(fecha.getTime()) && fecha.toISOString().slice(0, 10) === valor;
}, 'Fecha de consulta no válida');
const urlFuente = z.url().refine((valor) => {
  try {
    const url = new URL(valor);
    return url.protocol === 'https:' && !url.username && !url.password;
  } catch { return false; }
}, 'La fuente debe ser una URL HTTPS sin credenciales');
const base = {
  id: texto.optional(), articulo_id: texto.optional(), clave: texto, concepto: texto,
  estado: z.enum(['verificado', 'parcial', 'sin_documentar']),
  fuente_url: urlFuente.nullish(), documento: texto.nullish(), apartado: texto.nullish(),
  consultado_en: fechaReal.nullish(), fuente: z.enum(['csv', 'app']), puerto_id: texto.nullish(),
};
const esquemasValor = {
  microfonia: z.object({ captacion: z.enum(['integrada', 'externa', 'desconocida']) }).strict(),
  alimentacion: z.object({ descripcion: texto }).strict(),
  poe: z.object({ rol: z.enum(['pd', 'pse']), vatios: z.number().finite().nonnegative().nullable(),
    estandar: texto.nullable(), compartido: z.boolean() }).strict(),
  suministro: z.object({ referencia: texto, cantidad: z.number().int().positive(),
    longitud_m: z.number().finite().positive().nullable(), longitud_aplica: z.boolean().nullable(),
    incluido: z.boolean().nullable() }).strict(),
  puerto: z.object({ nombre: texto, total: z.number().int().positive(),
    sentido: z.enum(['entrada', 'salida', 'bidireccional', 'control']),
    senal: z.enum(['hdmi', 'red', 'usb', 'audio_linea', 'audio_altavoz', 'microfono', 'alimentacion', 'control', 'otro']),
    conector: texto.nullable() }).strict(),
  restriccion: z.object({ texto }).strict(),
};
export const esquemaDatoTecnico = z.discriminatedUnion('tipo', [
  z.object({ ...base, tipo: z.literal('microfonia'), valor: esquemasValor.microfonia.nullable() }).strict(),
  z.object({ ...base, tipo: z.literal('alimentacion'), valor: esquemasValor.alimentacion.nullable() }).strict(),
  z.object({ ...base, tipo: z.literal('poe'), valor: esquemasValor.poe.nullable() }).strict(),
  z.object({ ...base, tipo: z.literal('suministro'), valor: esquemasValor.suministro.nullable() }).strict(),
  z.object({ ...base, tipo: z.literal('puerto'), valor: esquemasValor.puerto.nullable() }).strict(),
  z.object({ ...base, tipo: z.literal('restriccion'), valor: esquemasValor.restriccion.nullable() }).strict(),
]).superRefine((dato, contexto) => {
  if (dato.tipo === 'suministro' && dato.valor?.longitud_aplica === false && dato.valor.longitud_m !== null) {
    contexto.addIssue({ code: 'custom', path: ['valor', 'longitud_m'], message: 'Una longitud no aplicable debe ser nula' });
  }
  if (dato.estado === 'sin_documentar') {
    if (dato.valor !== null) contexto.addIssue({ code: 'custom', path: ['valor'], message: 'Un dato sin documentar debe tener valor nulo' });
    return;
  }
  if (dato.valor === null) contexto.addIssue({ code: 'custom', path: ['valor'], message: 'Falta el valor documentado' });
  for (const campo of ['fuente_url', 'documento', 'apartado', 'consultado_en'] as const) {
    if (!dato[campo]) contexto.addIssue({ code: 'custom', path: [campo], message: 'Falta la procedencia del dato' });
  }
});
export type DatoTecnico = z.infer<typeof esquemaDatoTecnico>;
export const ESTADO_DATO_TECNICO = { verificado: 'Verificado', parcial: 'Parcial', sin_documentar: 'Sin documentar' } as const;
export const TIPO_DATO_TECNICO = { microfonia: 'Microfonía', alimentacion: 'Alimentación', poe: 'PoE', suministro: 'Suministro', puerto: 'Puerto', restriccion: 'Restricción' } as const;

/** La ausencia nunca acredita captación integrada ni compatibilidad. */
export function presentarDatoTecnico(dato: DatoTecnico): string {
  if (dato.estado === 'sin_documentar' || dato.valor === null) return `${dato.concepto}: sin documentar`;
  switch (dato.tipo) {
    case 'microfonia': return { integrada: 'Captación integrada', externa: 'Requiere micrófono externo', desconocida: 'Captación desconocida' }[dato.valor.captacion];
    case 'alimentacion': return dato.valor.descripcion;
    case 'restriccion': return dato.valor.texto;
    case 'poe': return [dato.valor.rol === 'pd' ? 'Recibe alimentación PoE' : 'Suministra alimentación PoE',
      dato.valor.vatios === null ? 'potencia desconocida' : `${dato.valor.vatios} W`,
      dato.valor.estandar ?? 'estándar desconocido', dato.valor.compartido ? 'presupuesto compartido' : 'presupuesto individual'].join(' · ');
    case 'suministro': return [`${dato.valor.cantidad} × ${dato.valor.referencia}`,
      dato.valor.incluido === null ? 'inclusión desconocida' : dato.valor.incluido ? 'incluido' : 'adicional',
      ...(dato.valor.longitud_aplica === false ? [] : [dato.valor.longitud_aplica === null
        ? 'aplicabilidad de longitud sin documentar'
        : dato.valor.longitud_m === null ? 'longitud desconocida' : `${dato.valor.longitud_m} m`])].join(' · ');
    case 'puerto': return [`${dato.valor.nombre} × ${dato.valor.total}`, ETIQUETA_SENTIDO[dato.valor.sentido],
      ETIQUETA_SENAL[dato.valor.senal],
      dato.valor.conector ?? 'conector desconocido'].join(' · ');
  }
}
