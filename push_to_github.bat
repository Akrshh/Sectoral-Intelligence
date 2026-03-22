@echo off
set PATH=%PATH%;C:\Program Files\Git\cmd
cd /d C:\Users\HP\.gemini\antigravity\scratch\sectoral-intelligence

echo === Adding new files ===
git add .

echo === Committing ===
git commit -m "v2.0: Self-Learning ML Engine + Professional Indicators (MACD, BB, ATR, OBV, FII/DII, PCR)"

echo === Pushing to GitHub ===
git push origin main

echo.
if %ERRORLEVEL%==0 (
    echo === SUCCESS! Updated code pushed to GitHub ===
    echo Render.com will auto-deploy in 2-3 minutes
) else (
    echo === Push failed. Check credentials. ===
)
