/* Auto.html / TeleOp.html / Total.html — shared ranking logic
   Each page loads this then calls Scout694Ranking.init(metricKey, metricLabel). */
/* global Scout694 */
window.Scout694Ranking = (function(){
    'use strict';
    var S = window.Scout694;
    var esc = S.escapeHtml;
    var _reportsCache = [];

    function computeRankings(eventVal, metricKey){
        var reports = _reportsCache.filter(function(r){ return eventVal === 'ALL' || r.event === eventVal; });
        var byTeam = {};
        reports.forEach(function(r){
            if(r.noShow) return;   // no-shows autofill zero and shouldn't drag averages
            var key = String(r.team || '').trim();
            if(!key) return;
            if(!byTeam[key]) byTeam[key] = { team: key, matches: 0, autoSum: 0, teleopSum: 0, totalSum: 0 };
            byTeam[key].matches += 1;
            byTeam[key].autoSum += (r.auto || 0);
            byTeam[key].teleopSum += (r.teleop || 0);
            byTeam[key].totalSum += (r.total || 0);
        });
        var rows = Object.keys(byTeam).map(function(k){
            var t = byTeam[k];
            return {
                team: t.team,
                matches: t.matches,
                avgAuto: t.autoSum / t.matches,
                avgTeleop: t.teleopSum / t.matches,
                avgTotal: t.totalSum / t.matches
            };
        });
        var metricProp = 'avg' + metricKey.charAt(0).toUpperCase() + metricKey.slice(1);
        rows.sort(function(a, b){
            if(b[metricProp] !== a[metricProp]) return b[metricProp] - a[metricProp];
            return b.avgTotal - a.avgTotal;
        });
        return rows;
    }

    function render(metricKey, metricLabel){
        var eventVal = document.getElementById('eventSelect').value;
        var body = document.getElementById('resultsBody');
        var summary = document.getElementById('resultsSummary');
        var rows = computeRankings(eventVal, metricKey);
        body.innerHTML = '';
        var eventLabel = (eventVal === 'ALL') ? 'across all events' : 'at ' + eventVal;

        if(!rows.length){
            summary.textContent = 'No scouting data recorded yet ' + eventLabel + '.';
            body.innerHTML = '<tr class="empty-row"><td colspan="6">No teams ranked yet.</td></tr>';
            return;
        }

        summary.textContent = 'Ranking ' + rows.length + ' team' + (rows.length === 1 ? '' : 's') +
            ' ' + eventLabel + ' by ' + metricLabel + '.';

        rows.forEach(function(r, idx){
            var tr = document.createElement('tr');
            if(idx === 0) tr.className = 'rank-1';
            var cls = function(key){ return (metricKey === key) ? 'num-cell metric-cell' : 'num-cell'; };
            tr.innerHTML =
                '<td class="num-cell">' + (idx + 1) + '</td>' +
                '<td class="num-cell">' + esc(r.team) + '</td>' +
                '<td class="' + cls('auto') + '">' + r.avgAuto.toFixed(1) + '</td>' +
                '<td class="' + cls('teleop') + '">' + r.avgTeleop.toFixed(1) + '</td>' +
                '<td class="' + cls('total') + '">' + r.avgTotal.toFixed(1) + '</td>' +
                '<td class="num-cell">' + r.matches + '</td>';
            body.appendChild(tr);
        });
    }

    function init(metricKey, metricLabel){
        S.initEventUI({ allowAll: true, onChange: function(){ render(metricKey, metricLabel); } });
        S.ready(function(){
            if(!window.db) return;
            window.db.collection('reports').onSnapshot(function(snap){
                _reportsCache = snap.docs.map(function(d){ return d.data(); });
                render(metricKey, metricLabel);
            }, function(err){
                console.error(err);
                document.getElementById('resultsSummary').textContent = 'Could not load shared data.';
            });
        });
    }

    return { init: init };
})();
