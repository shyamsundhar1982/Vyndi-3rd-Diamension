export const COMMUNITY_CONTENT_TYPES = Object.freeze([
  "community_post",
  "blog_article",
  "ride_story",
  "route_guide",
  "knowledge",
  "event_story",
  "discussion"
]);


export const COMMUNITY_SPORTS = Object.freeze([
  "cycling",
  "running",
  "ultra_running",
  "triathlon",
  "duathlon",
  "swimming",
  "trail_hiking",
  "adventure"
]);

const COMMUNITY_SPORT_ALIASES = Object.freeze({
  cycling: "cycling", ride: "cycling", riding: "cycling", randonneuring: "cycling",
  running: "running", run: "running", marathon: "running",
  ultra: "ultra_running", ultramarathon: "ultra_running", ultra_running: "ultra_running", "ultra-running": "ultra_running",
  triathlon: "triathlon", tri: "triathlon", duathlon: "duathlon",
  swimming: "swimming", swim: "swimming",
  trail: "trail_hiking", hiking: "trail_hiking", trail_hiking: "trail_hiking", "trail-hiking": "trail_hiking",
  adventure: "adventure", expedition: "adventure"
});

export function normalizeSport(value = "cycling") {
  const key = String(value ?? "cycling").trim().toLowerCase();
  const sport = COMMUNITY_SPORT_ALIASES[key];
  if (!sport || !COMMUNITY_SPORTS.includes(sport)) throw new Error("Unsupported community sport.");
  return sport;
}

export const DEFAULT_COMMUNITY_POLICY = Object.freeze({
  minimumActiveAdmins: 3,
  joinApprovalsRequired: 2,
  rejectApprovalsRequired: 2,
  directPublishAfter: 3
});

export const COMMUNITY_ANNOUNCEMENT_TYPES = Object.freeze([
  "community_announcement",
  "founder_message"
]);

export const COMMUNITY_ANNOUNCEMENT_AUDIENCES = Object.freeze([
  "all",
  "members",
  "admins"
]);

function cleanText(value, maxLength, fieldName, { required = false } = {}) {
  const text = String(value ?? "").replace(/\s+/g, " ").trim();
  if (required && !text) throw new Error(`${fieldName} is required.`);
  if (text.length > maxLength) throw new Error(`${fieldName} is too long.`);
  return text;
}

export function normalizeAnnouncementMetadata(input = {}) {
  const announcementType = String(input.announcementType ?? "community_announcement").trim().toLowerCase();
  if (!COMMUNITY_ANNOUNCEMENT_TYPES.includes(announcementType)) {
    throw new Error("Unsupported announcement type.");
  }

  const audience = String(input.audience ?? "all").trim().toLowerCase();
  if (!COMMUNITY_ANNOUNCEMENT_AUDIENCES.includes(audience)) {
    throw new Error("Unsupported announcement audience.");
  }

  const defaultLabel = announcementType === "founder_message" ? "Founder" : "VYNDI Admin";
  const authorLabel = cleanText(input.authorLabel ?? defaultLabel, 80, "Author label") || defaultLabel;

  return {
    announcementType,
    isPinned: input.isPinned === true,
    audience,
    authorLabel
  };
}

export function canCreateAnnouncement(adminRole, announcementType = "community_announcement") {
  const role = String(adminRole ?? "").trim().toLowerCase();
  const type = String(announcementType ?? "").trim().toLowerCase();
  if (!COMMUNITY_ANNOUNCEMENT_TYPES.includes(type)) return false;
  if (!role) return false;
  if (type === "founder_message") return role === "founder";
  return ["founder", "community_admin", "content_admin", "route_curator"].includes(role);
}

export function canReadAnnouncement({ audience = "all", userStatus = "", adminRole = null } = {}) {
  const normalizedAudience = String(audience ?? "all").trim().toLowerCase();
  const active = String(userStatus ?? "").trim().toLowerCase() === "active";
  if (normalizedAudience === "all") return true;
  if (normalizedAudience === "members") return active;
  if (normalizedAudience === "admins") return active && Boolean(adminRole);
  return false;
}

export function normalizeHandle(value) {
  const handle = String(value ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-+/g, "-")
    .slice(0, 40);
  if (!/^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])?$/.test(handle)) {
    throw new Error("A valid rider handle must contain 3 to 40 letters, numbers or hyphens.");
  }
  return handle;
}

