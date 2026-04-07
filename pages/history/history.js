const tracker = require("../../utils/tracker");

Page({
  data: {
    records: [],
    metrics: null
  },

  onShow() {
    const sessions = tracker.getAll();

    // ── 历史记录列表（复用 records 格式，补充 emotion 信息） ──
    const records = sessions.slice(0, 20).map(s => ({
      emotionId:   s.emotionId,
      name:         s.emotionName || "-",
      color:        s.emotionColor || "#888",
      percent:      Math.min(100, Math.floor(s.reliefValue || 0)),
      maxCombo:     s.maxCombo     || 0,
      reliefValue:  s.reliefValue  || 0,
      date:         s.endTime ? new Date(s.endTime).toLocaleDateString("zh-CN") : "-",
      duration:     s.duration    || 0,
      replay:       s.replay,
      share:        s.share
    }));

    // ── 增长指标汇总 ──
    const metrics = tracker.calcMetrics(sessions);

    this.setData({ records, metrics });
  }
});
