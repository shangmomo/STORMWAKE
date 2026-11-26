// Wall-clock intervals, not simulation dt. Bounded samples; no GPU dependency.
export class FrameTiming {
 constructor(){this.samples=[];this.elapsed=0;this.total=0;this.longFrames=0;this.worstMs=0;}
 record(seconds){if(!Number.isFinite(seconds)||seconds<=0)return false;const ms=seconds*1000;this.samples.push(ms);this.elapsed+=seconds;this.total++;if(ms>=50)this.longFrames++;this.worstMs=Math.max(this.worstMs,ms);return true;}
 window(){if(this.elapsed<.5&&this.samples.length<240)return null;const sorted=this.samples.slice().sort((a,b)=>a-b),n=sorted.length;const pick=p=>sorted[Math.min(n-1,Math.ceil(n*p)-1)];const result={fps:n/this.elapsed,meanMs:this.elapsed*1000/n,p50Ms:pick(.5),p95Ms:pick(.95),p99Ms:pick(.99),maxMs:sorted[n-1],samples:n,totalFrames:this.total,longFrames:this.longFrames,sessionWorstMs:this.worstMs};this.samples.length=0;this.elapsed=0;return result;}
}
