var { remote, ipcRenderer: ipc } = require('electron');
var fs = require('fs');

var $ = require('jquery');
require('bootstrap');

var items = {
    difficulty: fs.readFileSync("./assets/items/diff.html").toString(),
    mapset: fs.readFileSync("./assets/items/mapset.html").toString(),
    video: fs.readFileSync("./assets/items/diff.html").toString()
};

String.prototype.rpl = function(obj) {
    var res = this;
    for(var key in obj) {
        res = res.split(`{${key}}`).join(obj[key]);
    }
    return res;
};

$(document).ready(function() {
    ipc.send('mainWindowLoaded', true);
    
    search();

    $(".close").click(function() {
        remote.getCurrentWindow().close();
    });

    $(".minimize").click(function() {
        remote.getCurrentWindow().minimize();
    });

    $('[data-toggle="tooltip"]').tooltip({html: true});
});

/* Requesting */

function search() {
    var query = {};
    //
}

/* Processing */