'use strict';
// ---------- render ----------
const TABS=()=>[['today',T('nav.today')],['week',T('nav.week')],['pending',T('nav.pending')],['dash',T('nav.dash')],['notes',T('nav.notes')],['plan',T('nav.plan')],['settings',T('nav.settings')],...(ME&&ME.is_admin&&!VIEW?[['admin',T('nav.admin')]]:[])];
const V={today:vToday,week:vWeek,pending:vPending,dash:vDash,notes:vNotes,plan:vPlan,settings:vSettings,admin:vAdmin,overall:vOverall};
function applyTheme(){const t=SET.theme=='system'?(matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'):SET.theme;document.documentElement.dataset.theme=t;const b=$('#thq');if(b){b.textContent=t=='dark'?'☀':'☾';b.setAttribute('aria-label',T('a.theme'))}}
function render(){applyTheme();document.documentElement.lang=LANG();const lq=$('#langq');lq.textContent=LANG()=='bn'?'EN':'বাং';lq.setAttribute('aria-label',T('a.lang'));
if(!ME){document.body.classList.add('auth');$('#view').innerHTML=vLogin();$('#modal').innerHTML='';renderPomo();if(focusSel){$(focusSel)?.focus();focusSel=''}return}
document.body.classList.remove('auth');syncCur();if(tab=='admin'&&(!ME.is_admin||VIEW))tab='dash';if(tab=='overall'&&VIEW)tab='dash';
const pn=$('#pname');pn.textContent=VIEW?VIEW.pname:PROJ?PROJ.name:'';$('#brand').setAttribute('aria-label',T('proj.title'));
const n=pendCount(),badge=k=>k=='pending'&&n?`<span class="n">${n}</span>`:k=='admin'&&WAITING?`<span class="n">${WAITING}</span>`:'';$('#nav').innerHTML=TABS().map(([k,l])=>`<button data-tab="${k}"${k==tab?' class="active" aria-current="page"':''}>${l}${badge(k)}</button>`).join('');
$('#bnav').innerHTML=bnavHtml(badge);
$('#chip').textContent=dd(cur.w,cur.d).full;const me=$('#me');me.textContent=(VIEW?VIEW.name:ME.name).trim().charAt(0).toUpperCase()||'?';me.setAttribute('aria-label',T('nav.settings'));
$('#view').innerHTML=(VIEW?`<div class="rob"><span>👁 ${T('ro.viewing',{n:esc(VIEW.name)})}</span><button class="mini p" data-act="exitview">← ${T('ro.back')}</button></div>`:'')+V[tab]();
const sc=$('.mbody')?.scrollTop;$('#modal').innerHTML=closing?modalHtml():imp?impHtml():CE?ceHtml():printOpen?printHtml():projUI?(projUI.kind=='new'?projNewHtml():projMenuHtml()):'';if((imp||CE)&&sc)$('.mbody').scrollTop=sc;
if(focusSel){$(focusSel)?.focus();focusSel=''}renderPomo();queueSave();queuePrefs()}
// phone: a bottom bar with the 4 main tabs; the rest sit in a "More" sheet
const BMAIN=['today','week','pending','dash'],BICON={today:'<path d="M4 6h16v14H4zM4 10h16M9 3v4M15 3v4"/>',week:'<path d="M4 5h16v15H4zM4 9h16M8 13h2M12 13h2M16 13h0M8 16h2M12 16h2"/>',pending:'<circle cx="12" cy="12" r="8"/><path d="M12 8v4l3 2"/>',dash:'<path d="M4 4h7v7H4zM13 4h7v4h-7zM13 10h7v10h-7zM4 13h7v7H4z"/>',more:'<circle cx="6" cy="12" r="1.4"/><circle cx="12" cy="12" r="1.4"/><circle cx="18" cy="12" r="1.4"/>'};
const bico=k=>`<svg viewBox="0 0 24 24" aria-hidden="true">${BICON[k]}</svg>`;
function bnavHtml(badge){const tabs=TABS(),more=tabs.filter(([k])=>!BMAIN.includes(k)),inMore=more.some(([k])=>k==tab),mb=more.some(([k])=>badge(k));
return tabs.filter(([k])=>BMAIN.includes(k)).map(([k,l])=>`<button data-tab="${k}"${k==tab?' class="active" aria-current="page"':''}>${bico(k)}<span>${l}</span>${badge(k)}</button>`).join('')+
`<button data-act="more"${inMore||moreOpen?' class="active"':''} aria-expanded="${moreOpen}">${bico('more')}<span>${T('nav.more')}</span>${mb?'<span class="n dot"></span>':''}</button>`+
(moreOpen?`<div class="bmore" role="menu">${more.map(([k,l])=>`<button data-tab="${k}" role="menuitem"${k==tab?' class="active"':''}>${l}${badge(k)}</button>`).join('')}</div>`:'')}
function go(t){tab=t;moreOpen=false;noteOpen=0;qadd='';if(t=='admin')loadAdmin();if(t=='settings')loadSess();if(t=='overall')loadOverall();render();scrollTo(0,0)}

// ---------- account ----------
async function afterAuth(r){TOKEN=r.token;try{localStorage.setItem(TKEY,TOKEN)}catch(e){}ME=r.user;if(ME.is_admin)try{WAITING=(await api('GET','me')).waiting||0}catch(e){}await loadMine();tab='dash';render()}
async function loadMine(){const lang=LANG(),pf=ME.prefs||{};SET=mergeSet(pf);if(!pf.lang)SET.lang=lang;lastPrefs=JSON.stringify(SET);
const r=await api('GET','projects');PROJS=r.projects;await loadProject(r.active&&PROJS.some(p=>p.id==r.active)?r.active:PROJS[0].id)}
async function loadProject(id){const r=await api('GET','projects/'+id);PROJ={id:r.id,name:r.name};REV=r.rev;lastSaved=restore(r.state)?'':snap();
clearInterval(PO.iv);PO={stage:'off'};syncCur();wkW=cur.w;wkSel=cur.d;rfDay={...cur};BD.day=co();wEdit=false;editing=0;adding=null;planOpen=new Set([cur.w]);resumePomo();remCheck()}
// switch to another project (the open one is saved first)
async function openProject(id,then){if(pLive()){toast(T('proj.stopTimer'));return}await flush();try{await loadProject(id);projUI=null;if(tab=='overall'||tab=='admin')tab='dash';then&&then();render();scrollTo(0,0);toast(T('proj.opened',{n:PROJ.name}))}catch(e){toast(errT(e))}}
async function loadOverall(){await flush();OV={loading:true};try{const r=await api('GET','projects');PROJS=r.projects;OV={}}catch(e){OV={err:errT(e)}}if(tab=='overall')render()}
async function refreshProjects(){try{PROJS=(await api('GET','projects')).projects}catch(e){}}
function logoutLocal(){clearInterval(PO.iv);PO={stage:'off'};ME=null;VIEW=null;OWN=null;TOKEN=null;ADM=null;PROJ=null;PROJS=[];projUI=null;CE=null;imp=null;OV=null;try{localStorage.removeItem(TKEY)}catch(e){}LG={mode:'login',phone:'',name:'',err:''};render()}
// login: phone + PIN. 'register' asks an admin for an account, 'setpin' is for an account without a PIN yet
async function doLogin(){const v=id=>(($(id)||{}).value||'').trim(),pin=v('#lpin'),pin2=v('#lpin2');LG.phone=v('#lphone')||LG.phone;LG.name=v('#lname')||LG.name;LG.err='';
const fail=(k,f)=>{LG.err=T(k);focusSel=f;render()};
if(!LG.phone)return fail('login.ePhone','#lphone');
if(LG.mode=='register'&&!LG.name)return fail('login.eName','#lname');
if(!/^[0-9০-৯]{4,6}$/.test(pin))return fail('err.bad_pin_format','#lpin');
if(LG.mode!='login'&&pin!=pin2)return fail('login.eMatch','#lpin2');
try{if(LG.mode=='register'){const r=await api('POST','register',{phone:LG.phone,name:LG.name,pin,today:todayISO(),lang:LANG()});if(r.pending){LG={mode:'sent',phone:LG.phone,name:'',err:''};render()}else await afterAuth(r)}
else await afterAuth(await api('POST','login',LG.mode=='setpin'?{phone:LG.phone,new_pin:pin}:{phone:LG.phone,pin}))}
catch(e){if(e.message=='pin_setup'){LG.mode='setpin';focusSel='#lpin'}
else if(e.message=='bad_pin')LG.err=T('err.bad_pin',{n:e.data.left});
else if(e.message=='locked')LG.err=T('err.locked',{t:new Date(e.data.until).toLocaleTimeString(LANG()=='bn'?'bn-BD':'en-GB',{hour:'2-digit',minute:'2-digit'})});
else LG.err=errT(e);render()}}

// ---------- admin ----------
async function loadSess(){try{SESS=(await api('GET','sessions')).sessions}catch(e){SESS=null}if(tab=='settings')render()}
async function loadAdmin(){const sel=ADM&&ADM.sel;ADM={loading:true};try{const r=await api('GET','admin/users');ADM={users:r.users,sel};WAITING=r.users.filter(u=>!u.approved).length}catch(e){ADM={err:errT(e)}}if(tab=='admin')render()}
async function viewUser(pid){if(pLive()){toast(T('ro.stopTimer'));return}try{const r=await api('GET','admin/projects/'+pid);await flush();OWN={state:snap(),tab};VIEW={id:r.user.id,name:r.user.name,pname:r.project.name};restore(r.state);syncCur();wkW=cur.w;wkSel=cur.d;rfDay={...cur};BD.day=co();tab='dash';render();scrollTo(0,0)}catch(e){toast(errT(e))}}
function exitView(){if(!OWN)return;restore(OWN.state);VIEW=null;tab='admin';OWN=null;syncCur();wkW=cur.w;wkSel=cur.d;rfDay={...cur};BD.day=co();lastSaved=snap();loadAdmin();render()}

// ---------- day close (the calendar moves the day; closing saves the reflection and the day's target) ----------
function doClose(save){const o=co(),left=act(cur.w,cur.d).filter(x=>!done.has(x.id)).length;
if(save){const v=($('#cr')||{}).value?.trim();if(v){const i=refl.findIndex(r=>r.w==cur.w&&r.d==cur.d);i>=0?refl[i].t=v:refl.push({w:cur.w,d:cur.d,t:v})}}
TGD[o]=tgt(o);closed[o]=1;closing=false;toast(left?T('close.doneLeft',{n:left}):T('close.doneAll'),1)}

// ---------- actions ----------
const UNDO=new Set(['parchall','wdel','sdel','arch','impgo','merge','mergesel','mergeall','closego','closeskip','wipe','tplreset','focdel','remdel']);
// what an admin may still click while looking at someone else's routine
const VIEW_OK=new Set(['exitview','wk','wkw','printopen','prr','prno','prgo','theme','themeq','lang','langq','undo']);
async function action(a){const D=a.dataset,id=+D.id,p=P.find(x=>x.id==id);
if(VIEW&&!VIEW_OK.has(D.act)){toast(T('ro.blocked'));return}
if(UNDO.has(D.act))undoSnap=snap();
switch(D.act){
case'login':doLogin();return;
case'more':moreOpen=!moreOpen;break;
case'parchall':{const ps=pendingList();if(!ps.length||!confirm(T('pend.clearQ',{n:ps.length})))return;ps.forEach(p=>p.arch=true);toast(T('pend.cleared',{n:ps.length}),1);break}
case'loginmode':LG={mode:D.v,phone:LG.phone,name:LG.name,err:''};focusSel=D.v=='register'?'#lname':'#lpin';break;
case'lang':SET.lang=D.v;try{localStorage.setItem(LKEY,D.v)}catch(e){}break;
case'langq':SET.lang=LANG()=='bn'?'en':'bn';try{localStorage.setItem(LKEY,SET.lang)}catch(e){}break;
case'logout':await flush();try{await api('POST','logout')}catch(e){}logoutLocal();return;
case'admreload':loadAdmin();break;
case'aview':viewUser(+D.p);return;
case'exitview':exitView();return;
case'aok':try{await api('POST',`admin/users/${D.u}/approve`);toast(T('adm.approved'));loadAdmin()}catch(e){toast(errT(e))}return;
case'apin':{const u=ADM&&ADM.users.find(x=>x.id==+D.u);if(!u||!confirm(T('adm.pinQ',{n:u.name})))return;try{const r=await api('POST',`admin/users/${D.u}/reset-pin`);alert(T('adm.tempPin',{n:u.name,p:r.pin}));loadAdmin()}catch(e){toast(errT(e))}return}
case'pinsave':{const o=($('#opin')||{}).value||'',n=$('#npin').value.trim(),n2=$('#npin2').value.trim();if(!/^[0-9০-৯]{4,6}$/.test(n)){toast(T('err.bad_pin_format'));return}if(n!=n2){toast(T('login.eMatch'));return}
try{await api('POST','pin',{old:o.trim(),new:n});ME.has_pin=true;ME.pin_temp=false;toast(T('set.pinSaved'));render()}catch(e){toast(e.message=='bad_pin'?T('err.bad_pin',{n:e.data.left}):errT(e))}return}
case'aman':ADM.sel=ADM.sel==+D.u?0:+D.u;render();if(ADM.sel)$('#aman')?.scrollIntoView({behavior:'smooth',block:'start'});return;
case'aedit':{const name=$('#aen').value.trim(),phone=$('#aep').value.trim();if(!name||!phone){toast(T('adm.need'));return}try{await api('POST',`admin/users/${D.u}/edit`,{name,phone});if(+D.u==ME.id){ME.name=name;ME.phone=phone}toast(T('adm.saved'));loadAdmin()}catch(e){toast(errT(e))}return}
case'ablock':{const u=ADM.users.find(x=>x.id==+D.u),b=D.v=='1';if(b&&!confirm(T('adm.blockQ',{n:u.name})))return;try{await api('POST',`admin/users/${D.u}/block`,{blocked:b});toast(T(b?'adm.blocked':'adm.unblocked',{n:u.name}));loadAdmin()}catch(e){toast(errT(e))}return}
case'aout':{const u=ADM.users.find(x=>x.id==+D.u);if(!confirm(T('adm.outQ',{n:u.name})))return;try{await api('DELETE',`admin/users/${D.u}/sessions`);toast(T('dev.outDone'));loadAdmin()}catch(e){toast(errT(e))}return}
case'sessout':if(!confirm(T('dev.othersQ')))return;try{await api('DELETE','sessions/others');toast(T('dev.outDone'));loadSess()}catch(e){toast(errT(e))}return;
case'arole':try{await api('POST',`admin/users/${D.u}/role`,{is_admin:D.v=='1'});loadAdmin()}catch(e){toast(errT(e))}return;
case'adel':{const u=ADM&&ADM.users.find(x=>x.id==+D.u);if(!u||!confirm(T('adm.delQ',{n:u.name})))return;try{await api('DELETE','admin/users/'+D.u);toast(T('adm.deleted'));loadAdmin()}catch(e){toast(errT(e))}return}
case'aadd':{const name=$('#anm').value.trim(),phone=$('#aph').value.trim();if(!name||!phone){toast(T('adm.need'));return}
try{const r=await api('POST','admin/users',{name,phone,today:todayISO(),lang:LANG()});alert(T('adm.tempPin',{n:name,p:r.pin}));loadAdmin()}catch(e){toast(errT(e))}return}
case'wk':wkW=+D.w;wkSel=+D.d;tab='week';break;
case'wkw':wkW=+D.w;editing=0;adding=null;break;
case'wedit':wEdit=!wEdit;editing=0;adding=null;renaming='';break;
case'wopen':wkW=+D.w;wkSel=wkW==cur.w?cur.d:1;wEdit=true;editing=0;adding=null;tab='week';scrollTo(0,0);break;
case'addweek':{const w=weeks().length+1;ensureWeeks(w);toast(T('plan.weekAdded',{w,a:ord(w,1),b:ord(w,7)}));break}
case'wtable':openCETasks('week',+D.w);break;
case'addtopics':if(!SUBJ.length){toast(T('tf.noSubj'));return}openCETasks('new');break;
case'wdel':{const w=+D.w,n=P.filter(p=>!p.arch&&p.w==w).length;if(weeks().length<2||!confirm(T('wk.delQ',{w,n})))return;removeWeek(w);break}
// ---- projects
case'projmenu':if(VIEW)return;projUI={kind:'menu'};refreshProjects().then(()=>{if(projUI)render()});break;
case'projclose':projUI=null;break;
case'projopen':if(PROJ&&+D.p==PROJ.id){projUI=null;if(tab=='overall')tab='dash';break}openProject(+D.p);return;
case'projren':projUI.ren=+D.p;focusSel='#prn';break;
case'projrensave':{const v=$('#prn').value.trim();if(!v){toast(T('m.writeName'));return}try{await api('POST',`projects/${D.p}/rename`,{name:v});if(PROJ&&PROJ.id==+D.p)PROJ.name=v;await refreshProjects();projUI.ren=0}catch(e){toast(errT(e))}break}
case'projdel':{const pj=PROJS.find(x=>x.id==+D.p);if(!pj||!confirm(T('proj.delQ',{n:pj.name})))return;try{await api('DELETE','projects/'+D.p);await refreshProjects();if(PROJ&&PROJ.id==+D.p){PROJ=null;lastSaved='';await loadProject(PROJS[0].id)}toast(T('proj.deleted'))}catch(e){toast(errT(e))}break}
case'projnew':projUI={kind:'new',src:'template',start:todayISO(),name:''};focusSel='#pnn';break;
case'projsrc':projUI.name=$('#pnn').value;projUI.start=$('#pns').value;projUI.src=D.v;projUI.err='';break;
case'projcreate':{const n=projUI,name=$('#pnn').value.trim(),start=$('#pns').value||todayISO();n.name=name;n.start=start;
if(!name){n.err=T('proj.needName');break}if(n.src=='csv'&&!n.text){n.err=T('proj.needFile');break}
if(pLive()){toast(T('proj.stopTimer'));return}await flush();
try{const r=await api('POST','projects',{name,start,source:n.src=='template'?'template':'empty'});const text=n.text,file=n.file,src=n.src;
await openProject(r.id,()=>{if(src=='csv')openCE(file,text,{mode:'all'});else if(src=='empty'){tab='settings'}})}catch(e){n.err=errT(e)}break}
case'overall':if(VIEW)return;projUI=null;go('overall');return;
// ---- CSV table editor
case'cedel':CE.rows.splice(+D.r,1);break;
case'ceadd':{const last=CE.rows[CE.rows.length-1];CE.rows.push({id:0,day:last&&Number.isInteger(last.day)?last.day:(CE.week=='all'?1:(+CE.week-1)*7+1),s:last?last.s:(SUBJ[0]?'k:'+SUBJ[0][0]:'n:'),pri:'',perr:'',topic:'',wt:''});CE.only=false;setTimeout(()=>{const b=$('.mbody');if(b)b.scrollTop=b.scrollHeight;const i=$$('.cetable [data-ce=topic]');i.length&&i[i.length-1].focus()},0);break}
case'ceno':CE=null;break;
case'cenext':imp=ceToImp();break;
case'ceback':imp=null;break;
case'qadd':qadd=D.k+'|'+D.o;focusSel='#qat';break;
case'qcancel':qadd='';break;
case'qsave':{const t=$('#qat').value.trim();if(!t){toast(T('m.writeTopic'));return}const[w,d]=od(+D.o);ensureWeeks(w);P.push({id:++uid,w,d,s:D.k,t,p:'',ow:w,od:d,arch:false,from:''});qadd='';toast(T('m.added'));break}
case'focadd':{const t=$('#fadd').value.trim(),k=$('#fos').value,pp=$('#fap').value,est=Math.max(0,num($('#fam').value)|0);if(!t){toast(T('m.writeSomething'));return}FF={s:k,p:pp};focusSel='#fadd';
// a subject makes it a real topic of today (and keeps it in focus); none = an own to-do outside the routine
if(k){const[w,d]=od(co());ensureWeeks(w);P.push({id:++uid,w,d,s:k,t,p:pp,est,ow:w,od:d,arch:false,from:''});pin.add(uid);toast(T('foc.addedTopic',{s:sn(k,w)}))}
else{FOC.push({id:++fid,o:co(),t,p:pp,est,done:false,from:''});toast(T('foc.added'))}break}
case'focdel':FOC=FOC.filter(f=>f.id!=+D.f);toast(T('foc.removed'),1);break;
case'pin':if(inFocus(p)){pin.delete(id);nof.add(id);toast(T('foc.removed'))}else{nof.delete(id);pin.add(id);toast(T('foc.pinned'))}break;
case'printopen':printOpen=true;PR={a:ord(cur.w,1),b:Math.min(ord(cur.w,7),planLen()),plan:true,date:true,done:true,hrs:true,notes:true};break;
case'prr':PR={a:+D.a,b:+D.b,...prOpts()};break;
case'prno':printOpen=false;break;
case'prgo':{const L=printLen(),a1=Math.max(1,Math.min(L,+$('#pra').value||1)),b1=Math.max(a1,Math.min(L,+$('#prb').value||a1));$('#print').innerHTML=printDoc(a1,b1,prOpts());printOpen=false;render();setTimeout(()=>window.print(),50);return}
case'subtick':{const s=act(cur.w,cur.d).filter(x=>x.s==D.sub),all=s.every(x=>done.has(x.id));s.forEach(x=>all?done.delete(x.id):done.add(x.id));break}
case'merge':merge(D.g,D.to);break;
case'mergesel':merge(D.g,document.getElementById('ms-'+D.g).value);break;
case'mergeall':{const[tw,td]=D.to.split('.').map(Number),ps=pendingList();ensureWeeks(tw);ps.forEach(q=>{q.w=tw;q.d=td;q.from=lab(q.ow,q.od)});toast(T('pend.moved',{n:ps.length,d:lab(tw,td)}),1);break}
case'dayclose':closing=true;closeDraft=null;focusSel='#cr';break;
case'closego':doClose(true);closeDraft=null;break;
case'closeskip':doClose(false);closeDraft=null;break;
case'closecancel':closing=false;closeDraft=null;break;
case'hr':{const o=+D.o,i=+D.i,was=hrs(o);HR[o]=i+1==was?i:i+1;if(was<tgt(o)&&hrs(o)>=tgt(o)){ding('target');toast(T('hr.hitToast',{n:hrs(o),s:streak()}))}focusSel=`.hbox[data-o="${o}"][data-i="${i}"]`;break}
case'revset':{const t=$('#nt');if(t&&t.value.trim())notes[id]=t.value.trim();const o=co()+(+D.n);revs.push({id:++rid,pid:id,o,iv:+D.n,step:revs.filter(r=>r.pid==id&&r.done).length+1,done:false});toast(T('rev.setT',{d:dlab(o)}));break}
case'revpick':{const t=$('#nt');if(t&&t.value.trim())notes[id]=t.value.trim();const o=Math.floor(num($('#rvd').value));if(!(o>co())){toast(T('rev.future'));return}revs.push({id:++rid,pid:id,o,iv:o-co(),step:revs.filter(r=>r.pid==id&&r.done).length+1,done:false});toast(T('rev.setT',{d:dlab(o)}));break}
case'revdel':revs=revs.filter(r=>r.id!=+D.r);break;
case'revtoday':overdueRevs().forEach(r=>r.o=co());toast(T('rev.movedToday'));break;
case'rn':renaming=D.k+D.w;editing=0;adding=null;focusSel='#rnm';break;
case'rnsave':{const v=$('#rnm').value.trim();if(!v){toast(T('m.writeName'));return}if(subjKey(v)&&subjKey(v)!=D.k){toast(T('subj.exists'));return}SNAME[D.k]=v;renaming='';toast(T('subj.renamed'));break}
case'ladsave':{const l=[...new Set($('#lad').value.split(',').map(Number).filter(n=>n>0))].sort((x,y)=>x-y);if(!l.length){toast(T('m.oneNumber'));return}LAD=l;toast(T('m.saved'));break}
case'note':noteOpen=noteOpen==id?0:id;focusSel='#nt';break;
case'notesave':{const v=$('#nt').value.trim();if(v)notes[id]=v;else delete notes[id];const em=$('#nest').value;p.est=em===''?0:Math.max(0,num(em)|0);const sm=$('#nspent').value;if(sm!==''){const want=Math.max(0,num(sm)|0)*60,cur0=Math.round((p.sec||0)/60)*60;if(want!=cur0)addSec(co(),want-(p.sec||0),{p:id})}noteOpen=0;toast(T('m.saved'));break}
case'notedel':delete notes[id];noteOpen=0;break;
case'notecancel':noteOpen=0;break;
case'rfsave':{const v=$('#rf').value.trim(),i=refl.findIndex(r=>r.w==rfDay.w&&r.d==rfDay.d);if(!v){toast(T('m.writeSomething'));return}i>=0?refl[i].t=v:refl.push({w:rfDay.w,d:rfDay.d,t:v});toast(T('m.saved'));break}
case'rfedit':rfDay={w:+D.w,d:+D.d};tab='notes';scrollTo(0,0);break;
case'rfdel':if(!confirm(T('notes.delQ')))return;refl=refl.filter(r=>!(r.w==D.w&&r.d==D.d));break;
case'edit':editing=id;adding=null;renaming='';focusSel='#edt';break;
case'cancel':editing=0;bedit=0;adding=null;renaming='';break;
case'save':{const t=$('#edt').value.trim(),[w,d]=$('#edd').value.split('.').map(Number);if(!t){toast(T('m.empty'));return}if(p.w!=w||p.d!=d)p.from=lab(p.w,p.d);p.t=t;p.s=$('#eds').value||p.s;p.p=$('#edp').value;p.est=Math.max(0,num($('#edm').value)|0);p.w=w;p.d=d;editing=0;toast(T('m.savedTick'));break}
case'arch':p.arch=true;toast(T('m.archived'),1);break;
case'restore':p.arch=false;toast(T('m.restored'));break;
case'addopen':adding={w:+D.w,d:+D.d,k:D.k||''};editing=0;renaming='';focusSel='#addt';break;
case'addsave':{const t=$('#addt').value.trim(),sv=$('#adds').value;if(!sv){toast(T('tf.noSubj'));return}if(!t){toast(T('m.writeTopic'));return}P.push({id:++uid,w:adding.w,d:adding.d,s:sv,t,p:'',est:Math.max(0,num($('#addm').value)|0),ow:adding.w,od:adding.d,arch:false,from:''});adding=null;toast(T('m.added'));break}
case'export':dl('routine.csv',csv([H,...csvRows()]));return;
case'template':{const sa=SUBJ[0]?sn(SUBJ[0][0]):T('subject'),sb=SUBJ[1]?sn(SUBJ[1][0]):sa;dl('routine-import-template.csv',csv([['id','day','subject','priority','minutes','subpart'],['',1,sa,'',120,T('tpl.ex1')],['',1,sb,'High',60,T('tpl.ex2')],['',2,sb,'',45,T('tpl.ex3')],['',10,sb,'','',T('tpl.ex4')]]));return}
case'upload':$('#csvFile').click();return;
case'impmode':imp.mode=D.m;break;
case'impgo':{const fromFile=!imp.kind||imp.kind=='file',w=impApply();if(w&&fromFile){wkW=w;wkSel=1;wEdit=true;tab='week';scrollTo(0,0)}break}
case'impno':imp=null;CE=null;break;
case'remadd':{const m=$('#rM').value.trim(),t=$('#rT').value;if(!m||!t){toast(T('rem.need'));return}const now=new Date(),r={t,r:$('#rR').value,m,on:true,dow:now.getDay(),last:''};if(pad(now.getHours())+':'+pad(now.getMinutes())>=t)r.last=isoOf(now);R.push(r);toast(T('m.added'));break}
case'remtog':R[+D.i].on=!R[+D.i].on;break;
case'remdel':R.splice(+D.i,1);toast(T('m.removed'),1);break;
case'remclear':RM=[];break;
case'sadd':{const v=$('#snew').value.trim();if(!v){toast(T('m.writeName'));return}if(subjKey(v)){toast(T('subj.exists'));return}getSubj(v);focusSel='#snew';toast(T('subj.added',{n:v}));break}
case'sdel':{const i=SUBJ.findIndex(x=>x[0]==D.k);if(i<0||P.some(q=>q.s==D.k))return;const nm=SNAME[D.k];SUBJ.splice(i,1);delete SNAME[D.k];toast(T('subj.deleted',{n:nm}),1);break}
case'smove':{const i=+D.i,j=i+(+D.dir);if(j<0||j>=SUBJ.length)return;[SUBJ[i],SUBJ[j]]=[SUBJ[j],SUBJ[i]];break}
case'theme':SET.theme=D.v;break;
case'themeq':SET.theme=document.documentElement.dataset.theme=='dark'?'light':'dark';break;
case'stog':sp(D.k,!gp(D.k));break;
case'stest':ding(D.v,1);return;
case'atest':alarmOn();setTimeout(alarmOff,3000);return;
case'notif':if(SET.notif){SET.notif=false;break}if(!('Notification' in window)){toast(T('set.notifNo'));return}Notification.requestPermission().then(x=>{SET.notif=x=='granted';toast(SET.notif?T('set.notifOn'):T('set.notifDenied'));render()});return;
case'backup':dl(`routine-backup-${todayISO()}.json`,snap(),'application/json');return;
case'tplreset':{if(!confirm(T('set.resetQ')))return;try{const r=await api('GET','template?today='+todayISO()),keep=SET;restore(r.state);SET=keep;syncCur();BD.day=co();wkW=cur.w;wkSel=cur.d;toast(T('set.resetDone'),1)}catch(e){toast(errT(e))}break}
case'wipe':if(!confirm(T('set.wipeQ')))return;clearInterval(PO.iv);PO={stage:'off'};P=[];done=new Set();HR={};TGD={};revs=[];refl=[];FOC=[];notes={};pin=new Set();nof=new Set();SEC={};HRC={};closed={};START=todayISO();ALL.length=0;ensureWeeks(1);syncCur();planOpen=new Set([1]);BD={day:1};tab='plan';toast(T('set.wiped'),1);break;
// ---- timer
case'pomo':pomoOpen(D.f?{f:+D.f}:{p:id});break;
case'pdur':PO.dur=+D.v;break;
case'pgo':{const c=+($('#pcus')||{}).value;if(c>=1)PO.dur=Math.min(180,Math.floor(c));PO.o=co();pomoStart('focus');break}
case'ppause':credit();if(PO.kind=='watch')PO.acc+=Date.now()-PO.t0;else PO.left=PO.endAt-Date.now();PO.stage='pause';clearInterval(PO.iv);break;
case'presume':if(PO.kind=='watch'){PO.t0=PO.last=Date.now();PO.stage='run';clearInterval(PO.iv);PO.iv=setInterval(pomoTick,250);break}{const L=PO.left,Tt=PO.total;pomoStart(PO.kind);PO.total=Tt;PO.endAt=Date.now()+L;break}
case'pplus':if(PO.stage=='pause')PO.left+=300000;else PO.endAt+=300000;PO.total+=300000;break;
case'pskip':credit();pomoEnd();return;
case'pwatch':PO.o=co();PO.kind='watch';PO.acc=0;PO.t0=PO.last=Date.now();PO.endAt=8.64e15;PO.total=0;PO.stage='run';clearInterval(PO.iv);PO.iv=setInterval(pomoTick,250);break;
case'plog':{const m=+D.v;addSec(co(),m*60,PO.ref);toast(T(m>0?'po.logged':'po.removed',{m:Math.abs(m),t:hm(SEC[co()])}));break}
case'pnext':pomoStart(PO.next);break;
case'pstop':if(SET.fg.on&&SET.fg.strict&&PO.kind=='focus'&&(PO.stage=='run'||PO.stage=='pause')){if(!confirm(T('fg.stopQ')))return;fgDay(PO.o).b++}credit();clearInterval(PO.iv);FG=null;alarmOff();toast(T('po.stopped',{t:hm(SEC[PO.o])}));PO={stage:'off'};exitFs();break;
case'pmin':if(PO.stage=='ready')PO={stage:'off'};else PO.fs=false;exitFs();break;
case'pmax':PO.fs=true;break;
case'psnd':SET.snd.on=!SET.snd.on;break;
case'pnative':if(document.fullscreenElement)exitFs();else document.documentElement.requestFullscreen?.().catch(()=>{});return;
case'pdone':{const r=PO.ref;if(r.f){const x=pref(r);if(x)x.done=!x.done}else done.has(r.p)?done.delete(r.p):done.add(r.p);break}
case'undo':if(undoSnap){const keep=[SET,SEC,HRC];restore(undoSnap);[SET,SEC,HRC]=keep;undoSnap=null;imp=null;closing=false;syncCur();wkW=cur.w;toast(T('undone'))}break;
case'build':tab='plan';scrollTo(0,0);break;
case'tfadd':{const o=+D.o,pre=D.pre,k=$('#'+pre+'s').value,t=$('#'+pre+'t').value.trim(),pp=$('#'+pre+'p').value;focusSel='#'+pre+'t';if(!t){toast(T('m.writeTopic'));break}
const[w,d]=od(o);ensureWeeks(w);const mn=$('#'+pre+'m');P.push({id:++uid,w,d,s:k,t,p:pp,est:mn?Math.max(0,num(mn.value)|0):0,ow:w,od:d,arch:false,from:''});TF={s:k,p:pp};planOpen.add(w);toast(T('tf.added',{s:sn(k,w),d:lab(w,d)}));break}

}
render()}

// ---------- events ----------
document.addEventListener('click',e=>{
if(moreOpen&&!e.target.closest('#bnav')){moreOpen=false;render()}
const t=e.target.closest('[data-tab]');if(t&&ME)return go(t.dataset.tab);
if(VIEW&&e.target.closest('[data-foc],[data-rev],.check')){toast(T('ro.blocked'));return}
const fc=e.target.closest('[data-foc]');if(fc){const f=FOC.find(x=>x.id==+fc.dataset.foc);f.done=!f.done;focusSel=`[data-foc="${f.id}"]`;render();return}
const rv=e.target.closest('[data-rev]');if(rv){const id=+rv.dataset.rev,r=revs.find(x=>x.id==id);if(r){r.done=!r.done;
if(r.done){const nx=LAD.find(x=>x>r.iv);if(nx){const n={id:++rid,pid:r.pid,o:co()+nx,iv:nx,step:r.step+1,done:false};revs.push(n);r.child=n.id;toast(T('rev.next',{d:dlab(n.o),n:nx}))}else toast(T('rev.cycleDone'))}
else{const c=revs.find(x=>x.id==r.child);if(c&&!c.done)revs=revs.filter(x=>x!=c);r.child=0}}focusSel=`.check[data-rev="${id}"]`;render();return}
const c=e.target.closest('.check');if(c){const i=+c.dataset.id;done.has(i)?done.delete(i):done.add(i);focusSel=`.check[data-id="${i}"]`;render();return}
const a=e.target.closest('[data-act]');if(a)action(a)});
document.addEventListener('keydown',e=>{if(PO.stage!='off'&&PO.fs&&!VIEW){if(e.key=='Escape'){e.preventDefault();$('#pomo [data-act=pmin]')?.click();return}if(e.key==' '&&!/INPUT|TEXTAREA|SELECT|BUTTON/.test(e.target.tagName)){e.preventDefault();$('#pomo [data-act=ppause],#pomo [data-act=presume]')?.click();return}}
if(e.key=='Escape'&&(closing||imp||CE||printOpen||projUI)){closing=false;if(imp)imp=null;else CE=null;printOpen=false;projUI=null;render();return}if(e.key!='Enter')return;const i=e.target.id;
const K={prn:'projrensave',pnn:'projcreate',lphone:'login',lname:'login',lpin:'login',lpin2:'login',opin:'pinsave',npin:'pinsave',npin2:'pinsave',rnm:'rnsave',edt:'save',edd:'save',eds:'save',edp:'save',addt:'addsave',rM:'remadd',snew:'sadd',qat:'qsave',fadd:'focadd',fam:'focadd',anm:'aadd',aph:'aadd'}[i];
if(K){$(`[data-act=${K}]`)?.click();return}
if(i=='tft'||i=='tfm'){$(`[data-act=tfadd][data-pre="${i.slice(0,2)}"]`).click();return}});
document.addEventListener('change',e=>{const tg=e.target;if(VIEW&&(tg.dataset.rvo||tg.dataset.tgt!==undefined||tg.dataset.set||tg.dataset.setv||tg.dataset.smin||tg.id=='startDate'||tg.id=='csvFile'||tg.dataset.ce)){toast(T('ro.blocked'));render();return}
const k=tg.dataset.imp;if(k){imp.off.has(k)?imp.off.delete(k):imp.off.add(k);focusSel=`[data-imp="${k}"]`;render();return}
if(tg.dataset.tgt!==undefined){for(let o=1;o<co();o++)if(TGD[o]==null)TGD[o]=TG;TG=+tg.value;toast(T('set.targetT',{n:TG}));render();return}
if(tg.id=='startDate'&&tg.value){START=tg.value;syncCur();wkW=cur.w;wkSel=cur.d;BD.day=co();render();return}
if(/^tf[sp]$/.test(tg.id)){TF[tg.id[2]]=tg.value;return}
if(tg.id=='fos'||tg.id=='fap'){FF[tg.id=='fos'?'s':'p']=tg.value;return}
if(tg.dataset.rvo){const r=revs.find(x=>x.id==+tg.dataset.rvo),v=Math.floor(num(tg.value));if(r&&v>=co()){r.o=v;toast(T('rev.setT',{d:dlab(v)}))}else toast(T('rev.future'));render();return}
if(tg.dataset.setv){sp(tg.dataset.setv,tg.value);render();return}
if(tg.dataset.smin){const v=num(tg.value);if(Number.isInteger(v)&&v>0)SMIN[tg.dataset.smin]=v;else delete SMIN[tg.dataset.smin];render();return}
const sk=tg.dataset.set;if(sk){const mn=+tg.min,mx=+tg.max;sp(sk,Math.min(mx,Math.max(mn,+tg.value||mn)));render();return}
if(tg.id=='csvFile'){const f=tg.files[0];tg.value='';if(f)f.text().then(t=>{openCE(f.name,t);render()});return}
if(tg.id=='pnf'){const f=tg.files[0];if(f)f.text().then(t=>{projUI.text=t;projUI.file=f.name;projUI.name=$('#pnn').value||f.name.replace(/\.csv$/i,'');projUI.start=$('#pns').value;projUI.err='';render()});return}
if(tg.dataset.ce){ceInput(tg);return}
if(tg.dataset.cemap!==undefined){const n=tg.dataset.cemap,v=tg.value;if(v)CE.rows.forEach(r=>{if(r.s=='n:'+n)r.s=v});render();return}
if(tg.id=='cew'){CE.week=tg.value;render();return}
if(tg.id=='ceo'){CE.only=tg.checked;render();return}});
document.addEventListener('input',e=>{if(e.target.dataset.ce&&e.target.tagName=='INPUT'){ceInput(e.target);return}if(e.target.dataset.set=='snd.vol')SET.snd.vol=+e.target.value;if(e.target.id=='cr')closeDraft=e.target.value;if(e.target.id=='rvd'){const l=$('#rvdl');if(l)l.textContent=rvDate(Math.floor(num(e.target.value)))}if(e.target.id=='lphone')LG.phone=e.target.value;if(e.target.id=='lname')LG.name=e.target.value});
document.addEventListener('toggle',e=>{const t=e.target;if(t.matches&&t.matches('details.fold'))FOLD[t.dataset.fold]=t.open},true);
window.addEventListener('blur',()=>setTimeout(()=>{if(fgAway())fgLeave()},60));window.addEventListener('focus',()=>setTimeout(fgReturn,60));
// closing the window or reloading always asks first ("Leave site?"); the browser decides the wording
window.addEventListener('beforeunload',e=>{if(!ME)return;flush(true);e.preventDefault();e.returnValue=''});
// really closing during a focus session: remember when, so reopening counts that time as away
window.addEventListener('pagehide',()=>{if(ME&&!VIEW&&PO.stage=='run'&&SET.fg.on&&(PO.kind=='focus'||PO.kind=='watch')){credit();PO.closedAt=FG?FG.at:Date.now();alarmOff();savePomo()}});
window.addEventListener('pageshow',e=>{if(e.persisted&&PO.closedAt){delete PO.closedAt;savePomo()}});
document.addEventListener('visibilitychange',()=>{if(document.hidden)fgLeave();else setTimeout(fgReturn,60);if(document.hidden)flush(true);else if(ME&&!VIEW){remCheck();render()}});
try{matchMedia('(prefers-color-scheme: dark)').addEventListener('change',()=>{if(SET.theme=='system')applyTheme()})}catch(e){}
// paper is always printed in the light palette, whatever theme is on screen
window.addEventListener('beforeprint',()=>{document.documentElement.dataset.theme='light'});
window.addEventListener('afterprint',applyTheme);
setInterval(remCheck,30000);
// a new calendar day while the app stays open
let lastDay=todayISO();setInterval(()=>{if(ME&&todayISO()!=lastDay){lastDay=todayISO();if(!closing&&!imp&&!printOpen)render()}},60000);

// ---------- start ----------
(async function boot(){const fi=document.createElement('input');fi.type='file';fi.id='csvFile';fi.accept='.csv';fi.hidden=true;document.body.appendChild(fi);
try{SET.lang=localStorage.getItem(LKEY)||'en'}catch(e){}
if(TOKEN){try{const m=await api('GET','me');ME=m.user;WAITING=m.waiting||0;await loadMine()}catch(e){if(e.status==401){TOKEN=null;try{localStorage.removeItem(TKEY)}catch(x){}ME=null}else{ME=null;LG.err=T('err.net')}}}
render()})();
