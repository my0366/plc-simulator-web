import type {Contact, Example} from './model';
import {SCAN_COLUMNS} from './model';

const contact=(t:Contact['t'],a:string):Contact=>({t,a});
const inputModes=(overrides:Record<string,'push'|'toggle'>):('push'|'toggle')[]=>{
  const modes:Array<'push'|'toggle'>=Array(8).fill('toggle');
  for(const index in overrides)modes[Number(index)]=overrides[index];
  return modes;
};
const inputWave=(...ranges:[number,number][]):string=>{
  const wave=Array(SCAN_COLUMNS).fill('0');
  for(const [start,end] of ranges)for(let i=start;i<end&&i<SCAN_COLUMNS;i++)wave[i]='1';
  return wave.join('');
};

export const EXAMPLES:Record<string,Example>={
  selfhold:{name:'자기유지 (시작/정지)',tags:{X0:'시작',X1:'정지',Y0:'모터',Y1:'정지등'},xmode:inputModes({0:'push',1:'push'}),rungs:[
    {note:'시작을 눌렀다 놓아도 Y0가 유지되고, 정지를 누르면 꺼집니다',cols:[[contact('NO','X0'),contact('NO','Y0')],[contact('NC','X1')]],out:{t:'OUT',a:'Y0',p:0}},
    {note:'모터가 꺼져 있을 때 정지등 점등',cols:[[contact('NC','Y0')]],out:{t:'OUT',a:'Y1',p:0}}],scn:{step:500,X:{X0:inputWave([4,6],[28,30]),X1:inputWave([20,22])}}},
  interlock:{name:'정/역 인터록',tags:{X0:'정회전',X1:'역회전',X2:'정지',Y0:'정방향',Y1:'역방향'},xmode:inputModes({0:'push',1:'push',2:'push'}),rungs:[
    {note:'정회전: 역방향 출력 중에는 동작하지 않습니다',cols:[[contact('NO','X0'),contact('NO','Y0')],[contact('NC','X2')],[contact('NC','Y1')]],out:{t:'OUT',a:'Y0',p:0}},
    {note:'역회전: 정방향 출력 중에는 동작하지 않습니다',cols:[[contact('NO','X1'),contact('NO','Y1')],[contact('NC','X2')],[contact('NC','Y0')]],out:{t:'OUT',a:'Y1',p:0}}],scn:{step:500,X:{X0:inputWave([4,6],[26,28]),X1:inputWave([18,20],[8,10]),X2:inputWave([14,16],[34,36])}}},
  ondelay:{name:'ON 딜레이 타이머',tags:{X0:'스위치',Y0:'지연출력',Y1:'대기등'},xmode:inputModes({}),rungs:[
    {note:'X0를 켜고 3초가 지나면 T0가 완료됩니다',cols:[[contact('NO','X0')]],out:{t:'TON',a:'T0',p:30}},
    {note:'T0 완료 시 Y0 출력',cols:[[contact('NO','T0')]],out:{t:'OUT',a:'Y0',p:0}},
    {note:'기다리는 동안 대기등 점등',cols:[[contact('NO','X0')],[contact('NC','T0')]],out:{t:'OUT',a:'Y1',p:0}}],scn:{step:500,X:{X0:inputWave([4,24],[28,32])}}},
  flicker:{name:'점멸 회로 (1초 간격)',tags:{X0:'동작',Y0:'점멸등'},xmode:inputModes({}),rungs:[
    {note:'T0: 켜져 있는 1초',cols:[[contact('NO','X0')],[contact('NC','T1')]],out:{t:'TON',a:'T0',p:10}},
    {note:'T1: 꺼져 있는 1초',cols:[[contact('NO','T0')]],out:{t:'TON',a:'T1',p:10}},
    {note:'T0가 끝나기 전까지 점등',cols:[[contact('NO','X0')],[contact('NC','T0')]],out:{t:'OUT',a:'Y0',p:0}}],scn:{step:500,X:{X0:inputWave([2,36])}}},
  counter:{name:'업 카운터 (5회)',tags:{X0:'카운트',X1:'리셋',Y0:'5회 도달'},xmode:inputModes({0:'push',1:'push'}),rungs:[
    {note:'X0를 누를 때마다(OFF→ON) 1씩 증가',cols:[[contact('NO','X0')]],out:{t:'CTU',a:'C0',p:5}},
    {note:'설정 횟수에 도달하면 Y0 출력',cols:[[contact('NO','C0')]],out:{t:'OUT',a:'Y0',p:0}},
    {note:'X1으로 카운터 리셋',cols:[[contact('NO','X1')]],out:{t:'RST',a:'C0',p:0}}],scn:{step:500,X:{X0:inputWave([4,6],[8,10],[12,14],[16,18],[20,22]),X1:inputWave([30,32])}}},
  serpar:{name:'직렬+직렬 병렬 (ORB)',tags:{X0:'A',X1:'B',X2:'C',X3:'D',Y0:'출력'},xmode:inputModes({}),rungs:[
    {note:'(X0 AND X1) 또는 (X2 AND X3)이면 Y0 출력',cols:[[contact('NO','X0')],[contact('NO','X1')]],br:[{to:1,cs:[contact('NO','X2'),contact('NO','X3')]}],out:{t:'OUT',a:'Y0',p:0}}],scn:{step:500,X:{X0:inputWave([4,12]),X1:inputWave([8,16]),X2:inputWave([20,28]),X3:inputWave([24,32])}}},
  empty:{name:'빈 프로그램',tags:{},xmode:inputModes({}),rungs:[],scn:{step:500,X:{}}}
};
