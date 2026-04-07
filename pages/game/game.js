const { emotions } = require("../../utils/emotion");
const tracker = require("../../utils/tracker");

// 随机物体配置（复用 V2）
const OBJECTS = [
  { type: "phone",    name: "手机",   maxDur: 120 },
  { type: "keyboard", name: "键盘",   maxDur: 150 },
  { type: "glass",    name: "玻璃",   maxDur: 80  },
  { type: "mug",      name: "马克杯", maxDur: 110 }
];

// 陪伴语录
const COMPANION_WORDS = [
  "你还好吗？", "我在这里陪着你", "慢慢来，不着急", "一切都会好起来的",
  "你不是一个人", "深呼吸~", "我懂你", "抱抱 🤗"
];

// 陪伴模式特殊：无倒计时，靠 duration 上报衡量沉浸感
const COMPANION_DURATION = 45; // 秒，45秒后自动结束

Page({
  data: {
    emotion: {},
    combo: 0,
    maxCombo: 0,
    durability: 100,
    durPercent: "100",
    durClass: "",
    reliefValue: 0,
    comboMultiplier: 0,
    timeLeft: 30,
    progress: 0,
    showProgress: true,
    showCombo: false,    // combo 区默认隐藏，首次点击后出现
    hitShake: false,
    comboShake: false,
    lastHitTime: 0,
    timerInterval: null,
    // ── 新增：埋点 ──
    _session: null,      // 当前 session 对象
    _startTime: 0,       // 用于计算 duration
    // ── end ──

    // explode
    explodeActive: false,

    // breath
    scale: 1,
    breathOpacity: 1,
    breathText: "吸气...",
    breathPhase: 0,
    breathTimeout: null,

    // tap
    tapCount: 0,
    tapPulse: false,

    // puzzle
    puzzlePieces: [],
    removedCount: 0,
    totalPieces: 12,

    // companion
    companionText: "🌙",
    companionWord: "",
    companionTapCount: 0,
    companionInterval: null,
    companionTimerInterval: null
  },

  onLoad(options) {
    wx.showShareMenu({ withShareTicket: true });

    const emotion = emotions.find(e => e.id === options.emotionId) || emotions[0];
    const obj = OBJECTS[Math.floor(Math.random() * OBJECTS.length)];

    // ── 埋点：启动 session ──
    const session = tracker.start(emotion.id, emotion.name, emotion.game);
    this.setData({
      emotion,
      durability: obj.maxDur,
      durPercent: "100",
      showProgress: emotion.type !== "companion",
      maxDurability: obj.maxDur,
      currentObject: obj,
      _session: session,
      _startTime: Date.now()
    });

    // ── 初始化游戏特定逻辑 ──
    if (emotion.game === "breath") {
      this.startBreath();
    } else if (emotion.game === "puzzle") {
      this.initPuzzle();
    } else if (emotion.game === "companion") {
      this.startCompanion();
    }

    // 除 companion 外，启动倒计时
    if (emotion.game !== "companion") {
      this.startTimer();
    } else {
      this.startCompanionTimer();
    }
  },

  onUnload() {
    clearInterval(this.data.timerInterval);
    clearTimeout(this.data.breathTimeout);
    clearInterval(this.data.companionInterval);
    clearInterval(this.data.companionTimerInterval);
  },

  // ── 通用 ──
  handleTap() {},

  goBack() {
    // 离开前 flush 一个被中断的 session（duration=0，replay/share=false）
    const { _session } = this.data;
    if (_session && !_session.endTime) {
      _session.duration = 0;
      _session.endTime  = Date.now();
      tracker.flush(_session);
    }
    wx.navigateBack();
  },

  startTimer() {
    const interval = setInterval(() => {
      const { timeLeft } = this.data;
      if (timeLeft <= 0) {
        clearInterval(interval);
        this.finish();
        return;
      }
      this.setData({ timeLeft: timeLeft - 1 });
    }, 1000);
    this.setData({ timerInterval: interval });
  },

  // ── 埋点：过程上报 ──
  _track(event, data) {
    const { _session } = this.data;
    if (!_session) return;
    tracker.track(_session, event, data);
  },

  finish() {
    clearInterval(this.data.timerInterval);
    clearTimeout(this.data.breathTimeout);
    clearInterval(this.data.companionInterval);
    clearInterval(this.data.companionTimerInterval);

    const { reliefValue, maxCombo, _session, emotion } = this.data;
    const percent = Math.min(100, Math.floor(reliefValue));

    // ── 埋点：结束 session ──
    tracker.track(_session, "relief", { value: reliefValue });
    tracker.track(_session, "max_combo", { value: maxCombo });
    const finished = tracker.finish(_session);
    tracker.flush(finished);

    this.saveRecord(emotion.id, percent, maxCombo, reliefValue, emotion);

    wx.navigateTo({
      url: `/pages/result/result?relief=${percent}&emotionId=${emotion.id}&maxCombo=${maxCombo}`
    });
  },

  saveRecord(emotionId, percent, maxCombo, reliefValue, emotion) {
    const records = wx.getStorageSync("records") || [];
    records.unshift({
      emotionId, percent, maxCombo, reliefValue,
      date: new Date().toLocaleDateString("zh-CN"),
      emotionName: emotion.name,
      emotionColor: emotion.color
    });
    if (records.length > 20) records.length = 20;
    wx.setStorageSync("records", records);
  },

  updateProgress() {
    let progress = 0;
    const { emotion, durability, maxDurability } = this.data;
    if (emotion.type === "release") {
      progress = Math.max(0, 100 - Math.floor((durability / maxDurability) * 100));
    } else if (emotion.type === "calm") {
      progress = Math.min(100, Math.floor((this.data.reliefValue / 100) * 100));
    } else if (emotion.type === "heal") {
      progress = Math.min(100, Math.floor((this.data.removedCount / this.data.totalPieces) * 100));
    }
    this.setData({ progress });
  },

  // ── hit: 砸击 ──
  onHit() {
    const now = Date.now();
    let { combo, maxCombo, durability, reliefValue, lastHitTime, _session } = this.data;
    const { maxDurability } = this.data;

    if (now - lastHitTime < 500) {
      combo++;
    } else {
      combo = 1;
    }
    // 首次有效点击后显示 combo 区
    if (!this.data.showCombo) this.setData({ showCombo: true });
    maxCombo = Math.max(maxCombo, combo);

    // ── 埋点：每次点击上报 combo ──
    tracker.track(_session, "max_combo", { value: maxCombo });
    tracker.track(_session, "click");

    const damage = Math.floor(Math.random() * 11) + 5;
    durability = Math.max(0, durability - damage);

    const multiplier = 1 + combo * 0.05;
    reliefValue = Math.floor(reliefValue + damage * multiplier);
    tracker.track(_session, "relief", { value: reliefValue });

    const durPercent = Math.max(0, ((durability / maxDurability) * 100)).toFixed(1);

    this.setData({
      combo, maxCombo, durability,
      durPercent, durClass: durPercent < 30 ? "danger" : durPercent < 60 ? "warn" : "",
      reliefValue,
      comboMultiplier: Math.round(combo * 5),
      lastHitTime: now,
      hitShake: true, comboShake: true
    });

    setTimeout(() => this.setData({ hitShake: false, comboShake: false }), 150);
    if (combo > 10) { wx.vibrateHeavy ? wx.vibrateHeavy() : wx.vibrateShort(); }
    else { wx.vibrateShort(); }

    this.updateProgress();
    if (durability <= 0) this.finish();
  },

  // ── explode: 爆炸 ──
  onExplode() {
    if (this.data.explodeActive) return;
    wx.vibrateLong();
    const { _session } = this.data;
    tracker.track(_session, "click");
    tracker.track(_session, "relief", { value: 100 });

    this.setData({ explodeActive: true, reliefValue: 100, progress: 100 });
    setTimeout(() => this.finish(), 800);
  },

  // ── breath: 呼吸 ──
  startBreath() {
    let phase = 0;
    const PHASES = [
      { scale: 1.3, text: "吸气...", duration: 3500, opacity: 0.9 },
      { scale: 1.3, text: "屏住...", duration: 2000, opacity: 1.0 },
      { scale: 0.8, text: "呼气...", duration: 4000, opacity: 0.7 }
    ];

    const run = () => {
      const p = PHASES[phase];
      this.setData({ scale: p.scale, breathText: p.text, breathOpacity: p.opacity, breathPhase: phase });

      const { reliefValue, _session } = this.data;
      this.setData({ reliefValue: reliefValue + 3 });
      tracker.track(_session, "relief", { value: this.data.reliefValue });
      this.updateProgress();

      this.data.breathTimeout = setTimeout(() => {
        phase = (phase + 1) % 3;
        if (phase === 0) this.finish();
        else run();
      }, p.duration);
    };
    run();
  },

  // ── tap: 敲击 ──
  onTap() {
    const { tapCount, reliefValue, _session } = this.data;
    tracker.track(_session, "click");
    const newRelief = reliefValue + 2;
    tracker.track(_session, "relief", { value: newRelief });

    this.setData({ tapCount: tapCount + 1, reliefValue: newRelief, tapPulse: true });
    setTimeout(() => this.setData({ tapPulse: false }), 200);
    wx.vibrateShort({ type: "light" });
    this.updateProgress();
    if (this.data.tapCount >= 60) this.finish();
  },

  // ── puzzle: 拼图 ──
  initPuzzle() {
    const { totalPieces, emotion, _session } = this.data;
    const pieces = [];
    for (let i = 0; i < totalPieces; i++) {
      pieces.push({ id: i, x: Math.random() * 70, y: Math.random() * 60 + 10, color: emotion.color, removed: false });
    }
    tracker.track(_session, "relief", { value: 0 });
    this.setData({ puzzlePieces: pieces, showProgress: true });
  },

  removePiece(e) {
    const id = e.currentTarget.dataset.id;
    const pieces = this.data.puzzlePieces.map(p => p.id === id ? { ...p, removed: true } : p);
    const removedCount = pieces.filter(p => p.removed).length;
    const newRelief = this.data.reliefValue + 8;
    tracker.track(_session, "click");
    tracker.track(_session, "relief", { value: newRelief });

    this.setData({ puzzlePieces: pieces, removedCount, reliefValue: newRelief });
    wx.vibrateShort();
    this.updateProgress();
    if (removedCount >= this.data.totalPieces) this.finish();
  },

  // ── companion: 陪伴 ──
  startCompanion() {
    const interval = setInterval(() => {
      const word = COMPANION_WORDS[Math.floor(Math.random() * COMPANION_WORDS.length)];
      this.setData({ companionWord: word });
    }, 30000);
    this.setData({ companionInterval: interval });
  },

  // companion 专属计时器（45秒自动结束）
  startCompanionTimer() {
    let timeLeft = COMPANION_DURATION;
    const interval = setInterval(() => {
      timeLeft--;
      this.setData({ timeLeft });
      if (timeLeft <= 0) {
        clearInterval(interval);
        this.finish();
      }
    }, 1000);
    this.setData({ companionTimerInterval: interval });
  },

  onCompanionTap() {
    const { companionTapCount, reliefValue, _session } = this.data;
    tracker.track(_session, "click");
    const newRelief = reliefValue + 1;
    tracker.track(_session, "relief", { value: newRelief });

    const faces = ["🌙", "🤗", "✨", "💛", "🌟", "🫂"];
    this.setData({
      companionTapCount: companionTapCount + 1,
      companionText: faces[(companionTapCount + 1) % faces.length],
      companionWord: COMPANION_WORDS[Math.floor(Math.random() * COMPANION_WORDS.length)],
      reliefValue: newRelief
    });
    this.updateProgress();
  },

  onShareAppMessage() {
    const { emotion, reliefValue, _session } = this.data;
    // ── 埋点：标记 share ──
    if (_session) tracker.mark(_session, "share");
    return {
      title: `${emotion.icon} 我刚刚${emotion.name}了 ${Math.min(100, Math.floor(reliefValue))}%，你也来试试！`,
      path: `/pages/home/home`
    };
  }
});
