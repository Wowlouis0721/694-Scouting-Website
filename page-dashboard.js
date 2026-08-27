/* index.html — the landing dashboard (loads after shared.js)
   Read-only: everything here is a view of reports / pit / assignments.
   Nothing on this page writes to the database. */
/* global Scout694 */
(function(){
    'use strict';
    var S = window.Scout694;
    var esc = S.escapeHtml;

    var _reports = [];
    var _pit = [];
    var _assignments = [];
    var _loaded = { reports:false, pit:false, assignments:false };

    function currentEvent(){
        var sel = document.getElementById('eventSelect');
        return (sel && sel.value) ? sel.value : 'ALL';
    }
    function atEvent(row){
        var ev = currentEvent();
        return ev === 'ALL' || row.event === ev;
    }
    function mine(r){
        var email = S.userEmail();
        if(r.scoutEmail) return String(r.scoutEmail).toLowerCase() === email;
        /* very old reports stored only the typed name */
        return (r.scout || '').trim().toLowerCase() === (S.userName() || '').trim().toLowerCase();
    }

    /* ---------- stat tiles ---------- */
    function tile(value, label, tone){
        return '<div class="stat' + (tone ? ' tone-' + tone : '') + '">' +
            '<b>' + value + '</b><span>' + label + '</span></div>';
    }
    function renderStats(){
        var myReports = _reports.filter(mine).filter(atEvent);
        var myPit = _pit.filter(function(p){
            return atEvent(p) && String(p.updatedEmail || '').toLowerCase() === S.userEmail();
        });
        var myOpen = openAssignments().length;
        var eventReports = _reports.filter(atEvent).length;

        document.getElementById('statRow').innerHTML =
            tile(myReports.length, 'Matches you scouted') +
            tile(myPit.length, 'Pit entries you filed') +
            tile(myOpen, 'Assignments open', myOpen ? 'warn' : 'ok') +
            tile(eventReports, 'Reports from everyone');
    }

    /* ---------- assignments ----------
       An assignment counts as finished when a report exists for the same
       event + match + team, whoever filed it. */
    function reportFor(a){
        var key = S.jobKey(a.event, a.matchLabel, a.team);
        return _reports.filter(function(r){ return S.reportJobKey(r) === key; })[0] || null;
    }
    function myAssignments(){
        return _assignments.filter(S.assignedToMe).filter(atEvent);
    }
    function openAssignments(){
        return myAssignments().filter(function(a){ return !reportFor(a); });
    }
    function scoutLink(a){
        return 'scout.html?event=' + encodeURIComponent(a.event) +
            '&type=' + encodeURIComponent(a.matchType || 'qual') +
            '&match=' + encodeURIComponent(a.matchNumber || '') +
            '&team=' + encodeURIComponent(a.team);
    }
    function renderAssignments(){
        var holder = document.getElementById('myAssignments');
        var showDone = document.getElementById('showDone').checked;
        var rows = myAssignments()
            .map(function(a){ return Object.assign({}, a, { report: reportFor(a) }); })
            .filter(function(a){ return showDone || !a.report; })
            .sort(function(a, b){
                var ap = (a.matchType === 'playoff') ? 1 : 0, bp = (b.matchType === 'playoff') ? 1 : 0;
                if(ap !== bp) return ap - bp;
                return (a.matchNumber || 0) - (b.matchNumber || 0);
            });

        holder.innerHTML = '';
        if(!rows.length){
            holder.innerHTML = '<p class="panel-hint" style="margin:0">' +
                (_loaded.assignments
                    ? (showDone ? 'Nothing assigned to you here yet.' : 'All caught up — no open assignments.')
                    : 'Loading…') +
                '</p>';
            return;
        }
        rows.forEach(function(a){
            var row = document.createElement('div');
            row.className = 'assign-row' + (a.report ? ' is-done' : '');
            row.innerHTML =
                '<span class="assign-code' + (a.matchType === 'playoff' ? ' is-playoff' : '') + '">' +
                    esc(a.matchLabel) + '</span>' +
                '<span class="assign-team">Team ' + esc(a.team) + '</span>' +
                '<span class="assign-who">' + esc(a.event) + '</span>' +
                '<span class="assign-state">' + (a.report ? 'done' : 'open') + '</span>';
            if(a.report){
                var tick = document.createElement('span');
                tick.className = 'assign-by';
                tick.textContent = 'by ' + (a.report.scout || '—');
                row.appendChild(tick);
            } else {
                var go = document.createElement('a');
                go.className = 'btn-mini go';
                go.href = scoutLink(a);
                go.textContent = 'Scout it';
                row.appendChild(go);
            }
            holder.appendChild(row);
        });
    }

    /* ---------- your recent reports ---------- */
    function renderMyReports(){
        var holder = document.getElementById('myReports');
        var rows = _reports.filter(mine).filter(atEvent)
            .sort(function(a, b){ return new Date(b.timestamp) - new Date(a.timestamp); })
            .slice(0, 8);
        holder.innerHTML = '';
        if(!rows.length){
            holder.innerHTML = '<p class="panel-hint" style="margin:0">' +
                (_loaded.reports ? 'You haven\'t filed a report here yet.' : 'Loading…') + '</p>';
            return;
        }
        rows.forEach(function(r){
            var row = document.createElement('div');
            row.className = 'mini-row';
            row.innerHTML =
                '<span class="assign-code' + (r.matchType === 'playoff' ? ' is-playoff' : '') + '">' +
                    esc(S.reportMatchLabel(r)) + '</span>' +
                '<span class="mini-team">' + esc(r.team) + '</span>' +
                '<span class="mini-note">' + (r.noShow ? 'no show' : esc(r.total) + ' fuel') + '</span>' +
                '<span class="mini-when">' + S.fmtWhen(r.timestamp) + '</span>';
            holder.appendChild(row);
        });
    }

    /* ---------- who else is filing reports ---------- */
    function renderActivity(){
        var holder = document.getElementById('teamActivity');
        var counts = {};
        _reports.filter(atEvent).forEach(function(r){
            var who = r.scout || 'Unknown';
            counts[who] = (counts[who] || 0) + 1;
        });
        var rows = Object.keys(counts).map(function(k){ return { who:k, n:counts[k] }; })
            .sort(function(a, b){ return b.n - a.n; }).slice(0, 8);
        holder.innerHTML = '';
        if(!rows.length){
            holder.innerHTML = '<p class="panel-hint" style="margin:0">' +
                (_loaded.reports ? 'No reports here yet.' : 'Loading…') + '</p>';
            return;
        }
        var me = (S.userName() || '').trim().toLowerCase();
        rows.forEach(function(r, i){
            var row = document.createElement('div');
            row.className = 'leader-row' + (r.who.trim().toLowerCase() === me ? ' is-me' : '');
            row.innerHTML = '<span class="rank">' + (i + 1) + '</span>' +
                '<span class="who">' + esc(r.who) + '</span>' +
                '<span class="count">' + r.n + '</span>';
            holder.appendChild(row);
        });
    }

    function renderAll(){
        renderStats();
        renderAssignments();
        renderMyReports();
        renderActivity();
    }

    /* ---------- boot ---------- */
    document.getElementById('showDone').addEventListener('change', renderAssignments);
    S.initEventUI({ allowAll:true, onChange: renderAll });
    S.ready(function(user){
        var first = (user.displayName || user.email || '').split(' ')[0];
        document.getElementById('helloName').textContent = first ? 'Hi, ' + first : 'Dashboard';
        if(!window.db){ renderAll(); return; }

        window.db.collection('reports').onSnapshot(function(snap){
            _reports = snap.docs.map(function(d){ return d.data(); });
            _loaded.reports = true;
            renderAll();
        }, function(err){ console.error(err); S.showToast('Could not load reports.', true); });

        window.db.collection('assignments').onSnapshot(function(snap){
            _assignments = snap.docs.map(function(d){ return d.data(); });
            _loaded.assignments = true;
            renderAll();
        }, function(err){ console.error(err); });

        window.db.collection('pit').onSnapshot(function(snap){
            _pit = snap.docs.map(function(d){ return d.data(); });
            _loaded.pit = true;
            renderStats();
        }, function(err){ console.error(err); });
    });
    renderAll();
})();
