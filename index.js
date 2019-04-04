const electron = require('electron');
const { app, BrowserWindow, ipcMain: ipc } = electron;
const userData = app.getPath('userData').split('\\').join('/');
const fs = require('fs');
const request = require('request').defaults({
    jar: true,
    headers: {
        'User-Agent': 'osu!direct v2.0.0'
    }
});

var user = fs.existsSync(`${userData}/login.data`) ? 
    JSON.parse(fs.readFileSync(`${userData}/login.data`).toString()) : {};

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

async function login() {
    return new Promise(function(r,j) {
        request.post({
            url: 'https://osu.ppy.sh/forum/ucp.php?mode=login',
            formData: {
                login: "Login",
                username: user.u,
                password: user.p
            }
        }, function(err, res, body) {
            if(err)
                return r(false);
            var incorrect = /You have specified an incorrect/i;
            r(!incorrect.test(body));
        });
    });
}

/* IPC Section */

ipc.on('mainWindowLoaded', (event) => {
    if(loadingWindow) {
        loadingWindow.close();
        loadingWindow = null;
    }
});

ipc.on('login', async (event, args) => {
    user = {
        u: args.u,
        p: args.p
    };
    let logged = await login();
    event.returnValue = logged;
    if(!logged) return;
    fs.writeFileSync(`${userData}/login.data`, JSON.stringify(user));
    createWindow();
    mainWindow.close();
    mainWindow = null;
});