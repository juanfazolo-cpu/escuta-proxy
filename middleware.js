export const config = {
  matcher: ['/gestao/:path*'],
};

export default function middleware(request) {
  const user = process.env.GESTAO_USER;
  const pass = process.env.GESTAO_PASS;

  // Sem senha configurada = aberto (útil em dev local)
  if (!user || !pass) return;

  const auth = request.headers.get('authorization');
  if (auth?.startsWith('Basic ')) {
    const decoded = atob(auth.slice(6));
    const sep = decoded.indexOf(':');
    const u = decoded.slice(0, sep);
    const p = decoded.slice(sep + 1);
    if (u === user && p === pass) return;
  }

  return new Response('Acesso restrito — Taldo Gestão', {
    status: 401,
    headers: {
      'WWW-Authenticate': 'Basic realm="Taldo Gestão"',
      'Content-Type': 'text/plain; charset=utf-8',
    },
  });
}
