/** Fuente literal separada de las conexiones físicas; sin deducir puertos. */
const columnas=['fuente_clave','tipologia','aforo','origen_categoria','destino_categoria','senal','ruta','orden','notas'];
const senales=new Set(['hdmi','red','usb','audio_linea','audio_altavoz','microfono','alimentacion','control','otro']);
const txt=v=>`'${v.replaceAll("'","''")}'`;
export function leerTiradasDocumentales(texto){
 const lineas=texto.replace(/^\uFEFF/,'').split(/\r?\n/).filter(x=>x.trim()!=='');
 if(!lineas.length||lineas[0].split(';').join('|')!==columnas.join('|'))throw new Error('plantillas-tiradas.csv: cabecera documental incorrecta');
 const claves=new Set();
 return lineas.slice(1).map((linea,i)=>{
  const celdas=linea.split(';');
  if(celdas.length!==columnas.length)throw new Error(`plantillas-tiradas.csv fila ${i+2}: numero de celdas incorrecto`);
  const fila=Object.fromEntries(columnas.map((c,j)=>[c,celdas[j]]));
  if(!/^[a-z0-9][a-z0-9_-]*$/.test(fila.fuente_clave)||claves.has(fila.fuente_clave))throw new Error(`plantillas-tiradas.csv fila ${i+2}: clave fuente vacia, invalida o repetida`);
  claves.add(fila.fuente_clave);
  if(!fila.tipologia.trim()||!fila.origen_categoria.trim()||!fila.destino_categoria.trim()||!senales.has(fila.senal))throw new Error(`plantillas-tiradas.csv fila ${i+2}: origen documental incompleto`);
  if(fila.aforo!==''&&fila.aforo!=='None'&&(!/^\d+$/.test(fila.aforo)||!Number.isSafeInteger(Number(fila.aforo))||Number(fila.aforo)<1))throw new Error(`plantillas-tiradas.csv fila ${i+2}: aforo invalido`);
  if(!/^-?\d+$/.test(fila.orden)||!Number.isSafeInteger(Number(fila.orden)))throw new Error(`plantillas-tiradas.csv fila ${i+2}: orden invalido`);
  return fila;
 });
}
export function sqlTiradasDocumentales(filas){
 const campos=columnas.join(',');
 const valores=filas.map(f=>`(${columnas.map(c=>txt(f[c])).join(',')},${txt(f.aforo&&f.aforo!=='None'?`${f.tipologia} · aforo ${Number(f.aforo)}`:f.tipologia)})`);
 return `-- Tiradas documentales: conservan fuente literal, no crean conexiones fisicas.
lock table plantilla_tiradas_documentales in share row exclusive mode;
create temporary table tiradas_documentales_csv (${columnas.map(c=>`${c} text not null`).join(',')},nombre_plantilla text not null) on commit drop;
${valores.length?`insert into tiradas_documentales_csv values\n${valores.join(',\n')};`:''}
do $$ declare faltan text; begin
 select string_agg(f.fuente_clave,', ') into faltan from tiradas_documentales_csv f
 where (select count(*) from plantillas_sala p where p.nombre=f.nombre_plantilla)<>1;
 if faltan is not null then raise exception 'Tiradas documentales sin plantilla univoca: %',faltan; end if;
 select string_agg(d.fuente_clave,', ') into faltan from plantilla_tiradas_documentales d
 where not exists(select 1 from tiradas_documentales_csv f where f.fuente_clave=d.fuente_clave);
 if faltan is not null then raise exception 'Fuente documental retirada: requiere revision explicita (%). No se borra historia',faltan; end if;
end $$;
insert into plantilla_tiradas_documentales (${campos},plantilla_id)
select ${columnas.map(c=>`f.${c}`).join(',')},p.id from tiradas_documentales_csv f join plantillas_sala p on p.nombre=f.nombre_plantilla
on conflict(fuente_clave) do update set
 ${columnas.slice(1).map(c=>`${c}=excluded.${c}`).join(',')},plantilla_id=excluded.plantilla_id;
`;
}
