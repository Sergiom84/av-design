import { exigirUsuario } from '@/lib/sesion-servidor';
import { redirect } from 'next/navigation';
export default async function LayoutInformes({ children }: {
    children: React.ReactNode;
}) {
    const yo = await exigirUsuario();
    if (yo.ficticio || yo.debeCambiarClave)
        redirect('/cuenta');
    return children;
}
