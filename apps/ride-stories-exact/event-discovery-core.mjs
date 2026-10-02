export const CONTINENTS = Object.freeze(["Worldwide","Africa","Asia","Europe","North America","South America","Oceania","Antarctica"]);

export function inferEventCategory(text=""){
  const value=String(text).toLowerCase();
  if(/triathlon|ironman|duathlon/.test(value))return "triathlon";
  if(/open.?water|swimming|swim race|aquathlon/.test(value))return "swimming";
  if(/rowing|kayak|canoe|paddl/.test(value))return "rowing";
  if(/sailing|yacht|regatta/.test(value))return "sailing";
  if(/motorsport|motor race|rally|enduro|motocross|formula|kart/.test(value))return "motorsport";
  if(/ski|snow|winter race|cross.?country ski|skimo/.test(value))return "winter";
  if(/hiking|trek|adventure race|orienteering/.test(value))return "adventure";
  if(/ultra|100 mile|100km|endurance run/.test(value))return "ultra";
  if(/trail|cross.country|cross country|xc|fell run/.test(value))return "trail";
  if(/marathon|half marathon|road running|10k|5k|running race/.test(value))return "marathon";
  if(/cycling|bicycle|bike|tour de|brevet|randon|gran fondo|criterium|road race/.test(value))return "cycling";
  return "other";
}

export function normalizeSearchText(value=""){
  return String(value||"")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g,"")
    .replace(/[^\p{L}\p{N}]+/gu," ")
    .trim()
    .toLowerCase()
    .replace(/\s+/g," ");
}

export function buildGeographySearchQueries(input={}){
  const continent=String(input.continent||"").trim();
  const country=String(input.country||"").trim();
  const region=String(input.region||"").trim();
  const city=String(input.city||"").trim();
  const variants=[
    [city,region,country],
    [city,country],
    [region,country],
    [country],
    [continent&&continent!=="Worldwide"?continent:""]
  ].map(parts=>parts.filter(Boolean).join(", ").trim()).filter(Boolean);
  return variants.filter((value,index,array)=>array.indexOf(value)===index);
}

export function expandEventSearchTerm(value=""){
  const raw=String(value||"").trim();
  const normalized=normalizeSearchText(raw);
  const aliases=new Map([
    ["pbp","Paris-Brest-Paris"],
    ["paris brest paris","Paris-Brest-Paris"],
    ["paris brest paris randonneur","Paris-Brest-Paris"],
    ["utmb","Ultra-Trail du Mont-Blanc"],
    ["tdf","Tour de France"]
  ]);
  return aliases.get(normalized)||raw;
}

function parseElapsedMinutes(value=""){
  const match=String(value||"").trim().match(/^(\d{1,3}):(\d{2})(?::(\d{2}))?$/);
  if(!match)return null;
  return Number(match[1])*60+Number(match[2])+Math.round(Number(match[3]||0)/60);
}

function formatUtcLike(date){
  const months=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const dd=String(date.getUTCDate()).padStart(2,"0");
  const mon=months[date.getUTCMonth()];
  const yyyy=date.getUTCFullYear();
  const hh=String(date.getUTCHours()).padStart(2,"0");
  const mm=String(date.getUTCMinutes()).padStart(2,"0");
  return `${dd} ${mon} ${yyyy} ${hh}:${mm}`;
}

function pbp2023WaveStart(bib=""){
  const letter=String(bib||"").trim().toUpperCase().charAt(0);
  const groups="GHIJKLMNOPQRSTU";
  const index=groups.indexOf(letter);
  if(index<0)return null;
  const startMinutes=17*60+30+index*15;
  return {hour:Math.floor(startMinutes/60),minute:startMinutes%60};
}

