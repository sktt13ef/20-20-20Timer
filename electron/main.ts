import { app, BrowserWindow, ipcMain, Notification } from "electron";
import path from "node:path";

type WindowState = {
  miniMode: boolean;
  alwaysOnTop: boolean;
};

const NORMAL_SIZE = { width: 980, height: 720 };
const MINI_SIZE = { width: 340, height: 250 };

let mainWindow: BrowserWindow | null = null;
let windowState: WindowState = {
  miniMode: false,
  alwaysOnTop: false
};

function getWindowState(): WindowState {
  return { ...windowState };
}

function publishWindowState() {
  mainWindow?.webContents.send("window:state", getWindowState());
}

function applyWindowState(win: BrowserWindow) {
  win.setAlwaysOnTop(windowState.alwaysOnTop, "screen-saver");
  win.setVisibleOnAllWorkspaces(windowState.alwaysOnTop);

  if (windowState.miniMode) {
    win.setMinimumSize(MINI_SIZE.width, MINI_SIZE.height);
    win.setSize(MINI_SIZE.width, MINI_SIZE.height, true);
  } else {
    win.setMinimumSize(820, 600);
    win.setSize(NORMAL_SIZE.width, NORMAL_SIZE.height, true);
  }
}

function createMainWindow() {
  mainWindow = new BrowserWindow({
    ...NORMAL_SIZE,
    minWidth: 820,
    minHeight: 600,
    title: "20-20-20 护眼计时器",
    autoHideMenuBar: true,
    backgroundColor: "#f5f7f4",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      backgroundThrottling: false
    }
  });

  if (app.isPackaged) {
    void mainWindow.loadFile(path.join(__dirname, "../dist/index.html"));
  } else {
    void mainWindow.loadURL("http://127.0.0.1:5173");
  }

  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  mainWindow.webContents.once("did-finish-load", () => {
    publishWindowState();
  });
}

app.setAppUserModelId("com.local.eye-202020-timer");

app.whenReady().then(() => {
  createMainWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

ipcMain.handle("window:set-mini-mode", (event, enabled: boolean) => {
  const win = BrowserWindow.fromWebContents(event.sender) ?? mainWindow;
  if (!win) {
    return getWindowState();
  }

  windowState = {
    ...windowState,
    miniMode: enabled,
    alwaysOnTop: enabled ? true : windowState.alwaysOnTop
  };

  applyWindowState(win);
  publishWindowState();
  return getWindowState();
});

ipcMain.handle("window:set-always-on-top", (event, enabled: boolean) => {
  const win = BrowserWindow.fromWebContents(event.sender) ?? mainWindow;
  if (!win) {
    return getWindowState();
  }

  windowState = {
    ...windowState,
    alwaysOnTop: enabled
  };

  applyWindowState(win);
  publishWindowState();
  return getWindowState();
});

ipcMain.handle("window:minimize", (event) => {
  BrowserWindow.fromWebContents(event.sender)?.minimize();
});

ipcMain.handle("notification:show", (_event, payload: { title: string; body: string }) => {
  if (!Notification.isSupported()) {
    return false;
  }

  new Notification({
    title: payload.title,
    body: payload.body
  }).show();

  return true;
});
