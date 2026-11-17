// ============================================================
// PREGADOR VISUAL — importar a Bíblia do pastor a partir do EPUB dele
// O texto fica SÓ neste aparelho (IndexedDB), nunca vai para a nuvem.
// Formatos reconhecidos:
//   A) Sociedade Bíblica do Brasil (NAA e outras): uma pasta por livro,
//      um arquivo por capítulo, versículos marcados com id="vC.V"
//   B) Editoras com arquivo por livro (ex.: NVI Thomas Nelson): índice de
//      capítulos no topo e números de versículo em <span>
//   C) SBB, edições mais antigas (ARA, ARC): um arquivo por capítulo, id="vN"
//   D) conversões sem marcação (ex.: Bíblia de Estudo NTLH): índice + números sobrescritos
//   E) arquivo por livro com id="vC.V" e capitular (ex.: King James Atualizada de Estudo)
//   F) Bíblia NVT (Calibre): "numero_caps" e "numero_vers"
//   G) Bíblia de Jerusalém (Calibre): versículos em <sup>, capítulos só nos títulos
//   H) Bíblia Hebraica (Sêfer): só o Antigo Testamento, "cap-num" e "vers"
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
  // ---------- formato D (conversões "cruas", ex.: Bíblia de Estudo NTLH) ----------
  // livro: pelo índice (toc.ncx); capítulo: título grande "João 3" ou, sem título,
  // quando a numeração dos versículos recomeça; versículo: número em <sup><small>.
  // Notas de estudo, títulos e quadros (em azul) são descartados.
  function formatoD(arquivos){
    const livros = {}; let total = 0;
    const opfN = Object.keys(arquivos).find(n => /\.opf$/i.test(n)); if (!opfN) return { livros, total };
    const base = opfN.replace(/[^/]*$/, ''), opf = dec.decode(arquivos[opfN]);
    const hrefDe = {}; for (const m of opf.matchAll(/<item\b[^>]*>/g)){ const h = m[0].match(/href="([^"]+)"/), i = m[0].match(/id="([^"]+)"/); if (h && i) hrefDe[i[1]] = base + decodeURIComponent(h[1]); }
    const espinha = [...opf.matchAll(/<itemref\b[^>]*idref="([^"]+)"/g)].map(m => hrefDe[m[1]]).filter(Boolean);
    const ncxN = Object.keys(arquivos).find(n => /\.ncx$/i.test(n)); if (!ncxN || !espinha.length) return { livros, total };
    const ncxBase = ncxN.replace(/[^/]*$/, '');
    const inicio = {};   // arquivo -> livro (ou '' para entradas que não são livros)
    for (const [, rot, src] of dec.decode(arquivos[ncxN]).matchAll(/<text>([^<]*)<\/text>\s*<\/navLabel>\s*<content src="([^"#]+)/g)){
      const n = limpa(rot); inicio[ncxBase + decodeURIComponent(src)] = /^j[óo]$/i.test(n) && /ó/i.test(n) ? 'jb' : (idDoNome(n) || '');
    }
    const MARCA = /<sup>\s*<small>((?:(?!<\/small>)[\s\S])*)<\/small>\s*<\/sup>/g;
    let livro = null, cap = 0, ultV = 0, vAtual = 0, aguardando = false;
    const por = (txt) => { if (!livro || !cap || !vAtual) return; const c = ((livros[livro] = livros[livro] || {})[cap] = livros[livro][cap] || {}); const x = limpa(txt); if (!x) return; if (!c[vAtual]){ c[vAtual] = x; total++; } else c[vAtual] += ' ' + x; };
    for (const arq of espinha){
      if (arq in inicio){ livro = inicio[arq] || null; cap = 0; ultV = 0; vAtual = 0; aguardando = true; }
      if (!livro || !arquivos[arq]) continue;
      let b = dec.decode(arquivos[arq]); b = b.slice(b.indexOf('<body'));
      for (const [el] of b.matchAll(/<(p|blockquote|li|h[1-6])\b[^>]*>[\s\S]*?<\/\1>/g)){
        const semMarca = el.replace(MARCA, '');
        // título de capítulo: "João 3", "Salmo 23", ou o nome do livro (livro de um capítulo)
        const tg = semMarca.match(/<font size="7">([\s\S]*?)<\/font>\s*(?:<\/a>)?\s*<\/p>/) || semMarca.match(/^<blockquote[^>]*>\s*<b><font color="#[0-9A-Fa-f]+">(Salmo\s+\d+)<\/font><\/b>/);
        if (tg){
          const m = limpa(tg[1]).match(/^(.*?)\s*(\d+)?$/);
          const id = m && (/^salmo$/i.test(m[1]) ? 'sl' : idDoNome(m[1]));
          if (id === livro){ cap = +(m[2] || 1); ultV = 0; vAtual = 0; aguardando = false; }
          continue;
        }
        if (/color="#(0F60AB|023768)"/i.test(semMarca)) continue;           // nota de estudo, título, quadro
        const partes = el.replace(/<\/?(p|blockquote|li|h[1-6])\b[^>]*>/g, ' ').split(MARCA);
        por(partes[0]);
        for (let i = 1; i < partes.length; i += 2){
          const n = limpa(partes[i]).match(/^(\d+)(?:\s*[-–]\s*(\d+))?$/);
          if (!n){ por(partes[i + 1]); continue; }
          const v = +n[1], ate = n[2] ? +n[2] : v;                          // "26-27": versículos unidos
          if (aguardando){ cap = cap || 1; aguardando = false; }
          else if (v <= ultV && v === 1) cap++;                               // recomeçou a numeração: capítulo seguinte
          ultV = ate; vAtual = v; por(partes[i + 1]);
          if (ate > v && livro && cap){ const c = livros[livro][cap]; if (c && c[v]) for (let k = v + 1; k <= ate; k++){ if (!c[k]) total++; c[k] = '=' + v; } }
        }
      }
    }
    return { livros, total };
  }
  // ---------- formato E (arquivo por livro, ex.: King James Atualizada de Estudo) ----------
  // livro: <h1 class="chapter"> (arquivos de continuação herdam o anterior);
  // versículo 1 do capítulo: <a class="dcap" id="cN">; demais: <a class="v" id="vC.V">
  function formatoE(arquivos){
    const livros = {}; let total = 0;
    const opfN = Object.keys(arquivos).find(n => /\.opf$/i.test(n));
    let ordem = Object.keys(arquivos).sort();
    if (opfN){
      const base = opfN.replace(/[^/]*$/, ''), opf = dec.decode(arquivos[opfN]), hrefDe = {};
      for (const m of opf.matchAll(/<item\b[^>]*>/g)){ const h = m[0].match(/href="([^"]+)"/), i = m[0].match(/id="([^"]+)"/); if (h && i) hrefDe[i[1]] = base + decodeURIComponent(h[1]); }
      const esp = [...opf.matchAll(/<itemref\b[^>]*idref="([^"]+)"/g)].map(m => hrefDe[m[1]]).filter(n => n && arquivos[n]);
      if (esp.length) ordem = esp;
    }
    const MARCA = /<a class="(?:v" id="v(\d+)\.(\d+)|dcap" id="c(\d+))"[^>]*>\s*\d+\s*<\/a>/g;
    let livro = null;
    for (const nome of ordem){
      if (!/\.x?html?$/i.test(nome)) continue;
      let t = dec.decode(arquivos[nome]);
      if (!/<a class="(v|dcap)" id="(v\d+\.\d+|c\d+)"/.test(t)) continue;
      t = t.slice(t.indexOf('<body'));
      const h = t.match(/<h1 class="chapter"[^>]*>([\s\S]*?)<\/h1>/);
      if (h){ const n = limpa(h[1]); livro = /^j[óÓ]$/i.test(n) ? 'jb' : idDoNome(n); }
      if (!livro) continue;
      t = t.replace(/<h[1-6][^>]*>[\s\S]*?<\/h[1-6]>/gi, '')
           .replace(/<p class="(tx1|link-index|center1|bibliography)"[^>]*>(?:(?!<\/p>)(?!<a class="(?:v|dcap)")[\s\S])*<\/p>/gi, '')
           .replace(/<p>\s*<em>(?:(?!<\/p>)(?!<a class)[\s\S])*<\/p>/gi, '')           // títulos de salmo e "(Dt 5.1-21)"
           // título simples seguido das passagens paralelas: "Jesus convoca Mateus" + "(Mt 9.9-13; Lc 5.27-32)"
           .replace(/(?:<p>(?:(?!<\/p>)(?!<a )[\s\S])*<\/p>\s*)?<p[^>]*>\s*(?:<em>)?\s*\(\s*<a href(?:(?!<\/p>)(?!<a class)[\s\S])*<\/p>/gi, '');
      const partes = t.split(MARCA);                                                   // [texto, c, v, cDcap, texto, …]
      for (let i = 1; i + 3 <= partes.length; i += 4){
        const c = +(partes[i] || partes[i + 2]), v = partes[i] ? +partes[i + 1] : 1, txt = limpa(partes[i + 3] || '');
        if (!c || !txt) continue;
        const cap = ((livros[livro] = livros[livro] || {})[c] = livros[livro][c] || {});
        if (!cap[v]) total++; cap[v] = txt;
      }
    }
    return { livros, total };
  }
  // ---------- formato F (Bíblia NVT, conversão do Calibre) ----------
  // livro: <h1 class="titulo_principal">; capítulo: <span class="numero_caps">N</span> (é o versículo 1);
  // versículo: <sup class="numero_vers">N</sup>; títulos, notas e "voltar ao índice" são descartados
  function espinhaDe(arquivos){
    const opfN = Object.keys(arquivos).find(n => /\.opf$/i.test(n));
    if (!opfN) return Object.keys(arquivos).sort();
    const base = opfN.replace(/[^/]*$/, ''), opf = dec.decode(arquivos[opfN]), hrefDe = {};
    for (const m of opf.matchAll(/<item\b[^>]*>/g)){ const h = m[0].match(/href="([^"]+)"/), i = m[0].match(/id="([^"]+)"/); if (h && i) hrefDe[i[1]] = base + decodeURIComponent(h[1]); }
    const esp = [...opf.matchAll(/<itemref\b[^>]*idref="([^"]+)"/g)].map(m => hrefDe[m[1]]).filter(n => n && arquivos[n]);
    return esp.length ? esp : Object.keys(arquivos).sort();
  }
  function formatoF(arquivos){
    const livros = {}; let total = 0, livro = null, cap = 0, v = 0;
    const por = txt => { if (!livro || !cap || !v) return; const x = limpa(txt); if (!x) return; const c = ((livros[livro] = livros[livro] || {})[cap] = livros[livro][cap] || {}); if (!c[v]){ c[v] = x; total++; } else c[v] += ' ' + x; };
    const MARCA = /<span class="numero_caps"[^>]*>\s*(\d+)\s*<\/span>|<sup class="numero_vers\d*">\s*(\d+)\s*<\/sup>/g;
    for (const nome of espinhaDe(arquivos)){
      if (!/\.x?html?$/i.test(nome)) continue;
      let t = dec.decode(arquivos[nome]); t = t.slice(t.indexOf('<body'));
      const h = t.match(/<h1 class="titulo_principal"[^>]*>([\s\S]*?)<\/h1>/);
      if (h){ const n = limpa(h[1]); livro = /^j[óÓ]$/i.test(n) ? 'jb' : idDoNome(n); cap = 0; v = 0; }
      if (!livro || !/class="numero_(vers|caps)/.test(t)) continue;
      t = t.replace(/<h[1-6][^>]*>[\s\S]*?<\/h[1-6]>/gi, '')
           .replace(/<span class="info-salmo"[^>]*>[\s\S]*?<\/span>\s*(?=<\/p>)/gi, '')     // "Salmo de Davi." (o nº do salmo fica)
           .replace(/<p class="(titulo_\w*|salmos_\w*|cap_ref|nota)[^"]*"[^>]*>[\s\S]*?<\/p>/gi, '')
           .replace(/<sup class="sub_nota">[\s\S]*?<\/sup>/gi, '')
           .replace(/<span class="volta_caps"[^>]*>[\s\S]*?<\/span>/gi, '');
      const partes = t.split(MARCA);                                   // [texto, cap, vers, texto, …]
      por(partes[0]);
      for (let i = 1; i + 2 <= partes.length; i += 3){
        if (partes[i]){ cap = +partes[i]; v = 1; }
        else {
          v = +partes[i + 1]; if (!cap) cap = 1;
          const c = (livros[livro] || {})[cap];                        // Salmos: "23" e depois "¹": o que veio entre os dois não é versículo
          if (v === 1 && c && c[1]){ delete c[1]; total--; }
        }
        por(partes[i + 2] || '');
      }
    }
    return { livros, total };
  }
  // ---------- formato G (Bíblia de Jerusalém, conversão do Calibre) ----------
  // versículo: <sup><span class="none2">N</span></sup>; texto: spans "none1"/"none3";
  // títulos (spans "none"): nome do livro em maiúsculas, "SALMO 23", "43 Os filhos de Jacó…" (nº do capítulo).
  // Livros que não existem na Bíblia protestante (Tobias, Macabeus…) e versículos com letra (Ester 3,13b) ficam de fora.
  // quantos versículos tem cada capítulo (numeração das Bíblias protestantes em português)
  const ORDEM = 'gn ex lv nm dt js jz rt 1sm 2sm 1rs 2rs 1cr 2cr ed ne et jb sl pv ec ct is jr lm ez dn os jl am ob jn mq na hc sf ag zc ml mt mc lc jo at rm 1co 2co gl ef fp cl 1ts 2ts 1tm 2tm tt fm hb tg 1pe 2pe 1jo 2jo 3jo jd ap'.split(' ');
  const VERSOS = '31,25,24,26,32,22,24,22,29,32,32,20,18,24,21,16,27,33,38,18,34,24,20,67,34,35,46,22,35,43,55,32,20,31,29,43,36,30,23,23,57,38,34,34,28,34,31,22,33,26;22,25,22,31,23,30,25,32,35,29,10,51,22,31,27,36,16,27,25,26,36,31,33,18,40,37,21,43,46,38,18,35,23,35,35,38,29,31,43,38;17,16,17,35,19,30,38,36,24,20,47,8,59,57,33,34,16,30,37,27,24,33,44,23,55,46,34;54,34,51,49,31,27,89,26,23,36,35,16,33,45,41,50,13,32,22,29,35,41,30,25,18,65,23,31,40,16,54,42,56,29,34,13;46,37,29,49,33,25,26,20,29,22,32,32,18,29,23,22,20,22,21,20,23,30,25,22,19,19,26,68,29,20,30,52,29,12;18,24,17,24,15,27,26,35,27,43,23,24,33,15,63,10,18,28,51,9,45,34,16,33;36,23,31,24,31,40,25,35,57,18,40,15,25,20,20,31,13,31,30,48,25;22,23,18,22;28,36,21,22,12,21,17,22,27,27,15,25,23,52,35,23,58,30,24,42,15,23,29,22,44,25,12,25,11,31,13;27,32,39,12,25,23,29,18,13,19,27,31,39,33,37,23,29,33,43,26,22,51,39,25;53,46,28,34,18,38,51,66,28,29,43,33,34,31,34,34,24,46,21,43,29,53;18,25,27,44,27,33,20,29,37,36,21,21,25,29,38,20,41,37,37,21,26,20,37,20,30;54,55,24,43,26,81,40,40,44,14,47,40,14,17,29,43,27,17,19,8,30,19,32,31,31,32,34,21,30;17,18,17,22,14,42,22,18,31,19,23,16,22,15,19,14,19,34,11,37,20,12,21,27,28,23,9,27,36,27,21,33,25,33,27,23;11,70,13,24,17,22,28,36,15,44;11,20,32,23,19,19,73,18,38,39,36,47,31;22,23,15,17,14,14,10,17,32,3;22,13,26,21,27,30,21,22,35,22,20,25,28,22,35,22,16,21,29,29,34,30,17,25,6,14,23,28,25,31,40,22,33,37,16,33,24,41,30,24,34,17;6,12,8,8,12,10,17,9,20,18,7,8,6,7,5,11,15,50,14,9,13,31,6,10,22,12,14,9,11,12,24,11,22,22,28,12,40,22,13,17,13,11,5,26,17,11,9,14,20,23,19,9,6,7,23,13,11,11,17,12,8,12,11,10,13,20,7,35,36,5,24,20,28,23,10,12,20,72,13,19,16,8,18,12,13,17,7,18,52,17,16,15,5,23,11,13,12,9,9,5,8,28,22,35,45,48,43,13,31,7,10,10,9,8,18,19,2,29,176,7,8,9,4,8,5,6,5,6,8,8,3,18,3,3,21,26,9,8,24,13,10,7,12,15,21,10,20,14,9,6;33,22,35,27,23,35,27,36,18,32,31,28,25,35,33,33,28,24,29,30,31,29,35,34,28,28,27,28,27,33,31;18,26,22,16,20,12,29,17,18,20,10,14;17,17,11,16,16,13,13,14;31,22,26,6,30,13,25,22,21,34,16,6,22,32,9,14,14,7,25,6,17,25,18,23,12,21,13,29,24,33,9,20,24,17,10,22,38,22,8,31,29,25,28,28,25,13,15,22,26,11,23,15,12,17,13,12,21,14,21,22,11,12,19,12,25,24;19,37,25,31,31,30,34,22,26,25,23,17,27,22,21,21,27,23,15,18,14,30,40,10,38,24,22,17,32,24,40,44,26,22,19,32,21,28,18,16,18,22,13,30,5,28,7,47,39,46,64,34;22,22,66,22,22;28,10,27,17,17,14,27,18,11,22,25,28,23,23,8,63,24,32,14,49,32,31,49,27,17,21,36,26,21,26,18,32,33,31,15,38,28,23,29,49,26,20,27,31,25,24,23,35;21,49,30,37,31,28,28,27,27,21,45,12;11,23,5,19,15,11,16,14,17,15,12,14,16,9;20,32,21;15,16,15,13,27,14,17,14,15;21;17,10,10,11;16,13,12,13,15,16,20;15,13,19;17,20,19;18,15,20;15,23;21,13,10,14,11,15,14,23,17,12,17,14,9,21;14,17,18,6;25,23,17,25,48,34,29,34,38,42,30,50,58,36,39,28,27,35,30,34,46,46,39,51,46,75,66,20;45,28,35,41,43,56,37,38,50,52,33,44,37,72,47,20;80,52,38,44,39,49,50,56,62,42,54,59,35,35,32,31,37,43,48,47,38,71,56,53;51,25,36,54,47,71,53,59,41,42,57,50,38,31,27,33,26,40,42,31,25;26,47,26,37,42,15,60,40,43,48,30,25,52,28,41,40,34,28,41,38,40,30,35,27,27,32,44,31;32,29,31,25,21,23,25,39,33,21,36,21,14,23,33,27;31,16,23,21,13,20,40,13,27,33,34,31,13,40,58,24;24,17,18,18,21,18,16,24,15,18,33,21,14;24,21,29,31,26,18;23,22,21,32,33,24;30,30,21,23;29,23,25,18;10,20,13,18,28;12,17,18;20,15,16,16,25,21;18,26,17,22;16,15,15;25;14,18,19,16,14,20,28,13,28,39,40,29,25;27,26,18,17,20;25,25,22,19,14;21,22,18;10,29,24,21,21;13;15;25;20,29,22,11,14,17,17,13,21,11,19,18,18,20,8,21,18,24,21,15,27,21'.split(';');
  const qtdCaps = id => { const i = ORDEM.indexOf(id); return i < 0 ? 0 : VERSOS[i].split(',').length; };
  const qtdVersos = (id, c) => { const i = ORDEM.indexOf(id); return i < 0 ? 0 : +(VERSOS[i].split(',')[c - 1] || 0); };
  const DEUTERO = /^(tobias|judite|[12]macabeus|sabedoria|eclesiastico|baruc)$/;
  function livroBJ(rotulo){
    let n = semAc(rotulo).replace(/evangelho segundo sao|ep[ií]stola (aos|as|a|de sao|de)?|dos apostolos$/g, ' ').trim();
    n = n.replace(/^primeir[oa]\s+/, '1').replace(/^segund[oa]\s+/, '2').replace(/^terceir[oa]\s+/, '3');
    const k = n.replace(/[^a-z0-9]/g, '');
    if (DEUTERO.test(k)) return '';                                     // livro que o app não usa
    if (/^j[óÓ]$/i.test(rotulo.trim())) return 'jb';
    return { abdias: 'ob', habacuc: 'hc', atos: 'at' }[k] || NOMES[k] || null;
  }
  function formatoG(arquivos){
    const livros = {}; let total = 0;
    const ncxN = Object.keys(arquivos).find(n => /\.ncx$/i.test(n));
    const inicio = {};
    if (ncxN){
      const base = ncxN.replace(/[^/]*$/, '');
      for (const [, rot, src] of dec.decode(arquivos[ncxN]).matchAll(/<text>([^<]*)<\/text>\s*<\/navLabel>\s*<content src="([^"#]+)/g)){
        const id = livroBJ(limpa(rot)); if (id !== null) inicio[base + decodeURIComponent(src)] = id;
      }
    }
    let livro = null, cap = 0, ultV = 0, vAtual = 0, cands = [], pre = [], capPend = null, explic = 0;   // pre: texto depois de um título numerado
    let duvida = null;                       // "1" sem título de capítulo: pode ser só um número solto no meio do texto
    const guarda = (c, v, x) => { const k = ((livros[livro] = livros[livro] || {})[c] = livros[livro][c] || {}); if (!k[v]){ k[v] = x; total++; } else k[v] += ' ' + x; };
    const resolveDuvida = vSeguinte => {
      if (!duvida) return;
      const d = duvida; duvida = null;
      if (vSeguinte === 2){ cap++; vAtual = 1; ultV = 1; if (d.txt.length) guarda(cap, 1, d.txt.join(' ')); }      // era mesmo o começo de um capítulo
      else if (vSeguinte === d.ultV + 2){ vAtual = d.ultV + 1; if (d.txt.length) guarda(cap, vAtual, d.txt.join(' ')); }   // "1" no lugar do número certo
      else { vAtual = d.ultV; if (d.txt.length && vAtual) guarda(cap, vAtual, d.txt.join(' ')); }      // era um "1" solto: o texto continua o versículo anterior
    };
    const novoLivro = id => { duvida = null; livro = id || null; cap = 0; ultV = 0; vAtual = 0; cands = []; pre = []; capPend = null; explic = 0; };
    const TOK = /<sup[^>]*>\s*<span class="none(\d*)">([^<]*)<\/span>\s*<\/sup>|<h1[^>]*>([\s\S]*?)<\/h1>|<span class="(none\d*)">([\s\S]*?)<\/span>/g;
    for (const nome of espinhaDe(arquivos)){
      if (nome in inicio) novoLivro(inicio[nome]);
      if (!/\.x?html?$/i.test(nome)) continue;
      let t = dec.decode(arquivos[nome]); t = t.slice(t.indexOf('<body'));
      for (const m of t.matchAll(TOK)){
        if (m[2] !== undefined){                                        // número de versículo
          let n = m[2].trim();
          if (m[1] === '5'){ resolveDuvida(0); vAtual = 0; continue; }       // números em destaque: acréscimos gregos (Ester, Daniel 3,51-90)
          if (m[1] !== '5' && /^\d+[a-z]$/.test(n)){                         // Abdias 1a, 1b, 1c: partes do mesmo versículo
            const b = parseInt(n, 10);
            if (b !== 1){ resolveDuvida(0); vAtual = 0; continue; }          // Ester 9,19a; 4,17a…: acréscimos gregos (ficam de fora)
            if (b === vAtual && cap){ continue; }                            // continua o mesmo versículo
            n = String(b);
          }
          if (!/^\d+$/.test(n)){ resolveDuvida(0); vAtual = 0; continue; }       // Ester 3,13b…: acréscimos gregos (ficam de fora)
          let v = +n;
          const tot0 = qtdVersos(livro, cap);
          if (tot0 && v > tot0 + 5 && n.length > 2 && (+n.slice(1) === ultV + 1 || +n.slice(0, -1) === ultV + 1)) v = ultV + 1;   // "220" ou "211" no lugar de "20"/"21"
          resolveDuvida(v);
          if (explic){                                                          // título só com o nº: o capítulo é esse (1Rs 4–5 vai e volta)
            cap = explic; explic = 0; cands = []; pre = []; capPend = null;
            const k = (livros[livro] || {})[cap]; if (k && k[v]){ delete k[v]; total--; }
            ultV = v; vAtual = v; continue;
          }
          if (capPend && (capPend.n !== cap + 1 || ++capPend.conta > 3)) capPend = null;
          if (cands.includes(cap + 1)) capPend = { n: cap + 1, conta: 0 };
          if (v !== 1 && v <= 3 && v < ultV && capPend){                       // título "14 …" e o versículo 1 sem número (ou com nº errado: Dn 6)
            cap++; capPend = null; if (pre.length){ const x = pre.join(' ').replace(/^[^—]{0,80}—\s*/, '').replace(/^[—–\-\s]+/, ''); if (x) guarda(cap, 1, x); }
            cands = []; pre = []; ultV = v; vAtual = v; continue;
          }
          const tot = qtdVersos(livro, cap);
          // a fonte pulou o início do capítulo (ex.: Lv 14.1-9): o capítulo anterior já tinha chegado ao fim
          const jaTem = cap && ((livros[livro] || {})[cap] || {})[v];         // a Jerusalém às vezes muda versículos de lugar (Is 38,21-22): aí o nº ainda não apareceu
          if (v !== 1 && v <= 10 && v < ultV - 5 && !cands.length && cap && tot && ultV >= tot && ultV <= tot + 1 && jaTem){
            cap++; cands = []; pre = []; ultV = v; vAtual = v; continue;
          }
          if (v !== 1 && pre.length && cap && vAtual) guarda(cap, vAtual, pre.join(' ').replace(/^[—–\-\s]+/, ''));   // não era capítulo novo: o texto continua
          pre = [];
          if (v === 1){
            capPend = null;
            const ok = cands.filter(c => c > cap && c <= cap + 5);
            if (cap === 0) cap = 1;
            else if (ok.length) cap = cap + 1;                                   // título com nº de capítulo (alguns vêm com nº errado)
            else if (cands.length){
              const k = (livros[livro] || {})[cap];
              if (cands.includes(cap) && (!k || Object.keys(k).length <= 2)){    // Ester: o acréscimo grego antes do cap. 1 também é "1"
                if (k){ total -= Object.keys(k).length; delete livros[livro][cap]; }
              } else cap = cap + 1;                                            // título com nº errado (2Ts 2 vem como "1")
            }
            else { duvida = { ultV, txt: [] }; cands = []; continue; }        // decide no próximo número
          }
          const k = cap && (livros[livro] || {})[cap], anterior = ultV;
          cands = []; ultV = v; vAtual = v;
          if (k && k[v]){
            if (v === anterior){ vAtual = 0; continue; }                     // Ester 3,13 "13": começo de um acréscimo grego (fica de fora)
            delete k[v]; total--;                                            // Dn 3,24-30 de novo depois do cântico grego: fica o último
          }
          continue;
        }
        const titulo = limpa(m[3] !== undefined ? m[3] : (m[4] === 'none' ? m[5] : ''));
        if (m[3] !== undefined || m[4] === 'none'){
          if (titulo && titulo === titulo.toUpperCase() && /[A-ZÀ-Ú]{3}/.test(titulo)){
            const id = livroBJ(titulo); if (id !== null){ novoLivro(id); continue; }
          }
          if (/^\d+$/.test(titulo) && cap && Math.abs(+titulo - cap) === 1 && +titulo <= qtdCaps(livro) + 2){ explic = +titulo; continue; }
          const x = titulo.match(/^(?:salmo\s+)?(\d+)(?!\d)/i);
          if (x) cands.push(+x[1]);
          continue;
        }
        if ((m[4] === 'none1' || m[4] === 'none3') && livro){
          const bruto = limpa(m[5]); if (!bruto || /^[\s—–\-()]+$/.test(bruto)) continue;
          if (cands.length){ pre.push(bruto); continue; }                      // pode ser o resto do título: decide no próximo número
          const x = bruto.replace(/^[—–\-\s]+/, ''); if (!x) continue;
          if (duvida){ duvida.txt.push(x); continue; }
          if (cap && vAtual) guarda(cap, vAtual, x);
        }
      }
    }
    resolveDuvida(0);
    // a fonte repete alguns capítulos (Sl 90 e 91 aparecem duas vezes): tira a cópia e renumera os seguintes
    for (const id of Object.keys(livros)){
      const caps = Object.keys(livros[id]).map(Number).sort((a, b) => a - b), recentes = [], novo = {}; let n = 0;
      for (const c of caps){
        const vs = livros[id][c];
        const assin = Object.keys(vs).map(Number).sort((a, b) => a - b).slice(0, 2).map(v => vs[v]).join(" ").slice(0, 200);
        const ks = Object.keys(vs).map(Number).sort((a, b) => a - b);
        const pedaco = ks.length > 2 && ks[0] === 1 && ks[1] > 10;                 // "Sl 91": v. 1 e depois 39-52 de outro salmo (colado errado na fonte)
        if (pedaco || (assin.length > 60 && recentes.includes(assin))){ total -= ks.length; continue; }
        recentes.push(assin); if (recentes.length > 3) recentes.shift();
        novo[++n] = vs;
      }
      livros[id] = novo;
    }
    return { livros, total };
  }
  // ---------- formato H (Bíblia Hebraica, Ed. Sêfer: só o Antigo Testamento) ----------
  // um arquivo por livro (Samuel, Reis, Crônicas e Esdras–Neemias vêm juntos, separados por <p class="tit-n1">);
  // capítulo: <span class="cap-num">N</span>; versículo: <span class="vers">N</span>
  const ARQ_HEB = { genesis: 'gn', exodo: 'ex', levitico: 'lv', numeros: 'nm', deuter: 'dt', josue: 'js', juizes: 'jz', samuel: '1sm',
    reis: '1rs', isaias: 'is', jeremias: 'jr', ezequiel: 'ez', oseias: 'os', joel: 'jl', amos: 'am', obadias: 'ob', jonas: 'jn', miha: 'mq',
    nahum: 'na', habacuc: 'hc', tsefania: 'sf', hagai: 'ag', zacarias: 'zc', malaquias: 'ml', salmos: 'sl', prov: 'pv', jo: 'jb',
    canticos: 'ct', rute: 'rt', lam: 'lm', eclesiastes: 'ec', ester: 'et', daniel: 'dn', ezra: 'ed', cronicas: '1cr' };
  function formatoH(arquivos){
    const livros = {}; let total = 0;
    const MARCA = /<p class="tit-n1"[^>]*>([\s\S]*?)<\/p>|<span class="cap-num"[^>]*>\s*(\d+)\s*<\/span>|<span class="vers"[^>]*>\s*(\d+)\s*<\/span>/g;
    for (const nome of espinhaDe(arquivos)){
      const a = nome.match(/\d\d_\d\d_([A-Za-z]+)\.x?html?$/);
      let livro = a && ARQ_HEB[a[1].toLowerCase()];
      if (!livro) continue;
      let t = dec.decode(arquivos[nome]); t = t.slice(t.indexOf('<body'));
      if (!/class="vers"/.test(t)) continue;
      t = t.replace(/<span class="heb"[^>]*>[\s\S]*?<\/span>/gi, '')
           .replace(/<p class="(cap-nom|tit-n[2-9]|subtit|p-nom\S*|p-ind\S*|sgc\S*|imcp)"[^>]*>[\s\S]*?<\/p>/gi, '');
      let cap = 0, v = 0;
      const partes = t.split(MARCA);                                   // [texto, tit-n1, cap, vers, texto, …]
      for (let i = 1; i + 3 <= partes.length; i += 4){
        if (partes[i] !== undefined){                                  // "2 Samuel", "Neemias"…
          const n = limpa(partes[i]); const id = idDoNome(n.replace(/\s+/g, ''));
          if (id){ livro = id; cap = 0; v = 0; }
        } else if (partes[i + 1] !== undefined){ cap = +partes[i + 1]; v = 0; }
        else { v = +partes[i + 2]; if (!cap) cap = 1; }
        const x = limpa(partes[i + 3] || '');
        if (!x || !cap || !v) continue;
        const c = ((livros[livro] = livros[livro] || {})[cap] = livros[livro][cap] || {});
        if (!c[v]){ c[v] = x; total++; } else c[v] += ' ' + x;
      }
    }
    // versículo que ficou sem marcação na fonte ("…vida. 30 E o seu sustento…", 2Rs 25,30): separa
    for (const caps of Object.values(livros)) for (const c of Object.values(caps)){
      for (let v = 1; v < 200; v++){
        if (!c[v] || c[v + 1]) continue;
        const m = c[v].match(new RegExp('^(.*[.;:!?»”"\'])\\s+' + (v + 1) + '\\s+([A-ZÀ-Ú“"«\'].*)$'));
        if (m){ c[v] = m[1]; c[v + 1] = m[2]; total++; }
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
    if (/biblia de jerusalem/.test(t)) return 'BJ';
    if (/biblia hebraica/.test(t)) return 'BH';
    if (/king james atualizada/.test(t)) return 'KJA';
    if (/king james/.test(t)) return 'KJV';
    return '';
  }
  // lê o EPUB (bytes) e devolve a Bíblia organizada
  async function lerEpub(bytes){
    if (!window.fflate) throw new Error('descompactador');
    let arquivos;
    try { arquivos = window.fflate.unzipSync(new Uint8Array(bytes), { filter: f => /\.(x?html?|opf|ncx|xml)$/i.test(f.name) }); }   /* só o texto: pula imagens (menos memória no iPad) */ catch { throw new Error('nao_epub'); }
    // DRM: só quando o texto (páginas) está criptografado; fontes "embaralhadas" não contam
    const enc = Object.keys(arquivos).find(n => /META-INF\/encryption\.xml$/i.test(n));
    if (enc && /<(enc:)?CipherReference[^>]*URI="[^"]+\.x?html?"/i.test(dec.decode(arquivos[enc]))) throw new Error('drm');
    const opf = Object.keys(arquivos).find(n => /\.opf$/i.test(n));
    const titulo = opf ? limpa((dec.decode(arquivos[opf]).match(/<dc:title[^>]*>([\s\S]*?)<\/dc:title>/i) || [])[1] || '') : '';
    let r = formatoA(arquivos), fmt = 'A';
    if (r.total < 1000){ r = formatoB(arquivos); fmt = 'B'; }
    if (r.total < 1000){ r = formatoC(arquivos); fmt = 'C'; }
    if (r.total < 1000){ r = formatoD(arquivos); fmt = 'D'; }
    if (r.total < 1000){ r = formatoE(arquivos); fmt = 'E'; }
    if (r.total < 1000){ r = formatoF(arquivos); fmt = 'F'; }
    if (r.total < 1000){ r = formatoG(arquivos); fmt = 'G'; }
    if (r.total < 1000){ r = formatoH(arquivos); fmt = 'H'; }
    if (r.total < 1000) throw new Error('formato');
    const nt = ['mt', 'mc', 'lc', 'jo', 'at', 'rm', 'ap'].some(id => r.livros[id]);
    return { titulo, sigla: siglaDoTitulo(titulo), livros: r.livros, total: r.total, nLivros: Object.keys(r.livros).length,
      soAT: !nt,                                   // Bíblia Hebraica: só o Antigo Testamento
      numeracaoHebraica: fmt === 'G' || fmt === 'H' };   // Jerusalém e Hebraica numeram como a Bíblia hebraica em alguns livros
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
    // versículo unido a outro (ex.: NTLH "26-27") fica guardado como "=26"
    const ini = v => { const x = vs[v]; return typeof x === 'string' && x[0] === '=' ? +x.slice(1) : v; };
    const fimDe = v => { let e = v; while (vs[e + 1] === '=' + v) e++; return e; };
    const rot = (a, e) => sobrescrito(a) + (e > a ? '⁻' + sobrescrito(e) : '');
    const blocos = ref.faixas.map(([a, b]) => {
      const out = []; let feito = 0;
      for (let v = ini(a); v <= b; v++){
        const i = ini(v); if (i <= feito || !vs[i] || vs[i][0] === '=') continue;
        const e = fimDe(i); out.push(rot(i, e) + ' ' + vs[i]); feito = e;
      }
      return out.join(' ');
    }).filter(Boolean);
    return blocos.join(' … ');
  }
  window.PVBiblia = { versao: '2.16.0', lerEpub, guardar, apagar, texto, idDoNome, siglaDoTitulo };
})();
