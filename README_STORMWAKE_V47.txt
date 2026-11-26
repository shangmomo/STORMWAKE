STORMWAKE V47 — ACTUAL CC0 DUTCH SHIP ASSET INTEGRATION PREVIEW

1. Windows: double-click START_STORMWAKE_V47.cmd (requires Python 3.10+).
   Other OS: python start_v47.py
2. The local browser page should open at:
   http://127.0.0.1:5173/?stormwake=1&heritageShip=1
   If it doesn't, paste the address into Chrome/Edge on the same computer.
3. For legacy small-ship fallback, remove &heritageShip=1 from the URL.
4. Fully offline file-level and logic tests: npm run test:v47
5. Chinese engineering/QA plan:
   docs/STORMWAKE_V47_真实复古船_施工图与验收标准.md

ACTUAL ASSETS ARE INCLUDED: Poly Haven Dutch Ship Medium (source .blend),
Kenney Pirate Kit and Quaternius Pirate Kit were directly supplied by the user,
converted and added to public/models/stormwake_v47/.

NOT YET LIVE-VERIFIED: camera/character clipping, exact watertight compartment,
all item interaction loops, animated sails, browser shader compilation and
final high-quality weather/vortex VFX. Do not present this as final gameplay QA.
