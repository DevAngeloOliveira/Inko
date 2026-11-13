import type { Metadata, Viewport } from 'next';
import { Inter, Manrope, Noto_Sans_JP } from 'next/font/google';
import { ToastProvider } from '../components/inko-interactions';
import { InkoDefs } from '../components/inko-kit';
import './globals.css';

const inter = Inter({ subsets: ['latin'], weight: ['400', '500', '600', '700'], variable: '--font-inter', display: 'swap' });
const manrope = Manrope({ subsets: ['latin'], weight: ['500', '600', '700', '800'], variable: '--font-manrope', display: 'swap' });
// Só para conteúdo real em japonês (títulos originais); não é pré-carregada.
const notoJp = Noto_Sans_JP({ weight: ['500', '700'], variable: '--font-noto-jp', display: 'swap', preload: false });

export const metadata: Metadata = {
  title: { default: 'INKO | Biblioteca de Mangás e HQs', template: '%s | INKO' },
  description: 'Plataforma de gestão de acervos, leitores e circulação.',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#111111',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR" className={`${inter.variable} ${manrope.variable} ${notoJp.variable}`}>
      <body>
        <InkoDefs/>
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
