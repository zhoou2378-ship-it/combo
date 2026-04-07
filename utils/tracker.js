/**
 * 埋点模块
 * 存储结构：
 *   sessions[]    已完成的完整记录
 *   current       当前进行中的 session（含 pending 待补全的字段）
 *   pending       等待 flush 时机填入的字段（replay / share / duration）
 */

const STORAGE_KEY = "tracker_v1";

// ── 基础工具 ──────────────────────────────────────
function now() {
  return Date.now();
}

// ── 初始化 ──────────────────────────────────────
function init() {
  const raw = wx.getStorageSync(STORAGE_KEY) || {};
  return {
    sessions: raw.sessions || [],
    current: null
  };
}

// ── 启动一次游戏 session ──────────────────────────
function start(emotionId, emotionName, gameMode) {
  return {
    sessionId: now(),
    emotionId,
    emotionName,
    gameMode,
    startTime: now(),
    endTime: null,
    duration: 0,
    // 过程指标（各 game 自行 track）
    reliefValue: 0,
    maxCombo: 0,
    totalClicks: 0,
    // 增长指标（finish / mark 后填充）
    replay: false,
    share: false
  };
}

// ── 过程埋点 ──────────────────────────────────────
function track(session, event, data = {}) {
  // 目前先合并到 session 里，flush 时一起上报
  if (event === "click") session.totalClicks++;
  if (event === "max_combo" && data.value > (session.maxCombo || 0)) {
    session.maxCombo = data.value;
  }
  if (event === "relief" && data.value !== undefined) {
    session.reliefValue = data.value;
  }
}

// ── 标记 replay / share（可多次调用，最终取 true） ──
function mark(session, flag) {
  if (flag === "replay") session.replay = true;
  if (flag === "share")  session.share  = true;
}

// ── 结束 session，计算 duration ───────────────────
function finish(session) {
  session.endTime  = now();
  session.duration = Math.round((session.endTime - session.startTime) / 1000); // 秒
  // replay/share 若仍为 false，说明用户没点按钮，自然流失
  return session;
}

// ── 写入本地 + 打印（云开发时替换为 wx.cloud.callContainer） ──
function flush(session) {
  const raw = wx.getStorageSync(STORAGE_KEY) || { sessions: [] };
  raw.sessions.unshift(session);
  // 最多保留 100 条
  if (raw.sessions.length > 100) raw.sessions.length = 100;
  wx.setStorageSync(STORAGE_KEY, raw);

  // 开发调试：打印到 console
  console.log("📊 [tracker] flush →", JSON.stringify(session, null, 2));
}

// ── 获取全部历史（供 history 页用） ───────────────
function getAll() {
  return (wx.getStorageSync(STORAGE_KEY) || { sessions: [] }).sessions;
}

// ── 指标计算（增长分析用） ─────────────────────────
/**
 * 计算关键增长指标：
 *   - replay_rate   : 二次游玩率（replay / total）
 *   - share_rate    : 分享率（share / total）
 *   - avg_duration  : 平均游戏时长（秒）
 *   - avg_relief    : 平均释放值
 *   - top_emotion   : 最受欢迎情绪
 */
function calcMetrics(sessions) {
  if (!sessions.length) return null;
  const n = sessions.length;
  const replayCount = sessions.filter(s => s.replay).length;
  const shareCount  = sessions.filter(s => s.share).length;

  const emotionCount = {};
  sessions.forEach(s => {
    emotionCount[s.emotionName] = (emotionCount[s.emotionName] || 0) + 1;
  });
  const topEmotion = Object.entries(emotionCount)
    .sort((a, b) => b[1] - a[1])[0]?.[0] || "-";

  return {
    total_games:  n,
    replay_rate:  (replayCount / n * 100).toFixed(1) + "%",
    share_rate:   (shareCount  / n * 100).toFixed(1) + "%",
    avg_duration: Math.round(sessions.reduce((s, r) => s + (r.duration || 0), 0) / n) + "s",
    avg_relief:   Math.round(sessions.reduce((s, r) => s + (r.reliefValue || 0), 0) / n),
    top_emotion:  topEmotion
  };
}

module.exports = { init, start, track, mark, finish, flush, getAll, calcMetrics };
