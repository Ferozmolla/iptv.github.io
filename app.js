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
    "History"
];

// Lazy Loading Configuration
const CHANNELS_PER_PAGE = 30; 
let displayedChannels = [];
let currentPage = 0;
let isLoadingMore = false;

// State Management - ব্যাক বাটনের জন্য স্টেট সেভ করা
let lastScrollPosition = 0;
let lastCategory = 'Cricket';
let lastView = 'playlist';

// নেটওয়ার্ক স্পীড ডিটেকশন
let networkSpeed = 'normal'; 
let isSlowNetwork = false;

// Pro-level channel caching
let channelCache = {};
let lastFetchTime = 0;
const CACHE_DURATION = 3600000; // 1 hour

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    console.log("=== IPTV PRO V51 - Pro Level Initialization Started ===");
    
    detectNetworkSpeed();
    loadCustomChannelsFromStorage();
    
    // সব সময় ওপেনের সাথে ১০ ক্যাটাগরি ট্যাব চালু থাকবে এবং Cricket ডিফল্ট হবে
    currentView = 'playlist';
    currentCategory = 'Cricket';
    
    fetchPlaylists();
    setupEventListeners();
    setupInfiniteScroll();
    // Network indicator removed to avoid overlapping with Install App button
    
    // Restore state if available
    restoreState();
});

function restoreState() {
    try {
        const savedState = sessionStorage.getItem('iptv_state');
        if (savedState) {
            const state = JSON.parse(savedState);
            currentView = state.view || 'playlist';
            currentCategory = state.category || 'Cricket';
        }
    } catch (e) {
        console.log("Could not restore state");
    }
}

function loadCustomChannelsFromStorage() {
    try {
        const stored = localStorage.getItem('custom_channels');
        if (stored) {
            const parsed = JSON.parse(stored);
            if (Array.isArray(parsed) && parsed.length > 0) {
                customChannels = parsed;
                console.log("Loaded custom channels from localStorage:", customChannels.length, "items");
            }
        }
    } catch (error) {
        console.error("Error loading custom channels from localStorage:", error);
    }
}

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
    }
}

// Network indicator function removed as requested

function setupEventListeners() {
    const searchInput = document.getElementById('search');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            const searchTerm = e.target.value.toLowerCase();
            filterAndDisplay(searchTerm);
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

function filterAndDisplay(searchTerm = "") {
    let baseList = [];
    let flatCustomChannels = [];
    if (customChannels && customChannels.length > 0) {
        customChannels.forEach(group => {
            // Handle grouped structure (groupName, channels array)
            if (group.channels && Array.isArray(group.channels)) {
                group.channels.forEach(ch => {
                    flatCustomChannels.push({
                        ...ch,
                        category: group.category || group.groupName || "Custom"
                    });
                });
            }
            // Handle flat structure (direct channel objects with name, url, logo, category)
            else if (group.name && group.url) {
                flatCustomChannels.push({
                    name: group.name,
                    url: group.url,
                    logo: group.logo || "",
                    category: group.category || "Custom"
                });
            }
        });
    }

    if (currentView === 'premium') {
        baseList = premiumChannels;
    } else if (currentView === 'fav') {
        baseList = playlistChannels.concat(premiumChannels).concat(flatCustomChannels).filter(ch => favorites.includes(ch.url));
    } else {
        // playlist view: combine playlist and custom channels
        baseList = playlistChannels.concat(flatCustomChannels);
    }

    const filtered = baseList.filter(ch => {
        let matchesCategory = false;
        
        if (currentView === 'premium' || currentView === 'fav') {
            matchesCategory = true;
        } else {
            matchesCategory = ch.category === currentCategory;
        }
        
        const matchesSearch = ch.name.toLowerCase().includes(searchTerm) || ch.category.toLowerCase().includes(searchTerm);
        return matchesCategory && matchesSearch;
    });

    displayChannelsLazy(filtered);
}

function setupInfiniteScroll() {
    const container = document.getElementById('channels');
    if (!container) return;

    // Remove old sentinel if exists
    const oldSentinel = document.getElementById('scroll-sentinel');
    if (oldSentinel) oldSentinel.remove();

    const observer = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting && !isLoadingMore) {
            loadMoreChannels();
        }
    }, { rootMargin: '400px' }); 

    const sentinel = document.createElement('div');
    sentinel.id = 'scroll-sentinel';
    sentinel.style.height = '20px';
    sentinel.style.width = '100%';
    container.appendChild(sentinel);
    observer.observe(sentinel);
}

