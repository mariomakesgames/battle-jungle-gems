# 网上现成 Match-3 关卡设计

检查日期：2026-10-17。以下两组数据已下载到项目，保留 MIT 许可证、来源提交与文件校验记录。第一组的 20 个布局已适配到 Portrait 前 20 关；第二组仅作为参考。

## 1. AlperenGarip/Match3：20 个完整布局

- 项目：https://github.com/AlperenGarip/Match3
- 固定版本：`d83c68675796f75749c5867d2d0cf24a2d460e1a`
- 数据：[original/](alperen-garip/original/)
- 授权：[MIT LICENSE](alperen-garip/LICENSE)，原作者明确将关卡数据纳入许可。
- 校验：[source.json](alperen-garip/source.json)

已检查 20 个 JSON，棋盘数组长度均与宽高一致，20 份完整布局均不相同。包含不同尺寸、边框、金字塔、迷宫、障碍分布及预置道具；每关有步数配置。

格式：`level_number`、`grid_width`、`grid_height`、`move_count`、一维 `grid`。格子编码包括颜色 `r/g/b/y`、随机 `rand`、箱子 `bo`、石头 `s`、双击花瓶 `v`、横纵火箭 `hro/vro`、炸弹 `tnt` 和彩球 `lb`。

已通过 `scripts/import-match3-levels.py` 转换到 `public/assets/levels/imported/`。完整保留宽高、格子位置和原始步数，较小棋盘以空洞补齐，10 格关卡按 10×10 逻辑网格缩放显示。盒子和石头映射为一击 stone，花瓶映射为两击 stone，目标为清除全部障碍。横纵火箭映射为现有 stripe，TNT 映射为 bomb，彩球映射为 color_bomb；道具范围与交互遵循本游戏规则。经典模式和 AI 对战默认仍为 9×9。

## 2. ShaistaShabbir-prog/candy-crush-match3：250 份关卡参数

- 项目：https://github.com/ShaistaShabbir-prog/candy-crush-match3
- 原始定义：[original-levels.js](candy-crush-match3/original-levels.js)，只提取 `LEVELS` 数据，未运行外部代码。
- 可读取 JSON：[levels.json](candy-crush-match3/levels.json)
- 授权：[MIT LICENSE](candy-crush-match3/LICENSE)
- 固定来源与校验：[source.json](candy-crush-match3/source.json)

项目说明和源码注释写 100 关，检查当前代码实际提取到 250 条，编号唯一。参数包括名称、主题、分数目标、步数、颜色数、锁定格数量、炸弹和 Boss 标记。

这组使用统一 8×8 棋盘，主要提供难度与目标参数，**不包含 250 种手工棋盘形状**。适合参考长线难度曲线；其分数、连击及锁定格机制与本游戏不同，不能把原分数目标直接当作已经平衡的目标。

## 另一个候选

https://github.com/thefcan/unity-match3 提供 120 个 Unity `.asset` 关卡及更丰富的机制，但本次检查仓库文件树未找到明确许可证。因此只做了临时研究，未将其关卡复制进本参考资料库。

## 结论

第一组已接入 Portrait 第 1—20 关，第二组仍只供参考。游戏总数保持 84 关，第 21—84 关仍使用原经典配置；不能表述为已有 84 个不同布局或已经增加了 270 个可玩布局。
