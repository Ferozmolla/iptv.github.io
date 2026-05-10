let playlistChannels = [];  // চ্যানেল playlist.m3u থেকে
let premiumChannels = [];   // চ্যানেল Premium Live.m3u থেকে
let favorites = JSON.parse(localStorage.getItem("iptv_favs")) || [];

// ডিফল্ট ভিউ
let currentCategory = 'Home';
let currentView = 'home';

// ডিফল্ট ১০টি ক্যাটাগরি যা আগে দেখাবে
const PREFERRED_CATEGORIES = [
    "Cricket", 
    "Football", 
    "Bangladesh", 
    "India", 
    "Pakistan", 
    "News Channels", 
    "TV Documentary", 
    "Kids TV", 
    "History", 
    "English"
];

// Lazy Loading Configuration
const CHANNELS_PER_PAGE = 30; 
let displayedChannels = [];
let currentPage = 0;
let isLoadingMore = false;

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    console.log("=== App Initialization Started ===");
    
    // রিস্টোর লাস্ট ভিউ (ব্যাক বাটন ফিফ)
    const lastView = localStorage.getItem('lastView') || 'home';
    const lastCategory = localStorage.getItem('lastCategory') || 'Home';
    
    currentView = lastView;
    currentCategory = lastCategory;
    
    fetchPlaylists();
    setupEventListeners();
    setupInfiniteScroll();
});

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
                if (currentView === 'home') {
                    return matchesSearch;
                }
                return (currentCategory === 'All' || ch.category === currentCategory) && matchesSearch;
            });
            
            displayChannelsLazy(filtered);
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

function setupInfiniteScroll() {
    const container = document.getElementById('channels');
    if (!container) return;

    const oldSentinel = document.getElementById('scroll-sentinel');
    if (oldSentinel) oldSentinel.remove();

    const observer = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting && !isLoadingMore) {
            loadMoreChannels();
        }
    }, { rootMargin: '300px' }); 

    const sentinel = document.createElement('div');
    sentinel.id = 'scroll-sentinel';
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
        if (sentinel) container.insertBefore(card, sentinel);
        else container.appendChild(card);
    });

    currentPage++;
    isLoadingMore = false;
}

function displayChannelsLazy(list) {
    const container = document.getElementById('channels');
    if (!container) return;
    
    const sentinel = document.getElementById('scroll-sentinel');
    container.innerHTML = "";
    if (sentinel) container.appendChild(sentinel);
    else setupInfiniteScroll();

    if (list.length === 0) {
        container.innerHTML = '<div class="loading-spinner">No channels found.</div>';
        return;
    }

    displayedChannels = list;
    currentPage = 0;
    loadMoreChannels();
}

async function fetchPlaylists() {
    const timestamp = new Date().getTime();
    const playlistPath = `./data/playlist.m3u?v=${timestamp}`;
    const premiumPath = `./data/Premium Live.m3u?v=${timestamp}`;
    
    playlistChannels = [];
    premiumChannels = [];
    
    try {
        console.log("Fetching playlists...");
        const resPlaylist = await fetch(playlistPath).then(r => r.ok ? r.text() : "").catch(e => { console.error("Playlist fetch failed:", e); return ""; });
        const resPremium = await fetch(premiumPath).then(r => r.ok ? r.text() : "").catch(e => { console.error("Premium fetch failed:", e); return ""; });

        if (resPlaylist) {
            parseM3U(resPlaylist, 'playlist');
            console.log(`✓ Loaded ${playlistChannels.length} playlist channels.`);
        }
        
        if (resPremium) {
            parseM3U(resPremium, 'premium');
            console.log(`✓ Loaded ${premiumChannels.length} premium channels.`);
        }
    } catch (error) {
        console.error(`Critical error loading playlists:`, error);
    }

    // ট্যাব বার আপডেট
    updateCategories();
    
    // রিস্টোর ভিউ
    if (currentView === 'premium') {
        showPremiumLive();
    } else if (currentView === 'fav') {
        showFavorites();
    } else if (currentView === 'playlist') {
        filterCategory(currentCategory);
    } else {
        showHome();
    }
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
            } else {
                const genericChannel = {
                    name: "Unknown Channel",
                    logo: "",
                    category: (source === 'premium' ? "Premium Live" : "General"),
                    url: line
                };
                if (!targetArray.some(ch => ch.url === genericChannel.url)) {
                    targetArray.push(genericChannel);
                }
            }
        }
    }
}

