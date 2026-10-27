'use strict';
// ---------- Print: pick a day range, build a paper sheet into #print, then window.print() ----------
function printHtml(){const L=planLen(),ch=[[T('pr.week'),ord(cur.w,1),ord(cur.w,7)],[T('pr.next7'),co(),co()+6],[T('pr.all'),1,L]].map(([l,a,b])=>[l,a,Math.min(b,L)]),cb=(id,on,l)=>`<label class="row2 paneldesc"><input type="checkbox" id="${id}"${on?' checked':''}> ${l}</label>`;
return `<div class="overlay"><div class="modal" role="dialog" aria-modal="true" aria-labelledby="pt"><div class="eyebrow">${T('pr.eyebrow')}</div><h2 id="pt" style="font-size:22px;font-family:Fraunces,Georgia,serif;color:var(--navy-deep);margin-bottom:6px">${T('pr.title')}</h2>
<div class="seg">${ch.map(([l,a,b])=>`<button data-act="prr" data-a="${a}" data-b="${b}"${PR.a==a&&PR.b==b?' class="on"':''}>${l}</button>`).join('')}</div>
<div class="row2" style="margin-top:14px"><label class="paneldesc">${T('pr.from')} <input type="number" id="pra" min="1" max="${L}" value="${PR.a}" style="width:84px"></label><label class="paneldesc">${T('pr.to')} <input type="number" id="prb" min="1" max="${L}" value="${PR.b}" style="width:84px"></label><span class="paneldesc">${T('pr.total',{n:L})}</span></div>
<div style="margin-top:14px;display:grid;gap:8px">${cb('prdt',PR.date,T('pr.dates'))}${cb('prd',PR.done,T('pr.showDone'))}${cb('prh',PR.hrs,T('pr.hours'))}${cb('prnt',PR.notes,T('pr.notes'))}</div>
<div class="row2" style="margin-top:18px;justify-content:flex-end"><button class="secondary" data-act="prno">${T('cancel')}</button><button class="primary" data-act="prgo">🖨 ${T('print')}</button></div></div></div>`}
const prOpts=()=>({date:$('#prdt').checked,done:$('#prd').checked,hrs:$('#prh').checked,notes:$('#prnt').checked});
// o = {date, done, hrs, notes}: what to put on paper
function printDoc(a,b,o){const A=dd(...od(a)),B=dd(...od(b)),bx=x=>`<span class="bx">${x?'✓':''}</span>`;
let h=`<div class="pr-head"><b>${esc(PROJ?PROJ.name:T('pr.routine'))}</b><span>${T('days.range',{a,b})}${o.date?` · ${A.day} ${A.mon} – ${B.day} ${B.mon}`:''}</span></div>`;
for(let n=a;n<=b;n++){const[w,d]=od(n),x=dd(w,d),ps=P.filter(p=>!p.arch&&p.w==w&&p.d==d),rv=revsOn(n).filter(r=>P.some(p=>p.id==r.pid&&!p.arch)),own=FOC.filter(f=>f.o==n),hs=hrs(n);
let rows=SUBJ.map(([k])=>{const s=ps.filter(p=>p.s==k);return s.length?`<tr><th>${esc(sn(k,w))}</th><td>${s.map(p=>`<div class="pr-it">${bx(o.done&&done.has(p.id))}<span>${esc(p.t)}${p.p=='High'?` <i>(${T('pri.high')})</i>`:''}</span></div>`).join('')}</td></tr>`:''}).join('');
if(rv.length)rows=`<tr><th>${T('rev.title')}</th><td>${rv.map(r=>`<div class="pr-it">${bx(o.done&&r.done)}<span>${esc(P.find(p=>p.id==r.pid).t)}</span></div>`).join('')}</td></tr>`+rows;
if(own.length)rows+=`<tr><th>${T('foc.own')}</th><td>${own.map(f=>`<div class="pr-it">${bx(o.done&&f.done)}<span>${esc(f.t)}</span></div>`).join('')}</td></tr>`;
if(o.hrs)rows+=`<tr><th>${T('hr.title')}</th><td><div class="pr-hrs">${Array.from({length:12},(_,i)=>`<span>${o.done&&i<hs?'✕':i+1}</span>`).join('')}</div></td></tr>`;
if(o.notes)rows+=`<tr><th>${T('note')}</th><td class="pr-note"></td></tr>`;
h+=`<section class="pr-day"><div class="pr-dh"><b>${lab(w,d)}</b><span>${wd(w,d)}${o.date?` · ${x.dow} ${x.day} ${x.mon}`:''}</span><span class="r">${T('n.topics',{n:ps.length})}</span></div><table>${rows||`<tr><td>${T('nothing')}</td></tr>`}</table></section>`}
return h}

