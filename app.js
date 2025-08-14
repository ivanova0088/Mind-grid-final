/* ========= Helpers ========= */
const $ = s => document.querySelector(s);
const $$ = s => Array.from(document.querySelectorAll(s));
function showScreen(id){ $$('.screen').forEach(s=>s.classList.remove('active')); $('#'+id).classList.add('active'); }
function uid(){ return 'u_'+Math.random().toString(36).slice(2,10); }

/* ========= Safe Storage ========= */
function safeGet(k, fb){ try{ const v=localStorage.getItem(k); return v?JSON.parse(v):fb; }catch{ return fb; } }
function safeSet(k, v){ try{ localStorage.setItem(k, JSON.stringify(v)); return true; }catch{ alert('التخزين معطّل (وضع خاص؟)'); return false; } }

/* ========= Users ========= */
let users = safeGet('mg_users', []);
let activeId = localStorage.getItem('mg_active') || null;

function computeAge(dob){ if(!dob) return 0; const d=new Date(dob), n=new Date(); let a=n.getFullYear()-d.getFullYear(); const m=n.getMonth()-d.getMonth(); if(m<0||(m===0&&n.getDate()<d.getDate())) a--; return Math.max(0,a); }

function renderUsers(){
  const box = $('#userList');
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
function enterAs(id){ activeId=id; localStorage.setItem('mg_active',id); $('#odSummary').innerHTML=''; showScreen('games'); }
function delUser(id){ users=users.filter(u=>u.id!==id); safeSet('mg_users',users); renderUsers(); }
function saveUser(){
  const name=$('#name').value.trim(), country=$('#countryInput').value.trim(), dob=$('#dob').value, diff=$('#difficulty').value;
  const u={id:uid(), name, country, dob, age:computeAge(dob), difficulty:diff, theme:null, progress:{}};
  users.push(u); if(!safeSet('mg_users',users)) return; renderUsers(); showScreen('userSelect');
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

/* ========= Content Loader (content/*.json) ========= */
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

/* ========= Normalize / Synonyms ========= */
function norm(s){
  const map = (MG&&MG.syn&&MG.syn.normalize) || {"أ":"ا","إ":"ا","آ":"ا","ة":"ه","ى":"ي","ؤ":"و","ئ":"ي","ـ":""," ":"","ٱ":"ا"};
  return (s||'').replace(/./g,ch=>map[ch]??ch).toUpperCase();
}
function matchAnswer(userInput, answer, displayAnswer){
  const targetKey = displayAnswer || answer;
  const nuser = norm(userInput);
  const ntarget = norm(answer);
  if(nuser===ntarget) return true;
  const syn = (MG&&MG.syn&&MG.syn.synonyms&&MG.syn.synonyms[targetKey]) || [];
  return syn.some(x=>norm(x)===nuser);
}

/* ========= Seeded random / rotation ========= */
function djb2(str){ let h=5381; for(let i=0;i<str.length;i++) h=((h<<5)+h)+str.charCodeAt(i); return h>>>0; }
function mulberry32(a){ return function(){ let t=a+=0x6D2B79F5; t=Math.imul(t^t>>>15,t|1); t^=t+Math.imul(t^t>>>7,t|61); return ((t^t>>>14)>>>0)/4294967296; } }
function seededShuffle(arr, rnd){ const a=[...arr]; for(let i=a.length-1;i>0;i--){ const j=Math.floor(rnd()*(i+1)); [a[i],a[j]]=[a[j],a[i]]; } return a; }

/* ========= Odyssey Game State ========= */
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
  if(!MG){ alert('المحتوى لم يُحمَّل بعد. أعد محاولة بعد ثوانٍ.'); return; }

  const user = users.find(u=>u.id===activeId) || {difficulty:'hard'};
  const cfg=MG.cfg; const seedStr = (cfg.seed_formula||'')+todayKey()+activeId;
  const rnd = mulberry32(djb2(seedStr));

  let order = [...cfg.rotation_order];
  if(cfg.daily_auto_rotate) order = seededShuffle(order, rnd);

  od = {
    user, cfg, order,
    stageIndex: 0,
    items: [], i: 0, answers: [], correct: [],
    timer: {t0:null, int:null, sec:0}
  };

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
  document.querySelector('#odStageProgress').textContent = `${od.stageIndex+1} / ${od.order.length}`;
  document.querySelector('#odStageName').textContent = STAGE_LABELS[stageId] || stageId;
  const accent = S.accent_color || getComputedStyle(document.documentElement).getPropertyValue('--primary');
  document.querySelector('#odStageName').style.color = accent;

  startTimerForStage(stageId);
  renderCurrent();
}

function renderCurrent(){
  const it = od.items[od.i]; if(!it) return;
  document.querySelector('#odClue').textContent = it._clue || '—';
  document.querySelector('#odTopic').textContent = it.topic || '—';
  document.querySelector('#odLen').textContent = it._len || '—';
  const inp = document.querySelector('#odAnswer'); inp.value = od.answers[od.i] || ''; inp.focus();
  const fb = document.querySelector('#odFeedback'); fb.className='help'; fb.textContent='';
  document.querySelector('#odSummary').innerHTML='';
}
function odPrev(){ if(!od) return; if(od.i>0){ od.i--; renderCurrent(); } }
function odNext(){ if(!od) return; if(od.i<od.items.length-1){ od.i++; renderCurrent(); } }
function odKey(e){ if(e.key==='Enter'){ e.preventDefault(); odCheck(); } }

function odCheck(){
  const it = od.items[od.i]; const inp=document.querySelector('#odAnswer').value.trim();
  od.answers[od.i]=inp;
  const ok = matchAnswer(inp, it.answer, it.display_answer);
  od.correct[od.i]=ok;
  const fb=document.querySelector('#odFeedback'); fb.textContent = ok? '✔︎ إجابة صحيحة' : '✖︎ غير صحيحة'; fb.className = ok? 'help ok' : 'help err';
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
    document.querySelector('#odTimer').textContent = fmtMMSS(left);
    if(left<=0){ stopTimer(); autoFinishOnTime(); }
  }, 250);
}
function stopTimer(){ if(od&&od.timer&&od.timer.int){ clearInterval(od.timer.int); od.timer.int=null; } }
function fmtMMSS(s){ const mm=String(Math.floor(s/60)).padStart(2,'0'); const ss=String(s%60).padStart(2,'0'); return `${mm}:${ss}`; }
function autoFinishOnTime(){ document.querySelector('#odFeedback').className='help err'; document.querySelector('#odFeedback').textContent='انتهى الوقت — تقييم المرحلة…'; odFinishStage(true); }

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

  const sum = document.querySelector('#odSummary');
  sum.innerHTML = `
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
      document.querySelector('#odClue').textContent='أحسنت! أكملت المراحل الخمس.';
      document.querySelector('#odTopic').textContent='—';
      document.querySelector('#odLen').textContent='—';
      document.querySelector('#odFeedback').textContent='';
      document.querySelector('#odStageName').textContent='انتهت الجولة 🎉';
    }
  }else{
    document.querySelector('#odFeedback').className='help err';
    document.querySelector('#odFeedback').textContent = 'يمكنك تعديل إجاباتك ثم الضغط "إنهاء المرحلة" مجددًا، أو الرجوع.';
  }
}

function showStore(){ showScreen('scrStore'); setWallet(getWallet()); }

renderUsers();

window.showScreen = showScreen;
window.saveUser = saveUser;
window.enterAs = enterAs;
window.delUser = delUser;
window.cycleTheme = cycleTheme;
window.startOdyssey = startOdyssey;
window.odPrev = odPrev;
window.odNext = odNext;
window.odCheck = odCheck;
window.odFinishStage = odFinishStage;
window.odKey = odKey;
window.showStore = showStore;
window.addDevCoins = addDevCoins;
window.addDevGems = addDevGems;
