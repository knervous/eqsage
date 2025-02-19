// preload.js
const { contextBridge, ipcRenderer, webUtils, webFrame } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  selectDirectory: () => ipcRenderer.invoke('electron:select-directory'),
  getPath        : file => webUtils.getPathForFile(file),
  setZoomFactor,
});

contextBridge.exposeInMainWorld('electronFS', {
  readFile        : (filePath) => ipcRenderer.invoke('electron:read-file', filePath),
  delete          : (filePath) => ipcRenderer.invoke('electron:delete-file', filePath),
  deleteFolder    : (folderPath) => ipcRenderer.invoke('electron:delete-folder', folderPath),
  readDir         : (filePath) => ipcRenderer.invoke('electron:read-dir', filePath),
  createIfNotExist: (path) => ipcRenderer.invoke('electron:create-dir', path),
  writeFile       : (filePath, data) => ipcRenderer.invoke('electron:write-file', filePath, data),
  // You can add more methods as needed (e.g., listDir, deleteFile, etc.)
});


async function setZoomFactor(zoomFactor) {
  webFrame.setZoomFactor(zoomFactor);
}
