// Imports de assets do catalogo via alias @atlases (?url emite o arquivo no
// bundle e devolve a URL final, que o service worker precacheia).
declare module '@atlases/*?url' {
  const url: string;
  export default url;
}
