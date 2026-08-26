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
    var START_POS = [
        { key:'btL', glyph:'▤', label:'Behind Trench' },
        { key:'utL', glyph:'⌒', label:'Under Trench' },
        { key:'bpL', glyph:'▲', label:'Bump' },
        { key:'ctr', glyph:'●', label:'Center' },
        { key:'bpR', glyph:'▲', label:'Bump' },
        { key:'utR', glyph:'⌒', label:'Under Trench' },
        { key:'btR', glyph:'▤', label:'Behind Trench' }
    ];
    var POS_LABEL = {
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

    /* ---------- starting position (flips for blue) ---------- */
    function buildSlots(){
        var holder = document.getElementById('startSlots');
        var order = alliance === 'blue' ? START_POS.slice().reverse() : START_POS;
        holder.innerHTML = '';
        order.forEach(function(p){
            var b = document.createElement('button');
            b.type = 'button';
            b.className = 'slot' + (startPos === p.key ? (' sel-' + alliance) : '');
            b.dataset.pos = p.key;
            b.innerHTML = '<span class="glyph">' + p.glyph + '</span>' + p.label.replace(' ', '<br>');
            b.addEventListener('click', function(){
                startPos = (startPos === p.key) ? null : p.key;
                buildSlots();
            });
            holder.appendChild(b);
        });
        document.getElementById('wallLabel').textContent =
            (alliance === 'red' ? 'RED' : 'BLUE') + ' ALLIANCE WALL · VIEW FROM DRIVE STATION';
        var picked = document.getElementById('startPicked');
        picked.innerHTML = startPos
            ? 'Starting spot: <b>' + POS_LABEL[startPos] + '</b>'
            : 'No spot selected yet.';
    }
    document.querySelectorAll('#allianceSeg button').forEach(function(btn){
        btn.addEventListener('click', function(){
            alliance = btn.dataset.alliance;
            document.querySelectorAll('#allianceSeg button').forEach(function(b){
                b.className = (b.dataset.alliance === alliance) ? ('on-' + alliance) : '';
            });
            buildSlots();
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
            startPos = null; buildSlots();
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
    buildSlots();
    buildTags();
    S.wireSteppers(document.getElementById('foulsPanel'));
    S.initEventUI({ allowAll:false, onChange: function(){ prefillMatch(); refreshPitHint(); } });
    S.ready(function(){
        document.getElementById('scoutName').value = S.userName();
        prefillMatch();
    });
})();
