const tracker = require("./utils/tracker");

App({
  onLaunch() {
    // 初始化埋点系统
    tracker.init();
  }
});
