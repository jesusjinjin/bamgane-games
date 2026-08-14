/* ─────────────────────────────────────────────────────────────
   밤가네 미니게임 — 공통 기능
   ───────────────────────────────────────────────────────────── */
"use strict";

/* 난이도. 여기 숫자만 고치면 모든 게임에 반영된다.
   값은 사람의 오차 분포로 시뮬레이션해 성공률 5% 안팎으로 잡은 것이다.
   실제로 해보고 쉽거나 어려우면 이 숫자를 조정한다. */
const RULES = {
  ricecut:  { tolPct: 0.25, sweepMin: 2.2, sweepMax: 3.2 }, // 오차 %, 편도 시간(초)
  schulte:  { limitSec: 7.1, count: 12 },                   // 제한 시간, 숫자 개수
  wire:     { halfWidth: 3.9 },                             // 통로 반폭(px)
  // 목표 시각은 매판 8~10초 사이에서 0.1초 간격으로 뽑는다. 외워서 못 하게.
  stopwatch:{ minTarget: 8.0, maxTarget: 10.0, targetStep: 0.1, places: 2 },
  curling:  { targetR: 7 },                                 // 목표 반지름(px)
  stack:    { layers: 14, barW: 54 },                       // 층수, 막대 너비
  // 회차마다 제한이 짧아진다. 소수점 둘째 자리에서 딱 떨어지는 값만 쓴다.
  // 어중간한 값이면 화면 표시(반올림)와 실제 판정이 어긋난다.
  signal:   { limitsSec: [0.40, 0.34, 0.30, 0.27, 0.24] },
  // 다가오는 시간(lead)과 속도를 매판 따로 뽑는다. 둘 중 하나라도 고정이면
  // 화면을 안 보고 박자만 세도 맞출 수 있어 실력 게임이 아니게 된다.
  // 회차가 오를수록 허용 오차가 좁아지고 속도도 붙는다.
  circle:   { rounds: 5, startR: 86, minTargetR: 20,
              tolStart: 3.2, tolStep: 0.4,          // 3.2 → 1.6px
              leadMin: 0.45, leadMax: 0.85,
              speedMin: 55, speedMax: 95, speedStep: 4 },
  // 차오르는 속도를 매판 다르게 한다. 고정이면 박자만 세면 되기 때문.
  pressure: { rounds: 3, tolPct: 1.1, minTarget: 58, maxTarget: 86,
              fillMin: 1.4, fillMax: 2.6 },                 // 100%까지 걸리는 시간(초)
  // 3회 연속. 회차가 오를수록 밝기 차이가 줄어 찾기 어려워진다.
  // 값을 하나로 박지 않고 구간으로 둔 이유:
  //  - 고정이면 몇 판 해보고 "이 정도면 보이는구나" 를 외워 버린다
  //  - 그렇다고 아무 값이나 뽑으면 쉬운 판이 세 번 연달아 나와 너무 쉬워진다
  // 회차마다 제 구간 안에서만 뽑아 난이도 곡선은 지키고 매판 다르게 한다.
  oddone:   { cols: 10, rows: 6, limitSec: 3.5,
              bands: [[7.0, 9.0], [5.0, 6.8], [3.6, 4.8]] },
  cutline:  { tolPx: 3.0 },                                 // 직선에서 벗어나도 되는 최대 거리
  // 바늘은 멈출 때까지 계속 돈다. 여러 바퀴 보고 노릴 수 있으므로
  // 허용 각도를 그만큼 좁게 잡았다.
  lock:     { rounds: 3, tolDeg: 4.5, spinMin: 200, spinMax: 340 },
};

/* 무대를 창 크기에 맞춰 통째로 확대·축소한다.
   이래야 어떤 창 크기에서도 화면 구성이 똑같이 유지된다. */
function fitStage() {
  const stage = document.querySelector(".stage");
  if (!stage) return;
  const cs = getComputedStyle(document.documentElement);
  const w = parseFloat(cs.getPropertyValue("--stage-w"));
  const h = parseFloat(cs.getPropertyValue("--stage-h"));
  const k = Math.min(innerWidth / w, innerHeight / h);
  // transform 을 직접 쓰지 않고 변수로 넘긴다.
  // 흔들림 연출이 transform 을 덮어써도 배율이 풀리지 않는다.
  stage.style.setProperty("--fit", k);
}
addEventListener("resize", fitStage);
addEventListener("DOMContentLoaded", fitStage);

