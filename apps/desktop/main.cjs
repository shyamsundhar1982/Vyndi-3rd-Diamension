const { app, BrowserWindow, shell } = require("electron");
const path=require("path");

function createWindow(){
  const win=new BrowserWindow({
    width:1540,height:980,minWidth:1120,minHeight:720,
    backgroundColor:"#090c0e",title:"VYNDI 3rd Diamension",autoHideMenuBar:true,
    webPreferences:{contextIsolation:true,nodeIntegration:false,sandbox:true}
  });
  win.loadFile(path.join(__dirname,"..","web","index.html"));
  win.webContents.setWindowOpenHandler(({url})=>{shell.openExternal(url);return {action:"deny"};});
}
app.whenReady().then(createWindow);
app.on("window-all-closed",()=>app.quit());
