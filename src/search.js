// search.js - Artist search and detail view for Dial
// Depends on utils.js for: getAvatarColor, escapeHtml, generateInitials, createArtistCard
// Depends on collections-store.js for: loadCollections, getArtist, saveArtist

document.addEventListener('DOMContentLoaded', function() {
    const searchInput = document.getElementById('search-input');
    const searchButton = document.getElementById('search-button');
    const resultsContainer = document.getElementById('results');
    const searchView = document.getElementById('search-view');
    const navBack = document.getElementById('nav-back');
    const navSearch = document.getElementById('nav-search');

    // In-memory map of artists from the last search, keyed by MusicBrainz ID
    let artistsById = {};

    // Tracks the artist currently shown in the detail view
    let currentArtist = null;

    // Holds references to artist view elements; null until first card click
    let view = null;

    // ── MusicBrainz API ───────────────────────────────────────────────────────

    // Thin wrapper around fetch for MusicBrainz endpoints. Centralizes the
    // required User-Agent header and the response status check. Callers pass
    // a path that already includes its own query string (e.g. "artist?query=…").
    async function mbFetch(path) {
        const response = await fetch(`https://musicbrainz.org/ws/2/${path}&fmt=json`, {
            headers: { 'User-Agent': 'Dial-MusicApp/1.0 (student-project)' }
        });
        if (!response.ok) throw new Error(`MusicBrainz error: ${response.status}`);
        return response.json();
    }

    // ── View switching ────────────────────────────────────────────────────────

    function showSearchView() {
        searchView.hidden = false;
        view.section.hidden = true;
        navBack.hidden = true;
        navSearch.classList.add('active');
        navSearch.setAttribute('aria-current', 'page');
    }

    function showArtistView() {
        searchView.hidden = true;
        view.section.hidden = false;
        navBack.hidden = false;
        navSearch.classList.remove('active');
        navSearch.removeAttribute('aria-current');
    }

    navBack.addEventListener('click', function(e) {
        e.preventDefault();
        showSearchView();
    });

    // ── Search ────────────────────────────────────────────────────────────────

    // Builds and appends artist cards to the results container
    function renderArtists(artists) {
        resultsContainer.innerHTML = '';

        // Rebuild the lookup map for the new result set
        artistsById = {};

        if (artists.length === 0) {
            resultsContainer.innerHTML = '<p>No artists found. Try a different search term.</p>';
            return;
        }

        artists.forEach((artist, i) => {
            // Store in memory — only the ID needs to go on the DOM element
            artistsById[artist.id] = artist;

            const card = createArtistCard(artist, {
                trailing: '<div class="view-indicator" aria-hidden="true">View →</div>'
            });
            card.tabIndex = 0; // Makes the card focusable for keyboard navigation
            card.style.setProperty('--card-index', i); // Drives the staggered slide-up animation
            resultsContainer.appendChild(card);
        });
    }

    // Fetches artist search results from the MusicBrainz API
    async function searchArtists(query) {
        const data = await mbFetch(`artist?query=${encodeURIComponent(query)}`);
        return data.artists.map(artist => ({
            id: artist.id,
            name: artist.name,
            genres: artist.tags ? artist.tags.map(tag => tag.name) : [],
            avatarText: generateInitials(artist.name),
            avatarColor: getAvatarColor(artist.name)
        }));
    }

    searchButton.addEventListener('click', async function() {
        const query = searchInput.value.trim();
        if (!query) {
            // Inline message instead of a disruptive browser alert
            resultsContainer.innerHTML = '<p>Please enter an artist name to search.</p>';
            return;
        }

        searchButton.disabled = true;
        searchButton.textContent = '...';
        resultsContainer.innerHTML = '<p>Searching...</p>';

        try {
            const artists = await searchArtists(query);
            renderArtists(artists);
        } catch (error) {
            console.error('Search error:', error);
            resultsContainer.innerHTML = '<p>Sorry, there was an error searching. Please try again.</p>';
        } finally {
            searchButton.disabled = false;
            searchButton.textContent = '→';
        }
    });

    // Allow Enter key to trigger search
    searchInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') searchButton.click();
    });

    // ── Artist view ───────────────────────────────────────────────────────────

    // Use event delegation on the results container to handle card clicks
    resultsContainer.addEventListener('click', function(e) {
        const card = e.target.closest('.artist-card');
        if (!card) return;

        // Capture the card's position now — before the view switches — so the
        // artist view animation can expand from the card's center
        openArtistView(artistsById[card.dataset.artistId], card.getBoundingClientRect());
    });

    // Also open the artist view when a card is activated via keyboard
    resultsContainer.addEventListener('keypress', function(e) {
        if (e.key !== 'Enter' && e.key !== ' ') return;

        const card = e.target.closest('.artist-card');
        if (!card) return;

        e.preventDefault();
        openArtistView(artistsById[card.dataset.artistId], card.getBoundingClientRect());
    });

    // Builds the artist view section once, appends it to <main>, and stores
    // direct references to its inner elements in the `view` object
    function buildArtistView() {
        const section = document.createElement('section');
        section.className = 'artist-view';
        section.hidden = true;

        section.innerHTML = `
            <div class="artist-header">
                <div class="avatar artist-avatar" aria-hidden="true"></div>
                <div class="artist-header-info">
                    <h2 class="artist-name"></h2>
                    <div class="genre-tags"></div>
                </div>
            </div>
            <div class="artist-body">
                <section class="collection-panel" aria-label="Add to Collection">
                    <h3>Add to Collection</h3>
                    <div class="collection-checkboxes" role="group" aria-label="Collections"></div>
                    <textarea placeholder="Add a note..." aria-label="Collection note"></textarea>
                    <button type="button">Save to Collection</button>
                    <p class="collection-saved-msg" hidden>Saved!</p>
                </section>
                <section class="discography-panel" aria-label="Discography">
                    <h3>Discography</h3>
                    <ul class="discography-list"></ul>
                </section>
            </div>
        `;

        document.querySelector('main').appendChild(section);

        // Store direct references so openArtistView never needs to query the DOM
        view = {
            section,
            avatar:      section.querySelector('.artist-avatar'),
            name:        section.querySelector('.artist-name'),
            genres:      section.querySelector('.genre-tags'),
            checkboxes:  section.querySelector('.collection-checkboxes'),
            note:        section.querySelector('.collection-panel textarea'),
            saveBtn:     section.querySelector('.collection-panel button'),
            savedMsg:    section.querySelector('.collection-saved-msg'),
            discography: section.querySelector('.discography-list')
        };

        // Wire up the save button once here rather than on every open
        view.saveBtn.addEventListener('click', function() {
            if (!currentArtist) return;
            const collectionIds = [...view.checkboxes.querySelectorAll('input:checked')]
                .map(cb => cb.value);
            saveArtist(currentArtist, collectionIds, view.note.value.trim());
            view.savedMsg.hidden = false;
            setTimeout(() => { view.savedMsg.hidden = true; }, 2000);
        });
    }

    // Populates and displays the artist detail view.
    // cardRect — the clicked card's getBoundingClientRect(), used to set the
    // animation's transform-origin so the view expands from the card's center.
    function openArtistView(artist, cardRect = null) {
        // Build the view the first time a card is clicked, then reuse it
        if (!view) buildArtistView();

        currentArtist = artist;

        view.avatar.textContent = artist.avatarText;
        view.avatar.style.backgroundColor = artist.avatarColor;
        view.name.textContent = artist.name;
        view.genres.innerHTML = artist.genres.slice(0, 5).map(g =>
            `<span class="genre-tag">${escapeHtml(g)}</span>`
        ).join('');

        // Rebuild checkboxes from current collections so user-created collections
        // appear automatically; restore checked state from any saved entry
        const collections = Object.values(loadCollections());
        const saved = getArtist(artist.id);
        const checkedIds = saved ? saved.collectionIds : [];

        view.checkboxes.innerHTML = collections.length > 0
            ? collections.map(col => `
                <label class="collection-checkbox-label">
                    <input type="checkbox" value="${col.id}"${checkedIds.includes(col.id) ? ' checked' : ''}>
                    ${escapeHtml(col.name)}
                </label>
            `).join('')
            : '<p class="collection-empty-msg">No collections yet. Create one on the <a href="collections.html">My Collections</a> page.</p>';

        view.note.value = saved ? saved.note : '';
        view.savedMsg.hidden = true;

        view.discography.innerHTML = '<li>Loading...</li>';

        // Suppress the CSS animation so the section is visible but static while
        // we measure its position to compute the correct transform-origin
        view.section.style.animation = 'none';

        if (cardRect) {
            const sectionRect = view.section.getBoundingClientRect();
            const x = cardRect.left + cardRect.width  / 2 - sectionRect.left;
            const y = cardRect.top  + cardRect.height / 2 - sectionRect.top;
            view.section.style.transformOrigin = `${x}px ${y}px`;
        }
        showArtistView();

        // Force a reflow so the browser commits the origin, then re-enable the
        // CSS animation — it starts fresh from the newly set transform-origin
        view.section.offsetHeight;
        view.section.style.animation = '';

        fetchDiscography(artist.id);
    }

    // Fetches and renders works associated with an artist from MusicBrainz.
    // Works represent unique compositions and have no duplicate editions,
    // unlike releases. Note: MusicBrainz links works via writer/composer
    // relationships, so artists who only perform covers may return no results.
    async function fetchDiscography(artistId) {
        try {
            const data = await mbFetch(`release-group?artist=${artistId}&limit=100`);

            if (!data["release-groups"] || data["release-groups"].length === 0) {
                view.discography.innerHTML = '<li>No releases found.</li>';
                return;
            }

            view.discography.innerHTML = '';
            data["release-groups"].forEach(releaseGroup => {
                const li = document.createElement('li');
                li.className = 'discography-item';
                li.innerHTML = `
                    <div class="release-title">${escapeHtml(releaseGroup.title)}</div>
                    ${releaseGroup["primary-type"] ? `<div class="release-meta">${escapeHtml(releaseGroup["primary-type"])}</div>` : ''}
                `;
                view.discography.appendChild(li);
            });
        } catch (err) {
            console.error('Discography error:', err);
            view.discography.innerHTML = '<li>Could not load discography.</li>';
        }
    }
});
