const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ADMIN_PASSWORD = 'admin123';
const SUGGESTIONS_FILE = path.join(__dirname, 'suggestions.json');

const mimeTypes = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg'
};

function readBody(req) {
  return new Promise(resolve => {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try { resolve(JSON.parse(body)); }
      catch { resolve({}); }
    });
  });
}

function readSuggestions() {
  try { return JSON.parse(fs.readFileSync(SUGGESTIONS_FILE, 'utf-8')); }
  catch { return []; }
}

function writeSuggestions(data) {
  fs.writeFileSync(SUGGESTIONS_FILE, JSON.stringify(data, null, 2), 'utf-8');
}

function jsonResponse(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

function serveFile(res, url) {
  if (url.endsWith('/')) url += 'index.html';
  let filePath = path.join(__dirname, url);
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end('File not found');
    } else {
      let ext = path.extname(filePath).toLowerCase();
      res.writeHead(200, { 'Content-Type': mimeTypes[ext] || 'application/octet-stream' });
      res.end(data);
    }
  });
}

http.createServer(async (req, res) => {
  const url = decodeURIComponent(req.url);
  const [pathname, query] = url.split('?');
  const params = new URLSearchParams(query || '');

  // --- API: Submit suggestion ---
  if (req.method === 'POST' && pathname === '/api/suggest') {
    const body = await readBody(req);
    if (!body.theme) {
      return jsonResponse(res, 400, { error: 'Theme is required' });
    }
    const suggestions = readSuggestions();
    suggestions.push({
      id: Date.now().toString(36) + crypto.randomBytes(4).toString('hex'),
      theme: body.theme,
      characters: body.characters || '',
      reason: body.reason || '',
      name: body.name || 'Anonyme',
      date: new Date().toISOString()
    });
    writeSuggestions(suggestions);
    return jsonResponse(res, 200, { success: true });
  }

  // --- API: Admin get suggestions ---
  if (req.method === 'GET' && pathname === '/api/admin/suggestions') {
    if (params.get('password') !== ADMIN_PASSWORD) {
      return jsonResponse(res, 401, { error: 'Unauthorized' });
    }
    return jsonResponse(res, 200, readSuggestions());
  }

  // --- API: Admin delete suggestion ---
  if (req.method === 'POST' && pathname === '/api/admin/suggestions/delete') {
    const body = await readBody(req);
    if (body.password !== ADMIN_PASSWORD) {
      return jsonResponse(res, 401, { error: 'Unauthorized' });
    }
    let suggestions = readSuggestions();
    suggestions = suggestions.filter(s => s.id !== body.id);
    writeSuggestions(suggestions);
    return jsonResponse(res, 200, { success: true });
  }

  // --- Serve static files ---
  serveFile(res, pathname);
}).listen(3000, () => {
  console.log('✅ Serveur démarré sur http://localhost:3000');
  console.log('🔐 Admin: http://localhost:3000/admin.html');
  console.log('🔄 Appuyez sur Ctrl+C pour arrêter');
});
