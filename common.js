/* ─────────────────────────────────────────────────────────────
   밤가네 미니게임 — 공통 기능
   ───────────────────────────────────────────────────────────── */
"use strict";

/* 이 묶음의 버전. 하루 작업을 마무리할 때 0.01 씩 올린다.
   자세한 내용은 _버전.md 에 적는다.

   배포용은 만들 때 이 파일을 그대로 복사해 가므로, 그때 값이 그대로 박힌다.
   관리용을 0.02 로 올려도 배포를 안 하면 배포용은 0.01 로 남는다.
   두 화면을 나란히 띄우면 무엇이 아직 안 나갔는지 눈으로 보인다. */
const VERSION = "0.22";

/* 난이도. 여기 숫자만 고치면 모든 게임에 반영된다.
   값은 사람의 오차 분포로 시뮬레이션해 성공률 5% 안팎으로 잡은 것이다.
   실제로 해보고 쉽거나 어려우면 이 숫자를 조정한다. */
const RULES = {
  // 칼은 좌우로 왕복하되 속도가 계속 변한다. 등속으로 두면 박자를 세서 맞출 수 있다.
  // 오차는 이미 2.3px 라 더 줄일 수 없어서, 대신 예측을 깨는 쪽으로 어렵게 만들었다.
  // 속도를 두 갈래로 나눠 준다.
  //   ① 자리에 따라 — 양 끝에서 느리고 가운데(성공선)에서 빠르다. 항상 그렇다.
  //   ② 시간에 따라  — 판 전체 박자가 오르내린다. 박자를 못 세게 하는 몫.
  // ①이 없으면 ②의 느린 구간이 성공선과 겹쳐서 거저 주는 판이 나온다.
  // 떡을 세 조각으로 나눈다. 자를 자리 두 곳이 매판 랜덤이고,
  // 두 번 자른 뒤 오차를 합해서 판정한다.
  // 한 번 자를 때보다 기준을 넓힌 이유: 두 번 연속이면 성공률이 제곱으로 떨어진다.
  // 0.15% 를 그대로 두면 백 번에 한 번 되는 게임이 된다.
  ricecut:  { cuts: 2,                          // 자르는 횟수 (조각은 3개)
              tolSum: 1.00,                     // 두 오차의 합이 이 % 안이면 성공
              minGapPct: 20,                    // 조각 하나가 최소 이만큼은 되어야 한다
              tolPct: 0.15,                     // (옛 단일 컷 기준. 참고용으로 남겨 둠)
              sweepMin: 2.4, sweepMax: 2.9,     // 편도 기준 시간(초)
              centerMin: 0.50, centerMax: 0.65, // 가운데 가속. 끝은 (1-값)배, 가운데는 (1+값)배
              waveMin: 0.15, waveMax: 0.25,     // 시간에 따른 흔들림 폭 (±비율)
              wavePMin: 1.6, wavePMax: 2.8,     // 그 주기(초). 편도와 안 맞물리게 잡는다
              creep: 0.05 },                    // 초당 이만큼씩 빨라진다 (오래 못 끌게)
  // 6열 3행 18장. 세로는 305px 칸이라 3줄이 한계여서 가로로 늘렸다.
  // 흔들림은 시간이 갈수록 심해진다 — 남은 시간을 숫자 말고 몸으로 느끼게 하려는 것.
  schulte:  { limitSec: 7.0, count: 18, wobbleMax: 3.2 },
  /* 실패에서 바늘까지 길을 따라 끈다. 벗어나면 실이 닳고, 다 닳으면 끊어진다.

     판이 760×200 에서 768×432 로 커지면서 길의 굽이와 폭을 1.9배 했다.
     굽이만 키우고 폭을 그대로 두면 길이 훨씬 가팔라져 난이도가 조용히 오른다. */
  wire:     { halfWidth: 7.4 },                             // 길 반폭(px)
  // 목표 시각은 매판 8~10초 사이에서 0.1초 간격으로 뽑는다. 외워서 못 하게.
  stopwatch:{ minTarget: 8.0, maxTarget: 10.0, targetStep: 0.1, places: 2 },
  /* 성공 반지름. 캔버스에 그려지는 px 그대로다.

     예전에는 이 값에 SCALE(0.853)을 곱해서 써서, 10 이라고 적어 두고
     실제로는 8.5px 로 판정했다. 적힌 값과 판정이 달라 헷갈린다. */
  curling:  { targetR: 10 },                                 // 성공 반지름(px)
  stack:    { layers: 14, barW: 56 },                       // 층수, 첫 돌 너비 (54 → 70 에서 20% 줄임)
  // 회차마다 제한이 짧아진다. 소수점 둘째 자리에서 딱 떨어지는 값만 쓴다.
  // 어중간한 값이면 화면 표시(반올림)와 실제 판정이 어긋난다.
  signal:   { limitsSec: [0.40, 0.34, 0.30, 0.27, 0.24] },
  // 다가오는 시간(lead)과 속도를 매판 따로 뽑는다. 둘 중 하나라도 고정이면
  // 화면을 안 보고 박자만 세도 맞출 수 있어 실력 게임이 아니게 된다.
  // 회차가 오를수록 허용 오차가 좁아지고 속도도 붙는다.
  /* 달무리가 좁아지다 달에 겹칠 때 누른다. 다섯 번 맞춰야 한다.

     판이 440×200 에서 768×432 로 커지면서 모든 px 값을 똑같이 2배 했다.
     한쪽만 키우면 난이도가 조용히 바뀐다 — 배율을 하나로 맞춰야 그대로다.

     빗나가도 죽지 않는다. 남은 시간에서 깎임 초를 덜고 같은 회차를 다시 던진다. */
  circle:   { rounds: 5, 전체초: 12.0, 깎임: 1.0,
              startR: 172, minTargetR: 46,
              tolStart: 6.4, tolStep: 0.8,          // 6.4 → 3.2px
              leadMin: 0.45, leadMax: 0.85,
              speedMin: 110, speedMax: 190, speedStep: 8 },
  // 차오르는 속도를 매판 다르게 한다. 고정이면 박자만 세면 되기 때문.
  pressure: { rounds: 3, tolPct: 1.1, minTarget: 58, maxTarget: 86,
              fillMin: 1.4, fillMax: 2.6 },                 // 100%까지 걸리는 시간(초)
  /* 5회 연속. 회차가 오를수록 색 차이가 줄어 찾기 어려워진다.

     숫자는 ΔE2000 — 사람이 느끼는 색 차이의 표준 자다.
       1       나란히 붙여 놔야 겨우 알아본다
       2~3     눈여겨보면 다르다
       5       떨어져 있어도 다르다고 느낀다
       10      누가 봐도 다른 색이다

     두 번 고쳤다.

     ① 처음에는 HSL 밝기 차이(%p)로 적었다. 같은 밝기 차이라도 노란 콩에서는
        잘 보이고 파란 콩에서는 안 보여서 3회차가 1.6~6.2 로 벌어졌다.
     ② 그래서 ΔE 로 바꿨는데, 그것도 Lab 위 직선거리(ΔE76)라 여전히 고르지
        않았다. 사람 눈은 채도가 높을수록 같은 차이를 둔하게 느끼는데 그 보정이
        없다. 숫자를 9.0 으로 똑같이 맞춰도 팥은 2.65, 동부콩은 9.25 로
        3.5배 벌어졌다 — 팥이 걸린 판은 사실상 못 찾는 판이었다.

     지금은 보정이 들어간 ΔE2000 을 쓴다. 여덟 종류 콩 전부 목표값에
     정확히 맞아떨어진다(벌어짐 1.00배). 자가 바뀌었으므로 아래 숫자는
     예전 ΔE76 값의 60% 쯤에 해당한다. */
  oddone:   { cols: 10, rows: 6, 전체초: 17.5, 깎임: 1.0,
              // 젤리빈으로 바꾸며 광택·그늘 때문에 "제 색" 이 보이는 면적이 54% → 27% 로 줄어
              // 같은 ΔE 라도 훨씬 어려워졌다. 2026-10-09 사용자 결정으로 올렸다 (예전 3.2/3.2/3.2/2.9/2.7)
              단계: [4.0, 4.0, 3.8, 3.4, 3.4],    // 회차별 목표 ΔE2000 (5회는 2026-10-09 3.0 → 3.4)
              흔들림: 0.12 },                      // 목표의 ±12% 안에서 뽑는다
  /* 연타로 목표 개수를 맞춘다. 12개 중 유일하게 "연타" 를 쓰는 게임이다.

     처음 몇 개까지만 숫자를 보여 주는 것이 이 게임의 전부다. 그 구간에서
     자기 연타 속도를 몸으로 익히고, 숫자가 사라진 뒤에는 그 감으로 센다.
     처음부터 안 보여 주면 순수한 운이 되고, 끝까지 보여 주면 그냥 읽기가 된다. */
  fill:     { minTarget: 35, maxTarget: 42,   // 목표 개수 (매판 랜덤)
              limitSec: 12.0,                 // 이 안에 담아야 한다
              showUntil: 10 },                // 여기까지만 숫자를 보여 준다
  /* 맨 아래 떡의 색을 판별해 같은 색을 누른다. 틀리면 즉시 실패.

     색마다 문양이 하나씩 고정이라(빨강=동그라미·초록=세모·파랑=별)
     색약인 시청자도 같이 볼 수 있다. 이건 꼭 지킨다.

     같은 색이 너무 여러 번 이어지면 손이 굳어서 오히려 쉬워진다.
     maxRun 으로 끊어 준다. */
  tower:    { layers: 40, 보임: 5, limitSec: 12.0, maxRun: 3, 벌초: 0.45, 깎임: 1.0 },
  /* 문 셋이 동시에 열리고 그중 도둑 하나를 짚는다.
     회차가 오를수록 시간이 짧아진다. 마지막 판은 눈에 들어오자마자 눌러야 한다. */
  doors:    { rounds: 3, limitsSec: [2.2, 1.7, 1.3], people: 6 },
  cutline:  { tolPx: 3.0 },                                 // 직선에서 벗어나도 되는 최대 거리
  // 바늘은 멈출 때까지 계속 돈다. 여러 바퀴 보고 노릴 수 있으므로
  // 허용 각도를 그만큼 좁게 잡았다.
  /* 물레방아 바퀴의 붉은 살이 홈통(12시)에 올 때 멈춘다. 다섯 번 맞춰야 한다.

     맞출 자리를 12시로 고정한 대신 속도와 도는 쪽을 매판 굴린다.
     자리까지 옮겨 다니면 물레방아가 아니라 그냥 원판이 된다.

     tolDeg 는 각도라 바퀴를 키워도 그대로 둔다 — 각속도가 안 바뀌었으니
     맞추는 어려움도 그대로다. 커진 건 보기 편해진 것뿐이다. */
  lock:     { rounds: 5, 전체초: 14.0, 깎임: 1.0,
              tolDeg: 4.5, spinMin: 200, spinMax: 340 },

  /* ── 셈 · 계획 · 지속 제어 ────────────────────────────────
     앞의 게임들이 전부 "보고 즉시 손이 나가는" 것이라 아래 셋은
     비어 있던 칸을 채우려고 만들었다. 노는 방식이 달라야 방송이 안 물린다. */

  /* 곶감 꼬치가 잠깐 보였다 사라진다. 몇 개였는지 고른다.

     한 알씩 흩어 놓으면 세는 게 아니라 눈대중이 된다 — 사람은 넷을 넘기면
     못 센다. 그래서 꼬치 여러 줄에 나눠 꿴다. "여섯에 다섯에 넷" 처럼
     묶어서 더하는 일이 되고, 그게 이 게임이 시험하려는 것이다.

     고르는 값은 정답 언저리(±1·±2)로만 낸다. 멀찍이 떨어진 값을 섞으면
     대충 봐도 맞아서 셀 이유가 없어진다. */
  count:    { rounds: 5, 전체초: 26.0, 깎임: 2.0,
              보임초: [1.50, 1.30, 1.15, 1.00, 0.85],
              줄최소: 2, 줄최대: 4, 알최소: 3, 알최대: 8 },

  /* 장대를 휘두르면 그 직선에 걸린 감이 전부 떨어진다.
     세 번 안에 익은 감을 목표만큼. 떫은 감이 섞이면 하나당 감점이다.

     기회를 적게 준 것이 핵심이다. 많이 주면 아무 데나 휘둘러도 되므로
     생각할 값이 없어진다. */
  /* 목표 8점 — 각도를 전부 훑어 최선으로 세 번 휘두르면 중간값이 9점,
     아무 데나 휘두르면 중간값이 2점이다. 사람은 각도를 다 못 훑으므로
     9점을 목표로 두면 잘해도 반 넘게 진다. */
  pole:     { 기회: 3, 목표: 8, 벌점: 1, 제한초: 25.0,
              익은감: 14, 떫은감: 8, 감반지름: 20,
              장대폭: 30 },                                // 장대에 걸리는 폭(반폭)

  /* 바람이 연을 좌우로 민다. 띠 안에 머무는 동안만 시간이 쌓인다.
     띠를 벗어나도 죽지 않는다 — 쌓이지 않을 뿐이다.
     화면 끝까지 밀리면 그때 줄이 끊어진다. */
  kite:     { 목표초: 11.0, 제한초: 26.0, 띠반폭: 78,
              바람시작: 34, 바람끝: 96,                    // 초당 미는 힘 (점점 세진다)
              당기는힘: 190, 저항: 1.6 },

  /* 베개 싸움 (상자 시제품). 컴온베이비 뺨 때리기처럼 체력을 깎고, 앞뒤로 거리를 잰다.
     상대가 베개를 치켜든 뒤 **앞으로 휘두르면 피하거나 뒤로 빠지고**, 그냥 내리면(속임) 가만히 있는다.
     휘두르기 전에 피하면 피한 뒤 굳은 틈에 맞는다 — 미리 피하기로는 못 버틴다.
     헛스윙으로 비틀거리거나 하품할 때, **베개가 닿는 거리에서만** 때릴 수 있다.
     그 밖에 때리면 막히고 반격을 받는다. 닿지 않는 거리에서 휘두르면 헛손질로 잠깐 굳는다.

     회차 배열 다섯 칸은 상대가 잃은 체력(단계체력마다 한 칸)에 해당한다. 깎을수록 빨라진다.
     시간 값은 초, 거리는 캔버스 px(768 폭), 속도는 px/초.
     2026-10-09 사람 모형 시뮬레이션(판 1500): 고수(반응 0.27초) 88% · 보통(0.32초) 25% · 초보(0.38초) 1%.
     시간 초과는 5% 안팎 — 대부분 K.O. 나 다운으로 끝난다. 손맛 보기용 첫 값이다. */
  pillow:   { 체력: 100, 제한초: 40.0, 단계체력: 20,
              맞는피해: 34,                                // 내가 맞으면 (세 대에 끝)
              반격피해: 20, 빠른피해: 30, 하품피해: 15,     // 내가 때리면. 헛스윙 직후 빨리 치면 "정타"
              빠른반격초: 0.38,                            // 헛스윙 순간부터 이 안에 닿으면 정타
              사거리: 250, 최소거리: 145,                  // 두 몸 가운데 사이 거리 (몸 폭 90 — 기울어도 안 겹치게)
              왼끝: 70, 오른끝: 698, 시작나: 200, 시작적: 568,
              걷기앞: 250, 걷기뒤: 205, 적걷기: 180, 쫓기속도: 155, 쫓기최대: 1.2, 밀림: 55,
              다가갈최소: 180, 다가갈최대: 235,            // 상대가 걸어 들어와 멈추는 거리
              물러남비율: 0.15, 물러남최소: 60, 물러남최대: 130,   // 사거리 밖으로 얼마나 물러나나
              휘두름초: [0.42, 0.38, 0.34, 0.31, 0.28],   // 휘두르기 시작 → 닿는 순간 (피할 수 있는 시간)
              속임비율: [0.20, 0.28, 0.34, 0.40, 0.45],   // 치켜든 것 중 그냥 내리는 몫
              하품비율: 0.15,                              // 닿는 거리에서 쉬다가 저절로 빈틈을 보이는 몫
              하품초:   [0.75, 0.66, 0.58, 0.52, 0.48],
              비틀초:   [0.70, 0.62, 0.55, 0.50, 0.46],   // 헛스윙 뒤 빈틈 길이
              쉼최소:   [0.70, 0.60, 0.50, 0.45, 0.40],
              쉼최대:   [1.40, 1.25, 1.10, 1.00, 0.90],
              쉼짧게최소: 0.15, 쉼짧게최대: 0.45,          // 걸어 들어온 뒤 숨 고르기
              예고최소: 0.45, 예고최대: 1.10,              // 치켜든 채 버티는 시간 (매번 뽑아 박자를 못 세게)
              내림초: 0.30, 반격예고: 0.30, 응징휘두름: 0.26,
              피함초: 0.35, 피함후딜: 0.35,                // 피하는 동안은 안 맞고, 그 뒤엔 굳는다
              타격준비: 0.12, 막힘초: 0.45, 헛손초: 0.40, 맞음초: 0.70 },
};

