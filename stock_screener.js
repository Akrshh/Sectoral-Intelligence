// ============================================================
// STOCK SCREENER ENGINE — 6-Step Institutional Process
// Macro → Sector Rotation → Fundamental Gate → Technical →
// Risk-Reward → Scoring (/40)
// ============================================================

const StockScreener = (() => {

    // ─────────────────────────────────────────────
    // STEP 1: MACRO & MARKET REGIME
    // ─────────────────────────────────────────────

    function analyzeMacro() {
        const macro = StockUniverse.MACRO_PROFILE;
        return {
            regime: macro.regime,
            regimeConfidence: macro.regimeConfidence,
            keyDrivers: macro.keyDrivers,
            forwardOutlook: macro.forwardOutlook,
            details: {
                rbiStance: macro.rbiStance,
                cpiTrend: macro.cpiTrend,
                gdpOutlook: macro.gdpOutlook,
                liquidity: macro.liquidityCondition,
                globalCues: macro.globalCues
            },
            sectorImplications: getSectorMacroImplications(macro.regime),
            lastUpdated: macro.lastUpdated
        };
    }

    function getSectorMacroImplications(regime) {
        const implications = {
            'NIFTY_IT': { bias: 'neutral', reason: 'Global slowdown fears vs INR depreciation benefit' },
            'BANK_NIFTY': { bias: 'positive', reason: 'Potential rate cuts in H2 positive for banks' },
            'NIFTY_AUTO': { bias: 'positive', reason: 'Domestic demand resilient, rural recovery' },
            'NIFTY_FMCG': { bias: 'neutral', reason: 'Defensive but slow growth, commodity input moderation' },
            'NIFTY_PHARMA': { bias: 'positive', reason: 'Defensive + export earnings, domestic healthcare demand' },
            'NIFTY_METAL': { bias: 'negative', reason: 'China slowdown, global demand uncertainty' },
            'NIFTY_REALTY': { bias: 'positive', reason: 'Rate cut expectations, strong pre-sales momentum' }
        };
        return implications;
    }

    // ─────────────────────────────────────────────
    // STEP 2: SECTOR ROTATION MODEL
    // ─────────────────────────────────────────────

    function classifySectors(rankings) {
        if (!rankings || rankings.length === 0) return {};

        const sorted = [...rankings].sort((a, b) => b.composite - a.composite);
        const total = sorted.length;

        const classified = {};
        sorted.forEach((r, idx) => {
            let category;
            const pct = idx / total;

            if (pct < 0.28) category = 'Leading';
            else if (pct < 0.57) category = 'Improving';
            else if (pct < 0.85) category = 'Weakening';
            else category = 'Lagging';

            // Override based on momentum + trend signals
            if (r.composite > 65 && r.return30d > 2) category = 'Leading';
            if (r.composite > 50 && r.return30d > 0 && r.momentum > 55) category = category === 'Lagging' ? 'Weakening' : category;
            if (r.composite < 35) category = 'Lagging';

            classified[r.sector] = {
                name: r.name,
                category,
                composite: r.composite,
                momentum: r.momentum,
                relativeStrength: r.relativeStrength,
                return30d: r.return30d,
                rank: idx + 1
            };
        });

        return classified;
    }

    function selectTopSectors(sectorClassification) {
        const leading = Object.entries(sectorClassification)
            .filter(([_, s]) => s.category === 'Leading' || s.category === 'Improving')
            .sort((a, b) => b[1].composite - a[1].composite)
            .slice(0, 3)
            .map(([key, _]) => key);
        return leading;
    }

    // ─────────────────────────────────────────────
    // STEP 3: FUNDAMENTAL GATE (Hard Filters)
    // ─────────────────────────────────────────────

    function runFundamentalGate(stockKey, stockData) {
        const f = stockData.fundamentals;
        const isBanking = StockUniverse.isBankingSector(stockData.sector);
        const inst = stockData.institutional;

        const gates = {
            roe: { value: f.roe, threshold: 15, pass: f.roe >= 15, label: 'ROE ≥ 15%' },
            roce: { value: f.roce, threshold: 15, pass: f.roce >= 15, label: 'ROCE ≥ 15%' },
            debtEquity: {
                value: f.debtEquity,
                threshold: isBanking ? 999 : 1,
                pass: isBanking ? true : f.debtEquity < 1,
                label: isBanking ? 'D/E (banking — NIM evaluated)' : 'D/E < 1'
            },
            revenueGrowth: { value: f.revenueGrowth, threshold: 10, pass: f.revenueGrowth >= 10, label: 'Rev Growth ≥ 10%' },
            cashFlow: { value: f.cashFlowPositive, threshold: true, pass: f.cashFlowPositive === true, label: 'Cash Flow Positive' },
            promoterStability: {
                value: f.promoterChange,
                threshold: 0,
                pass: f.promoterChange >= -0.5,
                label: 'Promoter Stable/Increasing'
            },
            valuation: {
                value: f.pe,
                threshold: f.sectorAvgPe * 2.5,
                pass: f.pe <= f.sectorAvgPe * 2.5,
                label: 'P/E not extreme (< 2.5x sector avg)'
            },
            // FII/DII Filter — new requirement
            institutionalInterest: {
                value: `FII: ${inst.fiiTrend}, DII: ${inst.diiTrend}`,
                threshold: 'increasing in at least one',
                pass: inst.fiiTrend === 'increasing' || inst.diiTrend === 'increasing',
                label: 'FII/DII increasing stake'
            }
        };

        const passCount = Object.values(gates).filter(g => g.pass).length;
        const totalGates = Object.keys(gates).length;
        const allCriticalPass = gates.roe.pass && gates.roce.pass && gates.debtEquity.pass && gates.cashFlow.pass;

        // Score out of 10: based on how many gates passed + quality
        let fundamentalScore = Math.round((passCount / totalGates) * 8);
        if (allCriticalPass) fundamentalScore += 1;
        if (f.profitMargin > 15) fundamentalScore += 1;
        fundamentalScore = Math.min(10, fundamentalScore);

        return {
            gates,
            passCount,
            totalGates,
            allCriticalPass,
            qualified: passCount >= 6 && allCriticalPass,
            fundamentalScore,
            reasoning: allCriticalPass ?
                `Passes critical quality gates (ROE: ${f.roe}%, ROCE: ${f.roce}%, D/E: ${f.debtEquity})` :
                `Fails critical quality gate(s)`
        };
    }

    // ─────────────────────────────────────────────
    // STEP 4: TECHNICAL & TIMING MODEL
    // ─────────────────────────────────────────────

    function runTechnicalAnalysis(priceData) {
        if (!priceData || priceData.length < 50) {
            return getDefaultTechnical();
        }

        const last = priceData[priceData.length - 1];
        const currentPrice = last.close;

        // Moving Averages
        const sma50 = calcSMA(priceData, 50);
        const sma200 = priceData.length >= 200 ? calcSMA(priceData, 200) : sma50;
        const sma20 = calcSMA(priceData, 20);

        // RSI
        const rsi = calcRSI(priceData, 14);

        // MACD
        const macd = calcMACD(priceData);

        // Trend analysis
        const aboveSMA50 = currentPrice > sma50;
        const aboveSMA200 = currentPrice > sma200;
        const goldenCross = sma50 > sma200;

        // Support / Resistance
        const support = calcSupport(priceData);
        const resistance = calcResistance(priceData);

        // Breakout detection
        const breakoutSetup = detectSetup(priceData, sma20, sma50, rsi);

        // Entry / SL / Target
        const entryRange = calcEntryRange(currentPrice, support, sma20, rsi);
        const stopLoss = calcStopLoss(currentPrice, support);
        const targets = calcTargets(currentPrice, resistance, sma50);

        // Technical Score (out of 10)
        let techScore = 0;
        if (aboveSMA50) techScore += 2;
        if (aboveSMA200) techScore += 2;
        if (goldenCross) techScore += 1;
        if (rsi > 40 && rsi < 70) techScore += 2; // Healthy range
        if (rsi < 35) techScore += 1; // Oversold opportunity
        if (macd.trend === 'bullish' || macd.trend === 'bullish_crossover') techScore += 2;
        if (breakoutSetup.type === 'breakout' || breakoutSetup.type === 'pullback') techScore += 1;
        techScore = Math.min(10, techScore);

        return {
            currentPrice,
            sma20: round2(sma20),
            sma50: round2(sma50),
            sma200: round2(sma200),
            rsi: round2(rsi),
            macd,
            aboveSMA50,
            aboveSMA200,
            goldenCross,
            support: round2(support),
            resistance: round2(resistance),
            setup: breakoutSetup,
            entryRange,
            stopLoss: round2(stopLoss),
            targets,
            technicalScore: techScore,
            trend: aboveSMA50 && aboveSMA200 ? 'Bullish' : aboveSMA50 ? 'Mildly Bullish' : 'Bearish'
        };
    }

    function getDefaultTechnical() {
        return {
            currentPrice: 0, sma20: 0, sma50: 0, sma200: 0, rsi: 50,
            macd: { trend: 'neutral', score: 50 }, aboveSMA50: false, aboveSMA200: false,
            goldenCross: false, support: 0, resistance: 0,
            setup: { type: 'insufficient_data', reason: 'Not enough OHLCV data' },
            entryRange: { low: 0, high: 0 }, stopLoss: 0,
            targets: { t1: 0, t2: 0, t3: 0 }, technicalScore: 3,
            trend: 'Unknown'
        };
    }

    // Technical helper functions
    function calcSMA(data, period) {
        if (data.length < period) return data[data.length - 1]?.close || 0;
        const slice = data.slice(-period);
        return slice.reduce((sum, d) => sum + d.close, 0) / period;
    }

    function calcRSI(data, period = 14) {
        if (data.length < period + 1) return 50;
        const changes = [];
        for (let i = data.length - period; i < data.length; i++) {
            changes.push(data[i].close - data[i - 1].close);
        }
        let avgGain = 0, avgLoss = 0;
        for (const c of changes) {
            if (c > 0) avgGain += c; else avgLoss += Math.abs(c);
        }
        avgGain /= period;
        avgLoss /= period;
        if (avgLoss === 0) return 100;
        return 100 - (100 / (1 + avgGain / avgLoss));
    }

    function calcMACD(data) {
        if (data.length < 35) return { trend: 'neutral', score: 50 };
        const fastEMA = calcEMA(data, 12);
        const slowEMA = calcEMA(data, 26);
        const macdLine = fastEMA - slowEMA;
        const prevFast = calcEMA(data.slice(0, -1), 12);
        const prevSlow = calcEMA(data.slice(0, -1), 26);
        const prevMACD = prevFast - prevSlow;

        let trend = 'neutral', score = 50;
        if (prevMACD < 0 && macdLine > 0) { trend = 'bullish_crossover'; score = 85; }
        else if (prevMACD > 0 && macdLine < 0) { trend = 'bearish_crossover'; score = 15; }
        else if (macdLine > 0) { trend = 'bullish'; score = 70; }
        else { trend = 'bearish'; score = 30; }

        return { macdLine: round2(macdLine), trend, score };
    }

    function calcEMA(data, period) {
        if (data.length < period) return data[data.length - 1]?.close || 0;
        const mult = 2 / (period + 1);
        let ema = data.slice(0, period).reduce((s, d) => s + d.close, 0) / period;
        for (let i = period; i < data.length; i++) {
            ema = (data[i].close - ema) * mult + ema;
        }
        return ema;
    }

    function calcSupport(data) {
        const recent = data.slice(-60);
        const lows = recent.map(d => d.low);
        lows.sort((a, b) => a - b);
        return lows[Math.floor(lows.length * 0.1)]; // 10th percentile low
    }

    function calcResistance(data) {
        const recent = data.slice(-60);
        const highs = recent.map(d => d.high);
        highs.sort((a, b) => b - a);
        return highs[Math.floor(highs.length * 0.1)]; // 10th percentile high
    }

    function detectSetup(data, sma20, sma50, rsi) {
        const price = data[data.length - 1].close;
        if (price > sma20 && price > sma50 && rsi > 55 && rsi < 75) {
            return { type: 'breakout', reason: 'Above key MAs with healthy RSI' };
        }
        if (price > sma50 && price < sma20 && rsi > 35 && rsi < 50) {
            return { type: 'pullback', reason: 'Pulled back to 20DMA in uptrend — buy-the-dip zone' };
        }
        if (rsi < 30) {
            return { type: 'oversold', reason: `RSI at ${round2(rsi)} — potential reversal zone` };
        }
        if (rsi > 75) {
            return { type: 'overbought', reason: `RSI at ${round2(rsi)} — wait for cooldown` };
        }
        return { type: 'neutral', reason: 'No clear setup — wait for trigger' };
    }

    function calcEntryRange(price, support, sma20, rsi) {
        const low = rsi < 40 ? support * 1.01 : Math.min(price * 0.98, sma20);
        const high = price * 1.005;
        return { low: round2(low), high: round2(high) };
    }

    function calcStopLoss(price, support) {
        const slFromSupport = support * 0.98;
        const slPercent = price * 0.93; // Max 7% SL
        return Math.max(slFromSupport, slPercent);
    }

    function calcTargets(price, resistance, sma50) {
        const risk = price - (price * 0.93);
        return {
            t1: round2(price + risk * 1.5),
            t2: round2(Math.max(resistance, price + risk * 2)),
            t3: round2(price + risk * 3)
        };
    }

    // ─────────────────────────────────────────────
    // STEP 5: RISK-REWARD & POSITION SIZING
    // ─────────────────────────────────────────────

    function calculateRiskReward(technical, portfolioCapital = 1000000) {
        if (!technical || technical.currentPrice === 0) {
            return { rrRatio: 0, positionSize: 0, riskScore: 3 };
        }

        const entry = (technical.entryRange.low + technical.entryRange.high) / 2;
        const sl = technical.stopLoss;
        const target = technical.targets.t2;

        const risk = entry - sl;
        const reward = target - entry;
        const rrRatio = risk > 0 ? round2(reward / risk) : 0;

        // Position sizing: risk 1% of capital per trade
        const riskPerShare = risk;
        const capitalRisk = portfolioCapital * 0.01;
        const shares = riskPerShare > 0 ? Math.floor(capitalRisk / riskPerShare) : 0;
        const positionValue = shares * entry;
        const positionPct = round2((positionValue / portfolioCapital) * 100);

        // Cap at 10%
        const cappedPct = Math.min(10, positionPct);

        // Risk score out of 10
        let riskScore = 0;
        if (rrRatio >= 3) riskScore = 10;
        else if (rrRatio >= 2.5) riskScore = 9;
        else if (rrRatio >= 2) riskScore = 8;
        else if (rrRatio >= 1.5) riskScore = 6;
        else if (rrRatio >= 1) riskScore = 4;
        else riskScore = 2;

        // Bonus for clean setup
        if (technical.setup.type === 'breakout' || technical.setup.type === 'pullback') riskScore = Math.min(10, riskScore + 1);

        return {
            entry: round2(entry),
            stopLoss: sl,
            target: round2(target),
            risk: round2(risk),
            reward: round2(reward),
            rrRatio,
            qualifiesMinRR: rrRatio >= 2,
            shares,
            positionValue: round2(positionValue),
            positionPct: cappedPct,
            capitalAllocation: `${cappedPct}%`,
            riskScore: Math.min(10, riskScore)
        };
    }

    // ─────────────────────────────────────────────
    // STEP 6: FINAL SCORING MODEL (/40)
    // ─────────────────────────────────────────────

    function calculateFinalScore(sectorScore, fundamentalScore, technicalScore, riskScore) {
        const total = sectorScore + fundamentalScore + technicalScore + riskScore;
        let verdict, verdictColor, verdictEmoji;

        if (total >= 34) { verdict = 'Strong Buy'; verdictColor = '#22c55e'; verdictEmoji = '🟢'; }
        else if (total >= 30) { verdict = 'Buy'; verdictColor = '#3b82f6'; verdictEmoji = '🔵'; }
        else if (total >= 24) { verdict = 'Hold'; verdictColor = '#eab308'; verdictEmoji = '🟡'; }
        else if (total >= 18) { verdict = 'Reduce'; verdictColor = '#f97316'; verdictEmoji = '🟠'; }
        else { verdict = 'Avoid'; verdictColor = '#ef4444'; verdictEmoji = '🔴'; }

        return {
            sectorScore,
            fundamentalScore,
            technicalScore,
            riskScore,
            total,
            maxScore: 40,
            qualified: total >= 30,
            verdict,
            verdictColor,
            verdictEmoji
        };
    }

    // ─────────────────────────────────────────────
    // SECTOR STRENGTH SCORE (out of 10)
    // ─────────────────────────────────────────────

    function calcSectorStrengthScore(sectorClassification, sectorKey) {
        const sector = sectorClassification[sectorKey];
        if (!sector) return 5;

        const categoryScores = { 'Leading': 9, 'Improving': 7, 'Weakening': 4, 'Lagging': 2 };
        let score = categoryScores[sector.category] || 5;

        // Boost for high composite
        if (sector.composite > 70) score = Math.min(10, score + 1);
        if (sector.return30d > 3) score = Math.min(10, score + 1);

        return Math.min(10, score);
    }

    // ─────────────────────────────────────────────
    // MASTER SCREENING FUNCTION
    // ─────────────────────────────────────────────

    function runFullScreening(sectorRankings, stockPriceData) {
        const results = {
            macro: analyzeMacro(),
            sectorClassification: {},
            topSectors: [],
            allStockAnalysis: [],
            qualifiedPicks: [],
            top3Picks: [],
            scoringTable: [],
            dataValidation: StockUniverse.DATA_META,
            timestamp: new Date().toISOString()
        };

        // Step 2: Classify sectors
        results.sectorClassification = classifySectors(sectorRankings);
        results.topSectors = selectTopSectors(results.sectorClassification);

        // Screen ALL stocks (not just top sectors — show full picture)
        const allStocks = StockUniverse.STOCKS;

        for (const [key, stock] of Object.entries(allStocks)) {
            // Step 3: Fundamental gate
            const fundGate = runFundamentalGate(key, stock);

            // Step 4: Technical analysis (from live price data if available)
            const priceData = stockPriceData?.[stock.yahooSymbol] || null;
            const technical = runTechnicalAnalysis(priceData);

            // Step 5: Risk-Reward
            const riskReward = calculateRiskReward(technical);

            // Sector Strength Score
            const sectorScore = calcSectorStrengthScore(results.sectorClassification, stock.sector);

            // Step 6: Final Score
            const finalScore = calculateFinalScore(
                sectorScore,
                fundGate.fundamentalScore,
                technical.technicalScore,
                riskReward.riskScore
            );

            const analysis = {
                key,
                name: stock.name,
                sector: stock.sector,
                sectorName: SectorDataEngine.SECTORS[stock.sector]?.name || stock.sector,
                sectorColor: SectorDataEngine.SECTORS[stock.sector]?.color || '#6366f1',
                yahooSymbol: stock.yahooSymbol,
                marketCap: stock.marketCap,
                moat: stock.moat,
                qualityTier: stock.qualityTier,
                sectorPosition: stock.sectorPosition,
                fundamentals: stock.fundamentals,
                institutional: stock.institutional,
                macroSensitivity: stock.macroSensitivity,
                fundamentalGate: fundGate,
                technical,
                riskReward,
                finalScore,
                isTopSector: results.topSectors.includes(stock.sector),
                hasLiveData: !!priceData
            };

            results.allStockAnalysis.push(analysis);
        }

        // Sort all by final score
        results.allStockAnalysis.sort((a, b) => b.finalScore.total - a.finalScore.total);

        // Filter qualified picks (score >= 30 AND fundamental gates passed)
        results.qualifiedPicks = results.allStockAnalysis.filter(s =>
            s.finalScore.qualified && s.fundamentalGate.qualified
        );

        // Top 3 highest conviction
        results.top3Picks = results.qualifiedPicks.slice(0, 3);

        // Scoring table (all stocks)
        results.scoringTable = results.allStockAnalysis.map(s => ({
            name: s.name,
            sector: s.sectorName,
            sectorScore: s.finalScore.sectorScore,
            fundamentalScore: s.finalScore.fundamentalScore,
            technicalScore: s.finalScore.technicalScore,
            riskScore: s.finalScore.riskScore,
            total: s.finalScore.total,
            verdict: s.finalScore.verdict,
            verdictEmoji: s.finalScore.verdictEmoji,
            qualified: s.finalScore.qualified
        }));

        // Portfolio concentration check
        results.portfolioCheck = checkPortfolioConcentration(results.qualifiedPicks);

        return results;
    }

    function checkPortfolioConcentration(picks) {
        const sectorExposure = {};
        picks.forEach(p => {
            sectorExposure[p.sector] = (sectorExposure[p.sector] || 0) + (p.riskReward.positionPct || 0);
        });

        const warnings = [];
        for (const [sector, pct] of Object.entries(sectorExposure)) {
            if (pct > 30) {
                warnings.push(`⚠️ ${sector} exposure at ${pct}% — exceeds 30% limit. Reduce position sizes.`);
            }
        }

        return {
            sectorExposure,
            totalPicks: picks.length,
            diversified: picks.length >= 3 && Object.keys(sectorExposure).length >= 2,
            warnings
        };
    }

    function round2(n) {
        return Math.round(n * 100) / 100;
    }

    // ─────────────────────────────────────────────
    // PUBLIC API
    // ─────────────────────────────────────────────

    return {
        analyzeMacro,
        classifySectors,
        selectTopSectors,
        runFundamentalGate,
        runTechnicalAnalysis,
        calculateRiskReward,
        calculateFinalScore,
        calcSectorStrengthScore,
        runFullScreening,
        checkPortfolioConcentration
    };
})();
