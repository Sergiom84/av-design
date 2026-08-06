/*
  Iconos de la navegación: SVG inline, trazo 1,5 px, estilo Feather (el de
  XTEN-AV) pero incrustados, sin fuente de iconos ni dependencia. Solo se usan
  junto a su etiqueta de texto, así que van con aria-hidden.
*/

type Props = { className?: string };

function base(props: Props) {
  return {
    className: props.className ?? 'size-5',
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.5,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
  };
}

export function IconoPanel(p: Props) {
  return (
    <svg {...base(p)}>
      <rect x="3" y="3" width="7" height="9" rx="1" />
      <rect x="14" y="3" width="7" height="5" rx="1" />
      <rect x="14" y="12" width="7" height="9" rx="1" />
      <rect x="3" y="16" width="7" height="5" rx="1" />
    </svg>
  );
}

export function IconoSalas(p: Props) {
  return (
    <svg {...base(p)}>
      <rect x="2" y="4" width="20" height="13" rx="1.5" />
      <path d="M8 21h8M12 17v4" />
    </svg>
  );
}

export function IconoPlantillas(p: Props) {
  return (
    <svg {...base(p)}>
      <rect x="8" y="8" width="13" height="13" rx="1.5" />
      <path d="M16 3H4.5A1.5 1.5 0 0 0 3 4.5V16" />
    </svg>
  );
}

export function IconoCheckin(p: Props) {
  return (
    <svg {...base(p)}>
      <rect x="4" y="4" width="16" height="18" rx="1.5" />
      <path d="M9 2v4M15 2v4M8.5 14l2.5 2.5 4.5-4.5" />
    </svg>
  );
}

export function IconoCatalogo(p: Props) {
  return (
    <svg {...base(p)}>
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V3H6.5A2.5 2.5 0 0 0 4 5.5v14z" />
      <path d="M4 19.5A2.5 2.5 0 0 0 6.5 22H20v-5" />
    </svg>
  );
}

export function IconoAlmacen(p: Props) {
  return (
    <svg {...base(p)}>
      <path d="M21 8.5 12 3 3 8.5V21h18V8.5z" />
      <path d="M3 8.5l9 5.5 9-5.5M12 14v7" />
    </svg>
  );
}

export function IconoCompras(p: Props) {
  return (
    <svg {...base(p)}>
      <circle cx="9" cy="20" r="1.5" />
      <circle cx="18" cy="20" r="1.5" />
      <path d="M2 3h3l2.7 12.4A1.5 1.5 0 0 0 9.16 16.5h8.9a1.5 1.5 0 0 0 1.46-1.17L21.5 7H6" />
    </svg>
  );
}

export function IconoCarga(p: Props) {
  return (
    <svg {...base(p)}>
      <path d="M1 5h14v11H1zM15 9h4l3 3v4h-7" />
      <circle cx="6" cy="18.5" r="1.8" />
      <circle cx="18" cy="18.5" r="1.8" />
    </svg>
  );
}

export function IconoParametros(p: Props) {
  return (
    <svg {...base(p)}>
      <path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3" />
      <path d="M1.5 14h5M9.5 8h5M17.5 16h5" />
    </svg>
  );
}

export function IconoSalir(p: Props) {
  return (
    <svg {...base(p)}>
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <path d="M16 17l5-5-5-5M21 12H9" />
    </svg>
  );
}

export function IconoMenu(p: Props) {
  return (
    <svg {...base(p)}>
      <path d="M3 6h18M3 12h18M3 18h18" />
    </svg>
  );
}

export function IconoCerrar(p: Props) {
  return (
    <svg {...base(p)}>
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}
