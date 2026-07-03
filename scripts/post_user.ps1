$body = @{
  email = 'iamtvloc02@gmail.com'
  fullName = 'Trần Việt Lộc'
  phone = '0987655124'
  role = 'admin'
  password = 'Tvloc02@'
}

$json = $body | ConvertTo-Json -Depth 10
Write-Host "Request body:"
Write-Host $json
try {
  $resp = Invoke-RestMethod -Uri 'http://localhost:3000/api/users' -Method Post -ContentType 'application/json' -Body $json -ErrorAction Stop
  Write-Host "HTTP Status: 200 OK (Invoke-RestMethod returned object)"
  $resp | ConvertTo-Json -Depth 10 | Write-Host
} catch {
  if ($_.Exception.Response -ne $null) {
    $stream = $_.Exception.Response.GetResponseStream()
    $reader = New-Object System.IO.StreamReader($stream)
    $text = $reader.ReadToEnd()
    Write-Host "HTTP Error response body:"
    Write-Host $text
  } else {
    Write-Host "Error:"
    Write-Host $_.Exception.Message
  }
}
