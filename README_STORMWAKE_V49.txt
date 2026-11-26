STORMWAKE V49 — 原版 Dutch Ship 原始模型修复工程

这是基于你提供的原始 dutch_ship_medium_4k.blend.zip 重新导出的真实船模版本。
不再叠加 V48 程序生成的假甲板、假船长室、假屋顶、家具和假舱口。
本包保留原项目海洋、任务、物品、海怪和所有源码，是单一完整工程 ZIP。

运行：Windows 双击 START_STORMWAKE_V49.cmd。
或 Python 3.10+ 执行 python start_v49.py。
浏览器：Chrome / Edge 打开 http://127.0.0.1:5173/?stormwake=1&heritageShip=1

重要：原始 Dutch Ship 不是带可游玩内舱的游戏资产，无法不经 Blender 改模就
得到可穿行的船长室。本版本主动禁用 V48 错误的假舱门和瞬移式下舱操作。
已修复的是来源一致性和主要位置/逻辑，不是已完成零穿模实机 QA。

登船：靠近舷梯 W/Space；离船：甲板越舷跳海；E 使用工作岗位，G 放下物品。
测试：npm run test:v49（需要 Node.js），含原始船模与旧版回归。
详细说明：docs/STORMWAKE_V49_原始DutchShip船体_改造与真实验收.md
