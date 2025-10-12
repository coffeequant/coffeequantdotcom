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


