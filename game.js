/* ============================================================
   샤미라이더 - 사이드뷰 러너 게임
   ------------------------------------------------------------
   ▶ 이미지를 사용하려면 아래 ASSET_PATHS의 경로에 파일을 넣고
     상대경로(예: 'images/rider.png')를 적으세요.
     비어있으면 기본 도형으로 그려집니다.
   ============================================================ */

const ASSET_PATHS = {
  rider:        'images/ohana.png',      // 인물 - 분리 상태(서있는 포즈)
  riderMounted: 'images/ohana_ride.png', // 인물 - 탑승 상태(앉은 포즈)
  mountBody:    'images/shami_body.png', // 탈것 몸통 (머리 제외)
  mountHead:    'images/shami_head.png', // 탈것 머리 (최상단 레이어)
  mountLeg:     'images/leg.png',        // 다리 1장 - 4곳에 재사용
  food:         'images/item.png',       // 먹는 아이템 (cat treat 형태)
  boss:         'images/boss.png',       // 보스 (스테이지 4 전용)
  title:        'images/title.png',      // 타이틀 화면 배경
  gameOverHole: 'images/gameover01.png', // 구멍 추락 게임오버
  gameOverHunger: 'images/gameover02.png', // 배고픔 게임오버
  gameOverClear: 'images/gameover03.png',  // 클리어(승리) 화면
  platform:     '',
  ground:       '',
  background:   '',
};

// 스테이지 배경 이미지 (캔버스 사이즈에 맞춰 제작된 정적 배경)
// 모든 스테이지를 통과하면 처음으로 순환
const STAGE_BG_PATHS = [
  'images/st01.png',
  'images/st02.png',
  'images/st03.png',
  'images/st04.png',
];

// 각 스테이지의 진행 거리 (월드 픽셀)
// 이미지 1800 - 캔버스 1500 = 300px 스크롤 여지. 14000 ≈ 35초 @ speed 6.5
const STAGE_LENGTH_WORLD = 14000;

// 스테이지 전환 페이드 시간 (페이드아웃/페이드인 각각, 초)
const STAGE_FADE_DURATION = 0.45;

// 스테이지별 블록 + 바닥 색상/질감 (배경 이미지 톤과 매칭)
// p* = 플랫폼(블록) 스타일, g* = 바닥(지면) 스타일
const STAGE_STYLES = [
  {
    name: 'ruins',  // Stage 1 - 폐허 도시
    pMain: '#4a4a52', pTop: '#7a7a82', pBottom: '#22222a', pLine: '#2a2a30', pCrack: true,
    gMain: '#363640', gTop: '#5a5a64', gLine: '#1c1c22',                     gCrack: true,
  },
  {
    name: 'shrine', // Stage 2 - 신사
    pMain: '#6b4828', pTop: '#a07033', pBottom: '#2a1c10', pLine: '#3a2418', pCrack: false,
    gMain: '#4a3220', gTop: '#7a5530', gLine: '#2a1810',                     gCrack: false,
  },
  {
    name: 'subway', // Stage 3 - 폐허 지하철
    pMain: '#5a4628', pTop: '#9a7e3a', pBottom: '#2a1c0a', pLine: '#3a2c14', pCrack: true,
    gMain: '#3a2d18', gTop: '#6a5a30', gLine: '#1f1808',                     gCrack: true,
  },
  {
    name: 'whippers', // Stage 4 - 채찍 군중 (위협)
    pMain: '#3a3530', pTop: '#7a4a36', pBottom: '#1a1414', pLine: '#241c1c', pCrack: true,
    gMain: '#2a2424', gTop: '#5a3e30', gLine: '#160e0e',                     gCrack: true,
  },
];

// 스테이지별 난이도 - 속도는 조금씩, 배고픔과 블록 배치로 난이도를 올림
const STAGE_DIFFICULTY = [
  { // Stage 1 - 입문
    targetSpeed: 6.0,
    hungerRate:  1.4,        // 초당 배고픔 감소
    holeProb:    0.25,       // 구멍 생성 확률
    holeRange:   [100, 180], // 구멍 너비 범위
    groundLen:   [450, 950], // 지면 segment 길이 범위
    platLen:     [220, 460], // 플랫폼 너비 범위
    platGap:     [220, 480], // 플랫폼 사이 간격
    moveChance:  0.12,       // 이동 블록 확률
  },
  { // Stage 2 - 약간 어려움
    targetSpeed: 6.3,
    hungerRate:  1.8,
    holeProb:    0.32,
    holeRange:   [120, 220],
    groundLen:   [400, 850],
    platLen:     [200, 420],
    platGap:     [200, 460],
    moveChance:  0.20,
  },
  { // Stage 3 - 본격 난이도
    targetSpeed: 6.6,
    hungerRate:  2.2,
    holeProb:    0.40,
    holeRange:   [140, 260],
    groundLen:   [340, 760],
    platLen:     [180, 380],
    platGap:     [180, 440],
    moveChance:  0.30,
  },
  { // Stage 4 - 위협
    targetSpeed: 7.0,
    hungerRate:  2.7,
    holeProb:    0.48,
    holeRange:   [160, 300],
    groundLen:   [300, 680],
    platLen:     [160, 340],
    platGap:     [160, 420],
    moveChance:  0.40,
  },
];

// 탑승 자세 인물(ohana_ride.png) 출력 설정
//   원본 548x765, 비율 0.716 유지 → 100x140
//   offsetX: 캐릭터가 이미지 가운데에서 벗어났을 때 보정 (현재 이미지는 트리밍됨)
//   overlap: 탈것 윗면 안쪽으로 얼마나 파고들어 앉을지(픽셀)
const RIDER_MOUNTED = {
  w: 100,
  h: 140,
  offsetX: 0,
  overlap: 70,
};

// 탈것 부위 배치 (박스 비율, 0~1)
// 박스: (width=MOUNT_W, height=MOUNT_H), 좌상단(0,0) ~ 우하단(1,1)
const MOUNT_PARTS = {
  // 몸통 - shami_body.png (1365x1013, aspect 1.347)
  //   박스 174x130 비율(1.338)과 거의 일치 → 박스 거의 전체 채움
  //   dw/dh = 1.347 × 130/174 ≈ 1.007 → dh = 1.0/1.007 ≈ 0.99
  body: { dx: 0.00, dy: 0.01, dw: 1.00, dh: 0.99 },
  // 머리 - shami_head.png (978x945, aspect 1.035) - 최상단 레이어
  //   박스 상단 오른쪽(캐릭터 앞쪽)에 배치. dw/dh = 1.035 × 130/174 ≈ 0.773
  head: { dx: 0.45, dy: 0.00, dw: 0.75, dh: 0.975 },

  // 4개 다리 - leg.png 한 장을 재사용
  // layer: 'back'(몸통 뒤로 → 일부 가려짐) / 'front'(몸통 앞)
  // 캐릭터가 오른쪽을 보고 있으므로, "왼쪽 다리(far side)" = 뒤 레이어
  // phase 위상: 대각선 페어(트로트) - rightFront+leftBack vs leftFront+rightBack
  legs: [
    // 왼쪽(far side) - 뒤 레이어, 약간 작고 어둡게 (원근감)
    // leg.png 비율(0.719) 보존: dw/dh = 0.719 × MOUNT_H/MOUNT_W = 0.719 × 130/174 ≈ 0.537
    { id: 'leftFront',  anchorX: 0.85, anchorY: 0.74, dw: 0.215, dh: 0.40,
      pivotX: 0.50, pivotY: 0.08, phase: Math.PI, scale: 0.88, dim: 0.78, layer: 'back' },
    { id: 'leftBack',   anchorX: 0.40, anchorY: 0.74, dw: 0.215, dh: 0.40,
      pivotX: 0.50, pivotY: 0.08, phase: 0,       scale: 0.88, dim: 0.78, layer: 'back' },
    // 오른쪽(near side) - 앞 레이어, 정상 크기
    { id: 'rightFront', anchorX: 0.52, anchorY: 0.75, dw: 0.242, dh: 0.45,
      pivotX: 0.50, pivotY: 0.08, phase: 0,       scale: 1.00, dim: 1.00, layer: 'front' },
    { id: 'rightBack',  anchorX: 0.19, anchorY: 0.75, dw: 0.242, dh: 0.45,
      pivotX: 0.50, pivotY: 0.08, phase: Math.PI, scale: 1.00, dim: 1.00, layer: 'front' },
  ],
};

// 갤럽 애니메이션 진폭
const MOUNT_GAIT = {
  faceRight:  true,   // 캐릭터가 오른쪽을 보면 true
  swing:      0.25,   // 다리 회전 진폭 (라디안)
  shift:      4,      // 다리 전후 이동 진폭 (픽셀)
  bob:        4,      // 몸통 상하 바운스 진폭 (픽셀)
  tilt:       0.035,  // 몸통 회전 진폭 (라디안)
  cycleSpeed: 0.03,   // 다리 사이클 속도 (스크롤 거리 대비)
};

