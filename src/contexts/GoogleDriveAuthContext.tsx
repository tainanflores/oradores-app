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
  silentSignIn,
  isGoogleDriveSignedIn,
  uploadBackupToDrive,
  listBackupsFromDrive,
  downloadBackupFromDrive,
} from "../utils/googleDrive";
import { restaurarBackup } from "../utils/backup";
import toast from "react-hot-toast";

interface GoogleDriveAuthContextType {
  isSignedIn: boolean;
  loading: boolean;
  signIn: () => Promise<void>;
  signOut: () => void;
  silentSignIn: () => Promise<boolean>;
  uploadBackup: (json: string, fileName?: string) => Promise<string>;
}

const GoogleDriveAuthContext = createContext<
  GoogleDriveAuthContextType | undefined
>(undefined);

export function GoogleDriveAuthProvider({ children }: { children: ReactNode }) {
  const [isSignedIn, setIsSignedIn] = useState(false);
  const [loading, setLoading] = useState(false);
  const [hasTriedSilentSignIn, setHasTriedSilentSignIn] = useState(false);
  const [explicitlyLoggedOut, setExplicitlyLoggedOut] = useState(() => {
    return localStorage.getItem("gdrive_explicitly_logged_out") === "true";
  });

  // Tenta login silencioso ao montar, apenas se não fez logout explícito
  useEffect(() => {
    if (!hasTriedSilentSignIn && !explicitlyLoggedOut) {
      setHasTriedSilentSignIn(true);
      silentSignIn().then((success) => {
        setIsSignedIn(success);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasTriedSilentSignIn, explicitlyLoggedOut]);

  // Atualiza status de login periodicamente
  useEffect(() => {
    const interval = setInterval(() => {
      setIsSignedIn(isGoogleDriveSignedIn());
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  const signIn = async () => {
    setLoading(true);
    try {
      await signInGoogleDrive();
      setIsSignedIn(isGoogleDriveSignedIn());
      setExplicitlyLoggedOut(false);
      localStorage.removeItem("gdrive_explicitly_logged_out");

      // Após login, verifica backup online
      try {
        const backups = await listBackupsFromDrive();
        if (backups && backups.length > 0) {
          const latest = backups[0];
          const remoteDate = new Date(latest.createdTime).getTime();
          const localDate = Number(
            localStorage.getItem("oradores_last_sync") || 0
          );
          if (remoteDate > localDate) {
            if (
              window.confirm(
                "Há um backup mais recente no Google Drive. Deseja restaurar e sincronizar este dispositivo? Isso pode sobrescrever dados locais."
              )
            ) {
              const backupData = await downloadBackupFromDrive(latest.id);
              await restaurarBackup(backupData);
              localStorage.setItem("oradores_last_sync", String(remoteDate));
              toast.success("Dados sincronizados com sucesso!");
            }
          }
        }
      } catch (err) {
        console.error(
          "Erro ao verificar/baixar backup do Drive após login:",
          err
        );
      }
    } catch (err) {
      toast.error(
        "Falha ao conectar com o Google Drive. Permita pop-ups no navegador e tente novamente." +
          err
      );
    } finally {
      setLoading(false);
    }
  };

  const signOut = () => {
    setLoading(true);
    try {
      signOutGoogleDrive();
      setIsSignedIn(false);
      setHasTriedSilentSignIn(false);
      setExplicitlyLoggedOut(true);
      localStorage.setItem("gdrive_explicitly_logged_out", "true");
      toast.success("Desconectado do Google Drive!");
    } finally {
      setLoading(false);
    }
  };

  const uploadBackup = async (json: string, fileName?: string) => {
    return uploadBackupToDrive(json, fileName);
  };

  return (
    <GoogleDriveAuthContext.Provider
      value={{
        isSignedIn,
        loading,
        signIn,
        signOut,
        silentSignIn,
        uploadBackup,
      }}
    >
      {children}
    </GoogleDriveAuthContext.Provider>
  );
}

export function useGoogleDriveAuth() {
  const ctx = useContext(GoogleDriveAuthContext);
  if (!ctx)
    throw new Error(
      "useGoogleDriveAuth deve ser usado dentro do GoogleDriveAuthProvider"
    );
  return ctx;
}