// ---------- Pomodoro: timer / stopwatch / "studied offline" log on a topic ----------
let AC=null,PO={stage:'off'};const TITLE=document.title,KL=k=>T('po.'+k);
const PKEY=()=>'routine-pomo-'+(ME?ME.id:0);
const SND={focus:[[880,0,.22],[880,.32,.22],[1175,.64,.6]],brk:[[659,0,.35],[523,.4,.7]],hour:[[784,0,1.4],[1047,.45,1.8]],target:[[523,0,.25],[659,.25,.25],[784,.5,.25],[1047,.75,1.1]]};
function ding(kind,force){if(!force&&!(kind=='hour'||kind=='target'?SET.snd.hour:SET.snd.on))return;try{AC=AC||new(window.AudioContext||window.webkitAudioContext)();if(AC.state=='suspended')AC.resume();const t0=AC.currentTime+.03,v=Math.max(.0002,SET.snd.vol*.35);
SND[kind].forEach(([fq,st,du])=>{const o=AC.createOscillator(),g=AC.createGain();o.type=kind=='hour'?'triangle':'sine';o.frequency.value=fq;g.gain.setValueAtTime(.0001,t0+st);g.gain.exponentialRampToValueAtTime(v,t0+st+.02);g.gain.exponentialRampToValueAtTime(.0001,t0+st+du);o.connect(g);g.connect(AC.destination);o.start(t0+st);o.stop(t0+st+du+.05)})}catch(e){}}
const pref=r=>r.f?FOC.find(x=>x.id==r.f):P.find(x=>x.id==r.p),pName=r=>(pref(r)||{t:T('topic')}).t,pSub=r=>{if(r.f)return T('foc.own');const p=pref(r);return p?`${sn(p.s,p.w)} · ${lab(p.w,p.d)}`:''};
const pLive=()=>['run','pause','between'].includes(PO.stage),pOn=r=>pLive()&&PO.ref.p==r.p&&PO.ref.f==r.f,phMin=k=>k=='focus'?PO.dur:k=='short'?SET.pomo.short:SET.pomo.long;
function pomoOpen(r){if(pLive()&&!pOn(r)){PO.fs=true;toast(T('po.busy'));return}if(pLive()){PO.fs=true;return}PO={stage:'ready',ref:r,kind:'focus',dur:SET.pomo.focus,n:0,fs:true,o:co()}}
function pomoStart(k){PO.kind=k;PO.total=phMin(k)*60000;PO.endAt=Date.now()+PO.total;PO.last=Date.now();PO.stage='run';clearInterval(PO.iv);PO.iv=setInterval(pomoTick,250)}
// every studied second (timer, stopwatch or offline log) lands here; each full hour can tick a box
function addSec(o,dt,ref){SEC[o]=Math.max(0,(SEC[o]||0)+dt);const x=ref&&pref(ref);if(x)x.sec=Math.max(0,(x.sec||0)+dt);let hit=0;
while((HRC[o]||0)<Math.floor(SEC[o]/3600)){hit=1;HRC[o]=(HRC[o]||0)+1;const was=hrs(o);if(SET.pomo.autoHour)HR[o]=Math.min(12,was+1);ding('hour');notify(T('po.hourN',{n:HRC[o]}),T('po.keepGoing'));toast(T('po.hourN',{n:HRC[o]})+(SET.pomo.autoHour?' — '+T('po.boxTicked'):''));if(SET.pomo.autoHour&&was<tgt(o)&&hrs(o)>=tgt(o))setTimeout(()=>ding('target'),1800)}return hit}
function credit(){const now=Date.now(),until=FG?Math.min(now,FG.at+SET.fg.grace*1000):now;if(PO.stage=='run'&&(PO.kind=='focus'||PO.kind=='watch')){const dt=(Math.min(until,PO.endAt)-PO.last)/1000;PO.last=Math.max(PO.last,until);if(dt>0&&addSec(PO.o,dt,PO.ref)&&!credit.busy){credit.busy=1;render();credit.busy=0}}else PO.last=now}
function notify(t,b){try{if(SET.notif&&document.hidden&&Notification.permission=='granted')new Notification(t,{body:b,icon:'icon-192.png'})}catch(e){}}
function savePomo(){try{localStorage.setItem(PKEY(),JSON.stringify({...PO,iv:0}))}catch(e){}}
function pomoTick(){if(PO.stage!='run')return;fgCheck();if(PO.stage!='run')return;credit();if(((PO.tk=(PO.tk||0)+1)%40)==0){queueSave();savePomo()}if(PO.endAt-Date.now()<=0)pomoEnd();else paintPomo()}
function pomoEnd(away){clearInterval(PO.iv);if(PO.kind=='focus'){PO.n++;PO.next=PO.n%SET.pomo.every?'short':'long'}else PO.next='focus';
const msg=PO.kind=='focus'?T('po.focusEnd',{b:KL(PO.next)}):T('po.breakEnd');
if(away)toast(T('po.away'));else{ding(PO.kind=='focus'?'focus':'brk');notify(msg,pName(PO.ref));toast(msg)}
if(SET.pomo.auto&&!away)pomoStart(PO.next);else PO.stage='between';render()}
function exitFs(){if(document.fullscreenElement)document.exitFullscreen?.().catch(()=>{})}
function resumePomo(){try{const j=JSON.parse(localStorage.getItem(PKEY())||'null');if(j&&j.stage&&j.stage!='off'&&j.ref&&pref(j.ref)){PO=j;PO.fs=false;if(PO.stage=='run'){credit();if(PO.endAt<=Date.now())pomoEnd(1);else PO.iv=setInterval(pomoTick,250)}}}catch(e){}}
function renderPomo(){if(!ME||VIEW){$('#pomo').innerHTML='';document.body.classList.remove('has-mini');wakeOff();return}savePomo();PO.stage=='run'?wakeOn():wakeOff();const el=$('#pomo');if(PO.stage=='off'){el.innerHTML='';document.body.classList.remove('has-mini');document.title=TITLE;return}
const r=PO.ref,k=PO.kind,o=PO.o,st=PO.stage,rd=st=='ready',bt=st=='between',run=st=='run',pa=st=='pause',dn=r.f?(pref(r)||{}).done:done.has(r.p),ev=SET.pomo.every;
if(!PO.fs){document.body.classList.add('has-mini');el.innerHTML=`<div class="pmini k-${bt?PO.next:k}${pa||bt?' paused':''}" role="region" aria-label="${T('po.timer')}"><span class="pdot"></span><span class="pmt"><b id="pmtime">${bt?T('po.ready'):mmss(PO.total)}</b><small>${esc(KL(bt?PO.next:k))} · ${esc(pName(r))}</small></span>${run?`<button data-act="ppause" aria-label="${T('po.pause')}">⏸</button>`:pa?`<button data-act="presume" aria-label="${T('po.resume')}">▶</button>`:`<button data-act="pnext" aria-label="${T('po.start')}">▶</button>`}<button data-act="pmax" aria-label="${T('po.expand')}">⤢</button><button data-act="pstop" aria-label="${T('po.stop')}">■</button></div>`;paintPomo();return}
document.body.classList.remove('has-mini');
el.innerHTML=`<div class="pfs k-${rd?'focus':bt?PO.next:k}" role="dialog" aria-modal="true" aria-label="${T('po.timer')}"><div class="pfs-top"><span class="pk">${rd?'Pomodoro':bt?T('po.nextStep',{s:KL(PO.next)}):KL(k)}</span><span class="pses">${'●'.repeat(PO.n%ev)}${'○'.repeat(ev-PO.n%ev)} · ${T('po.sessions',{n:PO.n})}</span><span class="pfs-sp"></span><button class="pb" data-act="psnd" aria-pressed="${SET.snd.on}">${SET.snd.on?'🔔 '+T('po.sound'):'🔕 '+T('po.soundOff')}</button><button class="pb" data-act="pnative">⛶ ${T('po.full')}</button><button class="pb" data-act="pmin">${rd?'✕ '+T('close'):'— '+T('po.min')}</button></div>
<div class="pfs-mid"><div class="psub">${esc(pSub(r))}</div><h2 class="ptitle">${esc(pName(r))}</h2>
<div class="ring"><svg viewBox="0 0 120 120" aria-hidden="true"><circle class="rbg" cx="60" cy="60" r="54"/><circle class="rfg" id="pring" cx="60" cy="60" r="54"/></svg><div class="rin"><div class="rtime" id="ptime">${rd?mmss(PO.dur*60000):bt?mmss(phMin(PO.next)*60000):mmss(PO.total)}</div><div class="rlab">${rd?T('po.howLong'):bt?T('po.ready'):pa?T('po.paused'):KL(k)}</div></div></div>
${rd?`<div class="pchips">${[25,45,50,60,90].map(m=>`<button data-act="pdur" data-v="${m}"${PO.dur==m?' class="on"':''}>${m}</button>`).join('')}<label>${T('po.other')} <input type="number" id="pcus" min="1" max="180" placeholder="${T('po.minutes')}"></label></div><div class="pacts"><button class="pbig" data-act="pgo">▶ ${T('po.start')}</button><button class="pb" data-act="pwatch">⏱ ${T('po.watch')}</button></div><div class="plog"><span>${T('po.logQ')}</span>${[15,30,45,60,90].map(m=>`<button data-act="plog" data-v="${m}">+${T('t.min',{m})}</button>`).join('')}<button data-act="plog" data-v="-15" aria-label="${T('po.minus')}">−15</button></div>`:
`<div class="pacts">${run?`<button class="pbig" data-act="ppause">⏸ ${T('po.pause')}</button>`:pa?`<button class="pbig" data-act="presume">▶ ${T('po.resume')}</button>`:`<button class="pbig" data-act="pnext">▶ ${T('po.startX',{s:KL(PO.next)})}</button>`}${bt||k=='watch'?'':`<button class="pb" data-act="pplus">+${T('t.min',{m:5})}</button><button class="pb" data-act="pskip">⏭ ${T('po.skip')}</button>`}<button class="pb" data-act="pstop">■ ${T('po.stop')}</button></div>`}
<button class="pb pdone${dn?' on':''}" data-act="pdone">${dn?'✓ '+T('po.doneOn'):'✓ '+T('po.done')}</button></div>
${PO.dist&&PO.dist.n?`<div class="pfs-foot" style="color:var(--gold-bright)">${T('fg.session',{n:PO.dist.n,t:PO.dist.sec<60?T('t.sec',{s:Math.round(PO.dist.sec)}):hm(PO.dist.sec)})}</div>`:''}<div class="pfs-foot">${T('po.foot',{t:`<b id="pftime">${hm(SEC[o])}</b>`,h:hrs(o),g:tgt(o),p:hm((pref(r)||{}).sec)})}</div></div>`;paintPomo()}
function paintPomo(){const w=PO.kind=='watch',now=Date.now(),v=PO.stage=='run'?(w?PO.acc+now-PO.t0:PO.endAt-now):PO.stage=='pause'?(w?PO.acc:PO.left):null;if(v==null){document.title=TITLE;return}const t=mmss(v),ring=$('#pring');
[['#ptime',t],['#pmtime',t],['#pftime',hm(SEC[PO.o])]].forEach(([q,x])=>{const e=$(q);if(e)e.textContent=x});if(ring)ring.style.strokeDashoffset=339.292*(w?1-(v%3600000)/3600000:1-Math.max(0,v)/PO.total);document.title=`${t} · ${KL(PO.kind)} — Routine`}

