const ipc = require('electron').ipcRenderer;
const { remote } = require('electron')
var querystring = require('querystring');
let cheerio = require("cheerio");
const ojsama = require("ojsama");
let readline = require('readline');
var request = require('request').defaults({
    jar: true,
    headers: {
        'User-Agent': 'osu!Direct v0.1'
    }
})
var progress = require('request-progress');
var fs = require('fs');
let authed = false;
let downloads = [];
let loadedMapsets = [];
var settings = {
	showDownloaded: false,
	noVideo: false
};
var loaded = false;

let hint = 0;

let nID = 1;

if(fs.existsSync("./settings.json")) {
	settings = JSON.parse(fs.readFileSync("./settings.json").toString());
} else {
	fs.writeFileSync("./settings.json", JSON.stringify(settings));
}

function editSettings(parameter, value) {
	settings[parameter] = value;
	fs.writeFileSync("./settings.json", JSON.stringify(settings));
}

function hidetray() {
    remote.BrowserWindow.getFocusedWindow().minimize();
}

ipc.on('tray-removed', function() {
    ipc.send('remove-tray');
    trayOn = false;
})

if(fs.existsSync('./Beatmapsets')) {
    let failed = fs.readdirSync("./Beatmapsets");
    failed.forEach(file => {
        if(file.indexOf(".osz") != -1) fs.unlinkSync(`./Beatmapsets/${file}`);
    })
}

let user = JSON.parse(fs.readFileSync("./loginData.json"));

var ignored = JSON.parse(fs.readFileSync("./ignored.json"));

let dlPath = fs.readFileSync("./downloadDirectory.txt").toString().replace('\\', '/');

let rawDirs = fs.readdirSync(dlPath);

if(fs.existsSync('./cached')) {
    fs.readdirSync('./cached').forEach(file => {
        fs.unlinkSync(`./cached/${file}`);
    })
    fs.rmdirSync('./cached')
}

fs.mkdirSync('./cached')

let start = 0;

let volume = 0.2;

let localUserCheck;

let cancel = 0;

let userid = 0;

let listrestor = 0;

var arrayOfDownloaded = [];
if(!fs.existsSync("./downloaded.json")) {
    rawDirs.forEach(dirr => {
        if(dirr.indexOf(".osz") != -1) arrayOfDownloaded.push(parseInt(dirr.split(".")[0]))
        else if(dirr.split(" ")[0].indexOf('n') > -1) arrayOfDownloaded.push(parseInt(dirr.split(" ")[0]));
        else if(dirr != "Failed") arrayOfDownloaded.push(parseInt(dirr.split(" ")[0]));
    })
    fs.writeFileSync("./downloaded.json", JSON.stringify(arrayOfDownloaded));
} else {
    arrayOfDownloaded = JSON.parse(fs.readFileSync("./downloaded.json"));
}

let friendlist = [];

request.post({
    url: 'https://osu.ppy.sh/forum/ucp.php?mode=login',
    formData: {
        login: "Login",
        username: user.username,
        password: user.password
    }
}, function(err, res, body) {
    var incorrect = /You have specified an incorrect password/i;
    if(incorrect.test(body)) {
        fs.unlinkSync("./loginData.json");
        let mainWindow = new BrowserWindow({width: 450, height: 300, frame: false, icon: __dirname + '/icon.ico'});
        mainWindow.setResizable(false);
        mainWindow.setFullScreenable(false);
        mainWindow.loadFile('login.html');
        window.close();
    }
    authed = true;
    fs.writeFileSync("./test.html", body)
    if(!body.split("localUserCheck = \"")[1]) {
        createNotification('error', "Couldn't authorize");
        document.getElementById("maplist").innerHTML = "<h2>Authorization failed</h2>";
    }
    localUserCheck = body.split("localUserCheck = \"")[1].split("\";")[0];
    userid = body.split("localUserId = ")[1].split(";")[0];
    document.getElementById("maplist").innerHTML = "<h2>Authorized</h2>";
    searchBeatmapsets();
    request.get("https://osu.ppy.sh/forum/ucp.php?i=163", function(err, res, body) {
        var $ = cheerio.load(body);
        let nickname = [];
        let friendid = $(".paddingboth").html().split('<div class="paddingboth">')[6].split("\t").join("").split("\n");
        friendid.forEach(nick => {
            if(nick.indexOf("profile_friend mutual") > -1) {
                nickname.push(nick.replace('<span class="profile_friend mutual"><a href="/u/', "").split('"')[0]);
            } else {nickname.push(nick.replace('<span class="profile_friend "><a href="/u/', "").split('"')[0])}
        })
        nickname.forEach(friend => {
            if(friend != "" && friend != "No friends online" && friend != "Offline" && friend != "Online" && friend != "</div>") friendlist.push(friend);
        })
    })
})

function formatUpper(string) {
    return string.charAt(0).toUpperCase() + string.slice(1);
}

function sortDiffs(diffs) {
    return diffs.sort(function(a,b){
        if(a.mode_int>b.mode_int) return 1
        else if(a.mode_int<b.mode_int) return -1
        else {
            if(a.difficulty_rating>b.difficulty_rating) return 1
            else if(a.difficulty_rating<b.difficulty_rating) return -1
            else return 0;
        }
    });
}

function osuSort(diffs) {
    diffs = sortDiffs(diffs);
    let give = [];
    diffs.forEach((diff, ind) => {
        if(diff.mode_int == 0) {
            give.push(diff);
        }
    })
    return give;
    // let del = [];
    // diffs.forEach((diff, ind) => {
    //     if(diff.mode_int != 0) del.push(ind);
    // })
    // if(diffs.length == del.length) return [];
    // del.forEach(d => {
    //     console.log(d);
    //     diffs.splice(d, 1);        
    // });
    // return sortDiffs(diffs);
}

function createNotification(style, text) {
    let meID = nID;
    nID++;
    let notification = `<div class="notif notif-${style}" id="notif-${meID}">${text}</div>`;
    document.getElementById("notifications").innerHTML += notification;
    document.getElementById(`notif-${meID}`).style.opacity = "1";
    setTimeout(function() {
        document.getElementById(`notif-${meID}`).style.opacity = "0";
        setTimeout(function() {
            document.getElementById(`notif-${meID}`).parentNode.removeChild(document.getElementById(`notif-${meID}`));
        }, 1000)
    }, 3000)
}

function getDiffColor(rating) {
    if(rating <= 1.5) {
        return "#8AAE17"
    } else if(rating > 1.5 && rating <= 2.25) {
        return "#9AD4DF"                  
    } else if(rating > 2.25 && rating <= 3.75) {
        return "#DEB32A"
    } else if(rating > 3.75 && rating <= 5.25) {
        return "#EB69A4"
    } else if(rating > 5.25 && rating <= 6.75) {
        return "#7264B5"
    } else {
        return "#050505"
    }
}

var lastparams = {};
var lastpage;

let starznak = ">=";
let arznak = ">=";
let odznak = ">=";
let hpznak = ">=";
let csznak = ">=";
let bpmznak = ">=";

