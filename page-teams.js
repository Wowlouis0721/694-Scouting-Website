/* teams.html — page logic (loads after shared.js) */
/* global Scout694 */
(function(){
    'use strict';
    var S = window.Scout694;
    var esc = S.escapeHtml;

    var _reportsCache = [];
    var _reportsLoaded = false;

    var SHIFT_KEYS = [['auto','AUTO'],['s1','S1'],['s2','S2'],['s3','S3'],['s4','S4'],['s5','S5'],['s6','S6']];

    function shiftLine(r){
        if(!r.shifts) return '';
        return SHIFT_KEYS.map(function(k){
            var s = r.shifts[k[0]] || {};
            return k[1] + ' ' + (s.shoot || 0) + '/' + (s.ferry || 0);
        }).join(' · ') + '   (shoot/ferry)';
    }

    function allianceCell(r){
        if(r.alliance === 'red') return '<span class="ally-red">RED</span>';
        if(r.alliance === 'blue') return '<span class="ally-blue">BLUE</span>';
        return '—';
    }

    function runSearch(){
        var eventVal = document.getElementById('eventSelect').value;
        var teamVal = document.getElementById('teamNumber').value.trim();
        var resultsPanel = document.getElementById('resultsPanel');
        var body = document.getElementById('resultsBody');
        var summary = document.getElementById('resultsSummary');

        if(!teamVal){ S.showToast('Enter a team number to search.', true); return; }
        if(!_reportsLoaded){ S.showToast('Still loading shared data — try again in a moment.', true); return; }

        loadPit(teamVal, eventVal);

        var matches = _reportsCache
            .filter(function(r){ return String(r.team).trim() === teamVal && (eventVal === 'ALL' || r.event === eventVal); })
            .sort(function(a, b){
                /* playoffs sit above quals, then highest match first */
                var ap = (a.matchType === 'playoff') ? 1 : 0, bp = (b.matchType === 'playoff') ? 1 : 0;
                if(ap !== bp) return bp - ap;
                if((a.match || 0) !== (b.match || 0)) return (b.match || 0) - (a.match || 0);
                return new Date(b.timestamp) - new Date(a.timestamp);
            });

        resultsPanel.hidden = false;
        body.innerHTML = '';
        var eventLabel = (eventVal === 'ALL') ? 'across all events' : 'at ' + eventVal;

        if(matches.length === 0){
            summary.textContent = 'No scouting reports found for Team ' + teamVal + ' ' + eventLabel + '.';
            var tr = document.createElement('tr');
            tr.className = 'empty-row';
            tr.innerHTML = '<td colspan="13">No matches recorded yet.</td>';
            body.appendChild(tr);
            return;
        }

        var n = matches.length;
        var avg = function(f){ return (matches.reduce(function(s, r){ return s + (f(r) || 0); }, 0) / n).toFixed(1); };
        var brokeN = matches.filter(function(r){ return r.broke; }).length;
        summary.textContent = 'Showing ' + n + ' report' + (n === 1 ? '' : 's') + ' for Team ' + teamVal + ' ' + eventLabel +
            ' · Avg auto ' + avg(function(r){ return r.auto; }) +
            ' · Avg teleop ' + avg(function(r){ return r.teleop; }) +
            ' · Avg total ' + avg(function(r){ return r.total; }) +
            (brokeN ? ' · Broke in ' + brokeN + '/' + n : '');

        matches.forEach(function(r){
            var tr = document.createElement('tr');
            tr.innerHTML =
                '<td class="num-cell">' + esc(S.reportMatchLabel(r)) + (r.noShow ? ' <span class="flag-yes">NS</span>' : '') + '</td>' +
                '<td>' + esc(r.event) + '</td>' +
                '<td class="num-cell">' + allianceCell(r) + '</td>' +
                '<td>' + esc(r.startPosLabel || (r.noShow ? 'no show' : '')) + '</td>' +
                '<td class="num-cell">' + esc(r.auto) + '</td>' +
                '<td class="num-cell">' + esc(r.teleop) + '</td>' +
                '<td class="num-cell">' + esc(r.ferried) + '</td>' +
                '<td class="num-cell total-cell">' + esc(r.total) + '</td>' +
                '<td class="num-cell">' + esc(r.fouls) + '</td>' +
                '<td class="num-cell">' + (r.defensePlayed ? esc(r.defenseRating) + '/10' : '—') + '</td>' +
                '<td>' + (r.broke ? '<span class="flag-yes">YES</span>' : '—') + '</td>' +
                '<td>' + esc(r.scout) + '</td>' +
                '<td class="num-cell">' + S.fmtWhen(r.timestamp) + '</td>';
            body.appendChild(tr);

            var bits = [];
            var sl = shiftLine(r);
            if(sl) bits.push(sl);
            if(r.defensePlayed && r.defense) bits.push('Defended: ' + esc(r.defense));
            if(r.broke) bits.push('Broke: ' + esc((r.brokeTags || []).join(', ') || 'untagged') + (r.brokeTime ? ' @ ' + esc(r.brokeTime) : ''));
            if(r.notes) bits.push('“' + esc(r.notes) + '”');
            if(!r.shifts && r.defense && !r.defensePlayed) bits.push('Defended: ' + esc(r.defense));  /* legacy reports */
            if(bits.length){
                var dr = document.createElement('tr');
                dr.className = 'detail-row';
                dr.innerHTML = '<td colspan="13">' + bits.join('&nbsp;&nbsp;·&nbsp;&nbsp;') + '</td>';
                body.appendChild(dr);
            }
        });
    }

    /* ---------- pit card for the searched team ---------- */
    function loadPit(teamVal, eventVal){
        var panel = document.getElementById('pitPanel');
        var cards = document.getElementById('pitCards');
        var sum = document.getElementById('pitSummary');
        if(!window.db){ panel.hidden = true; return; }
        window.db.collection('pit').where('team', '==', teamVal).get().then(function(snap){
            var docs = snap.docs.map(function(d){ return d.data(); })
                .filter(function(p){ return eventVal === 'ALL' || p.event === eventVal; });
            if(!docs.length){ panel.hidden = true; return; }
            panel.hidden = false;
            sum.textContent = docs.length + ' pit entr' + (docs.length === 1 ? 'y' : 'ies') + ' for Team ' + teamVal + '.';
            cards.innerHTML = '';
            docs.forEach(function(p){ cards.appendChild(pitCard(p)); });
        }).catch(function(){ panel.hidden = true; });
    }
    function pitCard(p){
        var card = document.createElement('div');
        card.className = 'pit-card';
        card.innerHTML =
            '<h3><span>' + esc(p.team) + '</span></h3>' +
            '<p class="pit-line"><b>' + esc(p.event) + '</b></p>' +
            '<p class="pit-line">Drivetrain: <b>' + esc(p.drivetrain) + '</b></p>' +
            '<p class="pit-line">Max hopper: <b>' + esc(p.hopper) + '</b> · Specialist: <b>' + esc(p.specialist) + '</b></p>' +
            (p.weight ? '<p class="pit-line">Weight: <b>' + esc(p.weight) + ' lb</b></p>' : '') +
            (p.notes ? '<p class="pit-line">' + esc(p.notes) + '</p>' : '') +
            '<div class="photo-grid"></div>' +
            '<p class="pit-meta">by ' + esc(p.updatedBy) + ' · ' + S.fmtWhen(p.updatedAt) + '</p>';
        var grid = card.querySelector('.photo-grid');
        (p.photos || []).forEach(function(src){
            var t = document.createElement('div');
            t.className = 'photo-thumb';
            var img = document.createElement('img');
            img.src = src;
            img.alt = 'Robot photo, team ' + p.team;
            t.appendChild(img);
            t.addEventListener('click', function(){ openViewer(src); });
            grid.appendChild(t);
        });
        return card;
    }
    function openViewer(src){
        var v = document.createElement('div');
        v.className = 'photo-view';
        var img = document.createElement('img');
        img.src = src;
        v.appendChild(img);
        v.addEventListener('click', function(){ v.remove(); });
        document.body.appendChild(v);
    }

    /* ---------- wiring ---------- */
    document.getElementById('searchBtn').addEventListener('click', runSearch);
    document.getElementById('teamNumber').addEventListener('keydown', function(e){
        if(e.key === 'Enter'){ e.preventDefault(); runSearch(); }
    });
    S.initEventUI({ allowAll:true });

    /* Live subscription: cache stays in sync; the open search re-runs
       whenever anyone submits a new report. */
    S.ready(function(){
        if(!window.db) return;
        window.db.collection('reports').onSnapshot(function(snap){
            _reportsCache = snap.docs.map(function(d){ return d.data(); });
            _reportsLoaded = true;
            var panel = document.getElementById('resultsPanel');
            var teamVal = document.getElementById('teamNumber').value.trim();
            if(panel && !panel.hidden && teamVal){ runSearch(); }
        }, function(err){
            console.error(err);
            S.showToast('Could not load shared data.', true);
        });
    });
})();
