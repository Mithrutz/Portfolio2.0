@echo off
echo ============================================================
echo Portfolio Manager — Build Windows (.exe)
echo ============================================================
python -m pip install -r requirements.txt
python -m pip install pyinstaller pywebview
echo.
echo Building PortfolioManager.exe...
echo.
python -m PyInstaller --onefile --windowed --name PortfolioManager ^
  --icon assets\icon.ico ^
  --add-data "frontend;frontend" ^
  run.py
echo.
if exist dist\PortfolioManager.exe (
    echo SUCCESS! dist\PortfolioManager.exe
    echo.
    echo NOTE: portfolio_data.json is NOT bundled.
    echo The app will use built-in demo data on first run.
    echo To use your own data, copy portfolio_data.json next to the .exe.
) else (
    echo BUILD FAILED - check errors above
)
pause
