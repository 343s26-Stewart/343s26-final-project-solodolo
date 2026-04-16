// app.js - Main JavaScript for Dial app

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    // Elements
    const searchInput = document.getElementById('search-input');
    const searchButton = document.getElementById('search-button');
    const resultsContainer = document.getElementById('results');

    // Initial state
    resultsContainer.innerHTML = '<p>Enter an artist name to search.</p>';

    // Function to render artist cards
    function renderArtists(artists) {
        resultsContainer.innerHTML = '';
        if (artists.length === 0) {
            resultsContainer.innerHTML = '<p>No artists found. Try a different search term.</p>';
            return;
        }
        
        artists.forEach(artist => {
            const card = document.createElement('article');
            card.className = 'artist-card';
            card.dataset.artistId = artist.id; // Store artist ID on the card
            const avatarColor = getAvatarColor(artist.name);
            card.innerHTML = `
                <div class="avatar" style="background-color: ${avatarColor};">${artist.avatarText}</div>
                <div class="info">
                    <h3>${escapeHtml(artist.name)}</h3>
                    <p>${artist.genres.length > 0 ? artist.genres.map(g => escapeHtml(g)).slice(0, 3).join(' · ') : 'No genres available'}</p>
                </div>
                <div class="view-indicator">View →</div>
            `;
            resultsContainer.appendChild(card);
        });
    }

    // Helper function to generate consistent color based on artist name
    function getAvatarColor(name) {
        const colors = ['#8f6de9', '#ff7fb3', '#6dc8ff', '#ffd05b', '#4fd18b', '#ff8b4d', '#5f8dff', '#d65dff', '#00c2b8', '#ff5c8a', '#7ac5ff', '#ffc46d', '#7bef8e', '#d96dff'];
        let hash = 0;
        for (let i = 0; i < name.length; i++) {
            hash = name.charCodeAt(i) + ((hash << 5) - hash);
        }
        return colors[Math.abs(hash) % colors.length];
    }

    // Helper function to escape HTML to prevent XSS
    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // Function to search artists using MusicBrainz API
    async function searchArtists(query) {
        const url = `https://musicbrainz.org/ws/2/artist?query=${encodeURIComponent(query)}&fmt=json`;
        
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`API request failed: ${response.status}`);
        }
        
        const data = await response.json();
        return data.artists.map(artist => ({
            id: artist.id,
            name: artist.name,
            genres: artist.tags ? artist.tags.map(tag => tag.name) : [],
            avatarText: generateInitials(artist.name)
        }));
    }

    // Helper function to generate initials from artist name
    function generateInitials(name) {
        return name.split(' ')
            .map(word => word.charAt(0).toUpperCase())
            .slice(0, 2)
            .join('');
    }

    // Search functionality with MusicBrainz API
    searchButton.addEventListener('click', async function() {
        const query = searchInput.value.trim();
        if (!query) {
            alert('Please enter an artist name to search.');
            return;
        }

        // Show loading state
        searchButton.disabled = true;
        searchButton.textContent = 'Searching...';
        resultsContainer.innerHTML = '<p>Searching...</p>';

        try {
            const artists = await searchArtists(query);
            renderArtists(artists);
        } catch (error) {
            console.error('Search error:', error);
            resultsContainer.innerHTML = '<p>Sorry, there was an error searching for artists. Please try again.</p>';
        } finally {
            // Reset button
            searchButton.disabled = false;
            searchButton.textContent = '→';
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
        const card = e.target.closest('.artist-card');
        if (card) {
            const artistId = card.dataset.artistId;
            // TODO: Navigate to artist detail view
            console.log('View artist:', artistId);
        }
    });

    // TODO: Implement navigation between views
    // TODO: Implement localStorage for collections
    // TODO: Implement MusicBrainz API integration
});