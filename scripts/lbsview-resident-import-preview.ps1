param(
  [Parameter(Mandatory = $true)]
  [string]$WorkbookPath,

  [string]$OutputDirectory = ".local-import"
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path -LiteralPath $WorkbookPath)) {
  throw "Workbook not found: $WorkbookPath"
}

Add-Type -AssemblyName System.IO.Compression.FileSystem

function Read-XlsxRows {
  param([string]$Path)

  $zip = [System.IO.Compression.ZipFile]::OpenRead($Path)
  try {
    $sharedStrings = @()
    $sharedEntry = $zip.GetEntry("xl/sharedStrings.xml")
    if ($sharedEntry) {
      $reader = [System.IO.StreamReader]::new($sharedEntry.Open())
      [xml]$sharedXml = $reader.ReadToEnd()
      $reader.Close()

      $ns = [System.Xml.XmlNamespaceManager]::new($sharedXml.NameTable)
      $ns.AddNamespace("x", "http://schemas.openxmlformats.org/spreadsheetml/2006/main")
      foreach ($item in $sharedXml.SelectNodes("//x:si", $ns)) {
        $sharedStrings += (($item.SelectNodes(".//x:t", $ns) | ForEach-Object { $_."#text" }) -join "")
      }
    }

    $sheetEntry = $zip.GetEntry("xl/worksheets/sheet1.xml")
    if (-not $sheetEntry) {
      throw "Expected xl/worksheets/sheet1.xml in workbook."
    }

    $reader = [System.IO.StreamReader]::new($sheetEntry.Open())
    [xml]$sheetXml = $reader.ReadToEnd()
    $reader.Close()

    $sheetNs = [System.Xml.XmlNamespaceManager]::new($sheetXml.NameTable)
    $sheetNs.AddNamespace("x", "http://schemas.openxmlformats.org/spreadsheetml/2006/main")
    $rows = @()

    foreach ($row in $sheetXml.SelectNodes("//x:sheetData/x:row", $sheetNs)) {
      $record = [ordered]@{ Row = [int]$row.r }
      foreach ($cell in $row.SelectNodes("x:c", $sheetNs)) {
        $column = ([regex]::Match($cell.r, "^[A-Z]+")).Value
        $valueNode = $cell.SelectSingleNode("x:v", $sheetNs)
        $inlineNode = $cell.SelectSingleNode("x:is", $sheetNs)
        $value = ""

        if ($cell.t -eq "s" -and $valueNode) {
          $value = $sharedStrings[[int]$valueNode.InnerText]
        } elseif ($cell.t -eq "inlineStr" -and $inlineNode) {
          $value = (($inlineNode.SelectNodes(".//x:t", $sheetNs) | ForEach-Object { $_."#text" }) -join "")
        } elseif ($valueNode) {
          $value = $valueNode.InnerText
        }

        $record[$column] = $value
      }
      $rows += [pscustomobject]$record
    }

    return $rows
  } finally {
    $zip.Dispose()
  }
}

function Clean-Text {
  param([string]$Value)
  return (($Value -replace "\s+", " ").Trim())
}

function Split-Cell {
  param([string]$Value)
  return @([regex]::Split($Value, "\s{20,}") | Where-Object { $_.Trim() })
}

function Normalize-RoleStatus {
  param([string]$Role)

  switch -Regex ($Role) {
    "EX RESIDENT" { return "moved out" }
    "RESIDENT" { return "active" }
    default { return "inactive" }
  }
}

function Normalize-Money {
  param([string]$Value)
  $number = [decimal]0
  $clean = ($Value -replace "[^\d.-]", "")
  if ([decimal]::TryParse($clean, [ref]$number)) {
    return $number
  }
  return 0
}

function Normalize-UnitCode {
  param(
    [string]$AddressOrUnit,
    [string]$PropertyGroup
  )

  $text = (Clean-Text $AddressOrUnit).ToUpperInvariant().Replace("’", "'")
  if ($text -match "\bJC\s*-?\s*(\d+)\b") {
    return "JC-$([int]$Matches[1])"
  }
  if ($PropertyGroup -eq "AA" -and $text -match "\bA\s*-?\s*(\d+)\b") {
    return "AA-$([int]$Matches[1])"
  }
  if ($text -match "\bAA\s*-?\s*(\d+)\b") {
    return "AA-$([int]$Matches[1])"
  }
  return ""
}