function loadMoreChannels() {
    if (isLoadingMore || !displayedChannels.length) return;
    
    const startIndex = currentPage * CHANNELS_PER_PAGE;
    if (startIndex >= displayedChannels.length) return;

    isLoadingMore = true;
    const endIndex = startIndex + CHANNELS_PER_PAGE;
    const channelsToAdd = displayedChannels.slice(startIndex, endIndex);

    const container = document.getElementById('channels');
    const sentinel = document.getElementById('scroll-sentinel');

    channelsToAdd.forEach(ch => {
        const isFav = favorites.includes(ch.url);
        const card = document.createElement('div');
        card.className = 'channel-card pro-card';
        
        const logoUrl = ch.logo && ch.logo.trim() !== "" ? ch.logo : `https://via.placeholder.com/300x150/141414/E50914?text=${encodeURIComponent(ch.name)}`;
        
        card.innerHTML = `
            <div class="card-img-container">
                <img src="${logoUrl}" loading="lazy" onerror="this.src='https://via.placeholder.com/300x150/141414/E50914?text=${encodeURIComponent(ch.name)}'">
                <div class="card-overlay">
                    <i class="fas fa-play-circle"></i>
                </div>
            </div>
            <button class="fav-btn ${isFav ? 'active' : ''}" onclick="toggleFav(event, '${ch.url}')">
                <i class="fas fa-heart"></i>
            </button>
            <div class="channel-info">
                <div class="channel-name">${ch.name}</div>
                <div class="channel-category-tag">${ch.category}</div>
            </div>
        `;
        card.onclick = () => playChannel(ch.url, ch.name);
        if (sentinel) container.insertBefore(card, sentinel);
        else container.appendChild(card);
    });

    currentPage++;
    isLoadingMore = false;
}

function displayChannelsLazy(list) {
    const container = document.getElementById('channels');
    if (!container) return;
    
    container.innerHTML = "";
    
    if (list.length === 0) {
        container.innerHTML = '<div class="no-results">No channels found in this category.</div>';
        return;
    }

    displayedChannels = list;
    currentPage = 0;
    loadMoreChannels();
    setupInfiniteScroll();
}

async function fetchPlaylists() {
    const timestamp = new Date().getTime();
    const playlistPath = `./data/playlist.m3u?v=${timestamp}`;
    const premiumPath = `./data/Premium Live.m3u?v=${timestamp}`;
    const customPath = `./data/custom_channels.json?v=${timestamp}`;
    
    try {
        console.log("Fetching playlists...");
        const [resPlaylist, resPremium, resCustom] = await Promise.all([
            fetch(playlistPath).then(r => r.ok ? r.text() : "").catch(e => {
                console.error("Error fetching playlist.m3u:", e);
                return "";
            }),
            fetch(premiumPath).then(r => r.ok ? r.text() : "").catch(e => {
                console.error("Error fetching Premium Live.m3u:", e);
                return "";
            }),
            fetch(customPath).then(r => r.ok ? r.json() : []).catch(e => {
                console.error("Error fetching custom_channels.json:", e);
                return [];
            })
        ]);

        if (resPlaylist) {
            parseM3U(resPlaylist, 'playlist');
            console.log(`Loaded ${playlistChannels.length} channels from playlist.m3u`);
        }
        if (resPremium) {
            parseM3U(resPremium, 'premium');
            console.log(`Loaded ${premiumChannels.length} channels from Premium Live.m3u`);
        }
        if (resCustom && Array.isArray(resCustom) && resCustom.length > 0) {
            customChannels = resCustom;
            console.log(`Loaded ${resCustom.length} custom channel groups`);
        }
        
    } catch (error) {
        console.error(`Error fetching data:`, error);
    }

    updateCategories();
    renderDynamicTabs();
    filterAndDisplay();
    updateTabStyles();
}

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
            
            let category = groupMatch ? groupMatch[1] : (source === 'premium' ? "Premium Live" : "General");
            
            // Category mapping - improved to handle more variations
            let finalCategory = category;
            if (category.toLowerCase().includes("news")) finalCategory = "News";
            else if (category.toLowerCase().includes("documentary")) finalCategory = "Documentary";
            else if (category.toLowerCase().includes("kids")) finalCategory = "Kids";
            else if (category.toLowerCase().includes("sports") || category.toLowerCase().includes("cricket")) finalCategory = "Cricket";
            else if (category.toLowerCase().includes("football")) finalCategory = "Football";
            else if (category.toLowerCase().includes("bangla") || category.toLowerCase().includes("bangladesh")) finalCategory = "Bangladesh";
            else if (category.toLowerCase().includes("india")) finalCategory = "India";
            else if (category.toLowerCase().includes("pakistan")) finalCategory = "Pakistan";
            else if (category.toLowerCase().includes("english")) finalCategory = "English";
            else if (category.toLowerCase().includes("history")) finalCategory = "History";
            else if (source === 'premium') finalCategory = "Premium Live";

            // Create channel object
            currentChannel = {
                name: nameMatch ? nameMatch[1].trim() : "Unknown",
                logo: logoMatch ? logoMatch[1] : "",
                category: finalCategory,
                url: ""
            };
        } else if (line.startsWith("http") || line.includes("://")) {
            if (currentChannel) {
                currentChannel.url = line;
                targetArray.push(currentChannel);
                currentChannel = null;
            }
        }
    }
}

