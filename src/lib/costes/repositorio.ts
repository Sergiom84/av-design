import type postgres from 'postgres';
import { autorCostes, exigirFinanzas } from './autorizacion';
import { entrada, alcanceSchema, ErrorCoste, LIMITES_COSTES, uuid } from './modelo';
import { listarTarifas, historialTarifa, prepararTarifa, guardarTarifa } from './repositorio-tarifas';
import { prepararLaboral, confirmarLaboral, listarPartesCoste, historialLaboral, anularLaboral } from './repositorio-laboral';
import { prepararMaterial, confirmarMaterial, candidatosMaterial, historialMaterial } from './repositorio-material';
import { prepararCorte, confirmarCorte, leerCorteEnConexion, listarCortes, construirCorte } from './repositorio-cortes';
export class RepositorioCostes {
  private secreto:string;
  constructor(private c:postgres.Sql,opciones:{secreto?:string;falloTrasEscritura?:()=>void}={}) { this.secreto=opciones.secreto??process.env.SESION_SECRETO??'';this.fallo=opciones.falloTrasEscritura; }
  private fallo?:()=>void;
  identidad(u:string){return autorCostes(this.c,u);}
  listarTarifas(u:string,t?:string,p=1){return this.c.begin('isolation level repeatable read read only',tx=>listarTarifas(tx,u,t,p));}
  historialTarifa(u:string,id:string,p=1){return this.c.begin('isolation level repeatable read read only',tx=>historialTarifa(tx,u,id,p));}
  prepararTarifa(u:string,e:unknown){return this.c.begin('isolation level repeatable read read only',tx=>prepararTarifa(tx,u,e));}
  guardarTarifa(u:string,e:unknown){return guardarTarifa(this.c,u,e,this.fallo);}
  historialLaboral(u:string,id:string,p=1){return this.c.begin('isolation level repeatable read read only',tx=>historialLaboral(tx,u,id,p));}
  anularLaboral(u:string,id:string,e:unknown){return anularLaboral(this.c,u,id,e,this.fallo);}
  prepararLaboral(u:string,e:unknown){return this.c.begin('isolation level repeatable read read only',tx=>prepararLaboral(tx,u,e,this.secreto));}
  confirmarLaboral(u:string,e:unknown){return confirmarLaboral(this.c,u,e,this.secreto,this.fallo);}
  listarPartes(u:string,p:string,d:string,h:string,n=1){return this.c.begin('isolation level repeatable read read only',tx=>listarPartesCoste(tx,u,p,d,h,n));}
  prepararMaterial(u:string,e:unknown){return this.c.begin('isolation level repeatable read read only',tx=>prepararMaterial(tx,u,e,this.secreto));}
  confirmarMaterial(u:string,e:unknown){return confirmarMaterial(this.c,u,e,this.secreto,this.fallo);}
  candidatosMaterial(u:string,p:string,d:string,h:string,n=1,q='',todos=false){return this.c.begin('isolation level repeatable read read only',tx=>candidatosMaterial(tx,u,p,d,h,n,q,todos));}
  historialMaterial(u:string,id:string,p=1){return this.c.begin('isolation level repeatable read read only',tx=>historialMaterial(tx,u,id,p));}
  prepararCorte(u:string,e:unknown){return this.c.begin('isolation level repeatable read read only',tx=>prepararCorte(tx,u,e,this.secreto));}
  confirmarCorte(u:string,e:unknown){return confirmarCorte(this.c,u,e,this.secreto,this.fallo);}
  leerCorte(u:string,id:string){return this.c.begin('isolation level repeatable read read only',tx=>leerCorteEnConexion(tx,u,id));}
  listarCortes(u:string,p:string,n=1,tipo?:'real'|'previsto'|'comparacion'){return this.c.begin('isolation level repeatable read read only',tx=>listarCortes(tx,u,p,n,tipo));}
  async metadatos(u:string,proyectoId:string) {
    entrada(uuid,proyectoId);
    return this.c.begin('isolation level repeatable read read only',async tx=>{
      const autor=await autorCostes(tx,u);exigirFinanzas(autor,{salas:true});
      const [proyecto]=await tx`select id,nombre,codigo from proyectos where id=${proyectoId}`;
      if(!proyecto)throw new ErrorCoste('NO_ENCONTRADO','La obra no existe.',404);
      const salas=await tx`select s.id,s.nombre,s.codigo from salas s join localizaciones l on l.id=s.localizacion_id where l.proyecto_id=${proyectoId} order by s.nombre,s.id limit 501`;
      if(salas.length>500)throw new ErrorCoste('LIMITE_EXCEDIDO','El alcance admite hasta 500 salas.',413);
      return {proyecto:{id:String(proyecto.id),nombre:String(proyecto.nombre),codigo:proyecto.codigo?String(proyecto.codigo):null},salas:salas.map(s=>({id:String(s.id),nombre:String(s.nombre),codigo:s.codigo?String(s.codigo):null})),alcance:'registros_del_alcance' as const};
    });
  }
  async tecnicos(u:string,q='') {
    await autorCostes(this.c,u);
    if(q.length>120)throw new ErrorCoste('ENTRADA_INVALIDA','Búsqueda demasiado larga.');
    const filas=await this.c`select id,nombre,activo from tecnicos where nombre ilike ${'%'+q.trim()+'%'} order by nombre,id limit ${LIMITES_COSTES.busqueda}`;
    return {tecnicos:filas.map(t=>({id:String(t.id),nombre:String(t.nombre),activo:!!t.activo}))};
  }
  async resumen(u:string,bruto:unknown) {
    const alcance=entrada(alcanceSchema,bruto);
    return this.c.begin('isolation level repeatable read read only',async tx=>construirCorte(tx,u,{tipo:'real',alcance,tratamientoFiscal:[],exclusionesMaterial:[],motivo:'Consulta del alcance registrado'}));
  }
}
