(function(){
  const $ = (sel, root=document) => root.querySelector(sel);
  const $$ = (sel, root=document) => Array.from(root.querySelectorAll(sel));

  async function loadJSON(path){
    try {
      const r = await fetch(path, {cache:'no-store'});
      if(!r.ok) throw new Error('HTTP '+r.status);
      return await r.json();
    } catch(e){ return null; }
  }

  function fmtDate(iso){
    try { return new Date(iso).toLocaleDateString(undefined,{year:'numeric',month:'short',day:'numeric'}); }
    catch(e){ return ''; }
  }

  // --- Daily ---
  async function renderDaily(){
    const data = await loadJSON('statics/data/daily.json');
    const el = $('#dailyCard'); if(!el) return;
    if(!data || !data.items || !data.items.length){ el.innerHTML = '<div class="cq-skeleton">No daily items yet.</div>'; return; }

    // Pick by date if provided; else rotate by day-of-year
    let idx = 0;
    const today = new Date().toISOString().slice(0,10);
    const exact = data.items.findIndex(i => i.date === today);
    if (exact >= 0) idx = exact; else idx = (new Date().getDay()) % data.items.length;

    const it = data.items[idx];
    el.innerHTML = `
      <h3>${it.title}</h3>
      <p class="cq-muted">${it.deck || ''}</p>
      ${it.html ? `<div>${it.html}</div>` : ''}
      ${it.link ? `<div class="cq-actions"><a class="cq-btn-ghost" href="${it.link}">Open</a></div>` : ''}
      <div class="cq-muted" style="margin-top:.4rem;font-size:.9rem">${fmtDate(it.date) || ''}</div>
    `;

    // Typeset math inside daily card if present
    if (window.MathJax && MathJax.typesetPromise) {
      MathJax.typesetPromise([el]).catch(console.error);
    }
  }

  // --- Notes ---
  async function renderNotes(){
    const data = await loadJSON('statics/data/notes.json');
    const host = $('#notesList'); if(!host) return;
    if(!data || !data.items || !data.items.length){ host.innerHTML = '<div class="cq-skeleton">No notes yet.</div>'; return; }
    host.innerHTML = data.items.slice(0,6).map(n => `
      <div class="item">
        <a href="${n.href || '#'}"><strong>${n.title}</strong></a>
        <div class="cq-muted" style="font-size:.92rem">${n.deck || ''}</div>
        <div class="cq-muted" style="font-size:.85rem;margin-top:.2rem">${fmtDate(n.date)}</div>
      </div>
    `).join('');
  }

  // --- Curiosities ---
  async function renderCurios(){
    const data = await loadJSON('statics/data/curios.json');
    const host = $('#curiosList'); if(!host) return;
    if(!data || !data.items || !data.items.length){ host.innerHTML = '<div class="cq-skeleton">No curiosities yet.</div>'; return; }
    host.innerHTML = data.items.slice(0,10).map(n => `
      <div class="item">
        <a href="${n.href}" target="_blank" rel="noopener">${n.title}</a>
        <span class="cq-muted" style="font-size:.85rem">${fmtDate(n.date)}</span>
      </div>
    `).join('');
  }

  // Initial render
  renderDaily(); renderNotes(); renderCurios();

  // Optional: refresh the Daily module when tab becomes visible (if you later date-lock items)
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) renderDaily();
  });
})();

// --- Command palette (⌘K / Ctrl+K) ---
(function(){
  const el = document.getElementById('cqKbar');
  const input = document.getElementById('kbarInput');
  const list = document.getElementById('kbarList');
  const open = () => { el.classList.add('open'); input.value=''; render(''); input.focus(); };
  const close = () => { el.classList.remove('open'); };

  const items = [
    { k:'daily', t:'Open CoffeeQuant Daily', href:'#daily' },
    { k:'labs', t:'Open Labs', href:'#labs' },
    { k:'tools', t:'Open Tools', href:'#tools' },
    { k:'notes', t:'Open Notes', href:'#notes' },
    { k:'curios', t:'Open Curiosities', href:'#curios' },
    { k:'pricing', t:'Open Pricing CLI', href:'statics/Tools/PricingCLI.html' },
    { k:'dice', t:'Open Dice Puzzle', href:'statics/WriteUps/DicePuzzle.html' },
    { k:'kelly', t:'Open Bet Sizing (Kelly)', href:'statics/WriteUps/BetSizing.html' }
  ];

  function render(q){
    const ql = q.trim().toLowerCase();
    const match = items.filter(i => !ql || i.k.includes(ql) || i.t.toLowerCase().includes(ql));
    list.innerHTML = match.map(i=>`<div class="cq-kbar-item" data-href="${i.href}">${i.t}</div>`).join('') || '<div class="cq-kbar-item">No results</div>';
  }

  list.addEventListener('click', e => {
    const row = e.target.closest('.cq-kbar-item'); if(!row) return;
    const href = row.getAttribute('data-href');
    close(); if (href.startsWith('#')) location.hash = href; else location.href = href;
  });

  input.addEventListener('input', e => render(e.target.value));
  document.getElementById('openKbar')?.addEventListener('click', e => { e.preventDefault(); open(); });

  window.addEventListener('keydown', e => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); open(); }
    if (e.key === 'Escape' && el.classList.contains('open')) close();
  });
})();

(async function heroRotate(){
  const slot = document.getElementById('heroBg'); if(!slot) return;
  try{
    const r = await fetch('statics/data/hero.json', {cache:'no-store'});
    const data = await r.json();
    const list = (data && data.images) || [];
    if(!list.length) return;
    // pick by day-of-year (stable daily), or random:
    const idx = (new Date()).getDay() % list.length;
    const it = list[idx];
    slot.style.backgroundImage = `url("${it.src}")`;
    slot.setAttribute('aria-label', it.alt || 'hero image');
  }catch(e){}
})();


