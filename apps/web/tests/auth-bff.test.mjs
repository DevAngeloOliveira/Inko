import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import {
  accessFor, clientAddress, isBookId, isMutation, isPlausibleToken, isSameOrigin, isStaffRole,
  sessionCookieName, sessionMaxAge,
} from '../lib/server/auth-policy.ts';

const web = new URL('../', import.meta.url);
const read = path => readFileSync(new URL(path, web), 'utf8');

test('only catalog reads are anonymous; per-book availability, loans, users, reports and mutations require staff', () => {
  assert.equal(accessFor('GET', ['livros']), 'public');
  assert.equal(accessFor('GET', ['livros', 'INK-0001']), 'public');
  for (const [method, path] of [
    ['GET', ['livros', 'INK-0001', 'disponibilidade']],
    ['GET', ['emprestimos']], ['GET', ['emprestimos', 'ativos']], ['GET', ['usuarios']],
    ['GET', ['relatorios', 'multas']], ['GET', ['system', 'status']], ['POST', ['livros']],
    ['POST', ['emprestimos']], ['GET', ['livros', 'INK-0001', 'capa']],
  ]) {
    assert.equal(accessFor(method, path), 'staff', `${method} ${path.join('/')}`);
  }
});

test('mutations need an Origin that matches the served host', () => {
  assert.ok(isMutation('post') && isMutation('PUT') && isMutation('DELETE'));
  assert.ok(!isMutation('GET'));
  assert.ok(isSameOrigin('http://127.0.0.1:3000', '127.0.0.1:3000'));
  assert.ok(isSameOrigin('https://inko.example', 'inko.example'));
  assert.ok(!isSameOrigin('https://evil.example', '127.0.0.1:3000'));
  assert.ok(!isSameOrigin(null, '127.0.0.1:3000'));
  assert.ok(!isSameOrigin('null', '127.0.0.1:3000'));
  assert.ok(!isSameOrigin('javascript:alert(1)', '127.0.0.1:3000'));
});

test('roles, tokens and identifiers are checked strictly', () => {
  assert.ok(isStaffRole('ADMIN') && isStaffRole('BIBLIOTECARIO'));
  assert.ok(!isStaffRole('LEITOR') && !isStaffRole('admin') && !isStaffRole(undefined));
  assert.ok(isPlausibleToken('a'.repeat(43)));
  assert.ok(!isPlausibleToken('short') && !isPlausibleToken('x'.repeat(43) + ';') && !isPlausibleToken(null));
  assert.ok(isBookId('INK-0001'));
  assert.ok(!isBookId('../etc/passwd') && !isBookId('INK 1') && !isBookId('A'.repeat(17)));
});

test('session cookie lifetime never exceeds the server session or eight hours', () => {
  const now = Date.parse('2026-11-17T12:00:00Z');
  assert.equal(sessionMaxAge('2026-11-17T13:00:00Z', now), 3600);
  assert.equal(sessionMaxAge('2026-11-18T12:00:00Z', now), 8 * 3600);
  assert.equal(sessionMaxAge('2026-11-17T11:00:00Z', now), 0);
  assert.equal(sessionMaxAge('invalid', now), 0);
  assert.equal(sessionCookieName(true), '__Host-inko_session');
  assert.equal(sessionCookieName(false), 'inko_session');
  assert.equal(clientAddress('10.0.0.1, 172.18.0.5'), '172.18.0.5');
  assert.equal(clientAddress('<script>'), null);
});

test('session cookie is HttpOnly and SameSite=Lax and the token never reaches the browser JSON', () => {
  const session = read('lib/server/session.ts');
  assert.match(session, /'HttpOnly', 'SameSite=Lax'/);
  assert.match(session, /\.\.\.\(secure \? \['Secure'\] : \[\]\)/);
  const route = read('app/api/auth/session/route.ts');
  assert.match(route, /json\(\{ id, nome, email, papel, expiraEm: session\.expiraEm \}/);
  assert.doesNotMatch(route, /json\(\{[^}]*token/);
  assert.match(route, /rejectForeignOrigin\(request\)/);
  assert.match(route, /total > MAX_LOGIN_BYTES[\s\S]*reader\.cancel\(\)/);
  assert.doesNotMatch(route, /request\.text\(\)/);
});

test('a session check started before login or logout never overwrites the newer state', () => {
  const api = read('lib/library-api.ts');
  assert.match(api, /const generation = sessionGeneration;/);
  assert.match(api, /if \(generation !== sessionGeneration\) return;/);
  assert.equal((api.match(/sessionGeneration\+\+/g) ?? []).length, 2, 'signIn e clearSession');
});

test('the browser keeps no credential: no token or session in web storage', () => {
  const api = read('lib/library-api.ts');
  assert.doesNotMatch(api, /localStorage/);
  assert.doesNotMatch(api, /writeJson\(\s*SESSION_KEY/);
  assert.doesNotMatch(api, /\btoken\b\s*[:=(]|\.token\b/i);
  assert.match(api, /fetch\('\/api\/auth\/session'/);
  assert.match(api, /removeItem\(LEGACY_SESSION_KEY\)/);
});

test('every private BFF route goes through requireStaff and media uploads stay off the gateway', () => {
  assert.match(read('app/api/v1/[...path]/route.ts'), /accessFor\(request\.method, path\) === 'staff'[\s\S]*requireStaff\(request\)/);
  const media = read('app/api/media/livros/[id]/route.ts');
  assert.match(media, /CATALOGO_INTERNAL_URL/);
  assert.doesNotMatch(media, /GATEWAY/);
  assert.equal((media.match(/requireStaff\(request\)/g) ?? []).length, 2, 'PUT e DELETE');
  assert.match(media, /MAX_CONCURRENT_UPLOADS = 4/);
  assert.match(media, /total > MAX_REQUEST_BYTES/);
});

test('the login screen has no demo shortcuts', () => {
  const login = read('app/login/page.tsx');
  assert.doesNotMatch(login, /Qualquer e-mail|Acesso demonstrativo|Esqueci a senha|Manter conectado/);
  assert.match(login, /signIn\(email, password\)/);
});
