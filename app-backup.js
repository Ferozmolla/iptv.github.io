let allChannels = [];
let premiumChannels = [];
let favorites = JSON.parse(localStorage.getItem("iptv_favs")) || [];
let currentCategory = localStorage.getItem('currentCategory') || 'all';
let currentView = 'all'; // Track current view: 'all', 'premium', 'fav'

// CORS Proxy URLs
const corsProxies = [
    "https://api.allorigins.win/raw?url=",
    "https://corsproxy.io/?url=",
    "https://api.codetabs.com/v1/proxy?quest="
];

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    console.log("=== App Initialization Started ===");
    fetchPlaylist();
    setupEventListeners();
});

function setupEventListeners() {
    const searchInput = document.getElementById('search');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            const searchTerm = e.target.value.toLowerCase();
            let filtered;
            
            if (currentView === 'premium') {
                filtered = premiumChannels.filter(ch => 
                    ch.name.toLowerCase().includes(searchTerm) || 
                    ch.category.toLowerCase().includes(searchTerm)
                );
            } else {
                filtered = allChannels.filter(ch => 
                    ch.name.toLowerCase().includes(searchTerm) || 
                    ch.category.toLowerCase().includes(searchTerm)
                );
            }
            displayChannels(filtered);
        });
    }

    // Navbar scroll effect
    window.addEventListener('scroll', () => {
        const nav = document.querySelector('.navbar');
        if (window.scrollY > 50) {
            nav.classList.add('scrolled');
        } else {
            nav.classList.remove('scrolled');
        }
    });
}

async function fetchPlaylist() {
    console.log("=== Fetching Playlists ===");
    
    // Local playlist
    const localPath = "./data/playlist.m3u";
    
    // Premium Live M3U file from data folder
    const premiumPath = "./data/Premium Live.m3u";
    
    allChannels = [];
    premiumChannels = [];
    
    // Load local playlist
    try {
        console.log("Loading local playlist from:", localPath);
        const response = await fetch(localPath);
        if (response.ok) {
            const data = await response.text();
            parseM3U(data, false);
            console.log("✓ Local playlist loaded. Total channels:", allChannels.length);
        }
    } catch (error) {
        console.error(`✗ Error loading local playlist:`, error);
    }
    
    // Load Premium Live M3U file
    try {
        console.log("Loading Premium Live M3U from:", premiumPath);
        const response = await fetch(premiumPath);
        if (response.ok) {
            const data = await response.text();
            parseM3U(data, true);
            console.log("✓ Premium Live M3U loaded. Total premium channels:", premiumChannels.length);
        }
    } catch (error) {
        console.error(`✗ Error loading Premium Live M3U:`, error);
    }

    console.log("=== Final Channel Count ===");
    console.log("All Channels:", allChannels.length);
    console.log("Premium Channels:", premiumChannels.length);

    // Initialize display
    if (allChannels.length > 0 || premiumChannels.length > 0) {
        if (allChannels.length > 0) {
            updateHero(allChannels[0]);
        }
        displayChannels(allChannels);
        updateCategories();
    } else {
        document.getElementById('channels').innerHTML = `<div class="loading-spinner">No channels loaded. Check connection.</div>`;
    }
}

function parseM3U(data, isPremium = false) {
    const lines = data.split("\n");
    let currentChannel = null;
    let channelsAdded = 0;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        
        if (line.startsWith("#EXTINF:")) {
            const nameMatch = line.match(/,(.*)$/);
            const logoMatch = line.match(/tvg-logo="([^"]*)"/);
            const groupMatch = line.match(/group-title="([^"]*)"/);
            
            currentChannel = {
                name: nameMatch ? nameMatch[1].trim() : "Unknown Channel",
                logo: logoMatch ? logoMatch[1] : "https://via.placeholder.com/300x150/181818/E50914?text=IPTV+PRO",
                category: groupMatch ? groupMatch[1] : "General",
                url: ""
            };
        } else if (line.startsWith("http") && currentChannel) {
            currentChannel.url = line;
            
            if (isPremium) {
                // Add to premium channels (avoid duplicates)
                if (!premiumChannels.some(ch => ch.url === currentChannel.url)) {
                    premiumChannels.push({...currentChannel});
                    channelsAdded++;
                }
            } else {
                // Add to all channels (avoid duplicates)
                if (!allChannels.some(ch => ch.url === currentChannel.url)) {
                    allChannels.push({...currentChannel});
                    channelsAdded++;
                }
            }
            currentChannel = null;
        }
    }
    
    console.log(`Parsed ${channelsAdded} channels (isPremium: ${isPremium})`);
}

function updateHero(channel) {
    document.getElementById('hero-title').innerText = "IPTV ULTRA PRO";
    document.querySelector('.hero-banner').style.backgroundImage = `linear-gradient(to right, rgba(0,0,0,0.9) 20%, rgba(0,0,0,0.4) 50%, transparent 100%), url('banner.jpg')`;
}

