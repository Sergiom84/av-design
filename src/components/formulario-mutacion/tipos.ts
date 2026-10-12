export type EstadoFormularioMutacion = { error: string | null };
export type AccionFormularioMutacion = (datos: FormData) => Promise<void | EstadoFormularioMutacion>;
