/* ========= crossword.js (Smart Dock) ========= */
import { $, showScreen, escapeHtml, matchAnswer, getWallet, setWallet } from './core.js';

/* شبكة احتياطية عند فشل ملف اليوم */
const CW_FALLBACK = {
  date:"fallback", gridSize:9,
  grid:["..#....#.","...#.....",".#..#..#.",".........","...#...#.",".#....#..",".....#...",".#..#..#.",".#....#.."],
  clues:{
    across:[{n:1,r:0,c:0,len:2,text:"حرفا عطف"},{n:2,r:0,c:3,len:4,text:"مدينة مغربية زرقاء"},{n:3,r:1,c:0,len:3,text:"غاز نبيل (54)"},{n:4,r:1,c:4,len:5,text:"بلد عاصمته هلسنكي"}],
    down:[{n:1,r:0,c:0,len:3,text:"عالم نحو بصري"},{n:2,r:0,c:1,len:4,text:"وحدة شدة التيار"}]
  },
  answers:{across:{"1":"او","2":"شفشاون","3":"زينون","4":"فنلندا"},down:{"1":"المبرد","2":"أمبير"}}
};

let cw=null;

/* ========== تحميل وفتح ========== */
export async function openCrossword(){
  try{ await loadCrossword(); }catch(e){ console.warn('CW error',e); buildCrossword(CW_FALLBACK); notify('(تجريبي) تم فتح شبكة احتياطية.'); }
  showScreen('scrCrossword');
}
async function loadCrossword(){
  const resp=await fetch('content/crossword_daily.json?v='+Date.now(),{cache:'no-store'});
  if(!resp.ok) throw new Error('HTTP '+resp.status);
  const text=await resp.text();
  const data=JSON.parse(text);
  buildCrossword(data);
}

/* ========== بناء الواجهة ========== */
function buildCrossword(data){
  cw = {
    data, size:data.gridSize||(data.grid?.[0]?.length||9), dir:'across',
    boardEl:$('#cwBoard'), feedback:$('#cwFeedback'), dateEl:$('#cwDate'),
    cells:[], startMap:{across:new Map(),down:new Map()}, coverMap:{across:new Map(),down:new Map()},
    slots:{across:[],down:[]}, answers:{across:data.answers?.across||{}, down:data.answers?.down||{}},
    sheetIndex:0, flags:new Map()
  };
  if(cw.dateEl) cw.dateEl.textContent=data.date||'—';

  (data.clues?.across||[]).forEach(s=>{ cw.slots.across.push(s); cw.startMap.across.set(key(s.r,s.c),s.n); for(let i=0;i<s.len;i++) cw.coverMap.across.set(key(s.r,s.c+i),s.n); });
  (data.clues?.down||[]).forEach(s=>{ cw.slots.down.push(s);   cw.startMap.down.set(key(s.r,s.c),s.n);   for(let i=0;i>s.len;i++){} }); // fix loop below
  // correct down cover filling:
  (data.clues?.down||[]).forEach(s=>{ for(let i=0;i<s.len;i++) cw.coverMap.down.set(key(s.r+i,s.c),s.n); });

  const G=data.grid||Array.from({length:cw.size},()=>'.'.repeat(cw.size));
  cw.boardEl.innerHTML=''; cw.cells=Array.from({length:cw.size},()=>Array(cw.size).fill(null));
  for(let r=0;r<cw.size;r++){
    for(let c=0;c<cw.size;c++){
      const ch=G[r][c];
      const cell=document.createElement('div'); cell.className='cw-cell'; cell.dataset.r=r; cell.dataset.c=c;
      const nA=cw.startMap.across.get(key(r,c)); const nD=cw.startMap.down.get(key(r,c)); const number=nA??nD;
      if(ch==='#'){ cell.classList.add('cw-block'); }
      else{
        const inp=document.createElement('input'); inp.type='text'; inp.maxLength=1; inp.className='cw-letter'; inp.inputMode='text';
        inp.addEventListener('input',e=>onInput(e));
        inp.addEventListener('keydown',e=>onKey(e));
        inp.addEventListener('focus',()=>focusCell(r,c));
        cell.appendChild(inp);
      }
      if(number!=null){ const n=document.createElement('div'); n.className='cw-number'; n.textContent=number; cell.appendChild(n); }
      cell.addEventListener('click',()=>clickCell(r,c));
      cw.boardEl.appendChild(cell); cw.cells[r][c]=cell;
    }
  }

  setDir('across');
  if(cw.slots.across.length) selectSlot('across', cw.slots.across[0].n);
  else if(cw.slots.down.length){ setDir('down'); selectSlot('down', cw.slots.down[0].n); }
  renderCards(); // لقائمة البطاقات في الـSheet
}