export function normalizeEmail(value) {
  const email = String(value ?? "").trim().toLowerCase();
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error("A valid email address is required.");
  }
  return email;
}

export function normalizeMembershipApplication(input = {}) {
  const disciplines = [...new Set((Array.isArray(input.disciplines) ? input.disciplines : [])
    .map(item => String(item ?? "").trim().toLowerCase())
    .filter(Boolean))].slice(0, 8);
  return {
    displayName: cleanText(input.displayName, 80, "Display name", { required: true }),
    email: normalizeEmail(input.email),
    handle: normalizeHandle(input.handle),
    city: cleanText(input.city, 80, "City"),
    state: cleanText(input.state, 80, "State"),
    disciplines,
    bio: cleanText(input.bio, 600, "Bio"),
    whyJoin: cleanText(input.whyJoin, 1000, "Why join", { required: true }),
    contribution: cleanText(input.contribution, 1000, "Contribution", { required: true })
  };
}

export function summarizeMembershipVotes(reviews = []) {
  const latest = new Map();
  for (const review of Array.isArray(reviews) ? reviews : []) {
    const adminId = cleanText(review?.adminId, 100, "Admin id");
    const decision = String(review?.decision ?? "").toLowerCase();
    if (!adminId || !["approve", "reject", "hold"].includes(decision)) continue;
    latest.set(adminId, decision);
  }
  let approvals = 0;
  let rejections = 0;
  let holds = 0;
  for (const decision of latest.values()) {
    if (decision === "approve") approvals += 1;
    else if (decision === "reject") rejections += 1;
    else holds += 1;
  }
  return { approvals, rejections, holds, uniqueAdminVotes: latest.size };
}

export function resolveMembershipQuorum(reviews = [], options = {}) {
  const policy = { ...DEFAULT_COMMUNITY_POLICY, ...(options.policy || {}) };
  const activeAdminCount = Math.max(0, Number(options.activeAdminCount) || 0);
  const summary = summarizeMembershipVotes(reviews);

  if (activeAdminCount < policy.minimumActiveAdmins) {
    return { status: "pending", reason: "admin-setup-incomplete", ...summary };
  }
  if (summary.holds > 0) {
    return { status: "review_required", reason: "admin-hold", ...summary };
  }
  if (summary.approvals >= policy.joinApprovalsRequired) {
    return { status: "active", reason: "approval-quorum", ...summary };
  }
  if (summary.rejections >= policy.rejectApprovalsRequired) {
    return { status: "rejected", reason: "rejection-quorum", ...summary };
  }
  if (summary.approvals > 0 && summary.rejections > 0) {
    return { status: "review_required", reason: "conflicting-votes", ...summary };
  }
  return { status: "pending", reason: "awaiting-quorum", ...summary };
}

function normalizeIsoDate(value, fieldName) {
  if (value === undefined || value === null || value === "") return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error(`${fieldName} is invalid.`);
  return date.toISOString();
}

function normalizePublicUrl(value, fieldName = "URL") {
  if (!value) return "";
  let url;
  try { url = new URL(String(value)); } catch { throw new Error(`${fieldName} is invalid.`); }
  if (!/^https?:$/.test(url.protocol) || url.username || url.password) throw new Error(`${fieldName} must be a public HTTP/HTTPS URL.`);
  return url.toString();
}

function normalizeSocialUrl(value, fieldName, allowedDomains) {
  const normalized = normalizePublicUrl(value, fieldName);
  if (!normalized) return "";
  const hostname = new URL(normalized).hostname.toLowerCase();
  const domains = Array.isArray(allowedDomains) ? allowedDomains : [allowedDomains];
  const accepted = domains.some(domain => hostname === domain || hostname.endsWith(`.${domain}`));
  if (!accepted) {
    throw new Error(`${fieldName} must use ${domains.join(" or ")}.`);
  }
  return normalized;
}

function normalizeProfilePhotoDataUrl(value) {
  const photo = String(value ?? "").trim();
  if (!photo) return "";
  if (!/^data:image\/(?:jpeg|png|webp);base64,[a-z0-9+/=]+$/i.test(photo)) {
    throw new Error("Profile photo must be a JPEG, PNG or WebP image.");
  }
  if (photo.length > 480000) throw new Error("Profile photo is too large.");
  return photo;
}

