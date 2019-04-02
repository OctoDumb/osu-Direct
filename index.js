const electron = require('electron');
const { app, BrowserWindow } = electron;
app.setAppUserModelId("octoDumb.osuDirect.Desktop"); // Dunno why but ok i'll leave it here

let mainWindow, loadingWindow;

const singleLocked = app.requestSingleInstanceLock();

if(!singleLocked) {
    app.quit();
} else {
    app.on('second-instance', () => {
        if(mainWindow | loadingWindow) {
            if(mainWindow.isMinimized()) mainWindow.restore();
            mainWindow.focus();
        }
    });
}

function createWindow() {
	loadingWindow = new BrowserWindow({width: 300, height: 450, transparent: true, frame: false, icon: __dirname + '/icon.ico', resizable: false, fullscreenable: false, show: false});
    loadingWindow.loadFile('loading.html');
    loadingWindow.on('ready-to-show', () => {
        loadingWindow.show();
    });
}

app.on('window-all-closed', () => {
  app.quit();
});

app.on('ready', createWindow);