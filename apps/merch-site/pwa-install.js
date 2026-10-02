let deferredInstallPrompt=null;
const installButtons=()=>document.querySelectorAll("[data-pwa-install]");
const iosNotes=()=>document.querySelectorAll("[data-pwa-ios]");
const isStandalone=()=>window.matchMedia("(display-mode: standalone)").matches||window.navigator.standalone===true;
const isIos=()=>/iphone|ipad|ipod/i.test(navigator.userAgent);
function syncInstallUi(){
  if(isStandalone()){installButtons().forEach(node=>node.hidden=true);iosNotes().forEach(node=>node.hidden=true);return;}
  installButtons().forEach(node=>node.hidden=!deferredInstallPrompt);
  iosNotes().forEach(node=>node.hidden=!(isIos()&&!deferredInstallPrompt));
}
window.addEventListener("beforeinstallprompt",event=>{event.preventDefault();deferredInstallPrompt=event;syncInstallUi();});
window.addEventListener("appinstalled",()=>{deferredInstallPrompt=null;syncInstallUi();});
document.addEventListener("click",async event=>{const button=event.target.closest("[data-pwa-install]");if(!button||!deferredInstallPrompt)return;deferredInstallPrompt.prompt();await deferredInstallPrompt.userChoice;deferredInstallPrompt=null;syncInstallUi();});
if("serviceWorker" in navigator)window.addEventListener("load",()=>navigator.serviceWorker.register("/sw.js").catch(()=>{}));
syncInstallUi();