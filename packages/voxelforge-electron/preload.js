const { contextBridge } = require('electron');

contextBridge.exposeInMainWorld('voxelforge', {
  version: '0.1.0',
});
