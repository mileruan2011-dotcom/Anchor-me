(function(){
  'use strict';

  var KEY = 'determinationAnchor.v2';
  var LEGACY_KEY = 'determinationAnchor.v1';
  var CATEGORIES = ['Study','Recovery','Maintenance','Exploration','Fun'];
  var STATES = ['bored','tired','restless','avoidant','focused','curious','low mood'];
  var ENERGIES = ['low','medium','high'];
  var TIMES = [2,10,25,60];
  var DIRECTIONS = ['Study','Recovery','Maintenance','Exploration','Fun','Surprise me'];
  var SWITCH_REASONS = ['bored','too hard','tired','feels meaningless','avoiding','interrupted','wrong pick'];
  var app = { db:null, currentTab:'dashboard', lastQ:null, pendingNo:null, replacement:null, timer:null, bankFilter:{category:'All',energy:'All',time:'All',text:''} };

  function uid(){
    if (window.crypto && typeof window.crypto.randomUUID === 'function') return window.crypto.randomUUID();
    return 'id-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2);
  }
  function now(){ return new Date().toISOString(); }
  function two(n){ n = String(n); return n.length < 2 ? '0' + n : n; }
  function $(s, root){ return (root || document).querySelector(s); }
  function all(s, root){ return Array.prototype.slice.call((root || document).querySelectorAll(s)); }
  function esc(v){ return String(v == null ? '' : v).replace(/[&<>"']/g,function(m){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m];}); }

  function starterActivities(){
    var rows = [
      ['IELTS Reading tiny start','Study','low',[2,10,25],['avoidant','focused','bored'],'Open one IELTS reading passage and underline the first question stem.','One question stem is understood and the first answer attempt exists.','It lowers the wall before study starts.',2,['ielts','reading']],
      ['IELTS Listening clip review','Study','low',[10,25],['tired','focused','curious'],'Play one 60-second clip and catch keywords.','Review one clip twice and note three missed words.','Small listening repairs compound quickly.',2,['ielts','listening']],
      ['Vocabulary active recall','Study','low',[2,10,25],['bored','avoidant'],'Pick five words and hide the answers.','Recall five words before checking.','Active recall beats passive rereading.',1,['vocabulary']],
      ['Science concept repair','Study','medium',[10,25],['curious','focused','avoidant'],'Write one confusing concept as a question.','Explain it in three plain sentences.','A named confusion becomes repairable.',3,['science']],
      ['10-minute walk','Recovery','low',[10,25],['restless','low mood','tired'],'Stand up and put shoes on.','Walk for the timebox and return with one word for your state.','Movement changes state before thoughts cooperate.',1,['walk','body']],
      ['Shower reset','Recovery','low',[10,25],['tired','low mood','restless'],'Start the water or gather a towel.','Take a simple reset shower.','A body reset can restart the cockpit.',2,['reset']],
      ['Clean desk','Maintenance','medium',[2,10,25],['avoidant','restless'],'Move one object to its home.','The visible work zone has one clear landing area.','Less friction makes the next good choice easier.',2,['space']],
      ['Drink water / make tea','Recovery','low',[2,10],['tired','low mood','avoidant'],'Fill a glass or put the kettle on.','The drink is finished or beside you.','Basic care is an anchor, not a detour.',1,['hydration']],
      ['Read one article','Exploration','medium',[10,25],['curious','bored'],'Open one article and read the title.','Read it and write one takeaway.','Curiosity gets a boundary instead of a rabbit hole.',2,['reading']],
      ['Watch one video with a stop timer','Fun','low',[10,25],['bored','tired'],'Choose one video and set a stop timer first.','Timer ends and the tab closes.','Controlled fun prevents drift.',2,['video','controlled fun']],
      ['Play one timed game session','Fun','medium',[10,25],['bored','restless'],'Open the game only after setting a timer.','Stop when the timer rings.','Fun is safer with edges.',3,['game','controlled fun']],
      ['Plan tomorrow','Maintenance','low',[10,25],['avoidant','focused'],'Write tomorrow at the top of a note.','Choose three possible anchors for tomorrow.','Future-you needs fewer decisions.',2,['planning']],
      ['Tiny journal note','Recovery','low',[2,10],['low mood','restless','tired'],'Write “Right now I notice…”','Three honest lines exist.','Naming the state keeps it from steering silently.',1,['journal']],
      ['Stretch for 5 minutes','Recovery','low',[10],['restless','tired'],'Stand up and roll shoulders once.','Stretch gently for five minutes.','It loosens stuck energy without a big plan.',1,['body']],
      ['Organize downloads folder','Maintenance','medium',[10,25],['bored','avoidant'],'Open Downloads and sort by date.','Ten items are deleted or filed.','Small order creates visible momentum.',2,['digital']],
      ['Sit outside for 5 minutes','Recovery','low',[2,10],['low mood','tired','restless'],'Step outside or sit by a window.','Five quiet minutes pass without optimizing.','A softer nervous system makes better choices.',1,['outside']],
      ['Do nothing intentionally for 2 minutes','Recovery','low',[2],['tired','low mood','restless'],'Set a two-minute timer and sit down.','Two minutes pass on purpose.','Intentional nothing is different from collapse.',1,['pause']]
    ];
    return rows.map(function(r){ return {id:uid(), title:r[0], category:r[1], energyRequired:r[2], timeOptions:r[3], suitableStates:r[4], firstStep:r[5], completion:r[6], why:r[7], friction:r[8], tags:r[9], custom:false}; });
  }
  function freshDb(){ return {activities:starterActivities(), currentAnchor:null, sessions:[]}; }
  function validDb(db){ return db && Array.isArray(db.activities) && db.activities.length && typeof db === 'object'; }
  function normalize(db){ db.currentAnchor = db.currentAnchor || null; db.sessions = Array.isArray(db.sessions) ? db.sessions : []; db.activities.forEach(function(a){ a.firstStep = a.firstStep || a.minimumStartStep || ''; a.completion = a.completion || a.completionDefinition || ''; a.why = a.why || a.whyItMatters || ''; }); return db; }
  function loadDb(){
    try {
      var raw = localStorage.getItem(KEY) || localStorage.getItem(LEGACY_KEY);
      if (!raw) return freshDb();
      var parsed = JSON.parse(raw);
      if (!validDb(parsed)) throw new Error('Malformed data');
      return normalize(parsed);
    } catch(e) {
      try { localStorage.removeItem(KEY); localStorage.removeItem(LEGACY_KEY); } catch(ignore) {}
      return freshDb();
    }
  }
  function saveDb(){ try { localStorage.setItem(KEY, JSON.stringify(app.db)); } catch(e) { toast('Could not save locally, but the app still works.'); } }

  function score(a,q,mode){ var s=0; if(a.suitableStates.indexOf(q.state)>-1)s+=5; if(a.energyRequired===q.energy)s+=3; if(a.timeOptions.indexOf(Number(q.time))>-1)s+=2; if(q.direction==='Surprise me'||a.category===q.direction)s+=3; s+=6-(a.friction||2); if(mode==='tiny')s+=(a.energyRequired==='low'?6:0); if(mode==='recovery')s+=(a.category==='Recovery'?9:0); if(mode==='fun')s+=(a.category==='Fun'?9:0); if(mode==='study')s+=(a.category==='Study'||a.category==='Maintenance'?5:0); return s; }
  function recommend(q,mode,exclude){ return app.db.activities.filter(function(a){return a.id!==exclude;}).sort(function(a,b){return score(b,q,mode)-score(a,q,mode);})[0]; }
  function recs(q){ var main=recommend(q,'main'); var tiny=recommend(q,'tiny', main && main.id); var escape=recommend(q, q.state==='tired'?'recovery':'fun', main && main.id); return [{label:'Main Anchor',a:main,mode:'main'},{label:'Tiny Anchor',a:tiny,mode:'tiny'},{label:'Escape Anchor',a:escape,mode:'escape'}]; }

  function setTab(id){ if(!$('#'+id)) id='dashboard'; app.currentTab=id; all('.tab').forEach(function(b){b.classList.toggle('active', b.getAttribute('data-tab')===id);}); all('.panel').forEach(function(p){p.classList.toggle('active', p.id===id);}); render(); }
  function render(){
    var panel = $('.panel.active') || $('#dashboard');
    if (!panel) return;
    if (!panel.classList.contains('active')) setTab('dashboard');
    var id = panel.id || 'dashboard';
    try {
      panel.innerHTML = id==='dashboard'?dashboard():id==='anchor'?anchorMe():id==='current'?currentAnchor():id==='bank'?bank():aboutData();
      if(id==='current') startTimer();
    } catch(e) { showError(e); }
  }
  function showError(e){ var main=$('main'); if(main) main.innerHTML='<section class="panel active"><div class="card"><h2>Determination Anchor hit a snag.</h2><p class="muted">The page recovered instead of going blank. Reset local data if this keeps happening.</p><pre class="item">'+esc(e.message || e)+'</pre><button class="btn primary" data-action="reset-data">Reset local data</button></div></section>'; }

  function dashboard(){ var cur=app.db.currentAnchor; return '<div class="grid"><div class="card span8"><p class="eyebrow">No Vacuum Rule</p><h2>Choose your next anchor</h2><p class="muted">Every “No” needs an Anchor. If you decide not to do something, choose a small replacement action before the motivation vacuum grows.</p>'+(cur?mini(cur):'<div class="item"><p>No active anchor. Choose a small landing point before the vacuum grows.</p></div>')+'<div class="actions big-actions"><button class="btn primary" data-tab-go="anchor">Anchor Me</button><button class="btn" data-quick="bored">I’m Bored</button><button class="btn" data-quick="avoidant">I’m Avoiding</button><button class="btn good" data-action="no-vacuum">I Decided Not To Do Something</button><button class="btn" data-preset="tiny">Tiny Start</button><button class="btn" data-preset="recovery">Recovery Anchor</button><button class="btn" data-preset="fun">Controlled Fun</button></div></div><div class="card span4"><h2>Fast cockpit</h2><p class="muted">Pick a state, drop anchor, and move. No streaks. No scores. No guilt dashboard.</p></div></div>'; }
  function mini(cur){ return '<div class="item"><p class="eyebrow">Current Anchor</p><h3>'+esc(cur.title)+'</h3><p>'+esc(cur.firstStep)+'</p><button class="btn primary" data-tab-go="current">Open Current Anchor</button></div>'; }
  function selects(q){ return select('state','Current state',STATES,q.state)+select('energy','Energy',ENERGIES,q.energy)+select('time','Available time',TIMES,q.time)+select('direction','Desired direction',DIRECTIONS,q.direction); }
  function select(id,label,opts,val){ return '<label>'+label+'<select id="'+id+'">'+opts.map(function(o){return '<option '+(String(o)===String(val)?'selected':'')+'>'+esc(o)+'</option>';}).join('')+'</select></label>'; }
  function currentQ(){ return {state:($('#state')||{}).value||'bored', energy:($('#energy')||{}).value||'low', time:Number(($('#time')||{}).value||10), direction:($('#direction')||{}).value||'Surprise me'}; }
  function anchorMe(){ var q=app.lastQ || {state:'bored',energy:'low',time:10,direction:'Surprise me'}; var cards= app.lastQ ? recs(q).map(card).join('') : ''; return '<div class="card"><h2>Anchor Me</h2><p class="muted">Answer four quick questions. You will get exactly three choices.</p><div class="form-grid">'+selects(q)+'</div><br><button class="btn primary" data-action="recommend">Recommend anchors</button></div><div class="grid">'+cards+'</div>'; }
  function card(r){ if(!r.a) return ''; return '<div class="card span4 rec"><p class="eyebrow">'+r.label+'</p><h3>'+esc(r.a.title)+'</h3><p><b>Why it fits:</b> '+esc(r.a.why)+'</p><p><b>First tiny step:</b> '+esc(r.a.firstStep)+'</p><p><b>Completion:</b> '+esc(r.a.completion)+'</p><p><span class="chip">'+(app.lastQ?app.lastQ.time:10)+' min</span></p><button class="btn primary" data-start="'+esc(r.a.id)+'" data-mode="'+esc(r.mode)+'">Start</button></div>'; }
  function currentAnchor(){ var c=app.db.currentAnchor; if(!c) return '<div class="card"><h2>Current Anchor</h2><p class="muted">No active anchor. Choose a small landing point before the vacuum grows.</p><button class="btn primary" data-tab-go="anchor">Anchor Me</button></div>'; return '<div class="card"><p class="eyebrow">Current Anchor · '+esc(c.mode)+'</p><h2>'+esc(c.title)+'</h2><p><span class="chip">'+esc(c.category)+'</span> <span class="chip">'+c.time+' minutes</span></p><p>'+esc(c.why)+'</p><h3>First tiny step</h3><p>'+esc(c.firstStep)+'</p><h3>Completion definition</h3><p>'+esc(c.completion)+'</p><div class="timer" id="timer">--:--</div><div class="actions"><button class="btn good" data-action="complete">Complete</button><button class="btn warn" data-action="switch">Switch</button><button class="btn danger" data-action="stop">Stop</button></div></div>'; }
  function bank(){ var f=app.bankFilter; return '<div class="card"><h2>Activity Bank</h2><p class="muted">Secondary shelf. The main action is still Anchor Me.</p><div class="form-grid">'+select('filterCategory','Category',['All'].concat(CATEGORIES),f.category)+select('filterEnergy','Energy',['All'].concat(ENERGIES),f.energy)+select('filterTime','Time',['All'].concat(TIMES),f.time)+'<label>Search<input id="filterText" placeholder="title or tag" value="'+esc(f.text)+'"></label></div><br><button class="btn" data-action="apply-bank-filter">Filter</button> <button class="btn primary" data-action="add-activity">Add custom activity</button></div><div class="list">'+activityList(filteredActivities())+'</div>'; }
  function filteredActivities(){ var f=app.bankFilter; var text=(f.text||'').toLowerCase(); return app.db.activities.filter(function(a){ return (f.category==='All'||a.category===f.category) && (f.energy==='All'||a.energyRequired===f.energy) && (f.time==='All'||a.timeOptions.indexOf(Number(f.time))>-1) && (!text || a.title.toLowerCase().indexOf(text)>-1 || (a.tags||[]).join(' ').toLowerCase().indexOf(text)>-1); }); }
  function activityList(items){ return items.map(function(a){return '<div class="item"><h3>'+esc(a.title)+'</h3><p><span class="chip">'+esc(a.category)+'</span> <span class="chip">'+esc(a.energyRequired)+'</span> <span class="chip">'+esc(a.timeOptions.join('/'))+' min</span></p><p>'+esc(a.firstStep)+'</p></div>';}).join(''); }
  function aboutData(){ return '<div class="card"><h2>About / Data</h2><p>The No Vacuum Rule: when you say no, stop, quit, delay, or switch, choose a replacement anchor so the empty space does not choose for you.</p><p class="muted">Determination Anchor is local-first. Data is stored only in this browser. It is not a habit tracker, stats dashboard, or life database.</p><div class="actions"><button class="btn primary" data-action="export">Export JSON</button><label class="btn">Import JSON<input hidden type="file" id="importFile" accept="application/json"></label><button class="btn danger" data-action="reset-data">Reset local data</button></div></div>'; }

  function startAnchor(id,mode){ var a=app.db.activities.filter(function(x){return x.id===id;})[0]; if(!a) return; var q=app.lastQ || {state:'bored',energy:'low',time:10,direction:'Surprise me'}; app.db.currentAnchor={id:uid(), activityId:a.id, title:a.title, category:a.category, why:a.why, firstStep:a.firstStep, completion:a.completion, mode:mode, time:Number(q.time)||10, startedAt:now()}; saveDb(); setTab('current'); toast('Anchor started'); }
  function complete(status, reason){ var c=app.db.currentAnchor; if(!c) return; c.status=status; c.reason=reason||'done'; c.endedAt=now(); app.db.sessions.push(c); app.db.currentAnchor=null; saveDb(); render(); toast(status==='completed'?'Anchor complete':'Anchor closed'); }
  function quick(state){ app.lastQ={state:state,energy:state==='tired'?'low':'medium',time:10,direction:'Surprise me'}; setTab('anchor'); }
  function preset(mode){ app.lastQ={state:mode==='recovery'?'tired':'bored',energy:'low',time:mode==='tiny'?2:10,direction:mode==='fun'?'Fun':mode==='recovery'?'Recovery':'Surprise me'}; setTab('anchor'); }
  function switchFlow(){ showChoiceModal('Switch Ritual','Why are you switching?', SWITCH_REASONS, function(reason){ var q={state:'bored',energy:'low',time:10,direction:'Surprise me'}; if(reason==='too hard'){q.time=2;} if(reason==='tired'){q.direction='Recovery';q.state='tired';} if(reason==='bored'){q.direction='Exploration';} if(reason==='avoiding'){q.time=2;q.state='avoidant';q.direction='Study';} if(reason==='interrupted'){q.direction='Recovery';} complete('switched', reason); app.lastQ=q; setTab('anchor'); }); }
  function noVacuum(){ var d=$('#switchDialog'); d.innerHTML='<form class="modal-inner" method="dialog"><p class="eyebrow">No Vacuum Rule</p><h2>You created a vacuum. Choose a replacement anchor.</h2><label>What did you decide not to do?<input id="noWhat"></label><label>Why?<textarea id="noWhy"></textarea></label><br><button class="btn primary" data-action="show-vacuum" type="button">Show replacement anchors</button></form>'; d.showModal(); }
  function showVacuum(){ var d=$('#switchDialog'); if(d) d.close(); var q={state:'avoidant',energy:'low',time:10,direction:'Surprise me'}; app.lastQ=q; var cards=[{label:'Recovery Anchor',a:recommend(q,'recovery'),mode:'recovery'},{label:'Productive Tiny Anchor',a:recommend({state:'avoidant',energy:'low',time:2,direction:'Study'},'study'),mode:'tiny'},{label:'Controlled Fun Anchor',a:recommend({state:'bored',energy:'low',time:10,direction:'Fun'},'fun'),mode:'escape'}].map(card).join(''); setTab('anchor'); $('#anchor').innerHTML='<div class="card"><p class="eyebrow">No Vacuum Rule</p><h2>You created a vacuum. Choose a replacement anchor.</h2></div><div class="grid">'+cards+'</div>'; }
  function showChoiceModal(title,sub,choices,cb){ var d=$('#switchDialog'); d.innerHTML='<div class="modal-inner"><h2>'+esc(title)+'</h2><p class="muted">'+esc(sub)+'</p><div class="list">'+choices.map(function(c){return '<button class="btn" data-choice="'+esc(c)+'">'+esc(c)+'</button>';}).join('')+'</div></div>'; d._choiceCallback=cb; d.showModal(); }
  function startTimer(){ clearInterval(app.timer); var c=app.db.currentAnchor, el=$('#timer'); if(!c||!el) return; var end=new Date(c.startedAt).getTime()+c.time*60000; app.timer=setInterval(function(){ var left=Math.max(0,end-Date.now()); el.textContent=two(Math.floor(left/60000))+':'+two(Math.floor(left/1000)%60); },500); }
  function toast(t){ var el=$('#toast'); if(!el) return; el.textContent=t; el.classList.add('show'); setTimeout(function(){el.classList.remove('show');},1800); }
  function exportData(){ var blob=new Blob([JSON.stringify(app.db,null,2)],{type:'application/json'}); var u=URL.createObjectURL(blob); var a=document.createElement('a'); a.href=u; a.download='determination-anchor-data.json'; a.click(); URL.revokeObjectURL(u); }
  function importData(file){ if(!file) return; var reader=new FileReader(); reader.onload=function(){ try{ var incoming=JSON.parse(reader.result); if(!validDb(incoming)) throw new Error('Invalid'); app.db=normalize(incoming); saveDb(); render(); toast('Data imported'); }catch(e){toast('Import failed');} }; reader.readAsText(file); }
  function bind(){
    document.addEventListener('click', function(e){ var t=e.target.closest('button,[data-tab-go]'); if(!t) return; if(t.dataset.tabGo){ setTab(t.dataset.tabGo); return; } if(t.dataset.quick){ quick(t.dataset.quick); return; } if(t.dataset.preset){ preset(t.dataset.preset); return; } if(t.dataset.start){ startAnchor(t.dataset.start,t.dataset.mode); return; } if(t.dataset.choice && $('#switchDialog')._choiceCallback){ var cb=$('#switchDialog')._choiceCallback; $('#switchDialog').close(); cb(t.dataset.choice); return; } var a=t.dataset.action; if(a==='recommend'){ app.lastQ=currentQ(); render(); } if(a==='apply-bank-filter'){ app.bankFilter={category:($('#filterCategory')||{}).value||'All',energy:($('#filterEnergy')||{}).value||'All',time:($('#filterTime')||{}).value||'All',text:($('#filterText')||{}).value||''}; render(); } if(a==='complete') complete('completed','done'); if(a==='stop') complete('stopped','stop'); if(a==='switch') switchFlow(); if(a==='no-vacuum') noVacuum(); if(a==='show-vacuum') showVacuum(); if(a==='export') exportData(); if(a==='reset-data'){ app.db=freshDb(); saveDb(); setTab('dashboard'); } if(a==='add-activity') toast('Custom editing can stay simple: import/export JSON for now.'); });
    document.addEventListener('change', function(e){ if(e.target && e.target.id==='importFile') importData(e.target.files[0]); });
  }
  function registerServiceWorker(){ if('serviceWorker' in navigator) navigator.serviceWorker.register('./service-worker.js').catch(function(){ /* non-fatal */ }); }
  function init(){ try{ app.db=loadDb(); bind(); var active=$('.tab.active'); setTab(active ? active.getAttribute('data-tab') : 'dashboard'); registerServiceWorker(); } catch(e){ showError(e); } }
  document.addEventListener('DOMContentLoaded', init);
})();
