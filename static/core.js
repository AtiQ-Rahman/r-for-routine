'use strict';
// ---------- basics ----------
const $=s=>document.querySelector(s),esc=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const $$=s=>[...document.querySelectorAll(s)];
const pad=n=>String(n).padStart(2,'0'),clone=o=>JSON.parse(JSON.stringify(o));

// ---------- the user's routine (one JSON document, saved on the server) ----------
const SUBJ=[],SNAME={},WT={},ALL=[];
let SMIN={},FGD={},P=[],uid=0,done=new Set(),START='',notes={},TG=10,TGD={},HR={},revs=[],rid=0,LAD=[1,3,7,14,30],refl=[],R=[],RM=[],FOC=[],fid=0,pin=new Set(),nof=new Set(),SEC={},HRC={},PNAME='',closed={};
const SET0={lang:'en',notif:false,theme:'system',pomo:{focus:25,short:5,long:15,every:4,auto:false,autoHour:true},snd:{on:true,hour:true,vol:.6},fg:{on:true,grace:10,mode:'pause',alert:'alarm',blur:true,strict:false,strictMin:2}};
let SET=clone(SET0);

// ---------- screen state ----------
let tab='dash',cur={w:1,d:1},wkW=1,wkSel=1,rfDay={w:1,d:1},noteOpen=0,editing=0,adding=null,closing=false,renaming='',wEdit=false,qadd='',
  printOpen=false,PR={},planOpen=new Set([1]),undoSnap=null,BD={day:1},TF={s:'',p:''},bedit=0,focusSel='',closeDraft=null,imp=null;
// account
const TKEY='routine-token',LKEY='routine-lang';
let ME=null,TOKEN=null,REV=0,lastSaved='',saveTimer=0,LG={mode:'login',phone:'',name:'',err:''},WAITING=0,moreOpen=false,SESS=null,ADM=null,VIEW=null,OWN=null;
// projects: PROJ = the open one, PROJS = list with server summaries; Settings (SET) belong to the user, not a project
let PROJ=null,PROJS=[],projUI=null,OV=null,CE=null,lastPrefs='',prefTimer=0,FOLD={},FF={s:'',p:''};
try{TOKEN=localStorage.getItem(TKEY)}catch(e){}

// ---------- language ----------
const LANG=()=>SET.lang||'en';
const errT=e=>{const k='err.'+(e&&e.message);return I18N[k]?T(k):T('err.net')};
function T(k,v){const e=I18N[k];let s=e?(LANG()=='bn'?e[1]:e[0]):k;if(v)for(const x in v)s=s.split('{'+x+'}').join(v[x]);return s}
const DOWS=()=>T('cal.dow').split(','),MONS=()=>T('cal.mon').split(',');

