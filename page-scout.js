/* scout.html — page logic (loads after shared.js) */
/* global Scout694 */
(function(){
    'use strict';
    var S = window.Scout694;

    var PERIODS = [
        { key:'auto', label:'Autonomous', tag:'AUTO' },
        { key:'s1', label:'Shift 1', num:'01' },
        { key:'s2', label:'Shift 2', num:'02' },
        { key:'s3', label:'Shift 3', num:'03' },
        { key:'s4', label:'Shift 4', num:'04' },
        { key:'s5', label:'Shift 5', num:'05' },
        { key:'s6', label:'Shift 6', num:'06' }
    ];
    /* ---------- the five starting spots ----------
       All five sit on ONE straight vertical line, just clear of the hub.
       START_X is that line, as a percentage of the field image's width
       (0 = left edge, 100 = right edge) — move it to slide the whole
       column toward or away from the hub. Each spot then only needs its
       y, top (0) to bottom (100).

       These are the RED numbers. Blue is the same field rotated 180°, so
       its dots are derived automatically — you never edit blue by hand.
       Left / right are from the drivers' point of view, so red's right
       rail is the top of the picture and blue's right rail is the bottom.

       >>> To move the dots, change ONLY these numbers. <<<                */
    var START_X = 28;
    var START_SPOTS = [
        { key:'rtr', label:'Right Trench', y:12 },
        { key:'rbp', label:'Right Bump',   y:31 },
        { key:'hub', label:'Hub',          y:50 },
        { key:'lbp', label:'Left Bump',    y:69 },
        { key:'ltr', label:'Left Trench',  y:88 }
    ];
    var POS_LABEL = {
        rtr:'Right Trench', rbp:'Right Bump', hub:'Hub',
        lbp:'Left Bump',    ltr:'Left Trench',
        /* legacy keys, so older reports still read correctly in Team Search */
        btL:'Behind Trench L', utL:'Under Trench L', bpL:'Bump L', ctr:'Center',
        bpR:'Bump R', utR:'Under Trench R', btR:'Behind Trench R'
    };
    var BREAK_TAGS = ['Intake','Shooter','Hopper','Drivetrain','Climber','Electrical','Radio/Comms','Tipped','Other'];

    var alliance = 'red';
    var startPos = null;
    var chosenTags = new Set();

    /* ---------- scoring table ---------- */
    function buildScoring(){
        var body = document.getElementById('scoringBody');
        body.innerHTML = PERIODS.map(function(p){
            var head = p.tag
                ? '<span class="period-tag">' + p.tag + '</span><span class="period-label">' + p.label + '</span>'
                : '<span class="shift-num">' + p.num + '</span><span class="period-label">' + p.label + '</span>';
            function stepper(kind){
                return '<div class="stepper" data-step="10" data-period="' + p.key + '" data-kind="' + kind + '">' +
                    '<button type="button" class="step-btn step-down" aria-label="Decrease ' + kind + ', ' + p.label + '">−</button>' +
                    '<input type="number" min="0" value="0" inputmode="numeric" aria-label="' + p.label + ' ' + kind + ' count">' +
                    '<button type="button" class="step-btn step-up" aria-label="Increase ' + kind + ', ' + p.label + '">+</button>' +
                '</div>';
            }
            return '<tr class="' + (p.key === 'auto' ? 'row-auto' : '') + '">' +
                '<td>' + head + '</td>' +
                '<td>' + stepper('shoot') + '</td>' +
                '<td>' + stepper('ferry') + '</td>' +
            '</tr>';
        }).join('');
        S.wireSteppers(body);
    }
    function readPeriod(key, kind){
        var el = document.querySelector('.stepper[data-period="' + key + '"][data-kind="' + kind + '"] input');
        return Math.max(0, parseInt((el && el.value) || '0', 10) || 0);
    }

    /* ---------- starting position: five tappable points per alliance ----------
       Both halves of the field are drawn, so a scout can see the whole picture,
       but only the selected alliance's five points are live. Blue's points are
       the red ones rotated 180° about the middle of the field. */
    function coordsFor(spot, side){
        return (side === 'red')
            ? { x: START_X, y: spot.y }
            : { x: 100 - START_X, y: 100 - spot.y };
    }

    function pickSpot(key){
        startPos = (startPos === key) ? null : key;
        buildStartMap();
    }

    function buildStartMap(){
        var marks = document.getElementById('fieldMarkers');
        var legend = document.getElementById('startLegend');
        marks.innerHTML = '';
        legend.innerHTML = '';

        ['red', 'blue'].forEach(function(side){
            var live = (side === alliance);
            START_SPOTS.forEach(function(spot){
                var sel = live && (startPos === spot.key);
                var c = coordsFor(spot, side);

                var mark = document.createElement('button');
                mark.type = 'button';
                mark.className = 'field-x ally-' + side +
                    (live ? ' is-live' : ' is-ghost') + (sel ? ' is-sel' : '');
                mark.style.left = c.x + '%';
                mark.style.top = c.y + '%';
                mark.dataset.pos = spot.key;
                mark.innerHTML = '<span class="x-dot"></span><span class="x-label"></span>';
                mark.querySelector('.x-label').textContent = spot.label;

                if(live){
                    mark.setAttribute('aria-label', spot.label + ' — ' + side.toUpperCase() + ' start');
                    mark.setAttribute('aria-pressed', sel ? 'true' : 'false');
                    mark.addEventListener('click', function(){ pickSpot(spot.key); });
                } else {
                    mark.disabled = true;
                    mark.tabIndex = -1;
                    mark.setAttribute('aria-hidden', 'true');
                }
                marks.appendChild(mark);
            });
        });

        /* legend under the map, in the same top-to-bottom order as the dots —
           doubles as the tap target on phones, where the on-map text is hidden */
        var order = (alliance === 'blue') ? START_SPOTS.slice().reverse() : START_SPOTS;
        order.forEach(function(spot){
            var sel = (startPos === spot.key);
            var b = document.createElement('button');
            b.type = 'button';
            b.className = 'legend-spot' + (sel ? (' on-' + alliance) : '');
            b.dataset.pos = spot.key;
            b.textContent = spot.label;
            b.setAttribute('aria-pressed', sel ? 'true' : 'false');
            b.addEventListener('click', function(){ pickSpot(spot.key); });
            legend.appendChild(b);
        });

        var picked = document.getElementById('startPicked');
        picked.className = 'slot-picked picked-' + alliance;
        picked.innerHTML = startPos
            ? 'Starting spot: <b>' + POS_LABEL[startPos] + '</b> · ' + alliance.toUpperCase() + ' side'
            : 'No spot selected yet.';
    }

    document.querySelectorAll('#allianceSeg button').forEach(function(btn){
        btn.addEventListener('click', function(){
            alliance = btn.dataset.alliance;
            document.querySelectorAll('#allianceSeg button').forEach(function(b){
                b.className = (b.dataset.alliance === alliance) ? ('on-' + alliance) : '';
            });
            /* the five spot names mean the same thing on either side, so a
               selection survives an alliance flip — it just moves across */
            buildStartMap();
        });
    });

    /* ---------- breakage tags ---------- */
    function buildTags(){
        var holder = document.getElementById('brokeTags');
        holder.innerHTML = '';
        BREAK_TAGS.forEach(function(t){
            var b = document.createElement('button');
            b.type = 'button';
            b.className = 'tag-chip' + (chosenTags.has(t) ? ' on' : '');
            b.textContent = t;
            b.addEventListener('click', function(){
                chosenTags.has(t) ? chosenTags.delete(t) : chosenTags.add(t);
                buildTags();
            });
            holder.appendChild(b);
        });
    }

    /* ---------- reveal toggles + no-show graying ---------- */
    document.getElementById('defensePlayed').addEventListener('change', function(e){
        document.getElementById('defenseDetail').hidden = !e.target.checked;
    });
    document.getElementById('brokeCheck').addEventListener('change', function(e){
        document.getElementById('breakDetail').hidden = !e.target.checked;
    });
    document.getElementById('defenseRating').addEventListener('input', function(e){
        document.getElementById('defenseRatingVal').textContent = e.target.value + '/10';
    });
    document.getElementById('noShow').addEventListener('change', function(e){
        ['startPanel','scoringPanel','foulsPanel','defensePanel','breakPanel'].forEach(function(id){
            document.getElementById(id).classList.toggle('disabled-zone', e.target.checked);
        });
    });

    /* ---------- pit hint: hopper capacity + specialist at the top of the sheet ---------- */
    var pitHintTimer = null;
    function refreshPitHint(){
        clearTimeout(pitHintTimer);
        pitHintTimer = setTimeout(function(){
            var hint = document.getElementById('pitHint');
            var ev = S.getCurrentEvent();
            var team = document.getElementById('teamNumber').value.trim();
            hint.textContent = '';
            if(!team || !ev || ev === 'ALL' || !window.db) return;
            window.db.collection('pit').doc(team + '__' + ev).get().then(function(snap){
                if(snap.exists){
                    var p = snap.data();
                    hint.innerHTML = 'PIT · ' +
                        (p.drivetrain ? S.escapeHtml(p.drivetrain) + ' · ' : '') +
                        'Hopper <b>' + S.escapeHtml(p.hopper === 0 || p.hopper ? p.hopper : '?') + '</b> · ' +
                        'Specialist <b>' + S.escapeHtml(p.specialist || '?') + '</b>';
                } else {
                    hint.textContent = 'No pit data for this team yet.';
                }
            }).catch(function(){ /* signed out / offline — hint is optional */ });
        }, 350);
    }
    document.getElementById('teamNumber').addEventListener('input', refreshPitHint);

    /* ---------- match number memory ---------- */
    function matchKey(){ return 'scout_lastMatch::' + S.getCurrentEvent(); }
    function prefillMatch(){
        var last = parseInt(localStorage.getItem(matchKey()) || '0', 10);
        if(last > 0 && !document.getElementById('matchNumber').value){
            document.getElementById('matchNumber').value = last + 1;
        }
    }

    /* ---------- submit ---------- */
    function saveReport(report){
        if(!window.db) return Promise.reject(new Error('Firebase is not configured. Edit firebase-config.js.'));
        return window.db.collection('reports').doc(report.id).set(report);
    }
    document.getElementById('submitReportBtn').addEventListener('click', function(){
        var eventVal = document.getElementById('eventSelect').value;
        var matchVal = document.getElementById('matchNumber').value.trim();
        var teamVal = document.getElementById('teamNumber').value.trim();
        var noShow = document.getElementById('noShow').checked;
        var notesVal = document.getElementById('notes').value.trim();

        if(!eventVal || eventVal === 'ALL'){ S.showToast('Select an event before submitting.', true); return; }
        if(!matchVal){ S.showToast('Enter the match number.', true); return; }
        if(!teamVal){ S.showToast('Enter a team number before submitting.', true); return; }
        if(!startPos && !noShow){ S.showToast('Pick a starting position (or mark No show).', true); return; }

        var shifts = {};
        var autoShoot = 0, autoFerry = 0, teleShoot = 0, teleFerry = 0;
        PERIODS.forEach(function(p){
            var shoot = noShow ? 0 : readPeriod(p.key, 'shoot');
            var ferry = noShow ? 0 : readPeriod(p.key, 'ferry');
            shifts[p.key] = { shoot: shoot, ferry: ferry };
            if(p.key === 'auto'){ autoShoot += shoot; autoFerry += ferry; }
            else { teleShoot += shoot; teleFerry += ferry; }
        });
        var defensePlayed = !noShow && document.getElementById('defensePlayed').checked;
        var broke = !noShow && document.getElementById('brokeCheck').checked;

        var report = {
            id: Date.now() + '-' + Math.random().toString(36).slice(2, 8),
            event: eventVal,
            match: parseInt(matchVal, 10),
            team: teamVal,
            alliance: alliance,
            scout: S.userName(),
            scoutEmail: S.userEmail(),
            noShow: noShow,
            startPos: noShow ? null : startPos,
            startPosLabel: (!noShow && startPos) ? POS_LABEL[startPos] : '',
            shifts: shifts,
            auto: autoShoot,            /* fuel SCORED — these three feed the ranking pages */
            teleop: teleShoot,
            total: autoShoot + teleShoot,
            autoFerry: autoFerry,
            teleopFerry: teleFerry,
            ferried: autoFerry + teleFerry,
            fouls: noShow ? 0 : Math.max(0, parseInt(document.getElementById('foulsInput').value || '0', 10) || 0),
            defensePlayed: defensePlayed,
            defenseRating: defensePlayed ? parseInt(document.getElementById('defenseRating').value, 10) : null,
            defense: defensePlayed ? document.getElementById('defended').value.trim() : '',
            broke: broke,
            brokeTags: broke ? Array.from(chosenTags) : [],
            brokeTime: broke ? document.getElementById('brokeTime').value.trim() : '',
            notes: notesVal,
            timestamp: new Date().toISOString()
        };

        var submitBtn = document.getElementById('submitReportBtn');
        submitBtn.disabled = true;
        var originalLabel = submitBtn.textContent;
        submitBtn.textContent = 'Saving…';
        saveReport(report).then(function(){
            submitBtn.disabled = false;
            submitBtn.textContent = originalLabel;
            S.showToast('Saved — Q' + report.match + ' Team ' + report.team +
                ' · Auto ' + report.auto + ' · TeleOp ' + report.teleop + ' · Total ' + report.total);

            /* remember match, reset per-match fields, keep event + alliance */
            try { localStorage.setItem(matchKey(), String(report.match)); } catch(e){}
            document.getElementById('matchNumber').value = report.match + 1;
            document.getElementById('teamNumber').value = '';
            document.getElementById('pitHint').textContent = '';
            document.getElementById('defended').value = '';
            document.getElementById('notes').value = '';
            document.getElementById('brokeTime').value = '';
            document.getElementById('foulsInput').value = '0';
            document.getElementById('noShow').checked = false;
            document.getElementById('defensePlayed').checked = false;
            document.getElementById('brokeCheck').checked = false;
            document.getElementById('defenseDetail').hidden = true;
            document.getElementById('breakDetail').hidden = true;
            document.getElementById('defenseRating').value = 5;
            document.getElementById('defenseRatingVal').textContent = '5/10';
            chosenTags.clear(); buildTags();
            startPos = null; buildStartMap();
            ['startPanel','scoringPanel','foulsPanel','defensePanel','breakPanel'].forEach(function(id){
                document.getElementById(id).classList.remove('disabled-zone');
            });
            document.querySelectorAll('.scoring-table .stepper input').forEach(function(inp){ inp.value = '0'; });
        }).catch(function(err){
            console.error(err);
            S.showToast('Could not save to the shared database. ' + (err && err.message ? err.message : ''), true);
            submitBtn.disabled = false;
            submitBtn.textContent = originalLabel;
        });
    });

    /* ---------- boot ---------- */
    buildScoring();
    buildStartMap();
    buildTags();
    S.wireSteppers(document.getElementById('foulsPanel'));
    S.initEventUI({ allowAll:false, onChange: function(){ prefillMatch(); refreshPitHint(); } });
    S.ready(function(){
        document.getElementById('scoutName').value = S.userName();
        prefillMatch();
    });
})();
