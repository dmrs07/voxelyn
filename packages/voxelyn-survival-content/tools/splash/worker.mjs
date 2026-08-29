// Um processo de render. Recebe a cena e os buffers em memoria compartilhada e
// preenche as faixas de linhas que o coordenador manda.
//
// O trabalho e distribuido por DEMANDA, e nao dividido em partes iguais de
// antemao: o custo por linha varia muito (uma faixa cheia de rocha proxima gasta
// poucos passos por raio; uma que atravessa a arena aberta ate o fundo gasta
// centenas), e uma divisao fixa deixaria metade dos processos ociosos esperando
// a faixa mais cara. Pedindo a proxima faixa ao terminar, todos param juntos.
import { parentPort, workerData } from 'node:worker_threads';
import { renderBand } from './render.mjs';

const { sceneData, cam, lights, buffers, samples } = workerData;

parentPort.postMessage('ready');
parentPort.on('message', (msg) => {
  if (msg.done) {
    parentPort.postMessage('finished');
    return;
  }
  const [start, end] = msg.band;
  renderBand(sceneData, cam, lights, buffers, start, end, { samples });
  parentPort.postMessage('band');
});
