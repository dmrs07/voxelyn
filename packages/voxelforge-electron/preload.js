const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('voxelforge', {
  version: '0.1.0',
});

const subscribe = (channel, callback) => {
  const handler = (_event, payload) => callback(payload);
  ipcRenderer.on(channel, handler);
  return () => {
    ipcRenderer.removeListener(channel, handler);
  };
};

contextBridge.exposeInMainWorld('voxelyn', {
  openProjectFolder: () => ipcRenderer.invoke('voxelyn:open-project-folder'),
  openProjectPath: (projectPath) => ipcRenderer.invoke('voxelyn:open-project-path', projectPath),
  selectDirectory: () => ipcRenderer.invoke('voxelyn:select-directory'),
  projectReadFile: (relPath) => ipcRenderer.invoke('voxelyn:project-read-file', relPath),
  projectReadDir: (relPath = '.') => ipcRenderer.invoke('voxelyn:project-read-dir', relPath),
  projectExists: (relPath) => ipcRenderer.invoke('voxelyn:project-exists', relPath),
  projectWriteFile: (relPath, data) => ipcRenderer.invoke('voxelyn:project-write-file', relPath, data),
  projectJoin: (...rel) => ipcRenderer.invoke('voxelyn:project-join', ...rel),
  onProjectOpened: (callback) => subscribe('voxelyn:project-opened', callback),
});

contextBridge.exposeInMainWorld('voxelynDesktop', {
  isDesktop: true,
  runCli: ({ cwd, args }) => ipcRenderer.invoke('cli:run', { cwd, args }),
  cancelCli: ({ runId }) => ipcRenderer.invoke('cli:cancel', { runId }),
  onCliStdout: (callback) => subscribe('cli:stdout', callback),
  onCliStderr: (callback) => subscribe('cli:stderr', callback),
  onCliExit: (callback) => subscribe('cli:exit', callback),
  onCliError: (callback) => subscribe('cli:error', callback),
  onUiCommand: (callback) => subscribe('ui:command', callback),
  openProjectPath: (projectPath) => ipcRenderer.invoke('voxelyn:open-project-path', projectPath),
});
