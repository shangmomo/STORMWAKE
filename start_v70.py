"""V70 launcher: fail early when run from an uninstalled payload."""
from pathlib import Path
import sys
ROOT=Path(__file__).resolve().parent
required=('start_v38.py','start_v60.py','src/main.js','public/models/abyss/deepsea-demon-whale.glb','server/coopServer.js','src/oceanhunt/AbyssInterior.js','src/core/ControlPolicy.js','src/ui/HUDMode.js','src/ui/hud-v67.css','src/oceanhunt/TitanAI.js','src/ship/SailReefing.js','src/land/ExpeditionTerrain.js','src/land/ExpeditionSites.js')
missing=[n for n in required if not (ROOT/n).is_file()]
if missing:
    print('STORMWAKE V70 incomplete. Re-extract the entire STORMWAKE_V70_Land_Expedition.zip. Missing: '+', '.join(missing),file=sys.stderr)
    raise SystemExit(2)
from start_v60 import main
if __name__=='__main__': raise SystemExit(main())
