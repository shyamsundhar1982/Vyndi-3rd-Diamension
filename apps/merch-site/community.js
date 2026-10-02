window.__VYNDI_COMMUNITY_CONTROLLER__='20261001-rider-row-ui-1';
const state = {
  me: null,
  health: null,
  feedType: "",
  feedSport: "",
  feedCircleIds: [],
  circleScope: "global",
  activeStory: null,
  adminPeople: [],
  navigationIndex: 0,
  pendingProfilePhotoDataUrl: "",
  pendingCoverPhotoDataUrl: "",
  pendingArticlePhotos: [],
  editingPostId: "",
  resourceLinks: [],
  feedRequest: 0,
  destinationRequest: 0
};

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

function setStatus(target, message, error = false) {
  if (!target) return;
  target.textContent = message || "";
  target.classList.toggle("error", Boolean(error));
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    credentials: "same-origin",
    ...options,
    headers: {
      "content-type": "application/json",
      ...(options.headers || {})
    }
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `Request failed with ${response.status}.`);
  return data;
}

function formatDate(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(date);
}

function contentTypeLabel(type) {
  return ({
    community_post: "Community Post",
    blog_article: "Blog Article",
    ride_story: "Ride Story",
    route_guide: "Route Guide",
    knowledge: "Cycling Knowledge",
    event_story: "Event Story",
    discussion: "Discussion"
  })[type] || type;
}

function announcementTypeLabel(type) {
  return ({
    founder_message: "Founder Message",
    community_announcement: "Community Announcement"
  })[type] || "Announcement";
}

function createUiIcon(name) {
  const icon = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  icon.setAttribute("class", "vyndi-icon");
  icon.setAttribute("viewBox", "0 0 24 24");
  icon.setAttribute("aria-hidden", "true");
  icon.setAttribute("focusable", "false");
  const use = document.createElementNS("http://www.w3.org/2000/svg", "use");
  use.setAttribute("href", `/vyndi-icons.svg#${name}`);
  icon.append(use);
  return icon;
}

function setActionContent(element, iconName, text) {
  const label = document.createElement("span");
  label.textContent = text;
  element.replaceChildren(createUiIcon(iconName), label);
}

async function toggleGlory(post, button) {
  if (!state.me?.authenticated || state.me.user?.status !== "active") {
    openAccountPanel();
    return;
  }
  button.disabled = true;
  try {
    const result = await api(`/api/community/posts/${encodeURIComponent(post.id)}/glory`, {
      method: "POST",
      body: "{}"
    });
    post.gloryCount = result.gloryCount;
    setActionContent(button, "heart", `Glory · ${result.gloryCount}`);
    button.setAttribute("aria-pressed", String(Boolean(result.active)));
    button.classList.toggle("active", Boolean(result.active));
  } catch (error) {
    setActionContent(button, "heart", "Glory unavailable");
  } finally {
    button.disabled = false;
  }
}

function makeGloryButton(post) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "glory-button";
  setActionContent(button, "heart", `Glory · ${Number(post.gloryCount || 0)}`);
  button.setAttribute("aria-label", `Give Glory to ${post.title}`);
  button.addEventListener("click", () => toggleGlory(post, button));
  return button;
}

function shareStory(post, button) {
  const url = new URL(`/stories/${post.slug}`, location.origin).href;
  if (navigator.share) {
    return navigator.share({ title: post.title, url }).catch(() => {});
  }
  if (navigator.clipboard?.writeText) {
    return navigator.clipboard.writeText(url).then(() => {
      setActionContent(button, "check", "Copied");
      window.setTimeout(() => { setActionContent(button, "share", "Share"); }, 1400);
    }).catch(() => {});
  }
  window.prompt("Copy this story link", url);
  return Promise.resolve();
}

async function openFeedComments(post, card) {
  let panel = card.querySelector(".feed-comments");
  if (panel) { panel.hidden = !panel.hidden; return; }
  panel = document.createElement("section");
  panel.className = "feed-comments";
  panel.textContent = "Loading comments…";
  card.append(panel);
  try {
    const data = await api(`/api/community/posts/${encodeURIComponent(post.id)}/comments`);
    panel.replaceChildren();
    for (const comment of data.comments || []) {
      const row = document.createElement("div"); row.className = "feed-comment";
      const who = document.createElement("strong"); who.textContent = comment.display_name || comment.handle;
      const body = document.createElement("span"); body.textContent = comment.body;
      row.append(who, body); panel.append(row);
    }
    if (!(data.comments || []).length) { const empty=document.createElement("p"); empty.className="muted"; empty.textContent="No comments yet."; panel.append(empty); }
    if (state.me?.authenticated && state.me.user?.status === "active") {
      const form=document.createElement("form"); form.className="feed-comment-form";
      const input=document.createElement("input"); input.name="body"; input.required=true; input.maxLength=2000; input.placeholder="Add a comment…";
      const send=document.createElement("button"); send.type="submit"; send.className="button quiet"; send.textContent="Post"; form.append(input,send);
      form.addEventListener("submit",async event=>{event.preventDefault();send.disabled=true;try{await api(`/api/community/posts/${encodeURIComponent(post.id)}/comments`,{method:"POST",body:JSON.stringify({body:input.value})});panel.remove();await openFeedComments(post,card);}catch(error){input.setCustomValidity(error.message);input.reportValidity();input.setCustomValidity("");}finally{send.disabled=false;}});
      panel.append(form);
    }
  } catch (error) { panel.textContent = error.message; }
}

function createStoryCard(post) {
  const card = document.createElement("article");
  card.className = "story-card social-story-card";

  const head = document.createElement("div");
  head.className = "story-card-head";

  const rider = document.createElement("div");
  rider.className = "story-card-rider";
  const avatar = createProfileVisual(post.author, "story-card-avatar");

  const identity = document.createElement("div");
  identity.className = "story-card-identity";
  const author = document.createElement("a");
  author.href = post.author?.handle ? `/riders/${post.author.handle}` : "/community";
  author.textContent = post.authorLabel
    ? `${post.author?.displayName || "VYNDI"} · ${post.authorLabel}`
    : (post.author?.displayName || "VYNDI rider");
  const meta = document.createElement("span");
  const locationLabel = [post.author?.city, post.author?.state].filter(Boolean).join(", ");
  const dateLabel = formatDate(post.originalPublishedAt || post.publishedAt || post.createdAt);
  meta.textContent = [locationLabel, dateLabel].filter(Boolean).join(" · ");
  identity.append(author, meta);
  rider.append(avatar, identity);

  const tag = document.createElement("span");
  tag.className = "tag";
  const sportLabel = String(post.sport || "cycling").replace(/_/g, " ").replace(/\b\w/g, char => char.toUpperCase());
  tag.textContent = post.announcementType ? announcementTypeLabel(post.announcementType) : `${sportLabel} · ${contentTypeLabel(post.type)}`;
  if (post.isPinned) tag.textContent += " · Pinned";
  head.append(rider, tag);

  const cardCoverSource = post.coverPhotoUrl || post.coverPhotoDataUrl;
  if (cardCoverSource) {
    const coverLink = document.createElement("a");
    coverLink.href = `/stories/${post.slug}`;
    coverLink.className = "story-card-cover-link";
    const cover = document.createElement("img");
    cover.className = "story-card-cover";
    cover.src = cardCoverSource;
    cover.alt = `${post.title} cover`;
    cover.loading = "lazy";
    coverLink.append(cover);
    card.append(head, coverLink);
  } else {
    card.append(head);
  }

  const body = document.createElement("div");
  body.className = "story-card-body";
  const titleLink = document.createElement("a");
  titleLink.href = `/stories/${post.slug}`;
  const title = document.createElement("h3");
  title.textContent = post.title;
  titleLink.append(title);
  const intro = document.createElement("p");
  intro.textContent = post.excerpt || post.body?.slice(0, 240) || "";
  body.append(titleLink, intro);

  const actions = document.createElement("div");
  actions.className = "story-card-actions";
  actions.append(makeGloryButton(post));

  const comments = document.createElement("button");
  comments.type = "button";
  comments.className = "story-action-button comment-action";
  setActionContent(comments, "chat", "Comments");
  comments.addEventListener("click", () => openFeedComments(post, card));
  actions.append(comments);

  const read = document.createElement("a");
  read.className = "story-action-link";
  read.href = `/stories/${post.slug}`;
  setActionContent(read, "story", "Read");
  actions.append(read);

  const share = document.createElement("button");
  share.type = "button";
  share.className = "story-action-button";
  setActionContent(share, "share", "Share");
  share.addEventListener("click", () => shareStory(post, share));
  actions.append(share);

  card.append(body, actions);
  return card;
}

function applyCommunitySearch() {
  const query = String($("#communitySearch")?.value || "").trim().toLowerCase();
  const cards = $$(location.pathname === "/journals"
    ? "#publicRiders .public-rider-row"
    : document.body.dataset.viewMode === "community"
      ? "#communityFeed .story-card"
      : "#destinationFeed .story-card, #routeView .story-card");
  let matches = 0;
  for (const card of cards) {
    card.hidden = Boolean(query) && !card.textContent.toLowerCase().includes(query);
    if (!card.hidden) matches++;
  }
  const status = $("#communitySearchStatus");
  if (status) {
    status.hidden = !query;
    status.textContent = query ? `${matches} matching ${location.pathname === "/journals" ? "riders" : "entries"}` : "";
  }
}

async function loadFeed(type = state.feedType, sport = state.feedSport || "") {
  const request = ++state.feedRequest;
  state.feedType = type;
  state.feedSport = sport;
  const feed = $("#communityFeed");
  feed.replaceChildren();
  const params = new URLSearchParams();
  if (type) params.set("type", type);
  if (sport) params.set("sport", sport);
  if (state.feedCircleIds?.length) params.set("circleIds", state.feedCircleIds.join(","));
  try {
    const data = await api(`/api/community/posts?${params.toString()}`);
    if (request !== state.feedRequest) return;
    if (!data.posts?.length) {
      const empty = document.createElement("article");
      empty.className = "empty-card";
      const p = document.createElement("p");
      p.textContent = "No published entries in this category yet. Founding riders can start the archive.";
      empty.append(p);
      feed.append(empty);
      return;
    }
    for (const post of data.posts) feed.append(createStoryCard(post));
    applyCommunitySearch();
  } catch (error) {
    if (request !== state.feedRequest) return;
    const empty = document.createElement("article");
    empty.className = "empty-card";
    const p = document.createElement("p");
    p.textContent = error.message;
    empty.append(p);
    feed.append(empty);
  }
}


function createPinnedAnnouncementCard(post) {
  const card = document.createElement("article");
  card.className = `pinned-announcement ${post.announcementType || "community_announcement"}`;

  const top = document.createElement("div");
  top.className = "pinned-announcement-top";

  const label = document.createElement("span");
  label.className = "announcement-badge";
  label.textContent = announcementTypeLabel(post.announcementType);

  const pin = document.createElement("span");
  pin.className = "pin-badge";
  pin.textContent = "PINNED";
  top.append(label, pin);

  const title = document.createElement("h3");
  const link = document.createElement("a");
  link.href = `/stories/${post.slug}`;
  link.textContent = post.title;
  title.append(link);

  const intro = document.createElement("p");
  intro.textContent = post.excerpt || String(post.body || "").slice(0, 240);

  const footer = document.createElement("div");
  footer.className = "pinned-announcement-footer";

  const identity = document.createElement("span");
  identity.textContent = [
    post.author?.displayName || "VYNDI",
    post.authorLabel || "",
    formatDate(post.publishedAt || post.createdAt)
  ].filter(Boolean).join(" · ");

  const read = document.createElement("a");
  read.className = "announcement-read";
  read.href = `/stories/${post.slug}`;
  read.textContent = "Read message →";

  footer.append(identity, read);
  card.append(top, title, intro, footer);
  return card;
}

async function loadPinnedAnnouncements() {
  const root = $("#pinnedAnnouncements");
  if (!root) return;
  root.replaceChildren();

  if (!state.me?.authenticated || state.me.user?.status !== "active") {
    root.hidden = true;
    return;
  }

  try {
    const data = await api("/api/community/announcements?pinned=1");
    const announcements = Array.isArray(data.announcements) ? data.announcements : [];
    if (!announcements.length) {
      root.hidden = true;
      return;
    }
    root.hidden = false;
    for (const post of announcements) root.append(createPinnedAnnouncementCard(post));
  } catch {
    root.hidden = true;
  }
}

const PUBLIC_DESTINATIONS = {
  "/stories": {
    eyebrow: "STORIES",
    title: "Ride stories worth keeping.",
    description: "Long-form cycling experiences, brevet stories, journeys and lessons from the road.",
    type: "ride_story"
  },
  "/routes": {
    eyebrow: "ROUTES",
    title: "Road knowledge riders can reuse.",
    description: "Route Guides for road condition, climbs, traffic, water, food, seasonal notes and practical route intelligence.",
    type: "route_guide"
  },
  "/knowledge": {
    eyebrow: "KNOWLEDGE",
    title: "Cycling knowledge that outlives one ride.",
    description: "Endurance, randonneuring, maintenance, fit, nutrition, travel, safety and India-specific cycling knowledge.",
    type: "knowledge"
  },
  "/events": {
    eyebrow: "EVENTS",
    title: "Events remembered by the riders who were there.",
    description: "Preparation, experience and lessons from brevets, PBP, LEL, K2K and other meaningful cycling events.",
    type: "event_story"
  },
  "/forum": {
    eyebrow: "FORUM",
    title: "Focused cycling discussions.",
    description: "Ask a question, compare experience and build answers that remain useful to the next rider.",
    type: "discussion"
  },
  "/journals": {
    eyebrow: "RIDERS",
    title: "Follow the rider, not the noise.",
    description: "Ride blogs from VYNDI riders. Read their published stories, knowledge and event writing.",
    riders: true
  }
};

async function loadDestinationPosts(type) {
  const request = ++state.destinationRequest;
  const root = $("#destinationFeed");
  root.replaceChildren();
  try {
    const data = await api(`/api/community/posts?type=${encodeURIComponent(type)}`);
    if (request !== state.destinationRequest) return;
    if (!data.posts?.length) {
      const empty = document.createElement("article");
      empty.className = "empty-card";
      const text = document.createElement("p");
      text.textContent = type === "discussion"
        ? "No forum topics yet. An active rider can start the first discussion."
        : "Nothing has been published here yet.";
      empty.append(text);
      root.append(empty);
      return;
    }
    for (const post of data.posts) root.append(createStoryCard(post));
  } catch (error) {
    if (request !== state.destinationRequest) return;
    const empty = document.createElement("article");
    empty.className = "empty-card";
    empty.textContent = error.message;
    root.append(empty);
  }
}

function initialsFor(name = "VYNDI Rider") {
  return String(name)
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part[0])
    .join("")
    .toUpperCase() || "VR";
}

function createProfileVisual(rider, className = "profile-photo") {
  if (rider?.profilePhotoDataUrl) {
    const image = document.createElement("img");
    image.className = className;
    image.src = rider.profilePhotoDataUrl;
    image.alt = `${rider.displayName || "Rider"} profile photo`;
    return image;
  }
  const fallback = document.createElement("span");
  fallback.className = "profile-photo-fallback";
  fallback.textContent = initialsFor(rider?.displayName);
  return fallback;
}

function socialProfileLinks(rider) {
  const wrapper = document.createElement("div");
  wrapper.className = "profile-social-links";
  for (const [label, url] of [
    ["Strava", rider?.stravaUrl],
    ["Instagram", rider?.instagramUrl],
    ["Facebook", rider?.facebookUrl]
  ]) {
    if (!url) continue;
    const link = document.createElement("a");
    link.href = url;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.textContent = label;
    wrapper.append(link);
  }
  return wrapper;
}

function renderCommunityRailProfile() {
  const root = $("#communityRailProfileBody");
  const card = $("#communityRailProfile");
  if (!root || !card) return;
  root.replaceChildren();

  if (!state.me?.authenticated || !state.me.user) {
    const copy = document.createElement("p");
    copy.className = "muted";
    copy.textContent = "Sign in to show your rider identity, social links and recent community activity.";
    const join = document.createElement("a");
    join.className = "button quiet rail-profile-join";
    join.href = "#account";
    join.textContent = "Join / Sign in";
    root.append(copy, join);
    return;
  }

  const user = state.me.user;
  const identity = document.createElement("div");
  identity.className = "rail-profile-identity";
  identity.append(createProfileVisual(user, "rail-profile-photo"));

  const copy = document.createElement("div");
  const name = document.createElement("strong");
  name.textContent = user.displayName || user.handle;
  const handle = document.createElement("span");
  handle.textContent = `@${user.handle}`;
  const locationLabel = [user.city, user.state].filter(Boolean).join(", ");
  const location = document.createElement("span");
  location.textContent = locationLabel || "VYNDI rider";
  copy.append(name, handle, location);
  identity.append(copy);
  root.append(identity);

  if (user.bio) {
    const bio = document.createElement("p");
    bio.className = "rail-profile-bio";
    bio.textContent = user.bio;
    root.append(bio);
  }

  const socials = socialProfileLinks(user);
  if (socials.childElementCount) root.append(socials);
}

function renderTodayForYou() {
  const root = $("#todayForYouBody");
  if (!root) return;
  root.replaceChildren();
  const location = [state.me?.user?.city, state.me?.user?.state].filter(Boolean).join(", ");
  const items = state.me?.authenticated ? [
    ["Continue your road", "Your Home is filtered around the riders, Circles and sports you choose."],
    ["Your Circles", "Use My Circles to continue conversations and activity in communities you belong to."],
    ["Around you", location ? "Explore riders, stories and routes connected with " + location + "." : "Add your city and region to unlock meaningful local discovery."]
  ] : [["Start your VYBES", "Sign in to build a personal view from riders, Circles, stories and routes that matter to you."]];
  for (const [title, copy] of items) { const item=document.createElement("div"); item.className="today-for-you-item"; const strong=document.createElement("strong"); strong.textContent=title; const span=document.createElement("span"); span.textContent=copy; item.append(strong,span); root.append(item); }
}

function setHeaderProfile(user = null) {
  const text = $("#headerAccountText");
  const avatar = $("#headerProfileAvatar");
  if (!text || !avatar) return;
  if (!user) {
    text.textContent = "Join / Sign in";
    avatar.textContent = "V";
    avatar.style.backgroundImage = "";
    return;
  }
  text.textContent = `@${user.handle}`;
  avatar.textContent = user.profilePhotoDataUrl ? "" : initialsFor(user.displayName || user.handle);
  avatar.style.backgroundImage = user.profilePhotoDataUrl ? `url("${user.profilePhotoDataUrl}")` : "";
}

function resourceCategoryLabel(category) {
  return ({
    blog: "Blog",
    study_material: "Study material",
    event: "Event"
  })[category] || category;
}

