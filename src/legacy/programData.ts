import type {Branch, Contact, Example, Output, Program, Rung} from './model';
import {ADDRESS_COUNTS, MAX_RUNG_COUNT, OUTPUT_TYPES, SCAN_COLUMNS} from './model';

/** Validate and normalize saved or imported ladder data before it enters the runtime. */
export function validateProgram(value:any):Program|null{
  if(!value||!Array.isArray(value.rungs)||value.rungs.length>MAX_RUNG_COUNT)return null;
  const isAddress=(address:any):boolean=>typeof address==='string'&&/^[XYMTC]\d+$/.test(address)&&Number(address.slice(1))<ADDRESS_COUNTS[address[0]];
  const rungs:Rung[]=[];
  for(const source of value.rungs){
    if(!source||!Array.isArray(source.cols)||source.cols.length>6)return null;
    const columns:Contact[][]=[];
    for(const column of source.cols){
      if(!Array.isArray(column)||!column.length||column.length>4)return null;
      const contacts:Contact[]=[];
      for(const contact of column){
        if(!contact||(contact.t!=='NO'&&contact.t!=='NC')||!isAddress(contact.a))return null;
        contacts.push({t:contact.t,a:contact.a});
      }
      columns.push(contacts);
    }
    const branches:Branch[]=[];
    if(Array.isArray(source.br)&&columns.length){
      if(source.br.length>4)return null;
      for(const branch of source.br){
        if(!branch||!Array.isArray(branch.cs)||!branch.cs.length||branch.cs.length>6)return null;
        const contacts:Contact[]=[];
        for(const contact of branch.cs){
          if(!contact||(contact.t!=='NO'&&contact.t!=='NC')||!isAddress(contact.a))return null;
          contacts.push({t:contact.t,a:contact.a});
        }
        branches.push({to:Math.max(0,Math.min(columns.length-1,parseInt(branch.to,10)||0)),cs:contacts});
      }
    }
    let output:Output|null=null;
    if(source.out){
      const candidate=source.out;
      if(!OUTPUT_TYPES[candidate.t]||!isAddress(candidate.a)||!OUTPUT_TYPES[candidate.t].includes(candidate.a[0]))return null;
      output={t:candidate.t,a:candidate.a,p:Math.max(0,Math.min(36000,parseInt(candidate.p,10)||0))};
    }
    rungs.push({note:String(source.note||'').slice(0,60),cols:columns,br:branches,out:output} as Rung);
  }
  const tags:Record<string,string>={};
  if(value.tags&&typeof value.tags==='object')for(const address in value.tags)if(isAddress(address))tags[address]=String(value.tags[address]).slice(0,8);
  const xmode=Array.from({length:8},(_,index)=>(value.xmode&&value.xmode[index]==='push'?'push':'toggle') as 'push'|'toggle');
  const scn={step:500,X:{} as Record<string,string>};
  if(value.scn&&typeof value.scn==='object'){
    if([100,200,500,1000].includes(+value.scn.step))scn.step=+value.scn.step;
    if(value.scn.X&&typeof value.scn.X==='object')for(const address in value.scn.X){
      if(/^X[0-7]$/.test(address)&&typeof value.scn.X[address]==='string')scn.X[address]=value.scn.X[address].replace(/[^01]/g,'0').padEnd(SCAN_COLUMNS,'0').slice(0,SCAN_COLUMNS);
    }
  }
  return {rungs,tags,xmode,scn};
}

export function cloneExample(example:Example):Program|null{
  return validateProgram(JSON.parse(JSON.stringify({rungs:example.rungs,tags:example.tags,xmode:example.xmode,scn:example.scn})));
}