/* 스페이스바·엔터를 버튼 누름으로 연결한다.
   꾹 누르고 있는 건 무시하고, 화면이 스크롤되지 않게 막는다. */
function onPressKey(handler) {
  addEventListener("keydown", (e) => {
    if (e.code !== "Space" && e.code !== "Enter") return;
    if (e.repeat) return;
    e.preventDefault();
    handler(e);
  });
}

/* 눌린 "그 순간"의 시각을 돌려준다.
   화면에 그려진 값이 아니라 이걸로 판정해야 모니터 주사율에 따라
   유불리가 갈리지 않는다. */
function pressTime(ev) {
  return (ev && typeof ev.timeStamp === "number" && ev.timeStamp > 0)
    ? ev.timeStamp : performance.now();
}

/* 소리 끄기 버튼을 상단 바 오른쪽 끝에 붙인다.
   Sound 가 있는 게임에서만 나타난다. 설정은 다음에 켤 때도 유지된다. */
addEventListener("DOMContentLoaded", () => {
  const bar = document.querySelector(".topbar");
  if (!bar || typeof Sound === "undefined") return;

  const ON  = '<svg viewBox="0 0 24 24"><path d="M4 9v6h4l5 4V5L8 9H4z"/>'
            + '<path d="M16.5 8.5a5 5 0 0 1 0 7"/><path d="M19 6a8.5 8.5 0 0 1 0 12"/></svg>';
  const OFF = '<svg viewBox="0 0 24 24"><path d="M4 9v6h4l5 4V5L8 9H4z"/>'
            + '<path d="M17 9.5l4 5M21 9.5l-4 5"/></svg>';

  const btn = document.createElement("button");
  btn.className = "mute";
  bar.appendChild(btn);

  let off = false;
  try { off = localStorage.getItem("bg_mute") === "1"; } catch (_) {}

  const apply = () => {
    Sound.setMuted(off);
    btn.innerHTML = off ? OFF : ON;
    btn.classList.toggle("off", off);
    btn.title = off ? "소리 켜기" : "소리 끄기";
  };
  apply();

  btn.addEventListener("click", () => {
    off = !off;
    try { localStorage.setItem("bg_mute", off ? "1" : "0"); } catch (_) {}
    apply();
  });
});

/* 판정 순간의 화면 연출.
   성공은 초록 빛이 한 번 퍼지고, 실패는 화면이 짧게 흔들린다.
   verdictHtml 안에서 같이 불러 주므로 게임 쪽은 손댈 것이 없다. */
function stageEffect(ok) {
  const stage = document.querySelector(".stage");
  if (!stage) return;
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  // 앞 판의 잔상이 남아 있으면 먼저 치운다
  stage.querySelectorAll(".fx").forEach((e) => e.remove());

  const fx = document.createElement("div");
  fx.className = "fx " + (ok ? "fx-ok" : "fx-fail");
  fx.addEventListener("animationend", () => fx.remove());
  stage.appendChild(fx);

  // 탭이 뒤에 있으면 애니메이션이 아예 돌지 않아 animationend 가 오지 않는다.
  // 그대로 두면 덮개가 화면에 눌러앉으므로 시간을 재서 반드시 걷어낸다.
  setTimeout(() => fx.remove(), 1200);

  if (ok) return;
  stage.classList.remove("shake");
  void stage.offsetWidth;                 // 애니메이션을 처음부터 다시 틀게 한다
  stage.classList.add("shake");
  const clear = () => stage.classList.remove("shake");
  stage.addEventListener("animationend", clear, { once: true });
  setTimeout(clear, 800);
}

/* 판정 화면 */
function verdictHtml(ok, detail, sub) {
  // 돌려준 글자가 화면에 붙은 다음 연출이 시작되도록 한 박자 미룬다
  queueMicrotask(() => stageEffect(ok));
  return '<div class="verdict ' + (ok ? "ok" : "fail") + '">'
       +   '<div class="mark">' + (ok ? "성 공" : "실 패") + "</div>"
       +   '<div class="detail">' + detail + "</div>"
       +   (sub ? '<div class="sub">' + sub + "</div>" : "")
       + "</div>";
}
