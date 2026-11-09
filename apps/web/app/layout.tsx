import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'INKO | Biblioteca de Mangás e HQs',
  description: 'Plataforma de gestão de acervos, leitores e circulação.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
