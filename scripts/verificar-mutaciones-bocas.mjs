import { spawnSync } from 'node:child_process';

const ejecutar = (comando, args, opciones = {}) => spawnSync(comando, args, {
  cwd: process.cwd(), encoding: 'utf8', shell: false, ...opciones,
});
const npmArgs = (...args) => [process.env.npm_execpath, ...args];
const psql = (sentencia) => {
  const r = ejecutar('docker', ['compose', 'exec', '-T', 'db', 'psql', '-U', 'av_design', '-d', 'av_design', '-v', 'ON_ERROR_STOP=1', '-c', sentencia]);
  if (r.status !== 0) throw new Error(r.stderr || r.stdout);
};
const pruebaQueCae = (nombre) => {
  const r = ejecutar(process.execPath, npmArgs('run', 'test:bocas'));
  const texto = `${r.stdout}\n${r.stderr}`;
  const cuenta = [...texto.matchAll(/(\d+)\/(\d+) comprobaciones/g)].at(-1);
  if (r.status === 0 || !cuenta) throw new Error(`${nombre}: la mutación no fue detectada`);
  console.log(`${nombre}: caen ${Number(cuenta[2]) - Number(cuenta[1])}/${cuenta[2]}`);
};

psql('alter table conexion_bocas drop constraint conexion_bocas_boca_unica');
try {
  pruebaQueCae('sin exclusividad');
} finally {
  psql('alter table conexion_bocas add constraint conexion_bocas_boca_unica unique (equipo_id, puerto_id, ordinal)');
}

psql('drop trigger conexion_bocas_validar on conexion_bocas');
try {
  pruebaQueCae('sin validación de pertenencia y rango');
} finally {
  const restaurar = ejecutar(process.execPath, npmArgs('run', 'db:migrate'));
  if (restaurar.status !== 0) throw new Error(restaurar.stderr || restaurar.stdout);
}

const final = ejecutar(process.execPath, npmArgs('run', 'test:bocas'), { stdio: 'inherit', encoding: undefined });
if (final.status !== 0) process.exit(final.status ?? 1);
