# Portrait 模式素材

当前游戏使用 84 张不同的 Pixabay 成年女性素材，包含 AI 插画和摄影，涵盖比基尼、泳装、蕾丝和礼服风格。本轮新增 43 张，替换重复关卡的图片。来源、下载地址与文件校验值见 [sources.json](sources.json)，原始文件保存在 `../downloads/glamour/` 至 `../downloads/glamour-04/`。

运行图片为 640×800 WebP，质量 82，按原图比例缩放，空白处以深蓝背景补齐，不拉伸人物或裁去画面。可在项目根目录运行 `python scripts/prepare-portrait-assets.py` 重新生成。

Baddie Mode 共有 84 关（10 个地图章节，最后一章 3 关），每关使用一张独立图片。第 1—20 关使用从 MIT 项目 AlperenGarip/Match3 导入的完整布局；第 21—84 关继续循环复用经典模式的 9 套配置。导入布局保留全部格子和原步数，障碍和特殊宝石适配为本游戏机制，详见 `reference/match3-levels/README.md`。第 1—11 关及第 55—84 关的图片不变，第 12—54 关改用本轮新增图片。关卡 ID 和原有通关存档保持兼容。

授权：[Pixabay Content License](https://pixabay.com/service/license-summary/)。在条款范围内免费使用及修改，无强制署名要求；禁止基本保持原样的独立素材转售或分发。完整条款见 [Pixabay Terms](https://pixabay.com/service/terms/)。

Baddie Mode 的关卡内已接入经典模式的锤子、交换、火箭和洗牌道具，共用玩家背包。点击按钮后选择棋盘目标，或从按钮直接拖到目标；交换需要选择两颗不同且可移动的宝石。有效使用扣一件库存，不消耗关卡步数，消除与连锁计入关卡目标和揭图进度。点击同一道具按钮可取消选择，暂停会清除选择。空库存、无效目标、忙碌和结束状态不会扣道具。