(() => {
  // ===== 캔버스 =====
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const W = canvas.width;
  const H = canvas.height;

  // ===== 자산 로드 =====
  const images = {};
  for (const [key, path] of Object.entries(ASSET_PATHS)) {
    if (!path) continue;
    const img = new Image();
    img.onload = () => { images[key] = img; };
    img.onerror = () => { console.warn('[샤미라이더] 이미지 로드 실패: ' + path); };
    img.src = path;
  }

  // 스테이지 배경 이미지 로드
  const stageImages = [];
  STAGE_BG_PATHS.forEach((path, i) => {
    const img = new Image();
    img.onload = () => { stageImages[i] = img; };
    img.onerror = () => { console.warn('[샤미라이더] 스테이지 배경 로드 실패: ' + path); };
    img.src = path;
  });

  // ===== 상수 =====
  const GROUND_Y = 680;
  const PLAYER_X = 360;
  const GRAVITY = 0.6;
  const JUMP_VY = -17;
  const DOUBLE_JUMP_VY = -14;
  // 캐릭터 크기 - 원본 이미지 비율 유지
  //   shami_body.png 1365x1013 (aspect 1.348) → 131x98  (이전 174x130에서 75% 축소)
  //   ohana.png       720x1115 (aspect 0.646) →  85x131
  const MOUNT_W = 131, MOUNT_H = 98;
  const RIDER_W =  85, RIDER_H = 131;
  const ACCEL = 0.06;
  const HUNGER_REFILL = 25;
  // TARGET_SPEED, HUNGER_RATE는 STAGE_DIFFICULTY에서 동적으로 가져옴 (stageDiff() 참조)

  function stageDiff() {
    return STAGE_DIFFICULTY[world.currentStage] || STAGE_DIFFICULTY[0];
  }

  // 탑승 시 인물 충돌 박스 높이 (앉은 자세에 맞춰 RIDER_H보다 작게)
  //   = 박스 윗면이 mount.y - 이 값 위치가 됨
  //   RIDER_MOUNTED(h=140, overlap=70) 기준 시각상 캐릭터 머리 위치(약 mount.y - 65)와 정렬
  //   이 값이 너무 크면(예: 100) 머리 위 빈 공간에서도 충돌이 트리거되는 헛 충돌 발생
  const RIDER_MOUNTED_COL_H = 65;

  // 보스 (스테이지 4 전용) - 원본 790x701 (aspect 1.127) → 140x124 유지
  const BOSS_W = 140;
  const BOSS_H = 124;
  const BOSS_SPAWN_INTERVAL_MIN = 3.2;  // 스폰 간격 (초)
  const BOSS_SPAWN_INTERVAL_MAX = 5.5;
  const BOSS_HITBOX_MARGIN = 22;        // 히트박스 내부 여백 (덜 짜증나게)
  const bosses = [];
  let bossSpawnTimer = 0;
  let nextBossSpawn = BOSS_SPAWN_INTERVAL_MIN;

  // ===== 월드 상태 =====
  const world = {
    scrollX: 0, speed: 0, state: 'title',   // 초기 상태: 타이틀
    playerName: '',                          // 입력받은 이름
    playStartTime: 0,                        // 클라이언트 측 게임 시작 시각 (로컬 통계용)
    serverSessionId: null,                   // 서버 세션 ID (점수 제출 시 필수)
    invulnTimer: 0,
    crashTimer: 0, shakeAmount: 0,
    hunger: 100, score: 0, distance: 0,
    bgOffset: 0, gameOverReason: '',
    // 스테이지 / 페이드
    currentStage: 0,
    stageStartScroll: 0,          // 현재 스테이지가 시작된 world.scrollX
    fadeState: 'none',            // 'none' | 'out' | 'in'
    fadeAlpha: 0,                 // 0(투명) ~ 1(완전 검정)
    fadeTimer: 0,
  };

  // ===== 플레이어 =====
  const mount = { y: GROUND_Y - MOUNT_H, vy: 0, onSurface: 'ground', prevY: 0 };
  const rider = { y: GROUND_Y - MOUNT_H - RIDER_H, vy: 0, onSurface: null, prevY: 0 };
  let mounted = true;
  let jumpsUsed = 0;

  // ===== 월드 오브젝트 =====
  const segments = [];
  const platforms = [];
  const foods = [];
  const particles = [];
  let nextGroundX = -200;
  let nextPlatformX = 1200;
  let nextFoodX = 800;

  segments.push({ x: -200, w: 2400 });
  nextGroundX = -200 + 2400;

  // ===== 타이틀 오버레이 / 이름 입력 =====
  const titleOverlay = document.getElementById('titleOverlay');
  const nameInput = document.getElementById('nameInput');
  const startBtn = document.getElementById('startBtn');

  // ===== BGM 관리 (타이틀 / 게임) =====
  const bgmTitle = document.getElementById('bgm');
  const bgmGame  = document.getElementById('gameBgm');
  if (bgmTitle) bgmTitle.volume = 0.45;
  if (bgmGame)  bgmGame.volume  = 0.40;
  let currentBgm = null; // 'title' | 'game' | null

  function stopBgmAudio(audio) {
    if (!audio) return;
    audio.pause();
    try { audio.currentTime = 0; } catch (e) {}
  }
  function playMusic(kind) {
    if (currentBgm === kind) {
      // 같은 트랙 재진입: 이미 재생 중이면 그대로 두고, 일시정지 상태면 재개만
      const a = kind === 'title' ? bgmTitle : (kind === 'game' ? bgmGame : null);
      if (a && a.paused) a.play().catch(() => {});
      return;
    }
    currentBgm = kind;
    if (kind !== 'title') stopBgmAudio(bgmTitle);
    if (kind !== 'game')  stopBgmAudio(bgmGame);
    if (kind === 'title' && bgmTitle) bgmTitle.play().catch(() => {});
    if (kind === 'game'  && bgmGame)  bgmGame.play().catch(() => {});
  }
  function stopAllMusic() {
    currentBgm = null;
    stopBgmAudio(bgmTitle);
    stopBgmAudio(bgmGame);
  }
  // 자동재생 차단 대비: 첫 사용자 상호작용 시 한 번만 재시도하고 리스너 제거
  let bgmUnlocked = false;
  function tryUnlockBgm() {
    if (bgmUnlocked) return;
    const a = currentBgm === 'title' ? bgmTitle
            : currentBgm === 'game'  ? bgmGame
            : null;
    if (a && a.paused) {
      a.play().then(() => {
        bgmUnlocked = true;
        window.removeEventListener('click', tryUnlockBgm);
        window.removeEventListener('keydown', tryUnlockBgm);
        window.removeEventListener('touchstart', tryUnlockBgm);
      }).catch(() => {});
    } else if (a && !a.paused) {
      bgmUnlocked = true;
      window.removeEventListener('click', tryUnlockBgm);
      window.removeEventListener('keydown', tryUnlockBgm);
      window.removeEventListener('touchstart', tryUnlockBgm);
    }
  }
  window.addEventListener('click', tryUnlockBgm);
  window.addEventListener('keydown', tryUnlockBgm);
  window.addEventListener('touchstart', tryUnlockBgm);

  // ===== SFX (Web Audio API로 즉석 생성) =====
  let audioCtx = null;
  function getAudioCtx() {
    if (!audioCtx) {
      try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); }
      catch (e) { return null; }
    }
    if (audioCtx.state === 'suspended') {
      audioCtx.resume().catch(() => {});
    }
    return audioCtx;
  }
  // 간단한 톤 재생 (주파수 슬라이드 지원)
  function playTone(opt) {
    const ctx = getAudioCtx();
    if (!ctx) return;
    const {
      freq = 440, freqEnd = null, duration = 0.15,
      type = 'sine', volume = 0.22, delay = 0
    } = opt;
    const t0 = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (freqEnd != null && freqEnd > 0) {
      osc.frequency.exponentialRampToValueAtTime(freqEnd, t0 + duration);
    }
    gain.gain.setValueAtTime(volume, t0);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
    osc.connect(gain); gain.connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + duration + 0.02);
  }
  // 노이즈 버스트 (충돌용)
  function playNoise(opt) {
    const ctx = getAudioCtx();
    if (!ctx) return;
    const { duration = 0.3, volume = 0.3, cutoff = 800 } = opt || {};
    const bufSize = Math.floor(ctx.sampleRate * duration);
    const buffer = ctx.createBuffer(1, bufSize, ctx.sampleRate);
    const out = buffer.getChannelData(0);
    for (let i = 0; i < bufSize; i++) out[i] = (Math.random()*2 - 1) * (1 - i/bufSize);
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = cutoff;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(volume, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);
    noise.connect(filter); filter.connect(gain); gain.connect(ctx.destination);
    noise.start();
    noise.stop(ctx.currentTime + duration);
  }
  // 효과음 묶음
  const sfx = {
    jump:   () => playTone({ freq: 440, freqEnd: 720, duration: 0.16, type: 'square', volume: 0.18 }),
    djump:  () => {
      playTone({ freq: 660, freqEnd: 980, duration: 0.14, type: 'square', volume: 0.20 });
      playTone({ freq: 1320, duration: 0.08, type: 'triangle', volume: 0.10, delay: 0.04 });
    },
    food:   () => {
      playTone({ freq: 880,  duration: 0.10, type: 'sine', volume: 0.22 });
      playTone({ freq: 1320, duration: 0.16, type: 'sine', volume: 0.18, delay: 0.07 });
    },
    crash:  () => {
      // 임팩트 강화: 광역 노이즈 + 저음 슬라이드 + 중음 띠 + 짧은 초고음 클릭
      playNoise({ duration: 0.45, volume: 0.55, cutoff: 1400 });
      playTone({ freq: 180, freqEnd: 45,  duration: 0.45, type: 'sawtooth', volume: 0.32 });
      playTone({ freq: 380, freqEnd: 110, duration: 0.25, type: 'square',   volume: 0.22, delay: 0.02 });
      playTone({ freq: 1600,              duration: 0.05, type: 'square',   volume: 0.18 });
    },
    over:   () => {
      playTone({ freq: 440, freqEnd: 180, duration: 0.5, type: 'sine',     volume: 0.25 });
      playTone({ freq: 220, freqEnd: 90,  duration: 0.7, type: 'triangle', volume: 0.22, delay: 0.35 });
    },
    clear:  () => {
      const notes = [523, 659, 784, 1047];   // C5 E5 G5 C6
      notes.forEach((f, i) => playTone({ freq: f, duration: 0.22, type: 'square', volume: 0.22, delay: i * 0.12 }));
    },
  };

  // 이전 세션의 이름 자동 복원
  try {
    const savedName = localStorage.getItem('shamiRiderLastName');
    if (savedName) nameInput.value = savedName;
  } catch (e) {}

  function showTitleOverlay() {
    titleOverlay.classList.add('show');
    setTimeout(() => nameInput.focus(), 30);
    playMusic('title');
    hideHungerGauge();
  }
  function hideTitleOverlay() {
    titleOverlay.classList.remove('show');
    nameInput.blur();
  }

  // ===== 게임오버/승리 - 다시하기 버튼 =====
  const gameOverOverlay = document.getElementById('gameOverOverlay');
  const restartBtn = document.getElementById('restartBtn');
  function showGameOverOverlay() {
    if (gameOverOverlay) gameOverOverlay.classList.add('show');
  }
  function hideGameOverOverlay() {
    if (gameOverOverlay) gameOverOverlay.classList.remove('show');
  }

  // 배고픔 게이지 표시/숨김 (타이틀/게임오버 화면에서는 숨김)
  const hungerWrap = document.getElementById('hungerWrap');
  function showHungerGauge() { if (hungerWrap) hungerWrap.style.display = ''; }
  function hideHungerGauge() { if (hungerWrap) hungerWrap.style.display = 'none'; }
  if (restartBtn) {
    restartBtn.addEventListener('click', () => {
      hideGameOverOverlay();
      restart();
      world.state = 'title';
      showTitleOverlay();
    });
  }

  function startGame() {
    const raw = (nameInput.value || '').trim();
    const name = raw.slice(0, 12) || 'PLAYER';
    world.playerName = name;
    try { localStorage.setItem('shamiRiderLastName', name); } catch (e) {}
    hideTitleOverlay();
    hideGameOverOverlay();
    restart();
    world.state = 'running';
    world.playStartTime = Date.now();
    world.serverSessionId = null;     // 새 세션 전엔 null
    playMusic('game');  // 게임 BGM 시작
    showHungerGauge();  // 게임 진입 시 배고픔 게이지 표시
    // 게임 시작 시점에 AudioContext 미리 활성화 → 첫 SFX(점프/충돌)가 묻히는 현상 방지
    getAudioCtx();
    // 서버 세션 시작 (비동기 - 게임은 즉시 시작되고 세션은 백그라운드로 발급)
    if (hasFirebase() && window.firebaseRanking.startSession) {
      window.firebaseRanking.startSession()
        .then(sid => { world.serverSessionId = sid; })
        .catch(e => { console.warn('[Session] 시작 실패:', e?.message || e); });
    }
  }
  startBtn.addEventListener('click', startGame);
  nameInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); startGame(); }
  });

  // ===== 랭킹 시스템 (Firebase + localStorage 폴백) =====
  const RANKING_KEY = 'shamiRiderRanking';
  const RANKING_MAX = 10;

  // 로컬(localStorage) 백업용
  function loadRankingLocal() {
    try {
      const raw = localStorage.getItem(RANKING_KEY);
      const arr = raw ? JSON.parse(raw) : [];
      return Array.isArray(arr) ? arr : [];
    } catch (e) { return []; }
  }
  function saveRankingLocal(arr) {
    try { localStorage.setItem(RANKING_KEY, JSON.stringify(arr)); } catch (e) {}
  }
  function addToLocalRanking(entry) {
    const list = loadRankingLocal();
    list.push(entry);
    list.sort((a, b) => b.score - a.score);
    if (list.length > RANKING_MAX) list.length = RANKING_MAX;
    saveRankingLocal(list);
    return list.indexOf(entry);
  }

  // 매 프레임 동기 접근 가능한 캐시 (drawRankingPanel에서 사용)
  let cachedRanking = loadRankingLocal();
  let lastRankIndex = -1; // 최근 점수의 랭킹 위치 (강조 표시용)
  let lastSubmittedEntry = null; // 본인 점수 식별용

  // Firebase 가용성 체크
  function hasFirebase() {
    return typeof window !== 'undefined' && !!window.firebaseRanking;
  }

  // 원격(또는 로컬) 랭킹을 캐시에 갱신
  async function refreshRanking() {
    if (hasFirebase()) {
      try {
        const remote = await window.firebaseRanking.load(RANKING_MAX);
        cachedRanking = Array.isArray(remote) ? remote : [];
        // 본인 점수가 있다면 인덱스 갱신
        if (lastSubmittedEntry) {
          lastRankIndex = cachedRanking.findIndex(
            (e) => e.name === lastSubmittedEntry.name
                && e.score === lastSubmittedEntry.score
                && e.date === lastSubmittedEntry.date
          );
        }
        return;
      } catch (e) {
        console.warn('[Firebase] 랭킹 로드 실패, 로컬 사용:', e);
      }
    }
    cachedRanking = loadRankingLocal();
  }

  // 점수 등록 (로컬 백업 + Firebase 비동기 - Cloud Function 경유)
  // 서버는 startSession에서 받은 sessionId의 startTime을 기준으로 playTime을 직접 계산
  // → 클라이언트가 playTime을 위조할 수 없음
  function submitRanking(name, score, distance, cleared) {
    const entry = {
      name: (name || 'PLAYER').slice(0, 12),
      score: Math.floor(score),
      distance: Math.floor(distance),
      cleared: !!cleared,
      date: Date.now(),
    };
    lastSubmittedEntry = entry;
    // 1) 로컬에 즉시 등록 (서버 검증 실패 시에도 본인 화면엔 점수 보임)
    const localIdx = addToLocalRanking(entry);
    cachedRanking = loadRankingLocal();
    lastRankIndex = localIdx;
    // 2) Cloud Function 호출 → 서버 검증 → 통과 시 DB 저장
    if (hasFirebase()) {
      const sid = world.serverSessionId;
      if (!sid) {
        console.warn('[Firebase] 서버 세션 없음, 원격 등록 건너뜀');
        return localIdx;
      }
      window.firebaseRanking.submit(entry, sid)
        .then(() => {
          world.serverSessionId = null;   // 세션은 1회용
          refreshRanking();
        })
        .catch((e) => {
          console.warn('[Firebase] 랭킹 등록 거부 또는 실패:', e?.message || e);
        });
    }
    return localIdx;
  }

  function triggerGameOver(reason, imageKey) {
    if (world.state === 'gameover' || world.state === 'victory') return;
    world.state = 'gameover';
    world.gameOverReason = reason || '';
    world.gameOverImageKey = imageKey || 'gameOverHole';
    lastRankIndex = submitRanking(world.playerName, world.score, world.distance, false);
    showGameOverOverlay();
    hideHungerGauge();
    stopAllMusic();
    sfx.over();
  }
  function triggerVictory() {
    if (world.state === 'gameover' || world.state === 'victory') return;
    world.state = 'victory';
    lastRankIndex = submitRanking(world.playerName, world.score, world.distance, true);
    showGameOverOverlay();
    hideHungerGauge();
    stopAllMusic();
    sfx.clear();
  }

  // 치트: 지정 스테이지로 즉시 점프
  function jumpToStage(idx) {
    if (idx < 0 || idx >= STAGE_BG_PATHS.length) return;
    world.currentStage = idx;
    world.stageStartScroll = world.scrollX;
    world.fadeState = 'none';
    world.fadeAlpha = 0;
    world.fadeTimer = 0;
    bosses.length = 0;
    bossSpawnTimer = 0;
    nextBossSpawn = BOSS_SPAWN_INTERVAL_MIN;
  }

  // ===== 유틸 =====
  function rand(a, b) { return a + Math.random() * (b - a); }
  function randInt(a, b) { return Math.floor(rand(a, b + 1)); }
  function playerWorldX() { return world.scrollX + PLAYER_X; }
  function groundExistsAt(wx) {
    for (const s of segments) if (wx >= s.x && wx <= s.x + s.w) return true;
    return false;
  }
  function nextGroundFrom(wx) {
    let best = null;
    for (const s of segments) {
      if (wx >= s.x && wx <= s.x + s.w) return wx;
      if (s.x > wx && (best === null || s.x < best)) best = s.x;
    }
    return best;
  }

  // ===== 입력 =====
  window.addEventListener('keydown', (e) => {
    // 이름 입력 필드에 포커스가 있을 때는 게임 단축키 완전 무시
    if (document.activeElement === nameInput) return;
    if (e.code === 'Space') e.preventDefault();
    if (e.repeat) return;
    if (world.state === 'title') return;

    // R = 어느 상태에서든 재시작
    if (e.code === 'KeyR') {
      hideGameOverOverlay();
      restart();
      world.state = 'running';
      world.playStartTime = Date.now();
      world.serverSessionId = null;
      playMusic('game');
      showHungerGauge();
      // 새 서버 세션 발급
      if (hasFirebase() && window.firebaseRanking.startSession) {
        window.firebaseRanking.startSession()
          .then(sid => { world.serverSessionId = sid; })
          .catch(e => { console.warn('[Session] 시작 실패:', e?.message || e); });
      }
      return;
    }
    // T = 타이틀로 돌아가기
    if (e.code === 'KeyT') {
      hideGameOverOverlay();
      restart();
      world.state = 'title';
      showTitleOverlay();
      return;
    }

    // 게임오버/승리 화면에선 다른 키 무시
    if (world.state === 'gameover' || world.state === 'victory') return;
    if (world.state !== 'running') return;

    // 치트: 1/2/3/4 = 스테이지 1/2/3/4로 즉시 점프
    if (e.code === 'Digit1') { jumpToStage(0); return; }
    if (e.code === 'Digit2') { jumpToStage(1); return; }
    if (e.code === 'Digit3') { jumpToStage(2); return; }
    if (e.code === 'Digit4') { jumpToStage(3); return; }
    // 치트: 0 = 즉시 클리어(승리 화면)
    if (e.code === 'Digit0') { triggerVictory(); return; }

    if (e.code === 'Space') tryJump();
  });

  function tryJump() {
    if (mounted) {
      if (jumpsUsed === 0 && mount.onSurface) {
        mount.vy = JUMP_VY;
        mount.onSurface = null;
        jumpsUsed = 1;
        spawnDust(PLAYER_X, mount.y + MOUNT_H, 8);
        sfx.jump();
      } else if (jumpsUsed === 1) {
        // 2단 점프 - 인물 분리
        mounted = false;
        rider.vy = DOUBLE_JUMP_VY;
        rider.onSurface = null;
        jumpsUsed = 2;
        for (let i = 0; i < 10; i++) spawnDust(PLAYER_X, rider.y + RIDER_H/2, 4, '#fff');
        sfx.djump();
      }
    } else {
      // 분리 상태: 인물이 표면(플랫폼/지면) 위에 있을 때만 점프
      if (rider.onSurface) {
        rider.vy = JUMP_VY;
        rider.onSurface = null;
        for (let i = 0; i < 6; i++) spawnDust(PLAYER_X, rider.y + RIDER_H, 1, '#fff');
        sfx.jump();
      }
    }
  }

  // ===== 월드 생성 =====
  function makePlatform(x, y, w) {
    const sd = stageDiff();
    // 이동 블록: 스테이지 2(인덱스 1)부터만 등장
    const moveChance = world.currentStage >= 1 ? sd.moveChance : 0;
    let motion = null;
    if (world.distance > 80 && Math.random() < moveChance) {
      const isVertical = Math.random() < 0.55;
      if (isVertical) {
        motion = {
          type: 'vertical',
          amp: randInt(60, 110),
          speed: rand(0.8, 1.6),
          phase: rand(0, Math.PI * 2),
        };
      } else {
        motion = {
          type: 'horizontal',
          amp: randInt(80, 180),
          speed: rand(0.5, 1.1),
          phase: rand(0, Math.PI * 2),
        };
      }
    }
    return {
      x, y, w, h: 32,
      baseX: x, baseY: y,
      motion, t: 0,
    };
  }

  function generateWorld() {
    const sd = stageDiff();
    while (nextGroundX - world.scrollX < W + 700) {
      const wantHole = Math.random() < sd.holeProb;
      if (wantHole && world.distance > 50) {
        nextGroundX += randInt(sd.holeRange[0], sd.holeRange[1]);
      }
      const len = randInt(sd.groundLen[0], sd.groundLen[1]);
      segments.push({ x: nextGroundX, w: len });
      nextGroundX += len;
    }
    while (nextPlatformX - world.scrollX < W + 600) {
      // 다양한 높이의 블록 (200~660 범위에서 40px 간격)
      // 200~360: 점프해서 올라타야 닿는 위쪽 (안전 통과 가능)
      // 400~540: 인물 머리/탈것이 부딪힐 수 있는 중단
      // 580~660: 탈것이 충돌하는 낮음
      const heights = [200, 240, 280, 320, 360, 400, 440, 480, 520, 560, 600, 640];
      const y = heights[randInt(0, heights.length - 1)];
      const w = randInt(sd.platLen[0], sd.platLen[1]);
      const x = nextPlatformX;
      platforms.push(makePlatform(x, y, w));
      // 30% 확률로 한 단 위에 추가 블록 (계단식)
      if (Math.random() < 0.3) {
        const y2 = y - randInt(110, 180);
        const x2 = x + w + randInt(60, 160);
        if (y2 > 160) platforms.push(makePlatform(x2, y2, randInt(160, 320)));
      }
      nextPlatformX = x + w + randInt(sd.platGap[0], sd.platGap[1]);
    }
    // 음식 사이 최소 간격 (px) - 너무 가까이 겹치거나 줄줄이 등장하지 않도록
    const FOOD_MIN_GAP = 480;
    while (nextFoodX - world.scrollX < W + 500) {
      let fx = nextFoodX, fy = GROUND_Y - 70;
      let placedOnPlat = false;
      // 플랫폼 위 배치 확률을 35%로 낮춤
      if (Math.random() < 0.35) {
        const p = platforms.find(p =>
          !p.motion && p.baseX > nextFoodX && p.baseX + p.w > nextFoodX + 70
        );
        if (p) { fx = p.baseX + p.w/2 - 28; fy = p.baseY - 70; placedOnPlat = true; }
      }
      if (!placedOnPlat) {
        fy = Math.random() < 0.5 ? GROUND_Y - 70 : rand(260, 480);
      }
      // 직전 음식과 거리 검사 (최소 간격 미만이면 스킵)
      const lastFood = foods[foods.length - 1];
      const tooClose = lastFood && Math.abs(lastFood.x - fx) < FOOD_MIN_GAP;
      if (!tooClose && (groundExistsAt(fx + 28) || placedOnPlat)) {
        foods.push({ x: fx, y: fy, w: 56, h: 56, collected: false, bob: Math.random() * Math.PI * 2 });
      }
      // 다음 스폰 위치는 충분히 멀리 (이전 280~560 → 600~1100)
      nextFoodX = Math.max(nextFoodX, fx) + randInt(600, 1100);
    }
  }

  // ===== 보스 =====
  function spawnBoss() {
    const baseY = rand(180, 480);
    const b = {
      x: W + BOSS_W,
      baseY,
      y: baseY,
      vx: -(3.0 + Math.random() * 1.8),       // 좌측으로 이동
      bobAmp: rand(90, 160),                  // 포물선 진폭
      bobSpeed: rand(1.2, 2.2),               // 포물선 주기
      phase: rand(0, Math.PI * 2),
    };
    b.y = b.baseY + Math.sin(b.phase) * b.bobAmp;
    bosses.push(b);
  }

  function isBossStage() {
    return world.currentStage === STAGE_BG_PATHS.length - 1;
  }

  function updateBosses(dt) {
    // 마지막 스테이지에서만 스폰
    if (isBossStage() && world.state === 'running' && world.fadeState === 'none') {
      bossSpawnTimer += dt;
      if (bossSpawnTimer >= nextBossSpawn) {
        bossSpawnTimer = 0;
        nextBossSpawn = rand(BOSS_SPAWN_INTERVAL_MIN, BOSS_SPAWN_INTERVAL_MAX);
        spawnBoss();
      }
    } else {
      bossSpawnTimer = 0;
    }
    // 모든 보스 이동
    for (let i = bosses.length - 1; i >= 0; i--) {
      const b = bosses[i];
      b.phase += dt * b.bobSpeed;
      b.x += b.vx;
      b.y = b.baseY + Math.sin(b.phase) * b.bobAmp;
      if (b.x + BOSS_W/2 < -60) bosses.splice(i, 1);
    }
  }

  function checkBossCollision() {
    if (bosses.length === 0) return null;
    // 플레이어 박스 (mount + rider 통합)
    const px = PLAYER_X;
    const m = 14; // 플레이어 히트박스 보정
    const playerLeft = px - MOUNT_W/2 + m;
    const playerRight = px + MOUNT_W/2 - m;
    const playerTop = mounted ? mount.y - RIDER_MOUNTED_COL_H + 8
                              : Math.min(mount.y, rider.y) + 8;
    const playerBottom = mount.y + MOUNT_H - 8;
    for (const b of bosses) {
      const bm = BOSS_HITBOX_MARGIN;
      const bLeft = b.x - BOSS_W/2 + bm;
      const bRight = b.x + BOSS_W/2 - bm;
      const bTop = b.y - BOSS_H/2 + bm;
      const bBottom = b.y + BOSS_H/2 - bm;
      if (playerLeft < bRight && playerRight > bLeft &&
          playerTop < bBottom && playerBottom > bTop) {
        return b;
      }
    }
    return null;
  }

  function drawBosses() {
    for (const b of bosses) {
      if (images.boss) {
        ctx.drawImage(images.boss, b.x - BOSS_W/2, b.y - BOSS_H/2, BOSS_W, BOSS_H);
      } else {
        // 폴백 도형
        ctx.fillStyle = '#3a6a4a';
        ctx.beginPath();
        ctx.ellipse(b.x, b.y, BOSS_W/2, BOSS_H/2, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#a0c8a0';
        ctx.fillRect(b.x - 18, b.y - 8, 36, 16);
      }
    }
  }

  function updatePlatforms(dt) {
    for (const p of platforms) {
      // 이전 위치 저장 (측면 충돌 교차 검사용)
      p.prevX = p.x;
      p.prevY = p.y;
      if (!p.motion) continue;
      p.t += dt;
      const ph = p.t * p.motion.speed + p.motion.phase;
      if (p.motion.type === 'vertical') {
        p.y = p.baseY + Math.sin(ph) * p.motion.amp;
      } else {
        p.x = p.baseX + Math.sin(ph) * p.motion.amp;
      }
    }
  }

  function cleanupBehind() {
    const cutoff = world.scrollX - 300;
    while (segments.length && segments[0].x + segments[0].w < cutoff) segments.shift();
    while (platforms.length) {
      const p = platforms[0];
      const farRight = (p.baseX != null ? p.baseX : p.x) + p.w + (p.motion ? p.motion.amp : 0);
      if (farRight < cutoff) platforms.shift();
      else break;
    }
    while (foods.length && foods[0].x + foods[0].w < cutoff) foods.shift();
  }

  // ===== 충돌 =====
  function checkLanding(body, h) {
    if (body.vy < 0) return null;
    const wx = playerWorldX();
    const prevBottom = body.prevY + h;
    const curBottom = body.y + h;
    let bestY = null, bestSurface = null;
    for (const p of platforms) {
      if (wx < p.x || wx > p.x + p.w) continue;
      if (p.y >= prevBottom - 1 && p.y <= curBottom + 0.5) {
        if (bestY === null || p.y < bestY) { bestY = p.y; bestSurface = p; }
      }
    }
    if (groundExistsAt(wx)) {
      if (GROUND_Y >= prevBottom - 1 && GROUND_Y <= curBottom + 0.5) {
        if (bestY === null || GROUND_Y < bestY) { bestY = GROUND_Y; bestSurface = 'ground'; }
      }
    }
    return bestSurface ? { y: bestY, surface: bestSurface } : null;
  }

  function stillOnSurface(body) {
    const wx = playerWorldX();
    if (body.onSurface === 'ground') return groundExistsAt(wx);
    if (body.onSurface && typeof body.onSurface === 'object') {
      const p = body.onSurface;
      return wx >= p.x && wx <= p.x + p.w;
    }
    return false;
  }

  function checkSideCollisionFor(bodyY, bodyW, bodyH) {
    const wxPrev = (world.scrollX - world.speed) + PLAYER_X;
    const wxCur = world.scrollX + PLAYER_X;
    const bodyTop = bodyY;
    const bodyBottom = bodyY + bodyH;
    const half = bodyW / 2;
    for (const p of platforms) {
      const pLeftPrev = p.prevX != null ? p.prevX : p.x;
      const pLeftCur = p.x;
      const frontPrev = wxPrev + half;
      const frontCur = wxCur + half;
      if (frontPrev < pLeftPrev && frontCur >= pLeftCur) {
        if (bodyBottom > p.y + 8 && bodyTop < p.y + p.h) return p;
      }
    }
    return null;
  }

  function updateBodyPhysics(body, h) {
    body.prevY = body.y;
    if (body.onSurface) {
      if (!stillOnSurface(body)) {
        body.onSurface = null;
        body.vy = 0;
      } else {
        if (body.onSurface === 'ground') body.y = GROUND_Y - h;
        else body.y = body.onSurface.y - h;
        body.vy = 0;
        return;
      }
    }
    body.vy += GRAVITY;
    if (body.vy > 14) body.vy = 14;
    body.y += body.vy;
    const land = checkLanding(body, h);
    if (land) {
      body.y = land.y - h;
      body.vy = 0;
      body.onSurface = land.surface;
    }
  }

  // ===== 파티클 =====
  function spawnDust(x, y, n = 5, color = '#d8c2a0') {
    for (let i = 0; i < n; i++) {
      particles.push({
        x, y,
        vx: rand(-2, -0.5) - world.speed * 0.2,
        vy: rand(-2, -0.2),
        life: 1, color, size: rand(2, 4),
      });
    }
  }
  function updateParticles(dt) {
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.x += p.vx; p.y += p.vy; p.vy += 0.15;
      p.life -= dt * 1.5;
      if (p.life <= 0) particles.splice(i, 1);
    }
  }

  // ===== 충돌 처리 =====
  // amount: 변화량 (양수 = 회복 표시, 음수 = 감소 표시)
  // 기본 동작은 감소(crash 호환)
  function flashHungerBar(amount) {
    const bar = document.getElementById('hungerBar');
    const wrap = document.getElementById('hungerWrap');
    const float = document.getElementById('floatLoss');
    const isGain = amount != null && amount > 0;
    // 소수점이 들어와도 정수로 표시
    const display = Math.round(amount != null ? Math.abs(amount) : 10);
    if (bar) {
      const cls = isGain ? 'heal' : 'hit';
      bar.classList.remove('hit', 'heal');
      void bar.offsetWidth;
      bar.classList.add(cls);
    }
    if (wrap) {
      const cls = isGain ? 'heal' : 'hit';
      wrap.classList.remove('hit', 'heal');
      void wrap.offsetWidth;
      wrap.classList.add(cls);
    }
    if (float) {
      const el = document.createElement('div');
      el.className = isGain ? 'gain' : 'loss';
      el.textContent = (isGain ? '+' : '-') + display;
      float.appendChild(el);
      setTimeout(() => el.remove(), 800);
    }
  }

  // 스테이지 전환 시작 (페이드아웃 → 다음 스테이지로 → 페이드인)
  function startStageTransition() {
    world.fadeState = 'out';
    world.fadeTimer = 0;
  }

  function updateStageFade(dt) {
    if (world.fadeState === 'out') {
      world.fadeTimer += dt;
      world.fadeAlpha = Math.min(1, world.fadeTimer / STAGE_FADE_DURATION);
      if (world.fadeAlpha >= 1) {
        // 다음 스테이지로 (마지막 → 처음 순환)
        world.currentStage = (world.currentStage + 1) % STAGE_BG_PATHS.length;
        world.stageStartScroll = world.scrollX;
        world.fadeState = 'in';
        world.fadeTimer = 0;
      }
    } else if (world.fadeState === 'in') {
      world.fadeTimer += dt;
      world.fadeAlpha = Math.max(0, 1 - world.fadeTimer / STAGE_FADE_DURATION);
      if (world.fadeAlpha <= 0) {
        world.fadeState = 'none';
        world.fadeAlpha = 0;
      }
    }
  }

  function checkStageEnd() {
    if (world.fadeState !== 'none') return; // 이미 전환 중
    if (world.scrollX - world.stageStartScroll >= STAGE_LENGTH_WORLD) {
      // 마지막 스테이지를 다 클리어 → 승리
      if (world.currentStage >= STAGE_BG_PATHS.length - 1) {
        triggerVictory();
        return;
      }
      startStageTransition();
    }
  }

  // hit: 충돌 대상 (플랫폼 객체 또는 null)
  // hungerPenalty: 배고픔 감소량 (기본 20, 보스는 50 전달)
  function handleCrash(hit, hungerPenalty) {
    if (hungerPenalty == null) hungerPenalty = 20;
    // CRASH 상태 진입: 스크롤 정지 + 흔들림 + CRASH! 표시
    world.state = 'crashing';
    world.crashTimer = 0.9;        // CRASH 상태 지속 시간 (초)
    world.shakeAmount = 14;        // 캐릭터 흔들림 진폭 (시간 따라 감쇠)
    world.speed = 0;               // 스크롤 즉시 정지
    sfx.crash();                   // 충돌 효과음

    // 배고픔 차감 + 시각 효과 (게이지 width와 펄스/플로팅을 동시에 표시)
    world.hunger = Math.max(0, world.hunger - hungerPenalty);
    flashHungerBar(-hungerPenalty);   // 음수 전달 = 감소 연출(빨강)
    updateHUD();   // crashing 상태에선 update()의 끝 갱신이 안 돌아가므로 즉시 갱신
    if (world.hunger <= 0) {
      triggerGameOver('배고픔으로 쓰러졌다…', 'gameOverHunger');
      return;
    }

    // 충돌 먼지/파편 (보스 충돌은 더 화려하게)
    const burstCount = hungerPenalty >= 50 ? 26 : 14;
    for (let i = 0; i < burstCount; i++) spawnDust(PLAYER_X, mount.y + MOUNT_H/2, 1, '#ff8a4a');
  }

  // ===== 메인 업데이트 =====
  function update(dt) {
    if (world.state === 'title') return;
    if (world.state === 'gameover' || world.state === 'victory') return;
    updateParticles(dt);

    // 스테이지 페이드 (페이드 중에도 게임은 계속 흐름)
    if (world.fadeState !== 'none') updateStageFade(dt);

    // ===== CRASH 상태: 스크롤 정지 + 흔들림 감쇠 + 캐릭터 지면으로 추락 =====
    if (world.state === 'crashing') {
      world.crashTimer -= dt;
      world.shakeAmount = Math.max(0, world.shakeAmount - dt * 16);

      // 캐릭터 자연 낙하 (지면 위까지)
      mount.vy += GRAVITY;
      mount.y += mount.vy;
      if (mount.y + MOUNT_H >= GROUND_Y) {
        mount.y = GROUND_Y - MOUNT_H;
        mount.vy = 0;
        mount.onSurface = 'ground';
      } else {
        mount.onSurface = null;
      }
      if (mounted) {
        rider.y = mount.y - RIDER_H;
        rider.vy = mount.vy;
      } else {
        rider.vy += GRAVITY;
        rider.y += rider.vy;
        if (rider.y + RIDER_H >= GROUND_Y) {
          rider.y = GROUND_Y - RIDER_H;
          rider.vy = 0;
        }
      }

      // 타이머 종료 → 다시 출발
      if (world.crashTimer <= 0) {
        // 캐릭터를 지면 위에 정착, 재탑승
        mount.y = GROUND_Y - MOUNT_H;
        mount.vy = 0;
        mount.onSurface = 'ground';
        mounted = true;
        jumpsUsed = 0;
        rider.y = mount.y - RIDER_H;
        rider.vy = 0;
        rider.onSurface = 'ground';
        world.shakeAmount = 0;
        world.state = 'running';
        // 충돌 지점을 자연스럽게 빠져나갈 시간 (가속 + 통과)
        world.invulnTimer = 1.2;
        // world.speed는 0으로 유지 → ACCEL로 다시 가속
      }
      return;
    }

    if (world.invulnTimer > 0) world.invulnTimer -= dt;

    const sd = stageDiff();

    // 배고픔 (스테이지별)
    world.hunger -= sd.hungerRate * dt;
    if (world.hunger <= 0) {
      world.hunger = 0;
      triggerGameOver('배고픔으로 쓰러졌다…', 'gameOverHunger');
      return;
    }

    // 가속 (목표 속도는 스테이지별)
    if (world.speed < sd.targetSpeed) {
      world.speed = Math.min(sd.targetSpeed, world.speed + ACCEL);
    } else if (world.speed > sd.targetSpeed) {
      // 새 스테이지의 목표 속도가 더 낮으면 부드럽게 감속
      world.speed = Math.max(sd.targetSpeed, world.speed - ACCEL * 0.5);
    }

    world.scrollX += world.speed;
    world.distance = world.scrollX / 30;
    world.score += world.speed * 0.05;
    world.bgOffset = (world.bgOffset + world.speed * 0.3) % 1000;

    // 스테이지 끝 도달 시 다음 스테이지로 전환 시작
    checkStageEnd();

    generateWorld();
    cleanupBehind();
    updatePlatforms(dt);
    updateBosses(dt);

    // 보스 충돌 → 일반 충돌(CRASH) 처리 + 배고픔 -50 (블록 충돌의 2.5배)
    if (world.invulnTimer <= 0 && checkBossCollision()) {
      handleCrash(null, 50);
      return;
    }

    // 측면 충돌 - 탑승/분리 상관없이 탈것과 인물 모두 검사
    //   탑승 시 인물 충돌 박스는 앉은 자세에 맞춰 줄임 (시각적 머리 위치와 정렬)
    if (world.invulnTimer <= 0) {
      const rColH = mounted ? RIDER_MOUNTED_COL_H : RIDER_H;
      const rColTop = mounted ? mount.y - rColH : rider.y;
      const hit = checkSideCollisionFor(mount.y, MOUNT_W, MOUNT_H)
               || checkSideCollisionFor(rColTop, RIDER_W, rColH);
      if (hit) {
        handleCrash(hit);
        return;
      }
    }

    // 물리
    if (mounted) {
      updateBodyPhysics(mount, MOUNT_H);
      rider.y = mount.y - RIDER_H;
      rider.vy = mount.vy;
      rider.onSurface = mount.onSurface;
      if (mount.onSurface) jumpsUsed = 0;
    } else {
      updateBodyPhysics(mount, MOUNT_H);
      updateBodyPhysics(rider, RIDER_H);
      // 재탑승
      if (rider.vy >= 0) {
        const riderBottom = rider.y + RIDER_H;
        const close = riderBottom >= mount.y - 2 && riderBottom <= mount.y + 12;
        const above = rider.y < mount.y;
        if (close && above) {
          mounted = true;
          rider.y = mount.y - RIDER_H;
          rider.vy = mount.vy;
          rider.onSurface = mount.onSurface;
          jumpsUsed = mount.onSurface ? 0 : 1;
          for (let i = 0; i < 8; i++) spawnDust(PLAYER_X, mount.y, 1, '#ffcb6b');
        }
      }
    }

    // 추락(게임오버)
    if (mount.y > H + 30) {
      triggerGameOver('구멍으로 추락했다…', 'gameOverHole');
      return;
    }
    if (!mounted && rider.y > H + 30) {
      triggerGameOver('라이더를 잃어버렸다…', 'gameOverHole');
      return;
    }

    // 음식 획득
    const pwx = playerWorldX();
    for (const f of foods) {
      if (f.collected) continue;
      const fc = f.x + f.w/2;
      if (Math.abs(pwx - fc) < MOUNT_W/2 + f.w/2) {
        const charTop = mounted ? rider.y : Math.min(mount.y, rider.y);
        const charBot = mount.y + MOUNT_H;
        if (charTop < f.y + f.h && charBot > f.y) {
          f.collected = true;
          world.hunger = Math.min(100, world.hunger + HUNGER_REFILL);
          // max를 넘는 경우라도 표시는 항상 상수값으로 (소수점 방지)
          flashHungerBar(HUNGER_REFILL);
          sfx.food();
          world.score += 100;
          for (let i = 0; i < 12; i++) {
            particles.push({
              x: f.x + f.w/2 - world.scrollX, y: f.y + f.h/2,
              vx: rand(-3, 3), vy: rand(-3, 0), life: 1,
              color: '#ff6b9a', size: rand(2, 4),
            });
          }
        }
      }
    }

    updateHUD();
  }

  // ===== 렌더 =====
  function drawBackground() {
    const sky = ctx.createLinearGradient(0, 0, 0, GROUND_Y);
    sky.addColorStop(0, '#a8c8ec');
    sky.addColorStop(0.6, '#d8e8f5');
    sky.addColorStop(1, '#f5e8d0');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, GROUND_Y);

    // 스테이지 배경 - 패럴랙스 스크롤
    //   이미지 1600 wide vs 캔버스 1500 wide → 100px 스크롤 여지
    //   스테이지 길이(STAGE_LENGTH_WORLD) 동안 이미지가 100px만큼 천천히 좌측으로 이동
    //   세로는 캔버스 높이로 stretch (1600x900 → 1600x800)
    const stageImg = stageImages[world.currentStage];
    if (stageImg) {
      const scrollRoom = Math.max(0, stageImg.width - W);
      const parallax = scrollRoom > 0 ? scrollRoom / STAGE_LENGTH_WORLD : 0;
      const bgScroll = (world.scrollX - world.stageStartScroll) * parallax;
      ctx.drawImage(stageImg, -bgScroll, 0, stageImg.width, H);
    } else if (images.background) {
      const img = images.background;
      const iw = img.width;
      const off = world.bgOffset % iw;
      for (let x = -off; x < W; x += iw) ctx.drawImage(img, x, 0, iw, GROUND_Y);
    } else {
      // 원경 산
      ctx.fillStyle = '#6b8db5';
      for (let i = 0; i < 14; i++) {
        const x = ((i * 280) - world.bgOffset * 0.15) % (W + 600) - 300;
        ctx.beginPath();
        ctx.moveTo(x, GROUND_Y);
        ctx.lineTo(x + 140, GROUND_Y - 280);
        ctx.lineTo(x + 280, GROUND_Y);
        ctx.closePath();
        ctx.fill();
      }
      // 언덕
      ctx.fillStyle = '#7ba87b';
      for (let i = 0; i < 12; i++) {
        const x = ((i * 380) - world.bgOffset * 0.35) % (W + 800) - 400;
        ctx.beginPath();
        ctx.moveTo(x, GROUND_Y);
        ctx.quadraticCurveTo(x + 190, GROUND_Y - 140, x + 380, GROUND_Y);
        ctx.closePath();
        ctx.fill();
      }
      // 구름
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      for (let i = 0; i < 10; i++) {
        const x = ((i * 380) - world.bgOffset * 0.5) % (W + 600) - 300;
        const y = 80 + (i % 4) * 50;
        ctx.beginPath();
        ctx.arc(x, y, 30, 0, Math.PI * 2);
        ctx.arc(x + 35, y - 8, 36, 0, Math.PI * 2);
        ctx.arc(x + 72, y, 30, 0, Math.PI * 2);
        ctx.fill();
      }
      // 나무
      ctx.fillStyle = '#3d6a3d';
      for (let i = 0; i < 16; i++) {
        const x = ((i * 240) - world.bgOffset * 0.5) % (W + 500) - 250;
        const y = GROUND_Y - 50;
        ctx.fillRect(x, y, 10, 50);
        ctx.beginPath();
        ctx.arc(x + 5, y, 26, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  function drawGround() {
    // 구멍 배경(심연)
    ctx.fillStyle = '#1a1015';
    let prevEnd = null;
    for (const s of segments) {
      const sx = s.x - world.scrollX;
      if (prevEnd !== null && sx > prevEnd) {
        const gs = Math.max(0, prevEnd);
        const ge = Math.min(W, sx);
        if (ge > gs) ctx.fillRect(gs, GROUND_Y, ge - gs, H - GROUND_Y);
      }
      prevEnd = sx + s.w;
    }
    if (prevEnd !== null && prevEnd < W) {
      ctx.fillRect(prevEnd, GROUND_Y, W - prevEnd, H - GROUND_Y);
    }
    if (segments.length > 0) {
      const firstSX = segments[0].x - world.scrollX;
      if (firstSX > 0) ctx.fillRect(0, GROUND_Y, firstSX, H - GROUND_Y);
    }

    // 스테이지 테마 지면 렌더링
    const style = STAGE_STYLES[world.currentStage] || STAGE_STYLES[0];
    const groundH = H - GROUND_Y;
    for (const s of segments) {
      const sx = s.x - world.scrollX;
      if (sx + s.w < 0 || sx > W) continue;
      const dx = Math.max(0, sx);
      const dw = Math.min(W, sx + s.w) - dx;
      if (dw <= 0) continue;

      // 등록된 ground 이미지 우선
      if (images.ground) {
        const img = images.ground;
        for (let x = 0; x < s.w; x += img.width) {
          ctx.drawImage(img, sx + x, GROUND_Y, Math.min(img.width, s.w - x), groundH);
        }
        continue;
      }

      // 메인 fill
      ctx.fillStyle = style.gMain;
      ctx.fillRect(dx, GROUND_Y, dw, groundH);
      // 윗면 하이라이트 (지면 표면)
      ctx.fillStyle = style.gTop;
      ctx.fillRect(dx, GROUND_Y, dw, 8);
      // 표면 직하 그림자 (입체감)
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.fillRect(dx, GROUND_Y + 8, dw, 2);

      if (style.gCrack) {
        // 폐허/지하철: 균열 디테일
        ctx.strokeStyle = style.gLine;
        ctx.lineWidth = 1;
        for (let i = 0; i < s.w; i += 70) {
          const cx = sx + i + ((i * 17) % 23);
          if (cx < 0 || cx > W) continue;
          ctx.beginPath();
          ctx.moveTo(cx, GROUND_Y + 14);
          ctx.lineTo(cx + 6, GROUND_Y + 26);
          ctx.lineTo(cx - 3, GROUND_Y + 50);
          ctx.stroke();
        }
        for (let i = 0; i < s.w; i += 110) {
          const cx = sx + i + ((i * 11) % 31);
          if (cx < 0 || cx > W) continue;
          const cy = GROUND_Y + 32 + ((i * 7) % 22);
          ctx.beginPath();
          ctx.moveTo(cx, cy);
          ctx.lineTo(cx + 32, cy + 4);
          ctx.stroke();
        }
      } else {
        // 신사: 흙바닥 자갈/돌 점박이 패턴
        ctx.fillStyle = style.gLine;
        for (let i = 0; i < s.w; i += 28) {
          const px = sx + i + ((i * 13) % 11);
          if (px >= 0 && px < W) {
            ctx.fillRect(px, GROUND_Y + 16, 3, 3);
            ctx.fillRect(px + 14, GROUND_Y + 34, 4, 2);
            ctx.fillRect(px + 7,  GROUND_Y + 52, 2, 3);
          }
        }
      }

      // 바닥 깊은 곳 어두운 띠
      ctx.fillStyle = 'rgba(0,0,0,0.4)';
      ctx.fillRect(dx, GROUND_Y + groundH - 8, dw, 8);
    }
  }

  function drawPlatforms() {
    for (const p of platforms) {
      const px = p.x - world.scrollX;
      if (px + p.w < 0 || px > W) continue;
      const isMoving = !!p.motion;
      if (images.platform) {
        ctx.drawImage(images.platform, px, p.y, p.w, p.h);
      } else if (isMoving) {
        // 움직이는 블록 - 푸른 톤 + 화살표
        ctx.fillStyle = '#3a5a8a';
        ctx.fillRect(px, p.y, p.w, p.h);
        ctx.fillStyle = '#6b9adf';
        ctx.fillRect(px, p.y, p.w, 6);
        ctx.fillStyle = 'rgba(0,0,0,0.25)';
        ctx.fillRect(px, p.y + p.h - 5, p.w, 5);
        // 방향 화살표
        ctx.fillStyle = 'rgba(255,255,255,0.7)';
        const cx = px + p.w / 2;
        const cy = p.y + p.h / 2 + 2;
        ctx.beginPath();
        if (p.motion.type === 'vertical') {
          // 위아래 양방향 화살표
          ctx.moveTo(cx, cy - 9); ctx.lineTo(cx - 6, cy - 3); ctx.lineTo(cx + 6, cy - 3); ctx.closePath();
          ctx.moveTo(cx, cy + 9); ctx.lineTo(cx - 6, cy + 3); ctx.lineTo(cx + 6, cy + 3); ctx.closePath();
        } else {
          // 좌우 양방향 화살표
          ctx.moveTo(cx - 12, cy); ctx.lineTo(cx - 6, cy - 5); ctx.lineTo(cx - 6, cy + 5); ctx.closePath();
          ctx.moveTo(cx + 12, cy); ctx.lineTo(cx + 6, cy - 5); ctx.lineTo(cx + 6, cy + 5); ctx.closePath();
        }
        ctx.fill();
      } else {
        // 정적 블록 - 스테이지 테마 색감 적용
        const style = STAGE_STYLES[world.currentStage] || STAGE_STYLES[0];
        ctx.fillStyle = style.pMain;
        ctx.fillRect(px, p.y, p.w, p.h);
        // 윗면 하이라이트
        ctx.fillStyle = style.pTop;
        ctx.fillRect(px, p.y, p.w, 6);
        // 윗면-옆면 경계
        ctx.fillStyle = 'rgba(0,0,0,0.25)';
        ctx.fillRect(px, p.y + 6, p.w, 2);
        // 아래쪽 그림자
        ctx.fillStyle = style.pBottom;
        ctx.fillRect(px, p.y + p.h - 6, p.w, 6);
        // 이음새/나무결 라인
        ctx.strokeStyle = style.pLine;
        ctx.lineWidth = 1;
        for (let i = 0; i < p.w; i += 36) {
          ctx.beginPath();
          ctx.moveTo(px + i, p.y + 6);
          ctx.lineTo(px + i, p.y + p.h - 6);
          ctx.stroke();
        }
        // 폐허 테마: 균열 디테일
        if (style.pCrack) {
          ctx.strokeStyle = 'rgba(0,0,0,0.4)';
          ctx.lineWidth = 1;
          // 블록 가로 위치에 따라 안정적인(랜덤이 아닌) 균열 그리기
          for (let i = 16; i < p.w - 16; i += 60) {
            const cx = px + i + ((i * 13) % 17);
            ctx.beginPath();
            ctx.moveTo(cx, p.y + 8);
            ctx.lineTo(cx + 4, p.y + 14);
            ctx.lineTo(cx - 2, p.y + p.h - 10);
            ctx.stroke();
          }
        }
      }
    }
  }

  function drawFoods() {
    for (const f of foods) {
      if (f.collected) continue;
      const fx = f.x - world.scrollX;
      if (fx + f.w < 0 || fx > W) continue;
      f.bob += 0.08;
      const by = f.y + Math.sin(f.bob) * 3;
      if (images.food) {
        ctx.drawImage(images.food, fx, by, f.w, f.h);
      } else {
        ctx.fillStyle = '#ff5050';
        ctx.beginPath();
        ctx.arc(fx + f.w/2, by + f.h/2 + 2, f.w/2 - 1, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#3d6a3d';
        ctx.beginPath();
        ctx.ellipse(fx + f.w/2 + 4, by + 4, 5, 3, -0.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#6b4f28';
        ctx.fillRect(fx + f.w/2 - 1, by + 2, 2, 4);
        ctx.fillStyle = 'rgba(255,255,255,0.4)';
        ctx.beginPath();
        ctx.arc(fx + f.w/2 - 4, by + f.h/2, 3, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  function hasMountParts() {
    return images.mountBody && images.mountHead && images.mountLeg;
  }

  function getMountGait() {
    // 갤럽 사이클: 지상에서만 활성화 (공중에선 정지)
    const hasImg = hasMountParts();
    if (!hasImg || !mount.onSurface) {
      return { phase: 0, bobY: 0, tilt: 0, swingFront: 0, swingBack: 0, shiftFront: 0, shiftBack: 0 };
    }
    const G = MOUNT_GAIT;
    const phase = world.scrollX * G.cycleSpeed;
    const bobY = Math.abs(Math.sin(phase * 2)) * G.bob;
    const tilt = Math.sin(phase * 2) * G.tilt;
    const swingFront = Math.sin(phase) * G.swing;
    const swingBack  = Math.sin(phase + Math.PI) * G.swing;
    const shiftFront = Math.cos(phase) * G.shift;
    const shiftBack  = Math.cos(phase + Math.PI) * G.shift;
    return { phase, bobY, tilt, swingFront, swingBack, shiftFront, shiftBack };
  }

  // === leg.png 한 장으로 4개 다리 합성 ===
  function drawSingleLeg(cfg, w, h, baseScrollPhase) {
    const G = MOUNT_GAIT;
    const phase = baseScrollPhase + cfg.phase;
    const swing = Math.sin(phase) * G.swing;
    // 다리 들림: 앞으로 스윙(swing>0)할 때 살짝 위로 들려서 발이 땅에서 떨어진 느낌
    const lift = Math.max(0, Math.sin(phase)) * (G.shift * 0.6);

    const ax = cfg.anchorX * w;
    const ay = cfg.anchorY * h;
    const scale = cfg.scale || 1;
    const legW = cfg.dw * w * scale;
    const legH = cfg.dh * h * scale;
    const pivotX = cfg.pivotX * legW;
    const pivotY = cfg.pivotY * legH;

    ctx.save();
    if (cfg.dim != null && cfg.dim < 1) ctx.globalAlpha = cfg.dim;
    ctx.translate(ax, ay - lift);
    ctx.rotate(swing);
    ctx.drawImage(images.mountLeg, -pivotX, -pivotY, legW, legH);
    ctx.restore();
  }

  // 몸통 + 다리만 그림 (머리는 별도로 drawMountHead에서 그림)
  // 레이어: 뒷다리(왼쪽) → 몸통 → 앞다리(오른쪽)
  function drawMountParts(x, y, w, h) {
    const g = getMountGait();
    const G = MOUNT_GAIT;
    const baseScrollPhase = world.scrollX * G.cycleSpeed;

    ctx.save();
    ctx.translate(x, y - g.bobY);
    ctx.translate(0, h);
    ctx.rotate(g.tilt);
    ctx.translate(-w/2, -h);

    // 1) 뒤 레이어 다리들 (왼쪽 = far side, 몸통 뒤로)
    for (const leg of MOUNT_PARTS.legs) {
      if (leg.layer === 'back') drawSingleLeg(leg, w, h, baseScrollPhase);
    }

    // 2) 몸통 (shami_body.png)
    const b = MOUNT_PARTS.body;
    ctx.drawImage(images.mountBody, b.dx * w, b.dy * h, b.dw * w, b.dh * h);

    // 3) 앞 레이어 다리들 (오른쪽 = near side, 몸통 앞으로)
    for (const leg of MOUNT_PARTS.legs) {
      if (leg.layer === 'front') drawSingleLeg(leg, w, h, baseScrollPhase);
    }

    ctx.restore();
  }

  // 머리만 별도로 그림 (drawPlayer에서 rider 위에 호출됨 → 최상단 레이어)
  function drawMountHead(x, y, w, h) {
    if (!images.mountHead) return;
    const g = getMountGait();
    const cfg = MOUNT_PARTS.head;
    ctx.save();
    ctx.translate(x, y - g.bobY);
    ctx.translate(0, h);
    ctx.rotate(g.tilt);
    ctx.translate(-w/2, -h);
    ctx.drawImage(images.mountHead, cfg.dx * w, cfg.dy * h, cfg.dw * w, cfg.dh * h);
    ctx.restore();
  }

  function drawMount(x, y, w, h) {
    // 1) 부위별 PNG가 모두 로드되어 있으면 부위별 합성 애니메이션
    if (hasMountParts()) {
      drawMountParts(x, y, w, h);
      return;
    }
    // 2) 단일 이미지만 있으면 자르지 않고 바운스/틸트만 적용
    if (images.mount) {
      const g = getMountGait();
      ctx.save();
      ctx.translate(x, y - g.bobY);
      ctx.translate(0, h);
      ctx.rotate(g.tilt);
      ctx.translate(0, -h);
      ctx.drawImage(images.mount, -w/2, 0, w, h);
      ctx.restore();
      return;
    }
    // 몸체
    ctx.fillStyle = '#ff6b3d';
    if (ctx.roundRect) {
      ctx.beginPath();
      ctx.roundRect(x - w/2, y + 8, w, h - 16, 6);
      ctx.fill();
    } else ctx.fillRect(x - w/2, y + 8, w, h - 16);
    // 앞부분
    ctx.fillStyle = '#ffcb6b';
    if (ctx.roundRect) {
      ctx.beginPath();
      ctx.roundRect(x + w/2 - 12, y + 4, 14, 14, 4);
      ctx.fill();
    } else ctx.fillRect(x + w/2 - 12, y + 4, 14, 14);
    // 시트
    ctx.fillStyle = '#3d2e1f';
    ctx.fillRect(x - w/4, y, w/2, 10);
    // 바퀴
    ctx.fillStyle = '#222';
    const wr = 9;
    ctx.beginPath();
    ctx.arc(x - w/2 + 12, y + h - 4, wr, 0, Math.PI * 2);
    ctx.arc(x + w/2 - 12, y + h - 4, wr, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#555';
    ctx.beginPath();
    ctx.arc(x - w/2 + 12, y + h - 4, wr - 4, 0, Math.PI * 2);
    ctx.arc(x + w/2 - 12, y + h - 4, wr - 4, 0, Math.PI * 2);
    ctx.fill();
    // 스포크 (회전)
    const ang = (world.scrollX * 0.2) % (Math.PI * 2);
    ctx.strokeStyle = '#888';
    ctx.lineWidth = 1.5;
    for (const cx of [x - w/2 + 12, x + w/2 - 12]) {
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(ang) * (wr - 4), y + h - 4 + Math.sin(ang) * (wr - 4));
      ctx.lineTo(cx - Math.cos(ang) * (wr - 4), y + h - 4 - Math.sin(ang) * (wr - 4));
      ctx.stroke();
    }
  }

  function drawRider(x, y, w, h) {
    // 탑승 상태: ohana_ride.png 사용 (앉은 자세)
    if (mounted && images.riderMounted) {
      const cfg = RIDER_MOUNTED;
      const bobY = getMountGait().bobY;
      const dx = PLAYER_X - cfg.w / 2 + cfg.offsetX;
      // 이미지 하단이 mount.y + overlap(살짝 안쪽) 위치에 오도록 배치, 탈것 바운스 동기화
      const dy = (mount.y - bobY) + cfg.overlap - cfg.h;
      ctx.drawImage(images.riderMounted, dx, dy, cfg.w, cfg.h);
      return;
    }
    // 분리 상태 또는 탑승 이미지 없음: ohana.png(서있는 포즈)
    if (images.rider) { ctx.drawImage(images.rider, x - w/2, y, w, h); return; }
    // 다리
    ctx.fillStyle = '#1a3a6e';
    ctx.fillRect(x - 7, y + h - 14, 6, 14);
    ctx.fillRect(x + 1, y + h - 14, 6, 14);
    // 몸통
    ctx.fillStyle = '#ffcb6b';
    if (ctx.roundRect) {
      ctx.beginPath();
      ctx.roundRect(x - 10, y + 12, 20, 18, 4);
      ctx.fill();
    } else ctx.fillRect(x - 10, y + 12, 20, 18);
    // 팔
    ctx.fillStyle = '#f3a06b';
    ctx.fillRect(x - 12, y + 14, 4, 12);
    ctx.fillRect(x + 8, y + 14, 4, 12);
    // 머리
    ctx.fillStyle = '#f3c89e';
    ctx.beginPath();
    ctx.arc(x, y + 8, 8, 0, Math.PI * 2);
    ctx.fill();
    // 머리카락
    ctx.fillStyle = '#3d2818';
    ctx.beginPath();
    ctx.arc(x, y + 5, 8, Math.PI, 0);
    ctx.fill();
    // 눈
    ctx.fillStyle = '#222';
    ctx.fillRect(x + 2, y + 8, 2, 2);
    ctx.fillRect(x - 4, y + 8, 2, 2);
  }

  // 캐릭터 바로 아래의 표면(지면/플랫폼)을 찾아 그 위에 그림자를 그림
  // 캐릭터가 점프해서 위로 올라가도 그림자는 표면에 고정됨 (높이에 따라 작아지고 흐려짐)
  function drawShadowFor(bodyY, bodyH, bodyW) {
    const wx = playerWorldX();
    const charBottom = bodyY + bodyH;
    let surfaceY = null;
    for (const p of platforms) {
      if (wx < p.x || wx > p.x + p.w) continue;
      if (p.y < charBottom - 2) continue; // 캐릭터보다 위에 있는 플랫폼은 제외
      if (surfaceY === null || p.y < surfaceY) surfaceY = p.y;
    }
    if (groundExistsAt(wx) && GROUND_Y >= charBottom - 2) {
      if (surfaceY === null || GROUND_Y < surfaceY) surfaceY = GROUND_Y;
    }
    if (surfaceY === null) return; // 아래가 구멍 → 그림자 없음

    // 높이에 따른 그림자 크기/투명도 (멀수록 작고 흐릿)
    const heightAbove = Math.max(0, surfaceY - charBottom);
    const f = Math.max(0.25, 1 - heightAbove / 500);
    ctx.fillStyle = 'rgba(0,0,0,' + (0.35 * f).toFixed(3) + ')';
    ctx.beginPath();
    ctx.ellipse(PLAYER_X, surfaceY + 2, (bodyW / 2) * 0.95 * f, 7 * f, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawPlayer() {
    // 탑승 상태에서 탈것의 갤럽 바운스에 인물도 함께 따라가도록 동기화
    const gait = getMountGait();
    const riderBob = mounted ? gait.bobY : 0;

    // 1) 그림자(들) - 캐릭터보다 먼저 그려서 발 밑에 깔리도록
    //    탑승 상태: 탈것 그림자 1개. 분리 상태: 탈것 + 인물 각각.
    drawShadowFor(mount.y, MOUNT_H, MOUNT_W);
    if (!mounted) drawShadowFor(rider.y, RIDER_H, RIDER_W * 0.7);

    // 레이어 순서 (아래 → 위)
    //   1. 그림자 (위에서 이미 그림 - 흔들림 영향 X)
    //   2. 탈것 몸통+다리 (drawMount)
    //   3. 인물 (drawRider) - 탑승 시 ohana_ride, 분리 시 ohana
    //   4. 탈것 머리 (drawMountHead) - 최상단
    // CRASH 상태에선 캐릭터 전체에 흔들림 적용 (그림자는 제외)
    const shaking = world.shakeAmount > 0.5;
    let sx = 0, sy = 0;
    if (shaking) {
      sx = (Math.random() - 0.5) * world.shakeAmount;
      sy = (Math.random() - 0.5) * world.shakeAmount;
      ctx.save();
      ctx.translate(sx, sy);
    }
    drawMount(PLAYER_X, mount.y, MOUNT_W, MOUNT_H);
    drawRider(PLAYER_X, rider.y - riderBob, RIDER_W, RIDER_H);
    drawMountHead(PLAYER_X, mount.y, MOUNT_W, MOUNT_H);
    if (shaking) ctx.restore();

  }

  // CRASH! 텍스트 (충돌 시 화면 중앙에 표시)
  function drawCrashText() {
    if (world.state !== 'crashing') return;
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    // 살짝 흔들림
    const wx = (Math.random() - 0.5) * 12;
    const wy = (Math.random() - 0.5) * 12;
    ctx.translate(W / 2 + wx, H / 2 + wy);
    // 외곽선 효과: 검은색 외곽 → 흰색 → 빨간색
    ctx.font = 'bold 140px sans-serif';
    ctx.lineWidth = 10;
    ctx.strokeStyle = '#000';
    ctx.strokeText('CRASH!', 0, 0);
    ctx.fillStyle = '#fff';
    ctx.fillText('CRASH!', 0, 0);
    ctx.font = 'bold 120px sans-serif';
    ctx.fillStyle = '#ff2030';
    ctx.fillText('CRASH!', 0, 0);
    ctx.restore();
  }

  function drawParticles() {
    for (const p of particles) {
      ctx.globalAlpha = Math.max(0, p.life);
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x - p.size/2, p.y - p.size/2, p.size, p.size);
    }
    ctx.globalAlpha = 1;
  }

  function drawCrashOverlay() {
    ctx.fillStyle = 'rgba(255,80,80,' + (world.crashTimer * 0.3) + ')';
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 28px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('CRASH!', W/2, H/2);
  }

  // 랭킹 표시 (게임오버/승리 공통)
  // 우측 패널 안에 랭킹을 표시. panelRight = 패널의 우측 x, panelWidth = 패널 너비
  function drawRankingPanel(centerY, panelRight, panelWidth) {
    const list = cachedRanking;
    const panelLeft = panelRight - panelWidth;
    const titleX = panelLeft + panelWidth/2;

    ctx.textAlign = 'center';
    ctx.font = 'bold 20px sans-serif';
    ctx.fillStyle = '#ffcb6b';
    ctx.fillText('— RANKING TOP ' + RANKING_MAX + ' —', titleX, centerY);

    const startY = centerY + 28;
    const rowH = 22;
    // 컬럼 X 좌표 (패널 내부, 좌측부터)
    const colIdx = panelLeft + 14;
    const colName = panelLeft + 50;
    const colScore = panelRight - 80;
    const colDist = panelRight - 12;

    ctx.font = '12px sans-serif';
    ctx.fillStyle = '#888';
    ctx.textAlign = 'left';
    ctx.fillText('#',     colIdx,  startY - 8);
    ctx.fillText('NAME',  colName, startY - 8);
    ctx.textAlign = 'right';
    ctx.fillText('SCORE', colScore, startY - 8);
    ctx.fillText('DIST',  colDist,  startY - 8);

    ctx.font = 'bold 15px sans-serif';
    for (let i = 0; i < list.length; i++) {
      const e = list[i];
      const isMine = i === lastRankIndex;
      ctx.fillStyle = isMine ? '#ff6b3d' : '#fff';
      const y = startY + i * rowH + 12;
      ctx.textAlign = 'left';
      ctx.fillText((i+1).toString().padStart(2, ' '), colIdx, y);
      ctx.fillText((e.name || 'PLAYER') + (e.cleared ? ' ★' : ''), colName, y);
      ctx.textAlign = 'right';
      ctx.fillText(e.score.toString(), colScore, y);
      ctx.fillText(e.distance + 'm', colDist, y);
    }
    if (list.length === 0) {
      ctx.fillStyle = '#888';
      ctx.font = '14px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('(아직 기록 없음)', titleX, startY + 20);
    }
  }

  function drawGameOver() {
    // 1) 배경 이미지 (게임오버 종류별)
    const img = images[world.gameOverImageKey] || images.gameOverHole;
    if (img) {
      // 좌측을 캐릭터 이미지로 가득 채움 (캔버스 전체에 stretch)
      ctx.drawImage(img, 0, 0, W, H);
      // 우측 패널이 들어갈 자리에 어두운 그라데이션 (이미지를 살짝 비치게)
      const grad = ctx.createLinearGradient(W * 0.55, 0, W, 0);
      grad.addColorStop(0, 'rgba(0,0,0,0)');
      grad.addColorStop(0.4, 'rgba(0,0,0,0.65)');
      grad.addColorStop(1, 'rgba(0,0,0,0.88)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, W, H);
    } else {
      ctx.fillStyle = 'rgba(0,0,0,0.78)';
      ctx.fillRect(0, 0, W, H);
    }

    // 2) 우측 패널 정보 (모두 우측 정렬)
    const panelRight = W - 32;
    const panelWidth = 440;
    const panelLeft = panelRight - panelWidth;

    ctx.textBaseline = 'alphabetic';
    ctx.textAlign = 'right';

    // GAME OVER
    ctx.font = 'bold 56px sans-serif';
    ctx.fillStyle = '#ff6b3d';
    ctx.fillText('GAME OVER', panelRight, 100);

    // 이유
    ctx.font = '18px sans-serif';
    ctx.fillStyle = '#fff';
    ctx.fillText(world.gameOverReason, panelRight, 132);

    // 본인 점수
    ctx.font = 'bold 26px sans-serif';
    ctx.fillStyle = '#ffcb6b';
    ctx.fillText((world.playerName || 'PLAYER') + ' : ' + Math.floor(world.score) + ' 점', panelRight, 175);

    // 거리
    ctx.font = '15px sans-serif';
    ctx.fillStyle = '#ddd';
    ctx.fillText('거리: ' + Math.floor(world.distance) + 'm', panelRight, 200);

    // 랭킹 패널 (우측 정렬)
    drawRankingPanel(245, panelRight, panelWidth);
  }

  function render() {
    ctx.clearRect(0, 0, W, H);

    // 타이틀 상태: 타이틀 이미지만 표시 (오버레이 폼은 HTML에서)
    if (world.state === 'title') {
      if (images.title) {
        ctx.drawImage(images.title, 0, 0, W, H);
      } else {
        ctx.fillStyle = '#1a1f3a';
        ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = '#ffcb6b';
        ctx.font = 'bold 80px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('SHAMI RIDER', W/2, H/2);
      }
      return;
    }

    drawBackground();
    drawGround();
    drawPlatforms();
    drawFoods();
    drawBosses();   // 보스는 플랫폼 위, 플레이어 아래 (또는 위) 레이어
    drawPlayer();
    drawParticles();
    drawCrashText();
    // 스테이지 전환 페이드 (검은 오버레이)
    if (world.fadeAlpha > 0) {
      ctx.fillStyle = 'rgba(0,0,0,' + world.fadeAlpha.toFixed(3) + ')';
      ctx.fillRect(0, 0, W, H);
      // 페이드 중 가운데 표시: "STAGE N"
      if (world.fadeAlpha > 0.4) {
        ctx.save();
        ctx.globalAlpha = Math.min(1, (world.fadeAlpha - 0.4) / 0.4);
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 60px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const displayStage = world.fadeState === 'in' ? world.currentStage + 1
          : ((world.currentStage + 1) % STAGE_BG_PATHS.length) + 1;
        ctx.fillText('STAGE ' + displayStage, W / 2, H / 2);
        ctx.restore();
      }
    }
    if (world.state === 'gameover') drawGameOver();
    if (world.state === 'victory') drawVictory();
  }

  function drawVictory() {
    // 1) 배경 이미지 (gameOverClear - 캐릭터들이 보스 쓰러뜨리고 환호)
    if (images.gameOverClear) {
      ctx.drawImage(images.gameOverClear, 0, 0, W, H);
      // 우측 패널 영역에 어두운 그라데이션 (정보 가독성 확보 + 좌측 이미지는 잘 보임)
      const grad = ctx.createLinearGradient(W * 0.55, 0, W, 0);
      grad.addColorStop(0, 'rgba(0,0,0,0)');
      grad.addColorStop(0.4, 'rgba(0,0,0,0.65)');
      grad.addColorStop(1, 'rgba(0,0,0,0.88)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, W, H);
    } else {
      ctx.fillStyle = 'rgba(0,0,0,0.82)';
      ctx.fillRect(0, 0, W, H);
    }

    // 2) 우측 패널 정보
    const panelRight = W - 32;
    const panelWidth = 440;
    ctx.textBaseline = 'alphabetic';
    ctx.textAlign = 'right';

    // CLEAR! 큰 노란 글자
    ctx.font = 'bold 80px sans-serif';
    ctx.lineWidth = 8;
    ctx.strokeStyle = '#000';
    ctx.strokeText('CLEAR!', panelRight, 100);
    ctx.fillStyle = '#ffcb6b';
    ctx.fillText('CLEAR!', panelRight, 100);

    ctx.fillStyle = '#fff';
    ctx.font = 'bold 26px sans-serif';
    ctx.fillText((world.playerName || 'PLAYER') + ' : ' + Math.floor(world.score) + ' 점', panelRight, 145);

    ctx.font = '15px sans-serif';
    ctx.fillStyle = '#ddd';
    ctx.fillText('거리: ' + Math.floor(world.distance) + 'm  |  모든 스테이지 클리어 ★', panelRight, 172);

    drawRankingPanel(215, panelRight, panelWidth);
  }

  // ===== HUD =====
  const $score = document.getElementById('score');
  const $dist = document.getElementById('dist');
  const $speed = document.getElementById('speed');
  const $hungerFill = document.getElementById('hungerFill');
  function updateHUD() {
    $score.textContent = Math.floor(world.score);
    $dist.textContent = Math.floor(world.distance);
    $speed.textContent = world.speed.toFixed(1);
    $hungerFill.style.width = world.hunger + '%';
  }

  // ===== 재시작 =====
  function restart() {
    // state는 호출 측에서 'running' / 'title' 등으로 결정 (여기선 'running' 기본)
    world.scrollX = 0; world.speed = 0; world.state = 'running';
    world.invulnTimer = 0;
    lastRankIndex = -1;
    world.crashTimer = 0; world.shakeAmount = 0;
    bosses.length = 0;
    bossSpawnTimer = 0;
    nextBossSpawn = BOSS_SPAWN_INTERVAL_MIN;
    world.hunger = 100; world.score = 0; world.distance = 0;
    world.bgOffset = 0; world.gameOverReason = '';
    world.currentStage = 0;
    world.stageStartScroll = 0;
    world.fadeState = 'none';
    world.fadeAlpha = 0;
    world.fadeTimer = 0;
    segments.length = 0; platforms.length = 0; foods.length = 0; particles.length = 0;
    segments.push({ x: -200, w: 2400 });
    nextGroundX = -200 + 2400;
    nextPlatformX = 1200; nextFoodX = 800;
    mount.y = GROUND_Y - MOUNT_H; mount.vy = 0; mount.onSurface = 'ground';
    rider.y = mount.y - RIDER_H; rider.vy = 0; rider.onSurface = null;
    mounted = true; jumpsUsed = 0;
    updateHUD();
  }

  // ===== 메인 루프 =====
  let lastTime = performance.now();
  function loop(now) {
    const dt = Math.min(0.033, (now - lastTime) / 1000);
    lastTime = now;
    update(dt);
    render();
    requestAnimationFrame(loop);
  }
  generateWorld();
  updateHUD();
  requestAnimationFrame(loop);

  // 초기 상태가 'title'이므로 타이틀 BGM 재생 시도
  // (브라우저 자동재생 정책으로 차단될 수 있으나, 사용자 첫 상호작용 시 unlock 리스너가 재시도)
  playMusic('title');
  hideHungerGauge();   // 초기엔 타이틀이므로 게이지 숨김

  // Firebase 랭킹 초기 로드 (SDK 스크립트가 module이라 늦게 로드될 수 있어
  // 즉시 시도 + 1초 후 한 번 더 재시도)
  refreshRanking();
  setTimeout(() => { if (cachedRanking.length === 0 || hasFirebase()) refreshRanking(); }, 1000);
})();
