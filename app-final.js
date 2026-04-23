let playlistChannels = [];  // চ্যানেল playlist.m3u থেকে
let premiumChannels = [];   // চ্যানেল Premium Live.m3u থেকে
let customChannels = [];    // custom_channels.json থেকে লোড করা চ্যানেল
let favorites = JSON.parse(localStorage.getItem("iptv_favs")) || [];
// ডিফল্ট ভিউ - Cricket ট্যাব ডিফল্ট করা হয়েছে
let currentCategory = 'Cricket';
let currentView = 'playlist';
// শুধুমাত্র এই ১০টি ক্যাটাগরি দেখানো হবে
const ALLOWED_CATEGORIES = [
    "Cricket", 
    "Football", 
    "Bangladesh", 
    "India", 
    "Pakistan", 
    "English",
    "News", 
    "Documentary", 
    "Kids", 
    "Sports"
];

// Network speed detection
let networkSpeed = 'normal'; // 'slow', 'normal', 'fast'
let isSlowNetwork = false;

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    console.log("=== App Initialization Started ===");
    
    // Detect network speed
    detectNetworkSpeed();
    
    // Restore last view
    const lastView = sessionStorage.getItem('iptv_state');
    if (lastView) {
        try {
            const state = JSON.parse(lastView);
            currentView = state.view || 'playlist';
            currentCategory = state.category || 'Cricket';
        } catch (e) {
            console.warn("Failed to restore state:", e);
        }
    }
    
    fetchPlaylists();
    setupEventListeners();
    
    console.log("App Initialization Complete");
});

// Network Speed Detection Function
function detectNetworkSpeed() {
    if ('connection' in navigator) {
        const connection = navigator.connection;
        const effectiveType = connection.effectiveType;
        
        if (effectiveType === '4g') {
            networkSpeed = 'fast';
            isSlowNetwork = false;
        } else if (effectiveType === '3g') {
            networkSpeed = 'normal';
            isSlowNetwork = false;
        } else if (effectiveType === '2g' || effectiveType === 'slow-2g') {
            networkSpeed = 'slow';
            isSlowNetwork = true;
        }
        
        console.log(`Network Speed Detected: ${effectiveType} (${networkSpeed})`);
    } else {
        console.log("Network Information API not available");
    }
}

function setupEventListeners() {
    const searchInput = document.getElementById('search');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            const searchTerm = e.target.value.toLowerCase();
            
            let activeList = currentView === 'premium' ? premiumChannels : playlistChannels;
            
            const filtered = activeList.filter(ch => {
                const matchesSearch = ch.name.toLowerCase().includes(searchTerm) || ch.category.toLowerCase().includes(searchTerm);
                if (currentView === 'fav') {
                    return favorites.includes(ch.url) && matchesSearch;
                }
                if (currentView === 'premium') {
                    return matchesSearch;
                }
                if (currentView === 'playlist') {
                    return (currentCategory === 'All' || ch.category === currentCategory) && matchesSearch;
                }
                return matchesSearch;
            });
            
            filterAndDisplay(filtered);
        });
    }

    window.addEventListener('scroll', () => {
        const nav = document.querySelector('.navbar');
        if (nav) {
            if (window.scrollY > 50) nav.classList.add('scrolled');
            else nav.classList.remove('scrolled');
        }
    });
}

// Progressive M3U Parsing
async function fetchPlaylists() {
    const timestamp = new Date().getTime();
    const playlistPath = `./data/playlist.m3u?v=${timestamp}`;
    const premiumPath = `./data/Premium Live.m3u?v=${timestamp}`;
    
    playlistChannels = [];
    premiumChannels = [];
    
    try {
        console.log("Fetching playlists...");
        
        // Parallel fetch both files
        const [resPlaylist, resPremium] = await Promise.all([
            fetch(playlistPath).then(r => r.ok ? r.text() : "").catch(e => { console.error("Playlist fetch failed:", e); return ""; }),
            fetch(premiumPath).then(r => r.ok ? r.text() : "").catch(e => { console.error("Premium fetch failed:", e); return ""; })
        ]);

        if (resPlaylist) {
            parseM3U(resPlaylist, 'playlist');
            console.log(`✓ Loaded ${playlistChannels.length} playlist channels.`);
        }
        
        if (resPremium) {
            parseM3U(resPremium, 'premium');
            console.log(`✓ Loaded ${premiumChannels.length} premium channels.`);
        }
        
        // Load custom channels if available
        loadCustomChannels();
    } catch (error) {
        console.error(`Critical error loading playlists:`, error);
    }

    // Update categories and restore view
    updateCategories();
    
    if (currentView === 'premium') {
        showPremiumLive();
    } else if (currentView === 'fav') {
        showFavorites();
    } else {
        filterCategory(currentCategory);
    }
}

