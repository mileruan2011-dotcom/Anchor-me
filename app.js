(function(){
  'use strict';

  var KEY = 'determinationAnchor.v2';
  var LEGACY_KEY = 'determinationAnchor.v1';
  var SETTINGS_KEY = 'determinationAnchor.settings.v1';
  var CATEGORIES = ['Study','Recovery','Maintenance','Exploration','Fun'];
  var ENERGIES = ['low','medium','high'];
  var TIMES = [2,10,25,60];
  var SWITCH_REASONS = ['bored','too hard','tired','feels meaningless','avoiding','interrupted','wrong pick'];
  var INTENTS = {
    bored:{label:'I’m bored', q:{state:'bored',energy:'medium',time:10,direction:'Exploration'}, mode:'main'},
    avoidant:{label:'I don’t want to continue what I was doing', q:{state:'avoidant',energy:'low',time:10,direction:'Surprise me'}, mode:'no-vacuum', noVacuum:true},
    tired:{label:'I’m tired', q:{state:'tired',energy:'low',time:10,direction:'Recovery'}, mode:'recovery'},
    meaningful:{label:'I want to do something meaningful', q:{state:'focused',energy:'medium',time:25,direction:'Study'}, mode:'study'},
    fun:{label:'I want controlled fun', q:{state:'bored',energy:'low',time:10,direction:'Fun'}, mode:'fun'},
    surprise:{label:'Surprise me', q:{state:'curious',energy:'medium',time:10,direction:'Surprise me'}, mode:'main'}
  };
  var THEMES = {
    ocean:{label:'Ocean', hint:'cyan + blue', meta:'#0c1222'},
    violet:{label:'Violet', hint:'purple + pink', meta:'#1a1027'},
    forest:{label:'Forest', hint:'green + teal', meta:'#071610'},
    sunset:{label:'Sunset', hint:'orange + red', meta:'#21100a'},
    monochrome:{label:'Monochrome', hint:'grey + white', meta:'#101114'}
  };
  var SOUND_TYPES = { positive:[523.25,659.25], neutral:[392], warning:[220,174.61] };
  var DEFAULT_SETTINGS = {theme:'ocean', sound:true, volume:22, reduceMotion:false};
  var app = { db:null, currentTab:'dashboard', lastQ:null, pendingNo:false, rec:null, timer:null, bankFilter:{category:'All',energy:'All',time:'All',text:''}, settings:null, audioCtx:null, lastSoundAt:0 };

  function uid(){ if (window.crypto && typeof window.crypto.randomUUID === 'function') return window.crypto.randomUUID(); return 'id-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2); }
  function now(){ return new Date().toISOString(); }
  function two(n){ n = String(n); return n.length < 2 ? '0' + n : n; }
  function $(s, root){ return (root || document).querySelector(s); }
  function all(s, root){ return Array.prototype.slice.call((root || document).querySelectorAll(s)); }
  function esc(v){ return String(v == null ? '' : v).replace(/[&<>"']/g,function(m){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m];}); }

  function starterActivities(){
    var rows = [
      ['IELTS Reading tiny start','Study','low',[2,10,25],['avoidant','focused','bored'],'Open one IELTS reading passage and underline the first question stem.','One question stem is understood and the first answer attempt exists.','It turns study into one visible next move.',2,['ielts','reading']],
      ['IELTS Listening clip review','Study','low',[10,25],['tired','focused','curious'],'Play one 60-second clip and catch keywords.','Review one clip twice and note three missed words.','It repairs listening without asking for a full session.',2,['ielts','listening']],
      ['Vocabulary active recall','Study','low',[2,10,25],['bored','avoidant'],'Pick five words and hide the answers.','Recall five words before checking.','It gives boredom a small memory challenge.',1,['vocabulary']],
      ['Science concept repair','Study','medium',[10,25],['curious','focused','avoidant'],'Write one confusing concept as a question.','Explain it in three plain sentences.','It makes a fuzzy problem concrete.',3,['science']],
      ['10-minute walk','Recovery','low',[10,25],['restless','low mood','tired'],'Stand up and put shoes on.','Walk for the timebox and return with one word for your state.','It changes your body state before thought has to cooperate.',1,['walk','body']],
      ['Shower reset','Recovery','low',[10,25],['tired','low mood','restless'],'Start the water or gather a towel.','Take a simple reset shower.','It uses body care as a clean restart.',2,['reset']],
      ['Clean desk','Maintenance','medium',[2,10,25],['avoidant','restless'],'Move one object to its home.','The visible work zone has one clear landing area.','It creates momentum without needing a big plan.',2,['space']],
      ['Drink water / make tea','Recovery','low',[2,10],['tired','low mood','avoidant'],'Fill a glass or put the kettle on.','The drink is finished or beside you.','It answers low energy with basic care.',1,['hydration']],
      ['Read one article','Exploration','medium',[10,25],['curious','bored'],'Open one article and read the title.','Read it and write one takeaway.','It gives curiosity a boundary.',2,['reading']],
      ['Watch one video with a stop timer','Fun','low',[10,25],['bored','tired'],'Choose one video and set a stop timer first.','Timer ends and the tab closes.','It lets fun happen without drifting.',2,['video','controlled fun']],
      ['Play one timed game session','Fun','medium',[10,25],['bored','restless'],'Open the game only after setting a timer.','Stop when the timer rings.','It gives play clear edges.',3,['game','controlled fun']],
      ['Plan tomorrow','Maintenance','low',[10,25],['avoidant','focused'],'Write tomorrow at the top of a note.','Choose three possible anchors for tomorrow.','It removes a decision from future-you.',2,['planning']],
      ['Tiny journal note','Recovery','low',[2,10],['low mood','restless','tired'],'Write “Right now I notice…”','Three honest lines exist.','It names the state instead of letting it steer.',1,['journal']],
      ['Stretch for 5 minutes','Recovery','low',[10],['restless','tired'],'Stand up and roll shoulders once.','Stretch gently for five minutes.','It loosens stuck energy without a project.',1,['body']],
      ['Organize downloads folder','Maintenance','medium',[10,25],['bored','avoidant'],'Open Downloads and sort by date.','Ten items are deleted or filed.','It makes order visible fast.',2,['digital']],
      ['Sit outside for 5 minutes','Recovery','low',[2,10],['low mood','tired','restless'],'Step outside or sit by a window.','Five quiet minutes pass without optimizing.','It lowers pressure while still switching state.',1,['outside']],
      ['Do nothing intentionally for 2 minutes','Recovery','low',[2],['tired','low mood','restless'],'Set a two-minute timer and sit down.','Two minutes pass on purpose.','It turns collapse into a chosen pause.',1,['pause']]
    ];
    return rows.map(function(r){ return {id:uid(), title:r[0], category:r[1], energyRequired:r[2], timeOptions:r[3], suitableStates:r[4], firstStep:r[5], completion:r[6], why:r[7], friction:r[8], tags:r[9], custom:false}; });
  }
  function freshDb(){ return {activities:starterActivities(), currentAnchor:null, sessions:[]}; }
  function validDb(db){ return db && Array.isArray(db.activities) && db.activities.length && typeof db === 'object'; }
  function normalize(db){ db.currentAnchor = db.currentAnchor || null; db.sessions = Array.isArray(db.sessions) ? db.sessions : []; db.activities.forEach(function(a){ a.firstStep = a.firstStep || a.minimumStartStep || ''; a.completion = a.completion || a.completionDefinition || ''; a.why = a.why || a.whyItMatters || ''; }); return db; }
  function loadDb(){ try { var raw = localStorage.getItem(KEY) || localStorage.getItem(LEGACY_KEY); if (!raw) return freshDb(); var parsed = JSON.parse(raw); if (!validDb(parsed)) throw new Error('Malformed data'); return normalize(parsed); } catch(e) { try { localStorage.removeItem(KEY); localStorage.removeItem(LEGACY_KEY); } catch(ignore) {} return freshDb(); } }
  function saveDb(){ try { localStorage.setItem(KEY, JSON.stringify(app.db)); } catch(e) { toast('Could not save locally, but the app still works.'); } }


  function loadSettings(){
    var saved = null;
    try { saved = JSON.parse(localStorage.getItem(SETTINGS_KEY) || 'null'); } catch(e) { saved = null; }
    var out = Object.assign({}, DEFAULT_SETTINGS, saved || {});
    if(!THEMES[out.theme]) out.theme = DEFAULT_SETTINGS.theme;
    out.volume = Math.max(0, Math.min(100, Number(out.volume == null ? DEFAULT_SETTINGS.volume : out.volume)));
    out.sound = out.sound !== false;
    out.reduceMotion = !!out.reduceMotion;
    return out;
  }
  function saveSettings(){ try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(app.settings)); } catch(e) { toast('Could not save settings locally.'); } }
  function applySettings(){
    var root = document.documentElement;
    var theme = (app.settings && app.settings.theme) || DEFAULT_SETTINGS.theme;
    root.setAttribute('data-theme', theme);
    root.classList.toggle('reduce-motion', !!(app.settings && app.settings.reduceMotion));
    var meta = $('meta[name="theme-color"]');
    if(meta) meta.setAttribute('content', (THEMES[theme] || THEMES.ocean).meta);
  }
  function updateSetting(name,value){
    if(!app.settings) app.settings = loadSettings();
    if(name==='theme' && THEMES[value]) app.settings.theme = value;
    if(name==='sound') app.settings.sound = !!value;
    if(name==='volume') app.settings.volume = Math.max(0, Math.min(100, Number(value) || 0));
    if(name==='reduceMotion') app.settings.reduceMotion = !!value;
    saveSettings();
    applySettings();
    render();
  }
  function ensureAudio(){
    if(!window.AudioContext && !window.webkitAudioContext) return null;
    if(!app.audioCtx) app.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if(app.audioCtx.state === 'suspended') app.audioCtx.resume().catch(function(){ /* non-fatal autoplay guard */ });
    return app.audioCtx;
  }
  function playSound(kind){
    if(!app.settings || !app.settings.sound || Number(app.settings.volume) <= 0) return;
    var at = Date.now();
    if(at - app.lastSoundAt < 110) return;
    app.lastSoundAt = at;
    var ctx = ensureAudio();
    if(!ctx) return;
    var notes = SOUND_TYPES[kind] || SOUND_TYPES.neutral;
    var volume = Math.min(.16, Math.max(0, app.settings.volume / 100 * .16));
    notes.forEach(function(freq,i){
      var start = ctx.currentTime + i * .055;
      var osc = ctx.createOscillator();
      var gain = ctx.createGain();
      osc.type = kind === 'warning' ? 'triangle' : 'sine';
      osc.frequency.setValueAtTime(freq, start);
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(volume, start + .015);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + .13);
      osc.connect(gain).connect(ctx.destination);
      osc.start(start);
      osc.stop(start + .15);
    });
  }

  function score(a,q,mode){ var s=0; if(a.suitableStates.indexOf(q.state)>-1)s+=6; if(a.energyRequired===q.energy)s+=3; if(a.timeOptions.indexOf(Number(q.time))>-1)s+=2; if(q.direction==='Surprise me'||a.category===q.direction)s+=4; s+=6-(a.friction||2); if(mode==='tiny')s+=(a.energyRequired==='low'?7:0)+(a.timeOptions.indexOf(2)>-1?4:0); if(mode==='recovery')s+=(a.category==='Recovery'?10:0); if(mode==='fun')s+=(a.category==='Fun'?10:0); if(mode==='study')s+=(a.category==='Study'||a.category==='Maintenance'?6:0); return s; }
  function recommend(q,mode,exclude){ return app.db.activities.filter(function(a){return a.id!==exclude;}).sort(function(a,b){return score(b,q,mode)-score(a,q,mode);})[0]; }
  function chooseIntent(key, exclude){ playSound('positive'); var intent=INTENTS[key] || INTENTS.surprise; app.lastQ={state:intent.q.state,energy:intent.q.energy,time:intent.q.time,direction:intent.q.direction,intent:key,mode:intent.mode}; app.pendingNo=!!intent.noVacuum; app.rec=recommend(app.lastQ, intent.mode, exclude); render(); }
  function another(){ playSound('neutral'); if(!app.lastQ) return chooseIntent('surprise'); var old=app.rec && app.rec.id; app.rec=recommend(app.lastQ, app.lastQ.mode || 'main', old); render(); }
  function tinyVersion(){ playSound('neutral'); if(!app.rec) return; app.lastQ=app.lastQ || {state:'avoidant',energy:'low',time:2,direction:'Surprise me',mode:'tiny'}; app.lastQ.time=2; app.lastQ.energy='low'; app.lastQ.mode='tiny'; var tiny=recommend(app.lastQ,'tiny', app.rec.id); if(tiny) app.rec=tiny; render(); }

  function setTab(id){ if(!$('#'+id)) id='dashboard'; var previous=app.currentTab; var changed=previous!==id; app.currentTab=id; all('.tab').forEach(function(b){b.classList.toggle('active', b.getAttribute('data-tab')===id); b.setAttribute('aria-selected', b.getAttribute('data-tab')===id ? 'true' : 'false');}); all('.panel').forEach(function(p){p.classList.toggle('active', p.id===id);}); render(); if(changed && (id==='settings' || previous==='settings')) playSound('neutral'); }
  function render(){ var panel = $('.panel.active') || $('#dashboard'); if (!panel) return; var id = panel.id || 'dashboard'; try { panel.innerHTML = id==='dashboard'?dashboard():id==='current'?currentAnchor():id==='bank'?bank():id==='data'?aboutData():settingsView(); if(id==='current') startTimer(); } catch(e) { showError(e); } }
  function showError(e){ var main=$('main'); if(main) main.innerHTML='<section class="panel active"><div class="card"><h2>Anchor Me hit a snag.</h2><p class="muted">The page recovered instead of going blank.</p><pre class="item">'+esc(e.message || e)+'</pre><button class="btn primary" data-action="reset-data">Reset local data</button></div></section>'; }

  function dashboard(){ var cur=app.db.currentAnchor; var selected=app.lastQ && app.lastQ.intent; return '<div class="dashboard-stack"><section class="card prompt-card"><h2>What’s happening right now?</h2><div class="intent-grid">'+Object.keys(INTENTS).map(function(k){var active=selected===k; return '<button class="btn intent '+(active?'selected':'')+'" data-intent="'+esc(k)+'" aria-pressed="'+(active?'true':'false')+'"><span>'+esc(INTENTS[k].label)+'</span>'+(active?'<small>Selected</small>':'')+'</button>';}).join('')+'</div></section>'+(app.rec?recommendationCard(app.rec):'')+(cur?'<section class="card secondary">'+mini(cur)+'</section>':'')+'</div>'; }
  function mini(cur){ return '<p class="eyebrow">Current Anchor</p><h3>'+esc(cur.title)+'</h3><p>'+esc(cur.firstStep)+'</p><button class="btn" data-tab-go="current">Open</button>'; }
  function recTime(){ return Number((app.lastQ && app.lastQ.time) || 10); }
  function recommendationCard(a){ var no=app.pendingNo?'<p class="no-vacuum-note">Choose a replacement before leaving this flow.</p>':''; return '<section class="card recommendation"><p class="eyebrow">Recommended anchor</p><h2>'+esc(a.title)+'</h2><div class="rec-lines"><p><b>First tiny step</b><br>'+esc(a.firstStep)+'</p><p><b>Time</b><br>'+recTime()+' minutes</p><p><b>Why this fits</b><br>'+esc(a.why)+'</p></div>'+no+'<div class="actions rec-actions"><button class="btn primary" data-start="'+esc(a.id)+'" data-mode="'+esc((app.lastQ&&app.lastQ.mode)||'main')+'">Start</button><button class="btn" data-action="another">Give me another</button><button class="btn" data-action="smaller">Make it smaller</button></div></section>'; }
  function currentAnchor(){ var c=app.db.currentAnchor; if(!c) return '<div class="card"><h2>Current Anchor</h2><p class="muted">No active anchor.</p><button class="btn primary" data-tab-go="dashboard">Choose one</button></div>'; return '<div class="card current-card"><p class="eyebrow">Current Anchor</p><h2>'+esc(c.title)+'</h2><p><span class="chip">'+esc(c.category)+'</span> <span class="chip">'+c.time+' minutes</span></p><h3>First tiny step</h3><p>'+esc(c.firstStep)+'</p><div class="timer" id="timer">--:--</div><div class="actions"><button class="btn good" data-action="complete">Complete</button><button class="btn warn" data-action="switch">Switch</button><button class="btn danger" data-action="stop">Stop</button></div></div>'; }
  function select(id,label,opts,val){ return '<label>'+label+'<select id="'+id+'">'+opts.map(function(o){return '<option '+(String(o)===String(val)?'selected':'')+'>'+esc(o)+'</option>';}).join('')+'</select></label>'; }
  function bank(){ var f=app.bankFilter; return '<div class="card"><h2>Activity Bank</h2><div class="form-grid">'+select('filterCategory','Category',['All'].concat(CATEGORIES),f.category)+select('filterEnergy','Energy',['All'].concat(ENERGIES),f.energy)+select('filterTime','Time',['All'].concat(TIMES),f.time)+'<label>Search<input id="filterText" placeholder="title or tag" value="'+esc(f.text)+'"></label></div><br><button class="btn" data-action="apply-bank-filter">Filter</button></div><div class="list">'+activityList(filteredActivities())+'</div>'; }
  function filteredActivities(){ var f=app.bankFilter; var text=(f.text||'').toLowerCase(); return app.db.activities.filter(function(a){ return (f.category==='All'||a.category===f.category) && (f.energy==='All'||a.energyRequired===f.energy) && (f.time==='All'||a.timeOptions.indexOf(Number(f.time))>-1) && (!text || a.title.toLowerCase().indexOf(text)>-1 || (a.tags||[]).join(' ').toLowerCase().indexOf(text)>-1); }); }
  function activityList(items){ return items.map(function(a){return '<div class="item"><h3>'+esc(a.title)+'</h3><p><span class="chip">'+esc(a.category)+'</span> <span class="chip">'+esc(a.energyRequired)+'</span> <span class="chip">'+esc(a.timeOptions.join('/'))+' min</span></p><p>'+esc(a.firstStep)+'</p></div>';}).join(''); }
  function aboutData(){ return '<div class="card"><h2>About / Data</h2><p>The No Vacuum Rule: when you say no, stop, quit, delay, or switch, choose a replacement anchor so the empty space does not choose for you.</p><p class="muted">Anchor Me is local-first and avoids streaks, scores, and guilt.</p><div class="actions"><button class="btn primary" data-action="export">Export JSON</button><label class="btn">Import JSON<input hidden type="file" id="importFile" accept="application/json"></label><button class="btn danger" data-action="reset-data">Reset local data</button></div></div>'; }
  function settingsView(){ var s=app.settings || DEFAULT_SETTINGS; return '<div class="card settings-card"><p class="eyebrow">Personalize</p><h2>Settings</h2><div class="settings-grid"><fieldset><legend>Theme color</legend><div class="theme-grid">'+Object.keys(THEMES).map(function(k){var t=THEMES[k], on=s.theme===k; return '<button class="theme-choice '+(on?'selected':'')+'" data-theme-choice="'+esc(k)+'" aria-pressed="'+(on?'true':'false')+'"><span class="swatch" aria-hidden="true"></span><span><b>'+esc(t.label)+'</b><small>'+esc(t.hint)+(on?' · Selected':'')+'</small></span></button>';}).join('')+'</div></fieldset><fieldset><legend>Sound feedback</legend><label class="toggle-row"><span><b>Sound effects</b><small>Soft tones for actions. Never required.</small></span><input type="checkbox" id="soundToggle" '+(s.sound?'checked':'')+'></label><label class="range-label" for="volumeSlider"><span>Sound volume</span><output>'+Math.round(s.volume)+'</output><input type="range" id="volumeSlider" min="0" max="100" value="'+esc(s.volume)+'"></label></fieldset><fieldset><legend>Motion</legend><label class="toggle-row"><span><b>Reduce motion</b><small>Shortens transitions and follows your preference here.</small></span><input type="checkbox" id="motionToggle" '+(s.reduceMotion?'checked':'')+'></label></fieldset></div></div>'; }


  function startAnchor(id,mode){ playSound('positive'); var a=app.db.activities.filter(function(x){return x.id===id;})[0]; if(!a) return; app.db.currentAnchor={id:uid(), activityId:a.id, title:a.title, category:a.category, why:a.why, firstStep:a.firstStep, completion:a.completion, mode:mode, time:recTime(), startedAt:now()}; app.pendingNo=false; saveDb(); setTab('current'); toast('Anchor started'); }
  function complete(status, reason){ playSound(status==='completed'?'positive':'warning'); var c=app.db.currentAnchor; if(!c) return; c.status=status; c.reason=reason||'done'; c.endedAt=now(); app.db.sessions.push(c); app.db.currentAnchor=null; saveDb(); setTab('dashboard'); toast(status==='completed'?'Anchor complete':'Anchor closed'); }
  function switchFlow(){ playSound('warning'); showChoiceModal('Switch','Choose a replacement reason.', SWITCH_REASONS, function(reason){ var q={state:'bored',energy:'low',time:10,direction:'Surprise me'}; if(reason==='too hard'){q.time=2;} if(reason==='tired'){q.direction='Recovery';q.state='tired';} if(reason==='bored'){q.direction='Exploration';} if(reason==='avoiding'){q.time=2;q.state='avoidant';q.direction='Study';} complete('switched', reason); app.lastQ={state:q.state,energy:q.energy,time:q.time,direction:q.direction,mode:'main'}; app.rec=recommend(app.lastQ,'main'); app.pendingNo=true; setTab('dashboard'); }); }
  function showChoiceModal(title,sub,choices,cb){ var d=$('#switchDialog'); d.innerHTML='<div class="modal-inner"><h2>'+esc(title)+'</h2><p class="muted">'+esc(sub)+'</p><div class="list">'+choices.map(function(c){return '<button class="btn" data-choice="'+esc(c)+'">'+esc(c)+'</button>';}).join('')+'</div></div>'; d._choiceCallback=cb; d.showModal(); }
  function startTimer(){ clearInterval(app.timer); var c=app.db.currentAnchor, el=$('#timer'); if(!c||!el) return; var end=new Date(c.startedAt).getTime()+c.time*60000; app.timer=setInterval(function(){ var left=Math.max(0,end-Date.now()); el.textContent=two(Math.floor(left/60000))+':'+two(Math.floor(left/1000)%60); },500); }
  function toast(t){ var el=$('#toast'); if(!el) return; el.textContent=t; el.classList.add('show'); setTimeout(function(){el.classList.remove('show');},1800); }
  function exportData(){ var blob=new Blob([JSON.stringify(app.db,null,2)],{type:'application/json'}); var u=URL.createObjectURL(blob); var a=document.createElement('a'); a.href=u; a.download='anchor-me-data.json'; a.click(); URL.revokeObjectURL(u); }
  function importData(file){ if(!file) return; var reader=new FileReader(); reader.onload=function(){ try{ var incoming=JSON.parse(reader.result); if(!validDb(incoming)) throw new Error('Invalid'); app.db=normalize(incoming); saveDb(); render(); toast('Data imported'); }catch(e){toast('Import failed');} }; reader.readAsText(file); }
  function bind(){
    document.addEventListener('click', function(e){ var t=e.target.closest('button,[data-tab-go]'); if(!t) return; if(app.pendingNo && ((t.dataset.tabGo && t.dataset.tabGo!=='dashboard') || (t.dataset.tab && t.dataset.tab!=='dashboard'))){ toast('Choose a replacement anchor first.'); return; } if(t.dataset.tabGo){ setTab(t.dataset.tabGo); return; } if(t.dataset.tab){ setTab(t.dataset.tab); return; } if(t.dataset.intent){ chooseIntent(t.dataset.intent); return; } if(t.dataset.themeChoice){ updateSetting('theme', t.dataset.themeChoice); playSound('neutral'); return; } if(t.dataset.start){ startAnchor(t.dataset.start,t.dataset.mode); return; } if(t.dataset.choice && $('#switchDialog')._choiceCallback){ var cb=$('#switchDialog')._choiceCallback; $('#switchDialog').close(); cb(t.dataset.choice); return; } var a=t.dataset.action; if(a==='another') another(); if(a==='smaller') tinyVersion(); if(a==='apply-bank-filter'){ app.bankFilter={category:($('#filterCategory')||{}).value||'All',energy:($('#filterEnergy')||{}).value||'All',time:($('#filterTime')||{}).value||'All',text:($('#filterText')||{}).value||''}; render(); } if(a==='complete') complete('completed','done'); if(a==='stop') complete('stopped','stop'); if(a==='switch') switchFlow(); if(a==='export') exportData(); if(a==='reset-data'){ app.db=freshDb(); app.pendingNo=false; app.rec=null; saveDb(); setTab('dashboard'); } });
    document.addEventListener('change', function(e){ if(e.target && e.target.id==='importFile') importData(e.target.files[0]); if(e.target && e.target.id==='soundToggle'){ updateSetting('sound', e.target.checked); if(e.target.checked) playSound('positive'); } if(e.target && e.target.id==='motionToggle') updateSetting('reduceMotion', e.target.checked); });
    document.addEventListener('input', function(e){ if(e.target && e.target.id==='volumeSlider'){ updateSetting('volume', e.target.value); } });
  }
  function registerServiceWorker(){ if('serviceWorker' in navigator) navigator.serviceWorker.register('./service-worker.js').catch(function(){ /* non-fatal */ }); }
  function init(){ try{ app.db=loadDb(); app.settings=loadSettings(); applySettings(); bind(); setTab('dashboard'); registerServiceWorker(); } catch(e){ showError(e); } }
  document.addEventListener('DOMContentLoaded', init);
})();
