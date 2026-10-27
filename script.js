const $ = id => document.getElementById(id);
const state = {questions:[], startedAt:0, endAt:0, timer:null, busy:false};
async function api(action,payload={}) {
  const response = await fetch('/api/exam',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,...payload})});
  const raw = await response.text(); let out;
  try { out = JSON.parse(raw); } catch { throw new Error('Сервер JSON бус хариу буцаалаа. Vercel API болон Apps Script deployment-ийг шалгана уу.'); }
  if(!response.ok || out.ok===false) throw new Error(out.message || `Серверийн алдаа (${response.status})`);
  return Object.prototype.hasOwnProperty.call(out,'data') ? out.data : out;
}
function safe(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function showExamPanel(id){['loginPanel','examPanel','resultPanel'].forEach(x=>$(x).classList.toggle('hidden',x!==id));}
async function loadExamData(){
 $('loginMessage').textContent='Асуултуудыг ачаалж байна...';
 try { const d=await api('getExamData'); if(!d||!Array.isArray(d.questions)||!d.questions.length)throw new Error('Сервер асуултын жагсаалт буцаасангүй.'); state.questions=d.questions; $('examTitle').textContent=d.title||'HTML · CSS · JavaScript'; $('loginMessage').textContent=`${state.questions.length} асуулт бэлэн.`; }
 catch(e){$('loginMessage').textContent='Асуултууд ачаалагдсангүй: '+e.message;}
}
function renderQuestions(){
 $('questions').innerHTML=state.questions.map((q,i)=>`<article class="question"><h3>${i+1}. ${safe(q.q)}</h3>${q.options.map((o,j)=>`<label class="option"><input type="radio" name="q${q.id}" value="${j}"><span>${safe(o)}</span></label>`).join('')}</article>`).join('');
 $('questions').querySelectorAll('input').forEach(x=>x.addEventListener('change',updateProgress));updateProgress();
}
function updateProgress(){const n=state.questions.filter(q=>document.querySelector(`input[name="q${q.id}"]:checked`)).length;$('progressText').textContent=`${n} / ${state.questions.length} асуулт хариулсан`;$('progressBar').style.width=`${n/Math.max(1,state.questions.length)*100}%`;}
function timeText(s){return `${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`;}
function tick(){const left=Math.max(0,Math.ceil((state.endAt-Date.now())/1000));$('timer').textContent=timeText(left);if(left===0)sendExam(true);}
async function startExam(){
 if(!state.questions.length){await loadExamData();if(!state.questions.length)return;}
 const name=$('studentName').value.trim(),studentClass=$('studentClass').value;
 if(name.length<2){$('loginMessage').textContent='Овог, нэрээ зөв оруулна уу.';return;} if(!studentClass){$('loginMessage').textContent='Ангиа сонгоно уу.';return;}
 $('startBtn').disabled=true;
 try{const a=await api('checkStudentAccess',{name,studentClass});if(a.allowed===false)throw new Error(a.message||'Шалгалтын эрхгүй байна.');state.startedAt=Date.now();state.endAt=state.startedAt+40*60*1000;$('studentLabel').textContent=`${name} · ${studentClass}`;renderQuestions();showExamPanel('examPanel');clearInterval(state.timer);tick();state.timer=setInterval(tick,1000);}
 catch(e){$('loginMessage').textContent=e.message;}finally{$('startBtn').disabled=false;}
}
async function sendExam(auto=false){
 if(state.busy||!state.questions.length)return;if(!auto&&!confirm('Шалгалтаа дуусгаж илгээх үү?'))return;
 state.busy=true;$('submitBtn').disabled=true;clearInterval(state.timer);
 const answers={};state.questions.forEach(q=>{const x=document.querySelector(`input[name="q${q.id}"]:checked`);if(x)answers[q.id]=Number(x.value);});
 try{const r=await api('submitExam',{name:$('studentName').value.trim(),studentClass:$('studentClass').value,startedAt:state.startedAt,answers});$('resultText').textContent=`Зөв хариулт: ${r.correct}/${r.total}. Оноо: ${r.percent}%. Үнэлгээ: ${r.grade}.`;$('examMessage').textContent='';showExamPanel('resultPanel');await loadResults();}
 catch(e){$('examMessage').textContent=e.message;}finally{state.busy=false;$('submitBtn').disabled=false;}
}
async function loadResults(){
 $('dashboardMessage').textContent='Дүн ачаалж байна...';
 try{const d=await api('getResults');$('count').textContent=d.count??0;$('average').textContent=`${d.average??0}%`;$('over80').textContent=d.over80??0;const rows=d.rows||[];$('resultsBody').innerHTML=rows.length?rows.map(r=>`<tr><td>${safe(r.date)}</td><td>${safe(r.name)}</td><td>${safe(r.studentClass)}</td><td>${safe(r.correct)}/${safe(r.total)}</td><td>${safe(r.percent)}%</td><td>${safe(r.grade)}</td></tr>`).join(''):'<tr><td colspan="6">Одоогоор дүн алга.</td></tr>';$('dashboardMessage').textContent='';}
 catch(e){$('dashboardMessage').textContent='Дүн ачаалж чадсангүй: '+e.message;}
}
async function grantRetake(){
 const pin=$('adminPin').value.trim(),name=$('retakeName').value.trim(),studentClass=$('retakeClass').value;
 if(!pin||!name||!studentClass){$('adminMessage').textContent='PIN, сурагчийн нэр, ангийг бүрэн оруулна уу.';return;}
 $('grantBtn').disabled=true;
 try{const r=await api('grantRetake',{pin,name,studentClass});$('adminMessage').textContent=typeof r==='string'?r:'Дахин шалгалтын эрх олголоо.';$('adminPin').value='';}
 catch(e){$('adminMessage').textContent=e.message;}finally{$('grantBtn').disabled=false;}
}
$('startBtn').addEventListener('click',startExam);$('examForm').addEventListener('submit',e=>{e.preventDefault();sendExam(false);});$('refreshBtn').addEventListener('click',loadResults);$('homeBtn').addEventListener('click',()=>{showExamPanel('loginPanel');$('loginMessage').textContent='';});$('grantBtn').addEventListener('click',grantRetake);
loadExamData();loadResults();