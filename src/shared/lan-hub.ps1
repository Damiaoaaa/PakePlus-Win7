param(
  [int]$Port = 9100
)

$ErrorActionPreference = "Continue"
$queue = [System.Collections.ArrayList]::new()
$seq = 0
$paired = $false
$lock = New-Object object
$log = Join-Path $env:TEMP "spc-lan-hub.log"

function Write-Log([string]$msg) {
  try {
    $line = "[{0}] {1}" -f ([DateTime]::Now.ToString("HH:mm:ss")), $msg
    Add-Content -Path $log -Value $line -Encoding UTF8 -ErrorAction SilentlyContinue
  } catch {}
}

function Send-Response([System.Net.Sockets.TcpClient]$client, [int]$code, [string]$body, [string]$type = "application/json") {
  $bytes = [System.Text.Encoding]::UTF8.GetBytes($body)
  $reason = switch ($code) {
    200 { "OK" }
    204 { "No Content" }
    400 { "Bad Request" }
    404 { "Not Found" }
    default { "OK" }
  }
  $header = "HTTP/1.1 $code $reason`r`nContent-Type: $type; charset=utf-8`r`nContent-Length: $($bytes.Length)`r`nAccess-Control-Allow-Origin: *`r`nAccess-Control-Allow-Methods: GET, POST, OPTIONS`r`nAccess-Control-Allow-Headers: Content-Type`r`nConnection: close`r`n`r`n"
  $stream = $client.GetStream()
  $headerBytes = [System.Text.Encoding]::ASCII.GetBytes($header)
  $stream.Write($headerBytes, 0, $headerBytes.Length)
  if ($bytes.Length -gt 0) { $stream.Write($bytes, 0, $bytes.Length) }
  $stream.Flush()
}

function Read-Request([System.Net.Sockets.TcpClient]$client) {
  $stream = $client.GetStream()
  $stream.ReadTimeout = 4000
  $stream.WriteTimeout = 4000
  $buffer = New-Object byte[] 65536
  $ms = New-Object System.IO.MemoryStream
  while ($true) {
    try {
      $n = $stream.Read($buffer, 0, $buffer.Length)
    } catch {
      break
    }
    if ($n -le 0) { break }
    $ms.Write($buffer, 0, $n)
    $text = [System.Text.Encoding]::UTF8.GetString($ms.ToArray())
    $idx = $text.IndexOf("`r`n`r`n")
    if ($idx -lt 0) { continue }
    $headerText = $text.Substring(0, $idx)
    $bodyText = $text.Substring($idx + 4)
    $lines = $headerText -split "`r`n"
    $parts = $lines[0] -split " "
    $method = $parts[0]
    $path = $parts[1]
    $contentLength = 0
    foreach ($line in $lines) {
      if ($line -match '^(?i)Content-Length:\s*(\d+)') {
        $contentLength = [int]$Matches[1]
      }
    }
    while ($bodyText.Length -lt $contentLength) {
      try { $n = $stream.Read($buffer, 0, $buffer.Length) } catch { break }
      if ($n -le 0) { break }
      $bodyText += [System.Text.Encoding]::UTF8.GetString($buffer, 0, $n)
    }
    if ($contentLength -gt 0 -and $bodyText.Length -gt $contentLength) {
      $bodyText = $bodyText.Substring(0, $contentLength)
    }
    return @{ Method = $method; Path = $path; Body = $bodyText }
  }
  return $null
}

try {
  Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue | ForEach-Object {
    try { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue } catch {}
  }
} catch {}

Start-Sleep -Milliseconds 250

try {
  $listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Any, $Port)
  $listener.Server.SetSocketOption([System.Net.Sockets.SocketOptionLevel]::Socket, [System.Net.Sockets.SocketOptionName]::ReuseAddress, $true)
  $listener.Start()
  Write-Log "listening on $Port"
} catch {
  Write-Log ("listen failed: " + $_.Exception.Message)
  exit 1
}