function renderSharedResources(root, links = [], { editable = false } = {}) {
  if (!root) return;
  root.replaceChildren();
  if (!links.length) {
    const empty = document.createElement("p");
    empty.className = "muted";
    empty.textContent = "No shared blog, study material or event links yet.";
    root.append(empty);
    return;
  }

  for (const item of links) {
    const row = document.createElement("article");
    row.className = "shared-resource";
    const copy = document.createElement("div");
    const title = document.createElement("strong");
    title.textContent = item.title;
    const meta = document.createElement("span");
    meta.textContent = resourceCategoryLabel(item.category);
    const link = document.createElement("a");
    link.href = item.url;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.textContent = item.url;
    copy.append(title, meta, link);
    if (item.description) {
      const description = document.createElement("p");
      description.textContent = item.description;
      copy.append(description);
    }
    row.append(copy);

    if (editable) {
      const remove = document.createElement("button");
      remove.type = "button";
      remove.textContent = "Remove";
      remove.addEventListener("click", async () => {
        try {
          await api(`/api/community/me/links/${encodeURIComponent(item.id)}`, { method: "DELETE" });
          await loadProfileResourceLinks();
        } catch (error) {
          setStatus($("#resourceLinkStatus"), error.message, true);
        }
      });
      row.append(remove);
    }
    root.append(row);
  }
}

async function loadCommunityKpis() {
  const todayNode = $("#kpiTodayUploads");
  const topNode = $("#kpiTopUpload");
  const trendingNode = $("#kpiTrending");
  const riderNode = $("#kpiRiderCount");
  if (!todayNode || !topNode || !trendingNode || !riderNode) return;

  try {
    const [postData, riderData] = await Promise.all([
      api("/api/community/posts"),
      api("/api/community/riders")
    ]);
    const posts = Array.isArray(postData.posts) ? postData.posts : [];
    const riders = Array.isArray(riderData.riders) ? riderData.riders : [];
    const today = new Date().toDateString();
    const todaysPosts = posts.filter(post => {
      const date = new Date(post.publishedAt || post.originalPublishedAt || post.createdAt || 0);
      return !Number.isNaN(date.getTime()) && date.toDateString() === today;
    });
    const ranked = posts.slice().sort((a, b) =>
      Number(b.gloryCount || 0) - Number(a.gloryCount || 0)
      || new Date(b.publishedAt || b.createdAt || 0) - new Date(a.publishedAt || a.createdAt || 0)
    );
    const topToday = todaysPosts.slice().sort((a, b) => Number(b.gloryCount || 0) - Number(a.gloryCount || 0))[0];

    todayNode.textContent = String(todaysPosts.length);
    topNode.textContent = topToday?.title || "No upload yet";
    trendingNode.textContent = ranked[0]?.title || "No trend yet";
    riderNode.textContent = String(riders.length);
  } catch {
    todayNode.textContent = "—";
    topNode.textContent = "Unavailable";
    trendingNode.textContent = "Unavailable";
    riderNode.textContent = "—";
  }
}

async function prepareProfilePhoto(file) {
  if (!file) return "";
  if (!/^image\/(jpeg|png|webp)$/.test(file.type)) throw new Error("Choose a JPEG, PNG or WebP image.");
  if (file.size > 12 * 1024 * 1024) throw new Error("Profile photo must be smaller than 12 MB.");

  const source = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Could not read the profile photo."));
    reader.onload = () => resolve(String(reader.result || ""));
    reader.readAsDataURL(file);
  });
  const image = await new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Could not decode the profile photo."));
    img.src = source;
  });

  const maxSide = 512;
  const scale = Math.min(1, maxSide / Math.max(image.naturalWidth, image.naturalHeight));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
  const context = canvas.getContext("2d");
  context.drawImage(image, 0, 0, canvas.width, canvas.height);

  let encoded = canvas.toDataURL("image/webp", 0.82);
  if (encoded.length > 470000) encoded = canvas.toDataURL("image/jpeg", 0.68);
  if (encoded.length > 470000) throw new Error("Profile photo is still too large after compression.");
  return encoded;
}

async function prepareArticlePhoto(file) {
  if (!file) return "";
  if (!/^image\/(jpeg|png|webp)$/.test(file.type)) throw new Error("Choose a JPEG, PNG or WebP article photo.");
  if (file.size > 15 * 1024 * 1024) throw new Error("Article photos must be smaller than 15 MB before compression.");

  const source = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Could not read the article photo."));
    reader.onload = () => resolve(String(reader.result || ""));
    reader.readAsDataURL(file);
  });
  const image = await new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Could not decode the article photo."));
    img.src = source;
  });

  const encode = (maxSide, mimeType, quality) => {
    const scale = Math.min(1, maxSide / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const context = canvas.getContext("2d");
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL(mimeType, quality);
  };

  for (const attempt of [
    [1600, "image/webp", 0.78],
    [1200, "image/webp", 0.66],
    [1000, "image/jpeg", 0.6]
  ]) {
    const encoded = encode(...attempt);
    if (encoded.length <= 340000) return encoded;
  }
  throw new Error("Article photo is still too large after compression. Choose a simpler or smaller image.");
}

function renderArticleMediaStaging() {
  const root = $("#articlePhotoList");
  if (!root) return;
  root.replaceChildren();

  if (state.pendingCoverPhotoDataUrl) {
    const cover = document.createElement("figure");
    cover.className = "article-photo-stage cover";
    const img = document.createElement("img");
    img.src = state.pendingCoverPhotoDataUrl;
    img.alt = "Selected article cover";
    const caption = document.createElement("figcaption");
    caption.textContent = "Cover photo";
    const remove = document.createElement("button");
    remove.type = "button";
    remove.textContent = "Remove";
    remove.addEventListener("click", () => {
      state.pendingCoverPhotoDataUrl = "";
      const input = $("#newPostForm")?.elements.coverPhoto;
      if (input) input.value = "";
      renderArticleMediaStaging();
    });
    cover.append(img, caption, remove);
    root.append(cover);
  }

  state.pendingArticlePhotos.forEach((photo, index) => {
    const figure = document.createElement("figure");
    figure.className = "article-photo-stage";
    const img = document.createElement("img");
    img.src = photo.dataUrl;
    img.alt = photo.caption || `Article photo ${index + 1}`;
    const caption = document.createElement("input");
    caption.type = "text";
    caption.maxLength = 180;
    caption.placeholder = `Caption for photo ${index + 1}`;
    caption.value = photo.caption || "";
    caption.addEventListener("input", () => {
      state.pendingArticlePhotos[index].caption = caption.value.slice(0, 180);
    });
    const remove = document.createElement("button");
    remove.type = "button";
    remove.textContent = "Remove";
    remove.addEventListener("click", () => {
      state.pendingArticlePhotos.splice(index, 1);
      renderArticleMediaStaging();
    });
    figure.append(img, caption, remove);
    root.append(figure);
  });
}

function applyArticleFormat(format) {
  const textarea = $("#articleBody");
  if (!textarea) return;
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const selected = textarea.value.slice(start, end) || "text";
  const formats = {
    heading: [start === 0 || textarea.value[start - 1] === "\n" ? "## " : "\n## ", ""],
    bold: ["**", "**"],
    italic: ["*", "*"],
    quote: [start === 0 || textarea.value[start - 1] === "\n" ? "> " : "\n> ", ""],
    bullet: [start === 0 || textarea.value[start - 1] === "\n" ? "- " : "\n- ", ""],
    link: ["[", "](https://)"]
  };
  const pair = formats[format];
  if (!pair) return;
  const replacement = `${pair[0]}${selected}${pair[1]}`;
  textarea.setRangeText(replacement, start, end, "select");
  textarea.focus();
}

function renderArticlePreview() {
  const form = $("#newPostForm");
  const root = $("#articlePreview");
  if (!form || !root) return;
  root.replaceChildren();

  if (state.pendingCoverPhotoDataUrl) {
    const cover = document.createElement("img");
    cover.className = "article-preview-cover";
    cover.src = state.pendingCoverPhotoDataUrl;
    cover.alt = "Article preview cover";
    root.append(cover);
  }

  const title = document.createElement("h2");
  title.textContent = form.elements.title.value.trim() || "Untitled blog article";
  root.append(title);

  const excerptValue = form.elements.excerpt.value.trim();
  if (excerptValue) {
    const excerpt = document.createElement("p");
    excerpt.className = "article-preview-excerpt";
    excerpt.textContent = excerptValue;
    root.append(excerpt);
  }

  const body = document.createElement("div");
  body.className = "body-copy";
  renderRichArticleBody(body, form.elements.body.value);
  root.append(body);

  if (state.pendingArticlePhotos.length) {
    const gallery = document.createElement("div");
    gallery.className = "story-photo-gallery";
    for (const photo of state.pendingArticlePhotos) {
      const figure = document.createElement("figure");
      const image = document.createElement("img");
      image.src = photo.dataUrl;
      image.alt = photo.caption || "Article photo";
      figure.append(image);
      if (photo.caption) {
        const caption = document.createElement("figcaption");
        caption.textContent = photo.caption;
        figure.append(caption);
      }
      gallery.append(figure);
    }
    root.append(gallery);
  }
  root.hidden = false;
}

function resetArticleEditor() {
  const form = $("#newPostForm");
  if (form) {
    form.reset();
    if (form.elements.type) form.elements.type.value = "blog_article";
  }
  state.editingPostId = "";
  state.pendingCoverPhotoDataUrl = "";
  state.pendingArticlePhotos = [];
  $("#articlePreview")?.setAttribute("hidden", "");
  const title = $("#articleFormTitle");
  if (title) title.textContent = "Write for the road ahead.";
  const save = $("#articleSaveButton");
  if (save) save.textContent = "Save blog entry";
  const cancel = $("#articleCancelEdit");
  if (cancel) cancel.hidden = true;
  renderArticleMediaStaging();
}

function startEditingPost(post) {
  const form = $("#newPostForm");
  if (!form) return;
  state.editingPostId = post.id;
  state.pendingCoverPhotoDataUrl = post.coverPhotoDataUrl || "";
  state.pendingArticlePhotos = Array.isArray(post.photos) ? post.photos.map(item => ({ ...item })) : [];
  form.elements.type.value = post.type || "blog_article";
  form.elements.title.value = post.title || "";
  form.elements.excerpt.value = post.excerpt || "";
  form.elements.body.value = post.body || "";
  form.elements.cyclingRelevanceConfirmed.checked = true;
  form.elements.publish.checked = post.status !== "draft";
  const title = $("#articleFormTitle");
  if (title) title.textContent = `Edit: ${post.title}`;
  const save = $("#articleSaveButton");
  if (save) save.textContent = "Save changes";
  const cancel = $("#articleCancelEdit");
  if (cancel) cancel.hidden = false;
  $("#articlePreview")?.setAttribute("hidden", "");
  renderArticleMediaStaging();
  setMemberPane("create");
  form.scrollIntoView({ behavior: "smooth", block: "start" });
}

function updateProfilePreview(photoDataUrl, displayName) {
  const image = $("#profilePhotoPreview");
  const fallback = $("#profilePhotoFallback");
  if (!image || !fallback) return;
  if (photoDataUrl) {
    image.src = photoDataUrl;
    image.alt = `${displayName || "Rider"} profile photo`;
    image.hidden = false;
    fallback.hidden = true;
  } else {
    image.removeAttribute("src");
    image.hidden = true;
    fallback.hidden = false;
    fallback.textContent = initialsFor(displayName);
  }
}

function populateProfileForm() {
  const form = $("#profileForm");
  const user = state.me?.user;
  if (!form || !user) return;
  form.elements.displayName.value = user.displayName || "";
  form.elements.city.value = user.city || "";
  form.elements.state.value = user.state || "";
  form.elements.disciplines.value = (user.disciplines || []).join(", ");
  form.elements.bio.value = user.bio || "";
  form.elements.stravaUrl.value = user.stravaUrl || "";
  form.elements.instagramUrl.value = user.instagramUrl || "";
  form.elements.facebookUrl.value = user.facebookUrl || "";
  state.pendingProfilePhotoDataUrl = user.profilePhotoDataUrl || "";
  updateProfilePreview(state.pendingProfilePhotoDataUrl, user.displayName);
}

async function loadProfileResourceLinks() {
  const root = $("#profileResourceLinks");
  if (!root || !state.me?.authenticated) return;
  try {
    const data = await api("/api/community/me/links");
    state.resourceLinks = Array.isArray(data.links) ? data.links : [];
    renderSharedResources(root, state.resourceLinks, { editable: true });
  } catch (error) {
    root.replaceChildren();
    const p = document.createElement("p");
    p.className = "muted";
    p.textContent = error.message;
    root.append(p);
  }
}

async function loadPublicRiders() {
  const feed = $("#destinationFeed");
  const root = $("#publicRiders");
  feed.hidden = true;
  root.hidden = false;
  root.replaceChildren();
  try {
    const data = await api("/api/community/riders");
    if (!data.riders?.length) {
      const empty = document.createElement("p");
      empty.className = "muted";
      empty.textContent = "No public Ride Blogs yet.";
      root.append(empty);
      return;
    }

    for (const rider of data.riders) {
      const card = document.createElement("article");
      card.className = "public-rider-row";

      const identity = document.createElement("div");
      identity.className = "rider-row-identity";
      identity.append(createProfileVisual(rider, "rider-row-avatar"));

      const identityCopy = document.createElement("div");
      identityCopy.className = "rider-row-name";
      const name = document.createElement("h3");
      const link = document.createElement("a");
      link.href = `/riders/${rider.handle}`;
      link.textContent = rider.displayName || rider.handle;
      name.append(link);

      const handle = document.createElement("p");
      handle.className = "rider-handle";
      handle.textContent = `@${rider.handle}`;
      identityCopy.append(name, handle);
      identity.append(identityCopy);

      const bio = document.createElement("p");
      bio.className = "rider-row-bio";
      bio.textContent = rider.bio || "VYNDI rider";

      const details = document.createElement("div");
      details.className = "rider-row-details";
      const location = [rider.city, rider.state].filter(Boolean).join(", ");
      const disciplines = (rider.disciplines || []).slice(0, 3).join(" · ");
      for (const value of [
        location || "Location not listed",
        disciplines || "Cycling",
        `${rider.publishedCount || 0} published`
      ]) {
        const span = document.createElement("span");
        span.textContent = value;
        details.append(span);
      }

      const actions = document.createElement("div");
      actions.className = "rider-row-actions";
      const socials = socialProfileLinks(rider);
      if (socials.childElementCount) actions.append(socials);

      const profile = document.createElement("a");
      profile.className = "button quiet";
      profile.href = `/riders/${rider.handle}`;
      profile.setAttribute("aria-label", `View ${rider.displayName || rider.handle} profile`);
      const profileLabel = document.createElement("span");
      profileLabel.className = "rider-profile-action-label";
      profileLabel.textContent = "View profile";
      const profileArrow = document.createElement("span");
      profileArrow.className = "rider-profile-action-arrow";
      profileArrow.setAttribute("aria-hidden", "true");
      profileArrow.textContent = "›";
      profile.append(profileLabel, profileArrow);
      actions.append(profile);

      card.append(identity, bio, details, actions);
      root.append(card);
    }
    applyCommunitySearch();
  } catch (error) {
    const message = document.createElement("p");
    message.className = "muted";
    message.textContent = error.message;
    root.append(message);
  }
}

async function loadCommunityDashboardRail() {
  const root = $("#communityRailRiders");
  const riderCount = $("#communityRailRiderCount");
  const adminCount = $("#communityRailAdminCount");
  if (adminCount) adminCount.textContent = String(state.health?.activeAdmins ?? "—");
  if (!root || !riderCount) return;

  root.replaceChildren();
  const loading = document.createElement("p");
  loading.className = "muted";
  loading.textContent = "Loading riders…";
  root.append(loading);

  try {
    const data = await api("/api/community/riders");
    const riders = Array.isArray(data.riders) ? data.riders : [];
    riderCount.textContent = String(riders.length);
    root.replaceChildren();

    if (!riders.length) {
      const empty = document.createElement("p");
      empty.className = "muted";
      empty.textContent = "Founding riders will appear here.";
      root.append(empty);
      return;
    }

    for (const rider of riders.slice(0, 5)) {
      const item = document.createElement("article");
      item.className = "rail-rider";

      const avatar = createProfileVisual(rider, "rail-avatar-photo");

      const identity = document.createElement("div");
      const name = document.createElement("strong");
      name.textContent = rider.displayName || rider.handle;
      const meta = document.createElement("span");
      const location = [rider.city, rider.state].filter(Boolean).join(", ");
      meta.textContent = location || `@${rider.handle}`;
      identity.append(name, meta);

      const link = document.createElement("a");
      link.href = `/riders/${rider.handle}`;
      link.textContent = "Profile";

      item.append(avatar, identity, link);
      root.append(item);
    }
  } catch (error) {
    riderCount.textContent = "—";
    root.replaceChildren();
    const message = document.createElement("p");
    message.className = "muted";
    message.textContent = "Rider list unavailable.";
    root.append(message);
  }
}

function isNavigationLinkActive(link, currentPath) {
  const href = new URL(link.getAttribute("href") || "/", location.origin).pathname;
  if (href === currentPath) return true;
  if (currentPath.startsWith("/stories/") && href === "/stories") return true;
  if (currentPath.startsWith("/riders/") && href === "/journals") return true;
  return false;
}

function sameOriginReferrer() {
  if (!document.referrer) return false;
  try {
    return new URL(document.referrer).origin === location.origin;
  } catch {
    return false;
  }
}

function ensureNavigationState() {
  const existing = Number(history.state?.vyndiNavIndex);
  if (Number.isFinite(existing)) {
    state.navigationIndex = existing;
    return;
  }
  const initial = { ...(history.state || {}), vyndiNavIndex: 0 };
  history.replaceState(initial, "", location.href);
  state.navigationIndex = 0;
}

function commitNavigationState(path, { replace = false } = {}) {
  const current = Number(history.state?.vyndiNavIndex);
  const baseIndex = Number.isFinite(current) ? current : state.navigationIndex;
  const nextIndex = replace ? baseIndex : baseIndex + 1;
  const payload = { ...(history.state || {}), vyndiNavIndex: nextIndex };
  if (replace) history.replaceState(payload, "", path);
  else history.pushState(payload, "", path);
  state.navigationIndex = nextIndex;
}

