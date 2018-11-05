const { remote } = require('electron');
var search = location.search.substring(1);
let data = JSON.parse('{"' + search.replace(/&/g, '","').replace(/=/g,'":"') + '"}', function(key, value) { return key===""?value:decodeURIComponent(value) });
if(!data.username | !data.password) {
	window.history.back();
} else {
	// let mainWindow = new BrowserWindow({width: 200, height: 100, frame: false, transparent: true});
	// mainWindow.setResizable(false);
	// mainWindow.setFullScreenable(false);
	// mainWindow.loadFile("index.html");
	let mainWindow = remote.getCurrentWindow();
	mainWindow.setSize(200, 100);
	mainWindow.loadFile('index.html');
	var fs = require('fs');
	fs.writeFileSync("./loginData.json", JSON.stringify({username: data.username, password: data.password}));
	//window.close();
}