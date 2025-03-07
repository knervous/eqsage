// electron.js
import {
  app,
  BrowserWindow,
  ipcMain,
  dialog,
  nativeImage,
  screen,
  Menu,
} from 'electron';
import pkg from 'electron-updater';
import path from 'path';
import { fsInterface } from './src/fsInterface.js';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import Store from 'electron-store';

const { autoUpdater } = pkg;
const isMac = process.platform === 'darwin';
const store = new Store();
function createMenu() {
  const menuTemplate = [
    // { role: 'appMenu' }
    ...(isMac
      ? [
        {
          label  : app.name,
          submenu: [
            { role: 'about' },
            { type: 'separator' },
            { role: 'services' },
            { type: 'separator' },
            { role: 'hide' },
            { role: 'hideOthers' },
            { role: 'unhide' },
            { type: 'separator' },
            { role: 'quit' },
          ],
        },
      ]
      : []),
    // { role: 'fileMenu' }
    {
      label  : 'File',
      submenu: [isMac ? { role: 'close' } : { role: 'quit' }],
    },
    {
      label  : 'Auto-Update',
      submenu: [
        {
          label: 'Toggle Auto-Update',
          click: () => {
            const current = store.get('autoUpdateEnabled');
            // Toggle the setting.
            store.set('autoUpdateEnabled', !current);
            const message = !current ? 'Auto update enabled.' : 'Auto update disabled.';
            dialog.showMessageBox({ message });
          }
        },
      ]
    },
    // { role: 'editMenu' }
    {
      label  : 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        ...(isMac
          ? [
            { role: 'pasteAndMatchStyle' },
            { role: 'delete' },
            { role: 'selectAll' },
            { type: 'separator' },
            {
              label  : 'Speech',
              submenu: [{ role: 'startSpeaking' }, { role: 'stopSpeaking' }],
            },
          ]
          : [{ role: 'delete' }, { type: 'separator' }, { role: 'selectAll' }]),
      ],
    },
    // { role: 'viewMenu' }
    {
      label  : 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
      ],
    },
    // { role: 'windowMenu' }
    {
      label  : 'Window',
      submenu: [
        { role: 'minimize' },
        { role: 'zoom' },
        ...(isMac
          ? [
            { type: 'separator' },
            { role: 'front' },
            { type: 'separator' },
            { role: 'window' },
          ]
          : [{ role: 'close' }]),
      ],
    },
    {
      role   : 'help',
      submenu: [
        {
          label: 'Learn More',
          click: async () => {
            const { shell } = require('electron');
            await shell.openExternal('https://electronjs.org');
          },
        },
      ],
    },
  ];

  const menu = Menu.buildFromTemplate(menuTemplate);
  Menu.setApplicationMenu(menu);
}

// Set a default for auto updates if it hasn't been set already.
if (store.get('autoUpdateEnabled') === undefined) {
  store.set('autoUpdateEnabled', true);
}

function shouldCheckForUpdates() {
  return store.get('autoUpdateEnabled');
}

autoUpdater.on('update-available', e => {
  console.log('Update', e);
  const response = dialog.showMessageBoxSync({
    type   : 'info',
    buttons: ['Download', 'Cancel'],
    title  : 'Update Available',
    message: `A new EQ Sage version ${e.version} is available. Do you want to download it?`
  });
  if (response === 0) { // User clicked 'Download'
    autoUpdater.downloadUpdate();
  }
});

autoUpdater.on('update-downloaded', () => {
  const response = dialog.showMessageBoxSync({
    type   : 'info',
    buttons: ['Install and Restart', 'Later'],
    title  : 'Update Ready',
    message: 'Update downloaded. Would you like to install it now?'
  });
  if (response === 0) {
    autoUpdater.quitAndInstall();
  }
});

process.env.NODE_TLS_REJECT_UNAUTHORIZED = 0;

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

