import { useRef, useState } from 'react';
import { ApiError } from '../../api/client';
import { database, type DatabaseHealth } from '../../api/database';

const ACK_PHRASE = 'ACKNOWLEDGED';

type Busy = null | 'backup' | 'health' | 'repair' | 'restore' | 'reset';
type Danger = null | 'repair' | 'restore' | 'reset';

function errMsg(e: unknown): string {
  if (e instanceof ApiError) return e.message;
  if (e instanceof Error) return e.message;
  return 'Something went wrong';
}

export default function DataManagementPage() {
  const [busy, setBusy] = useState<Busy>(null);
  const [danger, setDanger] = useState<Danger>(null);
  const [ack, setAck] = useState('');
  const [restoreFile, setRestoreFile] = useState<File | null>(null);
  const [dangerError, setDangerError] = useState<string | null>(null);
  const [health, setHealth] = useState<DatabaseHealth | null>(null);
  const [flash, setFlash] = useState<{ kind: 'ok' | 'err'; message: string } | null>(null);
  const restoreInputRef = useRef<HTMLInputElement>(null);

  const backup = async () => {
    setBusy('backup');
    setFlash(null);
    try {
      await database.backup();
      setFlash({ kind: 'ok', message: 'Backup downloaded' });
    } catch (e) {
      setFlash({ kind: 'err', message: errMsg(e) || 'Backup failed' });
    } finally {
      setBusy(null);
    }
  };

  const checkHealth = async () => {
    setBusy('health');
    setFlash(null);
    try {
      const result = await database.health();
      setHealth(result);
      setFlash({
        kind: result.ok ? 'ok' : 'err',
        message: result.ok ? 'Database health check passed' : 'Database corruption detected',
      });
    } catch (e) {
      setFlash({ kind: 'err', message: errMsg(e) || 'Health check failed' });
    } finally {
      setBusy(null);
    }
  };

  const openRestore = () => {
    setRestoreFile(null);
    restoreInputRef.current?.click();
  };

  const onRestoreFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    setRestoreFile(f);
    setAck('');
    setDangerError(null);
    setDanger('restore');
  };

  const openRepair = () => {
    setAck('');
    setRestoreFile(null);
    setDangerError(null);
    setDanger('repair');
  };

  const openReset = () => {
    setAck('');
    setRestoreFile(null);
    setDangerError(null);
    setDanger('reset');
  };

  const closeDanger = () => {
    setDanger(null);
    setAck('');
    setRestoreFile(null);
    setDangerError(null);
  };

  const confirmDanger = async () => {
    if (ack.trim().toUpperCase() !== ACK_PHRASE) return;

    if (danger === 'repair') {
      setBusy('repair');
      setDangerError(null);
      try {
        const result = await database.repair();
        setHealth({ ok: result.ok, status: result.status, detail: result.detail });
        closeDanger();
        setFlash({
          kind: result.ok ? 'ok' : 'err',
          message: result.repaired
            ? 'Database repaired'
            : result.ok
              ? 'Database is already healthy'
              : 'Database repair did not fully resolve corruption',
        });
      } catch (e) {
        setDangerError(errMsg(e) || 'Repair failed');
      } finally {
        setBusy(null);
      }
    } else if (danger === 'restore' && restoreFile) {
      setBusy('restore');
      setDangerError(null);
      try {
        await database.restore(restoreFile);
        closeDanger();
        setFlash({ kind: 'ok', message: 'Database restored — reloading…' });
        setTimeout(() => window.location.reload(), 1200);
      } catch (e) {
        setDangerError(errMsg(e) || 'Restore failed');
      } finally {
        setBusy(null);
      }
    } else if (danger === 'reset') {
      setBusy('reset');
      setDangerError(null);
      try {
        await database.reset();
        closeDanger();
        setFlash({ kind: 'ok', message: 'All data deleted — reloading…' });
        setTimeout(() => window.location.reload(), 1200);
      } catch (e) {
        setDangerError(errMsg(e) || 'Delete failed');
      } finally {
        setBusy(null);
      }
    }
  };

  return (
    <div aria-label="Data Management">
      {flash && (
        <div
          role="status"
          className={`mb-4 rounded-md border px-3 py-2 text-sm ${
            flash.kind === 'ok'
              ? 'border-emerald-300 bg-emerald-50 text-emerald-800'
              : 'border-red-300 bg-red-50 text-red-800'
          }`}
        >
          {flash.message}
        </div>
      )}

      <p className="mb-4 text-sm text-slate-600">
        Back up the campaign database to a file, restore from a previous backup, or wipe it
        entirely. This affects the database only.
      </p>

      <div className="flex flex-col gap-4">
        <button
          onClick={backup}
          disabled={busy !== null}
          className="self-start rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {busy === 'backup' ? 'Preparing backup…' : 'Download Backup'}
        </button>

        <div className="rounded-md border border-slate-200 bg-white p-4">
          <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-slate-500">
            Database Health
          </p>
          <p className="mb-3 text-xs text-slate-500">
            Run a SQLite integrity check, or attempt a safe index repair. Repair snapshots the
            database first.
          </p>
          {health && (
            <div
              role="status"
              className={`mb-3 rounded-md border px-3 py-2 text-xs ${
                health.ok
                  ? 'border-emerald-300 bg-emerald-50 text-emerald-800'
                  : 'border-red-300 bg-red-50 text-red-800'
              }`}
            >
              <span className="font-semibold">{health.ok ? 'Healthy' : 'Corruption detected'}:</span>{' '}
              <span className="font-mono break-words">{health.detail}</span>
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            <button
              onClick={checkHealth}
              disabled={busy !== null}
              className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {busy === 'health' ? 'Checking…' : 'Check Health'}
            </button>
            <button
              onClick={openRepair}
              disabled={busy !== null || health?.ok !== false}
              className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800 hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {busy === 'repair' ? 'Repairing…' : 'Repair Database'}
            </button>
          </div>
        </div>

        <div className="rounded-md border border-red-300 bg-red-50 p-4">
          <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-red-700">
            Danger Zone
          </p>
          <p className="mb-4 text-xs text-red-700/80">
            These actions permanently overwrite or erase the campaign database and cannot be
            undone. Download a backup first.
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={openRestore}
              disabled={busy !== null}
              className="rounded-md border border-red-400 bg-white px-3 py-2 text-sm text-red-700 hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Restore from Backup…
            </button>
            <button
              onClick={openReset}
              disabled={busy !== null}
              className="rounded-md bg-red-700 px-3 py-2 text-sm text-white hover:bg-red-600 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Delete All Data
            </button>
          </div>
          <input
            ref={restoreInputRef}
            type="file"
            accept=".db,.sqlite,.sqlite3,application/octet-stream"
            onChange={onRestoreFile}
            className="hidden"
          />
        </div>
      </div>

      {danger && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="w-full max-w-md rounded-lg border border-red-300 bg-white p-6 shadow-xl">
            <h3 className="mb-2 text-lg font-bold text-red-700">
              {danger === 'repair'
                ? 'Repair database?'
                : danger === 'restore'
                  ? 'Restore database?'
                  : 'Delete all data?'}
            </h3>
            {danger === 'repair' ? (
              <p className="mb-4 text-sm text-slate-700">
                This will snapshot the current database, run SQLite <span className="font-mono">REINDEX</span>,
                and verify the result with an integrity check.
              </p>
            ) : danger === 'restore' ? (
              <p className="mb-4 text-sm text-slate-700">
                This will <strong className="text-red-700">overwrite the entire current database</strong> with
                the contents of <span className="font-mono">{restoreFile?.name}</span>. This{' '}
                <strong className="text-red-700">cannot be recovered</strong> unless you have a backup.
              </p>
            ) : (
              <p className="mb-4 text-sm text-slate-700">
                This will <strong className="text-red-700">permanently erase every campaign, character,
                and message</strong> in the database. This <strong className="text-red-700">cannot be undone</strong>.
              </p>
            )}
            <label className="mb-1.5 block text-xs text-slate-500">
              Type <span className="font-mono font-semibold text-red-700">{ACK_PHRASE}</span> to confirm:
            </label>
            <input
              autoFocus
              value={ack}
              onChange={(e) => setAck(e.target.value)}
              placeholder={ACK_PHRASE}
              className="mb-4 w-full rounded-md border border-slate-300 px-3 py-2 font-mono text-sm tracking-wider focus:border-red-500 focus:outline-none"
            />
            {dangerError && (
              <div className="mb-4 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800">
                {dangerError}
              </div>
            )}
            <div className="flex justify-end gap-2">
              <button
                onClick={closeDanger}
                disabled={busy !== null}
                className="rounded-md bg-slate-100 px-4 py-2 text-sm text-slate-700 hover:bg-slate-200 disabled:opacity-40"
              >
                Cancel
              </button>
              <button
                onClick={confirmDanger}
                disabled={busy !== null || ack.trim().toUpperCase() !== ACK_PHRASE}
                className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {busy === 'repair'
                  ? 'Repairing…'
                  : busy === 'restore'
                    ? 'Restoring…'
                    : busy === 'reset'
                      ? 'Deleting…'
                      : danger === 'repair'
                        ? 'Repair Database'
                        : danger === 'restore'
                          ? 'Overwrite Database'
                          : 'Delete Everything'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
