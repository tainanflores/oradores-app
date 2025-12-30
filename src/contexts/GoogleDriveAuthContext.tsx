import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import {
  signInGoogleDrive,
  signOutGoogleDrive,
  silentSignIn as silentSignInService,
  uploadBackupToDrive,
  listBackupsFromDrive,
  downloadBackupFromDrive,
} from "../utils/googleDrive";
import { restaurarBackup } from "../utils/backup";
import toast from "react-hot-toast";

/* =====================================================
   TYPES
   ===================================================== */
interface GoogleDriveAuthContextType {
  isSignedIn: boolean;
  loading: boolean;
  signIn: () => Promise<void>;
  signOut: () => void;
  uploadBackup: (json: string, fileName?: string) => Promise<string>;
}

/* =====================================================
   CONTEXT
   ===================================================== */
const GoogleDriveAuthContext = createContext<
  GoogleDriveAuthContextType | undefined
>(undefined);

/* =====================================================
   PROVIDER
   ===================================================== */
export function GoogleDriveAuthProvider({ children }: { children: ReactNode }) {
  const [isSignedIn, setIsSignedIn] = useState(false);
  const [loading, setLoading] = useState(false);
  const [hasTriedSilentSignIn, setHasTriedSilentSignIn] = useState(false);

  const explicitlyLoggedOut =
    localStorage.getItem("gdrive_explicitly_logged_out") === "true";

  /* =====================================================
     SILENT SIGN-IN (executa uma vez ao iniciar)
     ===================================================== */
  useEffect(() => {
    const wasAuthorized =
      localStorage.getItem("googleDriveAuthorized") === "true";

    if (explicitlyLoggedOut) return;
    if (!wasAuthorized) return;
    if (hasTriedSilentSignIn) return;

    setHasTriedSilentSignIn(true);

    silentSignInService().then((success) => {
      setIsSignedIn(success);

      if (!success) {
        localStorage.removeItem("googleDriveAuthorized");
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasTriedSilentSignIn]);

  /* =====================================================
     LOGIN MANUAL
     ===================================================== */
  const signIn = async () => {
    setLoading(true);

    try {
      await signInGoogleDrive();
      setIsSignedIn(true);

      localStorage.setItem("googleDriveAuthorized", "true");
      localStorage.removeItem("gdrive_explicitly_logged_out");

      await checkAndRestoreBackup();

      toast.success("Google Drive conectado com sucesso!");
    } catch (err) {
      console.error(err);
      toast.error(
        "Falha ao conectar com o Google Drive. Permita pop-ups e tente novamente."
      );
    } finally {
      setLoading(false);
    }
  };

  /* =====================================================
     LOGOUT
     ===================================================== */
  const signOut = () => {
    setLoading(true);
    try {
      signOutGoogleDrive();
      setIsSignedIn(false);
      setHasTriedSilentSignIn(false);

      localStorage.removeItem("googleDriveAuthorized");
      localStorage.setItem("gdrive_explicitly_logged_out", "true");

      toast.success("Desconectado do Google Drive");
    } finally {
      setLoading(false);
    }
  };

  /* =====================================================
     BACKUP
     ===================================================== */
  const uploadBackup = async (json: string, fileName?: string) => {
    try {
      setLoading(true);
      return uploadBackupToDrive(json, fileName);
    } catch (err) {
      console.error("Erro ao enviar backup para o Drive:", err);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  /* =====================================================
     RESTORE AUTOMÁTICO APÓS LOGIN
     ===================================================== */
  async function checkAndRestoreBackup() {
    try {
      const backups = await listBackupsFromDrive();
      if (!backups || backups.length === 0) return;

      const latest = backups[0];
      const remoteDate = new Date(latest.createdTime).getTime();
      const localDate = Number(localStorage.getItem("oradores_last_sync") || 0);

      if (remoteDate <= localDate) return;

      const confirmRestore = window.confirm(
        "Há um backup mais recente no Google Drive. Deseja restaurar e sincronizar este dispositivo? Isso pode sobrescrever dados locais."
      );

      if (!confirmRestore) return;

      const backupData = await downloadBackupFromDrive(latest.id);
      await restaurarBackup(backupData);

      localStorage.setItem("oradores_last_sync", String(remoteDate));
      toast.success("Dados restaurados e sincronizados!");
    } catch (err) {
      console.error("Erro ao restaurar backup:", err);
    }
  }

  /* =====================================================
     PROVIDER VALUE
     ===================================================== */
  return (
    <GoogleDriveAuthContext.Provider
      value={{
        isSignedIn,
        loading,
        signIn,
        signOut,
        uploadBackup,
      }}
    >
      {children}
    </GoogleDriveAuthContext.Provider>
  );
}

/* =====================================================
   HOOK
   ===================================================== */
export function useGoogleDriveAuth() {
  const ctx = useContext(GoogleDriveAuthContext);
  if (!ctx) {
    throw new Error(
      "useGoogleDriveAuth deve ser usado dentro do GoogleDriveAuthProvider"
    );
  }
  return ctx;
}