function setCommunityViewMode(mode) {
  document.body.dataset.viewMode = mode;
  if (mode !== "community") document.body.dataset.accountOpen = "false";
  const search = $("#communitySearch");
  const mobileSearch = $("#mobileCommunitySearch");
  const searchPlaceholder = location.pathname === "/journals"
    ? "Search riders, places, disciplines…"
    : "Search stories, routes, knowledge…";
  const searchLabel = location.pathname === "/journals" ? "Search rider directory" : "Search community content";
  if (search) {
    search.placeholder = searchPlaceholder;
    search.setAttribute("aria-label", searchLabel);
  }
  if (mobileSearch) {
    mobileSearch.placeholder = searchPlaceholder;
    mobileSearch.setAttribute("aria-label", searchLabel);
  }
  if (mode === "community") document.title = "Vybes · VYNDI Ride Stories";
  const currentPath = location.pathname;

  for (const link of $$("[data-community-route], [data-app-route]")) {
    const isActive = isNavigationLinkActive(link, currentPath);
    if (isActive) link.setAttribute("aria-current", "page");
    else link.removeAttribute("aria-current");
  }

  const mobileMoreToggle = $("#mobileMoreToggle");
  if (mobileMoreToggle) {
    const moreActive = ["/routes", "/knowledge", "/events", "/forum", "/admin"].includes(currentPath);
    mobileMoreToggle.classList.toggle("route-active", moreActive);
  }

}

function setMemberPane(name = "create") {
  document.body.dataset.memberView = name;
  for (const button of $$("[data-member-tab]")) {
    const active = button.dataset.memberTab === name;
    button.classList.toggle("active", active);
    button.setAttribute("aria-selected", active ? "true" : "false");
  }
  for (const pane of $$("[data-member-pane]")) {
    pane.hidden = pane.dataset.memberPane !== name;
  }
  if (name === "profile") loadAthletePassport();
}

function passportNumber(value, maximumFractionDigits = 0) {
  return new Intl.NumberFormat(undefined, { maximumFractionDigits }).format(Number(value || 0));
}

function renderPassportHeroStats(data) {
  const root=$("#passportHeroStats"); if(!root)return;
  const cells=root.querySelectorAll("strong");
  if(cells[0]) cells[0].textContent=passportNumber(data.roadDNA?.activeYears||0)+" yrs";
  if(cells[1]) cells[1].textContent=String(data.roadDNA?.primaryDiscipline||"—").replace(/_/g," ");
}
function renderPassportAchievementRail(items) {
  const root=$("#passportAchievementRail"); if(!root)return; root.replaceChildren();
  for(const item of (items||[]).slice(-5)){const badge=document.createElement("div");const icon=document.createElement("i");icon.textContent="◆";const text=document.createElement("span");text.textContent=typeof item==="string"?item:(item.label||item.name||item.title||"Milestone");badge.append(icon,text);root.append(badge)}
}
function renderPassportActivityHeatmap(legacy) {
  const root=$("#passportActivityHeatmap"); if(!root)return; root.replaceChildren();
  const rows=(legacy||[]).slice(-8), max=Math.max(1,...rows.map(r=>Number(r.activities||0)));
  for(const row of rows){const cell=document.createElement("div");cell.className="passport-heat-cell";cell.style.setProperty("--heat",String(Math.max(.08,Number(row.activities||0)/max)));const value=document.createElement("strong");value.textContent=passportNumber(row.activities||0);const year=document.createElement("span");year.textContent=row.year;cell.append(value,year);root.append(cell)}
}
function renderPassportElevationProfile(legacy) {
  const root=$("#passportElevationProfile"); if(!root)return; root.replaceChildren();
  const rows=(legacy||[]).slice(-10),max=Math.max(1,...rows.map(r=>Number(r.elevationGainMeters||0)));
  const svg=document.createElementNS("http://www.w3.org/2000/svg","svg");svg.setAttribute("viewBox","0 0 640 110");svg.setAttribute("preserveAspectRatio","none");
  const pts=rows.map((r,i)=>[(i/Math.max(1,rows.length-1))*640,100-(Number(r.elevationGainMeters||0)/max)*88]);
  const area=document.createElementNS(svg.namespaceURI,"path");area.setAttribute("d",pts.length?"M0 110 L"+pts.map(p=>p[0].toFixed(1)+" "+p[1].toFixed(1)).join(" L")+" L640 110 Z":"");area.setAttribute("class","passport-elevation-area");svg.append(area);
  const line=document.createElementNS(svg.namespaceURI,"path");line.setAttribute("d",pts.map((p,i)=>(i?"L":"M")+p[0].toFixed(1)+" "+p[1].toFixed(1)).join(" "));line.setAttribute("class","passport-elevation-line");svg.append(line);root.append(svg);
}
function renderPassportRecordConstellation(records) {
  const root=$("#passportRecordConstellation"); if(!root)return; root.replaceChildren();
  const flat=[];for(const group of records||[]){for(const key of ["longest","highest","biggestElevation"]){if(group?.[key])flat.push({sport:group.sport||"effort",kind:key,item:group[key]})}}
  for(const record of flat.slice(0,6)){const card=document.createElement("article");const kind=document.createElement("span");kind.textContent=record.kind.replace(/([A-Z])/g," $1");const strong=document.createElement("strong");strong.textContent=record.kind==="longest"?passportNumber(record.item.distance_meters/1000,1)+" km":passportNumber(record.kind==="highest"?record.item.max_altitude_meters:record.item.elevation_gain_meters)+" m";const small=document.createElement("small");small.textContent=String(record.sport).replace(/_/g," ");card.append(kind,strong,small);root.append(card)}
}
function renderPassportJourneyChart(legacy) {
  const root=$("#passportJourneyChart"); if(!root)return; root.replaceChildren();
  const rows=(legacy||[]).filter(row=>Number(row.year));
  const max=Math.max(1,...rows.map(row=>Number(row.distanceMeters||0)));
  const svg=document.createElementNS("http://www.w3.org/2000/svg","svg"); svg.setAttribute("viewBox","0 0 760 240"); svg.setAttribute("role","img"); svg.setAttribute("aria-label","Annual endurance distance trend");
  const points=rows.map((row,index)=>{const x=rows.length===1?380:30+(index/(rows.length-1))*700;const y=190-(Number(row.distanceMeters||0)/max)*145;return {row,x,y};});
  const path=document.createElementNS(svg.namespaceURI,"path"); path.setAttribute("class","passport-chart-line"); path.setAttribute("d",points.map((p,i)=>(i?"L":"M")+p.x.toFixed(1)+" "+p.y.toFixed(1)).join(" ")); svg.append(path);
  for(const p of points){const dot=document.createElementNS(svg.namespaceURI,"circle");dot.setAttribute("cx",p.x);dot.setAttribute("cy",p.y);dot.setAttribute("r","6");dot.setAttribute("class","passport-chart-dot");const title=document.createElementNS(svg.namespaceURI,"title");title.textContent=p.row.year+" · "+passportNumber(p.row.distanceMeters/1000,0)+" km · "+passportNumber(p.row.elevationGainMeters)+" m";dot.append(title);svg.append(dot);const label=document.createElementNS(svg.namespaceURI,"text");label.setAttribute("x",p.x);label.setAttribute("y","222");label.setAttribute("text-anchor","middle");label.textContent=p.row.year;svg.append(label)}
  root.append(svg);
}
function renderPassportDisciplineMix(items) {
  const root=$("#passportDisciplineMix"); if(!root)return; root.replaceChildren();
  const rows=(items||[]).filter(item=>Number(item.activities||item.activityCount||0)>0);
  const total=Math.max(1,rows.reduce((sum,item)=>sum+Number(item.activities||item.activityCount||0),0));
  const ring=document.createElement("div");ring.className="passport-mix-ring";let cursor=0;const stops=[];
  for(const [index,item] of rows.entries()){const value=Number(item.activities||item.activityCount||0);const end=cursor+(value/total)*100;stops.push("var(--passport-mix-"+(index%5)+") "+cursor+"% "+end+"%");cursor=end}
  ring.style.background=stops.length?"conic-gradient("+stops.join(",")+")":"var(--surface)";
  const centre=document.createElement("div");centre.innerHTML="<strong>"+passportNumber(total)+"</strong><span>activities</span>";ring.append(centre);root.append(ring);
  const legend=document.createElement("div");legend.className="passport-mix-legend";for(const [index,item] of rows.entries()){const row=document.createElement("p");row.style.setProperty("--mix-index",index%5);const name=document.createElement("span");name.textContent=String(item.sport||"activity").replace(/_/g," ");const value=document.createElement("b");value.textContent=passportNumber((Number(item.activities||item.activityCount||0)/total)*100,0)+"%";row.append(name,value);legend.append(row)}root.append(legend);
}
function renderPassportCalibreVisual(calibre, roadDNA) {
  const root=$("#passportCalibreVisual"); if(!root)return; root.replaceChildren();
  const breadth=Math.min(100,Number(calibre.breadth?.disciplineCount||0)*20);
  const values=[["Consistency",Number(calibre.consistency?.coveragePercent||0)],["Endurance",Math.min(100,Number(calibre.endurance?.longEfforts||0))],["Climbing",Math.min(100,Number(calibre.climbing?.metersPer100Km||0)/10)],["Breadth",breadth],["Years",Math.min(100,Number(roadDNA.activeYears||0)*10)]];
  for(const [label,value] of values){const row=document.createElement("div");row.className="passport-calibre-axis";const top=document.createElement("p");const name=document.createElement("span");name.textContent=label;const score=document.createElement("b");score.textContent=passportNumber(value,0)+"%";top.append(name,score);const track=document.createElement("i");const fill=document.createElement("em");fill.style.width=Math.max(0,Math.min(100,value))+"%";track.append(fill);row.append(top,track);root.append(row)}
}

async function loadAthletePassport() {
  const status = $("#passportStatus");
  if (!$("#passportActivities")) return;
  try {
    if (status) status.textContent = "Loading canonical activity evidence…";
    const sourceState = await api("/api/community/me/activity-sources");
    const strava = sourceState.connections?.find(item => item.provider === "strava" && item.status === "connected");
    if (strava && Number(strava.metadataVersion || 1) < 2) {
      if (status) status.textContent = "Repairing historical Strava disciplines and event metadata…";
      await api("/api/community/me/activity-sources/strava/sync", { method: "POST" });
    }
    const data = await api("/api/community/me/passport");
    const totals = data.totals || {};
    const user = state.me?.user || {};
    $("#passportRiderName").textContent = user.displayName || "Athlete Passport";
    $("#passportPublicId").textContent = data.passportId || "Passport unavailable";
    $("#passportIssuedAt").textContent = data.issuedAt ? "Issued " + new Date(data.issuedAt).toLocaleDateString() + " · Permanent ID" : "Permanent rider identity";
    $("#passportIdentity").textContent = [user.handle ? "@" + user.handle : "", data.primarySource ? "Primary: " + data.primarySource.toUpperCase() : "", totals.firstActivityAt ? "Evidence since " + new Date(totals.firstActivityAt).toLocaleDateString() : ""].filter(Boolean).join(" · ");
    $("#passportActivities").textContent = passportNumber(totals.activityCount);
    $("#passportDistance").textContent = passportNumber(Number(totals.distanceMeters || 0) / 1000, 1) + " km";
    $("#passportElevation").textContent = passportNumber(totals.elevationGainMeters) + " m";
    $("#passportDuration").textContent = passportNumber(Number(totals.durationSeconds || 0) / 3600, 1) + " h";
    $("#passportVerification").textContent = (data.sources?.length || 0) + " VERIFIED SOURCE" + ((data.sources?.length || 0) === 1 ? "" : "S");

    const sourceRoot = $("#passportSources");
    sourceRoot.replaceChildren();
    for (const source of data.sources || []) {
      const row = document.createElement("div");
      row.className = "passport-source-row";
      const name = document.createElement("strong"); name.textContent = String(source.source || "").toUpperCase();
      const evidence = document.createElement("span"); evidence.textContent = passportNumber(source.activityCount) + " evidenced activities";
      row.append(name, evidence); sourceRoot.append(row);
    }
    if (!data.sources?.length) { const p=document.createElement("p"); p.className="muted"; p.textContent="No verified source evidence yet."; sourceRoot.append(p); }

    const recordsRoot = $("#passportDisciplineRecords");
    recordsRoot.replaceChildren();
    const recordDefs = [
      ["longestDistance", "Longest distance", a => passportNumber(a.distance_meters / 1000, 1) + " km"],
      ["biggestElevation", "Biggest elevation gain", a => passportNumber(a.elevation_gain_meters) + " m"],
      ["longestDuration", "Longest duration", a => passportNumber(a.duration_seconds / 3600, 1) + " h"]
    ];
    for (const discipline of data.singleActivityRecords || []) {
      const section=document.createElement("section"); section.className="passport-discipline-card";
      const title=document.createElement("h5"); title.textContent=String(discipline.sport||"activity").replace(/_/g," ");
      const grid=document.createElement("div"); grid.className="passport-record-grid";
      for(const [key,label,format] of recordDefs){const activity=discipline[key];if(!activity)continue;const card=document.createElement("article");const lab=document.createElement("span");lab.textContent=label;const value=document.createElement("strong");value.textContent=format(activity);const meta=document.createElement("small");meta.textContent=(activity.activity_name?activity.activity_name+" · ":"")+new Date(activity.started_at).toLocaleDateString()+" · "+String(activity.primary_source||"").toUpperCase();card.append(lab,value,meta);grid.append(card)}
      section.append(title,grid);recordsRoot.append(section);
    }
    if(!data.singleActivityRecords?.length){const p=document.createElement("p");p.className="muted";p.textContent="No qualified single-activity records yet.";recordsRoot.append(p)}
    $("#passportAltitudeStatus").textContent=data.altitudeStatus||"Maximum altitude is not available from current evidence.";

    const eventsRoot=$("#passportEventRecords"); eventsRoot.replaceChildren();
    for(const activity of data.enduranceEventRecords||[]){const row=document.createElement("article");row.className="passport-event-row";const name=document.createElement("strong");name.textContent=activity.activity_name||String(activity.sport||"Endurance event").replace(/_/g," ");const stats=document.createElement("span");stats.textContent=passportNumber(activity.distance_meters/1000,1)+" km · "+passportNumber(activity.elevation_gain_meters)+" m · "+passportNumber(activity.duration_seconds/3600,1)+" h";const meta=document.createElement("small");meta.textContent=new Date(activity.started_at).toLocaleDateString()+" · "+String(activity.primary_source||"").toUpperCase();row.append(name,stats,meta);eventsRoot.append(row)}
    if(!data.enduranceEventRecords?.length){const p=document.createElement("p");p.className="muted";p.textContent="No multi-day or exceptional-distance event records detected.";eventsRoot.append(p)}

    renderPassportJourneyChart(data.roadLegacy || []);
    renderPassportDisciplineMix(data.roadDNA?.disciplineMix || []);
    renderPassportCalibreVisual(data.calibre || {}, data.roadDNA || {});
    renderPassportActivityHeatmap(data.roadLegacy || []);
    renderPassportElevationProfile(data.roadLegacy || []);
    renderPassportRecordConstellation(data.disciplineRecords || []);
    $("#passportHeroMetric").textContent = passportNumber(Number(totals.distanceMeters || 0) / 1000, 0) + " km";
    $("#passportActiveYears").textContent = passportNumber(data.roadDNA?.activeYears || 0);
    $("#passportLongEfforts").textContent = passportNumber(data.calibre?.endurance?.longEfforts || 0);
    $("#passportClimbRate").textContent = passportNumber(data.calibre?.climbing?.metersPer100Km || 0) + " m";
    $("#passportDisciplineCount").textContent = passportNumber(data.calibre?.breadth?.disciplineCount || 0);
    renderPassportHeroStats(data);
    renderPassportAchievementRail(data.roadDNA?.achievements || []);

    const dna=$("#passportRoadDNA"); dna.replaceChildren();
    const dnaItems=[["Primary discipline",data.roadDNA?.primaryDiscipline||"—"],["Disciplines",passportNumber(data.roadDNA?.disciplineMix?.length||0)],["Long efforts",passportNumber(data.roadDNA?.longEfforts||0)],["Active years",passportNumber(data.roadDNA?.activeYears||0)]];
    for(const [label,value] of dnaItems){const p=document.createElement("p");const b=document.createElement("b");b.textContent=value;const s=document.createElement("span");s.textContent=label;p.append(s,b);dna.append(p)}

    const calibre=$("#passportCalibre"); calibre.replaceChildren();
    const primaryEfficiency=(data.calibre?.efficiency?.byDiscipline||[]).find(item=>item.sport===data.roadDNA?.primaryDiscipline)||data.calibre?.efficiency?.byDiscipline?.[0];
    const efficiencyValue=primaryEfficiency ? passportNumber(primaryEfficiency.averageMovingSpeedKmh,1)+" km/h · "+passportNumber(primaryEfficiency.climbingDensityMetersPer100Km)+" m/100 km" : "—";
    const calItems=[["Consistency",passportNumber(data.calibre?.consistency?.coveragePercent||0)+"% active months"],["Endurance",passportNumber(data.calibre?.endurance?.longEfforts||0)+" long efforts"],["Efficiency",efficiencyValue],["Climbing",passportNumber(data.calibre?.climbing?.metersPer100Km||0)+" m / 100 km"],["Breadth",passportNumber(data.calibre?.breadth?.disciplineCount||0)+" disciplines"]];
    for(const [label,value] of calItems){const p=document.createElement("p");const s=document.createElement("span");s.textContent=label;const b=document.createElement("b");b.textContent=value;p.append(s,b);calibre.append(p)}

    const achievements=$("#passportAchievements"); achievements.replaceChildren();
    for(const item of data.achievements||[]){const badge=document.createElement("span");badge.className="passport-achievement";badge.textContent=item.label;achievements.append(badge)}
    if(!data.achievements?.length){const p=document.createElement("p");p.className="muted";p.textContent="Milestones will appear as evidence accumulates.";achievements.append(p)}

    const legacy=$("#passportLegacy"); legacy.replaceChildren();
    for(const year of data.roadLegacy||[]){const row=document.createElement("p");const y=document.createElement("b");y.textContent=year.year;const s=document.createElement("span");s.textContent=passportNumber(year.distanceMeters/1000,0)+" km · "+passportNumber(year.elevationGainMeters)+" m · "+passportNumber(year.activities)+" activities";row.append(y,s);legacy.append(row)}

    const verifyUrl=new URL("/api/community/passport/"+encodeURIComponent(data.passportId||""),location.origin).toString();
    const publicUrl=new URL("/passport/"+encodeURIComponent(data.passportId||""),location.origin).toString();
    $("#passportVerifyLink").href=verifyUrl;
    $("#passportShareButton").onclick=async()=>{try{if(navigator.share)await navigator.share({title:(user.displayName||"VYNDI rider")+" · Athlete Passport",text:"My verified VYNDI endurance identity",url:publicUrl});else await navigator.clipboard.writeText(publicUrl);$("#passportStatus").textContent=navigator.share?"Passport shared.":"Public Passport link copied."}catch{}};

    const recentRoot = $("#passportRecent");
    recentRoot.replaceChildren();
    for (const activity of data.recent || []) {
      const row = document.createElement("article");
      row.className = "passport-activity-row";
      const top = document.createElement("div");
      const sport = document.createElement("strong"); sport.textContent = String(activity.sport || "activity").replace(/_/g, " ");
      const date = document.createElement("time"); date.textContent = new Date(activity.startedAt).toLocaleDateString();
      top.append(sport, date);
      const metrics = document.createElement("p");
      metrics.textContent = passportNumber(activity.distanceMeters / 1000, 1) + " km · " + passportNumber(activity.elevationGainMeters) + " m ↑ · " + passportNumber(activity.durationSeconds / 3600, 1) + " h · " + String(activity.primarySource || "").toUpperCase();
      row.append(top, metrics); recentRoot.append(row);
    }
    if (status) status.textContent = "Passport calculated from persisted canonical activities and provenance.";
  } catch (error) {
    if (status) { status.textContent = error.message || "Athlete Passport could not be loaded."; status.dataset.error = "true"; }
  }
}

