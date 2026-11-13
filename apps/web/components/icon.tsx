import type { ReactNode } from 'react';

/**
 * Ícones de traço do Design System INKO (24×24, stroke 1.75, currentColor).
 * São sempre decorativos: o texto ou o `aria-label` do controle carrega o significado.
 */
const paths = {
  dashboard: <><rect x="3" y="3" width="7" height="9" rx="1"/><rect x="14" y="3" width="7" height="5" rx="1"/><rect x="14" y="12" width="7" height="9" rx="1"/><rect x="3" y="16" width="7" height="5" rx="1"/></>,
  acervo: <path d="m16 6 4 14M12 6v14M8 8v12M4 4v16"/>,
  usuarios: <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></>,
  usuario: <><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></>,
  emprestimos: <path d="M8 3 4 7l4 4M4 7h16M16 21l4-4-4-4M20 17H4"/>,
  devolucoes: <><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></>,
  relatorios: <path d="M3 3v18h18M18 17V9M13 17V5M8 17v-3"/>,
  configuracoes: <path d="M21 4h-7M10 4H3M21 12h-9M8 12H3M21 20h-5M12 20H3M14 2v4M8 10v4M16 18v4"/>,
  pesquisa: <><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></>,
  notificacoes: <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.94 1.94 0 0 0 3.4 0"/>,
  menu: <path d="M4 6h16M4 12h16M4 18h16"/>,
  fechar: <path d="M18 6 6 18M6 6l12 12"/>,
  mais: <path d="M5 12h14M12 5v14"/>,
  seta: <path d="M5 12h14M12 5l7 7-7 7"/>,
  'seta-esquerda': <path d="M19 12H5M12 19l-7-7 7-7"/>,
  'chevron-baixo': <path d="m6 9 6 6 6-6"/>,
  'chevron-cima': <path d="m18 15-6-6-6 6"/>,
  'chevron-esquerda': <path d="m15 18-6-6 6-6"/>,
  'chevron-direita': <path d="m9 18 6-6-6-6"/>,
  ordenar: <path d="m7 15 5 5 5-5M7 9l5-5 5 5"/>,
  check: <path d="M20 6 9 17l-5-5"/>,
  'check-circulo': <><circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/></>,
  relogio: <><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></>,
  info: <><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></>,
  'erro-circulo': <><circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/></>,
  alerta: <><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4M12 17h.01"/></>,
  sair: <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>,
  olho: <><path d="M2.06 12.35a1 1 0 0 1 0-.7 10.75 10.75 0 0 1 19.88 0 1 1 0 0 1 0 .7 10.75 10.75 0 0 1-19.88 0"/><circle cx="12" cy="12" r="3"/></>,
  'olho-fechado': <><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68M6.61 6.61A13.53 13.53 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61M2 2l20 20"/><path d="M14.12 14.12a3 3 0 1 1-4.24-4.24"/></>,
  calendario: <><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></>,
  filtro: <path d="M22 3H2l8 9.46V19l4 2v-8.54L22 3z"/>,
  'mais-acoes': <><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/></>,
  lixeira: <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>,
  enviar: <path d="M22 2 11 13M22 2l-7 20-4-9-9-4Z"/>,
  atualizar: <path d="M21 12a9 9 0 1 1-3-6.7L21 8M21 3v5h-5"/>,
  carregando: <path d="M21 12a9 9 0 1 1-6.22-8.56"/>,
  upload: <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/>,
  download: <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/>,
  imagem: <><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.1-3.1a2 2 0 0 0-2.8 0L6 21"/></>,
  cards: <><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></>,
  tabela: <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>,
  mangas: <><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 11h18M13 3v8M9 11l-2 10"/></>,
  falha: <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4"/>,
  email: <><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-10 6L2 7"/></>,
  cadeado: <><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></>,
} satisfies Record<string, ReactNode>;

export type IconName = keyof typeof paths;

export function Icon({ name, size = 20, className = '' }: Readonly<{ name: IconName; size?: number; className?: string }>) {
  return <svg className={`inko-icon ${className}`.trim()} viewBox="0 0 24 24" width={size} height={size} aria-hidden="true" focusable="false">{paths[name]}</svg>;
}
