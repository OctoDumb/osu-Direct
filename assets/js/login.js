var { remote, ipcRenderer: ipc } = require('electron');

var $ = require('jquery');

$(document).ready(function() {
    ipc.send('mainWindowLoaded', true);

    $("#login-form").submit(e => {
        e.preventDefault();
    });

    $(".minimize").click(function() {
        ipc.send('tray');
    });

    $(".cclose").click(function() {
        remote.getCurrentWindow().close();
    });

    $("#login-btn").click(function(e) {
        e.preventDefault();
        $(".status").html('<div class="spinner-border" style="width:40px;height:40px;" role="status"></div>');
        let logged = ipc.sendSync('login', {u: $("#usernameInput").val(), p: $("#passwordInput").val()});
        if(logged) {
            $(".status").html('<div class="alert alert-success" role="alert">Successfully logged in!</div>');
        } else {
            $(".status").html('<div class="alert alert-danger" role="alert">An error occured! Check your data and try again!</div>');
        }
    });
});

function passwordVisible() {
    if($("#passwordInput").attr("type") == "password") {
        $("#passwordInput").attr("type", "text");
    } else {
        $("#passwordInput").attr("type", "password");
    }
    $("#passVis").toggleClass("fa-eye").toggleClass("fa-eye-slash");
}