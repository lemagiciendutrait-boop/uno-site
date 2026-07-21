const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'mf1979@';
const SUGGESTIONS_FILE = path.join(__dirname, 'suggestions.json');
const VISITS_FILE = path.join(__dirname, 'visits.json');
const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || '';

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

function getClientIP(req) {
  const forwarded = req.headers['x-forwarded-for'];
  const raw = forwarded ? forwarded.split(',')[0].trim() : req.socket.remoteAddress || 'unknown';
  return raw.replace(/\d+$/, 'XXX');
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

// --- Supabase helpers ---

const USE_SUPABASE = !!(SUPABASE_URL && SUPABASE_ANON_KEY);

function supabaseHeaders() {
  return {
    'apikey': SUPABASE_ANON_KEY,
    'Authorization': 'Bearer ' + SUPABASE_ANON_KEY,
    'Content-Type': 'application/json',
    'Prefer': 'return=representation'
  };
}

async function supabaseFetch(path, options = {}) {
  const url = SUPABASE_URL.replace(/\/$/, '') + '/rest/v1/' + path;
  const res = await fetch(url, { ...options, headers: { ...supabaseHeaders(), ...options.headers } });
  if (!res.ok) throw new Error('Supabase error: ' + res.status + ' ' + (await res.text()));
  return res;
}

async function readPromoCodes() {
  if (USE_SUPABASE) {
    try {
      const res = await supabaseFetch('promo_codes?select=*&order=created_at.asc');
      return await res.json();
    } catch { return []; }
  }
  try { return JSON.parse(fs.readFileSync(path.join(__dirname, 'promo-codes.json'), 'utf-8')); }
  catch { return []; }
}

async function writePromoCodes(data) {
  if (USE_SUPABASE) {
    try {
      await supabaseFetch('promo_codes', { method: 'DELETE', headers: { 'Prefer': '' } });
      for (const c of data) {
        await supabaseFetch('promo_codes', {
          method: 'POST',
          body: JSON.stringify({
            code: c.code,
            creator: c.creator,
            used: c.used,
            used_at: c.usedAt || null,
            discount: c.discount,
            permanent: c.permanent || false,
            created_at: c.createdAt
          })
        });
      }
    } catch (e) { console.error('Supabase write error:', e.message); }
  } else {
    fs.writeFileSync(path.join(__dirname, 'promo-codes.json'), JSON.stringify(data, null, 2), 'utf-8');
  }
}

async function initPromoCodes() {
  const codes = await readPromoCodes();
  if (codes.length > 0) {
    console.log('🎟️ ' + codes.length + ' codes promo chargés' + (USE_SUPABASE ? ' (Supabase)' : ''));
    return;
  }
  const seedFile = path.join(__dirname, 'promo-codes.seed.json');
  let seed = [];
  if (fs.existsSync(seedFile)) {
    seed = JSON.parse(fs.readFileSync(seedFile, 'utf-8'));
  } else {
    const creators = ['Createur 1', 'Createur 2', 'Createur 3', 'Createur 4', 'Createur 5'];
    seed = creators.map(name => ({
      code: 'CREATEUR-' + crypto.randomBytes(3).toString('hex').toUpperCase(),
      creator: name,
      used: false,
      discount: 0.5,
      createdAt: new Date().toISOString()
    }));
  }
  await writePromoCodes(seed);
  console.log('🎟️ Codes promo créés :');
  seed.forEach(c => console.log('   ' + c.code + ' → ' + c.creator));
}

function readVisits() {
  try { return JSON.parse(fs.readFileSync(VISITS_FILE, 'utf-8')); }
  catch { return []; }
}

function writeVisits(data) {
  const max = 500;
  if (data.length > max) data = data.slice(data.length - max);
  fs.writeFileSync(VISITS_FILE, JSON.stringify(data, null, 2), 'utf-8');
}

async function handleRequest(req, res) {
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
    const codes = await readPromoCodes();
    const match = codes.find(c => c.code === code);
    if (!match) {
      return jsonResponse(res, 200, { valid: false, message: 'Code invalide' });
    }
    if (!match.permanent && match.used) {
      return jsonResponse(res, 200, { valid: false, message: 'Code déjà utilisé' });
    }
    return jsonResponse(res, 200, { valid: true, discount: match.discount, permanent: !!match.permanent, message: match.permanent ? 'Code permanent actif !' : 'Code valide !' });
  }

  // --- API: Use promo code (marquer comme utilisé) ---
  if (req.method === 'POST' && pathname === '/api/use-promo') {
    const body = await readBody(req);
    const code = (body.code || '').trim().toUpperCase();
    let codes = await readPromoCodes();
    const match = codes.find(c => c.code === code);
    if (!match || match.used) {
      return jsonResponse(res, 200, { success: false });
    }
    if (match.permanent) {
      return jsonResponse(res, 200, { success: true });
    }
    match.used = true;
    match.usedAt = new Date().toISOString();
    await writePromoCodes(codes);
    return jsonResponse(res, 200, { success: true });
  }

  // --- API: Admin get promo codes ---
  if (req.method === 'GET' && pathname === '/api/admin/promos') {
    if (params.get('password') !== ADMIN_PASSWORD) {
      return jsonResponse(res, 401, { error: 'Unauthorized' });
    }
    const codes = await readPromoCodes();
    return jsonResponse(res, 200, codes);
  }

  // --- API: Admin get visits ---
  if (req.method === 'GET' && pathname === '/api/admin/visits') {
    if (params.get('password') !== ADMIN_PASSWORD) {
      return jsonResponse(res, 401, { error: 'Unauthorized' });
    }
    const visits = readVisits();
    const now = new Date();
    const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    const last7 = new Date(now.getTime() - 7 * 86400000).toISOString();
    return jsonResponse(res, 200, {
      total: visits.length,
      today: visits.filter(v => v.date >= startToday).length,
      last7: visits.filter(v => v.date >= last7).length,
      uniqueIPs: new Set(visits.map(v => v.ip)).size,
      recent: visits.reverse().slice(0, 20)
    });
  }

  // --- API: Admin generate creator code ---
  if (req.method === 'POST' && pathname === '/api/admin/promos/generate') {
    const body = await readBody(req);
    if (body.password !== ADMIN_PASSWORD) {
      return jsonResponse(res, 401, { error: 'Unauthorized' });
    }
    const creatorName = (body.creator || '').trim();
    if (!creatorName) {
      return jsonResponse(res, 400, { error: 'Creator name is required' });
    }
    const isPermanent = !!body.permanent;
    const codes = await readPromoCodes();
    const newCode = {
      code: 'CREATEUR-' + crypto.randomBytes(3).toString('hex').toUpperCase(),
      creator: creatorName,
      used: false,
      discount: isPermanent ? 0.2 : 0.5,
      permanent: isPermanent || undefined,
      createdAt: new Date().toISOString()
    };
    codes.push(newCode);
    await writePromoCodes(codes);
    return jsonResponse(res, 200, { success: true, code: newCode });
  }

  // --- Log visit (HTML pages only) ---
  if (pathname.endsWith('.html') || pathname === '/' || pathname === '/index.html') {
    const visits = readVisits();
    visits.push({
      date: new Date().toISOString(),
      page: pathname === '/' ? '/index.html' : pathname,
      ip: getClientIP(req),
      agent: (req.headers['user-agent'] || '').substring(0, 80)
    });
    writeVisits(visits);
  }

  // --- Serve static files ---
  serveFile(res, pathname);
}

http.createServer(async (req, res) => {
  try {
    await handleRequest(req, res);
  } catch (e) {
    console.error('Erreur serveur:', e);
    if (!res.headersSent) {
      res.writeHead(500);
      res.end('Erreur interne');
    }
  }
}).listen(process.env.PORT || 3000, async () => {
  const port = process.env.PORT || 3000;
  await initPromoCodes();
  if (USE_SUPABASE) console.log('🗄️  Stockage Supabase actif');
  console.log('✅ Serveur démarré sur http://localhost:' + port);
  console.log('🔐 Admin: http://localhost:' + port + '/admin.html');
  console.log('🔄 Appuyez sur Ctrl+C pour arrêter');
});
