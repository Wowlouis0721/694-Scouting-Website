/* admin.html — page logic (loads after shared.js) */
/* global Scout694 */
(function(){
    'use strict';
    var S = window.Scout694;
    var esc = S.escapeHtml;
    var EMAIL_RE = /^[^\s@]+@stuypulse\.com$/i;

    var _reportsCache = [];
    var _pitCache = [];

    /* ---------- gate ---------- */
    function paintGate(isAdmin){
        document.getElementById('restrictedNotice').hidden = isAdmin;
        document.getElementById('adminContent').hidden = !isAdmin;
        document.getElementById('whoAmI').textContent = S.userName() + ' (' + S.userEmail() + ')';
        if(isAdmin) boot();
    }

    /* ---------- admin list ---------- */
    function subscribeAdmins(){
        if(!window.db) return;
        window.db.collection('admins').onSnapshot(function(snap){
            var extra = snap.docs.map(function(d){ return d.id; }).sort();
            var holder = document.getElementById('adminList');
            holder.innerHTML = '';
            var seedRow = document.createElement('div');
            seedRow.className = 'admin-row';
            seedRow.innerHTML = '<span class="who">' + esc(S.SEED_ADMIN) + '<span class="seed-tag">SEED &middot; PERMANENT</span></span>';
            holder.appendChild(seedRow);
            extra.forEach(function(email){
                if(email.toLowerCase() === S.SEED_ADMIN.toLowerCase()) return;
                var row = document.createElement('div');
                row.className = 'admin-row';
                row.innerHTML = '<span class="who">' + esc(email) + '</span>';
                var del = document.createElement('button');
                del.type = 'button';
                del.className = 'btn-mini danger';
                del.textContent = 'Remove';
                del.addEventListener('click', function(){
                    if(!confirm('Remove admin access for ' + email + '?')) return;
                    window.db.collection('admins').doc(email).delete()
                        .catch(function(err){ S.showToast('Could not remove: ' + err.message, true); });
                });
                row.appendChild(del);
                holder.appendChild(row);
            });
        }, function(err){
            console.error(err);
            S.showToast('Could not load admin list.', true);
        });
    }
    document.getElementById('addAdminBtn').addEventListener('click', function(){
        var email = document.getElementById('newAdminEmail').value.trim().toLowerCase();
        if(!EMAIL_RE.test(email)){ S.showToast('Enter a valid name@stuypulse.com address.', true); return; }
        window.db.collection('admins').doc(email).set({
            addedBy: S.userEmail(),
            addedAt: new Date().toISOString()
        }).then(function(){
            document.getElementById('newAdminEmail').value = '';
            S.showToast('Added ' + email + ' as admin.');
        }).catch(function(err){ S.showToast('Could not add: ' + err.message, true); });
    });

    /* ---------- leaderboard ---------- */
    function renderLeaderboard(){
        var counts = {};
        _reportsCache.forEach(function(r){
            var who = r.scout || 'Unknown';
            counts[who] = (counts[who] || 0) + 1;
        });
        var rows = Object.keys(counts).map(function(k){ return { who:k, n:counts[k] }; })
            .sort(function(a, b){ return b.n - a.n; });
        var holder = document.getElementById('leaderboardList');
        holder.innerHTML = '';
        if(!rows.length){ holder.innerHTML = '<p class="panel-hint">No reports submitted yet.</p>'; return; }
        rows.forEach(function(r, i){
            var row = document.createElement('div');
            row.className = 'leader-row';
            row.innerHTML = '<span class="rank">' + (i + 1) + '</span>' +
                '<span class="who">' + esc(r.who) + '</span>' +
                '<span class="count">' + r.n + '</span>';
            holder.appendChild(row);
        });
    }

    /* ---------- PulseCrew flags ---------- */
    function pcMessage(r){
        return ':rotating_light: PulseCrew — Team ' + r.team + ' broke in Q' + r.match +
            (r.brokeTime ? ' (' + r.brokeTime + ')' : '') + ': ' +
            ((r.brokeTags || []).join(', ') || 'see scout') +
            (r.notes ? '. Notes: ' + r.notes : '');
    }
    function renderFlags(){
        var flagged = _reportsCache.filter(function(r){ return r.broke; })
            .sort(function(a, b){ return new Date(b.timestamp) - new Date(a.timestamp); });
        var holder = document.getElementById('flagList');
        holder.innerHTML = '';
        if(!flagged.length){ holder.innerHTML = '<p class="panel-hint">No breakage flags. 🎉</p>'; return; }
        flagged.forEach(function(r){
            var card = document.createElement('div');
            card.className = 'flag-card';
            card.innerHTML =
                '<div class="flag-head">Q' + esc(r.match) + ' &middot; Team ' + esc(r.team) + ' &middot; ' + esc(r.event) + '</div>' +
                '<div>' + esc((r.brokeTags || []).join(', ') || 'untagged') + (r.brokeTime ? ' @ ' + esc(r.brokeTime) : '') + '</div>' +
                '<div class="pit-meta">' + esc(r.scout) + ' &middot; ' + S.fmtWhen(r.timestamp) + '</div>';
            var btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'btn-mini';
            btn.style.marginTop = '8px';
            btn.textContent = 'Copy for #comp-pulsecrew';
            btn.addEventListener('click', function(){
                var msg = pcMessage(r);
                if(navigator.clipboard && navigator.clipboard.writeText){
                    navigator.clipboard.writeText(msg).then(function(){ S.showToast('Copied.'); }, function(){ prompt('Copy:', msg); });
                } else { prompt('Copy:', msg); }
            });
            card.appendChild(btn);
            holder.appendChild(card);
        });
    }

    /* ---------- reports manager ---------- */
    function buildReportFilter(){
        var sel = document.getElementById('reportFilter');
        sel.innerHTML = '';
        var allOpt = document.createElement('option');
        allOpt.value = 'ALL'; allOpt.textContent = 'All Events';
        sel.appendChild(allOpt);
        S.EVENTS.forEach(function(ev){
            var opt = document.createElement('option');
            opt.value = ev; opt.textContent = ev;
            sel.appendChild(opt);
        });
        sel.addEventListener('change', renderReports);
    }
    function renderReports(){
        var eventVal = document.getElementById('reportFilter').value;
        var rows = _reportsCache
            .filter(function(r){ return eventVal === 'ALL' || r.event === eventVal; })
            .sort(function(a, b){ return new Date(b.timestamp) - new Date(a.timestamp); });
        var body = document.getElementById('reportsBody');
        body.innerHTML = '';
        if(!rows.length){
            body.innerHTML = '<tr class="empty-row"><td colspan="9">No reports.</td></tr>';
            return;
        }
        rows.forEach(function(r){
            var tr = document.createElement('tr');
            tr.innerHTML =
                '<td class="num-cell">' + (r.match ? 'Q' + esc(r.match) : '—') + '</td>' +
                '<td>' + esc(r.event) + '</td>' +
                '<td class="num-cell">' + esc(r.team) + '</td>' +
                '<td class="num-cell">' + (r.alliance === 'red' ? '<span class="ally-red">RED</span>' : r.alliance === 'blue' ? '<span class="ally-blue">BLUE</span>' : '—') + '</td>' +
                '<td class="num-cell total-cell">' + esc(r.total) + '</td>' +
                '<td>' + (r.broke ? '<span class="flag-yes">YES</span>' : '—') + '</td>' +
                '<td>' + esc(r.scout) + '</td>' +
                '<td class="num-cell">' + S.fmtWhen(r.timestamp) + '</td>' +
                '<td></td>';
            var del = document.createElement('button');
            del.type = 'button';
            del.className = 'btn-mini danger';
            del.textContent = 'Delete';
            del.addEventListener('click', function(){
                if(!confirm('Delete Q' + r.match + ' Team ' + r.team + ' (' + r.event + ')? This cannot be undone.')) return;
                window.db.collection('reports').doc(r.id).delete()
                    .then(function(){ S.showToast('Deleted.'); })
                    .catch(function(err){ S.showToast('Delete failed: ' + err.message, true); });
            });
            tr.lastElementChild.appendChild(del);
            body.appendChild(tr);
        });
    }

    /* ---------- pit manager ---------- */
    function renderPit(){
        var rows = _pitCache.slice().sort(function(a, b){
            return (a.event || '').localeCompare(b.event || '') || (parseInt(a.team, 10) || 0) - (parseInt(b.team, 10) || 0);
        });
        var body = document.getElementById('pitBody');
        body.innerHTML = '';
        if(!rows.length){ body.innerHTML = '<tr class="empty-row"><td colspan="7">No pit entries.</td></tr>'; return; }
        rows.forEach(function(p){
            var tr = document.createElement('tr');
            tr.innerHTML =
                '<td class="num-cell">' + esc(p.team) + '</td>' +
                '<td>' + esc(p.event) + '</td>' +
                '<td>' + esc(p.drivetrain) + '</td>' +
                '<td class="num-cell">' + esc(p.hopper) + '</td>' +
                '<td>' + esc(p.specialist) + '</td>' +
                '<td>' + esc(p.updatedBy) + '</td>' +
                '<td></td>';
            var del = document.createElement('button');
            del.type = 'button';
            del.className = 'btn-mini danger';
            del.textContent = 'Delete';
            del.addEventListener('click', function(){
                if(!confirm('Delete the pit entry for Team ' + p.team + ' @ ' + p.event + '?')) return;
                window.db.collection('pit').doc(p.team + '__' + p.event).delete()
                    .then(function(){ S.showToast('Deleted.'); })
                    .catch(function(err){ S.showToast('Delete failed: ' + err.message, true); });
            });
            tr.lastElementChild.appendChild(del);
            body.appendChild(tr);
        });
    }

    /* ---------- boot (only after we know the user is admin) ---------- */
    var booted = false;
    function boot(){
        if(booted) return;
        booted = true;
        subscribeAdmins();
        buildReportFilter();
        window.db.collection('reports').onSnapshot(function(snap){
            _reportsCache = snap.docs.map(function(d){ return Object.assign({ id: d.id }, d.data()); });
            renderLeaderboard();
            renderFlags();
            renderReports();
        }, function(err){ console.error(err); S.showToast('Could not load reports.', true); });
        window.db.collection('pit').onSnapshot(function(snap){
            _pitCache = snap.docs.map(function(d){ return d.data(); });
            renderPit();
        }, function(err){ console.error(err); S.showToast('Could not load pit entries.', true); });
    }

    S.ready(function(){
        S.isAdmin().then(paintGate);
    });
})();