/* 무대를 창 크기에 맞춰 통째로 확대·축소한다.
   이래야 어떤 창 크기에서도 화면 구성이 똑같이 유지된다.

   게임은 PC 방송용이다. 무대는 1280×720 으로 못 박혀 있고 그 안의 좌표·크기·
   판정 기준은 어떤 기기에서도 건드리지 않는다. 바꾸는 것은 마지막에 화면에
   얹는 방법뿐이다.

   휴대폰을 세로로 들면 폭이 375px 남짓이다. 가로로 긴 무대를 그대로 넣으면
   0.29배까지 줄어들어 15px 글자가 4px 가 된다. 읽을 수가 없다.
   그래서 세로일 때는 무대를 통째로 90도 눕힌다. 같은 화면에 0.52배로 들어가서
   1.8배 커진다. 사용자는 휴대폰을 돌려 잡으면 된다.

   눕히는 것은 CSS 변환일 뿐이라 게임 쪽은 아무것도 달라지지 않는다.
   배율이 균일해서 모든 비율이 그대로고, 판정은 % 기준이라 배율과 무관하다.
   터치 좌표도 브라우저가 알아서 되짚어 준다.

   태블릿은 세로로도 0.6배라 읽을 만해서 눕히지 않는다. */
const ROTATE_MAX_W = 600;      // 이 폭 아래에서 세로면 눕힌다 (휴대폰만)

