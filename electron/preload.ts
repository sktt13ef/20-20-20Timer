import { contextBridge, ipcRenderer } from "electron";

type WindowState = {
  miniMode: boolean;
  alwaysOnTop: boolean;
};

type NotificationPayload = {
  title: string;
  body: string;
};

contextBridge.exposeInMainWorld("eyeTimer", {
  setMiniMode(enabled: boolean): Promise<WindowState> {
    return ipcRenderer.invoke("window:set-mini-mode", enabled);
  },
  setAlwaysOnTop(enabled: boolean): Promise<WindowState> {
    return ipcRenderer.invoke("window:set-always-on-top", enabled);
  },
  minimize(): Promise<void> {
    return ipcRenderer.invoke("window:minimize");
  },
  showNotification(payload: NotificationPayload): Promise<boolean> {
    return ipcRenderer.invoke("notification:show", payload);
  },
  onWindowState(callback: (state: WindowState) => void): () => void {
    const listener = (_event: Electron.IpcRendererEvent, state: WindowState) => {
      callback(state);
    };

    ipcRenderer.on("window:state", listener);
    return () => {
      ipcRenderer.removeListener("window:state", listener);
    };
  }
});
