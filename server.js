const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || (() => {
  const defaultPwd = 'admin' + Date.now().toString(36);
  console.log('⚠️  ADMIN_PASSWORD non défini. Mot de passe temporaire: ' + defaultPwd);
  console.log('💡 Configurez une variable d\'environnement ADMIN_PASSWORD en production.');
  return defaultPwd;
})();
const SUGGESTIONS_FILE = path.join(__dirname, 'suggestions.json');
const PROMO_FILE = path.join(__dirname, 'promo-codes.json');

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

function readPromoCodes() {
  try { return JSON.parse(fs.readFileSync(PROMO_FILE, 'utf-8')); }
  catch { return []; }
}

function writePromoCodes(data) {
  fs.writeFileSync(PROMO_FILE, JSON.stringify(data, null, 2), 'utf-8');
}

function initPromoCodes() {
  if (fs.existsSync(PROMO_FILE)) return;
  const creators = ['Createur 1', 'Createur 2', 'Createur 3', 'Createur 4', 'Createur 5'];
  const codes = creators.map(name => ({
    code: 'CREATEUR-' + crypto.randomBytes(3).toString('hex').toUpperCase(),
    creator: name,
    used: false,
    discount: 0.5,
    createdAt: new Date().toISOString()
  }));
  writePromoCodes(codes);
  console.log('🎟️ Codes promo créés :');
  codes.forEach(c => console.log('   ' + c.code + ' → ' + c.creator));
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

  // --- API: Check promo code ---
  if (req.method === 'GET' && pathname === '/api/check-promo') {
    const code = (params.get('code') || '').trim().toUpperCase();
    const codes = readPromoCodes();
    const match = codes.find(c => c.code === code);
    if (!match) {
      return jsonResponse(res, 200, { valid: false, message: 'Code invalide' });
    }
    if (match.used) {
      return jsonResponse(res, 200, { valid: false, message: 'Code déjà utilisé' });
    }
    return jsonResponse(res, 200, { valid: true, discount: match.discount, message: 'Code valide !' });
  }

  // --- API: Use promo code (marquer comme utilisé) ---
  if (req.method === 'POST' && pathname === '/api/use-promo') {
    const body = await readBody(req);
    const code = (body.code || '').trim().toUpperCase();
    let codes = readPromoCodes();
    const match = codes.find(c => c.code === code);
    if (!match || match.used) {
      return jsonResponse(res, 200, { success: false });
    }
    match.used = true;
    match.usedAt = new Date().toISOString();
    writePromoCodes(codes);
    return jsonResponse(res, 200, { success: true });
  }

  // --- API: Admin get promo codes ---
  if (req.method === 'GET' && pathname === '/api/admin/promos') {
    if (params.get('password') !== ADMIN_PASSWORD) {
      return jsonResponse(res, 401, { error: 'Unauthorized' });
    }
    return jsonResponse(res, 200, readPromoCodes());
  }

  // --- Serve static files ---
  serveFile(res, pathname);
}).listen(3000, () => {
  initPromoCodes();
  console.log('✅ Serveur démarré sur http://localhost:3000');
  console.log('🔐 Admin: http://localhost:3000/admin.html');
  console.log('🔄 Appuyez sur Ctrl+C pour arrêter');
});