/* ===== Dojo-style nav: scroll spy + shortcuts ===== */
(function(){
  // Map section IDs to all nav anchors that point to them
  const sections = ['daily','labs','tools','notes','curios'];
  const linkSets = new Map();

  function collectLinks() {
    sections.forEach(id => {
      const sel = `a[href="#${id}"]`;
      linkSets.set(id, Array.from(document.querySelectorAll(sel)));
    });
  }

  function setActive(id){
    // remove from all
    document.querySelectorAll('.cq-navlinks a, .cq-dock a').forEach(a=>{
      a.classList.remove('is-active');
      a.removeAttribute('aria-current');
    });
    // add to matching
    const links = linkSets.get(id) || [];
    links.forEach(a => {
      a.classList.add('is-active');
      a.setAttribute('aria-current','page');
    });
  }

  // Scroll spy (highlights the section most in view)
  function initSpy(){
    collectLinks();
    const opts = { root: null, rootMargin: '0px 0px -60% 0px', threshold: 0.1 };
    const seen = new Map(); // track intersection ratios
    const io = new IntersectionObserver((entries)=>{
      entries.forEach(e=>{
        if (!sections.includes(e.target.id)) return;
        seen.set(e.target.id, e.isIntersecting ? e.intersectionRatio : 0);
      });
      // pick the section with highest ratio
      let best = null, bestR = 0;
      sections.forEach(id=>{
        const r = seen.get(id) || 0;
        if (r > bestR) { best = id; bestR = r; }
      });
      if (best) setActive(best);
    }, opts);

    sections.forEach(id=>{
      const el = document.getElementById(id);
      if (el) io.observe(el);
    });

    // Hash change (e.g., clicking a link)
    window.addEventListener('hashchange', ()=>{
      const id = (location.hash||'').replace('#','');
      if (sections.includes(id)) setActive(id);
    });

    // On load, highlight current hash if present
    const initId = (location.hash||'').replace('#','');
    if (sections.includes(initId)) setActive(initId);
  }

  // Keyboard shortcuts overlay (press ?)
  function initShortcuts(){
    // Reuse the command palette backdrop styles if you like; otherwise simple modal
    const modal = document.createElement('div');
    modal.id = 'cqShortcuts';
    modal.style.cssText = `
      position:fixed; inset:0; display:none; place-items:center; z-index:60;
      background:rgba(0,0,0,.35);
    `;
    modal.innerHTML = `
      <div style="
        width:min(720px,92vw); background:var(--bg); color:var(--fg);
        border:1px solid var(--line); border-radius:12px; box-shadow:0 20px 50px rgba(0,0,0,.25);
        padding:.8rem 1rem;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:.4rem">
          <strong>Keyboard shortcuts</strong>
          <button id="cqShortcutsClose" class="cq-btn-ghost" style="border-radius:8px;padding:.25rem .5rem">Esc</button>
        </div>
        <div style="display:grid;grid-template-columns:1fr auto;gap:.3rem .8rem;font-size:.95rem">
          <div>Open Daily</div><div><kbd>g</kbd> <kbd>d</kbd></div>
          <div>Open Labs</div><div><kbd>g</kbd> <kbd>l</kbd></div>
          <div>Open Tools</div><div><kbd>g</kbd> <kbd>t</kbd></div>
          <div>Open Notes</div><div><kbd>g</kbd> <kbd>n</kbd></div>
          <div>Open Curios</div><div><kbd>g</kbd> <kbd>c</kbd></div>
          <div>Command palette</div><div><kbd>⌘</kbd>/<kbd>Ctrl</kbd> + <kbd>K</kbd></div>
          <div>Search (if present)</div><div><kbd>/</kbd></div>
          <div>Show shortcuts</div><div><kbd>?</kbd></div>
        </div>
      </div>`;
    document.body.appendChild(modal);

    const open = ()=>{ modal.style.display = 'grid'; };
    const close = ()=>{ modal.style.display = 'none'; };

    document.getElementById('cqShortcutsClose').addEventListener('click', close);
    modal.addEventListener('click', (e)=>{ if(e.target === modal) close(); });

    // Key handling
    let awaitingGo = false; // after 'g', wait for next key
    window.addEventListener('keydown', (e)=>{
      // ignore when typing in inputs/textarea
      const tag = (e.target && e.target.tagName || '').toLowerCase();
      if (tag === 'input' || tag === 'textarea' || e.target.isContentEditable) return;

      // show shortcuts
      if (e.key === '?'){ e.preventDefault(); open(); return; }
      if (e.key === 'Escape'){ if (modal.style.display === 'grid') close(); return; }

      // quick search focus (if you add a search input with id="cqSearch")
      if (e.key === '/'){ const s=document.getElementById('cqSearch'); if(s){ e.preventDefault(); s.focus(); } return; }

      // g-then-*
      if (!awaitingGo && (e.key.toLowerCase() === 'g')) { awaitingGo = true; setTimeout(()=>awaitingGo=false, 1200); return; }
      if (awaitingGo){
        awaitingGo = false;
        const k = e.key.toLowerCase();
        const jump = id => { location.hash = '#'+id; setActive(id); };
        if (k === 'd') { jump('daily'); }
        else if (k === 'l') { jump('labs'); }
        else if (k === 't') { jump('tools'); }
        else if (k === 'n') { jump('notes'); }
        else if (k === 'c') { jump('curios'); }
      }
    });
  }

  // Run
  initSpy();
  initShortcuts();
})();
