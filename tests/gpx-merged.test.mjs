import test from "node:test";
import assert from "node:assert/strict";
import { parseGpxText } from "../packages/gpx/gpx-core.mjs";

test("merged GPX parser keeps TrailRelief large-file behavior and VMM ride statistics",()=>{
  const gpx='<gpx><trk><name>Metric Test</name><trkseg>'
    +'<trkpt lat="0" lon="0"><ele>100</ele><time>2026-01-01T00:00:00Z</time></trkpt>'
    +'<trkpt lat="0" lon="0.01"><ele>120</ele><time>2026-01-01T00:10:00Z</time></trkpt>'
    +'<trkpt lat="0" lon="0.02"><ele>115</ele><time>2026-01-01T00:20:00Z</time></trkpt>'
    +'</trkseg></trk></gpx>';
  const route=parseGpxText(gpx,"fallback.gpx",{maxPoints:100});
  assert.equal(route.name,"Metric Test");
  assert.equal(route.sourcePointCount,3);
  assert.ok(route.distanceKm>2.2&&route.distanceKm<2.3);
  assert.equal(route.elevationGainM,20);
  assert.equal(route.elapsedTimeSeconds,1200);
  assert.equal(route.movingTimeSeconds,1200);
});
