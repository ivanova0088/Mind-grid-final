// ========= core.js =========
export const $ = sel => document.querySelector(sel);
export const safeGet = (k, def) => { try{const v=localStorage.getItem(k); return v?JSON.parse(v):def;}catch{return def;} };
export const safeSet = (k, v) => { try{localStorage.setItem(k, JSON.stringify(v));}catch{} };

export function showScreen(id){
  document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'));
  const el=document.getElementById(id); if(el) el.classList.add('active');
}

/* الثيم */
export function cycleTheme(){
  const root=document.documentElement;
  const cur=root.getAttribute('data-theme')||'light';
  const nxt = cur==='dark'?'light':'dark';
  root.setAttribute('data-theme',nxt);
  localStorage.setItem('mg_theme',nxt);
}

/* المحفظة */
export const getWallet = () => safeGet('mg_wallet',{coins:0,gems:0});
export const setWallet = w => { safeSet('mg_wallet',w); updateWalletUI(); };
export function addDevCoins(){ const w=getWallet(); w.coins+=100; setWallet(w); }
export function addDevGems(){ const w=getWallet(); w.gems+=10; setWallet(w); }
function updateWalletUI(){
  const w=getWallet();
  $('#wCoins') && ($('#wCoins').textContent=w.coins||0);
  $('#wGems')  && ($('#wGems').textContent =w.gems||0);
}

/* مستخدمون */
let users=[]; let activeId=null;

export function renderUsers(){
  const wrap=$('#userList'); if(!wrap) return;
  wrap.innerHTML = users.length? users.map(u=>`
    <div class="card">
      <div class="row space-between">
        <b>${u.name}</b>
        <span class="help">${u.country||'—'} • ${u.difficulty}</span>
      </div>
      <div class="row mt8">
        <button class="btn-primary" onclick="enterAs('${u.id}')">دخول</button>
        <button class="btn" onclick="delUser('${u.id}')">حذف</button>
      </div>
    </div>
  `).join('') : `<div class="help">لا يوجد مستخدمون بعد. اضغط "إضافة مستخدم".</div>`;
}
export function saveUser(){
  const name=$('#name')?.value?.trim();
  const country=$('#countrySelect')?.value?.trim();
  const dob=$('#dob')?.value;
  const difficulty=$('#difficulty')?.value||'hard';
  if(!name){ alert('أدخل الاسم'); return; }
  const id='u'+Date.now();
  users.push({id,name,country,dob,difficulty});
  safeSet('mg_users',users);
  localStorage.setItem('mg_active',id);
  renderUsers();
  showScreen('games');
}
export function enterAs(id){ localStorage.setItem('mg_active',id); showScreen('games'); }
export function delUser(id){ users=users.filter(u=>u.id!==id); safeSet('mg_users',users); renderUsers(); }

/* أدوات للكلمات المتقاطعة */
export const escapeHtml = s => (s||'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
export function matchAnswer(input,answer){
  const norm=x=>x.toString().trim().toUpperCase()
    .replaceAll('أ','ا').replaceAll('إ','ا').replaceAll('آ','ا').replaceAll('ى','ي');
  return norm(input||'') && norm(answer||'') && norm(input||'')===norm(answer||'');
}

/* الإقلاع */
export async function boot(){
  // ثيم محفوظ
  const saved=localStorage.getItem('mg_theme')||'light';
  document.documentElement.setAttribute('data-theme',saved);

  // محفظة
  updateWalletUI();

  // تعبئة الدول (select) من countries.json
  try{
    const r=await fetch('countries.json?v='+Date.now(),{cache:'no-store'});
    if(r.ok){
      const arr=await r.json();
      const sel=$('#countrySelect');
      if(sel){
        sel.innerHTML = `<option value="">— اختر الدولة —</option>` +
          arr.map(c=>`<option value="${c}">${c}</option>`).join('');
      }
    }
  }catch(e){ console.warn('countries load',e); }

  // مستخدمون
  users=safeGet('mg_users',[]);
  activeId=localStorage.getItem('mg_active')||null;
  renderUsers();
  if(users.length>0 && activeId){ showScreen('games'); }
}
