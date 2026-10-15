'use strict';

const { app, BrowserWindow, WebContentsView, ipcMain, session } = require('electron');
const path = require('node:path');

const HOME_URL = `file://${path.join(__dirname, '..', 'index.html')}`;
const tabs = new Map();
let mainWindow;
let activeId = null;

function validId(id) {
  return Number.isInteger(id) && id > 0;
}

function validRemoteUrl(value) {
  if (typeof value !== 'string' || !value.trim()) return null;
  try {
    const url = new URL(value.trim());
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.toString() : null;
  } catch {
    return null;
  }
}

function stateFor(tab, extra = {}) {
  const contents = tab.view.webContents;
  return {
    id: tab.id,
    url: tab.home ? '' : (contents.getURL() || tab.url || ''),
    title: tab.home ? 'New tab' : (contents.getTitle() || tab.title || 'New tab'),
    loading: contents.isLoading(),
    canGoBack: contents.canGoBack(),
    canGoForward: contents.canGoForward(),
    ...extra
  };
}

function sendState(tab, extra) {
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('orbit:state', stateFor(tab, extra));
}

function setTabVisible(tab, visible) {
  if (mainWindow && !mainWindow.isDestroyed()) tab.view.setVisible(Boolean(visible));
}

function wireTab(tab) {
  const contents = tab.view.webContents;
  contents.on('did-start-loading', () => sendState(tab));
  contents.on('did-stop-loading', () => sendState(tab));
  contents.on('did-navigate', (_event, url) => { tab.url = url; sendState(tab); });
  contents.on('did-navigate-in-page', (_event, url) => { tab.url = url; sendState(tab); });
  contents.on('page-title-updated', (_event, title) => { tab.title = title; sendState(tab); });
  contents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL, isMainFrame) => {
    if (isMainFrame && errorCode !== -3) sendState(tab, { error: { code: errorCode, description: errorDescription, url: validatedURL } });
  });
  contents.on('will-navigate', (event, url) => {
    if (!validRemoteUrl(url)) event.preventDefault();
  });
  contents.on('will-redirect', (event, url) => {
    if (!validRemoteUrl(url)) event.preventDefault();
  });
  contents.setWindowOpenHandler(({ url }) => {
    const safeUrl = validRemoteUrl(url);
    if (safeUrl) navigateTab(tab.id, safeUrl);
    return { action: 'deny' };
  });
}

function createTab(id) {
  const view = new WebContentsView({
    webPreferences: {
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      webviewTag: false
    }
  });
  const tab = { id, view, url: '', title: 'New tab', home: true };
  tabs.set(id, tab);
  wireTab(tab);
  view.setVisible(false);
  if (mainWindow) mainWindow.contentView.addChildView(view);
  return tab;
}

function tabFor(id) {
  return validId(id) ? tabs.get(id) : undefined;
}

function navigateTab(id, url) {
  const tab = tabFor(id);
  const safeUrl = validRemoteUrl(url);
  if (!tab || !safeUrl) return false;
  tab.url = safeUrl;
  tab.home = false;
  tab.view.webContents.loadURL(safeUrl).catch(() => {});
  return true;
}

function registerIpc() {
  ipcMain.handle('orbit:navigate', (_event, { id, url } = {}) => navigateTab(id, url));
  ipcMain.handle('orbit:activate', (_event, { id } = {}) => {
    const tab = tabFor(id) || (validId(id) ? createTab(id) : undefined);
    if (!tab) return false;
    if (activeId !== null && tabs.has(activeId)) setTabVisible(tabs.get(activeId), false);
    activeId = id;
    setTabVisible(tab, !tab.home);
    sendState(tab);
    return true;
  });
  ipcMain.handle('orbit:close', (_event, { id } = {}) => {
    const tab = tabFor(id);
    if (!tab) return false;
    mainWindow.contentView.removeChildView(tab.view);
    tab.view.webContents.close();
    tabs.delete(id);
    if (activeId === id) activeId = null;
    return true;
  });
  ipcMain.handle('orbit:home', (_event, { id } = {}) => {
    const tab = tabFor(id);
    if (!tab) return false;
    tab.url = '';
    tab.title = 'New tab';
    tab.home = true;
    setTabVisible(tab, false);
    sendState(tab);
    return true;
  });
  ipcMain.handle('orbit:back', (_event, { id } = {}) => { const tab = tabFor(id); if (!tab || !tab.view.webContents.canGoBack()) return false; tab.view.webContents.goBack(); return true; });
  ipcMain.handle('orbit:forward', (_event, { id } = {}) => { const tab = tabFor(id); if (!tab || !tab.view.webContents.canGoForward()) return false; tab.view.webContents.goForward(); return true; });
  ipcMain.handle('orbit:reload', (_event, { id } = {}) => { const tab = tabFor(id); if (!tab) return false; tab.view.webContents.reload(); return true; });
  ipcMain.handle('orbit:set-bounds', (_event, bounds = {}) => {
    const tab = activeId === null ? undefined : tabs.get(activeId);
    if (!tab) return false;
    const numbers = ['x', 'y', 'width', 'height'].map((key) => Number(bounds[key]));
    if (numbers.some((value) => !Number.isFinite(value)) || numbers[2] < 0 || numbers[3] < 0) return false;
    tab.view.setBounds({ x: numbers[0], y: numbers[1], width: numbers[2], height: numbers[3] });
    return true;
  });
  ipcMain.handle('orbit:set-visible', (_event, visible) => {
    const tab = activeId === null ? undefined : tabs.get(activeId);
    if (!tab) return false;
    setTabVisible(tab, visible);
    return true;
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({ webPreferences: { preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, sandbox: true, nodeIntegration: false } });
  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (url !== HOME_URL) event.preventDefault();
  });
  mainWindow.loadURL(HOME_URL);
  createTab(1);
  activeId = 1;
}

app.whenReady().then(() => {
  session.defaultSession.setPermissionRequestHandler((_webContents, _permission, callback) => callback(false));
  session.defaultSession.setPermissionCheckHandler(() => false);
  session.defaultSession.setDisplayMediaRequestHandler((_request, callback) => callback());
  app.on('web-contents-created', (_event, contents) => contents.on('will-attach-webview', (event) => event.preventDefault()));
  registerIpc();
  createWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
