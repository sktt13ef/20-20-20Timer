export type WindowState = {
  miniMode: boolean;
  alwaysOnTop: boolean;
};

export type NotificationPayload = {
  title: string;
  body: string;
};

export type EyeTimerBridge = {
  setMiniMode(enabled: boolean): Promise<WindowState>;
  setAlwaysOnTop(enabled: boolean): Promise<WindowState>;
  minimize(): Promise<void>;
  showNotification(payload: NotificationPayload): Promise<boolean>;
  onWindowState(callback: (state: WindowState) => void): () => void;
};

declare global {
  interface Window {
    eyeTimer?: EyeTimerBridge;
  }
}
