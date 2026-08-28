/* ============================================================
   add-property.js

   - Live map: real Leaflet map + OpenStreetMap tiles (no API key
     needed). The red pin stays fixed in the center of the screen;
     the MAP moves underneath it (the standard "drop a pin" pattern
     used by most ride-share/delivery apps) and the address field
     is filled in automatically via reverse-geocoding through the
     free Nominatim API whenever the map stops moving.
   - Functional multi-image upload with real previews, a 10-image
     cap, and per-image removal.
   - Every button wired to something real: amenity toggles, the
     description auto-generator (a simple client-side template —
     NOT a real AI call, see note below), Save as Draft / Submit
     for Review against the API, and Back/Add New navigation.

   ASSUMPTION (unconfirmed against Swagger docs): POST /properties
   for submitting a listing, and POST /properties/drafts for
   drafts. GET /properties is confirmed working elsewhere in this
   project; these POST paths follow normal REST convention from
   that but haven't been verified directly.
   ============================================================ */

const state = {
  amenities: new Set(),
  mediaFiles: [], // { file, previewUrl }
  mapCenter: { lat: 6.5244, lng: 3.3792 }, // Lagos, Nigeria — sensible default
};

document.addEventListener('DOMContentLoaded', () => {
  initMap();
  initAmenities();
  initMediaUpload();
  initAutoGenerate();
  initTopbarButtons();
  initFormSubmission();
  initToast();
});

/* ============================================================
   LIVE MAP
   ============================================================ */

let map;
let geocodeDebounceTimer = null;

function initMap() {
  map = L.map('propertyMap', {
    center: [state.mapCenter.lat, state.mapCenter.lng],
    zoom: 15,
    zoomControl: true,
  });

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    maxZoom: 19,
  }).addTo(map);

  // The pin itself is a fixed CSS overlay (see the HTML/CSS) sitting
  // dead-center of the map container — we never move it. Instead we
  // read the map's center coordinates whenever the user finishes
  // panning, which is what a "drop pin" UI actually needs.
  map.on('moveend', () => {
    const center = map.getCenter();
    state.mapCenter = { lat: center.lat, lng: center.lng };
    reverseGeocode(center.lat, center.lng);
  });

  // Forward geocoding: typing an address and pressing Enter pans
  // the map there instead.
  const addressInput = document.getElementById('addressLocation');
  addressInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      forwardGeocode(addressInput.value.trim());
    }
  });
}

async function reverseGeocode(lat, lng) {
  // Debounced so we don't hammer the free Nominatim API on every
  // tiny map movement — only fires 600ms after panning stops.
  clearTimeout(geocodeDebounceTimer);
  geocodeDebounceTimer = setTimeout(async () => {
    try {
      const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`;
      const res = await fetch(url, { headers: { 'Accept-Language': 'en' } });
      if (!res.ok) return;
      const data = await res.json();
      if (data.display_name) {
        document.getElementById('addressLocation').value = data.display_name;
      }
    } catch (err) {
      // Silent failure is fine here — reverse geocoding is a nicety,
      // not a required field. The user can still type an address manually.
      console.error('Reverse geocoding failed:', err);
    }
  }, 600);
}

async function forwardGeocode(query) {
  if (!query) return;
  try {
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1`;
    const res = await fetch(url, { headers: { 'Accept-Language': 'en' } });
    if (!res.ok) return;
    const results = await res.json();
    if (results.length > 0) {
      const { lat, lon } = results[0];
      map.setView([parseFloat(lat), parseFloat(lon)], 16);
      // moveend fires automatically after setView, which re-fills
      // the address field with the precise reverse-geocoded result
    }
  } catch (err) {
    console.error('Forward geocoding failed:', err);
  }
}

/* ============================================================
   AMENITIES (multi-select toggle chips)
   ============================================================ */

function initAmenities() {
  document.querySelectorAll('.amenity-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      const value = chip.dataset.value;
      const isSelected = chip.classList.toggle('is-selected');
      if (isSelected) {
        state.amenities.add(value);
      } else {
        state.amenities.delete(value);
      }
    });
  });
}

/* ============================================================
   MEDIA UPLOAD
   ============================================================ */

const MAX_PHOTOS = 10;