function bindConnectedSources() {
  const input = $("#activityImportInput");
  const status = $("#connectedSourcesStatus");
  const primary = $("#activityPrimarySource");
  let requestedType = "";
  const setStatus = (message, error = false) => {
    if (!status) return;
    status.textContent = message;
    status.dataset.error = error ? "true" : "false";
  };
  const renderSourceState = state => {
    if (!primary) return;
    const available = Array.isArray(state?.availableSources) ? state.availableSources.filter(source => ["gpx", "tcx", "garmin", "strava"].includes(source)) : [];
    primary.replaceChildren(new Option(available.length ? "Choose primary source" : "Import a source first", ""));
    for (const source of available) primary.add(new Option(source.toUpperCase(), source));
    primary.disabled = available.length === 0;
    primary.value = available.includes(state?.primarySource) ? state.primarySource : "";
    for (const connection of state?.connections || []) {
      const sourceState = document.querySelector('[data-source-state="' + connection.provider + '"]');
      if (sourceState && ["gpx", "tcx"].includes(connection.provider)) sourceState.textContent = "Imported · " + connection.activityCount + " activit" + (connection.activityCount === 1 ? "y" : "ies");
      if (sourceState && connection.provider === "strava" && connection.status === "connected") sourceState.textContent = "Connected · " + connection.activityCount + " activit" + (connection.activityCount === 1 ? "y" : "ies");
      if (connection.provider === "strava") {
        const stravaButton = document.querySelector('[data-provider-connect="strava"]');
        if (stravaButton && connection.status === "connected") {
          stravaButton.textContent = "Sync Strava";
          stravaButton.dataset.providerSync = "strava";
          delete stravaButton.dataset.providerConnect;
          let disconnectButton = document.querySelector('[data-provider-disconnect="strava"]');
          if (!disconnectButton) {
            disconnectButton = document.createElement("button");
            disconnectButton.type = "button";
            disconnectButton.className = "button quiet source-action";
            disconnectButton.textContent = "Disconnect Strava";
            disconnectButton.dataset.providerDisconnect = "strava";
            stravaButton.parentElement?.append(disconnectButton);
          }
        }
      }
    }
  };
  const loadSourceState = async () => {
    const state = await api("/api/community/me/activity-sources");
    renderSourceState(state);
    return state;
  };
  const stravaButton = document.querySelector('[data-provider-connect="strava"]');
  stravaButton?.addEventListener("click", async () => {
    if (stravaButton.dataset.providerSync === "strava") {
      try {
        stravaButton.disabled = true;
        setStatus("Synchronizing Strava activities…");
        const result = await api("/api/community/me/activity-sources/strava/sync", { method: "POST" });
        await loadSourceState();
        setStatus("Strava synchronized. " + result.created + " new activit" + (result.created === 1 ? "y" : "ies") + " added; " + (result.reclassified || 0) + " historical records repaired.");
      } catch (error) {
        setStatus(error.message || "Strava synchronization failed.", true);
      } finally {
        stravaButton.disabled = false;
      }
      return;
    }
    window.location.assign("/api/community/oauth/strava/start");
  });
  document.addEventListener("click", async event => {
    const disconnectButton = event.target.closest?.('[data-provider-disconnect="strava"]');
    if (!disconnectButton) return;
    try {
      disconnectButton.disabled = true;
      setStatus("Disconnecting Strava…");
      await api("/api/community/me/activity-sources/strava/disconnect", { method: "POST" });
      disconnectButton.remove();
      delete stravaButton.dataset.providerSync;
      stravaButton.dataset.providerConnect = "strava";
      stravaButton.textContent = "Connect Strava";
      await loadSourceState();
      setStatus("Strava disconnected. Existing verified Passport evidence was preserved.");
    } catch (error) {
      setStatus(error.message || "Strava could not be disconnected.", true);
      disconnectButton.disabled = false;
    }
  });
  const oauthResult = new URLSearchParams(globalThis.location?.search || "").get("strava");
  if (oauthResult === "connected") setStatus("Strava connected. Your recent activities were imported into your Athlete Passport.");
  else if (oauthResult === "denied") setStatus("Strava authorization was cancelled.", true);
    for (const button of document.querySelectorAll("[data-activity-import]")) {
    button.addEventListener("click", () => {
      requestedType = String(button.dataset.activityImport || "").toLowerCase();
      input?.click();
    });
  }
  input?.addEventListener("change", async () => {
    const file = input.files?.[0];
    if (!file) return;
    const ext = "." + String(file.name || "").split(".").pop().toLowerCase();
    if (![".gpx", ".tcx"].includes(ext) || (requestedType && ext !== "." + requestedType)) {
      setStatus("Choose a " + (requestedType ? requestedType.toUpperCase() : "GPX or TCX") + " activity file.", true);
      input.value = "";
      return;
    }
    const source = ext.slice(1);
    try {
      setStatus("Reading " + file.name + "…");
      const text = await file.text();
      const { parsePortableActivity } = await import("../community-core.mjs");
      const activity = parsePortableActivity({ source, fileName: file.name, text });
      const response = await api("/api/community/me/activities/import", { method: "POST", body: JSON.stringify(activity) });
      await loadSourceState();
      setStatus(file.name + (response.deduplicated ? " matched an existing activity; provenance was preserved." : " imported into your Athlete Passport."));
    } catch (error) {
      setStatus(error.message || "Activity import failed.", true);
    } finally {
      input.value = "";
    }
  });
  primary?.addEventListener("change", async () => {
    const source = String(primary.value || "");
    if (!source) return;
    try {
      await api("/api/community/me/activity-sources/primary", { method: "PATCH", body: JSON.stringify({ source }) });
      const state = await loadSourceState();
      setStatus((state.primarySource || source).toUpperCase() + " is now your primary activity source.");
    } catch (error) {
      setStatus(error.message || "Primary source could not be saved.", true);
      await loadSourceState().catch(() => {});
    }
  });
  loadSourceState().catch(error => setStatus(error.message || "Connected Sources could not be loaded.", true));
}

function setAdminPane(name = "people") {
  for (const button of $$("[data-admin-tab]")) {
    const active = button.dataset.adminTab === name;
    button.classList.toggle("active", active);
    button.setAttribute("aria-selected", active ? "true" : "false");
  }
  for (const pane of $$("[data-admin-pane]")) {
    pane.hidden = pane.dataset.adminPane !== name;
  }
  const setup = $("#initialAdminSetup");
  if (setup) setup.hidden = name !== "roles" || !(state.me?.adminRole === "founder"
    && (state.health?.activeAdmins || 0) < (state.health?.policy?.minimumActiveAdmins || 3));
}

async function renderDashboardRoute(path) {
  const routeView = $("#routeView");
  if (routeView) routeView.hidden = true;
  const destination = $("#publicDestination");
  if (destination) destination.hidden = true;
  const forumPrompt = $("#forumPrompt");
  if (forumPrompt) forumPrompt.hidden = true;

  if (path === "/community/create") {
    if (!state.me?.authenticated) { history.replaceState({}, "", "/community#account"); openAccountPanel(); return true; }
    setCommunityViewMode("destination"); const createView=$("#communityCreateView"); if(createView) createView.hidden=false; $(".community-social-shell")?.setAttribute("hidden",""); $("#publicDestination")?.setAttribute("hidden",""); document.title="Create Community · VYBES"; return true;
  }

  if (path === "/dashboard") {
    if (!state.me?.authenticated) {
      history.replaceState({}, "", "/community#account");
      document.body.dataset.accountOpen = "true";
      setCommunityViewMode("community");
      await renderPublicDestination();
      await loadFeed();
      requestAnimationFrame(() => $("#account")?.scrollIntoView({ block: "start" }));
      return true;
    }
    setCommunityViewMode("member-dashboard");
    setMemberPane(state.me?.user?.status === "active" ? "create" : "profile");
    document.title = "My VYNDI · Member Dashboard";
    await loadPinnedAnnouncements();
    return true;
  }

  if (path === "/admin") {
    if (!state.me?.authenticated) {
      history.replaceState({}, "", "/community#account");
      document.body.dataset.accountOpen = "true";
      setCommunityViewMode("community");
      await renderPublicDestination();
      await loadFeed();
      requestAnimationFrame(() => $("#account")?.scrollIntoView({ block: "start" }));
      return true;
    }
    if (!state.me?.adminRole) {
      history.replaceState({}, "", "/dashboard");
      return renderDashboardRoute("/dashboard");
    }
    setCommunityViewMode("admin-dashboard");
    setAdminPane("people");
    document.title = "VYNDI · Admin Dashboard";
    await loadAnnouncementQueue();
    return true;
  }

  return false;
}

async function navigateCommunityRoute(path, { replace = false } = {}) {
  if (!path) return;
  const createView = $("#communityCreateView");
  if (createView) createView.hidden = path !== "/community/create";
  if (path !== "/community/create") $(".community-social-shell")?.removeAttribute("hidden");
  setMobileSheet(null);
  state.feedRequest++;
  state.destinationRequest++;

  if (path !== location.pathname || location.hash) {
    commitNavigationState(path, { replace });
  }

  $("#routeView")?.setAttribute("hidden", "");

  if (path === "/dashboard" || path === "/admin" || path === "/community/create") {
    await renderDashboardRoute(path);
  } else {
    setCommunityViewMode(path === "/community" ? "community" : "destination");
    const rendered = await renderPublicDestination();
    if (!rendered) await loadFeed();
  }

  window.scrollTo({ top: 0, behavior: "auto" });
}

async function renderPublicDestination() {
  const config = PUBLIC_DESTINATIONS[location.pathname];
  const destination = $("#publicDestination");
  const discover = $(".discover-section");
  const purpose = $(".purpose-grid");
  const forumPrompt = $("#forumPrompt");

  if (!config) {
    setCommunityViewMode("community");
    document.body.dataset.accountOpen = isAccountAccessHash() ? "true" : "false";
    destination.hidden = true;
    if (discover) discover.hidden = false;
    if (purpose) purpose.hidden = false;
    if (forumPrompt) forumPrompt.hidden = true;
    await loadCommunityDashboardRail();
    return false;
  }

  setCommunityViewMode("destination");
  destination.hidden = false;
  if (discover) discover.hidden = true;
  if (purpose) purpose.hidden = true;
  if (forumPrompt) forumPrompt.hidden = location.pathname !== "/forum";

  $("#destinationEyebrow").textContent = config.eyebrow;
  $("#destinationTitle").textContent = config.title;
  $("#destinationDescription").textContent = config.description;
  document.title = `${config.eyebrow} · VYNDI Ride Stories`;

  const feed = $("#destinationFeed");
  const riders = $("#publicRiders");
  feed.hidden = false;
  riders.hidden = true;

  if (config.riders) await loadPublicRiders();
  else await loadDestinationPosts(config.type);
  applyCommunitySearch();

  return true;
}

function appendInlineArticleMarkup(parent, text) {
  const source = String(text || "");
  const token = /(\*\*[^*\n]+\*\*|\*[^*\n]+\*|\[[^\]\n]+\]\(https?:\/\/[^)\s]+\))/g;
  let cursor = 0;
  for (const match of source.matchAll(token)) {
    const index = match.index ?? 0;
    if (index > cursor) parent.append(document.createTextNode(source.slice(cursor, index)));
    const value = match[0];
    if (value.startsWith("**")) {
      const strong = document.createElement("strong");
      strong.textContent = value.slice(2, -2);
      parent.append(strong);
    } else if (value.startsWith("*")) {
      const em = document.createElement("em");
      em.textContent = value.slice(1, -1);
      parent.append(em);
    } else {
      const linkMatch = value.match(/^\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)$/);
      if (linkMatch) {
        const link = document.createElement("a");
        link.href = linkMatch[2];
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        link.textContent = linkMatch[1];
        parent.append(link);
      } else {
        parent.append(document.createTextNode(value));
      }
    }
    cursor = index + value.length;
  }
  if (cursor < source.length) parent.append(document.createTextNode(source.slice(cursor)));
}

