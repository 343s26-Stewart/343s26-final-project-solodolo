// app.js - Main JavaScript for Dial app

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    // Elements
    const searchInput = document.getElementById('search-input');
    const searchButton = document.getElementById('search-button');
    const resultsContainer = document.getElementById('results');

    // Sample data for initial display (to be replaced with API calls)
    const sampleArtists = [
        {
            id: 'lumineers-id',
            name: 'The Lumineers',
            genres: ['folk', 'americana'],
            avatarClass: 'avatar-lumineers',
            avatarText: 'TL'
        },
        {
            id: '502s-id',
            name: 'The 502s',
            genres: ['folk', 'americana'],
            avatarClass: 'avatar-502s',
            avatarText: 'T5'
        }
    ];

    // Function to render artist cards
    function renderArtists(artists) {
        resultsContainer.innerHTML = '';
        artists.forEach(artist => {
            const card = document.createElement('article');
            card.className = 'artist-card';
            card.innerHTML = `
                <div class="avatar ${artist.avatarClass}">${artist.avatarText}</div>
                <div class="info">
                    <h3>${artist.name}</h3>
                    <p>${artist.genres.join(' · ')}</p>
                </div>
                <button class="view-btn" type="button" data-artist-id="${artist.id}">View →</button>
            `;
            resultsContainer.appendChild(card);
        });
    }

    // Initial render of sample data
    renderArtists(sampleArtists);

    // Search functionality (placeholder - to be implemented with MusicBrainz API)
    searchButton.addEventListener('click', function() {
        const query = searchInput.value.trim();
        if (query) {
            // TODO: Implement API search
            console.log('Searching for:', query);
            // For now, just show sample results
            renderArtists(sampleArtists);
        }
    });

    // Allow Enter key to trigger search
    searchInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            searchButton.click();
        }
    });

    // Handle view button clicks (placeholder)
    resultsContainer.addEventListener('click', function(e) {
        if (e.target.classList.contains('view-btn')) {
            const artistId = e.target.dataset.artistId;
            // TODO: Navigate to artist detail view
            console.log('View artist:', artistId);
        }
    });

    // TODO: Implement navigation between views
    // TODO: Implement localStorage for collections
    // TODO: Implement MusicBrainz API integration
});