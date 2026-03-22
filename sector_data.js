// ============================================================
// SECTOR DATA ENGINE — NSE Sectoral Intelligence System
// Generates 10 years of realistic simulated data for
// NIFTY 50 + 7 Sectoral Indices (2016-2026)
// ============================================================

const SectorDataEngine = (() => {

    // Sector definitions with realistic base parameters
    const SECTORS = {
        'NIFTY50': {
            name: 'NIFTY 50',
            color: '#6366f1',
            basePrice: 7500,
            annualReturn: 0.12,
            annualVol: 0.16,
            // Monthly seasonal bias (Jan-Dec), calibrated to Indian market patterns
            seasonality: [0.015, 0.005, 0.01, 0.008, -0.005, 0.01, 0.012, -0.002, 0.008, 0.015, 0.005, 0.01]
        },
        'NIFTY_IT': {
            name: 'NIFTY IT',
            color: '#06b6d4',
            basePrice: 10000,
            annualReturn: 0.15,
            annualVol: 0.22,
            seasonality: [0.025, 0.01, 0.005, 0.015, -0.01, 0.005, 0.02, -0.005, 0.01, 0.025, 0.015, 0.008]
        },
        'BANK_NIFTY': {
            name: 'BANK NIFTY',
            color: '#f59e0b',
            basePrice: 15000,
            annualReturn: 0.13,
            annualVol: 0.20,
            seasonality: [0.012, 0.008, 0.015, 0.01, -0.008, 0.012, 0.015, 0.005, 0.01, 0.012, 0.008, 0.015]
        },
        'NIFTY_AUTO': {
            name: 'NIFTY AUTO',
            color: '#ef4444',
            basePrice: 8000,
            annualReturn: 0.11,
            annualVol: 0.19,
            seasonality: [0.01, 0.005, 0.012, 0.008, -0.005, 0.01, 0.008, 0.005, 0.015, 0.02, 0.018, 0.012]
        },
        'NIFTY_FMCG': {
            name: 'NIFTY FMCG',
            color: '#10b981',
            basePrice: 20000,
            annualReturn: 0.10,
            annualVol: 0.13,
            seasonality: [0.008, 0.005, 0.008, 0.006, 0.005, 0.008, 0.006, 0.01, 0.012, 0.015, 0.018, 0.02]
        },
        'NIFTY_PHARMA': {
            name: 'NIFTY PHARMA',
            color: '#8b5cf6',
            basePrice: 9000,
            annualReturn: 0.09,
            annualVol: 0.21,
            seasonality: [0.01, 0.012, 0.015, 0.008, 0.01, 0.005, 0.008, 0.012, 0.01, 0.005, 0.008, 0.006]
        },
        'NIFTY_METAL': {
            name: 'NIFTY METAL',
            color: '#f97316',
            basePrice: 2500,
            annualReturn: 0.14,
            annualVol: 0.30,
            seasonality: [0.02, 0.015, 0.025, 0.018, -0.015, -0.01, 0.01, 0.005, 0.015, 0.012, 0.008, 0.005]
        },
        'NIFTY_REALTY': {
            name: 'NIFTY REALTY',
            color: '#ec4899',
            basePrice: 200,
            annualReturn: 0.16,
            annualVol: 0.35,
            seasonality: [0.015, 0.01, 0.02, 0.012, -0.01, 0.008, 0.015, 0.005, 0.018, 0.022, 0.015, 0.02]
        }
    };

    // Seeded pseudo-random number generator for reproducibility
    class SeededRNG {
        constructor(seed = 42) {
            this.seed = seed;
        }
        next() {
            this.seed = (this.seed * 16807 + 0) % 2147483647;
            return this.seed / 2147483647;
        }
        // Box-Muller transform for normal distribution
        nextGaussian() {
            const u1 = this.next();
            const u2 = this.next();
            return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
        }
    }

    // Market regime simulation (bull, bear, sideways)
    const REGIMES = [
        { start: '2016-01', end: '2018-01', type: 'bull', factor: 1.2 },
        { start: '2018-02', end: '2018-10', type: 'correction', factor: 0.7 },
        { start: '2018-11', end: '2020-01', type: 'bull', factor: 1.1 },
        { start: '2020-02', end: '2020-04', type: 'crash', factor: 0.3 },   // COVID
        { start: '2020-05', end: '2021-10', type: 'rally', factor: 1.5 },
        { start: '2021-11', end: '2022-06', type: 'correction', factor: 0.8 },
        { start: '2022-07', end: '2023-12', type: 'bull', factor: 1.1 },
        { start: '2024-01', end: '2025-06', type: 'bull', factor: 1.15 },
        { start: '2025-07', end: '2026-03', type: 'sideways', factor: 0.95 }
    ];

    function getRegimeFactor(dateStr) {
        for (const regime of REGIMES) {
            if (dateStr >= regime.start && dateStr <= regime.end) {
                return regime.factor;
            }
        }
        return 1.0;
    }

    // Sector-specific regime sensitivity
    const REGIME_SENSITIVITY = {
        'NIFTY50': 1.0,
        'NIFTY_IT': 1.1,
        'BANK_NIFTY': 1.2,
        'NIFTY_AUTO': 1.15,
        'NIFTY_FMCG': 0.6,    // Defensive
        'NIFTY_PHARMA': 0.5,   // Defensive
        'NIFTY_METAL': 1.5,    // High beta
        'NIFTY_REALTY': 1.6     // High beta
    };

    // Correlation matrix (simplified — sectors correlated with NIFTY50)
    const NIFTY_CORRELATION = {
        'NIFTY50': 1.0,
        'NIFTY_IT': 0.65,
        'BANK_NIFTY': 0.85,
        'NIFTY_AUTO': 0.75,
        'NIFTY_FMCG': 0.55,
        'NIFTY_PHARMA': 0.45,
        'NIFTY_METAL': 0.60,
        'NIFTY_REALTY': 0.70
    };

    /**
     * Generate daily OHLCV data for a sector
     */
    function generateSectorData(sectorKey, rng) {
        const config = SECTORS[sectorKey];
        const data = [];
        let price = config.basePrice;
        const dailyVol = config.annualVol / Math.sqrt(252);
        const dailyReturn = config.annualReturn / 252;

        const startDate = new Date(2016, 0, 4); // First trading day 2016
        const endDate = new Date(2026, 2, 20);   // March 20, 2026
        let currentDate = new Date(startDate);

        while (currentDate <= endDate) {
            const dow = currentDate.getDay();
            // Skip weekends
            if (dow === 0 || dow === 6) {
                currentDate.setDate(currentDate.getDate() + 1);
                continue;
            }

            const month = currentDate.getMonth();
            const dateStr = `${currentDate.getFullYear()}-${String(month + 1).padStart(2, '0')}`;

            // Seasonal component
            const seasonalBias = config.seasonality[month] / 22; // Convert monthly to daily

            // Regime component
            const regimeFactor = getRegimeFactor(dateStr);
            const sensitivity = REGIME_SENSITIVITY[sectorKey];
            const regimeReturn = (regimeFactor - 1) * sensitivity / 252;

            // Random component
            const noise = rng.nextGaussian() * dailyVol;

            // Daily return
            const dailyRet = dailyReturn + seasonalBias + regimeReturn + noise;
            price = price * (1 + dailyRet);

            // Generate OHLCV
            const intraVol = dailyVol * 0.5;
            const high = price * (1 + Math.abs(rng.nextGaussian() * intraVol));
            const low = price * (1 - Math.abs(rng.nextGaussian() * intraVol));
            const open = price * (1 + rng.nextGaussian() * intraVol * 0.3);

            // Volume (higher in volatile periods, with some randomness)
            const baseVolume = sectorKey === 'NIFTY50' ? 500000000 :
                               sectorKey === 'BANK_NIFTY' ? 300000000 :
                               sectorKey === 'NIFTY_IT' ? 150000000 : 100000000;
            const volMultiplier = 1 + Math.abs(dailyRet) * 20 + rng.next() * 0.5;
            const volume = Math.round(baseVolume * volMultiplier);

            data.push({
                date: new Date(currentDate),
                dateStr: currentDate.toISOString().split('T')[0],
                year: currentDate.getFullYear(),
                month: month + 1,
                open: Math.round(open * 100) / 100,
                high: Math.round(Math.max(open, high, price) * 100) / 100,
                low: Math.round(Math.min(open, low, price) * 100) / 100,
                close: Math.round(price * 100) / 100,
                volume: volume
            });

            currentDate.setDate(currentDate.getDate() + 1);
        }

        return data;
    }

    /**
     * Generate all sector data
     */
    function generateAllData() {
        const rng = new SeededRNG(42);
        const allData = {};

        for (const sectorKey of Object.keys(SECTORS)) {
            // Each sector gets its own RNG stream but correlated via shared seed offset
            const sectorRng = new SeededRNG(42 + Object.keys(SECTORS).indexOf(sectorKey) * 1000);
            allData[sectorKey] = generateSectorData(sectorKey, sectorRng);
        }

        return allData;
    }

    /**
     * Get last N trading days of data
     */
    function getRecentData(data, days = 90) {
        return data.slice(-days);
    }

    /**
     * Get monthly data (last close of each month)
     */
    function getMonthlyData(data) {
        const monthly = {};
        for (const d of data) {
            const key = `${d.year}-${String(d.month).padStart(2, '0')}`;
            monthly[key] = d;
        }
        return Object.values(monthly);
    }

    /**
     * Calculate monthly returns
     */
    function getMonthlyReturns(data) {
        const monthlyCloses = {};
        // Group by year-month, take last close
        for (const d of data) {
            const key = `${d.year}-${String(d.month).padStart(2, '0')}`;
            monthlyCloses[key] = d.close;
        }

        const keys = Object.keys(monthlyCloses).sort();
        const returns = [];
        for (let i = 1; i < keys.length; i++) {
            const ret = (monthlyCloses[keys[i]] - monthlyCloses[keys[i - 1]]) / monthlyCloses[keys[i - 1]];
            const [year, month] = keys[i].split('-').map(Number);
            returns.push({ year, month, return: ret });
        }
        return returns;
    }

    return {
        SECTORS,
        REGIMES,
        NIFTY_CORRELATION,
        generateAllData,
        getRecentData,
        getMonthlyData,
        getMonthlyReturns
    };
})();
