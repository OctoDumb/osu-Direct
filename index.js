const electron = require('electron');
const { app, BrowserWindow, ipcMain: ipc } = electron;
const userData = app.getPath('userData').split('\\').join('/');
const fs = require('fs');
if(!fs.existsSync(`${userData}/cookies.data`)) fs.writeFileSync(`${userData}/cookies.data`, "[]");
var CookieStore = require('tough-cookie-filestore');
const request = require('request').defaults({
    jar: new CookieStore(`${userData}/cookies.data`)
});

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
        mainWindow = new BrowserWindow({width: 800, height: 600, frame: false, icon: __dirname + '/icon.ico', show: false});
        mainWindow.loadFile(fs.existsSync(`${userData}/login.data`) ? 'index.html' : 'login.html');
        mainWindow.on('ready-to-show', () => {
            mainWindow.show();
        });
    });
}

app.on('window-all-closed', () => {
  app.quit();
});

app.on('ready', createWindow);

/* IPC Section */

ipc.on('mainWindowLoaded', (event) => {
    if(loadingWindow) {
        loadingWindow.close();
        loadingWindow = null;
    }
});

ipc.on('login', (event, args) => {
    request.post({
        url: 'https://osu.ppy.sh/forum/ucp.php?mode=login',
        formData: {
            login: "Login",
            username: args.u,
            password: args.p
        }
    }, function(err, res, body) {
        fs.writeFileSync("./test.html", body);
        var incorrect = /You have specified an incorrect/i;
        event.returnValue = !incorrect.test(body);
    });
});