import React,{act} from 'react';
import assert from 'node:assert/strict';
import { it } from 'node:test';
import { montar,escribir,esperar } from '@/pruebas/dom';
import { FormularioHitoProyecto } from './formulario-hito';
Object.assign(globalThis,{React});
it('expone el rechazo seguro del cierre conservando técnico, fecha y nota',async()=>{
  const recibidos:FormData[]=[];
  const mensaje='Las salas de la obra siguen cambiando. No se ha registrado el hito. Revisa la obra y vuelve a intentarlo.';
  const m=await montar(<FormularioHitoProyecto proyectoId="obra" tipo="cierre" etiqueta="Registrar cierre" iniciadores={[{id:'tei',nombre:'TEI sintético',activo:true}]} exigeNota accion={async d=>{recibidos.push(d);return{error:mensaje};}}/>);
  const formDataOriginal=globalThis.FormData;
  Object.assign(globalThis,{FormData:(m.ventana as Window & typeof globalThis).FormData});
  try{
    const select=m.contenedor.querySelector('select')!;
    await act(async()=>{select.value='tei';select.dispatchEvent(new Event('change',{bubbles:true}));});
    const fecha=m.contenedor.querySelector<HTMLInputElement>('[name=fecha]')!,nota=m.contenedor.querySelector<HTMLInputElement>('[name=notas]')!;
    await escribir(fecha,'2026-10-15');await escribir(nota,'Revisión consciente de cierre');
    await act(async()=>m.contenedor.querySelector('form')!.requestSubmit());await esperar(20);
    assert.equal(m.contenedor.querySelector('[role=alert]')?.textContent,mensaje);
    assert.equal(select.value,'tei');assert.equal(fecha.value,'2026-10-15');assert.equal(nota.value,'Revisión consciente de cierre');
    assert.equal(recibidos[0].get('tecnico_id'),'tei');assert.equal(recibidos[0].get('fecha'),'2026-10-15');assert.equal(recibidos[0].get('notas'),'Revisión consciente de cierre');
  }finally{Object.assign(globalThis,{FormData:formDataOriginal});await m.desmontar();}
});
