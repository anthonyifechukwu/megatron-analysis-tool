const MEGATRON = {
  markets: [
    {name:"Volatility 10 Index", symbol:"R_10", price:1349.28, change:0.42, volatility:10},
    {name:"Volatility 25 Index", symbol:"R_25", price:2248.17, change:-0.31, volatility:25},
    {name:"Volatility 50 Index", symbol:"R_50", price:4812.64, change:0.77, volatility:50},
    {name:"Volatility 75 Index", symbol:"R_75", price:6174.39, change:1.08, volatility:75},
    {name:"Volatility 100 Index", symbol:"R_100", price:9021.51, change:-0.12, volatility:100}
  ],
  patterns: [
    ["Breakout",85],["Pullback",79],["Consolidation",81],["Divergence",88],
    ["Channel",84],["Surge",86],["Decline",80],["Volatility",83]
  ],
  strategies:["Even/Odd","Over/Under","Matches/Differs","Rise/Fall","Higher/Lower"],
  demo:true
};

function $(s,root=document){return root.querySelector(s)}
function $all(s,root=document){return [...root.querySelectorAll(s)]}
function toast(msg){
  let t=$(".toast"); if(!t){t=document.createElement("div");t.className="toast";document.body.appendChild(t)}
  t.textContent=msg;t.classList.add("show");clearTimeout(window._toast);window._toast=setTimeout(()=>t.classList.remove("show"),2400)
}
function initNav(){
  const page=document.body.dataset.page;
  $all(".nav-link").forEach(a=>a.classList.toggle("active",a.dataset.page===page));
  $all(".mobile-nav a").forEach(a=>a.classList.toggle("active",a.dataset.page===page));
}
function initTilt(){
  if(!window.matchMedia("(pointer:fine)").matches)return;
  $all(".tilt-card").forEach(card=>{
    card.addEventListener("mousemove",e=>{
      const r=card.getBoundingClientRect(),x=(e.clientX-r.left)/r.width-.5,y=(e.clientY-r.top)/r.height-.5;
      card.style.transform=`perspective(1000px) rotateX(${-y*7}deg) rotateY(${x*9}deg) translateY(-3px)`;
    });
    card.addEventListener("mouseleave",()=>card.style.transform="");
  })
}
function marketSelects(){
  $all("[data-market-select]").forEach(sel=>{
    sel.innerHTML=MEGATRON.markets.map((m,i)=>`<option value="${i}">${m.name}</option>`).join("");
    sel.addEventListener("change",()=>updateSelectedMarket(+sel.value))
  })
}
function updateSelectedMarket(i=0){
  const m=MEGATRON.markets[i]||MEGATRON.markets[0];
  $all("[data-live-price]").forEach(el=>el.innerHTML=`${m.price.toLocaleString()}<span>${(m.price%1).toFixed(2).slice(1)}</span>`);
  $all("[data-market-name]").forEach(el=>el.textContent=m.name);
  $all("[data-market-symbol]").forEach(el=>el.textContent=m.symbol);
}
function demoTicker(){
  setInterval(()=>{
    MEGATRON.markets.forEach(m=>m.price=+(m.price+(Math.random()-.5)*1.8).toFixed(2));
    updateSelectedMarket($("[data-market-select]")?.value ? +$("[data-market-select]").value : 0);
    $all("[data-demo-price]").forEach((el,i)=>el.textContent=MEGATRON.markets[i%MEGATRON.markets.length].price.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2}));
  },2000)
}
function renderPatterns(){
  const box=$("[data-pattern-list]");if(!box)return;
  box.innerHTML=MEGATRON.patterns.map(([name,score])=>`<div class="pattern-item"><div class="pattern-name">${name}</div><div class="pattern-score">${score}%</div><div class="pattern-bar"><div class="progress"><b style="width:${score}%"></b></div></div></div>`).join("");
}
function runAnalysis(){
  const result=$("[data-result]"),conf=$("[data-confidence]"),status=$("[data-scan-status]");
  if(!result)return;
  result.textContent="SCANNING"; result.classList.add("scanning");
  if(status)status.textContent="Processing market data…";
  setTimeout(()=>{
    const options=["ODD","EVEN","OVER","UNDER","MATCHES","DIFFERS"];
    const val=options[Math.floor(Math.random()*options.length)];
    const c=Math.floor(68+Math.random()*24);
    result.textContent=val;result.classList.remove("scanning");
    if(conf)conf.textContent=`${c}% confidence estimate`;
    if(status)status.textContent="Signal synthesis complete";
    const record={market:$("[data-market-name]")?.textContent||"Volatility 10 Index",strategy:$("[data-strategy]")?.value||"Even/Odd",result:val,confidence:c,time:new Date().toLocaleString()};
    const history=JSON.parse(localStorage.getItem("megatron_history")||"[]");history.unshift(record);localStorage.setItem("megatron_history",JSON.stringify(history.slice(0,50)));
    toast("Analysis completed");
    renderHistory();
  },1400)
}
function runDeepScan(){
  const btn=$("[data-deep-scan]"); if(!btn)return;
  const old=btn.textContent;btn.textContent="SCANNING…";btn.disabled=true;
  setTimeout(()=>{btn.textContent=old;btn.disabled=false;toast("Deep scan completed");$all("[data-scan-value]").forEach((e,i)=>e.textContent=[86,79,83,88,91][i]+"%")},1800)
}
function renderHistory(){
  const body=$("[data-history-body]");if(!body)return;
  const h=JSON.parse(localStorage.getItem("megatron_history")||"[]");
  body.innerHTML=h.length?h.map(x=>`<tr><td>${x.market}</td><td>${x.strategy}</td><td><span class="badge badge-green">${x.result}</span></td><td>${x.confidence}%</td><td>${x.time}</td></tr>`).join(""):`<tr><td colspan="5" class="empty">No analyses yet. Run an analysis to create history.</td></tr>`;
}
function renderMarkets(){
  const body=$("[data-market-body]");if(!body)return;
  const query=($("[data-market-search]")?.value||"").toLowerCase();
  const list=MEGATRON.markets.filter(m=>m.name.toLowerCase().includes(query));
  body.innerHTML=list.map((m,i)=>`<tr><td><strong>${m.name}</strong><br><small>${m.symbol}</small></td><td data-demo-price="${i}">${m.price.toFixed(2)}</td><td class="${m.change>=0?'positive':''}">${m.change>=0?"+":""}${m.change}%</td><td>${m.volatility}</td><td><span class="badge badge-green">Demo</span></td><td><a class="btn" style="padding:6px 9px;font-size:9px" href="analyzer.html">Analyze</a></td></tr>`).join("");
}
function digitChart(){
  const wrap=$("[data-digit-chart]");if(!wrap)return;
  const vals=[11,5,5,14,8,15,12,13,5,14];
  wrap.innerHTML=vals.map((v,i)=>`<div class="digit-bar" style="--h:${v*12}px"><span>${v}%</span></div>`).join("");
  const labels=$("[data-digit-labels]");if(labels)labels.innerHTML=vals.map((_,i)=>`<span>${i}</span>`).join("");
}
function chartDemo(){
  const svg=$("[data-chart-svg]");if(!svg)return;
  const pts=[];let y=145;
  for(let i=0;i<80;i++){y+= (Math.random()-.47)*15;y=Math.max(30,Math.min(245,y));pts.push([i*(100/79),y])}
  const d=pts.map((p,i)=>(i?"L":"M")+` ${p[0].toFixed(2)} ${p[1].toFixed(2)}`).join(" ");
  svg.innerHTML=`<defs><linearGradient id="lineg" x1="0" x2="1"><stop stop-color="#2edfff"/><stop offset="1" stop-color="#9a55ff"/></linearGradient></defs><path d="${d}" fill="none" stroke="url(#lineg)" stroke-width="2.5"/><path d="${d} L 100 270 L 0 270 Z" fill="url(#lineg)" opacity=".08"/>`;
}
function initSwitches(){
  $all(".switch").forEach(s=>s.addEventListener("click",()=>{s.classList.toggle("on");toast("Preference updated")}))
}
function initButtons(){
  $all("[data-run-analysis]").forEach(b=>b.addEventListener("click",runAnalysis));
  $all("[data-deep-scan]").forEach(b=>b.addEventListener("click",runDeepScan));
  $all("[data-clear-history]").forEach(b=>b.addEventListener("click",()=>{localStorage.removeItem("megatron_history");renderHistory();toast("History cleared")}));
  $all("[data-market-search]").forEach(i=>i.addEventListener("input",renderMarkets));
  $all("[data-demo-action]").forEach(b=>b.addEventListener("click",()=>toast("This control is ready for API/backend integration.")));
}
document.addEventListener("DOMContentLoaded",()=>{
  initNav();initTilt();marketSelects();updateSelectedMarket();demoTicker();renderPatterns();renderHistory();renderMarkets();digitChart();chartDemo();initSwitches();initButtons();
});