function fitStage() {
  const stage = document.querySelector(".stage");
  if (!stage) return;
  const cs = getComputedStyle(document.documentElement);
  const w = parseFloat(cs.getPropertyValue("--stage-w"));
  const h = parseFloat(cs.getPropertyValue("--stage-h"));

  const 눕힌다 = innerHeight > innerWidth && innerWidth <= ROTATE_MAX_W;
  // 눕히면 화면의 가로세로가 뒤바뀐 셈이 된다
  const vw = 눕힌다 ? innerHeight : innerWidth;
  const vh = 눕힌다 ? innerWidth  : innerHeight;
  const k = Math.min(vw / w, vh / h);

  // transform 을 직접 쓰지 않고 변수로 넘긴다.
  // 흔들림 연출이 transform 을 덮어써도 배율이 풀리지 않는다.
  stage.style.setProperty("--fit", k);
  stage.style.setProperty("--rot", 눕힌다 ? "90deg" : "0deg");
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

/* 이 화면에서 틀 곡 번호. 0 이면 아무거나 (게임 화면).

   홈화면은 늘 3번이다. 7곡 중 아케이드 대역(110~160 BPM)에 드는 것이
   1번(133)과 3번(117) 둘뿐인데, 3번은 끝과 처음의 단차가 0.018 로
   1번(0.113)의 6분의 1 이다. 홈화면은 30초짜리를 계속 이어 붙여 트는 데다
   방송에서 가장 오래 떠 있는 화면이라 30초마다 나는 "툭" 소리가 쌓인다.
   7곡 중 가장 밝기도 하다.

   갈 때마다 딴 곡이 나오면 "돌아왔다" 는 느낌이 없고 산만하다.
   틀 때와 손잡이를 올릴 때가 같은 곡이어야 하므로 여기 한 곳에서만 정한다. */
const 홈화면곡 = 3;
function 이화면곡() { return document.querySelector(".hub") ? 홈화면곡 : 0; }

/* ── 소리 조절 ──────────────────────────────────────────────────
   상단 바 오른쪽 끝의 스피커를 누르면 손잡이 두 개가 펼쳐진다.
   효과음과 배경음악을 따로 조절한다 — 방송에서는 배경음악만 낮추고
   효과음은 살려 두는 일이 잦은데, 하나로 묶어 두면 그걸 못 한다.

   값은 브라우저에 적어 두므로 다른 게임으로 옮겨 가도 그대로 따라간다.
   게임마다 다시 맞추게 하면 열두 번 맞춰야 한다. */
const 소리설정 = (() => {
  const 열쇠 = { sfx: "bg_vol_sfx", bgm: "bg_vol_bgm" };
  const 값 = { sfx: 1, bgm: 1 };
  // 전체 음소거는 손잡이와 따로 둔다. 껐다 켜면 원래 크기로 돌아와야 하는데,
  // 손잡이를 0 으로 내려 버리면 얼마였는지를 잃는다.
  const 음소거열쇠 = "bg_mute_all";
  let 다끔 = false;

  // 예전에는 켜고 끄는 것뿐이었다. 꺼 두고 갔던 사람은 꺼진 채로 이어받는다.
  let 예전음소거 = false;
  try { 예전음소거 = localStorage.getItem("bg_mute") === "1"; } catch (_) {}

  for (const k in 열쇠) {
    let v = null;
    try { v = localStorage.getItem(열쇠[k]); } catch (_) {}
    if (v == null) 값[k] = 예전음소거 ? 0 : 1;
    else 값[k] = Math.max(0, Math.min(1, parseFloat(v) || 0));
  }

  try { 다끔 = localStorage.getItem(음소거열쇠) === "1"; } catch (_) {}

  const 읽기 = (k) => 값[k];
  const 쓰기 = (k, v) => {
    값[k] = Math.max(0, Math.min(1, v));
    try { localStorage.setItem(열쇠[k], String(값[k])); } catch (_) {}
    if (typeof Sound !== "undefined") Sound.setVolume(k, 값[k]);
  };
  /* 저장해 둔 값을 다시 읽어 Sound 에 넣는다.

     화면이 살아 있는 동안 **다른 화면이 값을 바꿔 놓았을 때** 쓴다.
     브라우저 뒤로가기로 돌아온 경우(bfcache)와 창을 두 개 띄운 경우다.
     둘 다 이 화면의 코드는 다시 돌지 않으므로 스스로는 알 수가 없다. */
  const 다시읽기 = () => {
    for (const k in 열쇠) {
      let v = null;
      try { v = localStorage.getItem(열쇠[k]); } catch (_) {}
      if (v != null) 값[k] = Math.max(0, Math.min(1, parseFloat(v) || 0));
    }
    try { 다끔 = localStorage.getItem(음소거열쇠) === "1"; } catch (_) {}
    if (typeof Sound === "undefined") return;
    Sound.setVolume("sfx", 값.sfx);
    Sound.setVolume("bgm", 값.bgm);
    Sound.setMuted(다끔);
  };

  const 음소거읽기 = () => 다끔;
  const 음소거쓰기 = (v) => {
    다끔 = !!v;
    try { localStorage.setItem(음소거열쇠, 다끔 ? "1" : "0"); } catch (_) {}
    if (typeof Sound !== "undefined") Sound.setMuted(다끔);
  };
  return { 읽기, 쓰기, 다시읽기, 음소거읽기, 음소거쓰기 };
})();

/* 저장해 둔 값을 Sound 에 넣는다.

   여기서 바로 넣으면 안 된다. 게임 화면은 common.js 를 sound.js 보다
   **먼저** 불러오므로 이 줄이 도는 시점에 Sound 가 아직 없다.
   그러면 화면의 손잡이만 저장값을 보여 주고 실제 소리는 100% 로 난다.

   그리고 이 줄은 배경음악을 트는 대목(아래)보다 먼저 등록해야 한다.
   순서가 뒤집히면 0% 로 꺼 둔 사람에게도 곡을 한 번 받아 온다. */
addEventListener("DOMContentLoaded", () => {
  if (typeof Sound === "undefined") return;
  Sound.setVolume("sfx", 소리설정.읽기("sfx"));
  Sound.setVolume("bgm", 소리설정.읽기("bgm"));
  // 음소거로 두고 나갔으면 곡을 받지도 않는다 — Sound 쪽에서 막힌다.
  Sound.setMuted(소리설정.음소거읽기());
});

addEventListener("DOMContentLoaded", () => {
  /* 붙일 자리. 게임 화면은 상단 바, 홈화면은 모드 고르는 줄(.sndmount) 이다.

     예전에는 상단 바만 봤다. 홈화면에는 상단 바가 없어서 소리 조절이
     아예 안 붙었고, 그래서 **게임에 들어가야만** 소리를 줄일 수 있었다.
     방송에서 목록을 띄워 두는 시간이 짧지 않은데 그동안은 손댈 데가 없었다. */
  const bar = document.querySelector(".topbar") || document.querySelector(".sndmount");
  if (!bar || typeof Sound === "undefined") return;

  const ON  = '<svg viewBox="0 0 24 24"><path d="M4 9v6h4l5 4V5L8 9H4z"/>'
            + '<path d="M16.5 8.5a5 5 0 0 1 0 7"/><path d="M19 6a8.5 8.5 0 0 1 0 12"/></svg>';
  const OFF = '<svg viewBox="0 0 24 24"><path d="M4 9v6h4l5 4V5L8 9H4z"/>'
            + '<path d="M17 9.5l4 5M21 9.5l-4 5"/></svg>';

  const 통 = document.createElement("div");
  통.className = "sndbox";
  const btn = document.createElement("button");
  btn.className = "mute";
  통.appendChild(btn);

  const 판 = document.createElement("div");
  판.className = "sndpanel";
  통.appendChild(판);
  bar.appendChild(통);

  /* 전체 음소거. 손잡이 위에 놓는다 — 두 갈래를 한꺼번에 끄는 것이라
     아래 것들을 거느리는 자리가 맞다.

     손잡이를 0 으로 내리는 것과 다르다. 껐다 켜면 원래 크기로 돌아와야 하는데
     손잡이를 내려 버리면 얼마였는지를 잃는다. 그래서 따로 둔다. */
  const 끔 = document.createElement("button");
  끔.className = "sndmute";
  끔.type = "button";
  끔.setAttribute("role", "switch");
  끔.innerHTML = '<span class="nm">전체 음소거</span><span class="sw"></span>';
  판.appendChild(끔);

  끔.addEventListener("click", (e) => {
    e.stopPropagation();
    const 켜자 = !소리설정.음소거읽기();
    소리설정.음소거쓰기(켜자);
    그리기();
    /* 음소거를 풀면 배경음악을 다시 튼다. Sound.setMuted(true) 가 도는 것을
       모두 멈추므로, 풀었을 때 아무도 다시 틀어 주지 않으면 조용한 채로 남는다. */
    if (!켜자 && 소리설정.읽기("bgm") > 0 && !Sound.isLooping("bgm")) {
      Sound.bgm(null, 이화면곡());
    }
  });

  const 손잡이 = {};
  for (const [갈래, 이름] of [["sfx", "효과음"], ["bgm", "배경음악"]]) {
    const 줄 = document.createElement("label");
    줄.className = "sndrow";
    줄.innerHTML = '<span class="nm">' + 이름 + '</span><span class="pc"></span>';
    const s = document.createElement("input");
    s.type = "range"; s.min = "0"; s.max = "100"; s.step = "5";
    /* 브라우저가 이 손잡이를 되살리지 못하게 막는다.

       뒤로가기로 돌아오면 브라우저는 **떠날 때 손잡이가 어디 있었는지**를
       기억했다가 그대로 되돌려 놓는다(폼 복원). 글자로 적힌 % 와 실제 소리는
       저장값을 읽어 맞는데 손잡이만 옛 자리에 있는, 가장 헷갈리는 꼴이 된다.
       이 손잡이의 값은 폼이 아니라 브라우저 저장소에 있다. 되살릴 필요가 없다. */
    s.autocomplete = "off";
    s.value = String(Math.round(소리설정.읽기(갈래) * 100));
    줄.appendChild(s);
    판.appendChild(줄);
    손잡이[갈래] = { s, pc: 줄.querySelector(".pc") };

    s.addEventListener("input", () => {
      const v = parseInt(s.value, 10) / 100;
      소리설정.쓰기(갈래, v);
      그리기();
      /* 배경음악은 0 이면 아예 안 받아 둔다. 올리는 순간 그때 받아 튼다.
         홈화면이면 처음 틀 때와 **같은 곡**이어야 한다 —
         손잡이를 만졌다고 딴 곡이 나오면 이상하다. */
      if (갈래 === "bgm" && v > 0 && !소리설정.음소거읽기()
          && !Sound.isLooping("bgm")) Sound.bgm(null, 이화면곡());
    });
  }

  function 그리기() {
    for (const k in 손잡이) {
      const v = 소리설정.읽기(k);
      손잡이[k].pc.textContent = Math.round(v * 100) + "%";
      손잡이[k].s.classList.toggle("zero", v <= 0);
    }
    const 다끔 = 소리설정.음소거읽기();
    끔.classList.toggle("on", 다끔);
    끔.setAttribute("aria-checked", 다끔 ? "true" : "false");
    // 음소거 중에는 손잡이를 흐리게. 만질 수는 있다 — 풀었을 때 쓸 값이다.
    판.classList.toggle("muted", 다끔);

    const 다꺼짐 = 다끔 || (소리설정.읽기("sfx") <= 0 && 소리설정.읽기("bgm") <= 0);
    btn.innerHTML = 다꺼짐 ? OFF : ON;
    btn.classList.toggle("off", 다꺼짐);
    btn.title = "소리 조절";
  }
  그리기();

  /* 다른 화면에서 바꾼 값을 이 화면에 맞춘다.

     소리 설정은 브라우저에 적어 두므로 **새로 연 화면**은 늘 최신값을 읽는다.
     문제는 이미 열려 있던 화면이다. 그쪽 코드는 다시 돌지 않으니 손잡이도
     소리도 옛 값 그대로 남는다. 두 경우에 그렇게 된다.

       뒤로가기   브라우저가 떠날 때 모습 그대로 되살린다(bfcache).
                  게임에서 소리를 줄이고 뒤로가기로 목록에 오면
                  목록은 줄이기 전 크기로 계속 울린다.
       창 두 개   목록과 게임을 따로 띄워 두면 한쪽에서 줄여도 다른 쪽은 모른다.

     그래서 되살아날 때와 저장값이 바뀔 때 다시 읽는다. */
  const 들리나 = () => !소리설정.음소거읽기() && 소리설정.읽기("bgm") > 0;

  function 맞추기() {
    const 전 = 들리나();
    소리설정.다시읽기();
    for (const k in 손잡이) {
      손잡이[k].s.value = String(Math.round(소리설정.읽기(k) * 100));
    }
    그리기();

    /* 꺼져 있던 배경음악이 켜졌으면 그때 받아 튼다.

       "안 돌고 있으면 튼다" 로 하면 안 된다. 화면을 처음 열 때도 이 함수가
       도는데, 그때는 곡을 받는 중이라 아직 안 돌고 있다 — 같은 곡을 두 번
       받아 온다(350KB). **꺼짐에서 켜짐으로 바뀐 순간에만** 튼다. */
    if (!전 && 들리나() && !Sound.isLooping("bgm")) Sound.bgm(null, 이화면곡());
  }
  addEventListener("pageshow", () => 맞추기());
  addEventListener("storage", (e) => {
    if (!e.key || e.key.indexOf("bg_vol_") === 0 || e.key === "bg_mute_all") 맞추기();
  });

  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    통.classList.toggle("open");
  });
  // 판 안을 만질 때는 닫히면 안 된다. 손잡이를 끌다 보면 손이 판 밖으로 나간다.
  판.addEventListener("pointerdown", (e) => e.stopPropagation());
  addEventListener("pointerdown", () => 통.classList.remove("open"));
});

