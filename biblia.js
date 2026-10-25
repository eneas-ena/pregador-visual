// ============================================================
// PREGADOR VISUAL — importar a Bíblia do pastor a partir do EPUB dele
// O texto fica SÓ neste aparelho (IndexedDB), nunca vai para a nuvem.
// Formatos reconhecidos:
//   A) Sociedade Bíblica do Brasil (NAA e outras): uma pasta por livro,
//      um arquivo por capítulo, versículos marcados com id="vC.V"
//   B) Editoras com arquivo por livro (ex.: NVI Thomas Nelson): índice de
//      capítulos no topo e números de versículo em <span>
//   C) SBB, edições mais antigas (ARA, ARC): um arquivo por capítulo, id="vN"
// ============================================================
(function(){
  const NOMES = {   // nome do livro (sem acento, minúsculo, sem espaço) -> código do app
    genesis:'gn', exodo:'ex', levitico:'lv', numeros:'nm', deuteronomio:'dt', josue:'js', juizes:'jz', rute:'rt',
    '1samuel':'1sm', '2samuel':'2sm', '1reis':'1rs', '2reis':'2rs', '1cronicas':'1cr', '2cronicas':'2cr',
    esdras:'ed', neemias:'ne', ester:'et', jo_:'jb', salmos:'sl', proverbios:'pv', eclesiastes:'ec',
    canticodoscanticos:'ct', canticos:'ct', cantares:'ct', isaias:'is', jeremias:'jr', lamentacoes:'lm', ezequiel:'ez',
    daniel:'dn', oseias:'os', joel:'jl', amos:'am', obadias:'ob', jonas:'jn', miqueias:'mq', naum:'na',
    habacuque:'hc', sofonias:'sf', ageu:'ag', zacarias:'zc', malaquias:'ml', mateus:'mt', marcos:'mc',
    lucas:'lc', joao:'jo', atos:'at', atosdosapostolos:'at', romanos:'rm', '1corintios':'1co', '2corintios':'2co',
    galatas:'gl', efesios:'ef', filipenses:'fp', colossenses:'cl', '1tessalonicenses':'1ts', '2tessalonicenses':'2ts',
    '1timoteo':'1tm', '2timoteo':'2tm', tito:'tt', filemom:'fm', filemon:'fm', hebreus:'hb', tiago:'tg',
    '1pedro':'1pe', '2pedro':'2pe', '1joao':'1jo', '2joao':'2jo', '3joao':'3jo', judas:'jd', apocalipse:'ap'
  };
  const semAc = t => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  function idDoNome(nome){
    const n = nome.trim();
    if (/^j[óÓ]$/i.test(n)) return 'jb';                                  // Jó (e não João)
    return NOMES[semAc(n).replace(/[^a-z0-9]/g, '')] || null;
  }
  const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', ndash: '–', mdash: '—', hellip: '…', laquo: '«', raquo: '»', ldquo: '“', rdquo: '”', lsquo: '‘', rsquo: '’' };
  const desfazEnt = s => s.replace(/&(#x[0-9a-f]+|#\d+|\w+);/gi, (m, e) =>
    e[0] === '#' ? String.fromCodePoint(e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10)) : (ENT[e.toLowerCase()] ?? m));
  function limpa(s){
    s = s.replace(/<\/?(div|p|br|li|h\d|aside|section)\b[^>]*>/gi, ' ').replace(/<[^>]+>/g, '');
    s = desfazEnt(s).replace(/\s+/g, ' ').trim();
    return s.replace(/\s+([!?.,;:»”)])/g, '$1').replace(/([«“(])\s+/g, '$1');
  }
  const dec = new TextDecoder('utf-8');

  // ---------- formato A (SBB) ----------
  function formatoA(arquivos){
    const livros = {}; let total = 0;
    for (const [nome, bytes] of Object.entries(arquivos)){
      const m = nome.match(/(?:^|\/)([1-3]?[A-Za-z]{1,3})\/(\d+)\.x?html$/);
      if (!m) continue;
      let t = dec.decode(bytes);
      if (!/class="v"/.test(t)) continue;
      const id = m[1].toLowerCase() === 'job' ? 'jb' : m[1].toLowerCase();
      t = t.slice(t.indexOf('<body'));
      t = t.replace(/<h[1-6][^>]*>[\s\S]*?<\/h[1-6]>/gi, '').replace(/<span class="qac">[\s\S]*?<\/span>/gi, '');
      const partes = t.split(/<a class="v"[^>]*id="v(\d+)\.(\d+)"[^>]*>\s*\d+\s*<\/a>/);
      for (let i = 1; i + 2 < partes.length + 1; i += 3){
        const c = +partes[i], v = +partes[i + 1], txt = limpa(partes[i + 2] || '');
        if (!txt) continue;
        ((livros[id] = livros[id] || {})[c] = livros[id][c] || {})[v] = txt; total++;
      }
    }
    return { livros, total };
  }
  // ---------- formato B (arquivo por livro) ----------
  function formatoB(arquivos){
    const livros = {}; let total = 0;
    for (const nome of Object.keys(arquivos).sort()){
      if (!/\.x?html?$/i.test(nome)) continue;
      let t = dec.decode(arquivos[nome]);
      if (!/class="class_s1HSD"/.test(t)) continue;
      let b = t.slice(t.indexOf('<body'));
      const h = b.match(/<div[^>]*class="heading_[^"]+"[^>]*>([\s\S]*?)<\/div>/);
      const id = h && idDoNome(limpa(h[1]));
      if (!id) continue;
      const k = b.indexOf('class="class_s2HG'); if (k > 0) b = b.slice(0, b.lastIndexOf('<', k));      // notas de rodapé
      b = b.replace(/<aside[\s\S]*?<\/aside>/gi, '').replace(/<a [^>]*class="class_s1HSJ"[^>]*>[\s\S]*?<\/a>/gi, '').replace(/<div class="class_s1E2">[\s\S]*?<\/div>/gi, '');
      let pos = [];
      for (const [, ancora, n] of b.matchAll(/<a href="[^"#]*#([^"]+)" class="class_s1HSX">\s*(\d+)\s*<\/a>/g)){
        const i = b.indexOf('id="' + ancora + '"'); if (i >= 0) pos.push([b.lastIndexOf('<', i), +n]);
      }
      if (!pos.length) for (const mm of b.matchAll(/<div[^>]*class="heading_[^"]+"[^>]*>([\s\S]*?)<\/div>/g)){
        const x = limpa(mm[1]).match(/^Salmo\s+(\d+)/i); if (x) pos.push([mm.index, +x[1], mm.index + mm[0].length]);
      }
      if (!pos.length){ const i = b.indexOf('<span class="class_s1HSD">'); if (i >= 0) pos = [[i, 1]]; }
      pos.sort((a, c) => a[0] - c[0]);
      pos.forEach((P, i) => {
        const fim = i + 1 < pos.length ? pos[i + 1][0] : b.length;
        let seg = P[2] ? b.slice(P[2], fim) : b.slice(P[0], fim);
        if (!P[2] && seg[0] === '<') seg = seg.slice(seg.indexOf('>') + 1);
        seg = seg.replace(/<span class="class_s1(HT3|DC|EM)">\s*\d+\s*<\/span>/g, '');
        const partes = seg.split(/<span class="class_s1HSD">\s*(\d+)\s*<\/span>/);
        const cap = ((livros[id] = livros[id] || {})[P[1]] = livros[id][P[1]] || {});
        const ini = limpa(partes[0]); if (ini){ cap[1] = ini; total++; }
        for (let j = 1; j < partes.length; j += 2){ const x = limpa(partes[j + 1] || ''); if (x){ if (!cap[+partes[j]]) total++; cap[+partes[j]] = x; } }
      });
    }
    return { livros, total };
  }
  // ---------- formato C (SBB, edições mais antigas: ARA, ARC…) ----------
  // um arquivo por capítulo; versículo marcado com id="vN"; livro e capítulo vêm do
  // "id" do arquivo no volume.opf (ex.: Joao3, livro1Corintios1, Jo1 = Jó) ou do título h2
  function formatoC(arquivos){
    const livros = {}; let total = 0;
    const opf = Object.keys(arquivos).find(n => /\.opf$/i.test(n));
    const base = opf ? opf.replace(/[^/]*$/, '') : '';
    const idDe = {};
    if (opf) for (const [, href, id] of dec.decode(arquivos[opf]).matchAll(/<item\b[^>]*?href="([^"]+)"[^>]*?id="([^"]+)"/g)) idDe[base + decodeURIComponent(href)] = id;
    const doNome = nome => nome === 'Jo' ? 'jb' : idDoNome(nome.replace(/^Salmo$/i, 'Salmos').replace(/^Cantico$/i, 'Canticos'));
    for (const [nome, bytes] of Object.entries(arquivos)){
      if (!/\.x?html?$/i.test(nome)) continue;
      let t = dec.decode(bytes);
      if (!/<a class="v(?:wj)?"[^>]*id="v\d+"/.test(t)) continue;
      let livro = null, cap = 0;
      const mi = (idDe[nome] || '').replace(/^livro/i, '').match(/^(\d?\D+?)(\d+)$/);
      if (mi){ livro = doNome(mi[1]); cap = +mi[2]; }
      if (!livro){
        const h = t.match(/<h2 class="c"[^>]*>([\s\S]*?)<\/h2>/);
        const mh = h && limpa(h[1]).match(/^(.+?)\s*(\d+)?$/);
        if (mh){ livro = doNome(mh[1].replace(/\s+/g, '')) || idDoNome(mh[1]); cap = +(mh[2] || 1); }
      }
      if (!livro || !cap) continue;
      t = t.slice(t.indexOf('<body'));
      t = t.replace(/<h[1-6][^>]*>[\s\S]*?<\/h[1-6]>/gi, '').replace(/<span class="chamada">[\s\S]*?<\/span>/gi, '').replace(/<a [^>]*class="footnote-link"[^>]*>[\s\S]*?<\/a>/gi, '');
      const partes = t.split(/<a class="v(?:wj)?"[^>]*id="v(\d+)"[^>]*>\s*\d+\s*<\/a>/);
      const vs = ((livros[livro] = livros[livro] || {})[cap] = livros[livro][cap] || {});
      for (let i = 1; i < partes.length; i += 2){
        const v = +partes[i], txt = limpa(partes[i + 1] || '');
        if (!txt) continue;
        if (!vs[v]) total++; vs[v] = txt;
      }
    }
    return { livros, total };
  }
  function siglaDoTitulo(titulo){
    const t = semAc(titulo || '');
    if (/nova almeida atualizada/.test(t)) return 'NAA';
    if (/\bnvi\b|nova versao internacional/.test(t)) return 'NVI';
    if (/nova versao transformadora|\bnvt\b/.test(t)) return 'NVT';
    if (/almeida revista e atualizada|\bara\b/.test(t)) return 'ARA';
    if (/almeida revista e corrigida|\barc\b/.test(t)) return 'ARC';
    if (/nova traducao na linguagem de hoje|\bntlh\b/.test(t)) return 'NTLH';
    if (/almeida corrigida fiel|\bacf\b/.test(t)) return 'ACF';
    if (/king james/.test(t)) return 'KJV';
    return '';
  }
  // lê o EPUB (bytes) e devolve a Bíblia organizada
  async function lerEpub(bytes){
    if (!window.fflate) throw new Error('descompactador');
    let arquivos;
    try { arquivos = window.fflate.unzipSync(new Uint8Array(bytes)); } catch { throw new Error('nao_epub'); }
    // DRM: só quando o texto (páginas) está criptografado; fontes "embaralhadas" não contam
    const enc = Object.keys(arquivos).find(n => /META-INF\/encryption\.xml$/i.test(n));
    if (enc && /<(enc:)?CipherReference[^>]*URI="[^"]+\.x?html?"/i.test(dec.decode(arquivos[enc]))) throw new Error('drm');
    const opf = Object.keys(arquivos).find(n => /\.opf$/i.test(n));
    const titulo = opf ? limpa((dec.decode(arquivos[opf]).match(/<dc:title[^>]*>([\s\S]*?)<\/dc:title>/i) || [])[1] || '') : '';
    let r = formatoA(arquivos);
    if (r.total < 1000) r = formatoB(arquivos);
    if (r.total < 1000) r = formatoC(arquivos);
    if (r.total < 1000) throw new Error('formato');
    return { titulo, sigla: siglaDoTitulo(titulo), livros: r.livros, total: r.total, nLivros: Object.keys(r.livros).length };
  }

  // ---------- guardar no aparelho ----------
  let _db;
  function abrir(){
    if (_db) return Promise.resolve(_db);
    return new Promise((ok, erro) => {
      const r = indexedDB.open('pregador-visual-biblias', 1);
      r.onupgradeneeded = () => r.result.createObjectStore('caps', { keyPath: 'chave' });
      r.onsuccess = () => { _db = r.result; ok(_db); };
      r.onerror = () => erro(r.error);
    });
  }
  async function guardar(sigla, livros){
    const d = await abrir();
    await apagar(sigla);
    await new Promise((ok, erro) => {
      const t = d.transaction('caps', 'readwrite'), s = t.objectStore('caps');
      for (const [id, caps] of Object.entries(livros)) for (const [c, vs] of Object.entries(caps)) s.put({ chave: `${sigla}|${id}|${c}`, v: vs });
      t.oncomplete = ok; t.onerror = () => erro(t.error);
    });
  }
  async function apagar(sigla){
    const d = await abrir();
    return new Promise((ok, erro) => {
      const t = d.transaction('caps', 'readwrite');
      const q = t.objectStore('caps').openCursor(IDBKeyRange.bound(sigla + '|', sigla + '|￿'));
      q.onsuccess = () => { const c = q.result; if (c){ c.delete(); c.continue(); } };
      t.oncomplete = ok; t.onerror = () => erro(t.error);
    });
  }
  async function capitulo(sigla, id, cap){
    const d = await abrir();
    return new Promise(ok => { const q = d.transaction('caps').objectStore('caps').get(`${sigla}|${id}|${cap}`); q.onsuccess = () => ok(q.result ? q.result.v : null); q.onerror = () => ok(null); });
  }
  const SOBRE = ['⁰','¹','²','³','⁴','⁵','⁶','⁷','⁸','⁹'];
  const sobrescrito = n => String(n).split('').map(d => SOBRE[+d]).join('');
  // texto de uma referência já entendida pelo app ({livro, cap, faixas:[[a,b],…]})
  async function texto(sigla, ref){
    if (!ref) return '';
    const vs = await capitulo(sigla, ref.livro, ref.cap); if (!vs) return '';
    const blocos = ref.faixas.map(([a, b]) => {
      const out = []; for (let v = a; v <= b; v++) if (vs[v]) out.push(sobrescrito(v) + ' ' + vs[v]);
      return out.join(' ');
    }).filter(Boolean);
    return blocos.join(' … ');
  }
  window.PVBiblia = { lerEpub, guardar, apagar, texto, idDoNome, siglaDoTitulo };
})();