function searchBeatmapsets() {
    loadedMapsets = [];
    cancel = 0;
    if(!authed) {
        createNotification('error', 'Wait until you are logged in!');
        return;
    }
    if(document.getElementById("maplist").innerHTML.indexOf("<h2>Nothing found</h2>") == -1) {
        start = 0;
    }
    if(start > 0 && document.getElementById("maplist").innerHTML.indexOf("<h2>Nothing found</h2>") == -1) {
        createNotification('started', `Wait until the search is complete.`);
        return
    }
    let params = {};
    if(document.getElementById("search-query").value != "") params.q = document.getElementById("search-query").value;
    if(document.getElementById('search-genre').value != "") params.g = document.getElementById("search-genre").value;
    if(document.getElementById('search-language').value != "") params.l = document.getElementById('search-language').value;
    if(document.getElementById("search-category").value != "0") params.s = document.getElementById("search-category").value;
    if(document.getElementById("search-mode").value != "-1") params.m = document.getElementById("search-mode").value;
    if(document.getElementById("search-sort").value != "") params.sort = document.getElementById("search-sort").value;
    if(document.getElementById("search-recommended").checked) params.c = "recommended";
    if(document.getElementById("search-include").checked) params.c = "converts";
    if(document.getElementById("search-include").checked && document.getElementById("search-recommended").checked) params.c = "converts.recommended";
    lastparams = params;
    document.getElementById("loader-proc").style.display = "flex";
    //document.getElementById("maplist").innerHTML = "<h2>Loading...</h2>"
    var url = `https://osu.ppy.sh/beatmapsets/search?${querystring.stringify(params)}`;
    request.get(url, function(err, res, body) {
        if(body.startsWith("<")) {
            createNotification('error', "osu! servers are down. Try again later");
            return;
        }
        let beatmapsets = JSON.parse(body).beatmapsets;
        if(beatmapsets.length == 0) {
            document.getElementById("maplist").innerHTML = "<h2>Nothing found</h2>";
            return;
        }
        var maplist = "";
        let ind = 0;
        beatmapsets.forEach(beatmapset => {
            let diffs = sortDiffs(beatmapset.beatmaps);
            let star = beatmapsets[ind].beatmaps[diffs.length-1].difficulty_rating;
            let ar = beatmapsets[ind].beatmaps[diffs.length-1].ar;
            let cs = beatmapsets[ind].beatmaps[diffs.length-1].cs;
            let od = beatmapsets[ind].beatmaps[diffs.length-1].accuracy;
            let hp = beatmapsets[ind].beatmaps[diffs.length-1].drain;
            let bpm = Number(beatmapset.bpm);
            let statsStar = star >= document.querySelector('#search-star').value;
            if (starznak == "<=") {
                statsStar = star <= document.querySelector('#search-star').value;
            }
            let statsAr = ar >= document.querySelector('#search-ar').value;
            if (arznak == "<=") {
                statsAr = ar <= document.querySelector('#search-ar').value;
            }
            let statsOd = od >= document.querySelector('#search-od').value;
            if (odznak == "<=") {
                statsOd = od <= document.querySelector('#search-od').value;
            }
            let statsCs = cs >= document.querySelector('#search-cs').value;
            if (csznak == "<=") {
                statsCs = cs <= document.querySelector('#search-cs').value;
            }
            let statsHp = hp >= document.querySelector('#search-hp').value;
            if (hpznak == "<=") {
                statsHp = hp <= document.querySelector('#search-hp').value;
            }
            let statsBpm = bpm >= document.querySelector('#search-bpm').value;
            if (bpmznak == "<=") {
                statsBpm = bpm <= document.querySelector('#search-bpm').value;
            }
            let stats = statsStar && statsAr && statsOd && statsCs && statsHp && statsBpm;
            let downloadedIgnored = arrayOfDownloaded.indexOf(beatmapset.id) == -1;
            if(settings.showDownloaded) downloadedIgnored = true;
            if(downloadedIgnored && ignored.indexOf(beatmapset.id) == -1 && stats) {
                let difficulties = "";
                if(diffs.length > 10) {
                    var nowmode = 0;
                    var count = 0;
                    diffs.forEach((diff, ind) => {
                        if(nowmode == diff.mode_int) {
                            count++;
                        } else {
                            if(count != 0) {
                                switch(nowmode) {
                                    case 0: {
                                        difficulties+=`<div title="${diffs[ind-1].difficulty_rating.toPrecision(3)}★ \nAR:${diffs[ind-1].ar} OD:${diffs[ind-1].accuracy} CS:${diffs[ind-1].cs} HP:${diffs[ind-1].drain} BPM:${beatmapset.bpm}" class="diff2"><i style="color: ${getDiffColor(diffs[ind-1].difficulty_rating)}" class="fal fa-extra-mode-osu"></i> ${count}</div>`;
                                        break;
                                    }
                                    case 1: {
                                        difficulties+=`<div title="${diffs[ind-1].difficulty_rating.toPrecision(3)}★ \nAR:${diffs[ind-1].ar} OD:${diffs[ind-1].accuracy} CS:${diffs[ind-1].cs} HP:${diffs[ind-1].drain} BPM:${beatmapset.bpm}" class="diff2"><i style="color: ${getDiffColor(diffs[ind-1].difficulty_rating)}" class="fal fa-extra-mode-taiko"></i> ${count}</div>`;
                                        break;
                                    }
                                    case 2: {
                                        difficulties+=`<div title="${diffs[ind-1].difficulty_rating.toPrecision(3)}★ \nAR:${diffs[ind-1].ar} OD:${diffs[ind-1].accuracy} CS:${diffs[ind-1].cs} HP:${diffs[ind-1].drain} BPM:${beatmapset.bpm}" class="diff2"><i style="color: ${getDiffColor(diffs[ind-1].difficulty_rating)}" class="fal fa-extra-mode-fruits"></i> ${count}</div>`;
                                        break;
                                    }
                                    case 3: {
                                        difficulties+=`<div title="${diffs[ind-1].difficulty_rating.toPrecision(3)}★ \nAR:${diffs[ind-1].ar} OD:${diffs[ind-1].accuracy} CS:${diffs[ind-1].cs} HP:${diffs[ind-1].drain} BPM:${beatmapset.bpm}" class="diff2"><i style="color: ${getDiffColor(diffs[ind-1].difficulty_rating)}" class="fal fa-extra-mode-mania"></i> ${count}</div>`;
                                        break;
                                    }
                                }
                            }
                            nowmode = diff.mode_int;
                            count = 1;
                        }
                    })
                    switch(nowmode) {
                        case 0: {
                            difficulties+=`<div title="${diffs[diffs.length-1].difficulty_rating.toPrecision(3)}★ \nAR:${diffs[diffs.length-1].ar} OD:${diffs[diffs.length-1].accuracy} CS:${diffs[diffs.length-1].cs} HP:${diffs[diffs.length-1].drain} BPM:${beatmapset.bpm}" class="diff2"><i style="color: ${getDiffColor(diffs[diffs.length-1].difficulty_rating)}" class="fal fa-extra-mode-osu"></i> ${count}</div>`;
                            break;
                        }
                        case 1: {
                            difficulties+=`<div title="${diffs[diffs.length-1].difficulty_rating.toPrecision(3)}★ \nAR:${diffs[diffs.length-1].ar} OD:${diffs[diffs.length-1].accuracy} CS:${diffs[diffs.length-1].cs} HP:${diffs[diffs.length-1].drain} BPM:${beatmapset.bpm}" class="diff2"><i style="color: ${getDiffColor(diffs[diffs.length-1].difficulty_rating)}" class="fal fa-extra-mode-taiko"></i> ${count}</div>`;
                            break;
                        }
                        case 2: {
                            difficulties+=`<div title="${diffs[diffs.length-1].difficulty_rating.toPrecision(3)}★ \nAR:${diffs[diffs.length-1].ar} OD:${diffs[diffs.length-1].accuracy} CS:${diffs[diffs.length-1].cs} HP:${diffs[diffs.length-1].drain} BPM:${beatmapset.bpm}" class="diff2"><i style="color: ${getDiffColor(diffs[diffs.length-1].difficulty_rating)}" class="fal fa-extra-mode-fruits"></i> ${count}</div>`;
                            break;
                        }
                        case 3: {
                            difficulties+=`<div title="${diffs[diffs.length-1].difficulty_rating.toPrecision(3)}★ \nAR:${diffs[diffs.length-1].ar} OD:${diffs[diffs.length-1].accuracy} CS:${diffs[diffs.length-1].cs} HP:${diffs[diffs.length-1].drain} BPM:${beatmapset.bpm}" class="diff2"><i style="color: ${getDiffColor(diffs[diffs.length-1].difficulty_rating)}" class="fal fa-extra-mode-mania"></i> ${count}</div>`;
                            break;
                        }
                    }
                } else {
                    diffs.forEach(diff => {
                        difficulties+=`<i title="${diff.version} ${diff.difficulty_rating.toPrecision(3)}★ \nAR:${diff.ar} OD:${diff.accuracy} CS:${diff.cs} HP:${diff.drain} BPM:${beatmapset.bpm}" style="color: ${getDiffColor(diff.difficulty_rating)}" class="fal diff fa-extra-mode-${diff.mode}"></i>`;
                    })
                }
                let favor = 'style="transform: scale(0.95);" onclick="favouriteBeatmapset('+ beatmapset.id +')" class="fas favor-' + beatmapset.id + ' fa-heart"';
                if(beatmapset.has_favourited == true) {
                    favor = 'style="transform: scale(0.95); color: rgb(209, 0, 108)" onclick="unfavouriteBeatmapset('+ beatmapset.id +');" class="fas favor-' + beatmapset.id + ' fa-heart"';
                }
                maplist+=`<div class="map" id="mapset-${beatmapset.id}">
                    <div class="map-header" onclick="openbrowser(${loadedMapsets.length})">
                        <img src="${beatmapset.covers.cover}" alt="">
                    </div>
                    <div class="status">${formatUpper(beatmapset.status)}</div>
                    <i onclick="previewMusic('${beatmapset.id}')" id="preview-${beatmapset.id}" class="fas play fa-play fa-3x"></i>
                    <div class="name">${beatmapset.title.substring(0, 35)}</div>
                    <div class="artist">${beatmapset.artist.substring(0, 35)}</div>
                    <div class="dlprogress" id="progress-${beatmapset.id}"></div>
                    <div class="creator">by ${beatmapset.creator}</div>
                    <a title="Download beatmap" class="download"><i onclick="donwloadBeatmapset(${beatmapset.id}, \`${beatmapset.title}\`, \`${beatmapset.artist}\`)" class="fas fa-download"></i></a>
                    <a title="Link to beatmap" class="link"><i onclick="openLink(${beatmapset.id})" class="fas fa-link"></i></a>
                    <a title="Favourite this beatmapset" class="link"><i ${favor}></i></a>
                    <a title="Ignore beatmap" class="ignore"><i onclick="ignoreMapset(${beatmapset.id}, \`${beatmapset.title}\`, \`${beatmapset.artist}\`)" class="fas fa-times"></i></a>
                    <div id="alldiff">${difficulties}</div>
                </div>`;
                loadedMapsets.push(beatmapset);
            }
            ind++;
        })
        lastpage = 1;
        let = numberDiv = document.getElementsByClassName('map');
        if(maplist != "") {
            maplist+=`<div id="nextPageButton"><i onclick="loadMore()" class="fas fa-angle-down fa-3x loadNext"></i></div>`
            document.getElementById("maplist").innerHTML = maplist;
            document.getElementById('footer').style.opacity = "1";
            document.getElementById("loader-proc").style.display = "none";
            loaded = true;
        } else {
            maplist+=`<div id="nextPageButton"><i onclick="loadMore()" class="fas fa-angle-down fa-3x loadNext"></i></div>`
            document.getElementById("maplist").innerHTML = maplist;
            lastpage = 0;
            loadMore();
        }
    });
}

