# STORMWAKE V79 P0 — 完整设计与第一批基础修复（非精品成品）

使用 7-Zip 完整解压，双击 `00_START_V79.cmd`。单人 Python 3.10+ 与支持 WebGPU 的 Chrome/Edge；多人房主另需 Node.js 22+。原有 V78 全部资源、历史设计与日志保留。启动前备份浏览器本地存档。此版继续使用同源既有存档，新增远征奖励待发放记录；不主动清空旧进度。

- `docs/V79_MASTER_DESIGN_zh.md`：总体设计、动作、场景、船艇、生态、经济、联网和验收规范。
- `docs/V79_EXECUTION_zh.md`：实际实现、测试与阻塞，不将设计目标计为已实现。
- `docs/V79_ACCEPTANCE_MATRIX.csv`：后续逐项验收门禁。
- `npm run test:v79`：新增 8 项专项及已有 V78 回归。可另执行 `node --test test/stormwake-v79.mjs`。

本轮：按键自动重复、编辑框焦点、非有限鼠标输入、Shift+P 归属、跨场景遗留交互候选、无效交互距离、单帧重复派发、帧时显示真实性、旧交易失败回滚、陆地奖励重试。没有宣称新的地下世界、潜艇舱口、所有动画、海洋生态或专用服务器已完成。HTTP 可用不等于 WebGPU 画面验证；当前环境浏览器访问被管理员策略阻止。旧自研 WebGPU/WGSL 引擎保留，并非官方 Three.js+TSL。
