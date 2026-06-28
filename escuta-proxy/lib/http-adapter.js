import { createReadStream, existsSync, statSync } from 'fs';
import { dirname, extname, join, normalize } from 'path';
import { fileURLToPath } from 'url';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};

export function createResponse(nodeRes) {
  let statusCode = 200;

  const res = {
    status(code) {
      statusCode = code;
      return this;
    },
    setHeader(name, value) {
      if (Array.isArray(value)) {
        nodeRes.setHeader(name, value);
      } else {
        nodeRes.setHeader(name, value);
      }
      return this;
    },
    json(data) {
      if (!nodeRes.headersSent) {
        nodeRes.statusCode = statusCode;
        nodeRes.setHeader('Content-Type', 'application/json; charset=utf-8');
        nodeRes.end(JSON.stringify(data));
      }
    },
    end(body = '') {
      if (!nodeRes.headersSent) {
        nodeRes.statusCode = statusCode;
        nodeRes.end(body);
      }
    },
    redirect(code, url) {
      if (!nodeRes.headersSent) {
        nodeRes.statusCode = code;
        nodeRes.setHeader('Location', url);
        nodeRes.end();
      }
    },
  };

  return res;
}

function parseQuery(url) {
  const i = url.indexOf('?');
  if (i === -1) return {};
  return Object.fromEntries(new URLSearchParams(url.slice(i + 1)));
}

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  if (!chunks.length) return undefined;

  const raw = Buffer.concat(chunks).toString('utf8');
  const type = req.headers['content-type'] || '';
  if (type.includes('application/json')) {
    try {
      return JSON.parse(raw);
    } catch {
      return {};
    }
  }
  return raw;
}

export async function invokeHandler(handler, nodeReq, nodeRes) {
  const url = nodeReq.url || '/';
  const path = url.split('?')[0];
  const req = {
    method: nodeReq.method,
    headers: nodeReq.headers,
    query: parseQuery(url),
    body: nodeReq.method === 'POST' || nodeReq.method === 'PUT' || nodeReq.method === 'PATCH'
      ? await readBody(nodeReq)
      : undefined,
    url: path,
  };

  const res = createResponse(nodeRes);
  await handler(req, res);
}

export function serveStatic(publicDir, urlPath) {
  let rel = decodeURIComponent(urlPath.split('?')[0]);
  if (rel === '/' || rel === '') rel = '/analisador.html';

  const safe = normalize(rel).replace(/^(\.\.[/\\])+/, '').replace(/^[/\\]+/, '');
  const filePath = join(publicDir, safe);

  if (!filePath.startsWith(publicDir) || !existsSync(filePath) || !statSync(filePath).isFile()) {
    return null;
  }

  return {
    path: filePath,
    type: MIME[extname(filePath).toLowerCase()] || 'application/octet-stream',
  };
}

export function streamFile(nodeRes, filePath, contentType) {
  nodeRes.statusCode = 200;
  nodeRes.setHeader('Content-Type', contentType);
  createReadStream(filePath).pipe(nodeRes);
}

export function getPublicDir(rootDir) {
  return join(rootDir, 'public');
}

export function rootDirFromMeta(metaUrl) {
  return dirname(fileURLToPath(metaUrl));
}
