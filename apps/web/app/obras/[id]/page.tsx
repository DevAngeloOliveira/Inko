'use client';

import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { CategoryTag, InkoBadge, InkoCover, InkoEmpty, InkoErrorState, InkoLinkButton, Section } from '../../../components/inko-kit';
import { InkoSkeleton } from '../../../components/inko-patterns';
import { ApiError, fetchPublicWork } from '../../../lib/library-api';
import styles from './obra-publica.module.css';

type State =
  | { status: 'loading' | 'missing' | 'error' }
  | { status: 'ready'; data: Awaited<ReturnType<typeof fetchPublicWork>> };

function PublicWork({ id }: Readonly<{ id: string }>) {
  const [state, setState] = useState<State>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let current = true;
    fetchPublicWork(id)
      .then(data => { if (current) setState({ status: 'ready', data }); })
      .catch((error: unknown) => {
        if (current) setState({ status: error instanceof ApiError && error.status === 404 ? 'missing' : 'error' });
      });
    return () => { current = false; };
  }, [id, attempt]);

  if (state.status === 'loading') return <div aria-busy="true"><InkoSkeleton lines={5}/></div>;
  if (state.status === 'missing') return <InkoEmpty title="Obra não encontrada" text="Este exemplar não está no acervo."/>;
  if (state.status !== 'ready') return <InkoErrorState title="Obra indisponível" text="Não foi possível carregar os detalhes." onRetry={() => {
    setState({ status: 'loading' });
    setAttempt(value => value + 1);
  }}/>;

  const { work, onLoan } = state.data;
  const metadata = [
    ['Código do exemplar', work.id],
    ['Volume', work.volume],
    ['Editora', work.publisher],
    ['Título original', work.originalTitle],
    ['ISBN', work.isbn],
  ];

  return <>
    <article className={styles.hero}>
      <div className={styles.cover}><InkoCover work={work}/></div>
      <header className={styles.heading}>
        <CategoryTag category={work.category}/>
        <h1>{work.title}</h1>
        <p className={styles.author}>{work.author}{work.volume && <> · {work.volume}</>}</p>
        {work.genres && work.genres.length > 0 && <ul aria-label="Gêneros" className={styles.genres}>
          {work.genres.map(genre => <li key={genre}><InkoBadge tone="neutral">{genre}</InkoBadge></li>)}
        </ul>}
        <div className={styles.availability}>
          {onLoan === null && <InkoBadge tone="neutral">Disponibilidade não confirmada</InkoBadge>}
          {onLoan === true && <InkoBadge tone="info" icon="emprestimos">Emprestado</InkoBadge>}
          {onLoan === false && <>
            <InkoBadge tone="success" icon="check-circulo">Na estante</InkoBadge>
            <p>Informe o código <strong>{work.id}</strong> à equipe da biblioteca para solicitar o empréstimo.</p>
          </>}
        </div>
      </header>
    </article>
    {work.synopsis && <Section title="Sinopse"><p className={styles.synopsis}>{work.synopsis}</p></Section>}
    <Section title="Ficha técnica">
      <dl className={`inko-definition ${styles.metadata}`}>
        {metadata.filter(([, value]) => value).map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}
      </dl>
      {work.sourceUrl?.startsWith('https://') && <a className={styles.source} href={work.sourceUrl} target="_blank" rel="noopener noreferrer">Consultar ficha da editora</a>}
    </Section>
  </>;
}

export default function PublicWorkPage() {
  const { id } = useParams<{ id: string }>();
  return <main className={styles.page}>
    <InkoLinkButton href="/landing#acervo" variant="outline" leftIcon="seta-esquerda" className={styles.back}>Voltar ao acervo</InkoLinkButton>
    <PublicWork key={id} id={id}/>
  </main>;
}
