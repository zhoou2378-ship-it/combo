const { emotions } = require("../../utils/emotion");
const tracker = require("../../utils/tracker");

Page({
  data: { emotions },

  selectEmotion(e) {
    const emotion = e.currentTarget.dataset.emotion;
    // ── 埋点：情绪选择事件 ──
    console.log("📊 [tracker] emotion_select →", emotion.id, emotion.name);
    wx.navigateTo({
      url: `/pages/game/game?emotionId=${emotion.id}`
    });
  },

  goHistory() {
    wx.navigateTo({ url: "/pages/history/history" });
  }
});