function initMediaUpload() {
  const addTile = document.getElementById('mediaAddTile');
  const input = document.getElementById('mediaInput');

  addTile.addEventListener('click', () => input.click());

  input.addEventListener('change', () => {
    const statusEl = document.getElementById('mediaStatus');
    const files = Array.from(input.files);

    for (const file of files) {
      if (state.mediaFiles.length >= MAX_PHOTOS) {
        setStatus(statusEl, `You can upload up to ${MAX_PHOTOS} photos.`, 'error');
        break;
      }
      if (!['image/jpeg', 'image/png'].includes(file.type)) {
        setStatus(statusEl, 'Only JPG or PNG images are supported.', 'error');
        continue;
      }
      state.mediaFiles.push({ file, previewUrl: URL.createObjectURL(file) });
    }

    input.value = ''; // allows re-selecting the same file again later
    renderMediaGrid();
  });
}

function renderMediaGrid() {
  const grid = document.getElementById('mediaGrid');
  const addTile = document.getElementById('mediaAddTile');
  const countEl = document.getElementById('mediaCount');

  // Clear everything except the "+" add tile, then re-insert photo
  // tiles before it
  grid.querySelectorAll('.media-photo-tile').forEach(el => el.remove());

  state.mediaFiles.forEach((item, index) => {
    const tile = document.createElement('div');
    tile.className = 'media-photo-tile';
    tile.innerHTML = `
      <img src="${item.previewUrl}" alt="Property photo ${index + 1}">
      <button type="button" class="media-remove-btn" data-index="${index}" aria-label="Remove photo">
        <svg viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
        </svg>
      </button>
    `;
    grid.insertBefore(tile, addTile);
  });

  grid.querySelectorAll('.media-remove-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const index = Number(btn.dataset.index);
      URL.revokeObjectURL(state.mediaFiles[index].previewUrl);
      state.mediaFiles.splice(index, 1);
      renderMediaGrid();
    });
  });

  countEl.textContent = `${state.mediaFiles.length}/${MAX_PHOTOS} uploaded`;
  addTile.disabled = state.mediaFiles.length >= MAX_PHOTOS;
}

/* ============================================================
   AUTO-GENERATE DESCRIPTION
   This is a simple client-side template built from the form's own
   fields — NOT a real AI service call. There's no confirmed AI
   endpoint for this project, so faking one would be misleading.
   This still gives a genuinely useful starting draft the person
   can edit, which is what the button visually promises.
   ============================================================ */

function initAutoGenerate() {
  document.getElementById('autogenBtn').addEventListener('click', () => {
    const title = document.getElementById('listingTitle').value.trim();
    const type = document.getElementById('propertyType').selectedOptions[0]?.text || 'property';
    const bedrooms = document.getElementById('bedrooms').value;
    const bathrooms = document.getElementById('bathrooms').value;
    const sqft = document.getElementById('squareFootage').value.trim();
    const address = document.getElementById('addressLocation').value.trim();
    const amenityLabels = Array.from(state.amenities).map(formatAmenityLabel);

    const parts = [];
    parts.push(`${title || 'This ' + type.toLowerCase()} is a ${type.toLowerCase()} located ${address ? 'at ' + address : 'in a well-connected neighborhood'}.`);

    if (bedrooms || bathrooms) {
      parts.push(`It features ${bedrooms || '—'} bedroom${bedrooms === '1' ? '' : 's'} and ${bathrooms || '—'} bathroom${bathrooms === '1' ? '' : 's'}${sqft ? `, spread across ${sqft}` : ''}.`);
    }

    if (amenityLabels.length > 0) {
      parts.push(`Residents enjoy access to ${amenityLabels.join(', ')}.`);
    }

    parts.push('Book a viewing today to see it in person.');

    document.getElementById('description').value = parts.join(' ');
  });
}

function formatAmenityLabel(value) {
  return value.replace(/_/g, ' ');
}

/* ============================================================
   TOPBAR BUTTONS
   ============================================================ */

function initTopbarButtons() {
  document.getElementById('backToDashboardBtn').addEventListener('click', () => {
    window.location.href = 'dashboard-landlord.html';
  });

  document.getElementById('newPropertyBtn').addEventListener('click', () => {
    const hasUnsavedWork = document.getElementById('listingTitle').value.trim() !== ''
      || state.mediaFiles.length > 0;

    if (hasUnsavedWork && !confirm('Start a new listing? Anything unsaved on this one will be lost.')) {
      return;
    }
    window.location.reload();
  });
}

/* ============================================================
   FORM SUBMISSION (Save as Draft / Submit for Review)
   ============================================================ */