// M3U Parsing Function
function parseM3U(data, source) {
    const lines = data.split("\n");
    let currentChannel = null;
    const targetArray = source === 'premium' ? premiumChannels : playlistChannels;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        if (line.startsWith("#EXTINF:")) {
            const nameMatch = line.match(/,(.+)$/);
            const logoMatch = line.match(/tvg-logo="([^"]+)"/);
            const groupMatch = line.match(/group-title="([^"]+)"/);
            
            currentChannel = {
                name: nameMatch ? nameMatch[1].trim() : "Unknown Channel",
                logo: logoMatch ? logoMatch[1] : "",
                category: groupMatch ? groupMatch[1] : (source === 'premium' ? "Premium Live" : "General"),
                url: ""
            };
        } else if (line.startsWith("http") || line.includes("://")) {
            if (currentChannel) {
                currentChannel.url = line;
                if (!targetArray.some(ch => ch.url === currentChannel.url)) {
                    targetArray.push({...currentChannel});
                }
                currentChannel = null;
            }
        }
    }
}

// Load custom channels from localStorage
function loadCustomChannels() {
    const savedChannels = localStorage.getItem('custom_channels');
    if (savedChannels) {
        try {
            customChannels = JSON.parse(savedChannels);
            console.log(`✓ Loaded ${customChannels.length} custom channels.`);
        } catch (e) {
            console.error("Failed to parse custom channels:", e);
        }
    }
}

function updateCategories() {
    const nav = document.getElementById('nav-categories');
    if (!nav) return;

    // Combine all channels
    let allChannels = [...playlistChannels, ...premiumChannels, ...customChannels];
    let allCats = [...new Set(allChannels.map(ch => ch.category))];
    
    // Filter to allowed categories
    let finalCats = ALLOWED_CATEGORIES.filter(c => allCats.includes(c));

    nav.innerHTML = finalCats.map(cat => {
        let isActive = (currentCategory === cat && currentView === 'playlist');
        return `<li class="nav-category-item ${isActive ? 'active' : ''}" onclick="filterCategory('${cat}')">${cat}</li>`;
    }).join('');
    
    updateActionButtons();
}

function updateActionButtons() {
    const premiumBtn = document.querySelector('.footer-tab[data-view="premium"]');
    const favBtn = document.querySelector('.footer-tab[data-view="fav"]');
    
    if (premiumBtn) premiumBtn.classList.toggle('active', currentView === 'premium');
    if (favBtn) favBtn.classList.toggle('active', currentView === 'fav');
}

