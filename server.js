// ============================================================
// SERVER — NSE Sectoral Intelligence System
// Express + Direct Yahoo Finance API + Local JSON Cache
// Run: npm start → opens at http://localhost:3000
// ============================================================

const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// ── Yahoo Finance Sector Symbols ──
const SECTOR_SYMBOLS = {
    'NIFTY50':      '^NSEI',
    'NIFTY_IT':     '^CNXIT',
    'BANK_NIFTY':   '^NSEBANK',
    'NIFTY_AUTO':   '^CNXAUTO',
    'NIFTY_FMCG':   '^CNXFMCG',
    'NIFTY_PHARMA':  '^CNXPHARMA',
    'NIFTY_METAL':   '^CNXMETAL',
    'NIFTY_REALTY':  '^CNXREALTY'
};

// ── Cache Config ──
const CACHE_DIR = path.join(__dirname, 'data_cache');
const CACHE_FILE = path.join(CACHE_DIR, 'sector_data.json');
const CACHE_META_FILE = path.join(CACHE_DIR, 'cache_meta.json');
const CACHE_DURATION_MS = 4 * 60 * 60 * 1000; // 4 hours

if (!fs.existsSync(CACHE_DIR)) {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
}

// ── Serve static files ──
app.use(express.static(__dirname));
app.use(express.json({ limit: '10mb' }));

// Learning data file
const LEARNING_FILE = path.join(CACHE_DIR, 'learning_history.json');

// ── API: Get sector data ──
app.get('/api/sector-data', async (req, res) => {
    try {
        const forceRefresh = req.query.refresh === 'true';
        const data = await getSectorData(forceRefresh);
        res.json({
            success: true,
            data: data.sectors,
            meta: data.meta,
            source: data.source
        });
    } catch (error) {
        console.error('Error:', error.message);
        const fallback = getFallbackData();
        res.json({
            success: true,
            data: fallback.sectors,
            meta: fallback.meta,
            source: 'fallback'
        });
    }
});

// ── API: Force refresh ──
app.get('/api/refresh', async (req, res) => {
    try {
        console.log('🔄 Manual refresh triggered...');
        const data = await fetchAllSectors();
        saveCache(data);
        res.json({ success: true, message: 'Data refreshed', meta: data.meta });
    } catch (error) {
        res.json({ success: false, message: error.message });
    }
});

// ── API: Cache status ──
app.get('/api/status', (req, res) => {
    const meta = getCacheMeta();
    const now = Date.now();
    res.json({
        hasCachedData: !!meta,
        lastFetch: meta?.lastFetch || null,
        lastFetchTime: meta?.lastFetchTime || null,
        ageMinutes: meta ? Math.round((now - meta.lastFetch) / 60000) : null,
        isStale: meta ? (now - meta.lastFetch > CACHE_DURATION_MS) : true,
        source: meta?.source || 'none',
        symbolsFetched: meta?.symbolsFetched || 0
    });
});

// ── API: Self-Learning Data ──
app.get('/api/learning', (req, res) => {
    try {
        if (fs.existsSync(LEARNING_FILE)) {
            const data = JSON.parse(fs.readFileSync(LEARNING_FILE, 'utf-8'));
            res.json({ success: true, data });
        } else {
            res.json({ success: true, data: null });
        }
    } catch (error) {
        res.json({ success: false, message: error.message });
    }
});

app.post('/api/learning', (req, res) => {
    try {
        fs.writeFileSync(LEARNING_FILE, JSON.stringify(req.body, null, 2));
        console.log('🧠 Learning data saved');
        res.json({ success: true });
    } catch (error) {
        res.json({ success: false, message: error.message });
    }
});


// ─────────────────────────────────────────────
// YAHOO FINANCE DIRECT API
// ─────────────────────────────────────────────

/**
 * Fetch historical chart data directly from Yahoo Finance API
 * Uses the v8/finance/chart endpoint — no npm package needed
 */