function renderRichArticleBody(container, text) {
  container.replaceChildren();
  let list = null;
  const lines = String(text || "").replace(/\r\n/g, "\n").split("\n");
  for (const rawLine of lines) {
    const line = rawLine.trimEnd();
    if (!line.trim()) {
      list = null;
      continue;
    }

    const headingMatch = line.match(/^(#{1,3})\s+(.+)$/);
    if (headingMatch) {
      list = null;
      const heading = document.createElement(`h${Math.min(4, headingMatch[1].length + 1)}`);
      appendInlineArticleMarkup(heading, headingMatch[2]);
      container.append(heading);
      continue;
    }

    const quoteMatch = line.match(/^>\s?(.+)$/);
    if (quoteMatch) {
      list = null;
      const quote = document.createElement("blockquote");
      appendInlineArticleMarkup(quote, quoteMatch[1]);
      container.append(quote);
      continue;
    }

    const bulletMatch = line.match(/^[-*]\s+(.+)$/);
    if (bulletMatch) {
      if (!list) {
        list = document.createElement("ul");
        container.append(list);
      }
      const item = document.createElement("li");
      appendInlineArticleMarkup(item, bulletMatch[1]);
      list.append(item);
      continue;
    }

    list = null;
    const paragraph = document.createElement("p");
    appendInlineArticleMarkup(paragraph, line);
    container.append(paragraph);
  }
}

function renderBodyText(container, text) {
  renderRichArticleBody(container, text);
}

async function renderStoryRoute(slug) {
  setCommunityViewMode("destination");
  $(".discover-section")?.setAttribute("hidden", "");
  $(".purpose-grid")?.setAttribute("hidden", "");
  $("#publicDestination")?.setAttribute("hidden", "");
  const routeView = $("#routeView");
  routeView.hidden = false;
  try {
    const data = await api(`/api/community/stories/${encodeURIComponent(slug)}`);
    const story = data.story;
    state.activeStory = story;

    const article = document.createElement("article");
    article.className = "story-reading";
    const back = document.createElement("a");
    back.className = "back-link";
    back.href = "/community";
    back.textContent = "← Back to community";

    const eyebrow = document.createElement("p");
    eyebrow.className = "eyebrow";
    eyebrow.textContent = contentTypeLabel(story.type);

    const h1 = document.createElement("h1");
    h1.textContent = story.title;

    const byline = document.createElement("p");
    byline.className = "byline";
    const author = document.createElement("a");
    author.href = story.author?.handle ? `/riders/${story.author.handle}` : "/community";
    author.textContent = story.author?.displayName || "VYNDI rider";
    byline.append("By ", author, document.createTextNode(` · ${formatDate(story.originalPublishedAt || story.publishedAt)}`));

    article.append(back, eyebrow, h1, byline);

    if (story.coverPhotoDataUrl) {
      const cover = document.createElement("img");
      cover.className = "story-cover";
      cover.src = story.coverPhotoDataUrl;
      cover.alt = `${story.title} cover`;
      article.append(cover);
    }

    const storyActions = document.createElement("div");
    storyActions.className = "story-actions";
    storyActions.append(makeGloryButton(story));

    if (state.me?.authenticated && state.me.user?.status === "active") {
      const report = document.createElement("button");
      report.type = "button";
      report.className = "report-button";
      report.textContent = "Report";
      report.addEventListener("click", async () => {
        const reason = window.prompt("Why are you reporting this publication?", "") || "";
        if (!reason.trim()) return;
        try {
          await api("/api/community/reports", {
            method: "POST",
            body: JSON.stringify({ targetType: "post", targetId: story.id, reason })
          });
          report.textContent = "Reported";
          report.disabled = true;
        } catch (error) {
          report.textContent = error.message;
        }
      });
      storyActions.append(report);
    }
    article.append(storyActions);

    if (story.originalPublishedAt || story.legacySourceUrl) {
      const provenance = document.createElement("div");
      provenance.className = "provenance";
      const parts = [];
      if (story.originalPublishedAt) parts.push(`Originally published ${formatDate(story.originalPublishedAt)}`);
      if (story.legacySourceUrl) parts.push("Imported with original-source attribution preserved");
      provenance.textContent = parts.join(" · ");
      if (story.legacySourceUrl) {
        const source = document.createElement("a");
        source.href = story.legacySourceUrl;
        source.target = "_blank";
        source.rel = "noopener noreferrer";
        source.textContent = " · Original source ↗";
        provenance.append(source);
      }
      article.append(provenance);
    }

    const body = document.createElement("div");
    body.className = "body-copy";
    renderRichArticleBody(body, story.body);
    article.append(body);

    if (Array.isArray(story.photos) && story.photos.length) {
      const gallery = document.createElement("div");
      gallery.className = "story-photo-gallery";
      for (const photo of story.photos) {
        const figure = document.createElement("figure");
        const image = document.createElement("img");
        image.src = photo.dataUrl;
        image.alt = photo.caption || `${story.title} article photo`;
        image.loading = "lazy";
        figure.append(image);
        if (photo.caption) {
          const caption = document.createElement("figcaption");
          caption.textContent = photo.caption;
          figure.append(caption);
        }
        gallery.append(figure);
      }
      article.append(gallery);
    }

    const comments = document.createElement("section");
    comments.className = "panel";
    comments.innerHTML = story.type === "discussion" ? "<p class='eyebrow'>FORUM THREAD</p><h3>Replies</h3>" : "<p class='eyebrow'>RIDER DISCUSSION</p><h3>Comments</h3>";
    const list = document.createElement("div");
    list.className = "my-posts";
    comments.append(list);

    try {
      const commentData = await api(`/api/community/posts/${encodeURIComponent(story.id)}/comments`);
      if (!commentData.comments?.length) {
        const p = document.createElement("p");
        p.className = "muted";
        p.textContent = "No comments yet.";
        list.append(p);
      } else {
        for (const comment of commentData.comments) {
          const item = document.createElement("div");
          item.className = "my-post";
          const copy = document.createElement("div");
          const name = document.createElement("h4");
          name.textContent = comment.display_name || comment.handle;
          const text = document.createElement("p");
          text.textContent = comment.body;
          copy.append(name, text);
          item.append(copy);
          list.append(item);
        }
      }
    } catch {}

    if (state.me?.authenticated && state.me.user?.status === "active") {
      const form = document.createElement("form");
      form.className = "form-panel";
      const label = document.createElement("label");
      label.textContent = story.type === "discussion" ? "Write a reply" : "Add a cycling-focused comment";
      const textarea = document.createElement("textarea");
      textarea.rows = 3;
      textarea.maxLength = 2000;
      textarea.required = true;
      label.append(textarea);
      const button = document.createElement("button");
      button.className = "button secondary";
      button.type = "submit";
      button.textContent = story.type === "discussion" ? "Post reply" : "Post comment";
      const status = document.createElement("p");
      status.className = "form-status";
      form.append(label, button, status);
      form.addEventListener("submit", async event => {
        event.preventDefault();
        try {
          await api(`/api/community/posts/${encodeURIComponent(story.id)}/comments`, {
            method: "POST",
            body: JSON.stringify({ body: textarea.value })
          });
          location.reload();
        } catch (error) {
          setStatus(status, error.message, true);
        }
      });
      comments.append(form);
    }

    article.append(comments);
    routeView.replaceChildren(article);
    routeView.scrollIntoView({ behavior: "smooth", block: "start" });
  } catch (error) {
    const p = document.createElement("p");
    p.textContent = error.message;
    routeView.replaceChildren(p);
  }
}

async function loadDirectConversation(rider, root) {
  let panel = root.querySelector(".direct-conversation");
  if (panel) { panel.remove(); return; }
  panel=document.createElement("section"); panel.className="direct-conversation"; panel.textContent="Loading conversation…"; root.append(panel);
  try {
    const data=await api(`/api/community/messages/${encodeURIComponent(rider.handle)}`); panel.replaceChildren();
    const title=document.createElement("h3"); title.textContent=`Messages with ${rider.displayName}`; panel.append(title);
    const thread=document.createElement("div"); thread.className="direct-message-thread";
    for(const item of data.messages||[]){const row=document.createElement("p");row.className="direct-message";row.textContent=`${item.sender_name || item.sender_handle}: ${item.body}`;thread.append(row);} panel.append(thread);
    const form=document.createElement("form");form.className="direct-message-form";const input=document.createElement("textarea");input.required=true;input.maxLength=2000;input.rows=2;input.placeholder="Write a private message…";const send=document.createElement("button");send.className="button primary";send.type="submit";send.textContent="Send";form.append(input,send);form.addEventListener("submit",async event=>{event.preventDefault();send.disabled=true;try{await api(`/api/community/messages/${encodeURIComponent(rider.handle)}`,{method:"POST",body:JSON.stringify({body:input.value})});panel.remove();await loadDirectConversation(rider,root);}catch(error){input.setCustomValidity(error.message);input.reportValidity();input.setCustomValidity("");}finally{send.disabled=false;}});panel.append(form);
  } catch(error){panel.textContent=error.message;}
}

async function renderPublicPassportRoute(passportId) {
  setCommunityViewMode("destination");
  $(".discover-section")?.setAttribute("hidden","");
  $(".purpose-grid")?.setAttribute("hidden","");
  $("#publicDestination")?.setAttribute("hidden","");
  $(".community-social-shell")?.setAttribute("hidden","");
  const routeView=$("#routeView"); routeView.hidden=false; routeView.replaceChildren();
  const shell=document.createElement("article"); shell.className="public-passport-shell passport-experience";
  shell.innerHTML='<div class="passport-public-loading"><span>VYNDI ATHLETE PASSPORT</span><strong>Loading verified endurance identity…</strong></div>'; routeView.append(shell);
  try{
    const result=await api("/api/community/passport/"+encodeURIComponent(passportId));
    const data=result.publicPassport||result;
    const totals=data.totals||{}, rider=data.rider||{};
    shell.replaceChildren();
    const hero=document.createElement("header");hero.className="public-passport-hero";hero.innerHTML='<span class="passport-public-mark">VYNDI ATHLETE PASSPORT</span><h1></h1><p></p><div class="passport-public-id"></div>';
    hero.querySelector("h1").textContent=rider.displayName||"Endurance athlete";
    hero.querySelector("p").textContent=[rider.handle?"@"+rider.handle:"",data.roadDNA?.primaryDiscipline||"",data.issuedAt?"Verified since "+new Date(data.issuedAt).toLocaleDateString():""].filter(Boolean).join(" · ");
    hero.querySelector(".passport-public-id").textContent=data.passportId||passportId;shell.append(hero);
    const totalsGrid=document.createElement("section");totalsGrid.className="passport-kpi-grid public-passport-kpis";
    for(const [label,value] of [["Activities",passportNumber(totals.activityCount)],["Distance",passportNumber(Number(totals.distanceMeters||0)/1000,1)+" km"],["Elevation",passportNumber(totals.elevationGainMeters)+" m"],["Moving time",passportNumber(Number(totals.durationSeconds||0)/3600,1)+" h"]]){const card=document.createElement("article");const strong=document.createElement("strong");strong.textContent=value;const span=document.createElement("span");span.textContent=label;card.append(strong,span);totalsGrid.append(card)}shell.append(totalsGrid);
    const visual=document.createElement("section");visual.className="passport-visual-intelligence public-passport-visuals";visual.innerHTML='<article class="passport-visual-card passport-journey-card"><div class="passport-section-heading"><div><span>PERFORMANCE JOURNEY</span><h4>Years on the road</h4></div></div><div id="passportJourneyChart" class="passport-journey-chart"></div></article><article class="passport-visual-card"><div class="passport-section-heading"><div><span>DISCIPLINE MIX</span><h4>Movement signature</h4></div></div><div id="passportDisciplineMix" class="passport-discipline-mix"></div></article><article class="passport-visual-card"><div class="passport-section-heading"><div><span>METTLE & CALIBRE</span><h4>Transparent dimensions</h4></div><small>No overall score</small></div><div id="passportCalibreVisual" class="passport-calibre-visual"></div></article>';shell.append(visual);
    renderPassportJourneyChart(data.roadLegacy||[]);renderPassportDisciplineMix(data.roadDNA?.disciplineMix||[]);renderPassportCalibreVisual(data.calibre||{},data.roadDNA||{});
    const hall=document.createElement("section");hall.className="passport-records-section passport-endurance-hall";hall.innerHTML='<div class="passport-section-heading"><div><span>ENDURANCE HALL</span><h4>Journeys that define the rider</h4></div></div><div class="passport-endurance-hall-track"><div class="passport-event-records"></div></div>';const hallRoot=hall.querySelector(".passport-event-records");
    for(const activity of data.enduranceEventRecords||[]){const row=document.createElement("article");row.className="passport-event-row";const n=document.createElement("strong");n.textContent=activity.activity_name||"Endurance event";const stats=document.createElement("span");stats.textContent=passportNumber(activity.distance_meters/1000,1)+" km · "+passportNumber(activity.elevation_gain_meters)+" m ↑";const meta=document.createElement("small");meta.textContent=new Date(activity.started_at).toLocaleDateString()+" · "+String(activity.primary_source||"").toUpperCase();row.append(n,stats,meta);hallRoot.append(row)}shell.append(hall);
    const legacy=document.createElement("section");legacy.className="passport-insight-card passport-legacy-card";legacy.innerHTML='<div class="panel-kicker"><span>ROAD LEGACY</span><small>Year-by-year endurance history</small></div><div class="passport-legacy-timeline"><div id="passportLegacy"></div></div>';const legacyRoot=legacy.querySelector("#passportLegacy");for(const year of data.roadLegacy||[]){const row=document.createElement("p");const y=document.createElement("b");y.textContent=year.year;const m=document.createElement("span");m.textContent=passportNumber(year.distanceMeters/1000,0)+" km · "+passportNumber(year.elevationGainMeters)+" m · "+passportNumber(year.activities)+" activities";row.append(y,m);legacyRoot.append(row)}shell.append(legacy);
    const proof=document.createElement("div");proof.className="passport-public-proof";const verify=new URL("/api/community/passport/"+encodeURIComponent(data.passportId||passportId),location.origin).toString();const a=document.createElement("a");a.className="button secondary";a.href=verify;a.target="_blank";a.rel="noopener";a.textContent="Verify evidence";const note=document.createElement("span");note.textContent=(data.sources?.length||0)+" verified evidence source"+((data.sources?.length||0)===1?"":"s");proof.append(a,note);shell.append(proof);
    document.title=(rider.displayName||"Athlete")+" · VYNDI Athlete Passport";
  }catch(error){shell.textContent=error.message||"Passport could not be loaded."}
}

async function renderRiderRoute(handle) {
  setCommunityViewMode("destination");
  $(".discover-section")?.setAttribute("hidden", "");
  $(".purpose-grid")?.setAttribute("hidden", "");
  $("#publicDestination")?.setAttribute("hidden", "");
  const routeView = $("#routeView");
  routeView.hidden = false;
  try {
    const data = await api(`/api/community/riders/${encodeURIComponent(handle)}`);
    const rider = data.rider;

    const article = document.createElement("article");
    article.className = "rider-view";
    const summary = document.createElement("aside");
    summary.className = "rider-profile-summary";
    summary.setAttribute("aria-label", "Rider profile");

    const head = document.createElement("div");
    head.className = "public-profile-head";
    const visual = createProfileVisual(rider);
    const headCopy = document.createElement("div");

    const h1 = document.createElement("h1");
    h1.textContent = rider.displayName;
    headCopy.append(h1);
    const identityLine = document.createElement("p");
    identityLine.className = "meta";
    identityLine.textContent = `@${rider.handle}${rider.adminRole ? ` · ${rider.adminRole.replace(/_/g, " ")}` : " · member"}`;
    headCopy.append(identityLine);
    head.append(visual, headCopy);

    const meta = document.createElement("div");
    meta.className = "rider-meta";
    for (const value of [[rider.city, rider.state].filter(Boolean).join(", "), (rider.disciplines || []).join(" · "), rider.joinedAt ? `Joined ${formatDate(rider.joinedAt)}` : ""].filter(Boolean)) {
      const span = document.createElement("span");
      span.textContent = value;
      meta.append(span);
    }

    const bio = document.createElement("p");
    bio.className = "rider-profile-bio";
    bio.textContent = rider.bio || "Cycling stories, routes and knowledge published on VYNDI Ride Stories.";

    const stats = document.createElement("div");
    stats.className = "rider-stats";
    for (const [label, value] of [["Stories", data.posts?.length || 0], ["Followers", data.followers || 0], ["Following", data.following || 0]]) {
      const box = document.createElement("div");
      const b = document.createElement("b");
      b.textContent = String(value);
      const small = document.createElement("small");
      small.textContent = label;
      box.append(b, small);
      stats.append(box);
    }

    summary.append(head, meta, bio);
    const socials = socialProfileLinks(rider);
    if (socials.childElementCount) summary.append(socials);
    summary.append(stats);

    if (Array.isArray(data.resourceLinks) && data.resourceLinks.length) {
      const resources = document.createElement("section");
      resources.className = "public-profile-links";
      const resourceTitle = document.createElement("h3");
      resourceTitle.textContent = "Shared resources";
      const resourceList = document.createElement("div");
      resourceList.className = "shared-resource-list";
      renderSharedResources(resourceList, data.resourceLinks);
      resources.append(resourceTitle, resourceList);
      summary.append(resources);
    }

    if (state.me?.authenticated && state.me.user?.status === "active" && state.me.user.handle !== rider.handle) {
      const follow = document.createElement("button");
      follow.className = "button secondary";
      follow.textContent = "Follow rider";
      follow.addEventListener("click", async () => {
        try {
          await api(`/api/community/riders/${encodeURIComponent(rider.handle)}/follow`, { method: "POST", body: "{}" });
          follow.textContent = "Following";
          follow.disabled = true;
        } catch (error) {
          follow.textContent = error.message;
        }
      });
      const message = document.createElement("button");
      message.className = "button quiet";
      message.textContent = "Message rider";
      message.addEventListener("click", () => loadDirectConversation(rider, summary));
      const block = document.createElement("button");
      block.className = "button quiet rider-block-button";
      block.textContent = data.blockedByMe ? "Unblock rider" : "Block rider";
      block.addEventListener("click", async () => {
        const blocking = block.textContent === "Block rider";
        try {
          await api(`/api/community/riders/${encodeURIComponent(rider.handle)}/block`, { method: blocking ? "POST" : "DELETE", body: "{}" });
          block.textContent = blocking ? "Unblock rider" : "Block rider";
          follow.disabled = blocking;
          message.disabled = blocking;
          if (blocking) follow.textContent = "Follow rider";
        } catch (error) { block.textContent = error.message; }
      });
      follow.disabled = Boolean(data.blockedByMe);
      message.disabled = Boolean(data.blockedByMe);
      summary.append(follow, message, block);
    }

    const grid = document.createElement("div");
    grid.className = "story-grid";
    const activity = document.createElement("section");
    activity.className = "rider-profile-posts";
    const postsTitle = document.createElement("h2");
    postsTitle.textContent = "Posts";
    activity.append(postsTitle, grid);
    if (!data.posts?.length) {
      const empty = document.createElement("article");
      empty.className = "empty-card";
      empty.textContent = "No published Ride Blog entries yet.";
      grid.append(empty);
    } else {
      for (const post of data.posts) grid.append(createStoryCard(post));
    }
    article.append(summary, activity);
    routeView.replaceChildren(article);
    routeView.scrollIntoView({ behavior: "smooth", block: "start" });
  } catch (error) {
    const p = document.createElement("p");
    p.textContent = error.message;
    routeView.replaceChildren(p);
  }
}

function syncMemberRouteLinks(authenticated = false) {
  for (const memberLink of $$("[data-member-gate]")) {
    if (authenticated) {
      memberLink.href = "/dashboard";
      memberLink.setAttribute("data-app-route", "");
    } else {
      memberLink.href = "/community#account";
      memberLink.removeAttribute("data-app-route");
    }
  }
}

function renderMemberState() {
  const headerAccount = $("#accountHeaderLink");
  const sidebarAdminLink = $("#sidebarAdminLink");
  const mobileAdminLink = $("#mobileAdminLink");
  const guest = $("#authGuest");
  const dashboard = $("#memberDashboard");
  const studio = $("#journalStudio");
  const adminPanel = $("#adminPanel");
  const bootstrap = $("#founderBootstrap");

  if (!state.me?.authenticated) {
    document.body.dataset.auth = "guest";
    document.body.dataset.accountOpen = location.hash === "#account" ? "true" : "false";
    if (headerAccount) {
      headerAccount.href = "/community#account";
      headerAccount.removeAttribute("data-app-route");
    }
    syncMemberRouteLinks(false);
    setHeaderProfile(null);
    renderCommunityRailProfile();
    if (sidebarAdminLink) sidebarAdminLink.hidden = true;
    if (mobileAdminLink) mobileAdminLink.hidden = true;
    guest.hidden = false;
    dashboard.hidden = true;
    studio.hidden = true;
    adminPanel.hidden = true;
    return;
  }

  document.body.dataset.auth = "member";
  document.body.dataset.accountOpen = "false";
  guest.hidden = true;
  dashboard.hidden = false;

  const user = state.me.user;
  syncMemberRouteLinks(true);
  if (headerAccount) {
    headerAccount.href = `/riders/${user.handle}`;
    headerAccount.removeAttribute("data-app-route");
  }
  setHeaderProfile(user);
  renderCommunityRailProfile();
  if (sidebarAdminLink) sidebarAdminLink.hidden = !state.me.adminRole;
  if (mobileAdminLink) mobileAdminLink.hidden = !state.me.adminRole;
  $("#memberName").textContent = user.displayName;
  $("#myJournalLink").href = `/riders/${user.handle}`;
  populateProfileForm();
  loadProfileResourceLinks();

  const membership = state.me.membership || {};
  const sharedLinksPanel = $(".shared-links-panel");
  if (sharedLinksPanel) sharedLinksPanel.hidden = user.status !== "active";
  if (user.status === "active") {
    $("#memberStatus").textContent = state.me.adminRole
      ? `Active member · ${state.me.adminRole.replace(/_/g, " ")}`
      : "Active member · Ride Blog publishing enabled";
    studio.hidden = false;
    for (const tab of $$("[data-member-tab]")) tab.hidden = false;
    loadMyPosts();
    loadPinnedAnnouncements();
  } else {
    const approvalText = Number.isFinite(membership.approvals) ? ` · ${membership.approvals}/2 approvals` : "";
    $("#memberStatus").textContent = `${String(user.status || "pending").replace(/_/g, " ")}${approvalText}`;
    studio.hidden = false;
    for (const tab of $$("[data-member-tab]")) tab.hidden = tab.dataset.memberTab !== "profile";
    setMemberPane("profile");
  }

  bootstrap.hidden = !(state.health?.activeAdmins === 0 && state.me.authenticated);
  adminPanel.hidden = !state.me.adminRole;
  if (state.me.adminRole) {
    $("#initialAdminSetup").hidden = !$("[data-admin-tab=\"roles\"]")?.classList.contains("active")
      || !(state.me.adminRole === "founder" && (state.health?.activeAdmins || 0) < (state.health?.policy?.minimumActiveAdmins || 3));
    const founderOption = $("#announcementType")?.querySelector('option[value="founder_message"]');
    if (founderOption) founderOption.disabled = state.me.adminRole !== "founder";
    const presetButton = $("#loadFounderWelcome");
    if (presetButton) presetButton.hidden = state.me.adminRole !== "founder";
    loadCommunityPeople();
    loadMembershipQueue();
    loadAdminNominations();
    loadPostReviewQueue();
    loadAnnouncementQueue();
    loadModerationQueue();
    loadPasswordRecoveryRequests();
  }
}

async function refreshSession() {
  try {
    state.health = await api("/api/community/health");
  } catch {
    state.health = null;
  }
  try {
    state.me = await api("/api/community/me");
  } catch {
    state.me = { authenticated: false };
  }
  renderMemberState();
  renderTodayForYou();
  if (location.pathname === "/community") showAccountAccessFromHash();
}

async function loadMyPosts() {
  const root = $("#myPosts");
  if (!root) return;
  root.replaceChildren();
  try {
    const data = await api("/api/community/my/posts");
    if (!data.posts?.length) {
      const p = document.createElement("p");
      p.className = "muted";
      p.textContent = "Your Ride Blog is empty. Create your first meaningful cycling entry.";
      root.append(p);
      return;
    }
    for (const post of data.posts) {
      const item = document.createElement("article");
      item.className = "my-post";
      const copy = document.createElement("div");
      const title = document.createElement("h4");
      title.textContent = post.title;
      const meta = document.createElement("p");
      meta.textContent = `${contentTypeLabel(post.type)} · Updated ${formatDate(post.updatedAt)}`;
      copy.append(title, meta);

      const right = document.createElement("div");
      const pill = document.createElement("span");
      pill.className = `status-pill ${post.status}`;
      pill.textContent = post.status.replace(/_/g, " ");
      right.append(pill);

      const edit = document.createElement("button");
      edit.type = "button";
      edit.className = "button quiet";
      edit.style.marginTop = "8px";
      edit.textContent = "Edit";
      edit.addEventListener("click", async () => {
        edit.disabled = true;
        edit.textContent = "Opening…";
        try {
          const detail = await api(`/api/community/my/posts/${encodeURIComponent(post.id)}`);
          startEditingPost(detail.post);
        } catch (error) {
          setStatus($("#newPostStatus"), error.message, true);
        } finally {
          edit.disabled = false;
          edit.textContent = "Edit";
        }
      });
      right.append(edit);

      if (post.status === "draft") {
        const publish = document.createElement("button");
        publish.type = "button";
        publish.className = "button quiet";
        publish.style.marginTop = "8px";
        publish.textContent = "Publish";
        publish.addEventListener("click", async () => {
          try {
            const data = await api(`/api/community/posts/${encodeURIComponent(post.id)}/publish`, { method: "POST", body: "{}" });
            setStatus($("#newPostStatus"), `Publication status: ${data.post.status.replace(/_/g, " ")}`);
            await loadMyPosts();
            await loadFeed();
          } catch (error) {
            setStatus($("#newPostStatus"), error.message, true);
          }
        });
        right.append(publish);
      }

      item.append(copy, right);
      root.append(item);
    }
  } catch (error) {
    const p = document.createElement("p");
    p.className = "muted";
    p.textContent = error.message;
    root.append(p);
  }
}

function personMatchesFilter(person, filter, query) {
  const normalizedFilter = String(filter || "all");
  const haystack = [
    person.displayName,
    person.handle,
    person.email,
    person.city,
    person.state,
    person.adminRole
  ].filter(Boolean).join(" ").toLowerCase();
  const normalizedQuery = String(query || "").trim().toLowerCase();

  if (normalizedQuery && !haystack.includes(normalizedQuery)) return false;
  if (normalizedFilter === "admins") return person.adminActive === true;
  if (normalizedFilter === "active") return person.status === "active";
  if (normalizedFilter === "pending") return person.status === "pending" || person.status === "review_required";
  if (normalizedFilter === "rejected") return person.status === "rejected";
  return true;
}

function renderCommunityPeople() {
  const root = $("#communityPeople");
  if (!root) return;
  root.replaceChildren();

  const filter = $("#peopleFilter")?.value || "all";
  const query = $("#peopleSearch")?.value || "";
  const people = state.adminPeople.filter(person => personMatchesFilter(person, filter, query));

  if (!people.length) {
    const empty = document.createElement("p");
    empty.className = "muted";
    empty.textContent = "No people match this view.";
    root.append(empty);
    return;
  }

  const directoryHead = document.createElement("div");
  directoryHead.className = "people-directory-head";
  for (const label of ["Member", "Status / role", "Location", "Joined", "Approved", "Trusted", "Actions"]) {
    const column = document.createElement("span");
    column.textContent = label;
    directoryHead.append(column);
  }
  root.append(directoryHead);

  for (const person of people) {
    const card = document.createElement("article");
    card.className = "person-card";

    const head = document.createElement("div");
    head.className = "person-card-head";

    const identity = document.createElement("div");
    const name = document.createElement("h4");
    name.textContent = person.displayName || person.handle;
    const meta = document.createElement("p");
    meta.className = "meta";
    meta.textContent = `@${person.handle} · ${person.email}`;
    identity.append(name, meta);

    const badges = document.createElement("div");
    badges.className = "person-badges";

    const status = document.createElement("span");
    status.className = `status-pill ${String(person.status || "").replace(/[^a-z_]/g, "")}`;
    status.textContent = String(person.status || "unknown").replace(/_/g, " ");
    badges.append(status);

    if (person.adminActive) {
      const admin = document.createElement("span");
      admin.className = "admin-badge";
      admin.textContent = (person.adminRole || "admin").replace(/_/g, " ");
      badges.append(admin);
    }

    head.append(identity, badges);

    const details = document.createElement("div");
    details.className = "person-details";
    const location = [person.city, person.state].filter(Boolean).join(", ");
    const joined = formatDate(person.createdAt);
    const approved = formatDate(person.approvedAt);

    for (const [label, value] of [
      ["Location", location || "—"],
      ["Joined", joined || "—"],
      ["Approved", approved || "—"],
      ["Trusted", person.trusted ? "Yes" : "No"]
    ]) {
      const item = document.createElement("div");
      const strong = document.createElement("strong");
      strong.textContent = label;
      const span = document.createElement("span");
      span.textContent = value;
      item.append(strong, span);
      details.append(item);
    }

    const footer = document.createElement("div");
    footer.className = "person-actions";
    const journal = document.createElement("a");
    journal.className = "button quiet";
    journal.href = `/riders/${person.handle}`;
    journal.textContent = "View profile";
    footer.append(journal);

    if (person.status === "pending" || person.status === "review_required") {
      const reviewMembership = document.createElement("button");
      reviewMembership.type = "button";
      reviewMembership.className = "button primary";
      reviewMembership.textContent = "Review membership";
      reviewMembership.setAttribute("aria-label", `Review membership request from ${person.displayName || person.handle}`);
      reviewMembership.addEventListener("click", async () => {
        setAdminPane("requests");
        await loadMembershipQueue(person.id);
      });
      footer.append(reviewMembership);
    }

    card.append(head, details, footer);
    root.append(card);
  }
}

async function loadCommunityPeople() {
  const root = $("#communityPeople");
  if (!root || !state.me?.adminRole) return;
  root.replaceChildren();
  const loading = document.createElement("p");
  loading.className = "muted";
  loading.textContent = "Loading community people…";
  root.append(loading);

  try {
    const data = await api("/api/community/admin/people");
    state.adminPeople = Array.isArray(data.people) ? data.people : [];

    const summary = $("#peopleSummary");
    if (summary) {
      const values = [
        data.counts?.totalMembers ?? 0,
        data.counts?.activeMembers ?? 0,
        data.counts?.pendingMembers ?? 0,
        data.counts?.activeAdmins ?? 0
      ];
      const cards = [...summary.querySelectorAll("article")];
      values.forEach((value, index) => {
        const target = cards[index]?.querySelector("b");
        if (target) target.textContent = String(value);
      });
    }

    state.health = {
      ...(state.health || {}),
      activeAdmins: data.counts?.activeAdmins ?? state.health?.activeAdmins,
      policy: data.policy || state.health?.policy
    };

    renderCommunityPeople();
  } catch (error) {
    root.replaceChildren();
    const message = document.createElement("p");
    message.className = "muted";
    message.textContent = error.message;
    root.append(message);
  }
}

async function loadMembershipQueue(focusMembershipId = "") {
  const root = $("#membershipQueue");
  if (!root || !state.me?.adminRole) return;
  root.replaceChildren();
  try {
    const data = await api("/api/community/admin/memberships?status=all");
    state.health = { ...(state.health || {}), activeAdmins: data.activeAdmins, policy: data.policy };
    $("#initialAdminSetup").hidden = !(state.me.adminRole === "founder" && data.activeAdmins < data.policy.minimumActiveAdmins);

    if (!data.memberships?.length) {
      const p = document.createElement("p");
      p.className = "muted";
      p.textContent = "No pending or review-required membership requests.";
      root.append(p);
      return;
    }

    for (const membership of data.memberships) {
      const card = document.createElement("article");
      card.className = "membership-card";
      card.dataset.membershipId = membership.id;
      card.tabIndex = -1;
      const head = document.createElement("div");
      head.className = "membership-card-head";
      const nameBox = document.createElement("div");
      const h4 = document.createElement("h4");
      h4.textContent = membership.display_name;
      const meta = document.createElement("p");
      meta.className = "meta";
      meta.textContent = `@${membership.handle} · ${membership.email} · ${[membership.city, membership.state].filter(Boolean).join(", ")}`;
      nameBox.append(h4, meta);
      const status = document.createElement("span");
      status.className = "status-pill";
      status.textContent = membership.status.replace(/_/g, " ");
      head.append(nameBox, status);

      const reason = document.createElement("p");
      reason.className = "reason";
      reason.textContent = `Why join: ${membership.why_join} · Contribution: ${membership.contribution}`;

      const votes = document.createElement("div");
      votes.className = "vote-line";
      for (const [label, value] of [["Approvals", membership.resolution?.approvals || 0], ["Rejections", membership.resolution?.rejections || 0], ["Holds", membership.resolution?.holds || 0]]) {
        const span = document.createElement("span");
        span.textContent = `${label}: ${value}`;
        votes.append(span);
      }

      const actions = document.createElement("div");
      actions.className = "membership-actions";
      for (const decision of ["approve", "hold", "reject"]) {
        const button = document.createElement("button");
        button.type = "button";
        button.className = decision;
        button.textContent = decision[0].toUpperCase() + decision.slice(1);
        button.addEventListener("click", async () => {
          let reasonText = "";
          if (decision !== "approve") reasonText = window.prompt(`Reason for ${decision}:`, "") || "";
          try {
            const result = await api(`/api/community/admin/memberships/${encodeURIComponent(membership.id)}/review`, {
              method: "POST",
              body: JSON.stringify({ decision, reason: reasonText })
            });
            const approvals = Number(result.resolution?.approvals || 0);
            const requiredApprovals = Number(
              result.resolution?.requiredApprovals
              || state.health?.policy?.joinApprovalsRequired
              || 2
            );
            const displayName = membership.display_name || membership.handle;
            if (result.resolution?.status === "active") {
              window.alert(`${displayName} is now approved and active.`);
            } else if (decision === "approve") {
              window.alert(`Approval recorded for ${displayName}: ${approvals} of ${requiredApprovals} approvals. Another admin must approve before activation.`);
            } else {
              window.alert(`${decision[0].toUpperCase() + decision.slice(1)} decision recorded for ${displayName}.`);
            }
            await loadMembershipQueue();
            await loadCommunityPeople();
          } catch (error) {
            window.alert(error.message);
          }
        });
        actions.append(button);
      }

      card.append(head, reason, votes, actions);
      root.append(card);

      if (focusMembershipId && membership.id === focusMembershipId) {
        card.classList.add("membership-card-focus");
        requestAnimationFrame(() => {
          card.scrollIntoView({ behavior: "smooth", block: "center" });
          card.focus({ preventScroll: true });
        });
      }
    }
  } catch (error) {
    const p = document.createElement("p");
    p.className = "muted";
    p.textContent = error.message;
    root.append(p);
  }
}

async function loadAdminNominations() {
  const root = $("#adminNominationQueue");
  if (!root || !state.me?.adminRole) return;
  root.replaceChildren();
  try {
    const data = await api("/api/community/admin/nominations");
    const nominations = Array.isArray(data.nominations) ? data.nominations : [];
    if (!nominations.length) {
      const empty = document.createElement("p");
      empty.className = "muted";
      empty.textContent = "No pending administrator nominations.";
      root.append(empty);
      return;
    }
    for (const nomination of nominations) {
      const card = document.createElement("article");
      card.className = "membership-card";
      const title = document.createElement("h4");
      title.textContent = nomination.displayName || nomination.handle;
      const meta = document.createElement("p");
      meta.className = "meta";
      meta.textContent = `@${nomination.handle} · ${nomination.email} · ${nomination.nominatedRole.replace(/_/g, " ")}`;
      const votes = document.createElement("p");
      votes.className = "vote-line";
      votes.textContent = `Approvals: ${nomination.approvals}/${nomination.requiredApprovals} · Rejections: ${nomination.rejections}`;
      const actions = document.createElement("div");
      actions.className = "membership-actions";
      if (nomination.reviewedByCurrentAdmin) {
        const recorded = document.createElement("span");
        recorded.className = "status-pill";
        recorded.textContent = "Your decision recorded";
        actions.append(recorded);
      } else {
        for (const decision of ["approve", "reject"]) {
          const button = document.createElement("button");
          button.type = "button";
          button.className = decision;
          button.textContent = decision === "approve" ? "Approve promotion" : "Reject";
          button.addEventListener("click", async () => {
            try {
              const result = await api(`/api/community/admin/nominations/${encodeURIComponent(nomination.id)}/review`, {
                method: "POST",
                body: JSON.stringify({ decision })
              });
              window.alert(result.status === "approved"
                ? `${nomination.displayName} is now an active ${nomination.nominatedRole.replace(/_/g, " ")}.`
                : `Decision recorded. Approvals: ${result.approvals}/${result.requiredApprovals}.`);
              await loadAdminNominations();
              await loadCommunityPeople();
              await refreshSession();
            } catch (error) {
              window.alert(error.message);
            }
          });
          actions.append(button);
        }
      }
      card.append(title, meta, votes, actions);
      root.append(card);
    }
  } catch (error) {
    const message = document.createElement("p");
    message.className = "muted";
    message.textContent = error.message;
    root.append(message);
  }
}

async function loadPostReviewQueue() {
  const root = $("#postReviewQueue");
  if (!root || !state.me?.adminRole) return;
  root.replaceChildren();
  try {
    const data = await api("/api/community/admin/posts?status=under_review");
    if (!data.posts?.length) {
      const empty = document.createElement("p");
      empty.className = "muted";
      empty.textContent = "No Ride Blog entries are awaiting editorial review.";
      root.append(empty);
      return;
    }
    for (const post of data.posts) {
      const card = document.createElement("article");
      card.className = "membership-card";

      const head = document.createElement("div");
      head.className = "membership-card-head";
      const copy = document.createElement("div");
      const title = document.createElement("h4");
      title.textContent = post.title;
      const meta = document.createElement("p");
      meta.className = "meta";
      meta.textContent = `${contentTypeLabel(post.type)} · ${post.author?.displayName || "Rider"} · @${post.author?.handle || "rider"}`;
      copy.append(title, meta);

      const status = document.createElement("span");
      status.className = "status-pill under_review";
      status.textContent = "under review";
      head.append(copy, status);

      const excerpt = document.createElement("p");
      excerpt.className = "reason";
      excerpt.textContent = post.excerpt || String(post.body || "").slice(0, 360);

      const actions = document.createElement("div");
      actions.className = "membership-actions";

      const approve = document.createElement("button");
      approve.type = "button";
      approve.className = "approve";
      approve.textContent = "Approve & publish";
      approve.addEventListener("click", async () => {
        await reviewPost(post.id, "approve", "");
      });

      const changes = document.createElement("button");
      changes.type = "button";
      changes.className = "hold";
      changes.textContent = "Request changes";
      changes.addEventListener("click", async () => {
        const note = window.prompt("What should the rider change before publication?", "") || "";
        if (note.trim()) await reviewPost(post.id, "changes_requested", note);
      });

      actions.append(approve, changes);
      card.append(head, excerpt, actions);
      root.append(card);
    }
  } catch (error) {
    const message = document.createElement("p");
    message.className = "muted";
    message.textContent = error.message;
    root.append(message);
  }
}

async function loadAnnouncementQueue() {
  const root = $("#announcementQueue");
  if (!root || !state.me?.adminRole) return;
  root.replaceChildren();

  try {
    const data = await api("/api/community/admin/announcements");
    const announcements = Array.isArray(data.announcements) ? data.announcements : [];

    if (!announcements.length) {
      const empty = document.createElement("p");
      empty.className = "muted";
      empty.textContent = "No governed announcements have been published yet.";
      root.append(empty);
      return;
    }

    for (const post of announcements) {
      const card = document.createElement("article");
      card.className = "announcement-admin-card";

      const copy = document.createElement("div");
      const heading = document.createElement("div");
      heading.className = "announcement-admin-heading";

      const title = document.createElement("h4");
      title.textContent = post.title;

      const badges = document.createElement("div");
      badges.className = "person-badges";

      const type = document.createElement("span");
      type.className = "admin-badge";
      type.textContent = announcementTypeLabel(post.announcementType);
      badges.append(type);

      const status = document.createElement("span");
      status.className = `status-pill ${post.status}`;
      status.textContent = post.status.replace(/_/g, " ");
      badges.append(status);

      if (post.isPinned) {
        const pin = document.createElement("span");
        pin.className = "pin-badge";
        pin.textContent = "PINNED";
        badges.append(pin);
      }

      heading.append(title, badges);

      const meta = document.createElement("p");
      meta.className = "meta";
      meta.textContent = `${post.authorLabel || "VYNDI Admin"} · Audience: ${post.audience || "all"} · ${formatDate(post.publishedAt || post.createdAt)}`;

      const intro = document.createElement("p");
      intro.textContent = post.excerpt || String(post.body || "").slice(0, 220);

      copy.append(heading, meta, intro);

      const actions = document.createElement("div");
      actions.className = "announcement-actions";

      if (post.status === "published") {
        const view = document.createElement("a");
        view.className = "button quiet";
        view.href = `/stories/${post.slug}`;
        view.textContent = "View";
        actions.append(view);
      }

      const canChangePin = post.announcementType !== "founder_message" || state.me.adminRole === "founder";
      if (canChangePin) {
        const pinButton = document.createElement("button");
        pinButton.type = "button";
        pinButton.className = "button secondary";
        pinButton.textContent = post.isPinned ? "Unpin" : "Pin";
        pinButton.addEventListener("click", async () => {
          try {
            await api(`/api/community/admin/announcements/${encodeURIComponent(post.id)}/pin`, {
              method: "POST",
              body: JSON.stringify({ pinned: !post.isPinned })
            });
            await loadAnnouncementQueue();
            await loadPinnedAnnouncements();
            await loadFeed();
          } catch (error) {
            setStatus($("#announcementStatus"), error.message, true);
          }
        });
        actions.append(pinButton);
      }

      card.append(copy, actions);
      root.append(card);
    }
  } catch (error) {
    const message = document.createElement("p");
    message.className = "muted";
    message.textContent = error.message;
    root.append(message);
  }
}

function loadFounderWelcomePreset() {
  if (state.me?.adminRole !== "founder") return;
  const form = $("#announcementForm");
  if (!form) return;

  form.elements.announcementType.value = "founder_message";
  form.elements.audience.value = "members";
  form.elements.title.value = "Welcome to VYNDI Rides — A Message from the Founder";
  form.elements.excerpt.value = "Every rider has a story, and every road leaves something behind. Welcome to the community we are building together.";
  form.elements.body.value = `Dear Admins, Members, Riders and Friends,

Welcome to VYNDI Rides.

This is the first message I am writing here as the Founder, and I want it to mark the beginning of something much bigger than another cycling website or social platform.

I have spent years on the road as a cyclist—through BRMs, long-distance rides, Paris–Brest–Paris, Kashmir to Kanyakumari, difficult days, beautiful roads, friendships, failures, recoveries and unforgettable finishes.

One thing I have learnt is that every rider has a story, and every road leaves something behind.

That idea is at the heart of VYNDI Rides.

We are building a place where riders can ride, record, remember, share and inspire: through Ride Stories, Blogs, Routes, Terrain Medals, Knowledge, Events, Achievements and Community.

To our Admins:

You are not simply managing a platform. You are helping establish its culture. Please protect this community as a place that is respectful, welcoming, authentic and useful. Encourage genuine stories and healthy discussion. Help new riders feel as valued as experienced endurance cyclists.

Administration should never become a barrier between the rider and the community. It should quietly make the community better.

To our Members:

This platform belongs to the riders who give it life.

Upload your rides. Tell us what happened beyond the GPX line. Share the climb that nearly defeated you, the stranger who helped you, the mechanical problem you somehow solved, the sunrise you will never forget, the brevet where you almost quit, and the finish that made everything worthwhile.

Your ride does not have to be 1,000 kilometres to matter. Ten kilometres can contain a great story too.

VYNDI Rides should never become a place where cyclists compete only for numbers, followers, likes or rankings. Let us build something different—a community where the journey matters as much as the statistics.

This is only the beginning.

Many parts of VYNDI Rides will continue to evolve. Some ideas will work brilliantly. Some will need improvement. New ideas will come from the riders themselves. That is exactly how I want this platform to grow.

Explore it. Use it. Challenge it. Tell us what is missing. And help us build the cycling community we would genuinely want to belong to.

Whether you ride for fitness, adventure, commuting, racing, brevet riding, touring, exploration or simply because being on a bicycle makes you happy—you are welcome here.

Ride the road.
Record the journey.
Share the story.
Inspire the next rider.

Welcome to VYNDI Rides.

Shyam Sundhar
Founder
Vāyú Shastr Pvt Ltd
VYNDI Rides`;
  form.elements.isPinned.checked = true;
  form.elements.publish.checked = true;
  setStatus($("#announcementStatus"), "Founder Welcome #001 loaded. Review it, then publish.");
}

async function loadModerationQueue() {
  const root = $("#moderationQueue");
  if (!root || !state.me?.adminRole) return;
  root.replaceChildren();

  try {
    const data = await api("/api/community/admin/reports");
    if (!data.reports?.length) {
      const empty = document.createElement("p");
      empty.className = "muted";
      empty.textContent = "No open community reports.";
      root.append(empty);
      return;
    }

    for (const report of data.reports) {
      const card = document.createElement("article");
      card.className = "membership-card moderation-card";

      const head = document.createElement("div");
      head.className = "membership-card-head";
      const copy = document.createElement("div");
      const title = document.createElement("h4");
      title.textContent = `${report.target_type.replace(/_/g, " ")} report`;
      const meta = document.createElement("p");
      meta.className = "meta";
      meta.textContent = `Reported by ${report.reporter_name || report.reporter_handle} · ${formatDate(report.created_at)}`;
      copy.append(title, meta);
      const status = document.createElement("span");
      status.className = "status-pill under_review";
      status.textContent = "open";
      head.append(copy, status);

      const reason = document.createElement("p");
      reason.className = "reason";
      reason.textContent = report.reason;

      const target = document.createElement("p");
      target.className = "meta";
      target.textContent = `Target: ${report.target_type} · ${report.target_id}`;

      const actions = document.createElement("div");
      actions.className = "membership-actions";

      const dismiss = document.createElement("button");
      dismiss.type = "button";
      dismiss.className = "hold";
      dismiss.textContent = "Dismiss";
      dismiss.addEventListener("click", () => resolveReport(report.id, "dismiss"));

      actions.append(dismiss);

      if (report.target_type === "post" || report.target_type === "comment") {
        const hide = document.createElement("button");
        hide.type = "button";
        hide.className = "reject";
        hide.textContent = "Hide content";
        hide.addEventListener("click", () => resolveReport(report.id, "hide_content"));
        actions.append(hide);
      }

      if (report.target_type === "user") {
        const suspend = document.createElement("button");
        suspend.type = "button";
        suspend.className = "reject";
        suspend.textContent = "Suspend user";
        suspend.addEventListener("click", () => resolveReport(report.id, "suspend_user"));
        actions.append(suspend);
      }

      card.append(head, reason, target, actions);
      root.append(card);
    }
  } catch (error) {
    const message = document.createElement("p");
    message.className = "muted";
    message.textContent = error.message;
    root.append(message);
  }
}

async function resolveReport(reportId, action) {
  const note = action === "dismiss" ? "" : (window.prompt("Moderator note:", "") || "");
  try {
    await api(`/api/community/admin/reports/${encodeURIComponent(reportId)}/resolve`, {
      method: "POST",
      body: JSON.stringify({ action, note })
    });
    await loadModerationQueue();
    await loadFeed();
  } catch (error) {
    window.alert(error.message);
  }
}

async function reviewPost(postId, decision, note) {
  try {
    await api(`/api/community/admin/posts/${encodeURIComponent(postId)}/review`, {
      method: "POST",
      body: JSON.stringify({ decision, note })
    });
    await loadPostReviewQueue();
    await loadFeed();
  } catch (error) {
    window.alert(error.message);
  }
}

$("#joinForm")?.addEventListener("submit", async event => {
  event.preventDefault();
  const form = event.currentTarget;
  const data = new FormData(form);
  const payload = {
    displayName: data.get("displayName"),
    handle: data.get("handle"),
    email: data.get("email"),
    password: data.get("password"),
    city: data.get("city"),
    state: data.get("state"),
    countryCode: String(data.get("countryCode") || "").trim().toUpperCase(),
    disciplines: String(data.get("disciplines") || "").split(",").map(value => value.trim()).filter(Boolean),
    bio: data.get("bio"),
    whyJoin: data.get("whyJoin"),
    contribution: data.get("contribution")
  };
  try {
    await api("/api/community/auth/register", { method: "POST", body: JSON.stringify(payload) });
    form.reset();
    setStatus($("#joinStatus"), "Joining request submitted. It will be reviewed by your Country Admin team, or the VYBES Global Admin team where no Country Admin is assigned.");
    await refreshSession();
  } catch (error) {
    setStatus($("#joinStatus"), error.message, true);
  }
});

$("#loginForm")?.addEventListener("submit", async event => {
  event.preventDefault();
  const form = event.currentTarget;
  const data = new FormData(form);
  try {
    await api("/api/community/auth/login", {
      method: "POST",
      body: JSON.stringify({ email: data.get("email"), password: data.get("password") })
    });
    form.reset();
    setStatus($("#loginStatus"), "");
    await refreshSession();
    if (state.me?.authenticated) await navigateCommunityRoute("/dashboard");
  } catch (error) {
    setStatus($("#loginStatus"), error.message, true);
  }
});

$("#logoutButton")?.addEventListener("click", async () => {
  try { await api("/api/community/auth/logout", { method: "POST", body: "{}" }); } catch {}
  state.me = { authenticated: false };
  location.href = "/community";
});

$("#bootstrapForm")?.addEventListener("submit", async event => {
  event.preventDefault();
  const form = event.currentTarget;
  const data = new FormData(form);
  try {
    await api("/api/community/admin/bootstrap", {
      method: "POST",
      headers: { "x-vyndi-bootstrap-secret": String(data.get("secret") || "") },
      body: "{}"
    });
    form.reset();
    setStatus($("#bootstrapStatus"), "Founder admin activated. Add the second and third administrators to complete the governance team.");
    await refreshSession();
  } catch (error) {
    setStatus($("#bootstrapStatus"), error.message, true);
  }
});

$("#promoteAdminForm")?.addEventListener("submit", async event => {
  event.preventDefault();
  const form = event.currentTarget;
  const data = new FormData(form);
  try {
    const result = await api("/api/community/admin/promote", {
      method: "POST",
      body: JSON.stringify({ email: data.get("email"), role: data.get("role") })
    });
    form.reset();
    setStatus($("#promoteStatus"), `Admin added. Active admins: ${result.activeAdmins}.`);
    await loadMembershipQueue();
    await loadCommunityPeople();
  } catch (error) {
    setStatus($("#promoteStatus"), error.message, true);
  }
});

$("#adminNominationForm")?.addEventListener("submit", async event => {
  event.preventDefault();
  const form = event.currentTarget;
  const data = new FormData(form);
  try {
    const result = await api("/api/community/admin/nominations", {
      method: "POST",
      body: JSON.stringify({ email: data.get("email"), role: data.get("role") })
    });
    form.reset();
    setStatus($("#adminNominationStatus"), `Nomination recorded: ${result.approvals} of ${result.requiredApprovals} approvals. Another administrator must approve.`);
    await loadAdminNominations();
  } catch (error) {
    setStatus($("#adminNominationStatus"), error.message, true);
  }
});

async function loadPasswordRecoveryRequests() {
  const root = $("#passwordRecoveryQueue");
  if (!root || !state.me?.adminRole) return;
  root.replaceChildren();
  try {
    const data = await api("/api/community/admin/password-recovery-requests");
    if (!data.requests?.length) {
      const empty = document.createElement("p");
      empty.className = "muted";
      empty.textContent = "No pending password recovery requests.";
      root.append(empty);
    }
    for (const request of data.requests || []) {
      const row = document.createElement("article");
      row.className = "membership-card";
      const details = document.createElement("p");
      details.textContent = request.displayName + " · @" + request.handle + " · " + request.email + " · " + new Date(request.requestedAt).toLocaleString();
      const select = document.createElement("button");
      select.type = "button";
      select.className = "button quiet";
      select.textContent = "Select member for recovery";
      select.addEventListener("click", () => {
        const email = $('#passwordResetLinkForm input[name="email"]');
        email.value = request.email;
        email.focus();
        $("#passwordResetLinkForm").scrollIntoView({ block: "center", behavior: "smooth" });
      });
      row.append(details, select);
      root.append(row);
    }
  } catch (error) {
    setStatus(root, error.message, true);
  }
}

$("#forgotPasswordButton")?.addEventListener("click", () => {
  const email = $('#loginForm input[name="email"]')?.value || "";
  history.replaceState(history.state || {}, "", "/community#recover");
  showAccountAccessFromHash();
  const target = $('#passwordRecoveryForm input[name="email"]');
  if (target) { target.value = email; target.focus(); }
});
$("#recoveryBackToLogin")?.addEventListener("click", openAccountPanel);
$("#passwordRecoveryForm")?.addEventListener("submit", async event => {
  event.preventDefault();
  const form = event.currentTarget;
  const submit = form.querySelector('button[type="submit"]');
  if (submit) submit.disabled = true;
  setStatus($("#passwordRecoveryStatus"), "Submitting recovery request…");
  try {
    const result = await api("/api/community/auth/forgot-password", {
      method: "POST",
      body: JSON.stringify({ email: new FormData(form).get("email") })
    });
    setStatus($("#passwordRecoveryStatus"), result.message);
  } catch (error) {
    setStatus($("#passwordRecoveryStatus"), error.message, true);
  } finally {
    if (submit) submit.disabled = false;
  }
});

$("#passwordResetLinkForm")?.addEventListener("submit", async event => {
  event.preventDefault();
  const form = event.currentTarget;
  const resultNode = $("#passwordResetLinkResult");
  const data = new FormData(form);
  try {
    const result = await api("/api/community/admin/password-resets", {
      method: "POST",
      body: JSON.stringify({ email: data.get("email") })
    });
    resultNode.replaceChildren();
    const message = document.createElement("p");
    message.textContent = `Recovery link for ${result.member.displayName}. Expires ${new Date(result.expiresAt).toLocaleTimeString()}.`;
    const link = document.createElement("input");
    link.type = "text";
    link.readOnly = true;
    link.value = result.resetUrl;
    const copy = document.createElement("button");
    copy.type = "button";
    copy.className = "button quiet";
    copy.textContent = "Copy private link";
    copy.addEventListener("click", async () => {
      await navigator.clipboard.writeText(result.resetUrl);
      copy.textContent = "Copied";
    });
    resultNode.append(message, link, copy);
    await loadPasswordRecoveryRequests();
  } catch (error) {
    setStatus(resultNode, error.message, true);
  }
});

$("#passwordResetForm")?.addEventListener("submit", async event => {
  event.preventDefault();
  const form = event.currentTarget;
  const data = new FormData(form);
  const password = String(data.get("password") || "");
  const confirmation = String(data.get("confirmPassword") || "");
  if (password !== confirmation) {
    setStatus($("#passwordResetStatus"), "Passwords do not match.", true);
    return;
  }
  const token = new URLSearchParams(location.hash.slice(1)).get("password-reset") || "";
  try {
    await api("/api/community/auth/reset-password", {
      method: "POST",
      body: JSON.stringify({ token, password })
    });
    form.reset();
    state.me = { authenticated: false };
    renderMemberState();
    openAccountPanel();
    setStatus($("#loginStatus"), "Password reset complete. Sign in with your new password.");
  } catch (error) {
    setStatus($("#passwordResetStatus"), error.message, true);
  }
});

$("#newPostForm")?.addEventListener("submit", async event => {
  event.preventDefault();
  const form = event.currentTarget;
  const data = new FormData(form);
  try {
    const editing = Boolean(state.editingPostId);
    const path = editing
      ? `/api/community/posts/${encodeURIComponent(state.editingPostId)}`
      : "/api/community/posts";
    const payload = {
      type: data.get("type"),
      sport: data.get("sport"),
      title: data.get("title"),
      excerpt: data.get("excerpt"),
      body: data.get("body"),
      coverPhotoDataUrl: state.pendingCoverPhotoDataUrl,
      photos: state.pendingArticlePhotos.map(photo => ({
        dataUrl: photo.dataUrl,
        caption: String(photo.caption || "").trim().slice(0, 180)
      })),
      enduranceRelevanceConfirmed: data.get("enduranceRelevanceConfirmed") === "on",
      publish: data.get("publish") === "on"
    };
    const result = await api(path, editing
      ? { method: "PUT", body: JSON.stringify(payload) }
      : { method: "POST", body: JSON.stringify(payload) });
    resetArticleEditor();
    setStatus($("#newPostStatus"), `${editing ? "Updated" : "Saved"}. Status: ${result.post.status.replace(/_/g, " ")}.`);
    await loadMyPosts();
    await loadFeed();
  } catch (error) {
    setStatus($("#newPostStatus"), error.message, true);
  }
});

$("#newPostForm")?.elements.coverPhoto?.addEventListener("change", async event => {
  const file = event.currentTarget.files?.[0];
  try {
    state.pendingCoverPhotoDataUrl = file ? await prepareArticlePhoto(file) : "";
    renderArticleMediaStaging();
  } catch (error) {
    event.currentTarget.value = "";
    setStatus($("#newPostStatus"), error.message, true);
  }
});

$("#newPostForm")?.elements.articlePhotos?.addEventListener("change", async event => {
  const files = [...(event.currentTarget.files || [])];
  if (files.length > 3) {
    event.currentTarget.value = "";
    setStatus($("#newPostStatus"), "Choose no more than 3 inline article photos.", true);
    return;
  }
  try {
    const photos = [];
    for (const file of files) photos.push({ dataUrl: await prepareArticlePhoto(file), caption: "" });
    state.pendingArticlePhotos = photos;
    renderArticleMediaStaging();
  } catch (error) {
    event.currentTarget.value = "";
    setStatus($("#newPostStatus"), error.message, true);
  }
});

for (const button of $$("[data-article-format]")) {
  button.addEventListener("click", () => applyArticleFormat(button.dataset.articleFormat));
}

$("#articlePreviewButton")?.addEventListener("click", () => {
  const preview = $("#articlePreview");
  if (!preview) return;
  if (!preview.hidden) {
    preview.hidden = true;
    return;
  }
  renderArticlePreview();
});

$("#articleCancelEdit")?.addEventListener("click", () => resetArticleEditor());

$("#importBlogForm")?.addEventListener("submit", async event => {
  event.preventDefault();
  const form = event.currentTarget;
  const data = new FormData(form);
  try {
    const result = await api("/api/community/posts/import", {
      method: "POST",
      body: JSON.stringify({
        type: data.get("type"),
        title: data.get("title"),
        body: data.get("body"),
        originalPublishedAt: data.get("originalPublishedAt") || null,
        sourceUrl: data.get("sourceUrl") || "",
        ownershipConfirmed: data.get("ownershipConfirmed") === "on",
        cyclingRelevanceConfirmed: data.get("cyclingRelevanceConfirmed") === "on"
      })
    });
    form.reset();
    setStatus($("#importStatus"), `Imported as ${result.post.status}. Original date/source provenance has been preserved.`);
    await loadMyPosts();
  } catch (error) {
    setStatus($("#importStatus"), error.message, true);
  }
});

$("#editProfileButton")?.addEventListener("click", () => {
  setMemberPane("profile");
  $("#journalStudio")?.scrollIntoView({ behavior: "smooth", block: "start" });
});

$("#profileForm")?.elements?.profilePhoto?.addEventListener("change", async event => {
  const file = event.currentTarget.files?.[0];
  if (!file) return;
  try {
    state.pendingProfilePhotoDataUrl = await prepareProfilePhoto(file);
    updateProfilePreview(state.pendingProfilePhotoDataUrl, $("#profileForm")?.elements?.displayName?.value);
    setStatus($("#profileStatus"), "Photo ready. Save profile to publish the change.");
  } catch (error) {
    event.currentTarget.value = "";
    setStatus($("#profileStatus"), error.message, true);
  }
});

$("#profileForm")?.addEventListener("submit", async event => {
  event.preventDefault();
  const form = event.currentTarget;
  const data = new FormData(form);
  try {
    const result = await api("/api/community/me/profile", {
      method: "PATCH",
      body: JSON.stringify({
        displayName: data.get("displayName"),
        city: data.get("city"),
        state: data.get("state"),
        disciplines: String(data.get("disciplines") || "").split(",").map(value => value.trim()).filter(Boolean),
        bio: data.get("bio"),
        stravaUrl: data.get("stravaUrl"),
        instagramUrl: data.get("instagramUrl"),
        facebookUrl: data.get("facebookUrl"),
        profilePhotoDataUrl: state.pendingProfilePhotoDataUrl || ""
      })
    });
    state.me.user = result.user;
    populateProfileForm();
    setStatus($("#profileStatus"), "Profile updated.");
    $("#memberName").textContent = result.user.displayName;
    $("#myJournalLink").href = `/riders/${result.user.handle}`;
    setHeaderProfile(result.user);
    renderCommunityRailProfile();
  } catch (error) {
    setStatus($("#profileStatus"), error.message, true);
  }
});

$("#resourceLinkForm")?.addEventListener("submit", async event => {
  event.preventDefault();
  const form = event.currentTarget;
  const data = new FormData(form);
  try {
    await api("/api/community/me/links", {
      method: "POST",
      body: JSON.stringify({
        category: data.get("category"),
        title: data.get("title"),
        url: data.get("url"),
        description: data.get("description")
      })
    });
    form.reset();
    setStatus($("#resourceLinkStatus"), "Shared resource added.");
    await loadProfileResourceLinks();
  } catch (error) {
    setStatus($("#resourceLinkStatus"), error.message, true);
  }
});

$("#announcementForm")?.addEventListener("submit", async event => {
  event.preventDefault();
  const form = event.currentTarget;
  const data = new FormData(form);

  try {
    const result = await api("/api/community/admin/announcements", {
      method: "POST",
      body: JSON.stringify({
        announcementType: data.get("announcementType"),
        audience: data.get("audience"),
        title: data.get("title"),
        excerpt: data.get("excerpt"),
        body: data.get("body"),
        isPinned: data.get("isPinned") === "on",
        publish: data.get("publish") === "on",
        authorLabel: data.get("announcementType") === "founder_message" ? "Founder" : "VYNDI Admin"
      })
    });

    form.reset();
    if (form.elements.isPinned) form.elements.isPinned.checked = true;
    if (form.elements.publish) form.elements.publish.checked = true;
    setStatus($("#announcementStatus"), `${announcementTypeLabel(result.announcement.announcementType)} saved as ${result.announcement.status.replace(/_/g, " ")}.`);
    await loadAnnouncementQueue();
    await loadPinnedAnnouncements();
    await loadFeed();
  } catch (error) {
    setStatus($("#announcementStatus"), error.message, true);
  }
});

function setMobileSheet(name = null) {
  const searchSheet = $("#mobileSearchSheet");
  const moreSheet = $("#mobileMoreSheet");
  const createSheet = $("#mobileCreateSheet");
  const searchToggle = $("#mobileSearchToggle");
  const moreToggle = $("#mobileMoreToggle");
  const createToggle = $("#mobileCreateToggle");
  const openSearch = name === "search";
  const openMore = name === "more";
  const openCreate = name === "create";

  if (searchSheet) searchSheet.hidden = !openSearch;
  if (moreSheet) moreSheet.hidden = !openMore;
  if (createSheet) createSheet.hidden = !openCreate;
  if (searchToggle) searchToggle.setAttribute("aria-expanded", String(openSearch));
  if (moreToggle) moreToggle.setAttribute("aria-expanded", String(openMore));
  if (createToggle) createToggle.setAttribute("aria-expanded", String(openCreate));
  document.body.dataset.mobileSheet = name || "";

  if (openSearch) {
    const desktopSearch = $("#communitySearch");
    const mobileSearch = $("#mobileCommunitySearch");
    if (mobileSearch) {
      mobileSearch.value = desktopSearch?.value || "";
      requestAnimationFrame(() => mobileSearch.focus());
    }
  }
}

$("#mobileSearchToggle")?.addEventListener("click", () => setMobileSheet("search"));
$("#mobileSearchClose")?.addEventListener("click", () => setMobileSheet(null));
$("#mobileMoreToggle")?.addEventListener("click", () => setMobileSheet("more"));
$("#mobileMoreClose")?.addEventListener("click", () => setMobileSheet(null));
$("#mobileCreateToggle")?.addEventListener("click", () => setMobileSheet("create"));
$("#mobileCreateClose")?.addEventListener("click", () => setMobileSheet(null));

for (const sheet of $$(".mobile-sheet")) {
  sheet.addEventListener("click", event => {
    if (event.target === sheet) setMobileSheet(null);
  });
}

$("#mobileCommunitySearch")?.addEventListener("input", event => {
  const desktopSearch = $("#communitySearch");
  if (desktopSearch) desktopSearch.value = event.currentTarget.value;
  applyCommunitySearch();
});

document.addEventListener("keydown", event => {
  if (event.key === "Escape" && document.body.dataset.mobileSheet) setMobileSheet(null);
});

$("#communitySearch")?.addEventListener("input", applyCommunitySearch);
$("#refreshPeople")?.addEventListener("click", loadCommunityPeople);
$("#peopleFilter")?.addEventListener("change", renderCommunityPeople);
$("#peopleSearch")?.addEventListener("input", renderCommunityPeople);
$("#refreshMemberships")?.addEventListener("click", loadMembershipQueue);
$("#refreshAdminNominations")?.addEventListener("click", loadAdminNominations);
$("#refreshPostReviews")?.addEventListener("click", loadPostReviewQueue);
$("#refreshAnnouncements")?.addEventListener("click", loadAnnouncementQueue);
$("#loadFounderWelcome")?.addEventListener("click", loadFounderWelcomePreset);
$("#refreshModeration")?.addEventListener("click", loadModerationQueue);
$("#refreshPasswordRecovery")?.addEventListener("click", loadPasswordRecoveryRequests);
$("#startDiscussionButton")?.addEventListener("click", () => {
  if (!state.me?.authenticated || state.me.user?.status !== "active") {
    location.href = "#account";
    return;
  }
  const form = $("#newPostForm");
  const type = form?.querySelector('select[name="type"]');
  if (type) type.value = "discussion";
  $("#journalStudio")?.scrollIntoView({ behavior: "smooth", block: "start" });
  form?.querySelector('input[name="title"]')?.focus();
});

async function openCommunityAlerts() {
  if (!state.me?.authenticated) {
    location.href = "/community#account";
    return;
  }
  await navigateCommunityRoute("/dashboard");
  const announcements = $("#pinnedAnnouncements");
  if (announcements && !announcements.hidden) {
    announcements.scrollIntoView({ behavior: "smooth", block: "start" });
  }
}

$("#communityNotifications")?.addEventListener("click", openCommunityAlerts);
$("#mobileAlertsNav")?.addEventListener("click", openCommunityAlerts);

function openAccountPanel() {
  history.replaceState(history.state || {}, "", "/community#account");
  setCommunityViewMode("community");
  document.body.dataset.accountOpen = "true";
  for (const selector of ["#publicDestination", "#routeView", "#forumPrompt"]) {
    const section = $(selector);
    if (section) section.hidden = true;
  }
  const guest = $("#authGuest");
  const dashboard = $("#memberDashboard");
  const reset = $("#passwordResetPanel");
  if (guest) guest.hidden = false;
  if (dashboard) dashboard.hidden = true;
  if (reset) reset.hidden = true;
  setAuthPane("login");
  requestAnimationFrame(() => {
    $("#account")?.scrollIntoView({ block: "start", behavior: "smooth" });
    $("#loginForm input[name=\"email\"]")?.focus();
  });
}

function setAuthPane(name = "login") {
  for (const button of $$("[data-auth-tab]")) {
    const active = button.dataset.authTab === name;
    button.classList.toggle("active", active);
    button.setAttribute("aria-selected", String(active));
  }
  $("#loginForm").hidden = name !== "login";
  $("#joinForm").hidden = name !== "join";
  const recovery = $("#passwordRecoveryForm");
  if (recovery) recovery.hidden = name !== "recover";
}

function isAccountAccessHash() {
  return location.hash === "#account" || location.hash === "#recover"
    || Boolean(new URLSearchParams(location.hash.slice(1)).get("password-reset"));
}

function showAccountAccessFromHash() {
  const token = new URLSearchParams(location.hash.slice(1)).get("password-reset");
  if (!token && location.hash !== "#recover") return false;
  setCommunityViewMode("community");
  document.body.dataset.accountOpen = "true";
  for (const selector of ["#publicDestination", "#routeView", "#forumPrompt"]) {
    const section = $(selector);
    if (section) section.hidden = true;
  }
  $("#authGuest").hidden = Boolean(token);
  $("#memberDashboard").hidden = true;
  $("#passwordResetPanel").hidden = !token;
  setAuthPane(token ? "reset" : "recover");
  $("#account")?.scrollIntoView({ block: "start" });
  return true;
}

for (const button of $$("[data-auth-tab]")) {
  button.addEventListener("click", () => {
    history.replaceState(history.state || {}, "", "/community#account");
    setAuthPane(button.dataset.authTab);
  });
}

let accountEntryBound = false;
function bindAccountEntry() {
  if (accountEntryBound) return;
  accountEntryBound = true;
  document.addEventListener("click", event => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const link = event.target.closest("[data-account-entry], [data-member-gate]");
    if (!link) return;
    if (state.me?.authenticated) return;
    event.preventDefault();
    openAccountPanel();
  });
}
bindAccountEntry();

let communityNavigationBound = false;
function bindCommunityNavigation() {
  if (communityNavigationBound) return;
  communityNavigationBound = true;
  document.addEventListener("click", async event => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const link = event.target.closest("[data-community-route], [data-app-route]");
    if (!link) return;
    const url = new URL(link.href, location.origin);
    if (url.origin !== location.origin) return;
    const supported = url.pathname === "/community"
      || Boolean(PUBLIC_DESTINATIONS[url.pathname])
      || url.pathname === "/dashboard"
      || url.pathname === "/admin"
      || url.pathname === "/community/create";
    if (!supported) return;
    event.preventDefault();
    try {
      await navigateCommunityRoute(url.pathname);
      if (link.dataset.openMemberPane) setMemberPane(link.dataset.openMemberPane);
    } catch (error) {
      console.error("VYNDI navigation fallback", error);
      location.href = url.href;
    }
  });
}
bindCommunityNavigation();
  bindConnectedSources();