function favouriteBeatmapset(id) {
    request.get(`https://osu.ppy.sh/web/favourite.php?localUserCheck=${localUserCheck}&a=${id}`, (err, res, body) => {
        createNotification('started', 'Added to favourites');
        document.getElementsByClassName("favor-" + id)[0].style.color = "rgb(209, 0, 108)";
        document.getElementsByClassName("favor-" + id)[0].setAttribute("onclick", `unfavouriteBeatmapset(${id})`)
    })
}

function unfavouriteBeatmapset(id) {
    request.get(`https://osu.ppy.sh/web/favourite.php?localUserCheck=${localUserCheck}&d=${id}`, (err, res, body) => {
        createNotification('started', 'Removed from favourites');
        document.getElementsByClassName("favor-" + id)[0].style.color = "rgb(0, 0, 0)";
        document.getElementsByClassName("favor-" + id)[0].setAttribute("onclick", `favouriteBeatmapset(${id})`)
    })
}

function loadMore() {
    if(cancel != 0) return;
    lastpage++;
    var url = `https://osu.ppy.sh/beatmapsets/search?${querystring.stringify(Object.assign(lastparams, {page: lastpage}))}`;
    if(start == 0) {
        document.getElementById("loader-proc").style.display = "flex";
    }
    request.get(url, function(err, res, body) {
        if(err) {
            console.log(err);
            createNotification('error', 'Unknown error');
            return;
        }
        if(body.startsWith("<")) {
            createNotification('error', "osu! servers are down. Try again later");
            return;
        }
        let beatmapsets = JSON.parse(body).beatmapsets;
        if(beatmapsets.length == 0) {
            document.getElementById("loader-proc").style.display = "none";
            document.getElementById("nextPageButton").parentNode.removeChild(document.getElementById("nextPageButton"));
            document.getElementById("maplist").innerHTML += "<h2>Nothing found</h2>";
            return;
        }
        var maplist = "";
        let ind = 0;
        beatmapsets.forEach(beatmapset => {
            let diffs = sortDiffs(beatmapset.beatmaps);
            let star = beatmapsets[ind].beatmaps[diffs.length-1].difficulty_rating;
            let ar = beatmapsets[ind].beatmaps[diffs.length-1].ar;
            let cs = beatmapsets[ind].beatmaps[diffs.length-1].cs;
            let od = beatmapsets[ind].beatmaps[diffs.length-1].accuracy;
            let hp = beatmapsets[ind].beatmaps[diffs.length-1].drain;
            let bpm = Number(beatmapset.bpm);
            let statsStar = star >= document.querySelector('#search-star').value;
            if (starznak == "<=") {
                statsStar = star <= document.querySelector('#search-star').value;
            }
            let statsAr = ar >= document.querySelector('#search-ar').value;
            if (arznak == "<=") {
                statsAr = ar <= document.querySelector('#search-ar').value;
            }
            let statsOd = od >= document.querySelector('#search-od').value;
            if (odznak == "<=") {
                statsOd = od <= document.querySelector('#search-od').value;
            }
            let statsCs = cs >= document.querySelector('#search-cs').value;
            if (csznak == "<=") {
                statsCs = cs <= document.querySelector('#search-cs').value;
            }
            let statsHp = hp >= document.querySelector('#search-hp').value;
            if (hpznak == "<=") {
                statsHp = hp <= document.querySelector('#search-hp').value;
            }
            let statsBpm = bpm >= document.querySelector('#search-bpm').value;
            if (bpmznak == "<=") {
                statsBpm = bpm <= document.querySelector('#search-bpm').value;
            }
            let stats = statsStar && statsAr && statsOd && statsCs && statsHp && statsBpm;
            let downloadedIgnored = arrayOfDownloaded.indexOf(beatmapset.id) == -1;
            if(settings.showDownloaded) downloadedIgnored = true;
            if(downloadedIgnored && ignored.indexOf(beatmapset.id) == -1 && stats) {
                let difficulties = "";
                if(diffs.length > 10) {
                    var nowmode = 0;
                    var count = 0;
                    diffs.forEach((diff, ind) => {
                        if(nowmode == diff.mode_int) {
                            count++;
                        } else {
                            if(count != 0) {
                                switch(nowmode) {
                                    case 0: {
                                        difficulties+=`<div title="${diffs[ind-1].difficulty_rating.toPrecision(3)}★ \nAR:${diffs[ind-1].ar} OD:${diffs[ind-1].accuracy} CS:${diffs[ind-1].cs} HP:${diffs[ind-1].drain} BPM:${beatmapset.bpm}" class="diff2"><i style="color: ${getDiffColor(diffs[ind-1].difficulty_rating)}" class="fal fa-extra-mode-osu"></i> ${count}</div>`;
                                        break;
                                    }
                                    case 1: {
                                        difficulties+=`<div title="${diffs[ind-1].difficulty_rating.toPrecision(3)}★ \nAR:${diffs[ind-1].ar} OD:${diffs[ind-1].accuracy} CS:${diffs[ind-1].cs} HP:${diffs[ind-1].drain} BPM:${beatmapset.bpm}" class="diff2"><i style="color: ${getDiffColor(diffs[ind-1].difficulty_rating)}" class="fal fa-extra-mode-taiko"></i> ${count}</div>`;
                                        break;
                                    }
                                    case 2: {
                                        difficulties+=`<div title="${diffs[ind-1].difficulty_rating.toPrecision(3)}★ \nAR:${diffs[ind-1].ar} OD:${diffs[ind-1].accuracy} CS:${diffs[ind-1].cs} HP:${diffs[ind-1].drain} BPM:${beatmapset.bpm}" class="diff2"><i style="color: ${getDiffColor(diffs[ind-1].difficulty_rating)}" class="fal fa-extra-mode-fruits"></i> ${count}</div>`;
                                        break;
                                    }
                                    case 3: {
                                        difficulties+=`<div title="${diffs[ind-1].difficulty_rating.toPrecision(3)}★ \nAR:${diffs[ind-1].ar} OD:${diffs[ind-1].accuracy} CS:${diffs[ind-1].cs} HP:${diffs[ind-1].drain} BPM:${beatmapset.bpm}" class="diff2"><i style="color: ${getDiffColor(diffs[ind-1].difficulty_rating)}" class="fal fa-extra-mode-mania"></i> ${count}</div>`;
                                        break;
                                    }
                                }
                            }
                            nowmode = diff.mode_int;
                            count = 1;
                        }
                    })
                    switch(nowmode) {
                        case 0: {
                            difficulties+=`<div title="${diffs[diffs.length-1].difficulty_rating.toPrecision(3)}★ \nAR:${diffs[diffs.length-1].ar} OD:${diffs[diffs.length-1].accuracy} CS:${diffs[diffs.length-1].cs} HP:${diffs[diffs.length-1].drain} BPM:${beatmapset.bpm}" class="diff2"><i style="color: ${getDiffColor(diffs[diffs.length-1].difficulty_rating)}" class="fal fa-extra-mode-osu"></i> ${count}</div>`;
                            break;
                        }
                        case 1: {
                            difficulties+=`<div title="${diffs[diffs.length-1].difficulty_rating.toPrecision(3)}★ \nAR:${diffs[diffs.length-1].ar} OD:${diffs[diffs.length-1].accuracy} CS:${diffs[diffs.length-1].cs} HP:${diffs[diffs.length-1].drain} BPM:${beatmapset.bpm}" class="diff2"><i style="color: ${getDiffColor(diffs[diffs.length-1].difficulty_rating)}" class="fal fa-extra-mode-taiko"></i> ${count}</div>`;
                            break;
                        }
                        case 2: {
                            difficulties+=`<div title="${diffs[diffs.length-1].difficulty_rating.toPrecision(3)}★ \nAR:${diffs[diffs.length-1].ar} OD:${diffs[diffs.length-1].accuracy} CS:${diffs[diffs.length-1].cs} HP:${diffs[diffs.length-1].drain} BPM:${beatmapset.bpm}" class="diff2"><i style="color: ${getDiffColor(diffs[diffs.length-1].difficulty_rating)}" class="fal fa-extra-mode-fruits"></i> ${count}</div>`;
                            break;
                        }
                        case 3: {
                            difficulties+=`<div title="${diffs[diffs.length-1].difficulty_rating.toPrecision(3)}★ \nAR:${diffs[diffs.length-1].ar} OD:${diffs[diffs.length-1].accuracy} CS:${diffs[diffs.length-1].cs} HP:${diffs[diffs.length-1].drain} BPM:${beatmapset.bpm}" class="diff2"><i style="color: ${getDiffColor(diffs[diffs.length-1].difficulty_rating)}" class="fal fa-extra-mode-mania"></i> ${count}</div>`;
                            break;
                        }
                    }
                } else {
                    diffs.forEach(diff => {
                        difficulties+=`<i title="${diff.version} ${diff.difficulty_rating.toPrecision(3)}★ \nAR:${diff.ar} OD:${diff.accuracy} CS:${diff.cs} HP:${diff.drain} BPM:${beatmapset.bpm}" style="color: ${getDiffColor(diff.difficulty_rating)}" class="fal diff fa-extra-mode-${diff.mode}"></i>`;
                    })
                }
                let favor = 'style="transform: scale(0.95);" onclick="favouriteBeatmapset('+ beatmapset.id +')" class="fas favor-' + beatmapset.id + ' fa-heart"';
                if(beatmapset.has_favourited == true) {
                    favor = 'style="transform: scale(0.95); color: rgb(209, 0, 108)" onclick="unfavouriteBeatmapset('+ beatmapset.id +');" class="fas favor-' + beatmapset.id + ' fa-heart"';
                }
                maplist+=`<div class="map" id="mapset-${beatmapset.id}">
                    <div class="map-header" onclick="openbrowser(${loadedMapsets.length})">
                        <img src="${beatmapset.covers.cover}" alt="">
                    </div>
                    <div class="status">${formatUpper(beatmapset.status)}</div>
                    <i onclick="previewMusic('${beatmapset.id}')" id="preview-${beatmapset.id}" class="fas play fa-play fa-3x"></i>
                    <div class="name">${beatmapset.title.substring(0, 35)}</div>
                    <div class="artist">${beatmapset.artist.substring(0, 35)}</div>
                    <div class="dlprogress" id="progress-${beatmapset.id}"></div>
                    <div class="creator">by ${beatmapset.creator}</div>
                    <a title="Download beatmap" class="download"><i onclick="donwloadBeatmapset(${beatmapset.id}, \`${beatmapset.title}\`, \`${beatmapset.artist}\`)" class="fas fa-download"></i></a>
                    <a title="Link to beatmap" class="link"><i onclick="openLink(${beatmapset.id})" class="fas fa-link"></i></a>
                    <a title="Favourite this beatmapset" class="link"><i ${favor}></i></a>
                    <a title="Ignore beatmap" class="ignore"><i onclick="ignoreMapset(${beatmapset.id}, \`${beatmapset.title}\`, \`${beatmapset.artist}\`)" class="fas fa-times"></i></a>
                    <div id="alldiff">${difficulties}</div>
                </div>`;
                loadedMapsets.push(beatmapset);
            }
            ind++;
        })
        let = numberDiv = document.getElementsByClassName('map');
        console.log(numberDiv.length)
        if(maplist != "" && numberDiv.length >= 10) {
            if(!loaded) {
                loaded = true;
                document.getElementById('footer').style.opacity = "1";
            }
            document.getElementById("loader-proc").style.display = "none";
            document.getElementById("nextPageButton").parentNode.removeChild(document.getElementById("nextPageButton"));
            maplist+=`<div id="nextPageButton"><i onclick="loadMore()" class="fas fa-angle-down fa-3x loadNext"></i></div>`
            document.getElementById("maplist").innerHTML += maplist;
            start = 0;
            cancel = 0;
        } else {
            document.getElementById("nextPageButton").parentNode.removeChild(document.getElementById("nextPageButton"));
            maplist+=`<div id="nextPageButton"><i onclick="loadMore()" class="fas fa-angle-down fa-3x loadNext"></i></div>`
            document.getElementById("maplist").innerHTML += maplist;
            loadMore();
        }
    });
}

