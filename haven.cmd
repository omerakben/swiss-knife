@echo off
rem Haven Desk launcher for Windows - forwards to haven.ps1 without requiring
rem the user to loosen their PowerShell execution policy.
rem   haven setup | up | down | status | doctor
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0haven.ps1" %*