export function normalizeProfileUpdate(input = {}) {
  const disciplines = [...new Set((Array.isArray(input.disciplines) ? input.disciplines : [])
    .map(item => String(item ?? "").trim().toLowerCase())
    .filter(Boolean))].slice(0, 8);

  return {
    displayName: cleanText(input.displayName, 80, "Display name", { required: true }),
    city: cleanText(input.city, 80, "City"),
    state: cleanText(input.state, 80, "State"),
    disciplines,
    bio: cleanText(input.bio, 600, "Bio"),
    stravaUrl: normalizeSocialUrl(input.stravaUrl, "Strava URL", ["strava.com", "strava.app.link"]),
    instagramUrl: normalizeSocialUrl(input.instagramUrl, "Instagram URL", ["instagram.com", "instagr.am"]),
    facebookUrl: normalizeSocialUrl(input.facebookUrl, "Facebook URL", ["facebook.com", "fb.me"]),
    profilePhotoDataUrl: normalizeProfilePhotoDataUrl(input.profilePhotoDataUrl)
  };
}

export const COMMUNITY_RESOURCE_LINK_CATEGORIES = Object.freeze([
  "blog",
  "study_material",
  "event"
]);

export function normalizeResourceLink(input = {}) {
  const category = String(input.category ?? "").trim().toLowerCase();
  if (!COMMUNITY_RESOURCE_LINK_CATEGORIES.includes(category)) {
    throw new Error("Unsupported resource link category.");
  }
  const url = normalizePublicUrl(input.url, "Resource URL");
  if (!url) throw new Error("Resource URL is required.");
  return {
    category,
    title: cleanText(input.title, 120, "Resource title", { required: true }),
    url,
    description: cleanText(input.description, 400, "Resource description")
  };
}

function normalizeArticleImageDataUrl(value, fieldName = "Article photo", maxLength = 420000) {
  const photo = String(value ?? "").trim();
  if (!photo) return "";
  if (!/^data:image\/(?:jpeg|png|webp);base64,[a-z0-9+/=]+$/i.test(photo)) {
    throw new Error(`${fieldName} must be a JPEG, PNG or WebP image.`);
  }
  if (photo.length > maxLength) throw new Error(`${fieldName} is too large.`);
  return photo;
}

export function normalizeArticleMedia(input = {}) {
  const sourcePhotos = Array.isArray(input.photos) ? input.photos : [];
  if (sourcePhotos.length > 3) throw new Error("A blog article can contain at most 3 inline photos.");
  const photos = sourcePhotos.map((item, index) => ({
    dataUrl: normalizeArticleImageDataUrl(item?.dataUrl, `Article photo ${index + 1}`, 360000),
    caption: cleanText(item?.caption, 180, "Photo caption")
  })).filter(item => item.dataUrl);

  return {
    coverPhotoDataUrl: normalizeArticleImageDataUrl(input.coverPhotoDataUrl, "Cover photo", 420000),
    photos
  };
}

export function normalizeCommunityPost(input = {}) {
  const type = String(input.type ?? "ride_story").trim().toLowerCase();
  if (!COMMUNITY_CONTENT_TYPES.includes(type)) throw new Error("Unsupported community content type.");
  const title = cleanText(input.title, 160, "Title", { required: true });
  const body = String(input.body ?? "").replace(/\r\n/g, "\n").trim();
  if (!body) throw new Error("Story body is required.");
  if (body.length > 120000) throw new Error("Story body is too long.");
  const media = normalizeArticleMedia(input);
  return {
    title,
    type,
    sport: normalizeSport(input.sport || input.discipline || "cycling"),
    body,
    excerpt: cleanText(input.excerpt, 500, "Excerpt"),
    ...media,
    routeId: cleanText(input.routeId, 100, "Route id"),
    eventId: cleanText(input.eventId, 100, "Event id"),
    circleId: cleanText(input.circleId, 100, "Circle id"),
    originalPublishedAt: normalizeIsoDate(input.originalPublishedAt, "Original publication date"),
    legacySourceUrl: normalizePublicUrl(input.legacySourceUrl || input.sourceUrl, "Legacy source URL")
  };
}

