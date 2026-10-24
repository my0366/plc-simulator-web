export type Contact={t:'NO'|'NC';a:string;_v?:boolean};
export type Output={t:'OUT'|'SET'|'RST'|'TON'|'CTU';a:string;p:number};
export type Branch={to:number;cs:Contact[];_v?:boolean;_in?:boolean[]};
export type Rung={note:string;cols:Contact[][];br?:Branch[];out?:Output|null;_prev?:boolean;_e?:boolean[];_eo?:boolean[];_cond?:boolean;_ui?:any};
export type ScanConfig={step:number;X:Record<string,string>};
export type Program={rungs:Rung[];tags:Record<string,string>;xmode:('push'|'toggle')[];scn:ScanConfig};
export type Selection={k:'c';r:number;ci:number;ki:number}|{k:'b';r:number;bi:number;ki:number}|{k:'o';r:number}|null;
export type RuntimeState={run:boolean;live:boolean;scans:number;t:number;X:boolean[];xs:boolean[];bits:Record<string,boolean>;acc:Record<string,number>;cnt:Record<string,number>;sel:Selection;pt:number[];hold:boolean[]};
export type Example={name:string;tags:Record<string,string>;xmode:('push'|'toggle')[];rungs:Rung[];scn:ScanConfig};

export const GROUPS=[['X','입력',8],['Y','출력',16],['M','내부 릴레이',16],['T','타이머',16],['C','카운터',16]] as const;
export const ADDRESS_COUNTS:Record<string,number>={X:8,Y:16,M:16,T:16,C:16};
export const OUTPUT_TYPES:Record<string,string>={OUT:'YM',SET:'YM',RST:'YMTC',TON:'T',CTU:'C'};
export const MAX_RUNG_COUNT=40;
export const SCAN_COLUMNS=40;
