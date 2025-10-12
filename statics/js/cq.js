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

