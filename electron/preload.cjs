'use strict';

const { contextBridge, ipcRenderer } = require('electron');

const invoke = (channel, value) => ipcRenderer.invoke(channel, value);

contextBridge.exposeInMainWorld('orbit', {
  navigate: ({ id, url } = {}) => invoke('orbit:navigate', { id, url }),
  activate: (id) => invoke('orbit:activate', { id }),
  close: (id) => invoke('orbit:close', { id }),
  home: (id) => invoke('orbit:home', { id }),
  back: (id) => invoke('orbit:back', { id }),
  forward: (id) => invoke('orbit:forward', { id }),
  reload: (id) => invoke('orbit:reload', { id }),
  setBounds: ({ x, y, width, height } = {}) => invoke('orbit:set-bounds', { x, y, width, height }),
  setVisible: (visible) => invoke('orbit:set-visible', Boolean(visible)),
  onState: (callback) => {
    if (typeof callback !== 'function') return () => {};
    const listener = (_event, state) => callback(state);
    ipcRenderer.on('orbit:state', listener);
    return () => ipcRenderer.removeListener('orbit:state', listener);
  }
});
