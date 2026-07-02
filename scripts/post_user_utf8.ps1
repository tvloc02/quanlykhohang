$body = @{
  email = 'iamtvloc02@gmail.com'
  fullName = 'Trần Việt Lộc'
  phone = '0987655124'
  role = 'admin'
  password = 'Tvloc02@'
}

$json = $body | ConvertTo-Json -Depth 10
$bytes = [System.Text.Encoding]::UTF8.GetBytes($json)

try {
  $r = Invoke-WebRequest -Uri 'http://localhost:3000/api/users' -Method Post -ContentType 'application/json; charset=utf-8' -Body $bytes -UseBasicParsing -ErrorAction Stop
  Write-Host "Status: $($r.StatusCode)"
  Write-Host "Content:"
  Write-Host $r.Content
} catch {
  if ($_.Exception.Response -ne $null) {
    $resp = $_.Exception.Response
    Write-Host "Status: $($resp.StatusCode)"
    $reader = New-Object System.IO.StreamReader($resp.GetResponseStream())
    $text = $reader.ReadToEnd()
    Write-Host "Content:"
    Write-Host $text
  } else {
    Write-Host "Error:"
    Write-Host $_.Exception.Message
  }
}
