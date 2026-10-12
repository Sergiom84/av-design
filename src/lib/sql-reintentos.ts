import type {Sql,TransactionSql} from 'postgres';
import {reintentarTransaccion} from './control-escritura';

/** Conserva consultas diferidas y helpers de postgres.js; no interpreta SQL. */
export function sqlConReintentos(original:Sql):Sql {
  const consulta=(crear:()=>object)=>{
    const inicial=crear();
    if(!('then' in inicial))return inicial;
    let resultado:Promise<unknown>|undefined;
    const cambios:Array<{clave:PropertyKey;args:unknown[]}>=[];
    const ejecutar=()=>resultado??=(reintentarTransaccion(()=>{
      const actual=resultado?crear():inicial;
      if(actual!==inicial)for(const cambio of cambios)Reflect.apply(Reflect.get(actual,cambio.clave),actual,cambio.args);
      return actual as PromiseLike<unknown>;
    }));
    const proxy=new Proxy(inicial,{get(objeto,clave){
      if(clave==='then')return (bien:unknown,mal:unknown)=>Reflect.apply(ejecutar().then,ejecutar(),[bien,mal]);
      if(clave==='catch')return (mal:unknown)=>Reflect.apply(ejecutar().catch,ejecutar(),[mal]);
      if(clave==='finally')return (final:unknown)=>Reflect.apply(ejecutar().finally,ejecutar(),[final]);
      const valor=Reflect.get(objeto,clave);
      if(typeof valor!=='function')return valor;
      return (...args:unknown[])=>{const r=Reflect.apply(valor,objeto,args);if(r===objeto){cambios.push({clave,args});return proxy;}return r;};
    }});return proxy;
  };
  return new Proxy(original,{apply(objeto,thisArg,args){
    return consulta(()=>Reflect.apply(objeto,thisArg,args));
  },get(objeto,clave){
    if(clave==='begin')return (...args:unknown[])=>{
      const opciones=typeof args[0]==='string'?args[0]:'';
      const callback=(typeof args[0]==='string'?args[1]:args[0]) as (tx:TransactionSql)=>unknown;
      return reintentarTransaccion(()=>original.begin(opciones,async tx=>{
        const resultado=callback(tx);
        return Array.isArray(resultado)?Promise.all(resultado):resultado;
      }));
    };
    if(clave==='unsafe')return (...args:unknown[])=>consulta(()=>Reflect.apply(original.unsafe,original,args));
    const valor=Reflect.get(objeto,clave);
    return typeof valor==='function'?valor.bind(objeto):valor;
  }}) as Sql;
}
