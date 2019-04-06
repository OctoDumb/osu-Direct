var { remote, ipcRenderer: ipc } = require('electron');

var $ = require('jquery');
require('bootstrap');
  
$(document).ready(function() {
    ipc.send('mainWindowLoaded', true);
    $(".minimize").click(() => {
        remote.getCurrentWindow().minimize();
    });
    $(".cclose").click(() => {
        remote.getCurrentWindow().close();
    });
    $(document).keydown(function(e) {
        if($("#songs-folder").is(':focus'))
            e.preventDefault();
    });
    $("#songs-folder-btn").click(function(e) {
        e.preventDefault();
        var path = remote.dialog.showOpenDialog({title: "Choose osu! folder", properties: ['openDirectory']})[0];
        path = path.split("\\").join("/");
        $("#songs-folder").val(path);
    });
    $("#use-token-cb").change(function() {
        if(!$("#token").attr("disabled")) {
            $("#token").attr("disabled", "disabled");
        } else {
            $("#token").removeAttr("disabled");
        }
    });
    $("#token-help").click(function() {
        $("#token-modal").modal('show');
    });
    $("#setup-btn").click(function() {
        let setup = {
            osu: $("#songs-folder").val(),
            useToken: $("#use-token-cb").is(':checked'),
            token: $("#token").val().toLowerCase()
        };
        if(!setup.osu) return;
        if(setup.useToken && !setup.token) return;
        $(this).html('<i class="fas fa-cog fa-spin"></i>').attr("disabled", "disabled");
        ipc.send('setup', setup);
    });
});

ipc.on('setup-err', (event, err) => {
    $("#setup-btn").text("Start!").removeAttr("disabled");
});