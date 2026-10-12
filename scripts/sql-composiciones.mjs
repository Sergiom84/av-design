const columnas=['kit_marca','kit_modelo','sku','version','estado_documental','clave','componente_marca','componente_modelo','identidad','rol','cantidad','inclusion','fuente'];
const literal=v=>`'${String(v).replaceAll("'","''")}'`;
export function leerComposiciones(texto){
 const lineas=texto.replace(/^\uFEFF/,'').split(/\r?\n/).filter(l=>l.trim());
 if(lineas[0]!==columnas.join(';'))throw new Error('composiciones.csv: cabecera incorrecta');
 const grupos=new Map();
 for(const [i,linea] of lineas.slice(1).entries()){
  const celdas=linea.split(';');
  if(celdas.length!==columnas.length)throw new Error(`Composicion fila ${i+2}: columnas incorrectas`);
  const f=Object.fromEntries(columnas.map((c,j)=>[c,celdas[j].trim()]));
  if(!f.kit_modelo||!f.sku||!f.clave||!f.identidad||!f.rol||!f.fuente||!/^https:\/\//.test(f.fuente)
   ||!['documentada','parcial'].includes(f.estado_documental)||!['incluido','opcional','por_determinar'].includes(f.inclusion)
   ||![f.version,f.cantidad].every(v=>/^[1-9]\d*$/.test(v)&&Number.isSafeInteger(Number(v)))
   ||(!f.componente_modelo&&f.componente_marca))throw new Error(`Composicion fila ${i+2}: identidad, cantidad o evidencia invalida`);
  const clave=JSON.stringify([f.kit_marca,f.kit_modelo,f.version]);
  const g=grupos.get(clave)??{...f,lineas:[]};
  if(g.sku!==f.sku||g.estado_documental!==f.estado_documental||g.fuente!==f.fuente||g.lineas.some(l=>l.clave===f.clave))throw new Error(`Composicion fila ${i+2}: version incoherente o linea repetida`);
  if(f.estado_documental==='documentada'&&(f.inclusion==='por_determinar'||(f.inclusion==='incluido'&&!f.componente_modelo&&f.rol!=='cable')))throw new Error('Composicion documentada con pendientes');
  g.lineas.push(f);grupos.set(clave,g);
 }
 return [...grupos.values()];
}
export function sqlComposiciones(grupos){
 return grupos.map(g=>`-- Composición explícita ${g.sku}, versión ${g.version}; nunca convierte instancias históricas.
do $composicion$ declare kit uuid; cid uuid; componente uuid; f jsonb; esperadas jsonb='[]'; actual jsonb; begin
 select id into strict kit from articulos where coalesce(marca,'')=${literal(g.kit_marca)} and modelo=${literal(g.kit_modelo)};
 perform 1 from articulos where id=kit for update;
 for f in select value from jsonb_array_elements(${literal(JSON.stringify(g.lineas))}::jsonb) loop
  componente=null;
  if f->>'componente_modelo'<>'' then
   select id into strict componente from articulos where coalesce(marca,'')=f->>'componente_marca' and modelo=f->>'componente_modelo';
  end if;
  esperadas=esperadas||jsonb_build_array(jsonb_build_object('clave',f->>'clave','articulo_componente_id',componente,
   'identidad',f->>'identidad','rol',f->>'rol','cantidad',(f->>'cantidad')::integer,'inclusion',f->>'inclusion','fuente',f->>'fuente'));
 end loop;
 select jsonb_agg(value order by value->>'clave') into esperadas from jsonb_array_elements(esperadas);
 select id into cid from articulo_composiciones where articulo_kit_id=kit and version=${g.version} for update;
 if cid is not null then
  select jsonb_agg(to_jsonb(l)-'id'-'composicion_id' order by l.clave) into actual from articulo_composicion_lineas l where composicion_id=cid;
  if actual is distinct from esperadas or not exists(select 1 from articulo_composiciones where id=cid and publicada
   and sku=${literal(g.sku)} and estado_documental=${literal(g.estado_documental)} and fuente=${literal(g.fuente)}) then
   raise exception 'Composicion publicada cambiada: nueva version requerida (${g.sku.replaceAll("'","''")})';
  end if;
 else
  insert into articulo_composiciones(articulo_kit_id,sku,version,estado_documental,fuente) values(kit,${literal(g.sku)},${g.version},${literal(g.estado_documental)},${literal(g.fuente)}) returning id into cid;
  for f in select value from jsonb_array_elements(esperadas) loop
   insert into articulo_composicion_lineas(composicion_id,clave,articulo_componente_id,identidad,rol,cantidad,inclusion,fuente)
   values(cid,f->>'clave',(f->>'articulo_componente_id')::uuid,f->>'identidad',f->>'rol',(f->>'cantidad')::integer,f->>'inclusion',f->>'fuente');
  end loop;
  update articulo_composiciones set publicada=true where id=cid;
 end if;
end $composicion$;`).join('\n');
}
