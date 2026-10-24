// @ts-nocheck
// The renderer still uses dynamic DOM templates; its model types are being migrated incrementally.
(function(){
'use strict';
type Contact={t:'NO'|'NC';a:string;_v?:boolean};
type Output={t:'OUT'|'SET'|'RST'|'TON'|'CTU';a:string;p:number};
type Branch={to:number;cs:Contact[];_v?:boolean;_in?:boolean[]};
type Rung={note:string;cols:Contact[][];br?:Branch[];out?:Output|null;_prev?:boolean;_e?:boolean[];_eo?:boolean[];_cond?:boolean;_ui?:any};
type ScanConfig={step:number;X:Record<string,string>};
type Program={rungs:Rung[];tags:Record<string,string>;xmode:('push'|'toggle')[];scn:ScanConfig};
type Selection={k:'c';r:number;ci:number;ki:number}|{k:'b';r:number;bi:number;ki:number}|{k:'o';r:number}|null;
type RuntimeState={run:boolean;live:boolean;scans:number;t:number;X:boolean[];xs:boolean[];bits:Record<string,boolean>;acc:Record<string,number>;cnt:Record<string,number>;sel:Selection;pt:number[];hold:boolean[]};
type Example={name:string;tags:Record<string,string>;xmode:('push'|'toggle')[];rungs:Rung[];scn:ScanConfig};
const $=(id:string):any=>document.getElementById(id);
const esc=s=>String(s).replace(/[&<>"]/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[m]));
const GROUPS=[['X','입력',8],['Y','출력',16],['M','내부 릴레이',16],['T','타이머',16],['C','카운터',16]];
const GN:Record<string,number>={X:8,Y:16,M:16,T:16,C:16};
const OUT_ALLOWED:Record<string,string>={OUT:'YM',SET:'YM',RST:'YMTC',TON:'T',CTU:'C'};
const MAXR=40;
const NCOL=40;

/*ENGINE*/
let prog:Program={rungs:[],tags:{},xmode:[],scn:{step:500,X:{}}};
const ST:RuntimeState={run:true,live:false,scans:0,t:0,X:Array(8).fill(false),xs:Array(8).fill(false),bits:{},acc:{},cnt:{},sel:null,pt:[],hold:[]};
let SIGS:string[]=[],HIST:{t:number;n:number;b:boolean[]}[]=[];
function read(a){const g=a[0],n=+a.slice(1);if(g==='X')return !!ST.xs[n];return !!ST.bits[a];}
function applyOut(r,dt){
  const o=r.out;if(!o)return;
  const a=o.a,cond=r._cond;
  switch(o.t){
    case 'OUT':ST.bits[a]=cond;break;
    case 'SET':if(cond)ST.bits[a]=true;break;
    case 'RST':if(cond){ST.bits[a]=false;if(a[0]==='C')ST.cnt[a]=0;if(a[0]==='T')ST.acc[a]=0;}break;
    case 'TON':{const lim=o.p*100;if(cond)ST.acc[a]=Math.min((ST.acc[a]||0)+dt,lim);else ST.acc[a]=0;ST.bits[a]=cond&&ST.acc[a]>=lim;break;}
    case 'CTU':{if(cond&&!r._prev)ST.cnt[a]=Math.min((ST.cnt[a]||0)+1,9999);ST.bits[a]=(ST.cnt[a]||0)>=o.p;r._prev=cond;break;}
  }
}
function sample(){
  if(!SIGS.length)return;
  HIST.push({t:ST.t,n:ST.scans,b:SIGS.map(a=>read(a))});
  while(HIST.length>240)HIST.shift();
}
function runScan(dt,dry,trace){
  ST.xs=ST.X.slice();
  ST.scans++;
  for(const [ri,r] of prog.rungs.entries()){
    let e=true;r._e=[];r._eo=[];
    r.cols.forEach((col,ci)=>{
      r._e[ci]=e;let any=false;
      for(const c of col){const v=read(c.a);c._v=c.t==='NC'?!v:v;if(c._v)any=true;}
      e=e&&any;
      if(r.br)for(const b of r.br){
        if(b.to!==ci)continue;
        let v=true;b._in=[];
        for(const c of b.cs){b._in.push(v);const x=read(c.a);c._v=c.t==='NC'?!x:x;v=v&&c._v;}
        b._v=v;e=e||v;
      }
      r._eo[ci]=e;
    });
    r._cond=e;
    applyOut(r,dt);
    if(trace)trace(ri);
  }
  ST.t+=dt;
  ST.live=true;
  if(!dry)sample();
}
function runtimeReset(keepX){
  ST.bits={};ST.acc={};ST.cnt={};ST.t=0;ST.live=false;HIST=[];
  if(!keepX){ST.X.fill(false);ST.xs.fill(false);}
  for(const r of prog.rungs){r._prev=false;r._e=undefined;r._eo=undefined;r._cond=false;for(const col of r.cols)for(const c of col)c._v=false;for(const b of (r.br||[])){b._v=false;b._in=[];for(const c of b.cs)c._v=false;}}
}
/*ENDENGINE*/

/* ---------- examples ---------- */
const k=(t,a)=>({t,a});
const mkX=o=>{const a=Array(8).fill('toggle');for(const i in o)a[+i]=o[i];return a;};
const pls=(...r)=>{const a=Array(NCOL).fill('0');for(const [x,y] of r)for(let i=x;i<y&&i<NCOL;i++)a[i]='1';return a.join('');};
const EXAMPLES:Record<string,Example>={
  selfhold:{name:'자기유지 (시작/정지)',tags:{X0:'시작',X1:'정지',Y0:'모터',Y1:'정지등'},xmode:mkX({0:'push',1:'push'}),rungs:[
    {note:'시작을 눌렀다 놓아도 Y0가 유지되고, 정지를 누르면 꺼집니다',cols:[[k('NO','X0'),k('NO','Y0')],[k('NC','X1')]],out:{t:'OUT',a:'Y0',p:0}},
    {note:'모터가 꺼져 있을 때 정지등 점등',cols:[[k('NC','Y0')]],out:{t:'OUT',a:'Y1',p:0}}],scn:{step:500,X:{X0:pls([4,6],[28,30]),X1:pls([20,22])}}},
  interlock:{name:'정/역 인터록',tags:{X0:'정회전',X1:'역회전',X2:'정지',Y0:'정방향',Y1:'역방향'},xmode:mkX({0:'push',1:'push',2:'push'}),rungs:[
    {note:'정회전: 역방향 출력 중에는 동작하지 않습니다',cols:[[k('NO','X0'),k('NO','Y0')],[k('NC','X2')],[k('NC','Y1')]],out:{t:'OUT',a:'Y0',p:0}},
    {note:'역회전: 정방향 출력 중에는 동작하지 않습니다',cols:[[k('NO','X1'),k('NO','Y1')],[k('NC','X2')],[k('NC','Y0')]],out:{t:'OUT',a:'Y1',p:0}}],scn:{step:500,X:{X0:pls([4,6],[26,28]),X1:pls([18,20],[8,10]),X2:pls([14,16],[34,36])}}},
  ondelay:{name:'ON 딜레이 타이머',tags:{X0:'스위치',Y0:'지연출력',Y1:'대기등'},xmode:mkX({}),rungs:[
    {note:'X0를 켜고 3초가 지나면 T0가 완료됩니다',cols:[[k('NO','X0')]],out:{t:'TON',a:'T0',p:30}},
    {note:'T0 완료 시 Y0 출력',cols:[[k('NO','T0')]],out:{t:'OUT',a:'Y0',p:0}},
    {note:'기다리는 동안 대기등 점등',cols:[[k('NO','X0')],[k('NC','T0')]],out:{t:'OUT',a:'Y1',p:0}}],scn:{step:500,X:{X0:pls([4,24],[28,32])}}},
  flicker:{name:'점멸 회로 (1초 간격)',tags:{X0:'동작',Y0:'점멸등'},xmode:mkX({}),rungs:[
    {note:'T0: 켜져 있는 1초',cols:[[k('NO','X0')],[k('NC','T1')]],out:{t:'TON',a:'T0',p:10}},
    {note:'T1: 꺼져 있는 1초',cols:[[k('NO','T0')]],out:{t:'TON',a:'T1',p:10}},
    {note:'T0가 끝나기 전까지 점등',cols:[[k('NO','X0')],[k('NC','T0')]],out:{t:'OUT',a:'Y0',p:0}}],scn:{step:500,X:{X0:pls([2,36])}}},
  counter:{name:'업 카운터 (5회)',tags:{X0:'카운트',X1:'리셋',Y0:'5회 도달'},xmode:mkX({0:'push',1:'push'}),rungs:[
    {note:'X0를 누를 때마다(OFF→ON) 1씩 증가',cols:[[k('NO','X0')]],out:{t:'CTU',a:'C0',p:5}},
    {note:'설정 횟수에 도달하면 Y0 출력',cols:[[k('NO','C0')]],out:{t:'OUT',a:'Y0',p:0}},
    {note:'X1으로 카운터 리셋',cols:[[k('NO','X1')]],out:{t:'RST',a:'C0',p:0}}],scn:{step:500,X:{X0:pls([4,6],[8,10],[12,14],[16,18],[20,22]),X1:pls([30,32])}}},
  serpar:{name:'직렬+직렬 병렬 (ORB)',tags:{X0:'A',X1:'B',X2:'C',X3:'D',Y0:'출력'},xmode:mkX({}),rungs:[
    {note:'(X0 AND X1) 또는 (X2 AND X3)이면 Y0 출력',cols:[[k('NO','X0')],[k('NO','X1')]],br:[{to:1,cs:[k('NO','X2'),k('NO','X3')]}],out:{t:'OUT',a:'Y0',p:0}}],scn:{step:500,X:{X0:pls([4,12]),X1:pls([8,16]),X2:pls([20,28]),X3:pls([24,32])}}},
  empty:{name:'빈 프로그램',tags:{},xmode:mkX({}),rungs:[]}
};

/* ---------- persistence ---------- */
const KEY='plc-ladder-sim-v1';
function sane(p){
  if(!p||!Array.isArray(p.rungs)||p.rungs.length>MAXR)return null;
  const okA=a=>typeof a==='string'&&/^[XYMTC]\d+$/.test(a)&&(+a.slice(1))<GN[a[0]];
  const rungs=[];
  for(const r of p.rungs){
    if(!r||!Array.isArray(r.cols)||r.cols.length>6)return null;
    const cols=[];
    for(const col of r.cols){
      if(!Array.isArray(col)||!col.length||col.length>4)return null;
      const cc=[];
      for(const c of col){if(!c||(c.t!=='NO'&&c.t!=='NC')||!okA(c.a))return null;cc.push({t:c.t,a:c.a});}
      cols.push(cc);
    }
    const br=[];
    if(Array.isArray(r.br)&&cols.length){
      if(r.br.length>4)return null;
      for(const b of r.br){
        if(!b||!Array.isArray(b.cs)||!b.cs.length||b.cs.length>6)return null;
        const cs=[];
        for(const c of b.cs){if(!c||(c.t!=='NO'&&c.t!=='NC')||!okA(c.a))return null;cs.push({t:c.t,a:c.a});}
        br.push({to:Math.max(0,Math.min(cols.length-1,parseInt(b.to,10)||0)),cs});
      }
    }
    let out=null;
    if(r.out){
      const o=r.out;
      if(!OUT_ALLOWED[o.t]||!okA(o.a)||!OUT_ALLOWED[o.t].includes(o.a[0]))return null;
      out={t:o.t,a:o.a,p:Math.max(0,Math.min(36000,parseInt(o.p,10)||0))};
    }
    rungs.push({note:String(r.note||'').slice(0,60),cols,br,out});
  }
  const tags={};
  if(p.tags&&typeof p.tags==='object')for(const a in p.tags)if(okA(a))tags[a]=String(p.tags[a]).slice(0,8);
  const xmode=Array.from({length:8},(_,i)=>(p.xmode&&p.xmode[i]==='push')?'push':'toggle');
  const scn={step:500,X:{}};
  if(p.scn&&typeof p.scn==='object'){
    if([100,200,500,1000].includes(+p.scn.step))scn.step=+p.scn.step;
    if(p.scn.X&&typeof p.scn.X==='object')for(const a in p.scn.X){
      if(/^X[0-7]$/.test(a)&&typeof p.scn.X[a]==='string')scn.X[a]=p.scn.X[a].replace(/[^01]/g,'0').padEnd(NCOL,'0').slice(0,NCOL);
    }
  }
  return {rungs,tags,xmode,scn};
}
const hhmm=()=>{const d=new Date(),p=n=>String(n).padStart(2,'0');return p(d.getHours())+':'+p(d.getMinutes())+':'+p(d.getSeconds());};
function setSaveState(t){const el=$('saveState');if(el)el.textContent=t;}
function snapshot(){return JSON.stringify({format:'plc-ladder-sim',version:1,savedAt:new Date().toISOString(),rungs:prog.rungs,tags:prog.tags,xmode:prog.xmode,scn:prog.scn},(key,v)=>key[0]==='_'?undefined:v,2);}
function save(){
  try{localStorage.setItem(KEY,JSON.stringify(prog,(key,v)=>key[0]==='_'?undefined:v));setSaveState('이 브라우저에 자동 저장됨 · '+hhmm());}
  catch(e){setSaveState('브라우저 저장을 쓸 수 없습니다. 파일로 저장해 두세요.');}
}
function loadSaved(){try{const s=localStorage.getItem(KEY);if(s)return sane(JSON.parse(s));}catch(e){}return null;}
function cloneEx(id){const e=EXAMPLES[id];return sane(JSON.parse(JSON.stringify({rungs:e.rungs,tags:e.tags,xmode:e.xmode,scn:e.scn})));}

/* ---------- svg builders ---------- */
function contactBody(c,W){
  const m=W/2;
  let s=`<line class="w wa" x1="0" y1="28" x2="${m-7}" y2="28"/><line class="w wb" x1="${m+7}" y1="28" x2="${W}" y2="28"/>`;
  s+=`<line class="sym" x1="${m-7}" y1="17" x2="${m-7}" y2="39"/><line class="sym" x1="${m+7}" y1="17" x2="${m+7}" y2="39"/>`;
  if(c.t==='NC')s+=`<line class="sym slash" x1="${m-12}" y1="40" x2="${m+12}" y2="16"/>`;
  const sub=prog.tags[c.a]||(c.t==='NO'?'a접점':'b접점');
  return s+`<text class="addr" x="${m}" y="11" text-anchor="middle">${c.a}</text><text class="tg2" x="${m}" y="52" text-anchor="middle">${esc(sub)}</text>`;
}
function contactSVG(c,n,i,W){
  W=W||84;const H=56;
  let s=`<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" aria-hidden="true">`;
  if(n>1){
    const y1=i>0?0:28,y2=i<n-1?H:28;
    s+=`<line class="w vl" x1="1" x2="1" y1="${y1}" y2="${y2}"/><line class="w vr" x1="${W-1}" x2="${W-1}" y1="${y1}" y2="${y2}"/>`;
  }
  return s+contactBody(c,W)+'</svg>';
}
function brSVG(c,W,first,last,up){
  let s=`<svg viewBox="0 0 ${W} 56" width="${W}" height="56" aria-hidden="true">`;
  if(first)s+=`<line class="w vl" x1="1" x2="1" y1="${-up}" y2="28"/>`;
  if(last)s+=`<line class="w vr" x1="${W-1}" x2="${W-1}" y1="${-up}" y2="28"/>`;
  return s+contactBody(c,W)+'</svg>';
}
function outSVG(o){
  const W=160,H=56;
  let s=`<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" aria-hidden="true">`;
  if(o.t==='TON'||o.t==='CTU'){
    s+=`<line class="w wo" x1="0" y1="28" x2="28" y2="28"/><line class="w wo" x1="132" y1="28" x2="${W}" y2="28"/>`;
    s+=`<rect class="osym box" x="28" y="5" width="104" height="46" rx="3"/>`;
    s+=`<text class="addr" x="80" y="21" text-anchor="middle">${o.t} ${o.a}</text><text class="dyn" x="80" y="41" text-anchor="middle"></text>`;
  }else{
    s+=`<line class="w wo" x1="0" y1="28" x2="63" y2="28"/><line class="w wo" x1="97" y1="28" x2="${W}" y2="28"/>`;
    s+=`<path class="osym" d="M 70 14 Q 56 28 70 42"/><path class="osym" d="M 90 14 Q 104 28 90 42"/>`;
    const L=o.t==='SET'?'S':o.t==='RST'?'R':'';
    if(L)s+=`<text class="otxt" x="80" y="32" text-anchor="middle">${L}</text>`;
    s+=`<text class="addr" x="80" y="11" text-anchor="middle">${o.a}</text><text class="tg2" x="80" y="52" text-anchor="middle">${esc(prog.tags[o.a]||o.t)}</text>`;
  }
  return s+'</svg>';
}
function dynText(o){
  if(o.t==='TON')return `${((ST.acc[o.a]||0)/1000).toFixed(1)} / ${(o.p/10).toFixed(1)}s`;
  if(o.t==='CTU')return `${ST.cnt[o.a]||0} / ${o.p}`;
  return '';
}

/* ---------- ladder render ---------- */
const div=c=>{const d=document.createElement('div');d.className=c;return d;};
function renderLadder(){
  const host=$('rungs');host.textContent='';
  if(!prog.rungs.length){host.innerHTML='<p class="empty">렁이 없습니다. 위의 “+ 렁 추가”로 시작하세요.</p>';return;}
  prog.rungs.forEach((r,ri)=>{
    const sec=document.createElement('section');sec.className='rung';
    sec.innerHTML=`<div class="rung-h"><span class="no">R${ri+1}</span>
      <button type="button" class="note${r.note?'':' none'}" data-act="note" data-r="${ri}" aria-label="행 ${ri+1} 설명 편집">${r.note?esc(r.note):'설명 추가'}</button>
      <div class="acts">
        <button type="button" class="btn sm" data-act="up" data-r="${ri}" aria-label="렁 ${ri+1} 위로"${ri===0?' disabled':''}>▲</button>
        <button type="button" class="btn sm" data-act="down" data-r="${ri}" aria-label="렁 ${ri+1} 아래로"${ri===prog.rungs.length-1?' disabled':''}>▼</button>
        <button type="button" class="btn sm danger" data-act="del" data-r="${ri}">삭제</button>
      </div></div>`;
    const body=div('rung-b'),wrap=div('rungbox'),row=div('rungrow');
    const brs=r.br||[];
    const colW=r.cols.map(()=>84);
    brs.slice().sort((a,b)=>a.to-b.to).forEach(b=>{
      let tot=0;for(let i=0;i<=b.to;i++)tot+=colW[i];
      const need=b.cs.length*84;
      if(need>tot)colW[b.to]+=need-tot;
    });
    const rowH=Math.max(56,...r.cols.map(c=>c.length*56));
    const ui={rail:div('rail'),cols:[],br:[],fill:div('fill'),out:null};
    row.append(ui.rail);
    r.cols.forEach((col,ci)=>{
      const cd=div('col'),cells=[];
      col.forEach((c,ki)=>{
        const b=document.createElement('button');b.type='button';b.className='cell';
        b.dataset.k='c';b.dataset.r=ri;b.dataset.ci=ci;b.dataset.ki=ki;
        b.style.width=colW[ci]+'px';
        b.setAttribute('aria-label',`렁 ${ri+1} ${c.a} ${c.t==='NO'?'a접점':'b접점'}`);
        b.innerHTML=contactSVG(c,col.length,ki,colW[ci]);
        cells.push({c,wa:b.querySelector('.wa'),wb:b.querySelector('.wb'),vl:b.querySelector('.vl'),vr:b.querySelector('.vr'),syms:b.querySelectorAll('.sym')});
        cd.append(b);
      });
      ui.cols.push(cells);row.append(cd);
    });
    row.append(ui.fill);
    const ob=document.createElement('button');ob.type='button';ob.className='cell out';
    ob.dataset.k='o';ob.dataset.r=ri;
    if(r.out){
      ob.setAttribute('aria-label',`행 ${ri+1} 출력 ${r.out.t} ${r.out.a}`);
      ob.innerHTML=outSVG(r.out);
    }else{
      ob.setAttribute('aria-label',`행 ${ri+1} 출력 비어 있음`);
      ob.innerHTML='<svg viewBox="0 0 160 56" width="160" height="56" aria-hidden="true"><rect class="ph" x="22" y="10" width="116" height="36" rx="4"/><text class="tg2" x="80" y="32" text-anchor="middle">OUT Y0 처럼 입력</text></svg>';
    }
    ui.out={wires:ob.querySelectorAll('.wo'),syms:ob.querySelectorAll('.osym'),dyn:ob.querySelector('.dyn')};
    row.append(ob);
    const rr=div('rail');row.append(rr);
    wrap.append(row);
    brs.forEach((b,bi)=>{
      let W=0;for(let i=0;i<=b.to;i++)W+=colW[i];
      const n=b.cs.length,sw=W/n,up=rowH-28+bi*56;
      const brow=div('brow'),cells=[];
      b.cs.forEach((c,ki)=>{
        const bt=document.createElement('button');bt.type='button';bt.className='cell';
        bt.dataset.k='b';bt.dataset.r=ri;bt.dataset.bi=bi;bt.dataset.ki=ki;
        bt.style.width=sw+'px';
        bt.setAttribute('aria-label',`행 ${ri+1} 병렬 가지 ${bi+1} ${ki+1}번째 ${c.a} ${c.t==='NO'?'a접점':'b접점'}`);
        bt.innerHTML=brSVG(c,sw,ki===0,ki===n-1,up);
        cells.push({c,wa:bt.querySelector('.wa'),wb:bt.querySelector('.wb'),vl:bt.querySelector('.vl'),vr:bt.querySelector('.vr'),syms:bt.querySelectorAll('.sym')});
        brow.append(bt);
      });
      wrap.append(brow);ui.br.push(cells);
    });
    body.append(wrap);sec.append(body);host.append(sec);
    r._ui=ui;
  });
}
function updateFlow(){
  const live=ST.live;
  prog.rungs.forEach(r=>{
    const ui=r._ui;if(!ui)return;
    const ok=live&&!!r._e;
    ui.rail.classList.toggle('on',live);
    ui.cols.forEach((cells,ci)=>{
      const ein=ok&&r._e[ci],eout=ok&&r._eo[ci];
      cells.forEach(o=>{
        o.wa.classList.toggle('on',!!ein);
        o.wb.classList.toggle('on',!!(ein&&o.c._v));
        if(o.vl)o.vl.classList.toggle('on',!!ein);
        if(o.vr)o.vr.classList.toggle('on',!!eout);
        o.syms.forEach(s=>s.classList.toggle('closed',!!(ok&&o.c._v)));
      });
    });
    (r.br||[]).forEach((b,bi)=>{
      const cells=ui.br&&ui.br[bi];if(!cells)return;
      cells.forEach((o,ki)=>{
        const inn=!!(ok&&b._in&&b._in[ki]);
        o.wa.classList.toggle('on',inn);
        o.wb.classList.toggle('on',inn&&!!o.c._v);
        if(o.vl)o.vl.classList.toggle('on',!!ok);
        if(o.vr)o.vr.classList.toggle('on',!!(ok&&b._v));
        o.syms.forEach(s=>s.classList.toggle('closed',!!(ok&&o.c._v)));
      });
    });
    const cond=!!(ok&&r._cond),o=r.out;
    ui.fill.classList.toggle('on',cond);
    if(!o)return;
    const lit=(o.t==='TON'||o.t==='CTU')?(live&&!!ST.bits[o.a]):cond;
    ui.out.wires.forEach(w=>w.classList.toggle('on',cond));
    ui.out.syms.forEach(s=>s.classList.toggle('closed',lit));
    if(ui.out.dyn)ui.out.dyn.textContent=dynText(o);
  });
}

/* ---------- selection & editor ---------- */
function applySel(){
  const s=ST.sel;
  document.querySelectorAll('#rungs .cell').forEach(b=>{
    let on=false;
    if(s){
      if(s.k==='c')on=b.dataset.k==='c'&&+b.dataset.r===s.r&&+b.dataset.ci===s.ci&&+b.dataset.ki===s.ki;
      else if(s.k==='b')on=b.dataset.k==='b'&&+b.dataset.r===s.r&&+b.dataset.bi===s.bi&&+b.dataset.ki===s.ki;
      else on=b.dataset.k==='o'&&+b.dataset.r===s.r;
    }
    b.classList.toggle('sel',on);
  });
  updateCmdHint();
}
function addrOptions(allowed,cur){
  let h='';
  for(const [g,label,n] of GROUPS){
    if(!allowed.includes(g))continue;
    h+=`<optgroup label="${label} ${g}">`;
    for(let i=0;i<n;i++){const a=g+i,tg=prog.tags[a];h+=`<option value="${a}"${a===cur?' selected':''}>${a}${tg?' · '+esc(tg):''}</option>`;}
    h+='</optgroup>';
  }
  return h;
}
function validSel(){
  const s=ST.sel;if(!s)return;
  const r=prog.rungs[s.r];
  if(!r){ST.sel=null;return;}
  if(s.k==='c'&&!(r.cols[s.ci]&&r.cols[s.ci][s.ki]))ST.sel=null;
  if(s.k==='b'&&!(r.br&&r.br[s.bi]&&r.br[s.bi].cs[s.ki]))ST.sel={k:'o',r:s.r};
}
function normBr(r){
  r.br=(r.br||[]).filter(b=>b&&b.cs&&b.cs.length);
  if(!r.cols.length){
    if(r.br.length)r.cols=r.br[0].cs.slice(0,6).map(c=>[c]);
    r.br=[];return;
  }
  r.br.forEach(b=>{b.to=Math.max(0,Math.min(r.cols.length-1,b.to|0));});
}
function selFromCell(c){
  const d=c.dataset;
  if(d.k==='c')return {k:'c',r:+d.r,ci:+d.ci,ki:+d.ki};
  if(d.k==='b')return {k:'b',r:+d.r,bi:+d.bi,ki:+d.ki};
  return {k:'o',r:+d.r};
}
function renderEditor(){}
function renderEditorLegacy(focusId){
  const ed=$('editor'),s=ST.sel;
  if(!s){ed.innerHTML='<p class="ed-hint">접점이나 코일을 클릭하면 이곳에서 종류와 주소를 바꿀 수 있습니다.</p>';return;}
  const r=prog.rungs[s.r];
  if(s.k==='c'){
    const col=r.cols[s.ci],c=col[s.ki];
    ed.innerHTML=`<span class="ed-name">접점 · 렁 ${s.r+1}</span>
      <label class="fld">종류 <select id="edT"><option value="NO"${c.t==='NO'?' selected':''}>a접점 (NO)</option><option value="NC"${c.t==='NC'?' selected':''}>b접점 (NC)</option></select></label>
      <label class="fld">주소 <select id="edA">${addrOptions('XYMTC',c.a)}</select></label>
      <button type="button" class="btn sm" id="edPar"${col.length>=4?' disabled':''}>병렬 추가</button>
      <button type="button" class="btn sm" id="edSer"${r.cols.length>=6?' disabled':''}>뒤에 직렬 추가</button>
      <button type="button" class="btn sm danger" id="edDel">삭제</button>`;
  }else if(!r.out){
    ed.innerHTML=`<span class="ed-name">출력 · 행 ${s.r+1}</span><span class="ed-hint">출력이 비어 있습니다. 입력줄에 <kbd>OUT Y0</kbd> 처럼 입력하거나</span><button type="button" class="btn sm" id="edAddOut">기본 코일 추가</button>`;
  }else{
    const o=r.out,tp=o.t==='TON'||o.t==='CTU';
    const types=[['OUT','OUT 코일'],['SET','SET 유지'],['RST','RST 해제'],['TON','TON 온딜레이 타이머'],['CTU','CTU 업 카운터']];
    ed.innerHTML=`<span class="ed-name">출력 · 렁 ${s.r+1}</span>
      <label class="fld">종류 <select id="edT">${types.map(([v,l])=>`<option value="${v}"${o.t===v?' selected':''}>${l}</option>`).join('')}</select></label>
      <label class="fld">주소 <select id="edA">${addrOptions(OUT_ALLOWED[o.t],o.a)}</select></label>
      ${tp?`<label class="fld">${o.t==='TON'?'설정값 (0.1초 단위)':'설정 횟수'} <input id="edP" type="number" min="1" max="${o.t==='TON'?36000:9999}" value="${o.p}" inputmode="numeric"></label>
      <span class="hint" id="edH">${o.t==='TON'?'= '+(o.p/10).toFixed(1)+'초':''}</span>`:''}`;
  }
  if(focusId){const f=$(focusId);if(f)f.focus();}
}
function setOutType(o,t){
  const prev=o.t;o.t=t;
  const al=OUT_ALLOWED[t];
  if(!al.includes(o.a[0]))o.a=al[0]==='T'?'T0':al[0]==='C'?'C0':'Y0';
  if(t==='TON'&&prev!=='TON')o.p=30;
  if(t==='CTU'&&prev!=='CTU')o.p=5;
}

/* ---------- io panel ---------- */
const IO={x:[],y:[],m:[]};
function renderIO(){
  let h='';
  for(let i=0;i<8;i++){
    const m=prog.xmode[i];
    h+=`<div class="xc"><button type="button" class="xin" data-i="${i}" data-mode="${m}" aria-pressed="false" aria-label="입력 X${i}"><span class="ad">X${i}</span><span class="sw"><i></i></span><span class="tg">${esc(prog.tags['X'+i]||'')}</span></button><button type="button" class="mode" data-i="${i}" aria-label="X${i} 동작 방식 바꾸기">${m==='push'?'푸시':'유지'}</button></div>`;
  }
  $('xin').innerHTML=h;
  h='';
  for(let i=0;i<GN.Y;i++)h+=`<div class="lamp" data-i="${i}"><span class="bulb"></span><span class="ad">Y${i}</span><span class="tg">${esc(prog.tags['Y'+i]||'')}</span></div>`;
  $('yout').innerHTML=h;
  h='';
  for(let i=0;i<GN.M;i++)h+=`<span class="mdot" title="M${i}"><i></i>M${i}</span>`;
  $('mrel').innerHTML=h;
  IO.x=[...$('xin').querySelectorAll('.xin')];
  IO.y=[...$('yout').querySelectorAll('.lamp')];
  IO.m=[...$('mrel').querySelectorAll('.mdot')];
}
function updateIO(){
  IO.x.forEach((el,i)=>{const on=ST.X[i];el.classList.toggle('on',on);el.setAttribute('aria-pressed',on?'true':'false');});
  IO.y.forEach((el,i)=>el.classList.toggle('on',!!ST.bits['Y'+i]));
  IO.m.forEach((el,i)=>el.classList.toggle('on',!!ST.bits['M'+i]));
}
function press(i){ST.hold[i]=true;ST.X[i]=true;ST.pt[i]=performance.now();updateIO();refresh();}
function release(i){
  if(!ST.hold[i])return;ST.hold[i]=false;
  const wait=Math.max(0,120-(performance.now()-ST.pt[i]));
  setTimeout(()=>{if(!ST.hold[i]){ST.X[i]=false;updateIO();refresh();}},wait);
}
const xin=$('xin');
xin.addEventListener('pointerdown',e=>{
  const b=e.target.closest('.xin');if(!b)return;
  const i=+b.dataset.i;if(prog.xmode[i]!=='push')return;
  e.preventDefault();try{b.setPointerCapture(e.pointerId);}catch(_){}
  press(i);
});
['pointerup','pointercancel','lostpointercapture'].forEach(ev=>xin.addEventListener(ev,e=>{
  const b=e.target.closest('.xin');if(b)release(+b.dataset.i);
}));
xin.addEventListener('keydown',e=>{
  const b=e.target.closest('.xin');if(!b)return;
  const i=+b.dataset.i;
  if(prog.xmode[i]==='push'&&(e.key===' '||e.key==='Enter')){e.preventDefault();if(!e.repeat)press(i);}
});
xin.addEventListener('keyup',e=>{
  const b=e.target.closest('.xin');if(!b)return;
  const i=+b.dataset.i;
  if(prog.xmode[i]==='push'&&(e.key===' '||e.key==='Enter')){e.preventDefault();release(i);}
});
xin.addEventListener('click',e=>{
  const m=e.target.closest('.mode');
  if(m){
    const i=+m.dataset.i;prog.xmode[i]=prog.xmode[i]==='push'?'toggle':'push';
    ST.X[i]=false;ST.hold[i]=false;save();renderIO();refresh();return;
  }
  const b=e.target.closest('.xin');if(!b)return;
  const i=+b.dataset.i;
  if(prog.xmode[i]==='push')return;
  ST.X[i]=!ST.X[i];updateIO();refresh();
});

/* ---------- timers & counters panel ---------- */
let MEM=[];
function renderMem(){
  const seen={},list=[];
  prog.rungs.forEach(r=>{const o=r.out;if(o&&(o.t==='TON'||o.t==='CTU')&&!seen[o.a]){seen[o.a]=1;list.push(o);}});
  list.sort((a,b)=>a.a<b.a?-1:1);
  $('memSec').hidden=!list.length;
  const host=$('mem');host.textContent='';MEM=[];
  list.forEach(o=>{
    const row=div('mr');
    row.innerHTML=`<span>${o.a}</span><span class="bar"><i></i></span><span class="v"></span>`;
    host.append(row);
    MEM.push({o,row,bar:row.querySelector('i'),v:row.querySelector('.v')});
  });
}
function updateMem(){
  MEM.forEach(m=>{
    const o=m.o;
    let cur,pre;
    if(o.t==='TON'){cur=(ST.acc[o.a]||0)/1000;pre=o.p/10;m.v.textContent=cur.toFixed(1)+' / '+pre.toFixed(1)+'s';}
    else{cur=ST.cnt[o.a]||0;pre=o.p;m.v.textContent=cur+' / '+pre;}
    m.bar.style.width=Math.max(0,Math.min(100,pre>0?cur/pre*100:100))+'%';
    m.row.classList.toggle('done',!!ST.bits[o.a]);
  });
}

/* ---------- one-scan preview chart ---------- */
function buildSignals(){
  const set=new Set();
  prog.rungs.forEach(r=>{r.cols.forEach(col=>col.forEach(c=>set.add(c.a)));(r.br||[]).forEach(b=>b.cs.forEach(c=>set.add(c.a)));if(r.out)set.add(r.out.a);});
  const ord='XMTCY';
  SIGS=[...set].sort((a,b)=>ord.indexOf(a[0])-ord.indexOf(b[0])||(+a.slice(1))-(+b.slice(1)));
}
let chartDirty=true;
function snapState(){
  const sv={bits:Object.assign({},ST.bits),acc:Object.assign({},ST.acc),cnt:Object.assign({},ST.cnt),xs:ST.xs.slice(),X:ST.X.slice(),t:ST.t,scans:ST.scans,live:ST.live,hist:HIST.slice()};
  const rs=prog.rungs.map(r=>({prev:r._prev,e:r._e,eo:r._eo,cond:r._cond,
    cv:r.cols.map(c=>c.map(x=>x._v)),
    br:(r.br||[]).map(b=>({v:b._v,inn:b._in,cv:b.cs.map(x=>x._v)}))}));
  return function restoreState(){
    ST.bits=sv.bits;ST.acc=sv.acc;ST.cnt=sv.cnt;ST.xs=sv.xs;ST.t=sv.t;ST.scans=sv.scans;ST.live=sv.live;
    HIST=sv.hist;
    for(let i=0;i<8;i++)ST.X[i]=sv.X[i];
    prog.rungs.forEach((r,i)=>{
      const o=rs[i];r._prev=o.prev;r._e=o.e;r._eo=o.eo;r._cond=o.cond;
      r.cols.forEach((c,ci)=>c.forEach((x,ki)=>{x._v=o.cv[ci][ki];}));
      (r.br||[]).forEach((b,bi)=>{b._v=o.br[bi].v;b._in=o.br[bi].inn;b.cs.forEach((x,ki)=>{x._v=o.br[bi].cv[ki];});});
    });
  };
}
type XRole='start'|'stop'|'sensor'|'always'|'custom';
type XScenario={role:XRole;on:string;off:string};
type ChartResult={duration:number;times:number[];values:boolean[][]};
const SCENARIO_KEY='plc-ladder-chart-scenario-v1';
const ROLE_NAMES:Record<XRole,string>={start:'시작 버튼',stop:'정지 버튼',sensor:'센서',always:'항상 ON',custom:'직접 설정'};
let scenarios:Record<string,XScenario>={};
let chartResult:ChartResult|null=null;
try{scenarios=JSON.parse(localStorage.getItem(SCENARIO_KEY)||'{}')||{};}catch(_){scenarios={};}
function suggestedRole(addr:string):XRole{
  const tag=prog.tags[addr]||'';
  if(/시작|기동|start|run/i.test(tag))return 'start';
  if(/정지|종료|stop|reset/i.test(tag))return 'stop';
  if(/센서|감지|sensor|detect/i.test(tag))return 'sensor';
  return 'custom';
}
function roleDefaults(role:XRole):XScenario{
  if(role==='start')return {role,on:'0',off:'0.5'};
  if(role==='stop')return {role,on:'5',off:'5.5'};
  if(role==='sensor')return {role,on:'1',off:'4'};
  if(role==='always')return {role,on:'0',off:''};
  return {role,on:'0',off:'1'};
}
function persistScenarios(){try{localStorage.setItem(SCENARIO_KEY,JSON.stringify(scenarios));}catch(_){}}
function scenarioAddresses(){return SIGS.filter(a=>a[0]==='X');}
function renderScenarioInputs(){
  const host=$('scenarioInputs'),addresses=scenarioAddresses();
  if(!addresses.length){host.innerHTML='<p class="scenario-head">래더에 X 접점을 추가하면 여기에서 입력 시나리오를 설정할 수 있습니다.</p>';return;}
  addresses.forEach(a=>{if(!scenarios[a])scenarios[a]=roleDefaults(suggestedRole(a));});
  host.innerHTML='<div class="scenario-head"><span>X</span><span>역할</span><span>ON (초)</span><span>OFF (초)</span></div>'+addresses.map(a=>{
    const s=scenarios[a];
    return `<label class="scenario-row"><span class="addr">${a}</span><select data-address="${a}" data-field="role" aria-label="${a} 역할">${(['start','stop','sensor','always','custom'] as XRole[]).map(role=>`<option value="${role}" ${s.role===role?'selected':''}>${ROLE_NAMES[role]}</option>`).join('')}</select><input data-address="${a}" data-field="on" type="number" min="0" max="60" step="0.1" value="${esc(s.on)}" aria-label="${a} ON 시각 초" title="ON 시각(초)"><input data-address="${a}" data-field="off" type="number" min="0" max="60" step="0.1" value="${esc(s.off)}" placeholder="끝까지" aria-label="${a} OFF 시각 초" title="OFF 시각(초)"></label>`;
  }).join('');
  persistScenarios();
}
function invalidateChart(message='입력 일정 또는 래더가 바뀌었습니다. 타임차트를 다시 예상해 주세요.'){
  chartResult=null;chartDirty=true;$('chartHint').textContent=message;refresh();
}
function runPrediction(){
  const duration=Math.min(60,Math.max(1,Number($('simDuration').value)||10));$('simDuration').value=String(duration);
  const addresses=scenarioAddresses(),inputs:Record<string,{on:number;off:number|null}>={};
  for(const addr of addresses){
    const s=scenarios[addr]||roleDefaults(suggestedRole(addr));
    const on=Math.min(duration,Math.max(0,Number(s.on)||0));
    const off=s.off.trim()===''?null:Math.min(duration,Math.max(0,Number(s.off)));
    inputs[addr]={on,off};
  }
  const restore=snapState(),dt=50,times:number[]=[],values:boolean[][]=[];
  try{
    runtimeReset(false);
    ST.scans=0;ST.t=0;
    for(let elapsed=0;elapsed<=duration*1000;elapsed+=dt){
      for(const addr of addresses){
        const event=inputs[addr];
        const on=elapsed>=event.on*1000&&(event.off===null||elapsed<event.off*1000);
        ST.X[+addr.slice(1)]=on;
      }
      if(elapsed>0)runScan(dt,true);
      else ST.xs=ST.X.slice();
      times.push(elapsed);values.push(SIGS.map(a=>read(a)));
    }
  }finally{restore();}
  chartResult={duration,times,values};chartDirty=true;
  $('chartHint').textContent=`${duration}초 동안 X 입력 일정대로 50ms 간격으로 래더를 실행한 예상입니다. 입력 X 외의 신호는 초기 OFF 상태에서 시작합니다.`;
  drawChart();
}
function drawChart(){
  chartDirty=false;
  const cv=$('cv'),wrap=cv.parentElement,n=SIGS.length;
  $('chartEmpty').hidden=!!chartResult&&n>0;cv.hidden=!chartResult||n===0;
  if(!chartResult||!n){
    $('chartEmpty').textContent=n?'X 역할과 ON/OFF 시각을 지정하고 “타임차트 예상”을 누르세요.':'래더에 X 접점을 추가하면 입력 일정을 설정할 수 있습니다.';
    if(n)$('chartHint').textContent='X 입력 역할과 시간을 설정한 뒤 타임차트 예상 버튼을 누르세요.';
    return;
  }
  const sim=chartResult,dpr=window.devicePixelRatio||1,avail=Math.max(280,wrap.clientWidth-28);
  const left=134,right=20,top=32,bottom=30,rowH=36,plotW=Math.max(700,avail-left-right),w=left+plotW+right,h=top+n*rowH+bottom;
  if(cv.width!==Math.round(w*dpr)||cv.height!==Math.round(h*dpr)){
    cv.width=Math.round(w*dpr);cv.height=Math.round(h*dpr);cv.style.width=w+'px';cv.style.height=h+'px';
  }
  cv.style.touchAction='pan-x pan-y';
  const ctx=cv.getContext('2d');if(!ctx)return;
  ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,w,h);
  const cs=getComputedStyle(document.documentElement),tok=name=>cs.getPropertyValue(name).trim();
  const cLine=tok('--line'),cInk=tok('--ink'),cInk2=tok('--ink-2');
  const colors={X:tok('--in'),Y:tok('--live'),M:tok('--warn'),T:tok('--warn'),C:tok('--warn')};
  const mono=tok('--mono'),sans=tok('--sans'),plotX=left,plotY=top,sx=(t:number)=>plotX+plotW*t/sim.duration;
  ctx.font='400 11px '+mono;ctx.textAlign='center';ctx.textBaseline='alphabetic';
  for(let sec=0;sec<=sim.duration;sec++){
    const x=Math.round(sx(sec))+.5;ctx.strokeStyle=cLine;ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(x,plotY-8);ctx.lineTo(x,plotY+n*rowH);ctx.stroke();
    ctx.fillStyle=cInk2;ctx.fillText(`${sec}s`,x,plotY+n*rowH+18);
  }
  SIGS.forEach((addr,i)=>{
    const y=plotY+i*rowH,hi=y+8,lo=y+rowH-8;
    ctx.strokeStyle=cLine;ctx.beginPath();ctx.moveTo(0,y+rowH-.5);ctx.lineTo(w,y+rowH-.5);ctx.stroke();
    ctx.textAlign='left';ctx.fillStyle=cInk;ctx.font='600 12px '+mono;ctx.fillText(addr,8,y+rowH/2+4);
    const tag=prog.tags[addr];if(tag){ctx.fillStyle=cInk2;ctx.font='400 11px '+sans;ctx.fillText(tag,43,y+rowH/2+4,left-48);}
    ctx.strokeStyle=colors[addr[0]];ctx.lineWidth=2.5;ctx.lineJoin='round';ctx.beginPath();
    sim.values.forEach((row,k)=>{
      const x=sx(sim.times[k]/1000),level=row[i]?hi:lo;
      if(k===0)ctx.moveTo(x,level);
      else{const prev=sim.values[k-1][i],prevY=prev?hi:lo;ctx.lineTo(x,prevY);if(prev!==row[i])ctx.lineTo(x,level);}
    });
    ctx.stroke();
  });
}
const scenarioHost=$('scenarioInputs');
scenarioHost.addEventListener('change',e=>{
  const el=e.target as HTMLInputElement|HTMLSelectElement,addr=el.dataset.address,field=el.dataset.field;
  if(!addr||!field)return;
  if(field==='role')scenarios[addr]=roleDefaults(el.value as XRole);
  else scenarios[addr]={...(scenarios[addr]||roleDefaults(suggestedRole(addr))),[field]:el.value};
  persistScenarios();renderScenarioInputs();invalidateChart();
});
scenarioHost.addEventListener('input',e=>{
  const el=e.target as HTMLInputElement,addr=el.dataset.address,field=el.dataset.field;
  if(!addr||!field||field==='role')return;
  scenarios[addr]={...(scenarios[addr]||roleDefaults(suggestedRole(addr))),[field]:el.value};persistScenarios();invalidateChart();
});
$('simDuration').addEventListener('input',()=>invalidateChart());
$('bPredict').addEventListener('click',runPrediction);
renderScenarioInputs();
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change',()=>drawChart());

/* ---------- commit / refresh ---------- */
function refresh(){
  updateFlow();updateIO();updateMem();if(chartDirty){chartDirty=false;drawChart();}
  $('scanCnt').textContent='SCAN '+ST.scans;
  $('led').classList.toggle('on',ST.run);
}
function commit(reset){
  chartDirty=true;chartResult=null;
  prog.rungs.forEach(normBr);
  record();
  if(reset!==false)runtimeReset(true);
  validSel();buildSignals();renderScenarioInputs();renderLadder();applySel();renderEditor();renderIO();renderMem();renderIL();save();refresh();
}

/* ---------- instruction list (GX Works2 리스트 표시 형식) ---------- */
function ilLines(){
  const out=[];
  prog.rungs.forEach((r,ri)=>{
    const L=[];
    r.cols.forEach((col,ci)=>{
      col.forEach((c,ki)=>{
        const neg=c.t==='NC';
        let op;
        if(ci===0||col.length>1)op=ki===0?(neg?'LDI':'LD'):(neg?'ORI':'OR');
        else op=neg?'ANI':'AND';
        L.push([op,c.a]);
      });
      if(ci>0&&col.length>1)L.push(['ANB','']);
      (r.br||[]).forEach(b=>{
        if(b.to!==ci)return;
        if(b.cs.length===1){const c=b.cs[0];L.push([c.t==='NC'?'ORI':'OR',c.a]);}
        else{
          b.cs.forEach((c,ki)=>L.push([ki===0?(c.t==='NC'?'LDI':'LD'):(c.t==='NC'?'ANI':'AND'),c.a]));
          L.push(['ORB','']);
        }
      });
    });
    const o=r.out;
    if(o){
      if(!r.cols.length)L.push(['LD','SM400']);
      if(o.t==='TON')L.push(['OUT',o.a+' K'+o.p]);
      else if(o.t==='CTU')L.push(['OUT',o.a+' K'+o.p]);
      else L.push([o.t,o.a]);
    }
    out.push({n:ri+1,note:r.note,L});
  });
  return out;
}
function ilText(){
  const t=[];
  ilLines().forEach(b=>{
    t.push('; R'+b.n+(b.note?' '+b.note:''));
    b.L.forEach(([op,a])=>t.push((op.padEnd(5)+a).trimEnd()));
  });
  t.push('END');
  return t.join('\n');
}
function renderIL(){
  const host=$('il');
  const blocks=ilLines();
  let h='';
  blocks.forEach(b=>{
    h+=`<div class="ilr"><div class="c">R${b.n}${b.note?' · '+esc(b.note):''}</div>`;
    b.L.forEach(([op,a])=>{h+=`<div class="ill"><b>${op}</b><span>${esc(a)}</span></div>`;});
    h+='</div>';
  });
  h+='<div class="ilr"><div class="ill"><b>END</b><span></span></div></div>';
  host.innerHTML=h;
}
function loadProgram(p){
  prog=p;ST.sel=null;ST.hold.fill(false);
  setEdit(false);$('cmd').value='';
  runtimeReset(false);ST.scans=0;
  commit(false);
}
let pending=null;
function askReplace(label,p){
  if(!prog.rungs.length){loadProgram(p);return;}
  pending=p;
  $('banMsg').textContent=`현재 프로그램을 “${label}”(으)로 바꿉니다. 저장하지 않은 내용은 사라집니다.`;
  $('banner').hidden=false;$('banOk').focus();
}
$('banOk').addEventListener('click',()=>{const p=pending;pending=null;$('banner').hidden=true;if(p)loadProgram(p);});
$('banNo').addEventListener('click',()=>{pending=null;$('banner').hidden=true;});

/* ---------- 파일 저장 / 열기 / 리스트 복사 ---------- */
async function copyText(text){
  try{await navigator.clipboard.writeText(text);return true;}catch(_){return false;}
}
$('bSave').addEventListener('click',async()=>{
  const data=snapshot(),d=new Date(),p=n=>String(n).padStart(2,'0');
  const name=`ladder-${d.getFullYear()}${p(d.getMonth()+1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}.json`;
  let dl=null;
  try{dl=window.claude&&window.claude.use?await window.claude.use('downloads'):null;}catch(_){}
  if(dl){
    try{await dl.save({filename:name,data});setSaveState('파일로 저장함 · '+hhmm());}
    catch(err){setSaveState(err&&err.code==='declined'?'파일 저장을 취소했습니다.':'파일 저장에 실패했습니다. 잠시 후 다시 시도하세요.');}
  }else{
    const ok=await copyText(data);
    setSaveState(ok?'파일 저장을 쓸 수 없어 프로그램 내용을 클립보드에 복사했습니다.':'파일 저장을 쓸 수 없습니다. 브라우저 자동 저장만 사용됩니다.');
  }
});
$('bOpen').addEventListener('click',()=>$('fOpen').click());
$('fOpen').addEventListener('change',e=>{
  const f=e.target.files&&e.target.files[0];e.target.value='';
  if(!f)return;
  if(f.size>2000000){setSaveState('파일이 너무 큽니다.');return;}
  const rd=new FileReader();
  rd.onload=()=>{
    let p=null;
    try{p=sane(JSON.parse(String(rd.result)));}catch(_){}
    if(!p){setSaveState('이 도구에서 저장한 .json 파일이 아니거나 내용을 읽을 수 없습니다.');return;}
    askReplace(f.name,p);
  };
  rd.onerror=()=>setSaveState('파일을 읽지 못했습니다.');
  rd.readAsText(f);
});
$('bCopyIL').addEventListener('click',async()=>{
  const b=$('bCopyIL'),ok=await copyText(ilText());
  if(!ok){const r=document.createRange();r.selectNodeContents($('il'));const s=getSelection();s.removeAllRanges();s.addRange(r);}
  b.textContent=ok?'복사됨':'선택됨, 직접 복사하세요';
  setTimeout(()=>{b.textContent='리스트 복사';},1800);
});

/* ---------- ladder events ---------- */
const newRung=()=>({note:'',cols:[[{t:'NO',a:'X0'}]],out:{t:'OUT',a:'Y0',p:0}});
$('rungs').addEventListener('click',e=>{
  const cell=e.target.closest('.cell');
  if(cell){
    ST.sel=selFromCell(cell);
    setEdit(false);$('cmd').value='';
    applySel();renderEditor();return;
  }
  const b=e.target.closest('[data-act]');if(!b||b.disabled)return;
  const ri=+b.dataset.r,r=prog.rungs[ri],act=b.dataset.act;
  if(act==='note'){ST.sel={k:'o',r:ri};applySel();openDlg('note');return;}
  if(act==='del'){prog.rungs.splice(ri,1);ST.sel=null;}
  else if(act==='up'&&ri>0){[prog.rungs[ri-1],prog.rungs[ri]]=[prog.rungs[ri],prog.rungs[ri-1]];ST.sel=null;}
  else if(act==='down'&&ri<prog.rungs.length-1){[prog.rungs[ri+1],prog.rungs[ri]]=[prog.rungs[ri],prog.rungs[ri+1]];ST.sel=null;}
  commit();
});
$('rungs').addEventListener('dblclick',e=>{
  const cell=e.target.closest('.cell');if(!cell)return;
  ST.sel=selFromCell(cell);
  applySel();openDlg('edit');
});
$('rungs').addEventListener('input',e=>{
  const n=e.target.closest('.note');if(!n)return;
  const r=prog.rungs[+n.dataset.r];if(r){r.note=n.value;save();}
});
$('bAddRung').addEventListener('click',()=>addRung(prog.rungs.length));
/* ---------- 되돌리기 / 다시 실행 ---------- */
const REPL=(key,v)=>key[0]==='_'?undefined:v;
let lastSnap='',undoS=[],redoS=[],restoring=false;
function ser(){return JSON.stringify({rungs:prog.rungs,tags:prog.tags},REPL);}
function updateUndoBtns(){$('bUndo').disabled=!undoS.length;$('bRedo').disabled=!redoS.length;}
function record(){
  if(restoring)return;
  const s=ser();
  if(s!==lastSnap){
    if(lastSnap){undoS.push(lastSnap);if(undoS.length>100)undoS.shift();}
    redoS=[];lastSnap=s;
  }
  updateUndoBtns();
}
function restore(s){
  let o;try{o=JSON.parse(s);}catch(_){return;}
  const p=sane({rungs:o.rungs,tags:o.tags,xmode:prog.xmode,scn:prog.scn});
  if(!p)return;
  prog=p;lastSnap=s;restoring=true;
  try{commit(true);}finally{restoring=false;}
  updateUndoBtns();
}
function undo(){
  if(!undoS.length)return say('되돌릴 작업이 없습니다.',true);
  redoS.push(lastSnap);restore(undoS.pop());say('되돌렸습니다.');
}
function redo(){
  if(!redoS.length)return say('다시 실행할 작업이 없습니다.',true);
  undoS.push(lastSnap);restore(redoS.pop());say('다시 실행했습니다.');
}
$('bUndo').addEventListener('click',undo);
$('bRedo').addEventListener('click',redo);

/* ---------- 입력 모달 (GX Works2식 명령어 입력) ---------- */
const dlg=$('dlg'),cmd=$('cmd');
const MN={LD:['c','NO'],LDI:['c','NC'],AND:['c','NO'],ANI:['c','NC'],OR:['c','NO'],ORI:['c','NC'],OUT:['o','OUT'],SET:['o','SET'],RST:['o','RST']};
let cmdHist=[],cmdPos=-1,dlgMode='add';
function setEdit(on){ST.edit=!!on;}
function say(msg,isErr){
  const el=dlg.open?$('dlgMsg'):$('cmdStat');
  el.textContent=msg;el.classList.toggle('err',!!isErr);
  return false;
}
function where(){
  const s=ST.sel;if(!s)return '';
  const r=prog.rungs[s.r];if(!r)return '';
  if(s.k==='o')return `행 ${s.r+1} · 출력`;
  if(s.k==='b')return `행 ${s.r+1} · 병렬 가지 ${s.bi+1}의 ${s.ki+1}번째 접점`;
  return `행 ${s.r+1} · ${s.ci+1}번째 접점${r.cols[s.ci].length>1?' · 병렬 '+(s.ki+1):''}`;
}
function updateCmdHint(){
  const el=$('cmdStat');
  el.classList.remove('err');
  const w=where();
  el.textContent=w?`현재 위치: ${w} — Enter 수정 · 영문자 입력 · ⌘/Ctrl+Enter 행 추가 · ⌘/Ctrl+Z 되돌리기`:'접점이나 코일을 선택하거나, ⌘/Ctrl+Enter로 행을 추가하세요.';
}
function cellText(s){
  const r=prog.rungs[s.r];
  if(s.k==='o'){
    const o=r.out;if(!o)return '';
    return (o.t==='TON'||o.t==='CTU')?`OUT ${o.a} K${o.p}`:`${o.t} ${o.a}`;
  }
  if(s.k==='b'){
    const b=r.br[s.bi],c=b.cs[s.ki],neg=c.t==='NC';
    const op=b.cs.length===1?(neg?'ORI':'OR'):s.ki===0?(neg?'LDI':'LD'):(neg?'ANI':'AND');
    return op+' '+c.a;
  }
  const c=r.cols[s.ci][s.ki],neg=c.t==='NC';
  let op;
  if(s.ci===0||r.cols[s.ci].length>1)op=s.ki===0?(neg?'LDI':'LD'):(neg?'ORI':'OR');
  else op=neg?'ANI':'AND';
  return op+' '+c.a;
}
function parseCmd(txt){
  const tk=txt.trim().toUpperCase().replace(/[,;]+/g,' ').split(/\s+/).filter(Boolean);
  if(!tk.length)return {err:'명령어를 입력하세요. 예: LD X0'};
  if(tk[0]==='ORB')return tk.length>1?{err:'ORB는 주소 없이 ORB만 입력합니다.'}:{op:'ORB',kind:'m'};
  let op=tk[0],a=tk[1],kk=tk[2];
  const m=op.match(/^(LDI|LD|ANI|AND|ORI|OR|OUT|SET|RST)([XYMTC]\d+)$/);
  if(m&&!a){op=m[1];a=m[2];}
  if(!MN[op])return {err:`“${op}”는 알 수 없는 명령어입니다. LD, LDI, AND, ANI, OR, ORI, ORB, OUT, SET, RST를 쓸 수 있습니다.`};
  if(!a||!/^[XYMTC]\d+$/.test(a))return {err:`${op} 뒤에 주소가 필요합니다. 예: ${op} X0`};
  if(+a.slice(1)>=GN[a[0]])return {err:`${a}는 범위를 벗어났습니다. ${a[0]}0~${a[0]}${GN[a[0]]-1}만 쓸 수 있습니다.`};
  let p=null;
  if(kk){const mk=kk.match(/^K(\d+)$/);if(!mk)return {err:'설정값은 K30처럼 입력합니다.'};p=Math.min(+mk[1],36000);}
  return {op,a,p,kind:MN[op][0],val:MN[op][1]};
}
function focusSelCell(){
  const el=document.querySelector('#rungs .cell.sel');
  if(el){el.focus({preventScroll:true});el.scrollIntoView({block:'nearest',inline:'nearest'});}
}
function configDlg(mode,init){
  dlgMode=mode;setEdit(mode==='edit');
  const s=ST.sel,w=where();
  const badge=$('dlgBadge');
  badge.textContent=mode==='edit'?'수정':mode==='note'?'설명':'추가';
  badge.classList.toggle('edit',mode!=='add');
  $('dlgOk').textContent=mode==='add'?'입력':'적용';
  cmd.classList.toggle('plain',mode==='note');
  $('dlgRef').hidden=mode==='note';
  if(mode==='note'){
    $('dlgTitle').textContent=`행 ${s.r+1} 설명`;
    cmd.placeholder='이 행이 하는 일을 적어 두세요';
    cmd.maxLength=60;
    cmd.value=prog.rungs[s.r].note;
    $('dlgHint').textContent='Enter로 적용합니다. 설명은 명령어 리스트에도 표시됩니다.';
  }else{
    $('dlgTitle').textContent=(mode==='edit'?'수정':'명령어 입력')+(w?' · '+w:'');
    cmd.placeholder='예) LD X0';
    cmd.removeAttribute('maxlength');
    cmd.value=mode==='edit'?cellText(s):(init||'');
    $('dlgHint').textContent=mode==='edit'?'Enter로 적용하면 창이 닫힙니다.':'Enter로 입력하면 창이 열린 채 다음 명령어를 받습니다. 한글 입력 상태에서도 알파벳 키로 인식합니다.';
  }
}
function openDlg(mode,init){
  if(mode!=='add'&&!ST.sel)return say('먼저 접점이나 코일을 선택하세요.',true);
  configDlg(mode,init);
  $('dlgMsg').textContent='';$('dlgMsg').classList.remove('err');
  if(!dlg.open)dlg.showModal();
  cmd.focus();
  if(mode==='add')cmd.setSelectionRange(cmd.value.length,cmd.value.length);else cmd.select();
}
function execCmd(text){
  const c=parseCmd(text);
  if(c.err)return say(c.err,true);
  if(!prog.rungs.length){
    prog.rungs.push({note:'',cols:[],br:[],out:null});ST.sel={k:'o',r:0};
  }
  let s=ST.sel;
  if(!s){s={k:'o',r:prog.rungs.length-1};ST.sel=s;}
  const r=prog.rungs[s.r];
  r.br=r.br||[];
  const edit=ST.edit;
  let msg='';
  if(c.kind==='m'){
    if(edit)return say('ORB는 새로 입력할 때만 쓸 수 있습니다.',true);
    if(s.k!=='b')return say('ORB는 LD로 시작한 병렬 가지 뒤에서 입력합니다. 예: LD X0 → AND X1 → LD X2 → AND X3 → ORB → OUT Y0',true);
    ST.sel={k:'o',r:s.r};
    msg='ORB: 병렬 가지를 합쳤습니다. 이어서 AND/ANI 또는 OUT을 입력하세요.';
  }else if(c.kind==='o'){
    let t=c.val;
    if(t==='OUT'){if(c.a[0]==='T')t='TON';else if(c.a[0]==='C')t='CTU';}
    if(!OUT_ALLOWED[t].includes(c.a[0]))return say(`${c.op} ${c.a}는 사용할 수 없습니다. ${c.a[0]==='X'?'입력(X)에는 출력할 수 없습니다.':'이 명령어로 쓸 수 있는 주소가 아닙니다.'}`,true);
    if(c.p!=null&&t!=='TON'&&t!=='CTU')return say('K 설정값은 타이머(T)와 카운터(C)에만 쓸 수 있습니다.',true);
    if(edit&&s.k!=='o')return say('접점 위치에서는 LD/AND/OR 계열로 수정합니다. 출력을 바꾸려면 출력 칸을 선택하세요.',true);
    const o={t,a:c.a,p:0};
    if(t==='TON')o.p=c.p!=null?c.p:30;
    if(t==='CTU')o.p=c.p!=null?c.p:5;
    r.out=o;ST.sel={k:'o',r:s.r};
    msg=`행 ${s.r+1} 출력을 ${cellText(ST.sel)}(으)로 설정했습니다.`+((t==='TON'||t==='CTU')&&c.p==null?` 설정값은 기본 K${o.p}입니다.`:'');
  }else{
    if(c.p!=null)return say('접점에는 K 설정값을 쓸 수 없습니다.',true);
    const ct={t:c.val,a:c.a},op=c.op,last=r.cols.length-1;
    if(edit){
      if(s.k==='c')r.cols[s.ci][s.ki]=ct;
      else if(s.k==='b')r.br[s.bi].cs[s.ki]=ct;
      else return say('출력 칸에서는 OUT/SET/RST로 수정합니다.',true);
      msg=`행 ${s.r+1} 접점을 ${c.op} ${c.a}(으)로 수정했습니다.`;
    }else if(op==='LD'||op==='LDI'){
      if(!r.cols.length){r.cols.push([ct]);ST.sel={k:'c',r:s.r,ci:0,ki:0};msg=`행 ${s.r+1}에 ${op} ${c.a}를 추가했습니다.`;}
      else{
        if(r.br.length>=4)return say('병렬 가지는 한 행에 4개까지 만들 수 있습니다.',true);
        r.br.push({to:last,cs:[ct]});ST.sel={k:'b',r:s.r,bi:r.br.length-1,ki:0};
        msg=`${op} ${c.a}로 병렬 가지를 시작했습니다. AND/ANI로 이어 붙이고 ORB로 합치세요.`;
      }
    }else if(op==='AND'||op==='ANI'){
      if(!r.cols.length)return say(`${op} 앞에 LD 또는 LDI로 첫 접점을 먼저 입력하세요.`,true);
      if(s.k==='b'){
        const b=r.br[s.bi];
        if(b.cs.length>=6)return say('병렬 가지 안의 직렬 접점은 6개까지 넣을 수 있습니다.',true);
        b.cs.splice(s.ki+1,0,ct);ST.sel={k:'b',r:s.r,bi:s.bi,ki:s.ki+1};
        msg=`${op} ${c.a}를 병렬 가지 안에 직렬로 추가했습니다. 끝나면 ORB를 입력하세요.`;
      }else{
        if(r.cols.length>=6)return say('직렬 접점은 한 행에 6개까지 넣을 수 있습니다.',true);
        const at=s.k==='c'?s.ci+1:r.cols.length;
        r.cols.splice(at,0,[ct]);
        r.br.forEach(b=>{if(b.to>=at)b.to++;});
        ST.sel={k:'c',r:s.r,ci:at,ki:0};
        msg=`${op} ${c.a}를 직렬로 추가했습니다.`;
      }
    }else{
      if(!r.cols.length)return say(`${op} 앞에 LD 또는 LDI로 첫 접점을 먼저 입력하세요.`,true);
      if(s.k==='b')return say('병렬 가지 안에서는 OR을 쓸 수 없습니다. 먼저 ORB로 가지를 합치세요.',true);
      const wholeRow=last>=1&&(s.k==='o'||s.ci===last);
      if(wholeRow){
        if(r.br.length>=4)return say('병렬 가지는 한 행에 4개까지 만들 수 있습니다.',true);
        r.br.push({to:last,cs:[ct]});ST.sel={k:'o',r:s.r};
        msg=`${op} ${c.a}를 지금까지의 접점 전체와 병렬로 추가했습니다.`;
      }else{
        const ci=s.k==='c'?s.ci:last;
        const col=r.cols[ci];
        if(col.length>=4)return say('병렬 접점은 한 칸에 4개까지 넣을 수 있습니다.',true);
        const at=s.k==='c'?s.ki+1:col.length;
        col.splice(at,0,ct);ST.sel={k:'c',r:s.r,ci,ki:at};
        msg=`${op} ${c.a}를 병렬로 추가했습니다.`;
      }
    }
  }
  if(cmdHist[cmdHist.length-1]!==text.trim())cmdHist.push(text.trim());
  if(cmdHist.length>50)cmdHist.shift();
  cmdPos=-1;
  setEdit(false);
  commit();
  say(msg);
  return true;
}
function addRung(at){
  if(prog.rungs.length>=MAXR)return say(`행은 최대 ${MAXR}개까지 만들 수 있습니다.`,true);
  prog.rungs.splice(at,0,{note:'',cols:[],br:[],out:null});
  ST.sel={k:'o',r:at};
  commit();
  if(dlg.open&&dlgMode!=='note'){configDlg('add');cmd.focus();}
  else openDlg('add');
  say(`행 ${at+1}을 추가했습니다. LD X0 처럼 입력하세요.`);
  const el=document.querySelector('#rungs .cell.sel');if(el)el.scrollIntoView({block:'nearest'});
}
function deleteSel(){
  const s=ST.sel;if(!s)return;
  const r=prog.rungs[s.r];if(!r)return;
  r.br=r.br||[];
  if(s.k==='o'){r.out=null;ST.sel={k:'o',r:s.r};}
  else if(s.k==='b'){
    const b=r.br[s.bi];
    if(b){
      b.cs.splice(s.ki,1);
      if(!b.cs.length){
        r.br.splice(s.bi,1);
        ST.sel=r.cols.length?{k:'c',r:s.r,ci:Math.min(b.to,r.cols.length-1),ki:0}:{k:'o',r:s.r};
      }else ST.sel={k:'b',r:s.r,bi:s.bi,ki:Math.min(s.ki,b.cs.length-1)};
    }
  }else{
    const col=r.cols[s.ci];col.splice(s.ki,1);
    if(!col.length){r.cols.splice(s.ci,1);r.br.forEach(b=>{if(b.to>=s.ci)b.to--;});}
    if(r.cols.length){const ci=Math.min(s.ci,r.cols.length-1);ST.sel={k:'c',r:s.r,ci,ki:0};}
    else ST.sel={k:'o',r:s.r};
  }
  setEdit(false);commit();say('삭제했습니다. 되돌리려면 ⌘/Ctrl+Z.');focusSelCell();
}
function deleteRung(){
  const s=ST.sel;if(!s)return;
  prog.rungs.splice(s.r,1);
  ST.sel=prog.rungs.length?{k:'o',r:Math.min(s.r,prog.rungs.length-1)}:null;
  setEdit(false);commit();say(`행 ${s.r+1}을 삭제했습니다. 되돌리려면 ⌘/Ctrl+Z.`);focusSelCell();
}
function moveCursor(dir){
  let s=ST.sel;
  if(!s){if(!prog.rungs.length)return;s={k:'o',r:0};}
  const R=prog.rungs;let n=null;
  const first=i=>R[i].cols.length?{k:'c',r:i,ci:0,ki:0}:{k:'o',r:i};
  const brs=(R[s.r].br||[]);
  if(s.k==='b'){
    const b=brs[s.bi];
    if(!b)return;
    if(dir==='right')n=s.ki<b.cs.length-1?{k:'b',r:s.r,bi:s.bi,ki:s.ki+1}:{k:'o',r:s.r};
    else if(dir==='left')n=s.ki>0?{k:'b',r:s.r,bi:s.bi,ki:s.ki-1}:null;
    else if(dir==='up')n=s.bi>0?{k:'b',r:s.r,bi:s.bi-1,ki:Math.min(s.ki,brs[s.bi-1].cs.length-1)}:{k:'c',r:s.r,ci:Math.min(s.ki,R[s.r].cols.length-1),ki:0};
    else if(dir==='down')n=s.bi<brs.length-1?{k:'b',r:s.r,bi:s.bi+1,ki:Math.min(s.ki,brs[s.bi+1].cs.length-1)}:(s.r<R.length-1?first(s.r+1):null);
  }else if(dir==='right'){
    if(s.k==='c')n=s.ci<R[s.r].cols.length-1?{k:'c',r:s.r,ci:s.ci+1,ki:Math.min(s.ki,R[s.r].cols[s.ci+1].length-1)}:{k:'o',r:s.r};
  }else if(dir==='left'){
    if(s.k==='o'&&R[s.r].cols.length){const ci=R[s.r].cols.length-1;n={k:'c',r:s.r,ci,ki:0};}
    else if(s.k==='c'&&s.ci>0)n={k:'c',r:s.r,ci:s.ci-1,ki:Math.min(s.ki,R[s.r].cols[s.ci-1].length-1)};
  }else if(dir==='down'){
    if(s.k==='c'&&s.ki<R[s.r].cols[s.ci].length-1)n={k:'c',r:s.r,ci:s.ci,ki:s.ki+1};
    else if(s.k==='c'&&brs.length)n={k:'b',r:s.r,bi:0,ki:Math.min(s.ci,brs[0].cs.length-1)};
    else if(s.r<R.length-1)n=s.k==='o'?{k:'o',r:s.r+1}:first(s.r+1);
  }else if(dir==='up'){
    if(s.k==='c'&&s.ki>0)n={k:'c',r:s.r,ci:s.ci,ki:s.ki-1};
    else if(s.r>0)n=s.k==='o'?{k:'o',r:s.r-1}:first(s.r-1);
  }
  if(!n)return;
  ST.sel=n;applySel();focusSelCell();
}

$('dlgForm').addEventListener('submit',e=>{
  e.preventDefault();
  if(dlgMode==='note'){
    const s=ST.sel;
    if(s&&prog.rungs[s.r]){prog.rungs[s.r].note=cmd.value.trim().slice(0,60);commit(false);}
    dlg.close();return;
  }
  const ok=execCmd(cmd.value);
  if(!ok)return;
  if(dlgMode==='edit'){dlg.close();return;}
  cmd.value='';
  const w=where();
  $('dlgTitle').textContent='명령어 입력'+(w?' · '+w:'');
  cmd.focus();
});
$('dlgCancel').addEventListener('click',()=>dlg.close());
dlg.addEventListener('click',e=>{if(e.target===dlg)dlg.close();});
dlg.addEventListener('close',()=>{
  setEdit(false);cmd.value='';updateCmdHint();
  if(ST.sel)focusSelCell();
});
cmd.addEventListener('keydown',e=>{
  const mod=e.metaKey||e.ctrlKey,cmdMode=dlgMode!=='note';
  if(cmdMode&&!mod&&!e.altKey&&/^Key[A-Z]$/.test(e.code)&&(e.isComposing||e.key==='Process'||/[ㄱ-ㅎㅏ-ㅣ가-힣]/.test(e.key))){
    e.preventDefault();
    cmd.setRangeText(e.code.slice(3),cmd.selectionStart,cmd.selectionEnd,'end');
    return;
  }
  if(cmdMode&&mod&&e.code==='KeyZ'&&!cmd.value.trim()){e.preventDefault();if(e.shiftKey)redo();else undo();return;}
  if(cmdMode&&mod&&e.code==='KeyY'){e.preventDefault();redo();return;}
  if(cmdMode&&(e.key==='ArrowUp'||e.key==='ArrowDown')&&!mod&&!e.altKey&&!e.shiftKey&&cmdHist.length){
    e.preventDefault();
    if(e.key==='ArrowUp')cmdPos=cmdPos<0?cmdHist.length-1:Math.max(0,cmdPos-1);
    else cmdPos=cmdPos<0?-1:(cmdPos+1>=cmdHist.length?-1:cmdPos+1);
    cmd.value=cmdPos<0?'':cmdHist[cmdPos];
  }
});
$('bInput').addEventListener('click',()=>openDlg('add'));
$('bEditSel').addEventListener('click',()=>openDlg('edit'));
$('bDelSel').addEventListener('click',()=>{if(ST.sel)deleteSel();else say('먼저 삭제할 접점이나 코일을 선택하세요.',true);});
document.addEventListener('keydown',e=>{
  const mod=e.metaKey||e.ctrlKey,t=e.target,tag=t&&t.tagName;
  const typing=tag==='INPUT'||tag==='SELECT'||tag==='TEXTAREA';
  if(mod&&e.key==='Enter'){
    e.preventDefault();
    if(dlg.open&&dlgMode==='note')return;
    addRung(ST.sel?ST.sel.r+1:prog.rungs.length);
    return;
  }
  if(typing)return;
  if(mod&&e.code==='KeyZ'){e.preventDefault();if(e.shiftKey)redo();else undo();return;}
  if(mod&&e.code==='KeyY'){e.preventDefault();redo();return;}
  if(dlg.open)return;
  if(mod&&(e.key==='Backspace'||e.key==='Delete')){e.preventDefault();deleteRung();return;}
  if(mod||e.altKey)return;
  const onCell=t&&t.classList&&t.classList.contains('cell');
  if(onCell){
    const dir={ArrowRight:'right',ArrowLeft:'left',ArrowDown:'down',ArrowUp:'up'}[e.key];
    if(dir){e.preventDefault();moveCursor(dir);return;}
    if(e.key==='Enter'&&ST.sel){e.preventDefault();openDlg('edit');return;}
    if(e.key==='Delete'||e.key==='Backspace'){e.preventDefault();deleteSel();return;}
  }
  if((t===document.body||onCell)&&/^Key[A-Z]$/.test(e.code)&&!e.shiftKey){
    e.preventDefault();
    openDlg('add',e.code.slice(3));
  }
});

/* ---------- header controls ---------- */
function setRun(run){
  ST.run=run;
  $('bRun').setAttribute('aria-pressed',run?'true':'false');
  $('bStop').setAttribute('aria-pressed',run?'false':'true');
  $('bStep').disabled=run;
  if(!run){
    for(let i=0;i<GN.Y;i++)ST.bits['Y'+i]=false;
    ST.live=false;
  }
  last=performance.now();
  refresh();
}
$('bRun').addEventListener('click',()=>setRun(true));
$('bStop').addEventListener('click',()=>setRun(false));
$('bStep').addEventListener('click',()=>{if(!ST.run){runScan(100);refresh();}});
$('bReset').addEventListener('click',()=>{
  ST.hold.fill(false);runtimeReset(false);ST.scans=0;
  if(!ST.run){for(let i=0;i<GN.Y;i++)ST.bits['Y'+i]=false;}
  refresh();
});
(function(){
  const sel=$('exSel');
  sel.innerHTML='<option value="">예제 불러오기…</option>'+Object.keys(EXAMPLES).map(id=>`<option value="${id}">${esc(EXAMPLES[id].name)}</option>`).join('');
  sel.addEventListener('change',()=>{
    const id=sel.value;sel.value='';
    if(id&&EXAMPLES[id])askReplace(EXAMPLES[id].name,cloneEx(id));
  });
})();
window.addEventListener('resize',drawChart);

/* ---------- main loop ---------- */
let last=performance.now();
setInterval(()=>{
  const now=performance.now(),dt=Math.min(now-last,250);last=now;
  if(!ST.run)return;
  runScan(dt);refresh();
},50);

/* ---------- init ---------- */
prog=loadSaved()||cloneEx('selfhold');
runtimeReset(false);
commit(false);
})();