var playing = false;
var playingID = 0;

function previewMusic(id) {
    if(hint == 0) {
        createNotification('started', 'Volume controls: Shift + "+" or Shift + "-" '); 
        hint++;
    }
    let previewURL = `https://b.ppy.sh/preview/${id}.mp3`;
    let audio = document.getElementById("preview");

    audio.onended = function() {
        document.getElementById(`preview-${playingID}`).classList.remove("fa-pause");
        document.getElementById(`preview-${playingID}`).classList.add("fa-play");
        document.getElementById(`preview-${playingID}`).classList.remove("playing");
        playingID = 0;
    }

    let button = document.getElementById(`preview-${id}`);
    audio.volume = volume;
    if(document.getElementById(`preview-${id}`).classList.contains("fa-play")) {
        if(playingID != 0) {
            if(document.getElementById(`preview-${playingID}`)) {
                document.getElementById(`preview-${playingID}`).classList.remove("fa-pause");
                document.getElementById(`preview-${playingID}`).classList.add("fa-play");
                document.getElementById(`preview-${playingID}`).classList.remove("playing");
            }
            audio.pause();
        }
        audio.src = previewURL;
        audio.load();
        audio.play();
        playingID = id;
        button.classList.remove("fa-play");
        button.classList.add("fa-pause");
        button.classList.add("playing");
    } else {
        playingID = 0;
        audio.pause();
        button.classList.remove("fa-pause");
        button.classList.add("fa-play");
        button.classList.remove("playing");
    }
    // document.getElementById('preview').className = "fas play fa-pause fa-3x";
    //
}

