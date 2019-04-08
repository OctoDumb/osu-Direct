var { remote, ipcRenderer: ipc } = require('electron');
var fs = require('fs');

var $ = require('jquery');
require('bootstrap');

var shownMapsets = {};

var items = {
    difficulty: fs.readFileSync("./assets/items/diff.html").toString(),
    mapset: fs.readFileSync("./assets/items/mapset.html").toString(),
    video: fs.readFileSync("./assets/items/video.html").toString(),
    toast: fs.readFileSync("./assets/items/toast.html").toString(),
    queue: fs.readFileSync("./assets/items/queue.html").toString()
};

String.prototype.rpl = function(obj) {
    var res = this;
    for(var key in obj) {
        res = res.split(`{${key}}`).join(obj[key]);
    }
    return res;
};

Number.prototype.roundTo = function(n) {
    return Math.round(this * (10 ** n)) / (10 ** n);
};

function sortDiffs(a,b) {
    if(a.mode_int > b.mode_int) 
        return 1;
    else if(a.mode_int < b.mode_int)
        return -1;
    if(a.difficulty_rating > b.difficulty_rating)
        return 1;
    else if(a.difficulty_rating < b.difficulty_rating)
        return -1;
    return 0;
}

function diffName(stars) {
    if(stars < 2)
        return "easy";
    if(stars < 2.7)
        return "normal";
    if(stars < 4)
        return "hard";
    if(stars < 5.3)
        return "insane";
    if(stars < 6.5)
        return "expert";
    return "extreme";
}

function modeIcon(mode) {
    if(mode == 1)
        return "&#xE803;";
    if(mode == 2)
        return "&#xE801;";
    if(mode == 3)
        return "&#xE802;";
    return "&#xE800";
}

$(document).ready(function() {
    ipc.send('mainWindowLoaded', true);
    
    search({}, false);

    $(".cclose").click(function() {
        remote.getCurrentWindow().close();
    });

    $(".minimize").click(function() {
        ipc.send('tray');
    });

    $('[data-toggle="tooltip"]').tooltip({html: true});

    $('.search-send').click(function() {
        let query = {
            q: $('.search-input').val()
        };
        search(query, false);
    });
});

const toasts = {
    'e': ['#d00', 'Error'],
    'i': ['#00d', 'Info'],
    's': ['#0f0', 'Success']
};

function toast(type, message, title) {
    let toast = items.toast
        .rpl({
            color: toasts[type][0],
            title: title ? title : toasts[type][1],
            text: message
        });
    $(toast).appendTo("#toast-div").toast('show').on('hidden.bs.toast', function() {
        this.parentNode.removeChild(this);
    });
}

/* Requesting */

function search(opts, n) {
    var query = opts;
    ipc.send('search', [query, n]);
}

/* Processing */

ipc.on('search-result', (event, args) => {
    if(!args.done)
        return;
    if(!args.next) {
        $(".search-entries").html("");
        shownMapsets = {};
    }
    args.object.beatmapsets.forEach((set) => {
        shownMapsets[set.id] = {
            title: set.title,
            artist: set.artist
        };
        let diffs = [];
        set.beatmaps.sort(sortDiffs).forEach(diff => {
            diffs.push(items.difficulty.rpl({
                diff: diffName(diff.difficulty_rating),
                tooltipInfo: `<b>${diff.version.split('"').join("&quot;")}</b><br>${diff.difficulty_rating.roundTo(2)}`,
                icon: modeIcon(diff.mode_int)
            }));
        });
        let mapset = items.mapset
            .rpl({
                id: String(set.id),
                video: set.video ? items.video : "",
                status: set.status,
                plays: String(set.play_count),
                favs: String(set.favourite_count),
                title: set.title,
                artist: set.artist,
                creator: set.creator,
                source: set.source,
                isFav: set.has_favourited ? " heart-favourite" : "",
                favStatus: set.has_favourited ? "Unfavourite": "Favourite",
                diffs: diffs.join("")
            });
        $(".search-entries").append(mapset);
    });
    $('img').on('error', function() {
        $(this).replaceWith('<img style="width: 100%;" src="assets/default-bg.png">');
    });
    $('[data-toggle="tooltip"]').tooltip({html: true});
    $('.fav').click(function() {
        if($(this).hasClass('heart-pulse'))
            return;
        let id = $(this).attr("mapset");
        let s = $(this).hasClass('heart-favourite');
        $(this).addClass('heart-pulse');
        if($(this).hasClass('heart-favourite'))
            $(this).removeClass('heart-favourite');
        ipc.send('fav', {id: id, s: s, artist: shownMapsets[id].artist, title: shownMapsets[id].title});
    });
    $('.play-prev').click(function() {
        toast('e', "Previews are not implemented");
    });
    $('.dl').click(function() {
        let id = $(this).attr("mapset");
        ipc.send('dl', {id: id, artist: shownMapsets[id].artist, title: shownMapsets[id].title});
    });
});

ipc.on('toast', (event, args) => {
    toast(args.type, args.message, args.title);
});

ipc.on('addQueue', (event, args) => {
    let q = items.queue
        .rpl({
            id: args.id,
            title: args.title.split('"').join("&quot;")
        });
    $(q).appendTo(".queue");
});

ipc.on('updQueue', (event, args) => {
    $(`#q-pr-${args.id}`).css("width", args.p);
    $(`#q-pc-${args.id}`).text(args.p);
});

ipc.on('delQueue', (event, args) => {
    console.log(args);
    $(`#q-${args}`).remove();
});

ipc.on('setFav', (event, args) => {
    let h = $(`#f-${args.id}`);
    if(!h) return;
    if(h.hasClass('heart-pulse'))
        h.removeClass('heart-pulse');
    if(h.hasClass('heart-favourite'))
        h.removeClass('heart-favourite');
    if(args.f)
        h.addClass('heart-favourite');
});