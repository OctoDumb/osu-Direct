const ipc = require('electron').ipcRenderer;
const { remote } = require('electron')
var querystring = require('querystring');
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
var loaded = false;

let hint = 0;

let nID = 1;

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

let start = 0;

let volume = 0.2;

let localUserCheck;

let cancel = 0;

var arrayOfDownloaded = [];
rawDirs.forEach(dirr => {
    if(dirr.indexOf(".osz") == -1) arrayOfDownloaded.push(Number(dirr.split("n").join("").split(" ")[0]))
    else arrayOfDownloaded.push(Number(dirr.split(" ")[0]));
})


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
    localUserCheck = body.split("localUserCheck = \"")[1].split("\";")[0];
    document.getElementById("maplist").innerHTML = "<h2>Authorized</h2>"
    searchBeatmapsets();
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

function searchBeatmapsets() {
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
    document.getElementById('more-op').style.display = "flex";
    document.getElementById('category').style.display = "none";
    document.getElementById('category-2').style.display = "none";
    document.getElementById('category-3').style.display = "none";
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
            let stats = statsStar && statsAr && statsOd && statsCs && statsHp;
            let downloadedIgnored = arrayOfDownloaded.indexOf(beatmapset.id) == -1;
            if(document.getElementById('search-downloaded').checked) downloadedIgnored = true;
            if(downloadedIgnored && ignored.indexOf(beatmapset.id) == -1 && stats) {
                let difficulties = "";
                if(diffs.length > 11) {
                    var nowmode = 0;
                    var count = 0;
                    diffs.forEach((diff, ind) => {
                        if(nowmode == diff.mode_int) {
                            count++;
                        } else {
                            if(count != 0) {
                                switch(nowmode) {
                                    case 0: {
                                        difficulties+=`<div title="${diffs[ind-1].difficulty_rating.toPrecision(3)}★ \nAR:${diffs[ind-1].ar} OD:${diffs[ind-1].accuracy} CS:${diffs[ind-1].cs} HP:${diffs[ind-1].drain}" class="diff2"><i style="color: ${getDiffColor(diffs[ind-1].difficulty_rating)}" class="fal fa-extra-mode-osu"></i> ${count}</div>`;
                                        break;
                                    }
                                    case 1: {
                                        difficulties+=`<div title="${diffs[ind-1].difficulty_rating.toPrecision(3)}★ \nAR:${diffs[ind-1].ar} OD:${diffs[ind-1].accuracy} CS:${diffs[ind-1].cs} HP:${diffs[ind-1].drain}" class="diff2"><i style="color: ${getDiffColor(diffs[ind-1].difficulty_rating)}" class="fal fa-extra-mode-taiko"></i> ${count}</div>`;
                                        break;
                                    }
                                    case 2: {
                                        difficulties+=`<div title="${diffs[ind-1].difficulty_rating.toPrecision(3)}★ \nAR:${diffs[ind-1].ar} OD:${diffs[ind-1].accuracy} CS:${diffs[ind-1].cs} HP:${diffs[ind-1].drain}" class="diff2"><i style="color: ${getDiffColor(diffs[ind-1].difficulty_rating)}" class="fal fa-extra-mode-fruits"></i> ${count}</div>`;
                                        break;
                                    }
                                    case 3: {
                                        difficulties+=`<div title="${diffs[ind-1].difficulty_rating.toPrecision(3)}★ \nAR:${diffs[ind-1].ar} OD:${diffs[ind-1].accuracy} CS:${diffs[ind-1].cs} HP:${diffs[ind-1].drain}" class="diff2"><i style="color: ${getDiffColor(diffs[ind-1].difficulty_rating)}" class="fal fa-extra-mode-mania"></i> ${count}</div>`;
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
                            difficulties+=`<div title="${diffs[diffs.length-1].difficulty_rating.toPrecision(3)}★ \nAR:${diffs[diffs.length-1].ar} OD:${diffs[diffs.length-1].accuracy} CS:${diffs[diffs.length-1].cs} HP:${diffs[diffs.length-1].drain}" class="diff2"><i style="color: ${getDiffColor(diffs[diffs.length-1].difficulty_rating)}" class="fal fa-extra-mode-osu"></i> ${count}</div>`;
                            break;
                        }
                        case 1: {
                            difficulties+=`<div title="${diffs[diffs.length-1].difficulty_rating.toPrecision(3)}★ \nAR:${diffs[diffs.length-1].ar} OD:${diffs[diffs.length-1].accuracy} CS:${diffs[diffs.length-1].cs} HP:${diffs[diffs.length-1].drain}" class="diff2"><i style="color: ${getDiffColor(diffs[diffs.length-1].difficulty_rating)}" class="fal fa-extra-mode-taiko"></i> ${count}</div>`;
                            break;
                        }
                        case 2: {
                            difficulties+=`<div title="${diffs[diffs.length-1].difficulty_rating.toPrecision(3)}★ \nAR:${diffs[diffs.length-1].ar} OD:${diffs[diffs.length-1].accuracy} CS:${diffs[diffs.length-1].cs} HP:${diffs[diffs.length-1].drain}" class="diff2"><i style="color: ${getDiffColor(diffs[diffs.length-1].difficulty_rating)}" class="fal fa-extra-mode-fruits"></i> ${count}</div>`;
                            break;
                        }
                        case 3: {
                            difficulties+=`<div title="${diffs[diffs.length-1].difficulty_rating.toPrecision(3)}★ \nAR:${diffs[diffs.length-1].ar} OD:${diffs[diffs.length-1].accuracy} CS:${diffs[diffs.length-1].cs} HP:${diffs[diffs.length-1].drain}" class="diff2"><i style="color: ${getDiffColor(diffs[diffs.length-1].difficulty_rating)}" class="fal fa-extra-mode-mania"></i> ${count}</div>`;
                            break;
                        }
                    }
                } else {
                    diffs.forEach(diff => {
                        difficulties+=`<i title="${diff.version} ${diff.difficulty_rating.toPrecision(3)}★ \nAR:${diff.ar} OD:${diff.accuracy} CS:${diff.cs} HP:${diff.drain}" style="color: ${getDiffColor(diff.difficulty_rating)}" class="fal diff fa-extra-mode-${diff.mode}"></i>`;
                    })
                }
                let favor = 'style="transform: scale(0.95);" onclick="favouriteBeatmapset('+ beatmapset.id +')" class="fas favor-' + beatmapset.id + ' fa-heart"';
                if(beatmapset.has_favourited == true) {
                    favor = 'style="transform: scale(0.95); color: rgb(209, 0, 108)" onclick="unfavouriteBeatmapset('+ beatmapset.id +');" class="fas favor-' + beatmapset.id + ' fa-heart"';
                }
                maplist+=`<div class="map" id="mapset-${beatmapset.id}">
                    <div class="map-header">
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
            let stats = statsStar && statsAr && statsOd && statsCs && statsHp;
            let downloadedIgnored = arrayOfDownloaded.indexOf(beatmapset.id) == -1;
            if(document.getElementById('search-downloaded').checked) downloadedIgnored = true;
            if(downloadedIgnored && ignored.indexOf(beatmapset.id) == -1 && stats) {
                let difficulties = "";
                if(diffs.length > 11) {
                    var nowmode = 0;
                    var count = 0;
                    diffs.forEach((diff, ind) => {
                        if(nowmode == diff.mode_int) {
                            count++;
                        } else {
                            if(count != 0) {
                                switch(nowmode) {
                                    case 0: {
                                        difficulties+=`<div title="${diffs[ind-1].difficulty_rating.toPrecision(3)}★ \nAR:${diffs[ind-1].ar} OD:${diffs[ind-1].accuracy} CS:${diffs[ind-1].cs} HP:${diffs[ind-1].drain}" class="diff2"><i style="color: ${getDiffColor(diffs[ind-1].difficulty_rating)}" class="fal fa-extra-mode-osu"></i> ${count}</div>`;
                                        break;
                                    }
                                    case 1: {
                                        difficulties+=`<div title="${diffs[ind-1].difficulty_rating.toPrecision(3)}★ \nAR:${diffs[ind-1].ar} OD:${diffs[ind-1].accuracy} CS:${diffs[ind-1].cs} HP:${diffs[ind-1].drain}" class="diff2"><i style="color: ${getDiffColor(diffs[ind-1].difficulty_rating)}" class="fal fa-extra-mode-taiko"></i> ${count}</div>`;
                                        break;
                                    }
                                    case 2: {
                                        difficulties+=`<div title="${diffs[ind-1].difficulty_rating.toPrecision(3)}★ \nAR:${diffs[ind-1].ar} OD:${diffs[ind-1].accuracy} CS:${diffs[ind-1].cs} HP:${diffs[ind-1].drain}" class="diff2"><i style="color: ${getDiffColor(diffs[ind-1].difficulty_rating)}" class="fal fa-extra-mode-fruits"></i> ${count}</div>`;
                                        break;
                                    }
                                    case 3: {
                                        difficulties+=`<div title="${diffs[ind-1].difficulty_rating.toPrecision(3)}★ \nAR:${diffs[ind-1].ar} OD:${diffs[ind-1].accuracy} CS:${diffs[ind-1].cs} HP:${diffs[ind-1].drain}" class="diff2"><i style="color: ${getDiffColor(diffs[ind-1].difficulty_rating)}" class="fal fa-extra-mode-mania"></i> ${count}</div>`;
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
                            difficulties+=`<div title="${diffs[diffs.length-1].difficulty_rating.toPrecision(3)}★ \nAR:${diffs[diffs.length-1].ar} OD:${diffs[diffs.length-1].accuracy} CS:${diffs[diffs.length-1].cs} HP:${diffs[diffs.length-1].drain}" class="diff2"><i style="color: ${getDiffColor(diffs[diffs.length-1].difficulty_rating)}" class="fal fa-extra-mode-osu"></i> ${count}</div>`;
                            break;
                        }
                        case 1: {
                            difficulties+=`<div title="${diffs[diffs.length-1].difficulty_rating.toPrecision(3)}★ \nAR:${diffs[diffs.length-1].ar} OD:${diffs[diffs.length-1].accuracy} CS:${diffs[diffs.length-1].cs} HP:${diffs[diffs.length-1].drain}" class="diff2"><i style="color: ${getDiffColor(diffs[diffs.length-1].difficulty_rating)}" class="fal fa-extra-mode-taiko"></i> ${count}</div>`;
                            break;
                        }
                        case 2: {
                            difficulties+=`<div title="${diffs[diffs.length-1].difficulty_rating.toPrecision(3)}★ \nAR:${diffs[diffs.length-1].ar} OD:${diffs[diffs.length-1].accuracy} CS:${diffs[diffs.length-1].cs} HP:${diffs[diffs.length-1].drain}" class="diff2"><i style="color: ${getDiffColor(diffs[diffs.length-1].difficulty_rating)}" class="fal fa-extra-mode-fruits"></i> ${count}</div>`;
                            break;
                        }
                        case 3: {
                            difficulties+=`<div title="${diffs[diffs.length-1].difficulty_rating.toPrecision(3)}★ \nAR:${diffs[diffs.length-1].ar} OD:${diffs[diffs.length-1].accuracy} CS:${diffs[diffs.length-1].cs} HP:${diffs[diffs.length-1].drain}" class="diff2"><i style="color: ${getDiffColor(diffs[diffs.length-1].difficulty_rating)}" class="fal fa-extra-mode-mania"></i> ${count}</div>`;
                            break;
                        }
                    }
                } else {
                    diffs.forEach(diff => {
                        difficulties+=`<i title="${diff.version} ${diff.difficulty_rating.toPrecision(3)}★ \nAR:${diff.ar} OD:${diff.accuracy} CS:${diff.cs} HP:${diff.drain}" style="color: ${getDiffColor(diff.difficulty_rating)}" class="fal diff fa-extra-mode-${diff.mode}"></i>`;
                    })
                }
                let favor = 'style="transform: scale(0.95);" onclick="favouriteBeatmapset('+ beatmapset.id +')" class="fas favor-' + beatmapset.id + ' fa-heart"';
                if(beatmapset.has_favourited == true) {
                    favor = 'style="transform: scale(0.95); color: rgb(209, 0, 108)" onclick="unfavouriteBeatmapset('+ beatmapset.id +');" class="fas favor-' + beatmapset.id + ' fa-heart"';
                }
                maplist+=`<div class="map" id="mapset-${beatmapset.id}">
                    <div class="map-header">
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
    if(document.getElementById('search-novideo').checked) id = id + "n";
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
        arrayOfDownloaded.push(id);
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
        })
    })
}

function checkDL(event) {
    if(event.keyCode == 13) {
        searchBeatmapsets();
        event.preventDefault()
    } else return true;
}

function openOptions() {
    document.getElementById('more-op').style.display = "none";
    document.getElementById('category').style.display = "flex";
    document.getElementById('category-2').style.display = "flex";
    document.getElementById('category-3').style.display = "flex";
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

function outputStarUpdate(vol) {
    document.querySelector('#output-star').innerHTML = "Star " + starznak + " " + document.querySelector('#search-star').value + "*";
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