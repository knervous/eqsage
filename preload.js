// preload.js
const { contextBridge, ipcRenderer, webUtils } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  selectDirectory: () => ipcRenderer.invoke('electron:select-directory'),
  getPath        : file => webUtils.getPathForFile(file),
});

contextBridge.exposeInMainWorld('electronFS', {
  readFile        : (filePath) => ipcRenderer.invoke('electron:read-file', filePath),
  readDir         : (filePath) => ipcRenderer.invoke('electron:read-dir', filePath),
  createIfNotExist: (path) => ipcRenderer.invoke('electron:create-dir', path),
  writeFile       : (filePath, data) => ipcRenderer.invoke('electron:write-file', filePath, data),
  // You can add more methods as needed (e.g., listDir, deleteFile, etc.)
});