async function fetchYahooChart(symbol, years = 10) {
    const now = Math.floor(Date.now() / 1000);
    const period1 = now - (years * 365.25 * 24 * 60 * 60);

    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}` +
        `?period1=${Math.floor(period1)}&period2=${now}&interval=1d&includeAdjustedClose=true`;

    const response = await fetch(url, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'application/json'
        }
    });

    if (!response.ok) {
        throw new Error(`HTTP ${response.status} for ${symbol}`);
    }

    const json = await response.json();
    const result = json?.chart?.result?.[0];

    if (!result || !result.timestamp) {
        throw new Error(`No data returned for ${symbol}`);
    }

    const timestamps = result.timestamp;
    const quotes = result.indicators?.quote?.[0];
    const adjClose = result.indicators?.adjclose?.[0]?.adjclose;

    if (!quotes) throw new Error(`No quote data for ${symbol}`);

    const data = [];
    for (let i = 0; i < timestamps.length; i++) {
        const date = new Date(timestamps[i] * 1000);
        const close = quotes.close?.[i];
        const open = quotes.open?.[i];
        const high = quotes.high?.[i];
        const low = quotes.low?.[i];
        const volume = quotes.volume?.[i];

        // Skip null/invalid entries
        if (close == null || isNaN(close)) continue;

        data.push({
            date: date.toISOString(),
            dateStr: date.toISOString().split('T')[0],
            year: date.getFullYear(),
            month: date.getMonth() + 1,
            open: round2(open ?? close),
            high: round2(high ?? close),
            low: round2(low ?? close),
            close: round2(adjClose?.[i] ?? close),
            volume: volume || 0
        });
    }

    return data;
}

/**
 * Fetch all sectors
 */
async function fetchAllSectors() {
    const sectors = {};
    let successCount = 0;

    console.log('\n🌐 Fetching live data from Yahoo Finance...\n');

    for (const [sectorKey, symbol] of Object.entries(SECTOR_SYMBOLS)) {
        try {
            console.log(`  📊 Fetching ${sectorKey} (${symbol})...`);
            const data = await fetchYahooChart(symbol);

            if (data.length > 0) {
                sectors[sectorKey] = data;
                successCount++;
                console.log(`  ✅ ${sectorKey}: ${data.length} data points (${data[0].dateStr} → ${data[data.length - 1].dateStr})`);
            }

            // Small delay to be respectful to Yahoo's API
            await sleep(300);
        } catch (err) {
            console.error(`  ❌ ${sectorKey} failed: ${err.message}`);
        }
    }

    if (successCount === 0) {
        throw new Error('Failed to fetch data for any sector');
    }

    const meta = {
        lastFetch: Date.now(),
        lastFetchTime: new Date().toISOString(),
        source: 'yahoo_finance',
        symbolsFetched: successCount,
        totalSymbols: Object.keys(SECTOR_SYMBOLS).length,
        dataPoints: Object.fromEntries(
            Object.entries(sectors).map(([k, v]) => [k, v.length])
        )
    };

    console.log(`\n✅ Fetched ${successCount}/${Object.keys(SECTOR_SYMBOLS).length} sectors successfully\n`);

    return { sectors, meta, source: 'live' };
}


// ─────────────────────────────────────────────
// DATA RETRIEVAL (Cache → Live → Fallback)
// ─────────────────────────────────────────────

async function getSectorData(forceRefresh = false) {
    if (!forceRefresh) {
        const cached = getCache();
        if (cached) {
            console.log('📦 Serving from cache (age: ' +
                Math.round((Date.now() - cached.meta.lastFetch) / 60000) + ' min)');
            return cached;
        }
    }

    try {
        const data = await fetchAllSectors();
        saveCache(data);
        return data;
    } catch (error) {
        console.error('❌ Live fetch failed:', error.message);
        const staleCache = getCache(true);
        if (staleCache) {
            console.log('⚠️ Serving stale cache...');
            staleCache.source = 'stale_cache';
            return staleCache;
        }
        throw error;
    }
}


// ─────────────────────────────────────────────
// CACHING
// ─────────────────────────────────────────────

function getCache(allowStale = false) {
    try {
        if (!fs.existsSync(CACHE_FILE) || !fs.existsSync(CACHE_META_FILE)) return null;

        const meta = JSON.parse(fs.readFileSync(CACHE_META_FILE, 'utf-8'));
        const age = Date.now() - meta.lastFetch;

        if (!allowStale && age > CACHE_DURATION_MS) {
            console.log('📦 Cache is stale (' + Math.round(age / 60000) + ' min old)');
            return null;
        }

        const sectors = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf-8'));
        return { sectors, meta, source: 'cache' };
    } catch (error) {
        console.error('Cache read error:', error.message);
        return null;
    }
}

function saveCache(data) {
    try {
        fs.writeFileSync(CACHE_FILE, JSON.stringify(data.sectors));
        fs.writeFileSync(CACHE_META_FILE, JSON.stringify(data.meta, null, 2));
        console.log('💾 Data cached to disk');
    } catch (error) {
        console.error('Cache write error:', error.message);
    }
}

function getCacheMeta() {
    try {
        if (!fs.existsSync(CACHE_META_FILE)) return null;
        return JSON.parse(fs.readFileSync(CACHE_META_FILE, 'utf-8'));
    } catch { return null; }
}


// ─────────────────────────────────────────────
// FALLBACK
// ─────────────────────────────────────────────

function getFallbackData() {
    return {
        sectors: {},
        meta: {
            lastFetch: Date.now(),
            lastFetchTime: new Date().toISOString(),
            source: 'simulated_fallback',
            symbolsFetched: 0,
            note: 'Yahoo Finance unavailable. Using simulated data engine in browser.'
        },
        source: 'fallback'
    };
}


// ─────────────────────────────────────────────
// UTILS
// ─────────────────────────────────────────────

function round2(n) {
    return n != null ? Math.round(n * 100) / 100 : 0;
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}


// ─────────────────────────────────────────────
// START SERVER
// ─────────────────────────────────────────────

app.listen(PORT, () => {
    console.log(`
╔══════════════════════════════════════════════════════════╗
║   📊 Sectoral Intelligence System                       ║
║   NSE India · AI-Powered Sector Rotation Analysis        ║
║                                                          ║
║   🌐 Dashboard: http://localhost:${PORT}                    ║
║   📡 API:       http://localhost:${PORT}/api/sector-data    ║
║   🔄 Refresh:   http://localhost:${PORT}/api/refresh        ║
║   📋 Status:    http://localhost:${PORT}/api/status          ║
║                                                          ║
║   Press Ctrl+C to stop                                   ║
╚══════════════════════════════════════════════════════════╝
    `);

    // Auto-fetch on first start
    console.log('🚀 Fetching initial data...');
    getSectorData().then(data => {
        console.log(`✅ Ready! Source: ${data.source}`);
        console.log(`   Open http://localhost:${PORT} in your browser\n`);
    }).catch(err => {
        console.log(`⚠️ Live data unavailable (${err.message}). Dashboard will use simulated data.\n`);
    });
});
