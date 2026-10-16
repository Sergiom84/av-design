'use client';
import { useRef, useState, type ReactNode } from 'react';
import { Boton, Campo, CampoCasilla, Estado } from '@/components/ui';
import { BuscadorArticulo } from '@/components/catalogo/buscador-articulo';
import type { Area, Candidato, Material, ObraRequisitos } from './tipos';
import { etiquetaRevision } from './tipos';

export function FuenteCandidato({ candidato: c }: { candidato: Candidato }) {
  return <div className="space-y-2">
    <div className="flex flex-wrap gap-2"><Estado>{c.clase}</Estado><Estado tono={c.ancla.metodo === 'literal_estructurado' ? 'informacion' : 'aviso'}>{c.ancla.metodo.replaceAll('_', ' ')}</Estado></div>
    <blockquote className="border-l-2 border-linea pl-3 whitespace-pre-wrap [overflow-wrap:anywhere]">{c.fragmento}</blockquote>
    <p className="text-xs text-tinta-tenue">{c.ancla.pagina === null ? `Línea ${c.ancla.linea ?? 'sin precisar'}` : `Página ${c.ancla.pagina}`} · caracteres UTF-16 {c.ancla.inicio}–{c.ancla.fin}</p>
    <p className="dato text-xs [overflow-wrap:anywhere]">Fragmento SHA-256: {c.ancla.sha256}</p>
    {c.ambiguedades.map((a, i) => <p key={i} className="text-aviso-fuerte">{a}</p>)}
  </div>;
}
export function RevisionCampos({ campos, valor, cambiar, disabled = false }: { campos: string[]; valor: string[]; cambiar: (v: string[]) => void; disabled?: boolean }) {
  return <fieldset disabled={disabled} className="rounded-md bg-fondo p-3"><legend className="font-medium px-1">Campos revisados</legend>
    <div className="flex flex-wrap gap-x-5 gap-y-2">{campos.map(c => <CampoCasilla key={c} type="checkbox" checked={valor.includes(c)} onChange={e => cambiar(e.target.checked ? [...valor, c] : valor.filter(v => v !== c))}>{etiquetaRevision(c)}</CampoCasilla>)}</div>
  </fieldset>;
}
function Revisable({ campo, children, cambiar }: { campo: string; children: ReactNode; cambiar: (c: string) => void }) {
  return <div onChange={() => cambiar(campo)}>{children}</div>;
}
export function EditorArea({ candidato, obra, inicial, incluir, cancelar }: { candidato: Candidato; obra: ObraRequisitos; inicial?: Area; incluir: (a: Area) => void; cancelar: () => void }) {
  const [accion, setAccion] = useState<'crear' | 'vincular'>(inicial?.accion ?? 'crear');
  const [revisados, setRevisados] = useState(inicial?.camposRevisados ?? []);
  const [localizacion, setLocalizacion] = useState(inicial?.localizacion.id ?? (inicial?.localizacion.nombreNuevo ? 'nueva' : ''));
  const [error, setError] = useState('');
  const invalidar = (campo: string) => setRevisados(v => v.filter(c => c !== campo));
  const campos = ['accion', 'nombre', 'codigo', 'localizacion', 'medidas', 'aceptarHomonimo'];
  return <form className="space-y-3 mt-4" onSubmit={e => {
    e.preventDefault(); const f = new FormData(e.currentTarget); const medida = (k: string) => f.get(k) === '' ? null : Number(f.get(k));
    const sala = obra.salas.find(s => s.id === f.get('salaId'));
    if (accion === 'vincular' && !sala || accion === 'crear' && !localizacion) { setError('Elige una sala o una localización explícita.'); return; }
    incluir({ candidatoId: candidato.id, accion, salaId: accion === 'vincular' ? sala!.id : null,
      nombre: accion === 'vincular' ? sala!.nombre : String(f.get('nombre')), codigo: accion === 'vincular' ? sala!.codigo : String(f.get('codigo') ?? '').trim() || null,
      localizacion: { id: accion === 'crear' && localizacion !== 'nueva' ? localizacion : null, nombreNuevo: accion === 'crear' && localizacion === 'nueva' ? String(f.get('nombreNuevo')) : null },
      medidas: accion === 'crear' ? { largo_m: medida('largo_m'), ancho_m: medida('ancho_m'), alto_m: medida('alto_m') } : { largo_m: null, ancho_m: null, alto_m: null },
      aceptarHomonimo: f.get('aceptarHomonimo') === 'on', camposRevisados: revisados, motivo: String(f.get('motivo')) });
  }}>
    <Revisable campo="accion" cambiar={invalidar}><Campo etiqueta="Acción"><select value={accion} onChange={e => setAccion(e.target.value as 'crear' | 'vincular')} className="w-full"><option value="crear">Crear sala sin equipamiento</option><option value="vincular">Vincular sala existente de esta obra</option></select></Campo></Revisable>
    {accion === 'vincular' ? <Revisable campo="nombre" cambiar={() => setRevisados([])}><Campo etiqueta="Sala existente"><select name="salaId" required defaultValue={inicial?.salaId ?? ''} className="w-full"><option value="">Elegir sala</option>{obra.salas.map(s => <option key={s.id} value={s.id}>{s.nombre} · {s.codigo ?? s.id}</option>)}</select></Campo></Revisable> : <>
      <div className="grid gap-3 sm:grid-cols-2"><Revisable campo="nombre" cambiar={invalidar}><Campo etiqueta="Nombre de sala"><input name="nombre" required maxLength={160} defaultValue={inicial?.nombre ?? candidato.original.sala ?? candidato.original.area ?? ''} className="w-full" /></Campo></Revisable>
        <Revisable campo="codigo" cambiar={invalidar}><Campo etiqueta="Código de sala (opcional)"><input name="codigo" maxLength={80} defaultValue={inicial?.codigo ?? ''} className="w-full" /></Campo></Revisable></div>
      <Revisable campo="localizacion" cambiar={invalidar}><Campo etiqueta="Localización"><select value={localizacion} onChange={e => setLocalizacion(e.target.value)} required className="w-full"><option value="">Elegir localización</option>{obra.localizaciones.map(l => <option key={l.id} value={l.id}>{l.nombre} · {l.id}</option>)}<option value="nueva">Crear una localización</option></select></Campo>
        {localizacion === 'nueva' && <Campo etiqueta="Nombre de la nueva localización"><input name="nombreNuevo" required maxLength={160} defaultValue={inicial?.localizacion.nombreNuevo ?? ''} className="w-full mt-1" /></Campo>}</Revisable>
      <Revisable campo="medidas" cambiar={invalidar}><fieldset><legend className="t-etiqueta mb-1">Medidas según documento · vacío = sin medir</legend><div className="grid gap-3 sm:grid-cols-3">{(['largo_m', 'ancho_m', 'alto_m'] as const).map(k => <Campo key={k} etiqueta={`${k.replace('_m', '')} (m)`}><input name={k} type="number" min="0.01" max="9999.99" step="0.01" defaultValue={inicial?.medidas[k] ?? ''} className="w-full dato" /></Campo>)}</div></fieldset></Revisable>
    </>}
    <Revisable campo="aceptarHomonimo" cambiar={invalidar}><CampoCasilla name="aceptarHomonimo" type="checkbox" defaultChecked={inicial?.aceptarHomonimo}>He comprobado los homónimos y acepto esta elección</CampoCasilla></Revisable>
    <Campo etiqueta="Motivo de la decisión"><textarea name="motivo" required maxLength={500} defaultValue={inicial?.motivo ?? ''} className="w-full" /></Campo>
    <RevisionCampos campos={campos} valor={revisados} cambiar={setRevisados} />
    {error && <p role="alert" className="text-alerta">{error}</p>}
    <div className="flex flex-wrap gap-3"><Boton disabled={campos.some(c => !revisados.includes(c))}>Incluir área revisada</Boton><Boton tipo="button" variante="secundario" onClick={cancelar}>Cancelar edición</Boton></div>
  </form>;
}
export function EditorMaterial({ candidato, obra, areas, inicial, incluir, cancelar, leerArticulo, alErrorAcceso }: { candidato: Candidato; obra: ObraRequisitos; areas: Area[]; inicial?: Material; incluir: (m: Material) => void; cancelar: () => void; leerArticulo: (id: string) => Promise<{ articulo: { revision: number } }>; alErrorAcceso?: () => void }) {
  const [articulo, setArticulo] = useState<{ id: string; etiqueta: string; revision?: number } | null>(inicial ? { id: inicial.articuloId, etiqueta: inicial.articuloId, revision: inicial.revisionArticulo } : null);
  const [revision, setRevision] = useState(inicial ? String(inicial.revisionArticulo) : '');
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');
  const comprobacion = useRef(0);
  const [revisados, setRevisados] = useState(inicial?.camposRevisados ?? []);
  const campos = ['sala', 'articuloId', 'cantidad', 'unidad', 'disenoRevisado'];
  const invalidar = (campo: string) => setRevisados(v => v.filter(c => c !== campo));
  return <form className="space-y-3 mt-4" onSubmit={e => { e.preventDefault(); if (!articulo) return; const f = new FormData(e.currentTarget), destino = String(f.get('sala'));
    incluir({ candidatoId: candidato.id, salaId: destino.startsWith('sala:') ? destino.slice(5) : null, areaCandidatoId: destino.startsWith('area:') ? destino.slice(5) : null,
      articuloId: articulo.id, revisionArticulo: Number(revision), cantidad: Number(f.get('cantidad')), unidad: f.get('unidad') as 'ud' | 'm', disenoRevisado: true, camposRevisados: revisados, motivo: String(f.get('motivo')) }); }}>
    <Revisable campo="sala" cambiar={invalidar}><Campo etiqueta="Sala de destino"><select name="sala" defaultValue={inicial?.salaId ? `sala:${inicial.salaId}` : inicial?.areaCandidatoId ? `area:${inicial.areaCandidatoId}` : ''} required className="w-full"><option value="">Elegir sala o área revisada</option>{obra.salas.map(s => <option key={s.id} value={`sala:${s.id}`}>{s.nombre} · {s.codigo ?? s.id}</option>)}{areas.map(a => <option key={a.candidatoId} value={`area:${a.candidatoId}`}>{a.nombre} · área de este plan</option>)}</select></Campo></Revisable>
    <BuscadorArticulo etiqueta="Referencia exacta del catálogo" className="w-full" alErrorAcceso={alErrorAcceso} alElegir={a => { comprobacion.current++; setArticulo(a); setRevision(''); setCargando(false); invalidar('articuloId'); }} />
    {articulo && <p className="dato text-xs">{articulo.etiqueta} · {articulo.id}</p>}
    <div className="flex flex-wrap items-end gap-3"><Campo etiqueta="Revisión actual del artículo"><input type="number" required value={revision} readOnly className="w-28 dato" /></Campo>
      <Boton tipo="button" variante="secundario" disabled={!articulo || cargando} onClick={async () => { if (!articulo) return; const actual = ++comprobacion.current; setCargando(true); setError(''); setRevision(''); invalidar('articuloId'); try { const r = await leerArticulo(articulo.id); if (actual !== comprobacion.current) return; setRevision(String(r.articulo.revision)); setArticulo({ ...articulo, revision: r.articulo.revision }); } catch (e) { if (e instanceof Error && e.name !== 'AbortError' && actual === comprobacion.current) setError(e.message); } finally { if (actual === comprobacion.current) setCargando(false); } }}>Comprobar referencia</Boton></div>
    {error && <p role="alert" className="text-alerta">{error}</p>}
    <div className="grid gap-3 sm:grid-cols-2"><Revisable campo="cantidad" cambiar={invalidar}><Campo etiqueta="Cantidad adicional"><input name="cantidad" type="number" min="0.01" max="1000000" step="0.01" required defaultValue={inicial?.cantidad ?? candidato.original.cantidad ?? ''} className="w-full dato" /></Campo></Revisable>
      <Revisable campo="unidad" cambiar={invalidar}><Campo etiqueta="Unidad"><select name="unidad" required defaultValue={inicial?.unidad ?? ''} className="w-full"><option value="">Elegir unidad</option><option value="ud">ud</option><option value="m">m</option></select></Campo></Revisable></div>
    <Revisable campo="disenoRevisado" cambiar={invalidar}><CampoCasilla name="disenoRevisado" type="checkbox" required defaultChecked={inicial?.disenoRevisado}>He revisado el material que ya aporta el diseño. Esta necesidad es adicional.</CampoCasilla></Revisable>
    <Campo etiqueta="Motivo de la decisión"><textarea name="motivo" required maxLength={500} defaultValue={inicial?.motivo ?? ''} className="w-full" /></Campo>
    <RevisionCampos campos={campos} valor={revisados} cambiar={setRevisados} />
    <div className="flex flex-wrap gap-3"><Boton disabled={!articulo || revision === '' || campos.some(c => !revisados.includes(c))}>Incluir material revisado</Boton><Boton tipo="button" variante="secundario" onClick={cancelar}>Cancelar edición</Boton></div>
  </form>;
}
