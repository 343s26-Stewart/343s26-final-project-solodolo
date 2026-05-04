// collections-store.js - Shared localStorage layer for Dial
// Loaded after utils.js, before search.js / collections.js.
//
// Schema stored under COLLECTIONS_KEY:
// {
//   collections: { "<id>": { id, name }, ... },
//   artists:     { "<mbid>": { id, name, genres, avatarText, note, collectionIds: [] }, ... }
// }

// Default collections seeded on first run
const DEFAULT_COLLECTIONS = [
    { id: 'want-to-explore', name: 'Want to Explore' },
    { id: 'listening',       name: 'Listening' },
    { id: 'listened',        name: 'Listened' }
];

// ── Internal read / write ─────────────────────────────────────────────────────

// Returns a valid data object from localStorage, seeding defaults if empty or
// the stored value doesn't match the expected shape
function loadData() {
    try {
        const raw = localStorage.getItem(COLLECTIONS_KEY);
        if (raw) {
            const parsed = JSON.parse(raw);
            if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)
                    && parsed.collections && parsed.artists) {
                return parsed;
            }
        }
    } catch (err) {
        console.error('Error loading data:', err);
    }
    return seedDefaults();
}

// Builds the initial data object with the default collections
function seedDefaults() {
    const data = { collections: {}, artists: {} };
    DEFAULT_COLLECTIONS.forEach(c => {
        data.collections[c.id] = { id: c.id, name: c.name };
    });
    persistData(data);
    return data;
}

function persistData(data) {
    try {
        localStorage.setItem(COLLECTIONS_KEY, JSON.stringify(data));
    } catch (err) {
        console.error('Error saving data:', err);
    }
}

// ── Collections ───────────────────────────────────────────────────────────────

// Returns all collections as a plain object keyed by ID
function loadCollections() {
    return loadData().collections;
}

// Creates a new collection with a generated ID; returns the new entry
function createCollection(name) {
    const data = loadData();
    const id = `col-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    data.collections[id] = { id, name };
    persistData(data);
    return data.collections[id];
}

// Renames an existing collection
function updateCollectionName(collectionId, name) {
    const data = loadData();
    if (!data.collections[collectionId]) return;
    data.collections[collectionId].name = name;
    persistData(data);
}

// Deletes a collection and removes it from every artist's collectionIds
function deleteCollection(collectionId) {
    const data = loadData();
    delete data.collections[collectionId];
    Object.values(data.artists).forEach(artist => {
        artist.collectionIds = (artist.collectionIds || []).filter(id => id !== collectionId);
    });
    persistData(data);
}

// ── Artists ───────────────────────────────────────────────────────────────────

// Returns all saved artists as a plain object keyed by MusicBrainz ID
function loadArtists() {
    return loadData().artists;
}

// Returns the saved entry for one artist, or null if not saved
function getArtist(artistId) {
    return loadData().artists[artistId] || null;
}

// Creates or replaces the entry for an artist
function saveArtist(artist, collectionIds, note) {
    const data = loadData();
    data.artists[artist.id] = {
        id: artist.id,
        name: artist.name,
        genres: artist.genres,
        avatarText: artist.avatarText,
        collectionIds,
        note
    };
    persistData(data);
}

// Removes an artist entry
function removeArtist(artistId) {
    const data = loadData();
    delete data.artists[artistId];
    persistData(data);
}

// Merges partial changes into an existing artist entry
function updateArtist(artistId, changes) {
    const data = loadData();
    if (!data.artists[artistId]) return;
    data.artists[artistId] = { ...data.artists[artistId], ...changes };
    persistData(data);
}

// ── Export / Import ───────────────────────────────────────────────────────────

// Triggers a JSON file download of the full data object (required by spec)
function exportData() {
    const json = JSON.stringify(loadData(), null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'dial-collections.json';
    a.click();
    URL.revokeObjectURL(url);
}

// Reads a JSON file and merges its collections and artists into the current
// data. Returns a Promise resolving to { collections, artists } import counts.
function importData(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsText(file);
        reader.onload = function() {
            try {
                const imported = JSON.parse(reader.result);
                if (!imported || typeof imported !== 'object' || Array.isArray(imported)
                        || !imported.collections || !imported.artists) {
                    throw new Error('Invalid format');
                }
                persistData({
                    collections: {...imported.collections },
                    artists:     {...imported.artists }
                });
                resolve({
                    collections: Object.keys(imported.collections).length,
                    artists:     Object.keys(imported.artists).length
                });
            } catch (err) {
                reject(err);
            }
        };
        reader.onerror = () => reject(reader.error);
    });
}
