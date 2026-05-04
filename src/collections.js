// collections.js - My Collections page for Dial
// Depends on utils.js for: escapeHtml, createArtistCard
// Depends on collections-store.js for: loadCollections, loadArtists, removeArtist,
//   updateArtist, createCollection, updateCollectionName, deleteCollection,
//   exportData, importData

let activeFilter = 'all';
let managerOpen = false;

// ── Collection manager ────────────────────────────────────────────────────────

// Renders the list of all collections with rename/delete actions and the
// form to create a new one
function renderCollectionManager() {
    const manager = document.getElementById('collections-manager');
    const collections = Object.values(loadCollections());

    // Create string for collection items to edit by mapping to html and joining
    const listItems = collections.map(col => `
        <li class="collection-list-item" data-collection-id="${col.id}">
            <span class="collection-list-name">${escapeHtml(col.name)}</span>
            <div class="card-actions">
                <button class="icon-btn rename-collection-btn" type="button"
                    aria-label="Rename ${escapeHtml(col.name)}">Edit</button>
                <button class="icon-btn delete-collection-btn delete" type="button"
                    aria-label="Delete ${escapeHtml(col.name)}">Delete</button>
            </div>
        </li>
    `).join('');

    // Create the list of collections
    manager.innerHTML = `
        <ul class="collection-list">${listItems}</ul>
        <form class="new-collection-form" id="new-collection-form">
            <input type="text" id="new-collection-input"
                placeholder="New collection name..." aria-label="New collection name" required>
            <button type="submit">+ Add</button>
        </form>
    `;

    // Handle edit/delete button clicks
    manager.querySelector('.collection-list').addEventListener('click', handleCollectionManagerClick);

    // Handle new collection creation
    manager.querySelector('#new-collection-form').addEventListener('submit', function(e) {
        e.preventDefault();
        const input = this.querySelector('#new-collection-input');
        const name = input.value.trim();
        if (!name) return;
        createCollection(name);
        input.value = '';
        renderCollectionManager();
        renderFilterButtons();
    });
}

// Handles rename and delete clicks on the collection manager list
function handleCollectionManagerClick(e) {
    const item = e.target.closest('.collection-list-item');
    if (!item) return;

    const collectionId = item.dataset.collectionId;

    if (e.target.closest('.delete-collection-btn')) {
        deleteCollection(collectionId);
        // Reset filter if the active one was just deleted
        if (activeFilter === collectionId) activeFilter = 'all';
        renderCollectionManager();
        renderFilterButtons();
        renderCollections();
        return;
    }

    if (e.target.closest('.rename-collection-btn')) {
        openCollectionRename(item, loadCollections()[collectionId]);
        return;
    }
}

// Replaces the collection name span with an inline text input
function openCollectionRename(item, collection) {
    const nameSpan = item.querySelector('.collection-list-name');

    // Change the name to an input and select it
    nameSpan.innerHTML = `
        <input type="text" class="collection-rename-input"
            value="${escapeHtml(collection.name)}" aria-label="Collection name">
    `;
    const input = nameSpan.querySelector('input');
    input.focus();
    input.select();

    // Flag set on Escape so the blur handler (which fires when the DOM is
    // replaced) knows not to commit the change
    let cancelled = false;

    // Update collection name
    function save() {
        if (cancelled) return;

        const newName = input.value.trim();

        if (newName && newName !== collection.name) {
            updateCollectionName(collection.id, newName);
            renderFilterButtons();
            renderCollections();
        }
        renderCollectionManager();
    }

    // blur handles both a normal click-away and an Enter keypress (via input.blur())
    // Escape allows user to revert their changes
    input.addEventListener('blur', save);
    input.addEventListener('keydown', function(e) {
        if (e.key === 'Enter') { e.preventDefault(); input.blur(); }
        if (e.key === 'Escape') {
            cancelled = true;
            renderCollectionManager();
        }
    });
}

// ── Filter buttons ────────────────────────────────────────────────────────────

