// ============================================================
// PREGADOR VISUAL — modo teleprompter (em teste, só para o administrador)
// Escrito do zero em JavaScript. Ideia inspirada no Textream
// (github.com/f/textream, de Fatih Kadir Akın, licença MIT) — ver Ajuda › Créditos.
//
// Três modos de rolagem:
//   constante — velocidade fixa ajustável
//   voz       — rola enquanto o microfone capta voz (só o volume; funciona sem internet)
//   palavras  — reconhecimento de fala: segue e destaca a palavra que está sendo lida
// ============================================================
(function(){
  const CORES = { amarelo: '245,200,66', verde: '61,220,132', azul: '79,163,255', rosa: '255,111,174', laranja: '255,154,60' };
  const SENS = { alta: 2.2, media: 3, baixa: 4.5 };          // quanto acima do ruído a voz precisa estar
  let CFG = Object.assign({ fs: 44, cor: 'amarelo', linha: 0.33, espH: false, espV: false, vel: 8, modo: 'constante', sens: 'media', cheia: false }, lerLS('pv.tp', {}));
  const salvar = () => gravarLS('pv.tp', CFG);
  const TP = { ativo: false, rodando: false, y: 0, esperado: -1, vel: 0, t: 0, salto: null, falando: false,
               actx: null, mic: null, rec: null, palavras: null, k: -1, ultimoAcerto: 0, ultimoOuvido: 0, ouvido: '' };
  window.TP_ESTADO = TP;
  const L = () => $('#leitura');
  const P = () => $('#pulpito');

  /* ---------- aparência ---------- */
  const css = document.createElement('style');
  css.textContent = `
#tp-vista{flex:1;min-height:0;position:relative;display:flex;flex-direction:column}
#pulpito.tp #tp-vista{transform:scale(var(--tpx,1),var(--tpy,1))}
#pulpito.tp .p-relogios{transform:scale(var(--tpx,1),var(--tpy,1))}
#pulpito.tp #conteudo{font-size:var(--tpfs,44px);line-height:1.45;max-width:1100px}
#pulpito.tp .p-cab-tit,#pulpito.tp .p-dir .versao,#pulpito.tp .p-dir [data-tema],#pulpito.tp #p-marcar,#pulpito.tp #p-topico,#pulpito.tp #p-prox,#pulpito.tp .v-mob,#pulpito.tp #p-base2{display:none!important}
#pulpito.tp.tp-cheia .p-sub{display:none}
#pulpito.tp.tp-cheia .p-topo{padding-top:calc(4px + env(safe-area-inset-top));padding-bottom:4px}
#p-tp.on{background:var(--ouro);color:#0F1B33;border-color:var(--ouro)}
#tp-faixa{position:absolute;left:0;right:0;top:calc(var(--tplinha,.33) * 100%);transform:translateY(-50%);height:calc(var(--tpfs,44px) * 1.6);pointer-events:none;z-index:2;
  background:rgba(var(--tpcor),.13);border-top:2px solid rgba(var(--tpcor),.55);border-bottom:2px solid rgba(var(--tpcor),.55)}
#tp-faixa::before{content:"";position:absolute;left:6px;top:50%;transform:translateY(-50%);border:11px solid transparent;border-left:15px solid rgb(var(--tpcor))}
#tp-palavra{position:fixed;z-index:30;pointer-events:none;border-radius:8px;background:rgba(var(--tpcor),.42);box-shadow:0 0 0 3px rgba(var(--tpcor),.35);transition:left .12s,top .12s,width .12s,height .12s}
.tp-barra{position:fixed;z-index:42;left:50%;bottom:calc(14px + env(safe-area-inset-bottom));transform:translateX(-50%);display:flex;flex-wrap:wrap;align-items:center;justify-content:center;gap:10px;
  max-width:calc(100vw - 24px);padding:10px 14px;background:var(--card);border:1.5px solid var(--ouro);border-radius:18px;box-shadow:var(--sombra);transition:opacity .35s,transform .35s}
.tp-barra.some{opacity:0;transform:translate(-50%,30px);pointer-events:none}
.tp-barra .icone{width:48px;height:48px}
.tp-barra .tp-play{width:60px;height:60px;background:var(--ouro);color:#0F1B33;border-color:var(--ouro)}
.tp-barra .passo b{min-width:34px;text-align:center;font-size:20px}
.tp-barra .seg button{padding:10px 12px;font-size:14px}
.tp-mic{display:none;align-items:center;gap:6px;padding:6px 10px;border-radius:999px;border:1.5px solid var(--linha);font-size:12px;font-weight:700;letter-spacing:.04em;color:var(--txt2);white-space:nowrap}
#pulpito.tp.tp-ouve .tp-mic{display:inline-flex}
.tp-mic svg{width:16px;height:16px}
.tp-mic .bar{display:inline-flex;align-items:flex-end;gap:2px;height:18px}
.tp-mic .bar i{display:block;width:4px;height:4px;border-radius:2px;background:var(--linha);transition:height .08s}
.tp-mic.voz{border-color:#3DDC84;color:#3DDC84}.tp-mic.voz .bar i{background:#3DDC84}
.tp-mic.erro{border-color:#E5484D;color:#E5484D}
.tp-cores{display:flex;gap:10px;flex-wrap:wrap}
.tp-cores button{width:40px;height:40px;border-radius:50%;border:3px solid transparent;cursor:pointer}
.tp-cores button.on{border-color:var(--txt)}
.tp-aj .opc{margin:14px 0}
.tp-aj input[type=range]{width:100%;accent-color:var(--ouro)}
.tp-aj a{color:var(--ouro);font-weight:700}
`;
  document.head.appendChild(css);

  /* ---------- montagem dos elementos ---------- */
  // botão no topo do púlpito
  const bt = document.createElement('button');
  bt.className = 'icone oculto'; bt.id = 'p-tp'; bt.title = 'Teleprompter';
  bt.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M7 8h10M7 12h10M7 16h6"/><path d="M19 10l2 2-2 2" stroke-width="1.6"/></svg>';
  $('#p-marcar').before(bt);
  // indicador do microfone, ao lado do cronômetro (fica visível mesmo com a barra escondida)
  const mic = document.createElement('span');
  mic.className = 'tp-mic'; mic.id = 'tp-mic';
  mic.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/></svg><span class="bar"><i></i><i></i><i></i><i></i><i></i></span><span id="tp-mic-rot"></span>';
  $('.p-relogios').appendChild(mic);
  // a área de leitura ganha uma "moldura" (para a faixa e o espelhamento)
  const vista = document.createElement('div'); vista.id = 'tp-vista';
  L().before(vista); vista.appendChild(L());
  const faixa = document.createElement('div'); faixa.id = 'tp-faixa'; faixa.className = 'oculto'; vista.appendChild(faixa);
  const real = document.createElement('div'); real.id = 'tp-palavra'; real.className = 'oculto'; P().appendChild(real);
  const barra = document.createElement('div'); barra.id = 'tp-barra'; barra.className = 'tp-barra oculto';
  const SVG = d => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
  barra.innerHTML = `
    <button class="icone" data-tp="voltar" title="Voltar algumas linhas">${SVG('<path d="M18 15l-6-6-6 6"/>')}</button>
    <button class="icone tp-play" data-tp="play" title="Rolar / pausar"></button>
    <button class="icone" data-tp="avancar" title="Avançar algumas linhas">${SVG('<path d="M6 9l6 6 6-6"/>')}</button>
    <div class="passo" title="Velocidade"><button class="icone" data-tp="vel-">−</button><b id="tp-vel"></b><button class="icone" data-tp="vel+">+</button></div>
    <div class="seg" id="tp-modo"><button data-m="constante">Constante</button><button data-m="voz">Pela voz</button><button data-m="palavras">Palavra a palavra</button></div>
    <button class="icone" data-tp="ajustes" title="Ajustes do teleprompter">${SVG('<path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6"/>')}</button>`;
  P().appendChild(barra);
  const ICO_PLAY = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>';
  const ICO_PAUSA = '<svg viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/></svg>';

  /* ---------- quem pode usar ---------- */
  function liberado(){ return !!(window.USUARIO_TP || (typeof USUARIO !== 'undefined' && USUARIO && USUARIO.admin)); }
  function pintarBotao(){ bt.classList.toggle('oculto', !liberado()); bt.classList.toggle('on', TP.ativo); }
  setInterval(pintarBotao, 1500); pintarBotao();

  /* ---------- geometria ---------- */
  // posição vertical real na tela (considera o espelhamento vertical)
  function topoNaTela(r){ if (!CFG.espV) return r.top; const v = vista.getBoundingClientRect(); return v.top + v.bottom - r.bottom; }
  window.topoNaTela = el => topoNaTela(el.getBoundingClientRect());
  window.linhaLeitura = () => TP.ativo ? CFG.linha : 1 / 3;
  const linhaY = () => { const v = vista.getBoundingClientRect(); return v.top + v.height * CFG.linha; };
  const maxY = () => L().scrollHeight - L().clientHeight;
  const pxs = () => CFG.vel * CFG.fs * 0.05;                    // velocidade em pixels por segundo

  function aplicar(){
    const p = P();
    p.style.setProperty('--tpfs', CFG.fs + 'px');
    p.style.setProperty('--tpcor', CORES[CFG.cor] || CORES.amarelo);
    p.style.setProperty('--tplinha', CFG.linha);
    p.style.setProperty('--tpx', CFG.espH ? -1 : 1);
    p.style.setProperty('--tpy', CFG.espV ? -1 : 1);
    p.classList.toggle('tp-cheia', TP.ativo && CFG.cheia);
    p.classList.toggle('tp-ouve', TP.ativo && CFG.modo !== 'constante');
    p.classList.toggle('esp-v', TP.ativo && CFG.espV);
    $('#tp-vel').textContent = CFG.vel;
    $$('#tp-modo button').forEach(b => b.classList.toggle('on', b.dataset.m === CFG.modo));
    barra.querySelector('[data-tp=play]').innerHTML = TP.rodando ? ICO_PAUSA : ICO_PLAY;
    barra.querySelector('.passo').style.display = CFG.modo === 'palavras' ? 'none' : '';
    if (TP.ativo){
      // espaço no alto: a primeira linha do sermão pode descer até a faixa de leitura
      const antes = parseFloat(L().style.paddingTop) || 0;
      const novo = Math.max(10, Math.round(L().clientHeight * CFG.linha - CFG.fs * 0.8));
      if (novo !== antes){ L().style.paddingTop = novo + 'px'; }
      if (typeof ajustarFolga === 'function') ajustarFolga();
    }
    pintarBotao();
  }

  /* ---------- entrar e sair ---------- */
  function entrar(){
    if (!liberado() || TP.ativo) return;
    if (typeof modoMarcar === 'function') modoMarcar(false);
    TP.ativo = true; TP.rodando = false; TP.vel = 0; TP.k = -1; TP.palavras = null;
    P().classList.add('tp'); faixa.classList.remove('oculto'); barra.classList.remove('oculto', 'some');
    aplicar(); TP.y = L().scrollTop; TP.esperado = -1;
    if (CFG.cheia) telaCheia(true);
    aviso('Teleprompter: toque em ▶ para começar');
    if (typeof rearmarAuto === 'function') rearmarAuto();
    requestAnimationFrame(quadro);
  }
  function sair(){
    if (!TP.ativo) return;
    pausar(); TP.ativo = false;
    P().classList.remove('tp', 'tp-cheia', 'tp-ouve', 'esp-v');
    faixa.classList.add('oculto'); barra.classList.add('oculto'); real.classList.add('oculto');
    L().style.paddingTop = '';
    if (typeof ajustarFolga === 'function') ajustarFolga();
    telaCheia(false); desligarMic();
    if (typeof rearmarAuto === 'function') rearmarAuto();
    pintarBotao();
  }
  bt.addEventListener('click', () => TP.ativo ? sair() : entrar());
  $('#p-voltar').addEventListener('click', sair, true);
  window.sairTeleprompter = sair;

  function telaCheia(ligar){
    const d = document, el = d.documentElement;
    try {
      if (ligar && !(d.fullscreenElement || d.webkitFullscreenElement)){ (el.requestFullscreen || el.webkitRequestFullscreen || (() => {})).call(el); }
      if (!ligar && (d.fullscreenElement || d.webkitFullscreenElement)){ (d.exitFullscreen || d.webkitExitFullscreen).call(d); }
    } catch {}
  }

  /* ---------- tocar, pausar, pular ---------- */
  async function tocar(){
    if (CFG.modo === 'voz' && !(await ligarMic())) return;
    if (CFG.modo === 'palavras' && !ligarFala()) return;
    TP.rodando = true; TP.y = L().scrollTop; TP.esperado = -1; aplicar(); esconderDepois();
  }
  function pausar(){
    TP.rodando = false; TP.vel = 0; TP.falando = false;
    pararFala(); aplicar(); mostrarBarra(true);
  }
  function alternar(){ TP.rodando ? pausar() : tocar(); }
  function pular(dir){
    const de = L().scrollTop, para = Math.max(0, Math.min(maxY(), de + dir * L().clientHeight * 0.22));
    TP.salto = { de, para, t0: performance.now() };
    if (CFG.modo === 'palavras') TP.k = -1;                          // reencontra a palavra na nova posição
  }
  // a barra some sozinha enquanto rola; volta com um toque
  let _esc = null;
  function mostrarBarra(fixa){ barra.classList.remove('some'); clearTimeout(_esc); if (!fixa) esconderDepois(); }
  function esconderDepois(){ clearTimeout(_esc); _esc = setTimeout(() => { if (TP.rodando) barra.classList.add('some'); }, 3500); }

  barra.addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    e.stopPropagation(); mostrarBarra(!TP.rodando);
    if (b.dataset.m){ return trocarModo(b.dataset.m); }
    const a = b.dataset.tp;
    if (a === 'play') alternar();
    else if (a === 'voltar') pular(-1);
    else if (a === 'avancar') pular(1);
    else if (a === 'vel-'){ CFG.vel = Math.max(1, CFG.vel - 1); salvar(); aplicar(); }
    else if (a === 'vel+'){ CFG.vel = Math.min(25, CFG.vel + 1); salvar(); aplicar(); }
    else if (a === 'ajustes') abrirAjustes();
  });
  // toque no texto: terço de cima volta, terço de baixo avança, meio pausa/continua
  vista.addEventListener('click', e => {
    if (!TP.ativo || P().classList.contains('marcando')) return;
    if (e.target.closest('.ref-link, span.nota, .slide-mk, a, button')) return;
    const r = vista.getBoundingClientRect(); let f = (e.clientY - r.top) / r.height; if (CFG.espV) f = 1 - f;
    mostrarBarra(!TP.rodando);
    if (f < 1 / 3) pular(-1); else if (f > 2 / 3) pular(1); else alternar();
  });
  // controle remoto / teclado: setas e Page Up/Down andam algumas linhas
  document.addEventListener('keydown', e => {
    if (!TP.ativo || !P().classList.contains('ativa') || e.target.closest('input, textarea, [contenteditable=true]')) return;
    if (!$('#caixa-texto').classList.contains('oculto')) return;
    if (['PageDown', 'ArrowDown', 'ArrowRight'].includes(e.key)){ e.preventDefault(); e.stopImmediatePropagation(); pular(1); }
    else if (['PageUp', 'ArrowUp', 'ArrowLeft'].includes(e.key)){ e.preventDefault(); e.stopImmediatePropagation(); pular(-1); }
  }, true);

  async function trocarModo(m){
    const rodava = TP.rodando;
    if (rodava) pausar();
    if (m !== 'voz') desligarMic();
    CFG.modo = m; salvar(); aplicar();
    preparaAudio();
    if (m === 'palavras') aviso('Experimental: o app tenta acompanhar a palavra que você lê. Precisa de internet.');
    if (rodava) tocar();
  }

  /* ---------- o motor da rolagem (60 vezes por segundo) ---------- */
  function quadro(t){
    if (!TP.ativo) return;
    const dt = Math.min(0.1, (t - (TP.t || t)) / 1000); TP.t = t;
    const l = L();
    if (TP.esperado >= 0 && Math.abs(l.scrollTop - TP.esperado) > 3){ TP.y = l.scrollTop; if (CFG.modo === 'palavras') TP.k = -1; }   // rolou com o dedo
    const caixaAberta = !$('#caixa-texto').classList.contains('oculto');
    medirMic(t);
    let mexeu = false;
    if (TP.salto){
      const f = Math.min(1, (t - TP.salto.t0) / 320), e = 1 - Math.pow(1 - f, 3);
      TP.y = TP.salto.de + (TP.salto.para - TP.salto.de) * e; mexeu = true;
      if (f >= 1) TP.salto = null;
    } else if (TP.rodando && !caixaAberta){
      let alvo = 0;
      if (CFG.modo === 'constante') alvo = pxs();
      else if (CFG.modo === 'voz') alvo = TP.falando ? pxs() : 0;
      else if (CFG.modo === 'palavras'){
        const r = retPalavra();
        if (r && t - TP.ultimoAcerto < 6000){
          const delta = topoNaTela(r) + r.height / 2 - linhaY();
          TP.y += delta * Math.min(1, dt * 2.5); mexeu = Math.abs(delta) > 0.5; alvo = 0; TP.vel = 0;
        } else if (TP.falando) alvo = pxs() * 0.7;               // falando fora do roteiro: segue devagar até reencontrar
      }
      TP.vel += (alvo - TP.vel) * Math.min(1, dt * 4);            // acelera e freia suave
      if (Math.abs(TP.vel) > 0.05){ TP.y += TP.vel * dt; mexeu = true; }
    } else TP.vel = 0;
    if (mexeu){
      TP.y = Math.max(0, Math.min(maxY(), TP.y));
      l.scrollTop = TP.y; TP.esperado = l.scrollTop;
      if (TP.rodando && CFG.modo === 'constante' && TP.y >= maxY() - 1){ pausar(); aviso('Fim do sermão'); }
    }
    pintarPalavra(); pintarMic(t);
    requestAnimationFrame(quadro);
  }

  /* ---------- microfone: rola enquanto há voz (só o volume) ---------- */
  function preparaAudio(){
    // no iPad o áudio só liga a partir de um toque: cria agora, enquanto o dedo está na tela
    try {
      if (!TP.actx){ const C = window.AudioContext || window.webkitAudioContext; if (C) TP.actx = new C(); }
      if (TP.actx && TP.actx.state === 'suspended') TP.actx.resume();
    } catch {}
  }
  async function ligarMic(){
    if (TP.mic) return true;
    preparaAudio();
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia || !TP.actx){ aviso('Este aparelho não deixa o app usar o microfone.'); mic.classList.add('erro'); return false; }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: false } });
      if (TP.actx.state === 'suspended') await TP.actx.resume();
      const src = TP.actx.createMediaStreamSource(stream), an = TP.actx.createAnalyser();
      an.fftSize = 1024; src.connect(an);
      TP.mic = { stream, src, an, buf: new Uint8Array(an.fftSize), piso: lerLS('pv.tpPiso', 0.004), nivel: 0, ultimaVoz: 0, inicioVoz: 0 };
      mic.classList.remove('erro');
      return true;
    } catch (err){
      mic.classList.add('erro');
      aviso(err && err.name === 'NotAllowedError' ? 'O microfone foi bloqueado. No iPad: Ajustes › Safari › Microfone › Permitir.' : 'Não consegui ligar o microfone.');
      return false;
    }
  }
  function desligarMic(){
    if (!TP.mic) return;
    try { TP.mic.stream.getTracks().forEach(k => k.stop()); TP.mic.src.disconnect(); } catch {}
    TP.mic = null; TP.falando = false;
  }
  function nivelAgora(){
    const m = TP.mic; m.an.getByteTimeDomainData(m.buf);
    let s = 0; for (let i = 0; i < m.buf.length; i++){ const v = (m.buf[i] - 128) / 128; s += v * v; }
    return Math.sqrt(s / m.buf.length);
  }
  function medirMic(t){
    if (CFG.modo === 'palavras'){ TP.falando = t - TP.ultimoOuvido < 1500; return; }
    const m = TP.mic; if (!m){ TP.falando = false; return; }
    const rms = nivelAgora(); m.nivel = rms;
    const limiar = Math.max(m.piso * (SENS[CFG.sens] || 3), 0.006);
    if (rms > limiar){
      if (!m.inicioVoz) m.inicioVoz = t;
      if (t - m.inicioVoz > 120){ TP.falando = true; m.ultimaVoz = t; }
    } else {
      m.inicioVoz = 0;
      if (t - m.ultimaVoz > 900) TP.falando = false;
      // o ruído do ambiente é acompanhado só no silêncio: desce rápido, sobe devagar
      m.piso = rms < m.piso ? m.piso * 0.9 + rms * 0.1 : Math.min(m.piso * 1.0003, 0.05);
    }
    m.limiar = limiar;
  }
  let _pm = 0;
  function pintarMic(t){
    if (t - _pm < 80) return; _pm = t;
    const rot = $('#tp-mic-rot'), barras = mic.querySelectorAll('.bar i');
    let nivel = 0;
    if (CFG.modo === 'voz' && TP.mic) nivel = Math.min(1, TP.mic.nivel / ((TP.mic.limiar || 0.02) * 2));
    else if (CFG.modo === 'palavras') nivel = TP.falando ? 0.4 + Math.random() * 0.5 : 0;
    barras.forEach((b, i) => { b.style.height = (4 + Math.max(0, Math.min(1, nivel * 1.3 - i * 0.18)) * 14) + 'px'; });
    mic.classList.toggle('voz', !!TP.falando && TP.rodando);
    const txt = !TP.rodando ? 'pausado'
      : CFG.modo === 'voz' ? (!TP.mic ? 'sem microfone' : TP.falando ? 'captando' : 'em silêncio')
      : (!TP.rec ? 'sem reconhecimento' : t - TP.ultimoAcerto < 2500 ? 'acompanhando' : TP.falando ? 'procurando no texto' : 'ouvindo');
    if (rot.textContent !== txt) rot.textContent = txt;
  }
  async function calibrar(){
    preparaAudio();
    if (!(await ligarMic())) return;
    aviso('Fique em silêncio por 3 segundos…');
    const amostras = [], fim = performance.now() + 3000;
    await new Promise(ok => { const f = () => { if (!TP.mic) return ok(); amostras.push(nivelAgora()); performance.now() < fim ? setTimeout(f, 50) : ok(); }; f(); });
    if (!amostras.length) return;
    amostras.sort((a, b) => a - b);
    const piso = Math.max(0.001, amostras[Math.floor(amostras.length * 0.6)] * 1.1);
    gravarLS('pv.tpPiso', piso); if (TP.mic) TP.mic.piso = piso;
    aviso('Microfone calibrado para este ambiente');
    if (CFG.modo !== 'voz' && !TP.rodando) desligarMic();
  }

  /* ---------- palavra a palavra (reconhecimento de fala, experimental) ---------- */
  const norm = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
  function indexar(){
    const lista = [];
    const w = document.createTreeWalker($('#conteudo'), NodeFilter.SHOW_TEXT, { acceptNode: n => n.parentElement.closest('.gerado, span.nota, .nota-linha') ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT });
    for (let n; (n = w.nextNode());){
      for (const m of n.nodeValue.matchAll(/[\p{L}\p{N}]+(?:[-'’][\p{L}\p{N}]+)*/gu)){ const x = norm(m[0]); if (x) lista.push({ n, i: m.index, f: m.index + m[0].length, w: x }); }
    }
    TP.palavras = lista;
  }
  const faixaDe = p => { const r = document.createRange(); r.setStart(p.n, p.i); r.setEnd(p.n, p.f); return r; };
  function retPalavra(){
    if (TP.k < 0 || !TP.palavras || !TP.palavras[TP.k]) return null;
    const p = TP.palavras[TP.k]; if (!p.n.isConnected){ TP.palavras = null; TP.k = -1; return null; }
    const rs = faixaDe(p).getClientRects(); return rs.length ? rs[0] : null;
  }
  // primeira palavra na faixa de leitura (ponto de partida da procura)
  function palavraNaLinha(){
    const lista = TP.palavras; if (!lista || !lista.length) return -1;
    const y = linhaY(); let a = 0, b = lista.length - 1;
    while (a < b){ const m = (a + b) >> 1, r = faixaDe(lista[m]).getBoundingClientRect(); (topoNaTela(r) + r.height < y) ? a = m + 1 : b = m; }
    return a;
  }
  function lev(a, b){
    if (Math.abs(a.length - b.length) > 2) return 9;
    const d = Array.from({ length: b.length + 1 }, (_, i) => i);
    for (let i = 1; i <= a.length; i++){
      let ant = d[0]; d[0] = i;
      for (let j = 1; j <= b.length; j++){ const tmp = d[j]; d[j] = Math.min(d[j] + 1, d[j - 1] + 1, ant + (a[i - 1] === b[j - 1] ? 0 : 1)); ant = tmp; }
    }
    return d[b.length];
  }
  // nomes bíblicos e variações de pronúncia: aceita palavras parecidas
  function parecida(a, b){
    if (a === b) return true;
    if (a.length < 3 || b.length < 3) return false;
    if (a.length >= 5 && b.length >= 5 && a.slice(0, 4) === b.slice(0, 4)) return true;
    return lev(a, b) <= (Math.max(a.length, b.length) >= 7 ? 2 : 1);
  }
  // alinha as últimas palavras ouvidas com o texto, perto de onde está a leitura
  function pontuar(ouv, j){
    const lista = TP.palavras; let s = 0, jj = j;
    for (let q = ouv.length - 1; q >= 0 && jj >= 0; q--){
      if (parecida(ouv[q], lista[jj].w)){ s++; jj--; }
      else if (jj > 0 && parecida(ouv[q], lista[jj - 1].w)){ s += 0.8; jj -= 2; }     // pulou uma palavra do texto
      if (j - jj > ouv.length + 3) break;
    }
    return s;
  }
  function acompanhar(texto){
    if (!TP.palavras) indexar();
    const lista = TP.palavras; if (!lista.length) return;
    const ouv = texto.split(/\s+/).map(norm).filter(Boolean).slice(-8); if (!ouv.length) return;
    if (TP.k < 0) TP.k = Math.max(0, palavraNaLinha() - 1);
    const k = TP.k;
    let melhor = -1, pont = 0;
    for (let j = Math.max(0, k - 6); j <= Math.min(lista.length - 1, k + 60); j++){
      const s = pontuar(ouv, j) - Math.abs(j - k) * 0.012 - (j < k ? 0.6 : 0);
      if (s > pont){ pont = s; melhor = j; }
    }
    const ok = melhor >= 0 && (pont >= Math.min(2, ouv.length - 0.2) || (pont >= 0.9 && lista[melhor].w.length >= 5 && melhor >= k && melhor <= k + 4));
    if (!ok){
      // pulou um trecho? procura mais adiante, exigindo uma sequência mais longa
      for (let j = k + 61; j <= Math.min(lista.length - 1, k + 500); j++){ const s = pontuar(ouv, j); if (s >= 4 && s > pont){ pont = s; melhor = j; } }
      if (pont < 4) return;
    }
    TP.k = melhor; TP.ultimoAcerto = performance.now();
  }
  function pintarPalavra(){
    const r = TP.ativo && CFG.modo === 'palavras' && TP.rodando && performance.now() - TP.ultimoAcerto < 6000 ? retPalavra() : null;
    if (!r){ real.classList.add('oculto'); return; }
    real.classList.remove('oculto');
    real.style.left = (r.left - 4) + 'px'; real.style.top = (r.top - 2) + 'px';
    real.style.width = (r.width + 8) + 'px'; real.style.height = (r.height + 4) + 'px';
  }
  function ligarFala(){
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR){ aviso('Este aparelho não oferece reconhecimento de fala ao app. Use “Pela voz”.'); return false; }
    if (!navigator.onLine){ aviso('Sem internet: “Palavra a palavra” precisa de conexão. Use “Pela voz”.'); return false; }
    if (TP.rec) return true;
    const r = new SR();
    r.lang = (typeof IDIOMA !== 'undefined' && IDIOMA === 'en') ? 'en-US' : 'pt-BR';
    r.continuous = true; r.interimResults = true; r.maxAlternatives = 1;
    r.onresult = e => {
      let txt = ''; for (let i = Math.max(0, e.results.length - 2); i < e.results.length; i++) txt += ' ' + e.results[i][0].transcript;
      TP.ultimoOuvido = performance.now(); TP.ouvido = txt;
      acompanhar(txt);
    };
    r.onerror = ev => {
      if (ev.error === 'no-speech' || ev.error === 'aborted') return;
      TP.rec = null; pausar();
      aviso(ev.error === 'not-allowed' || ev.error === 'service-not-allowed' ? 'O reconhecimento de fala foi bloqueado neste aparelho. Use “Pela voz”.'
        : ev.error === 'network' ? 'O reconhecimento de fala precisa de internet. Use “Pela voz”.' : 'O reconhecimento de fala parou (' + ev.error + ').');
    };
    // o iPad encerra o reconhecimento de tempos em tempos: religa enquanto estiver rolando
    r.onend = () => { if (TP.rec === r && TP.rodando && TP.ativo) setTimeout(() => { if (TP.rec === r) try { r.start(); } catch {} }, 250); };
    try { r.start(); } catch { aviso('Não consegui iniciar o reconhecimento de fala.'); return false; }
    TP.rec = r; TP.k = -1; TP.palavras = null; TP.ultimoAcerto = 0;
    return true;
  }
  function pararFala(){ const r = TP.rec; TP.rec = null; if (r) try { r.stop(); } catch {} real.classList.add('oculto'); }
  window.TP_ACOMPANHAR = acompanhar;     // usado nos testes

  /* ---------- ajustes ---------- */
  function abrirAjustes(){
    const cores = Object.keys(CORES).map(c => `<button data-cor-tp="${c}" class="${c === CFG.cor ? 'on' : ''}" style="background:rgb(${CORES[c]})" title="${c}"></button>`).join('');
    abrirModal(`
      <h2>Ajustes do teleprompter <button class="icone" onclick="fecharModal()" title="Fechar"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg></button></h2>
      <div class="tp-aj">
        <div class="opc"><label class="rot">Tamanho da letra</label>
          <div class="passo"><button class="icone" data-tpfs="-4">A−</button><b id="tpa-fs">${CFG.fs}</b><button class="icone" data-tpfs="4">A+</button></div></div>
        <div class="opc"><label class="rot">Cor do destaque</label><div class="tp-cores">${cores}</div></div>
        <div class="opc"><label class="rot">Posição da linha de leitura <b id="tpa-linha">${Math.round(CFG.linha * 100)}%</b></label>
          <input type="range" id="tpa-linha-in" min="15" max="60" step="1" value="${Math.round(CFG.linha * 100)}">
          <p class="dica">É também a linha que dispara os slides automáticos.</p></div>
        <div class="opc"><label class="rot">Tela cheia</label>
          <div class="seg"><button data-cheia="0" class="${CFG.cheia ? '' : 'on'}">Não</button><button data-cheia="1" class="${CFG.cheia ? 'on' : ''}">Sim</button></div>
          <p class="dica">Esconde a barra de tópicos e slides. A hora e o cronômetro continuam no topo.</p></div>
        <div class="opc"><label class="rot">Sensibilidade do microfone (modo “Pela voz”)</label>
          <div class="seg">${['baixa', 'media', 'alta'].map(s => `<button data-sens="${s}" class="${CFG.sens === s ? 'on' : ''}">${{ baixa: 'Baixa', media: 'Média', alta: 'Alta' }[s]}</button>`).join('')}</div>
          <button class="btn" id="tpa-calibrar" style="width:100%;justify-content:center;margin-top:10px">🎙 Calibrar no silêncio (3 segundos)</button>
          <p class="dica">Faça antes do culto, no lugar onde vai pregar. Em ambiente barulhento, use “Baixa”.</p></div>
        <details class="opc"><summary class="rot" style="cursor:pointer">Avançado: espelhamento (teleprompter de vidro)</summary>
          <div class="seg" style="margin-top:10px"><button data-esp="h" class="${CFG.espH ? 'on' : ''}">↔ Horizontal</button><button data-esp="v" class="${CFG.espV ? 'on' : ''}">↕ Vertical</button></div>
          <p class="dica">Só para usar com vidro refletor: o texto e o relógio aparecem invertidos no iPad.</p></details>
        <p class="dica" style="margin-top:16px">Toques no texto: terço de cima volta · meio pausa/continua · terço de baixo avança. <a href="#" id="tpa-creditos">Créditos</a></p>
      </div>`);
    const cx = $('#modal-caixa');
    cx.onclick = e => {
      const b = e.target.closest('button, a'); if (!b) return;
      if (b.dataset.tpfs){ CFG.fs = Math.max(24, Math.min(96, CFG.fs + +b.dataset.tpfs)); $('#tpa-fs').textContent = CFG.fs; }
      else if (b.dataset.corTp){ CFG.cor = b.dataset.corTp; cx.querySelectorAll('[data-cor-tp]').forEach(x => x.classList.toggle('on', x === b)); }
      else if (b.dataset.cheia){ CFG.cheia = b.dataset.cheia === '1'; cx.querySelectorAll('[data-cheia]').forEach(x => x.classList.toggle('on', x === b)); telaCheia(CFG.cheia); }
      else if (b.dataset.sens){ CFG.sens = b.dataset.sens; cx.querySelectorAll('[data-sens]').forEach(x => x.classList.toggle('on', x === b)); }
      else if (b.dataset.esp){ const k = b.dataset.esp === 'h' ? 'espH' : 'espV'; CFG[k] = !CFG[k]; b.classList.toggle('on', CFG[k]); }
      else if (b.id === 'tpa-calibrar'){ calibrar(); return; }
      else if (b.id === 'tpa-creditos'){ e.preventDefault(); fecharModal(); abrirCreditos(); return; }
      else return;
      salvar(); aplicar();
    };
    $('#tpa-linha-in').oninput = e => { CFG.linha = +e.target.value / 100; $('#tpa-linha').textContent = e.target.value + '%'; salvar(); aplicar(); };
  }
  function abrirCreditos(){
    if (typeof abrirAjuda !== 'function') return;
    if (TP.rodando) pausar();
    abrirAjuda();
    const d = document.getElementById('aj-creditos'); if (d){ d.open = true; setTimeout(() => d.scrollIntoView({ block: 'start' }), 60); }
  }
  window.abrirCreditos = abrirCreditos;

  // ao sair do app (trocar de app, bloquear a tela), pausa
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden' && TP.rodando) pausar(); });
})();
