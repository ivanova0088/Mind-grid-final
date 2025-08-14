/* ===== Helpers ===== */
const $  = s => document.querySelector(s);
const $$ = s => Array.from(document.querySelectorAll(s));
function showScreen(id){ $$('.screen').forEach(s=>s.classList.remove('active')); $('#'+id).classList.add('active'); }
function uid(){ return 'u_'+Math.random().toString(36).slice(2,9); }
function norm(s){return (s||'').replace(/\s/g,'').replace(/[أإآ]/g,'ا').replace(/ة/g,'ه').replace(/ى/g,'ي').toUpperCase();}

/* ===== Safe storage ===== */
function safeGet(key, fallback){ try{ const v=localStorage.getItem(key); return v?JSON.parse(v):fallback; }catch(e){ return fallback; } }
function safeSet(key, val){ try{ localStorage.setItem(key, JSON.stringify(val)); return true; }catch(e){ alert('التخزين معطّل (وضع خاص؟).'); return false; } }

/* ===== Users ===== */
let users = safeGet('mg_users', []);
let activeId = localStorage.getItem('mg_active') || null;

function computeAge(dob){ if(!dob) return 0; const d=new Date(dob), n=new Date(); let a=n.getFullYear()-d.getFullYear(); const m=n.getMonth()-d.getMonth(); if(m<0||(m===0&&n.getDate()<d.getDate())) a--; return Math.max(0,a); }
function renderUsers(){
  const box = $('#userList');
  box.innerHTML = users.map(u=>`
    <div class="card">
      <div class="row space-between">
        <div>
          <div style="font-weight:800">${u.name||"بدون اسم"}</div>
          <div class="help">${u.country||"—"} • ${u.age?u.age+" سنة":"—"} • ${u.difficulty||"—"}</div>
        </div>
        <div class="row">
          <button class="btn-primary" onclick="enterAs('${u.id}')">دخول</button>
          <button class="btn" onclick="delUser('${u.id}')">حذف</button>
        </div>
      </div>
    </div>
  `).join('');
}
function enterAs(id){ activeId=id; localStorage.setItem('mg_active',id); showScreen('games'); }
function delUser(id){ users=users.filter(u=>u.id!==id); safeSet('mg_users',users); renderUsers(); }
function saveUser(){
  const name=$('#name').value.trim();
  const country=$('#countryInput').value.trim();
  const dob=$('#dob').value; const age=computeAge(dob);
  const difficulty=$('#difficulty').value;
  const u={id:uid(),name,country,dob,age,difficulty,theme:null,progress:{}};
  users.push(u); if(!safeSet('mg_users',users)) return;
  renderUsers(); showScreen('userSelect');
}

/* ===== Theme loader ===== */
let themes=[], currentThemeId=null;
function applyTheme(id){
  const th = themes.find(x=>x.id===id); if(!th) return;
  currentThemeId=id;
  Object.entries(th.vars).forEach(([k,v])=> document.documentElement.style.setProperty(k,v));
  localStorage.setItem('mg_theme', id);
}
function cycleTheme(){
  if(!themes.length) return;
  const i = themes.findIndex(t=>t.id===currentThemeId);
  const next = themes[(i+1)%themes.length]; applyTheme(next.id);
}
fetch('themes.json').then(r=>r.json()).then(t=>{
  themes=t.themes||[]; const saved=localStorage.getItem('mg_theme')||t.default_theme_id||(themes[0]?.id);
  applyTheme(saved);
}).catch(()=>{});

/* ===== Data ===== */
let puzzles={}, countries=[];
fetch('puzzles.json').then(r=>r.json()).then(d=>puzzles=d||{}).catch(()=>puzzles={});
fetch('countries.json').then(r=>r.json()).then(list=>{
  countries=list||[]; const dl=$('#countryList'); if(dl) dl.innerHTML=countries.map(c=>`<option value="${c}">`).join('');
}).catch(()=>{});

/* ===== Wallet (بسيط) ===== */
function getWallet(){ return safeGet('mg_wallet',{coins:0,gems:0}); }
function setWallet(w){ safeSet('mg_wallet',w); $('#coins').textContent = w.coins; }
setWallet(getWallet()); // مزامنة البداية

/* ===== Crossword: Classic-Lite ===== */
let cwSol=[], cwDir='across', cwSize=9, gridCells=[], activeWord=null, lastTap=0;
let currentClueTab='across', currentClueIndex=0;

function showCrossword(){
  applyTheme('newspaper_white');   // ثيم Newspaper تلقائي
  showScreen('scrCrossword');
  loadCrosswordMode('standard');
  startTimer();
}

