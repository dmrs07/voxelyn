import { generateWorld, biomeProfile, sectorBiome, sectorSeed, SOLID_NONE, SOLID_ORE, SOLID_CRYSTAL } from '@voxelyn/survival-sim';
const W=96,H=96,MIX=0x9e3779b9;
const [rs,sec]=[Number(process.argv[2]),Number(process.argv[3])];
const b=sectorBiome(rs,sec),p=biomeProfile(b,sec);
const w=generateWorld(sectorSeed((rs^MIX)>>>0,sec),W,H,p);
console.log(`${b.stratum}/${b.occupation} halls=${p.halls} core=(${w.corePos.x},${w.corePos.y}) guardian=(${w.guardianSpawn.x},${w.guardianSpawn.y}) halls=${JSON.stringify(w.hallCenters)}`);
console.log('salvage',JSON.stringify(w.salvageSites));
const ley=new Set(); w.leylines.forEach(s=>s.cells.forEach(c=>ley.add(c)));
const nodes=new Set(w.leylineNodes.map(n=>n.cell));
const x0=Math.max(0,w.corePos.x-26),x1=Math.min(W,w.corePos.x+18),y0=Math.max(0,w.corePos.y-30),y1=Math.min(H,w.corePos.y+8);
console.log(`window x[${x0},${x1}) y[${y0},${y1})`);
console.log('    '+Array.from({length:x1-x0},(_,i)=>String((x0+i)%10)).join(''));
for(let y=y0;y<y1;y++){let r=String(y).padStart(3)+' ';
 for(let x=x0;x<x1;x++){const s=w.solid[y*W+x];
  if(x===w.corePos.x&&y===w.corePos.y)r+='C';
  else if(x===w.guardianSpawn.x&&y===w.guardianSpawn.y)r+='G';
  else if(nodes.has(y*W+x))r+='N'; else if(ley.has(y*W+x))r+='L';
  else r+= s===SOLID_NONE?'.':s===SOLID_ORE?'o':s===SOLID_CRYSTAL?'x':'#';}
 console.log(r);}
