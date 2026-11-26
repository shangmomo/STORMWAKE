"""V73 launcher: fail early when run from an uninstalled payload."""
from pathlib import Path
import sys
ROOT=Path(__file__).resolve().parent
required=('start_v38.py','start_v60.py','src/main.js','public/models/abyss/deepsea-demon-whale.glb','server/coopServer.js','src/oceanhunt/AbyssInterior.js','src/core/ControlPolicy.js','src/ui/HUDMode.js','src/ui/hud-v67.css','src/oceanhunt/TitanAI.js','src/ship/SailReefing.js','src/land/ExpeditionTerrain.js','src/land/ExpeditionSites.js','src/land/ExpeditionArt.js','src/land/FossilSurvey.js','src/land/RexEncounter.js','src/land/RexBrain.js','src/land/RexAsset.js','public/models/land/trex-v71.glb','public/models/land/trex-v71.json','src/land/ExpeditionAssetsV73.js','src/land/BearBrainV73.js','public/models/land/v73/manifest.json','public/models/land/v73/bear.glb','public/models/land/v73/captain.glb','public/models/land/v73/interior.glb','public/models/land/v73/house.glb')
missing=[n for n in required if not (ROOT/n).is_file()]
if missing:
    print('STORMWAKE V73 incomplete. Re-extract the entire STORMWAKE_V73_Expedition.zip. Missing: '+', '.join(missing),file=sys.stderr)
    raise SystemExit(2)
from start_v60 import main
if __name__=='__main__': raise SystemExit(main())
