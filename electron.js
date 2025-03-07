// electron.js
import {
  app,
  BrowserWindow,
  ipcMain,
  dialog,
  nativeImage,
  screen,
} from "electron";
import pkg from "electron-updater";
import path from "path";
import { fsInterface } from "./src/fsInterface.js";
import { fileURLToPath } from "url";
import { dirname } from "path";

const { autoUpdater } = pkg;

process.env.NODE_TLS_REJECT_UNAUTHORIZED = 0;

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

app.setName("EQ Sage");
/**
 * @type {BrowserWindow}
 */
let win = null;
function createWindow() {
  console.log("Creating");
  win = new BrowserWindow({
    width: 1024,
    height: 768,
    icon: path.join(
      __dirname,
      "public",
      process.platform === "darwin" ? "favicon.icns" : "favicon.ico"
    ),
    webPreferences: {
      nodeIntegrationInWorker: true,
      preload: path.join(__dirname, "preload.cjs"),
    },
  });
  if (process.env.LOCAL_DEV === "true") {
    console.log("Loading local dev");
    // win.loadURL("http://localhost:4200");
    win.loadFile(path.join(__dirname, 'build', 'index.html'));
  } else {
    win.loadFile(path.join(__dirname, "build", "index.html"));
  }
}

app.whenReady().then(() => {
  if (process.platform === "darwin") {
    const iconPath = path.join(__dirname, "public", "favicon.png");
    const icon = nativeImage.createFromPath(iconPath);
    if (icon.isEmpty()) {
      console.error(`Failed to load image from path '${iconPath}'`);
    } else {
      app.dock.setIcon(icon);
    }
  }

  createWindow();
});

// if (process.env.LOCAL_DEV === 'true') {
//   autoUpdater.forceDevUpdateConfig = true;
// }

autoUpdater.checkForUpdatesAndNotify();

// Quit the app when all windows are closed (except on macOS).
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

// (Optional) Re-create a window when the app icon is clicked (macOS).
app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

ipcMain.handle("electron:read-file", async (_event, filePath) => {
  return fsInterface.readFile(filePath);
});
ipcMain.handle("electron:delete-file", async (_event, filePath) => {
  return fsInterface.deleteFile(filePath);
});
ipcMain.handle("electron:delete-folder", async (_event, filePath) => {
  return fsInterface.deleteFolder(filePath);
});
ipcMain.handle("electron:create-dir", async (_event, path) => {
  return fsInterface.createIfNotExist(path);
});
ipcMain.handle("electron:read-dir", async (_event, filePath) => {
  return fsInterface.readDir(filePath);
});
ipcMain.handle("electron:write-file", async (_event, filePath, data) => {
  return fsInterface.writeFile(filePath, data);
});
ipcMain.handle("get-screen-size", () => {
  return screen.getPrimaryDisplay().workAreaSize;
});
ipcMain.handle("electron:select-directory", async () => {
  const result = await dialog.showOpenDialog({
    properties: ["openDirectory"],
  });
  if (!result.canceled && result.filePaths.length > 0) {
    return result.filePaths[0];
  }
  return null;
});

ipcMain.handle("electron:proxy", async (_event, url, data) => {
  try {
    console.log("Proxy url", url);
    const [_apiPrefix, path] = url.split("/").filter(Boolean);
    const remoteApi = data.headers?.["x-remote-api"];
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
      case "login":
      case "v1":
        if (remoteApi) {
          res = await fetch(`${remoteApi}${url}`, data).then(handler);
        }
        break;
      case "magelo":
        if (remoteApi) {
          const remotePath = data.headers?.["x-remote-path"];
          res = await fetch(`${remoteApi}${remotePath}`, data).then(handler);
        }
        break;
      default:
        break;
    }
    return res;
  } catch (e) {
    console.log("Error during electron proxy", e);
    win.webContents.send("main-error", e);
    if (e?.cause) {
      win.webContents.send("main-error", e.cause);
    }
  }

  return null;
});