function Detect-PropertyGroup {
  param(
    [string]$AddressOrUnit,
    [string]$LegacyProperty
  )

  $text = "$AddressOrUnit $LegacyProperty"
  if ($text -match "Ateeq") {
    return @{ Code = "AA"; Name = "Ateeq Apartment" }
  }
  if ($text -match "Jed") {
    return @{ Code = "JC"; Name = "Jeds Court Apartments" }
  }
  return @{ Code = "LDI-REVIEW"; Name = "LBS View Manual Review" }
}

$rows = Read-XlsxRows -Path $WorkbookPath
$dataRows = $rows | Where-Object { $_.Row -ge 3 -and $_.B }
$preview = @()

foreach ($row in $dataRows) {
  $nameParts = Split-Cell ([string]$row.B)
  $unitParts = Split-Cell ([string]$row.C)
  $fullName = if ($nameParts.Count) { Clean-Text $nameParts[0] } else { "" }
  $legacyName = if ($nameParts.Count -gt 1 -and $nameParts[1] -match "^\(") { Clean-Text $nameParts[1] } else { "" }
  $phone = ([regex]::Match([string]$row.B, "(?:\+?234|0)\d{10}")).Value
  $email = ([regex]::Match([string]$row.B, "[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}")).Value.TrimEnd(",")
  $apartmentType = if ($unitParts.Count) { Clean-Text $unitParts[0] } else { "" }
  $addressOrUnit = if ($unitParts.Count -gt 2) { Clean-Text $unitParts[1] } else { "" }
  $legacyProperty = if ($unitParts.Count -gt 1) { Clean-Text $unitParts[$unitParts.Count - 1] } else { "" }
  $property = Detect-PropertyGroup -AddressOrUnit $addressOrUnit -LegacyProperty $legacyProperty
  $unitCode = Normalize-UnitCode -AddressOrUnit $addressOrUnit -PropertyGroup $property.Code
  $reviewReasons = @()

  if (-not $unitCode) {
    $reviewReasons += "unit_id_missing"
  }
  if ($row.J -notmatch "RESIDENT|EX RESIDENT") {
    $reviewReasons += "non_resident_role"
  }
  if (-not $phone -and -not $email) {
    $reviewReasons += "missing_login_contact"
  }

  $preview += [pscustomobject]@{
    sourceRow = $row.Row
    fullName = $fullName
    phone = $phone
    email = $email
    role = Clean-Text ([string]$row.J)
    residentStatus = Normalize-RoleStatus ([string]$row.J)
    propertyCode = $property.Code
    propertyName = $property.Name
    unitCode = $unitCode
    apartmentType = $apartmentType
    legacyName = $legacyName
    legacyAddress = $addressOrUnit
    legacyProperty = $legacyProperty
    expectedPayment = Normalize-Money ([string]$row.D)
    amountPaid = Normalize-Money ([string]$row.E)
    openingOutstanding = Normalize-Money ([string]$row.F)
    expectedMonthly = Normalize-Money ([string]$row.G)
    reviewRequired = $reviewReasons.Count -gt 0
    reviewReasons = $reviewReasons
  }
}

New-Item -ItemType Directory -Path $OutputDirectory -Force | Out-Null
$previewPath = Join-Path $OutputDirectory "lbsview-onboarding-preview.json"
$summaryPath = Join-Path $OutputDirectory "lbsview-onboarding-summary.json"

$summary = [pscustomobject]@{
  generatedAt = (Get-Date).ToString("o")
  source = $WorkbookPath
  totalRows = $preview.Count
  activeResidents = @($preview | Where-Object { $_.residentStatus -eq "active" }).Count
  movedOutResidents = @($preview | Where-Object { $_.residentStatus -eq "moved out" }).Count
  reviewRequired = @($preview | Where-Object { $_.reviewRequired }).Count
  byProperty = @($preview | Group-Object propertyCode | ForEach-Object {
    [pscustomobject]@{ propertyCode = $_.Name; count = $_.Count }
  })
}

$preview | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath $previewPath -Encoding UTF8
$summary | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath $summaryPath -Encoding UTF8

Write-Host "Preview written to $previewPath"
Write-Host "Summary written to $summaryPath"
