@echo off
rem Double-click to put the Puzzle Shelf scores Worker on your Cloudflare account (see README.md beside this file).
cd /d "%~dp0"
echo.
echo  Deploying the Puzzle Shelf scores Worker to your Cloudflare account...
echo  If a browser window opens, sign in to Cloudflare and click Allow, then come back here.
echo.
call npx --yes wrangler deploy
echo.
echo  When it worked, the address ends in .workers.dev (just above).
echo  Copy it, then in Puzzle Shelf hold the clock on the shelf for two seconds,
echo  tick "Real scores from last night" and paste the address.
echo.
pause