function openLink(id) {
    let opened = remote.shell.openExternal(`https://osu.ppy.sh/s/${id}`);
    if(!opened) {
        createNotification('error', "Unable to open mapset page");
    }
}

function openSite(url) {
    let opened = remote.shell.openExternal(url);
    if(!opened) {
        createNotification('error', "Unable to open mapset page");
    }
}

function ignoreMapset(id, title, artist) {
    if(ignored.indexOf(id) == -1) {
        ignored.push(id);
        createNotification('started', `Ignoring ${title} - ${artist}`)
        fs.writeFileSync("./ignored.json", JSON.stringify(ignored));
    }
}

window.onscroll = function() {
    var scrolled = window.pageYOffset || document.documentElement.scrollTop;
    if(scrolled > 500) {
        document.getElementById('arrowup').style.opacity = 0.5;
    }
}

function donwloadBeatmapset(id, title, artist) {
    var alreadyDownloading = false;
    downloads.forEach(dl => {
        if(dl == id) {
            alreadyDownloading = true;
        }
    })
    if(settings.noVideo) id += "n";
    if(alreadyDownloading) {
        var scrolled = window.pageYOffset || document.documentElement.scrollTop;
        setTimeout(function() {
            window.scrollTo(0, scrolled);
        }, 1)
        createNotification('error', 'You are already downloading this mapset!');
        return;
    }
    const notAvailableRegex = /This download is no longer available/i;
    if(!fs.existsSync("./Beatmapsets")) fs.mkdirSync("./Beatmapsets");

    createNotification('started', `Started downloading ${title} - ${artist}`);

    var scrolled = window.pageYOffset || document.documentElement.scrollTop;
    setTimeout(function() {
        window.scrollTo(0, scrolled);
    }, 1)
    
    downloads.push(id);
    let dlProgress = `<div class="dlprogress" id="dl-${id}">
        <div class="dlprogress-name">${title} - ${artist}</div>
        <div class="dlprogress-percent" id="percent-${id}">0%</div>
        <div class="dlprogress-bar" id="progress-${id}"></div>
        </div>`
    document.getElementById("downloads-list").innerHTML += dlProgress;
    let stream = fs.createWriteStream(`./Beatmapsets/${id.toString().split("n").join("")} ${title} - ${artist}.osz`);
    // let progressCount = document.getElementById(`percent-${id}`);
    // let progressCount = new CountUp(`percent-${id}`, 0, 0, 0, 1, {suffix: "%"});
    // progressCount.start();
    progress(request.get(`https://osu.ppy.sh/d/${id}`))
    .on('progress', function(state) {
        document.getElementById(`progress-${id}`).style.width = `${Math.round(state.percent * 100)}%`;
        // progressCount.update(Math.round(state.percent * 100));
        document.getElementById(`percent-${id}`).innerHTML = `${Math.round(state.percent * 100)}%`;
    }).on('error', (err) => {
        stream.end();
        document.getElementById(`dl-${id}`).parentNode.removeChild(document.getElementById(`dl-${id}`));
        createNotification('error', `Failed downloading ${title} - ${artist}`);
        return;
    }).pipe(stream).on('finish', () => {
        if(arrayOfDownloaded.indexOf(Number(id.split("n")[0])) == -1) arrayOfDownloaded.push(Number(id.split("n")[0]));
        fs.writeFileSync("./downloaded.json", JSON.stringify(arrayOfDownloaded));
        downloads.forEach((dl,ind) => {
            if(dl == id) downloads.splice(ind, 1);
        })
        stream.end();
        // fs.renameSync(`./Beatmapsets/${id}.osz`, `${dlPath}/${id}.osz`);
        let rs = fs.createReadStream(`./Beatmapsets/${id.toString().split("n").join("")} ${title} - ${artist}.osz`);
        let ws = fs.createWriteStream(`${dlPath}/${id.toString().split("n").join("")} ${title} - ${artist}.osz`);
        rs.pipe(ws);
        rs.on('end', () => {
            fs.unlinkSync(`./Beatmapsets/${id.toString().split("n").join("")} ${title} - ${artist}.osz`);
            document.getElementById(`dl-${id}`).parentNode.removeChild(document.getElementById(`dl-${id}`));
            createNotification('success', `Finished downloading ${title} - ${artist}`);
            if(title == "Restoring") {
                listrestor++;
                restoreBeatmaps(true);
            }
        })
    })
}

function checkDL(event) {
    if(event.keyCode == 13) {
        searchBeatmapsets();
        event.preventDefault()
    } else return true;
}

let open = 0;

function openOptions() {
    if(open == 0) {
        document.getElementById('more-op').style.display = "none";
        document.getElementById('hide-op').style.display = "block";
        document.getElementById('category').style.display = "flex";
        document.getElementById('category-2').style.display = "flex";
        document.getElementById('category-3').style.display = "flex";
        open++;
    } else {
        document.getElementById('more-op').style.display = "flex";
        document.getElementById('hide-op').style.display = "none";
        document.getElementById('category').style.display = "none";
        document.getElementById('category-2').style.display = "none";
        document.getElementById('category-3').style.display = "none";
        open = 0;
    }
}


function changeFormStar() {
    if(starznak == ">=") {
        starznak = "<="
    } else {
        starznak = ">="
    }
    document.querySelector('#output-star').innerHTML = "Star " + starznak + " " + document.querySelector('#search-star').value + "*";
}

function changeFormAr() {
    if(arznak == ">=") {
        arznak = "<="
    } else {
        arznak = ">="
    }
    document.querySelector('#output-ar').innerHTML = "AR " + arznak + " " + document.querySelector('#search-ar').value ;
}

function changeFormCs() {
    if(csznak == ">=") {
        csznak = "<="
    } else {
        csznak = ">="
    }
    document.querySelector('#output-cs').innerHTML = "CS " + csznak + " " + document.querySelector('#search-cs').value ;
}

function changeFormOd() {
    if(odznak == ">=") {
        odznak = "<="
    } else {
        odznak = ">="
    }
    document.querySelector('#output-od').innerHTML = "OD " + odznak + " " + document.querySelector('#search-od').value ;
}

function changeFormHp() {
    if(hpznak == ">=") {
        hpznak = "<="
    } else {
        hpznak = ">="
    }
    document.querySelector('#output-hp').innerHTML = "HP " + hpznak + " " + document.querySelector('#search-hp').value ;
}

function changeFormBpm() {
    if(bpmznak == ">=") {
        bpmznak = "<="
    } else {
        bpmznak = ">="
    }
    document.querySelector('#output-bpm').innerHTML = "BPM " + bpmznak + " " + document.querySelector('#search-bpm').value ;
}

