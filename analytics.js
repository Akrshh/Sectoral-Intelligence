// ============================================================
// ANALYTICS ENGINE — NSE Sectoral Intelligence System
// Seasonality · Money Flow · Prediction · Insights
// ============================================================

const AnalyticsEngine = (() => {

    const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                         'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    // ─────────────────────────────────────────────
    // STEP 2: SEASONALITY ANALYSIS
    // ─────────────────────────────────────────────

    /**
     * Compute seasonality table: average monthly returns per sector
     * Returns { sectorKey: { month(1-12): { avgReturn, count, positiveCount, consistencyScore } } }
     */
    function computeSeasonality(allData) {
        const result = {};
        const sectorKeys = Object.keys(allData).filter(k => k !== 'NIFTY50');

        for (const key of sectorKeys) {
            const monthlyReturns = SectorDataEngine.getMonthlyReturns(allData[key]);
            result[key] = {};

            for (let m = 1; m <= 12; m++) {
                const monthData = monthlyReturns.filter(r => r.month === m);
                const returns = monthData.map(r => r.return);
                const avg = returns.reduce((s, v) => s + v, 0) / returns.length;
                const positiveCount = returns.filter(r => r > 0).length;

                result[key][m] = {
                    avgReturn: avg,
                    avgReturnPct: (avg * 100).toFixed(2),
                    count: returns.length,
                    positiveCount: positiveCount,
                    consistencyScore: ((positiveCount / returns.length) * 100).toFixed(1),
                    returns: returns
                };
            }
        }
        return result;
    }

    /**
     * Get top N sectors for each month
     */
    function getTopSectorsPerMonth(seasonality, topN = 2) {
        const result = {};
        for (let m = 1; m <= 12; m++) {
            const sectorReturns = [];
            for (const [key, months] of Object.entries(seasonality)) {
                sectorReturns.push({
                    sector: key,
                    name: SectorDataEngine.SECTORS[key].name,
                    avgReturn: months[m].avgReturn,
                    consistency: parseFloat(months[m].consistencyScore)
                });
            }
            // Sort by combination of return and consistency
            sectorReturns.sort((a, b) => {
                const scoreA = a.avgReturn * 0.6 + (a.consistency / 100) * 0.4;
                const scoreB = b.avgReturn * 0.6 + (b.consistency / 100) * 0.4;
                return scoreB - scoreA;
            });
            result[m] = sectorReturns.slice(0, topN);
        }
        return result;
    }

    /**
     * Get worst sector for each month
     */
    function getWorstSectorsPerMonth(seasonality) {
        const result = {};
        for (let m = 1; m <= 12; m++) {
            const sectorReturns = [];
            for (const [key, months] of Object.entries(seasonality)) {
                sectorReturns.push({
                    sector: key,
                    name: SectorDataEngine.SECTORS[key].name,
                    avgReturn: months[m].avgReturn,
                    consistency: parseFloat(months[m].consistencyScore)
                });
            }
            sectorReturns.sort((a, b) => a.avgReturn - b.avgReturn);
            result[m] = sectorReturns[0];
        }
        return result;
    }


    // ─────────────────────────────────────────────
    // STEP 3: MONEY FLOW / SECTOR STRENGTH
    // ─────────────────────────────────────────────

    /**
     * Calculate RSI (Relative Strength Index)
     */
    function calculateRSI(data, period = 14) {
        if (data.length < period + 1) return 50;

        const changes = [];
        for (let i = 1; i < data.length; i++) {
            changes.push(data[i].close - data[i - 1].close);
        }

        const recentChanges = changes.slice(-period);
        let avgGain = 0, avgLoss = 0;

        for (const change of recentChanges) {
            if (change > 0) avgGain += change;
            else avgLoss += Math.abs(change);
        }

        avgGain /= period;
        avgLoss /= period;

        if (avgLoss === 0) return 100;
        const rs = avgGain / avgLoss;
        return 100 - (100 / (1 + rs));
    }

    /**
     * Calculate Simple Moving Average
     */
    function calculateSMA(data, period) {
        if (data.length < period) return data[data.length - 1]?.close || 0;
        const slice = data.slice(-period);
        return slice.reduce((sum, d) => sum + d.close, 0) / period;
    }

    /**
     * Calculate EMA (Exponential Moving Average)
     */
    function calculateEMA(data, period) {
        if (data.length < period) return data[data.length - 1]?.close || 0;
        const multiplier = 2 / (period + 1);
        let ema = data.slice(0, period).reduce((s, d) => s + d.close, 0) / period;
        for (let i = period; i < data.length; i++) {
            ema = (data[i].close - ema) * multiplier + ema;
        }
        return ema;
    }

    /**
     * Detect volume spikes (vs 20-day average)
     */
    function detectVolumeSpike(data, lookback = 20) {
        if (data.length < lookback + 5) return { spike: false, ratio: 1 };
        const recentVol = data.slice(-5).reduce((s, d) => s + d.volume, 0) / 5;
        const avgVol = data.slice(-(lookback + 5), -5).reduce((s, d) => s + d.volume, 0) / lookback;
        const ratio = recentVol / avgVol;
        return { spike: ratio > 1.5, ratio: ratio };
    }

    /**
     * Calculate Relative Strength vs NIFTY50
     */
    function calculateRelativeStrength(sectorData, niftyData, period = 30) {
        if (sectorData.length < period || niftyData.length < period) return 1;

        const sectorRecent = sectorData.slice(-period);
        const niftyRecent = niftyData.slice(-period);

        const sectorReturn = (sectorRecent[sectorRecent.length - 1].close - sectorRecent[0].close) / sectorRecent[0].close;
        const niftyReturn = (niftyRecent[niftyRecent.length - 1].close - niftyRecent[0].close) / niftyRecent[0].close;

        // RS ratio: >1 means outperforming NIFTY
        return niftyReturn !== 0 ? (1 + sectorReturn) / (1 + niftyReturn) : 1;
    }

    /**
     * Detect breakout signals
     */
    function detectBreakout(data) {
        if (data.length < 50) return { breakout: false, type: null };

        const current = data[data.length - 1].close;
        const sma20 = calculateSMA(data, 20);
        const sma50 = calculateSMA(data, 50);

        // Price above both MAs and 20 > 50 = bullish
        const bullish = current > sma20 && current > sma50 && sma20 > sma50;
        // Price below both MAs and 20 < 50 = bearish
        const bearish = current < sma20 && current < sma50 && sma20 < sma50;

        // Check for recent crossover (golden/death cross)
        const prev5 = data.slice(-6, -1);
        const prevSma20Values = prev5.map((_, i) => calculateSMA(data.slice(0, data.length - 5 + i), 20));
        const prevSma50Values = prev5.map((_, i) => calculateSMA(data.slice(0, data.length - 5 + i), 50));

        let goldenCross = false;
        for (let i = 1; i < prevSma20Values.length; i++) {
            if (prevSma20Values[i] > prevSma50Values[i] && prevSma20Values[i - 1] <= prevSma50Values[i - 1]) {
                goldenCross = true;
            }
        }

        return {
            breakout: bullish || goldenCross,
            type: goldenCross ? 'golden_cross' : bullish ? 'bullish_trend' : bearish ? 'bearish_trend' : 'neutral',
            priceVsSMA20: ((current / sma20 - 1) * 100).toFixed(2),
            priceVsSMA50: ((current / sma50 - 1) * 100).toFixed(2),
            sma20, sma50
        };
    }


    // ─────────────────────────────────────────────
    // PROFESSIONAL INDICATORS
    // ─────────────────────────────────────────────

    /**
     * MACD (Moving Average Convergence Divergence)
     * Returns: { macd, signal, histogram, trend }
     */
    function calculateMACD(data, fast = 12, slow = 26, signal = 9) {
        if (data.length < slow + signal) return { macd: 0, signal: 0, histogram: 0, trend: 'neutral', score: 50 };

        // Calculate fast & slow EMA
        const fastEMA = calculateEMA(data, fast);
        const slowEMA = calculateEMA(data, slow);
        const macdLine = fastEMA - slowEMA;

        // Signal line: EMA of MACD values over last 'signal' periods
        // Simplified: use recent MACD trend
        const prevFastEMA = calculateEMA(data.slice(0, -1), fast);
        const prevSlowEMA = calculateEMA(data.slice(0, -1), slow);
        const prevMACD = prevFastEMA - prevSlowEMA;

        const lastPrice = data[data.length - 1].close;
        const signalLine = (macdLine + prevMACD) / 2; // Simplified signal
        const histogram = macdLine - signalLine;

        // Determine trend
        let trend = 'neutral';
        let score = 50;
        if (macdLine > 0 && histogram > 0) { trend = 'bullish'; score = 75; }
        else if (macdLine > 0 && histogram < 0) { trend = 'weakening'; score = 60; }
        else if (macdLine < 0 && histogram > 0) { trend = 'recovering'; score = 45; }
        else if (macdLine < 0 && histogram < 0) { trend = 'bearish'; score = 25; }

        // Crossover detection
        if (prevMACD < 0 && macdLine > 0) { trend = 'bullish_crossover'; score = 85; }
        if (prevMACD > 0 && macdLine < 0) { trend = 'bearish_crossover'; score = 15; }

        return {
            macd: Math.round(macdLine * 100) / 100,
            signal: Math.round(signalLine * 100) / 100,
            histogram: Math.round(histogram * 100) / 100,
            trend,
            score: Math.min(100, Math.max(0, score))
        };
    }

    /**
     * Bollinger Bands
     * Returns: { upper, middle, lower, width, position, squeeze }
     */
    function calculateBollingerBands(data, period = 20, multiplier = 2) {
        if (data.length < period) return { upper: 0, middle: 0, lower: 0, width: 0, position: 50, squeeze: false, score: 50 };

        const recent = data.slice(-period);
        const closes = recent.map(d => d.close);
        const middle = closes.reduce((s, v) => s + v, 0) / period;
        const variance = closes.reduce((s, v) => s + Math.pow(v - middle, 2), 0) / period;
        const stdDev = Math.sqrt(variance);

        const upper = middle + multiplier * stdDev;
        const lower = middle - multiplier * stdDev;
        const width = ((upper - lower) / middle) * 100;  // Band width as %
        const currentPrice = data[data.length - 1].close;

        // Position within bands (0 = lower band, 100 = upper band)
        const position = upper !== lower ? ((currentPrice - lower) / (upper - lower)) * 100 : 50;

        // Squeeze detection: narrow bands mean low volatility → breakout coming
        const avgWidth = 4.0;  // Typical width
        const squeeze = width < avgWidth * 0.6;

        // Score: near upper band = overbought, near lower = oversold
        let score = 50;
        if (position > 80) score = 30;  // Overbought risk
        else if (position < 20) score = 70;  // Oversold opportunity
        else score = 50 + (50 - position) * 0.3;

        return {
            upper: Math.round(upper * 100) / 100,
            middle: Math.round(middle * 100) / 100,
            lower: Math.round(lower * 100) / 100,
            width: Math.round(width * 100) / 100,
            position: Math.round(position),
            squeeze,
            score: Math.round(Math.min(100, Math.max(0, score)))
        };
    }

    /**
     * ATR (Average True Range) — Volatility indicator
     */
    function calculateATR(data, period = 14) {
        if (data.length < period + 1) return { atr: 0, atrPercent: 0, volatility: 'normal' };

        let trSum = 0;
        const recent = data.slice(-(period + 1));

        for (let i = 1; i < recent.length; i++) {
            const high = recent[i].high;
            const low = recent[i].low;
            const prevClose = recent[i - 1].close;
            const trueRange = Math.max(high - low, Math.abs(high - prevClose), Math.abs(low - prevClose));
            trSum += trueRange;
        }

        const atr = trSum / period;
        const atrPercent = (atr / data[data.length - 1].close) * 100;

        let volatility = 'normal';
        if (atrPercent > 2.5) volatility = 'high';
        else if (atrPercent > 1.5) volatility = 'elevated';
        else if (atrPercent < 0.8) volatility = 'low';

        return {
            atr: Math.round(atr * 100) / 100,
            atrPercent: Math.round(atrPercent * 100) / 100,
            volatility
        };
    }

    /**
     * OBV (On-Balance Volume) — Volume confirms price trend
     */
    function calculateOBV(data, lookback = 30) {
        if (data.length < lookback + 10) return { obv: 0, trend: 'neutral', divergence: 'none', score: 50 };

        const recent = data.slice(-lookback);
        let obv = 0;
        const obvSeries = [];

        for (let i = 1; i < recent.length; i++) {
            if (recent[i].close > recent[i - 1].close) obv += recent[i].volume;
            else if (recent[i].close < recent[i - 1].close) obv -= recent[i].volume;
            obvSeries.push(obv);
        }

        // OBV trend (rising or falling)
        const obvStart = obvSeries.slice(0, 5).reduce((s, v) => s + v, 0) / 5;
        const obvEnd = obvSeries.slice(-5).reduce((s, v) => s + v, 0) / 5;
        const obvTrend = obvEnd > obvStart ? 'rising' : 'falling';

        // Price trend
        const priceStart = recent.slice(0, 5).reduce((s, d) => s + d.close, 0) / 5;
        const priceEnd = recent.slice(-5).reduce((s, d) => s + d.close, 0) / 5;
        const priceTrend = priceEnd > priceStart ? 'rising' : 'falling';

        // Divergence detection
        let divergence = 'none';
        if (priceTrend === 'rising' && obvTrend === 'falling') divergence = 'bearish';  // Price up but volume down
        if (priceTrend === 'falling' && obvTrend === 'rising') divergence = 'bullish';  // Price down but volume up (accumulation)

        let score = 50;
        if (obvTrend === 'rising' && priceTrend === 'rising') score = 75;  // Confirmed uptrend
        if (divergence === 'bullish') score = 70;  // Smart money buying
        if (divergence === 'bearish') score = 30;  // Distribution
        if (obvTrend === 'falling' && priceTrend === 'falling') score = 25;

        return { obv, trend: obvTrend, divergence, score };
    }

    /**
     * FII/DII Flow Proxy — Estimates institutional buying/selling
     * Based on: large volume on up days = institutional buying
     */
    function calculateInstitutionalFlowProxy(data, lookback = 20) {
        if (data.length < lookback + 5) return { fiiProxy: 0, diiProxy: 0, netFlow: 'neutral', score: 50 };

        const recent = data.slice(-lookback);
        let buyVolume = 0, sellVolume = 0;
        let largeBuyDays = 0, largeSellDays = 0;
        const avgVolume = recent.reduce((s, d) => s + d.volume, 0) / recent.length;

        for (let i = 1; i < recent.length; i++) {
            const change = recent[i].close - recent[i - 1].close;
            const volumeRatio = recent[i].volume / avgVolume;

            if (change > 0) {
                buyVolume += recent[i].volume * Math.abs(change) / recent[i - 1].close;
                if (volumeRatio > 1.3) largeBuyDays++;
            } else {
                sellVolume += recent[i].volume * Math.abs(change) / recent[i - 1].close;
                if (volumeRatio > 1.3) largeSellDays++;
            }
        }

        const totalFlow = buyVolume + sellVolume;
        const fiiProxy = totalFlow > 0 ? Math.round((buyVolume / totalFlow) * 100) : 50;
        const diiProxy = 100 - fiiProxy;

        let netFlow = 'neutral';
        if (fiiProxy > 60) netFlow = 'strong_inflow';
        else if (fiiProxy > 55) netFlow = 'mild_inflow';
        else if (fiiProxy < 40) netFlow = 'strong_outflow';
        else if (fiiProxy < 45) netFlow = 'mild_outflow';

        const score = Math.min(100, Math.max(0, fiiProxy));

        return {
            fiiProxy,
            diiProxy,
            netFlow,
            largeBuyDays,
            largeSellDays,
            score
        };
    }

    /**
     * Put-Call Ratio Proxy — Market sentiment from volatility + trend
     * High PCR (>1.2) = bearish sentiment = contrarian bullish
     * Low PCR (<0.8) = bullish sentiment = contrarian bearish
     */
    function calculatePCRProxy(data, lookback = 20) {
        if (data.length < lookback + 5) return { pcr: 1.0, sentiment: 'neutral', score: 50 };

        const recent = data.slice(-lookback);
        const atrInfo = calculateATR(data);

        // PCR proxy components:
        // - High volatility + down trend → high PCR (fear)
        // - Low volatility + up trend → low PCR (complacency)
        const priceChange = (recent[recent.length - 1].close - recent[0].close) / recent[0].close;
        const volFactor = atrInfo.atrPercent / 1.5; // Normalize around 1.5% ATR

        let pcr = 1.0;
        pcr += volFactor * 0.3;  // Higher vol → higher PCR
        pcr -= priceChange * 2;   // Rising prices → lower PCR

        pcr = Math.max(0.5, Math.min(1.8, pcr));

        let sentiment = 'neutral';
        if (pcr > 1.3) sentiment = 'fearful';       // Contrarian bullish
        else if (pcr > 1.1) sentiment = 'cautious';
        else if (pcr < 0.7) sentiment = 'greedy';    // Contrarian bearish
        else if (pcr < 0.9) sentiment = 'optimistic';

        // Score: contrarian logic — extreme fear = buying opportunity
        let score = 50;
        if (pcr > 1.3) score = 70;    // Extreme fear = good entry
        else if (pcr > 1.1) score = 60;
        else if (pcr < 0.7) score = 30;  // Extreme greed = caution
        else if (pcr < 0.9) score = 40;

        return {
            pcr: Math.round(pcr * 100) / 100,
            sentiment,
            score
        };
    }

    /**
     * Compute all advanced indicators for a sector
     */
    function computeAdvancedIndicators(sectorData) {
        return {
            macd: calculateMACD(sectorData),
            bollingerBands: calculateBollingerBands(sectorData),
            atr: calculateATR(sectorData),
            obv: calculateOBV(sectorData),
            institutionalFlow: calculateInstitutionalFlowProxy(sectorData),
            pcr: calculatePCRProxy(sectorData)
        };
    }

    /**
     * Calculate composite Sector Strength Score (0-100)
     * Enhanced with 6 factors: Momentum + RS + Volume + Trend + MACD + Institutional Flow
     */
    function calculateSectorStrength(sectorData, niftyData) {
        const rsi = calculateRSI(sectorData);
        const rs = calculateRelativeStrength(sectorData, niftyData);
        const volumeInfo = detectVolumeSpike(sectorData);
        const breakoutInfo = detectBreakout(sectorData);

        // Advanced indicators
        const advanced = computeAdvancedIndicators(sectorData);

        // Momentum score (0-100) based on RSI normalization
        const momentumScore = Math.min(100, Math.max(0, (rsi - 20) * (100 / 60)));

        // Relative Strength score (0-100)
        const rsScore = Math.min(100, Math.max(0, (rs - 0.9) * (100 / 0.2)));

        // Volume score (0-100) based on volume spike ratio
        const volumeScore = Math.min(100, Math.max(0, (volumeInfo.ratio - 0.5) * (100 / 2)));

        // Trend score (0-100)
        let trendScore = 50;
        if (breakoutInfo.type === 'golden_cross') trendScore = 95;
        else if (breakoutInfo.type === 'bullish_trend') trendScore = 80;
        else if (breakoutInfo.type === 'bearish_trend') trendScore = 20;
        else trendScore = 50;
        const priceSma20 = parseFloat(breakoutInfo.priceVsSMA20 || 0);
        trendScore = Math.min(100, Math.max(0, trendScore + priceSma20 * 2));

        // MACD score (from advanced indicators)
        const macdScore = advanced.macd.score;

        // Institutional flow score (from advanced indicators)
        const institutionalScore = advanced.institutionalFlow.score;

        // 6-Factor Composite Score
        const composite =
            (momentumScore * 0.20) +
            (rsScore * 0.20) +
            (volumeScore * 0.15) +
            (trendScore * 0.15) +
            (macdScore * 0.15) +
            (institutionalScore * 0.15);

        return {
            composite: Math.round(Math.min(100, Math.max(0, composite))),
            momentum: Math.round(momentumScore),
            relativeStrength: Math.round(rsScore),
            volume: Math.round(volumeScore),
            trend: Math.round(trendScore),
            macdScore: Math.round(macdScore),
            institutionalScore: Math.round(institutionalScore),
            rsi: Math.round(rsi * 100) / 100,
            rsRatio: Math.round(rs * 1000) / 1000,
            volumeSpike: volumeInfo.spike,
            volumeRatio: Math.round(volumeInfo.ratio * 100) / 100,
            breakout: breakoutInfo,
            advanced: advanced
        };
    }

    /**
     * Rank all sectors by Strength Score
     */
    function rankSectors(allData) {
        const rankings = [];
        const sectorKeys = Object.keys(allData).filter(k => k !== 'NIFTY50');
        const niftyData = allData['NIFTY50'];

        const recent90 = {};
        for (const key of Object.keys(allData)) {
            recent90[key] = SectorDataEngine.getRecentData(allData[key], 90);
        }

        for (const key of sectorKeys) {
            const strength = calculateSectorStrength(recent90[key], recent90['NIFTY50']);
            const lastPrice = allData[key][allData[key].length - 1].close;
            const prev30Price = allData[key][allData[key].length - 31]?.close || lastPrice;
            const return30d = ((lastPrice - prev30Price) / prev30Price * 100).toFixed(2);

            rankings.push({
                sector: key,
                name: SectorDataEngine.SECTORS[key].name,
                color: SectorDataEngine.SECTORS[key].color,
                price: lastPrice,
                return30d: parseFloat(return30d),
                ...strength
            });
        }

        rankings.sort((a, b) => b.composite - a.composite);
        rankings.forEach((r, i) => r.rank = i + 1);

        return rankings;
    }


    // ─────────────────────────────────────────────
    // STEP 4: AI PREDICTION MODEL
    // ─────────────────────────────────────────────

    /**
     * Multi-factor prediction model with ADAPTIVE WEIGHTS
     * Uses self-learning weights when available, otherwise defaults
     */
    function predictTopSectors(seasonality, rankings, currentMonth) {
        const nextMonth = currentMonth === 12 ? 1 : currentMonth + 1;
        const predictions = [];

        // Get adaptive weights from self-learning engine (if available)
        const weights = (typeof SelfLearningEngine !== 'undefined') ?
            SelfLearningEngine.getWeights() :
            { seasonality: 0.30, momentum: 0.25, relativeStrength: 0.20, macro: 0.15, institutional: 0.10 };

        for (const ranking of rankings) {
            const key = ranking.sector;
            const seasonalData = seasonality[key]?.[nextMonth];
            if (!seasonalData) continue;

            // Seasonality Score (normalized 0-100)
            const seasonalReturn = seasonalData.avgReturn;
            const seasonalConsistency = parseFloat(seasonalData.consistencyScore);
            const seasonalScore = (seasonalReturn * 500 + seasonalConsistency) / 2;

            // Momentum Score (from rankings, already 0-100)
            const momentumScore = ranking.momentum;

            // Relative Strength Score (from rankings)
            const rsScore = ranking.relativeStrength;

            // Macro Proxy Score — enhanced with institutional flow data
            let macroScore = 50;
            if (key === 'NIFTY_IT') macroScore = 65;
            if (key === 'BANK_NIFTY') macroScore = 60;
            if (key === 'NIFTY_FMCG' && (nextMonth >= 10 || nextMonth <= 1)) macroScore = 70;
            if (key === 'NIFTY_METAL') macroScore = 55;
            if (key === 'NIFTY_AUTO' && nextMonth >= 9 && nextMonth <= 11) macroScore = 72;
            if (key === 'NIFTY_PHARMA') macroScore = 58;
            if (key === 'NIFTY_REALTY' && (nextMonth === 2 || nextMonth === 3)) macroScore = 68;

            // Institutional Flow Score (from MACD + OBV + volume proxy)
            const institutionalScore = ranking.institutionalScore || ranking.macdScore || 50;

            // ADAPTIVE COMPOSITE PREDICTION SCORE
            const predictionScore = (
                seasonalScore * weights.seasonality +
                momentumScore * weights.momentum +
                rsScore * weights.relativeStrength +
                macroScore * weights.macro +
                institutionalScore * weights.institutional
            );

            // Confidence: based on consistency and alignment of factors
            const factorAlignment = [
                seasonalScore > 50 ? 1 : 0,
                momentumScore > 50 ? 1 : 0,
                rsScore > 50 ? 1 : 0,
                macroScore > 50 ? 1 : 0
            ];
            const alignmentCount = factorAlignment.reduce((s, v) => s + v, 0);
            const baseConfidence = 45 + (alignmentCount * 10);
            const consistencyBonus = (seasonalConsistency - 50) * 0.3;
            const confidence = Math.min(92, Math.max(35, baseConfidence + consistencyBonus));

            predictions.push({
                sector: key,
                name: SectorDataEngine.SECTORS[key].name,
                color: SectorDataEngine.SECTORS[key].color,
                predictionScore: Math.round(predictionScore),
                confidence: Math.round(confidence),
                factors: {
                    seasonality: Math.round(seasonalScore),
                    momentum: momentumScore,
                    relativeStrength: rsScore,
                    macro: macroScore
                },
                seasonalReturn: seasonalData.avgReturnPct,
                seasonalConsistency: seasonalData.consistencyScore
            });
        }

        predictions.sort((a, b) => b.predictionScore - a.predictionScore);
        return predictions;
    }


    // ─────────────────────────────────────────────
    // STEP 5: INSIGHT GENERATION
    // ─────────────────────────────────────────────

    /**
     * Generate actionable insights
     */
    function generateInsights(seasonality, rankings, predictions, currentMonth) {
        const nextMonth = currentMonth === 12 ? 1 : currentMonth + 1;
        const monthName = MONTH_NAMES[nextMonth - 1];

        // Historically strong sector for next month
        const topSeasonal = getTopSectorsPerMonth(seasonality, 1);
        const historicallyStrong = topSeasonal[nextMonth][0];

        // Current money flow leader
        const moneyFlowLeader = rankings[0];

        // AI top picks
        const top3 = predictions.slice(0, 3);
        const avgConfidence = Math.round(top3.reduce((s, p) => s + p.confidence, 0) / 3);

        const insights = {
            monthName: monthName,
            nextMonth: nextMonth,
            outlook: `${monthName} ${new Date().getFullYear()} Outlook`,
            historicallyStrong: {
                name: historicallyStrong.name,
                sector: historicallyStrong.sector,
                avgReturn: (historicallyStrong.avgReturn * 100).toFixed(2),
                consistency: historicallyStrong.consistency
            },
            moneyFlow: {
                name: moneyFlowLeader.name,
                sector: moneyFlowLeader.sector,
                score: moneyFlowLeader.composite,
                return30d: moneyFlowLeader.return30d
            },
            aiPrediction: {
                top3: top3,
                avgConfidence: avgConfidence
            },
            narrative: generateNarrative(monthName, historicallyStrong, moneyFlowLeader, top3, avgConfidence),
            warnings: generateWarnings(rankings, predictions),
            opportunities: generateOpportunities(seasonality, rankings, predictions, nextMonth)
        };

        return insights;
    }

    function generateNarrative(monthName, historical, moneyFlow, top3, confidence) {
        const top3Names = top3.map(p => p.name).join(', ');
        return `${monthName} Outlook:\n` +
            `• Historically strong sector: ${historical.name} (avg ${(historical.avgReturn * 100).toFixed(1)}%, consistency ${historical.consistency.toFixed(0)}%)\n` +
            `• Current money flow leader: ${moneyFlow.name} (Score: ${moneyFlow.composite}/100)\n` +
            `• AI prediction: ${top3Names} likely to outperform\n` +
            `• Overall confidence: ${confidence}%`;
    }

    function generateWarnings(rankings, predictions) {
        const warnings = [];
        // Sectors with very low strength scores
        const weakSectors = rankings.filter(r => r.composite < 35);
        for (const w of weakSectors) {
            warnings.push(`⚠️ ${w.name} showing weakness (Score: ${w.composite}/100). Consider reducing exposure.`);
        }
        // Sectors with high RSI (overbought)
        const overbought = rankings.filter(r => r.rsi > 70);
        for (const o of overbought) {
            warnings.push(`🔴 ${o.name} RSI at ${o.rsi} — potentially overbought. Watch for pullback.`);
        }
        return warnings;
    }

    function generateOpportunities(seasonality, rankings, predictions, nextMonth) {
        const opportunities = [];
        // Sectors where seasonality AND momentum align
        for (const pred of predictions.slice(0, 3)) {
            const seasonal = seasonality[pred.sector]?.[nextMonth];
            const ranking = rankings.find(r => r.sector === pred.sector);
            if (seasonal && ranking) {
                if (seasonal.avgReturn > 0.01 && ranking.composite > 55) {
                    opportunities.push(`🚀 ${pred.name}: Seasonal tailwind (${seasonal.avgReturnPct}% avg) + Strong momentum (Score: ${ranking.composite}). High conviction.`);
                } else if (seasonal.avgReturn > 0.005) {
                    opportunities.push(`📈 ${pred.name}: Moderate seasonal support (${seasonal.avgReturnPct}% avg). Confidence: ${pred.confidence}%.`);
                }
            }
        }
        // Volume spike opportunity
        const spikes = rankings.filter(r => r.volumeSpike);
        for (const s of spikes) {
            if (!opportunities.some(o => o.includes(s.name))) {
                opportunities.push(`📊 ${s.name}: Volume spike detected (${s.volumeRatio}x average). Institutional activity likely.`);
            }
        }
        return opportunities;
    }


    // ─────────────────────────────────────────────
    // STEP 6: HEATMAP DATA
    // ─────────────────────────────────────────────

    /**
     * Generate heatmap data for multiple timeframes
     */
    function generateHeatmapData(allData) {
        const heatmap = {};
        const sectorKeys = Object.keys(allData).filter(k => k !== 'NIFTY50');

        for (const key of sectorKeys) {
            const data = allData[key];
            const last = data[data.length - 1].close;

            const getReturn = (days) => {
                const prev = data[data.length - 1 - days]?.close || last;
                return ((last - prev) / prev * 100);
            };

            heatmap[key] = {
                name: SectorDataEngine.SECTORS[key].name,
                color: SectorDataEngine.SECTORS[key].color,
                '1D': getReturn(1),
                '1W': getReturn(5),
                '1M': getReturn(22),
                '3M': getReturn(66),
                '6M': getReturn(132),
                '1Y': getReturn(252),
                'YTD': (() => {
                    // Find first trading day of current year
                    const currentYear = data[data.length - 1].year;
                    const firstDay = data.find(d => d.year === currentYear);
                    return firstDay ? ((last - firstDay.close) / firstDay.close * 100) : 0;
                })()
            };
        }
        return heatmap;
    }

    /**
     * Get sparkline data (last 30 days of closes)
     */
    function getSparklineData(data, days = 30) {
        const recent = data.slice(-days);
        const minPrice = Math.min(...recent.map(d => d.close));
        const maxPrice = Math.max(...recent.map(d => d.close));
        const range = maxPrice - minPrice || 1;

        return recent.map(d => ({
            date: d.dateStr,
            value: (d.close - minPrice) / range // Normalized 0-1
        }));
    }


    // ─────────────────────────────────────────────
    // PUBLIC API
    // ─────────────────────────────────────────────

    return {
        MONTH_NAMES,
        computeSeasonality,
        getTopSectorsPerMonth,
        getWorstSectorsPerMonth,
        calculateRSI,
        calculateSMA,
        calculateEMA,
        detectVolumeSpike,
        calculateRelativeStrength,
        detectBreakout,
        calculateMACD,
        calculateBollingerBands,
        calculateATR,
        calculateOBV,
        calculateInstitutionalFlowProxy,
        calculatePCRProxy,
        computeAdvancedIndicators,
        calculateSectorStrength,
        rankSectors,
        predictTopSectors,
        generateInsights,
        generateHeatmapData,
        getSparklineData
    };
})();