/* 목록 화면 구석에 버전을 조그맣게 띄운다.
   관리용과 배포용을 나란히 놓았을 때 어느 쪽이 앞선 것인지 눈으로 가르려는 것이다.
   빌드 번호(?v=)도 같이 붙인다 — 같은 버전 안에서도 몇 번째 빌드인지 알 수 있고,
   시청자 브라우저가 옛 파일을 붙잡고 있는지 확인할 때 이 숫자를 보면 된다. */
addEventListener("DOMContentLoaded", () => {
  const hub = document.querySelector(".hub");
  if (!hub || document.getElementById("ver")) return;

  const s = document.querySelector('script[src*="common.js"]');
  const m = s && s.getAttribute("src").match(/\?v=(\d+)/);

  const d = document.createElement("div");
  d.id = "ver";
  d.textContent = "v" + VERSION + (m ? " · " + m[1] : "");
  hub.appendChild(d);
});

/* 게임 화면에 들어오면 바로 배경음악을 튼다.
   예전에는 "도 전" 을 눌러야 나왔는데, 그러면 규칙을 읽는 동안 화면이 조용하다.

   다만 브라우저는 사용자가 이 화면에서 무언가 누르기 전에는 소리를 못 내게 막는다.
   목록에서 카드를 누른 것은 **앞 화면에서의 일**이라 여기까지 이어지지 않는다.
   그래서 일단 틀어 보고, 막혔으면 이 화면에서의 첫 움직임에 다시 튼다.
   손을 대기만 해도 걸리도록 누름·키·마우스 이동을 모두 본다. */
