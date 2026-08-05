import Link from 'next/link';
import { hayConfiguracion } from '@/lib/db';
import { listarSalas } from '@/lib/datos';
import { SinConfigurar } from '@/components/sin-configurar';
import { Cabecera } from '@/components/ui';
import { ListaDeSalas } from '@/components/sala/lista';

export const dynamic = 'force-dynamic';

export default async function Salas() {
  if (!hayConfiguracion()) return <SinConfigurar />;

  const salas = await listarSalas();

  return (
    <>
      <Cabecera
        titulo="Salas"
        descripcion="Cada sala guarda sus medidas reales, su equipamiento y sus conexiones. De ahí salen los metros de cable."
        acciones={
          <Link
            href="/salas/nueva"
            className="border border-acento bg-acento text-papel rounded-[2px] px-3 py-1.5 hover:opacity-90 transition-colors"
          >
            Nueva sala
          </Link>
        }
      />

      <ListaDeSalas salas={salas} />
    </>
  );
}
