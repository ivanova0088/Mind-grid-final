/* ========= odyssey.js ========= */
import {
  $, showScreen, getActiveId, getUsers,
  MG, djb2, mulberry32, seededShuffle,
  matchAnswer, getWallet, setWallet, fmtMMSS
} from './core.js';

const STAGE_LABELS = {
  A_HEXABLOOM:'HexaBloom (سداسي)',
  E_CIPHER:'Cipher Weave (شِفري)',
  C_PATHMAZE:'PathMaze (متاهة)',
  B_SPIRAL:'Spiral Rings (حلقات)',
  D_ISLANDS:'Word Islands (جزر)'
};

let od = null;

const todayKey = ()=> {
  const d=new Date();
  const yyyy=d.getFullYear(), mm=String(d.getMonth()+1).padStart(2,'0'), dd=String(d.getDate()).padStart(2,'0');
  return `${yyyy}-${mm}-${dd}`;
};

function pickByDifficulty(pool, diff){
  const hard=pool.filter(x=>x.difficulty==='hard');
  const mid =pool.filter(x=>x.difficulty==='medium');
  const easy=pool.filter(x=>x.difficulty==='easy');
  if(diff==='hard')   return [...hard,...mid,...easy];
  if(diff==='medium') return [...mid,...hard,...easy];
  return [...easy,...mid,...hard];
}
function chooseN(list,n,rnd){
  const L=[...list], out=[];
  while(out.length<Math.min(n,L.length)){
    const j=Math.floor(rnd()*L.length);
    out.push(L.splice(j,1)[0]);
  }
  return out;
}
const idToLetter = id => id.split('_')[0];

function renderCurrent(){
  const it=od.items[od.i]; if(!it) return;
  $('#odClue').textContent = it._clue || '—';
  $('#odTopic').textContent = it.topic || '—';
  $('#odLen').textContent   = it._len || '—';
  const inp = $('#odAnswer');
  if(inp){ inp.value = od.answers[od.i] || ''; inp.focus(); }
  const fb=$('#odFeedback'); if(fb){ fb.className='help'; fb.textContent=''; }
  const sm=$('#odSummary');  if(sm) sm.innerHTML='';
}

function startTimerForStage(stageId){
  stopTimer();
  const cfg=od.cfg, diff=(od.user?.difficulty)||'hard';
  const base=cfg.difficulty[diff]||cfg.difficulty.hard;
  const over=(cfg.stage_overrides && cfg.stage_overrides[stageId] && cfg.stage_overrides[stageId][diff])||{};
  const timeSec=over.time_sec || base.time_sec;

  od.timer.allowed=timeSec; od.timer.sec=0; od.timer.t0=Date.now();
  od.timer.int=setInterval(()=>{
    od.timer.sec=Math.floor((Date.now()-od.timer.t0)/1000);
    const left=Math.max(0,timeSec-od.timer.sec);
    $('#odTimer').textContent=fmtMMSS(left);
    if(left<=0){ stopTimer(); autoFinishOnTime(); }
  },250);
}
function stopTimer(){ if(od?.timer?.int){ clearInterval(od.timer.int); od.timer.int=null; } }
function autoFinishOnTime(){
  const fb=$('#odFeedback');
  if(fb){ fb.className='help err'; fb.textContent='انتهى الوقت — تقييم المرحلة…'; }
  odFinishStage(true);
}

function loadStage(stageId, rnd){
  const S = MG.stages[idToLetter(stageId)];
  const diff = (od.user?.difficulty)||'hard';
  const ordered = pickByDifficulty(S.pool, diff);

  const items = chooseN(ordered, 6, rnd).map(x=>{
    const clues=x.clues||['—']; const ci=Math.floor(rnd()*clues.length);
    const expectedLen = x.length || (x.display_answer||x.answer||'').length;
    return {...x, _clue:clues[ci], _len:expectedLen};
  });

  od.items=items; od.i=0; od.answers=Array(items.length).fill(''); od.correct=Array(items.length).fill(null);

  $('#odStageProgress').textContent = `${od.stageIndex+1} / ${od.order.length}`;
  $('#odStageName').textContent = STAGE_LABELS[stageId] || stageId;
  const accent = S.accent_color || getComputedStyle(document.documentElement).getPropertyValue('--primary');
  $('#odStageName').style.color = accent;

  startTimerForStage(stageId);
  renderCurrent();
}