// Rebuilds the filter buttons from the current collections. Appends an Edit
// toggle button that shows/hides the collection manager below the row.
function renderFilterButtons() {
    const container = document.getElementById('filter-buttons');
    const collections = Object.values(loadCollections());

    // Add "All", any collections to filter by, and "Edit"
    container.innerHTML = `
        <button class="tag${activeFilter === 'all' ? ' active' : ''}"
            type="button" data-filter="all">All</button>
        ${collections.map(col => `
            <button class="tag${activeFilter === col.id ? ' active' : ''}"
                type="button" data-filter="${col.id}">${escapeHtml(col.name)}</button>
        `).join('')}
        <button class="tag${managerOpen ? ' active' : ''}"
            type="button" id="manage-collections-btn"
            aria-expanded="${managerOpen}" aria-controls="collections-manager">Edit</button>
    `;
}

function handleFilterClick(e) {
    // Toggle the collection manager when the Edit button is clicked
    if (e.target.closest('#manage-collections-btn')) {
        managerOpen = !managerOpen;
        const manager = document.getElementById('collections-manager');
        manager.hidden = !managerOpen;

        // Unset activeFilter so filters aren't rendered with active class
        if (managerOpen) { activeFilter = ''; renderCollectionManager(); }
        renderFilterButtons();
        renderCollections();
        return;
    }

    const btn = e.target.closest('#filter-buttons .tag');
    if (!btn) return;

    // Selecting a filter closes the manager
    if (managerOpen) {
        managerOpen = false;
        document.getElementById('collections-manager').hidden = true;
    }

    // Sets active filter - defaults to "All"
    activeFilter = btn.dataset.filter || 'all';
    renderFilterButtons();
    renderCollections();
}

// ── Artist cards ──────────────────────────────────────────────────────────────

function getFilteredArtists() {
    // Get list of artists
    const artists = Object.values(loadArtists());

    // Return based on filter
    if (activeFilter === 'all') return artists;

    return artists.filter(artist =>
        (artist.collectionIds || []).includes(activeFilter)
    );
}

function renderCollections() {
    const resultsContainer = document.getElementById('results');
    const artists = getFilteredArtists();
    const collections = loadCollections();

    // Empty list if the collections manager is open
    if (managerOpen) { resultsContainer.innerHTML = ''; return; }

    // Placeholder message if no artists
    if (artists.length === 0) {
        const total = Object.keys(loadArtists()).length;

        // Alter message depending on if any artists have been saved yet
        const msg = total === 0
            ? 'No artists saved yet. Search and add some from the <a href="index.html">Search</a> page!'
            : 'No artists in this collection yet.';

        resultsContainer.innerHTML = `<p class="empty-state">${msg}</p>`;
        return;
    }

    resultsContainer.innerHTML = '';
    artists.forEach((artist, i) => {
        // Show a tag for each collection the artist belongs to; filter any
        // collection IDs that no longer exist (e.g. deleted after being saved)
        const badges = (artist.collectionIds || [])
            .filter(id => collections[id])
            .map(id => `<span class="collection-badge">${escapeHtml(collections[id].name)}</span>`)
            .join('');

        // Create the card with the extra tags and trailing buttons
        const card = createArtistCard(artist, {
            extraInfo: `
                <div class="collection-badges">${badges}</div>
                ${artist.note ? `<p>${escapeHtml(artist.note)}</p>` : ''}
            `,
            trailing: `
                <div class="card-actions">
                    <button class="icon-btn" type="button"
                        aria-label="Edit ${escapeHtml(artist.name)}">Edit</button>
                    <button class="icon-btn delete" type="button"
                        aria-label="Remove ${escapeHtml(artist.name)}">Delete</button>
                </div>
            `
        });
        card.style.setProperty('--card-index', i); // Drives the staggered slide-up animation
        resultsContainer.appendChild(card);
    });
}

// ── Inline card edit ──────────────────────────────────────────────────────────

