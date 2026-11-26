# V66 验收记录（2026-11-24）

## 已执行
- `node --test test/stormwake-v66.mjs`：13/13，通过。含 7 技能三维碰撞、实例矩阵有限、舱壁门洞/控制台、局部相机、驾驶/资源、三武器、六任务日志、房间授权。
- `node test/stormwake-v66-ws.mjs`：真实四客户端 WebSocket 通过；实际加入、共享技能与 HP、走过舱壁、驾驶和武器命令、错误岗位拒绝、伪造快照拒绝、房主断开关闭。
- `npm run test:v65`：退出码 0，原主回归套件全部通过（包含 V65 八项专项及历史多客户端）。
- `node test/stormwake-v30.mjs`、`node test/stormwake-v27.mjs`、`node test/stormwake-v36.mjs`：退出码 0；驾驶物理、海神咬合、陆战动画/骨骼与命中时间。
- `python start_v66.py --help`：通过；启动前验证原始启动模块及主要资源。

## 尚未验收 / 已知问题
- 当前环境没有完成实际浏览器 WebGPU 图形运行，故不能确认实机视觉、着色器编译、FPS、四个浏览器完整游戏画面以及从开始到击败海神的全程。
- 之前 V65 的 47 个额外历史脚本中有 21 个已存在的失败（含过期断言），本轮未逐项重跑或消除；详见 V65 报告。不能宣称零 Bug。
- 终章多人为房主模拟、服务器权限校验；未实现专用服务器完整战斗权威、房主迁移、断线恢复。完整舱口、复杂舱体破损、真实流体计算、武器专用动画和陆战联网均待后续设计实现。

## 全新安装验收
使用用户最初的 V64 ZIP，执行 `install_v66.py --source <原ZIP> --output <新目录> --no-open`，成功生成 1,185 个尺寸校验文件；安装时自动运行新启动器帮助命令。独立安装目录运行 `python start_v66.py --mode solo --port 0 --no-browser`，正常启动 HTTP 服务；主页、main.js、AbyssRaid.js、AbyssInterior.js、LeviathanSpells.js、PersonalWeapons.js、MissionLog.js 和深海魔鲸号 GLB 全部 HTTP 200。独立安装目录再运行 V66 单测，13/13 通过。此为真实启动服务与资源读取验证，非浏览器画面验证。
