// Advanced Universal Player Engine with Multiple Engine Fallbacks
// Version 4.0 - Optimized for Mobile & Desktop Browsers

document.addEventListener('DOMContentLoaded', () => {
    const params = new URLSearchParams(window.location.search);
    const streamUrl = params.get('url');
    const streamName = params.get('name');
    const playerWrapper = document.getElementById('player-wrapper');
    const loading = document.getElementById('loading');
    const errorMsg = document.getElementById('error-msg');
    const errDetail = document.getElementById('err-detail');

    if (streamName) {
        document.title = `Playing: ${streamName} - IPTV PRO`;
    }

    if (!streamUrl) {
        showError("No valid stream URL provided.");
        return;
    }

    console.log("Loading stream:", streamUrl);

    // Proxy list for CORS bypass
    const proxies = [
        "", // Direct
        "https://api.allorigins.win/raw?url=",
        "https://corsproxy.io/?url=",
        "https://api.codetabs.com/v1/proxy?quest=",
        "https://thingproxy.freeboard.io/fetch/",
        "https://proxy.cors.sh/"
    ];

    let currentProxyIndex = 0;

    function tryNextEngine(url) {
        // Clear previous player content
        playerWrapper.innerHTML = "";
        
        // Mixed Content Check: If page is HTTPS and stream is HTTP, we MUST use a proxy
        const isPageHttps = window.location.protocol === 'https:';
        const isStreamHttp = url.startsWith('http:');
        
        if (isPageHttps && isStreamHttp && currentProxyIndex === 0) {
            console.warn("Mixed content detected (HTTPS page, HTTP stream). Forcing proxy...");
            currentProxyIndex = 1; // Start with first proxy
            const proxiedUrl = proxies[currentProxyIndex] + encodeURIComponent(url);
            url = proxiedUrl;
        }

        // Priority 1: HLS.js (Best for modern browsers)
        if (Hls.isSupported()) {
            tryHlsJs(url);
        } 
        // Priority 2: Native HLS (Best for Safari & Mobile Browsers)
        else {
            tryNativeHls(url);
        }
    }

    function tryHlsJs(url) {
        console.log("Attempting HLS.js playback with:", url);
        playerWrapper.innerHTML = '<video id="video-player" style="width:100%; height:100%;" controls autoplay playsinline></video>';
        const video = document.getElementById('video-player');
        const hls = new Hls({
            enableWorker: true,
            lowLatencyMode: true,
            xhrSetup: function(xhr, url) {
                xhr.withCredentials = false;
            }
        });

        hls.loadSource(url);
        hls.attachMedia(video);

        hls.on(Hls.Events.MANIFEST_PARSED, () => {
            console.log("HLS.js Manifest Parsed");
            video.play().catch(e => console.warn("Auto-play blocked:", e));
            hideLoading();
        });

        hls.on(Hls.Events.ERROR, (event, data) => {
            if (data.fatal) {
                switch (data.type) {
                    case Hls.ErrorTypes.NETWORK_ERROR:
                        console.warn("HLS.js Network Error, trying next engine...");
                        hls.destroy();
                        tryClappr(url);
                        break;
                    case Hls.ErrorTypes.MEDIA_ERROR:
                        console.warn("HLS.js Media Error, trying next engine...");
                        hls.recoverMediaError();
                        break;
                    default:
                        console.error("HLS.js Fatal Error, trying next engine...");
                        hls.destroy();
                        tryClappr(url);
                        break;
                }
            }
        });
    }

    function tryNativeHls(url) {
        console.log("Attempting Native HLS playback with:", url);
        playerWrapper.innerHTML = `<video id="video-player" src="${url}" style="width:100%; height:100%;" controls autoplay playsinline></video>`;
        const video = document.getElementById('video-player');

        video.addEventListener('loadedmetadata', () => {
            console.log("Native HLS Metadata Loaded");
            video.play().catch(e => console.warn("Auto-play blocked:", e));
            hideLoading();
        });

        video.addEventListener('error', () => {
            console.warn("Native HLS Error, trying Clappr...");
            tryClappr(url);
        });
    }

    function tryClappr(url) {
        console.log("Attempting Clappr playback with:", url);
        const player = new Clappr.Player({
            source: url,
            parentId: "#player-wrapper",
            width: '100%',
            height: '100%',
            autoPlay: true,
            preload: 'auto',
            playback: {
                hlsjsConfig: {
                    enableWorker: true,
                    lowLatencyMode: true,
                    xhrSetup: function(xhr, url) {
                        xhr.withCredentials = false;
                    }
                }
            },
            events: {
                onReady: function() {
                    console.log("Clappr Ready");
                    hideLoading();
                },
                onError: function(e) {
                    console.warn("Clappr Error, trying Shaka...");
                    tryShaka(url);
                }
            }
        });
    }

    function tryShaka(url) {
        console.log("Attempting Shaka playback with:", url);
        playerWrapper.innerHTML = '<video id="shaka-video" style="width:100%; height:100%;" controls autoplay playsinline></video>';
        const video = document.getElementById('shaka-video');
        
        if (typeof shaka !== 'undefined') {
            const player = new shaka.Player(video);
            player.configure({
                streaming: {
                    retryParameters: { maxAttempts: 3, baseDelay: 1000, backoffFactor: 2 }
                }
            });

            player.addEventListener('error', (event) => {
                console.error('Shaka Error:', event.detail);
                handleFailure(url);
            });

            player.load(url).then(() => {
                console.log('Shaka Playback Started');
                hideLoading();
            }).catch((e) => {
                console.error('Shaka Load Error:', e);
                handleFailure(url);
            });
        } else {
            handleFailure(url);
        }
    }

    function handleFailure(url) {
        if (currentProxyIndex < proxies.length - 1) {
            currentProxyIndex++;
            console.log(`Retrying with Proxy ${currentProxyIndex}: ${proxies[currentProxyIndex]}`);
            const proxiedUrl = proxies[currentProxyIndex] + encodeURIComponent(streamUrl);
            tryNextEngine(proxiedUrl);
        } else {
            showError("Your browser or device does not support this video stream. Please try using a different browser like Chrome or Firefox, or check if the stream is online.");
        }
    }

    function hideLoading() {
        if (loading) loading.style.display = 'none';
        if (errorMsg) errorMsg.style.display = 'none';
    }

    function showError(msg) {
        if (loading) loading.style.display = 'none';
        if (errorMsg) {
            errorMsg.style.display = 'block';
            if (errDetail) errDetail.innerText = msg;
        }
    }

    // Start playback process
    tryNextEngine(streamUrl);
});
