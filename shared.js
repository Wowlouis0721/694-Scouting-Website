/* =============================================================
   694 SCOUTING · shared.js
   One place for: the event list, the event picker UI, sign-in
   (@stuypulse.com only), admin checks, toasts, image compression.
   Every page loads this after firebase-config.js.
   ============================================================= */
/* global firebase */
window.Scout694 = (function(){
    'use strict';

    /* ---------------- events (edit this list to add events) ---------------- */
    const EVENTS = [
        "Indiana Robotics Invitational",
        "Chezy Champs",
        "NYC Robo Replay",
        "Brunswick Eruption"
    ];
    const STORAGE_KEY = "scout_currentEvent";
    const SEED_ADMIN = "louis.lee@stuypulse.com";   // always an admin, cannot be removed
    const EMAIL_RE = /@stuypulse\.com$/i;

    /* ---------------- tiny helpers ---------------- */
    function escapeHtml(value){
        const div = document.createElement('div');
        div.textContent = (value === null || value === undefined || value === '') ? '—' : String(value);
        return div.innerHTML;
    }
    function showToast(message, isError){
        const toast = document.createElement('div');
        toast.className = 'app-toast' + (isError ? ' is-error' : '');
        toast.textContent = message;
        document.body.appendChild(toast);
        requestAnimationFrame(() => toast.classList.add('is-visible'));
        setTimeout(() => {
            toast.classList.remove('is-visible');
            setTimeout(() => toast.remove(), 300);
        }, 2800);
    }
    function fmtWhen(ts){
        if(!ts) return '—';
        const d = new Date(ts);
        if(isNaN(d)) return '—';
        return (d.getMonth()+1) + '/' + d.getDate() + ' ' +
            String(d.getHours()).padStart(2,'0') + ':' + String(d.getMinutes()).padStart(2,'0');
    }

    /* ---------------- current event ---------------- */
    let _eventChangeCbs = [];
    function getCurrentEvent(){ 
        try { return localStorage.getItem(STORAGE_KEY) || ""; } catch(e){ return ""; }
    }
    function setCurrentEvent(name){
        try { localStorage.setItem(STORAGE_KEY, name); } catch(e){}
        _renderEventUI();
        _eventChangeCbs.forEach(cb => { try { cb(name); } catch(e){ console.error(e); } });
    }
    let _eventOpts = { allowAll:true };
    function initEventUI(opts){
        _eventOpts = Object.assign({ allowAll:true, onChange:null }, opts || {});
        if(_eventOpts.onChange) _eventChangeCbs.push(_eventOpts.onChange);

        const select = document.getElementById('eventSelect');
        if(select){
            select.innerHTML = '';
            if(_eventOpts.allowAll){
                const allOpt = document.createElement('option');
                allOpt.value = 'ALL';
                allOpt.textContent = 'All Events';
                select.appendChild(allOpt);
            } else {
                const placeholder = document.createElement('option');
                placeholder.value = '';
                placeholder.textContent = 'Select event…';
                placeholder.disabled = true;
                placeholder.selected = true;
                select.appendChild(placeholder);
            }
            EVENTS.forEach(ev => {
                const opt = document.createElement('option');
                opt.value = ev;
                opt.textContent = ev;
                select.appendChild(opt);
            });
            select.addEventListener('change', (e) => setCurrentEvent(e.target.value));
        }

        const list = document.getElementById('eventList');
        if(list){
            list.innerHTML = '';
            EVENTS.forEach(ev => {
                const item = document.createElement('button');
                item.type = 'button';
                item.className = 'event-row';
                item.dataset.event = ev;
                item.innerHTML =
                    '<span class="event-dot"></span>' +
                    '<span class="event-name"></span>' +
                    '<span class="event-check">✓</span>';
                item.querySelector('.event-name').textContent = ev;
                item.addEventListener('click', () => setCurrentEvent(ev));
                list.appendChild(item);
            });
        }
        _renderEventUI();
    }
    function _renderEventUI(){
        let current = getCurrentEvent();
        const select = document.getElementById('eventSelect');
        if(select){
            if(_eventOpts.allowAll){
                if(!current) current = 'ALL';
                select.value = current;
            } else {
                select.value = (current && current !== 'ALL') ? current : '';
            }
        }
        document.querySelectorAll('.event-row').forEach(row => {
            row.classList.toggle('is-active', row.dataset.event === current);
        });
        const sub = document.getElementById('currentEventLabel');
        if(sub){
            sub.textContent = (!current || current === 'ALL')
                ? (_eventOpts.allowAll ? 'All Events' : 'No event selected')
                : current;
        }
    }

    /* ---------------- steppers (data-step sets the increment) ---------------- */
    function wireSteppers(root){
        (root || document).querySelectorAll('.stepper').forEach(stepper => {
            if(stepper._wired) return;
            stepper._wired = true;
            const input = stepper.querySelector('input');
            const step = parseInt(stepper.dataset.step || '10', 10);
            const down = stepper.querySelector('.step-down');
            const up = stepper.querySelector('.step-up');
            if(down) down.addEventListener('click', () => {
                input.value = Math.max(0, (parseInt(input.value || '0', 10) - step));
            });
            if(up) up.addEventListener('click', () => {
                input.value = (parseInt(input.value || '0', 10) + step);
            });
        });
    }

    /* ---------------- navbar hamburger ---------------- */
    function wireNavbar(){
        const toggler = document.querySelector('.custom-toggler');
        const navCollapse = document.getElementById('navbarSupportedContent');
        if(toggler && navCollapse){
            navCollapse.addEventListener('shown.bs.collapse', () => toggler.classList.add('is-open'));
            navCollapse.addEventListener('hidden.bs.collapse', () => toggler.classList.remove('is-open'));
        }
    }

    /* ---------------- sign in (@stuypulse.com only) ---------------- */
    let _user = null;
    let _readyCbs = [];
    let _readyFired = false;
    let _adminPromise = null;

    function _gateEl(){
        let gate = document.getElementById('authGate');
        if(!gate){
            gate = document.createElement('div');
            gate.className = 'auth-gate';
            gate.id = 'authGate';
            gate.innerHTML =
                '<div class="auth-card">' +
                  '<div class="auth-brand">694 <span>SCOUTING</span></div>' +
                  '<p class="auth-sub">Sign in with your <b>@stuypulse.com</b> account.<br>Other emails cannot log in.</p>' +
                  '<button type="button" class="btn-signin" id="authSignInBtn">Sign in</button>' +
                  '<p class="auth-err" id="authErr" hidden></p>' +
                '</div>';
            document.body.appendChild(gate);
            gate.querySelector('#authSignInBtn').addEventListener('click', signIn);
        }
        return gate;
    }
    function _authError(msg){
        const gate = _gateEl();
        const err = gate.querySelector('#authErr');
        err.textContent = msg;
        err.hidden = false;
    }
    function signIn(){
        if(!window.firebase || !firebase.auth){ _authError('Firebase Auth is not loaded — check firebase-config.js.'); return; }
        if(window.location.protocol === 'file:'){
            _authError('You opened this page as a file (file://). Google sign-in only works over http — ' +
                'run a tiny local server in this folder (python3 -m http.server, then open http://localhost:8000/scout.html) ' +
                'or use the GitHub Pages URL.');
            return;
        }
        const provider = new firebase.auth.GoogleAuthProvider();
        provider.setCustomParameters({ hd: 'stuypulse.com', prompt: 'select_account' });
        firebase.auth().signInWithPopup(provider).catch(function(err){
            console.error('[scouting] sign-in error:', err && err.code, err);
            if(err && (err.code === 'auth/popup-blocked' ||
                       err.code === 'auth/operation-not-supported-in-this-environment' ||
                       err.code === 'auth/cancelled-popup-request')){
                // popup blockers / iOS standalone mode: fall back to a full-page redirect
                firebase.auth().signInWithRedirect(provider).catch(function(err2){
                    console.error('[scouting] redirect sign-in error:', err2 && err2.code, err2);
                    _authError('Sign-in failed (' + ((err2 && err2.code) || 'unknown') + '). ' +
                        'Check SETUP.md: Google provider enabled? Domain authorized?');
                });
            } else if(err && err.code === 'auth/popup-closed-by-user'){
                /* they closed the popup on purpose — not an error */
            } else {
                _authError('Sign-in failed: ' + (err && err.message ? err.message : 'unknown error') +
                    (err && err.code ? ' [' + err.code + ']' : ''));
            }
        });
    }
    function signOut(){
        if(window.firebase && firebase.auth) firebase.auth().signOut();
    }
    function _paintChip(){
        const slot = document.getElementById('navAuthSlot');
        if(!slot) return;
        if(_user){
            slot.innerHTML =
                '<div class="nav-auth">' +
                  '<span class="nav-user"></span>' +
                  '<button type="button" class="nav-signout">Sign out</button>' +
                '</div>';
            slot.querySelector('.nav-user').textContent = _user.displayName || _user.email;
            slot.querySelector('.nav-signout').addEventListener('click', signOut);
        } else {
            slot.innerHTML = '';
        }
    }
    function initAuth(){
        const gate = _gateEl();
        if(!window.firebase || !firebase.auth || !window.db){
            _authError('Firebase is not configured — see firebase-config.js.');
            return;
        }
        firebase.auth().onAuthStateChanged(function(user){
            _adminPromise = null;
            if(user && user.email && EMAIL_RE.test(user.email)){
                _user = user;
                gate.hidden = true;
                _paintChip();
                if(!_readyFired){
                    _readyFired = true;
                    _readyCbs.forEach(cb => { try { cb(user); } catch(e){ console.error(e); } });
                    _readyCbs = [];
                }
            } else {
                if(user){
                    // wrong domain — kick them out
                    firebase.auth().signOut();
                    _authError('That account is not an @stuypulse.com email. Use your StuyPulse account.');
                }
                _user = null;
                _readyFired = false;
                gate.hidden = false;
                _paintChip();
            }
        });
    }
    function ready(cb){
        if(_user && _readyFired){ try { cb(_user); } catch(e){ console.error(e); } }
        else _readyCbs.push(cb);
    }
    function user(){ return _user; }
    function userName(){ return _user ? (_user.displayName || _user.email) : ''; }
    function userEmail(){ return _user ? _user.email.toLowerCase() : ''; }
    function isAdmin(){
        if(!_user) return Promise.resolve(false);
        if(userEmail() === SEED_ADMIN) return Promise.resolve(true);
        if(!_adminPromise){
            _adminPromise = window.db.collection('admins').doc(userEmail()).get()
                .then(function(snap){ return snap.exists; })
                .catch(function(){ return false; });
        }
        return _adminPromise;
    }

    /* ---------------- photo compression (keeps Firestore docs small) ---------------- */
    function compressImage(file){
        return new Promise(function(resolve, reject){
            const url = URL.createObjectURL(file);
            const img = new Image();
            img.onload = function(){
                URL.revokeObjectURL(url);
                let scale = Math.min(1, 900 / Math.max(img.width, img.height, 1));
                let quality = 0.72;
                let out = '';
                for(let i = 0; i < 8; i++){
                    const c = document.createElement('canvas');
                    c.width = Math.max(1, Math.round(img.width * scale));
                    c.height = Math.max(1, Math.round(img.height * scale));
                    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
                    out = c.toDataURL('image/jpeg', quality);
                    if(out.length <= 360000) break;      // ~350 KB → 2 photos fit one Firestore doc
                    if(quality > 0.42) quality -= 0.12;
                    else scale *= 0.8;
                }
                out.length <= 360000 ? resolve(out) : reject(new Error('Photo is too large even after compression.'));
            };
            img.onerror = function(){ URL.revokeObjectURL(url); reject(new Error('Could not read that image.')); };
            img.src = url;
        });
    }

    /* boot */
    wireNavbar();
    initAuth();

    return {
        EVENTS: EVENTS,
        SEED_ADMIN: SEED_ADMIN,
        getCurrentEvent: getCurrentEvent,
        setCurrentEvent: setCurrentEvent,
        initEventUI: initEventUI,
        wireSteppers: wireSteppers,
        escapeHtml: escapeHtml,
        showToast: showToast,
        fmtWhen: fmtWhen,
        signIn: signIn,
        signOut: signOut,
        ready: ready,
        user: user,
        userName: userName,
        userEmail: userEmail,
        isAdmin: isAdmin,
        compressImage: compressImage
    };
})();
