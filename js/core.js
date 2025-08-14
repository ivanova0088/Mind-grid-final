/* ========= core.js ========= */
/* Helpers */
export const $  = s => document.querySelector(s);
export const $$ = s => Array.from(document.querySelectorAll(s));
export function showScreen(id){ $$('.screen').forEach(s=>s.classList.remove('active')); $('#'+id).classList.add('active'); }
export const uid = ()=>'u_'+Math.random().toString(36).slice(2,10);
export const escapeHtml = s => (s||'').replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[m]));

/* Safe storage */
export function safeGet(k, fb){ try{ const v=localStorage.getItem(k); return v?JSON.parse(v):fb; }catch{ return fb; } }
export function safeSet(k, v){ try{ localStorage.setItem(k, JSON.stringify(v)); return true; }catch{ alert('التخزين معطّل (وضع خاص؟)'); return false; } }

/* Users */
let users = safeGet('mg_users', []);
let activeId = localStorage.getItem('mg_active') || null;
export const getUsers = ()=>users;
export const getActiveId = ()=>activeId;
export function setActiveId(id){ activeId=id; localStorage.setItem('mg_active', id); }
export function computeAge(dob){ if(!dob) return 0; const d=new Date(dob), n=new Date(); let a=n.getFullYear()-d.getFullYear(); const m=n.getMonth()-d.getMonth(); if(m<0||(m===0&&n.getDate()<d.getDate())) a--; return Math.max(0,a); }
export function renderUsers(){
  const box = $('#userList'); if(!box) return;
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
export const labelDifficulty = d => d==='easy'?'سهل':d==='medium'?'متوسط':'صعب';
export function enterAs(id){ setActiveId(id); const s=$('#odSummary'); if(s) s.innerHTML=''; showScreen('games'); }
export function delUser(id){ users=users.filter(u=>u.id!==id); safeSet('mg_users',users); renderUsers(); }
export function saveUser(){
  const name=$('#name').value.trim(), country=$('#countryInput').value.trim(), dob=$('#dob').value, diff=$('#difficulty').value;
  const u={id:uid(), name, country, dob, age:computeAge(dob), difficulty:diff, theme:null, progress:{}};
  users.push(u); if(!safeSet('mg_users',users)) return;
  setActiveId(u.id); renderUsers(); showScreen('games');
}

/* Themes */
let themes=[], currentThemeId=null;
export function applyTheme(id){
  const th = themes.find(x=>x.id===id); if(!th) return;
  currentThemeId=id; Object.entries(th.vars).forEach(([k,v])=>document.documentElement.style.setProperty(k,v));
  localStorage.setItem('mg_theme', id);
}
export function cycleTheme(){ if(!themes.length) return; const i=themes.findIndex(t=>t.id===currentThemeId); const next=themes[(i+1)%themes.length]; applyTheme(next.id); }
async function loadThemes(){ try{ const t=await (await fetch('themes.json')).json(); themes=t.themes||[]; applyTheme(localStorage.getItem('mg_theme')||t.default_theme_id||(themes[0]?.id)); }catch{} }

/* Countries datalist */
async function loadCountries(){ try{ const list=await (await fetch('countries.json')).json(); const dl=$('#countryList'); if(dl) dl.innerHTML=list.map(c=>`<option value="${c}">`).join(''); }catch{} }

/* Wallet */
export function getWallet(){ return safeGet('mg_wallet',{coins:200,gems:5}); }
export function setWallet(w){ safeSet('mg_wallet',w); $('#coins')&&($('#coins').textContent=w.coins); $('#wCoins')&&($('#wCoins').textContent=w.coins); $('#wGems')&&($('#wGems').textContent=w.gems); }
export function addDevCoins(){ const w=getWallet(); w.coins+=100; setWallet(w); }
export function addDevGems(){ const w=getWallet(); w.gems+=10; setWallet(w); }

/* Normalization + synonyms */
export function norm(s){
  const map = (MG.syn&&MG.syn.normalize) || {"أ":"ا","إ":"ا","آ":"ا","ة":"ه","ى":"ي","ؤ":"و","ئ":"ي","ـ":""," ":"","ٱ":"ا"};
  return (s||'').replace(/./g,ch=>map[ch]??ch).toUpperCase();
}
export function matchAnswer(userInput, answer, displayAnswer){
  const key = displayAnswer || answer;
  const nuser=norm(userInput), ntarget=norm(answer);
  if(nuser===ntarget) return true;
  const syn=(MG.syn&&MG.syn.synonyms&&MG.syn.synonyms[key])||[];
  return syn.some(x=>norm(x)===nuser);
}

/* Content (Odyssey data holder) */
export const MG = { cfg:null, syn:null, stages:{} };
export async function loadContent(){
  const files=[
    'content/odyssey_config.json',
    'content/synonyms_ar.json',
    'content/hexa_bloom.json',
    'content/cipher_weave.json',
    'content/path_maze.json',
    'content/spiral_rings.json',
    'content/word_islands.json'
  ];
  try{
    const [cfg,syn,a,e,c,b,d]=await Promise.all(files.map(p=>fetch(p).then(r=>r.json())));
    MG.cfg=cfg; MG.syn=syn; MG.stages={A:a,E:e,C:c,B:b,D:d};
    const h=$('header h1'); if(h && !h.textContent.includes('•')) h.textContent+=' • المحتوى جاهز';
  }catch{ alert('تعذّر تحميل محتوى content/'); }
}

/* RNG utilities */
export function djb2(str){ let h=5381; for(let i=0;i<str.length;i++) h=((h<<5)+h)+str.charCodeAt(i); return h>>>0; }
export function mulberry32(a){ return function(){ let t=a+=0x6D2B79F5; t=Math.imul(t^t>>>15,t|1); t^=t+Math.imul(t^t>>>7,t|61); return ((t^t>>>14)>>>0)/4294967296; } }
export function seededShuffle(arr,rnd){ const a=[...arr]; for(let i=a.length-1;i>0;i--){ const j=Math.floor(rnd()*(i+1)); [a[i],a[j]]=[a[j],a[i]]; } return a; }
export function fmtMMSS(s){ const mm=String(Math.floor(s/60)).padStart(2,'0'), ss=String(s%60).padStart(2,'0'); return `${mm}:${ss}`; }

/* Boot */
export async function boot(){
  setWallet(getWallet());
  renderUsers();
  users.length>0 ? showScreen('userSelect') : showScreen('addUser');
  await Promise.all([loadThemes(), loadCountries(), loadContent()]);
}
