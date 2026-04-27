// search.js - Artist search and detail view for Dial

const COLLECTIONS_KEY = 'dial_collections';

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

        artists.forEach(artist => {
            // Store in memory — only the ID needs to go on the DOM element
            artistsById[artist.id] = artist;

            const card = document.createElement('article');
            card.className = 'artist-card';
            card.tabIndex = 0; // Makes the card focusable for keyboard navigation
            card.dataset.artistId = artist.id;

            const genreText = artist.genres.length > 0
                ? artist.genres.map(g => escapeHtml(g)).slice(0, 3).join(' · ')
                : 'No genres available';

            card.innerHTML = `
                <div class="avatar" aria-hidden="true">${escapeHtml(artist.avatarText)}</div>
                <div class="info">
                    <h3>${escapeHtml(artist.name)}</h3>
                    <p>${genreText}</p>
                </div>
                <div class="view-indicator" aria-hidden="true">View →</div>
            `;

            // Set avatar color via JS to keep dynamic values out of markup
            card.querySelector('.avatar').style.backgroundColor = artist.avatarColor;

            resultsContainer.appendChild(card);
        });
    }

    // Fetches artist search results from the MusicBrainz API
    async function searchArtists(query) {
        const url = `https://musicbrainz.org/ws/2/artist?query=${encodeURIComponent(query)}&fmt=json`;
        const response = await fetch(url, {
            headers: { 'User-Agent': 'Dial-MusicApp/1.0 (student-project)' }
        });
        if (!response.ok) throw new Error(`API request failed: ${response.status}`);
        const data = await response.json();

        return data.artists.map(artist => ({
            id: artist.id,
            name: artist.name,
            // MusicBrainz returns genres as "tags" with a name property
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
        openArtistView(artistsById[card.dataset.artistId]);
    });

    // Also open the artist view when a card is activated via keyboard
    resultsContainer.addEventListener('keypress', function(e) {
        if (e.key !== 'Enter' && e.key !== ' ') return;
        const card = e.target.closest('.artist-card');
        if (!card) return;
        e.preventDefault();
        openArtistView(artistsById[card.dataset.artistId]);
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
                    <select aria-label="Collection status">
                        <option value="Want to Explore">Want to Explore</option>
                        <option value="Listening">Listening</option>
                        <option value="Listened">Listened</option>
                    </select>
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
            select:      section.querySelector('.collection-panel select'),
            note:        section.querySelector('.collection-panel textarea'),
            saveBtn:     section.querySelector('.collection-panel button'),
            savedMsg:    section.querySelector('.collection-saved-msg'),
            discography: section.querySelector('.discography-list')
        };

        // Wire up the save button once here rather than on every open
        view.saveBtn.addEventListener('click', function() {
            if (!currentArtist) return;
            saveCollection(currentArtist, view.select.value, view.note.value.trim());
            view.savedMsg.hidden = false;
            setTimeout(() => { view.savedMsg.hidden = true; }, 2000);
        });
    }

    // Populates and displays the artist detail view
    function openArtistView(artist) {
        // Build the view the first time a card is clicked, then reuse it
        if (!view) buildArtistView();

        currentArtist = artist;

        view.avatar.textContent = artist.avatarText;
        view.avatar.style.backgroundColor = artist.avatarColor;
        view.name.textContent = artist.name;
        view.genres.innerHTML = artist.genres.slice(0, 5).map(g =>
            `<span class="genre-tag">${escapeHtml(g)}</span>`
        ).join('');

        // Restore any previously saved collection entry for this artist
        const saved = getCollection(artist.id);
        view.select.value = saved ? saved.collection : 'Want to Explore';
        view.note.value = saved ? saved.note : '';
        view.savedMsg.hidden = true;

        view.discography.innerHTML = '<li>Loading...</li>';

        showArtistView();
        fetchDiscography(artist.id, view.discography);
    }

    // Fetches and renders works associated with an artist from MusicBrainz.
    // Works represent unique compositions and have no duplicate editions,
    // unlike releases. Note: MusicBrainz links works via writer/composer
    // relationships, so artists who only perform covers may return no results.
    async function fetchDiscography(artistId, listEl) {
        try {
            const url = `https://musicbrainz.org/ws/2/work?artist=${artistId}&fmt=json&limit=100`;
            const response = await fetch(url, {
                headers: { 'User-Agent': 'Dial-MusicApp/1.0 (student-project)' }
            });
            if (!response.ok) throw new Error(`API error: ${response.status}`);
            const data = await response.json();

            if (!data.works || data.works.length === 0) {
                listEl.innerHTML = '<li>No works found.</li>';
                return;
            }

            listEl.innerHTML = '';
            data.works.forEach(work => {
                const li = document.createElement('li');
                li.className = 'discography-item';
                li.innerHTML = `
                    <div class="release-title">${escapeHtml(work.title)}</div>
                    ${work.type ? `<div class="release-meta">${escapeHtml(work.type)}</div>` : ''}
                `;
                listEl.appendChild(li);
            });
        } catch (err) {
            console.error('Discography error:', err);
            listEl.innerHTML = '<li>Could not load discography.</li>';
        }
    }

    // ── Collections (localStorage) ────────────────────────────────────────────

    // Returns the saved collection entry for an artist, or null if not saved
    function getCollection(artistId) {
        const data = JSON.parse(localStorage.getItem(COLLECTIONS_KEY) || '{}');
        return data[artistId] || null;
    }

    // Persists a collection entry keyed by artist ID
    function saveCollection(artist, collection, note) {
        const data = JSON.parse(localStorage.getItem(COLLECTIONS_KEY) || '{}');
        data[artist.id] = {
            id: artist.id,
            name: artist.name,
            genres: artist.genres,
            avatarText: artist.avatarText,
            collection,
            note
        };
        localStorage.setItem(COLLECTIONS_KEY, JSON.stringify(data));
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    // Generates a consistent color for an artist name using a simple hash.
    // The same name always produces the same color across sessions.
    function getAvatarColor(name) {
        const colors = [
            '#8f6de9', '#ff7fb3', '#6dc8ff', '#ffd05b', '#4fd18b',
            '#ff8b4d', '#5f8dff', '#d65dff', '#00c2b8', '#ff5c8a',
            '#7ac5ff', '#ffc46d', '#7bef8e', '#d96dff'
        ];
        let hash = 0;
        for (let i = 0; i < name.length; i++) {
            hash = name.charCodeAt(i) + ((hash << 5) - hash);
        }
        return colors[Math.abs(hash) % colors.length];
    }

    // Safely encodes a string for insertion into innerHTML to prevent XSS.
    // Uses the browser's own text node encoding rather than a manual char map.
    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // Returns up to two uppercase initials from an artist name
    function generateInitials(name) {
        return name.split(' ')
            .map(word => word.charAt(0).toUpperCase())
            .slice(0, 2)
            .join('');
    }
});