window.addEventListener("hashchange", () => {
  if (location.pathname !== "/community") return;
  document.body.dataset.accountOpen = isAccountAccessHash() ? "true" : "false";
  if (showAccountAccessFromHash()) return;
  if (location.hash === "#account" && !state.me?.authenticated) {
    openAccountPanel();
    return;
  }
  $("#passwordResetPanel").hidden = true;
  if (location.hash !== "#recover") setAuthPane("login");
  if (location.hash === "#account") {
    requestAnimationFrame(() => $("#account")?.scrollIntoView({ block: "start", behavior: "smooth" }));
  }
});

window.addEventListener("popstate", async event => {
  state.navigationIndex = Number(event.state?.vyndiNavIndex ?? 0);
  const path = location.pathname;
  const supported = path === "/community"
    || Boolean(PUBLIC_DESTINATIONS[path])
    || path === "/dashboard"
    || path === "/admin"
    || path === "/community/create";
  if (supported) await navigateCommunityRoute(path);
});

for (const button of $$("[data-member-tab]")) {
  button.addEventListener("click", () => setMemberPane(button.dataset.memberTab));
}

for (const button of $$("[data-admin-tab]")) {
  button.addEventListener("click", () => setAdminPane(button.dataset.adminTab));
}

for (const button of $$(".sport-filter")) {
  button.addEventListener("click", async () => {
    const wasActive = button.classList.contains("active");
    $$(".sport-filter").forEach(item => item.classList.remove("active"));
    const sport = wasActive ? "" : (button.dataset.sport || "");
    if (!wasActive) button.classList.add("active");
    await loadFeed(state.feedType || "", sport);
  });
}

