import { z } from 'zod';
import { puede, type Permisos, type Seccion } from './usuarios';

export const TARJETAS_PANEL = [
  {clave:'equipos',etiqueta:'Equipos en catálogo',seccion:'catalogo',href:'/catalogo'},
  {clave:'cables',etiqueta:'Referencias de cable',seccion:'catalogo',href:'/catalogo'},
  {clave:'consumibles',etiqueta:'Consumibles',seccion:'catalogo',href:'/catalogo'},
  {clave:'plantillas',etiqueta:'Plantillas de sala',seccion:'plantillas',href:'/plantillas'},
  {clave:'salas',etiqueta:'Salas',seccion:'salas',href:'/salas'},
  {clave:'almacen',etiqueta:'Referencias en almacén',seccion:'almacen',href:'/almacen'},
  {clave:'reservas',etiqueta:'Reservas activas',seccion:'almacen',href:'/almacen'},
  {clave:'pedidos',etiqueta:'Pedidos en curso',seccion:'compras',href:'/compras'},
  {clave:'cargas',etiqueta:'Cargas abiertas',seccion:'carga',href:'/carga'},
  {clave:'agenda_hoy',etiqueta:'Tareas de hoy',seccion:'proyectos',seccionesRequeridas:['proyectos','salas'],requiereUsuarioReal:true,planificacion:'hoy',href:'/proyectos/agenda?vista=hoy'},
  {clave:'agenda_semana',etiqueta:'Tareas de esta semana',seccion:'proyectos',seccionesRequeridas:['proyectos','salas'],requiereUsuarioReal:true,planificacion:'semana',href:'/proyectos/agenda?vista=semana'},
  {clave:'agenda_vencidas',etiqueta:'Tareas vencidas',seccion:'proyectos',seccionesRequeridas:['proyectos','salas'],requiereUsuarioReal:true,planificacion:'vencidas',href:'/proyectos/agenda?vista=vencidas'},
  {clave:'agenda_sin_fecha',etiqueta:'Tareas sin fecha',seccion:'proyectos',seccionesRequeridas:['proyectos','salas'],requiereUsuarioReal:true,planificacion:'sin_fecha',href:'/proyectos/agenda?vista=sin_fecha'},
  {clave:'ocupacion_semana',etiqueta:'Ocupación de la semana (minutos-persona)',seccion:'proyectos',seccionesRequeridas:['proyectos','salas'],requiereUsuarioReal:true,planificacion:'minutos_persona_semana',href:'/proyectos/agenda?vista=semana'},
  {clave:'seguimiento_propuestas',etiqueta:'Seguimiento de propuestas',seccion:'salas',requiereUsuarioReal:true,enlaceSolo:true,href:'/propuestas/seguimiento'},
] as const satisfies readonly {clave:string;etiqueta:string;seccion:Seccion;href:string;seccionesRequeridas?:readonly Seccion[];requiereUsuarioReal?:boolean;planificacion?:string;enlaceSolo?:boolean}[];
export type ClaveTarjeta=(typeof TARJETAS_PANEL)[number]['clave'];
export type GrupoPreferencias='panel'|'catalogo';
export interface PreferenciasPanel {orden:ClaveTarjeta[];ocultas:ClaveTarjeta[]}
export interface PreferenciasCatalogo {marcas:string[];q:string;tipo?:'equipo'|'cable'|'consumible'}
const clave=z.enum(TARJETAS_PANEL.map(t=>t.clave) as [ClaveTarjeta,...ClaveTarjeta[]]);
const unicas=z.array(clave).max(TARJETAS_PANEL.length).refine(v=>new Set(v).size===v.length,'No repitas tarjetas.');
const texto=(max:number)=>z.string().trim().max(max).refine(v=>!/[<>\u0000-\u001f]/.test(v)&&!/(;|--|\/\*|\*\/|\b(?:drop|alter|insert|delete|update)\s+(?:table|into|from)\b)/i.test(v),'Usa texto literal.');
const esquemaPanel=z.object({orden:unicas.optional().default([]),ocultas:unicas.optional().default([])}).strict();
const esquemaCatalogo=z.object({marcas:z.array(texto(100).min(1)).max(10).refine(v=>new Set(v).size===v.length,'No repitas marcas.').optional().default([]),q:texto(200).optional().default(''),tipo:z.enum(['equipo','cable','consumible']).optional()}).strict();
export const esquemaCambioPreferencias=z.discriminatedUnion('grupo',[
  z.object({grupo:z.literal('panel'),version:z.number().int().min(0).max(2147483646),valor:esquemaPanel}).strict(),
  z.object({grupo:z.literal('catalogo'),version:z.number().int().min(0).max(2147483646),valor:esquemaCatalogo}).strict(),
]);
export const esquemaRestablecerPreferencias=z.object({grupo:z.enum(['panel','catalogo']),version:z.number().int().min(0).max(2147483646)}).strict();
export function validarPanel(valor:unknown):PreferenciasPanel {const p=esquemaPanel.parse(valor);return {...p,orden:[...p.orden,...TARJETAS_PANEL.map(t=>t.clave).filter(k=>!p.orden.includes(k))]};}
export function validarCatalogo(valor:unknown):PreferenciasCatalogo{return esquemaCatalogo.parse(valor);}
interface AutorizacionTarjeta {
  seccion: Seccion;
  seccionesRequeridas?: readonly Seccion[];
  requiereUsuarioReal?: boolean;
}
export function seccionesRequeridas(tarjeta: AutorizacionTarjeta): readonly Seccion[] {
  return tarjeta.seccionesRequeridas ?? [tarjeta.seccion];
}
export function tarjetaAutorizada(tarjeta: AutorizacionTarjeta, permisos: Permisos, ficticio = false): boolean {
  return !(ficticio && tarjeta.requiereUsuarioReal) && seccionesRequeridas(tarjeta).every(seccion => puede(permisos, seccion, 'ver'));
}
export function panelAutorizado(p:PreferenciasPanel,permisos:Permisos,ficticio=false):PreferenciasPanel {
  const permitidas=new Set(TARJETAS_PANEL.filter(t=>tarjetaAutorizada(t,permisos,ficticio)).map(t=>t.clave));
  return {orden:p.orden.filter(k=>permitidas.has(k)),ocultas:p.ocultas.filter(k=>permitidas.has(k))};
}
export class ErrorPreferencias extends Error {constructor(message:string,public status=400){super(message);}}
