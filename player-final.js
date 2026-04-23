// IPTV PRO V52 - Ultimate Player with Advanced Proxy & Mixed Content Handler
// Optimized for GitHub Pages HTTPS + HTTP Stream Compatibility
// Supports: HLS.js, Native HLS, Clappr, Shaka, YouTube, Direct Streams

document.addEventListener('DOMContentLoaded', () => {
    const params = new URLSearchParams(window.location.search);
    const streamUrl = params.get('url') || localStorage.getItem('currentStreamUrl');
    const streamName = params.get('name') || localStorage.getItem('currentStreamName');
    const isSlowNetwork = params.get('slownet') === '1' || localStorage.getItem('isSlowNetwork') === 'true';
    
    const playerWrapper = document.getElementById('player-wrapper');
    const loading = document.getElementById('loading');
    const errorMsg = document.getElementById('error-msg');
    const errDetail = document.getElementById('err-detail');
    const playerTitle = document.getElementById('player-title');

    if (streamName && playerTitle) {
        playerTitle.innerText = streamName;
        document.title = `Playing: ${streamName} - IPTV PRO`;
    }

    if (!streamUrl) {
        showError("No valid stream URL provided.");
        return;
    }

    console.log("Pro Player V52: Loading stream:", streamUrl.substring(0, 50) + "...");
    console.log("Slow Network Mode:", isSlowNetwork);

    // Advanced Proxy List - Optimized for GitHub Pages HTTPS
    // Order matters: Best performers for mixed content first
    const proxies = [
        "", // Direct (no proxy) - Only for HTTPS streams
        "https://corsproxy.io/?url=",  // Best for binary streams (.ts files)
        "https://api.allorigins.win/raw?url=",  // Good for JSON/M3U8
        "https://api.codetabs.com/v1/proxy?quest=",  // Reliable fallback
        "https://thingproxy.freeboard.io/fetch/",  // Another option
        "https://proxy.cors.sh/",  // Last resort
        "https://cors-anywhere.herokuapp.com/"  // Emergency fallback
    ];

    let currentProxyIndex = 0;
    let engineIndex = 0;
    let failureCount = 0;
    const engines = ['hls', 'native', 'clappr', 'dash', 'fallback'];
    const maxFailures = proxies.length * engines.length;

    // Pro-level configuration optimized for slow networks and GitHub Pages
    const proConfig = {
        hlsConfig: {
            enableWorker: true,
            lowLatencyMode: !isSlowNetwork,
            backBufferLength: isSlowNetwork ? 60 : 60,
            maxBufferLength: isSlowNetwork ? 180 : 120,
            maxMaxBufferLength: isSlowNetwork ? 300 : 240,
            manifestLoadingTimeOut: isSlowNetwork ? 30000 : 10000,
            manifestLoadingMaxRetry: isSlowNetwork ? 5 : 3,
            levelLoadingTimeOut: isSlowNetwork ? 30000 : 10000,
            levelLoadingMaxRetry: isSlowNetwork ? 5 : 3,
            fragLoadingTimeOut: isSlowNetwork ? 45000 : 15000,
            fragLoadingMaxRetry: isSlowNetwork ? 5 : 3,
            abrEwmaFastLive: isSlowNetwork ? 3000 : 3000,
            abrEwmaSlowLive: isSlowNetwork ? 9000 : 9000,
            startLevel: isSlowNetwork ? 0 : -1,
            abrBandwidthFactor: isSlowNetwork ? 0.95 : 0.95,
            abrBandwidthSafetyFactor: isSlowNetwork ? 0.9 : 0.9,
            xhrSetup: function(xhr, url) {
                xhr.withCredentials = false;
                xhr.timeout = isSlowNetwork ? 45000 : 15000;
            }
        }
    };

    function extractYouTubeVideoId(url) {
        const patterns = [
            /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/v\/|youtube\.com\/shorts\/)([^&\n?#]+)/
        ];
        for (let pattern of patterns) {
            const match = url.match(pattern);
            if (match && match[1]) return match[1];
        }
        return null;
    }

    function isYouTubeUrl(url) {
        return /(?:youtube\.com|youtu\.be)/.test(url);
    }

    function playYouTubeVideo(videoId) {
        console.log("Engine: YouTube Embed");
        playerWrapper.innerHTML = `
            <iframe 
                id="youtube-player"
                width="100%" 
                height="100%" 
                src="https://www.youtube.com/embed/${videoId}?autoplay=1&controls=1&modestbranding=1&rel=0&fs=1&enablejsapi=1&origin=${encodeURIComponent(window.location.origin)}" 
                frameborder="0" 
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" 
                allowfullscreen
                style="border: none; position: absolute; top: 0; left: 0; width: 100%; height: 100%;">
            </iframe>
        `;
        hideLoading();
    }

    function getMixedContentStrategy(url) {
        const isPageHttps = window.location.protocol === 'https:';
        const isStreamHttp = url.startsWith('http:');
        const isStreamHttps = url.startsWith('https:');
        
        if (isPageHttps && isStreamHttp) {
            // HTTPS page + HTTP stream = MUST use proxy
            return {
                needsProxy: true,
                reason: "Mixed Content (HTTPS page, HTTP stream)",
                startProxy: url.includes('.ts') ? 1 : 1  // corsproxy for .ts, allorigins for others
            };
        } else if (isPageHttps && isStreamHttps) {
            // HTTPS page + HTTPS stream = Try direct first
            return {
                needsProxy: false,
                reason: "Secure connection (HTTPS page, HTTPS stream)",
                startProxy: 0
            };
        } else {
            // HTTP page or any other case
            return {
                needsProxy: false,
                reason: "HTTP page or direct stream",
                startProxy: 0
            };
        }
    }

    function tryNextEngine(url) {
        playerWrapper.innerHTML = "";
        
        // Check for YouTube
        if (isYouTubeUrl(url)) {
            const videoId = extractYouTubeVideoId(url);
            if (videoId) {
                playYouTubeVideo(videoId);
                return;
            }
        }
        
        // Determine proxy strategy
        const strategy = getMixedContentStrategy(url);
        
        let finalUrl = url;
        
        // Apply proxy if needed and not already applied
        if (strategy.needsProxy && currentProxyIndex === 0) {
            console.warn(`Mixed content detected: ${strategy.reason}. Forcing proxy...`);
            currentProxyIndex = strategy.startProxy;
        }
        
        if (currentProxyIndex > 0) {
            finalUrl = proxies[currentProxyIndex] + encodeURIComponent(url);
            console.log(`Using Proxy ${currentProxyIndex}: ${proxies[currentProxyIndex].substring(0, 30)}...`);
        }

        const currentEngine = engines[engineIndex];
        console.log(`Attempt ${failureCount + 1}/${maxFailures}: Engine=${currentEngine}, Proxy=${currentProxyIndex}, URL=${url.substring(0, 40)}...`);

        // Determine stream type
        const isM3U8 = url.includes('.m3u8');
        const isTS = url.includes('.ts');
        const isMPD = url.includes('.mpd');
        const isHlsSource = currentEngine === 'hls' || isM3U8 || isTS;

        if (isHlsSource) {
            if (currentEngine === 'clappr') {
                tryClappr(finalUrl);
            } else if (typeof Hls !== 'undefined' && Hls.isSupported() && currentEngine === 'hls') {
                tryHlsJs(finalUrl, isTS);
            } else {
                tryNativeVideo(finalUrl);
            }
        } else if (currentEngine === 'dash' || isMPD) {
            tryShaka(finalUrl);
        } else {
            tryNativeVideo(finalUrl);
        }
    }

    function tryHlsJs(url, isTS = false) {
        playerWrapper.innerHTML = '<video id="video-player" class="pro-video" controls autoplay playsinline crossorigin="anonymous"></video>';
        const video = document.getElementById('video-player');
        
        const hls = new Hls(proConfig.hlsConfig);
        
        hls.loadSource(url);
        hls.attachMedia(video);

        hls.on(Hls.Events.MANIFEST_PARSED, () => {
            console.log("HLS Manifest parsed successfully");
            video.play().catch(() => console.log("Autoplay blocked"));
            hideLoading();
        });

        hls.on(Hls.Events.ERROR, (event, data) => {
            console.error("HLS Error:", data.type, data.details);
            
            if (data.fatal) {
                hls.destroy();
                if (isTS) {
                    console.log("HLS failed for .ts, trying native...");
                    tryNativeVideo(url);
                } else {
                    handleFailure();
                }
            }
        });
    }

    function tryNativeVideo(url) {
        const isTS = url.includes('.ts');
        const typeStr = isTS ? 'type="video/mp2t"' : 'type="application/x-mpegURL"';
        
        playerWrapper.innerHTML = `<video id="video-player" class="pro-video" controls autoplay playsinline crossorigin="anonymous"><source src="${url}" ${typeStr}><source src="${url}" type="video/mp4"></video>`;
        const video = document.getElementById('video-player');

        let playAttempted = false;
        
        video.oncanplay = () => {
            console.log("Native video can play");
            if (!playAttempted) {
                playAttempted = true;
                video.play().catch(() => {});
                hideLoading();
            }
        };

        video.onerror = () => {
            console.error("Native Video Error");
            handleFailure();
        };
    }

    function tryClappr(url) {
        if (typeof Clappr !== 'undefined') {
            playerWrapper.innerHTML = '<div id="clappr-player" style="width:100%; height:100%;"></div>';
            const player = new Clappr.Player({
                source: url,
                parentId: "#clappr-player",
                width: '100%',
                height: '100%',
                autoPlay: true,
                playback: {
                    hlsjsConfig: proConfig.hlsConfig
                },
                events: {
                    onReady: () => {
                        console.log("Clappr Ready");
                        hideLoading();
                    },
                    onError: (e) => {
                        console.error("Clappr Error", e);
                        handleFailure();
                    }
                }
            });
        } else {
            handleFailure();
        }
    }

    function tryShaka(url) {
        playerWrapper.innerHTML = '<video id="video-player" class="pro-video" controls autoplay playsinline></video>';
        const video = document.getElementById('video-player');
        
        if (typeof shaka !== 'undefined') {
            const player = new shaka.Player(video);
            player.load(url).then(() => {
                console.log("Shaka player loaded successfully");
                hideLoading();
            }).catch((e) => {
                console.error("Shaka Error", e);
                handleFailure();
            });
        } else {
            handleFailure();
        }
    }

    function handleFailure() {
        failureCount++;
        console.log(`Failure #${failureCount}/${maxFailures} at Engine: ${engines[engineIndex]}, Proxy: ${currentProxyIndex}`);
        
        if (failureCount >= maxFailures) {
            console.error("All playback engines and proxies failed for URL:", streamUrl);
            showError("Stream unavailable. This might be due to a broken link, geo-blocking, or stream being offline. Try another channel or check your internet connection.");
            return;
        }
        
        // Strategy: Try all proxies first, then move to next engine
        if (currentProxyIndex < proxies.length - 1) {
            currentProxyIndex++;
            console.log(`Switching to proxy ${currentProxyIndex}/${proxies.length - 1}...`);
            setTimeout(() => tryNextEngine(streamUrl), 200);
        } 
        else if (engineIndex < engines.length - 1) {
            engineIndex++;
            currentProxyIndex = 0;
            console.log(`Switching to engine ${engineIndex}/${engines.length - 1}...`);
            setTimeout(() => tryNextEngine(streamUrl), 200);
        } 
        else {
            showError("All playback methods exhausted. Stream is not accessible from your location or device.");
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
