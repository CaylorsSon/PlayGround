(() => {
  const canvas = document.getElementById('battlefield');
  const ctx = canvas.getContext('2d');
  const cardRow = document.getElementById('cardRow');
  const cards = {
    luke: { name: 'LUKE', role: 'JEDI KNIGHT', cost: 4, icon: '⚔️', hp: 170, damage: 38, range: 42, speed: 30, rate: .8, color: '#67d8e6', kind: 'hero' },
    han: { name: 'HAN SOLO', role: 'BLASTER ACE', cost: 3, icon: '🔫', hp: 100, damage: 24, range: 120, speed: 33, rate: 1.05, color: '#6fd4cb', kind: 'ranged' },
    chewie: { name: 'CHEWIE', role: 'WOOKIEE TANK', cost: 5, icon: '🐻', hp: 280, damage: 35, range: 37, speed: 22, rate: 1.05, color: '#dfa65e', kind: 'tank' },
    artoo: { name: 'R2-D2', role: 'ASTROMECH', cost: 2, icon: '🤖', hp: 85, damage: 16, range: 105, speed: 26, rate: .75, color: '#83d7ee', kind: 'support' },
    xwing: { name: 'X-WING', role: 'STARFIGHTER', cost: 4, icon: '✈️', hp: 135, damage: 32, range: 140, speed: 44, rate: 1.2, color: '#9be3db', kind: 'air' },
    storm: { name: 'STORMTROOPERS', role: 'IMPERIAL SQUAD', cost: 3, icon: '☠️', hp: 96, damage: 21, range: 105, speed: 28, rate: 1.1, color: '#f08c85', kind: 'ranged' },
    vader: { name: 'VADER', role: 'SITH LORD', cost: 5, icon: '🟥', hp: 230, damage: 43, range: 43, speed: 25, rate: .85, color: '#fb666c', kind: 'hero' },
    atst: { name: 'AT-ST', role: 'WALKER', cost: 5, icon: '🦿', hp: 250, damage: 33, range: 110, speed: 20, rate: 1.25, color: '#db8980', kind: 'tank' },
    tie: { name: 'TIE FIGHTER', role: 'FIGHTER WING', cost: 3, icon: '✦', hp: 90, damage: 24, range: 125, speed: 42, rate: .95, color: '#e98981', kind: 'air' }
  };
  const deck = ['luke', 'han', 'chewie', 'artoo', 'xwing'];
  let hand = deck.slice(0, 4), deckIndex = 4, selected = null;
  let units = [], towers = [], effects = [], particles = [];
  let energy = 5, elapsed = 0, matchTime = 180, last = 0, aiTimer = 4.5;
  let deployCount = 0, paused = false, ended = false, overtime = false, soundOn = false;
  let toastTimer = 0, hintTimer = 8, playerCrowns = 0, enemyCrowns = 0, frame = 0, lastCardEnergy = -1;
  const $ = id => document.getElementById(id);
  const clamp = (n, a, b) => Math.max(a, Math.min(b, n));

  function resize() {
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(rect.width * dpr); canvas.height = Math.round(rect.height * dpr);
    ctx.setTransform(canvas.width / 900, 0, 0, canvas.height / 600, 0, 0);
  }
  window.addEventListener('resize', resize); resize();

  function makeTower(side, x, y, type, lane) {
    const command = type === 'command';
    return { side, x, y, type, lane, hp: command ? 980 : 590, maxHp: command ? 980 : 590, range: command ? 185 : 160, damage: command ? 34 : 24, cooldown: Math.random() * .4, alive: true };
  }
  function freshGame() {
    $('pauseOverlay').innerHTML = '<div><span>Ⅱ</span><b>PAUSED</b><small>Take a breath, Commander.</small><button id="resumeBtn">RESUME BATTLE</button></div>';
    $('resumeBtn').addEventListener('click', togglePause);
    units = []; effects = []; particles = []; energy = 5; elapsed = 0; matchTime = 180; last = 0; aiTimer = 3.6;
    deployCount = 0; paused = false; ended = false; overtime = false; selected = null; playerCrowns = 0; enemyCrowns = 0; hand = deck.slice(0, 4); deckIndex = 4;
    towers = [makeTower('enemy', .23, .16, 'guard', 0), makeTower('enemy', .77, .16, 'guard', 1), makeTower('enemy', .5, .095, 'command', 2), makeTower('player', .23, .84, 'guard', 0), makeTower('player', .77, .84, 'guard', 1), makeTower('player', .5, .905, 'command', 2)];
    $('combatFeed').innerHTML = '<div class="feed-item start"><i>✦</i><span>Squad deployed. Awaiting your orders, Commander.</span><time>NOW</time></div>';
    $('pauseOverlay').classList.remove('active'); $('pauseBtn').textContent = 'Ⅱ'; $('phaseLabel').textContent = 'BATTLE IN PROGRESS';
    $('arenaHint').style.opacity = '1'; hintTimer = 8; $('toast').classList.remove('show'); updateHud(); renderCards();
  }

  function addFeed(message, enemy = false) {
    const item = document.createElement('div'); item.className = `feed-item${enemy ? ' enemy' : ''}`;
    item.innerHTML = `<i>${enemy ? '◈' : '✦'}</i><span>${message}</span><time>NOW</time>`;
    $('combatFeed').prepend(item); while ($('combatFeed').children.length > 5) $('combatFeed').lastElementChild.remove();
  }
  function showToast(message) {
    const el = $('toast'); el.textContent = message; el.classList.add('show'); toastTimer = 1.7;
  }
  function renderCards() {
    cardRow.innerHTML = '';
    hand.forEach((id, i) => {
      const c = cards[id], card = document.createElement('button');
      card.className = `unit-card${selected === i ? ' selected' : ''}${energy < c.cost ? ' unaffordable' : ''}`;
      card.setAttribute('aria-label', `${c.name}, costs ${c.cost} energy. Select card.`);
      card.innerHTML = `<span class="card-art"><span class="unit-emoji">${c.icon}</span><span class="card-cost">${c.cost}</span></span><span class="card-name">${c.name}</span><span class="card-role">${c.role}</span>`;
      card.addEventListener('click', () => {
        if (ended || paused) return;
        selected = selected === i ? null : i;
        if (selected !== null && energy < c.cost) showToast('NOT ENOUGH FORCE ENERGY');
        else if (selected !== null) { showToast(`DEPLOY ${c.name.toUpperCase()} ON YOUR SIDE`); $('arenaHint').style.opacity = '1'; hintTimer = 4; }
        renderCards();
      });
      cardRow.appendChild(card);
    });
    const next = cards[deck[deckIndex % deck.length]];
    $('nextCard').textContent = next.icon; lastCardEnergy = Math.floor(energy);
  }

  function deploy(id, x, y, enemy = false) {
    const c = cards[id];
    if (!enemy && energy < c.cost) { showToast('NOT ENOUGH FORCE ENERGY'); return false; }
    if (!enemy) { energy -= c.cost; deployCount++; $('unitsDeployed').textContent = String(deployCount).padStart(2, '0'); }
    const count = id === 'storm' ? 3 : 1;
    for (let i = 0; i < count; i++) {
      const offset = count === 1 ? 0 : (i - 1) * .028;
      units.push({ id, side: enemy ? 'enemy' : 'player', x: clamp(x + offset, .07, .93), y: clamp(y + (enemy ? -offset : offset), .06, .94), hp: c.hp, maxHp: c.hp, damage: c.damage, range: c.range / 600, speed: c.speed / 600, rate: c.rate, cooldown: .15 + Math.random() * .35, target: null, kind: c.kind, color: c.color, icon: c.icon, lane: x < .5 ? 0 : 1, dead: false, bob: Math.random() * 6.28, hitFlash: 0 });
    }
    if (!enemy) {
      selected = null; const played = hand.shift(); hand.push(deck[deckIndex++ % deck.length]);
      renderCards(); addFeed(`${c.name} deployed to the field.`); $('arenaHint').style.opacity = '0';
    } else addFeed(`${c.name} spotted in the canyon!`, true);
    effects.push({ x, y, life: .65, max: .65, type: 'deploy', color: enemy ? '#fa7978' : '#72dcdf' });
    return true;
  }

  function eventPosition(e) {
    const rect = canvas.getBoundingClientRect();
    return { x: (e.clientX - rect.left) / rect.width, y: (e.clientY - rect.top) / rect.height };
  }
  canvas.addEventListener('pointerdown', e => {
    if (!selected || ended || paused) return;
    const p = eventPosition(e);
    if (p.y < .505) { showToast('DEPLOY ON YOUR SIDE OF THE RIVER'); return; }
    const id = hand[selected]; if (energy < cards[id].cost) { showToast('NOT ENOUGH FORCE ENERGY'); return; }
    deploy(id, p.x, p.y);
  });
  $('pauseBtn').addEventListener('click', togglePause); $('resumeBtn').addEventListener('click', togglePause);
  function togglePause() { if (ended) return; paused = !paused; $('pauseOverlay').classList.toggle('active', paused); $('pauseBtn').textContent = paused ? '▶' : 'Ⅱ'; if (paused) selected = null; renderCards(); }
  $('concedeBtn').addEventListener('click', () => { if (!ended && confirm('Concede this battle?')) finish('enemy'); });
  $('soundBtn').addEventListener('click', e => { soundOn = !soundOn; e.currentTarget.style.color = soundOn ? '#e7ad56' : ''; showToast(soundOn ? 'SOUND ENABLED' : 'SOUND MUTED'); });

  function update(dt) {
    if (ended || paused) return;
    elapsed += dt; matchTime -= dt; energy = Math.min(10, energy + dt * (overtime ? .72 : .36));
    if (!overtime && matchTime <= 60) { overtime = true; $('phaseLabel').textContent = '⚡ DOUBLE ENERGY'; addFeed('DOUBLE ENERGY — final minute!', false); showToast('DOUBLE ENERGY'); }
    if (matchTime <= 0) {
      matchTime = 0; if (playerCrowns > enemyCrowns) finish('player'); else if (enemyCrowns > playerCrowns) finish('enemy'); else finish('draw'); return;
    }
    aiTimer -= dt;
    if (aiTimer <= 0) {
      const choices = ['storm', 'vader', 'atst', 'tie']; const id = choices[Math.floor(Math.random() * choices.length)];
      const x = Math.random() < .5 ? .23 + (Math.random() - .5) * .16 : .77 + (Math.random() - .5) * .16;
      deploy(id, x, .22 + Math.random() * .14, true); aiTimer = 4.5 + Math.random() * 4;
    }
    towers.forEach(t => {
      if (!t.alive) return;
      t.cooldown -= dt;
      if (t.cooldown <= 0) {
        const targets = units.filter(u => u.side !== t.side && !u.dead && dist(t.x, t.y, u.x, u.y) < t.range / 600);
        if (targets.length) { targets.sort((a, b) => dist(t.x, t.y, a.x, a.y) - dist(t.x, t.y, b.x, b.y)); attack(t, targets[0], t.damage); t.cooldown = 1.05; }
      }
    });
    units.forEach(u => {
      if (u.dead) return;
      u.cooldown -= dt; u.hitFlash = Math.max(0, u.hitFlash - dt * 3);
      let targets = units.filter(v => v.side !== u.side && !v.dead && dist(u.x, u.y, v.x, v.y) < u.range + .035);
      let target = null;
      if (targets.length) { targets.sort((a, b) => dist(u.x, u.y, a.x, a.y) - dist(u.x, u.y, b.x, b.y)); target = targets[0]; }
      if (!target) {
        const aliveTowers = towers.filter(t => t.side !== u.side && t.alive);
        if (aliveTowers.length) {
          const laneTower = aliveTowers.filter(t => t.type === 'guard' && t.lane === u.lane);
          const preferred = laneTower.length ? laneTower : aliveTowers.filter(t => t.type === 'command');
          const group = preferred.length ? preferred : aliveTowers;
          target = group.sort((a, b) => dist(u.x, u.y, a.x, a.y) - dist(u.x, u.y, b.x, b.y))[0];
        }
      }
      if (!target) return;
      const d = dist(u.x, u.y, target.x, target.y);
      const attackRange = target.type ? u.range + .045 : u.range + .035;
      if (d <= attackRange) {
        if (u.cooldown <= 0) { attack(u, target, u.damage); u.cooldown = u.rate; }
      } else {
        const dx = (target.x - u.x) / (d || 1), dy = (target.y - u.y) / (d || 1);
        let nx = u.x + dx * u.speed * dt, ny = u.y + dy * u.speed * dt;
        const riverTop = .465, riverBottom = .535;
        if (u.kind !== 'air' && ny > riverTop && ny < riverBottom) {
          const bridgeX = u.lane === 0 ? .30 : .70;
          if (Math.abs(nx - bridgeX) > .085) nx += Math.sign(bridgeX - nx) * u.speed * dt * 1.7;
        }
        u.x = clamp(nx, .06, .94); u.y = clamp(ny, .055, .945);
      }
    });
    units = units.filter(u => !u.dead);
    effects.forEach(v => v.life -= dt); effects = effects.filter(v => v.life > 0);
    particles.forEach(p => { p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt; }); particles = particles.filter(p => p.life > 0);
    if (toastTimer > 0 && (toastTimer -= dt) <= 0) $('toast').classList.remove('show');
    if (hintTimer > 0 && (hintTimer -= dt) <= 0) $('arenaHint').style.opacity = '0';
    updateHud();
  }

  function dist(x, y, a, b) { const dx = (x - a) * 1.5, dy = y - b; return Math.hypot(dx, dy); }
  function attack(source, target, damage) {
    if (target.dead || target.alive === false) return;
    target.hp -= damage; if (target.hitFlash !== undefined) target.hitFlash = 1;
    effects.push({ x: (source.x + target.x) / 2, y: (source.y + target.y) / 2, life: .18, max: .18, type: 'shot', color: source.side === 'enemy' ? '#ff8b87' : '#9af4ed', x1: source.x, y1: source.y, x2: target.x, y2: target.y });
    if (target.hp <= 0) {
      if (target.type) {
        target.hp = 0; target.alive = false;
        const crown = target.type === 'command' ? 3 : 1;
        if (target.side === 'enemy') { playerCrowns += crown; addFeed(`${target.type === 'command' ? 'ENEMY COMMAND POST' : 'IMPERIAL TOWER'} DESTROYED!`); }
        else { enemyCrowns += crown; addFeed(`${target.type === 'command' ? 'YOUR COMMAND POST' : 'REBEL TOWER'} DESTROYED!`, true); }
        const count = target.side === 'enemy' ? playerCrowns : enemyCrowns;
        $(target.side === 'enemy' ? 'playerCrowns' : 'enemyCrowns').textContent = count;
        burst(target.x, target.y, target.side === 'enemy' ? '#ffb65c' : '#ff706c', 34);
        if (target.type === 'command') { finish(target.side === 'enemy' ? 'player' : 'enemy'); return; }
      } else {
        target.dead = true; burst(target.x, target.y, target.side === 'enemy' ? '#f17e78' : '#7bdae0', 8);
      }
    }
  }
  function burst(x, y, color, count) { for (let i = 0; i < count; i++) { const a = Math.random() * Math.PI * 2, s = .025 + Math.random() * .12; particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: .35 + Math.random() * .6, max: .95, color, r: 1 + Math.random() * 3 }); } }

  function updateHud() {
    const mins = Math.floor(matchTime / 60), secs = Math.floor(matchTime % 60);
    $('timer').textContent = `${mins}:${String(secs).padStart(2, '0')}`;
    $('timer').style.color = matchTime < 30 ? '#f07872' : '';
    $('elapsed').textContent = `${String(Math.floor(elapsed / 60)).padStart(2, '0')}:${String(Math.floor(elapsed % 60)).padStart(2, '0')}`;
    $('energyValue').textContent = Math.floor(energy); $('energyFill').style.width = `${energy * 10}%`;
    const diff = playerCrowns - enemyCrowns;
    $('controlFill').style.width = `${clamp(50 + diff * 19, 8, 92)}%`;
    $('controlText').textContent = diff > 0 ? 'REBEL ADVANTAGE' : diff < 0 ? 'IMPERIAL ADVANTAGE' : 'EVENLY MATCHED';
    if (lastCardEnergy !== Math.floor(energy)) renderCards();
  }
  function finish(winner) {
    if (ended) return; ended = true; paused = true; selected = null; renderCards();
    const won = winner === 'player', draw = winner === 'draw';
    $('phaseLabel').textContent = draw ? 'BATTLE DRAW' : won ? 'VICTORY' : 'DEFEAT';
    const box = $('pauseOverlay'); box.classList.add('active');
    box.innerHTML = `<div class="result-card"><span class="result-emblem">${draw ? '◈' : won ? '✦' : '◈'}</span><b>${draw ? 'DRAW' : won ? 'VICTORY' : 'DEFEAT'}</b><small>${draw ? 'The canyon remains contested.' : won ? 'The Outer Rim is safe... for now.' : 'The Empire has claimed this sector.'}</small><div class="result-score"><span>ROGUE SQUAD <b>${playerCrowns}</b></span><i>—</i><span><b>${enemyCrowns}</b> IMPERIAL ACE</span></div><button id="restartBtn">DEPLOY AGAIN</button></div>`;
    $('restartBtn').addEventListener('click', freshGame);
    addFeed(draw ? 'The battle ended in a draw.' : won ? 'VICTORY! The sector is yours.' : 'The Empire has won the battle.', !won);
  }

  function roundRect(x, y, w, h, r) {
    ctx.beginPath(); ctx.roundRect(x, y, w, h, r);
  }
  function drawBackground() {
    const g = ctx.createLinearGradient(0, 0, 900, 600); g.addColorStop(0, '#927451'); g.addColorStop(.42, '#776348'); g.addColorStop(.5, '#465753'); g.addColorStop(.58, '#80694b'); g.addColorStop(1, '#a07b50');
    ctx.fillStyle = g; ctx.fillRect(0, 0, 900, 600);
    // Geonosis mesas and windswept ridges
    for (let i = 0; i < 10; i++) {
      const x = (i * 113 + 31) % 950 - 20, y = i % 2 ? 40 + (i * 47) % 185 : 390 + (i * 37) % 195;
      ctx.fillStyle = i % 2 ? '#c29c68' : '#564c3c'; ctx.globalAlpha = .12;
      ctx.beginPath(); ctx.ellipse(x, y, 34 + i % 4 * 13, 9 + i % 3 * 4, -.16, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#e2bd82'; ctx.lineWidth = 2; ctx.globalAlpha = .09; ctx.beginPath(); ctx.ellipse(x - 3, y - 2, 25 + i % 4 * 11, 5 + i % 3 * 3, -.16, 0, Math.PI * 2); ctx.stroke();
    }
    ctx.globalAlpha = 1;
    // Arena perimeter and lane markings
    ctx.strokeStyle = '#dbc39127'; ctx.lineWidth = 2; ctx.setLineDash([6, 9]); ctx.strokeRect(28, 22, 844, 556); ctx.setLineDash([]);
    ctx.fillStyle = '#ddc49312'; ctx.fillRect(0, 294, 900, 12);
    // River bed and water
    ctx.fillStyle = '#344747'; ctx.fillRect(0, 279, 900, 42);
    const river = ctx.createLinearGradient(0, 279, 0, 321); river.addColorStop(0, '#526b65'); river.addColorStop(.5, '#344c4d'); river.addColorStop(1, '#273c3e'); ctx.fillStyle = river; ctx.fillRect(0, 283, 900, 34);
    ctx.strokeStyle = '#9bb5a366'; ctx.lineWidth = 1;
    for (let i = 0; i < 14; i++) { const x = (i * 79 + frame * .25) % 930 - 15; ctx.beginPath(); ctx.moveTo(x, 289 + (i % 3) * 11); ctx.lineTo(x + 24, 289 + (i % 3) * 11); ctx.stroke(); }
    // Bridges
    [.30, .70].forEach((bx, i) => {
      ctx.fillStyle = '#443b32'; ctx.fillRect(bx * 900 - 45, 271, 90, 58);
      ctx.fillStyle = '#aa8352'; ctx.fillRect(bx * 900 - 38, 274, 76, 52);
      ctx.fillStyle = '#70583d'; for (let j = 0; j < 5; j++) ctx.fillRect(bx * 900 - 35 + j * 17, 276, 3, 48);
      ctx.strokeStyle = '#d5b47a'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(bx * 900 - 42, 274); ctx.lineTo(bx * 900 + 42, 274); ctx.moveTo(bx * 900 - 42, 326); ctx.lineTo(bx * 900 + 42, 326); ctx.stroke();
    });
    // Deployment zones
    ctx.fillStyle = '#4cc8c414'; ctx.fillRect(0, 326, 900, 274); ctx.fillStyle = '#ef696012'; ctx.fillRect(0, 0, 900, 270);
    ctx.fillStyle = '#e5eee833'; ctx.font = '700 10px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('IMPERIAL TERRITORY', 450, 31); ctx.fillText('REBEL DEPLOYMENT ZONE', 450, 575);
  }

  function drawTower(t) {
    const x = t.x * 900, y = t.y * 600, enemy = t.side === 'enemy', color = enemy ? '#d76563' : '#50bcc0';
    ctx.save(); ctx.translate(x, y);
    if (!t.alive) {
      ctx.fillStyle = '#302e2a'; ctx.beginPath(); ctx.ellipse(0, 5, 25, 12, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#4a4236'; ctx.fillRect(-18, -3, 36, 7); ctx.fillRect(-11, -9, 20, 7);
      for (let i = 0; i < 2; i++) { ctx.fillStyle = `rgba(185,180,160,${.12 + Math.sin(frame * .08 + i) * .05})`; ctx.beginPath(); ctx.arc(-4 + i * 10, -13 - (frame * .5 % 12), 5 + i * 2, 0, Math.PI * 2); ctx.fill(); }
      ctx.restore(); return;
    }
    ctx.fillStyle = '#10161966'; ctx.beginPath(); ctx.ellipse(1, 13, t.type === 'command' ? 30 : 23, 12, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#4c4a40'; ctx.strokeStyle = '#d6c69d'; ctx.lineWidth = 2;
    if (t.type === 'command') { roundRect(-24, -23, 48, 42, 7); ctx.fill(); ctx.stroke(); ctx.fillStyle = '#77715f'; roundRect(-14, -32, 28, 18, 5); ctx.fill(); ctx.stroke(); }
    else { roundRect(-20, -17, 40, 34, 7); ctx.fill(); ctx.stroke(); ctx.fillStyle = '#77715f'; roundRect(-12, -24, 24, 16, 4); ctx.fill(); ctx.stroke(); }
    ctx.fillStyle = enemy ? '#271e20' : '#203638'; roundRect(-7, -19, 14, 14, 4); ctx.fill();
    ctx.fillStyle = color; ctx.shadowColor = color; ctx.shadowBlur = 12; ctx.beginPath(); ctx.arc(0, -11, t.type === 'command' ? 5 : 4, 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0;
    ctx.fillStyle = '#c9c4aa'; ctx.fillRect(-2, -3, 4, 15);
    // health bar
    ctx.fillStyle = '#171d1d'; roundRect(-24, -41, 48, 5, 2); ctx.fill(); ctx.fillStyle = t.hp / t.maxHp < .32 ? '#e87462' : color; roundRect(-23, -40, 46 * Math.max(0, t.hp / t.maxHp), 3, 2); ctx.fill();
    ctx.fillStyle = '#f0d7a2'; ctx.font = '700 8px sans-serif'; ctx.textAlign = 'center'; ctx.fillText(t.type === 'command' ? 'COMMAND' : 'GUARD', 0, 31);
    ctx.restore();
  }

  function drawUnit(u) {
    const x = u.x * 900, y = u.y * 600 + Math.sin(frame * .08 + u.bob) * 1.3, enemy = u.side === 'enemy';
    ctx.save(); ctx.translate(x, y);
    ctx.globalAlpha = .32; ctx.fillStyle = '#111'; ctx.beginPath(); ctx.ellipse(0, 8, u.kind === 'tank' ? 15 : 11, 5, 0, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1;
    if (u.kind === 'air') { ctx.fillStyle = '#c5d3d1'; ctx.beginPath(); ctx.moveTo(0, -9); ctx.lineTo(13, 3); ctx.lineTo(2, 1); ctx.lineTo(0, 8); ctx.lineTo(-2, 1); ctx.lineTo(-13, 3); ctx.closePath(); ctx.fill(); ctx.strokeStyle = enemy ? '#f08c85' : '#8be8df'; ctx.lineWidth = 1.5; ctx.stroke(); }
    else {
      const fill = u.hitFlash > 0 ? '#fff' : enemy ? '#bcb7aa' : '#c6bda8';
      ctx.fillStyle = enemy ? '#392d30' : '#253c3d'; ctx.strokeStyle = u.color; ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.ellipse(0, 2, u.kind === 'tank' ? 11 : 9, u.kind === 'tank' ? 12 : 10, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = fill; ctx.beginPath(); ctx.arc(0, -7, u.kind === 'hero' ? 7 : 6, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      if (u.id === 'vader') { ctx.fillStyle = '#1b1b1c'; ctx.beginPath(); ctx.arc(0, -7, 5, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#fb4449'; ctx.fillRect(-4, -11, 8, 2); }
      if (u.id === 'luke') { ctx.strokeStyle = '#8aff97'; ctx.shadowColor = '#8aff97'; ctx.shadowBlur = 8; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(8, -8); ctx.lineTo(14, -17); ctx.stroke(); ctx.shadowBlur = 0; }
      else if (u.id === 'chewie') { ctx.fillStyle = '#715039'; ctx.fillRect(-10, -7, 3, 13); ctx.fillRect(7, -7, 3, 13); }
      else { ctx.fillStyle = enemy ? '#2b2427' : '#203b3e'; ctx.fillRect(-8, -1, 16, 5); }
    }
    // health strip
    ctx.fillStyle = '#111'; roundRect(-11, -22, 22, 3, 1); ctx.fill(); ctx.fillStyle = enemy ? '#ed7975' : '#69d6ce'; roundRect(-10, -21.5, 20 * Math.max(0, u.hp / u.maxHp), 2, 1); ctx.fill();
    ctx.restore();
  }

  function drawEffects() {
    effects.forEach(v => {
      const alpha = clamp(v.life / v.max, 0, 1);
      if (v.type === 'shot') { ctx.globalAlpha = alpha; ctx.strokeStyle = v.color; ctx.shadowColor = v.color; ctx.shadowBlur = 8; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(v.x1 * 900, v.y1 * 600); ctx.lineTo(v.x2 * 900, v.y2 * 600); ctx.stroke(); ctx.shadowBlur = 0; ctx.globalAlpha = 1; }
      else { ctx.globalAlpha = alpha; ctx.strokeStyle = v.color; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(v.x * 900, v.y * 600, (1 - alpha) * 32 + 3, 0, Math.PI * 2); ctx.stroke(); ctx.globalAlpha = 1; }
    });
    particles.forEach(p => { ctx.globalAlpha = clamp(p.life / p.max, 0, 1); ctx.fillStyle = p.color; ctx.beginPath(); ctx.arc(p.x * 900, p.y * 600, p.r, 0, Math.PI * 2); ctx.fill(); }); ctx.globalAlpha = 1;
  }

  function render() {
    frame++; ctx.clearRect(0, 0, 900, 600); drawBackground();
    towers.filter(t => t.side === 'enemy').forEach(drawTower); towers.filter(t => t.side === 'player').forEach(drawTower);
    units.slice().sort((a, b) => a.y - b.y).forEach(drawUnit); drawEffects();
    // Clickable side reticle for selected deployment
    if (selected !== null && !paused && !ended) {
      const c = canvas.getBoundingClientRect(); const p = pointer;
      if (p) { ctx.strokeStyle = '#d8efcfaa'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(p.x * 900, p.y * 600, 13, 0, Math.PI * 2); ctx.moveTo(p.x * 900 - 19, p.y * 600); ctx.lineTo(p.x * 900 - 8, p.y * 600); ctx.moveTo(p.x * 900 + 8, p.y * 600); ctx.lineTo(p.x * 900 + 19, p.y * 600); ctx.stroke(); }
    }
  }
  let pointer = null;
  canvas.addEventListener('pointermove', e => { const p = eventPosition(e); pointer = p; });
  function loop(now) { const dt = Math.min(.05, last ? (now - last) / 1000 : .016); last = now; update(dt); render(); requestAnimationFrame(loop); }
  freshGame(); requestAnimationFrame(loop);
})();