addEventListener("DOMContentLoaded", () => {
  if (typeof Sound === "undefined") return;

  /* 게임 화면은 상단 바로, 홈화면은 목록 칸으로 알아본다.

     예전에는 상단 바가 있는 화면에서만 틀었는데, 홈화면에는 상단 바가 없어서
     통째로 건너뛰었다 — 그래서 홈화면만 조용했다. */
  if (!이화면곡() && !document.querySelector(".topbar")) return;

  let 틀었나 = false;
  const 틀기 = () => {
    if (틀었나) return;
    틀었나 = true;
    Sound.bgm(null, 이화면곡());
  };

  틀기();                                   // 되면 바로

  // 막혔을 때를 위한 그물. 한 번 걸리면 스스로 걷힌다.
  const 그물 = () => {
    틀었나 = false;                          // 앞의 시도가 막혔을 수 있으니 다시
    틀기();
    for (const e of ["pointerdown", "keydown", "pointermove"]) {
      removeEventListener(e, 그물);
    }
  };
  for (const e of ["pointerdown", "keydown", "pointermove"]) {
    addEventListener(e, 그물, { once: false });
  }
});

/* 시작 버튼 옆에 홈으로 나가는 버튼을 붙인다.
   게임마다 .controls 를 따로 적어 두고 있어서, 파일 12개를 다 고치는 대신
   여기서 한 번에 넣는다. 새 게임을 만들어도 저절로 따라온다. */
