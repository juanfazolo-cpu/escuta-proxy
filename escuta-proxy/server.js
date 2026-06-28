import http from 'http';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import analisador from './api/analisador.js';
import gerar from './api/gerar.js';
import gadsAuth from './api/google-ads/auth.js';
import gadsCallback from './api/google-ads/callback.js';
import gadsAccounts from './api/google-ads/accounts.js';
import gadsCampaigns from './api/google-ads/campaigns.js';
import gadsDisconnect from './api/google-ads/disconnect.js';
import {
  getPublicDir,
  invokeHandler,
  rootDirFromMeta,
  serveStatic,
  streamFile,
} from './lib/http-adapter.js';

const ROOT = rootDirFromMeta(import.meta.url);

function loadEnvFile() {
  const envPath = join(ROOT, '.env');
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const i = trimmed.indexOf('=');
    if (i === -1) continue;
    const key = trimmed.slice(0, i).trim();
    let val = trimmed.slice(i + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = val;
  }
}

loadEnvFile();

const PUBLIC = getPublicDir(ROOT);
const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || '0.0.0.0';

const routes = {
  '/api/analisador': analisador,
  '/api/gerar': gerar,
  '/api/google-ads/auth': gadsAuth,
  '/api/google-ads/callback': gadsCallback,
  '/api/google-ads/accounts': gadsAccounts,
  '/api/google-ads/campaigns': gadsCampaigns,
  '/api/google-ads/disconnect': gadsDisconnect,
};

const server = http.createServer(async (nodeReq, nodeRes) => {
  try {
    const path = (nodeReq.url || '/').split('?')[0];
    const handler = routes[path];

    if (handler) {
      await invokeHandler(handler, nodeReq, nodeRes);
      return;
    }

    const file = serveStatic(PUBLIC, path);
    if (file) {
      streamFile(nodeRes, file.path, file.type);
      return;
    }

    nodeRes.statusCode = 404;
    nodeRes.setHeader('Content-Type', 'text/plain; charset=utf-8');
    nodeRes.end('Não encontrado');
  } catch (err) {
    if (!nodeRes.headersSent) {
      nodeRes.statusCode = 500;
      nodeRes.setHeader('Content-Type', 'application/json; charset=utf-8');
      nodeRes.end(JSON.stringify({ error: err.message || 'Erro interno' }));
    }
  }
});

server.listen(PORT, HOST, () => {
  const base = process.env.PUBLIC_URL || `http://localhost:${PORT}`;
  console.log(`Analisador Google Ads rodando em ${base}`);
  console.log(`  → ${base}/analisador.html`);
  if (!process.env.GOOGLE_ADS_CLIENT_ID) {
    console.log('  ⚠ Defina GOOGLE_ADS_* no arquivo .env (veja .env.example)');
  }
});
