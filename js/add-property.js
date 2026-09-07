/* add-property.js */

const state = {
  amenities: new Set(),
  mediaFiles: [], 
  mapCenter: { lat: 6.5244, lng: 3.3792 }, 
};

document.addEventListener('DOMContentLoaded', () => {
  if (!guardLandlordAccess()) return;

  initMap();
  initAmenities();
  initMediaUpload();
  initAutoGenerate();
  initTopbarButtons();
  initFormSubmission();
  initToast();
});

/* ============================================================
   ROLE GUARD
   ============================================================ */

function guardLandlordAccess() {
  const token = localStorage.getItem(CONFIG.TOKEN_KEY);

  if (!token) {
    // No session at all — send to login, not just the seeker dashboard.
    window.location.href = 'login.html';
    return false;
  }

  const role = getUserRole(token);

  if (role !== 'LANDLORD') {
    // Consistent with landlord-dashboard.html: wrong role gets bounced
    // back to their own dashboard rather than shown the form.
    window.location.href = 'seeker-dashboard.html';
    return false;
  }

  return true;
}

function getUserRole(token) {
  // 1) Try a cached user object first (cheaper, no decoding needed).
  try {
    const cachedUser = JSON.parse(localStorage.getItem(CONFIG.USER_KEY) || 'null');
    if (cachedUser && cachedUser.role) return String(cachedUser.role).toUpperCase();
  } catch (_) { /* not JSON, fall through */ }

  // 2) Fall back to decoding the role claim out of the JWT payload.
  try {
    const payloadSegment = token.split('.')[1];
    const decoded = JSON.parse(atob(payloadSegment.replace(/-/g, '+').replace(/_/g, '/')));
    if (decoded.role) return String(decoded.role).toUpperCase();
  } catch (_) { /* not a valid/decodable JWT */ }

  return null;
}

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

    input.value = ''; 
    renderMediaGrid();
  });
}