function outputStarUpdate(vol) {
    document.querySelector('#output-star').innerHTML = "Star " + starznak + " " + document.querySelector('#search-star').value + "*";
}

function outputBpmUpdate(vol) {
    document.querySelector('#output-bpm').innerHTML = "BPM " + bpmznak + " " + document.querySelector('#search-bpm').value;
}


function outputArUpdate(vol) {
    document.querySelector('#output-ar').innerHTML = "AR " + arznak + " " + document.querySelector('#search-ar').value ;
}

function outputOdUpdate(vol) {
    document.querySelector('#output-od').innerHTML = "OD " + odznak + " " + document.querySelector('#search-od').value ;
}

function outputCsUpdate(vol) {
    document.querySelector('#output-cs').innerHTML = "CS " + csznak + " " + document.querySelector('#search-cs').value ;
}

function outputHpUpdate(vol) {
    document.querySelector('#output-hp').innerHTML = "HP " + hpznak + " " + document.querySelector('#search-hp').value ;
}

window.onload = function () {
    document.getElementById("volume").style.width = volume*100 + "vw";
}

let openedVolume = 0;
document.onkeydown = function(evt) {
    evt = evt || window.event;
    var isEscape = false;
    var volumeUp = false;
    var volumeDown = false;
    if ("key" in evt) {
        isEscape = (evt.key == "Escape" || evt.key == "Esc");
    } else {
        isEscape = (evt.keyCode == 27);
    }
    if ("key" in evt) {
        volumeDown = (evt.key == "_" || evt.key == "_");
    } else {
        volumeDown = (evt.keyCode == 173);
    }
    if ("key" in evt) {
        volumeUp = (evt.key == "+" || evt.key == "+");
    } else {
        volumeUp = (evt.keyCode == 18);
    }
    if (volumeDown) {
        let audio = document.getElementById("preview");
        if(volume <= 0.75 && volume > 0) volume -= 0.05;
        document.getElementById("volume").style.width = volume*100 + "vw";
        document.getElementsByClassName("volumebg")[0].style.bottom = "10px";
        document.getElementById("volume").style.bottom = "10px";
        audio.volume = volume;
        if(openedVolume == 0) {
            openedVolume++;
            setTimeout(function () {
                    document.getElementsByClassName("volumebg")[0].style.bottom = "-10vh";
                    document.getElementById("volume").style.bottom = "-10vh";
                    openedVolume = 0;
            }, 2000)
        }
    }
    if (volumeUp) {
        let audio = document.getElementById("preview");
        if(volume <= 0.65) volume += 0.05;
        document.getElementById("volume").style.width = volume*100 + "vw";
        document.getElementsByClassName("volumebg")[0].style.bottom = "10px";
        document.getElementById("volume").style.bottom = "10px";
        audio.volume = volume;
        if(openedVolume == 0) {
            openedVolume++;
            setTimeout(function () {
                    document.getElementsByClassName("volumebg")[0].style.bottom = "-10vh";
                    document.getElementById("volume").style.bottom = "-10vh";
                    openedVolume = 0;
            }, 2000)
        }
    }
    if (isEscape) {
        document.getElementById("loader-proc").style.display = "none";
        cancel++;
    }
};

let settingopen = 0;

function openSettings() {
    if(settingopen == 0) {
        document.getElementById('settings-back').style.display = "flex";
        setTimeout(function () {
            document.getElementById('settings-window').style.opacity = "1";
            document.getElementById('settings-window').style.transform = "scale(1)";
        }, 100)
        settingopen++;
    } else {
        document.getElementById('settings-window').style.opacity = "0";
        document.getElementById('settings-window').style.transform = "scale(1.1)";
        setTimeout(function () {
            document.getElementById('settings-back').style.display = "none";            
        }, 500)
        settingopen = 0;
    }
    document.getElementById('username').value = user.username;
    document.getElementById('password').value = user.password;
    if(user.token) document.getElementById('token').value = user.token;
    document.getElementById('profile-pic').style.background = 'url("https://a.ppy.sh/' + userid + '")'
}


function signout() {
    fs.unlinkSync("./loginData.json");
    let mainWindow = new remote.BrowserWindow({width: 400, height: 300, frame: false, icon: __dirname + "/icon.ico"});
    let thisWindow = remote.getCurrentWindow();
    mainWindow.setPosition(thisWindow.getPosition()[0]+300, thisWindow.getPosition()[1]+200);
    mainWindow.loadFile("login.html");
    window.close();
}

function loadCB() {
    let checkboxes = document.getElementsByClassName("cb-circle");
    console.log(checkboxes);
    for(let i = 0; i < checkboxes.length; i++) {
        let cb = checkboxes[i];
        let param = cb.getAttribute("param");
        cb.parentNode.addEventListener('click', () => {
            if(cb.classList.contains("cb-on")) {
                cb.classList.remove("cb-on");
                cb.parentNode.style.background = "rgb(230,0,0)";
            } else {
                cb.classList.add("cb-on");
                cb.parentNode.style.background = "rgb(0,230,0)";
            }
            editSettings(param, !settings[param]);
        })
        cb.parentNode.setAttribute('onclick', `changeParameter('${param}', !settings['${param}'])`);
        cb.onclick = `changeParameter('${param}', !settings['${param}'])`;
        if(settings[param]) {
            cb.parentNode.style.background = "rgb(0,230,0)";
            cb.classList.add("cb-on");
        } else {
            cb.parentNode.style.background = "rgb(230,0,0)";
        }
    }
}

function openGeneralOptions() {
    document.getElementById('general-op').className = "option option-selected";
    document.getElementById('backup-op').className = "option";
    document.getElementById('myacc-op').className = "option";
    document.getElementById('change-op').className = "option";
    document.getElementById('settings-main').innerHTML = fs.readFileSync("./settings/generalSettings.html").toString();
    // document.getElementById("search-novideo").checked = settings.noVideo;
    // document.getElementById("search-downloaded").checked = settings.showDownloaded;
    loadCB();
}

function openMyaccOptions() {
    document.getElementById('myacc-op').className = "option option-selected";
    document.getElementById('backup-op').className = "option";
    document.getElementById('general-op').className = "option";
    document.getElementById('change-op').className = "option";
    document.getElementById('settings-main').innerHTML = fs.readFileSync("./settings/accountSettings.html").toString();
    document.getElementById('username').value = user.username;
    document.getElementById('password').value = user.password;
    if(user.token) document.getElementById('token').value = user.token;
    document.getElementById('profile-pic').style.background = 'url("https://a.ppy.sh/' + userid + '")';
}

function openbackupOptions() {
    document.getElementById('backup-op').className = "option option-selected";
    document.getElementById('myacc-op').className = "option";
    document.getElementById('general-op').className = "option";
    document.getElementById('change-op').className = "option";
    document.getElementById('settings-main').innerHTML = fs.readFileSync("./settings/backupSettings.html");
}

function openChangelogOptions() {
    document.getElementById('change-op').className = "option option-selected";
    document.getElementById('myacc-op').className = "option";
    document.getElementById('general-op').className = "option";
    document.getElementById('backup-op').className = "option";
    document.getElementById('settings-main').innerHTML = fs.readFileSync("./settings/changelog.html");
}

let restorstarted = 0;
let missingmapsnum = 0;

