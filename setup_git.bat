@echo off
set PATH=%PATH%;C:\Program Files\Git\cmd
cd /d C:\Users\HP\.gemini\antigravity\scratch\sectoral-intelligence

echo === Git Version ===
git --version

echo.
echo === Initializing Git Repository ===
git init
git add .
git config user.email "user@example.com"
git config user.name "User"
git commit -m "Sectoral Intelligence System v1.0"
git branch -M main

echo.
echo === Done! Repository ready. ===
echo Now you need to connect to GitHub.
