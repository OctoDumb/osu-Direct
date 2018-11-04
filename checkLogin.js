var fs = require('fs');
const { BrowserWindow } = require('electron').remote;

if(!fs.existsSync("./ignored.json")) fs.writeFileSync("./ignored.json", "[]");

if(fs.existsSync("./loginData.json")) {
	let mainWindow = new BrowserWindow({width: 200, height: 100, frame: false, icon: __dirname + '/icon.ico'});
	mainWindow.setResizable(false);
	mainWindow.setFullScreenable(false);
	mainWindow.loadFile("index.html");
	window.close();
}