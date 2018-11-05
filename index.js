const electron = require('electron')
const { app, BrowserWindow } = electron;
app.setAppUserModelId("octoDumb.osuDirect.Desktop.alpha");

let mainWindow;

const shouldQuit = app.makeSingleInstance((argv, workingDirectory) => {
	if(mainWindow) {
		if (mainWindow.isMinimized()) mainWindow.restore();
		mainWindow.focus();
    mainWindow.webContents.executeJavaScript(`donwloadBeatmapset(${argv[1].split("osu://dl/")[1].split("/")[0]}, 'osu!Direct', 'Redirected from osu!')`);
    return true;
	} else {
        createWindow();
        if(fs.existsSync("./loginData.json")) {
            mainWindow.loadFile('search.html');
            setTimeout(() => {
                mainWindow.webContents.executeJavaScript(`donwloadBeatmapset(${argv[1].split("osu://dl/")[1].split("/")[0]}, 'osu!Direct', 'Redirected from osu!')`);
            }, 3000);
        }
        return false;
    };
})


if (shouldQuit) {
    app.quit();
    return;
}

function createWindow() {
	mainWindow = new BrowserWindow({width: 450, height: 300, frame: false, icon: __dirname + '/icon.ico'});
	mainWindow.setResizable(false);
	mainWindow.setFullScreenable(false);
  	mainWindow.loadFile('login.html');

    mainWindow.on('close', function (event) {
        win = null
    })

    mainWindow.on('minimize', function (event) {
        mainWindow.minimize();
    })
}

app.on('window-all-closed', () => {
  app.quit()
})

app.on('ready', createWindow);

app.setAsDefaultProtocolClient("osu");