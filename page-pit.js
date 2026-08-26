/* pit.html — page logic (loads after shared.js) */
/* global Scout694 */
(function(){
    'use strict';
    var S = window.Scout694;
    var esc = S.escapeHtml;

    var photos = [];          // data URLs for the entry being edited
    var iAmAdmin = false;
    var unsubscribeDir = null;

    function docId(team, ev){ return team + '__' + ev; }

    /* ---------- photo handling ---------- */
    function renderPhotos(){
        var grid = document.getElementById('photoGrid');
        grid.innerHTML = '';
        photos.forEach(function(src, idx){
            var t = document.createElement('div');
            t.className = 'photo-thumb';
            var img = document.createElement('img');
            img.src = src;
            img.alt = 'Robot photo ' + (idx + 1);
            t.appendChild(img);
            var x = document.createElement('button');
            x.type = 'button';
            x.className = 'photo-x';
            x.textContent = '✕';
            x.setAttribute('aria-label', 'Remove photo');
            x.addEventListener('click', function(e){ e.stopPropagation(); photos.splice(idx, 1); renderPhotos(); });
            t.appendChild(x);
            t.addEventListener('click', function(){ openViewer(src); });
            grid.appendChild(t);
        });
        document.querySelector('label[for=pitPhotoInput]').style.display = photos.length >= 2 ? 'none' : '';
    }
    document.getElementById('pitPhotoInput').addEventListener('change', function(e){
        var file = e.target.files && e.target.files[0];
        e.target.value = '';
        if(!file) return;
        if(photos.length >= 2){ S.showToast('Max 2 photos per team.', true); return; }
        S.showToast('Compressing photo…');
        S.compressImage(file).then(function(dataUrl){
            photos.push(dataUrl);
            renderPhotos();
        }).catch(function(err){ S.showToast(err.message, true); });
    });
    function openViewer(src){
        var v = document.createElement('div');
        v.className = 'photo-view';
        var img = document.createElement('img');
        img.src = src;
        v.appendChild(img);
        v.addEventListener('click', function(){ v.remove(); });
        document.body.appendChild(v);
    }

    /* ---------- prefill existing entry when team/event chosen ---------- */
    var prefillTimer = null;
    function prefill(){
        clearTimeout(prefillTimer);
        prefillTimer = setTimeout(function(){
            var ev = document.getElementById('eventSelect').value;
            var team = document.getElementById('pitTeam').value.trim();
            if(!ev || ev === 'ALL' || !team || !window.db) return;
            window.db.collection('pit').doc(docId(team, ev)).get().then(function(snap){
                if(!snap.exists){ return; }
                var p = snap.data();
                document.getElementById('pitDrivetrain').value = p.drivetrain || '';
                document.getElementById('pitHopper').value = (p.hopper === 0 || p.hopper) ? p.hopper : '';
                document.getElementById('pitSpecialist').value = p.specialist || '';
                document.getElementById('pitWeight').value = (p.weight === 0 || p.weight) ? p.weight : '';
                document.getElementById('pitNotes').value = p.notes || '';
                photos = (p.photos || []).slice(0, 2);
                renderPhotos();
                S.showToast('Loaded existing pit entry for Team ' + team + ' — saving updates it.');
            }).catch(function(){ /* fine */ });
        }, 350);
    }
    document.getElementById('pitTeam').addEventListener('input', prefill);

    /* ---------- save ---------- */
    document.getElementById('savePitBtn').addEventListener('click', function(){
        var ev = document.getElementById('eventSelect').value;
        var team = document.getElementById('pitTeam').value.trim();
        if(!ev || ev === 'ALL'){ S.showToast('Select an event first.', true); return; }
        if(!team){ S.showToast('Enter a team number.', true); return; }
        if(!window.db){ S.showToast('Firebase is not configured.', true); return; }

        var entry = {
            event: ev,
            team: team,
            drivetrain: document.getElementById('pitDrivetrain').value,
            hopper: document.getElementById('pitHopper').value === '' ? null : parseInt(document.getElementById('pitHopper').value, 10),
            specialist: document.getElementById('pitSpecialist').value,
            weight: document.getElementById('pitWeight').value === '' ? null : parseFloat(document.getElementById('pitWeight').value),
            notes: document.getElementById('pitNotes').value.trim(),
            photos: photos.slice(0, 2),
            updatedBy: S.userName(),
            updatedEmail: S.userEmail(),
            updatedAt: new Date().toISOString()
        };
        var btn = document.getElementById('savePitBtn');
        btn.disabled = true;
        var label = btn.textContent;
        btn.textContent = 'Saving…';
        window.db.collection('pit').doc(docId(team, ev)).set(entry, { merge: true }).then(function(){
            btn.disabled = false;
            btn.textContent = label;
            S.showToast('Pit entry saved — Team ' + team + ' @ ' + ev);
            document.getElementById('pitTeam').value = '';
            document.getElementById('pitDrivetrain').value = '';
            document.getElementById('pitHopper').value = '';
            document.getElementById('pitSpecialist').value = '';
            document.getElementById('pitWeight').value = '';
            document.getElementById('pitNotes').value = '';
            photos = [];
            renderPhotos();
        }).catch(function(err){
            console.error(err);
            btn.disabled = false;
            btn.textContent = label;
            S.showToast('Could not save: ' + (err && err.message ? err.message : ''), true);
        });
    });

    /* ---------- live directory of pit entries at the current event ---------- */
    function subscribeDirectory(){
        if(unsubscribeDir){ unsubscribeDir(); unsubscribeDir = null; }
        var holder = document.getElementById('pitDirectory');
        var hint = document.getElementById('pitDirHint');
        var ev = S.getCurrentEvent();
        if(!ev || ev === 'ALL'){
            holder.innerHTML = '';
            hint.textContent = 'Select an event above to see its pit database.';
            return;
        }
        if(!window.db) return;
        unsubscribeDir = window.db.collection('pit').where('event', '==', ev)
            .onSnapshot(function(snap){
                var docs = snap.docs.map(function(d){ return d.data(); })
                    .sort(function(a, b){ return (parseInt(a.team, 10) || 0) - (parseInt(b.team, 10) || 0); });
                hint.textContent = docs.length
                    ? docs.length + ' team' + (docs.length === 1 ? '' : 's') + ' pit-scouted at ' + ev + '. Tap a photo to enlarge.'
                    : 'No pit entries at ' + ev + ' yet — be the first.';
                holder.innerHTML = '';
                docs.forEach(function(p){ holder.appendChild(card(p)); });
            }, function(err){
                console.error(err);
                hint.textContent = 'Could not load the pit database.';
            });
    }
    function card(p){
        var el = document.createElement('div');
        el.className = 'pit-card';
        el.innerHTML =
            '<h3>TEAM <span>' + esc(p.team) + '</span></h3>' +
            '<p class="pit-line">Drivetrain: <b>' + esc(p.drivetrain) + '</b></p>' +
            '<p class="pit-line">Max hopper: <b>' + esc(p.hopper) + '</b> · Specialist: <b>' + esc(p.specialist) + '</b></p>' +
            (p.weight ? '<p class="pit-line">Weight: <b>' + esc(p.weight) + ' lb</b></p>' : '') +
            (p.notes ? '<p class="pit-line">' + esc(p.notes) + '</p>' : '') +
            '<div class="photo-grid"></div>' +
            '<p class="pit-meta">by ' + esc(p.updatedBy) + ' · ' + S.fmtWhen(p.updatedAt) + '</p>';
        var grid = el.querySelector('.photo-grid');
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
        if(iAmAdmin){
            var del = document.createElement('button');
            del.type = 'button';
            del.className = 'btn-mini danger';
            del.textContent = 'Delete entry';
            del.style.marginTop = '10px';
            del.addEventListener('click', function(){
                if(!confirm('Delete the pit entry for Team ' + p.team + ' @ ' + p.event + '?')) return;
                window.db.collection('pit').doc(docId(p.team, p.event)).delete()
                    .then(function(){ S.showToast('Deleted.'); })
                    .catch(function(err){ S.showToast('Delete failed: ' + err.message, true); });
            });
            el.appendChild(del);
        }
        return el;
    }

    /* ---------- boot ---------- */
    renderPhotos();
    S.initEventUI({ allowAll:false, onChange: function(){ subscribeDirectory(); prefill(); } });
    S.ready(function(){
        S.isAdmin().then(function(v){ iAmAdmin = v; subscribeDirectory(); });
    });
})();
