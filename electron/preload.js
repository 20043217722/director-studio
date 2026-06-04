const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  saveFile: (opts) => ipcRenderer.invoke("save-file", opts),
  onUpdateStatus: (cb) => ipcRenderer.on("update-status", (_, msg) => cb(msg)),
});