export function enrichKnownResultFacts(facts={},context={}){
  const source=`${facts.sourceUrl||""} ${context.sourceUrl||""} ${context.eventName||""}`.toLowerCase();
  const year=String(facts.editionYear||facts.editionDate||"");
  const isPbp=/paris-brest-paris|paris_brest_paris|audax-club-parisien\.com\/palmares-du-paris-brest-paris|paris-brest-paris\.org/.test(source);
  const is2023=isPbp&&(/2023/.test(source)||year==="2023");
  if(!is2023)return {...facts};

  const enriched={
    ...facts,
    eventPreset:"pbp2023",
    eventName:"Paris–Brest–Paris 2023",
    editionDate:"2023-08-20",
    eventEnd:"2023-08-24",
    location:"Rambouillet, Île-de-France, France",
    distance:"1,219 km",
    placing:""
  };
  const wave=pbp2023WaveStart(enriched.bib);
  if(wave){
    const start=new Date(Date.UTC(2023,7,20,wave.hour,wave.minute,0));
    enriched.start=formatUtcLike(start);
    const elapsedMinutes=parseElapsedMinutes(enriched.elapsed);
    if(Number.isFinite(elapsedMinutes)){
      const finish=new Date(start.getTime()+elapsedMinutes*60*1000);
      enriched.finish=formatUtcLike(finish);
    }
  }
  return enriched;
}

export function buildEventSearchQuery(input={}){
  const parts=[
    expandEventSearchTerm(input.query),
    input.category&&input.category!=="all"?input.category:"",
    input.city,
    input.region,
    input.country,
    input.continent&&input.continent!=="Worldwide"?input.continent:""
  ];
  return parts.map(value=>String(value||"").trim()).filter(Boolean).join(" ").replace(/\s+/g," ");
}

export function normalizeGeoBounds(value){
  if(!Array.isArray(value)||value.length<4)return null;
  const south=Number(value[0]),north=Number(value[1]),west=Number(value[2]),east=Number(value[3]);
  if(![south,north,west,east].every(Number.isFinite)||south>=north||west>=east)return null;
  return {minLat:south,maxLat:north,minLon:west,maxLon:east};
}

function safeHttpUrl(value=""){
  try{
    const url=new URL(String(value));
    return /^https?:$/.test(url.protocol)?url.toString():"";
  }catch{return ""}
}

export function normalizeDiscoveryEvent(item={}){
  const name=String(item.name||item.label||item.title||"Unnamed event").trim();
  const description=String(item.description||item.summary||"Public event discovery result.").trim();
  const source=String(item.source||"Public web").trim();
  const sourceUrl=safeHttpUrl(item.sourceUrl||item.url||item.concepturi||"");
  return {
    id:String(item.id||item.event_id||"EVENT").trim(),
    name,
    description,
    category:item.category||inferEventCategory(`${name} ${description}`),
    location:String(item.location||item.venue||"").trim(),
    editionDate:String(item.editionDate||item.date||item.startDate||"").trim(),
    distance:String(item.distance||"").trim(),
    officialWebsite:safeHttpUrl(item.officialWebsite||item.website||""),
    source,
    sourceUrl,
    provenance:{source,sourceUrl}
  };
}

