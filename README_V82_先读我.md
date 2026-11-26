# STORMWAKE V82
完整解压后双击 `00_START_V82.cmd`。Windows 需要 Python 3；联机房主还需要 Node.js 22+，允许 TCP 5174。原始资源已保留，不要与 V81 手动合并。

新增碰撞、相机、门板扫掠防夹、移动船表面、异步建筑防穿模与持续交互锁定等修复。详见 `docs/V82_EXECUTION_zh.md` 和 `docs/V82_ACCEPTANCE.csv`。

CPU/协议测试：`npm run test:v82`。真实 WebGPU 视觉、全流程通关以及多人压力验收仍是发布前硬门槛。
