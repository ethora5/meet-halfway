// Meet Halfway: find a fair meeting spot between two areas in Kuwait.
// APIs used:
//   CARTO      -> the map background (needs a free API key, see config.example.js)
//   Esri       -> backup map if CARTO has no key or stops working (no key needed)
//   Nominatim  -> turns an area name into coordinates (geocoding)
//   Overpass   -> finds cafes/restaurants from OpenStreetMap data
//   Leaflet    -> shows the map
// Area lists come from areas.js (KUWAIT_AREAS). The key lives in config.js (not on GitHub).

const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";
// Several public Overpass servers: if one is busy, we try the next one
const OVERPASS_SERVERS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://overpass.private.coffee/api/interpreter",
];
const KUWAIT_CENTER = [29.25, 47.85];
const COLORS = { a: "#1ba39a", b: "#d9406f", mid: "#e6a92a" };
const TYPE_EMOJI = { cafe: "☕", restaurant: "🍽️", fast_food: "🍔", ice_cream: "🍦" };
const TYPE_WORD = { cafe: "coffee spots", restaurant: "restaurants", fast_food: "quick bites", ice_cream: "dessert places" };
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// ---------- Map setup ----------
const map = L.map("map", { zoomControl: false, attributionControl: false }).setView(KUWAIT_CENTER, 10);
L.control.zoom({ position: "bottomright" }).addTo(map);

// ---------- Base map: CARTO first, Esri as a backup ----------
const ESRI = "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas";
let usingBackup = false;

function useBackupMap() {
  if (usingBackup) return;
  usingBackup = true;
  console.warn("CARTO map not available, switching to the Esri backup map.");
  L.tileLayer(`${ESRI}/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}`, { maxZoom: 16 }).addTo(map);
  L.tileLayer(`${ESRI}/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}`, { maxZoom: 16 }).addTo(map);
}

// CARTO_KEY comes from config.js. If the file is missing, it is undefined.
const cartoKey = typeof CARTO_KEY !== "undefined" ? CARTO_KEY : "";

if (cartoKey && cartoKey !== "PUT_YOUR_KEY_HERE") {
  const carto = L.tileLayer(`https://basemaps.cartocdn.com/rastertiles/dark_all/{z}/{x}/{y}.png?key=${cartoKey}`, {
    maxZoom: 19,
    attribution: "© OpenStreetMap contributors © CARTO",
  }).addTo(map);

  // If several tiles fail (wrong key, limit reached, service down), switch to the backup
  let failedTiles = 0;
  carto.on("tileerror", () => {
    failedTiles++;
    if (failedTiles >= 3) {
      map.removeLayer(carto);
      useBackupMap();
    }
  });
} else {
  useBackupMap();
}

// On desktop the panel covers the left of the map, so keep things out from under it
function mapPadding() {
  return window.innerWidth > 760 ? { paddingTopLeft: [460, 60], paddingBottomRight: [60, 60] } : { padding: [30, 30] };
}

const drawLayer = L.layerGroup().addTo(map);

const homeIcon = (color) =>
  L.divIcon({ className: "", html: `<div class="mk-home" style="color:${color}"></div>`, iconSize: [22, 22], iconAnchor: [11, 11] });

const midIcon = L.divIcon({
  className: "",
  html: `<div class="mk-mid"><span class="ring"></span><span class="core"></span></div>`,
  iconSize: [26, 26],
  iconAnchor: [13, 13],
});

const placeIcon = (emoji, top) =>
  L.divIcon({ className: "", html: `<div class="mk-place${top ? " top" : ""}">${emoji}</div>`, iconSize: [30, 30], iconAnchor: [15, 15] });

const labelIcon = (text) =>
  L.divIcon({ className: "", html: `<span class="mk-label">${escapeHtml(text)}</span>`, iconSize: [0, 0] });

// ---------- Dropdowns: governorate -> area ----------
function fillGovernorates(select) {
  KUWAIT_AREAS.forEach((gov, i) => select.add(new Option(`${gov.ar} (${gov.en})`, i)));
}

function fillAreas(person) {
  const govSelect = document.getElementById(`gov-${person}`);
  const areaSelect = document.getElementById(`area-${person}`);
  areaSelect.innerHTML = "";
  areaSelect.add(new Option("Area", ""));

  if (govSelect.value === "") {
    areaSelect.disabled = true;
    return;
  }
  KUWAIT_AREAS[govSelect.value].areas.forEach((area, i) => areaSelect.add(new Option(`${area.ar} (${area.en})`, i)));
  areaSelect.disabled = false;
}

document.querySelectorAll(".gov").forEach((select) => {
  fillGovernorates(select);
  select.addEventListener("change", () => fillAreas(select.dataset.person));
});

function getChoice(person) {
  const g = document.getElementById(`gov-${person}`).value;
  const a = document.getElementById(`area-${person}`).value;
  if (g === "" || a === "") return null;
  const gov = KUWAIT_AREAS[g];
  return { gov, area: gov.areas[a] };
}

