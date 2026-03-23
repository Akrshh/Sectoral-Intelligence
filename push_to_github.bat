@echo off
set PATH=%PATH%;C:\Program Files\Git\cmd
cd /d C:\Users\HP\.gemini\antigravity\scratch\sectoral-intelligence

git add .
git commit -m "Fix: safety timeout for loading overlay + Node engine requirement"
git push origin main

echo.
echo === Done! Render will auto-redeploy in 2-3 minutes ===
