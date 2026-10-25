# SQLite Backup and Recovery

The application stores character configuration, normalized Jira state, activity history, and display settings in one SQLite database. A release bundle keeps it at `data/game.db` unless `DB_PATH` overrides that location.

## Create a backup

Backup is safe while the server is running. It uses SQLite `VACUUM INTO` to create a consistent standalone snapshot, then runs `PRAGMA quick_check` and reports its SHA-256 digest.

macOS or Linux:

```sh
./webdev-admin backup --db ./data/game.db --out ./backups/game-2026-10-25.db
./webdev-admin verify --file ./backups/game-2026-10-25.db
```

Windows PowerShell:

```powershell
.\webdev-admin.exe backup --db .\data\game.db --out .\backups\game-2026-10-25.db
.\webdev-admin.exe verify --file .\backups\game-2026-10-25.db
```

Backup never overwrites an existing file. Use a new dated filename for every snapshot, retain copies outside the release directory, and record the reported checksum with the operational change ticket.

## Restore a backup

Restore changes production data. Follow this order:

1. Stop `webdev-server` and confirm it is no longer listening.
2. Verify the selected backup.
3. Copy the backup off-host if it is the only retained copy.
4. Run restore with the exact confirmation value `STOPPED`.
5. Start the server and check `/api/ready`, `/api/version`, Game View, mappings, and Jira freshness.

macOS or Linux:

```sh
./webdev-admin restore --db ./data/game.db --from ./backups/game-2026-10-25.db --confirm STOPPED
```

Windows PowerShell:

```powershell
.\webdev-admin.exe restore --db .\data\game.db --from .\backups\game-2026-10-25.db --confirm STOPPED
```

Before activating the backup, restore renames the current database to a timestamped `game.db.rollback-*` file and preserves matching `-wal` and `-shm` sidecars. Do not delete those files until the restored application has been verified.

## Roll back the restore

If validation fails, stop the server again. Preserve the failed restored database for investigation, then restore the timestamped rollback database using the same command and confirmation workflow. The tool always verifies the source before replacing the active database.

Never restore while the server is running, never copy only an active WAL-mode `game.db` as a backup, and never store Jira credentials inside backup folders.
