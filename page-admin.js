/* admin.html — page logic (loads after shared.js) */
/* global Scout694 */
(function(){
    'use strict';
    var S = window.Scout694;
    var esc = S.escapeHtml;
    var EMAIL_RE = /^[^\s@]+@stuypulse\.com$/i;

    var _reportsCache = [];
    var _pitCache = [];
    var _assignCache = [];
    var _people = [];              /* everyone who has ever signed in */
    var assignType = 'qual';

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

    /* =========================================================
       ASSIGNMENTS — one match + one team, handed to one scout
       ========================================================= */

    /* The "Assign to" box is a real text input backed by a <datalist>: the
       dropdown lists everyone who has signed in, but an admin can type a name
       that isn't there yet. If what they typed matches a known person we
       attach that person's email (so the assignment follows them even if they
       change their display name); if not, we keep the plain name and match on
       it instead. */
    function paintPeople(){
        var list = document.getElementById('peopleList');
        list.innerHTML = '';
        _people.forEach(function(p){
            var opt = document.createElement('option');
            opt.value = p.name || p.email;
            list.appendChild(opt);
        });
    }
    function resolvePerson(typed){
        var t = (typed || '').trim();
        if(!t) return null;
        var low = t.toLowerCase();
        var hit = _people.filter(function(p){
            return (p.name || '').toLowerCase() === low || (p.email || '').toLowerCase() === low;
        })[0];
        return hit
            ? { name: hit.name || hit.email, email: (hit.email || '').toLowerCase(), known: true }
            : { name: t, email: '', known: false };
    }
    function paintResolve(){
        var el = document.getElementById('assignResolve');
        var who = resolvePerson(document.getElementById('assignWho').value);
        if(!who){ el.textContent = ''; el.className = 'assign-resolve'; return; }
        if(who.known){
            el.textContent = 'Matches ' + who.email + ' — will appear on their dashboard.';
            el.className = 'assign-resolve is-ok';
        } else {
            el.textContent = '“' + who.name + '” hasn\'t signed in yet — the assignment ' +
                'will find them by name once they do.';
            el.className = 'assign-resolve is-warn';
        }
    }
    document.getElementById('assignWho').addEventListener('input', paintResolve);

    function paintAssignType(){
        document.querySelectorAll('#assignTypeSeg button').forEach(function(b){
            b.className = (b.dataset.mtype === assignType)
                ? ('on-' + (assignType === 'playoff' ? 'blue' : 'red')) : '';
        });
        var code = S.matchLabel(assignType, document.getElementById('assignMatch').value.trim());
        var el = document.getElementById('assignCode');
        el.textContent = code ? '· ' + code : '';
        el.className = 'match-code' + (assignType === 'playoff' ? ' is-playoff' : '');
    }
    document.querySelectorAll('#assignTypeSeg button').forEach(function(btn){
        btn.addEventListener('click', function(){ assignType = btn.dataset.mtype; paintAssignType(); });
    });
    document.getElementById('assignMatch').addEventListener('input', paintAssignType);

    function buildAssignSelects(){
        var ev = document.getElementById('assignEvent');
        var filter = document.getElementById('assignFilter');
        ev.innerHTML = '';
        filter.innerHTML = '';
        var all = document.createElement('option');
        all.value = 'ALL'; all.textContent = 'All Events';
        filter.appendChild(all);
        S.EVENTS.forEach(function(name){
            var a = document.createElement('option');
            a.value = name; a.textContent = name;
            ev.appendChild(a);
            var b = document.createElement('option');
            b.value = name; b.textContent = name;
            filter.appendChild(b);
        });
        var current = S.getCurrentEvent();
        if(current && current !== 'ALL'){ ev.value = current; filter.value = current; }
        filter.addEventListener('change', renderAssignments);
        document.getElementById('showDone').addEventListener('change', renderAssignments);
    }

    document.getElementById('addAssignBtn').addEventListener('click', function(){
        var ev = document.getElementById('assignEvent').value;
        var num = document.getElementById('assignMatch').value.trim();
        var team = document.getElementById('assignTeam').value.trim();
        var who = resolvePerson(document.getElementById('assignWho').value);

        if(!ev){ S.showToast('Pick an event.', true); return; }
        if(!num){ S.showToast('Enter a match number.', true); return; }
        if(!team){ S.showToast('Enter a team number.', true); return; }
        if(!who){ S.showToast('Pick or type who this is for.', true); return; }

        var label = S.matchLabel(assignType, num);
        var id = [ev, label, team, (who.email || who.name)].join('__').replace(/[\/\s]+/g, '_');

        /* the same person, match and team twice is a mistake, not a second job */
        var dupe = _assignCache.filter(function(a){
            return a.event === ev && a.matchLabel === label && String(a.team) === team &&
                ((who.email && a.assigneeEmail === who.email) ||
                 (!who.email && (a.assigneeName || '').toLowerCase() === who.name.toLowerCase()));
        })[0];
        if(dupe){ S.showToast(who.name + ' already has ' + label + ' · ' + team + '.', true); return; }

        window.db.collection('assignments').doc(id).set({
            id: id,
            event: ev,
            matchType: assignType,
            matchLabel: label,
            matchNumber: parseInt(num, 10),
            team: team,
            assigneeName: who.name,
            assigneeEmail: who.email,
            assignedBy: S.userName(),
            assignedAt: new Date().toISOString()
        }).then(function(){
            S.showToast('Assigned ' + label + ' · Team ' + team + ' to ' + who.name + '.');
            document.getElementById('assignMatch').value = num;   /* same match, next team */
            document.getElementById('assignTeam').value = '';
            paintAssignType();
        }).catch(function(err){ S.showToast('Could not assign: ' + err.message, true); });
    });

    /* An assignment is finished when a report exists for the same event,
       match and team — no one has to remember to tick anything. */
    function doneKeys(){
        var set = {};
        _reportsCache.forEach(function(r){ set[S.reportJobKey(r)] = r; });
        return set;
    }
    function renderAssignments(){
        var holder = document.getElementById('assignList');
        var eventVal = document.getElementById('assignFilter').value || 'ALL';
        var showDone = document.getElementById('showDone').checked;
        var done = doneKeys();

        var rows = _assignCache
            .filter(function(a){ return eventVal === 'ALL' || a.event === eventVal; })
            .map(function(a){
                return Object.assign({}, a, { report: done[S.jobKey(a.event, a.matchLabel, a.team)] || null });
            })
            .filter(function(a){ return showDone || !a.report; })
            .sort(function(a, b){
                var ap = (a.matchType === 'playoff') ? 1 : 0, bp = (b.matchType === 'playoff') ? 1 : 0;
                if(ap !== bp) return ap - bp;
                if((a.matchNumber || 0) !== (b.matchNumber || 0)) return (a.matchNumber || 0) - (b.matchNumber || 0);
                return (a.assigneeName || '').localeCompare(b.assigneeName || '');
            });

        holder.innerHTML = '';
        if(!rows.length){
            holder.innerHTML = '<p class="panel-hint" style="margin:0">' +
                (showDone ? 'No assignments here yet.' : 'Nothing outstanding — every assignment has a report.') +
                '</p>';
            return;
        }
        rows.forEach(function(a){
            var row = document.createElement('div');
            row.className = 'assign-row' + (a.report ? ' is-done' : '');
            row.innerHTML =
                '<span class="assign-code' + (a.matchType === 'playoff' ? ' is-playoff' : '') + '">' +
                    esc(a.matchLabel) + '</span>' +
                '<span class="assign-team">' + esc(a.team) + '</span>' +
                '<span class="assign-who">' + esc(a.assigneeName) + '</span>' +
                '<span class="assign-state">' + (a.report ? 'done' : 'open') + '</span>';
            var del = document.createElement('button');
            del.type = 'button';
            del.className = 'btn-mini danger';
            del.textContent = 'Remove';
            del.addEventListener('click', function(){
                if(!confirm('Remove ' + a.matchLabel + ' · Team ' + a.team + ' from ' + a.assigneeName + '?')) return;
                window.db.collection('assignments').doc(a.id).delete()
                    .catch(function(err){ S.showToast('Could not remove: ' + err.message, true); });
            });
            row.appendChild(del);
            holder.appendChild(row);
        });
    }

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
        return ':rotating_light: PulseCrew — Team ' + r.team + ' broke in ' + S.reportMatchLabel(r) +
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
                '<div class="flag-head">' + esc(S.reportMatchLabel(r)) + ' &middot; Team ' + esc(r.team) + ' &middot; ' + esc(r.event) + '</div>' +
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
                '<td class="num-cell">' + esc(S.reportMatchLabel(r)) + '</td>' +
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
                if(!confirm('Delete ' + S.reportMatchLabel(r) + ' Team ' + r.team + ' (' + r.event + ')? This cannot be undone.')) return;
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
        S.initEventUI({ allowAll:true });   /* fills the Events dropdown in the navbar */
        buildReportFilter();
        buildAssignSelects();
        paintAssignType();
        S.listUsers().then(function(people){ _people = people; paintPeople(); });
        window.db.collection('assignments').onSnapshot(function(snap){
            _assignCache = snap.docs.map(function(d){ return Object.assign({ id: d.id }, d.data()); });
            renderAssignments();
        }, function(err){ console.error(err); S.showToast('Could not load assignments.', true); });
        window.db.collection('reports').onSnapshot(function(snap){
            _reportsCache = snap.docs.map(function(d){ return Object.assign({ id: d.id }, d.data()); });
            renderLeaderboard();
            renderFlags();
            renderReports();
            renderAssignments();   /* a new report can close an assignment */
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