// ---------- Focus guard: notices when you leave the app during a focus session ----------
// It can't block other apps (a web app isn't allowed to) — it pauses or stops counting, reminds you, and keeps score.
let FG=null,WL=null;
const fgAway=()=>document.hidden||(SET.fg.blur&&!document.hasFocus());
const fgDay=o=>FGD[o]=FGD[o]||{n:0,sec:0,b:0};
function fgLeave(){if(FG||VIEW||!SET.fg.on||PO.stage!='run'||!(PO.kind=='focus'||PO.kind=='watch'))return;FG={at:Date.now(),paused:false,broken:false,warned:0}}
function fgCheck(){if(!FG)return;const now=Date.now(),away=(now-FG.at)/1000,g=SET.fg.grace;if(away<g)return;const cut=FG.at+g*1000;
if(SET.fg.strict&&!FG.broken&&PO.kind=='focus'&&away>=SET.fg.strictMin*60){credit();FG.broken=true;clearInterval(PO.iv);fgDay(PO.o).b++;PO.next='focus';PO.stage='between';notify(T('fg.brokenN'),pName(PO.ref));savePomo();return}
if(SET.fg.mode=='pause'&&!FG.paused&&PO.stage=='run'){credit();FG.paused=true;if(PO.kind=='watch')PO.acc+=cut-PO.t0;else PO.left=PO.endAt-cut;PO.stage='pause';clearInterval(PO.iv);savePomo()}
if(SET.fg.remind&&now-(FG.warned||0)>=60000){FG.warned=now;ding('brk');notify(T('fg.comeBack'),pName(PO.ref))}}
function fgReturn(){if(!FG||fgAway())return;fgCheck();const away=(Date.now()-FG.at)/1000,f=FG;FG=null;if(away<SET.fg.grace)return;
const d=fgDay(PO.o);d.n++;d.sec+=away;PO.dist=PO.dist||{n:0,sec:0};PO.dist.n++;PO.dist.sec+=away;if(PO.stage=='run')PO.last=Date.now();
const t=away<60?T('t.sec',{s:Math.round(away)}):hm(away);toast(f.broken?T('fg.broken',{t}):f.paused?T('fg.paused',{t}):T('fg.notCounted',{t}));PO.fs=true;render()}
// while the app is hidden timers slow down, so also check on a separate clock
setInterval(()=>{if(FG){fgCheck();if(!fgAway())fgReturn()}},5000);
async function wakeOn(){try{if(!WL&&'wakeLock' in navigator&&!document.hidden){WL=await navigator.wakeLock.request('screen');WL.addEventListener('release',()=>{WL=null})}}catch(e){WL=null}}
function wakeOff(){try{WL&&WL.release()}catch(e){}WL=null}
const focusPct=(a,b)=>{let f=0,w=0,n=0,br=0;for(let o=a;o<=b;o++){f+=SEC[o]||0;const g=FGD[o];if(g){w+=g.sec;n+=g.n;br+=g.b}}return f+w>0&&(w||n)?{p:Math.round(100*f/(f+w)),n,br,w}:null};