// Swap the two people
const swapBtn = document.getElementById("swap-btn");
swapBtn.addEventListener("click", () => {
  const govA = document.getElementById("gov-a"), govB = document.getElementById("gov-b");
  const areaA = document.getElementById("area-a"), areaB = document.getElementById("area-b");
  const saved = { g: govA.value, a: areaA.value };
  govA.value = govB.value; fillAreas("a"); areaA.value = areaB.value;
  govB.value = saved.g; fillAreas("b"); areaB.value = saved.a;
  swapBtn.classList.toggle("spin");
});

const radiusInput = document.getElementById("radius");
radiusInput.addEventListener("input", () => {
  document.getElementById("radius-value").textContent = `${radiusInput.value / 1000} km`;
});

// ---------- Helpers ----------
const statusEl = document.getElementById("status");
function setStatus(text, isError = false) {
  statusEl.textContent = text;
  statusEl.className = isError ? "error" : "";
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Distance between two points on Earth in km (Haversine formula)
function distanceKm([lat1, lon1], [lat2, lon2]) {
  const R = 6371;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

// Averaging is accurate enough for short distances (inside a country)
const midpoint = ([lat1, lon1], [lat2, lon2]) => [(lat1 + lat2) / 2, (lon1 + lon2) / 2];

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}

// Draws a line from `from` to `to` little by little, like a car driving
function animateLine(from, to, color, duration = 1100) {
  const line = L.polyline([from, from], { color, weight: 4, opacity: 0.9, lineCap: "round" }).addTo(drawLayer);
  if (reduceMotion) {
    line.setLatLngs([from, to]);
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    const start = performance.now();
    function step(now) {
      const t = Math.min((now - start) / duration, 1);
      const ease = 1 - Math.pow(1 - t, 3);
      line.setLatLngs([from, [from[0] + (to[0] - from[0]) * ease, from[1] + (to[1] - from[1]) * ease]]);
      t < 1 ? requestAnimationFrame(step) : resolve();
    }
    requestAnimationFrame(step);
  });
}

// ---------- API calls ----------
const geoCache = {};

async function nominatimSearch(q) {
  const params = new URLSearchParams({ q, format: "jsonv2", limit: "1", countrycodes: "kw" });
  const res = await fetch(`${NOMINATIM_URL}?${params}`);
  if (!res.ok) throw new Error(`The map search isn't answering right now (error ${res.status}). Try again in a minute.`);
  const data = await res.json();
  return data.length ? [parseFloat(data[0].lat), parseFloat(data[0].lon)] : null;
}

// Area -> [lat, lon]. Tries "Area, Governorate, Kuwait", then "Area, Kuwait".
async function geocodeArea({ gov, area }) {
  const key = `${area.en}|${gov.en}`;
  if (geoCache[key]) return geoCache[key];

  let coords = await nominatimSearch(`${area.en}, ${gov.en}, Kuwait`);
  if (!coords) {
    await sleep(1100); // Nominatim usage policy: max 1 request per second
    coords = await nominatimSearch(`${area.en}, Kuwait`);
  }
  if (!coords) throw new Error(`${area.en} wasn't found on the map. Pick a nearby area instead.`);

  geoCache[key] = coords;
  return coords;
}

async function findPlaces([lat, lon], type, radius) {
  const query = `
    [out:json][timeout:25];
    (
      node["amenity"="${type}"](around:${radius},${lat},${lon});
      way["amenity"="${type}"](around:${radius},${lat},${lon});
    );
    out center 40;
  `;
  // Overpass servers are often busy (errors 429, 502, 504).
  // Try the main server first, then other public servers, until one answers.
  let data = null;
  let lastError = "";
  for (const url of OVERPASS_SERVERS) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 20000); // give each server 20 seconds
      const res = await fetch(url, {
        method: "POST",
        body: "data=" + encodeURIComponent(query),
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        signal: controller.signal,
      });
      clearTimeout(timer);
      if (!res.ok) {
        lastError = `error ${res.status}`;
        console.warn(`${url} answered ${res.status}, trying the next server...`);
        continue;
      }
      data = await res.json();
      break;
    } catch (err) {
      lastError = err.name === "AbortError" ? "too slow" : "no connection";
      console.warn(`${url} failed (${lastError}), trying the next server...`);
    }
  }
  if (!data) throw new Error(`All the places servers are busy right now (${lastError}). Try again in a minute.`);

  return data.elements
    .map((el) => ({
      name: el.tags?.name || el.tags?.["name:en"] || el.tags?.["name:ar"],
      coords: el.type === "node" ? [el.lat, el.lon] : [el.center.lat, el.center.lon],
    }))
    .filter((p) => p.name);
}

// ---------- Main flow ----------
const form = document.getElementById("search-form");
const btn = document.getElementById("go-btn");
const btnText = btn.querySelector(".go-text");
const resultsEl = document.getElementById("results");
const listEl = document.getElementById("results-list");
const summaryEl = document.getElementById("summary");

