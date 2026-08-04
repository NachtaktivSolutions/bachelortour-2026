param(
  [Parameter(Mandatory=$true)]
  [string]$RepoUrl
)

$ErrorActionPreference = "Stop"

Write-Host "Pruefe Git..." -ForegroundColor Cyan
if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
  Write-Host "Git ist nicht installiert. Bitte zuerst GitHub Desktop installieren: https://desktop.github.com/" -ForegroundColor Red
  exit 1
}

Set-Location $PSScriptRoot

if (-not (Test-Path ".git")) {
  git init
}

git add .
git commit -m "Complete Bachelortour 2026 app" 2>$null
git branch -M main

$existing = git remote 2>$null
if ($existing -contains "origin") {
  git remote set-url origin $RepoUrl
} else {
  git remote add origin $RepoUrl
}

Write-Host "Lade Projekt zu GitHub hoch..." -ForegroundColor Cyan
git push -u origin main --force

Write-Host ""
Write-Host "Fertig. GitHub enthaelt jetzt auch app, components, lib, public und supabase." -ForegroundColor Green
