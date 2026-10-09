# Relais PowerShell des outils Pulse : lance le script bash du meme nom, dans ce dossier, par le bash de Git for Windows.
# PowerShell prend ce fichier avant le relais .cmd : les arguments ne passent jamais par cmd.exe, si bien que
# les caracteres & | > < ^, les espaces et les guillemets arrivent tels quels. Ils voyagent par l'environnement
# (PULSE_RELAIS_ARGC, PULSE_RELAIS_ARG_<i>), que le script bash relit puis efface : par la ligne de commande,
# Windows PowerShell 5.1 perdrait les guillemets et les arguments vides.
# Fichier en ASCII seulement : Windows PowerShell 5.1 lit un .ps1 sans BOM dans la page de code du systeme.

function Find-PulseGitBash {
  $candidats = New-Object System.Collections.Generic.List[string]
  foreach ($git in @(Get-Command git.exe -CommandType Application -All -ErrorAction SilentlyContinue)) {
    $dossier = Split-Path -Parent $git.Source
    # git.exe vit dans cmd\, bin\ ou mingw64\bin\ de Git for Windows ; bash.exe dans bin\ a sa racine.
    foreach ($relatif in '..\bin\bash.exe', '..\..\bin\bash.exe', 'bash.exe') { $candidats.Add((Join-Path $dossier $relatif)) }
  }
  foreach ($racine in @($env:ProgramW6432, $env:ProgramFiles, ${env:ProgramFiles(x86)})) {
    if ($racine) { $candidats.Add((Join-Path $racine 'Git\bin\bash.exe')) }
  }
  if ($env:LOCALAPPDATA) { $candidats.Add((Join-Path $env:LOCALAPPDATA 'Programs\Git\bin\bash.exe')) }
  foreach ($c in $candidats) {
    if (Test-Path -LiteralPath $c -PathType Leaf) { return [System.IO.Path]::GetFullPath($c) }
  }
  return $null
}

function Clear-PulseArguments {
  Get-ChildItem Env: | Where-Object { $_.Name -like 'PULSE_RELAIS_ARG*' } |
    ForEach-Object { [Environment]::SetEnvironmentVariable($_.Name, [NullString]::Value) }
}

$nom = [System.IO.Path]::GetFileNameWithoutExtension($PSCommandPath)
$bash = Find-PulseGitBash
if (-not $bash) {
  [Console]::Error.WriteLine("$nom : le bash de Git for Windows est introuvable. Installez Git for Windows (https://git-scm.com/download/win), puis fermez et relancez Claude Code.")
  exit 127
}

$liste = @($args | ForEach-Object { [string]$_ })
Clear-PulseArguments
[Environment]::SetEnvironmentVariable('PULSE_RELAIS_ARGC', [string]$liste.Count)
for ($i = 0; $i -lt $liste.Count; $i++) { [Environment]::SetEnvironmentVariable("PULSE_RELAIS_ARG_$i", $liste[$i]) }
$entreeAvant = $global:OutputEncoding
$sortieAvant = [Console]::OutputEncoding
$utf8 = New-Object System.Text.UTF8Encoding $false
$code = 1
try {
  $global:OutputEncoding = $utf8
  [Console]::OutputEncoding = $utf8
  $script = Join-Path $PSScriptRoot $nom
  if ($MyInvocation.ExpectingInput) { $input | & $bash $script } else { & $bash $script }
  $code = $LASTEXITCODE
} finally {
  $global:OutputEncoding = $entreeAvant
  [Console]::OutputEncoding = $sortieAvant
  Clear-PulseArguments
}
exit $code