form.addEventListener("submit", async (e) => {
  e.preventDefault();

  const choiceA = getChoice("a");
  const choiceB = getChoice("b");
  if (!choiceA || !choiceB) {
    setStatus("Choose a governorate and an area for both of you first.", true);
    return;
  }
  if (choiceA.area === choiceB.area) {
    setStatus("You both picked the same area, so you're already halfway there 😄 Pick two different areas.", true);
    return;
  }

  const type = document.querySelector('input[name="type"]:checked').value;
  const radius = Number(radiusInput.value);

  btn.disabled = true;
  btn.classList.add("loading");
  btnText.textContent = "Finding your spot...";
  drawLayer.clearLayers();
  resultsEl.hidden = true;
  listEl.innerHTML = "";

  try {
    // 1) Find both areas on the map
    setStatus(`Locating ${choiceA.area.en}...`);
    const a = await geocodeArea(choiceA);
    await sleep(1100);
    setStatus(`Locating ${choiceB.area.en}...`);
    const b = await geocodeArea(choiceB);
    const mid = midpoint(a, b);

    // 2) Show both homes, fly there, then draw both trips meeting in the middle
    L.marker(a, { icon: homeIcon(COLORS.a) }).addTo(drawLayer);
    L.marker(b, { icon: homeIcon(COLORS.b) }).addTo(drawLayer);
    L.marker(a, { icon: labelIcon(choiceA.area.ar), interactive: false }).addTo(drawLayer);
    L.marker(b, { icon: labelIcon(choiceB.area.ar), interactive: false }).addTo(drawLayer);

    map.flyToBounds(L.latLngBounds([a, b]).pad(0.15), { ...mapPadding(), duration: reduceMotion ? 0 : 1.2 });
    if (!reduceMotion) await sleep(1200);

    setStatus("Meeting in the middle...");
    await Promise.all([animateLine(a, mid, COLORS.a), animateLine(b, mid, COLORS.b)]);
    L.circle(mid, { radius, color: COLORS.mid, weight: 1.5, dashArray: "4 6", fillColor: COLORS.mid, fillOpacity: 0.08 }).addTo(drawLayer);
    L.marker(mid, { icon: midIcon, zIndexOffset: 1000 }).addTo(drawLayer);

    // 3) Find places around the middle
    setStatus(`Looking for ${TYPE_WORD[type]} near the middle...`);
    const places = await findPlaces(mid, type, radius);
    const halfKm = distanceKm(a, b) / 2;

    resultsEl.hidden = false;
    if (places.length === 0) {
      summaryEl.innerHTML = `
        <p class="big">No ${TYPE_WORD[type]} close to the middle.</p>
        <p>Drag the distance slider up, or try another type of place.</p>`;
      setStatus("");
      return;
    }

    // 4) Rank by fairness: smallest difference between the two trips
    places.forEach((p) => {
      p.fromA = distanceKm(a, p.coords);
      p.fromB = distanceKm(b, p.coords);
      p.gap = Math.abs(p.fromA - p.fromB);
    });
    places.sort((x, y) => x.gap - y.gap);

    summaryEl.innerHTML = `
      <p class="big">${halfKm.toFixed(1)} km each.</p>
      <p>That's how far each of you drives to the middle. Here are ${places.length} ${TYPE_WORD[type]}, fairest first.</p>`;

    places.forEach((p, i) => {
      const top = i < 3;
      const marker = L.marker(p.coords, { icon: placeIcon(TYPE_EMOJI[type], top) })
        .bindPopup(`<b>${escapeHtml(p.name)}</b><br>You ${p.fromA.toFixed(1)} km, friend ${p.fromB.toFixed(1)} km`)
        .addTo(drawLayer);

      const shareA = (p.fromA / (p.fromA + p.fromB)) * 100;
      const directions = `https://www.google.com/maps/dir/?api=1&destination=${p.coords[0]},${p.coords[1]}`;

      const li = document.createElement("li");
      li.className = `place${top ? " top" : ""}`;
      li.innerHTML = `
        <button type="button" class="place-name">${escapeHtml(p.name)}</button>
        <div class="balance" aria-hidden="true"><span class="ba" style="width:${shareA}%"></span><span class="bb"></span></div>
        <div class="place-meta">
          <span><span class="ka">You ${p.fromA.toFixed(1)} km</span> &nbsp; <span class="kb">Friend ${p.fromB.toFixed(1)} km</span></span>
          <a href="${directions}" target="_blank" rel="noopener">Directions</a>
        </div>`;
      li.querySelector(".place-name").addEventListener("click", () => {
        map.flyTo(p.coords, 16, { duration: reduceMotion ? 0 : 0.8 });
        marker.openPopup();
        if (window.innerWidth <= 760) document.getElementById("map").scrollIntoView({ behavior: "smooth" });
      });
      listEl.appendChild(li);
    });

    setStatus("");
    resultsEl.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
  } catch (err) {
    console.error(err);
    setStatus(err.message || "Something went wrong. Try again.", true);
  } finally {
    btn.disabled = false;
    btn.classList.remove("loading");
    btnText.textContent = "Find our spot";
  }
});