export function normalizeLegacyBlogImport(input = {}, now = new Date()) {
  if (input.ownershipConfirmed !== true) {
    throw new Error("Ownership or republication permission must be confirmed before importing a legacy blog.");
  }
  const base = normalizeCommunityPost({
    ...input,
    type: input.type || "ride_story",
    legacySourceUrl: input.legacySourceUrl || input.sourceUrl
  });
  return {
    ...base,
    status: "draft",
    imported: true,
    importedAt: new Date(now).toISOString(),
    originalPublishedAt: base.originalPublishedAt,
    legacySourceUrl: base.legacySourceUrl,
    ownershipConfirmed: true
  };
}

export function canPublishDirectly({ publishedCount = 0, trusted = false } = {}, policy = DEFAULT_COMMUNITY_POLICY) {
  if (trusted === true) return true;
  return Math.max(0, Number(publishedCount) || 0) >= policy.directPublishAfter;
}

export function slugifyPostTitle(title, suffix = "") {
  const base = String(title ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 72) || "ride-story";
  const safeSuffix = String(suffix ?? "").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 10);
  return safeSuffix ? `${base}-${safeSuffix}` : base;
}

export function safeJsonArray(value) {
  try {
    const parsed = typeof value === "string" ? JSON.parse(value) : value;
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function publicUserView(row = {}) {
  return {
    id: row.id,
    handle: row.handle,
    displayName: row.display_name ?? row.displayName ?? "",
    city: row.city ?? "",
    state: row.state ?? "",
    disciplines: Array.isArray(row.disciplines) ? row.disciplines : safeJsonArray(row.disciplines_json),
    bio: row.bio ?? "",
    profilePhotoDataUrl: row.profile_photo_data_url ?? row.profilePhotoDataUrl ?? "",
    stravaUrl: row.strava_url ?? row.stravaUrl ?? "",
    instagramUrl: row.instagram_url ?? row.instagramUrl ?? "",
    facebookUrl: row.facebook_url ?? row.facebookUrl ?? "",
    status: row.status ?? "pending",
    trusted: Boolean(row.trusted)
  };
}


export const CONNECTED_ACTIVITY_SOURCES = Object.freeze(["garmin", "strava", "komoot", "fit", "gpx", "tcx", "other"]);

export function normalizeConnectedActivity(input = {}) {
  const source = String(input.source ?? "").trim().toLowerCase();
  if (!CONNECTED_ACTIVITY_SOURCES.includes(source)) throw new Error("Unsupported activity source.");
  const sourceActivityId = cleanText(input.sourceActivityId, 160, "Source activity id", { required: true });
  const sport = normalizeSport(input.sport || input.discipline || "cycling");
  const startedAt = normalizeIsoDate(input.startedAt, "Activity start");
  if (!startedAt) throw new Error("Activity start is required.");
  const number = (value, name) => {
    const parsed = Number(value ?? 0);
    if (!Number.isFinite(parsed) || parsed < 0) throw new Error(`${name} is invalid.`);
    return parsed;
  };
  return {
    source,
    sourceActivityId,
    sport,
    startedAt,
    durationSeconds: Math.round(number(input.durationSeconds, "Duration")),
    distanceMeters: Math.round(number(input.distanceMeters, "Distance")),
    elevationGainMeters: Math.round(number(input.elevationGainMeters, "Elevation gain")),
    verification: source === "other" ? "declared" : "connected_source"
  };
}

export function activityFingerprint(activity = {}) {
  const normalized = normalizeConnectedActivity(activity);
  const startBucket = Math.round(new Date(normalized.startedAt).getTime() / 300000);
  const distanceBucket = Math.round(normalized.distanceMeters / 1000);
  const durationBucket = Math.round(normalized.durationSeconds / 300);
  return [normalized.sport, startBucket, distanceBucket, durationBucket].join(":");
}

export function mergeConnectedActivities(activities = [], sourcePriority = []) {
  const priority = new Map(sourcePriority.map((source, index) => [String(source).toLowerCase(), index]));
  const groups = new Map();
  for (const raw of Array.isArray(activities) ? activities : []) {
    const activity = normalizeConnectedActivity(raw);
    const key = activityFingerprint(activity);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(activity);
  }
  return [...groups.values()].map(group => {
    const ordered = [...group].sort((a, b) => (priority.get(a.source) ?? 999) - (priority.get(b.source) ?? 999));
    const primary = ordered[0];
    return {
      ...primary,
      provenance: group.map(item => ({ source: item.source, sourceActivityId: item.sourceActivityId, verification: item.verification }))
    };
  }).sort((a, b) => new Date(b.startedAt) - new Date(a.startedAt));
}


function portableXmlValues(xml, tag) {
  const re = new RegExp("<(?:[A-Za-z0-9_-]+:)?" + tag + "\\b[^>]*>([\\s\\S]*?)<\\/(?:[A-Za-z0-9_-]+:)?" + tag + ">", "gi");
  return [...String(xml).matchAll(re)].map(match => match[1].trim());
}

function haversineMeters(a, b) {
  const rad = value => Number(value) * Math.PI / 180;
  const lat1 = rad(a.lat), lat2 = rad(b.lat);
  const dLat = lat2 - lat1, dLon = rad(b.lon) - rad(a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 6371000 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

export function parsePortableActivity({ source, fileName = "", text = "" } = {}) {
  source = String(source || "").toLowerCase();
  if (source === "fit") throw new Error("FIT parser is not yet qualified.");
  if (!["gpx", "tcx"].includes(source)) throw new Error("Unsupported portable activity format.");
  if (!String(text).trim()) throw new Error("Activity file is empty.");
  const points = [];
  if (source === "gpx") {
    const re = /<(?:[A-Za-z0-9_-]+:)?trkpt\b([^>]*)>([\s\S]*?)<\/(?:[A-Za-z0-9_-]+:)?trkpt>/gi;
    for (const match of String(text).matchAll(re)) {
      const lat = Number(/\blat=["']([^"']+)/i.exec(match[1])?.[1]);
      const lon = Number(/\blon=["']([^"']+)/i.exec(match[1])?.[1]);
      const time = portableXmlValues(match[2], "time")[0] || "";
      const ele = Number(portableXmlValues(match[2], "ele")[0]);
      if (Number.isFinite(lat) && Number.isFinite(lon) && time) points.push({ lat, lon, time, ele: Number.isFinite(ele) ? ele : null });
    }
  } else {
    const re = /<(?:[A-Za-z0-9_-]+:)?Trackpoint\b[^>]*>([\s\S]*?)<\/(?:[A-Za-z0-9_-]+:)?Trackpoint>/gi;
    for (const match of String(text).matchAll(re)) {
      const time = portableXmlValues(match[1], "Time")[0] || "";
      const altitude = Number(portableXmlValues(match[1], "AltitudeMeters")[0]);
      const distance = Number(portableXmlValues(match[1], "DistanceMeters")[0]);
      const lat = Number(portableXmlValues(match[1], "LatitudeDegrees")[0]);
      const lon = Number(portableXmlValues(match[1], "LongitudeDegrees")[0]);
      if (time) points.push({ time, ele: Number.isFinite(altitude) ? altitude : null, distance: Number.isFinite(distance) ? distance : null, lat, lon });
    }
  }
  if (!points.length) throw new Error("No timed activity trackpoints were found.");
  const start = new Date(points[0].time), end = new Date(points.at(-1).time);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) throw new Error("Activity timestamps are invalid.");
  let distanceMeters = 0, elevationGainMeters = 0;
  if (source === "tcx" && points.some(point => Number.isFinite(point.distance))) {
    const distances = points.map(point => point.distance).filter(Number.isFinite);
    distanceMeters = Math.max(...distances) - Math.min(...distances);
  } else {
    for (let i = 1; i < points.length; i++) {
      if ([points[i - 1].lat, points[i - 1].lon, points[i].lat, points[i].lon].every(Number.isFinite)) distanceMeters += haversineMeters(points[i - 1], points[i]);
    }
  }
  for (let i = 1; i < points.length; i++) {
    if (Number.isFinite(points[i - 1].ele) && Number.isFinite(points[i].ele)) elevationGainMeters += Math.max(0, points[i].ele - points[i - 1].ele);
  }
  return normalizeConnectedActivity({
    source,
    sourceActivityId: source + ":" + String(fileName || "activity").slice(0, 120) + ":" + start.toISOString(),
    sport: "cycling",
    startedAt: start.toISOString(),
    durationSeconds: Math.max(0, (end - start) / 1000),
    distanceMeters,
    elevationGainMeters
  });
}
