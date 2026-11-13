'use client';

import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useEffect, useState, type FormEvent } from 'react';
import { Icon } from '../../components/icon';
import { InkoPasswordInput, useToast } from '../../components/inko-interactions';
import { Enso, InkoButton, InkoInput, SeigaihaBand, WashiTexture } from '../../components/inko-kit';
import { InkoAlert } from '../../components/inko-patterns';
import { MockApiError, signIn, useLibrary } from '../../lib/mock-api';
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
  if (!password) return 'Informe sua senha.';
  return password.length < 6 ? 'A senha tem pelo menos 6 caracteres.' : undefined;
}

function focusFirstInvalid(errors: FieldErrors) {
  const target = errors.email ? EMAIL_ID : PASSWORD_ID;
  document.getElementById(target)?.focus();
}

export default function LoginPage() {
  const router = useRouter();
  const library = useLibrary();
  const toast = useToast();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  // Só é verdadeiro no navegador, depois de o estado mockado ser lido (evita divergência na hidratação).
  const signedIn = library.ready && Boolean(library.session);

  useEffect(() => {
    if (signedIn) router.replace('/');
  }, [signedIn, router]);

  function needsBackend(feature: string) {
    toast({ title: `${feature} depende do backend`, text: 'Disponível quando o serviço de autenticação for integrado.' });
  }

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
      if (error instanceof MockApiError && (error.field === 'email' || error.field === 'password')) {
        const remote: FieldErrors = { [error.field]: error.message };
        setErrors(remote);
        focusFirstInvalid(remote);
        return;
      }
      setFormError(error instanceof Error ? error.message : 'Tente novamente em instantes.');
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
          <div className={styles.options}>
            <label className={styles.remember}>
              <input type="checkbox" name="remember" onChange={event => { if (event.target.checked) needsBackend('Manter conectado'); }}/>
              Manter conectado neste dispositivo
            </label>
            <button type="button" className={styles.forgot} onClick={() => needsBackend('A recuperação de senha')}>Esqueci a senha</button>
          </div>
          <InkoButton type="submit" size="lg" loading={submitting} className={styles.submit}>Entrar</InkoButton>
        </form>}

        <p className={styles.demo}>
          <Icon name="info" size={16}/>
          <span><strong>Acesso demonstrativo.</strong> Qualquer e-mail válido e senha com 6 ou mais caracteres entram. Nada é transmitido: a sessão fica apenas nesta aba do navegador.</span>
        </p>
      </div>
    </main>
  </div>;
}
