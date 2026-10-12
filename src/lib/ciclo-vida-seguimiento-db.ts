import type { Sql, TransactionSql } from 'postgres';
import { transaccionConControl } from './control-escritura';
import { exigirOrdenFinal, exigirSeguimiento, fechaSeguimiento, puntosFinales, pruebaCompleta } from './ciclo-vida-seguimiento';

type Autor = { id: string; nombre: string; ficticio: boolean };
export type OrdenSeguimiento = {
  operacion: 'plan' | 'checklist' | 'prueba_final' | 'reabrir_prueba' | 'instalacion' | 'entrega' | 'borrar_hito';
  salaId: string; version?: number; fecha?: string; tecnicoId?: string | null;
  nota?: string; puntos?: unknown; hitoId?: string; acepta?: string;
};
const fecha = (v: unknown) => v == null ? null : v instanceof Date ? v.toISOString().slice(0, 10) : String(v).slice(0, 10);

async function validarTecnico(tx: TransactionSql, id: string | null | undefined) {
  exigirSeguimiento(id, 'Elige un técnico de instalación.');
  const filas = await tx`select t.id from tecnicos t join tecnico_roles r on r.tecnico_id = t.id
    where t.id = ${id} and t.activo and r.rol = 'instalacion' for share of t, r`;
  exigirSeguimiento(filas.length === 1, 'El técnico no está activo o no tiene rol de instalación.');
}

/** Entrada de servidor, sin confiar en autoría enviada por formulario.
 * Sala primero: mismo cerrojo y orden que el cierre de obra y el plano.
 * Todo rechazo lanza; incluso un fallo de auditoría revierte la escritura.
 */