function restoreBeatmaps(force) {
    if(force) {
        let existsNow = [];
        fs.readdirSync(dlPath).forEach(dpath => {
            existsNow.push(dpath.split(" ")[0].replace('n', "").split(".")[0]);
        })
        let missingmaps = [];
        arrayOfDownloaded.forEach((dld, ind) => {
            if(existsNow.indexOf(String(dld)) == -1) {
                missingmaps.push(Number(dld))
            }
        })
        console.log(missingmaps);
        if(existsNow.indexOf(String(missingmaps[0])) == -1 && missingmaps.length != 0) {
            donwloadBeatmapset(Number(missingmaps[0]), "Restoring", `#${listrestor+1}`);
            console.log(100/(missingmapsnum/listrestor)/1.42)
            document.getElementById("restore").style.width = 100/(missingmapsnum/listrestor)/1.42 + "vw";
            if(restorstarted == 0) {
                document.getElementsByClassName("restorebg")[0].style.bottom = "10px";
                document.getElementById("restore").style.bottom = "10px";
                missingmapsnum = missingmaps.length;
                restorstarted++;
            }
        } else {
            document.getElementById("restore").style.width = "100vw";
            setTimeout(function () {
                document.getElementsByClassName("restorebg")[0].style.bottom = "-10vw";
                document.getElementById("restore").style.bottom = "-10vw";
                document.getElementById("restore").style.width = "0vw";
            }, 1000)
        }
        // arrayOfDownloaded.forEach((dld, ind) => {
        //     if(existsNow.indexOf(String(dld)) == -1) {
        //         donwloadBeatmapset(Number(dld), "Restoring", `#${ind+1}`);
        //     }
        // })
    } else {
        listrestor = 0;
        document.getElementById("tooManyMapsets").classList.add('shown-modal');
    }
}

function sleep(ms) {
    var start = new Date().getTime()
    while ((new Date().getTime() - start) < ms) { }
    return 1
}

let modeIcons = {
    0: '<i class="fal fa-extra-mode-osu"></i>',
    1: '<i class="fal fa-extra-mode-taiko"></i>',
    2: '<i class="fal fa-extra-mode-fruits"></i>',
    3: '<i class="fal fa-extra-mode-mania"></i>'
}

let diffselected = 0;

const eemods = {
    1:      'NF',
    2:      'EZ',
    4:      'Touch',
    8:      'HD',
    16:     'HR',
    32:     'SD',
    64:     'DT',
    128:    'RX',
    256:    'HT',
    576:    'NC',
    1024:   'FL',
    2048:   'AT',
    4096:   'SO',
    8192:   'AP',
    16416:  'PF'
}

function parseMods(m) {
    const enabled = [];
    
    const values = Object.keys(eemods).map(a => Number(a));
    for (let i = values.length - 1; i >= 0; i--) {
        if (m >= values[i]) {
            m -= values[i];
            enabled.push(eemods[values[i]]);
        }
        if (m == 0)
            break;
    }
    let modsText = "";
    enabled.reverse().forEach((mod, ind) => {
        if (ind == 0) {
            modsText += mod;
        } else {
            modsText += (mod);
        }
    });
    return modsText;
}

let bpmwithoutdt = 0;

function openbrowser(ind) {
    let mapset = loadedMapsets[ind];
    let diffs = osuSort(mapset.beatmaps);
    document.getElementsByClassName('map-all-diffs')[0].innerHTML = "";
    request.get(`https://assets.ppy.sh/beatmaps/${mapset.id}/covers/cover.jpg`, function(err, res, body) {
        if(body.indexOf('404 Not Found') > -1) {
            document.getElementById('map-bg').src = `default-bg.png`;
        } else {document.getElementById('map-bg').src = `https://assets.ppy.sh/beatmaps/${mapset.id}/covers/cover.jpg`;}
    })
    document.getElementById('map-title').innerHTML = `${mapset.artist} - ${mapset.title}`;
    document.getElementsByClassName('bpm')[0].innerHTML = `BPM: ${mapset.bpm.toPrecision(3)}`;
    let mapLM = Math.floor(mapset.beatmaps[0].total_length/60);
    let mapLength = String(mapLM) + (String(mapset.beatmaps[0].total_length - mapLM*60).length > 1 ? `:${mapset.beatmaps[0].total_length - mapLM*60}` : `:0${mapset.beatmaps[0].total_length - mapLM*60}`);
    document.getElementsByClassName('length')[0].innerHTML = `<i style="margin-right: 5px;" class="fas fa-clock"></i>${mapLength}`;
    if(diffs.length == 0) {
        document.getElementsByClassName('pp-counter')[0].style.display = "none";
        document.getElementsByClassName('top-plays')[0].style.height = "400px";
        document.getElementsByClassName('justcenter')[0].style.height = "360px";
    } else {
        document.getElementsByClassName('pp-counter')[0].style.display = "flex";
        document.getElementsByClassName('top-plays')[0].style.height = "340px";
        document.getElementsByClassName('justcenter')[0].style.height = "300px";
    }
    diffs.forEach(function(diff,i) {
        if(i == diffs.length-1) {
            document.getElementsByClassName('map-all-diffs')[0].innerHTML += `<div onclick="changeDiff(${i},${mapset.beatmaps[i].difficulty_rating.toPrecision(3)}, ${mapset.beatmaps[i].ar}, ${mapset.beatmaps[i].cs}, ${mapset.beatmaps[i].accuracy}, ${mapset.beatmaps[i].drain}, ${mapset.beatmaps[i].id})" class="map-diff diff-selected">${modeIcons[diff.mode_int]} ${diff.version}</div>`;
            diffselected = i;
        } else {
            document.getElementsByClassName('map-all-diffs')[0].innerHTML += `<div onclick="changeDiff(${i},${mapset.beatmaps[i].difficulty_rating.toPrecision(3)}, ${mapset.beatmaps[i].ar}, ${mapset.beatmaps[i].cs}, ${mapset.beatmaps[i].accuracy}, ${mapset.beatmaps[i].drain}, ${mapset.beatmaps[i].id})" class="map-diff">${modeIcons[diff.mode_int]} ${diff.version}</div>`;
        }
    })
    if(!user.token) {
        document.getElementsByClassName("justcenter")[0].innerHTML = "No API key provided. Check settings";
    } else {
        request.get(`https://osu.ppy.sh/api/get_scores?${querystring.stringify({k: user.token, b: diffs[diffselected].id, limit: 50})}`, function(err, res, body) {
            body = JSON.parse(body);
            if(body.error) {
                document.getElementsByClassName("justcenter")[0].innerHTML = "Invalid API key.";
            } else {
                let table = "";
                body.forEach((score, ind) => {
                    console.log(score.enabled_mods)
                    let object = {
                        300: score.count300,
                        100: score.count100,
                        50: score.count50,
                        miss: score.countmiss
                    }
                    let acc = Math.round((parseInt(object["300"]) * 6 + parseInt(object["100"]) * 2 + parseInt(object["50"])) / (parseInt(object["300"]) * 6 + parseInt(object["100"]) * 6 + parseInt(object["50"]) * 6 + parseInt(object.miss*6)) * 10000) / 100;
                    table+=`<tr>
                        <th scope="row">#${ind+1}</th>
                        <td>${score.rank}</td>
                        <td>${score.score}</td>
                        <td>${acc}%</td>
                        <td>${score.username}</td>
                        <td>${score.maxcombo}x</td>
                        <td>${object['300']}/${object['100']}/${object['50']}/${object.miss}</td>
                        <td>${Math.round(Number(score.pp))}</td>
                        <td>${parseMods(parseInt(score.enabled_mods))}</td>
                    </tr>`
                })
                document.getElementById("topplays").innerHTML = table;
            }                                                
        })
    }
    document.getElementsByClassName('star')[0].innerHTML = `<i style="margin-right: 5px;" class="fas fa-star"></i> ${mapset.beatmaps[diffselected].difficulty_rating.toPrecision(3)}`;
    document.getElementsByClassName('ar')[0].innerHTML = `AR: ${mapset.beatmaps[diffselected].ar}`;
    document.getElementsByClassName('cs')[0].innerHTML = `CS: ${mapset.beatmaps[diffselected].cs}`;
    document.getElementsByClassName('od')[0].innerHTML = `OD: ${mapset.beatmaps[diffselected].accuracy}`;
    document.getElementsByClassName('hp')[0].innerHTML = `HP: ${mapset.beatmaps[diffselected].drain}`;
    bpmwithoutdt = Number(document.getElementsByClassName('bpm')[0].innerHTML.split(" ")[1])
    updatePP(mapset.beatmaps[diffselected].id);
    document.getElementById('browser').style.display = "flex";
    setTimeout(function () {
        document.getElementById('browser-window').style.opacity = "1";
        document.getElementById('browser-window').style.transform = "scale(1)";
    }, 100)
    console.log(mapset);
}

