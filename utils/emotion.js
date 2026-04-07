/**
 * 情绪配置 - 整个产品的数据驱动层
 * type: release(发泄) | calm(舒缓) | heal(治愈)
 * game: hit(砸击) | explode(爆炸) | breath(呼吸) | tap(敲击) | puzzle(拼图) | companion(陪伴)
 */
const emotions = [
  {
    id: "angry",
    name: "烦躁",
    type: "release",
    game: "hit",
    color: "#FF5A5A",
    icon: "💢",
    desc: "砸碎它，释放怒火"
  },
  {
    id: "rage",
    name: "生气",
    type: "release",
    game: "explode",
    color: "#FF2E2E",
    icon: "🤬",
    desc: "一触即爆，彻底炸裂"
  },
  {
    id: "anxiety",
    name: "焦虑",
    type: "calm",
    game: "breath",
    color: "#5AAEFF",
    icon: "😰",
    desc: "跟着节奏，慢慢呼气"
  },
  {
    id: "stress",
    name: "压力",
    type: "calm",
    game: "tap",
    color: "#7B6EFF",
    icon: "😣",
    desc: "有节奏地敲击，释放压力"
  },
  {
    id: "sad",
    name: "难过",
    type: "heal",
    game: "puzzle",
    color: "#8ED1C2",
    icon: "😢",
    desc: "拼起碎片，治愈自己"
  },
  {
    id: "lonely",
    name: "孤独",
    type: "heal",
    game: "companion",
    color: "#FFD58A",
    icon: "🌙",
    desc: "感受陪伴，你不是一个人"
  }
];

module.exports = { emotions };
