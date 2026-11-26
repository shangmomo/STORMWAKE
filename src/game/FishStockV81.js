// A local, persisted population budget, shared by rod, pots, trawls and streamed shoals.
// Units are abstract catch opportunities, not individual tagged animals.
export const STOCK_CELL=48,STOCK_CAPACITY=24,STOCK_RECOVERY=30;
export class FishStockV81{
 constructor(){this.clock=0;this.cells=new Map();}
 key(x,z){return Number.isFinite(x)&&Number.isFinite(z)&&Math.abs(x)<=20000&&Math.abs(z)<=20000?`${Math.floor(x/STOCK_CELL)},${Math.floor(z/STOCK_CELL)}`:null;}
 advance(dt){if(Number.isFinite(dt)&&dt>0)this.clock+=Math.min(dt,.15);}
 debt(k){const row=this.cells.get(k);if(!row)return 0;const n=Math.max(0,row.debt-(this.clock-row.at)/STOCK_RECOVERY);if(n<=1e-9)this.cells.delete(k);return n;}
 fraction(x,z){const k=this.key(x,z);return k===null?0:Math.max(0,1-this.debt(k)/STOCK_CAPACITY);}
 reserve(x,z){const k=this.key(x,z);if(k===null)return null;const d=this.debt(k);if(d>STOCK_CAPACITY-1+1e-9)return null;if(!this.cells.has(k)&&this.cells.size>=16384){this.toJSON();if(this.cells.size>=16384)return null;}this.cells.set(k,{debt:d+1,at:this.clock});return {k,d};}
 rollback(r){if(!r)return;if(r.d>0)this.cells.set(r.k,{debt:r.d,at:this.clock});else this.cells.delete(r.k);}
 toJSON(){const rows=[];for(const k of this.cells.keys()){const d=this.debt(k);if(d>0)rows.push([k,d]);}return rows;}
 restore(rows){this.clock=0;this.cells.clear();if(!Array.isArray(rows))return;for(const r of rows.slice(0,16384)){if(!Array.isArray(r)||typeof r[0]!=='string'||!/^[-]?\d{1,3},[-]?\d{1,3}$/.test(r[0])||!Number.isFinite(r[1])||r[1]<=0||r[1]>STOCK_CAPACITY)continue;this.cells.set(r[0],{debt:r[1],at:0});}}
}
