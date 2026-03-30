// ============================================================
// STOCK UNIVERSE — NSE Sectoral Intelligence System
// Pre-curated fundamental & institutional data for ~80 stocks
// Data sources: BSE/NSE filings, Annual Reports, SEBI data
// ============================================================

const StockUniverse = (() => {

    // ─────────────────────────────────────────────
    // DATA VALIDATION METADATA
    // ─────────────────────────────────────────────
    const DATA_META = {
        lastResearchUpdate: '2026-03-25',
        dataConfidence: 'moderate',
        limitations: [
            'Fundamental data is pre-curated from public filings (not real-time)',
            'FII/DII holdings are from latest available quarterly filings',
            'P/E ratios may lag by 1-2 weeks',
            'Promoter holding changes are quarter-on-quarter',
            'Technical data (price/volume) is LIVE from Yahoo Finance'
        ],
        liveData: ['Price', 'Volume', 'OHLCV', 'Moving Averages', 'RSI', 'MACD'],
        curatedData: ['ROE', 'ROCE', 'D/E', 'Revenue Growth', 'P/E', 'FII/DII Holdings', 'Promoter Holding']
    };

    // ─────────────────────────────────────────────
    // MACRO ENVIRONMENT PROFILE
    // ─────────────────────────────────────────────
    const MACRO_PROFILE = {
        regime: 'Sideways',  // Bullish | Bearish | Sideways | Transition
        regimeConfidence: 65,
        keyDrivers: [
            'RBI maintaining repo rate at 6.25% — neutral to slightly accommodative',
            'CPI inflation moderating to ~4.5%, within RBI comfort zone',
            'GDP growth steady at ~6.5% — resilient domestic demand',
            'Global uncertainty: US tariff concerns, Fed holding rates',
            'Crude oil range-bound ($70-80) — manageable for India',
            'INR stable but under mild pressure from FII outflows',
            'FII net sellers in recent months; DIIs absorbing supply'
        ],
        forwardOutlook: 'Market likely range-bound with stock-specific opportunities. Rate-sensitive sectors may benefit from potential rate cuts in H2. Export-linked sectors face headwinds from global slowdown fears. Domestic consumption themes remain resilient.',
        rbiStance: 'Neutral to accommodative',
        cpiTrend: 'Moderating (~4.5%)',
        gdpOutlook: '6.5% growth',
        liquidityCondition: 'Adequate',
        globalCues: 'Mixed — US tariff uncertainty, stable crude',
        lastUpdated: '2026-03-25'
    };

    // ─────────────────────────────────────────────
    // STOCK DATABASE
    // ─────────────────────────────────────────────
    // Each stock has: ticker, name, sector, yahooSymbol,
    // fundamentals, institutional holdings, macro sensitivity

    const STOCKS = {

        // ═══════════════════════════════════════════
        // NIFTY IT
        // ═══════════════════════════════════════════
        'TCS': {
            name: 'Tata Consultancy Services', sector: 'NIFTY_IT', yahooSymbol: 'TCS.NS',
            marketCap: 'Large', moat: 'scale',
            fundamentals: {
                roe: 47, roce: 60, debtEquity: 0.05, revenueGrowth: 8.5, profitGrowth: 9,
                pe: 28, sectorAvgPe: 30, cashFlowPositive: true, profitMargin: 19,
                promoterHolding: 72.3, promoterChange: 0
            },
            institutional: {
                fiiHolding: 12.8, fiiChange: -0.3, fiiTrend: 'decreasing',
                diiHolding: 10.2, diiChange: 0.4, diiTrend: 'increasing'
            },
            macroSensitivity: ['export_linked', 'usd_positive', 'global_demand'],
            sectorPosition: 'market_leader', qualityTier: 'premium'
        },
        'INFY': {
            name: 'Infosys', sector: 'NIFTY_IT', yahooSymbol: 'INFY.NS',
            marketCap: 'Large', moat: 'brand',
            fundamentals: {
                roe: 32, roce: 40, debtEquity: 0.08, revenueGrowth: 7, profitGrowth: 8,
                pe: 26, sectorAvgPe: 30, cashFlowPositive: true, profitMargin: 17,
                promoterHolding: 14.8, promoterChange: 0
            },
            institutional: {
                fiiHolding: 34.5, fiiChange: -0.5, fiiTrend: 'decreasing',
                diiHolding: 18.2, diiChange: 0.6, diiTrend: 'increasing'
            },
            macroSensitivity: ['export_linked', 'usd_positive', 'global_demand'],
            sectorPosition: 'market_leader', qualityTier: 'premium'
        },
        'WIPRO': {
            name: 'Wipro', sector: 'NIFTY_IT', yahooSymbol: 'WIPRO.NS',
            marketCap: 'Large', moat: 'scale',
            fundamentals: {
                roe: 16, roce: 18, debtEquity: 0.2, revenueGrowth: 3, profitGrowth: 2,
                pe: 24, sectorAvgPe: 30, cashFlowPositive: true, profitMargin: 12,
                promoterHolding: 72.9, promoterChange: -0.1
            },
            institutional: {
                fiiHolding: 7.5, fiiChange: -0.2, fiiTrend: 'decreasing',
                diiHolding: 9.8, diiChange: 0.1, diiTrend: 'stable'
            },
            macroSensitivity: ['export_linked', 'usd_positive'],
            sectorPosition: 'challenger', qualityTier: 'standard'
        },
        'HCLTECH': {
            name: 'HCL Technologies', sector: 'NIFTY_IT', yahooSymbol: 'HCLTECH.NS',
            marketCap: 'Large', moat: 'technology',
            fundamentals: {
                roe: 24, roce: 28, debtEquity: 0.05, revenueGrowth: 12, profitGrowth: 11,
                pe: 27, sectorAvgPe: 30, cashFlowPositive: true, profitMargin: 17,
                promoterHolding: 60.8, promoterChange: 0
            },
            institutional: {
                fiiHolding: 20.5, fiiChange: 0.3, fiiTrend: 'increasing',
                diiHolding: 13.1, diiChange: 0.2, diiTrend: 'increasing'
            },
            macroSensitivity: ['export_linked', 'usd_positive', 'global_demand'],
            sectorPosition: 'market_leader', qualityTier: 'premium'
        },
        'TECHM': {
            name: 'Tech Mahindra', sector: 'NIFTY_IT', yahooSymbol: 'TECHM.NS',
            marketCap: 'Large', moat: 'telecom_expertise',
            fundamentals: {
                roe: 14, roce: 16, debtEquity: 0.1, revenueGrowth: 5, profitGrowth: 15,
                pe: 35, sectorAvgPe: 30, cashFlowPositive: true, profitMargin: 9,
                promoterHolding: 35.2, promoterChange: 0
            },
            institutional: {
                fiiHolding: 25.8, fiiChange: -0.4, fiiTrend: 'decreasing',
                diiHolding: 15.3, diiChange: 0.5, diiTrend: 'increasing'
            },
            macroSensitivity: ['export_linked', 'usd_positive', 'telecom_linked'],
            sectorPosition: 'challenger', qualityTier: 'standard'
        },
        'LTIM': {
            name: 'LTIMindtree', sector: 'NIFTY_IT', yahooSymbol: 'LTIM.NS',
            marketCap: 'Large', moat: 'scale',
            fundamentals: {
                roe: 27, roce: 33, debtEquity: 0.06, revenueGrowth: 14, profitGrowth: 12,
                pe: 32, sectorAvgPe: 30, cashFlowPositive: true, profitMargin: 15,
                promoterHolding: 68.6, promoterChange: 0
            },
            institutional: {
                fiiHolding: 13.5, fiiChange: 0.2, fiiTrend: 'increasing',
                diiHolding: 11.8, diiChange: 0.3, diiTrend: 'increasing'
            },
            macroSensitivity: ['export_linked', 'usd_positive', 'global_demand'],
            sectorPosition: 'challenger', qualityTier: 'premium'
        },
        'PERSISTENT': {
            name: 'Persistent Systems', sector: 'NIFTY_IT', yahooSymbol: 'PERSISTENT.NS',
            marketCap: 'Mid', moat: 'technology',
            fundamentals: {
                roe: 25, roce: 30, debtEquity: 0.04, revenueGrowth: 22, profitGrowth: 25,
                pe: 55, sectorAvgPe: 30, cashFlowPositive: true, profitMargin: 14,
                promoterHolding: 31.2, promoterChange: 0
            },
            institutional: {
                fiiHolding: 22.1, fiiChange: 0.5, fiiTrend: 'increasing',
                diiHolding: 18.5, diiChange: 0.4, diiTrend: 'increasing'
            },
            macroSensitivity: ['export_linked', 'usd_positive'],
            sectorPosition: 'niche_leader', qualityTier: 'premium'
        },
        'COFORGE': {
            name: 'Coforge', sector: 'NIFTY_IT', yahooSymbol: 'COFORGE.NS',
            marketCap: 'Mid', moat: 'domain_expertise',
            fundamentals: {
                roe: 26, roce: 28, debtEquity: 0.3, revenueGrowth: 18, profitGrowth: 20,
                pe: 45, sectorAvgPe: 30, cashFlowPositive: true, profitMargin: 11,
                promoterHolding: 0, promoterChange: 0
            },
            institutional: {
                fiiHolding: 40.2, fiiChange: 0.8, fiiTrend: 'increasing',
                diiHolding: 25.1, diiChange: 0.3, diiTrend: 'increasing'
            },
            macroSensitivity: ['export_linked', 'usd_positive'],
            sectorPosition: 'niche_leader', qualityTier: 'standard'
        },
        'MPHASIS': {
            name: 'Mphasis', sector: 'NIFTY_IT', yahooSymbol: 'MPHASIS.NS',
            marketCap: 'Mid', moat: 'cloud_expertise',
            fundamentals: {
                roe: 22, roce: 26, debtEquity: 0.12, revenueGrowth: 10, profitGrowth: 11,
                pe: 30, sectorAvgPe: 30, cashFlowPositive: true, profitMargin: 13,
                promoterHolding: 55.6, promoterChange: 0
            },
            institutional: {
                fiiHolding: 18.3, fiiChange: -0.2, fiiTrend: 'stable',
                diiHolding: 14.2, diiChange: 0.1, diiTrend: 'stable'
            },
            macroSensitivity: ['export_linked', 'usd_positive', 'bfsi_linked'],
            sectorPosition: 'niche_player', qualityTier: 'standard'
        },

        // ═══════════════════════════════════════════
        // BANK NIFTY
        // ═══════════════════════════════════════════
        'HDFCBANK': {
            name: 'HDFC Bank', sector: 'BANK_NIFTY', yahooSymbol: 'HDFCBANK.NS',
            marketCap: 'Large', moat: 'brand',
            fundamentals: {
                roe: 16, roce: 16, debtEquity: 6.5, revenueGrowth: 18, profitGrowth: 20,
                pe: 19, sectorAvgPe: 14, cashFlowPositive: true, profitMargin: 28,
                promoterHolding: 0, promoterChange: 0
            },
            institutional: {
                fiiHolding: 53.2, fiiChange: -1.2, fiiTrend: 'decreasing',
                diiHolding: 22.5, diiChange: 1.0, diiTrend: 'increasing'
            },
            macroSensitivity: ['rate_sensitive', 'domestic_demand', 'credit_growth'],
            sectorPosition: 'market_leader', qualityTier: 'premium',
            note: 'D/E high is normal for banks — evaluate via NPA, NIM instead'
        },
        'ICICIBANK': {
            name: 'ICICI Bank', sector: 'BANK_NIFTY', yahooSymbol: 'ICICIBANK.NS',
            marketCap: 'Large', moat: 'scale',
            fundamentals: {
                roe: 18, roce: 17, debtEquity: 6.2, revenueGrowth: 22, profitGrowth: 28,
                pe: 18, sectorAvgPe: 14, cashFlowPositive: true, profitMargin: 30,
                promoterHolding: 0, promoterChange: 0
            },
            institutional: {
                fiiHolding: 45.8, fiiChange: -0.8, fiiTrend: 'decreasing',
                diiHolding: 25.3, diiChange: 0.9, diiTrend: 'increasing'
            },
            macroSensitivity: ['rate_sensitive', 'domestic_demand', 'credit_growth'],
            sectorPosition: 'market_leader', qualityTier: 'premium'
        },
        'SBIN': {
            name: 'State Bank of India', sector: 'BANK_NIFTY', yahooSymbol: 'SBIN.NS',
            marketCap: 'Large', moat: 'scale',
            fundamentals: {
                roe: 20, roce: 18, debtEquity: 5.8, revenueGrowth: 16, profitGrowth: 22,
                pe: 10, sectorAvgPe: 14, cashFlowPositive: true, profitMargin: 18,
                promoterHolding: 57.5, promoterChange: 0
            },
            institutional: {
                fiiHolding: 11.2, fiiChange: -0.5, fiiTrend: 'decreasing',
                diiHolding: 24.8, diiChange: 0.6, diiTrend: 'increasing'
            },
            macroSensitivity: ['rate_sensitive', 'domestic_demand', 'govt_linked'],
            sectorPosition: 'market_leader', qualityTier: 'premium'
        },
        'KOTAKBANK': {
            name: 'Kotak Mahindra Bank', sector: 'BANK_NIFTY', yahooSymbol: 'KOTAKBANK.NS',
            marketCap: 'Large', moat: 'brand',
            fundamentals: {
                roe: 14, roce: 14, debtEquity: 5.5, revenueGrowth: 14, profitGrowth: 16,
                pe: 22, sectorAvgPe: 14, cashFlowPositive: true, profitMargin: 25,
                promoterHolding: 26, promoterChange: -0.5
            },
            institutional: {
                fiiHolding: 38.5, fiiChange: -1.0, fiiTrend: 'decreasing',
                diiHolding: 18.2, diiChange: 0.8, diiTrend: 'increasing'
            },
            macroSensitivity: ['rate_sensitive', 'domestic_demand'],
            sectorPosition: 'market_leader', qualityTier: 'premium'
        },
        'AXISBANK': {
            name: 'Axis Bank', sector: 'BANK_NIFTY', yahooSymbol: 'AXISBANK.NS',
            marketCap: 'Large', moat: 'scale',
            fundamentals: {
                roe: 17, roce: 16, debtEquity: 6.0, revenueGrowth: 20, profitGrowth: 25,
                pe: 13, sectorAvgPe: 14, cashFlowPositive: true, profitMargin: 22,
                promoterHolding: 0, promoterChange: 0
            },
            institutional: {
                fiiHolding: 50.1, fiiChange: -0.6, fiiTrend: 'decreasing',
                diiHolding: 20.5, diiChange: 0.5, diiTrend: 'increasing'
            },
            macroSensitivity: ['rate_sensitive', 'domestic_demand', 'credit_growth'],
            sectorPosition: 'challenger', qualityTier: 'premium'
        },
        'INDUSINDBK': {
            name: 'IndusInd Bank', sector: 'BANK_NIFTY', yahooSymbol: 'INDUSINDBK.NS',
            marketCap: 'Large', moat: 'niche_lending',
            fundamentals: {
                roe: 14, roce: 14, debtEquity: 6.8, revenueGrowth: 12, profitGrowth: 10,
                pe: 10, sectorAvgPe: 14, cashFlowPositive: true, profitMargin: 15,
                promoterHolding: 16.5, promoterChange: -0.2
            },
            institutional: {
                fiiHolding: 35.2, fiiChange: -2.0, fiiTrend: 'decreasing',
                diiHolding: 28.1, diiChange: 1.5, diiTrend: 'increasing'
            },
            macroSensitivity: ['rate_sensitive', 'vehicle_finance'],
            sectorPosition: 'challenger', qualityTier: 'standard'
        },
        'FEDERALBNK': {
            name: 'Federal Bank', sector: 'BANK_NIFTY', yahooSymbol: 'FEDERALBNK.NS',
            marketCap: 'Mid', moat: 'regional_presence',
            fundamentals: {
                roe: 14, roce: 13, debtEquity: 5.5, revenueGrowth: 18, profitGrowth: 20,
                pe: 10, sectorAvgPe: 14, cashFlowPositive: true, profitMargin: 16,
                promoterHolding: 0, promoterChange: 0
            },
            institutional: {
                fiiHolding: 28.5, fiiChange: 0.5, fiiTrend: 'increasing',
                diiHolding: 22.3, diiChange: 0.3, diiTrend: 'increasing'
            },
            macroSensitivity: ['rate_sensitive', 'domestic_demand'],
            sectorPosition: 'niche_player', qualityTier: 'standard'
        },
        'PNB': {
            name: 'Punjab National Bank', sector: 'BANK_NIFTY', yahooSymbol: 'PNB.NS',
            marketCap: 'Mid', moat: 'govt_backing',
            fundamentals: {
                roe: 10, roce: 10, debtEquity: 6.0, revenueGrowth: 14, profitGrowth: 35,
                pe: 8, sectorAvgPe: 14, cashFlowPositive: true, profitMargin: 10,
                promoterHolding: 73.2, promoterChange: 0
            },
            institutional: {
                fiiHolding: 4.5, fiiChange: -0.3, fiiTrend: 'decreasing',
                diiHolding: 15.2, diiChange: 0.2, diiTrend: 'stable'
            },
            macroSensitivity: ['rate_sensitive', 'govt_linked', 'npa_exposure'],
            sectorPosition: 'laggard', qualityTier: 'value'
        },
        'BANKBARODA': {
            name: 'Bank of Baroda', sector: 'BANK_NIFTY', yahooSymbol: 'BANKBARODA.NS',
            marketCap: 'Mid', moat: 'govt_backing',
            fundamentals: {
                roe: 16, roce: 15, debtEquity: 5.5, revenueGrowth: 15, profitGrowth: 18,
                pe: 7, sectorAvgPe: 14, cashFlowPositive: true, profitMargin: 14,
                promoterHolding: 63.9, promoterChange: 0
            },
            institutional: {
                fiiHolding: 8.2, fiiChange: 0.3, fiiTrend: 'increasing',
                diiHolding: 18.5, diiChange: 0.4, diiTrend: 'increasing'
            },
            macroSensitivity: ['rate_sensitive', 'govt_linked'],
            sectorPosition: 'challenger', qualityTier: 'value'
        },
        'AUBANK': {
            name: 'AU Small Finance Bank', sector: 'BANK_NIFTY', yahooSymbol: 'AUBANK.NS',
            marketCap: 'Mid', moat: 'niche_lending',
            fundamentals: {
                roe: 14, roce: 14, debtEquity: 5.0, revenueGrowth: 25, profitGrowth: 22,
                pe: 28, sectorAvgPe: 14, cashFlowPositive: true, profitMargin: 16,
                promoterHolding: 26.2, promoterChange: 0
            },
            institutional: {
                fiiHolding: 18.5, fiiChange: 0.4, fiiTrend: 'increasing',
                diiHolding: 25.1, diiChange: 0.3, diiTrend: 'increasing'
            },
            macroSensitivity: ['rate_sensitive', 'sme_lending', 'rural_india'],
            sectorPosition: 'niche_leader', qualityTier: 'growth'
        },

        // ═══════════════════════════════════════════
        // NIFTY AUTO
        // ═══════════════════════════════════════════
        'M_M': {
            name: 'Mahindra & Mahindra', sector: 'NIFTY_AUTO', yahooSymbol: 'M&M.NS',
            marketCap: 'Large', moat: 'brand',
            fundamentals: {
                roe: 18, roce: 16, debtEquity: 0.6, revenueGrowth: 20, profitGrowth: 35,
                pe: 30, sectorAvgPe: 25, cashFlowPositive: true, profitMargin: 10,
                promoterHolding: 19.3, promoterChange: 0
            },
            institutional: {
                fiiHolding: 38.2, fiiChange: 0.5, fiiTrend: 'increasing',
                diiHolding: 22.8, diiChange: 0.3, diiTrend: 'increasing'
            },
            macroSensitivity: ['domestic_demand', 'rural_india', 'ev_transition'],
            sectorPosition: 'market_leader', qualityTier: 'premium'
        },
        'TATAMOTORS': {
            name: 'Tata Motors', sector: 'NIFTY_AUTO', yahooSymbol: 'TATAMOTORS.NS',
            marketCap: 'Large', moat: 'brand',
            fundamentals: {
                roe: 22, roce: 14, debtEquity: 0.9, revenueGrowth: 18, profitGrowth: 40,
                pe: 8, sectorAvgPe: 25, cashFlowPositive: true, profitMargin: 7,
                promoterHolding: 46.4, promoterChange: 0
            },
            institutional: {
                fiiHolding: 18.5, fiiChange: -0.8, fiiTrend: 'decreasing',
                diiHolding: 16.2, diiChange: 0.5, diiTrend: 'increasing'
            },
            macroSensitivity: ['global_demand', 'commodity_linked', 'ev_transition', 'jlr_exposure'],
            sectorPosition: 'market_leader', qualityTier: 'turnaround'
        },
        'MARUTI': {
            name: 'Maruti Suzuki', sector: 'NIFTY_AUTO', yahooSymbol: 'MARUTI.NS',
            marketCap: 'Large', moat: 'scale',
            fundamentals: {
                roe: 15, roce: 18, debtEquity: 0.02, revenueGrowth: 14, profitGrowth: 22,
                pe: 28, sectorAvgPe: 25, cashFlowPositive: true, profitMargin: 9,
                promoterHolding: 56.3, promoterChange: 0
            },
            institutional: {
                fiiHolding: 22.1, fiiChange: 0.2, fiiTrend: 'stable',
                diiHolding: 15.5, diiChange: 0.1, diiTrend: 'stable'
            },
            macroSensitivity: ['domestic_demand', 'fuel_prices', 'rural_india'],
            sectorPosition: 'market_leader', qualityTier: 'premium'
        },
        'BAJAJ_AUTO': {
            name: 'Bajaj Auto', sector: 'NIFTY_AUTO', yahooSymbol: 'BAJAJ-AUTO.NS',
            marketCap: 'Large', moat: 'brand',
            fundamentals: {
                roe: 28, roce: 35, debtEquity: 0.01, revenueGrowth: 16, profitGrowth: 18,
                pe: 32, sectorAvgPe: 25, cashFlowPositive: true, profitMargin: 17,
                promoterHolding: 54.2, promoterChange: 0
            },
            institutional: {
                fiiHolding: 13.5, fiiChange: 0.3, fiiTrend: 'increasing',
                diiHolding: 15.8, diiChange: 0.2, diiTrend: 'increasing'
            },
            macroSensitivity: ['export_linked', 'domestic_demand', 'rural_india'],
            sectorPosition: 'market_leader', qualityTier: 'premium'
        },
        'HEROMOTOCO': {
            name: 'Hero MotoCorp', sector: 'NIFTY_AUTO', yahooSymbol: 'HEROMOTOCO.NS',
            marketCap: 'Large', moat: 'distribution',
            fundamentals: {
                roe: 22, roce: 28, debtEquity: 0.01, revenueGrowth: 12, profitGrowth: 15,
                pe: 24, sectorAvgPe: 25, cashFlowPositive: true, profitMargin: 10,
                promoterHolding: 34.6, promoterChange: 0
            },
            institutional: {
                fiiHolding: 30.2, fiiChange: -0.3, fiiTrend: 'stable',
                diiHolding: 18.5, diiChange: 0.2, diiTrend: 'stable'
            },
            macroSensitivity: ['domestic_demand', 'rural_india', 'fuel_prices'],
            sectorPosition: 'market_leader', qualityTier: 'standard'
        },
        'EICHERMOT': {
            name: 'Eicher Motors', sector: 'NIFTY_AUTO', yahooSymbol: 'EICHERMOT.NS',
            marketCap: 'Large', moat: 'brand',
            fundamentals: {
                roe: 24, roce: 30, debtEquity: 0.01, revenueGrowth: 15, profitGrowth: 20,
                pe: 32, sectorAvgPe: 25, cashFlowPositive: true, profitMargin: 22,
                promoterHolding: 49.2, promoterChange: 0
            },
            institutional: {
                fiiHolding: 22.5, fiiChange: 0.4, fiiTrend: 'increasing',
                diiHolding: 14.3, diiChange: 0.2, diiTrend: 'increasing'
            },
            macroSensitivity: ['domestic_demand', 'premium_consumption'],
            sectorPosition: 'niche_leader', qualityTier: 'premium'
        },
        'TVSMOTOR': {
            name: 'TVS Motor', sector: 'NIFTY_AUTO', yahooSymbol: 'TVSMOTOR.NS',
            marketCap: 'Large', moat: 'innovation',
            fundamentals: {
                roe: 25, roce: 22, debtEquity: 0.5, revenueGrowth: 18, profitGrowth: 22,
                pe: 50, sectorAvgPe: 25, cashFlowPositive: true, profitMargin: 7,
                promoterHolding: 50.3, promoterChange: 0
            },
            institutional: {
                fiiHolding: 20.8, fiiChange: 0.6, fiiTrend: 'increasing',
                diiHolding: 12.5, diiChange: 0.3, diiTrend: 'increasing'
            },
            macroSensitivity: ['domestic_demand', 'export_linked', 'ev_transition'],
            sectorPosition: 'challenger', qualityTier: 'growth'
        },
        'ASHOKLEY': {
            name: 'Ashok Leyland', sector: 'NIFTY_AUTO', yahooSymbol: 'ASHOKLEY.NS',
            marketCap: 'Mid', moat: 'scale',
            fundamentals: {
                roe: 22, roce: 20, debtEquity: 0.8, revenueGrowth: 14, profitGrowth: 18,
                pe: 22, sectorAvgPe: 25, cashFlowPositive: true, profitMargin: 7,
                promoterHolding: 51.5, promoterChange: 0
            },
            institutional: {
                fiiHolding: 18.2, fiiChange: -0.5, fiiTrend: 'decreasing',
                diiHolding: 16.8, diiChange: 0.3, diiTrend: 'increasing'
            },
            macroSensitivity: ['domestic_demand', 'infra_spending', 'cv_cycle'],
            sectorPosition: 'market_leader', qualityTier: 'cyclical'
        },

        // ═══════════════════════════════════════════
        // NIFTY FMCG
        // ═══════════════════════════════════════════
        'HINDUNILVR': {
            name: 'Hindustan Unilever', sector: 'NIFTY_FMCG', yahooSymbol: 'HINDUNILVR.NS',
            marketCap: 'Large', moat: 'brand',
            fundamentals: {
                roe: 38, roce: 50, debtEquity: 0.3, revenueGrowth: 5, profitGrowth: 4,
                pe: 55, sectorAvgPe: 45, cashFlowPositive: true, profitMargin: 17,
                promoterHolding: 61.9, promoterChange: 0
            },
            institutional: {
                fiiHolding: 14.2, fiiChange: -0.3, fiiTrend: 'decreasing',
                diiHolding: 10.5, diiChange: 0.2, diiTrend: 'stable'
            },
            macroSensitivity: ['domestic_demand', 'rural_india', 'commodity_input'],
            sectorPosition: 'market_leader', qualityTier: 'premium'
        },
        'ITC': {
            name: 'ITC Limited', sector: 'NIFTY_FMCG', yahooSymbol: 'ITC.NS',
            marketCap: 'Large', moat: 'distribution',
            fundamentals: {
                roe: 28, roce: 36, debtEquity: 0.01, revenueGrowth: 10, profitGrowth: 12,
                pe: 25, sectorAvgPe: 45, cashFlowPositive: true, profitMargin: 27,
                promoterHolding: 0, promoterChange: 0
            },
            institutional: {
                fiiHolding: 42.5, fiiChange: -0.5, fiiTrend: 'decreasing',
                diiHolding: 28.2, diiChange: 0.4, diiTrend: 'increasing'
            },
            macroSensitivity: ['domestic_demand', 'rural_india', 'tobacco_regulation'],
            sectorPosition: 'market_leader', qualityTier: 'value'
        },
        'NESTLEIND': {
            name: 'Nestle India', sector: 'NIFTY_FMCG', yahooSymbol: 'NESTLEIND.NS',
            marketCap: 'Large', moat: 'brand',
            fundamentals: {
                roe: 108, roce: 85, debtEquity: 0.6, revenueGrowth: 8, profitGrowth: 10,
                pe: 70, sectorAvgPe: 45, cashFlowPositive: true, profitMargin: 15,
                promoterHolding: 87.8, promoterChange: 0
            },
            institutional: {
                fiiHolding: 5.2, fiiChange: -0.1, fiiTrend: 'stable',
                diiHolding: 3.8, diiChange: 0.1, diiTrend: 'stable'
            },
            macroSensitivity: ['domestic_demand', 'commodity_input'],
            sectorPosition: 'niche_leader', qualityTier: 'premium'
        },
        'BRITANNIA': {
            name: 'Britannia Industries', sector: 'NIFTY_FMCG', yahooSymbol: 'BRITANNIA.NS',
            marketCap: 'Large', moat: 'brand',
            fundamentals: {
                roe: 55, roce: 45, debtEquity: 0.8, revenueGrowth: 8, profitGrowth: 12,
                pe: 55, sectorAvgPe: 45, cashFlowPositive: true, profitMargin: 14,
                promoterHolding: 50.6, promoterChange: 0
            },
            institutional: {
                fiiHolding: 18.5, fiiChange: 0.2, fiiTrend: 'stable',
                diiHolding: 14.1, diiChange: 0.1, diiTrend: 'stable'
            },
            macroSensitivity: ['domestic_demand', 'commodity_input', 'rural_india'],
            sectorPosition: 'market_leader', qualityTier: 'premium'
        },
        'DABUR': {
            name: 'Dabur India', sector: 'NIFTY_FMCG', yahooSymbol: 'DABUR.NS',
            marketCap: 'Large', moat: 'brand',
            fundamentals: {
                roe: 22, roce: 24, debtEquity: 0.15, revenueGrowth: 7, profitGrowth: 6,
                pe: 48, sectorAvgPe: 45, cashFlowPositive: true, profitMargin: 16,
                promoterHolding: 67.2, promoterChange: 0
            },
            institutional: {
                fiiHolding: 15.8, fiiChange: -0.3, fiiTrend: 'decreasing',
                diiHolding: 8.5, diiChange: 0.1, diiTrend: 'stable'
            },
            macroSensitivity: ['domestic_demand', 'rural_india'],
            sectorPosition: 'challenger', qualityTier: 'standard'
        },
        'GODREJCP': {
            name: 'Godrej Consumer Products', sector: 'NIFTY_FMCG', yahooSymbol: 'GODREJCP.NS',
            marketCap: 'Large', moat: 'brand',
            fundamentals: {
                roe: 18, roce: 16, debtEquity: 0.3, revenueGrowth: 6, profitGrowth: 8,
                pe: 50, sectorAvgPe: 45, cashFlowPositive: true, profitMargin: 14,
                promoterHolding: 63.2, promoterChange: 0
            },
            institutional: {
                fiiHolding: 15.2, fiiChange: -0.2, fiiTrend: 'stable',
                diiHolding: 10.8, diiChange: 0.1, diiTrend: 'stable'
            },
            macroSensitivity: ['domestic_demand', 'emerging_markets', 'commodity_input'],
            sectorPosition: 'challenger', qualityTier: 'standard'
        },
        'MARICO': {
            name: 'Marico', sector: 'NIFTY_FMCG', yahooSymbol: 'MARICO.NS',
            marketCap: 'Large', moat: 'brand',
            fundamentals: {
                roe: 38, roce: 42, debtEquity: 0.05, revenueGrowth: 5, profitGrowth: 8,
                pe: 50, sectorAvgPe: 45, cashFlowPositive: true, profitMargin: 18,
                promoterHolding: 59.6, promoterChange: 0
            },
            institutional: {
                fiiHolding: 22.5, fiiChange: 0.3, fiiTrend: 'increasing',
                diiHolding: 8.2, diiChange: 0.1, diiTrend: 'stable'
            },
            macroSensitivity: ['domestic_demand', 'commodity_input', 'copra_prices'],
            sectorPosition: 'niche_leader', qualityTier: 'standard'
        },
        'TATACONSUM': {
            name: 'Tata Consumer Products', sector: 'NIFTY_FMCG', yahooSymbol: 'TATACONSUM.NS',
            marketCap: 'Large', moat: 'brand',
            fundamentals: {
                roe: 8, roce: 10, debtEquity: 0.2, revenueGrowth: 12, profitGrowth: 14,
                pe: 65, sectorAvgPe: 45, cashFlowPositive: true, profitMargin: 10,
                promoterHolding: 34.7, promoterChange: 0
            },
            institutional: {
                fiiHolding: 22.1, fiiChange: -0.4, fiiTrend: 'decreasing',
                diiHolding: 18.5, diiChange: 0.5, diiTrend: 'increasing'
            },
            macroSensitivity: ['domestic_demand', 'commodity_input', 'distribution_expansion'],
            sectorPosition: 'challenger', qualityTier: 'growth'
        },

        // ═══════════════════════════════════════════
        // NIFTY PHARMA
        // ═══════════════════════════════════════════
        'SUNPHARMA': {
            name: 'Sun Pharmaceutical', sector: 'NIFTY_PHARMA', yahooSymbol: 'SUNPHARMA.NS',
            marketCap: 'Large', moat: 'scale',
            fundamentals: {
                roe: 16, roce: 18, debtEquity: 0.15, revenueGrowth: 12, profitGrowth: 18,
                pe: 38, sectorAvgPe: 32, cashFlowPositive: true, profitMargin: 18,
                promoterHolding: 54.5, promoterChange: 0
            },
            institutional: {
                fiiHolding: 18.2, fiiChange: 0.3, fiiTrend: 'increasing',
                diiHolding: 14.5, diiChange: 0.2, diiTrend: 'increasing'
            },
            macroSensitivity: ['export_linked', 'usd_positive', 'usfda_risk'],
            sectorPosition: 'market_leader', qualityTier: 'premium'
        },
        'DRREDDY': {
            name: 'Dr Reddys Laboratories', sector: 'NIFTY_PHARMA', yahooSymbol: 'DRREDDY.NS',
            marketCap: 'Large', moat: 'rd_pipeline',
            fundamentals: {
                roe: 18, roce: 20, debtEquity: 0.1, revenueGrowth: 14, profitGrowth: 16,
                pe: 20, sectorAvgPe: 32, cashFlowPositive: true, profitMargin: 16,
                promoterHolding: 26.7, promoterChange: 0
            },
            institutional: {
                fiiHolding: 22.8, fiiChange: 0.5, fiiTrend: 'increasing',
                diiHolding: 20.1, diiChange: 0.3, diiTrend: 'increasing'
            },
            macroSensitivity: ['export_linked', 'usd_positive', 'usfda_risk'],
            sectorPosition: 'market_leader', qualityTier: 'premium'
        },
        'CIPLA': {
            name: 'Cipla', sector: 'NIFTY_PHARMA', yahooSymbol: 'CIPLA.NS',
            marketCap: 'Large', moat: 'brand',
            fundamentals: {
                roe: 16, roce: 19, debtEquity: 0.05, revenueGrowth: 10, profitGrowth: 25,
                pe: 28, sectorAvgPe: 32, cashFlowPositive: true, profitMargin: 16,
                promoterHolding: 33.5, promoterChange: 0
            },
            institutional: {
                fiiHolding: 24.5, fiiChange: -0.2, fiiTrend: 'stable',
                diiHolding: 22.8, diiChange: 0.3, diiTrend: 'increasing'
            },
            macroSensitivity: ['domestic_demand', 'export_linked', 'respiratory_therapy'],
            sectorPosition: 'market_leader', qualityTier: 'premium'
        },
        'DIVISLAB': {
            name: 'Divis Laboratories', sector: 'NIFTY_PHARMA', yahooSymbol: 'DIVISLAB.NS',
            marketCap: 'Large', moat: 'technology',
            fundamentals: {
                roe: 15, roce: 18, debtEquity: 0.01, revenueGrowth: 8, profitGrowth: 10,
                pe: 50, sectorAvgPe: 32, cashFlowPositive: true, profitMargin: 28,
                promoterHolding: 51.9, promoterChange: 0
            },
            institutional: {
                fiiHolding: 17.8, fiiChange: -0.5, fiiTrend: 'decreasing',
                diiHolding: 16.2, diiChange: 0.2, diiTrend: 'stable'
            },
            macroSensitivity: ['export_linked', 'api_demand', 'china_plus_one'],
            sectorPosition: 'niche_leader', qualityTier: 'premium'
        },
        'APOLLOHOSP': {
            name: 'Apollo Hospitals', sector: 'NIFTY_PHARMA', yahooSymbol: 'APOLLOHOSP.NS',
            marketCap: 'Large', moat: 'brand',
            fundamentals: {
                roe: 16, roce: 14, debtEquity: 0.5, revenueGrowth: 15, profitGrowth: 22,
                pe: 70, sectorAvgPe: 32, cashFlowPositive: true, profitMargin: 8,
                promoterHolding: 29.3, promoterChange: 0
            },
            institutional: {
                fiiHolding: 35.2, fiiChange: 0.8, fiiTrend: 'increasing',
                diiHolding: 15.8, diiChange: 0.4, diiTrend: 'increasing'
            },
            macroSensitivity: ['domestic_demand', 'healthcare_spending', 'medical_tourism'],
            sectorPosition: 'market_leader', qualityTier: 'growth'
        },
        'LUPIN': {
            name: 'Lupin', sector: 'NIFTY_PHARMA', yahooSymbol: 'LUPIN.NS',
            marketCap: 'Large', moat: 'rd_pipeline',
            fundamentals: {
                roe: 18, roce: 20, debtEquity: 0.15, revenueGrowth: 12, profitGrowth: 30,
                pe: 30, sectorAvgPe: 32, cashFlowPositive: true, profitMargin: 14,
                promoterHolding: 47.0, promoterChange: 0
            },
            institutional: {
                fiiHolding: 18.5, fiiChange: 0.4, fiiTrend: 'increasing',
                diiHolding: 16.2, diiChange: 0.3, diiTrend: 'increasing'
            },
            macroSensitivity: ['export_linked', 'usd_positive', 'usfda_risk'],
            sectorPosition: 'challenger', qualityTier: 'turnaround'
        },
        'AUROPHARMA': {
            name: 'Aurobindo Pharma', sector: 'NIFTY_PHARMA', yahooSymbol: 'AUROPHARMA.NS',
            marketCap: 'Mid', moat: 'scale',
            fundamentals: {
                roe: 14, roce: 16, debtEquity: 0.3, revenueGrowth: 8, profitGrowth: 12,
                pe: 18, sectorAvgPe: 32, cashFlowPositive: true, profitMargin: 12,
                promoterHolding: 51.8, promoterChange: 0
            },
            institutional: {
                fiiHolding: 15.2, fiiChange: -0.3, fiiTrend: 'decreasing',
                diiHolding: 18.8, diiChange: 0.2, diiTrend: 'stable'
            },
            macroSensitivity: ['export_linked', 'usd_positive', 'usfda_risk'],
            sectorPosition: 'challenger', qualityTier: 'value'
        },
        'TORNTPHARM': {
            name: 'Torrent Pharmaceuticals', sector: 'NIFTY_PHARMA', yahooSymbol: 'TORNTPHARM.NS',
            marketCap: 'Mid', moat: 'branded_generics',
            fundamentals: {
                roe: 30, roce: 25, debtEquity: 0.5, revenueGrowth: 10, profitGrowth: 14,
                pe: 55, sectorAvgPe: 32, cashFlowPositive: true, profitMargin: 20,
                promoterHolding: 71.3, promoterChange: 0
            },
            institutional: {
                fiiHolding: 12.5, fiiChange: 0.2, fiiTrend: 'stable',
                diiHolding: 10.8, diiChange: 0.1, diiTrend: 'stable'
            },
            macroSensitivity: ['domestic_demand', 'chronic_therapy'],
            sectorPosition: 'niche_leader', qualityTier: 'premium'
        },
        'ZYDUSLIFE': {
            name: 'Zydus Lifesciences', sector: 'NIFTY_PHARMA', yahooSymbol: 'ZYDUSLIFE.NS',
            marketCap: 'Mid', moat: 'rd_pipeline',
            fundamentals: {
                roe: 20, roce: 22, debtEquity: 0.1, revenueGrowth: 14, profitGrowth: 20,
                pe: 22, sectorAvgPe: 32, cashFlowPositive: true, profitMargin: 18,
                promoterHolding: 75.0, promoterChange: 0
            },
            institutional: {
                fiiHolding: 10.2, fiiChange: 0.3, fiiTrend: 'increasing',
                diiHolding: 8.5, diiChange: 0.2, diiTrend: 'increasing'
            },
            macroSensitivity: ['export_linked', 'domestic_demand', 'innovation'],
            sectorPosition: 'challenger', qualityTier: 'growth'
        },

        // ═══════════════════════════════════════════
        // NIFTY METAL
        // ═══════════════════════════════════════════
        'TATASTEEL': {
            name: 'Tata Steel', sector: 'NIFTY_METAL', yahooSymbol: 'TATASTEEL.NS',
            marketCap: 'Large', moat: 'scale',
            fundamentals: {
                roe: 8, roce: 10, debtEquity: 0.8, revenueGrowth: 5, profitGrowth: -15,
                pe: 55, sectorAvgPe: 15, cashFlowPositive: true, profitMargin: 4,
                promoterHolding: 33.2, promoterChange: 0
            },
            institutional: {
                fiiHolding: 17.5, fiiChange: -0.8, fiiTrend: 'decreasing',
                diiHolding: 22.1, diiChange: 0.5, diiTrend: 'increasing'
            },
            macroSensitivity: ['commodity_linked', 'global_demand', 'china_impact', 'infra_spending'],
            sectorPosition: 'market_leader', qualityTier: 'cyclical'
        },
        'JSWSTEEL': {
            name: 'JSW Steel', sector: 'NIFTY_METAL', yahooSymbol: 'JSWSTEEL.NS',
            marketCap: 'Large', moat: 'scale',
            fundamentals: {
                roe: 12, roce: 12, debtEquity: 0.7, revenueGrowth: 8, profitGrowth: -10,
                pe: 35, sectorAvgPe: 15, cashFlowPositive: true, profitMargin: 6,
                promoterHolding: 44.8, promoterChange: 0
            },
            institutional: {
                fiiHolding: 22.5, fiiChange: -0.5, fiiTrend: 'decreasing',
                diiHolding: 18.3, diiChange: 0.4, diiTrend: 'increasing'
            },
            macroSensitivity: ['commodity_linked', 'infra_spending', 'china_impact'],
            sectorPosition: 'market_leader', qualityTier: 'cyclical'
        },
        'HINDALCO': {
            name: 'Hindalco Industries', sector: 'NIFTY_METAL', yahooSymbol: 'HINDALCO.NS',
            marketCap: 'Large', moat: 'vertical_integration',
            fundamentals: {
                roe: 12, roce: 10, debtEquity: 0.6, revenueGrowth: 10, profitGrowth: 8,
                pe: 12, sectorAvgPe: 15, cashFlowPositive: true, profitMargin: 5,
                promoterHolding: 34.6, promoterChange: 0
            },
            institutional: {
                fiiHolding: 28.5, fiiChange: 0.3, fiiTrend: 'increasing',
                diiHolding: 18.2, diiChange: 0.2, diiTrend: 'stable'
            },
            macroSensitivity: ['commodity_linked', 'global_demand', 'aluminium_prices', 'novelis_exposure'],
            sectorPosition: 'market_leader', qualityTier: 'standard'
        },
        'COALINDIA': {
            name: 'Coal India', sector: 'NIFTY_METAL', yahooSymbol: 'COALINDIA.NS',
            marketCap: 'Large', moat: 'monopoly',
            fundamentals: {
                roe: 52, roce: 62, debtEquity: 0.08, revenueGrowth: 6, profitGrowth: 5,
                pe: 7, sectorAvgPe: 15, cashFlowPositive: true, profitMargin: 25,
                promoterHolding: 63.1, promoterChange: 0
            },
            institutional: {
                fiiHolding: 8.5, fiiChange: -0.3, fiiTrend: 'decreasing',
                diiHolding: 20.2, diiChange: 0.4, diiTrend: 'increasing'
            },
            macroSensitivity: ['energy_demand', 'govt_linked', 'esg_risk'],
            sectorPosition: 'monopoly', qualityTier: 'dividend'
        },
        'VEDL': {
            name: 'Vedanta', sector: 'NIFTY_METAL', yahooSymbol: 'VEDL.NS',
            marketCap: 'Large', moat: 'diversified_commodities',
            fundamentals: {
                roe: 22, roce: 15, debtEquity: 1.2, revenueGrowth: 8, profitGrowth: 15,
                pe: 15, sectorAvgPe: 15, cashFlowPositive: true, profitMargin: 12,
                promoterHolding: 56.4, promoterChange: -2.0
            },
            institutional: {
                fiiHolding: 12.8, fiiChange: -0.5, fiiTrend: 'decreasing',
                diiHolding: 15.2, diiChange: 0.3, diiTrend: 'increasing'
            },
            macroSensitivity: ['commodity_linked', 'global_demand', 'zinc_aluminium_prices'],
            sectorPosition: 'challenger', qualityTier: 'value'
        },
        'NMDC': {
            name: 'NMDC', sector: 'NIFTY_METAL', yahooSymbol: 'NMDC.NS',
            marketCap: 'Mid', moat: 'govt_monopoly',
            fundamentals: {
                roe: 22, roce: 28, debtEquity: 0.05, revenueGrowth: 5, profitGrowth: 8,
                pe: 8, sectorAvgPe: 15, cashFlowPositive: true, profitMargin: 32,
                promoterHolding: 60.8, promoterChange: 0
            },
            institutional: {
                fiiHolding: 6.5, fiiChange: 0.2, fiiTrend: 'stable',
                diiHolding: 22.5, diiChange: 0.3, diiTrend: 'increasing'
            },
            macroSensitivity: ['iron_ore_prices', 'infra_spending', 'govt_linked'],
            sectorPosition: 'niche_leader', qualityTier: 'dividend'
        },
        'SAIL': {
            name: 'Steel Authority of India', sector: 'NIFTY_METAL', yahooSymbol: 'SAIL.NS',
            marketCap: 'Mid', moat: 'govt_backing',
            fundamentals: {
                roe: 8, roce: 10, debtEquity: 0.5, revenueGrowth: 4, profitGrowth: -20,
                pe: 18, sectorAvgPe: 15, cashFlowPositive: true, profitMargin: 5,
                promoterHolding: 65.0, promoterChange: 0
            },
            institutional: {
                fiiHolding: 5.2, fiiChange: -0.3, fiiTrend: 'decreasing',
                diiHolding: 18.5, diiChange: 0.2, diiTrend: 'stable'
            },
            macroSensitivity: ['commodity_linked', 'infra_spending', 'govt_linked'],
            sectorPosition: 'laggard', qualityTier: 'value'
        },
        'NATIONALUM': {
            name: 'National Aluminium', sector: 'NIFTY_METAL', yahooSymbol: 'NATIONALUM.NS',
            marketCap: 'Mid', moat: 'low_cost_producer',
            fundamentals: {
                roe: 18, roce: 22, debtEquity: 0.02, revenueGrowth: 6, profitGrowth: 10,
                pe: 10, sectorAvgPe: 15, cashFlowPositive: true, profitMargin: 18,
                promoterHolding: 51.3, promoterChange: 0
            },
            institutional: {
                fiiHolding: 5.8, fiiChange: 0.2, fiiTrend: 'stable',
                diiHolding: 28.5, diiChange: 0.3, diiTrend: 'increasing'
            },
            macroSensitivity: ['aluminium_prices', 'energy_costs', 'govt_linked'],
            sectorPosition: 'niche_player', qualityTier: 'dividend'
        },

        // ═══════════════════════════════════════════
        // NIFTY REALTY
        // ═══════════════════════════════════════════
        'DLF': {
            name: 'DLF', sector: 'NIFTY_REALTY', yahooSymbol: 'DLF.NS',
            marketCap: 'Large', moat: 'land_bank',
            fundamentals: {
                roe: 8, roce: 6, debtEquity: 0.2, revenueGrowth: 15, profitGrowth: 20,
                pe: 65, sectorAvgPe: 45, cashFlowPositive: true, profitMargin: 20,
                promoterHolding: 74.1, promoterChange: 0
            },
            institutional: {
                fiiHolding: 12.5, fiiChange: 0.3, fiiTrend: 'increasing',
                diiHolding: 8.2, diiChange: 0.2, diiTrend: 'increasing'
            },
            macroSensitivity: ['rate_sensitive', 'real_estate_cycle', 'luxury_demand'],
            sectorPosition: 'market_leader', qualityTier: 'premium'
        },
        'GODREJPROP': {
            name: 'Godrej Properties', sector: 'NIFTY_REALTY', yahooSymbol: 'GODREJPROP.NS',
            marketCap: 'Large', moat: 'brand',
            fundamentals: {
                roe: 8, roce: 6, debtEquity: 0.5, revenueGrowth: 22, profitGrowth: 25,
                pe: 55, sectorAvgPe: 45, cashFlowPositive: false, profitMargin: 12,
                promoterHolding: 58.5, promoterChange: 0
            },
            institutional: {
                fiiHolding: 22.5, fiiChange: 0.5, fiiTrend: 'increasing',
                diiHolding: 10.2, diiChange: 0.3, diiTrend: 'increasing'
            },
            macroSensitivity: ['rate_sensitive', 'real_estate_cycle', 'urbanization'],
            sectorPosition: 'market_leader', qualityTier: 'growth'
        },
        'OBEROIRLTY': {
            name: 'Oberoi Realty', sector: 'NIFTY_REALTY', yahooSymbol: 'OBEROIRLTY.NS',
            marketCap: 'Large', moat: 'brand',
            fundamentals: {
                roe: 12, roce: 10, debtEquity: 0.3, revenueGrowth: 18, profitGrowth: 22,
                pe: 28, sectorAvgPe: 45, cashFlowPositive: true, profitMargin: 35,
                promoterHolding: 67.7, promoterChange: 0
            },
            institutional: {
                fiiHolding: 15.8, fiiChange: 0.4, fiiTrend: 'increasing',
                diiHolding: 8.5, diiChange: 0.2, diiTrend: 'increasing'
            },
            macroSensitivity: ['rate_sensitive', 'luxury_demand', 'mumbai_real_estate'],
            sectorPosition: 'niche_leader', qualityTier: 'premium'
        },
        'PRESTIGE': {
            name: 'Prestige Estates', sector: 'NIFTY_REALTY', yahooSymbol: 'PRESTIGE.NS',
            marketCap: 'Large', moat: 'brand',
            fundamentals: {
                roe: 10, roce: 8, debtEquity: 0.8, revenueGrowth: 25, profitGrowth: 30,
                pe: 45, sectorAvgPe: 45, cashFlowPositive: true, profitMargin: 14,
                promoterHolding: 61.5, promoterChange: 0
            },
            institutional: {
                fiiHolding: 18.2, fiiChange: 0.6, fiiTrend: 'increasing',
                diiHolding: 10.5, diiChange: 0.3, diiTrend: 'increasing'
            },
            macroSensitivity: ['rate_sensitive', 'real_estate_cycle', 'south_india'],
            sectorPosition: 'challenger', qualityTier: 'growth'
        },
        'BRIGADE': {
            name: 'Brigade Enterprises', sector: 'NIFTY_REALTY', yahooSymbol: 'BRIGADE.NS',
            marketCap: 'Mid', moat: 'regional_presence',
            fundamentals: {
                roe: 12, roce: 10, debtEquity: 0.7, revenueGrowth: 20, profitGrowth: 25,
                pe: 35, sectorAvgPe: 45, cashFlowPositive: true, profitMargin: 12,
                promoterHolding: 44.8, promoterChange: 0
            },
            institutional: {
                fiiHolding: 25.2, fiiChange: 0.8, fiiTrend: 'increasing',
                diiHolding: 12.5, diiChange: 0.4, diiTrend: 'increasing'
            },
            macroSensitivity: ['rate_sensitive', 'real_estate_cycle', 'bangalore_market'],
            sectorPosition: 'niche_leader', qualityTier: 'growth'
        },
        'PHOENIXLTD': {
            name: 'Phoenix Mills', sector: 'NIFTY_REALTY', yahooSymbol: 'PHOENIXLTD.NS',
            marketCap: 'Large', moat: 'retail_assets',
            fundamentals: {
                roe: 10, roce: 8, debtEquity: 0.5, revenueGrowth: 18, profitGrowth: 22,
                pe: 48, sectorAvgPe: 45, cashFlowPositive: true, profitMargin: 30,
                promoterHolding: 47.5, promoterChange: 0
            },
            institutional: {
                fiiHolding: 30.2, fiiChange: 0.5, fiiTrend: 'increasing',
                diiHolding: 10.8, diiChange: 0.2, diiTrend: 'increasing'
            },
            macroSensitivity: ['consumption', 'retail_growth', 'urbanization'],
            sectorPosition: 'niche_leader', qualityTier: 'premium'
        },
        'SOBHA': {
            name: 'Sobha Limited', sector: 'NIFTY_REALTY', yahooSymbol: 'SOBHA.NS',
            marketCap: 'Mid', moat: 'backward_integration',
            fundamentals: {
                roe: 8, roce: 7, debtEquity: 0.6, revenueGrowth: 12, profitGrowth: 15,
                pe: 32, sectorAvgPe: 45, cashFlowPositive: true, profitMargin: 10,
                promoterHolding: 51.1, promoterChange: 0
            },
            institutional: {
                fiiHolding: 20.5, fiiChange: 0.3, fiiTrend: 'increasing',
                diiHolding: 8.2, diiChange: 0.1, diiTrend: 'stable'
            },
            macroSensitivity: ['rate_sensitive', 'real_estate_cycle', 'south_india'],
            sectorPosition: 'niche_player', qualityTier: 'standard'
        },
        'LODHA': {
            name: 'Macrotech Developers', sector: 'NIFTY_REALTY', yahooSymbol: 'LODHA.NS',
            marketCap: 'Large', moat: 'scale',
            fundamentals: {
                roe: 14, roce: 10, debtEquity: 0.8, revenueGrowth: 28, profitGrowth: 35,
                pe: 50, sectorAvgPe: 45, cashFlowPositive: true, profitMargin: 12,
                promoterHolding: 72.4, promoterChange: 0
            },
            institutional: {
                fiiHolding: 12.5, fiiChange: 0.6, fiiTrend: 'increasing',
                diiHolding: 7.8, diiChange: 0.3, diiTrend: 'increasing'
            },
            macroSensitivity: ['rate_sensitive', 'real_estate_cycle', 'mumbai_real_estate'],
            sectorPosition: 'market_leader', qualityTier: 'growth'
        }
    };

    // ─────────────────────────────────────────────
    // HELPER FUNCTIONS
    // ─────────────────────────────────────────────

    function getStocksBySector(sector) {
        return Object.entries(STOCKS)
            .filter(([_, s]) => s.sector === sector)
            .map(([key, s]) => ({ key, ...s }));
    }

    function getAllSectors() {
        const sectors = new Set(Object.values(STOCKS).map(s => s.sector));
        return [...sectors];
    }

    function getAllYahooSymbols() {
        return Object.values(STOCKS).map(s => s.yahooSymbol);
    }

    function getStockBySymbol(yahooSymbol) {
        return Object.entries(STOCKS).find(([_, s]) => s.yahooSymbol === yahooSymbol);
    }

    function getStockByKey(key) {
        return STOCKS[key] || null;
    }

    // Bank-specific: D/E filtering works differently
    function isBankingSector(sector) {
        return sector === 'BANK_NIFTY';
    }

    return {
        DATA_META,
        MACRO_PROFILE,
        STOCKS,
        getStocksBySector,
        getAllSectors,
        getAllYahooSymbols,
        getStockBySymbol,
        getStockByKey,
        isBankingSector
    };
})();

// Node.js export for server-side use
if (typeof module !== 'undefined' && module.exports) {
    module.exports = StockUniverse;
}
