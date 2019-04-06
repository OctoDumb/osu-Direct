const electron = require('electron');
const { app, BrowserWindow, ipcMain: ipc, Tray } = electron;
const userData = app.getPath('userData').split('\\').join('/');
const fs = require('fs');
const querystring = require('querystring');
const request = require('request').defaults({
    jar: true,
    headers: {
        'User-Agent': 'osu!direct v2.0.0'
    }
});

var user = fs.existsSync(`${userData}/login.data`) ? 
    JSON.parse(fs.readFileSync(`${userData}/login.data`).toString()) : {};

app.setAppUserModelId("octoDumb.osuDirect.Desktop"); // Dunno why but ok i'll leave it here

/**
 * @type {BrowserWindow}
 */
let mainWindow;
/**
 * @type {BrowserWindow}
 */
let loadingWindow;
/**
 * @type {Tray}
 */
let tray;

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
    loadingWindow.on('ready-to-show', async () => {
        loadingWindow.show();
        let logged = await login();
        if(!logged) {
            fs.unlinkSync(`${userData}/login.data`);
        }
        mainWindow = new BrowserWindow({width: 800, height: 600, frame: false, icon: __dirname + '/icon.ico', show: false});
        mainWindow.loadFile(fs.existsSync(`${userData}/login.data`) ? fs.existsSync(`${userData}/settings.data`) ? 'index.html' : 'setup.html' : 'login.html');
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

async function req(url) {
    return new Promise(function(r,j) {
        request.get(url, function(err, res, body) {
            if(err)
                j(err);
            else
                r(body);
        });
    });
}

/* IPC Section */

ipc.on('mainWindowLoaded', () => {
    if(loadingWindow) {
        loadingWindow.close();
        loadingWindow = null;
    }
});

ipc.on('tray', () => {
    mainWindow.hide();
    tray = new Tray(__dirname + "/icon.ico");
    tray.displayBalloon({
        title: "osu!Direct is now hidden",
        content: "To open it again, click on its icon in tray",
        silent: true
    });
    tray.setToolTip("Click to open osu!Direct");
    tray.on('click', () => {
        mainWindow.show();
        tray.destroy();
    });
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

ipc.on('setup', async (event, args) => {
    if(args.useToken) {
        let tokenRegExp = /[^0-9a-f]/;
        if(tokenRegExp.test(args.token) | args.token.length != 40)
            return event.sender.send('setup-err', "Incorrect token");
        let checkToken = JSON.parse(await req(`https://osu.ppy.sh/api/get_user?u=${user.u}&k=${args.token}`));
        if(checkToken.error)
            return event.sender.send('setup-err', "Incorrect token");
    }
    if(!fs.existsSync(`${args.osu}/Songs`))
        return event.sender.send('setup-err', "Invalid osu! folder");
    fs.writeFileSync(`${userData}/settings.data`, JSON.stringify(args));
    createWindow();
    mainWindow.close();
    mainWindow = null;
    // let checkToken = await req(`https://osu.ppy.sh/api/get_user?u=${user.u}&k=${args.token}`);
    // fs.writeFileSync(`${userData}/settings.data`, JSON.stringify(args));
    // createWindow();
    // mainWindow.close();
    // mainWindow = null;
});

ipc.on('search', async (event, args) => {
    try {
        let q = await req(`https://osu.ppy.sh/beatmapsets/search?${querystring.stringify(args[0])}`);
        event.sender.send('search-result', {done: true, object: JSON.parse(q), next: args[1]});
    } catch(e) {
        event.sender.send('search-result', {done: false, object: e.toString()});
    }
});

ipc.on('fav', (event, args) => {
    event.sender.send('err', 'Favouriting is not implemented yet');
});

ipc.on('dl', (event, args) => {
    event.sender.send('err', 'Downloading is not implemented yet');
});