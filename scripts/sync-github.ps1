param(
    [string]$Message = ""
)

$ErrorActionPreference = "Stop"
Set-Location (Resolve-Path (Join-Path $PSScriptRoot ".."))

git add -A
$status = git status --porcelain
if (-not $status) {
    git push origin HEAD
    Write-Host "GitHub is up to date."
    exit 0
}

if (-not $Message) {
    $Message = "Update Peakwise $(Get-Date -Format 'yyyy-MM-dd HH:mm')"
}

git commit -m $Message
git push origin HEAD
Write-Host "Pushed to https://github.com/Arnold-RG/peakwise"