/* ======== Public actions ======== */
export function startOdyssey(){
  if(!getActiveId()){ alert('اختر مستخدمًا أولًا'); return; }
  if(!MG || !MG.cfg){ alert('المحتوى لم يُحمَّل بعد.'); return; }

  const user = (getUsers().find(u=>u.id===getActiveId())) || {difficulty:'hard'};
  const cfg = MG.cfg;

  const seedStr = (cfg.seed_formula||'') + todayKey() + getActiveId();
  const rnd = mulberry32(djb2(seedStr));

  let order=[...cfg.rotation_order];
  if(cfg.daily_auto_rotate) order = seededShuffle(order, rnd);

  od = { user, cfg, order, stageIndex:0, items:[], i:0, answers:[], correct:[], timer:{t0:null,int:null,sec:0} };

  loadStage(od.order[0], rnd);
  showScreen('scrOdyssey');
}
export function odPrev(){ if(!od) return; if(od.i>0){ od.i--; renderCurrent(); } }
export function odNext(){ if(!od) return; if(od.i<od.items.length-1){ od.i++; renderCurrent(); } }
export function odKey(e){ if(e.key==='Enter'){ e.preventDefault(); odCheck(); } }
export function odCheck(){
  const it=od.items[od.i];
  const inp=$('#odAnswer').value.trim();
  od.answers[od.i]=inp;
  const ok = matchAnswer(inp, it.answer, it.display_answer);
  od.correct[od.i]=ok;

  const fb=$('#odFeedback');
  if(fb){ fb.textContent= ok?'✔︎ إجابة صحيحة':'✖︎ غير صحيحة'; fb.className= ok?'help ok':'help err'; }
  if(ok){ const w=getWallet(); w.coins+=5; setWallet(w); }
}
export function odFinishStage(){
  const stageId=od.order[od.stageIndex];
  const cfg=od.cfg, diff=(od.user?.difficulty)||'hard';
  const base=cfg.difficulty[diff]||cfg.difficulty.hard;
  const over=(cfg.stage_overrides && cfg.stage_overrides[stageId] && cfg.stage_overrides[stageId][diff])||{};
  const minAcc=(over.min_accuracy_pct||base.min_accuracy_pct)/100;

  const total=od.items.length;
  const correct=od.correct.filter(x=>x===true).length;
  const acc=(correct/total);
  const pass=(acc>=minAcc);

  const w=getWallet();
  const coinsGain=Math.round(acc*30)+(pass?20:0);
  w.coins+=coinsGain; setWallet(w);

  const sum=$('#odSummary');
  if(sum){
    sum.innerHTML = `
      <div class="card soft">
        <div><b>نتيجة المرحلة:</b> ${pass?'نجاح ✔︎':'إخفاق ✖︎'}</div>
        <div>الدقة: ${(acc*100).toFixed(0)}% — صحيحة: ${correct}/${total}</div>
        <div>المكافأة: 🪙 +${coinsGain}</div>
      </div>`;
  }
  stopTimer();

  if(pass){
    if(od.stageIndex < od.order.length-1){
      od.stageIndex++;
      const seedStr=(od.cfg.seed_formula||'')+todayKey()+getActiveId()+od.stageIndex;
      const rnd=mulberry32(djb2(seedStr));
      loadStage(od.order[od.stageIndex], rnd);
    }else{
      $('#odClue').textContent='أحسنت! أكملت المراحل الخمس.';
      $('#odTopic').textContent='—'; $('#odLen').textContent='—';
      const fb=$('#odFeedback'); if(fb) fb.textContent='';
      $('#odStageName').textContent='انتهت الجولة 🎉';
    }
  }else{
    const fb=$('#odFeedback');
    if(fb){ fb.className='help err'; fb.textContent='عدّل إجاباتك ثم اضغط "إنهاء المرحلة" مجددًا.'; }
  }
}

/* ======== Export state for debugging if needed ======== */
export const _odysseyState = ()=>od;
