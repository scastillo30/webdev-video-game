# Windows installation and startup

This guide runs the Angular frontend, Go API, SQLite database, and preserved HTML game on a Windows host.

## Prerequisites

Install the following 64-bit tools:

- [Git for Windows](https://git-scm.com/download/win)
- [Node.js 22 LTS](https://nodejs.org/en/download/)
- [Go](https://go.dev/dl/) matching `.go-version` (or a compatible newer toolchain)

After installation, open a new PowerShell window and verify that all commands are available:

```powershell
git --version
node --version
npm --version
go version
```

The repository's `local:*` npm commands use the project-local macOS toolchain and are not intended for Windows. Use the standard commands shown below.

## Download the project

```powershell
git clone https://github.com/scastillo30/webdev-video-game.git
cd webdev-video-game
```

To update an existing checkout instead:

```powershell
git pull origin main
```

## Install dependencies

Install the root development utilities and Angular dependencies:

```powershell
npm install
npm run frontend:install
```

Go downloads its modules automatically the first time the backend starts. To download them explicitly:

```powershell
Set-Location backend
go mod download
Set-Location ..
```

SQLite does not need a separate installer or database service. The backend uses a pure-Go SQLite driver.

## Run in development

Open two PowerShell windows in the repository root.

In the first window, start the API:

```powershell
$env:JIRA_BASE_URL = "https://company.atlassian.net"
$env:JIRA_CREDENTIAL_KEYS = "PASTE-A-GENERATED-URL-SAFE-BASE64-32-BYTE-KEY"
npm run backend:start
```

Generate the key once with a trusted password/key generator or with OpenSSL (`openssl rand -base64 32`). On Windows PowerShell versions where the static `RandomNumberGenerator.Fill` method is unavailable, use:

```powershell
$bytes = New-Object byte[] 32
$rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
$rng.GetBytes($bytes)
$rng.Dispose()
$key = [Convert]::ToBase64String($bytes).TrimEnd('=').Replace('+','-').Replace('/','_')
$env:JIRA_CREDENTIAL_KEYS = $key
```

Store the key in the host's secret configuration, not in the repository. Keep the same value across restarts or existing encrypted login cookies become unreadable. The Jira Server entered in Settings must match `$env:JIRA_BASE_URL`. In production also set `$env:APP_ENV = "production"` so credential cookies require HTTPS.

In the second window, start Angular:

```powershell
npm run frontend:start
```

Open [http://localhost:4200](http://localhost:4200). Angular owns `/game` and forwards `/api` and `/legacy-game` requests to the Go server on port `8080`.

Keep both PowerShell windows open while using the development application. Press `Ctrl+C` in each window to stop it.

## Run the production build locally

Build Angular from the repository root:

```powershell
npm run frontend:build
```

Then start the Go server:

```powershell
npm run backend:start
```

Open [http://localhost:8080](http://localhost:8080). In this mode, Go serves the compiled Angular application, API, and preserved game from one port.

## Create a self-contained Windows release

From a clean repository checkout, build and verify a Windows x64 bundle:

```powershell
npm run release:build -- --target windows-amd64
```

The result is written to `release\webdev-mmorpg-windows-amd64`. Copy that folder to the display host, open PowerShell inside it, and run:

```powershell
.\start.ps1
```

Then open `http://localhost:8080`. Configure Jira through process environment variables before starting; do not write the API token into the release folder. The included `release-manifest.json` records checksums and can be revalidated from a repository checkout with `npm run release:verify -- <release-folder>`.

For an approved deployment candidate, first complete and sign the four-hour soak report, then run:

```powershell
npm run release:candidate -- --soak-report C:\path\to\webdev-tv-soak-report.json --target windows-amd64
```

This reruns the complete quality gate and records a checksum-only soak certificate in the bundle.

The release folder also includes `webdev-admin.exe`. Create a live-safe backup with:

```powershell
.\webdev-admin.exe backup --db .\data\game.db --out .\backups\game-2026-10-25.db
.\webdev-admin.exe verify --file .\backups\game-2026-10-25.db
```

See `BACKUP_RECOVERY.md` before restoring. The server must be stopped, and the command requires `--confirm STOPPED`.

Preview data-retention maintenance without deleting anything:

```powershell
.\webdev-admin.exe prune --db .\data\game.db --event-days 180 --audit-days 365
```

Only after reviewing the counts, apply the same policy with a new pre-prune backup and exact confirmation:

```powershell
.\webdev-admin.exe prune --db .\data\game.db --event-days 180 --audit-days 365 --apply --confirm PRUNE --backup .\backups\before-prune-2026-10-25.db
```

See `DATA_RETENTION.md` for scope and verification steps.

## Database and configuration

The default SQLite database is created automatically at:

```text
backend\data\game.db
```

The data directory and database files are excluded from Git. To use a different database or port in the current PowerShell session:

```powershell
$env:DB_PATH = "C:\WebdevMMORPG\data\game.db"
$env:ADDR = ":8090"
npm run backend:start
```

The application would then be available at `http://localhost:8090` after a production build. Remove those overrides with:

```powershell
Remove-Item Env:DB_PATH
Remove-Item Env:ADDR
```

## Windows troubleshooting

### A command is not recognized

Close and reopen PowerShell after installing Node.js, Go, or Git. If the command still fails, confirm the tool's installation directory is included in the Windows `PATH` environment variable.

### Port 4200 or 8080 is already in use

Find the process using a port:

```powershell
Get-NetTCPConnection -LocalPort 4200,8080 -ErrorAction SilentlyContinue |
  Select-Object LocalPort, State, OwningProcess
```

Stop the conflicting application or configure a different backend port. Angular's development proxy expects the backend at `127.0.0.1:8080` unless `frontend\proxy.conf.json` is updated too.

### Windows Firewall prompt

Allow Node.js and the Go server on private networks when Windows Defender Firewall asks. Public-network access is not required for local development.

### Blank Angular page

Make sure both servers are running, open `http://localhost:4200` rather than the root `index.html`, and perform a hard refresh with `Ctrl+F5`. Check the two PowerShell windows for build or API errors.

### Reinstall frontend dependencies

If dependency installation becomes corrupted, close the development servers and run:

```powershell
Remove-Item -Recurse -Force frontend\node_modules
npm run frontend:install
```

Do not delete `backend\data\game.db` unless you intentionally want to remove the local character database.

For the complete cross-platform development model, see [`DEVELOPMENT.md`](DEVELOPMENT.md). For release-host upgrades and checks, see [`DEPLOYMENT.md`](DEPLOYMENT.md).
