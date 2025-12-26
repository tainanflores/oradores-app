import { useGoogleDriveAuth } from "../contexts/GoogleDriveAuthContext";

interface GoogleDriveStatusBarProps {
  autoBackup: boolean;
}

export default function GoogleDriveStatusBar({
  autoBackup,
}: GoogleDriveStatusBarProps) {
  const { isSignedIn, loading, signIn } = useGoogleDriveAuth();

  if (isSignedIn || !autoBackup) return null;

  return (
    <div className="fixed top-0 left-0 w-full z-50 bg-yellow-400 text-black text-xs flex items-center justify-center py-1 shadow animate-pulse">
      <span className="truncate max-w-xs sm:max-w-md md:max-w-lg">
        ⚠️ Conecte ao Google Drive para backup automático.
      </span>
      <button
        onClick={signIn}
        disabled={loading}
        className="ml-2 bg-blue-600 text-white px-2 py-0.5 rounded text-xs hover:bg-blue-700 transition-colors disabled:opacity-50"
        style={{ minWidth: 70 }}
      >
        {loading ? "Conectando..." : "Conectar"}
      </button>
    </div>
  );
}
