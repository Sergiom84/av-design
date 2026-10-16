import type { ListaTiempos } from '@/lib/tiempos/modelo';
import { MisPartes } from './mis-partes';
export function GestionTiempos({ inicial, proyectoId }: { inicial: ListaTiempos; proyectoId: string }) { return <MisPartes inicial={inicial} proyectoId={proyectoId} />; }
