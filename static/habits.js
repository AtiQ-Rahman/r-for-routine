'use strict';
// ---------- Pause (the routine): take some calendar days off ----------
let pauseUI=null;
const fullOf=iso=>new Date(iso+'T00:00:00Z').toLocaleDateString(LANG()=='bn'?'bn-BD':'en-GB',{day:'numeric',month:'short',timeZone:'UTC'});
const dayHas=o=>hrs(o)>0||(SEC[o]||0)>0||!!closed[o];
// logs are kept per Day number. When a pause changes the Day number of past dates (today included), their
// logs move with the date. Later Day numbers (revisions, own to-dos) keep their Day and so move with the routine.
// Returns the first date that has study logged but would be paused (then nothing changes), else ''.
function remapDays(oldL,newL){const t=todayISO(),bad=[];
const chk=o=>{const iso=isoOfO(o,oldL);if(iso<=t&&pauseAt(iso,newL))bad.push(iso)};
for(const k in HR)if(HR[k]>0)chk(+k);for(const k in SEC)if(SEC[k]>0)chk(+k);for(const k in closed)if(closed[k])chk(+k);refl.forEach(r=>chk(ord(r.w,r.d)));
if(bad.length)return bad.sort()[0];
const mv=o=>{const iso=isoOfO(o,oldL);return iso<=t?(pauseAt(iso,newL)?0:oOfIso(iso,newL)):o};
[HR,TGD,SEC,HRC,closed,FGD].forEach(m=>{const e=Object.entries(m);for(const k in m)delete m[k];e.forEach(([k,v])=>{const n=mv(+k);if(n>0)m[n]=v})});
const mv2=o=>{const iso=isoOfO(o,oldL);return iso<=t?Math.max(1,oOfIso(iso,newL)):o};
revs.forEach(r=>r.o=mv2(r.o));FOC.forEach(f=>f.o=mv2(f.o));refl.forEach(r=>{const[w,d]=od(mv2(ord(r.w,r.d)));r.w=w;r.d=d});
return ''}
function setPauses(L){const bad=remapDays(PAUSE,L);if(bad){toast(T('pz.hasLog',{d:fullOf(bad)}));return false}PAUSE=L;syncCur();wkW=cur.w;wkSel=cur.d;return true}
function pzRead(){if(!pauseUI)return;const a=$('#pza'),n=$('#pzn'),w=$('#pzw');if(a&&a.value)pauseUI.a=a.value;if(n)pauseUI.n=Math.floor(num(n.value))||0;if(w)pauseUI.why=w.value}
function pzCheck(u){if(!(u.n>=1&&u.n<=120))return T('pz.badN');if(!/^\d{4}-\d\d-\d\d$/.test(u.a))return T('pz.badDate');if(u.a<START)return T('pz.beforeStart',{d:fullOf(START)});
const e=isoAdd(u.a,u.n-1);if(PAUSE.some(p=>p.a<=e&&u.a<=pauseEnd(p)))return T('pz.overlap');return ''}
function pauseHtml(){const u=pauseUI,t=todayISO(),err=pzCheck(u),len=routineLen();let prev='';
if(!err){const L=[...PAUSE,{a:u.a,n:u.n}],o=oOfIso(u.a),back=isoAdd(u.a,u.n);
prev=`<div class="pzprev"><div>⏸ <b>${fullOf(u.a)} - ${fullOf(isoAdd(u.a,u.n-1))}</b> · ${T('pz.nDays',{n:u.n})}</div><div>▶ ${T('pz.resume',{o,d:fullOf(back)})}</div><div>🏁 ${T('pz.end')}: ${fullOf(isoOfO(len))} → <b>${fullOf(isoOfO(len,L))}</b></div>${u.a<t?`<div class="pzwarn">${T('pz.pastNote')}</div>`:''}</div>`}
const qd=[[t,T('pz.today')],[isoAdd(t,1),T('pz.tomorrow')]],qn=[1,2,3,5,7,10];
const list=PAUSE.length?`<div class="pzlist">${[...PAUSE].sort((a,b)=>a.a<b.a?-1:1).map(p=>{const on=t>=p.a&&t<=pauseEnd(p),past=pauseEnd(p)<t;
return `<div class="pitem"><span style="flex:1">${on?'⏸ ':past?'✓ ':'📅 '}${fullOf(p.a)} - ${fullOf(pauseEnd(p))} · ${T('pz.nDays',{n:p.n})}${p.why?` · <i>${esc(p.why)}</i>`:''}</span>${on?`<button class="mini p" data-act="pzend" data-p="${p.id}">▶ ${T('pz.endNow')}</button>`:''}<button class="mini danger" data-act="pzdel" data-p="${p.id}" aria-label="${T('delete')}">✕</button></div>`}).join('')}</div>`:'';
return `<div class="overlay"><div class="modal" role="dialog" aria-modal="true" aria-labelledby="pzt"><div class="eyebrow">${T('pz.eyebrow')}</div><h2 id="pzt" class="mtitle">⏸ ${T('pz.title')}</h2>
<p class="paneldesc">${T('pz.desc')}</p>
<label class="lfield">${T('pz.from')}<input type="date" id="pza" value="${u.a}" min="${START}"></label><div class="seg" style="margin-top:8px">${qd.map(([v,l])=>`<button data-act="pzday" data-v="${v}"${u.a==v?' class="on"':''}>${l}</button>`).join('')}</div>
<label class="lfield">${T('pz.days')}<input type="number" id="pzn" min="1" max="120" value="${u.n||''}"></label><div class="seg" style="margin-top:8px">${qn.map(v=>`<button data-act="pzdays" data-v="${v}"${u.n==v?' class="on"':''}>${v}</button>`).join('')}</div>
<label class="lfield">${T('pz.why')}<input type="text" id="pzw" value="${esc(u.why||'')}" placeholder="${T('pz.whyPh')}" maxlength="80"></label>
${err?`<p class="pzwarn" style="margin-top:12px">${err}</p>`:prev}
${list?`<h3 class="msub">${T('pz.list')}</h3>${list}`:''}
<div class="row2" style="margin-top:18px;justify-content:space-between"><button class="secondary" data-act="pzno">${T('close')}</button><button class="primary" data-act="pzgo"${err?' disabled':''}>⏸ ${T('pz.go')}</button></div></div></div>`}
// banner on Today / Dashboard: paused now, or a pause coming within a week
function pauseBanner(){const t=todayISO(),p=pauseAt(t);if(p&&started()){const left=dayDiff(t,pauseEnd(p))+1;
return `<div class="banner pz">⏸ ${T('pz.now')}${p.why?` (${esc(p.why)})`:''} · ${T('pz.left',{n:left})} · ${T('pz.resume',{o:co(),d:fullOf(isoAdd(pauseEnd(p),1))})} ${VIEW?'':`<button class="mini p" data-act="pzend" data-p="${p.id}">▶ ${T('pz.endNow')}</button>`}</div>`}
const nx=PAUSE.filter(x=>x.a>t&&dayDiff(t,x.a)<=7).sort((a,b)=>a.a<b.a?-1:1)[0];
return nx?`<div class="banner soft">📅 ${T('pz.soon',{d:fullOf(nx.a),n:nx.n})} ${VIEW?'':`<button class="link" data-act="pzopen">${T('pz.manage')}</button>`}</div>`:''}
function pauseAction(D){const t=todayISO();switch(D.act){
case'pzopen':pauseUI={a:dayHas(co())&&!pausedToday()?isoAdd(t,1):t,n:3,why:''};return true;
case'pzno':pauseUI=null;return true;
case'pzday':pzRead();pauseUI.a=D.v;return true;
case'pzdays':pzRead();pauseUI.n=+D.v;return true;
case'pzgo':{pzRead();const u=pauseUI,err=pzCheck(u);if(err){toast(err);return true}
const id=PAUSE.reduce((a,p)=>Math.max(a,p.id||0),0)+1;if(!setPauses([...PAUSE,{id,a:u.a,n:u.n,why:(u.why||'').trim().slice(0,80)}]))return true;
pauseUI=null;toast(T('pz.done',{n:u.n,d:fullOf(isoAdd(u.a,u.n))}),1);return true}
case'pzdel':{const p=PAUSE.find(x=>x.id==+D.p);if(!p||!confirm(T('pz.delQ',{a:fullOf(p.a),b:fullOf(pauseEnd(p))})))return false;if(setPauses(PAUSE.filter(x=>x!=p)))toast(T('pz.deleted'),1);return true}
case'pzend':{const p=PAUSE.find(x=>x.id==+D.p);if(!p)return false;const n=dayDiff(p.a,t);
if(setPauses(n>0?PAUSE.map(x=>x==p?{...x,n}:x):PAUSE.filter(x=>x!=p))){toast(T('pz.ended',{o:co()}),1);if(tab!='today'&&!pauseUI)tab='today'}return true}}
return false}