// ---------- days: Day N counts from the plan start date, by the calendar ----------
const ord=(w,d)=>(w-1)*7+d,od=o=>[Math.floor((o-1)/7)+1,(o-1)%7+1];
const lab=(w,d)=>T('day.n',{n:ord(w,d)}),wd=(w,d)=>`W${w}D${d}`,labf=(w,d)=>`${lab(w,d)} · ${wd(w,d)}`,dlab=o=>lab(...od(o));
const TODAY_Q=new URLSearchParams(location.search).get('today');   // ?today=YYYY-MM-DD only for testing
const isoOf=d=>`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
const todayISO=()=>TODAY_Q||isoOf(new Date());
const dayDiff=(a,b)=>Math.round((Date.parse(b+'T00:00:00Z')-Date.parse(a+'T00:00:00Z'))/864e5);
const started=()=>dayDiff(START,todayISO())>=0;
const co=()=>Math.max(1,dayDiff(START,todayISO())+1);
const planLen=()=>Math.max(co(),...P.filter(p=>!p.arch).map(p=>ord(p.w,p.d)));
// pending revisions (they may fall after the routine ends; no week is created for them)
const openRevs=()=>revs.filter(r=>!r.done&&P.some(p=>p.id==r.pid&&!p.arch));
// days you can move work to: the routine's days from today on, and at least the next two weeks
const daysFrom=from=>{const out=[],last=Math.max(ALL.length,co()+13);for(let o=Math.max(1,from);o<=last;o++)out.push(od(o));return out};
function dd(w,d){const s=new Date(Date.parse(START+'T00:00:00Z')+(ord(w,d)-1)*864e5);
return{iso:s.toISOString().slice(0,10),dow:DOWS()[s.getUTCDay()],day:pad(s.getUTCDate()),mon:MONS()[s.getUTCMonth()],
full:s.toLocaleDateString(LANG()=='bn'?'bn-BD':'en-GB',{weekday:'long',day:'numeric',month:'long',year:'numeric',timeZone:'UTC'})}}
function ensureWeeks(n){while(ALL.length/7<n){const w=ALL.length/7+1;for(let d=1;d<=7;d++)ALL.push([w,d])}}
const weeks=()=>[...new Set(ALL.map(x=>x[0]))];
// called on every render: today's week/day, and unfinished own to-dos follow you to today
function syncCur(){const[w,d]=od(co());cur={w,d};
FOC.forEach(f=>{if(f.o<co()&&!f.done){f.from=f.from||dlab(f.o);f.o=co()}})}

// ---------- subjects ----------
const sn=(k,w)=>SNAME[k]||String(k).replace(/^new:/,'');
function subjKey(v){const x=String(v).trim(),l=x.toLowerCase();if(SUBJ.some(s=>s[0]==l))return l;for(const k in SNAME)if(String(SNAME[k]).toLowerCase()==l)return k;return ''}
function getSubj(name){const k=subjKey(name);if(k)return k;let i=SUBJ.length;while(SNAME['c'+i]||SUBJ.some(x=>x[0]=='c'+i))i++;const n='c'+i;SUBJ.push([n]);SNAME[n]=name.trim();return n}

// ---------- tasks ----------
function act(w,d){let a=P.filter(p=>!p.arch&&p.w==w&&p.d==d);if(ord(w,d)<co())a=[...a.filter(p=>done.has(p.id)),...a.filter(p=>!done.has(p.id))];return a}
const pendingList=()=>P.filter(p=>!p.arch&&ord(p.w,p.d)<co()&&!done.has(p.id));
const cnt=a=>a.filter(p=>done.has(p.id)).length,pc=a=>a.length?Math.round(cnt(a)/a.length*100):0;
const revsOn=o=>revs.filter(r=>r.o==o),overdueRevs=()=>revs.filter(r=>!r.done&&r.o<co()&&P.some(p=>p.id==r.pid&&!p.arch)),pendCount=()=>pendingList().length+overdueRevs().length;
// HR[o] = hours studied that day; TGD[o] = that day's target (frozen once the day is past), else current TG
const hrs=o=>HR[o]||0,tgt=o=>TGD[o]??TG;
function streak(){let o=co(),n=0;if(hrs(o)<tgt(o))o--;while(o>=1&&hrs(o)>=tgt(o)){n++;o--}return n}
// planned minutes: a topic's own estimate, else its subject's default (Settings → Subjects)
const estOf=p=>p.est>0?p.est:(SMIN[p.s]||0),fmtM=m=>hm((m||0)*60),hShort=m=>m>=60?(Math.round(m/6)/10)+'h':m+'m';
// in Today's focus: ★ topics, plus today's High-priority topics automatically (unless taken out with ★)
const inFocus=p=>pin.has(p.id)||(p.p=='High'&&ord(p.w,p.d)==co()&&!nof.has(p.id));
// everything to do on a day: routine topics plus own to-dos (Today's focus)
const dayCount=o=>{const ps=P.filter(p=>!p.arch&&ord(p.w,p.d)==o),fs=FOC.filter(f=>f.o==o),n=ps.length+fs.length,d=cnt(ps)+fs.filter(f=>f.done).length;return{d,n,pct:n?Math.round(d/n*100):0}};
const planMin=o=>P.reduce((a,p)=>a+(!p.arch&&ord(p.w,p.d)==o?estOf(p):0),0)+FOC.reduce((a,f)=>a+(f.o==o?f.est||0:0),0);
// first-time defaults: a subject that belongs to only a few weeks is that week's main subject (3 h), everyday ones 1 h
function defaultSMIN(){const wk={};P.forEach(p=>(wk[p.s]=wk[p.s]||new Set()).add(p.w));const o={};for(const k in wk)o[k]=wk[k].size<=3?180:60;return o}
const sorted=()=>[...refl].sort((a,b)=>ord(b.w,b.d)-ord(a.w,a.d));
const mmss=ms=>{const t=Math.max(0,Math.ceil(ms/1000));return `${pad(Math.floor(t/60))}:${pad(t%60)}`};
const hm=sec=>{const m=Math.floor((sec||0)/60);return m>=60?T('t.hm',{h:Math.floor(m/60),m:pad(m%60)}):T('t.min',{m})};

// ---------- whole-state snapshot: saved to the server, also used for Undo ----------
function snapObj(){return{v:3,PNAME,P,uid,done:[...done],START,notes,TG,TGD,HR,revs,rid,LAD,refl,R,RM,FOC,fid,pin:[...pin],nof:[...nof],SUBJ,SNAME,WT,nw:ALL.length/7,SEC,HRC,closed,FGD,SMIN}}
const snap=()=>JSON.stringify(snapObj());
function restore(j){const o=typeof j=='string'?JSON.parse(j):j;
PNAME=o.PNAME||'';P=o.P||[];uid=o.uid||P.reduce((a,p)=>Math.max(a,p.id),0);done=new Set(o.done||[]);START=o.START||todayISO();notes=o.notes||{};TG=o.TG||10;TGD=o.TGD||{};HR=o.HR||{};
revs=o.revs||[];rid=o.rid||0;LAD=o.LAD||[1,3,7,14,30];refl=o.refl||[];R=o.R||[];RM=o.RM||[];FOC=o.FOC||[];fid=o.fid||0;pin=new Set(o.pin||[]);nof=new Set(o.nof||[]);SEC=o.SEC||{};HRC=o.HRC||{};closed=o.closed||{};FGD=o.FGD||{};
SUBJ.splice(0,SUBJ.length,...(o.SUBJ||[]));for(const k in SNAME)delete SNAME[k];Object.assign(SNAME,o.SNAME||{});for(const k in WT)delete WT[k];Object.assign(WT,o.WT||{});
ALL.length=0;ensureWeeks(Math.max(1,o.nw||1));const mm=migrateMain();
// once: earlier versions added empty weeks for revisions/today past the routine end; drop trailing weeks without topics
let trimmed=false;if((o.v||1)<3){const last=P.reduce((a,p)=>Math.max(a,p.w),1);if(ALL.length/7>last){ALL.length=last*7;trimmed=true}}
if(trimmed&&o.SMIN){SMIN=o.SMIN;return true}if(!o.SMIN){SMIN=defaultSMIN();return true}SMIN=o.SMIN;return mm}
const mergeSet=st=>{st=st||{};return{...SET0,...st,pomo:{...SET0.pomo,...st.pomo},snd:{...SET0.snd,...st.snd},fg:{...SET0.fg,...st.fg}}};
// older routines had one "main" subject whose name changed by week: give those topics real subjects
function migrateMain(){if(!SUBJ.some(s=>s[0]=='main')&&!P.some(p=>p.s=='main'))return false;const before=new Set(SUBJ.map(s=>s[0]));
P.forEach(p=>{if(p.s=='main'){const n=String(WT[p.w]||T('subj.main')).split(' - ')[0].trim();p.s=getSubj(n)}});
const i=SUBJ.findIndex(s=>s[0]=='main');if(i>=0)SUBJ.splice(i,1);
const made=SUBJ.filter(s=>!before.has(s[0]));SUBJ.splice(0,SUBJ.length,...made,...SUBJ.filter(s=>before.has(s[0])));return true}

// ---------- server ----------
async function api(method,path,body,keep){
const r=await fetch('api/'+path,{method,keepalive:!!keep,headers:{'Content-Type':'application/json',...(TOKEN?{Authorization:'Bearer '+TOKEN}:{})},body:body==null?undefined:typeof body=='string'?body:JSON.stringify(body)});
let d=null;try{d=await r.json()}catch(e){}
if(!r.ok){const e=new Error(d&&d.error||String(r.status));e.status=r.status;e.data=d;throw e}return d}
function setSync(s){const e=$('#sync');if(!e)return;e.className='sync'+(s=='ok'?'':' '+s);e.title=T('sync.'+s)}
// save shortly after a change; on a conflict (same account changed on another device) load the newer copy
function queueSave(){if(!ME||VIEW||!PROJ)return;if(snap()==lastSaved)return;clearTimeout(saveTimer);saveTimer=setTimeout(flush,700)}
async function flush(keep){if(!ME||VIEW||!PROJ)return;const s=snap();if(s==lastSaved)return;setSync('saving');
try{const r=await api('PUT','projects/'+PROJ.id,`{"rev":${REV},"state":${s}}`,keep);REV=r.rev;lastSaved=s;setSync('ok')}
catch(e){if(e.status==409&&e.data&&e.data.state){REV=e.data.rev;restore(e.data.state);lastSaved=snap();toast(T('sync.reloaded'));render();setSync('ok')}
else if(e.status==401){logoutLocal()}else{setSync('off');clearTimeout(saveTimer);saveTimer=setTimeout(flush,5000)}}}

// user settings (language, theme, timer, sound) are saved to the account, shared by all projects
function queuePrefs(){if(!ME||VIEW)return;const s=JSON.stringify(SET);if(s==lastPrefs)return;clearTimeout(prefTimer);prefTimer=setTimeout(async()=>{const v=JSON.stringify(SET);try{await api('PUT','prefs',`{"prefs":${v}}`);lastPrefs=v}catch(e){}},800)}

// ---------- small UI helpers ----------
function toast(m,u){const t=$('#toast'),ok=u&&undoSnap&&!VIEW;t.innerHTML=esc(m)+(ok?`<button class="tundo" data-act="undo">${T('undo')}</button>`:'');t.classList.toggle('act',!!ok);t.classList.add('on');clearTimeout(toast.t);toast.t=setTimeout(()=>{t.classList.remove('on','act')},ok?7000:2600)}
const hd=(ey,h,sub,btn)=>`<div class="headrow"><div><div class="eyebrow">${ey}</div><h1>${h}</h1><p class="subtitle">${sub}</p></div>${btn||''}</div>`;
const panel=(t,d,r,body)=>`<section class="panel"><div class="panelhead"><div><h2>${t}</h2><p class="paneldesc">${d}</p></div>${r||''}</div>${body}</section>`;
const pr=p=>p=='High'?`<span class="priority">${T('pri.high')}</span>`:p?`<span class="tag">${T('pri.'+p.toLowerCase())}</span>`:'';
const priOpts=sel=>['','High','Medium','Low'].map(v=>`<option value="${v}"${sel==v?' selected':''}>${v?T('pri.'+v.toLowerCase()):T('pri.none')}</option>`).join('');
const dayOpts=sel=>ALL.map(([w,d])=>`<option value="${w}.${d}"${sel==w+'.'+d?' selected':''}>${labf(w,d)}</option>`).join('');
const tgSel=()=>`<select data-tgt aria-label="${T('set.target')}">${Array.from({length:12},(_,i)=>`<option${i+1==TG?' selected':''}>${i+1}</option>`).join('')}</select>`;
function dl(n,t,type){const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([type?t:'﻿'+t],{type:type||'text/csv'}));a.download=n;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),4000)}