while ($true) {
  $client = $null
  try {
    $client = $listener.AcceptTcpClient()
    $req = Read-Request $client
    if (-not $req) {
      Send-Response $client 400 '{"ok":false}'
      continue
    }

    $method = $req.Method
    $rawPath = $req.Path
    $path = ($rawPath -split "\?")[0]
    $query = ""
    if ($rawPath.Contains("?")) { $query = ($rawPath -split "\?", 2)[1] }

    if ($method -eq "OPTIONS") {
      Send-Response $client 204 ""
      continue
    }

    if ($method -eq "GET" -and $path -eq "/health") {
      Send-Response $client 200 '{"ok":true}'
      continue
    }

    if ($method -eq "GET" -and $path -eq "/status") {
      $json = '{"ok":true,"paired":' + ($(if ($paired) { "true" } else { "false" })) + ',"seq":' + $seq + '}'
      Send-Response $client 200 $json
      continue
    }

    if ($method -eq "POST" -and $path -eq "/pair") {
      $paired = $true
      Send-Response $client 200 '{"ok":true,"paired":true}'
      continue
    }

    if (($method -eq "POST" -or $method -eq "GET") -and $path -eq "/stop") {
      Send-Response $client 200 '{"ok":true,"stopped":true}'
      try { $client.Close() } catch {}
      try { $listener.Stop() } catch {}
      Write-Log "stopped"
      exit 0
    }

    if ($method -eq "POST" -and $path -eq "/cmd") {
      try {
        $obj = $req.Body | ConvertFrom-Json
        $command = [string]$obj.command
        if (-not $command) { throw "empty" }
        $itemSeq = 0
        [void][System.Threading.Monitor]::Enter($lock)
        try {
          $script:seq++
          $itemSeq = $script:seq
          $at = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
          [void]$queue.Add([pscustomobject]@{ seq = $itemSeq; type = "cmd"; command = $command; at = $at })
          while ($queue.Count -gt 80) { $queue.RemoveAt(0) }
        } finally {
          [System.Threading.Monitor]::Exit($lock)
        }
        Send-Response $client 200 ('{"ok":true,"seq":' + $itemSeq + '}')
      } catch {
        Send-Response $client 400 '{"ok":false}'
      }
      continue
    }

    if ($method -eq "GET" -and $path -eq "/pull") {
      $after = 0
      foreach ($pair in ($query -split "&")) {
        if ($pair -match '^after=(\d+)$') { $after = [int]$Matches[1] }
      }
      # 最多等 600ms，避免堵死后续 /health /cmd
      $deadline = [DateTime]::UtcNow.AddMilliseconds(600)
      $items = @()
      while ([DateTime]::UtcNow -lt $deadline) {
        [void][System.Threading.Monitor]::Enter($lock)
        try {
          $items = @($queue | Where-Object { $_.seq -gt $after })
        } finally {
          [System.Threading.Monitor]::Exit($lock)
        }
        if ($items.Count -gt 0) { break }
        Start-Sleep -Milliseconds 60
      }
      $parts = New-Object System.Collections.ArrayList
      foreach ($it in $items) {
        $cmd = [string]$it.command
        $cmd = $cmd.Replace('\', '\\').Replace('"', '\"')
        [void]$parts.Add(('{"type":"cmd","seq":' + $it.seq + ',"command":"' + $cmd + '","at":' + $it.at + '}'))
      }
      Send-Response $client 200 ('{"ok":true,"cmds":[' + ($parts -join ",") + ']}')
      continue
    }

    Send-Response $client 404 '{"ok":false}'
  } catch {
    Write-Log ("req error: " + $_.Exception.Message)
    try { if ($client) { Send-Response $client 400 '{"ok":false}' } } catch {}
  } finally {
    try { if ($client) { $client.Close() } } catch {}
  }
}