/* ========== الورقة السفلية والبطاقات (تبقى) ========== */
const dirLabel = d => d==='across'?'أفقي':'عمودي';
export function cwToggleSheet(){ const sh=$('#cwSheet'); sh.dataset.open = (sh.dataset.open==='1'?'0':'1'); }
export function cwPrev(){ const list=cw.slots[cw.dir]; if(!list?.length) return; const i=Math.max(0,(cw.sheetIndex||0)-1); selectSlot(cw.dir,list[i].n); }
export function cwNext(){ const list=cw.slots[cw.dir]; if(!list?.length) return; const i=Math.min(list.length-1,(cw.sheetIndex||0)+1); selectSlot(cw.dir,list[i].n); }
export function cwSetDir(d){ setDir(d); renderCards(); }
function setDir(d){
  cw.dir=d;
  $('#segAcross')?.classList.toggle('active', d==='across');
  $('#segDown')?.classList.toggle('active', d==='down');
  $('#cwChipDir') && ($('#cwChipDir').textContent = dirLabel(d));
  renderCards();
}
function renderCards(){
  const list=cw.slots[cw.dir]||[];
  const cards=$('#cwCards'); if(!cards) return;
  cards.innerHTML=list.map((s,i)=>`
    <div class="cw-card ${flagClass(cw.dir,s.n)}" data-idx="${i}" data-n="${s.n}">
      <div class="cw-card-num">${s.n}</div>
      <div class="cw-card-text">${escapeHtml(s.text||'')}</div>
      <div class="cw-card-meta">${dirLabel(cw.dir)} • (${s.len})</div>
    </div>`).join('');
  cards.onclick=e=>{ const el=e.target.closest('.cw-card'); if(!el) return; selectSlot(cw.dir, +el.dataset.n); };
}
function syncSheet(dir,n){
  const list=cw.slots[dir]||[]; const idx=list.findIndex(s=>s.n===n); cw.sheetIndex=idx>=0?idx:0;
  $('#cwChipDir') && ($('#cwChipDir').textContent=dirLabel(dir));
  $('#cwChipNum') && ($('#cwChipNum').textContent=list[idx]?list[idx].n:'—');
  $('#cwChipLen') && ($('#cwChipLen').textContent=list[idx]?`(${list[idx].len})`:'');
  $('#cwClueTextSheet') && ($('#cwClueTextSheet').textContent=list[idx]? (list[idx].text||'—') : '—');
  document.querySelectorAll('.cw-card').forEach(c=>c.classList.remove('active'));
  const card=document.querySelector(`#cwCards .cw-card[data-n="${n}"]`); if(card){ card.classList.add('active'); card.scrollIntoView({behavior:'smooth',inline:'center',block:'nearest'}); }
}

/* ========== Smart Dock ========== */
function updateDock(dir,n){
  const s=getSlot(dir,n); if(!s) return;
  $('#dkDir').textContent = dirLabel(dir);
  $('#dkNum').textContent = s.n;
  $('#dkLen').textContent = `(${s.len})`;
  $('#dkClueText').textContent = s.text || '—';
  const status = cw.flags.get(flagKey(dir,n)) || 'new';
  $('#dkStatus').textContent = status==='later' ? 'لاحقًا' : 'لم يُحلّ';
  refreshProgressBoxes(dir,n);
}
function refreshProgressBoxes(dir,n){
  const s=getSlot(dir,n); if(!s) return;
  const boxes = [];
  for(let i=0;i<s.len;i++){
    const r=dir==='across'?s.r: s.r+i;
    const c=dir==='across'?s.c+i: s.c;
    const letter = cw.cells[r][c]?.querySelector('.cw-letter')?.value || '';
    boxes.push(`<span class="dk-slot ${letter? 'filled':''}">${letter?escapeHtml(letter.toUpperCase()):' '}</span>`);
  }
  $('#dkSlots').innerHTML = boxes.join('');
}

