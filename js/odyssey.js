// ========= odyssey.js =========
import { $, showScreen, getWallet, setWallet } from './core.js';

let cfg = null;
let stage = 0;      // 0..4 (5 مراحل)
let idx = 0;        // السؤال الحالي داخل المرحلة

const FALLBACK = {
  stages: [
    { name:"تمهيد", items:[{clue:"عاصمة عربية على المتوسط", answer:"تونس", topic:"جغرافيا"},
                           {clue:"عنصر رمزه Fe", answer:"حديد", topic:"كيمياء"}]},
    { name:"تاريخ",  items:[{clue:"فتح الأندلس كان في القرن الـ", answer:"الثامن", topic:"تاريخ"}]},
    { name:"علوم",   items:[{clue:"أقرب الكواكب إلى الشمس", answer:"عطارد", topic:"فضاء"}]},
    { name:"أدب",    items:[{clue:"صاحب رسالة الغفران", answer:"أبو العلاء", topic:"أدب"}]},
    { name:"نهائي",  items:[{clue:"أكبر محيط على الأرض", answer:"الهادئ", topic:"جغرافيا"}]}
  ]
};

export async function startOdyssey(){
  idx = 0; stage = 0;
  try{
    const r = await fetch('content/odyssey_config.json?v='+Date.now(), {cache:'no-store'});
    cfg = r.ok ? await r.json() : FALLBACK;
  }catch{ cfg = FALLBACK; }
  render();
  showScreen('scrOdyssey');
}

/* واجهة */
function curStage(){ return cfg?.stages?.[stage] || {name:'—', items:[]}; }
function curItem(){  return curStage().items[idx] || null; }

function render(){
  const s = curStage(), it = curItem();
  $('#odStageProgress').textContent = `${stage+1} / ${cfg.stages.length}`;
  $('#odStageName').textContent = s.name || '—';
  $('#odClue').textContent = it? it.clue : '—';
  $('#odTopic').textContent = it? (it.topic||'—') : '—';
  $('#odLen').textContent = it? `(${(it.answer||'').length})` : '—';
  $('#odAnswer').value = '';
  $('#odFeedback').textContent = '';
  $('#odSummary').textContent = '';
}

export function odPrev(){ if(idx>0){ idx--; render(); } }
export function odNext(){ const s=curStage(); if(idx < s.items.length-1){ idx++; render(); } }

export function odCheck(){
  const it = curItem(); if(!it) return;
  const val = ($('#odAnswer').value||'').trim();
  const ok  = normalize(val) === normalize(it.answer||'');
  $('#odFeedback').textContent = ok ? '✔︎ صحيح' : '✖︎ غير صحيح';
  if(ok){
    const w=getWallet(); w.coins += 5; setWallet(w);
  }
}

export function odFinishStage(){
  const s = curStage();
  $('#odSummary').textContent = `أنهيت مرحلة «${s.name}».`;
  if(stage < (cfg.stages.length-1)){ stage++; idx=0; render(); }
}

export function odKey(e){ if(e.key==='Enter'){ odCheck(); } }

/* Helpers */
const normalize = x => (x||'').toString().trim()
  .toUpperCase()
  .replaceAll('أ','ا').replaceAll('إ','ا').replaceAll('آ','ا').replaceAll('ى','ي');