function updateCategories() {
    const preferredOrder = ["Cricket", "Football", "Bangladesh", "India", "Pakistan", "News Channels", "TV Documentary", "Kids TV", "History", "English", "General"];
    
    let channels = currentView === 'premium' ? premiumChannels : allChannels;
    const playlistCategories = [...new Set(channels.map(ch => ch.category))];
    
    const sortedCategories = playlistCategories.sort((a, b) => {
        const indexA = preferredOrder.indexOf(a);
        const indexB = preferredOrder.indexOf(b);
        if (indexA !== -1 && indexB !== -1) return indexA - indexB;
        if (indexA !== -1) return -1;
        if (indexB !== -1) return 1;
        return a.localeCompare(b);
    });

    const navCategories = document.getElementById('nav-categories');
    if (navCategories) {
        const filteredCategories = sortedCategories.filter(cat => cat !== 'Premium Live');
        navCategories.innerHTML = filteredCategories.map(cat => `
            <li class="nav-category-item ${currentCategory === cat ? 'active' : ''}" onclick="filterCategory('${cat}')">${cat}</li>
        `).join('');
    }
}

function displayChannels(list) {
    const container = document.getElementById('channels');
    container.innerHTML = "";

    if (list.length === 0) {
        container.innerHTML = '<div class="loading-spinner">No channels found.</div>';
        return;
    }

    list.forEach(ch => {
        const isFav = favorites.includes(ch.url);
        const card = document.createElement('div');
        card.className = 'channel-card';
        card.innerHTML = `
            <img src="${ch.logo}" onerror="this.src='https://via.placeholder.com/300x150/181818/E50914?text=${encodeURIComponent(ch.name)}'">
            <button class="fav-btn ${isFav ? 'active' : ''}" onclick="toggleFav(event, '${ch.url}')"><i class="fas fa-heart"></i></button>
            <div class="channel-info">
                <div class="channel-name">${ch.name}</div>
                <div class="channel-category">${ch.category}</div>
            </div>
        `;
        card.onclick = () => playChannel(ch.url, ch.name);
        container.appendChild(card);
    });
}

function filterCategory(cat) {
    currentCategory = cat;
    currentView = 'all';
    localStorage.setItem('currentCategory', cat);
    updateCategories();
    document.getElementById('section-title').innerText = cat === 'all' ? 'Trending Now' : cat;
    displayChannels(cat === 'all' ? allChannels : allChannels.filter(ch => ch.category === cat));
}

function showPremiumLive() {
    console.log("=== Showing Premium Live ===");
    console.log("Total premium channels:", premiumChannels.length);
    currentView = 'premium';
    currentCategory = 'Premium Live';
    localStorage.setItem('currentCategory', 'Premium Live');
    document.getElementById('section-title').innerText = '🌟 Premium Live';
    updateCategories();
    
    if (premiumChannels.length === 0) {
        console.warn("⚠️ No premium channels loaded!");
        document.getElementById('channels').innerHTML = '<div class="loading-spinner">Loading Premium Channels...</div>';
        // Try to reload premium channels
        setTimeout(() => {
            if (premiumChannels.length === 0) {
                document.getElementById('channels').innerHTML = '<div class="loading-spinner">No premium channels available. Please check your internet connection.</div>';
            }
        }, 3000);
    } else {
        displayChannels(premiumChannels);
    }
}

function showFavorites() {
    currentView = 'fav';
    currentCategory = 'My List';
    localStorage.setItem('currentCategory', 'My List');
    document.getElementById('section-title').innerText = 'My List';
    const allCombined = [...allChannels, ...premiumChannels];
    displayChannels(allCombined.filter(ch => favorites.includes(ch.url)));
}

function toggleFav(e, url) {
    e.stopPropagation();
    if (favorites.includes(url)) {
        favorites = favorites.filter(f => f !== url);
    } else {
        favorites.push(url);
    }
    localStorage.setItem("iptv_favs", JSON.stringify(favorites));
    
    if (currentView === 'fav') {
        showFavorites();
    } else if (currentView === 'premium') {
        showPremiumLive();
    } else {
        filterCategory(currentCategory);
    }
}

function playChannel(url, name) {
    // Save current category and view to localStorage for back button
    localStorage.setItem('lastCategory', currentCategory);
    localStorage.setItem('lastView', currentView);
    window.location.href = `player.html?url=${encodeURIComponent(url)}&name=${encodeURIComponent(name)}`;
}

function playFirstChannel() {
    if (allChannels.length > 0) {
        playChannel(allChannels[0].url, allChannels[0].name);
    }
}

function showWebTV() {
    window.location.href = 'webtv.html';
}
