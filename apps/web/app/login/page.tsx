'use client';
import Image from 'next/image';
import Link from 'next/link';
import { useState, type FormEvent } from 'react';
import { InkoButton, InkoInput } from '../../components/inko-kit';
import { isValidEmailAddress } from '../../lib/validation';

export default function LoginPage() {
  const [email,setEmail]=useState('');
  const [password,setPassword]=useState('');
  const [visible,setVisible]=useState(false);
  const [attempted,setAttempted]=useState(false);
  const emailError=attempted&&!isValidEmailAddress(email)?'Informe um e-mail válido.':undefined;
  const passwordError=attempted&&password.length<6?'A senha deve ter pelo menos 6 caracteres.':undefined;
  function submit(event:FormEvent<HTMLFormElement>){event.preventDefault();setAttempted(true);}
  return <main className="inko-login"><section className="inko-login-art"><div className="inko-login-panels" aria-hidden="true"/><Image src="/inko/svg/elementos/enso-seal.svg" alt="" width={310} height={310} className="inko-login-enso"/><Image src="/inko/logo/inko-logo.png" alt="INKO" width={340} height={250} className="inko-login-logo"/><p>Uma biblioteca de universos em tinta.</p><Image src="/inko/svg/elementos/seigaiha-tile.svg" alt="" width={500} height={250} className="inko-login-waves"/></section><section className="inko-login-form"><div className="inko-login-card"><span className="inko-eyebrow">INKO / ADMINISTRATIVO</span><h1>Entrar</h1><p>Acesse o gerenciamento do acervo de mangás e HQs.</p><form className="inko-form" onSubmit={submit} noValidate><InkoInput id="email" label="E-mail" type="email" autoComplete="username" value={email} onChange={event=>setEmail(event.target.value)} error={emailError}/><label className="inko-field"><span className="inko-label">Senha</span><div className="inko-password"><input id="password" type={visible?'text':'password'} autoComplete="current-password" value={password} onChange={event=>setPassword(event.target.value)} aria-invalid={Boolean(passwordError)}/><button type="button" onClick={()=>setVisible(value=>!value)} aria-label={visible?'Ocultar senha':'Mostrar senha'}>{visible?'Ocultar':'Mostrar'}</button></div>{passwordError&&<span className="inko-field-error">{passwordError}</span>}</label><InkoButton type="submit">Validar campos</InkoButton></form><div className="inko-alert inko-alert--warning">Autenticação indisponível na Sprint 00. O formulário valida os campos localmente; nenhuma credencial é transmitida ou armazenada.</div><Link href="/">Acessar demonstração visual →</Link></div></section></main>;
}
