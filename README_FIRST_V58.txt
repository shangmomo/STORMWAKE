STORMWAKE V58 - AutoQA + Ship Visual Refinement

1. 单人 / 联机启动：双击 00_START_V58.cmd
2. WebGPU 自动验收：双击 00_RUN_AUTOQA_V58.cmd
3. 可选的 AI 辅助修复循环：00_AUTOFIX_V58.cmd（需自行安装并登录 Codex CLI，显式选择授权）
4. 测试完成后：打开 autoqa_reports/<最新日期>/VISUAL_REPORT.html 查看证据、截图和日志。

要求：Windows 10/11 + Chrome/Edge (WebGPU) + Python 3.10+。
自动验收首次需安装 Python playwright / Pillow，双客户端测试需 Node.js 22+。
自动化不能证明美术达到商业 3A 水平；版本仍需视觉审查。
详见 README_STORMWAKE_V58_AUTOQA_与画面升级.md
