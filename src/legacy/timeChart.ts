import type {Program, RuntimeState} from './model';

type XRole='start'|'stop'|'sensor'|'always'|'custom';
type XScenario={role:XRole;on:string;off:string};
type ChartResult={duration:number;times:number[];values:boolean[][]};
type Dependencies={
  getProgram:()=>Program;
  getSignals:()=>string[];
  setSignals:(signals:string[])=>void;
  state:RuntimeState;
  runScan:(dt:number,dry?:boolean)=>void;
  runtimeReset:(keepX:boolean)=>void;
  snapshot:()=>()=>void;
  refresh:()=>void;
};

const $=(id:string):any=>document.getElementById(id);
const escapeMap:Record<string,string>={'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'};
const esc=(value:unknown):string=>String(value).replace(/[&<>\"]/g,char=>escapeMap[char]||char);

export function createTimeChart({getProgram,getSignals,setSignals,state,runScan,runtimeReset,snapshot,refresh}:Dependencies){
  const SCENARIO_KEY='plc-ladder-chart-scenario-v1';
  const ROLE_NAMES:Record<XRole,string>={start:'시작 버튼',stop:'정지 버튼',sensor:'센서',always:'항상 ON',custom:'직접 설정'};
  let scenarios:Record<string,XScenario>={};
  let chartResult:ChartResult|null=null,chartDirty=true;
  try{scenarios=JSON.parse(localStorage.getItem(SCENARIO_KEY)||'{}')||{};}catch(_){scenarios={};}

  function suggestedRole(address:string):XRole{
    const tag=getProgram().tags[address]||'';
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
  function persistScenarios():void{try{localStorage.setItem(SCENARIO_KEY,JSON.stringify(scenarios));}catch(_){}}
  function buildSignals():void{
    const signals=new Set<string>();
    getProgram().rungs.forEach(rung=>{
      rung.cols.forEach(column=>column.forEach(contact=>signals.add(contact.a)));
      (rung.br||[]).forEach(branch=>branch.cs.forEach(contact=>signals.add(contact.a)));
      if(rung.out)signals.add(rung.out.a);
    });
    const order='XMTCY';
    setSignals([...signals].sort((a,b)=>order.indexOf(a[0])-order.indexOf(b[0])||Number(a.slice(1))-Number(b.slice(1))));
  }
  function scenarioAddresses():string[]{return getSignals().filter(address=>address[0]==='X');}
  function renderScenarioInputs():void{
    const host=$('scenarioInputs'),addresses=scenarioAddresses();
    if(!addresses.length){host.innerHTML='<p class="scenario-head">래더에 X 접점을 추가하면 여기에서 입력 시나리오를 설정할 수 있습니다.</p>';return;}
    addresses.forEach(address=>{if(!scenarios[address])scenarios[address]=roleDefaults(suggestedRole(address));});
    host.innerHTML='<div class="scenario-head"><span>X</span><span>역할</span><span>ON (초)</span><span>OFF (초)</span></div>'+addresses.map(address=>{
      const scenario=scenarios[address];
      return `<label class="scenario-row"><span class="addr">${address}</span><select data-address="${address}" data-field="role" aria-label="${address} 역할">${(['start','stop','sensor','always','custom'] as XRole[]).map(role=>`<option value="${role}" ${scenario.role===role?'selected':''}>${ROLE_NAMES[role]}</option>`).join('')}</select><input data-address="${address}" data-field="on" type="number" min="0" max="60" step="0.1" value="${esc(scenario.on)}" aria-label="${address} ON 시각 초" title="ON 시각(초)"><input data-address="${address}" data-field="off" type="number" min="0" max="60" step="0.1" value="${esc(scenario.off)}" placeholder="끝까지" aria-label="${address} OFF 시각 초" title="OFF 시각(초)"></label>`;
    }).join('');
    persistScenarios();
  }
  function drawChart():void{
    chartDirty=false;
    const canvas=$('cv'),wrap=canvas.parentElement as HTMLElement,signals=getSignals();
    $('chartEmpty').hidden=!!chartResult&&signals.length>0;canvas.hidden=!chartResult||signals.length===0;
    if(!chartResult||!signals.length){
      $('chartEmpty').textContent=signals.length?'X 역할과 ON/OFF 시각을 지정하고 “예상 실행”을 누르세요.':'래더에 X 접점을 추가하면 입력 일정을 설정할 수 있습니다.';
      if(signals.length)$('chartHint').textContent='X 입력 역할과 시간을 설정한 뒤 예상 실행 버튼을 누르세요.';
      return;
    }
    const result=chartResult,dpr=window.devicePixelRatio||1,available=Math.max(280,wrap.clientWidth-28);
    const left=134,right=20,top=32,bottom=30,rowHeight=36,plotWidth=Math.max(700,available-left-right),width=left+plotWidth+right,height=top+signals.length*rowHeight+bottom;
    if(canvas.width!==Math.round(width*dpr)||canvas.height!==Math.round(height*dpr)){
      canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);canvas.style.width=width+'px';canvas.style.height=height+'px';
    }
    canvas.style.touchAction='pan-x pan-y';
    const context=canvas.getContext('2d');if(!context)return;
    context.setTransform(dpr,0,0,dpr,0,0);context.clearRect(0,0,width,height);
    const style=getComputedStyle(document.documentElement),token=(name:string)=>style.getPropertyValue(name).trim();
    const line=token('--line'),ink=token('--ink'),secondary=token('--ink-2');
    const colors:Record<string,string>={X:token('--in'),Y:token('--live'),M:token('--warn'),T:token('--warn'),C:token('--warn')};
    const mono=token('--mono'),sans=token('--sans'),plotY=top,xAt=(time:number)=>left+plotWidth*time/result.duration;
    context.font='400 11px '+mono;context.textAlign='center';context.textBaseline='alphabetic';
    for(let second=0;second<=result.duration;second++){
      const x=Math.round(xAt(second))+.5;context.strokeStyle=line;context.lineWidth=1;context.beginPath();context.moveTo(x,plotY-8);context.lineTo(x,plotY+signals.length*rowHeight);context.stroke();
      context.fillStyle=secondary;context.fillText(`${second}s`,x,plotY+signals.length*rowHeight+18);
    }
    signals.forEach((address,index)=>{
      const y=plotY+index*rowHeight,high=y+8,low=y+rowHeight-8;
      context.strokeStyle=line;context.beginPath();context.moveTo(0,y+rowHeight-.5);context.lineTo(width,y+rowHeight-.5);context.stroke();
      context.textAlign='left';context.fillStyle=ink;context.font='600 12px '+mono;context.fillText(address,8,y+rowHeight/2+4);
      const tag=getProgram().tags[address];if(tag){context.fillStyle=secondary;context.font='400 11px '+sans;context.fillText(tag,43,y+rowHeight/2+4,left-48);}
      context.strokeStyle=colors[address[0]];context.lineWidth=2.5;context.lineJoin='round';context.beginPath();
      result.values.forEach((row,sampleIndex)=>{
        const x=xAt(result.times[sampleIndex]/1000),level=row[index]?high:low;
        if(sampleIndex===0)context.moveTo(x,level);
        else{const previous=result.values[sampleIndex-1][index],previousY=previous?high:low;context.lineTo(x,previousY);if(previous!==row[index])context.lineTo(x,level);}
      });
      context.stroke();
    });
  }
  function drawIfDirty():void{if(chartDirty)drawChart();}
  function invalidateChart():void{
    chartResult=null;chartDirty=true;$('chartHint').textContent='입력 일정 또는 래더가 바뀌었습니다. 타임차트를 다시 예상해 주세요.';refresh();
  }
  function runPrediction():void{
    const duration=Math.min(60,Math.max(1,Number($('simDuration').value)||10));$('simDuration').value=String(duration);
    const addresses=scenarioAddresses(),inputs:Record<string,{on:number;off:number|null}>={};
    for(const address of addresses){
      const scenario=scenarios[address]||roleDefaults(suggestedRole(address));
      const on=Math.min(duration,Math.max(0,Number(scenario.on)||0));
      const off=scenario.off.trim()===''?null:Math.min(duration,Math.max(0,Number(scenario.off)));
      inputs[address]={on,off};
    }
    const restore=snapshot(),step=50,times:number[]=[],values:boolean[][]=[];
    try{
      runtimeReset(false);state.scans=0;state.t=0;
      for(let elapsed=0;elapsed<=duration*1000;elapsed+=step){
        for(const address of addresses){
          const event=inputs[address],isOn=elapsed>=event.on*1000&&(event.off===null||elapsed<event.off*1000);
          state.X[Number(address.slice(1))]=isOn;
        }
        if(elapsed>0)runScan(step,true);else state.xs=state.X.slice();
        times.push(elapsed);values.push(getSignals().map(address=>address[0]==='X'?!!state.xs[Number(address.slice(1))]:!!state.bits[address]));
      }
    }finally{restore();}
    chartResult={duration,times,values};chartDirty=true;
    $('chartHint').textContent=`${duration}초 동안 X 입력 일정대로 50ms 간격으로 래더를 실행한 예상입니다. 입력 X 외의 신호는 초기 OFF 상태에서 시작합니다.`;
    drawChart();
  }
  function programChanged():void{buildSignals();chartResult=null;chartDirty=true;renderScenarioInputs();}

  const scenarioHost=$('scenarioInputs');
  scenarioHost.addEventListener('change',(event:Event)=>{
    const element=event.target as HTMLInputElement|HTMLSelectElement,address=element.dataset.address,field=element.dataset.field;
    if(!address||!field)return;
    if(field==='role')scenarios[address]=roleDefaults(element.value as XRole);
    else scenarios[address]={...(scenarios[address]||roleDefaults(suggestedRole(address))),[field]:element.value};
    persistScenarios();renderScenarioInputs();invalidateChart();
  });
  scenarioHost.addEventListener('input',(event:Event)=>{
    const element=event.target as HTMLInputElement,address=element.dataset.address,field=element.dataset.field;
    if(!address||!field||field==='role')return;
    scenarios[address]={...(scenarios[address]||roleDefaults(suggestedRole(address))),[field]:element.value};persistScenarios();invalidateChart();
  });
  $('simDuration').addEventListener('input',invalidateChart);
  $('bPredict').addEventListener('click',runPrediction);
  const dialog=$('chartDialog');
  $('bChart').addEventListener('click',()=>{if(!dialog.open)dialog.showModal();requestAnimationFrame(drawChart);});
  $('bChartClose').addEventListener('click',()=>dialog.close());
  dialog.addEventListener('click',(event:MouseEvent)=>{if(event.target===dialog)dialog.close();});
  window.addEventListener('resize',drawChart);
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change',drawChart);

  return {buildSignals,renderScenarioInputs,programChanged,drawChart,drawIfDirty};
}
