import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import React, {act} from 'react';
import {createRoot} from 'react-dom/client';
import {DictadoLocal} from './dictado-local';
test('adaptador local:es-ES/processLocally,sin autoenvío,finaldeduplicado y abortar al desmontar',async()=>{
 const dom=new JSDOM('<div id="root"></div>',{url:'https://local.test'});const prevWindow=globalThis.window,prevDocument=globalThis.document;Object.assign(globalThis,{window:dom.window,document:dom.window.document,IS_REACT_ACT_ENVIRONMENT:true});
 const finales:string[]=[];const instancias:Motor[]=[];
 class Motor {local=false;lang='';continuous=false;interimResults=false;onresult:((e:unknown)=>void)|null=null;onerror:(()=>void)|null=null;onend:(()=>void)|null=null;inicios=0;abortos=0;paradas=0;constructor(){instancias.push(this);}get processLocally(){return this.local;}set processLocally(v:boolean){this.local=v;}static async available(o:unknown){assert.deepEqual(o,{langs:['es-ES'],processLocally:true});return 'available';}start(){this.inicios++;}stop(){this.paradas++;}abort(){this.abortos++;}}
 Object.assign(dom.window,{SpeechRecognition:Motor});const root=createRoot(dom.window.document.getElementById('root')!);
 try{await act(async()=>{root.render(<DictadoLocal identidad="A:sala" onFinal={t=>finales.push(t)}/>);});assert(dom.window.document.body.textContent?.includes('español disponible'));assert.equal(instancias.length,0);
 await act(async()=>{(dom.window.document.querySelector('button')as HTMLButtonElement).click();});const instancia=instancias.at(-1);assert(instancia);assert.equal(instancia.lang,'es-ES');assert.equal(instancia.processLocally,true);assert.equal(instancia.inicios,1);
 const e={results:[{isFinal:true,0:{transcript:'Texto final'}},{isFinal:false,0:{transcript:'parcial'}}]};await act(async()=>{instancia!.onresult?.(e);instancia!.onresult?.(e);});assert.deepEqual(finales,['Texto final']);assert(dom.window.document.body.textContent?.includes('parcial'));
 await act(async()=>{(dom.window.document.querySelector('button')as HTMLButtonElement).click();});assert.equal(instancia.paradas,1);await act(async()=>root.unmount());assert.equal(instancia.abortos,1);assert.equal(instancia.onresult,null);
 }finally{Object.assign(globalThis,{window:prevWindow,document:prevDocument});dom.window.close();}
});