function changeDiff(diffind, star, ar, cs, od, hp, id) {
    document.getElementsByClassName('map-diff')[diffselected].className = "map-diff";
    diffselected = diffind;
    document.getElementsByClassName('map-diff')[diffind].className = "map-diff diff-selected";
    document.getElementsByClassName('star')[0].innerHTML = `<i style="margin-right: 5px;" class="fas fa-star"></i> ${star}`;
    document.getElementsByClassName('ar')[0].innerHTML = `AR: ${ar}`;
    document.getElementsByClassName('cs')[0].innerHTML = `CS: ${cs}`;
    document.getElementsByClassName('od')[0].innerHTML = `OD: ${od}`;
    document.getElementsByClassName('hp')[0].innerHTML = `HP: ${hp}`;
    if(!user.token) {
        document.getElementsByClassName("justcenter")[0].innerHTML = "No API key provided. Check settings";
    } else {
        request.get(`https://osu.ppy.sh/api/get_scores?${querystring.stringify({k: user.token, b: id, limit: 50})}`, function(err, res, body) {
            body = JSON.parse(body);
            if(body.error) {
                document.getElementsByClassName("justcenter")[0].innerHTML = "Invalid API key.";
            } else {
                let table = "";
                body.forEach((score, ind) => {
                    console.log(score.enabled_mods)
                    let object = {
                        300: score.count300,
                        100: score.count100,
                        50: score.count50,
                        miss: score.countmiss
                    }
                    let acc = Math.round((parseInt(object["300"]) * 6 + parseInt(object["100"]) * 2 + parseInt(object["50"])) / (parseInt(object["300"]) * 6 + parseInt(object["100"]) * 6 + parseInt(object["50"]) * 6 + parseInt(object.miss*6)) * 10000) / 100;
                    table+=`<tr>
                        <th scope="row">#${ind+1}</th>
                        <td>${score.rank}</td>
                        <td>${score.score}</td>
                        <td>${acc}%</td>
                        <td>${score.username}</td>
                        <td>${score.maxcombo}x</td>
                        <td>${object['300']}/${object['100']}/${object['50']}/${object.miss}</td>
                        <td>${Math.round(Number(score.pp))}</td>
                        <td>${parseMods(parseInt(score.enabled_mods))}</td>
                    </tr>`
                })
                document.getElementById("topplays").innerHTML = table;
            }                                                
        })
    }
    updatePP(id);
}

function closebrowser() {
    document.getElementById('browser-window').style.opacity = "0";
    document.getElementById('browser-window').style.transform = "scale(1.1)";
    setTimeout(function () {
        document.getElementById('browser').style.display = "none";            
    }, 500)
}

let hr = 0;
let hd = 0;
let fl = 0;
let dt = 0;

let ppcalcend = 0;

let lastbeatmaps = "";

function updatePP(beatmap) {
    let mods = 0;
    ppcalcend++;
    lastbeatmaps = beatmap;
    if(hr == 1) mods += 16;
    if(hd == 1) mods += 8;
    if(fl == 1) mods += 1024;
    if(dt == 1) {
        mods += 64; 
        document.getElementsByClassName('bpm')[0].innerHTML = `BPM: ${bpmwithoutdt*1.5}`;
    } else {
        document.getElementsByClassName('bpm')[0].innerHTML = `BPM: ${bpmwithoutdt}`;
    }
    if(fs.existsSync(`./cached/${beatmap}.osu`)) {
        var parser = new ojsama.parser();
        readline.createInterface({
            input: fs.createReadStream(`./cached/${beatmap}.osu`)
        }).on("line", parser.feed_line.bind(parser))
        .on("close", function() {
            var map = parser.map;
            var stars = new ojsama.diff().calc({map: map, mods: mods});
            let mapstats = new ojsama.std_beatmap_stats({ar: map.ar, od: map.od, cs: map.cs, hp: map.hp})
            .with_mods(mods);
            document.getElementsByClassName('star')[0].innerHTML = `<i style="margin-right: 5px;" class="fas fa-star"></i> ${stars.total.toPrecision(3)}`;
            document.getElementsByClassName('ar')[0].innerHTML = `AR: ${mapstats.ar.toPrecision(3)}`;
            document.getElementsByClassName('cs')[0].innerHTML = `CS: ${mapstats.cs.toPrecision(3)}`;
            document.getElementsByClassName('od')[0].innerHTML = `OD: ${mapstats.od.toPrecision(3)}`;
            document.getElementsByClassName('hp')[0].innerHTML = `HP: ${mapstats.hp.toPrecision(3)}`;
            var pp = Math.round(ojsama.ppv2({
                stars: stars,
                combo: map.max_combo(),
                nmiss: 0,
                acc_percent: Number(document.getElementById('accuracy-pp').value.replace("%", ""))
            }).total);
            document.getElementById('pp-output').innerHTML = `= ${pp}pp`;
            ppcalcend = 0;
        })
    } else {
        request.get(`https://osu.ppy.sh/osu/${beatmap}`, function (err, res, body) {
            fs.writeFileSync(`./cached/${beatmap}.osu`, body)
            var parser = new ojsama.parser();
            readline.createInterface({
                input: fs.createReadStream(`./cached/${beatmap}.osu`)
            }).on("line", parser.feed_line.bind(parser))
            .on("close", function() {
                var map = parser.map;
                var stars = new ojsama.diff().calc({map: map, mods: mods});
                let mapstats = new ojsama.std_beatmap_stats({ar: map.ar, od: map.od, cs: map.cs, hp: map.hp})
                .with_mods(mods);
                var pp = Math.round(ojsama.ppv2({
                    stars: stars,
                    combo: map.max_combo(),
                    nmiss: 0,
                    acc_percent: Number(document.getElementById('accuracy-pp').value.replace("%", ""))
                }).total);
                document.getElementById('pp-output').innerHTML = `= ${pp}pp`;
                ppcalcend = 0;
            })
        })
    }
}

function accchange() {
    if(ppcalcend == 0) {
        updatePP(lastbeatmaps);
    }
}

function switchMod(mod) {
    if(eval(`${mod} == 0`)) {
        document.getElementsByClassName(mod)[0].classList.add('mode-selected');
        eval(`${mod} = 1`)
    } else {
        document.getElementsByClassName(mod)[0].classList.remove('mode-selected');
        eval(`${mod} = 0`)
    }
    updatePP(lastbeatmaps)
}

function saveToken() {
    user = {
        username: document.getElementById("username").value,
        password: document.getElementById("password").value,
        token: document.getElementById("token").value
    }
    fs.writeFileSync("./loginData.json", JSON.stringify(user));
}

function changeDLDir() {
    var path = remote.dialog.showOpenDialog({title: 'Choose osu!/Songs directory', properties: ['openDirectory']});
    fs.writeFileSync("downloadDirectory.txt", path);
    dlPath = path.replace('\\', '/');
}

function saveDLs() {
    var path = remote.dialog.showSaveDialog({title: "Save downloaded beatmaps list", filters: [{name: "JSON files", extensions: ['json']}]});
    fs.writeFileSync(path, JSON.stringify(arrayOfDownloaded));
}

function loadDLs() {
    //var path = remote.dialog.showOpenDialog({title: 'Load beatmapsets list', filters: [{name: "JSON files", extensions: ['json']}, properties: ['openFile']]});
    //var bms = JSON.parse(fs.readFileSync(path).toString());
    //
    
}