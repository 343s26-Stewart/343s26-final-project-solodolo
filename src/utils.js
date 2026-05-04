// utils.js - Shared utilities for Dial
// Loaded before other scripts; functions are available at global scope.

const COLLECTIONS_KEY = 'dial_collections';

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

// Builds a standard artist card element used by both the search and
// collections pages. The two pages share the avatar + info block but differ
// in the trailing column (View → indicator vs. edit/delete buttons), so the
// caller passes any page-specific HTML via the options object:
//   - extraInfo: HTML appended inside .info (e.g. status badge, saved note)
//   - trailing:  HTML for the right-hand column after .info
function createArtistCard(artist, { extraInfo = '', trailing = '' } = {}) {
    const card = document.createElement('li');
    card.className = 'artist-card';
    card.dataset.artistId = artist.id;

    const avatarText = artist.avatarText || generateInitials(artist.name);
    const genreText = (artist.genres && artist.genres.length > 0)
        ? artist.genres.slice(0, 3).map(escapeHtml).join(' · ')
        : 'No genres';

    card.innerHTML = `
        <div class="avatar" aria-hidden="true">${escapeHtml(avatarText)}</div>
        <div class="info">
            <h3>${escapeHtml(artist.name)}</h3>
            <p>${genreText}</p>
            ${extraInfo}
        </div>
        ${trailing}
    `;

    // Set avatar color via JS — dynamic per-artist values stay out of markup
    card.querySelector('.avatar').style.backgroundColor =
        artist.avatarColor || getAvatarColor(artist.name);
    return card;
}
