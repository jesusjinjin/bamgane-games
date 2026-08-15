/* ─────────────────────────────────────────────────────────────
   밤가네 미니게임 — 소리
   음원 파일 없이 코드로 만든다. 파일 하나로 완결되어야 하기 때문.
   브라우저는 사용자가 누르기 전에는 소리를 못 내므로,
   첫 클릭 때 깨우고 그 뒤부터 울린다.
   ───────────────────────────────────────────────────────────── */
"use strict";

const Sound = (() => {
  let ac = null;
  let master = null;
  let muted = false;

  /* 소리를 두 갈래로 나눠 내보낸다.

       효과음 ─┐
                ├─ master ─→ 스피커
       배경음악 ─┘

     master 는 전체 크기와 더킹(때리는 순간 잠깐 눌러 주는 것)을 맡고,
     갈래마다 붙은 손잡이로 효과음과 배경음악을 따로 조절한다.
     한 덩어리로 두면 "배경음악만 줄이기" 를 할 수 없다. */
  let sfx = null;          // 효과음 갈래
  let bgmBus = null;       // 배경음악 갈래
  const 볼륨 = { sfx: 1, bgm: 1 };   // 0~1. 화면의 손잡이 값이 여기 들어온다

  function ctx() {
    if (!ac) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ac = new AC();
      master = ac.createGain();
      master.gain.value = 0.55;
      master.connect(ac.destination);

      sfx = ac.createGain();
      bgmBus = ac.createGain();
      // 소리가 처음 나기 전에 손잡이를 돌려 뒀을 수 있다. 그 값으로 시작한다.
      sfx.gain.value = 볼륨.sfx;
      bgmBus.gain.value = 볼륨.bgm;
      sfx.connect(master);
      bgmBus.connect(master);
    }
    if (ac.state === "suspended") ac.resume();
    return ac;
  }

  /* 갈래 하나의 크기를 바꾼다. 이름은 "sfx" 또는 "bgm".
     끊어지듯 바뀌면 딱 소리가 나므로 짧게 미끄러뜨린다. */
  function setVolume(갈래, v) {
    const x = Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : 0;
    if (갈래 !== "sfx" && 갈래 !== "bgm") return;
    볼륨[갈래] = x;
    const g = 갈래 === "sfx" ? sfx : bgmBus;
    if (g && ac) g.gain.setTargetAtTime(x, ac.currentTime, 0.02);
  }

  function getVolume(갈래) { return 볼륨[갈래] == null ? 1 : 볼륨[갈래]; }

  // 지직거리는 잡음의 재료. 한 번 만들어 두고 돌려 쓴다.
  let noiseBuf = null;
  function noise() {
    const c = ctx();
    if (!c) return null;
    if (!noiseBuf) {
      const n = Math.floor(c.sampleRate * 1.2);
      noiseBuf = c.createBuffer(1, n, c.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    }
    const src = c.createBufferSource();
    src.buffer = noiseBuf;
    src.loop = true;
    return src;
  }

  /* ── 용접: 계속 이어지는 지직 소리 ──────────────────────
     끌고 가는 동안 켜두고, 통로 가장자리에 가까울수록 거칠어진다. */
  function weldRig() {
    const c = ctx();
    if (!c) return null;

    const src = noise();
    // 잡음에서 중고음만 남겨 "치익" 하는 결을 만든다
    const bp = c.createBiquadFilter();
    bp.type = "bandpass"; bp.frequency.value = 1400; bp.Q.value = 0.8;
    // 낮은 웅웅거림을 더해 무게를 준다
    const lp = c.createBiquadFilter();
    lp.type = "lowpass"; lp.frequency.value = 260;

    const gTop = c.createGain(); gTop.gain.value = 0.0;
    const gLow = c.createGain(); gLow.gain.value = 0.0;
    const out   = c.createGain(); out.gain.value = 1;

    src.connect(bp); bp.connect(gTop); gTop.connect(out);
    src.connect(lp); lp.connect(gLow); gLow.connect(out);
    out.connect(sfx);
    src.start();

    return { src, bp, gTop, gLow, out };
  }

  let weld = null;

  function weldStart() {
    if (muted || weld) return;
    weld = weldRig();
  }

  /* edge: 0(가운데) ~ 1(가장자리). 소리의 세기와 거칠기를 함께 올린다. */
  function weldSet(edge) {
    if (!weld || !ac) return;
    const t = ac.currentTime;
    const e = Number.isFinite(edge) ? Math.max(0, Math.min(1, edge)) : 0;
    weld.gTop.gain.setTargetAtTime(0.030 + e * 0.085, t, 0.05);
    weld.gLow.gain.setTargetAtTime(0.020 + e * 0.055, t, 0.05);
    weld.bp.frequency.setTargetAtTime(1100 + e * 1700, t, 0.08);
    weld.bp.Q.setTargetAtTime(0.7 + e * 2.2, t, 0.08);
  }

  function weldStop() {
    if (!weld || !ac) return;
    const t = ac.currentTime;
    weld.out.gain.setTargetAtTime(0, t, 0.04);
    const w = weld;
    weld = null;
    setTimeout(() => { try { w.src.stop(); } catch (_) {} }, 400);
  }

  /* ── 한 번씩 튀는 소리 ─────────────────────────────────── */
  function crackle(power) {
    const c = ctx();
    if (!c || muted) return;
    const src = noise();
    const bp = c.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = 1800 + Math.random() * 2600;
    bp.Q.value = 3;
    const g = c.createGain();
    const t = c.currentTime;
    const vol = 0.05 * (power || 1);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.06 + Math.random() * 0.05);
    src.connect(bp); bp.connect(g); g.connect(sfx);
    src.start(t); src.stop(t + 0.16);
  }

  /* ── 결과음 ────────────────────────────────────────────── */
  function tone(freq, dur, type, vol, at) {
    const c = ctx();
    if (!c || muted) return;
    const o = c.createOscillator();
    const g = c.createGain();
    const t = (at || c.currentTime);
    o.type = type || "sine";
    o.frequency.setValueAtTime(freq, t);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(sfx);
    o.start(t); o.stop(t + dur + 0.02);
  }

  /* 음이 미끄러지듯 옮겨 가는 소리 */
  function glide(f1, f2, dur, type, vol, at) {
    const c = ctx();
    if (!c || muted) return;
    const o = c.createOscillator();
    const g = c.createGain();
    const t = (at || c.currentTime);
    o.type = type || "sawtooth";
    o.frequency.setValueAtTime(f1, t);
    o.frequency.exponentialRampToValueAtTime(f2, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(sfx);
    o.start(t); o.stop(t + dur + 0.02);
  }

  /* 딸깍 — 한 걸음 나아갔다는 짧은 신호 */
  function tick(pitch) {
    tone(760 * (pitch || 1), 0.05, "square", 0.045);
  }

  /* 성공: 미(E)–솔#–시 로 올라가고, 위에 종소리 배음과 반짝임을 얹는다.
     세 음만으로는 방송에서 너무 심심해서 잔향을 붙였다. */
  function success() {
    const c = ctx(); if (!c || muted) return;
    const t = c.currentTime;
    duck(0.6, 0.1);
    if (play("success")) return;
    tone(659.3, 0.18, "triangle", 0.16, t);
    tone(830.6, 0.18, "triangle", 0.16, t + 0.085);
    tone(987.8, 0.46, "triangle", 0.15, t + 0.17);
    tone(1318.5, 0.52, "sine", 0.070, t + 0.17);
    tone(1975.5, 0.44, "sine", 0.038, t + 0.20);
    for (let i = 0; i < 6; i++) {
      tone(1500 + Math.random() * 1500, 0.16, "sine", 0.026, t + 0.30 + i * 0.055);
    }
  }

  /* 실패: 음이 아래로 미끄러지며 꺼진다 */
  function fail() {
    const c = ctx(); if (!c || muted) return;
    const t = c.currentTime;
    duck(0.55, 0.12);
    if (play("fail")) return;
    glide(280, 88, 0.55, "sawtooth", 0.11, t);
    tone(146.8, 0.40, "sawtooth", 0.10, t + 0.10);
    tone(98, 0.60, "sine", 0.085, t + 0.12);
    for (let i = 0; i < 8; i++) setTimeout(() => crackle(2.2), i * 26);
  }

  /* ── 타격음 ────────────────────────────────────────────────
     여기부터는 "결과" 가 아니라 "행동하는 순간" 에 쓰는 소리다.
     칼이 지나가고, 돌이 얹히고, 떡이 갈리는 그 순간에 소리가 없으면
     아무리 판정음을 화려하게 해도 손맛이 나지 않는다. */

  /* 둔탁하게 쿵. 돌이 얹히거나 뭔가 내려앉을 때.
     power 0~1. 세게 칠수록 낮고 길게 울린다. */
  function thud(power) {
    const c = ctx(); if (!c || muted) return;
    const p = Number.isFinite(power) ? Math.max(0, Math.min(1, power)) : 0.6;
    const t = c.currentTime;

    // 때리는 순간 나머지를 잠깐 눌러 이 소리만 튀어나오게 한다
    duck(0.5 - p * 0.15, 0.07 + p * 0.05);

    // 녹음 파일이 등록돼 있으면 그걸 쓴다. 세기에 따라 음높이를 살짝 낮춘다.
    if (play("thud", { vol: 0.5 + p * 0.5, rate: 1.12 - p * 0.22 })) return;

    // 몸통 — 낮은 음이 급히 떨어지며 "쿵"
    // 음높이를 매번 조금씩 흩어 놓는다. 똑같은 소리가 반복되면 기계처럼 들린다.
    const 흩음 = 1 + (Math.random() * 0.14 - 0.07);
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = "sine";
    o.frequency.setValueAtTime((150 - p * 40) * 흩음, t);
    o.frequency.exponentialRampToValueAtTime(42 * 흩음, t + 0.10 + p * 0.06);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.16 + p * 0.16, t + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.17 + p * 0.12);
    o.connect(g); g.connect(sfx);
    o.start(t); o.stop(t + 0.34);

    // 표면 — 돌끼리 부딪히는 거친 결
    const n = noise();
    const bp = c.createBiquadFilter();
    bp.type = "bandpass"; bp.frequency.value = 900 + p * 700; bp.Q.value = 1.1;
    const ng = c.createGain();
    ng.gain.setValueAtTime(0.10 + p * 0.12, t);
    ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.06 + p * 0.05);
    n.connect(bp); bp.connect(ng); ng.connect(sfx);
    n.start(t); n.stop(t + 0.2);
  }

  /* 무언가 빠르게 지나가는 바람. power 0~1 로 속도를 넘긴다.
     칼이 왕복하는 동안 속도에 맞춰 울려 주면 움직임이 손에 잡힌다. */
  function swoosh(power) {
    const c = ctx(); if (!c || muted) return;
    const p = Number.isFinite(power) ? Math.max(0, Math.min(1, power)) : 0.5;
    if (play("swoosh", { vol: 0.35 + p * 0.55, rate: 0.9 + p * 0.35 })) return;
    const t = c.currentTime;
    const n = noise();
    const bp = c.createBiquadFilter();
    bp.type = "bandpass"; bp.Q.value = 1.6;
    // 다가왔다 멀어지는 느낌을 주려고 음색이 올랐다 내린다
    bp.frequency.setValueAtTime(500 + p * 700, t);
    bp.frequency.linearRampToValueAtTime(1400 + p * 2400, t + 0.06);
    bp.frequency.linearRampToValueAtTime(600 + p * 500, t + 0.15);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.020 + p * 0.055, t + 0.05);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.17);
    n.connect(bp); bp.connect(g); g.connect(sfx);
    n.start(t); n.stop(t + 0.24);
  }

  /* 날붙이가 무언가를 가르는 순간. 짧고 날카롭게 "샥". */
  function slice() {
    const c = ctx(); if (!c || muted) return;
    const t = c.currentTime;
    if (play("slice", { rate: 0.96 + Math.random() * 0.08 })) return;

    // 쇳소리 — 높은 잡음이 순식간에 사라진다
    const n = noise();
    const hp = c.createBiquadFilter();
    hp.type = "highpass"; hp.frequency.setValueAtTime(2600, t);
    hp.frequency.exponentialRampToValueAtTime(7000, t + 0.09);
    const g = c.createGain();
    g.gain.setValueAtTime(0.20, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.11);
    n.connect(hp); hp.connect(g); g.connect(sfx);
    n.start(t); n.stop(t + 0.16);

    // 떡이 갈라지며 나는 낮고 짧은 소리
    glide(420, 160, 0.12, "triangle", 0.085, t);
  }

  /* 미끄러지는 지속음. 조약돌이 얼음 위를 갈 때 켜 두고 속도를 넘긴다. */
  let slid = null;

  function slideStart() {
    const c = ctx(); if (!c || muted || slid) return;
    if (loop("slide", { vol: 0, fade: 0.05 })) return;
    const src = noise();
    const bp = c.createBiquadFilter();
    bp.type = "bandpass"; bp.frequency.value = 900; bp.Q.value = 0.9;
    const g = c.createGain(); g.gain.value = 0;
    src.connect(bp); bp.connect(g); g.connect(sfx);
    src.start();
    slid = { src, bp, g };
  }

  /* v: 0(멈춤) ~ 1(가장 빠름).
     이 함수는 애니메이션 루프 안에서 매 프레임 불린다.
     NaN 이 한 번이라도 들어오면 오디오가 예외를 던지고 그 자리에서 게임이 멈춘다.
     계산이 어긋나도 게임은 굴러가야 하므로 값을 여기서 확인한다. */
  function slideSet(v) {
    if (loopSet("slide", Number.isFinite(v) ? Math.max(0, Math.min(1, v)) * 0.7 : 0)) return;
    if (!slid || !ac) return;
    const t = ac.currentTime;
    const e = Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : 0;
    slid.g.gain.setTargetAtTime(e * 0.075, t, 0.04);
    slid.bp.frequency.setTargetAtTime(500 + e * 1900, t, 0.06);
  }

  function slideStop() {
    loopStop("slide");
    if (!slid || !ac) return;
    const t = ac.currentTime;
    slid.g.gain.setTargetAtTime(0, t, 0.05);
    const s = slid; slid = null;
    setTimeout(() => { try { s.src.stop(); } catch (_) {} }, 400);
  }

  /* ── 배경음 ────────────────────────────────────────────────
     방송에 얹는 화면이라 가락을 깔면 진행자 목소리와 싸운다.
     그래서 선율이 아니라 그 자리의 공기만 아주 옅게 깐다.
     소리가 아예 없으면 효과음이 튀어나올 때 대비가 없어 오히려 밋밋하다. */
  let amb = null;

  // 예전에는 자리마다 다른 "공기 소리" 를 코드로 깔았다.
  // 이제는 아케이드풍 곡을 랜덤으로 튼다. kind 는 더 쓰지 않지만
  // 게임 쪽 호출을 고치지 않아도 되게 인자는 그대로 받아 둔다.
  function ambience(kind) {
    const c = ctx(); if (!c || muted || amb) return;
    bgm();
    return;

    const out = c.createGain();
    out.gain.value = 0;
    out.connect(sfx);

    const src = noise();
    const lp = c.createBiquadFilter();
    lp.type = "lowpass";
    const g = c.createGain();
    src.connect(lp); lp.connect(g); g.connect(out);
    src.start();

    // 자리마다 공기가 다르다
    const 결 = {
      kitchen: { cut: 320, vol: 0.055, 숨: 0.10, 주기: 7.0 },  // 부엌 — 낮게 웅웅
      wind:    { cut: 900, vol: 0.075, 숨: 0.55, 주기: 4.5 },  // 눈밭 — 바람이 오르내린다
      forest:  { cut: 640, vol: 0.060, 숨: 0.35, 주기: 6.0 },  // 산길 — 잎사귀 스치는 결
    }[kind] || { cut: 500, vol: 0.05, 숨: 0.3, 주기: 6 };

    lp.frequency.value = 결.cut;
    g.gain.value = 결.vol;

    // 숨쉬듯 세기가 오르내리게 한다. 고정된 잡음은 금방 귀에 거슬린다.
    const lfo = c.createOscillator();
    const lfoG = c.createGain();
    lfo.type = "sine";
    lfo.frequency.value = 1 / 결.주기;
    lfoG.gain.value = 결.vol * 결.숨;
    lfo.connect(lfoG); lfoG.connect(g.gain);
    lfo.start();

    // 갑자기 켜지면 놀라므로 3초에 걸쳐 스며들게 한다
    out.gain.setTargetAtTime(0.55, c.currentTime, 1.2);

    amb = { src, lfo, out };
  }

  function ambienceStop() {
    bgmStop();
    for (const k in 도는것) if (k.indexOf("bgm") === 0) loopStop(k, 0.4);
    if (!amb || !ac) return;
    amb.out.gain.setTargetAtTime(0, ac.currentTime, 0.4);
    const a = amb; amb = null;
    setTimeout(() => {
      try { a.src.stop(); } catch (_) {}
      try { a.lfo.stop(); } catch (_) {}
    }, 2000);
  }

  /* ── 한 방을 세게 들리게 하는 장치 ────────────────────────

     소리를 키우는 것만으로는 세게 안 들린다. 귀는 절대 크기가 아니라
     **앞뒤와의 차이**로 세기를 느낀다. 그래서 때리는 순간 나머지를 잠깐 눌러 준다.
     방송·영화에서 쓰는 그 방법이다.

     amount: 얼마나 누를지 (0.35면 35%까지 내려간다)
     hold  : 눌러 두는 시간(초). 이 뒤에 스르륵 돌아온다 */
  let 원래볼륨 = 0.55;
  let duckTimer = 0;

  function duck(amount, hold) {
    const c = ctx(); if (!c || muted) return;
    const t = c.currentTime;
    const a = Number.isFinite(amount) ? Math.max(0.1, Math.min(1, amount)) : 0.45;
    const h = Number.isFinite(hold) ? hold : 0.09;

    clearTimeout(duckTimer);
    master.gain.cancelScheduledValues(t);
    master.gain.setValueAtTime(master.gain.value, t);
    master.gain.linearRampToValueAtTime(원래볼륨 * a, t + 0.012);   // 확 내리고
    duckTimer = setTimeout(() => {                                  // 천천히 올린다
      if (!ac || muted) return;
      const t2 = ac.currentTime;
      master.gain.cancelScheduledValues(t2);
      master.gain.setValueAtTime(master.gain.value, t2);
      master.gain.linearRampToValueAtTime(원래볼륨, t2 + 0.22);
    }, h * 1000);
  }

  /* ── 조여드는 소리 ─────────────────────────────────────────

     게임이 막바지로 갈수록 낮게 깔리는 음이 조금씩 올라온다.
     탑이 높아질수록, 돌이 과녁에 다가갈수록, 칼이 빨라질수록.
     들리는 듯 마는 듯해야 한다. 뚜렷하면 배경음과 싸운다. */
  let tens = null;

  function tensionStart() {
    const c = ctx(); if (!c || muted || tens) return;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = "sawtooth";
    o.frequency.value = 55;
    const lp = c.createBiquadFilter();
    lp.type = "lowpass"; lp.frequency.value = 220; lp.Q.value = 3;
    g.gain.value = 0;
    o.connect(lp); lp.connect(g); g.connect(sfx);
    o.start();
    tens = { o, g, lp };
  }

  /* level: 0(아직 멀었다) ~ 1(코앞이다) */
  function tensionSet(level) {
    if (!tens || !ac) return;
    const t = ac.currentTime;
    const e = Number.isFinite(level) ? Math.max(0, Math.min(1, level)) : 0;
    // 세기와 음높이가 함께 오른다. 둘 다 올라야 "조여든다" 로 들린다.
    tens.g.gain.setTargetAtTime(e * e * 0.055, t, 0.15);
    tens.o.frequency.setTargetAtTime(55 + e * 30, t, 0.3);
    tens.lp.frequency.setTargetAtTime(220 + e * 260, t, 0.3);
  }

  function tensionStop() {
    if (!tens || !ac) return;
    const t = ac.currentTime;
    tens.g.gain.setTargetAtTime(0, t, 0.12);
    const x = tens; tens = null;
    setTimeout(() => { try { x.o.stop(); } catch (_) {} }, 900);
  }

  /* ── 녹음된 소리 ───────────────────────────────────────────

     여기까지는 전부 코드로 만든 소리다. 파일이 없어 가볍지만 얇다.
     실제 녹음을 쓰면 두께가 다르다.

     불러오기 전이나 실패했을 때를 대비해 **코드 소리를 그대로 남겨 둔다.**
     파일이 있으면 파일을, 없으면 코드 소리를 낸다. 소리가 아예 안 나는 일은 없다.

     모든 소리는 master 를 거치므로 음소거와 더킹이 그대로 먹는다. */
  const 버퍼 = {};          // 이름 → AudioBuffer
  const 도는것 = {};        // 이름 → 지금 반복 재생 중인 것

  /* 소리마다의 기본 크기. 여기 한 곳에서 전체 균형을 잡는다.
     파일은 모두 피크 -3dB 로 맞춰져 있지만, 사람이 느끼는 크기는
     피크가 아니라 **평균**이다. 평균이 파일마다 16dB 넘게 벌어져 있어
     그대로 쓰면 어떤 소리는 귀를 때리고 어떤 소리는 안 들린다.

     짧은 타격음은 평균이 낮아도 크게 들리므로 그대로 두고,
     여운이 긴 소리(실패음·배경음)만 눌러 준다.

       파일 평균     그대로 쓰면        여기서 곱한 뒤
       fail  -12.1    가장 큼           -20.1  성공음과 나란해짐
       bgm   -18~-25  제각각           -34 안팎으로 통일 */
  const 볼륨표 = {
    fail:    0.40,     // 여운이 길어 유독 크게 들린다. 성공음에 맞춰 낮춤
    success: 1.00,     // 이걸 기준으로 나머지를 맞춘다
    bgm:     0.22,     // 가락이 있는 곡이라 진행자 목소리를 덮지 않게 낮게
  };

  function 크기(이름, v) {
    const 기본 = 볼륨표[이름] == null ? 1 : 볼륨표[이름];
    return (v == null ? 1 : v) * 기본;
  }

  /* 이 소리가 어느 갈래로 나갈지. 배경음악만 따로 가고 나머지는 효과음이다. */
  function 버스(이름) { return 이름 === "bgm" ? bgmBus : sfx; }

  /* ── 배경음악 ──────────────────────────────────────────────
     게임에 들어갈 때마다 곡을 하나 뽑아 튼다.

     일곱 곡을 미리 다 받아 두면 2.5MB 다. 한 판에 한 곡만 들으므로
     **뽑은 그 곡만** 받는다. 시청자가 받아야 하는 양이 350KB 로 줄어든다. */
  const 배경음악수 = 7;

  function bgm(vol) {
    const c = ctx(); if (!c || muted || 도는것.bgm) return;
    // 손잡이를 0 으로 내려 뒀으면 받지도 않는다. 안 들을 곡을 350KB 받을 이유가 없다.
    // 나중에 손잡이를 올리면 그때 이 함수가 다시 불린다.
    if (볼륨.bgm <= 0) return;
    const n = 1 + Math.floor(Math.random() * 배경음악수);
    const 주소 = "assets/_sounds/bgm/배경음악_" + n + ".mp3";
    fetch(주소)
      .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(r.status)))
      .then((b) => c.decodeAudioData(b))
      .then((buf) => {
        버퍼.bgm = buf;
        // 받는 동안 음소거를 눌렀거나 화면을 떠났으면 틀지 않는다
        if (!muted && !도는것.bgm) loop("bgm", { vol: vol == null ? 1 : vol, fade: 1.2 });
      })
      .catch(() => {});
  }

  function bgmStop() { loopStop("bgm", 0.5); }

  function 불러오기(이름, 주소) {
    const c = ctx(); if (!c) return;
    fetch(주소)
      .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(r.status)))
      .then((b) => c.decodeAudioData(b))
      .then((buf) => { 버퍼[이름] = buf; })
      .catch(() => {});     // 실패해도 조용히 넘어간다. 코드 소리가 대신한다.
  }

  /* 쓸 파일을 등록한다. { 이름: 주소 } */
  function use(목록) {
    for (const 이름 in 목록) 불러오기(이름, 목록[이름]);
  }

  /* 한 번 재생. vol 은 0~1, rate 는 재생 속도(음높이).
     rate 를 조금씩 흩어 주면 같은 소리가 반복돼도 기계처럼 들리지 않는다. */
  function play(이름, opt) {
    const c = ctx(); if (!c || muted) return false;
    const buf = 버퍼[이름];
    if (!buf) return false;                 // 아직 안 왔으면 코드 소리에 맡긴다
    const o = opt || {};
    const src = c.createBufferSource();
    src.buffer = buf;
    src.playbackRate.value = o.rate || 1;
    const g = c.createGain();
    g.gain.value = 크기(이름, o.vol);
    src.connect(g); g.connect(버스(이름));
    src.start();
    return true;
  }

  /* 이어지는 소리를 켠다. 이미 돌고 있으면 아무것도 하지 않는다. */
  function loop(이름, opt) {
    const c = ctx(); if (!c || muted) return false;
    const buf = 버퍼[이름];
    if (!buf || 도는것[이름]) return false;
    const o = opt || {};
    const src = c.createBufferSource();
    src.buffer = buf; src.loop = true;
    const g = c.createGain();
    g.gain.value = 0;
    src.connect(g); g.connect(버스(이름));
    src.start();
    // 갑자기 켜지면 놀라므로 스며들게 한다
    g.gain.setTargetAtTime(크기(이름, o.vol == null ? 0.5 : o.vol), c.currentTime, o.fade || 0.25);
    도는것[이름] = { src, g };
    return true;
  }

  /* 도는 소리의 세기를 바꾼다 (미끄러짐처럼 속도에 맞춰야 하는 것) */
  function loopSet(이름, vol) {
    const it = 도는것[이름];
    if (!it || !ac) return false;
    const v = Number.isFinite(vol) ? Math.max(0, Math.min(1, vol)) : 0;
    it.g.gain.setTargetAtTime(크기(이름, v), ac.currentTime, 0.05);
    return true;
  }

  function loopStop(이름, fade) {
    const it = 도는것[이름];
    if (!it || !ac) return false;
    it.g.gain.setTargetAtTime(0, ac.currentTime, fade || 0.12);
    delete 도는것[이름];
    setTimeout(() => { try { it.src.stop(); } catch (_) {} }, 1200);
    return true;
  }

  function 모두멈춤() { for (const k in 도는것) loopStop(k, 0.05); }

  function setMuted(v) {
    muted = !!v;
    if (muted) { weldStop(); slideStop(); ambienceStop(); tensionStop(); 모두멈춤(); }
    clearTimeout(duckTimer);
    if (master) master.gain.value = muted ? 0 : 원래볼륨;
  }

  return { weldStart, weldSet, weldStop, crackle, tick, glide, success, fail,
           thud, swoosh, slice, slideStart, slideSet, slideStop,
           ambience, ambienceStop,
           duck, tensionStart, tensionSet, tensionStop,
           use, play, loop, loopSet, loopStop, bgm, bgmStop,
           setVolume, getVolume, isLooping: (이름) => !!도는것[이름],
           setMuted, isMuted: () => muted };
})();
