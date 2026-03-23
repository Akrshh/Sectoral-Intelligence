@echo off
set PATH=%PATH%;C:\Program Files\Git\cmd
cd /d C:\Users\HP\.gemini\antigravity\scratch\sectoral-intelligence

git add .
git commit -m "Fix: delay data fetch on startup so pages load instantly on Render"
git push origin main

echo === Done! Render will redeploy in 2-3 min ===