export async function escribirSeguimiento(db: Sql, autor: Autor, orden: OrdenSeguimiento,
  revisarEntrega: () => Promise<{ exigeNota: boolean; avisos: string[] }>) {
  exigirSeguimiento(!autor.ficticio, 'Inicia sesión con un usuario real para registrar el seguimiento.');
  await transaccionConControl(db, async (tx) => {
    const salas = await tx`select id from salas where id = ${orden.salaId} for update`;
    exigirSeguimiento(salas.length === 1, 'La sala no existe.');
    const cerrados = await tx`select h.id from hitos_proyecto h join localizaciones l on l.proyecto_id = h.proyecto_id
      join salas s on s.localizacion_id = l.id where s.id = ${orden.salaId} and h.tipo = 'cierre'`;
    exigirSeguimiento(cerrados.length === 0, 'El proyecto está cerrado. Reábrelo antes de modificar la sala.');
    const usuarios = await tx`select id from usuarios where id = ${autor.id} and activo and not debe_cambiar_clave for share`;
    exigirSeguimiento(usuarios.length === 1, 'Se requiere una sesión de usuario activo.');
    const hitos = await tx`select * from hitos_sala where sala_id = ${orden.salaId}`;
    const instalacion = hitos.find((h) => h.tipo === 'instalacion');
    const entrega = hitos.find((h) => h.tipo === 'entrega');
    const [prueba] = await tx`select * from prueba_final_sala where sala_id = ${orden.salaId}`;
    const hitoBorrar = hitos.find((h) => h.id === orden.hitoId);
    exigirSeguimiento(!entrega || (orden.operacion === 'borrar_hito' && hitoBorrar?.tipo === 'entrega'),
      'La sala está entregada. Anula primero la entrega para corregirla.');
    const nota = orden.nota?.trim() ?? '';
    exigirSeguimiento(nota.length <= 2000, 'La nota admite hasta 2000 caracteres.');
    let operacion: string = orden.operacion;
    let datos: Record<string, unknown> = {};
    if (orden.operacion === 'plan') {
      const [anterior] = await tx`select * from seguimiento_instalacion_sala where sala_id = ${orden.salaId}`;
      exigirSeguimiento(orden.version === (anterior?.version ?? 0), 'El plan ha cambiado. Recarga antes de guardar.');
      if (orden.tecnicoId) await validarTecnico(tx, orden.tecnicoId);
      const prevista = orden.fecha ? fechaSeguimiento(orden.fecha) : null;
      const [nuevo] = await tx`insert into seguimiento_instalacion_sala (sala_id, fecha_prevista, instalador_id, nota, version)
        values (${orden.salaId}, ${prevista}, ${orden.tecnicoId ?? null}, ${nota}, 1)
        on conflict (sala_id) do update set fecha_prevista = excluded.fecha_prevista, instalador_id = excluded.instalador_id,
          nota = excluded.nota, version = seguimiento_instalacion_sala.version + 1 returning *`;
      datos = { anterior: anterior ?? null, nuevo };
    } else if (orden.operacion === 'checklist' || orden.operacion === 'prueba_final') {
      exigirSeguimiento(instalacion, 'Primero marca la instalación como Hecho.');
      exigirSeguimiento(!prueba?.fecha, 'La prueba ya está finalizada. Reábrela para corregirla.');
      exigirSeguimiento(orden.version === (prueba?.version ?? 0), 'El checklist ha cambiado. Recarga antes de guardar.');
      const puntos = puntosFinales(orden.puntos);
      const finalizar = orden.operacion === 'prueba_final';
      if (finalizar) {
        exigirSeguimiento(pruebaCompleta(puntos), 'Quedan puntos pendientes o incidencias; no se puede completar la prueba final.');
        exigirOrdenFinal(fecha(instalacion.fecha), null, orden.fecha ?? '');
        await validarTecnico(tx, orden.tecnicoId);
      }
      const [nuevo] = await tx`insert into prueba_final_sala (sala_id, puntos, version, fecha, tecnico_id)
        values (${orden.salaId}, ${tx.json(puntos)}, 1, ${finalizar ? orden.fecha! : null}, ${finalizar ? orden.tecnicoId! : null})
        on conflict (sala_id) do update set puntos = excluded.puntos, version = prueba_final_sala.version + 1,
          fecha = excluded.fecha, tecnico_id = excluded.tecnico_id returning *`;
      datos = { anterior: prueba ?? null, nuevo };
    } else if (orden.operacion === 'reabrir_prueba') {
      exigirSeguimiento(prueba?.fecha && nota, 'La reapertura requiere una prueba final y un motivo.');
      exigirSeguimiento(orden.version === prueba.version, 'La prueba ha cambiado. Recarga antes de reabrirla.');
      // Se conservan las observaciones; cada punto vuelve a pendiente para obligar a comprobarlo otra vez.
      const puntos = puntosFinales(prueba.puntos).map((p) => ({ ...p, resultado: 'pendiente' }));
      await tx`update prueba_final_sala set fecha = null, tecnico_id = null, puntos = ${tx.json(puntos)},
        version = version + 1 where sala_id = ${orden.salaId}`;
      datos = { anterior: prueba, motivo: nota, puntos };
    } else if (orden.operacion === 'borrar_hito') {
      exigirSeguimiento(hitoBorrar, 'El hito no pertenece a esta sala.');
      exigirSeguimiento(hitoBorrar.tipo !== 'instalacion' || (!entrega && !prueba?.fecha),
        'Reabre primero la prueba final antes de anular la instalación.');
      exigirSeguimiento(nota, 'Indica el motivo de la anulación.');
      if (hitoBorrar.tipo === 'instalacion' && prueba) {
        await tx`delete from prueba_final_sala where sala_id = ${orden.salaId}`;
      }
      await tx`delete from hitos_sala where id = ${hitoBorrar.id} and sala_id = ${orden.salaId}`;
      operacion = `borrar_${hitoBorrar.tipo}`;
      datos = { anterior: hitoBorrar, prueba_anterior: prueba ?? null, motivo: nota };
    } else {
      exigirSeguimiento(!hitos.some((h) => h.tipo === orden.operacion), 'El hito ya está registrado.');
      const dia = fechaSeguimiento(orden.fecha ?? '');
      await validarTecnico(tx, orden.tecnicoId);
      let avisos: string[] = [];
      if (orden.operacion === 'entrega') {
        exigirOrdenFinal(fecha(instalacion?.fecha), fecha(prueba?.fecha), dia, true);
        exigirSeguimiento(prueba && pruebaCompleta(puntosFinales(prueba.puntos)), 'La prueba final no está completa.');
        exigirSeguimiento(orden.acepta?.trim() && orden.acepta.length <= 200, 'Indica quién recibe y acepta la sala.');
        const revision = await revisarEntrega();
        exigirSeguimiento(!revision.exigeNota || nota, 'Entrega excepcional: la revisión tiene bloqueos y exige una nota.');
        avisos = revision.avisos;
      }
      const [nuevo] = await tx`insert into hitos_sala (sala_id, tipo, tecnico_id, fecha, notas)
        values (${orden.salaId}, ${orden.operacion}, ${orden.tecnicoId!}, ${dia}, ${nota || null}) returning *`;
      datos = { nuevo, acepta: orden.acepta?.trim() ?? null, avisos };
    }
    if (orden.tecnicoId) {
      const [tecnico] = await tx`select nombre from tecnicos where id = ${orden.tecnicoId}`;
      datos.tecnico = tecnico?.nombre ?? null;
    }
    await tx`insert into auditoria_instalacion_sala (sala_id, autor_id, autor, operacion, datos)
      values (${orden.salaId}, ${autor.id}, ${autor.nombre}, ${operacion}, ${tx.json(datos as Parameters<typeof tx.json>[0])})`;
  });
}
