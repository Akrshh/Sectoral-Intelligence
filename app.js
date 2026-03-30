// ============================================================
// DASHBOARD CONTROLLER — NSE Sectoral Intelligence System
// Live Data (via Server API) → Analytics → UI Rendering
// Falls back to simulated data if server is unavailable
// ============================================================

const Dashboard = (() => {

    // State
    let allData = null;
    let seasonality = null;
    let rankings = null;
    let predictions = null;
    let insights = null;
    let heatmapData = null;
    let currentSeasonalityView = 'returns';
    let dataSource = 'loading';
    let dataMeta = null;
    let currentMonth = new Date().getMonth() + 1; // Current month (1-12)
    let currentYear = new Date().getFullYear();

    const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                         'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    // Auto-refresh interval (15 minutes during market hours)
    let refreshInterval = null;


    // ─────────────────────────────────────────────
    // INITIALIZATION
    // ─────────────────────────────────────────────

    async function init() {
        // Show current date
        document.getElementById('headerDate').textContent = formatDate(new Date());

        // Safety net: always hide loading after 10 seconds max
        const safetyTimeout = setTimeout(() => {
            const overlay = document.getElementById('loadingOverlay');
            if (overlay && !overlay.classList.contains('hidden')) {
                console.warn('Safety timeout: forcing loading overlay to hide');
                overlay.classList.add('hidden');
            }
        }, 10000);

        updateLoadingText('Connecting to data server...');

        try {
            // Try live data first
            allData = await fetchLiveData();
            dataSource = 'live';
        } catch (e) {
            console.log('Server unavailable, using simulated data:', e.message);
            updateLoadingText('Generating simulated data...');
            allData = SectorDataEngine.generateAllData();
            dataSource = 'simulated';
        }

        try {
            updateLoadingText('Running analytics engine...');
            await runAnalyticsAndRender();
        } catch (e) {
            console.error('Analytics error:', e);
        }

        // Setup auto-refresh (every 15 min during market hours)
        startAutoRefresh();

        // Run stock screener (non-blocking — loads in parallel)
        initStockScreener().catch(e => console.error('Screener init error:', e));

        // Hide loading
        clearTimeout(safetyTimeout);
        setTimeout(() => {
            document.getElementById('loadingOverlay').classList.add('hidden');
        }, 600);
    }

    async function fetchLiveData() {
        const response = await fetch('/api/sector-data');
        const json = await response.json();

        if (!json.success) throw new Error('API returned error');

        dataMeta = json.meta;

        // If server returned empty data (fallback), use simulated
        if (!json.data || Object.keys(json.data).length === 0) {
            console.log('Server returned empty data, using simulated');
            throw new Error('No live data available');
        }

        // Convert date strings back to Date objects for compatibility
        const formatted = {};
        for (const [key, records] of Object.entries(json.data)) {
            formatted[key] = records.map(r => ({
                ...r,
                date: new Date(r.date),
                dateStr: r.dateStr || new Date(r.date).toISOString().split('T')[0],
                year: r.year || new Date(r.date).getFullYear(),
                month: r.month || (new Date(r.date).getMonth() + 1)
            }));
        }

        console.log(`✅ Loaded live data: ${Object.keys(formatted).length} sectors, source: ${json.source}`);
        return formatted;
    }

    async function runAnalyticsAndRender() {
        // Run all analytics
        seasonality = AnalyticsEngine.computeSeasonality(allData);
        rankings = AnalyticsEngine.rankSectors(allData);
        predictions = AnalyticsEngine.predictTopSectors(seasonality, rankings, currentMonth);
        insights = AnalyticsEngine.generateInsights(seasonality, rankings, predictions, currentMonth);
        heatmapData = AnalyticsEngine.generateHeatmapData(allData);

        // Update prediction badge
        const nextMonth = currentMonth === 12 ? 1 : currentMonth + 1;
        document.getElementById('predictionMonthBadge').textContent = `${MONTH_SHORT[nextMonth - 1]} ${currentYear}`;

        // Update data source badge
        updateDataSourceBadge();

        // Render all panels
        renderHeatmap('1W');
        renderRankings();
        renderPredictions();
        renderSeasonality();
        renderInsights();
        renderBreakdown();

        // Setup heatmap tabs
        setupHeatmapTabs();

        // Run self-learning cycle
        if (typeof SelfLearningEngine !== 'undefined') {
            try {
                await SelfLearningEngine.runLearningCycle(allData, predictions, rankings, currentMonth, currentYear);
                renderLearning();
            } catch (e) {
                console.log('Self-learning cycle skipped:', e.message);
            }
        }
    }

    function updateLoadingText(text) {
        const el = document.querySelector('.loading-text');
        if (el) el.textContent = text;
    }

    function updateDataSourceBadge() {
        const badge = document.getElementById('dataSourceBadge');
        if (!badge) return;

        if (dataSource === 'live') {
            const age = dataMeta ? Math.round((Date.now() - dataMeta.lastFetch) / 60000) : 0;
            badge.className = 'header-badge badge-live';
            badge.innerHTML = `🟢 LIVE DATA <span class="badge-age">${age}m ago</span>`;
            badge.title = `Source: Yahoo Finance\nSectors: ${dataMeta?.symbolsFetched || '?'}/${dataMeta?.totalSymbols || '?'}\nLast fetch: ${dataMeta?.lastFetchTime || 'unknown'}`;
        } else {
            badge.className = 'header-badge badge-simulated';
            badge.innerHTML = '⚙ SIMULATED DATA';
            badge.title = 'Server unavailable. Using realistic simulated data.\nStart server with: npm start';
        }
    }

    function formatDate(d) {
        const options = { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' };
        const time = d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false });
        return d.toLocaleDateString('en-IN', options) + ' · ' + time + ' IST';
    }


    // ─────────────────────────────────────────────
    // AUTO-REFRESH
    // ─────────────────────────────────────────────

    function startAutoRefresh() {
        // Refresh every 15 minutes
        refreshInterval = setInterval(async () => {
            // Only auto-refresh during Indian market hours (9:00-15:45 IST)
            const now = new Date();
            const hours = now.getHours();
            const mins = now.getMinutes();
            const timeNum = hours * 100 + mins;
            const isWeekday = now.getDay() >= 1 && now.getDay() <= 5;

            if (isWeekday && timeNum >= 900 && timeNum <= 1545) {
                console.log('🔄 Auto-refreshing data...');
                try {
                    const newData = await fetchLiveData();
                    allData = newData;
                    dataSource = 'live';
                    document.getElementById('headerDate').textContent = formatDate(new Date());
                    await runAnalyticsAndRender();
                    console.log('✅ Auto-refresh complete');
                } catch (e) {
                    console.log('Auto-refresh failed, keeping current data');
                }
            }
        }, 15 * 60 * 1000); // 15 minutes
    }

    async function manualRefresh() {
        const btn = document.getElementById('refreshBtn');
        if (btn) {
            btn.disabled = true;
            btn.innerHTML = '🔄 Refreshing...';
        }

        try {
            // Call server refresh endpoint
            const resp = await fetch('/api/refresh');
            const json = await resp.json();

            if (json.success) {
                // Fetch the newly refreshed data
                const newData = await fetchLiveData();
                allData = newData;
                dataSource = 'live';
                document.getElementById('headerDate').textContent = formatDate(new Date());
                await runAnalyticsAndRender();
            }
        } catch (e) {
            console.log('Manual refresh failed:', e.message);
        }

        if (btn) {
            btn.disabled = false;
            btn.innerHTML = '🔄 Refresh Data';
        }
    }


    // ─────────────────────────────────────────────
    // HEATMAP
    // ─────────────────────────────────────────────

    function renderHeatmap(period) {
        const container = document.getElementById('heatmapBody');
        const periods = ['1D', '1W', '1M', '3M', '6M', '1Y', 'YTD'];
        const sectorKeys = Object.keys(heatmapData);

        let html = '<div class="heatmap-grid">';

        // Header row
        html += '<div class="heatmap-header">Sector</div>';
        for (const p of periods) {
            html += `<div class="heatmap-header">${p}</div>`;
        }

        // Data rows
        for (const key of sectorKeys) {
            const sector = heatmapData[key];
            html += `<div class="heatmap-sector-name">
                <span class="heatmap-sector-dot" style="background:${sector.color}"></span>
                ${sector.name}
            </div>`;

            for (const p of periods) {
                const val = sector[p];
                const cssClass = getHeatmapClass(val);
                const display = val >= 0 ? `+${val.toFixed(1)}%` : `${val.toFixed(1)}%`;
                html += `<div class="heatmap-cell ${cssClass}">${display}</div>`;
            }
        }

        html += '</div>';
        container.innerHTML = html;
    }

    function getHeatmapClass(val) {
        if (val > 5) return 'positive-strong';
        if (val > 2) return 'positive-medium';
        if (val > 0) return 'positive-weak';
        if (val > -2) return 'negative-weak';
        if (val > -5) return 'negative-medium';
        if (val < -5) return 'negative-strong';
        return 'neutral';
    }

    function setupHeatmapTabs() {
        const tabs = document.querySelectorAll('#heatmapTabs .tab-btn');
        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                tabs.forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                highlightHeatmapPeriod(tab.dataset.period);
            });
        });
    }

    function highlightHeatmapPeriod(period) {
        const periods = ['1D', '1W', '1M', '3M', '6M', '1Y', 'YTD'];
        const idx = periods.indexOf(period);
        const cells = document.querySelectorAll('.heatmap-cell');
        const cols = 7;

        cells.forEach((cell, i) => {
            const col = i % cols;
            if (col === idx) {
                cell.style.transform = 'scale(1.08)';
                cell.style.boxShadow = '0 0 15px rgba(99, 102, 241, 0.3)';
                cell.style.zIndex = '3';
            } else {
                cell.style.transform = '';
                cell.style.boxShadow = '';
                cell.style.zIndex = '';
            }
        });
    }


    // ─────────────────────────────────────────────
    // SECTOR RANKINGS
    // ─────────────────────────────────────────────

    function renderRankings() {
        const container = document.getElementById('rankingsBody');
        let html = '<div class="ranking-list">';

        for (const r of rankings) {
            const rankClass = r.rank <= 3 ? `rank-${r.rank}` : 'rank-default';
            const scoreColor = getScoreColor(r.composite);
            const returnColor = r.return30d >= 0 ? 'var(--green-pos)' : 'var(--red-neg)';
            const returnSign = r.return30d >= 0 ? '+' : '';

            // Sparkline
            const sparkData = AnalyticsEngine.getSparklineData(allData[r.sector], 30);
            const sparkBars = sparkData.map(d => {
                const h = Math.max(3, d.value * 28);
                return `<div class="sparkline-bar" style="height:${h}px; background:${scoreColor}"></div>`;
            }).join('');

            html += `
                <div class="ranking-item">
                    <div class="ranking-rank ${rankClass}">${r.rank}</div>
                    <div class="ranking-name">
                        <span class="sector-dot" style="background:${r.color}"></span>
                        ${r.name}
                    </div>
                    <div class="ranking-score-bar">
                        <div class="ranking-score-fill" style="width:${r.composite}%; background: linear-gradient(90deg, ${scoreColor}88, ${scoreColor})"></div>
                    </div>
                    <div class="ranking-score-value" style="color:${scoreColor}">${r.composite}</div>
                    <div class="ranking-return" style="color:${returnColor}">${returnSign}${r.return30d}%</div>
                    <div class="ranking-sparkline">${sparkBars}</div>
                </div>`;
        }

        html += '</div>';
        container.innerHTML = html;
    }

    function getScoreColor(score) {
        if (score >= 70) return '#22c55e';
        if (score >= 50) return '#eab308';
        if (score >= 35) return '#f97316';
        return '#ef4444';
    }


    // ─────────────────────────────────────────────
    // AI PREDICTIONS
    // ─────────────────────────────────────────────

    function renderPredictions() {
        const container = document.getElementById('predictionsBody');
        const top3 = predictions.slice(0, 3);
        const labels = ['Top Pick', '2nd Pick', '3rd Pick'];

        let html = '<div class="prediction-cards">';

        top3.forEach((pred, i) => {
            const circumference = 2 * Math.PI * 34;
            const offset = circumference - (pred.confidence / 100) * circumference;
            const confColor = pred.confidence >= 70 ? 'var(--green-pos)' :
                             pred.confidence >= 55 ? 'var(--accent-amber)' : 'var(--accent-orange)';

            html += `
                <div class="prediction-card">
                    <div class="prediction-rank-label">${labels[i]}</div>
                    <div class="prediction-sector-name" style="color:${pred.color}">${pred.name}</div>
                    <div class="prediction-confidence">
                        <svg class="confidence-ring" width="80" height="80" viewBox="0 0 80 80">
                            <circle class="confidence-ring-bg" cx="40" cy="40" r="34"/>
                            <circle class="confidence-ring-fill" cx="40" cy="40" r="34"
                                stroke="${confColor}"
                                stroke-dasharray="${circumference}"
                                stroke-dashoffset="${offset}"/>
                        </svg>
                        <div class="confidence-value" style="color:${confColor}">${pred.confidence}%</div>
                    </div>
                    <div class="confidence-label">Confidence</div>
                    <div class="prediction-factors">
                        <div class="prediction-factor">
                            <span class="prediction-factor-label">Season</span>
                            <span class="prediction-factor-value">${pred.factors.seasonality}</span>
                        </div>
                        <div class="prediction-factor">
                            <span class="prediction-factor-label">Momentum</span>
                            <span class="prediction-factor-value">${pred.factors.momentum}</span>
                        </div>
                        <div class="prediction-factor">
                            <span class="prediction-factor-label">RS</span>
                            <span class="prediction-factor-value">${pred.factors.relativeStrength}</span>
                        </div>
                        <div class="prediction-factor">
                            <span class="prediction-factor-label">Macro</span>
                            <span class="prediction-factor-value">${pred.factors.macro}</span>
                        </div>
                    </div>
                </div>`;
        });

        html += '</div>';

        // Additional predictions table
        html += '<div style="margin-top:16px;">';
        html += '<table style="width:100%; font-size:12px; border-collapse:collapse;">';
        html += '<tr style="color:var(--text-muted); font-size:10px; text-transform:uppercase; letter-spacing:0.5px;">';
        html += '<th style="text-align:left; padding:8px;">Sector</th>';
        html += '<th style="text-align:center; padding:8px;">Score</th>';
        html += '<th style="text-align:center; padding:8px;">Confidence</th>';
        html += '<th style="text-align:center; padding:8px;">Seasonal Avg</th>';
        html += '</tr>';

        predictions.forEach((pred, i) => {
            const bgColor = i < 3 ? 'rgba(99, 102, 241, 0.05)' : 'transparent';
            const prefix = i < 3 ? '🏅 ' : '';
            html += `<tr style="background:${bgColor}; border-bottom:1px solid var(--border-glass);">
                <td style="padding:8px; font-weight:500; color:${pred.color}">${prefix}${pred.name}</td>
                <td style="text-align:center; padding:8px; font-family:'JetBrains Mono',monospace; font-weight:600;">${pred.predictionScore}</td>
                <td style="text-align:center; padding:8px; font-family:'JetBrains Mono',monospace;">${pred.confidence}%</td>
                <td style="text-align:center; padding:8px; font-family:'JetBrains Mono',monospace; color:${parseFloat(pred.seasonalReturn) >= 0 ? 'var(--green-pos)' : 'var(--red-neg)'}">
                    ${parseFloat(pred.seasonalReturn) >= 0 ? '+' : ''}${pred.seasonalReturn}%
                </td>
            </tr>`;
        });

        html += '</table></div>';
        container.innerHTML = html;
    }


    // ─────────────────────────────────────────────
    // SEASONALITY TABLE
    // ─────────────────────────────────────────────

    function renderSeasonality() {
        const container = document.getElementById('seasonalityBody');
        const topSectors = AnalyticsEngine.getTopSectorsPerMonth(seasonality);
        const sectorKeys = Object.keys(seasonality);

        let html = '<table class="seasonality-table">';

        // Header
        html += '<thead><tr><th>Sector</th>';
        for (let m = 1; m <= 12; m++) {
            const isCurrentMonth = m === currentMonth;
            const style = isCurrentMonth ? 'color:var(--accent-cyan); font-weight:700;' : '';
            html += `<th style="${style}">${MONTH_SHORT[m - 1]}</th>`;
        }
        html += '</tr></thead>';

        // Body
        html += '<tbody>';
        for (const key of sectorKeys) {
            const sectorName = SectorDataEngine.SECTORS[key].name;
            const sectorColor = SectorDataEngine.SECTORS[key].color;

            html += `<tr><td><span style="color:${sectorColor}">●</span> ${sectorName}</td>`;
            for (let m = 1; m <= 12; m++) {
                const data = seasonality[key][m];
                const isTop = topSectors[m].some(t => t.sector === key);
                const isCurrentMonth = m === currentMonth;

                let value, colorClass;
                if (currentSeasonalityView === 'returns') {
                    value = `${parseFloat(data.avgReturnPct) >= 0 ? '+' : ''}${data.avgReturnPct}%`;
                    colorClass = parseFloat(data.avgReturnPct) >= 0 ? 'seasonality-cell-positive' : 'seasonality-cell-negative';
                } else {
                    value = `${data.consistencyScore}%`;
                    colorClass = parseFloat(data.consistencyScore) >= 60 ? 'seasonality-cell-positive' : 'seasonality-cell-negative';
                }

                const topClass = isTop ? 'seasonality-top-pick' : '';
                const currentStyle = isCurrentMonth ? 'background:rgba(6,182,212,0.08);' : '';
                const highlightStyle = isTop ? 'font-weight:700;' : '';

                html += `<td class="${colorClass} ${topClass}" style="${currentStyle}${highlightStyle}">${value}</td>`;
            }
            html += '</tr>';
        }

        // Top Picks Row
        html += '<tr class="top-sectors-row"><td style="font-weight:600;">🏆 Top Picks</td>';
        for (let m = 1; m <= 12; m++) {
            const tops = topSectors[m];
            const names = tops.map(t => {
                const shortName = t.name.replace('NIFTY ', '').replace('BANK NIFTY', 'BANK');
                return shortName;
            }).join(', ');
            html += `<td>${names}</td>`;
        }
        html += '</tr>';

        html += '</tbody></table>';
        container.innerHTML = html;
    }

    function toggleSeasonalityView(view) {
        currentSeasonalityView = view;
        document.getElementById('tabReturns').classList.toggle('active', view === 'returns');
        document.getElementById('tabConsistency').classList.toggle('active', view === 'consistency');
        renderSeasonality();
    }


    // ─────────────────────────────────────────────
    // INSIGHTS
    // ─────────────────────────────────────────────

    function renderInsights() {
        const container = document.getElementById('insightsBody');

        let html = '<div class="insights-section">';

        // Outlook narrative
        html += `<div class="insight-outlook">${insights.narrative}</div>`;

        // Opportunities
        if (insights.opportunities.length > 0) {
            html += '<div class="insight-group"><div class="insight-group-title">Opportunities</div>';
            for (const opp of insights.opportunities) {
                html += `<div class="insight-item insight-opportunity">${opp}</div>`;
            }
            html += '</div>';
        }

        // Warnings
        if (insights.warnings.length > 0) {
            html += '<div class="insight-group"><div class="insight-group-title">Warnings</div>';
            for (const warn of insights.warnings) {
                html += `<div class="insight-item insight-warning">${warn}</div>`;
            }
            html += '</div>';
        }

        // Key Statistics
        html += `<div class="insight-group">
            <div class="insight-group-title">Key Market Context</div>
            <div style="display:grid; grid-template-columns:repeat(4,1fr); gap:10px;">
                ${createStatCard('Historical Leader', insights.historicallyStrong.name, `Avg: +${insights.historicallyStrong.avgReturn}%`, 'var(--accent-amber)')}
                ${createStatCard('Money Flow Leader', insights.moneyFlow.name, `Score: ${insights.moneyFlow.score}/100`, 'var(--accent-cyan)')}
                ${createStatCard('AI Top Pick', insights.aiPrediction.top3[0].name, `Conf: ${insights.aiPrediction.top3[0].confidence}%`, 'var(--accent-violet)')}
                ${createStatCard('Avg Confidence', `${insights.aiPrediction.avgConfidence}%`, 'Top 3 Sectors', 'var(--accent-emerald)')}
            </div>
        </div>`;

        html += '</div>';
        container.innerHTML = html;
    }

    // ─────────────────────────────────────────────
    // AI LEARNING PANEL
    // ─────────────────────────────────────────────

    function renderLearning() {
        const container = document.getElementById('learningBody');
        if (!container || typeof SelfLearningEngine === 'undefined') return;

        const metrics = SelfLearningEngine.getMetrics();
        const summary = SelfLearningEngine.getSummary();
        const weights = metrics.currentWeights;
        const defaults = metrics.defaultWeights;

        // Update status badge
        const badge = document.getElementById('learningStatusBadge');
        if (badge) {
            if (summary.evaluated > 0) {
                badge.textContent = `${summary.hitRate}% Accuracy`;
                badge.style.background = 'rgba(34, 197, 94, 0.15)';
                badge.style.color = 'var(--green-pos)';
                badge.style.borderColor = 'rgba(34, 197, 94, 0.3)';
            } else {
                badge.textContent = 'Learning...';
            }
        }

        const factorLabels = {
            seasonality: { name: 'Seasonality', icon: '📅', color: '#f59e0b' },
            momentum: { name: 'Momentum', icon: '🚀', color: '#6366f1' },
            relativeStrength: { name: 'Relative Strength', icon: '💪', color: '#06b6d4' },
            macro: { name: 'Macro/Sector', icon: '🌍', color: '#10b981' },
            institutional: { name: 'FII/DII Flow', icon: '🏦', color: '#ec4899' }
        };

        let html = '<div style="display:grid; grid-template-columns:1fr 1fr; gap:20px;">';

        // Left: Adaptive Weights
        html += '<div>';
        html += '<div style="font-size:13px; font-weight:600; margin-bottom:14px; color:var(--text-bright);">📊 Adaptive Model Weights</div>';

        for (const [key, info] of Object.entries(factorLabels)) {
            const weight = weights[key] || 0;
            const defaultWeight = defaults[key] || 0;
            const pct = (weight * 100).toFixed(1);
            const defPct = (defaultWeight * 100).toFixed(0);
            const changed = Math.abs(weight - defaultWeight) > 0.01;
            const arrow = weight > defaultWeight ? '▲' : weight < defaultWeight ? '▼' : '=';
            const arrowColor = weight > defaultWeight ? 'var(--green-pos)' : weight < defaultWeight ? 'var(--red-neg)' : 'var(--text-muted)';

            html += `<div style="display:flex; align-items:center; gap:10px; margin-bottom:10px;">
                <span style="font-size:14px; width:22px;">${info.icon}</span>
                <span style="width:110px; font-size:11px; color:var(--text-secondary);">${info.name}</span>
                <div style="flex:1; height:8px; background:rgba(255,255,255,0.05); border-radius:4px; overflow:hidden;">
                    <div style="width:${pct}%; height:100%; background:${info.color}; border-radius:4px; transition:width 0.5s;"></div>
                </div>
                <span style="font-family:'JetBrains Mono',monospace; font-size:12px; font-weight:600; min-width:45px; color:${info.color};">${pct}%</span>
                ${changed ? `<span style="font-size:9px; color:${arrowColor};" title="Default: ${defPct}%">${arrow}</span>` : ''}
            </div>`;
        }

        html += `<div style="margin-top:12px; font-size:10px; color:var(--text-muted);">Weights adjust automatically as the model learns from past predictions. Default weights shown with ▲▼ arrows.</div>`;
        html += '</div>';

        // Right: Learning Metrics
        html += '<div>';
        html += '<div style="font-size:13px; font-weight:600; margin-bottom:14px; color:var(--text-bright);">🧠 Learning Metrics</div>';

        const statCards = [
            { label: 'Status', value: summary.evaluated > 0 ? 'Active' : 'Learning', color: summary.evaluated > 0 ? 'var(--green-pos)' : 'var(--accent-amber)' },
            { label: 'Predictions Logged', value: summary.totalPredictions, color: 'var(--accent-cyan)' },
            { label: 'Evaluated', value: summary.evaluated, color: 'var(--accent-violet)' },
            { label: 'Pending', value: summary.pending, color: 'var(--accent-orange)' },
            { label: 'Hit Rate (Top 3)', value: summary.evaluated > 0 ? summary.hitRate + '%' : 'N/A', color: 'var(--green-pos)' },
            { label: 'Avg Rank Error', value: summary.evaluated > 0 ? summary.avgError : 'N/A', color: 'var(--accent-amber)' }
        ];

        html += '<div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:8px;">';
        for (const stat of statCards) {
            html += `<div style="background:var(--bg-glass); border:1px solid var(--border-glass); border-radius:var(--radius-sm); padding:12px; text-align:center;">
                <div style="font-size:9px; color:var(--text-muted); text-transform:uppercase; letter-spacing:0.5px; margin-bottom:4px;">${stat.label}</div>
                <div style="font-size:16px; font-weight:700; color:${stat.color}; font-family:'JetBrains Mono',monospace;">${stat.value}</div>
            </div>`;
        }
        html += '</div>';

        // How it works explanation
        html += `<div style="margin-top:14px; padding:12px; background:linear-gradient(135deg, rgba(6,182,212,0.05), rgba(99,102,241,0.05)); border:1px solid rgba(6,182,212,0.15); border-radius:var(--radius-sm); font-size:10px; line-height:1.6; color:var(--text-secondary);">
            <strong style="color:var(--text-bright);">How Self-Learning Works:</strong><br>
            1. Every month, the AI logs its sector predictions<br>
            2. When actual data arrives, it compares prediction vs reality<br>
            3. Factors that were accurate get <span style="color:var(--green-pos);">more weight ▲</span><br>
            4. Factors that were wrong get <span style="color:var(--red-neg);">less weight ▼</span><br>
            5. Over time, the model becomes <strong style="color:var(--accent-cyan);">more accurate</strong>
        </div>`;

        html += '</div></div>';
        container.innerHTML = html;
    }

    function createStatCard(label, value, sub, color) {
        return `<div style="
            background: var(--bg-glass);
            border: 1px solid var(--border-glass);
            border-radius: var(--radius-sm);
            padding: 14px;
            text-align: center;
            border-top: 2px solid ${color};
        ">
            <div style="font-size:10px; color:var(--text-muted); text-transform:uppercase; letter-spacing:0.5px; margin-bottom:6px;">${label}</div>
            <div style="font-size:16px; font-weight:700; color:${color}; margin-bottom:4px;">${value}</div>
            <div style="font-size:10px; color:var(--text-secondary);">${sub}</div>
        </div>`;
    }


    // ─────────────────────────────────────────────
    // SCORE BREAKDOWN
    // ─────────────────────────────────────────────

    function renderBreakdown() {
        const container = document.getElementById('breakdownBody');

        let html = '<div style="overflow-x:auto;">';
        html += '<table style="width:100%; font-size:12px; border-collapse:separate; border-spacing:0 4px;">';
        html += `<tr style="color:var(--text-muted); font-size:10px; text-transform:uppercase; letter-spacing:0.5px;">
            <th style="text-align:left; padding:8px 12px;">Sector</th>
            <th style="text-align:center; padding:8px;">Composite</th>
            <th style="text-align:center; padding:8px;">Momentum</th>
            <th style="text-align:center; padding:8px;">Rel Str</th>
            <th style="text-align:center; padding:8px;">MACD</th>
            <th style="text-align:center; padding:8px;">FII/DII</th>
            <th style="text-align:center; padding:8px;">RSI</th>
            <th style="text-align:center; padding:8px;">BB Pos</th>
            <th style="text-align:center; padding:8px;">PCR</th>
            <th style="text-align:center; padding:8px;">Breakout</th>
        </tr>`;

        for (const r of rankings) {
            const compositeColor = getScoreColor(r.composite);
            const adv = r.advanced || {};
            const macdTrend = adv.macd?.trend || 'neutral';
            const macdColor = macdTrend.includes('bullish') ? 'var(--green-pos)' : macdTrend.includes('bearish') ? 'var(--red-neg)' : 'var(--text-muted)';
            const fiiFlow = adv.institutionalFlow?.netFlow || 'neutral';
            const fiiColor = fiiFlow.includes('inflow') ? 'var(--green-pos)' : fiiFlow.includes('outflow') ? 'var(--red-neg)' : 'var(--text-muted)';
            const bbPos = adv.bollingerBands?.position ?? 50;
            const bbLabel = bbPos > 80 ? 'OB' : bbPos < 20 ? 'OS' : 'Mid';
            const bbColor = bbPos > 80 ? 'var(--red-neg)' : bbPos < 20 ? 'var(--green-pos)' : 'var(--text-secondary)';
            const pcr = adv.pcr?.pcr ?? 1.0;
            const pcrSent = adv.pcr?.sentiment || 'neutral';
            const pcrColor = pcrSent === 'fearful' ? 'var(--green-pos)' : pcrSent === 'greedy' ? 'var(--red-neg)' : 'var(--text-secondary)';

            html += `<tr style="background:var(--bg-glass); border-radius:8px;">
                <td style="padding:10px 12px; font-weight:500;">
                    <span style="color:${r.color}">●</span> ${r.name}
                </td>
                <td style="text-align:center; padding:8px;">
                    <span style="font-weight:700; font-size:16px; color:${compositeColor}; font-family:'JetBrains Mono',monospace;">${r.composite}</span>
                </td>
                <td style="text-align:center; padding:8px;">${createMiniBar(r.momentum, '#6366f1')}</td>
                <td style="text-align:center; padding:8px;">${createMiniBar(r.relativeStrength, '#06b6d4')}</td>
                <td style="text-align:center; padding:8px;">
                    <span style="color:${macdColor}; font-size:10px; font-weight:600;">${macdTrend.replace('_', ' ').toUpperCase()}</span>
                </td>
                <td style="text-align:center; padding:8px;">
                    <span style="color:${fiiColor}; font-size:10px; font-weight:600;">${fiiFlow.replace('_', ' ').toUpperCase()}</span>
                </td>
                <td style="text-align:center; padding:8px; font-family:'JetBrains Mono',monospace; font-size:11px; color:${r.rsi > 70 ? 'var(--red-neg)' : r.rsi < 30 ? 'var(--green-pos)' : 'var(--text-secondary)'}">
                    ${r.rsi.toFixed(1)}
                </td>
                <td style="text-align:center; padding:8px;">
                    <span style="color:${bbColor}; font-size:10px; font-weight:600;">${bbLabel} (${bbPos}%)</span>
                </td>
                <td style="text-align:center; padding:8px; font-family:'JetBrains Mono',monospace; font-size:11px; color:${pcrColor}">
                    ${pcr} <span style="font-size:8px;">${pcrSent}</span>
                </td>
                <td style="text-align:center; padding:8px;">
                    ${getBreakoutBadge(r.breakout.type)}
                </td>
            </tr>`;
        }

        html += '</table></div>';
        container.innerHTML = html;
    }

    function createMiniBar(value, color) {
        return `<div style="display:flex; align-items:center; gap:6px; justify-content:center;">
            <div style="width:50px; height:6px; background:rgba(255,255,255,0.05); border-radius:3px; overflow:hidden;">
                <div style="width:${value}%; height:100%; background:${color}; border-radius:3px; transition:width 1s ease;"></div>
            </div>
            <span style="font-family:'JetBrains Mono',monospace; font-size:10px; color:var(--text-secondary); min-width:24px;">${value}</span>
        </div>`;
    }

    function getBreakoutBadge(type) {
        const badges = {
            'golden_cross': '<span style="color:#22c55e; font-size:10px; font-weight:600;">🟢 Golden Cross</span>',
            'bullish_trend': '<span style="color:#4ade80; font-size:10px;">📈 Bullish</span>',
            'bearish_trend': '<span style="color:#ef4444; font-size:10px;">📉 Bearish</span>',
            'neutral': '<span style="color:var(--text-muted); font-size:10px;">➖ Neutral</span>'
        };
        return badges[type] || badges['neutral'];
    }


    // ─────────────────────────────────────────────
    // STOCK SCREENER INTEGRATION
    // ─────────────────────────────────────────────

    let screenerResults = null;
    let stockPriceData = null;
    let currentStockFilter = 'ALL';

    async function initStockScreener() {
        try {
            updateLoadingText('Fetching stock price data...');
            stockPriceData = await fetchStockPriceData();
        } catch (e) {
            console.log('Stock price data unavailable, using analysis without live prices:', e.message);
            stockPriceData = {};
        }

        try {
            updateLoadingText('Running 6-step institutional screening...');
            screenerResults = StockScreener.runFullScreening(rankings, stockPriceData);

            renderMacroSummary();
            renderSectorRotation();
            renderStockPicks('ALL');
            renderScoringTable();
            renderDataValidation();
            setupStockSectorTabs();
        } catch (e) {
            console.error('Stock screener error:', e);
        }
    }

    async function fetchStockPriceData() {
        const response = await fetch('/api/stock-data');
        const json = await response.json();
        if (!json.success || !json.data) return {};

        // Convert date strings for compatibility
        const formatted = {};
        for (const [symbol, records] of Object.entries(json.data)) {
            formatted[symbol] = records.map(r => ({
                ...r,
                date: new Date(r.date),
                dateStr: r.dateStr || new Date(r.date).toISOString().split('T')[0]
            }));
        }
        return formatted;
    }

    // ── Macro Summary ──
    function renderMacroSummary() {
        if (!screenerResults) return;
        const macro = screenerResults.macro;
        const container = document.getElementById('macroBody');
        const badge = document.getElementById('regimeBadge');

        const regimeColors = {
            'Bullish': { bg: 'rgba(34,197,94,0.15)', color: 'var(--green-pos)', border: 'rgba(34,197,94,0.3)', emoji: '📈', cls: 'regime-bullish' },
            'Bearish': { bg: 'rgba(239,68,68,0.15)', color: 'var(--red-neg)', border: 'rgba(239,68,68,0.3)', emoji: '📉', cls: 'regime-bearish' },
            'Sideways': { bg: 'rgba(234,179,8,0.15)', color: 'var(--accent-amber)', border: 'rgba(234,179,8,0.3)', emoji: '↔️', cls: 'regime-sideways' },
            'Transition': { bg: 'rgba(139,92,246,0.15)', color: 'var(--accent-violet)', border: 'rgba(139,92,246,0.3)', emoji: '🔄', cls: 'regime-transition' }
        };
        const rc = regimeColors[macro.regime] || regimeColors['Sideways'];

        badge.style.background = rc.bg;
        badge.style.color = rc.color;
        badge.style.borderColor = rc.border;
        badge.textContent = `${macro.regime} (${macro.regimeConfidence}% conf)`;

        let html = `<div class="macro-regime-banner">
            <div class="regime-indicator ${rc.cls}">${rc.emoji}</div>
            <div style="flex:1;">
                <div style="font-size:18px; font-weight:700; color:${rc.color}; margin-bottom:4px;">${macro.regime} Market</div>
                <div style="font-size:12px; color:var(--text-secondary); line-height:1.6;">${macro.forwardOutlook}</div>
            </div>
        </div>`;

        // Key macro details
        html += `<div style="display:grid; grid-template-columns:repeat(5,1fr); gap:8px; margin-bottom:14px;">
            ${macroStatCard('RBI', macro.details.rbiStance, 'var(--accent-indigo)')}
            ${macroStatCard('CPI', macro.details.cpiTrend, 'var(--accent-amber)')}
            ${macroStatCard('GDP', macro.details.gdpOutlook, 'var(--green-pos)')}
            ${macroStatCard('Liquidity', macro.details.liquidity, 'var(--accent-cyan)')}
            ${macroStatCard('Global', macro.details.globalCues, 'var(--accent-orange)')}
        </div>`;

        // Drivers
        html += '<div class="macro-drivers">';
        macro.keyDrivers.forEach(d => {
            html += `<div class="macro-driver-pill">${d}</div>`;
        });
        html += '</div>';

        container.innerHTML = html;
    }

    function macroStatCard(label, value, color) {
        return `<div style="background:var(--bg-glass); border:1px solid var(--border-glass); border-radius:var(--radius-sm); padding:10px; text-align:center; border-top:2px solid ${color};">
            <div style="font-size:9px; color:var(--text-muted); text-transform:uppercase; letter-spacing:0.5px; margin-bottom:4px;">${label}</div>
            <div style="font-size:11px; font-weight:600; color:var(--text-bright);">${value}</div>
        </div>`;
    }

    // ── Sector Rotation Pipeline ──
    function renderSectorRotation() {
        if (!screenerResults) return;
        const sc = screenerResults.sectorClassification;
        const container = document.getElementById('sectorRotationBody');

        const stages = { 'Leading': [], 'Improving': [], 'Weakening': [], 'Lagging': [] };
        for (const [key, data] of Object.entries(sc)) {
            stages[data.category].push({ key, ...data });
        }

        let html = '<div class="rotation-pipeline">';
        for (const [stage, sectors] of Object.entries(stages)) {
            const stageClass = `stage-${stage.toLowerCase()}`;
            html += `<div class="rotation-stage ${stageClass}">
                <div class="stage-title">${stage}</div>`;
            if (sectors.length === 0) {
                html += '<div style="font-size:11px; color:var(--text-muted); padding:8px;">None</div>';
            }
            for (const s of sectors) {
                const selected = screenerResults.topSectors.includes(s.key);
                const border = selected ? 'border:1px solid var(--accent-cyan);' : '';
                const selBadge = selected ? ' ⭐' : '';
                html += `<div class="stage-sector" style="${border}">
                    <span>${s.name}${selBadge}</span>
                    <span class="stage-score" style="color:${getScoreColor(s.composite)}">${s.composite}</span>
                </div>`;
            }
            html += '</div>';
        }
        html += '</div>';

        container.innerHTML = html;
    }

    // ── Stock Picks ──
    function renderStockPicks(filter) {
        if (!screenerResults) return;
        const container = document.getElementById('stockPicksBody');
        currentStockFilter = filter;

        let stocks = screenerResults.allStockAnalysis;
        if (filter === 'QUALIFIED') {
            stocks = screenerResults.qualifiedPicks;
        } else if (filter !== 'ALL') {
            stocks = stocks.filter(s => s.sector === filter);
        }

        if (stocks.length === 0) {
            container.innerHTML = '<div class="screener-loading">No stocks match this filter.</div>';
            return;
        }

        // Show top 3 banner if viewing all qualified
        let html = '';
        if ((filter === 'ALL' || filter === 'QUALIFIED') && screenerResults.top3Picks.length > 0) {
            html += '<div style="margin-bottom:16px; padding:12px 16px; background:linear-gradient(135deg, rgba(245,158,11,0.1), rgba(99,102,241,0.05)); border:1px solid rgba(245,158,11,0.2); border-radius:var(--radius-md);">';
            html += '<div style="font-size:12px; font-weight:700; color:var(--accent-amber); margin-bottom:8px;">🏆 TOP 3 HIGHEST CONVICTION PICKS</div>';
            html += '<div style="display:flex; gap:12px; flex-wrap:wrap;">';
            screenerResults.top3Picks.forEach((p, i) => {
                html += `<div style="padding:6px 14px; background:var(--bg-glass); border:1px solid rgba(245,158,11,0.3); border-radius:20px; font-size:12px;">
                    <span style="font-weight:700; color:var(--accent-amber);">#${i+1}</span>
                    <span style="font-weight:600; color:var(--text-bright); margin:0 6px;">${p.name}</span>
                    <span style="color:${p.finalScore.verdictColor}; font-weight:600;">${p.finalScore.total}/40</span>
                </div>`;
            });
            html += '</div></div>';
        }

        html += '<div class="stock-cards-grid">';
        stocks.slice(0, 20).forEach(s => {
            html += renderStockCard(s);
        });
        html += '</div>';

        container.innerHTML = html;
    }

    function renderStockCard(s) {
        const isTopPick = screenerResults.top3Picks.some(t => t.key === s.key);
        const isQualified = s.finalScore.qualified && s.fundamentalGate.qualified;
        const cardClass = isTopPick ? 'stock-card top-pick-card' : isQualified ? 'stock-card qualified-card' : 'stock-card';

        const inst = s.institutional;
        const fiiTrendClass = inst.fiiTrend === 'increasing' ? 'trend-up' : inst.fiiTrend === 'decreasing' ? 'trend-down' : 'trend-flat';
        const diiTrendClass = inst.diiTrend === 'increasing' ? 'trend-up' : inst.diiTrend === 'decreasing' ? 'trend-down' : 'trend-flat';

        let html = `<div class="${cardClass}">`;
        if (isTopPick) html += '<div style="position:absolute; top:8px; right:8px; font-size:16px;">🏆</div>';

        // Header
        html += `<div class="stock-card-header">
            <div>
                <div class="stock-name">${s.name}</div>
                <span class="stock-sector-tag" style="background:${s.sectorColor}22; color:${s.sectorColor}; border:1px solid ${s.sectorColor}44;">${s.sectorName}</span>
                ${s.hasLiveData ? '<span style="font-size:9px; color:var(--green-pos); margin-left:4px;">● LIVE</span>' : ''}
            </div>
            <div class="verdict-badge" style="background:${s.finalScore.verdictColor}22; color:${s.finalScore.verdictColor}; border:1px solid ${s.finalScore.verdictColor}44;">
                ${s.finalScore.verdictEmoji} ${s.finalScore.verdict}
            </div>
        </div>`;

        // Score row
        const sc = s.finalScore;
        html += `<div class="stock-scores-row">
            <div class="score-mini"><div class="score-mini-label">Sector</div><div class="score-mini-value" style="color:${scoreMiniColor(sc.sectorScore)}">${sc.sectorScore}</div></div>
            <div class="score-mini"><div class="score-mini-label">Fundamental</div><div class="score-mini-value" style="color:${scoreMiniColor(sc.fundamentalScore)}">${sc.fundamentalScore}</div></div>
            <div class="score-mini"><div class="score-mini-label">Technical</div><div class="score-mini-value" style="color:${scoreMiniColor(sc.technicalScore)}">${sc.technicalScore}</div></div>
            <div class="score-mini"><div class="score-mini-label">Risk-Reward</div><div class="score-mini-value" style="color:${scoreMiniColor(sc.riskScore)}">${sc.riskScore}</div></div>
        </div>`;
        html += `<div style="text-align:center; font-size:13px; margin-bottom:8px;">
            <span style="font-weight:700; font-family:'JetBrains Mono',monospace; font-size:18px; color:${sc.verdictColor};">${sc.total}</span>
            <span style="color:var(--text-muted);">/40</span>
        </div>`;

        // FII/DII
        html += `<div class="stock-fii-dii">
            <span class="fii-pill ${fiiTrendClass}">FII: ${inst.fiiHolding}% (${inst.fiiChange > 0 ? '+' : ''}${inst.fiiChange}%)</span>
            <span class="dii-pill ${diiTrendClass}">DII: ${inst.diiHolding}% (${inst.diiChange > 0 ? '+' : ''}${inst.diiChange}%)</span>
        </div>`;

        // Fundamental gates (compact)
        html += '<div class="stock-gates">';
        for (const [key, gate] of Object.entries(s.fundamentalGate.gates)) {
            const cls = gate.pass ? 'gate-pass' : 'gate-fail';
            const icon = gate.pass ? '✓' : '✗';
            html += `<span class="gate-pill ${cls}" title="${gate.label}: ${gate.value}">${icon} ${gate.label.split(' ')[0]}</span>`;
        }
        html += '</div>';

        // Technical summary (if live data)
        if (s.hasLiveData && s.technical.currentPrice > 0) {
            const t = s.technical;
            html += `<div class="stock-technicals">
                <div class="tech-row"><span class="tech-label">Price</span><span class="tech-value">₹${t.currentPrice.toLocaleString()}</span></div>
                <div class="tech-row"><span class="tech-label">RSI</span><span class="tech-value" style="color:${t.rsi > 70 ? 'var(--red-neg)' : t.rsi < 30 ? 'var(--green-pos)' : 'var(--text-secondary)'}">${t.rsi}</span></div>
                <div class="tech-row"><span class="tech-label">Trend</span><span class="tech-value">${t.trend}</span></div>
                <div class="tech-row"><span class="tech-label">Setup</span><span class="tech-value">${t.setup.type.replace(/_/g, ' ')}</span></div>
                <div class="tech-row"><span class="tech-label">R:R</span><span class="tech-value" style="color:${s.riskReward.rrRatio >= 2 ? 'var(--green-pos)' : 'var(--accent-amber)'}">1:${s.riskReward.rrRatio}</span></div>
            </div>`;

            // Entry / SL / Target
            html += `<div class="stock-entry-sl-target">
                <div class="est-box est-entry"><div class="est-label">Entry</div><div class="est-value" style="color:var(--green-pos);">₹${t.entryRange.low}-${t.entryRange.high}</div></div>
                <div class="est-box est-sl"><div class="est-label">Stop Loss</div><div class="est-value" style="color:var(--red-neg);">₹${t.stopLoss}</div></div>
                <div class="est-box est-target"><div class="est-label">Target</div><div class="est-value" style="color:var(--accent-cyan);">₹${t.targets.t2}</div></div>
            </div>`;
        }

        html += '</div>';
        return html;
    }

    function scoreMiniColor(score) {
        if (score >= 8) return 'var(--green-pos)';
        if (score >= 6) return 'var(--accent-cyan)';
        if (score >= 4) return 'var(--accent-amber)';
        return 'var(--red-neg)';
    }

    function setupStockSectorTabs() {
        const tabs = document.querySelectorAll('#stockSectorTabs .tab-btn');
        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                tabs.forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                renderStockPicks(tab.dataset.sector);
            });
        });
    }

    // ── Scoring Table ──
    function renderScoringTable() {
        if (!screenerResults) return;
        const container = document.getElementById('scoringTableBody');
        const table = screenerResults.scoringTable;

        let html = '<div style="overflow-x:auto;"><table class="scoring-table">';
        html += `<tr>
            <th style="min-width:160px;">Stock</th><th>Sector</th>
            <th>Sector /10</th><th>Fund /10</th><th>Tech /10</th><th>Risk /10</th>
            <th style="min-width:80px;">Total /40</th><th>Verdict</th>
        </tr>`;

        table.forEach(row => {
            const rowClass = row.qualified ? 'qualified-row' : 'rejected-row';
            const totalColor = row.total >= 30 ? 'var(--green-pos)' : row.total >= 24 ? 'var(--accent-amber)' : 'var(--red-neg)';
            html += `<tr class="${rowClass}" style="background:var(--bg-glass); border-radius:8px;">
                <td style="font-weight:600;">${row.name}</td>
                <td style="font-size:10px; color:var(--text-muted);">${row.sector}</td>
                <td>${scoreCell(row.sectorScore, 10, 'var(--accent-indigo)')}</td>
                <td>${scoreCell(row.fundamentalScore, 10, 'var(--accent-emerald)')}</td>
                <td>${scoreCell(row.technicalScore, 10, 'var(--accent-cyan)')}</td>
                <td>${scoreCell(row.riskScore, 10, 'var(--accent-amber)')}</td>
                <td style="font-weight:700; font-size:16px; color:${totalColor}; font-family:'JetBrains Mono',monospace;">${row.total}</td>
                <td><span class="verdict-badge" style="font-size:10px;">${row.verdictEmoji} ${row.verdict}</span></td>
            </tr>`;
        });

        html += '</table></div>';
        container.innerHTML = html;
    }

    function scoreCell(value, max, color) {
        const pct = (value / max) * 100;
        return `<span style="font-family:'JetBrains Mono',monospace; font-weight:600; font-size:12px;">${value}</span>
            <div class="score-bar-cell"><div class="score-bar-fill" style="width:${pct}%; background:${color};"></div></div>`;
    }

    // ── Data Validation ──
    function renderDataValidation() {
        if (!screenerResults) return;
        const container = document.getElementById('dataValidationBody');
        const meta = screenerResults.dataValidation;

        let html = '<div class="validation-grid">';

        // Live data
        html += `<div class="validation-section">
            <div class="validation-title" style="color:var(--green-pos);">🟢 Live Data (Real-time)</div>`;
        meta.liveData.forEach(item => {
            html += `<div class="validation-item"><span style="color:var(--green-pos);">✓</span> ${item}</div>`;
        });
        html += '</div>';

        // Curated data
        html += `<div class="validation-section">
            <div class="validation-title" style="color:var(--accent-amber);">📋 Pre-Curated Research</div>`;
        meta.curatedData.forEach(item => {
            html += `<div class="validation-item"><span style="color:var(--accent-amber);">◎</span> ${item}</div>`;
        });
        html += `<div class="validation-item" style="margin-top:8px; font-weight:600;">Last updated: ${meta.lastResearchUpdate}</div>`;
        html += '</div>';

        // Limitations
        html += `<div class="validation-section" style="grid-column:1/-1;">
            <div class="validation-title" style="color:var(--accent-orange);">⚠️ Known Limitations</div>`;
        meta.limitations.forEach(lim => {
            html += `<div class="validation-item"><span style="color:var(--accent-orange);">!</span> ${lim}</div>`;
        });
        html += '</div></div>';

        container.innerHTML = html;
    }


    // ─────────────────────────────────────────────
    // PUBLIC API
    // ─────────────────────────────────────────────

    return {
        init,
        toggleSeasonalityView,
        manualRefresh
    };

})();

// Boot
document.addEventListener('DOMContentLoaded', Dashboard.init);