function decodeEntities(text=""){
  return String(text)
    .replace(/&nbsp;/gi," ")
    .replace(/&amp;/gi,"&")
    .replace(/&quot;/gi,'"')
    .replace(/&#39;|&apos;/gi,"'")
    .replace(/&lt;/gi,"<")
    .replace(/&gt;/gi,">")
    .replace(/&#(\d+);/g,(_,n)=>String.fromCharCode(Number(n)));
}

function plainText(html=""){
  return decodeEntities(String(html)
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi," ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi," ")
    .replace(/<\/(?:td|th|tr|li|p|div|section)>/gi," | ")
    .replace(/<[^>]+>/g," ")
    .replace(/\s+/g," ")
  ).trim();
}

function jsonLdObjects(html=""){
  const objects=[];
  const pattern=/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match;
  while((match=pattern.exec(String(html)))!==null){
    try{
      const parsed=JSON.parse(match[1].trim());
      if(Array.isArray(parsed))objects.push(...parsed);
      else if(parsed?.["@graph"]&&Array.isArray(parsed["@graph"]))objects.push(...parsed["@graph"]);
      else if(parsed)objects.push(parsed);
    }catch{}
  }
  return objects;
}

function locationText(location){
  if(!location)return "";
  if(typeof location==="string")return location;
  const address=location.address||{};
  return [location.name,address.addressLocality,address.addressRegion,address.addressCountry].filter(Boolean).join(", ");
}

function capture(context,regex){
  const match=String(context||"").match(regex);
  return match?.[1]?.trim()||"";
}

export function extractPublicEventFacts(html,input={}){
  const documentText=plainText(html);
  const participant=String(input.participant||"").trim();
  const bib=String(input.bib||"").trim();
  let context=documentText;
  const needles=[participant,bib].filter(Boolean);
  for(const needle of needles){
    const index=documentText.toLowerCase().indexOf(needle.toLowerCase());
    if(index>=0){context=documentText.slice(Math.max(0,index-2500),Math.min(documentText.length,index+4500));break;}
  }

  const eventNode=jsonLdObjects(html).find(node=>{
    const type=Array.isArray(node?.["@type"])?node["@type"].join(" "):node?.["@type"];
    return /SportsEvent|Event/i.test(String(type||""));
  })||{};

  const eventName=String(eventNode.name||"").trim();
  const startDate=String(eventNode.startDate||"").trim();
  const endDate=String(eventNode.endDate||"").trim();
  const location=locationText(eventNode.location);

  const start=capture(context,/\b(?:start(?:ed)?|start\s*time)\s*[:\-]?\s*([0-9]{1,2}:[0-9]{2}(?::[0-9]{2})?(?:\s*[AP]M)?|[0-9]{4}-[0-9]{2}-[0-9]{2}[^|,;]{0,32})/i);
  const finish=capture(context,/\b(?:finish(?:ed)?|finish\s*time|completion)\s*[:\-]?\s*([0-9]{1,2}:[0-9]{2}(?::[0-9]{2})?(?:\s*[AP]M)?|[0-9]{4}-[0-9]{2}-[0-9]{2}[^|,;]{0,32})/i);
  const elapsed=capture(context,/\b(?:elapsed(?:\s*time)?|chip\s*time|net\s*time|result\s*time|time)\s*[:\-]?\s*([0-9]{1,3}:[0-9]{2}(?::[0-9]{2})?)/i);
  const status=capture(context,/\bstatus\s*[:\-]?\s*(finished|finisher|complete(?:d)?|dnf|dns|dq|disqualified|withdrawn)/i)
    || capture(context,/\b(finished|finisher|dnf|dns|disqualified|withdrawn)\b/i);
  const placing=capture(context,/\b(?:overall|place|placing|rank|position)\s*[:#\-]?\s*(\d{1,7})(?:st|nd|rd|th)?\b/i);
  const foundBib=capture(context,/\b(?:bib|rider\s*(?:no\.?|number)|race\s*(?:no\.?|number))\s*[:#\-]?\s*([A-Za-z0-9][A-Za-z0-9 _\/-]{0,20}?)(?=\s*\||\s+(?:status|elapsed|time|overall|place|rank|start|finish)\b|$)/i);

  const gpxMatch=String(html).match(/href=["']([^"']+\.gpx(?:\?[^"']*)?)["']/i);
  let gpxUrl="";
  if(gpxMatch){
    try{gpxUrl=new URL(gpxMatch[1],input.sourceUrl||undefined).toString()}catch{}
  }

  return {
    eventName,
    editionDate:startDate?startDate.slice(0,10):"",
    eventStart:startDate,
    eventEnd:endDate,
    location,
    participant,
    bib:foundBib||bib,
    start,
    finish,
    elapsed,
    status,
    placing,
    gpxUrl:safeHttpUrl(gpxUrl),
    sourceUrl:String(input.sourceUrl||"").trim(),
    confidence:needles.some(needle=>context.toLowerCase().includes(needle.toLowerCase()))?"participant-context":"page-level"
  };
}

function normalizeHeader(value=""){
  return normalizeSearchText(value).replace(/\b(?:no|number)\b/g,"").trim();
}

function parseDelimitedLine(line, delimiter){
  const values=[];let current="",quoted=false;
  for(let i=0;i<line.length;i++){
    const char=line[i];
    if(char==='"'){
      if(quoted&&line[i+1]==='"'){current+='"';i+=1}
      else quoted=!quoted;
    }else if(char===delimiter&&!quoted){values.push(current.trim());current=""}
    else current+=char;
  }
  values.push(current.trim());
  return values;
}

function detectDelimiter(lines){
  const candidates=[",",";","\t","|"];
  let best=",",bestScore=-1;
  for(const delimiter of candidates){
    const score=lines.slice(0,8).reduce((sum,line)=>sum+(line.split(delimiter).length-1),0);
    if(score>bestScore){best=delimiter;bestScore=score}
  }
  return best;
}

function normalizeElapsed(value=""){
  const text=String(value||"").trim().toUpperCase();
  const match=text.match(/^(\d{1,3})\s*[:H]\s*(\d{2})(?:\s*[:M]\s*(\d{2}))?$/);
  if(!match)return "";
  return `${Number(match[1])}:${match[2]}${match[3]?`:${match[3]}`:""}`;
}

function statusFromResultValue(value=""){
  const text=normalizeSearchText(value).replace(/\s+/g,"");
  if(!text)return "";
  if(["ab","dnf","abandon","abandoned"].includes(text))return "DNF";
  if(["np","dns","nonpartant"].includes(text))return "DNS";
  if(["nh","dq","disqualified","nonhomologue"].includes(text))return "Disqualified";
  if(["hd","horsdelai"].includes(text))return "Over time limit";
  return normalizeElapsed(value)?"Finished":"";
}

export function extractTabularParticipantCandidates(text,input={}){
  const source=String(text||"").replace(/\r/g,"");
  const lines=source.split("\n").map(line=>line.trim()).filter(Boolean);
  const nameQuery=normalizeSearchText(input.participant);
  const bibQuery=normalizeSearchText(input.bib).replace(/\s+/g,"");
  if(nameQuery.length<2&&!bibQuery)return [];
  if(lines.length<2)return [];
  const delimiter=detectDelimiter(lines);
  const rows=lines.map(line=>parseDelimitedLine(line,delimiter));
  const headerIndex=rows.findIndex(row=>{
    const headers=row.map(normalizeHeader);
    return headers.some(value=>/annee|year/.test(value))
      && headers.some(value=>/temps|time/.test(value))
      && headers.some(value=>/plaque|bib|rider/.test(value))
      && headers.some(value=>/nom prenom|name/.test(value));
  });
  if(headerIndex<0)return [];
  const headers=rows[headerIndex].map(normalizeHeader);
  const indexOf=(patterns)=>headers.findIndex(header=>patterns.some(pattern=>pattern.test(header)));
  const yearIndex=indexOf([/annee/,/year/]);
  const timeIndex=indexOf([/^temps$/,/^time$/,/elapsed/]);
  const bibIndex=indexOf([/plaque/,/bib/,/rider/]);
  const nameIndex=indexOf([/nom prenom/,/^name$/,/participant/]);
  const nameTokens=nameQuery.split(" ").filter(token=>token.length>1);
  return rows.slice(headerIndex+1).map(row=>{
    const participant=nameIndex>=0?String(row[nameIndex]||"").trim():"";
    const bib=bibIndex>=0?String(row[bibIndex]||"").trim():"";
    const normalizedName=normalizeSearchText(participant);
    const normalizedBib=normalizeSearchText(bib).replace(/\s+/g,"");
    let score=0;
    if(bibQuery){
      if(normalizedBib===bibQuery)score+=100;
      else if(normalizedBib.includes(bibQuery))score+=45;
      else return null;
    }
    if(nameTokens.length){
      const matched=nameTokens.filter(token=>normalizedName.includes(token)).length;
      if(matched!==nameTokens.length)return null;
      score+=matched*20;
      if(normalizedName===nameQuery)score+=50;
      else if(normalizedName.startsWith(nameQuery))score+=15;
    }
    const rawTime=timeIndex>=0?row[timeIndex]||"":"";
    return {
      participant,
      bib,
      elapsed:normalizeElapsed(rawTime),
      status:statusFromResultValue(rawTime),
      editionYear:yearIndex>=0?String(row[yearIndex]||"").trim():"",
      sourceUrl:String(input.sourceUrl||"").trim(),
      confidence:"participant-row",
      _score:score
    };
  }).filter(Boolean)
    .sort((a,b)=>b._score-a._score||a.participant.localeCompare(b.participant))
    .slice(0,12)
    .map(({_score,...candidate})=>candidate);
}

export function extractTabularParticipantFacts(text,input={}){
  const source=String(text||"").replace(/\r/g,"");
  const lines=source.split("\n").map(line=>line.trim()).filter(Boolean);
  if(lines.length<2)return {participant:String(input.participant||"").trim(),bib:String(input.bib||"").trim(),elapsed:"",status:"",editionYear:"",sourceUrl:String(input.sourceUrl||"").trim(),confidence:"page-level"};
  const delimiter=detectDelimiter(lines);
  const rows=lines.map(line=>parseDelimitedLine(line,delimiter));
  const headerIndex=rows.findIndex(row=>{
    const headers=row.map(normalizeHeader);
    return headers.some(value=>/annee|year/.test(value))
      && headers.some(value=>/temps|time/.test(value))
      && headers.some(value=>/plaque|bib|rider/.test(value))
      && headers.some(value=>/nom prenom|name/.test(value));
  });
  if(headerIndex<0)return {participant:String(input.participant||"").trim(),bib:String(input.bib||"").trim(),elapsed:"",status:"",editionYear:"",sourceUrl:String(input.sourceUrl||"").trim(),confidence:"page-level"};
  const headers=rows[headerIndex].map(normalizeHeader);
  const indexOf=(patterns)=>headers.findIndex(header=>patterns.some(pattern=>pattern.test(header)));
  const yearIndex=indexOf([/annee/,/year/]);
  const timeIndex=indexOf([/^temps$/,/^time$/,/elapsed/]);
  const bibIndex=indexOf([/plaque/,/bib/,/rider/]);
  const nameIndex=indexOf([/nom prenom/,/^name$/,/participant/]);
  const wantedBib=normalizeSearchText(input.bib).replace(/\s+/g,"");
  const wantedNameTokens=normalizeSearchText(input.participant).split(" ").filter(token=>token.length>1);
  const row=rows.slice(headerIndex+1).find(candidate=>{
    const rowBib=bibIndex>=0?normalizeSearchText(candidate[bibIndex]).replace(/\s+/g,""):"";
    if(wantedBib&&rowBib===wantedBib)return true;
    if(wantedNameTokens.length){
      const rowName=normalizeSearchText(candidate[nameIndex]||"");
      return wantedNameTokens.every(token=>rowName.includes(token));
    }
    return false;
  });
  if(!row)return {participant:String(input.participant||"").trim(),bib:String(input.bib||"").trim(),elapsed:"",status:"",editionYear:"",sourceUrl:String(input.sourceUrl||"").trim(),confidence:"page-level"};
  const rawTime=timeIndex>=0?row[timeIndex]||"":"";
  return {
    participant:nameIndex>=0?String(row[nameIndex]||input.participant||"").trim():String(input.participant||"").trim(),
    bib:bibIndex>=0?String(row[bibIndex]||input.bib||"").trim():String(input.bib||"").trim(),
    elapsed:normalizeElapsed(rawTime),
    status:statusFromResultValue(rawTime),
    editionYear:yearIndex>=0?String(row[yearIndex]||"").trim():"",
    sourceUrl:String(input.sourceUrl||"").trim(),
    confidence:"participant-row"
  };
}

function cleanPart(value,max=56){
  const text=String(value||"").replace(/\s+/g," ").trim();
  return text.length>max?`${text.slice(0,max-1)}…`:text;
}

export function buildMedalMetaLines(data={}){
  const lines=[];
  const first=[cleanPart(data.editionDate,20),cleanPart(data.location,48)].filter(Boolean).join(" · ");
  if(first)lines.push(first);
  const second=[cleanPart(data.distance,22),data.bib?`BIB ${cleanPart(data.bib,18)}`:""].filter(Boolean).join(" · ");
  if(second)lines.push(second);
  const third=[data.startDetail?`START ${cleanPart(data.startDetail,24)}`:"",data.finishDetail?`FINISH ${cleanPart(data.finishDetail,24)}`:""].filter(Boolean).join(" · ");
  if(third)lines.push(third);
  const fourth=[cleanPart(data.elapsedTime,24),cleanPart(data.resultStatus,20),data.placing?`PLACE ${cleanPart(data.placing,12)}`:""].filter(Boolean).join(" · ");
  if(fourth)lines.push(fourth);
  return lines;
}
