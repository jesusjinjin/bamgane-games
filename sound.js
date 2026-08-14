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

  function ctx() {
    if (!ac) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ac = new AC();
      master = ac.createGain();
      master.gain.value = 0.55;
      master.connect(ac.destination);
    }
    if (ac.state === "suspended") ac.resume();
    return ac;
  }

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
    out.connect(master);
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
    const e = Math.max(0, Math.min(1, edge));
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
    src.connect(bp); bp.connect(g); g.connect(master);
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
    o.connect(g); g.connect(master);
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
    o.connect(g); g.connect(master);
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
    glide(280, 88, 0.55, "sawtooth", 0.11, t);
    tone(146.8, 0.40, "sawtooth", 0.10, t + 0.10);
    tone(98, 0.60, "sine", 0.085, t + 0.12);
    for (let i = 0; i < 8; i++) setTimeout(() => crackle(2.2), i * 26);
  }

  function setMuted(v) {
    muted = !!v;
    if (muted) weldStop();
    if (master) master.gain.value = muted ? 0 : 0.55;
  }

  return { weldStart, weldSet, weldStop, crackle, tick, glide, success, fail,
           setMuted, isMuted: () => muted };
})();
