param(
  [switch]$InstallSDK
)

$sdkPath = "$env:LOCALAPPDATA\Android\Sdk"

Write-Host "=== Urban Intel - Android SDK Setup ===" -ForegroundColor Cyan

# Check if SDK already exists
if (Test-Path $sdkPath) {
  Write-Host "Android SDK found at: $sdkPath" -ForegroundColor Green
} else {
  Write-Host "Android SDK not found at default location." -ForegroundColor Yellow
  if ($InstallSDK) {
    Write-Host "Installing Android SDK via commandlinetools..." -ForegroundColor Cyan
    $toolsDir = "$env:TEMP\android-cmdline"
    New-Item -ItemType Directory -Force -Path $toolsDir | Out-Null
    $zipPath = "$toolsDir\cmdline-tools.zip"
    try {
      Invoke-WebRequest -Uri "https://dl.google.com/android/repository/commandlinetools-win-11076708_latest.zip" -OutFile $zipPath
      Expand-Archive -Path $zipPath -DestinationPath "$toolsDir\extracted" -Force
      New-Item -ItemType Directory -Force -Path "$sdkPath\cmdline-tools" | Out-Null
      Copy-Item -Recurse -Force "$toolsDir\extracted\cmdline-tools\*" "$sdkPath\cmdline-tools\latest"
      $yes = New-Object System.Diagnostics.ProcessStartInfo
      $yes.FileName = "cmd.exe"
      $yes.Arguments = "/c echo y | $sdkPath\cmdline-tools\latest\bin\sdkmanager.bat --install `"platforms;android-34`" `"platform-tools`" `"build-tools;34.0.0`""
      $yes.UseShellExecute = $false
      $yes.RedirectStandardOutput = $true
      $p = [System.Diagnostics.Process]::Start($yes)
      $p.WaitForExit()
      Write-Host "SDK installed." -ForegroundColor Green
    } catch {
      Write-Host "Failed to install SDK: $_" -ForegroundColor Red
      Write-Host "Please install Android Studio manually from: https://developer.android.com/studio" -ForegroundColor Yellow
    }
  } else {
    Write-Host "Install Android Studio from: https://developer.android.com/studio" -ForegroundColor Yellow
    Write-Host "During installation, ensure SDK is installed at: $sdkPath" -ForegroundColor Yellow
  }
}

# Check adb
$adbPath = "$sdkPath\platform-tools\adb.exe"
if (Test-Path $adbPath) {
  Write-Host "adb found at: $adbPath" -ForegroundColor Green
} else {
  Write-Host "adb not found. Install platform-tools via Android Studio SDK Manager." -ForegroundColor Yellow
}

# Check ANDROID_HOME
$currentHome = [Environment]::GetEnvironmentVariable("ANDROID_HOME", "User")
if ($currentHome) {
  Write-Host "ANDROID_HOME is set to: $currentHome" -ForegroundColor Green
} else {
  Write-Host "Setting ANDROID_HOME environment variable..." -ForegroundColor Cyan
  [Environment]::SetEnvironmentVariable("ANDROID_HOME", $sdkPath, "User")
  $env:ANDROID_HOME = $sdkPath
  Write-Host "ANDROID_HOME set to: $sdkPath" -ForegroundColor Green
}

# Check PATH for platform-tools
$currentPath = [Environment]::GetEnvironmentVariable("Path", "User")
if ($currentPath -notlike "*platform-tools*") {
  Write-Host "Adding platform-tools to PATH..." -ForegroundColor Cyan
  [Environment]::SetEnvironmentVariable("Path", "$currentPath;$sdkPath\platform-tools", "User")
  $env:Path += ";$sdkPath\platform-tools"
  Write-Host "platform-tools added to PATH" -ForegroundColor Green
} else {
  Write-Host "platform-tools already in PATH" -ForegroundColor Green
}

Write-Host ""
Write-Host "=== Setup Complete ===" -ForegroundColor Cyan
Write-Host "Please restart your terminal for environment changes to take effect." -ForegroundColor Yellow
Write-Host "Then run: cd frontend && npx expo start --android" -ForegroundColor Cyan
