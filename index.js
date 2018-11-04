const electron = require('electron')
const { ipcMain, app, Menu, Tray, BrowserWindow } = electron;
app.setAppUserModelId("octoDumb.osuDirect.Desktop.alpha");

let mainWindow;

let appIcon;

function createWindow() {
	mainWindow = new BrowserWindow({width: 450, height: 300, frame: false, icon: __dirname + '/icon.ico'});
	mainWindow.setResizable(false);
	mainWindow.setFullScreenable(false);
    mainWindow.loadFile('login.html');

    mainWindow.on('close', function (event) {
        win = null
    })

    mainWindow.on('minimize', function (event) {
		mainWindow.hide();
    })
}

app.on('window-all-closed', () => {
  app.quit()
})

app.on('ready', createWindow);