for (const button of $$(".filter")) {
  button.addEventListener("click", async () => {
    $$(".filter").forEach(item => item.classList.remove("active"));
    button.classList.add("active");
    await loadFeed(button.dataset.type || "", state.feedSport || "");
  });
}

async function boot() {
  ensureNavigationState();
  // Recovery entry must not wait on background health/session/feed requests.
  if (location.pathname === "/community" && isAccountAccessHash()) {
    if (!showAccountAccessFromHash()) openAccountPanel();
  }
  await refreshSession();
  if (showAccountAccessFromHash()) return;
  await loadCommunityKpis();

  const parts = location.pathname.split("/").filter(Boolean);
  if (parts[0] === "passport" && parts[1]) {
    await renderPublicPassportRoute(parts[1]);
    return;
  }
  if (parts[0] === "riders" && parts[1]) {
    await renderRiderRoute(parts[1]);
    return;
  }
  if (parts[0] === "stories" && parts[1]) {
    await renderStoryRoute(parts[1]);
    return;
  }

  if (location.pathname === "/community/create") {
    if (!state.me?.authenticated) { history.replaceState({}, "", "/community#account"); openAccountPanel(); return; }
    setCommunityViewMode("destination");
    const createView = $("#communityCreateView"); if (createView) createView.hidden = false;
    $("#publicDestination")?.setAttribute("hidden", "");
    $(".community-social-shell")?.setAttribute("hidden", "");
    document.title = "Create Community · VYBES";
    return;
  }

  if (location.pathname === "/dashboard" || location.pathname === "/admin") {
    await renderDashboardRoute(location.pathname);
    return;
  }

  setCommunityViewMode(location.pathname === "/community" ? "community" : "destination");
  const renderedDestination = await renderPublicDestination();
  if (!renderedDestination) await loadFeed();
}

