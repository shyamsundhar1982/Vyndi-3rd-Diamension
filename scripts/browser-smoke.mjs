import { chromium } from "playwright";

const browser=await chromium.launch({headless:true,args:["--use-gl=swiftshader","--enable-webgl","--ignore-gpu-blocklist"]});
const page=await browser.newPage({viewport:{width:1600,height:1000}});
const errors=[],networkErrors=[];
page.on("pageerror",error=>errors.push(String(error)));
page.on("console",message=>{if(message.type()==="error")errors.push(message.text())});
page.on("response",response=>{if(response.status()>=400)networkErrors.push(response.status()+" "+response.url())});
page.on("requestfailed",request=>networkErrors.push("FAILED "+request.url()+" "+(request.failure()?.errorText||"")));

try{
  await page.goto("http://127.0.0.1:8765/apps/web/index.html",{waitUntil:"networkidle",timeout:60000});
  await page.waitForFunction(()=>document.readyState==="complete");
  const gpx=`<gpx version="1.1"><trk><name>VYNDI ICONIC TEST</name><trkseg>
  <trkpt lat="10.0000" lon="76.0000"><ele>100</ele><time>2026-10-02T00:00:00Z</time></trkpt>
  <trkpt lat="10.0100" lon="76.0100"><ele>160</ele><time>2026-10-02T00:10:00Z</time></trkpt>
  <trkpt lat="10.0200" lon="76.0200"><ele>140</ele><time>2026-10-02T00:20:00Z</time></trkpt>
  </trkseg></trk></gpx>`;
  await page.setInputFiles("#gpxInput",{name:"iconic.gpx",mimeType:"application/gpx+xml",buffer:Buffer.from(gpx)});
  try{
    await page.waitForFunction(()=>document.querySelector("#ribbonEvent")?.textContent==="VYNDI ICONIC TEST",null,{timeout:10000});
    await page.waitForFunction(()=>document.querySelector("#ribbonPoints")?.textContent==="3 PTS",null,{timeout:10000});
  }catch(error){
    const state=await page.evaluate(()=>({
      event:document.querySelector("#ribbonEvent")?.textContent,
      points:document.querySelector("#ribbonPoints")?.textContent,
      production:document.querySelector("#productionStatus")?.textContent,
      ready:document.readyState
    }));
    throw new Error("GPX ribbon did not update · "+JSON.stringify({state,errors,networkErrors,cause:String(error)}));
  }
  const paletteKeys=await page.locator("[data-palette]").evaluateAll(nodes=>[...new Set(nodes.map(node=>node.dataset.palette))]);
  for(const key of ["land","forest","mountain","snow","water","route","roads","labels","rim"]){
    if(!paletteKeys.includes(key))throw new Error("Missing terrain palette control: "+key);
  }
  for(const id of ["routeStyle","forestRaise","waterDepth","printerProfile","contourEnabled","magnetEnabled","hangerEnabled","tileEnabled","placeLabelMode","downloadPrintPackage","issueAuthenticity"]){
    if(!await page.locator("#"+id).count())throw new Error("Missing full-union control: "+id);
  }
  await page.waitForFunction(()=>{
    const viewer=document.querySelector("#liveModelViewer");
    const status=document.querySelector("#livePreviewStatus")?.textContent||"";
    return Boolean(viewer?.src)&&status.includes("LIVE 3D READY");
  },null,{timeout:60000});
  await page.waitForFunction(()=>{
    const viewer=document.querySelector("#liveModelViewer");
    return viewer?.loaded===true && viewer?.modelIsVisible===true;
  },null,{timeout:30000});
  await page.waitForTimeout(1000);
  await page.screenshot({path:"vyndi-3rd-diamension-studio.png",fullPage:true});

  await page.click("#engineTrailRelief");
  await page.waitForFunction(()=>document.querySelector("#sourceEngineFrame")?.getAttribute("src")==="engines/trailrelief/index.html",null,{timeout:10000});
  const sourceFrame=page.frameLocator("#sourceEngineFrame");
  const trailTitle=await sourceFrame.locator("body").evaluate(()=>document.title);
  if(trailTitle!=="TrailRelief")throw new Error("TrailRelief source engine did not load its original document.");
  await page.waitForTimeout(5000);
  const trailButtons=await sourceFrame.locator("button").allTextContents();
  const trailBody=await sourceFrame.locator("body").innerText();
  const demoButton=sourceFrame.getByRole("button",{name:/Demo/i}).first();
  if(!await demoButton.count())throw new Error("TrailRelief source UI did not mount · buttons="+JSON.stringify(trailButtons)+" · body="+trailBody.slice(0,600)+" · browser="+errors.join(" | "));
  await demoButton.click();
  await sourceFrame.locator("canvas").first().waitFor({state:"visible",timeout:60000});

  await page.click("#engineVyndi");
  await page.waitForFunction(()=>document.querySelector("#sourceEngineFrame")?.getAttribute("src")==="engines/vyndi-medal/terrain-medal.html",null,{timeout:10000});
  await sourceFrame.locator("#medalCanvas").waitFor({state:"visible",timeout:30000});
  const vyndiTitle=await sourceFrame.locator("body").evaluate(()=>document.title);
  if(!vyndiTitle.includes("Terrain Medal"))throw new Error("VYNDI source engine did not load its original terrain-medal document.");

  await page.click("#engineUnified");
  await page.waitForFunction(()=>!document.querySelector("#sourceStage")?.classList.contains("active"),null,{timeout:10000});
  await page.click("#openAdvanced");
  await page.waitForFunction(()=>document.querySelector("#advancedDrawer")?.classList.contains("open"));
  const labels=await page.locator("#advancedDrawer summary").allTextContents();
  for(const expected of ["DEM & elevation","Map layers","Shape & branding","Fabrication","Export & validation"]){
    if(!labels.includes(expected))throw new Error("Missing Advanced section: "+expected);
  }
  if(errors.length)throw new Error("Browser errors: "+errors.join(" | "));
  console.log("BROWSER PASS · unified + exact TrailRelief + exact VYNDI terrain engines + Advanced workbench");
}finally{
  await browser.close();
}