function initFormSubmission() {
  document.getElementById('saveDraftBtn').addEventListener('click', () => submitListing(true));

  document.getElementById('propertyForm').addEventListener('submit', (e) => {
    e.preventDefault();
    submitListing(false);
  });
}

function buildFormPayload() {
  const formData = new FormData();
  formData.append('title', document.getElementById('listingTitle').value.trim());
  formData.append('address', document.getElementById('addressLocation').value.trim());
  formData.append('latitude', state.mapCenter.lat);
  formData.append('longitude', state.mapCenter.lng);
  formData.append('propertyType', document.getElementById('propertyType').value);
  formData.append('rentPrice', document.getElementById('rentPrice').value);
  formData.append('bedrooms', document.getElementById('bedrooms').value);
  formData.append('bathrooms', document.getElementById('bathrooms').value);
  formData.append('floorNumber', document.getElementById('floorNumber').value);
  formData.append('squareFootage', document.getElementById('squareFootage').value.trim());
  formData.append('description', document.getElementById('description').value.trim());

  state.amenities.forEach(a => formData.append('amenities[]', a));
  state.mediaFiles.forEach(item => formData.append('photos', item.file));

  return formData;
}

async function submitListing(isDraft) {
  const statusEl = document.getElementById('formStatus');
  const saveDraftBtn = document.getElementById('saveDraftBtn');
  const submitBtn = document.getElementById('submitReviewBtn');

  if (!isDraft) {
    const title = document.getElementById('listingTitle').value.trim();
    const address = document.getElementById('addressLocation').value.trim();
    const rentPrice = document.getElementById('rentPrice').value;

    if (!title || !address || !rentPrice) {
      setStatus(statusEl, 'Listing title, address, and rent price are required to submit for review.', 'error');
      return;
    }
  }

  saveDraftBtn.disabled = true;
  submitBtn.disabled = true;
  setStatus(statusEl, isDraft ? 'Saving draft…' : 'Submitting…', '');

  const formData = buildFormPayload();
  // ASSUMPTION — not yet confirmed: POST /properties/drafts vs POST /properties
  const endpoint = isDraft ? '/properties/drafts' : '/properties';

  try {
    await postMultipart(endpoint, formData);

    if (isDraft) {
      setStatus(statusEl, 'Draft saved.', 'success');
    } else {
      showToast();
      document.getElementById('propertyForm').reset();
      state.amenities.clear();
      document.querySelectorAll('.amenity-chip.is-selected').forEach(c => c.classList.remove('is-selected'));
      state.mediaFiles.forEach(item => URL.revokeObjectURL(item.previewUrl));
      state.mediaFiles = [];
      renderMediaGrid();
    }
  } catch (err) {
    setStatus(statusEl, err.message, 'error');
  } finally {
    saveDraftBtn.disabled = false;
    submitBtn.disabled = false;
  }
}

/* Multipart POST helper — bypasses api.js's post()/put(), which
   always JSON.stringify the body. Same pattern used for the photo
   upload in settings.js. CONFIG and localStorage are both readable
   here directly since every script on this page is a classic,
   non-module script sharing one global scope. */
async function postMultipart(endpoint, formData) {
  const token = localStorage.getItem(CONFIG.TOKEN_KEY);
  const url = CONFIG.USE_MOCK_DATA
    ? `${CONFIG.MOCK_BASE_PATH}${endpoint}`
    : `${CONFIG.BASE_URL}${endpoint}`;

  const headers = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const response = await fetch(url, { method: 'POST', headers, body: formData });

  if (!response.ok) {
    let message = `Request failed with status ${response.status}`;
    try {
      const body = await response.json();
      message = body.message || message;
    } catch (_) { /* not JSON */ }
    throw new Error(message);
  }

  return response.json();
}

/* ============================================================
   TOAST
   ============================================================ */

function initToast() {
  document.getElementById('toastCloseBtn').addEventListener('click', hideToast);
}

function showToast() {
  const toast = document.getElementById('successToast');
  toast.hidden = false;
  clearTimeout(showToast._timer);
  showToast._timer = setTimeout(hideToast, 8000);
}

function hideToast() {
  document.getElementById('successToast').hidden = true;
}

/* ============================================================
   SHARED HELPER
   ============================================================ */

function setStatus(el, message, tone) {
  if (!el) return;
  el.textContent = message;
  el.classList.remove('is-error', 'is-success');
  if (tone === 'error') el.classList.add('is-error');
  if (tone === 'success') el.classList.add('is-success');
}