function loadCrosswordMode(mode){
  const set = puzzles.crossword||[];
  const p = (mode==='mini' ? set.find(x=>x.size===5) : set.find(x=>x.size===9)) || set[0];
  if(!p){ alert('لا توجد شبكة متقاطعة'); return; }
  $('#btn9').classList.toggle('active', p.size===9);
  $('#btn5').classList.toggle('active', p.size===5);
  $('#cwTitle').textContent = p.title || 'كلمات متقاطعة';
  cwSol=(p.solution||[]).map(r=>r.split('')); cwSize=cwSol.length;
  buildGrid(p); buildClues(p);
  currentClueTab='across'; currentClueIndex=0; renderClueBar();
  const first=p.clues?.across?.[0]||p.clues?.down?.[0]; if(first) { cwDir='across'; setActiveWordFromCell(first.row,first.col); }
}

function buildGrid(p){
  const grid=$('#cwGrid'); grid.innerHTML=''; gridCells=[];
  grid.style.gridTemplateColumns=`repeat(${cwSize}, ${cwSize===5?50:42}px)`;
  const numMap=new Map();
  (p.clues?.across||[]).forEach(c=>numMap.set(`${c.row},${c.col}`,c.num));
  (p.clues?.down  ||[]).forEach(c=>{ if(!numMap.has(`${c.row},${c.col}`)) numMap.set(`${c.row},${c.col}`,c.num); });

  for(let r=0;r<cwSize;r++){
    gridCells[r]=[];
    for(let c=0;c<cwSize;c++){
      const sol=cwSol[r]?.[c]||'#';
      const cell=document.createElement('div');
      if(sol==='#'){ cell.className='cw-cell cw-black'; grid.appendChild(cell); gridCells[r][c]={cell,input:null}; continue; }
      cell.className='cw-cell';
      const n=numMap.get(`${r},${c}`); if(n){ const s=document.createElement('span'); s.className='cw-num'; s.textContent=n; cell.appendChild(s); }
      const inp=document.createElement('input');
      inp.className='cw-input'; inp.maxLength=1; inp.autocomplete='off'; inp.spellcheck=false; inp.inputMode='text';
      inp.addEventListener('input',e=>{ e.target.value=e.target.value.replace(/\s/g,''); moveCaret(e.target,+1); });
      inp.addEventListener('keydown',e=>{ if(e.key==='Backspace'&&!e.target.value) moveCaret(e.target,-1,true); });
      cell.addEventListener('click',()=>onCellTap(r,c));
      cell.appendChild(inp); grid.appendChild(cell);
      gridCells[r][c]={cell,input:inp};
    }
  }
  activeWord=null; paintActive();
}

function onCellTap(r,c){
  if(!gridCells[r][c].input) return;
  const now=Date.now(); if(now-lastTap<300) toggleDir(); lastTap=now;
  setActiveWordFromCell(r,c);
}
function toggleDir(){ cwDir=(cwDir==='across')?'down':'across'; if(activeWord) setActiveWordFromCell(activeWord.row,activeWord.col); }
function findStart(r,c,dir){ if(dir==='across'){ while(c>0&&cwSol[r][c-1]!=='#') c--; return {r,c}; } else { while(r>0&&cwSol[r-1][c]!=='#') r--; return {r,c}; } }
function collectCells(r,c,dir){
  const list=[]; if(dir==='across'){ for(let cc=c;cc<cwSize&&cwSol[r][cc]!=='#';cc++) list.push({r,c:cc,cell:gridCells[r][cc].cell,input:gridCells[r][cc].input}); }
  else{ for(let rr=r;rr<cwSize&&cwSol[rr][c]!=='#';rr++) list.push({r:rr,c,cell:gridCells[rr][c].cell,input:gridCells[rr][c].input}); }
  return list;
}
function setActiveWordFromCell(r,c){
  if(!gridCells[r][c].input) return;
  const s=findStart(r,c,cwDir); const cells=collectCells(s.r,s.c,cwDir);
  activeWord={dir:cwDir,row:s.r,col:s.c,len:cells.length,cells}; paintActive();
  activeWord.cells[0]?.input?.focus();
}
function paintActive(){ for(let r=0;r<cwSize;r++) for(let c=0;c<cwSize;c++) gridCells[r][c].cell.classList.remove('cw-active'); if(!activeWord) return; activeWord.cells.forEach(x=>x.cell.classList.add('cw-active')); }
function moveCaret(target,step,clearPrev=false){
  if(!activeWord) return;
  const idx=activeWord.cells.findIndex(x=>x.input===target); if(idx===-1) return;
  const next=activeWord.cells[idx+step]; if(next&&next.input){ if(step<0&&clearPrev) next.input.value=''; next.input.focus(); }
}