// ---------- pending → another day ----------
function merge(g,to){const[tw,td]=to.split('.').map(Number),ps=pendingList().filter(p=>p.ow+'.'+p.od==g);ps.forEach(p=>{p.w=tw;p.d=td;p.from=lab(p.ow,p.od)});toast(T('pend.moved',{n:ps.length,d:lab(tw,td)}),1)}

// ---------- CSV export / import (review popup before anything changes) ----------
const H=['id','day','week_day','date','subject','priority','subpart'];
const csvRows=()=>P.filter(p=>!p.arch).sort((a,b)=>ord(a.w,a.d)-ord(b.w,b.d)||SUBJ.findIndex(s=>s[0]==a.s)-SUBJ.findIndex(s=>s[0]==b.s)).map(p=>[p.id,ord(p.w,p.d),wd(p.w,p.d),dd(p.w,p.d).iso,sn(p.s,p.w),p.p,p.t]);
const csv=r=>r.map(x=>x.map(v=>/[",\n]/.test(v)?'"'+String(v).replace(/"/g,'""')+'"':v).join(',')).join('\n');
const MODES=()=>[['file',T('imp.mFile'),T('imp.mFileD')],['all',T('imp.mAll'),T('imp.mAllD')],['append',T('imp.mAppend'),T('imp.mAppendD')]];
const num=v=>+String(v).trim().replace(/[০-৯]/g,c=>'০১২৩৪৫৬৭৮৯'.indexOf(c));
function parseCSV(t){t=t.replace(/^﻿/,'');const rows=[];let row=[],f='',q=false;
for(let i=0;i<t.length;i++){const c=t[i];if(q){if(c=='"'){if(t[i+1]=='"'){f+='"';i++}else q=false}else f+=c}
else if(c=='"')q=true;else if(c==','){row.push(f);f=''}else if(c=='\n'||c=='\r'){if(c=='\r'&&t[i+1]=='\n')i++;row.push(f);rows.push(row);row=[];f=''}else f+=c}
if(f||row.length){row.push(f);rows.push(row)}return rows}
// ---------- CSV editor: every upload first opens as an editable table ----------
// reads both the week-block routine (like the BCS file) and the flat day,subject,priority,subpart file
const PRI_TAG=/\s*\[(high|medium|low)\]\s*$/i,cap=x=>x.charAt(0).toUpperCase()+x.slice(1).toLowerCase();
function csvToRows(text){const rows=parseCSV(text).map(r=>r.map(c=>String(c||'').trim())),isWeek=c=>/^(সপ্তাহ|week)\s*[0-9০-৯]+/i.test(c||'');
if(rows.some(r=>isWeek(r[0]))&&rows.some(r=>/^day$/i.test(r[0]||''))){const out=[];let week=0,cols=null,title='',ws='';
rows.forEach(r=>{const first=r[0]||'';if(!r.some(Boolean))return;
if(isWeek(first)){week++;const full=r.filter(Boolean).join(', ');title=full.includes(' — ')?full.split(' — ').slice(1).join(' — ').trim():full;ws=title.split(' — ')[0].trim()||title;return}
if(/^day$/i.test(first)){cols=r.slice(1).filter(Boolean);return}
const m=first.match(/^day\s*([0-9০-৯]+)$/i);if(!m||!cols||!week)return;const d=num(m[1]);
r.slice(1,1+cols.length).forEach((cell,ci)=>cell.split('|').map(x=>x.trim()).filter(Boolean).forEach(part=>{const pm=part.match(PRI_TAG);
out.push({id:0,day:(week-1)*7+d,subj:ci==0?ws:cols[ci],pri:pm?cap(pm[1]):'',perr:'',topic:part.replace(PRI_TAG,'').trim(),wt:title})}))});
return{rows:out}}
const head=(rows.shift()||[]).map(h=>h.toLowerCase()),ix=k=>head.indexOf(k),wk=ix('week')>=0,g=(r,k)=>ix(k)<0?'':(r[ix(k)]||'');
const miss=['day','subject','subpart'].filter(k=>ix(k)<0);if(miss.length)return{err:T('imp.eHeader',{c:miss.join(', ')})};
return{rows:rows.filter(r=>r.some(Boolean)).map(r=>{const dn=num(g(r,'day')),wv=num(g(r,'week')),p0=g(r,'priority'),pv=['High','Medium','Low'].find(x=>x.toLowerCase()==p0.toLowerCase());
return{id:num(g(r,'id'))||0,day:wk?(Number.isInteger(wv)&&Number.isInteger(dn)&&dn<=7?(wv-1)*7+dn:NaN):dn,subj:g(r,'subject'),pri:pv||'',perr:p0&&!pv?p0:'',topic:g(r,'subpart'),wt:g(r,'week_title')}})}}
function openCE(name,text,o){const r=csvToRows(text);if(r.err){toast(r.err);return}
CE={kind:'file',name,mode:(o&&o.mode)||'file',week:'all',only:false,rows:r.rows.map(x=>{const k=subjKey(x.subj);return{...x,s:k?'k:'+k:'n:'+x.subj}})}}
// the same table for a week of the routine (rows keep their id, removed rows get archived) or for new topics
function openCETasks(kind,w){const one=(day,s)=>({id:0,day,s:s||(TF.s?'k:'+TF.s:SUBJ[0]?'k:'+SUBJ[0][0]:'n:'),pri:'',perr:'',topic:'',wt:''});
if(kind=='week'){const ps=P.filter(p=>!p.arch&&p.w==w).sort((a,b)=>a.d-b.d||SUBJ.findIndex(s=>s[0]==a.s)-SUBJ.findIndex(s=>s[0]==b.s));
CE={kind,w,name:`${T('week.n',{n:w})} · ${T('days.range',{a:ord(w,1),b:ord(w,7)})}`,mode:'file',scope:[...Array(7)].map((_,i)=>ord(w,i+1)),week:'all',only:false,rows:ps.map(p=>({id:p.id,day:ord(p.w,p.d),s:'k:'+p.s,pri:p.p||'',perr:'',topic:p.t,wt:''}))};if(!CE.rows.length)CE.rows.push(one(ord(w,1)))}
else CE={kind,name:T('ce.newName'),mode:'append',week:'all',only:false,rows:[one(BD.day||co())]}}
function rowErr(r){return!(Number.isInteger(r.day)&&r.day>=1)?T('imp.eDay',{v:Number.isNaN(r.day)?'':r.day}):r.s.length<3?T('imp.eSubj'):r.perr?T('imp.ePri',{v:r.perr}):!String(r.topic).trim()?T('imp.eTopic'):''}
const ceNew=()=>[...new Set(CE.rows.filter(r=>r.s.startsWith('n:')&&r.s.length>2).map(r=>r.s.slice(2)))];
function ceHtml(){const c=CE,news=ceNew(),nErr=c.rows.filter(rowErr).length,nw=Math.max(1,...c.rows.map(r=>Number.isInteger(r.day)?Math.ceil(r.day/7):1));
const opts=r=>SUBJ.map(([k])=>`<option value="k:${k}"${r.s=='k:'+k?' selected':''}>${esc(sn(k))}</option>`).join('')+news.map(n=>`<option value="n:${esc(n)}"${r.s=='n:'+n?' selected':''}>★ ${esc(n)} (${T('ce.new')})</option>`).join('')+(r.s.length<3?'<option value="n:" selected>—</option>':'')+(c.kind=='file'?`<option value="__add">+ ${T('ce.addSubj')}</option>`:'');
const vis=c.rows.map((r,i)=>[r,i]).filter(([r])=>(c.week=='all'||(Number.isInteger(r.day)&&Math.ceil(r.day/7)==+c.week))&&(!c.only||rowErr(r)));
const body=vis.map(([r,i])=>{const e=rowErr(r);return `<tr class="${e?'bad':''}${r.s.startsWith('n:')&&r.s.length>2?' nsub':''}" data-row="${i}"><td class="n">${i+1}</td><td><input type="number" min="1" class="cday" data-ce="day" data-r="${i}" value="${Number.isInteger(r.day)?r.day:''}" aria-label="${T('b.day')}"></td><td><select data-ce="s" data-r="${i}" aria-label="${T('subject')}">${opts(r)}</select></td><td><input type="text" data-ce="topic" data-r="${i}" value="${esc(r.topic)}" aria-label="${T('topic')}"></td><td><select data-ce="pri" data-r="${i}" aria-label="${T('priority')}">${priOpts(r.pri)}</select></td><td class="cerr">${esc(e)}</td><td><button class="mini danger" data-act="cedel" data-r="${i}" aria-label="${T('delete')}">✕</button></td></tr>`}).join('');
return `<div class="overlay"><div class="modal wide xl" role="dialog" aria-modal="true" aria-labelledby="cet"><div class="eyebrow">${c.kind=='file'?T('ce.eyebrow')+' · ':''}${esc(c.name)}</div><h2 id="cet" style="font-size:22px;font-family:Fraunces,Georgia,serif;color:var(--navy-deep);margin-bottom:6px">${c.kind=='week'?T('ce.titleWeek',{w:c.w}):c.kind=='new'?T('ce.titleNew'):T('ce.title')}</h2><p class="paneldesc">${T(c.kind=='week'?'ce.descWeek':c.kind=='new'?'ce.descNew':'ce.desc')}</p>
<div class="row2" style="margin-top:12px"><span class="chip">${T('ce.rowsN')} <b>${c.rows.length}</b></span><span class="chip${nErr?' err':''}">${T('imp.err')} <b id="ceerr">${nErr}</b></span>${news.length?`<span class="chip">★ ${T('ce.newN')} <b>${news.length}</b></span>`:''}<span class="row2" style="margin-left:auto"><label class="paneldesc">${T('week.n',{n:''}).trim()} <select id="cew"><option value="all">${T('ce.allWeeks')}</option>${Array.from({length:nw},(_,i)=>`<option value="${i+1}"${c.week==i+1?' selected':''}>${i+1}</option>`).join('')}</select></label><label class="paneldesc row2"><input type="checkbox" id="ceo"${c.only?' checked':''}> ${T('ce.onlyErr')}</label></span></div>
${news.length?`<div class="cenew"><b>★ ${T('ce.newTitle',{n:news.length})}</b><p class="paneldesc" style="margin:2px 0 8px">${T('ce.newDesc')}</p>${news.map(n=>`<div class="row2 cenrow"><span class="tag">${esc(n)}</span><span class="paneldesc">${T('ce.used',{n:c.rows.filter(r=>r.s=='n:'+n).length})}</span><select data-cemap="${esc(n)}" aria-label="${esc(n)}"><option value="">${T('ce.create')}</option>${SUBJ.map(([k])=>`<option value="k:${k}">→ ${esc(sn(k))}</option>`).join('')}</select></div>`).join('')}</div>`:''}
<div class="mbody"><table class="cetable"><thead><tr><th>#</th><th>${T('b.day')}</th><th>${T('subject')}</th><th>${T('topic')}</th><th>${T('priority')}</th><th></th><th></th></tr></thead><tbody>${body||`<tr><td colspan="7" class="empty">${T('nothing')}</td></tr>`}</tbody></table></div>
<div class="row2" style="margin-top:14px;justify-content:space-between"><button class="secondary" data-act="ceadd">+ ${T('ce.addRow')}</button><span class="row2"><button class="secondary" data-act="ceno">${T('cancel')}</button><button class="primary" data-act="cenext">${T('ce.next')} →</button></span></div></div></div>`}
function ceToImp(){const ok=[],errs=[];CE.rows.forEach((r,i)=>{const e=rowErr(r);if(e)return errs.push({n:i+1,m:e});
ok.push({n:i+1,id:r.id,w:Math.ceil(r.day/7),d:(r.day-1)%7+1,s:r.s.startsWith('k:')?r.s.slice(2):'new:'+r.s.slice(2),p:r.pri,t:String(r.topic).trim(),wt:r.wt||''})});
return{name:CE.name,errs,ok,mode:CE.mode,off:new Set(),fromCE:true,kind:CE.kind,scope:CE.scope}}
// live edits in the table without redrawing it (keeps the cursor where it is)
function ceInput(el){const r=CE.rows[+el.dataset.r],f=el.dataset.ce;if(!r)return;
if(f=='day')r.day=el.value===''?NaN:num(el.value);else if(f=='topic')r.topic=el.value;else if(f=='pri'){r.pri=el.value;r.perr=''}
else if(f=='s'){if(el.value=='__add'){const n=(prompt(T('ce.addPrompt'))||'').trim();if(n){const k=subjKey(n);r.s=k?'k:'+k:'n:'+n}render();return}const was=r.s;r.s=el.value;if(was.startsWith('n:')||r.s.startsWith('n:')){render();return}}
const tr=el.closest('tr'),e=rowErr(r);tr.classList.toggle('bad',!!e);tr.querySelector('.cerr').textContent=e;const c=$('#ceerr');if(c)c.textContent=CE.rows.filter(rowErr).length}

function impPlan(m){const used=new Set(),add=[],chg=[],same=[];
m.ok.forEach(r=>{let p=r.id?P.find(x=>x.id==r.id&&!used.has(x.id)):null;
if(!p)p=P.find(x=>!used.has(x.id)&&!x.arch&&x.w==r.w&&x.d==r.d&&x.s==r.s&&x.t==r.t);
if(!p)return add.push(r);used.add(p.id);const f=[];
if(p.t!=r.t)f.push([T('topic'),p.t,r.t]);if(p.w!=r.w||p.d!=r.d)f.push([T('b.day'),lab(p.w,p.d),lab(r.w,r.d)]);if(p.s!=r.s)f.push([T('subject'),sn(p.s,p.w),sn(r.s,r.w)]);if((p.p||'')!=r.p)f.push([T('priority'),p.p||'—',r.p||'—']);if(p.arch)f.push([T('archive'),T('imp.archived'),T('imp.back')]);
f.length?chg.push({r,p,f}):same.push(r)});
const days=new Set(m.scope||m.ok.map(r=>ord(r.w,r.d)));
const del=m.mode=='append'?[]:P.filter(p=>!p.arch&&!used.has(p.id)&&(m.mode=='all'||days.has(ord(p.w,p.d))));
return{add,chg,same,del}}
function impWT(){return[]}
function impHtml(){const m=imp,pl=impPlan(m),ap=m.mode=='append',on=k=>!m.off.has(k),wt=impWT(m),ns=[...new Set(m.ok.filter(r=>r.s.startsWith('new:')).map(r=>r.s.slice(4)))],GOLD='background:var(--gold-bg);color:var(--gold-ink)',NAVY='background:var(--blue-bg);color:var(--navy)';
const nA=pl.add.filter((_,i)=>on('a'+i)).length,nC=ap?0:pl.chg.filter(c=>on('c'+c.p.id)).length,nD=pl.del.filter(p=>on('r'+p.id)).length;
const row=(k,tx,sub)=>`<label class="irow${k&&!on(k)?' off':''}">${k?`<input type="checkbox" data-imp="${k}"${on(k)?' checked':''}>`:''}<div><div class="tx">${tx}</div><div class="diff">${sub}</div></div></label>`;
const at=x=>`${lab(x.w,x.d)} · ${esc(sn(x.s,x.w))}${x.p?' · '+x.p:''}`;
const sec=(t,n,body,st)=>n?`<div class="ish"><span>${t}</span><span class="pending-count"${st?` style="${st}"`:''}>${n}</span></div>${body}`:'';
let b=sec(T('imp.errors'),m.errs.length,m.errs.map(e=>row('',T('imp.row',{n:e.n}),esc(e.m))).join(''));
b+=sec(T('imp.newSubj'),ns.length,ns.map(x=>row('',esc(x),T('imp.newSubjD'))).join(''),NAVY);
b+=sec(T('imp.wt'),wt.length,wt.map(([w,o,v])=>row('',T('week.n',{n:w}),`<del>${esc(o||'—')}</del> → <ins>${esc(v)}</ins>`)).join(''),GOLD);
b+=sec(ap?T('imp.chgAppend'):T('imp.chg'),pl.chg.length,pl.chg.map(c=>row(ap?'':'c'+c.p.id,esc(c.r.t),c.f.map(([l,o,v])=>`${l}: <del>${esc(o)}</del> → <ins>${esc(v)}</ins>`).join('<br>'))).join(''),GOLD);
b+=sec(T('imp.new'),pl.add.length,pl.add.map((x,i)=>row('a'+i,esc(x.t),at(x))).join(''),NAVY);
b+=sec(T('imp.del'),pl.del.length,pl.del.map(p=>row('r'+p.id,esc(p.t),at(p)+(done.has(p.id)?` · <b style="color:var(--red)">✓ ${T('imp.ticked')}</b>`:''))).join(''));
if(!b)b=`<p class="paneldesc" style="margin:16px 0">${T('imp.same')}</p>`;
const none=!nA&&!nC&&!nD&&!wt.length,M=MODES();
return `<div class="overlay"><div class="modal wide" role="dialog" aria-modal="true" aria-labelledby="it"><div class="eyebrow">${T('imp.eyebrow')} · ${esc(m.name)}</div><h2 id="it" style="font-size:22px;font-family:Fraunces,Georgia,serif;color:var(--navy-deep);margin-bottom:12px">${T('imp.title')}</h2>
<div class="row2"><span class="chip">${T('imp.new')} <b>${nA}</b></span><span class="chip">${T('imp.chg')} <b>${nC}</b></span><span class="chip">${T('archive')} <b>${nD}</b></span><span class="chip">${T('imp.unchanged')} <b>${pl.same.length}</b></span>${m.errs.length?`<span class="chip err">${T('imp.err')} <b>${m.errs.length}</b></span>`:''}</div>
${m.kind&&m.kind!='file'?`<p class="paneldesc" style="margin-top:12px">${T(m.kind=='week'?'imp.weekNote':'imp.newNote')} ${T('imp.untick')}</p>`:`<div class="seg" role="group">${M.map(([k,l])=>`<button data-act="impmode" data-m="${k}" aria-pressed="${m.mode==k}"${m.mode==k?' class="on"':''}>${l}</button>`).join('')}</div><p class="paneldesc" style="margin-top:8px">${M.find(x=>x[0]==m.mode)[2]} ${T('imp.untick')}</p>`}
<div class="mbody">${b}</div>
<div class="row2" style="margin-top:14px;justify-content:space-between"><span class="paneldesc" style="flex:1;min-width:200px">${T('imp.foot')}</span><span class="row2">${m.fromCE?`<button class="secondary" data-act="ceback">← ${T('ce.back')}</button>`:''}<button class="secondary" data-act="impno">${T('cancel')}</button><button class="primary" data-act="impgo"${none?' disabled':''}>${T('imp.apply')}</button></span></div></div></div>`}
function impApply(){const S=k=>k.startsWith('new:')?getSubj(k.slice(4)):k,m=imp,pl=impPlan(m),ap=m.mode=='append',on=k=>!m.off.has(k);let a=0,c=0,r=0;
ensureWeeks(Math.max(0,...m.ok.map(x=>x.w)));impWT(m).forEach(([w,,v])=>WT[w]=v);
pl.add.forEach((x,i)=>{if(!on('a'+i))return;P.push({id:++uid,w:x.w,d:x.d,s:S(x.s),t:x.t,p:x.p,ow:x.w,od:x.d,arch:false,from:''});a++});
if(!ap)pl.chg.forEach(({r:x,p})=>{if(!on('c'+p.id))return;if(p.w!=x.w||p.d!=x.d)p.from=lab(p.w,p.d);Object.assign(p,{t:x.t,s:S(x.s),p:x.p,w:x.w,d:x.d,arch:false});c++});
pl.del.forEach(p=>{if(on('r'+p.id)){p.arch=true;r++}});
const cw={};[...pl.add,...pl.chg.map(x=>x.r)].forEach(x=>cw[x.w]=(cw[x.w]||0)+1);imp=null;CE=null;toast(T('imp.done',{a,c,r}),1);return +Object.keys(cw).sort((x,y)=>cw[y]-cw[x])[0]||0}

// ---------- reminders (fire while the app is open; otherwise shown as missed) ----------
const mins=t=>{const[h,m]=t.split(':').map(Number);return h*60+m};
function remCheck(){if(!ME||VIEW)return;const now=new Date(),t=pad(now.getHours())+':'+pad(now.getMinutes()),today=isoOf(now);let ch=0;
R.forEach(r=>{if(!r.on||r.last==today||(r.r=='weekly'&&r.dow!=now.getDay())||t<r.t)return;r.last=today;ch=1;
if(mins(t)-mins(r.t)<=10){ding('focus');notify('⏰ '+T('rem.title'),r.m);toast('⏰ '+r.m)}else RM.push({t:r.t,m:r.m})});
if(ch){queueSave();if(!closing&&!imp&&!printOpen)render()}}

// ---------- remove a week: its topics go to Archive, later weeks move up one week (Undo brings it back) ----------
function removeWeek(w){const a=ord(w,1),b=ord(w,7),n=P.filter(p=>!p.arch&&p.w==w).length;
P.forEach(p=>{if(p.w==w)p.arch=true;else if(p.w>w)p.w--});
const shift=obj=>{const o={};for(const k in obj){const x=+k;if(x<a)o[x]=obj[k];else if(x>b)o[x-7]=obj[k]}return o};
HR=shift(HR);SEC=shift(SEC);HRC=shift(HRC);TGD=shift(TGD);closed=shift(closed);
revs=revs.filter(r=>r.o<a||r.o>b).map(r=>r.o>b?{...r,o:r.o-7}:r);FOC=FOC.filter(f=>f.o<a||f.o>b).map(f=>f.o>b?{...f,o:f.o-7}:f);
refl=refl.filter(r=>r.w!=w).map(r=>r.w>w?{...r,w:r.w-1}:r);
if(weeks().length>1)ALL.length-=7;if(BD.day>b)BD.day-=7;else if(BD.day>=a)BD.day=a;if(wkW>w)wkW--;
toast(T('wk.removed',{w,n}),1)}