function openInlineEdit(card, artist) {
    const collections = Object.values(loadCollections());
    const checkedIds = artist.collectionIds || [];

    // Create checkboxes for each available collection
    const checkboxes = collections.map(col => `
        <label class="collection-checkbox-label">
            <input type="checkbox" value="${col.id}"${checkedIds.includes(col.id) ? ' checked' : ''}>
            ${escapeHtml(col.name)}
        </label>
    `).join('');

    // Set card to edit functionality with checkboxes/note and save/cancel buttons
    card.innerHTML = `
        <div class="info">
            <h3>${escapeHtml(artist.name)}</h3>
            <div class="collection-checkboxes" role="group" aria-label="Collections">
                ${checkboxes}
            </div>
            <textarea class="edit-note" aria-label="Note"
                placeholder="Add a note...">${escapeHtml(artist.note || '')}</textarea>
        </div>
        <div class="card-actions">
            <button class="icon-btn save-edit-btn" type="button" aria-label="Save">Save</button>
            <button class="icon-btn cancel-edit-btn" type="button" aria-label="Cancel">Cancel</button>
        </div>
    `;

    // Save edits
    card.querySelector('.save-edit-btn').addEventListener('click', function() {
        // Get a list of the checked values
        const collectionIds = [...card.querySelectorAll('.collection-checkboxes input:checked')]
            .map(cb => cb.value);
        
        // Get note and update artist
        const note = card.querySelector('.edit-note').value.trim();
        updateArtist(artist.id, { collectionIds, note });
        renderCollections();
    });

    // Cancel edits
    card.querySelector('.cancel-edit-btn').addEventListener('click', renderCollections);
}

// ── Results click delegation ──────────────────────────────────────────────────

function handleResultsClick(e) {
    // Get closest card
    const card = e.target.closest('.artist-card');
    if (!card) return;

    // Get artist id
    const artistId = card.dataset.artistId;

    // Remove by id if delete button, or open editor if other button
    if (e.target.closest('.delete')) {
        removeArtist(artistId);
        renderCollections();
        return;
    } else if (e.target.closest('.icon-btn')) {
        openInlineEdit(card, loadArtists()[artistId]);
        return;
    }
}

// ── Status message for file input ────────────────────────────────────────────────────────────

function showStatusMessage(text, isError = false) {
    let msg = document.getElementById('status-message');

    // Create message if doesn't exist
    if (!msg) {
        msg = document.createElement('p');
        msg.id = 'status-message';
        msg.className = 'status-message';
        document.querySelector('.view-section').prepend(msg);
    }

    // Set text and error class if applicable
    msg.textContent = text;
    msg.classList.toggle('error', isError);

    // Clear message after 3 sec
    clearTimeout(msg._timer);
    msg._timer = setTimeout(() => msg.remove(), 3000);
}

// ── Init ──────────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', function() {
    // Render content
    renderFilterButtons();
    renderCollections();

    // Set click handlers
    document.getElementById('filter-buttons').addEventListener('click', handleFilterClick);
    document.getElementById('results').addEventListener('click', handleResultsClick);
    document.getElementById('export-btn').addEventListener('click', exportData);

    // Import: trigger hidden file input when the Import button is clicked
    const importInput = document.getElementById('import-input');
    document.getElementById('import-btn').addEventListener('click', () => importInput.click());

    // Attempt file import on input change (file added from picker)
    importInput.addEventListener('change', function() {
        if (this.files.length === 0) return;

        // Handle promise from importData, display message, rerender if fulfilled
        importData(this.files[0])
            .then(({ collections, artists }) => {
                showStatusMessage(`Imported ${collections} collection(s) and ${artists} artist(s).`);
                renderCollectionManager();
                renderFilterButtons();
                renderCollections();
            })
            .catch(err => {
                console.error('Import error:', err);
                showStatusMessage('Could not import file. Make sure it is a valid Dial export.', true);
            });
        this.value = ''; // Reset so the same file can be re-imported
    });
});
