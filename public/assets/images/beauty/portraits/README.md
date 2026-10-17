# Portrait 模式素材

当前游戏使用 41 张 Pixabay AI 成人女性素材，涵盖泳装、蕾丝、礼服和插画风格。来源与授权记录见 [sources.json](sources.json)，原始下载文件保存在 `../downloads/glamour/`、`../downloads/glamour-02/` 和 `../downloads/glamour-03/`。

运行图片为 640×800 WebP，质量 82，按原图比例缩放，空白处以深蓝背景补齐，不拉伸人物或裁去画面。可在项目根目录运行 `python scripts/prepare-portrait-assets.py` 重新生成。

Portrait 模式共有 84 关，循环复用经典模式的 9 套关卡（10 个地图章节，最后一章 3 关），直接加载经典关卡 JSON 的棋盘、障碍、颜色、目标和步数。前 54 关保留原先 11 张图片的顺序；新增第 55—84 关分别使用 30 张不同的新图片。重复图片共享纹理缓存。通关进度继续使用原有存档，与经典模式的金币、生命和进度分开。

授权：[Pixabay Content License](https://pixabay.com/service/license-summary/)。在条款范围内免费使用及修改，无强制署名要求；禁止基本保持原样的独立素材转售或分发。完整条款见 [Pixabay Terms](https://pixabay.com/service/terms/)。
