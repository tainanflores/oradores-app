import { useEffect, useState } from "react";
import { useGoogleDriveAuth } from "../contexts/GoogleDriveAuthContext";
import { useConfig } from "../contexts/ConfigContext";
import {
  listBackupsFromDrive,
  downloadBackupFromDrive,
} from "../utils/googleDrive";
import { restaurarBackup } from "../utils/backup";
import toast from "react-hot-toast";

const LAST_SYNC_KEY = "oradores_last_sync";

export function useSyncWithDriveOnStart() {
  const { isSignedIn } = useGoogleDriveAuth();
  const { congregacao } = useConfig();
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    if (!isSignedIn || !congregacao?.autoBackup) return;
    let ignore = false;
    async function checkAndPromptSync() {
      setChecking(true);
      try {
        const backups = await listBackupsFromDrive();
        if (!backups || backups.length === 0) return;
        const latest = backups[0];
        const remoteDate = new Date(latest.createdTime).getTime();
        const localDate = Number(localStorage.getItem(LAST_SYNC_KEY) || 0);
        console.log("Último backup no Drive:", new Date(remoteDate));
        console.log("Última sincronização local:", new Date(localDate));
        if (remoteDate > localDate) {
          if (
            window.confirm(
              "Há um backup mais recente no Google Drive. Deseja restaurar e sincronizar este dispositivo?"
            )
          ) {
            const backupData = await downloadBackupFromDrive(latest.id);
            await restaurarBackup(backupData);
            localStorage.setItem(LAST_SYNC_KEY, String(remoteDate));
            toast.success("Dados sincronizados com sucesso!");
          }
        }
      } catch (err) {
        console.error("Erro ao verificar/baixar backup do Drive:", err);
      } finally {
        if (!ignore) setChecking(false);
      }
    }
    checkAndPromptSync();
    return () => {
      ignore = true;
    };
  }, [isSignedIn, congregacao?.autoBackup]);

  return { checking };
}
