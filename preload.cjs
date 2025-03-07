// preload.js
const { contextBridge, ipcRenderer, webUtils, webFrame } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  onMessage: (callback) => ipcRenderer.on('main-error', callback),
  selectDirectory: () => ipcRenderer.invoke('electron:select-directory'),
  getPath        : file => webUtils.getPathForFile(file).replaceAll('\\', '/'),
  proxyFetch     : async (url, data) => {
    const text = await ipcRenderer.invoke('electron:proxy', url, data).catch(e => {
      console.log('Error during proxy invoke', e);
      return '';
    });
    return {
      async text() {
        return text;
      },
      async json() {
        return JSON.parse(text);
      }
    };
  },
  setZoomFactor,
  hasStandalone() {
    return true;
  }
});

contextBridge.exposeInMainWorld('electronFS', {
  readFile        : (filePath) => ipcRenderer.invoke('electron:read-file', filePath),
  delete          : (filePath) => ipcRenderer.invoke('electron:delete-file', filePath),
  deleteFolder    : (folderPath) => ipcRenderer.invoke('electron:delete-folder', folderPath),
  readDir         : (filePath) => ipcRenderer.invoke('electron:read-dir', filePath),
  createIfNotExist: (path) => ipcRenderer.invoke('electron:create-dir', path),
  writeFile       : (filePath, data) => ipcRenderer.invoke('electron:write-file', filePath, data),
});


async function setZoomFactor(zoomFactor) {
  webFrame.setZoomFactor(zoomFactor);
}