// ---------- Habits: small daily things you want to build (account-wide, kept in SET.hab) ----------
// a habit: {id,name,icon,cue,mini,why,time,days:[0-6] (empty = every day),start,goal,arch}
// log[id][date] = 'd' done · 'm' small version done (both keep the streak) · 's' rest day (doesn't break it)
let habUI=null;const HFIRED=new Set();
const HB=()=>SET.hab,HICONS=['🧘','🏃','📖','💧','😴','📵','🕌','✍️','🥗','🌅','🧹','🎯'];
const HTPL=()=>T('hb.tpl').split('|').map(x=>{const[icon,name,cue,mini,why]=x.split('~');return{icon,name,cue,mini,why}});
const dowOf=iso=>new Date(iso+'T00:00:00Z').getUTCDay();
const hSched=(h,iso)=>iso>=h.start&&(!h.days||!h.days.length||h.days.includes(dowOf(iso)));
const hVal=(h,iso)=>((HB().log[h.id]||{})[iso])||'';
function hSet(h,iso,v){const lg=HB().log,L=lg[h.id]=lg[h.id]||{};if(v)L[iso]=v;else delete L[iso]}
const hOk=v=>v=='d'||v=='m';
const habsLive=()=>HB().list.filter(h=>!h.arch);
const habsOn=iso=>habsLive().filter(h=>hSched(h,iso));
// streak: scheduled days in a row, done (or small version); rest days and unscheduled days are skipped over;
// today only counts once ticked, so an unticked today doesn't break it yet
function hStreak(h){const t=todayISO();let iso=hOk(hVal(h,t))?t:isoAdd(t,-1),n=0;
for(let i=0;i<3000&&iso>=h.start;i++,iso=isoAdd(iso,-1)){if(!hSched(h,iso))continue;const v=hVal(h,iso);if(v=='s')continue;if(hOk(v))n++;else break}return n}
function hScan(h){const t=todayISO();let best=0,c=0,sch=0,ok=0;
for(let iso=h.start,i=0;iso<=t&&i<3000;iso=isoAdd(iso,1),i++){if(!hSched(h,iso))continue;const v=hVal(h,iso);if(v=='s')continue;if(iso==t&&!hOk(v))continue;sch++;if(hOk(v)){ok++;c++;best=Math.max(best,c)}else c=0}
return{best,rate:sch?Math.round(ok/sch*100):null,ok,sch}}
const hDay=h=>dayDiff(h.start,todayISO())+1;
// "never miss twice": yesterday was due and nothing was ticked
const hMissedY=h=>{const y=isoAdd(todayISO(),-1);return y>=h.start&&hSched(h,y)&&!hVal(h,y)};
const hDaysTxt=h=>!h.days||!h.days.length||h.days.length==7?T('hb.everyDay'):h.days.map(d=>DOWS()[d]).join(', ');

