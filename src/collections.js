// collections.js - Collections page state and localStorage persistence

const COLLECTIONS_KEY = 'dial_collection';
const COLLECTION_NAMES = ['Want to Explore', 'Listening', 'Listened'];

let activeCollection = 'all';
let collections = [];

function loadCollections() {
    try {
        const raw = localStorage.getItem(COLLECTIONS_KEY);
        if (!raw) {
            return [];
        }

        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed.map(normalizeArtist).filter(Boolean) : [];
    } catch (error) {
        console.error('Error loading collections:', error);
        return [];
    }
}

function saveCollections(nextCollections) {
    try {
        localStorage.setItem(COLLECTIONS_KEY, JSON.stringify(nextCollections));
    } catch (error) {
        console.error('Error saving collections:', error);
        if (error.name === 'QuotaExceededError') {
            alert('Storage quota exceeded. Please delete some artists to make room.');
        }
    }
}

// Normalize saved data so the rest of the page can rely on one artist shape.
function normalizeArtist(artist) {
    if (!artist || typeof artist !== 'object' || !artist.id || !artist.name) {
        return null;
    }

    const collectionName = COLLECTION_NAMES.includes(artist.collection)
        ? artist.collection
        : 'Want to Explore';

    return {
        id: String(artist.id),
        name: String(artist.name),
        genres: Array.isArray(artist.genres)
            ? artist.genres.filter(Boolean).map(String)
            : [],
        collection: collectionName,
        note: typeof artist.note === 'string' ? artist.note : ''
    };
}

function deleteArtist(artistId) {
    collections = collections.filter(artist => artist.id !== artistId);
    saveCollections(collections);
    renderCollections();
}

function updateArtist(artistId, updates) {
    collections = collections.map(artist => {
        if (artist.id !== artistId) {
            return artist;
        }

        return normalizeArtist({ ...artist, ...updates });
    }).filter(Boolean);

    saveCollections(collections);
    renderCollections();
}

function getFilteredArtists() {
    if (activeCollection === 'all') {
        return collections;
    }

    return collections.filter(artist => artist.collection === activeCollection);
}

function renderCollections() {
    const resultsContainer = document.getElementById('results');
    const artists = getFilteredArtists();

    if (artists.length === 0) {
        const emptyMessage = collections.length === 0
            ? 'No artists saved yet. Search and add some from the <a href="index.html">Search</a> view!'
            : 'No artists are in this collection yet.';

        resultsContainer.innerHTML = `<p class="empty-state">${emptyMessage}</p>`;
        return;
    }

    resultsContainer.innerHTML = artists.map(createArtistCardHTML).join('');
}

function createArtistCardHTML(artist) {
    const avatarColor = getAvatarColor(artist.name);
    const initials = artist.name
        .split(' ')
        .map(word => word[0])
        .filter(Boolean)
        .join('')
        .toUpperCase()
        .slice(0, 2);

    const genres = artist.genres.length > 0
        ? artist.genres.join(' · ')
        : 'No genres';

    return `
        <article class="artist-card" data-artist-id="${escapeHtml(artist.id)}">
            <div class="avatar" style="background-color: ${avatarColor};" aria-hidden="true">${escapeHtml(initials)}</div>
            <div class="info">
                <h3>${escapeHtml(artist.name)}</h3>
                <p>${escapeHtml(genres)}</p>
                <p>Collection: <span class="tag">${escapeHtml(artist.collection)}</span></p>
                ${artist.note ? `<p>Note: ${escapeHtml(artist.note)}</p>` : ''}
            </div>
            <button class="edit-btn" type="button" data-artist-id="${escapeHtml(artist.id)}">Edit</button>
            <button class="delete-btn" type="button" data-artist-id="${escapeHtml(artist.id)}">Delete</button>
        </article>
    `;
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Keep avatar colors deterministic so each artist keeps the same look across sessions.
function getAvatarColor(name) {
    const colors = [
        '#FFB3D9', '#FFB3BA', '#FFCBA4', '#FFE5B4', '#FFFFBA',
        '#BAFFC9', '#BAE1FF', '#D4BAFF', '#FFB3FF', '#FFD9B3',
        '#B3E5FF', '#B3FFB3', '#FFB3D9', '#E1B3FF', '#FFE0B3'
    ];

    let hash = 0;
    for (let i = 0; i < name.length; i += 1) {
        hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }

    return colors[Math.abs(hash) % colors.length];
}

function updateActiveFilterButton(nextActiveButton) {
    const filterButtons = document.querySelectorAll('.filter-buttons .tag');
    filterButtons.forEach(button => {
        button.classList.toggle('active', button === nextActiveButton);
    });
}

// Prompts keep the edit flow simple while the page structure is still evolving.
function promptForCollection(currentCollection) {
    const choices = COLLECTION_NAMES.join(', ');
    const nextCollection = window.prompt(
        `Enter a collection name: ${choices}`,
        currentCollection
    );

    if (nextCollection === null) {
        return null;
    }

    const normalizedChoice = nextCollection.trim();
    if (!COLLECTION_NAMES.includes(normalizedChoice)) {
        alert('Please choose one of the existing collections.');
        return null;
    }

    return normalizedChoice;
}

function promptForNote(currentNote) {
    const nextNote = window.prompt('Edit note (leave blank for no note):', currentNote);
    if (nextNote === null) {
        return null;
    }

    return nextNote.trim();
}

function handleFilterClick(event) {
    const button = event.target.closest('.filter-buttons .tag');
    if (!button) {
        return;
    }

    activeCollection = button.dataset.collection || 'all';
    updateActiveFilterButton(button);
    renderCollections();
}

function handleResultsClick(event) {
    const deleteButton = event.target.closest('.delete-btn');
    if (deleteButton) {
        const shouldDelete = window.confirm('Remove this artist from your collections?');
        if (!shouldDelete) {
            return;
        }

        deleteArtist(deleteButton.dataset.artistId);
        return;
    }

    const editButton = event.target.closest('.edit-btn');
    if (!editButton) {
        return;
    }

    const artistId = editButton.dataset.artistId;
    const artist = collections.find(entry => entry.id === artistId);
    if (!artist) {
        return;
    }

    const nextCollection = promptForCollection(artist.collection);
    if (nextCollection === null) {
        return;
    }

    const nextNote = promptForNote(artist.note);
    if (nextNote === null) {
        return;
    }

    updateArtist(artistId, {
        collection: nextCollection,
        note: nextNote
    });
}

document.addEventListener('DOMContentLoaded', function() {
    const filtersContainer = document.querySelector('.filter-buttons');
    const resultsContainer = document.getElementById('results');

    // Load once from localStorage, then keep the page state in memory until it changes.
    collections = loadCollections();

    filtersContainer.addEventListener('click', handleFilterClick);
    resultsContainer.addEventListener('click', handleResultsClick);

    renderCollections();
});
