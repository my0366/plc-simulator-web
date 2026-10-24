import type {Program, Rung, RuntimeState} from './model';

/** Runtime for one PLC scan cycle. UI code owns the program and state objects. */
export function createLadderEngine(getProgram:()=>Program,state:RuntimeState,getSignals:()=>string[]){
  let history:{t:number;n:number;b:boolean[]}[]=[];

  function read(address:string):boolean{
    const group=address[0],index=Number(address.slice(1));
    if(group==='X')return !!state.xs[index];
    return !!state.bits[address];
  }

  function applyOutput(rung:Rung,dt:number):void{
    const output=rung.out;if(!output)return;
    const address=output.a,condition=!!rung._cond;
    switch(output.t){
      case 'OUT':state.bits[address]=condition;break;
      case 'SET':if(condition)state.bits[address]=true;break;
      case 'RST':if(condition){state.bits[address]=false;if(address[0]==='C')state.cnt[address]=0;if(address[0]==='T')state.acc[address]=0;}break;
      case 'TON':{
        const limit=output.p*100;
        if(condition)state.acc[address]=Math.min((state.acc[address]||0)+dt,limit);
        else state.acc[address]=0;
        state.bits[address]=condition&&state.acc[address]>=limit;
        break;
      }
      case 'CTU':
        if(condition&&!rung._prev)state.cnt[address]=Math.min((state.cnt[address]||0)+1,9999);
        state.bits[address]=(state.cnt[address]||0)>=output.p;rung._prev=condition;
        break;
    }
  }

  function sample():void{
    const signals=getSignals();if(!signals.length)return;
    history.push({t:state.t,n:state.scans,b:signals.map(read)});
    while(history.length>240)history.shift();
  }

  function runScan(dt:number,dry=false,trace?:(rungIndex:number)=>void):void{
    const program=getProgram();
    state.xs=state.X.slice();state.scans++;
    for(const [rungIndex,rung] of program.rungs.entries()){
      let energized=true;rung._e=[];rung._eo=[];
      rung.cols.forEach((column,columnIndex)=>{
        rung._e![columnIndex]=energized;
        let any=false;
        for(const contact of column){
          const value=read(contact.a);contact._v=contact.t==='NC'?!value:value;
          if(contact._v)any=true;
        }
        energized=energized&&any;
        if(rung.br)for(const branch of rung.br){
          if(branch.to!==columnIndex)continue;
          let value=true;const branchInputs:boolean[]=[];branch._in=branchInputs;
          for(const contact of branch.cs){
            branchInputs.push(value);const signal=read(contact.a);
            contact._v=contact.t==='NC'?!signal:signal;value=value&&!!contact._v;
          }
          branch._v=value;energized=energized||value;
        }
        rung._eo![columnIndex]=energized;
      });
      rung._cond=energized;applyOutput(rung,dt);trace?.(rungIndex);
    }
    state.t+=dt;state.live=true;
    if(!dry)sample();
  }

  function runtimeReset(keepX:boolean):void{
    const program=getProgram();
    state.bits={};state.acc={};state.cnt={};state.t=0;state.live=false;history=[];
    if(!keepX){state.X.fill(false);state.xs.fill(false);}
    for(const rung of program.rungs){
      rung._prev=false;rung._e=undefined;rung._eo=undefined;rung._cond=false;
      for(const column of rung.cols)for(const contact of column)contact._v=false;
      for(const branch of (rung.br||[])){branch._v=false;branch._in=[];for(const contact of branch.cs)contact._v=false;}
    }
  }

  function snapshot(){
    const program=getProgram();
    const saved={bits:{...state.bits},acc:{...state.acc},cnt:{...state.cnt},xs:state.xs.slice(),X:state.X.slice(),t:state.t,scans:state.scans,live:state.live,history:history.slice()};
    const rungState=program.rungs.map(rung=>({prev:rung._prev,e:rung._e,eo:rung._eo,cond:rung._cond,
      contacts:rung.cols.map(column=>column.map(contact=>contact._v)),
      branches:(rung.br||[]).map(branch=>({v:branch._v,inputs:branch._in,contacts:branch.cs.map(contact=>contact._v)}))}));
    return function restore():void{
      state.bits=saved.bits;state.acc=saved.acc;state.cnt=saved.cnt;state.xs=saved.xs;state.t=saved.t;state.scans=saved.scans;state.live=saved.live;
      history=saved.history;for(let i=0;i<state.X.length;i++)state.X[i]=saved.X[i];
      program.rungs.forEach((rung,index)=>{
        const savedRung=rungState[index];rung._prev=savedRung.prev;rung._e=savedRung.e;rung._eo=savedRung.eo;rung._cond=savedRung.cond;
        rung.cols.forEach((column,columnIndex)=>column.forEach((contact,contactIndex)=>{contact._v=savedRung.contacts[columnIndex][contactIndex];}));
        (rung.br||[]).forEach((branch,branchIndex)=>{
          const savedBranch=savedRung.branches[branchIndex];branch._v=savedBranch.v;branch._in=savedBranch.inputs;
          branch.cs.forEach((contact,contactIndex)=>{contact._v=savedBranch.contacts[contactIndex];});
        });
      });
    };
  }

  return {read,runScan,runtimeReset,snapshot};
}