/* ========== اختيار الخانات والكتابة ========== */
const key = (r,c)=>`${r},${c}`;
const getSlot = (dir,n)=>(cw.slots[dir]||[]).find(s=>s.n===n);
function clearHighlights(){
  document.querySelectorAll('.cw-highlight').forEach(el=>el.classList.remove('cw-highlight'));
  document.querySelectorAll('.cw-active').forEach(el=>el.classList.remove('cw-active'));
}
function selectSlot(dir,n){
  cw.dir=dir; syncSheet(dir,n); clearHighlights(); updateDock(dir,n);
  const s=getSlot(dir,n); if(!s) return;

  for(let i=0;i<s.len;i++){
    const r=dir==='across'?s.r: s.r+i;
    const c=dir==='across'?s.c+i: s.c;
    const cell=cw.cells[r][c];
    if(cell && !cell.classList.contains('cw-block')) cell.classList.add('cw-highlight');
  }
  // أول خانة فارغة
  let focused=false;
  for(let i=0;i<s.len;i++){
    const r=dir==='across'?s.r: s.r+i;
    const c=dir==='across'?s.c+i: s.c;
    const inp=cw.cells[r][c]?.querySelector('.cw-letter');
    if(inp && !inp.value){ inp.focus(); focused=true; break; }
  }
  if(!focused){ const inp=cw.cells[s.r][s.c]?.querySelector('.cw-letter'); if(inp) inp.focus(); }
}
function clickCell(r,c){
  const nIn=cw.coverMap[cw.dir].get(key(r,c));
  if(nIn!=null){ selectSlot(cw.dir,nIn); return; }
  const other=cw.dir==='across'?'down':'across';
  const nOther=cw.coverMap[other].get(key(r,c));
  if(nOther!=null){ setDir(other); selectSlot(other,nOther); }
}
function focusCell(r,c){
  const cell=cw.cells[r][c]; if(!cell) return;
  document.querySelectorAll('.cw-active').forEach(el=>el.classList.remove('cw-active'));
  cell.classList.add('cw-active');
}
function move(step){
  const cur=cw.sheetIndex; const slot=cw.slots[cw.dir][cur]; if(!slot) return;
  let idx=0;
  for(let i=0;i<slot.len;i++){
    const r=cw.dir==='across'?slot.r:slot.r+i, c=cw.dir==='across'?slot.c+i:slot.c;
    const inp=cw.cells[r][c]?.querySelector('.cw-letter');
    if(inp===document.activeElement){ idx=i; break; }
  }
  let ni=Math.min(slot.len-1,Math.max(0,idx+step));
  const nr=cw.dir==='across'?slot.r:slot.r+ni, nc=cw.dir==='across'?slot.c+ni:slot.c;
  const ninp=cw.cells[nr][nc]?.querySelector('.cw-letter'); if(ninp){ ninp.focus(); ninp.select?.(); }
}
function onInput(e){ const v=e.target.value; e.target.value=(v||'').slice(-1).toUpperCase(); refreshCurrentDock(); move(+1); }
function onKey(e){
  const k=e.key;
  if(k==='Backspace'){ if(e.target.value){ e.target.value=''; } else move(-1); refreshCurrentDock(); e.preventDefault(); }
  else if(k==='ArrowLeft'||k==='ArrowUp'){ move(-1); e.preventDefault(); }
  else if(k==='ArrowRight'||k==='ArrowDown'){ move(+1); e.preventDefault(); }
  else if(k==='Enter'){ cwCheckWord(); e.preventDefault(); }
}
function refreshCurrentDock(){
  const list=cw.slots[cw.dir]; if(!list?.length) return;
  const n=list[cw.sheetIndex]?.n; if(n==null) return;
  refreshProgressBoxes(cw.dir,n);
}

