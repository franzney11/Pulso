'use strict';
// Puente seguro entre la interfaz (renderer) y el proceso principal.
// La interfaz no tiene acceso a Node: solo puede llamar a estas funciones.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('pulso', {
  platform: process.platform,
  getState: () => ipcRenderer.invoke('pulso:get-state'),
  rescan: () => ipcRenderer.invoke('pulso:rescan'),
  saveProfile: (profile) => ipcRenderer.invoke('pulso:save-profile', profile),
  checkDrivers: () => ipcRenderer.invoke('pulso:check-drivers'),
  openExternal: (url) => ipcRenderer.invoke('pulso:open-external', url),
  exportReport: () => ipcRenderer.invoke('pulso:export-report'),
  onTick: (callback) => {
    const handler = (_event, payload) => callback(payload);
    ipcRenderer.on('pulso:tick', handler);
    return () => ipcRenderer.removeListener('pulso:tick', handler);
  },
});
