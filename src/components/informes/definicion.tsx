'use client';
import { REGISTRO_INFORMES } from '@/lib/informes/registro';
import type { ClaveInforme, ConfiguracionInforme, FormatoInforme } from '@/lib/informes/modelo';
export interface OpcionAmbito {
    id: string;
    nombre: string;
    tipo: 'sala' | 'obra' | 'sede';
}
export function Definicion({ nombre, configuracion, claves, opciones, cambiarNombre, cambiar }: {
    nombre: string;
    configuracion: ConfiguracionInforme;
    claves: ClaveInforme[];
    opciones: OpcionAmbito[];
    cambiarNombre: (n: string) => void;
    cambiar: (c: ConfiguracionInforme) => void;
}) {
    const c = configuracion;
    const seleccionar = (clave: ClaveInforme) => cambiar({ ...c, clave, periodo: clave.endsWith('_actual') ? { modo: 'actual' } : { modo: 'rango', desde: '', hasta: '' } });
    return <fieldset className="space-y-4">
    
    <legend className="font-semibold">Contenido del informe</legend>
    
    <label className="block">Nombre<input className="campo mt-1 w-full" required maxLength={120} value={nombre} onChange={e => cambiarNombre(e.target.value)}/></label>
    
    <label className="block">Informe<select aria-label="Informe" className="campo mt-1 w-full" value={c.clave} onChange={e => seleccionar(e.target.value as ClaveInforme)}>
    
    {claves.map(k => <option key={k} value={k}>{REGISTRO_INFORMES[k].modulo} · {REGISTRO_INFORMES[k].nombre}</option>)}
    
    </select></label>
    
    <div className="grid gap-3 sm:grid-cols-2">
    
    <label>Tipo de ámbito<select aria-label="Tipo de ámbito" className="campo mt-1 w-full" value={c.ambito.tipo} onChange={e => {
            const tipo = e.target.value as OpcionAmbito['tipo'];
            cambiar({ ...c, ambito: { tipo, id: opciones.find(o => o.tipo === tipo)?.id ?? '' } });
        }}>
        
        {(['sala', 'obra', 'sede'] as const).filter(t => opciones.some(o => o.tipo === t)).map(t => <option key={t} value={t}>
        
        {t === 'obra' ? 'Obra' : t === 'sede' ? 'Sede' : 'Sala'}
        
        </option>)}
    
    </select></label>
    
    <label>Ámbito<select aria-label="Ámbito" className="campo mt-1 w-full" value={c.ambito.id} onChange={e => cambiar({ ...c, ambito: { tipo: c.ambito.tipo, id: e.target.value } })}>
    
    <option value="">Selecciona un ámbito</option>
        
        {opciones.filter(o => o.tipo === c.ambito.tipo).map(o => <option key={o.id} value={o.id}>
        
        {o.nombre}
        
        </option>)}
    
    </select></label>
    
    </div>
        
        {c.ambito.tipo !== 'sala' && <label className="block">Selección de salas (opcional)<select aria-label="Selección de salas (opcional)" multiple className="campo mt-1 min-h-24 w-full" aria-describedby="ayuda-seleccion" value={c.ambito.salaIds ?? []} onChange={e => cambiar({ ...c, ambito: { ...c.ambito, ...{ salaIds: Array.from(e.target.selectedOptions).map(o => o.value) } } })}>
            
            {opciones.filter(o => o.tipo === 'sala').map(o => <option key={o.id} value={o.id}>
            
            {o.nombre}
            
            </option>)}
        
        </select><span id="ayuda-seleccion" className="text-sm text-slate-600">Sin selección explícita se incluyen todas las salas del ámbito. La revisión comprueba su pertenencia.</span><button type="button" className="ml-2 underline" onClick={() => cambiar({ ...c, ambito: { tipo: c.ambito.tipo as 'obra' | 'sede', id: c.ambito.id } })}>Incluir todas</button></label>}
    
        
        {c.periodo.modo === 'actual' ? <p className="text-sm text-slate-600">Datos actuales, observados cuando el runner capture las fuentes.</p> : <fieldset className="space-y-3">
        
        <legend>Período · Europe/Madrid</legend>
        
        <label>Tipo de período<select aria-label="Tipo de período" className="campo ml-2" value={c.periodo.modo === 'rango' ? 'rango' : c.periodo.intervalo} onChange={e => cambiar({ ...c, periodo: e.target.value === 'rango' ? { modo: 'rango', desde: '', hasta: '' } : { modo: 'relativo', intervalo: e.target.value as 'dia_anterior' | 'semana_anterior' | 'mes_anterior' } })}>
        
        <option value="rango">Rango fijo inclusivo</option>
        
        <option value="dia_anterior">Día anterior</option>
        
        <option value="semana_anterior">Semana anterior (lunes a domingo)</option>
        
        <option value="mes_anterior">Mes anterior</option>
        
        </select></label>
            
            {c.periodo.modo === 'rango' && <div className="flex flex-wrap gap-3">
            
            <label>Desde<input type="date" required className="campo ml-2" value={c.periodo.desde} onChange={e => cambiar({ ...c, periodo: { modo: 'rango', desde: e.target.value, hasta: c.periodo.modo === 'rango' ? c.periodo.hasta : '' } })}/></label>
            
            <label>Hasta<input type="date" required className="campo ml-2" value={c.periodo.hasta} onChange={e => cambiar({ ...c, periodo: { modo: 'rango', hasta: e.target.value, desde: c.periodo.modo === 'rango' ? c.periodo.desde : '' } })}/></label>
            
            </div>}
        
        </fieldset>}
    
    
    <fieldset>
    
    <legend>Formatos</legend>
    
    <div className="mt-2 flex gap-5">
        
        {(['pdf', 'xlsx', 'csv'] as FormatoInforme[]).map(f => <label key={f} className="flex items-center gap-2">
        
        <input type="checkbox" checked={c.formatos.includes(f)} onChange={e => cambiar({ ...c, formatos: e.target.checked ? [...c.formatos, f] : c.formatos.filter(x => x !== f) })}/>
        
        {f.toUpperCase()}
        
        </label>)}
    
    </div>
    
    </fieldset>
    
    </fieldset>;
}
