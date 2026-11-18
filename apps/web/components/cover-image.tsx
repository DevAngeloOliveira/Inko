'use client';

import { useState } from 'react';

/**
 * Capa persistida no Catálogo, desenhada por cima da capa em CSS.
 * Se o arquivo não carregar, some e a capa original continua visível.
 */
export function CoverImage({ src, alt }: Readonly<{ src: string; alt: string }>) {
  const [failed, setFailed] = useState<string | null>(null);
  if (failed === src) return null;
  return <img className="inko-cover-image" src={src} alt={alt} loading="lazy" decoding="async" referrerPolicy="no-referrer" onError={() => setFailed(src)}/>;
}