function updateCategories() {
    const nav = document.getElementById('nav-categories');
    if (!nav) return;

    // শুধুমাত্র PREFERRED_CATEGORIES এ যা আছে তাই দেখাবো
    // General বা অন্য কোনো ক্যাটাগরি দেখাবো না
    let allCats = [...new Set(playlistChannels.map(ch => ch.category))];
    
    // শুধুমাত্র পছন্দের ক্যাটাগরি যা প্লেলিস্টে আছে এবং General নয়
    let finalCats = PREFERRED_CATEGORIES.filter(c => allCats.includes(c) && c !== 'General');

    nav.innerHTML = finalCats.map(cat => {
        let isActive = (currentCategory === cat && currentView === 'playlist');
        return `<li class="nav-category-item ${isActive ? 'active' : ''}" onclick="filterCategory('${cat}')">${cat}</li>`;
    }).join('');
    
    const homeItem = document.getElementById('nav-home');
    if (homeItem) homeItem.classList.toggle('active', currentView === 'home');
    
    updateActionButtons();
}

function updateActionButtons() {
    const premiumBtn = document.querySelector('.nav-premium');
    const webtvBtn = document.querySelector('.nav-webtv');
    const mylistBtn = document.querySelector('.nav-mylist');
    
    if (premiumBtn) premiumBtn.classList.toggle('active', currentView === 'premium');
    if (webtvBtn) webtvBtn.classList.toggle('active', currentView === 'webtv');
    if (mylistBtn) mylistBtn.classList.toggle('active', currentView === 'fav');
    
    // Update desktop action buttons
    const premiumBtnDesktop = document.querySelector('.nav-premium-desktop');
    const webtvBtnDesktop = document.querySelector('.nav-webtv-desktop');
    const mylistBtnDesktop = document.querySelector('.nav-mylist-desktop');
    
    if (premiumBtnDesktop) premiumBtnDesktop.classList.toggle('active', currentView === 'premium');
    if (webtvBtnDesktop) webtvBtnDesktop.classList.toggle('active', currentView === 'webtv');
    if (mylistBtnDesktop) mylistBtnDesktop.classList.toggle('active', currentView === 'fav');
}

function showHome() {
    currentView = 'home';
    currentCategory = 'Home';
    localStorage.setItem('lastView', 'home');
    localStorage.setItem('lastCategory', 'Home');
    
    const title = document.getElementById('section-title');
    if (title) title.innerText = '🏠 Trending Now';
    
    updateCategories();
    displayChannelsLazy(playlistChannels);
}

function filterCategory(cat) {
    currentCategory = cat;
    currentView = 'playlist';
    localStorage.setItem('lastView', 'playlist');
    localStorage.setItem('lastCategory', cat);
    
    const title = document.getElementById('section-title');
    if (title) title.innerText = cat;
    
    const filtered = playlistChannels.filter(ch => ch.category === cat);
    updateCategories();
    displayChannelsLazy(filtered);
}

function showPremiumLive() {
    currentView = 'premium';
    currentCategory = 'Premium Live';
    localStorage.setItem('lastView', 'premium');
    localStorage.setItem('lastCategory', 'Premium Live');
    
    const title = document.getElementById('section-title');
    if (title) title.innerText = '🌟 Premium Live';
    
    updateCategories();
    displayChannelsLazy(premiumChannels);
}

function showWebTV() {
    window.location.href = 'webtv.html';
}

function showFavorites() {
    currentView = 'fav';
    currentCategory = 'My List';
    localStorage.setItem('lastView', 'fav');
    localStorage.setItem('lastCategory', 'My List');
    
    const title = document.getElementById('section-title');
    if (title) title.innerText = '❤️ My Favorites';
    
    const filtered = playlistChannels.concat(premiumChannels).filter(ch => favorites.includes(ch.url));
    updateCategories();
    displayChannelsLazy(filtered);
}

function toggleFav(event, url) {
    event.stopPropagation();
    const index = favorites.indexOf(url);
    if (index === -1) {
        favorites.push(url);
    } else {
        favorites.splice(index, 1);
    }
    localStorage.setItem("iptv_favs", JSON.stringify(favorites));
    
    const btn = event.currentTarget;
    btn.classList.toggle('active');
    
    if (currentView === 'fav') showFavorites();
}

function playChannel(url, name) {
    // সেভ স্টেট বিফোর নেভিগেশন
    localStorage.setItem('lastView', currentView);
    localStorage.setItem('lastCategory', currentCategory);
    
    const playerUrl = `player.html?url=${encodeURIComponent(url)}&name=${encodeURIComponent(name)}`;
    window.location.href = playerUrl;
}
