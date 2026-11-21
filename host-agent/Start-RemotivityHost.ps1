<#
.SYNOPSIS
    Agent hôte Remotivity 100% natif PowerShell (.NET HttpListener) sans aucune dépendance externe.
.DESCRIPTION
    Expose en local (ou via Tailscale / Cloudflare Tunnel) vos sessions Antigravity, Claude Code,
    VS Code et terminaux PowerShell à l'application mobile/web Remotivity.
#>
param(
    [int]$Port = 7890,
    [string]$Token = "",
    [string]$WorkspaceRoot = "$env:USERPROFILE\.gemini\antigravity\scratch",
    [switch]$BindAll
)

$ErrorActionPreference = "Continue"
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

if ([string]::IsNullOrWhiteSpace($Token)) {
    $bytes = New-Object byte[] 18
    [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
    $Token = "rmv_" + ([Convert]::ToBase64String($bytes) -replace '[^a-zA-Z0-9]', '').Substring(0, 18)
}

if (-not (Test-Path $WorkspaceRoot)) {
    $WorkspaceRoot = $env:USERPROFILE
}

function Get-LocalIPAddresses {
    $ips = @()
    try {
        $ips = Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue |
            Where-Object {
                $_.IPAddress -ne "127.0.0.1" -and
                $_.IPAddress -notlike "169.254.*" -and
                $_.AddressState -eq "Preferred"
            } |
            Select-Object -ExpandProperty IPAddress -Unique
    } catch {
        try {
            $ips = [System.Net.Dns]::GetHostAddresses([System.Net.Dns]::GetHostName()) |
                Where-Object { $_.AddressFamily -eq [System.Net.Sockets.AddressFamily]::InterNetwork } |
                ForEach-Object { $_.IPAddressToString }
        } catch {}
    }
    return @($ips)
}

function Get-ActiveDevProcesses {
    $targets = @("Antigravity", "Code", "Cursor", "claude", "powershell", "pwsh", "WindowsTerminal", "node")
    $procs = Get-Process -ErrorAction SilentlyContinue | Where-Object {
        $name = $_.ProcessName
        $targets | Where-Object { $name -like "*$_*" }
    } | Select-Object -First 25 ProcessName, Id, MainWindowTitle, @{
        Name = "MemoryMB"; Expression = { [math]::Round($_.WorkingSet64 / 1MB, 1) }
    }
    return @($procs)
}

function Get-AntigravitySessions {
    $brainPath = Join-Path $env:USERPROFILE ".gemini\antigravity\brain"
    $sessions = @()
    if (Test-Path $brainPath) {
        $dirs = Get-ChildItem -Path $brainPath -Directory -ErrorAction SilentlyContinue |
            Where-Object { $_.Name -ne "tempmediaStorage" } |
            Sort-Object LastWriteTime -Descending |
            Select-Object -First 12
        foreach ($d in $dirs) {
            $artifacts = @(Get-ChildItem -Path $d.FullName -File -ErrorAction SilentlyContinue |
                Where-Object { $_.Name -notlike "*.metadata.json" } |
                Select-Object -ExpandProperty Name)
            $sessions += [PSCustomObject]@{
                id = $d.Name
                type = "antigravity"
                lastUpdated = $d.LastWriteTime.ToString("yyyy-MM-dd HH:mm:ss")
                artifacts = $artifacts
            }
        }
    }

    $workspaces = @()
    if (Test-Path $WorkspaceRoot) {
        $workspaces = @(Get-ChildItem -Path $WorkspaceRoot -Directory -ErrorAction SilentlyContinue |
            Sort-Object LastWriteTime -Descending |
            Select-Object -First 15 | ForEach-Object {
                [PSCustomObject]@{
                    name = $_.Name
                    path = $_.FullName
                    hasGit = (Test-Path (Join-Path $_.FullName ".git"))
                    lastModified = $_.LastWriteTime.ToString("yyyy-MM-dd HH:mm")
                }
            })
    }

    return [PSCustomObject]@{
        sessions = $sessions
        workspaces = $workspaces
        processes = Get-ActiveDevProcesses
    }
}

function Get-HostMetrics {
    $os = Get-CimInstance Win32_OperatingSystem -ErrorAction SilentlyContinue
    $totalRamGB = if ($os) { [math]::Round($os.TotalVisibleMemorySize / 1MB, 1) } else { 0 }
    $freeRamGB = if ($os) { [math]::Round($os.FreePhysicalMemory / 1MB, 1) } else { 0 }
    $usedRamPct = if ($totalRamGB -gt 0) { [math]::Round((($totalRamGB - $freeRamGB) / $totalRamGB) * 100, 0) } else { 0 }

    return [PSCustomObject]@{
        status = "online"
        agent = "Remotivity Host Agent"
        version = "1.0.1"
        hostname = $env:COMPUTERNAME
        username = $env:USERNAME
        os = if ($os) { $os.Caption } else { "Windows" }
        workspaceRoot = $WorkspaceRoot
        ramUsedPct = $usedRamPct
        ramFreeGB = $freeRamGB
        ramTotalGB = $totalRamGB
        ips = Get-LocalIPAddresses
        processesCount = (Get-ActiveDevProcesses).Count
        timestamp = (Get-Date).ToString("o")
    }
}

function Send-JsonResponse {
    param(
        [System.Net.HttpListenerResponse]$Response,
        [int]$StatusCode,
        [object]$Payload
    )
    $Response.StatusCode = $StatusCode
    $Response.ContentType = "application/json; charset=utf-8"
    $Response.Headers["Access-Control-Allow-Origin"] = "*"
    $Response.Headers["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS"
    $Response.Headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization, X-Remotivity-Token"

    $json = $Payload | ConvertTo-Json -Depth 8 -Compress
    $buffer = [System.Text.Encoding]::UTF8.GetBytes($json)
    $Response.ContentLength64 = $buffer.Length
    $Response.OutputStream.Write($buffer, 0, $buffer.Length)
    $Response.OutputStream.Close()
}

function Test-RequestAuthorized {
    param([System.Net.HttpListenerRequest]$Request)
    $authHeader = $Request.Headers["Authorization"]
    $customHeader = $Request.Headers["X-Remotivity-Token"]
    $queryToken = $Request.QueryString["token"]

    if ($authHeader -eq "Bearer $Token") { return $true }
    if ($customHeader -eq $Token) { return $true }
    if ($queryToken -eq $Token) { return $true }
    return $false
}

$listener = New-Object System.Net.HttpListener
$prefixes = @("http://localhost:$Port/", "http://127.0.0.1:$Port/")
if ($BindAll) {
    $prefixes = @("http://+:$Port/")
}

foreach ($p in $prefixes) {
    $listener.Prefixes.Add($p)
}

try {
    $listener.Start()
} catch {
    Write-Host "[ERREUR] Impossible de démarrer sur $Port : $($_.Exception.Message)" -ForegroundColor Red
    if ($BindAll) {
        Write-Host "Astuce : Sans droits administrateur, relancez sans -BindAll ou utilisez un tunnel Cloudflare/Tailscale vers localhost:$Port" -ForegroundColor Yellow
    }
    exit 1
}

$ips = Get-LocalIPAddresses
$primaryHost = if ($ips.Count -gt 0 -and $BindAll) { "http://$($ips[0]):$Port" } else { "http://localhost:$Port" }

$inviteObj = @{
    v = 1
    name = "$($env:COMPUTERNAME) • Antigravity & Shell"
    type = "antigravity"
    hostUrl = $primaryHost
    accessToken = $Token
    workspace = $WorkspaceRoot
    readOnly = $false
    sharedBy = $env:USERNAME
} | ConvertTo-Json -Compress
$inviteBytes = [System.Text.Encoding]::UTF8.GetBytes($inviteObj)
$inviteB64 = [Convert]::ToBase64String($inviteBytes).Replace('+', '-').Replace('/', '_').TrimEnd('=')

Write-Host ""
Write-Host "=================================================================" -ForegroundColor Cyan
Write-Host "  🛰️  REMOTIVITY HOST AGENT ACTIF" -ForegroundColor Green
Write-Host "=================================================================" -ForegroundColor Cyan
Write-Host "  Machine       : $($env:COMPUTERNAME) ($($env:USERNAME))"
Write-Host "  Workspace     : $WorkspaceRoot"
Write-Host "  Écoute locale : http://localhost:$Port"
if ($ips.Count -gt 0) {
    Write-Host "  IP(s) réseau  : $(($ips | ForEach-Object { "http://${_}:$Port" }) -join ', ')"
}
Write-Host "  Jeton d'accès : $Token" -ForegroundColor Yellow
Write-Host ""
Write-Host "  Lien d'appairage direct (PWA / Android) :" -ForegroundColor Magenta
Write-Host "  https://heyhacene.github.io/Remotivity/?invite=$inviteB64" -ForegroundColor White
Write-Host ""
Write-Host "  Code d'invitation rapide :" -ForegroundColor Magenta
Write-Host "  $inviteB64" -ForegroundColor Gray
Write-Host "=================================================================" -ForegroundColor Cyan
Write-Host "  Appuyez sur Ctrl+C pour arrêter l'agent." -ForegroundColor DarkGray
Write-Host ""

try {
    while ($listener.IsListening) {
        $context = $listener.GetContext()
        $req = $context.Request
        $res = $context.Response

        if ($req.HttpMethod -eq "OPTIONS") {
            $res.StatusCode = 204
            $res.Headers["Access-Control-Allow-Origin"] = "*"
            $res.Headers["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS"
            $res.Headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization, X-Remotivity-Token"
            $res.Close()
            continue
        }

        if (-not (Test-RequestAuthorized $req)) {
            Send-JsonResponse -Response $res -StatusCode 401 -Payload @{
                error = "Jeton d'authentification invalide ou manquant."
            }
            continue
        }

        $path = $req.Url.AbsolutePath.TrimEnd('/')
        if ([string]::IsNullOrEmpty($path)) { $path = "/" }

        try {
            switch ($path) {
                "/api/status" {
                    Send-JsonResponse -Response $res -StatusCode 200 -Payload (Get-HostMetrics)
                }
                "/api/sessions" {
                    Send-JsonResponse -Response $res -StatusCode 200 -Payload (Get-AntigravitySessions)
                }
                "/api/files" {
                    $target = $req.QueryString["path"]
                    if ([string]::IsNullOrWhiteSpace($target) -or -not (Test-Path $target)) {
                        $target = $WorkspaceRoot
                    }
                    $items = @(Get-ChildItem -Path $target -Force -ErrorAction SilentlyContinue |
                        Select-Object -First 60 | ForEach-Object {
                            [PSCustomObject]@{
                                name = $_.Name
                                isDir = $_.PSIsContainer
                                size = if ($_.PSIsContainer) { 0 } else { $_.Length }
                                modified = $_.LastWriteTime.ToString("yyyy-MM-dd HH:mm")
                            }
                        })
                    Send-JsonResponse -Response $res -StatusCode 200 -Payload @{
                        path = $target
                        items = $items
                    }
                }
                "/api/exec" {
                    if ($req.HttpMethod -ne "POST") {
                        Send-JsonResponse -Response $res -StatusCode 405 -Payload @{ error = "Méthode POST requise" }
                        break
                    }
                    $reader = New-Object System.IO.StreamReader($req.InputStream, [System.Text.Encoding]::UTF8)
                    $bodyStr = $reader.ReadToEnd()
                    $body = $bodyStr | ConvertFrom-Json
                    $cmd = [string]$body.command
                    $cwd = if ($body.cwd -and (Test-Path $body.cwd)) { [string]$body.cwd } else { $WorkspaceRoot }

                    if ([string]::IsNullOrWhiteSpace($cmd)) {
                        Send-JsonResponse -Response $res -StatusCode 400 -Payload @{ error = "Commande vide" }
                        break
                    }

                    $sw = [System.Diagnostics.Stopwatch]::StartNew()
                    $psi = New-Object System.Diagnostics.ProcessStartInfo
                    $psi.FileName = "powershell.exe"
                    $psi.Arguments = "-NoProfile -ExecutionPolicy Bypass -Command `"& { Set-Location -LiteralPath '$($cwd -replace "'","''")'; $cmd }`""
                    $psi.RedirectStandardOutput = $true
                    $psi.RedirectStandardError = $true
                    $psi.UseShellExecute = $false
                    $psi.CreateNoWindow = $true
                    $psi.StandardOutputEncoding = [System.Text.Encoding]::UTF8
                    $psi.StandardErrorEncoding = [System.Text.Encoding]::UTF8

                    $proc = New-Object System.Diagnostics.Process
                    $proc.StartInfo = $psi
                    $proc.Start() | Out-Null
                    $stdout = $proc.StandardOutput.ReadToEnd()
                    $stderr = $proc.StandardError.ReadToEnd()
                    $proc.WaitForExit(30000) | Out-Null
                    $sw.Stop()

                    Write-Host "[EXEC] ($($sw.ElapsedMilliseconds)ms) $cmd" -ForegroundColor DarkCyan
                    Send-JsonResponse -Response $res -StatusCode 200 -Payload @{
                        exitCode = $proc.ExitCode
                        stdout = $stdout
                        stderr = $stderr
                        cwd = $cwd
                        durationMs = $sw.ElapsedMilliseconds
                    }
                }
                "/api/prompt" {
                    if ($req.HttpMethod -ne "POST") {
                        Send-JsonResponse -Response $res -StatusCode 405 -Payload @{ error = "Méthode POST requise" }
                        break
                    }
                    $reader = New-Object System.IO.StreamReader($req.InputStream, [System.Text.Encoding]::UTF8)
                    $bodyStr = $reader.ReadToEnd()
                    $body = $bodyStr | ConvertFrom-Json
                    $promptText = [string]$body.prompt
                    $agentType = if ($body.agent) { [string]$body.agent } else { "antigravity" }
                    $cwd = if ($body.cwd -and (Test-Path $body.cwd)) { [string]$body.cwd } else { $WorkspaceRoot }

                    $inboxDir = Join-Path $env:USERPROFILE ".remotivity_inbox"
                    if (-not (Test-Path $inboxDir)) {
                        New-Item -ItemType Directory -Path $inboxDir -Force | Out-Null
                    }
                    $stamp = Get-Date -Format "yyyyMMdd_HHmmss"
                    $noteFile = Join-Path $inboxDir "prompt_${agentType}_${stamp}.md"
                    $noteContent = "# Prompt distant Remotivity ($agentType)`nDate: $(Get-Date -Format o)`nWorkspace: $cwd`n`n$promptText`n"
                    Set-Content -Path $noteFile -Value $noteContent -Encoding UTF8

                    Write-Host "[PROMPT -> $agentType] $promptText" -ForegroundColor Green
                    Send-JsonResponse -Response $res -StatusCode 200 -Payload @{
                        accepted = $true
                        agent = $agentType
                        queuedFile = $noteFile
                        reply = "Instruction transmise à l'hôte $($env:COMPUTERNAME) ($agentType) et enregistrée dans $noteFile. Workspace ciblé : $cwd."
                    }
                }
                default {
                    Send-JsonResponse -Response $res -StatusCode 404 -Payload @{ error = "Route introuvable : $path" }
                }
            }
        } catch {
            Send-JsonResponse -Response $res -StatusCode 500 -Payload @{
                error = $_.Exception.Message
            }
        }
    }
} finally {
    $listener.Stop()
    $listener.Close()
}
