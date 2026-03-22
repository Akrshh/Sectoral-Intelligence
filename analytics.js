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

    /**
     * Calculate composite Sector Strength Score (0-100)
     * Momentum (30%) + Relative Strength (30%) + Volume (20%) + Trend (20%)
     */
    function calculateSectorStrength(sectorData, niftyData) {
        const rsi = calculateRSI(sectorData);
        const rs = calculateRelativeStrength(sectorData, niftyData);
        const volumeInfo = detectVolumeSpike(sectorData);
        const breakoutInfo = detectBreakout(sectorData);

        // Momentum score (0-100) based on RSI normalization
        // RSI 30-70 maps to 0-100 but with clamping
        const momentumScore = Math.min(100, Math.max(0, (rsi - 20) * (100 / 60)));

        // Relative Strength score (0-100)
        // RS 0.9-1.1 maps to 0-100
        const rsScore = Math.min(100, Math.max(0, (rs - 0.9) * (100 / 0.2)));

        // Volume score (0-100) based on volume spike ratio
        const volumeScore = Math.min(100, Math.max(0, (volumeInfo.ratio - 0.5) * (100 / 2)));

        // Trend score (0-100)
        let trendScore = 50; // neutral
        if (breakoutInfo.type === 'golden_cross') trendScore = 95;
        else if (breakoutInfo.type === 'bullish_trend') trendScore = 80;
        else if (breakoutInfo.type === 'bearish_trend') trendScore = 20;
        else trendScore = 50;

        // Add price vs SMA component
        const priceSma20 = parseFloat(breakoutInfo.priceVsSMA20 || 0);
        trendScore = Math.min(100, Math.max(0, trendScore + priceSma20 * 2));

        // Composite score
        const composite = (momentumScore * 0.30) + (rsScore * 0.30) + (volumeScore * 0.20) + (trendScore * 0.20);

        return {
            composite: Math.round(Math.min(100, Math.max(0, composite))),
            momentum: Math.round(momentumScore),
            relativeStrength: Math.round(rsScore),
            volume: Math.round(volumeScore),
            trend: Math.round(trendScore),
            rsi: Math.round(rsi * 100) / 100,
            rsRatio: Math.round(rs * 1000) / 1000,
            volumeSpike: volumeInfo.spike,
            volumeRatio: Math.round(volumeInfo.ratio * 100) / 100,
            breakout: breakoutInfo
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
     * Multi-factor prediction model
     * Combines: Seasonality (35%) + Momentum (25%) + Relative Strength (20%) + Macro Proxy (20%)
     */
    function predictTopSectors(seasonality, rankings, currentMonth) {
        const nextMonth = currentMonth === 12 ? 1 : currentMonth + 1;
        const predictions = [];

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

            // Macro Proxy Score — simulated based on sector characteristics
            // In production this would use: USD/INR, US bond yields, crude oil, FII flows
            let macroScore = 50;
            // IT benefits from strong USD
            if (key === 'NIFTY_IT') macroScore = 65;
            // Banks benefit from rising rates
            if (key === 'BANK_NIFTY') macroScore = 60;
            // FMCG benefits from rural spending (Q3/Q4 strong)
            if (key === 'NIFTY_FMCG' && (nextMonth >= 10 || nextMonth <= 1)) macroScore = 70;
            // Metals track global commodity cycle
            if (key === 'NIFTY_METAL') macroScore = 55;
            // Auto benefits from festive season
            if (key === 'NIFTY_AUTO' && nextMonth >= 9 && nextMonth <= 11) macroScore = 72;
            // Pharma defensive play in uncertain times
            if (key === 'NIFTY_PHARMA') macroScore = 58;
            // Realty benefits from rate cuts / budget
            if (key === 'NIFTY_REALTY' && (nextMonth === 2 || nextMonth === 3)) macroScore = 68;

            // Composite prediction score
            const predictionScore = (
                seasonalScore * 0.35 +
                momentumScore * 0.25 +
                rsScore * 0.20 +
                macroScore * 0.20
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
        calculateSectorStrength,
        rankSectors,
        predictTopSectors,
        generateInsights,
        generateHeatmapData,
        getSparklineData
    };
})();