// one habit's tick row (Habits tab, Today, Dashboard)
function habRow(h){const t=todayISO(),v=hVal(h,t),s=hStreak(h),miss=!v&&hMissedY(h);
return `<div class="hrow${hOk(v)?' ok':''}${v=='s'?' rest':''}"><button class="hchk${hOk(v)?' done':''}" data-act="hbtick" data-h="${h.id}" aria-pressed="${hOk(v)}" aria-label="${T('a.tick')}: ${esc(h.name)}">${v=='m'?'½':'✓'}</button>
<span class="hico" aria-hidden="true">${esc(h.icon||'•')}</span><div class="hcopy"><b class="${hOk(v)?'done':''}">${esc(h.name)}</b><small>${[h.cue,h.time?'⏰ '+h.time:''].filter(Boolean).map(esc).join(' · ')}${v=='m'?` · ${T('hb.didMini')}`:v=='s'?` · ${T('hb.rested')}`:''}</small>
${miss?`<small class="hwarn">${T('hb.missY')}${h.mini?` ${T('hb.atLeast',{m:esc(h.mini)})}`:''}</small>`:''}</div>
<span class="hstreak${s?'':' zero'}" title="${T('hb.streak')}">🔥 ${s}</span>
${VIEW?'':`<span class="hbtns">${h.mini&&v!='d'?`<button class="mini${v=='m'?' p':''}" data-act="hbmini" data-h="${h.id}" title="${esc(h.mini)}">½ ${T('hb.mini')}</button>`:''}${hOk(v)?'':`<button class="mini${v=='s'?' p':''}" data-act="hbskip" data-h="${h.id}" title="${T('hb.restT')}">${T('hb.rest')}</button>`}</span>`}</div>`}
// small panel for Today and Dashboard
function habitsPanel(){if(VIEW)return'';const L=habsOn(todayISO());if(!L.length)return'';const d=L.filter(h=>hOk(hVal(h,todayISO()))).length;
return `<div id="habbox">${panel(`${T('hb.today')} <span class="pending-count hcount${d==L.length?' all':''}">${d} / ${L.length}</span>`,T('hb.todayDesc'),`<button class="link" data-tab="habits">${T('open')} ↗</button>`,L.map(habRow).join(''))}</div>`}
// one line inside Today's focus: how today's habits stand; tapping it jumps to the habits box
function habLine(){if(VIEW)return'';const t=todayISO(),L=habsOn(t);if(!L.length)return'';const ok=L.filter(h=>hOk(hVal(h,t))),left=L.filter(h=>!hVal(h,t));
return `<button class="hline${ok.length==L.length?' all':''}" data-act="hbgo">${esc(L[0].icon||'•')} <b>${T('hb.today')}: ${ok.length}/${L.length}</b>${ok.length==L.length?' ✓':left.length?` · ${T('hb.leftL')}: ${left.map(h=>esc(h.name)).join(', ')}`:''} <span aria-hidden="true">↓</span></button>`}
// day close: habits of today not ticked yet, with their buttons, before the day is closed
function habClose(){if(VIEW||pausedToday())return'';const t=todayISO(),L=habsOn(t).filter(h=>!hVal(h,t));if(!L.length)return'';
return `<div class="hclose"><div class="eyebrow" style="margin:0 0 4px">${T('hb.closeT')}</div><p class="paneldesc" style="margin:0 0 4px">${T('hb.closeD')}</p>${L.map(habRow).join('')}</div>`}

