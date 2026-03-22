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

        updateLoadingText('Running analytics engine...');
        await runAnalyticsAndRender();

        // Setup auto-refresh (every 15 min during market hours)
        startAutoRefresh();

        // Hide loading
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
            <th style="text-align:center; padding:8px;">Momentum (30%)</th>
            <th style="text-align:center; padding:8px;">Relative Str (30%)</th>
            <th style="text-align:center; padding:8px;">Volume (20%)</th>
            <th style="text-align:center; padding:8px;">Trend (20%)</th>
            <th style="text-align:center; padding:8px;">RSI</th>
            <th style="text-align:center; padding:8px;">RS Ratio</th>
            <th style="text-align:center; padding:8px;">Vol Spike</th>
            <th style="text-align:center; padding:8px;">Breakout</th>
        </tr>`;

        for (const r of rankings) {
            const compositeColor = getScoreColor(r.composite);
            html += `<tr style="background:var(--bg-glass); border-radius:8px;">
                <td style="padding:10px 12px; font-weight:500;">
                    <span style="color:${r.color}">●</span> ${r.name}
                </td>
                <td style="text-align:center; padding:8px;">
                    <span style="font-weight:700; font-size:16px; color:${compositeColor}; font-family:'JetBrains Mono',monospace;">${r.composite}</span>
                </td>
                <td style="text-align:center; padding:8px;">${createMiniBar(r.momentum, '#6366f1')}</td>
                <td style="text-align:center; padding:8px;">${createMiniBar(r.relativeStrength, '#06b6d4')}</td>
                <td style="text-align:center; padding:8px;">${createMiniBar(r.volume, '#f59e0b')}</td>
                <td style="text-align:center; padding:8px;">${createMiniBar(r.trend, '#10b981')}</td>
                <td style="text-align:center; padding:8px; font-family:'JetBrains Mono',monospace; font-size:11px; color:${r.rsi > 70 ? 'var(--red-neg)' : r.rsi < 30 ? 'var(--green-pos)' : 'var(--text-secondary)'}">
                    ${r.rsi.toFixed(1)}
                </td>
                <td style="text-align:center; padding:8px; font-family:'JetBrains Mono',monospace; font-size:11px; color:${r.rsRatio > 1 ? 'var(--green-pos)' : 'var(--red-neg)'}">
                    ${r.rsRatio.toFixed(3)}
                </td>
                <td style="text-align:center; padding:8px;">
                    ${r.volumeSpike ? `<span style="color:var(--accent-amber)">⚡ ${r.volumeRatio}x</span>` : `<span style="color:var(--text-muted)">${r.volumeRatio}x</span>`}
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