function filterCategory(cat) {
    currentCategory = cat;
    currentView = 'playlist';
    
    updateCategories();
    updateActionButtons();
    
    let allChannels = [...playlistChannels, ...premiumChannels, ...customChannels];
    const filtered = allChannels.filter(ch => ch.category === cat);
    filterAndDisplay(filtered);
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function showHome() {
    currentView = 'playlist';
    currentCategory = 'Cricket';
    
    updateCategories();
    updateActionButtons();
    
    let allChannels = [...playlistChannels, ...premiumChannels, ...customChannels];
    filterAndDisplay(allChannels);
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function showPremiumLive() {
    currentView = 'premium';
    updateActionButtons();
    filterAndDisplay(premiumChannels);
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function showFavorites() {
    currentView = 'fav';
    updateActionButtons();
    
    let allChannels = [...playlistChannels, ...premiumChannels, ...customChannels];
    const filtered = allChannels.filter(ch => favorites.includes(ch.url));
    filterAndDisplay(filtered);
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function toggleFav(event, url) {
    event.stopPropagation();
    const index = favorites.indexOf(url);
    if (index > -1) {
        favorites.splice(index, 1);
    } else {
        favorites.push(url);
    }
    localStorage.setItem("iptv_favs", JSON.stringify(favorites));
    
    const btn = event.currentTarget;
    btn.classList.toggle('active');
    
    if (currentView === 'fav') showFavorites();
}

function playChannel(url, name) {
    saveState();
    // Detect slow network and pass it to player
    const isSlow = isSlowNetwork ? '1' : '0';
    const playerUrl = `player.html?url=${encodeURIComponent(url)}&name=${encodeURIComponent(name)}&slownet=${isSlow}`;
    window.location.href = playerUrl;
}

function saveState() {
    const state = {
        view: currentView,
        category: currentCategory,
        scrollPos: window.scrollY
    };
    sessionStorage.setItem('iptv_state', JSON.stringify(state));
}

function filterAndDisplay(channels) {
    const container = document.getElementById('channels');
    if (!container) return;
    
    container.innerHTML = "";
    
    if (!channels || channels.length === 0) {
        container.innerHTML = '<div class="loading-spinner">No channels found.</div>';
        return;
    }

    channels.forEach(ch => {
        const isFav = favorites.includes(ch.url);
        const card = document.createElement('div');
        card.className = 'channel-card';
        
        const logoUrl = ch.logo && ch.logo.trim() !== "" ? ch.logo : `https://via.placeholder.com/300x150/181818/E50914?text=${encodeURIComponent(ch.name)}`;
        
        card.innerHTML = `
            <img src="${logoUrl}" loading="lazy" onerror="this.src='https://via.placeholder.com/300x150/181818/E50914?text=${encodeURIComponent(ch.name)}'">
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

function renderDynamicTabs() {
    const container = document.getElementById('dynamic-tabs-container');
    if (!container) return;
    
    container.innerHTML = "";
    
    if (!customChannels || customChannels.length === 0) return;
    
    customChannels.forEach((group, index) => {
        if (group.groupName && group.channels && Array.isArray(group.channels)) {
            const btn = document.createElement('button');
            btn.className = 'dynamic-tab-btn';
            const icon = group.groupIcon || 'fas fa-play-circle';
            btn.innerHTML = `
                <i class="${icon}"></i>
                <span>${group.groupName}</span>
            `;
            btn.onclick = () => openChannelPopup(index);
            container.appendChild(btn);
        }
    });
}

function openChannelPopup(groupIndex) {
    const group = customChannels[groupIndex];
    if (!group) return;
    const modal = document.getElementById('channel-popup-modal');
    const title = document.getElementById('popup-title');
    const list = document.getElementById('popup-channels-list');
    
    if (!modal || !title || !list) return;
    title.innerText = group.groupName || "Channels";
    list.innerHTML = "";
    
    if (group.channels && Array.isArray(group.channels)) {
        group.channels.forEach(ch => {
            const item = document.createElement('div');
            item.className = 'popup-channel-item';
            
            const logoUrl = ch.logo && ch.logo.trim() !== "" ? ch.logo : `https://via.placeholder.com/300x150/141414/E50914?text=${encodeURIComponent(ch.name)}`;
            
            item.innerHTML = `
                <div class="popup-item-img">
                    <img src="${logoUrl}" onerror="this.src='https://via.placeholder.com/300x150/141414/E50914?text=${encodeURIComponent(ch.name)}'">
                </div>
                <div class="popup-item-info">
                    <div class="popup-item-name">${ch.name}</div>
                    <div class="popup-item-play"><i class="fas fa-play"></i> Play Now</div>
                </div>
            `;
            item.onclick = () => playChannel(ch.url, ch.name);
            list.appendChild(item);
        });
    }
    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
}

function closeChannelPopup() {
    const modal = document.getElementById('channel-popup-modal');
    if (modal) modal.style.display = 'none';
    document.body.style.overflow = 'auto';
}
