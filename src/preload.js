const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  getConfig: () => ipcRenderer.invoke("get-config"),
  parsePDF: (buffer) => ipcRenderer.invoke("parsePDF", buffer),
  processImage: (path) => ipcRenderer.invoke("process-image", path),
  highlightCode: (code, language) =>
    ipcRenderer.invoke("highlight-code", code, language),
  ipcRenderer: {
    invoke: (channel, ...args) => ipcRenderer.invoke(channel, ...args),
    on: (channel, listener) => {
      ipcRenderer.on(channel, listener);
      return () => ipcRenderer.removeListener(channel, listener);
    },
    removeListener: (channel, listener) =>
      ipcRenderer.removeListener(channel, listener),
  },
  callAssistant: (params) => ipcRenderer.invoke("callAssistant", params),
  getDesktopSources: () => ipcRenderer.invoke("get-desktop-sources"),
  startDeepgramSTT: (config) =>
    ipcRenderer.invoke("start-deepgram-stt", config),
  sendAudioToDeepgram: (audioData) =>
    ipcRenderer.invoke("send-audio-to-deepgram", audioData),
  stopDeepgramSTT: () => ipcRenderer.invoke("stop-deepgram-stt"),
});
