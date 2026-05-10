const PROXY_URL = "https://api.allorigins.win/raw?url=";

self.addEventListener('install', (event) => {
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(clients.claim());
});

self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);
    
    // শুধুমাত্র .m3u8 বা .ts ফাইলের জন্য এবং যদি সেগুলো HTTP হয়
    if (url.protocol === 'http:' && (url.pathname.endsWith('.m3u8') || url.pathname.endsWith('.ts') || url.href.includes('m3u8'))) {
        console.log('SW Proxy Intercepting:', url.href);
        
        const proxiedUrl = PROXY_URL + encodeURIComponent(url.href);
        
        event.respondWith(
            fetch(proxiedUrl, {
                mode: 'cors',
                credentials: 'omit'
            }).catch(err => {
                console.error('SW Proxy Fetch Error:', err);
                return fetch(event.request); // ফেইল করলে অরিজিনাল রিকোয়েস্ট চেষ্টা করবে
            })
        );
    }
});
