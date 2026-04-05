(function(){
  if (window.__cqWriteupRehaul) return;
  window.__cqWriteupRehaul = true;

  const d = document;
  const body = d.body;
  if (!body) return;
  body.classList.add('cq-rehaul');

  // Basic shell
  let article = d.querySelector('#cq-article') || d.querySelector('article');
  if (!article) {
    article = d.createElement('article');
    article.id = 'cq-article';
    while (body.firstChild) article.appendChild(body.firstChild);
    body.appendChild(article);
  }

  const oldNodes = Array.from(body.childNodes);
  const progress = d.createElement('div');
  progress.className = 'cq-progress';

  const shell = d.createElement('div');
  shell.className = 'cq-shell';
  const top = d.createElement('div');
  top.className = 'cq-top';
  top.innerHTML = '<a href="/">☕ CoffeeQuant</a><a href="/">All articles</a>';

  const wrap = d.createElement('div');
  wrap.className = 'cq-wrap';

  const main = d.createElement('main');
  main.className = 'cq-main';
  const aside = d.createElement('aside');
  aside.className = 'cq-aside';
  aside.innerHTML = '<h4>On this page</h4><div id="cqToc"></div>';

  // Move article into main
  if (article.parentElement !== main) main.appendChild(article);

  wrap.appendChild(main);
  wrap.appendChild(aside);
  shell.appendChild(top);
  shell.appendChild(wrap);

  // Clear & rebuild body safely
  body.innerHTML = '';
  body.appendChild(progress);
  body.appendChild(shell);

  // Keep old scripts that may include analytics/view counters
  oldNodes.forEach(n => {
    if (n && n.tagName === 'SCRIPT') body.appendChild(n);
  });

  // Cleanup legacy tags without rewriting content
  article.querySelectorAll('font').forEach(f => {
    f.removeAttribute('face');
    f.removeAttribute('color');
    f.removeAttribute('size');
  });

  // Reading meta + title polish
  const h1 = article.querySelector('h1') || article.querySelector('p b') || article.querySelector('b');
  if (h1 && h1.textContent && h1.textContent.trim().length > 2) {
    if (!article.querySelector('h1')) {
      const title = d.createElement('h1');
      title.textContent = h1.textContent.trim();
      article.insertBefore(title, article.firstChild);
    }
    d.title = (h1.textContent.trim().replace(/\s+/g,' ') + ' | CoffeeQuant');
  }

  const words = (article.textContent || '').trim().split(/\s+/).filter(Boolean).length;
  const mins = Math.max(1, Math.round(words/220));
  const meta = d.createElement('div');
  meta.className = 'cq-meta';
  meta.innerHTML = `<span>${words.toLocaleString()} words</span><span>${mins} min read</span>`;
  article.insertBefore(meta, article.children[1] || null);

  // Normalize headings for TOC
  article.querySelectorAll('h2,h3').forEach((h,i)=>{
    if (!h.id) h.id = 'sec-' + (i+1);
  });
  const toc = d.getElementById('cqToc');
  const heads = Array.from(article.querySelectorAll('h2,h3'));
  if (!heads.length) {
    toc.innerHTML = '<div class="cq-meta">No headings detected</div>';
  } else {
    toc.innerHTML = heads.map(h=>{
      const indent = h.tagName === 'H3' ? ' style="padding-left:16px"' : '';
      return `<a${indent} href="#${h.id}">${h.textContent.trim().slice(0,70)}</a>`;
    }).join('');
  }

  // Image fixes + lazy
  article.querySelectorAll('img').forEach((img,idx)=>{
    img.loading = 'lazy';
    img.decoding = 'async';
    if (!img.alt || !img.alt.trim()) img.alt = `Article image ${idx+1}`;
    img.addEventListener('error', ()=>{
      const bad = d.createElement('div');
      bad.className = 'cq-img-bad';
      bad.textContent = 'Image unavailable';
      img.replaceWith(bad);
    }, { once:true });
  });

  // Scroll progress
  const onScroll = () => {
    const max = d.documentElement.scrollHeight - window.innerHeight;
    const p = max > 0 ? (window.scrollY / max) * 100 : 0;
    progress.style.width = p.toFixed(2) + '%';
  };
  window.addEventListener('scroll', onScroll, {passive:true});
  onScroll();
})();
