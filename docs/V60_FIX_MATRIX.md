# STORMWAKE V60 · 对两份设计文档的实现与验收矩阵（2026-11-15）

声明：以下“逻辑通过”仅指源码、Node 或真实 WebSocket 测试，不等价于浏览器视觉通过。源码改动只做了本轮列出的项目；严格跟踪未完成设计，不用“完美”掩盖缺口。

| 设计需求 | V60 代码入口 | 当前状态 | 证据 / 未通过界限 |
|---|---|---|---|
| FIX-001 锚机 E 聚焦 / 四人占位 | `src/voyage/VoyageM1.js`, `ShipStations.js` | 已改，逻辑通过，未实机视觉通过 | 交互优先级与岗位抢占测试；需真人从各角度操作 |
| FIX-002/007 干舱海水穿透 | `src/App.js`, `WaterMaterial.js` | 已修复全局隐藏策略，视觉未验收 | Ocean 恒可见 + 现有局部裁剪；须逐帧检查舱窗/高浪/左右倾斜 |
| FIX-003 开场遮罩挡 QA 截图 | `tools/autoqa/runner.py` | 已改，浏览器未验收 | 不再允许遮罩未退即开始可视截图 |
| FIX-004 远海传送失效 | `src/qa/AutoQA.js` | 已改，待 GPU/地形实测 | 按地形深度动态选择 QA 位置 |
| FIX-005 404 资源 URL 丢失 | `tools/autoqa/runner.py` | 已补记录，待浏览器执行 | 将 4xx/5xx URL 写入报告 |
| 舵/帆/锚水动力与自然移动 | `src/player/BoatController.js`, `ShipAnchorTether.js` | 锚链已改且专项逻辑通过；整体航行动画未实测 | 取消一刀切速度衰减、接触力按积分；需要实机手感校准 |
| 舱段真实漏水与舀水 | `HullCompartments.js`, `ShipDamage.js`, `DutchLowerHold.js` | 已改，专项逻辑通过；视觉待验收 | 三舱段局部入水、互通、积水 mesh / 修理 / 桶排水 |
| 同船 4 人岗位网络同步 | `ShipNetBridge.js`, `server/coopHub.js` | 原 V58 逻辑回归继续通过 | 保留 4 人联机接口、跨玩家操舵/炮位；未验证 4 人长期实机同步 |
| 多人任务货物可取放 | `CargoReach.js`, `VoyageM1.js`, `server/coopHub.js`, `CoopClient.js` | 新增实现，真实 2 WebSocket 客户端通过 | 位置、楼层和独占权、货舱取回、断线后可取回测试 |
| 任务完成与单次奖励 | `VoyageDirector.js`, `CoopHub` | 旧任务逻辑回归通过 | 4s 挖掘+入舱+港口一次结算；未做实机全程 |
| 舱门/楼梯无穿模 | Player + ShipLadder + GLB | 未完成，需 geometry/BVH 实装与实测 | 不能据当前逻辑测试宣称完全无穿模 |
| 真实可见高品质海怪骨骼接触 | Titan modules | 沿用 V58，未达新 GDD 目标 | 未做新 3A 骨骼与多阶段接触动画 |
| 全新海难搜救、幽灵舰队任务链、经济平衡 | GDD 第二份 | 尚未开发为新任务 | 第二份 GDD 属计划，不是 V60 功能 |
| 真实 GPU 画质/性能/连续体验 | Browser AutoQA | 环境阻塞，不可验收 | 当前环境 `ERR_BLOCKED_BY_ADMINISTRATOR`，必须在本地真实 GPU 运行 |

**检查命令**：`npm run test:v60`（本轮 exit 0），`python start_v60.py --mode solo --no-browser --port 5183` + HTTP 主页面/船 GLB/JS 请求抽检（均 200）。扩展 `npm test` 缺可选 dev dependency `webgpu`，需要先 `npm ci`。
