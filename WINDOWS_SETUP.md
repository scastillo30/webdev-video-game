# Windows installation and startup

This guide runs the Angular frontend, Go API, SQLite database, and preserved HTML game on a Windows host.

## Prerequisites

Install the following 64-bit tools:

- [Git for Windows](https://git-scm.com/download/win)
- [Node.js 22 LTS](https://nodejs.org/en/download/)
- [Go 1.22 or newer](https://go.dev/dl/)

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
npm run backend:start
```

In the second window, start Angular:

```powershell
npm run frontend:start
```

Open [http://localhost:4200](http://localhost:4200). Angular automatically forwards `/api` and `/game` requests to the Go server on port `8080`.

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