function updateCategories() {
    const container = document.getElementById('category-list');
    if (!container) return;

    container.innerHTML = "";
    
    // শুধুমাত্র ১০টি অনুমোদিত ক্যাটাগরি দেখানো হবে
    const categoriesToShow = ALLOWED_CATEGORIES;
    
    categoriesToShow.forEach(cat => {
        const item = document.createElement('div');
        item.className = `nav-category-item ${currentCategory === cat ? 'active' : ''}`;
        item.textContent = cat;
        item.onclick = () => filterCategory(cat);
        container.appendChild(item);
    });
}

function filterCategory(cat) {
    currentCategory = cat;
    currentView = 'playlist';
    
    updateCategories();
    updateTabStyles();
    filterAndDisplay();
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function showHome() {
    currentView = 'playlist';
    currentCategory = 'Cricket';
    
    updateCategories();
    updateTabStyles();
    filterAndDisplay();
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function showPremiumLive() {
    currentView = 'premium';
    // When in premium view, we show all premium channels regardless of category
    updateTabStyles();
    filterAndDisplay();
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function showFavorites() {
    currentView = 'fav';
    updateTabStyles();
    filterAndDisplay();
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function updateTabStyles() {
    document.querySelectorAll('.footer-tab').forEach(tab => tab.classList.remove('active'));
    
    if (currentView === 'premium') {
        const tab = document.getElementById('tab-premium');
        if (tab) tab.classList.add('active');
    } else if (currentView === 'fav') {
        const tab = document.getElementById('tab-fav');
        if (tab) tab.classList.add('active');
    } else if (currentView === 'playlist') {
        // You could add a home tab if you want, but for now we just clear others
    }
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
    
    if (currentView === 'fav') filterAndDisplay();
}

function playChannel(url, name) {
    saveState();
    // Detect slow network if possible
    const isSlow = (navigator.connection && (navigator.connection.effectiveType === '2g' || navigator.connection.effectiveType === 'slow-2g')) ? '1' : '0';
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

function renderDynamicTabs() {
    const container = document.getElementById('dynamic-tabs-container');
    if (!container) return;
    
    container.innerHTML = "";
    
    if (!customChannels || customChannels.length === 0) return;
    
    customChannels.forEach((group, index) => {
        // Only render tabs for grouped structure
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

    // Handle grouped structure
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
    document.body.style.overflow = 'hidden'; // Prevent scrolling
}

function closeChannelPopup() {
    const modal = document.getElementById('channel-popup-modal');
    if (modal) modal.style.display = 'none';
    document.body.style.overflow = 'auto';
}
