/* ========= Helpers ========= */
const $ = s => document.querySelector(s);
const $$ = s => Array.from(document.querySelectorAll(s));
function showScreen(id){ $$('.screen').forEach(s=>s.classList.remove('active')); $('#'+id).classList.add('active'); }
function uid(){ return 'u_'+Math.random().toString(36).slice(2,10); }
function escapeHtml(s){ return (s||'').replace(/[&<>"']/g, m=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[m])); }

/* ========= Safe Storage ========= */
function safeGet(k, fb){ try{ const v=localStorage.getItem(k); return v?JSON.parse(v):fb; }catch{ return fb; } }
function safeSet(k, v){ try{ localStorage.setItem(k, JSON.stringify(v)); return true; }catch{ alert('التخزين معطّل (وضع خاص؟)'); return false; } }

/* ========= Users ========= */
let users = safeGet('mg_users', []);
let activeId = localStorage.getItem('mg_active') || null;

function computeAge(dob){ if(!dob) return 0; const d=new Date(dob), n=new Date(); let a=n.getFullYear()-d.getFullYear(); const m=n.getMonth()-d.getMonth(); if(m<0||(m===0&&n.getDate()<d.getDate())) a--; return Math.max(0,a); }

function renderUsers(){
  const box = $('#userList');
  if(!box) return;
  box.innerHTML = users.map(u=>`
    <div class="card">
      <div class="row space-between">
        <div>
          <div style="font-weight:800">${u.name||'بدون اسم'}</div>
          <div class="help">${u.country||'—'} • ${u.age?u.age+' سنة':'—'} • ${labelDifficulty(u.difficulty||'hard')}</div>
        </div>
        <div class="row">
          <button class="btn-primary" onclick="enterAs('${u.id}')">دخول</button>
          <button class="btn" onclick="delUser('${u.id}')">حذف</button>
        </div>
      </div>
    </div>
  `).join('');
}
function labelDifficulty(d){ return d==='easy'?'سهل':d==='medium'?'متوسط':'صعب'; }
function enterAs(id){ activeId=id; localStorage.setItem('mg_active',id); const s=$('#odSummary'); if(s) s.innerHTML=''; showScreen('games'); }
function delUser(id){ users=users.filter(u=>u.id!==id); safeSet('mg_users',users); renderUsers(); }
function saveUser(){
  const name=$('#name').value.trim(), country=$('#countryInput').value.trim(), dob=$('#dob').value, diff=$('#difficulty').value;
  const u={id:uid(), name, country, dob, age:computeAge(dob), difficulty:diff, theme:null, progress:{}};
  users.push(u);
  if(!safeSet('mg_users',users)) return;
  activeId = u.id;
  localStorage.setItem('mg_active', u.id);
  renderUsers();
  showScreen('games'); // مباشرة لقائمة الألعاب
}

/* ========= Themes ========= */
let themes=[], currentThemeId=null;
function applyTheme(id){
  const th = themes.find(x=>x.id===id); if(!th) return;
  currentThemeId=id;
  Object.entries(th.vars).forEach(([k,v])=>document.documentElement.style.setProperty(k,v));
  localStorage.setItem('mg_theme', id);
}
function cycleTheme(){
  if(!themes.length) return; const i=themes.findIndex(t=>t.id===currentThemeId); const next=themes[(i+1)%themes.length]; applyTheme(next.id);
}
fetch('themes.json').then(r=>r.json()).then(t=>{
  themes=t.themes||[]; const saved=localStorage.getItem('mg_theme')||t.default_theme_id||(themes[0]?.id); applyTheme(saved);
}).catch(()=>{});

/* ========= Countries (datalist) ========= */
fetch('countries.json').then(r=>r.json()).then(list=>{
  const dl=$('#countryList'); if(dl) dl.innerHTML=(list||[]).map(c=>`<option value="${c}">`).join('');
}).catch(()=>{});

/* ========= Wallet ========= */
function getWallet(){ return safeGet('mg_wallet',{coins:200,gems:5}); }
function setWallet(w){ safeSet('mg_wallet',w); if($('#coins')) $('#coins').textContent=w.coins; if($('#wCoins')) $('#wCoins').textContent=w.coins; if($('#wGems')) $('#wGems').textContent=w.gems; }
function addDevCoins(){ const w=getWallet(); w.coins+=100; setWallet(w); }
function addDevGems(){ const w=getWallet(); w.gems+=10; setWallet(w); }
setWallet(getWallet());

/* ========= Normalize / Synonyms ========= */
function norm(s){
  const map = (window.MG&&MG.syn&&MG.syn.normalize) || {"أ":"ا","إ":"ا","آ":"ا","ة":"ه","ى":"ي","ؤ":"و","ئ":"ي","ـ":""," ":"","ٱ":"ا"};
  return (s||'').replace(/./g,ch=>map[ch]??ch).toUpperCase();
}
function matchAnswer(userInput, answer, displayAnswer){
  const targetKey = displayAnswer || answer;
  const nuser = norm(userInput);
  const ntarget = norm(answer);
  if(nuser===ntarget) return true;
  const syn = (window.MG&&MG.syn&&MG.syn.synonyms&&MG.syn.synonyms[targetKey]) || [];
  return syn.some(x=>norm(x)===nuser);
}

/* ========= Odyssey content ========= */
const MG_CONTENT_FILES=[
  'content/odyssey_config.json',
  'content/synonyms_ar.json',
  'content/hexa_bloom.json',
  'content/cipher_weave.json',
  'content/path_maze.json',
  'content/spiral_rings.json',
  'content/word_islands.json'
];
let MG=null;
async function loadOdysseyContent(){
  const [cfg,syn,a,e,c,b,d]=await Promise.all(MG_CONTENT_FILES.map(p=>fetch(p).then(r=>r.json())));
  MG = { cfg, syn, stages:{A:a, E:e, C:c, B:b, D:d} };
  const h=$('header h1'); if(h && !h.textContent.includes('•')) h.textContent+=' • المحتوى جاهز';
}
loadOdysseyContent().catch(()=>alert('تعذّر تحميل محتوى content/ — تأكد من المسارات وGitHub Pages'));

/* ========= Seeded random / rotation ========= */
function djb2(str){ let h=5381; for(let i=0;i<str.length;i++) h=((h<<5)+h)+str.charCodeAt(i); return h>>>0; }
function mulberry32(a){ return function(){ let t=a+=0x6D2B79F5; t=Math.imul(t^t>>>15,t|1); t^=t+Math.imul(t^t>>>7,t|61); return ((t^t>>>14)>>>0)/4294967296; } }
function seededShuffle(arr, rnd){ const a=[...arr]; for(let i=a.length-1;i>0;i--){ const j=Math.floor(rnd()*(i+1)); [a[i],a[j]]=[a[j],a[i]]; } return a; }

/* ========= Odyssey Game ========= */
let od = null;
const STAGE_LABELS = {
  A_HEXABLOOM:'HexaBloom (سداسي)',
  E_CIPHER:'Cipher Weave (شِفري)',
  C_PATHMAZE:'PathMaze (متاهة)',
  B_SPIRAL:'Spiral Rings (حلقات)',
  D_ISLANDS:'Word Islands (جزر)'
};
function todayKey(){ const d=new Date(); const yyyy=d.getFullYear(), mm=String(d.getMonth()+1).padStart(2,'0'), dd=String(d.getDate()).padStart(2,'0'); return `${yyyy}-${mm}-${dd}`; }
function startOdyssey(){
  if(!activeId){ alert('اختر مستخدمًا أولًا'); return; }
  if(!MG){ alert('المحتوى لم يُحمَّل بعد. أعد محاولة بعد ثوانٍ.'); return; }
  const user = users.find(u=>u.id===activeId) || {difficulty:'hard'};
  const cfg=MG.cfg; const seedStr = (cfg.seed_formula||'')+todayKey()+activeId;
  const rnd = mulberry32(djb2(seedStr));
  let order = [...cfg.rotation_order];
  if(cfg.daily_auto_rotate) order = seededShuffle(order, rnd);
  od = { user, cfg, order, stageIndex:0, items:[], i:0, answers:[], correct:[], timer:{t0:null,int:null,sec:0} };
  loadStage(od.order[0], rnd);
  showScreen('scrOdyssey');
}
function pickByDifficulty(pool, diff){
  const hard = pool.filter(x=>x.difficulty==='hard');
  const mid  = pool.filter(x=>x.difficulty==='medium');
  const easy = pool.filter(x=>x.difficulty==='easy');
  if(diff==='hard') return [...hard, ...mid, ...easy];
  if(diff==='medium') return [...mid, ...hard, ...easy];
  return [...easy, ...mid, ...hard];
}
function chooseN(list, n, rnd){ const L=[...list]; const res=[]; while(res.length<Math.min(n,L.length)){ const j=Math.floor(rnd()*L.length); res.push(L.splice(j,1)[0]); } return res; }
function idToLetter(stageId){ return stageId.split('_')[0]; }
function loadStage(stageId, rnd){
  const S = MG.stages[idToLetter(stageId)];
  const diff = (od.user?.difficulty)||'hard';
  const ordered = pickByDifficulty(S.pool, diff);
  const items = chooseN(ordered, 6, rnd).map(x=>{
    const clues = x.clues||['—']; const ci = Math.floor(rnd()*clues.length);
    const expectedLen = x.length || norm(x.display_answer||x.answer).length;
    return {...x, _clue: clues[ci], _len: expectedLen};
  });
  od.items = items; od.i=0; od.answers = Array(items.length).fill(''); od.correct = Array(items.length).fill(null);
  $('#odStageProgress').textContent = `${od.stageIndex+1} / ${od.order.length}`;
  $('#odStageName').textContent = STAGE_LABELS[stageId] || stageId;
  const accent = S.accent_color || getComputedStyle(document.documentElement).getPropertyValue('--primary');
  $('#odStageName').style.color = accent;
  startTimerForStage(stageId);
  renderCurrent();
}
function renderCurrent(){
  const it = od.items[od.i]; if(!it) return;
  $('#odClue').textContent = it._clue || '—';
  $('#odTopic').textContent = it.topic || '—';
  $('#odLen').textContent = it._len || '—';
  const inp = $('#odAnswer'); if(inp){ inp.value = od.answers[od.i] || ''; inp.focus(); }
  const fb = $('#odFeedback'); if(fb){ fb.className='help'; fb.textContent=''; }
  const sm = $('#odSummary'); if(sm) sm.innerHTML='';
}
function odPrev(){ if(!od) return; if(od.i>0){ od.i--; renderCurrent(); } }
function odNext(){ if(!od) return; if(od.i<od.items.length-1){ od.i++; renderCurrent(); } }
function odKey(e){ if(e.key==='Enter'){ e.preventDefault(); odCheck(); } }
function odCheck(){
  const it = od.items[od.i]; const inp=$('#odAnswer').value.trim();
  od.answers[od.i]=inp;
  const ok = matchAnswer(inp, it.answer, it.display_answer);
  od.correct[od.i]=ok;
  const fb=$('#odFeedback'); if(!fb) return;
  fb.textContent = ok? '✔︎ إجابة صحيحة' : '✖︎ غير صحيحة'; fb.className = ok? 'help ok' : 'help err';
  if(ok){ const w=getWallet(); w.coins+=5; setWallet(w); }
}
function startTimerForStage(stageId){
  stopTimer();
  const cfg=od.cfg, diff = (od.user?.difficulty)||'hard';
  const base = cfg.difficulty[diff] || cfg.difficulty.hard;
  const over = (cfg.stage_overrides && cfg.stage_overrides[stageId] && cfg.stage_overrides[stageId][diff]) || {};
  const timeSec = over.time_sec || base.time_sec;
  od.timer.allowed = timeSec;
  od.timer.sec = 0;
  od.timer.t0 = Date.now();
  od.timer.int = setInterval(()=>{
    od.timer.sec = Math.floor((Date.now()-od.timer.t0)/1000);
    const left = Math.max(0, timeSec - od.timer.sec);
    $('#odTimer').textContent = fmtMMSS(left);
    if(left<=0){ stopTimer(); autoFinishOnTime(); }
  }, 250);
}
function stopTimer(){ if(od&&od.timer&&od.timer.int){ clearInterval(od.timer.int); od.timer.int=null; } }
function fmtMMSS(s){ const mm=String(Math.floor(s/60)).padStart(2,'0'); const ss=String(s%60).padStart(2,'0'); return `${mm}:${ss}`; }
function autoFinishOnTime(){ const fb=$('#odFeedback'); if(fb){ fb.className='help err'; fb.textContent='انتهى الوقت — تقييم المرحلة…'; } odFinishStage(true); }
function odFinishStage(fromTimeout=false){
  const stageId = od.order[od.stageIndex];
  const cfg=od.cfg, diff=(od.user?.difficulty)||'hard';
  const base = cfg.difficulty[diff] || cfg.difficulty.hard;
  const over = (cfg.stage_overrides && cfg.stage_overrides[stageId] && cfg.stage_overrides[stageId][diff]) || {};
  const minAcc = (over.min_accuracy_pct || base.min_accuracy_pct) / 100;
  const total = od.items.length;
  const correct = od.correct.filter(x=>x===true).length;
  const acc = (correct/total);
  let cipherOK = true;
  if(stageId==='E_CIPHER' && over.min_cipher_progress_pct){
    cipherOK = (acc >= (over.min_cipher_progress_pct/100));
  }
  const pass = (acc >= minAcc) && cipherOK;
  const w=getWallet();
  const coinsGain = Math.round(acc*30) + (pass?20:0);
  w.coins += coinsGain; setWallet(w);
  const sum = $('#odSummary');
  if(sum) sum.innerHTML = `
    <div class="card soft">
      <div><b>نتيجة المرحلة:</b> ${pass?'نجاح ✔︎':'إخفاق ✖︎'}</div>
      <div>الدقة: ${(acc*100).toFixed(0)}% — صحيحة: ${correct}/${total}</div>
      <div>المكافأة: 🪙 +${coinsGain}</div>
    </div>
  `;
  stopTimer();
  if(pass){
    if(od.stageIndex < od.order.length-1){
      od.stageIndex++;
      const seedStr = (od.cfg.seed_formula||'')+todayKey()+activeId+od.stageIndex;
      const rnd = mulberry32(djb2(seedStr));
      loadStage(od.order[od.stageIndex], rnd);
    }else{
      $('#odClue').textContent='أحسنت! أكملت المراحل الخمس.';
      $('#odTopic').textContent='—';
      $('#odLen').textContent='—';
      $('#odFeedback').textContent='';
      $('#odStageName').textContent='انتهت الجولة 🎉';
    }
  }else{
    const fb=$('#odFeedback'); if(fb){ fb.className='help err'; fb.textContent = 'يمكنك تعديل إجاباتك ثم الضغط "إنهاء المرحلة" مجددًا، أو الرجوع.'; }
  }
}

/* ========= Crossword (Newspaper 9×9) ========= */

/* Fallback شبكة احتياطية إذا فشل تحميل ملف اليوم */
const CW_FALLBACK = {
  date: "fallback",
  gridSize: 9,
  grid: [
    "..#....#.",
    "...#.....",
    ".#..#..#.",
    ".........",
    "...#...#.",
    ".#....#..",
    ".....#...",
    ".#..#..#.",
    ".#....#.."
  ],
  clues: {
    across: [
      { n:1, r:0, c:0, len:2, text:"حرفا عطف" },
      { n:2, r:0, c:3, len:4, text:"مدينة مغربية زرقاء" },
      { n:3, r:1, c:0, len:3, text:"غاز نبيل (54)" },
      { n:4, r:1, c:4, len:5, text:"بلد عاصمته هلسنكي" }
    ],
    down: [
      { n:1, r:0, c:0, len:3, text:"عالم نحو بصري" },
      { n:2, r:0, c:1, len:4, text:"وحدة شدة التيار" }
    ]
  },
  answers: {
    across: { "1":"او", "2":"شفشاون", "3":"زينون", "4":"فنلندا" },
    down:   { "1":"المبرد", "2":"أمبير" }
  }
};

let cw = null;

async function openCrossword(){
  if(!activeId){ alert('اختر مستخدمًا أولًا'); return; }
  try{
    await loadCrossword();
    showScreen('scrCrossword');
  }catch(e){
    console.warn('CW fetch failed:', e);
    buildCrossword(CW_FALLBACK);
    showScreen('scrCrossword');
    const fb = $('#cwFeedback');
    if(fb) fb.textContent = '(وضع تجريبي) تم تحميل شبكة احتياطية لأن ملف اليوم غير متاح.';
  }
}

async function loadCrossword(){
  const url = 'content/crossword_daily.json?v=' + Date.now();
  const resp = await fetch(url, { cache:'no-store' });
  if(!resp.ok) throw new Error('HTTP '+resp.status);
  const text = await resp.text();
  let data;
  try{ data = JSON.parse(text); }
  catch(e){ throw new Error('JSON parse error'); }
  buildCrossword(data);
}

function buildCrossword(data){
  cw = {
    data,
    size: data.gridSize || (data.grid?.[0]?.length || 9),
    dir: 'across',
    boardEl: $('#cwBoard'),
    feedback: $('#cwFeedback'),
    dateEl: $('#cwDate'),
    cluesAcrossEl: $('#cwCluesAcross'),
    cluesDownEl: $('#cwCluesDown'),
    cells: [], // 2D
    startMap: { across:new Map(), down:new Map() }, // 'r,c' -> n
    coverMap: { across:new Map(), down:new Map() }, // 'r,c' -> n
    slots: { across:[], down:[] }, // من ملف المحتوى
    answers: { across: data.answers?.across||{}, down:data.answers?.down||{} },
    current: null // {dir,n}
  };

  if(cw.dateEl) cw.dateEl.textContent = data.date || '—';

  (data.clues?.across||[]).forEach(s=>{
    cw.slots.across.push(s);
    cw.startMap.across.set(`${s.r},${s.c}`, s.n);
    for(let i=0;i<s.len;i++){
      const key=`${s.r},${s.c+i}`;
      cw.coverMap.across.set(key, s.n);
    }
  });
  (data.clues?.down||[]).forEach(s=>{
    cw.slots.down.push(s);
    cw.startMap.down.set(`${s.r},${s.c}`, s.n);
    for(let i=0;i<s.len;i++){
      const key=`${s.r+i},${s.c}`;
      cw.coverMap.down.set(key, s.n);
    }
  });

  const G = data.grid || Array.from({length:cw.size},()=>'.'.repeat(cw.size));
  cw.boardEl.innerHTML = '';
  cw.cells = Array.from({length:cw.size}, ()=>Array(cw.size).fill(null));

  for(let r=0;r<cw.size;r++){
    for(let c=0;c<cw.size;c++){
      const ch = G[r][c];
      const cell = document.createElement('div');
      cell.className = 'cw-cell';
      cell.dataset.r=r; cell.dataset.c=c;

      const numAcross = cw.startMap.across.get(`${r},${c}`);
      const numDown   = cw.startMap.down.get(`${r},${c}`);
      const numberToShow = numAcross ?? numDown;

      if(ch==='#'){
        cell.classList.add('cw-block');
      }else{
        const inp = document.createElement('input');
        inp.type='text'; inp.maxLength=1; inp.className='cw-letter'; inp.inputMode='text';
        inp.addEventListener('input', (e)=>cwOnInput(e, r, c));
        inp.addEventListener('keydown', (e)=>cwOnKey(e, r, c));
        inp.addEventListener('focus', ()=>cwFocusCell(r,c));
        cell.appendChild(inp);
      }

      if(numberToShow!=null){
        const n = document.createElement('div');
        n.className='cw-number';
        n.textContent = numberToShow;
        cell.appendChild(n);
      }

      cell.addEventListener('click', ()=>cwClickCell(r,c));
      cw.boardEl.appendChild(cell);
      cw.cells[r][c] = cell;
    }
  }

  if(cw.cluesAcrossEl){
    cw.cluesAcrossEl.innerHTML = cw.slots.across.map(s=>`<li data-dir="across" data-n="${s.n}"><b>${s.n}.</b> ${escapeHtml(s.text||'')} <span class="help">(${s.len})</span></li>`).join('');
    cw.cluesAcrossEl.addEventListener('click', e=>{
      const li = e.target.closest('li'); if(!li) return;
      cwSelectSlot('across', parseInt(li.dataset.n,10));
    });
  }
  if(cw.cluesDownEl){
    cw.cluesDownEl.innerHTML = cw.slots.down.map(s=>`<li data-dir="down" data-n="${s.n}"><b>${s.n}.</b> ${escapeHtml(s.text||'')} <span class="help">(${s.len})</span></li>`).join('');
    cw.cluesDownEl.addEventListener('click', e=>{
      const li = e.target.closest('li'); if(!li) return;
      cwSelectSlot('down', parseInt(li.dataset.n,10));
    });
  }

  if(cw.slots.across.length){
    cwSelectSlot('across', cw.slots.across[0].n);
  }else if(cw.slots.down.length){
    cwSelectSlot('down', cw.slots.down[0].n);
  }
}

function cwKey(r,c){ return `${r},${c}`; }
function cwGetSlot(dir,n){ return (cw.slots[dir]||[]).find(s=>s.n===n); }

function cwClearHighlights(){
  $$('.cw-highlight').forEach(el=>el.classList.remove('cw-highlight'));
  $$('.cw-active').forEach(el=>el.classList.remove('cw-active'));
  $$('#cwCluesAcross li, #cwCluesDown li').forEach(li=>li.classList.remove('active'));
}

function cwSelectSlot(dir,n){
  cw.dir = dir;
  cw.current = {dir, n};
  cwClearHighlights();
  const slot = cwGetSlot(dir,n);
  if(!slot) return;

  for(let i=0;i<slot.len;i++){
    const r = dir==='across' ? slot.r : slot.r + i;
    const c = dir==='across' ? slot.c + i : slot.c;
    const cell = cw.cells[r][c];
    if(cell && !cell.classList.contains('cw-block')){
      cell.classList.add('cw-highlight');
    }
  }

  const ul = dir==='across' ? cw.cluesAcrossEl : cw.cluesDownEl;
  if(ul){
    const li = ul.querySelector(`li[data-n="${n}"]`);
    if(li) li.classList.add('active');
  }

  let focused=false;
  for(let i=0;i<slot.len;i++){
    const r = dir==='across' ? slot.r : slot.r + i;
    const c = dir==='across' ? slot.c + i : slot.c;
    const inp = cw.cells[r][c]?.querySelector('.cw-letter');
    if(inp && !inp.value){ inp.focus(); focused=true; break; }
  }
  if(!focused){
    const r = slot.r, c = slot.c;
    const inp = cw.cells[r][c]?.querySelector('.cw-letter');
    if(inp) inp.focus();
  }
}

function cwClickCell(r,c){
  const key=cwKey(r,c);
  const nInDir = cw.coverMap[cw.dir].get(key);
  if(nInDir!=null){
    cwSelectSlot(cw.dir, nInDir);
  }else{
    const other = (cw.dir==='across')?'down':'across';
    const nOther = cw.coverMap[other].get(key);
    if(nOther!=null){
      cwSelectSlot(other, nOther);
    }
  }
}

function cwFocusCell(r,c){
  const cell = cw.cells[r][c];
  if(!cell) return;
  $$('.cw-active').forEach(el=>el.classList.remove('cw-active'));
  cell.classList.add('cw-active');
}

function cwMove(step){
  const cur = cw.current; if(!cur) return;
  const slot = cwGetSlot(cur.dir, cur.n); if(!slot) return;
  const len = slot.len;
  let idx = 0;
  for(let i=0;i<len;i++){
    const r = cur.dir==='across'? slot.r : slot.r+i;
    const c = cur.dir==='across'? slot.c+i : slot.c;
    const inp = cw.cells[r][c]?.querySelector('.cw-letter');
    if(inp && inp===document.activeElement){ idx=i; break; }
  }
  let ni = Math.min(len-1, Math.max(0, idx+step));
  const nr = cur.dir==='across'? slot.r : slot.r+ni;
  const nc = cur.dir==='across'? slot.c+ni : slot.c;
  const ninp = cw.cells[nr][nc]?.querySelector('.cw-letter');
  if(ninp){ ninp.focus(); ninp.select?.(); }
}

function cwOnInput(e, r, c){
  const v = e.target.value;
  e.target.value = (v||'').slice(-1).toUpperCase();
  cwMove(+1);
}

function cwOnKey(e, r, c){
  const key=e.key;
  if(key==='Backspace'){
    if(e.target.value){ e.target.value=''; }
    else cwMove(-1);
    e.preventDefault();
  }else if(key==='ArrowLeft'){ cw.dir='across'; cwMove(-1); e.preventDefault();
  }else if(key==='ArrowRight'){ cw.dir='across'; cwMove(+1); e.preventDefault();
  }else if(key==='ArrowUp'){ cw.dir='down'; cwMove(-1); e.preventDefault();
  }else if(key==='ArrowDown'){ cw.dir='down'; cwMove(+1); e.preventDefault();
  }else if(key==='Enter'){ cwCheckWord(); e.preventDefault(); }
}

function cwToggleDir(){
  if(!cw||!cw.current) return;
  const other = cw.dir==='across'?'down':'across';
  const act = document.activeElement?.closest('.cw-cell');
  if(act){
    const r=+act.dataset.r, c=+act.dataset.c;
    const n = cw.coverMap[other].get(cwKey(r,c));
    if(n!=null){ cwSelectSlot(other,n); return; }
  }
  const first = cw.slots[other][0];
  if(first) cwSelectSlot(other, first.n);
}

function cwGetWordLetters(dir,n){
  const slot = cwGetSlot(dir,n); if(!slot) return '';
  let s='';
  for(let i=0;i<slot.len;i++){
    const r = dir==='across'? slot.r : slot.r+i;
    const c = dir==='across'? slot.c+i : slot.c;
    const inp = cw.cells[r][c]?.querySelector('.cw-letter');
    s += (inp?.value||'');
  }
  return s;
}

function cwMarkSlot(dir,n,cls){
  const slot = cwGetSlot(dir,n); if(!slot) return;
  for(let i=0;i<slot.len;i++){
    const r = dir==='across'? slot.r : slot.r+i;
    const c = dir==='across'? slot.c+i : slot.c;
    const cell = cw.cells[r][c];
    if(!cell) continue;
    cell.classList.remove('cw-correct','cw-wrong');
    if(cls) cell.classList.add(cls);
  }
}

function cwCheckWord(){
  if(!cw||!cw.current) return;
  const {dir,n} = cw.current;
  const user = cwGetWordLetters(dir,n);
  const ansDisp = cw.answers[dir][String(n)] || '';
  const ok = matchAnswer(user, ansDisp, ansDisp);
  cwMarkSlot(dir,n, ok? 'cw-correct':'cw-wrong');
  if(cw.feedback) cw.feedback.textContent = ok? '✔︎ كلمة صحيحة' : '✖︎ غير صحيحة';
  if(ok){ const w=getWallet(); w.coins += 5; setWallet(w); }
}

function cwCheckAll(){
  if(!cw) return;
  let total=0, good=0;
  ['across','down'].forEach(dir=>{
    (cw.slots[dir]||[]).forEach(s=>{
      total++;
      const user = cwGetWordLetters(dir,s.n);
      const ansDisp = cw.answers[dir][String(s.n)] || '';
      const ok = matchAnswer(user, ansDisp, ansDisp);
      cwMarkSlot(dir,s.n, ok? 'cw-correct':'cw-wrong');
      if(ok) good++;
    });
  });
  if(cw.feedback) cw.feedback.textContent = `النتيجة: ${good}/${total}`;
  const w=getWallet(); w.coins += Math.round((good/Math.max(1,total))*20); setWallet(w);
}

/* ========= Store screen ========= */
function showStore(){ showScreen('scrStore'); setWallet(getWallet()); }

/* ========= Boot ========= */
(function boot(){
  users = safeGet('mg_users', []);
  activeId = localStorage.getItem('mg_active') || null;
  renderUsers();
  if (users.length > 0) {
    showScreen('userSelect'); // اعرض المستخدمين القدامى مع خيار الإضافة
  } else {
    showScreen('addUser');    // أول مرة فقط
  }
})();

/* ========= Public API ========= */
window.showScreen = showScreen;
window.saveUser = saveUser;
window.enterAs = enterAs;
window.delUser = delUser;
window.cycleTheme = cycleTheme;

// Odyssey
window.startOdyssey = startOdyssey;
window.odPrev = odPrev;
window.odNext = odNext;
window.odCheck = odCheck;
window.odFinishStage = odFinishStage;
window.odKey = odKey;

// Store
window.showStore = showStore;
window.addDevCoins = addDevCoins;
window.addDevGems = addDevGems;

// Crossword
window.openCrossword = openCrossword;
window.cwToggleDir = cwToggleDir;
window.cwCheckWord = cwCheckWord;
window.cwCheckAll  = cwCheckAll;