addEventListener("DOMContentLoaded", () => {
  const box = document.querySelector(".controls");
  if (!box || box.querySelector(".btn.home")) return;

  const a = document.createElement("a");
  a.className = "btn home";
  a.href = "index.html";
  a.textContent = "홈화면";
  a.title = "게임 목록으로";
  box.appendChild(a);
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

  // 화면을 한 번 때린다. 성공은 부풀고, 실패는 흔들린다.
  // 둘 다 transform 을 쓰므로 같이 걸면 서로 덮어쓴다. 하나만 건다.
  const 몸짓 = ok ? "punch" : "shake";
  stage.classList.remove("punch", "shake");
  void stage.offsetWidth;                 // 애니메이션을 처음부터 다시 틀게 한다
  stage.classList.add(몸짓);
  const clear = () => stage.classList.remove("punch", "shake");
  stage.addEventListener("animationend", clear, { once: true });
  setTimeout(clear, 900);

  if (!ok) return;

  // 성공에는 퍼져 나가는 고리를 하나 더 얹는다
  const ring = document.createElement("div");
  ring.className = "fx-ring";
  ring.addEventListener("animationend", () => ring.remove());
  stage.appendChild(ring);
  setTimeout(() => ring.remove(), 1200);
}

/* 판정 화면 */
/* ── 깬 게임 기록 ───────────────────────────────────────────────
   랜덤모드에서 이미 깬 게임이 또 걸리면 김이 샌다. 성공한 게임을 적어 두고
   목록 화면에서 뽑기 대상에서 뺀다.

   적는 자리를 verdictHtml 한 곳으로 잡았다. 열두 게임이 성공을 알리는 통로가
   여기 하나뿐이라, 게임 파일은 한 줄도 안 고쳐도 전부 걸린다.
   나중에 게임을 더 만들어도 저절로 따라온다. */
const 깬기록 = (() => {
  const 열쇠 = "bg_cleared";
  const 읽기 = () => {
    try { return JSON.parse(localStorage.getItem(열쇠)) || []; }
    catch (_) { return []; }
  };
  const 쓰기 = (목록) => {
    try { localStorage.setItem(열쇠, JSON.stringify(목록)); } catch (_) {}
  };
  return {
    목록: 읽기,
    깼나: (파일) => 읽기().indexOf(파일) >= 0,
    더하기: (파일) => { const m = 읽기(); if (m.indexOf(파일) < 0) { m.push(파일); 쓰기(m); } },
    비우기: () => 쓰기([]),
  };
})();

// 지금 보고 있는 게임의 파일 이름 (목록 화면이면 빈 문자열)
function 이게임() {
  const 끝 = location.pathname.split("/").pop() || "";
  return 끝 === "index.html" ? "" : 끝;
}

function verdictHtml(ok, detail, sub) {
  if (ok) { const f = 이게임(); if (f) 깬기록.더하기(f); }
  // 돌려준 글자가 화면에 붙은 다음 연출이 시작되도록 한 박자 미룬다
  queueMicrotask(() => stageEffect(ok));
  return '<div class="verdict ' + (ok ? "ok" : "fail") + '">'
       +   '<div class="mark">' + (ok ? "성 공" : "실 패") + "</div>"
       +   '<div class="detail">' + detail + "</div>"
       +   (sub ? '<div class="sub">' + sub + "</div>" : "")
       + "</div>";
}
