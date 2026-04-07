const { emotions } = require("../../utils/emotion");
const tracker = require("../../utils/tracker");

Page({
  data: {
    emotion: {},
    relief: 0,
    maxCombo: 0
  },

  onLoad(options) {
    wx.showShareMenu({ withShareTicket: true });

    const relief    = parseInt(options.relief)     || 0;
    const maxCombo  = parseInt(options.maxCombo)  || 0;
    const emotion   = emotions.find(e => e.id === options.emotionId) || emotions[0];

    // ── 埋点：从 storage 找到最新 session，标记 replay ──
    const sessions = tracker.getAll();
    const latest = sessions[0];
    if (latest) tracker.mark(latest, "replay");

    this.setData({ relief, maxCombo, emotion });
  },

  restart() {
    wx.reLaunch({ url: `/pages/game/game?emotionId=${this.data.emotion.id}` });
  },

  goHome() {
    wx.reLaunch({ url: "/pages/home/home" });
  },

  onShareAppMessage() {
    const { relief, emotion } = this.data;
    return {
      title: `${emotion.icon} 我刚刚释放了${relief}%的${emotion.name}，你也来试试！`,
      path: "/pages/home/home"
    };
  }
});