function renderMediaGrid() {
  const grid = document.getElementById('mediaGrid');
  const addTile = document.getElementById('mediaAddTile');
  const countEl = document.getElementById('mediaCount');

  
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

/* AUTO-GENERATE DESCRIPTION */

function initAutoGenerate() {
  const btn = document.getElementById('autogenBtn');

  btn.addEventListener('click', async () => {
    const statusEl = document.getElementById('formStatus');
       const descriptionEl = document.getElementById('description');
    const originalLabel = btn.textContent;

    const payload = buildAiPayload();

    if (payload.userInput.length < 3) {
      setStatus(statusEl, 'Fill in a few property details first (title, type, etc.) before generating.', 'error');
      return;
    }
    if (payload.userInput.length > 2000) {
      payload.userInput = payload.userInput.slice(0, 2000);
    }

    btn.disabled = true;
    btn.textContent = 'Generating…';
    setStatus(statusEl, 'Generating description with AI…', '');

    try {
      const data = await generateAiDescription(payload);

      const generated =
        data?.generatedDescription ??
        data?.data?.generatedDescription ??
        data?.text ??
        data?.result;

      if (!data?.success || !generated) {
        throw new Error('AI response did not include a description.');
      }

      descriptionEl.value = generated;
      setStatus(statusEl, 'Description generated.', 'success');
    } catch (err) {
      console.error('AI description generation failed:', err);
      setStatus(statusEl, `Couldn't generate a description: ${err.message}`, 'error');
    } finally {
      btn.disabled = false;
      btn.textContent = originalLabel;
    }
  });
}

function buildAiPayload() {
  const title = document.getElementById('listingTitle').value.trim();
  const propertyType = document.getElementById('propertyType').selectedOptions[0]?.text || '';
  const bedrooms = document.getElementById('bedrooms').value;
  const bathrooms = document.getElementById('bathrooms').value;
  const squareFootage = document.getElementById('squareFootage').value.trim();
  const address = document.getElementById('addressLocation').value.trim();
  const rentPrice = document.getElementById('rentPrice').value;
  const amenityLabels = Array.from(state.amenities).map(formatAmenityLabel);

  const parts = [];

  if (title) parts.push(`Listing title: ${title}.`);
  if (propertyType) parts.push(`Property type: ${propertyType}.`);
  if (bedrooms || bathrooms) {
    parts.push(`${bedrooms || '—'} bedroom(s), ${bathrooms || '—'} bathroom(s).`);
  }
  if (squareFootage) parts.push(`Size: ${squareFootage}.`);
  if (address) parts.push(`Location: ${address}.`);
  if (rentPrice) parts.push(`Rent price: ${rentPrice}.`);
  if (amenityLabels.length > 0) parts.push(`Amenities: ${amenityLabels.join(', ')}.`);

  const userInput = parts.join(' ').trim();

  return { userInput };
}

function formatAmenityLabel(value) {
  return value.replace(/_/g, ' ');
}

async function generateAiDescription(payload) {
  // NOTE: matches the '/properties' convention used elsewhere in this
  // file — CONFIG.BASE_URL / CONFIG.MOCK_BASE_PATH already include the
  // '/api/v1' prefix, so it must NOT be repeated here. Adding it caused
  // a 404 (the request hit /api/v1/api/v1/ai/generate-description).
  return postJson('/ai/generate-description', payload);
}
function formatAmenityLabel(value) {
  return value.replace(/_/g, ' ');
}

async function generateAiDescription(payload) {
  // NOTE: matches the '/properties' convention used elsewhere in this
  // file — CONFIG.BASE_URL / CONFIG.MOCK_BASE_PATH already include the
  // '/api/v1' prefix, so it must NOT be repeated here. Adding it caused
  // a 404 (the request hit /api/v1/api/v1/ai/generate-description).
  return postJson('/ai/generate-description', payload);
}

/* ============================================================
   TOPBAR BUTTONS
   ============================================================ */

function initTopbarButtons() {
  document.getElementById('backToDashboardBtn').addEventListener('click', () => {
    window.location.href = 'landlord-dashboard.html';
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
  const endpoint = isDraft ? '/properties/drafts' : '/properties';

  try {
    await postMultipart(endpoint, formData);

    if (isDraft) {
      setStatus(statusEl, 'Draft saved.', 'success');
    } else {
      showToast();
      setTimeout(() => {
        // FIXED REDIRECT ROUTE: Corrects the Vercel deployment 404 error by hitting your actual route name
        window.location.href = 'landlord-dashboard.html';
      }, 1500);
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

/* JSON POST helper — for endpoints (like the AI Listing Assistant)
   that expect an application/json body rather than multipart form
   data. Mirrors postMultipart's auth/base-URL handling exactly so
   both go through the same CONFIG.USE_MOCK_DATA switch. */
async function postJson(endpoint, body) {
  const token = localStorage.getItem(CONFIG.TOKEN_KEY);
  const url = CONFIG.USE_MOCK_DATA
    ? `${CONFIG.MOCK_BASE_PATH}${endpoint}`
    : `${CONFIG.BASE_URL}${endpoint}`;

  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    let message = `Request failed with status ${response.status}`;
    try {
      const errorBody = await response.json();
      // Log the raw body so validation details (which don't always
      // live under `.message` — e.g. NestJS's ValidationPipe puts an
      // array there, but some APIs use `.errors` or `.error`) are
      // visible in the console without opening the Network tab.
      console.error('postJson error body:', errorBody);
      message = formatErrorMessage(errorBody) || message;
    } catch (_) { /* not JSON */ }
    throw new Error(message);
  }

  return response.json();
}

function formatErrorMessage(body) {
  if (!body) return null;
  if (typeof body.message === 'string') return body.message;
  if (Array.isArray(body.message)) return body.message.join('; ');
  if (typeof body.error === 'string') return body.error;
  if (Array.isArray(body.errors)) return body.errors.join('; ');
  return null;
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