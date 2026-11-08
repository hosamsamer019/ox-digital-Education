@echo off
:: Forward to "start server.bat" to ensure unified behavior
call "%~dp0start server.bat" %*
exit /b %errorlevel%