/* —— Clue bar —— */
function renderClueBar(){
  const p=(puzzles.crossword||[]).find(x=>x.size===cwSize)||(puzzles.crossword||[])[0]; if(!p) return;
  const list=p.clues?.[currentClueTab]||[]; if(!list.length){ $('#clueNum').textContent='-'; $('#clueContent').textContent=''; $('#clueLen').textContent=''; return; }
  const idx=(currentClueIndex%list.length+list.length)%list.length; const cl=list[idx];
  $('#segAcross').classList.toggle('active', currentClueTab==='across');
  $('#segDown').classList.toggle('active', currentClueTab==='down');
  $('#clueNum').textContent=cl.num; $('#clueContent').textContent=cl.clue; $('#clueLen').textContent=`(${cl.answer.length})`;
}
function switchClueTab(tab){
  currentClueTab=tab; currentClueIndex=0; renderClueBar();
  const p=(puzzles.crossword||[]).find(x=>x.size===cwSize)||puzzles.crossword[0];
  const cl=p?.clues?.[tab]?.[0]; if(cl){ cwDir=tab==='across'?'across':'down'; setActiveWordFromCell(cl.row,cl.col); }
}
function selectClue(tab,index){
  currentClueTab=tab; currentClueIndex=index; renderClueBar();
  const p=(puzzles.crossword||[]).find(x=>x.size===cwSize)||puzzles.crossword[0];
  const list=p?.clues?.[tab]||[]; if(!list.length) return; const cl=list[(index%list.length+list.length)%list.length];
  cwDir=tab==='across'?'across':'down'; setActiveWordFromCell(cl.row,cl.col);
}
function nextClue(){ const p=(puzzles.crossword||[]).find(x=>x.size===cwSize)||puzzles.crossword[0]; const list=p?.clues?.[currentClueTab]||[]; if(!list.length) return; currentClueIndex=(currentClueIndex+1)%list.length; selectClue(currentClueTab,currentClueIndex); }
function prevClue(){ const p=(puzzles.crossword||[]).find(x=>x.size===cwSize)||puzzles.crossword[0]; const list=p?.clues?.[currentClueTab]||[]; if(!list.length) return; currentClueIndex=(currentClueIndex-1+list.length)%list.length; selectClue(currentClueTab,currentClueIndex); }

/* —— Checks / Pencil / Reveal —— */
function checkLetter(){
  const el=document.activeElement; if(!(el&&el.classList.contains('cw-input'))) return;
  const pos=findInputPos(el); if(!pos) return; const g=norm(cwSol[pos.r][pos.c]), v=norm(el.value); markCell(pos.r,pos.c, v===g);
}
function checkWord(){ if(!activeWord) return; activeWord.cells.forEach(x=>{ const g=norm(cwSol[x.r][x.c]), v=norm(x.input.value); markCell(x.r,x.c, v===g); }); }
function checkGrid(){
  for(let r=0;r<cwSize;r++) for(let c=0;c<cwSize;c++){
    const ref=gridCells[r][c]; const sol=cwSol[r]?.[c]||'#'; if(sol==='#'||!ref.input) continue;
    const v=norm(ref.input.value), g=norm(sol); markCell(r,c, v===g);
  }
}
function markCell(r,c,ok){ const cell=gridCells[r][c].cell; cell.classList.remove('cw-correct','cw-wrong'); if(gridCells[r][c].input?.classList.contains('pencil')) return; cell.classList.add(ok?'cw-correct':'cw-wrong'); }
function findInputPos(input){ for(let r=0;r<cwSize;r++) for(let c=0;c<cwSize;c++) if(gridCells[r][c].input===input) return {r,c}; return null; }
let pencil=false;
function togglePencil(){ pencil=!pencil; $('#pencilBtn').classList.toggle('btn-primary',pencil); for(let r=0;r<cwSize;r++) for(let c=0;c<cwSize;c++){ const ip=gridCells[r][c].input; if(ip) ip.classList.toggle('pencil',pencil); } }
function revealLetter(){
  if(!activeWord) return; const w=getWallet(); if(w.coins<=0){ alert('لا عملات كافية'); return; }
  const slot=activeWord.cells.find(x=>!x.input.value); if(!slot){ alert('لا خانات فارغة في هذه الكلمة'); return; }
  slot.input.value=cwSol[slot.r][slot.c]; w.coins--; setWallet(w);
}

/* —— Timer —— */
let t0=null, tint=null;
function startTimer(){ clearInterval(tint); t0=Date.now(); tint=setInterval(()=>{ const s=Math.floor((Date.now()-t0)/1000); const mm=String(Math.floor(s/60)).padStart(2,'0'); const ss=String(s%60).padStart(2,'0'); $('#timer').textContent=`${mm}:${ss}`; },1000); }

/* ===== Boot ===== */
renderUsers();
if('serviceWorker' in navigator){ /* يمكن إضافة sw.js لاحقًا */ }