/* ========== التحقق ========== */
function getWordLetters(dir,n){
  const s=getSlot(dir,n); if(!s) return '';
  let out=''; for(let i=0;i<s.len;i++){
    const r=dir==='across'?s.r: s.r+i, c=dir==='across'?s.c+i: s.c;
    const inp=cw.cells[r][c]?.querySelector('.cw-letter'); out+=(inp?.value||'');
  } return out;
}
function markSlot(dir,n,cls){
  const s=getSlot(dir,n); if(!s) return;
  for(let i=0;i<s.len;i++){
    const r=dir==='across'?s.r: s.r+i, c=dir==='across'?s.c+i: s.c;
    const cell=cw.cells[r][c]; if(!cell) continue;
    cell.classList.remove('cw-correct','cw-wrong'); if(cls) cell.classList.add(cls);
  }
}
export function cwCheckWord(){
  const dir=cw.dir; const n=cw.slots[dir][cw.sheetIndex]?.n; if(n==null) return;
  const user=getWordLetters(dir,n); const ans=cw.answers[dir][String(n)]||'';
  const ok=matchAnswer(user,ans,ans);
  markSlot(dir,n, ok?'cw-correct':'cw-wrong');
  notify(ok?'✔︎ كلمة صحيحة':'✖︎ غير صحيحة');
  if(ok){ const w=getWallet(); w.coins+=5; setWallet(w); }
}

/* ========== تلميحات ووسوم ========== */
const flagKey=(dir,n)=>`${dir}:${n}`;
const flagClass=(dir,n)=> (cw.flags.get(flagKey(dir,n))==='later'?'flag-later':'');
export function cwMarkLater(){
  const dir=cw.dir; const n=cw.slots[dir][cw.sheetIndex]?.n; if(n==null) return;
  const k=flagKey(dir,n);
  cw.flags.set(k, cw.flags.get(k)==='later' ? 'new' : 'later');
  updateDock(dir,n); renderCards();
}
export function cwHintLetter(){
  const dir=cw.dir; const n=cw.slots[dir][cw.sheetIndex]?.n; if(n==null) return;
  const s=getSlot(dir,n); const ans=(cw.answers[dir][String(n)]||'').toUpperCase(); if(!s||!ans) return;
  const w=getWallet(); if((w.coins||0)<10){ notify('لا توجد عملات كافية'); return; }
  // أول خانة فارغة
  for(let i=0;i<s.len;i++){
    const r=dir==='across'?s.r: s.r+i, c=dir==='across'?s.c+i: s.c;
    const inp=cw.cells[r][c]?.querySelector('.cw-letter');
    if(inp && !inp.value){
      inp.value = ans[i]||''; setWallet({...w, coins:w.coins-10}); break;
    }
  }
  refreshCurrentDock();
}
export function cwFlipDir(){
  // اعثر على الخلية النشطة وحاول اختيار الكلمة المتقاطعة في الاتجاه الآخر
  const active=document.querySelector('.cw-active'); if(!active){ setDir(cw.dir==='across'?'down':'across'); cwNext(); return; }
  const r=+active.dataset.r, c=+active.dataset.c;
  const other=cw.dir==='across'?'down':'across';
  const nOther=cw.coverMap[other].get(key(r,c));
  if(nOther!=null){ setDir(other); selectSlot(other,nOther); }
  else{ setDir(other); cwNext(); }
}

/* ========== بحث/فلترة ========== */
export function cwSearch(q){
  q=(q||'').trim();
  const cards=$('#cwCards'); if(!cards) return;
  const nodes=[...cards.querySelectorAll('.cw-card')];
  let first=null;
  nodes.forEach(n=>{
    const text=(n.querySelector('.cw-card-text')?.textContent||'');
    const show = !q || text.includes(q);
    n.style.display = show ? '' : 'none';
    if(show && !first) first=n;
  });
  if(first){ first.classList.add('active'); first.scrollIntoView({behavior:'smooth',block:'nearest'}); nodes.forEach(n=>{ if(n!==first) n.classList.remove('active'); }); }
}
export function cwFilter(mode){
  if(mode==='all'){ /* لا شيء */ }
  else if(mode==='across'){ setDir('across'); }
  else if(mode==='down'){ setDir('down'); }
  renderCards();
}

/* ========== مساعدات صغيرة ========== */
function notify(msg){ const fb=cw?.feedback; if(fb){ fb.textContent=msg; } }