const VYNDI_THEME_KEY = "vyndi-theme";
function applyTheme(theme) {
  const allowed = ["midnight", "light", "contrast"];
  const next = allowed.includes(theme) ? theme : "midnight";
  if (document.body?.dataset) document.body.dataset.theme = next;
  try { localStorage.setItem(VYNDI_THEME_KEY, next); } catch {}
  document.querySelectorAll("[data-theme-choice]").forEach(button => button.setAttribute("aria-pressed", String(button.dataset.themeChoice === next)));
}
function initThemePreferences() {
  let saved = "midnight";
  try { saved = localStorage.getItem(VYNDI_THEME_KEY) || "midnight"; } catch {}
  applyTheme(saved);
  const toggle = document.querySelector("#themeToggle");
  const panel = document.querySelector("#themePanel");
  toggle?.addEventListener("click", () => { const open = panel?.hidden !== false; if (panel) panel.hidden = !open; toggle.setAttribute("aria-expanded", String(open)); });
  document.querySelectorAll("[data-theme-choice]").forEach(button => button.addEventListener("click", () => { applyTheme(button.dataset.themeChoice); if (panel) panel.hidden = true; toggle?.setAttribute("aria-expanded", "false"); }));
}
async function resolveCircleScope(scope) {
  state.circleScope = scope;
  state.feedCircleIds = [];
  if (scope === "global") return null;
  const user = state.me?.user;
  if (!user && scope !== "global") return null;
  let circles = [];
  if (scope === "mine") {
    const data = await api("/api/community/circles?mine=1");
    circles = data.circles || [];
  } else {
    const data = await api("/api/community/circles");
    circles = data.circles || [];
    const locationText = scope === "country" ? String(user?.country || user?.countryCode || "").toLowerCase()
      : String(scope === "region" ? (user?.state || user?.region || "") : (user?.city || user?.state || "")).toLowerCase();
    if (locationText) circles = circles.filter(circle => [circle.name, circle.countryCode].filter(Boolean).some(value => locationText.includes(String(value).toLowerCase()) || String(value).toLowerCase().includes(locationText)));
  }
  state.feedCircleIds = circles.map(circle => circle.id).filter(Boolean);
  return state.feedCircleIds;
}
function initCircleScopes() {
  document.querySelectorAll("[data-circle-scope]").forEach(button => button.addEventListener("click", async () => {
    document.querySelectorAll("[data-circle-scope]").forEach(item => item.classList.toggle("active", item === button));
    try { await resolveCircleScope(button.dataset.circleScope || "global"); await loadFeed(state.feedType || "", state.feedSport || ""); }
    catch (error) { state.feedCircleIds = []; const feed = document.querySelector("#communityFeed"); if (feed) feed.textContent = error.message; }
  }));
}
if (document.querySelector("#themeToggle") || document.querySelector("#themePanel")) { if (document.readyState === "loading" && typeof document.addEventListener === "function") document.addEventListener("DOMContentLoaded", () => { initThemePreferences(); initCircleScopes(); initAccountMenu(); }); else { initThemePreferences(); initCircleScopes(); initAccountMenu(); } }


function initAccountMenu() {
  const trigger = $("#accountHeaderLink"); const menu = $("#accountMenu"); if (!trigger || !menu) return;
  const close=()=>{menu.hidden=true;trigger.setAttribute("aria-expanded","false");};
  trigger.addEventListener("click",()=>{if(!state.me?.authenticated){openAccountPanel();return;} const open=menu.hidden; menu.hidden=!open; trigger.setAttribute("aria-expanded",String(open));});
  menu.querySelector('[data-account-action="profile"]')?.addEventListener("click",async()=>{close(); await navigateCommunityRoute("/dashboard"); setMemberPane("profile");});
  menu.querySelector('[data-account-action="appearance"]')?.addEventListener("click",()=>{close(); const panel=$("#themePanel"); if(panel) panel.hidden=false; $("#themeToggle")?.setAttribute("aria-expanded","true");});
  menu.querySelector('[data-account-action="logout"]')?.addEventListener("click",async()=>{close(); try{await api("/api/community/auth/logout",{method:"POST",body:"{}"});}catch{} state.me={authenticated:false}; location.href="/community";});
  document.addEventListener("click",event=>{if(!menu.hidden&&!menu.contains(event.target)&&!trigger.contains(event.target))close();});
}

function initCommunityCreation() {
  const form = $("#communityCreateForm");
  if (!form) return;
  form.addEventListener("submit", async event => {
    event.preventDefault();
    const status = $("#communityCreateStatus");
    if (!state.me?.user) { openAccountPanel(); return; }
    const data = new FormData(form);
    if (status) status.textContent = "Creating…";
    try {
      const result = await api("/api/community/circles", { method: "POST", body: JSON.stringify({
        name: data.get("name"), kind: data.get("kind"), circleClass: "rider_community",
        primarySport: data.get("primarySport"), visibility: data.get("visibility"),
        membershipPolicy: data.get("membershipPolicy"), description: data.get("description")
      }) });
      if (status) status.textContent = "Created " + (result.circle?.name || "community") + ". You are its owner.";
      form.reset(); await resolveCircleScope("mine"); await loadFeed();
    } catch (error) { if (status) status.textContent = error.message || "Community creation failed."; }
  });
}

initCommunityCreation();

boot();

function initPassportParallax(){const stage=document.querySelector("[data-passport-parallax]");if(!stage||window.matchMedia("(prefers-reduced-motion: reduce)").matches)return;const panel=stage.closest(".athlete-passport-panel");if(!panel)return;panel.addEventListener("pointermove",event=>{const rect=panel.getBoundingClientRect(),x=Math.max(-1,Math.min(1,((event.clientX-rect.left)/Math.max(rect.width,1)-.5)*2)),y=Math.max(-1,Math.min(1,((event.clientY-rect.top)/Math.max(rect.height,1)-.5)*2));stage.style.setProperty("--passport-rx",(-y*3.5).toFixed(2)+"deg");stage.style.setProperty("--passport-ry",(x*5).toFixed(2)+"deg");stage.style.setProperty("--passport-x",(x*10).toFixed(1)+"px");stage.style.setProperty("--passport-y",(y*8).toFixed(1)+"px")},{passive:true});panel.addEventListener("pointerleave",()=>["--passport-rx","--passport-ry","--passport-x","--passport-y"].forEach(name=>stage.style.removeProperty(name)))}window.addEventListener("DOMContentLoaded",initPassportParallax,{once:true});