// a habit's day grid: the challenge days (or the last 5 weeks once it runs long)
function habGrid(h){const t=todayISO(),k=hDay(h),goal=h.goal||30,n=goal<=70?goal:35,from=goal<=70?h.start:isoAdd(t,-(n-1));let c='';
for(let i=0;i<Math.max(n,goal<=70&&k>goal?k:0)&&i<120;i++){const iso=isoAdd(from,i),v=hVal(h,iso),sch=hSched(h,iso),fut=iso>t,cls=fut?'fut':!sch?'off':v=='d'?'d':v=='m'?'m':v=='s'?'s':iso==t?'now':'x';
c+=`<button class="hcell ${cls}${iso==t?' today':''}" ${fut?'disabled':`data-act="hbcell" data-h="${h.id}" data-d="${iso}"`} title="${fullOf(iso)}${cls=='x'?' · '+T('hb.missed'):cls=='off'?' · '+T('hb.offDay'):''}">${dayDiff(h.start,iso)+1}</button>`}
return `<div class="hgrid">${c}</div>`}
function habCard(h){const k=hDay(h),goal=h.goal||30,sc=hScan(h),s=hStreak(h),pct=Math.min(100,Math.round(Math.max(0,k)/goal*100)),fin=k>goal;
const stat=(l,v)=>`<div class="hstat"><b>${v}</b><small>${l}</small></div>`;
return `<section class="panel hcard"><div class="panelhead"><div><h2><span class="hico big">${esc(h.icon||'•')}</span> ${esc(h.name)}</h2><p class="paneldesc">${[h.cue&&T('hb.when')+': '+h.cue,hDaysTxt(h),h.time&&'⏰ '+h.time].filter(Boolean).map(esc).join(' · ')}</p></div>
<span class="row2"><button class="mini" data-act="hbedit" data-h="${h.id}">✎ ${T('edit')}</button><button class="mini" data-act="hbarch" data-h="${h.id}" title="${T('hb.archT')}">⏸ ${T('hb.arch')}</button></span></div>
${h.why?`<p class="hwhy">“${esc(h.why)}”</p>`:''}
<div class="hstats">${stat(T('hb.streak'),'🔥 '+s)}${stat(T('hb.best'),'🏆 '+sc.best)}${stat(T('hb.rate'),sc.rate==null?'-':sc.rate+'%')}${stat(T('hb.chal'),k<1?T('hb.notYet'):fin?'✓ '+goal:`${k} / ${goal}`)}</div>
<div class="hbar" title="${pct}%"><span style="width:${k<1?0:pct}%"></span></div>
${k<1?`<p class="paneldesc">${T('hb.startsOn',{d:fullOf(h.start)})}</p>`:fin?`<div class="banner soft">🎉 ${T('hb.finished',{n:goal,ok:sc.ok})} <button class="mini p" data-act="hbmore" data-h="${h.id}">+30 ${T('hb.days')}</button></div>`:''}
${habGrid(h)}<p class="hlegend"><span class="hcell d"></span>${T('hb.lgDone')} <span class="hcell m"></span>${T('hb.lgMini')} <span class="hcell s"></span>${T('hb.lgRest')} <span class="hcell x"></span>${T('hb.lgMiss')} · ${T('hb.tapFix')}</p>
${h.mini?`<p class="paneldesc">½ ${T('hb.miniIs')}: ${esc(h.mini)}</p>`:''}</section>`}
function vHabits(){const L=habsLive(),A=HB().list.filter(h=>h.arch),t=todayISO(),due=habsOn(t),off=L.filter(h=>!hSched(h,t)&&h.start<=t);
let h=hd(T('hb.eyebrow'),T('hb.h1'),T('hb.sub'),`<button class="primary" data-act="hbnew">+ ${T('hb.new')}</button>`);
if(!L.length)h+=panel(T('hb.emptyT'),T('hb.emptyD'),'',`<div class="hhow">${T('hb.how')}</div><div class="htpl">${HTPL().map((x,i)=>`<button class="secondary" data-act="hbnew" data-i="${i}">${x.icon} ${esc(x.name)}</button>`).join('')}</div>`);
else{h+=panel(`${T('hb.today')} <span class="pending-count hcount${due.length&&due.every(x=>hOk(hVal(x,t)))?' all':''}">${due.filter(x=>hOk(hVal(x,t))).length} / ${due.length}</span>`,T('hb.todayDesc'),'',(due.map(habRow).join('')||`<p class="paneldesc">${T('hb.noneToday')}</p>`)+(off.length?`<p class="paneldesc" style="margin-top:10px">${T('hb.offToday')}: ${off.map(x=>esc(x.icon+' '+x.name)).join(', ')}</p>`:''));
h+=L.map(habCard).join('')}
if(A.length)h+=fold('harch',T('hb.archived'),T('hb.archivedD'),A.map(x=>`<div class="pitem"><span style="flex:1">${esc(x.icon+' '+x.name)} · 🏆 ${hScan(x).best}</span><button class="mini" data-act="hbunarch" data-h="${x.id}">▶ ${T('hb.unarch')}</button><button class="mini danger" data-act="hbdel" data-h="${x.id}" aria-label="${T('delete')}">✕</button></div>`).join(''),false);
return h}

