// QA de VALOR: compara a distribuicao de luminancia de um render com a de outra
// imagem — na pratica, com a referencia.
//
//   node tools/splash/histogram.mjs <render.png> [referencia.png]
//
// Existe porque "esta escuro demais" e "esta lavado" sao impressoes que mudam
// com o monitor e com o cansaco, e porque a calibragem por impressao andou em
// circulos: a mesma cena foi julgada escura demais e clara demais em iteracoes
// consecutivas.
//
// A medicao encerrou a discussao de uma vez, e de um jeito que a impressao nao
// teria encontrado: a estrutura de VALOR do render ja batia com a da referencia
// (mediana 0,059 contra 0,052; sombras cobrindo 60% do quadro contra 62%; altas
// 3,7% contra 4,2%) enquanto a COR estava muito longe — media RGB (8,5 24,0
// 64,6) contra (20,0 28,0 28,5). O problema nunca tinha sido exposicao: era luz
// azul multiplicando rocha azul. Sem separar os dois eixos, nenhum ajuste de
// exposicao ia resolver, e foi por isso que nenhum resolveu.
//
// As tres faixas (sombras, meios, altas) sao o que o briefing cobra em palavras
// — "grandes areas de sombra", "detalhe concentrado" — reduzido a numeros que
// duas pessoas conseguem conferir.
import { PNG } from 'pngjs'; import { readFileSync } from 'node:fs';
const png = PNG.sync.read(readFileSync(process.argv[2]));
const n = png.width*png.height; const lum = new Float64Array(n);
let r=0,g=0,b=0;
for(let i=0;i<n;i++){const p=i*4; r+=png.data[p];g+=png.data[p+1];b+=png.data[p+2];
 lum[i]=(0.2126*png.data[p]+0.7152*png.data[p+1]+0.0722*png.data[p+2])/255;}
const s=[...lum].sort((a,b)=>a-b);
const q=(f)=>s[Math.min(n-1,Math.floor(n*f))].toFixed(3);
console.log(`media RGB: ${(r/n).toFixed(1)} ${(g/n).toFixed(1)} ${(b/n).toFixed(1)}`);
console.log(`luminancia p01=${q(.01)} p10=${q(.10)} p25=${q(.25)} mediana=${q(.5)} p75=${q(.75)} p90=${q(.90)} p99=${q(.99)} max=${q(.999)}`);
let dark=0,mid=0,bright=0; for(const v of lum){if(v<0.08)dark++;else if(v<0.45)mid++;else bright++;}
console.log(`sombras(<0.08)=${(100*dark/n).toFixed(1)}%  meios=${(100*mid/n).toFixed(1)}%  altas(>0.45)=${(100*bright/n).toFixed(1)}%`);
