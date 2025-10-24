(function(){
  const $ = (s,r=document)=>r.querySelectorAll(s);
  function h(s){ let x=0; for (let i=0;i<s.length;i++) x = (x*1664525 + s.charCodeAt(i)+1013904223)>>>0; return x; }
  function rand(n,seed){ seed = (seed*1664525+1013904223)>>>0; return [ (seed/0xffffffff)*n, seed ]; }

  function makeSVG(title){
    let seed = h(title||'CQ');
    let a; [a,seed]=rand(360,seed); let b; [b,seed]=rand(360,seed);
    const c1 = `hsl(${a},70%,55%)`, c2 = `hsl(${b},70%,50%)`;
    return `
      <svg viewBox="0 0 1200 630" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${title}">
        <defs>
          <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
            <stop stop-color="${c1}" offset="0"/>
            <stop stop-color="${c2}" offset="1"/>
          </linearGradient>
        </defs>
        <rect width="1200" height="630" fill="#0b1220"/>
        <g opacity=".18" fill="url(#g)">
          <circle cx="300" cy="340" r="260"/>
          <circle cx="900" cy="290" r="240"/>
          <circle cx="640" cy="480" r="200"/>
        </g>
        <text x="60" y="420" font-family="ui-sans-serif,system-ui,Segoe UI" font-size="90" fill="#e5e9f0" font-weight="800">${(title||'CoffeeQuant')}</text>
        <text x="60" y="500" font-family="ui-monospace, SFMono-Regular, Menlo" font-size="40" fill="#9aa3af">math · markets · curiosity</text>
      </svg>`;
  }

  window.CQCover = {
    inject(el, title){
      if(!el) return;
      el.innerHTML = makeSVG(title);
    }
  };
})();
