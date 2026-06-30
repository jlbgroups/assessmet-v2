param (
    [string]$BaseUrl = "http://127.0.0.1:8000",
    [int]$AssessmentId = 1,
    [int]$Vus = 0,
    [string]$Duration = "90s",
    [string]$Script = "load_test.js"
)

$ErrorActionPreference = "Stop"

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "         AssessPro AI Incremental Load Testing Suite       " -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "Target Base URL:      $BaseUrl"
Write-Host "Target Assessment ID: $AssessmentId"
Write-Host "Level Duration:       $Duration"
Write-Host "==========================================================" -ForegroundColor Cyan

if (-not (Get-Command k6 -ErrorAction SilentlyContinue)) {
    Write-Error "k6 is not installed on this system or not on your PATH."
    Write-Host "Please install k6 using:" -ForegroundColor Yellow
    Write-Host "  winget install grafana.k6" -ForegroundColor Green
    Write-Host "Or download it from: https://k6.io/docs/getting-started/installation/" -ForegroundColor Yellow
    Exit 1
}

$PythonPath = Join-Path $PSScriptRoot "..\backend\venv\Scripts\python.exe"
$PrepareScript = Join-Path $PSScriptRoot "prepare_users.py"

if (-not (Test-Path $PythonPath)) {
    Write-Error "Could not find python virtual environment at $PythonPath."
    Exit 1
}

Write-Host "`n[INFO] Using pre-seeded students..." -ForegroundColor Green

Write-Host "`n[MONITORING TIP] Run this in a separate PowerShell window to monitor CPU in real time:" -ForegroundColor Yellow
Write-Host "  while (`$true) { Get-Counter '\Processor(_Total)\% Processor Time'; Start-Sleep -Seconds 2 }`n" -ForegroundColor Green

Write-Host "[STEP 2/2] Running incremental load testing..." -ForegroundColor Yellow

$levels = @()
if ($Vus -gt 0) {
    $levels += $Vus
} else {
    $levels = @(10,25,50,75,100,150)
}

$resultsTable = @()

foreach ($level in $levels) {
    Write-Host "----------------------------------------------------------" -ForegroundColor Gray
    Write-Host "Executing Load Level: $level Concurrent VUs" -ForegroundColor Yellow
    Write-Host "----------------------------------------------------------" -ForegroundColor Gray

    $env:BASE_URL = $BaseUrl
    $env:LOAD_TEST_ASSESSMENT_ID = $AssessmentId.ToString()
    $env:VUS = $level.ToString()

    $summaryFile = "summary_$level.json"
    if (Test-Path $summaryFile) {
        Remove-Item $summaryFile -Force
    }

    k6 run $Script --summary-export=$summaryFile

    if (Test-Path $summaryFile) {
        $json = Get-Content $summaryFile -Raw | ConvertFrom-Json
        
        if ($json.metrics.http_req_duration.avg -eq $null) {
            Write-Host "Level $level produced no completed iterations." -ForegroundColor Red
            $resultsTable += [PSCustomObject]@{
                "Students"     = $level
                "Avg Response" = "N/A"
                "P95 Response" = "N/A"
                "Error Rate"   = "N/A"
                "Usable"       = "INVALID"
            }
            continue
        }

        $avgMs = [double]$json.metrics.http_req_duration.avg
        $p95Ms = [double]$json.metrics.http_req_duration.'p(95)'
        $failedRate = [double]$json.metrics.http_req_failed.value * 100
        $completedIterations = $json.metrics.iterations.count

        $avgStr = if ($avgMs -lt 1000) { "$([Math]::Round($avgMs, 0))ms" } else { "$([Math]::Round($avgMs / 1000, 2))s" }
        $p95Str = if ($p95Ms -lt 1000) { "$([Math]::Round($p95Ms, 0))ms" } else { "$([Math]::Round($p95Ms / 1000, 2))s" }
        $failStr = "$([Math]::Round($failedRate, 2))%"

        $usable = "PASS"
        $statusColor = "Green"
        if ($failedRate -ge 1.0 -or $avgMs -ge 2000 -or $p95Ms -ge 5000) {
            $usable = "FAIL"
            $statusColor = "Red"
        }
        if ($completedIterations -eq 0 -or $completedIterations -eq $null) {
            $usable = "INVALID"
            $statusColor = "Red"
        }

        Write-Host "Level $level completed: Avg=$avgStr, P95=$p95Str, Errors=$failStr -> Status: $usable" -ForegroundColor $statusColor

        $resultsTable += [PSCustomObject]@{
            "Students"     = $level
            "Avg Response" = $avgStr
            "P95 Response" = $p95Str
            "Error Rate"   = $failStr
            "Usable"       = $usable
        }
    } else {
        Write-Error "Failed to locate k6 summary report at $summaryFile"
    }
}

Write-Host "`n==========================================================" -ForegroundColor Cyan
Write-Host "                 FINAL CAPACITY ANALYSIS REPORT           " -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan
$resultsTable | Format-Table -AutoSize
Write-Host "==========================================================" -ForegroundColor Cyan

$maxCapacity = 0
foreach ($res in $resultsTable) {
    if ($res.Usable -eq "PASS") {
        $maxCapacity = $res.Students
    } else {
        break;
    }
}

if ($maxCapacity -gt 0) {
    Write-Host "CONCLUSION: The platform reliably supports up to $maxCapacity concurrent students." -ForegroundColor Green
} else {
    Write-Host "CONCLUSION: The system could not pass usability thresholds even at the lowest level." -ForegroundColor Red
}
Write-Host "==========================================================" -ForegroundColor Cyan
