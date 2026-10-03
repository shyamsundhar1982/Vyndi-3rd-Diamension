import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const html=readFileSync(new URL("../apps/web/index.html",import.meta.url),"utf8");
const app=readFileSync(new URL("../apps/web/app.mjs",import.meta.url),"utf8");

test("studio keeps TrailRelief simplicity with event and material ribbons",()=>{
  assert.match(html,/class="event-ribbon"/);
  assert.match(html,/class="material-ribbon"/);
  for(const name of ["Land","Forest","Mountain","Snow","Water","Route","Roads","Labels"])assert.match(html,new RegExp(">"+name+"<"));
});

test("event ribbon is data-driven from GPX rather than static copy",()=>{
  assert.match(app,/parseGpxText/);
  assert.match(app,/deriveRibbonMeta/);
  assert.match(app,/updateRibbon/);
});

test("advanced workbench preserves DEM map shape fabrication and export depth",()=>{
  for(const label of ["DEM & elevation","Map layers","Shape & branding","Fabrication","Export & validation"])assert.match(html,new RegExp(label.replace("&","&amp;|&")));
});

test("production GLB uses the proven self-hosted model-viewer path",()=>{
  assert.match(html,/<model-viewer\b/);
  assert.match(app,/import\("\.\/vendor\/model-viewer\.min\.js"\)/);
  assert.match(app,/modelViewer"\)\.src=state\.glbUrl/);
});

test("advanced DEM sources are wired as real file workflows",()=>{
  for(const id of ["geoTiffInput","arcInput","demSource"])assert.match(html,new RegExp('id="'+id+'"'));
  assert.match(app,/loadGeoTiffFile/);
  assert.match(app,/loadArcAsciiFile/);
  assert.match(app,/state\.demFile/);
  assert.match(app,/state\.arcFile/);
});

test("selected map layers feed the governed production model",()=>{
  assert.match(app,/loadOpenFreeMapCartography/);
  assert.match(app,/cartography/);
  assert.match(app,/mapEnabled/);
});


test("live terrain is a real canonical 3D model, not a decorative 2D canvas",()=>{
  assert.doesNotMatch(html,/id="terrainCanvas"/);
  assert.match(html,/id="liveModelViewer"/);
  assert.match(app,/generateLivePreview/);
  assert.match(app,/gpxPreviewSampler/);
  assert.match(app,/liveModelViewer"\)\.src=state\.previewUrl/);
});


test("Workbench keeps production diagnostics DOM contract and known-event personalization", () => {
  assert.match(html, /id="modelDiagnostics"/);
  assert.match(app, /KNOWN_EVENT_PROFILES/);
  assert.match(app, /Paris Brest Paris/i);
  assert.match(app, /I277/);
  assert.match(app, /Rambouillet/);
  assert.match(app, /applyKnownEventProfile/);
});


test("Workbench V2 preserves capability while progressively disclosing complexity",()=>{
  for(const token of ["SOURCE","EVENT","MAP","DESIGN","MAKE","GUIDED","PRO","featureSearch","eventSearch","eventResults","mapSuggestions","productChoices","authIdentity"]) assert.match(html,new RegExp(token));
  for(const id of ["gpxInput","geoSearch","geoJsonInput","shape","routeBufferKm","printerProfile","demSource","roads","trails","railways","buildings","logoInput","generate"]) assert.match(html,new RegExp('id="'+id+'"'));
});

test("GPX load drives editable metadata and automatic geography suggestions",()=>{
  assert.match(app,/suggestGeographyFromRoute/);
  assert.match(app,/mapSuggestions/);
  assert.match(app,/applyMapSuggestion/);
  assert.match(app,/Reset to GPX/);
});

test("event discovery and official branding remain first class capabilities",()=>{
  assert.match(app,/searchOfficialEvent/);
  assert.match(app,/eventResults/);
  assert.match(app,/officialLogo/);
});
