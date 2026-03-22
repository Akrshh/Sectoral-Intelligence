// ============================================================
// SELF-LEARNING ENGINE — NSE Sectoral Intelligence System
// Tracks predictions vs reality · Auto-adjusts weights
// Persists learning data via server API
// ============================================================

const SelfLearningEngine = (() => {

    // Default model weights (these get adjusted over time)
    const DEFAULT_WEIGHTS = {
        seasonality: 0.30,
        momentum: 0.25,
        relativeStrength: 0.20,
        macro: 0.15,
        institutional: 0.10
    };

    // Learning configuration
    const LEARNING_RATE = 0.15;          // How fast weights adjust (0.05 = slow, 0.3 = fast)
    const MIN_WEIGHT = 0.05;             // No factor drops below 5%
    const MAX_WEIGHT = 0.45;             // No factor exceeds 45%
    const SMOOTHING_FACTOR = 0.3;        // Exponential smoothing for accuracy tracking

    // State
    let learningHistory = [];
    let currentWeights = { ...DEFAULT_WEIGHTS };
    let accuracyMetrics = {
        hitRate: 0,           // % of times top-3 prediction was correct
        avgError: 0,          // Average prediction error
        totalPredictions: 0,
        correctPredictions: 0,
        weightHistory: [],    // Track weight changes over time
        monthlyAccuracy: []   // Per-month accuracy log
    };


    // ─────────────────────────────────────────────
    // PREDICTION RECORDING
    // ─────────────────────────────────────────────

    /**
     * Record a new prediction for future evaluation
     */
    function recordPrediction(predictions, rankings, month, year) {
        const record = {
            id: `${year}-${String(month).padStart(2, '0')}`,
            timestamp: Date.now(),
            date: new Date().toISOString(),
            targetMonth: month,
            targetYear: year,
            weightsUsed: { ...currentWeights },
            predictedTop3: predictions.slice(0, 3).map(p => ({
                sector: p.sector,
                name: p.name,
                predictionScore: p.predictionScore,
                confidence: p.confidence,
                factors: { ...p.factors }
            })),
            predictedRankings: predictions.map(p => ({
                sector: p.sector,
                score: p.predictionScore
            })),
            allSectorScores: rankings.map(r => ({
                sector: r.sector,
                compositeScore: r.composite,
                return30d: r.return30d
            })),
            outcome: null,  // Filled when we evaluate
            evaluated: false
        };

        // Avoid duplicates for same month
        const existingIdx = learningHistory.findIndex(h => h.id === record.id);
        if (existingIdx >= 0) {
            learningHistory[existingIdx] = record;
        } else {
            learningHistory.push(record);
        }

        return record;
    }


    // ─────────────────────────────────────────────
    // OUTCOME EVALUATION
    // ─────────────────────────────────────────────

    /**
     * Evaluate past predictions against actual sector performance
     * Called when new data is available — checks which past predictions 
     * can now be scored
     */
    function evaluatePredictions(allData) {
        let newEvaluations = 0;

        for (const record of learningHistory) {
            if (record.evaluated) continue;

            // Check if we have enough data to evaluate this prediction
            // (we need at least the end of the predicted month)
            const targetDate = new Date(record.targetYear, record.targetMonth - 1, 28);
            const now = new Date();
            if (now < targetDate) continue; // Month hasn't ended yet

            // Calculate actual returns for the predicted month
            const actualReturns = {};
            for (const [sectorKey, data] of Object.entries(allData)) {
                if (sectorKey === 'NIFTY50') continue;

                const monthData = data.filter(d =>
                    d.month === record.targetMonth && d.year === record.targetYear
                );

                if (monthData.length >= 2) {
                    const firstClose = monthData[0].close;
                    const lastClose = monthData[monthData.length - 1].close;
                    actualReturns[sectorKey] = ((lastClose - firstClose) / firstClose) * 100;
                }
            }

            if (Object.keys(actualReturns).length < 3) continue; // Not enough data

            // Rank sectors by actual return
            const actualRanking = Object.entries(actualReturns)
                .sort((a, b) => b[1] - a[1])
                .map(([sector, ret], i) => ({ sector, return: ret, rank: i + 1 }));

            const actualTop3 = actualRanking.slice(0, 3).map(a => a.sector);
            const predictedTop3 = record.predictedTop3.map(p => p.sector);

            // Calculate accuracy metrics
            const hits = predictedTop3.filter(p => actualTop3.includes(p)).length;
            const hitRate = hits / 3;

            // Calculate prediction error (RMSE of predicted rank vs actual rank)
            let totalError = 0;
            let errorCount = 0;
            for (const pred of record.predictedRankings) {
                const actualRank = actualRanking.find(a => a.sector === pred.sector);
                if (actualRank) {
                    const predRank = record.predictedRankings.indexOf(pred) + 1;
                    totalError += Math.pow(predRank - actualRank.rank, 2);
                    errorCount++;
                }
            }
            const rmse = errorCount > 0 ? Math.sqrt(totalError / errorCount) : 0;

            // Calculate factor contribution accuracy
            const factorAccuracy = calculateFactorAccuracy(record, actualReturns);

            // Store outcome
            record.outcome = {
                actualReturns,
                actualTop3,
                hits,
                hitRate,
                rmse,
                factorAccuracy,
                evaluatedAt: new Date().toISOString()
            };
            record.evaluated = true;
            newEvaluations++;

            // Update running accuracy metrics
            updateAccuracyMetrics(record);

            // Adjust weights based on this evaluation
            adjustWeights(factorAccuracy);
        }

        if (newEvaluations > 0) {
            console.log(`📊 Self-Learning: Evaluated ${newEvaluations} predictions, accuracy: ${(accuracyMetrics.hitRate * 100).toFixed(1)}%`);
        }

        return newEvaluations;
    }

    /**
     * Calculate how well each factor predicted the actual outcome
     */
    function calculateFactorAccuracy(record, actualReturns) {
        const factors = ['seasonality', 'momentum', 'relativeStrength', 'macro'];
        const accuracy = {};

        for (const factor of factors) {
            // Get factor scores from predictions
            const factorRanking = record.predictedTop3
                .map(p => ({ sector: p.sector, score: p.factors[factor] || 0 }))
                .sort((a, b) => b.score - a.score);

            // Compare factor ranking with actual returns
            let concordance = 0;
            let total = 0;

            for (let i = 0; i < factorRanking.length; i++) {
                const factorSector = factorRanking[i].sector;
                const actualReturn = actualReturns[factorSector] || 0;

                for (let j = i + 1; j < factorRanking.length; j++) {
                    const otherSector = factorRanking[j].sector;
                    const otherReturn = actualReturns[otherSector] || 0;

                    // Check if higher factor score → higher actual return
                    if ((factorRanking[i].score > factorRanking[j].score && actualReturn > otherReturn) ||
                        (factorRanking[i].score < factorRanking[j].score && actualReturn < otherReturn)) {
                        concordance++;
                    }
                    total++;
                }
            }

            accuracy[factor] = total > 0 ? concordance / total : 0.5;
        }

        // Institutional flow gets the same accuracy as macro for now
        accuracy.institutional = accuracy.macro * 0.9 + 0.1 * 0.5;

        return accuracy;
    }

    /**
     * Update running accuracy metrics using exponential smoothing
     */
    function updateAccuracyMetrics(record) {
        const outcome = record.outcome;
        accuracyMetrics.totalPredictions++;

        if (outcome.hits >= 2) {
            accuracyMetrics.correctPredictions++;
        }

        // Exponential smoothing for hit rate
        if (accuracyMetrics.totalPredictions === 1) {
            accuracyMetrics.hitRate = outcome.hitRate;
            accuracyMetrics.avgError = outcome.rmse;
        } else {
            accuracyMetrics.hitRate =
                SMOOTHING_FACTOR * outcome.hitRate +
                (1 - SMOOTHING_FACTOR) * accuracyMetrics.hitRate;
            accuracyMetrics.avgError =
                SMOOTHING_FACTOR * outcome.rmse +
                (1 - SMOOTHING_FACTOR) * accuracyMetrics.avgError;
        }

        // Log monthly accuracy
        accuracyMetrics.monthlyAccuracy.push({
            month: record.id,
            hitRate: outcome.hitRate,
            hits: outcome.hits,
            rmse: outcome.rmse,
            weights: { ...currentWeights }
        });

        // Keep weight history
        accuracyMetrics.weightHistory.push({
            month: record.id,
            weights: { ...currentWeights }
        });
    }


    // ─────────────────────────────────────────────
    // ADAPTIVE WEIGHT ADJUSTMENT
    // ─────────────────────────────────────────────

    /**
     * Adjust prediction model weights based on factor accuracy
     * Factors that predicted well get more weight next time
     */
    function adjustWeights(factorAccuracy) {
        const factors = Object.keys(currentWeights);

        // Calculate reward for each factor based on accuracy
        for (const factor of factors) {
            const accuracy = factorAccuracy[factor] || 0.5;
            const deviation = accuracy - 0.5; // How much better/worse than random

            // Adjust weight: increase for accurate factors, decrease for inaccurate
            currentWeights[factor] += LEARNING_RATE * deviation;

            // Clamp to min/max
            currentWeights[factor] = Math.max(MIN_WEIGHT, Math.min(MAX_WEIGHT, currentWeights[factor]));
        }

        // Normalize weights to sum to 1.0
        normalizeWeights();

        console.log('🧠 Adjusted weights:', JSON.stringify(currentWeights, null, 0));
    }

    /**
     * Normalize weights to sum to 1.0
     */
    function normalizeWeights() {
        const sum = Object.values(currentWeights).reduce((s, w) => s + w, 0);
        for (const key of Object.keys(currentWeights)) {
            currentWeights[key] = Math.round((currentWeights[key] / sum) * 1000) / 1000;
        }
        // Fix rounding
        const newSum = Object.values(currentWeights).reduce((s, w) => s + w, 0);
        const diff = 1.0 - newSum;
        if (Math.abs(diff) > 0.001) {
            const maxKey = Object.entries(currentWeights).sort((a, b) => b[1] - a[1])[0][0];
            currentWeights[maxKey] += diff;
        }
    }


    // ─────────────────────────────────────────────
    // PERSISTENCE (Load/Save via Server)
    // ─────────────────────────────────────────────

    /**
     * Load learning data from server
     */
    async function loadFromServer() {
        try {
            const response = await fetch('/api/learning');
            const json = await response.json();
            if (json.success && json.data) {
                learningHistory = json.data.history || [];
                currentWeights = json.data.weights || { ...DEFAULT_WEIGHTS };
                accuracyMetrics = json.data.metrics || accuracyMetrics;
                console.log('📚 Loaded learning history:', learningHistory.length, 'records');
                return true;
            }
        } catch (e) {
            console.log('Learning data not available:', e.message);
        }
        return false;
    }

    /**
     * Save learning data to server
     */
    async function saveToServer() {
        try {
            const response = await fetch('/api/learning', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    history: learningHistory,
                    weights: currentWeights,
                    metrics: accuracyMetrics
                })
            });
            const json = await response.json();
            if (json.success) {
                console.log('💾 Learning data saved');
            }
        } catch (e) {
            console.log('Failed to save learning data:', e.message);
        }
    }


    // ─────────────────────────────────────────────
    // PUBLIC API
    // ─────────────────────────────────────────────

    /**
     * Get current adaptive weights for the prediction model
     */
    function getWeights() {
        return { ...currentWeights };
    }

    /**
     * Get accuracy metrics
     */
    function getMetrics() {
        return {
            ...accuracyMetrics,
            currentWeights: { ...currentWeights },
            defaultWeights: { ...DEFAULT_WEIGHTS },
            totalEvaluated: learningHistory.filter(h => h.evaluated).length,
            totalPending: learningHistory.filter(h => !h.evaluated).length,
            recentAccuracy: accuracyMetrics.monthlyAccuracy.slice(-6)
        };
    }

    /**
     * Get learning summary for display
     */
    function getSummary() {
        const evaluated = learningHistory.filter(h => h.evaluated);
        const pending = learningHistory.filter(h => !h.evaluated);

        return {
            status: evaluated.length === 0 ? 'learning' : 'active',
            totalPredictions: learningHistory.length,
            evaluated: evaluated.length,
            pending: pending.length,
            hitRate: (accuracyMetrics.hitRate * 100).toFixed(1),
            avgError: accuracyMetrics.avgError.toFixed(2),
            weightsChanged: !Object.keys(DEFAULT_WEIGHTS).every(
                k => Math.abs(currentWeights[k] - DEFAULT_WEIGHTS[k]) < 0.01
            ),
            lastEvaluation: evaluated.length > 0 ?
                evaluated[evaluated.length - 1].outcome.evaluatedAt : null
        };
    }

    /**
     * Full learning cycle: evaluate past predictions, save results
     */
    async function runLearningCycle(allData, predictions, rankings, currentMonth, currentYear) {
        // 1. Load existing learning data
        await loadFromServer();

        // 2. Record current prediction
        const nextMonth = currentMonth === 12 ? 1 : currentMonth + 1;
        const nextYear = currentMonth === 12 ? currentYear + 1 : currentYear;
        recordPrediction(predictions, rankings, nextMonth, nextYear);

        // 3. Evaluate any past predictions that can now be scored
        evaluatePredictions(allData);

        // 4. Save everything
        await saveToServer();
    }

    return {
        DEFAULT_WEIGHTS,
        getWeights,
        getMetrics,
        getSummary,
        recordPrediction,
        evaluatePredictions,
        adjustWeights: adjustWeights,
        loadFromServer,
        saveToServer,
        runLearningCycle
    };

})();