// add / edit form (a modal)
function habRead(){if(!habUI)return;const g=id=>{const e=$('#'+id);return e?e.value:null};['name:hbn','cue:hbc','mini:hbm','why:hbw','time:hbt','start:hbs'].forEach(x=>{const[k,id]=x.split(':'),v=g(id);if(v!=null)habUI[k]=k=='start'?v:v.replace(/\s+$/,'')});const gl=g('hbg');if(gl!=null)habUI.goal=Math.floor(num(gl))||0}
function habHtml(){const u=habUI,ed=!!u.id,dw=DOWS(),all=!u.days.length||u.days.length==7,f=(id,l,v,ph,hint)=>`<label class="lfield">${l}<input type="text" id="${id}" value="${esc(v||'')}" placeholder="${esc(ph)}" maxlength="80">${hint?`<small class="lhint">${hint}</small>`:''}</label>`;
return `<div class="overlay"><div class="modal" role="dialog" aria-modal="true" aria-labelledby="hbt0"><div class="eyebrow">${T('hb.eyebrow')}</div><h2 id="hbt0" class="mtitle">${ed?T('hb.editT'):T('hb.newT')}</h2>
${ed?'':`<p class="paneldesc">${T('hb.pick')}</p><div class="htpl">${HTPL().map((x,i)=>`<button class="mini" data-act="hbtpl" data-i="${i}">${x.icon} ${esc(x.name)}</button>`).join('')}</div>`}
${f('hbn','1. '+T('hb.fName'),u.name,T('hb.fNamePh'))}
<div class="seg" style="margin-top:8px">${HICONS.map(i=>`<button data-act="hbicon" data-v="${i}"${u.icon==i?' class="on"':''} aria-label="${i}">${i}</button>`).join('')}</div>
<label class="lfield">2. ${T('hb.fGoal')}<input type="number" id="hbg" min="1" max="365" value="${u.goal||''}"><small class="lhint">${T('hb.fGoalHint')}</small></label>
<div class="seg" style="margin-top:8px">${[21,30,40,66].map(v=>`<button data-act="hbgoal" data-v="${v}"${u.goal==v?' class="on"':''}>${T('hb.nDays',{n:v})}</button>`).join('')}</div>
<p class="lfield" style="margin-bottom:0">3. ${T('hb.fDays')}</p><div class="seg" style="margin-top:8px"><button data-act="hbday" data-v="all"${all?' class="on"':''}>${T('hb.everyDay')}</button>${dw.map((n,i)=>`<button data-act="hbday" data-v="${i}"${!all&&u.days.includes(i)?' class="on"':''}>${n}</button>`).join('')}</div>
${f('hbc','4. '+T('hb.fCue'),u.cue,T('hb.fCuePh'),T('hb.fCueHint'))}
<label class="lfield">${T('hb.fTime')}<input type="time" id="hbt" value="${esc(u.time||'')}"><small class="lhint">${T('hb.fTimeHint')}</small></label>
${f('hbm','5. '+T('hb.fMini'),u.mini,T('hb.fMiniPh'),T('hb.fMiniHint'))}
${f('hbw','6. '+T('hb.fWhy'),u.why,T('hb.fWhyPh'),T('hb.fWhyHint'))}
<label class="lfield">${T('hb.fStart')}<input type="date" id="hbs" value="${esc(u.start)}"></label>
${u.err?`<p class="pzwarn" style="margin-top:12px">${esc(u.err)}</p>`:''}
<div class="row2" style="margin-top:18px;justify-content:space-between">${ed?`<button class="secondary danger" data-act="hbdel" data-h="${u.id}">✕ ${T('delete')}</button>`:'<span></span>'}<span class="row2"><button class="secondary" data-act="hbno">${T('cancel')}</button><button class="primary" data-act="hbsave">${ed?T('save'):'+ '+T('hb.add')}</button></span></div></div></div>`}

