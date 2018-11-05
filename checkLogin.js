var fs = require('fs');
const { remote } = require('electron');

if(!fs.existsSync("./ignored.json")) fs.writeFileSync("./ignored.json", "[]");

if(fs.existsSync("./loginData.json")) {
	// let mainWindow = new BrowserWindow({width: 200, height: 100, frame: false, icon: __dirname + '/icon.ico'});
	// mainWindow.setResizable(false);
	// mainWindow.setFullScreenable(false);
	// mainWindow.loadFile("index.html");
	// window.close();
	let mainWindow = remote.getCurrentWindow();
	mainWindow.setSize(200, 100);
	mainWindow.loadFile('index.html');
}