app.setName('EQ Sage');
/**
 * @type {BrowserWindow}
 */
let win = null;
function createWindow() {
  console.log('Creating');
  win = new BrowserWindow({
    width : 1024,
    height: 768,
    icon  : path.join(
      __dirname,
      'public',
      process.platform === 'darwin' ? 'favicon.icns' : 'favicon.ico'
    ),
    webPreferences: {
      nodeIntegrationInWorker: true,
      preload                : path.join(__dirname, 'preload.cjs'),
    },
  });
  if (process.env.LOCAL_DEV === 'true') {
    console.log('Loading local dev');
    win.loadURL('http://localhost:4200');
    // win.loadFile(path.join(__dirname, 'build', 'index.html'));
  } else {
    win.loadFile(path.join(__dirname, 'build', 'index.html'));
  }
}

app.whenReady().then(() => {
  if (process.platform === 'darwin') {
    const iconPath = path.join(__dirname, 'public', 'favicon.png');
    const icon = nativeImage.createFromPath(iconPath);
    if (icon.isEmpty()) {
      console.error(`Failed to load image from path '${iconPath}'`);
    } else {
      app.dock.setIcon(icon);
    }
  }

  createWindow();
  createMenu();

  // Prevent auto-download; control downloads manually.
  autoUpdater.autoDownload = false;

  // Check for updates only if the user has enabled auto updates.
  if (shouldCheckForUpdates()) {
    autoUpdater.checkForUpdates();
  } else {
    console.log('User did not want to check for auto updates.');
  }
});

if (process.env.LOCAL_DEV === 'true') {
  // autoUpdater.forceDevUpdateConfig = true;
}

// Quit the app when all windows are closed (except on macOS).
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// (Optional) Re-create a window when the app icon is clicked (macOS).
app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

ipcMain.handle('electron:read-file', async (_event, filePath) => {
  return fsInterface.readFile(filePath);
});
ipcMain.handle('electron:delete-file', async (_event, filePath) => {
  return fsInterface.deleteFile(filePath);
});
ipcMain.handle('electron:delete-folder', async (_event, filePath) => {
  return fsInterface.deleteFolder(filePath);
});
ipcMain.handle('electron:create-dir', async (_event, path) => {
  return fsInterface.createIfNotExist(path);
});
ipcMain.handle('electron:read-dir', async (_event, filePath) => {
  return fsInterface.readDir(filePath);
});
ipcMain.handle('electron:write-file', async (_event, filePath, data) => {
  return fsInterface.writeFile(filePath, data);
});
ipcMain.handle('get-screen-size', () => {
  return screen.getPrimaryDisplay().workAreaSize;
});
ipcMain.handle('electron:select-directory', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openDirectory'],
  });
  if (!result.canceled && result.filePaths.length > 0) {
    return result.filePaths[0];
  }
  return null;
});

ipcMain.handle('electron:proxy', async (_event, url, data) => {
  try {
    console.log('Proxy url', url);
    const [_apiPrefix, path] = url.split('/').filter(Boolean);
    const remoteApi = data.headers?.['x-remote-api'];
    let res = null;
    const handler = (response) => {
      if (response.status >= 400) {
        throw new Error(
          `Error response from server ${remoteApi}}: ${response.status} code`
        );
      }
      return response.text();
    };
    switch (path) {
      case 'login':
      case 'v1':
        if (remoteApi) {
          res = await fetch(`${remoteApi}${url}`, data).then(handler);
        }
        break;
      case 'magelo':
        if (remoteApi) {
          const remotePath = data.headers?.['x-remote-path'];
          res = await fetch(`${remoteApi}${remotePath}`, data).then(handler);
        }
        break;
      default:
        break;
    }
    return res;
  } catch (e) {
    console.log('Error during electron proxy', e);
    win.webContents.send('main-error', e);
    if (e?.cause) {
      win.webContents.send('main-error', e.cause);
    }
  }

  return null;
});
