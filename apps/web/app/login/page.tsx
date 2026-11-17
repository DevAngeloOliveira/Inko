'use client';

import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useEffect, useState, type FormEvent } from 'react';
import { InkoPasswordInput } from '../../components/inko-interactions';
import { Enso, InkoButton, InkoInput, SeigaihaBand, WashiTexture } from '../../components/inko-kit';
import { InkoAlert } from '../../components/inko-patterns';
import { ApiError, signIn, useLibrary } from '../../lib/library-api';
import { isValidEmailAddress } from '../../lib/validation';
import styles from './login.module.css';

type FieldErrors = { email?: string; password?: string };

const EMAIL_ID = 'login-email';
const PASSWORD_ID = 'login-password';

function emailError(email: string): string | undefined {
  if (!email.trim()) return 'Informe seu e-mail.';
  return isValidEmailAddress(email) ? undefined : 'Informe um e-mail válido, como nome@biblioteca.org.';
}

function passwordError(password: string): string | undefined {
  return password ? undefined : 'Informe sua senha.';
}

function focusFirstInvalid(errors: FieldErrors) {
  const target = errors.email ? EMAIL_ID : PASSWORD_ID;
  document.getElementById(target)?.focus();
}

export default function LoginPage() {
  const router = useRouter();
  const library = useLibrary();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  // Só é verdadeiro no navegador, depois de a sessão ser conferida no servidor (evita divergência na hidratação).
  const signedIn = library.ready && Boolean(library.session);

  useEffect(() => {
    if (signedIn) router.replace('/');
  }, [signedIn, router]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    const local: FieldErrors = { email: emailError(email), password: passwordError(password) };
    setErrors(local);
    setFormError('');
    if (local.email || local.password) {
      focusFirstInvalid(local);
      return;
    }
    setSubmitting(true);
    try {
      await signIn(email, password);
      router.replace('/');
    } catch (error) {
      setSubmitting(false);
      if (error instanceof ApiError && (error.field === 'email' || error.field === 'password')) {
        const remote: FieldErrors = { [error.field]: error.message };
        setErrors(remote);
        focusFirstInvalid(remote);
        return;
      }
      setPassword('');
      setFormError(error instanceof Error ? error.message : 'Tente novamente em instantes.');
      document.getElementById(PASSWORD_ID)?.focus();
    }
  }

  return <div className={styles.page}>
    <section className={styles.art} aria-label="INKO">
      <WashiTexture/>
      <span className={`${styles.frame} ${styles.frameDots}`} aria-hidden="true"/>
      <span className={`${styles.frame} ${styles.frameRays}`} aria-hidden="true"/>
      <div className={styles.brand}>
        <Enso size={420} strokeWidth={10} animated className={styles.enso}/>
        <Image src="/inko/logo/inko-logo.png" alt="INKO" width={900} height={665} priority sizes="(max-width: 767px) 280px, 560px" className={styles.logo}/>
      </div>
      <p className={styles.tagline}>Gestão de acervo físico · mangás, HQs e graphic novels</p>
      <p className={styles.signature}>Cada volume, no seu lugar.</p>
      <SeigaihaBand className={styles.waves}/>
    </section>

    <main className={styles.main}>
      <div className={styles.card}>
        <header className={styles.heading}>
          <h1>Entrar</h1>
          <p>Use sua conta de equipe da biblioteca.</p>
        </header>

        {formError && <InkoAlert tone="danger" title="Não foi possível entrar">{formError}</InkoAlert>}

        {signedIn && <InkoAlert tone="success" title={`Autenticado como ${library.session?.name ?? ''}`}>Abrindo o Dashboard…</InkoAlert>}

        {!signedIn && <form className={styles.form} onSubmit={submit} noValidate>
          <InkoInput id={EMAIL_ID} label="E-mail" type="email" name="email" inputMode="email" autoComplete="username" autoCapitalize="none" spellCheck={false}
            value={email} error={errors.email}
            onChange={event => { setEmail(event.target.value); setErrors(current => ({ ...current, email: undefined })); }}/>
          <InkoPasswordInput id={PASSWORD_ID} label="Senha" name="password" autoComplete="current-password"
            value={password} error={errors.password}
            onChange={event => { setPassword(event.target.value); setErrors(current => ({ ...current, password: undefined })); }}/>
          <InkoButton type="submit" size="lg" loading={submitting} className={styles.submit}>Entrar</InkoButton>
        </form>}

        <p className={styles.demo}>
          A conta é criada pela administração da biblioteca. A sessão expira em até 8 horas e é encerrada no servidor ao sair.
        </p>
      </div>
    </main>
  </div>;
}
