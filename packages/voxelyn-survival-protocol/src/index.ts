// Protocolo de rede versionado do Voxelyn Survival (co-op PvE).
// JSON versionado, validacao de runtime, e codec de chunk diff para o
// mundo destrutivel. Nenhuma dependencia de rede aqui: apenas tipos e codecs
// puros, testaveis em Node.
export * from './version.js';
export * from './messages.js';
export * from './validate.js';
export * from './chunk-diff.js';
