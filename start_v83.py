"""V83.2 launcher: fail early when run from an uninstalled payload."""
from pathlib import Path
import sys
ROOT=Path(__file__).resolve().parent
required=('start_v38.py','start_v60.py','src/main.js','public/models/abyss/deepsea-demon-whale.glb','server/coopServer.js','src/oceanhunt/AbyssInterior.js','src/core/ControlPolicy.js','src/ui/HUDMode.js','src/ui/hud-v67.css','src/oceanhunt/TitanAI.js','src/ship/SailReefing.js','src/land/ExpeditionTerrain.js','src/land/ExpeditionSites.js','src/land/ExpeditionArt.js','src/land/FossilSurvey.js','src/land/RexEncounter.js','src/land/RexBrain.js','src/land/RexAsset.js','public/models/land/trex-v71.glb','public/models/land/trex-v71.json','src/land/ExpeditionAssetsV73.js','src/land/BearBrainV73.js','public/models/land/v73/manifest.json','public/models/land/v73/bear.glb','public/models/land/v73/captain.glb','public/models/land/v73/interior.glb','public/models/land/v73/house.glb','src/land/ExpeditionWildlifeV74.js','public/models/expedition/v74/manifest.json','public/models/expedition/v74/ptero.glb','public/models/expedition/v74/wolf.glb','public/models/expedition/v74/ray.glb','public/models/expedition/v74/grotto.glb','public/models/expedition/v75/rock.glb','public/models/expedition/v75/captain-motion.json','public/models/expedition/v75/manifest.json','src/land/ExpeditionRockV75.js','src/land/CaptainMotionV75.js')
required+=tuple('public/models/expedition/v76/'+n+'.glb' for n in ('rock02','mountain','fern','tavern','forge'))+('src/land/ExpeditionSceneryV76.js','src/land/ScenerySitesV76.js')
required+=('src/land/ExpeditionServicesV77.js','src/game/LandForge.js','src/land/expedition-v77.css')
required+=('src/player/LandMotorV78.js','src/core/RuntimeRecoveryV78.js')
required+=('src/core/FrameTimingV79.js','src/interact/InteractionGeometryV79.js','src/land/LandRewardOutboxV79.js','docs/V79_MASTER_DESIGN_zh.md')
required+=('src/oceanhunt/PressureSystemsV80.js','src/land/MineReservoirV80.js','docs/V80_EXECUTION_zh.md')
required+=('src/land/MineLiftV81.js','src/game/FishStockV81.js','src/post/LocalWaterV81.js','docs/V81_EXECUTION_zh.md')
required+=('test/stormwake-v82.mjs','docs/V82_EXECUTION_zh.md','src/systems/MovingSurfaceWorld.js')
required+=('src/oceanhunt/AbyssHatchV83.js','src/land/LurkerV83.js','src/land/MineLiftRulesV83.js','server/mineLiftRoomV83.js','test/stormwake-v83.mjs','test/stormwake-v83-ws.mjs','docs/V83_EXECUTION_zh.md')
required+=('src/land/CaveSurfaceV831.js','test/stormwake-v831.mjs')
missing=[n for n in required if not (ROOT/n).is_file()]
if missing:
    print('STORMWAKE V83.2 incomplete. Update or re-extract the complete repository. Missing: '+', '.join(missing),file=sys.stderr)
    raise SystemExit(2)
from start_v60 import main
if __name__=='__main__': raise SystemExit(main())
