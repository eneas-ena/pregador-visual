// Pregador Visual — service worker (funciona sem internet)
const VERSAO = '2.3.0';
// nome diferente do Pregador pessoal ("pregador-…"), para um nunca apagar o cache do outro
const CACHE = 'pvisual-' + VERSAO;
const ARQUIVOS = [
  './', './index.html', './config.js', './manifest.json', './mammoth.min.js',
  './supabase.min.js', './docx.min.js', './pdf.min.mjs', './pdf.worker.min.mjs', './projetor.html',
  './icon-192.png', './icon-512.png', './apple-touch-icon.png'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ARQUIVOS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(ks => Promise.all(ks.filter(k => k.startsWith('pvisual-') && k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Banco de dados: nunca guardar em cache (o app cuida disso sozinho)
  if (url.hostname.endsWith('supabase.co')) return;

  // Fontes do Google: guardar e servir do cache
  if (url.hostname.includes('fonts.googleapis.com') || url.hostname.includes('fonts.gstatic.com')) {
    e.respondWith(
      caches.open(CACHE).then(c => c.match(req).then(r => r || fetch(req).then(resp => { c.put(req, resp.clone()); return resp; })))
    );
    return;
  }

  // Página principal: tenta a internet primeiro (pega atualizações), senão usa o cache
  if (req.mode === 'navigate' || url.pathname.endsWith('.html')) {
    e.respondWith(
      fetch(req).then(resp => { const copia = resp.clone(); caches.open(CACHE).then(c => c.put(req, copia)); return resp; })
        .catch(() => caches.match(req, { ignoreSearch: true }).then(r => r || caches.match('./index.html')))
    );
    return;
  }

  // Demais arquivos: cache primeiro
  e.respondWith(caches.match(req).then(r => r || fetch(req)));
});
