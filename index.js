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
const progress = require('request-progress');

var phantom = require('phantom');

var user = fs.existsSync(`${userData}/login.data`) ? 
    JSON.parse(fs.readFileSync(`${userData}/login.data`).toString()) : {};

var settings = fs.existsSync(`${userData}/settings.data`) ?
    JSON.parse(fs.readFileSync(`${userData}/settings.data`).toString()) : {};

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
        if(fs.existsSync(`${userData}/login.data`)) {
            let logged = await login();
            if(!logged) {
                fs.unlinkSync(`${userData}/login.data`);
            }
        }
        if(settings.osu) {
            if(!fs.existsSync(`${settings.osu}/DirectTemp`)) {
                fs.mkdirSync(`${settings.osu}/DirectTemp`);
            } else {
                fs.readdirSync(`${settings.osu}/DirectTemp`).forEach(file => {
                    if(file.endsWith(".osz"))
                        fs.unlinkSync(`${settings.osu}/DirectTemp/${file}`);
                });
            }
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
        }, async function(err, res, body) {
            if(err)
                return r(false);
            var incorrect = /You have specified an incorrect/i;
            if(body.indexOf("DDoS protection by Cloudflare") != -1) {
                app.exit();
            } else {
                if(!incorrect.test(body)) {
                    user.check = body.split("localUserCheck = \"")[1].split("\";")[0];
                    user.id = body.split("localUserId = ")[1].split(";")[0];
                }
                r(!incorrect.test(body));
            }
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

/* Functionality */

Array.prototype.indexObj = function(param, value) {let r = -1;let d = false;this.forEach((a,i) => {if(d)return;if(a[param] == value){r=i;d=!d;}});return r;};

var downloadQueue = [];

function download(object, windowIpc) {
    let q = downloadQueue.indexObj("id", object.id);
    if(q == -1) {
        windowIpc.send('toast', {type: 'i', message: `Downloading ${object.artist} - ${object.title}`});
        windowIpc.send('addQueue', object);
        q = downloadQueue.length;
        downloadQueue.push(object);
    } else
        return windowIpc.send('toast', {type: 'e', message: `Already downloading ${object.artist} - ${object.title}`});
    if(q < 2) {
        var fileregexp = /[^0-9A-Za-z!@#$%^&()_+=[\]'. -]/g;

        var dl = progress(request.get({
            url: `https://osu.ppy.sh/d/${object.id}n`,
            timeout: 10000
        }), {
            throttle: 500
        }).on('progress', state => {
            windowIpc.send('updQueue', {id: object.id, p: `${Math.round(state.percent*100)}%`});
        });

        dl.on('error', (err) => {
            if(err.code == 'ETIMEDOUT') {
                windowIpc.send('toast', {type: 'e', message: `${object.artist} - ${object.title} timed out! Skipping..`, title: "Timed out"});
            } else {
                windowIpc.send('toast', {type: 'e', message: `Failed to download ${object.artist} - ${object.title}`});
            }
            windowIpc.send('delQueue', object.id);
            q = downloadQueue.indexObj("id", object.id);
            downloadQueue.splice(q, 1);
            if(downloadQueue.length > 1)
                download(downloadQueue[1], windowIpc);
        });

        dl.on('response', (res) => {
            if(res.headers['content-type'] == 'application/download') {
                let filename = res.headers['content-disposition'].split("filename=")[1].split('"')[1].replace(fileregexp, '');
                progress(dl, {
                    throttle: 500
                }).on('progress', (state) => {
                    windowIpc.send('updQueue', {id: object.id, p: `${Math.round(state.percent*100)}%`});
                });
                let ws = dl.pipe(fs.createWriteStream(`${settings.osu}/DirectTemp/${filename}`));
                dl.on('end', () => {
                    ws.end();
                    fs.renameSync(`${settings.osu}/DirectTemp/${filename}`, `${settings.osu}/Songs/${filename}`);
                    windowIpc.send('toast', {type: 's', message: `Downloaded ${object.artist} - ${object.title}`});
                    windowIpc.send('delQueue', object.id);
                    q = downloadQueue.indexObj("id", object.id);
                    downloadQueue.splice(q, 1);
                    if(downloadQueue.length > 1)
                        download(downloadQueue[1], windowIpc);
                });
            } else {
                windowIpc.send('toast', {type: 'e', message: `${object.artist} - ${object.title} doesn't exists`});
                windowIpc.send('delQueue', object.id);
                q = downloadQueue.indexObj("id", object.id);
                downloadQueue.splice(q, 1);
                if(downloadQueue.length > 1)
                    download(downloadQueue[1], windowIpc);
            }
        });
    }
}

async function favourite(object, windowIpc) {
    if(!object.s) {
        await req(`https://osu.ppy.sh/web/favourite.php?localUserCheck=${user.check}&a=${object.id}`);
        windowIpc.send('setFav', {id: object.id, f: !object.s});
        windowIpc.send('toast', {type: 'i', message: `Favourited ${object.artist} - ${object.title}`});
    } else {
        await req(`https://osu.ppy.sh/web/favourite.php?localUserCheck=${user.check}&d=${object.id}`);
        windowIpc.send('setFav', {id: object.id, f: !object.s});
        windowIpc.send('toast', {type: 'i', message: `Unfavourited ${object.artist} - ${object.title}`});
    }
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
    console.log(args);
    user.u = args.u;
    user.p = args.p;
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
    settings = Object.assign(settings, args);
    fs.writeFileSync(`${userData}/settings.data`, JSON.stringify(args));
    if(!fs.existsSync(`${args.osu}/DirectTemp`)) fs.mkdirSync(`${args.osu}/DirectTemp`);
    createWindow();
    mainWindow.close();
    mainWindow = null;
});

ipc.on('search', async (event, args) => {
    windowIpc = event.sender;
    try {
        let q = await req(`https://osu.ppy.sh/beatmapsets/search?${querystring.stringify(args[0])}`);
        event.sender.send('search-result', {done: true, object: JSON.parse(q), next: args[1]});
        ipc.emit('toast', {type: ''});
    } catch(e) {
        event.sender.send('search-result', {done: false, object: e.toString()});
    }
});

ipc.on('fav', (event, args) => {
    favourite(args, event.sender);
});

ipc.on('dl', (event, args) => {
    download(args, event.sender);
});

ipc.on('getTop', (event, id) => {
    request(`https://osu.ppy.sh/beatmaps/${id}/scores`, (err, res, body) => {
        if(err) 
            return event.sender.send('toast', {type: 'e', message: "Failed to load top"});
        event.sender.send('top', {id: id, top: JSON.parse(body)});
    });
});

ipc.on('getFriendsTop', (event, id) => {
    event.sender.send('toast', {type: 'i', message: 'Friends Ranking is not implemented yet'});
    event.sender.send('f-top', {id: id, top: ""});
});