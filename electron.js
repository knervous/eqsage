// electron.js
import { app, BrowserWindow, ipcMain, dialog, nativeImage, screen } from 'electron';
import path from 'path';
import { fsInterface } from './src/fsInterface.js';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

app.setName('EQ Sage');

function createWindow() {
  console.log('Creating');
  const win = new BrowserWindow({
    width         : 1024,
    height        : 768,
    icon          : path.join(__dirname, 'public', process.platform === 'darwin' ? 'favicon.icns' : 'favicon.ico'),
    webPreferences: {
      nodeIntegrationInWorker: true,
      preload                : path.join(__dirname, 'preload.cjs'),
    },
  });
  if (process.env.LOCAL_DEV === 'true') {
    console.log('Loading local dev');
    win.loadURL('http://localhost:4200');
  } else {
    win.loadURL('https://eqsage.vercel.app');
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
});

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