function habAction(D){const t=todayISO(),L=HB().list,h=L.find(x=>x.id==+D.h);habRead();
const tickToast=x=>{const s=hStreak(x);if([3,7,14,21,30,40,50,66,100].includes(s)){ding('target');toast(T('hb.milestone',{n:s,h:x.name}))}else toast(T('hb.tickT',{n:s}))};
switch(D.act){
case'hbgo':{const b=$('#habbox');if(b)b.scrollIntoView({behavior:'smooth',block:'start'});else go('habits');return false}
case'hbnew':{const p=D.i!=null?HTPL()[+D.i]:{};habUI={id:0,name:p.name||'',icon:p.icon||'🧘',cue:p.cue||'',mini:p.mini||'',why:p.why||'',time:'',days:[],goal:30,start:t,err:''};focusSel='#hbn';return true}
case'hbtpl':{const p=HTPL()[+D.i];Object.assign(habUI,{name:p.name,icon:p.icon,cue:p.cue,mini:p.mini,why:p.why});return true}
case'hbicon':habUI.icon=D.v;return true;
case'hbgoal':habUI.goal=+D.v;return true;
case'hbday':{if(D.v=='all'){habUI.days=[];return true}const d=+D.v,s=new Set(habUI.days.length?habUI.days:[]);s.has(d)?s.delete(d):s.add(d);habUI.days=[...s].sort();if(habUI.days.length==7)habUI.days=[];return true}
case'hbno':habUI=null;return true;
case'hbsave':{const u=habUI;u.err='';if(!u.name.trim()){u.err=T('hb.needName');focusSel='#hbn';return true}if(!(u.goal>=1&&u.goal<=365)){u.err=T('hb.badGoal');return true}if(!/^\d{4}-\d\d-\d\d$/.test(u.start))u.start=t;
const o={name:u.name.trim().slice(0,60),icon:u.icon,cue:u.cue.trim(),mini:u.mini.trim(),why:u.why.trim(),time:u.time||'',days:u.days,goal:u.goal,start:u.start};
if(u.id){Object.assign(L.find(x=>x.id==u.id),o);toast(T('m.saved'))}else{const id=++HB().nid;L.push({id,...o,arch:false});toast(T('hb.added',{h:o.name}))}habUI=null;return true}
case'hbedit':if(!h)return false;habUI={...h,days:[...(h.days||[])],err:''};return true;
case'hbdel':{if(!h||!confirm(T('hb.delQ',{h:h.name})))return false;HB().list=L.filter(x=>x!=h);delete HB().log[h.id];habUI=null;toast(T('hb.deleted'));return true}
case'hbarch':if(!h)return false;h.arch=true;toast(T('hb.archDone',{h:h.name}));return true;
case'hbunarch':if(!h)return false;h.arch=false;return true;
case'hbmore':if(!h)return false;h.goal=(h.goal||30)+30;toast(T('hb.extended',{n:h.goal}));return true;
case'hbtick':{if(!h)return false;const v=hVal(h,t);hSet(h,t,hOk(v)?'':'d');if(!hOk(v))tickToast(h);focusSel=`[data-act=hbtick][data-h="${h.id}"]`;return true}
case'hbmini':{if(!h)return false;const v=hVal(h,t);hSet(h,t,v=='m'?'':'m');if(v!='m')tickToast(h);return true}
case'hbskip':{if(!h)return false;const v=hVal(h,t);hSet(h,t,v=='s'?'':'s');if(v!='s')toast(T('hb.restDone'));return true}
case'hbcell':{if(!h||D.d>t)return false;const nx={'':'d',d:'m',m:'s',s:''}[hVal(h,D.d)];hSet(h,D.d,h.mini||nx!='m'?nx:'s');return true}}
return false}

// reminder: at the habit's time (while the app is open), once a day, if not ticked yet
function habCheck(){if(!ME||VIEW)return;const now=new Date(),hm_=pad(now.getHours())+':'+pad(now.getMinutes()),t=todayISO();
habsOn(t).forEach(h=>{if(!h.time||hVal(h,t)||hm_<h.time||mins(hm_)-mins(h.time)>30)return;const k=h.id+'|'+t;if(HFIRED.has(k))return;HFIRED.add(k);
const m=`${h.icon||''} ${h.name}${h.cue?' · '+h.cue:''}${h.mini?' · '+T('hb.atLeast',{m:h.mini}):''}`;ding('focus');notify(T('hb.remT'),m);toast(m)})}
setInterval(habCheck,30000);
