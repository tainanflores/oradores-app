/* =====================================================
   Google Drive Backup Service
   React + Vite | Google Identity Services (GSI)
   ===================================================== */

const CLIENT_ID =
  "83029076698-31so6g1mma1c5368npg4fdpta0smlv6l.apps.googleusercontent.com";

const SCOPES = "https://www.googleapis.com/auth/drive.appdata";

/* =====================================================
   INTERNAL STATE
   ===================================================== */
let tokenClient: google.accounts.oauth2.TokenClient | null = null;
let accessToken: string | null = null;
let initPromise: Promise<void> | null = null;

// Chaves para armazenar token no localStorage
const TOKEN_STORAGE_KEY = "google_drive_access_token";
const TOKEN_EXPIRY_KEY = "google_drive_token_expiry";
const TOKEN_TIMESTAMP_KEY = "google_drive_token_timestamp";

/* =====================================================
   LOAD GOOGLE APIS (singleton)
   ===================================================== */
function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) {
      resolve();
      return;
    }

    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Erro ao carregar script: ${src}`));
    document.head.appendChild(script);
  });
}

export function loadGoogleAPI(): Promise<void> {
  if (initPromise) return initPromise;

  initPromise = (async () => {
    // Google API client
    await loadScript("https://apis.google.com/js/api.js");
    // @ts-ignore
    await new Promise<void>((resolve) => gapi.load("client", resolve));
    // @ts-ignore
    await gapi.client.init({
      discoveryDocs: [
        "https://www.googleapis.com/discovery/v1/apis/drive/v3/rest",
      ],
    });

    // Google Identity Services
    await loadScript("https://accounts.google.com/gsi/client");
    // @ts-ignore
    tokenClient = google.accounts.oauth2.initTokenClient({
      client_id: CLIENT_ID,
      scope: SCOPES,
      callback: () => {},
    });
  })();

  return initPromise;
}

/* =====================================================
   AUTH HELPERS
   ===================================================== */

/**
 * Salva token no localStorage com informação de expiração
 */
function setSession(token: string, expiresIn = 3599) {
  const expiryTime = Date.now() + expiresIn * 1000;

  accessToken = token;
  localStorage.setItem(TOKEN_STORAGE_KEY, token);
  localStorage.setItem(TOKEN_EXPIRY_KEY, String(expiryTime));
  localStorage.setItem(TOKEN_TIMESTAMP_KEY, String(Date.now()));

  // @ts-ignore
  gapi.client.setToken({ access_token: token });

  console.log(
    `[GoogleDrive] Token salvo. Expira em: ${new Date(expiryTime).toLocaleTimeString("pt-BR")}`,
  );
}

/**
 * Carrega token do localStorage se válido
 */
function loadSavedToken(): string | null {
  const savedToken = localStorage.getItem(TOKEN_STORAGE_KEY);
  const expiry = localStorage.getItem(TOKEN_EXPIRY_KEY);

  if (!savedToken || !expiry) {
    return null;
  }

  const expiryTime = Number(expiry);
  const now = Date.now();

  // Se expirou, remove e retorna null
  if (now >= expiryTime) {
    console.log("[GoogleDrive] Token expirado. Removendo...");
    clearSavedToken();
    return null;
  }

  // Token válido
  const minutesRemaining = Math.round((expiryTime - now) / 1000 / 60);
  console.log(
    `[GoogleDrive] Token carregado do localStorage (válido por ${minutesRemaining}min)`,
  );

  return savedToken;
}

/**
 * Limpa token do localStorage
 */
function clearSavedToken() {
  localStorage.removeItem(TOKEN_STORAGE_KEY);
  localStorage.removeItem(TOKEN_EXPIRY_KEY);
  localStorage.removeItem(TOKEN_TIMESTAMP_KEY);
}

function clearSession() {
  accessToken = null;
  clearSavedToken();
  // @ts-ignore
  gapi.client.setToken(null);
}

function markAuthenticationTime() {
  const timestamp = Date.now();
  localStorage.setItem("google_auth_time", String(timestamp));
  console.log("[GoogleDrive] Autenticação marcada:", new Date(timestamp));
}

function hasBeenAuthenticatedBefore(): boolean {
  const authTime = localStorage.getItem("google_auth_time");
  const hasAuth = !!authTime;
  console.log("[GoogleDrive] Autenticado antes?", hasAuth);
  return hasAuth;
}

function clearAuthenticationTime() {
  localStorage.removeItem("google_auth_time");
  console.log("[GoogleDrive] Marca de autenticação removida");
}

/* =====================================================
   SILENT SIGN-IN
   ===================================================== */
export async function silentSignIn(): Promise<boolean> {
  await loadGoogleAPI();
  if (!tokenClient) return false;

  // 1º: Tenta carregar token já salvo
  const savedToken = loadSavedToken();
  if (savedToken) {
    console.log("[GoogleDrive] Usando token salvo - login persistente");
    setSession(savedToken);
    return true;
  }

  // 2º: Só tenta novo login silencioso se foi autenticado antes
  if (!hasBeenAuthenticatedBefore()) {
    console.log(
      "[GoogleDrive] Nunca autenticado antes - não tentando silent sign-in",
    );
    return false;
  }

  return new Promise((resolve) => {
    tokenClient!.callback = (resp: any) => {
      if (resp?.access_token) {
        console.log("[GoogleDrive] Silent sign-in bem-sucedido");
        setSession(resp.access_token, resp.expires_in || 3599);
        markAuthenticationTime();
        resolve(true);
      } else {
        console.log("[GoogleDrive] Silent sign-in falhou");
        resolve(false);
      }
    };

    try {
      console.log("[GoogleDrive] Tentando silent sign-in (select_account)...");
      // 'select_account' permite o user escolher conta sem pedir consentimento novamente
      // Respeita cookies de sessão do navegador
      tokenClient!.requestAccessToken({
        prompt: "select_account",
      });
    } catch (err) {
      console.error("[GoogleDrive] Erro ao tentar silent sign-in:", err);
      resolve(false);
    }
  });
}

/* =====================================================
   MANUAL SIGN-IN
   ===================================================== */
export async function signInGoogleDrive(): Promise<void> {
  await loadGoogleAPI();
  if (!tokenClient) throw new Error("Token client não inicializado");

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(
        new Error(
          "Login do Google não concluído. Verifique bloqueio de pop-ups.",
        ),
      );
    }, 30000);

    tokenClient!.callback = (resp: any) => {
      clearTimeout(timeout);
      if (resp?.access_token) {
        console.log("[GoogleDrive] Manual sign-in sucesso");
        setSession(resp.access_token, resp.expires_in || 3599);
        // Marcar que foi autenticado com sucesso
        markAuthenticationTime();
        resolve();
      } else {
        reject(resp);
      }
    };

    tokenClient!.requestAccessToken({ prompt: "consent" });
  });
}

/* =====================================================
   STATUS
   ===================================================== */
export function isGoogleDriveSignedIn(): boolean {
  return !!accessToken;
}

/* =====================================================
   LOGOUT
   ===================================================== */
export function signOutGoogleDrive(): void {
  if (!accessToken) return;

  // @ts-ignore
  google.accounts.oauth2.revoke(accessToken);
  clearSession();
  clearAuthenticationTime();
  clearSavedToken();
  console.log("[GoogleDrive] Logout completo - token removido");
}

/* =====================================================
   UPLOAD BACKUP
   ===================================================== */
export async function uploadBackupToDrive(
  json: string,
  fileName = "backup-oradores.json",
): Promise<string> {
  if (!isGoogleDriveSignedIn()) {
    throw new Error("Google Drive não conectado");
  }

  const boundary = "-------314159265358979323846";

  const body =
    `\r\n--${boundary}\r\n` +
    "Content-Type: application/json\r\n\r\n" +
    JSON.stringify({
      name: fileName,
      parents: ["appDataFolder"],
      mimeType: "application/json",
    }) +
    `\r\n--${boundary}\r\n` +
    "Content-Type: application/json\r\n\r\n" +
    json +
    `\r\n--${boundary}--`;

  // @ts-ignore
  const res = await gapi.client.request({
    path: "/upload/drive/v3/files",
    method: "POST",
    params: { uploadType: "multipart" },
    headers: {
      "Content-Type": `multipart/related; boundary=${boundary}`,
    },
    body,
  });

  return res.result.id;
}

/* =====================================================
   LIST BACKUPS
   ===================================================== */
export async function listBackupsFromDrive(): Promise<
  Array<{ id: string; name: string; createdTime: string }>
> {
  if (!isGoogleDriveSignedIn()) {
    throw new Error("Google Drive não conectado");
  }

  // @ts-ignore
  const res = await gapi.client.drive.files.list({
    spaces: "appDataFolder",
    fields: "files(id, name, createdTime)",
    orderBy: "createdTime desc",
    q: "mimeType='application/json' and name contains 'backup'",
  });

  return res.result.files || [];
}

/* =====================================================
   DOWNLOAD BACKUP
   ===================================================== */
export async function downloadBackupFromDrive(fileId: string): Promise<any> {
  if (!isGoogleDriveSignedIn()) {
    throw new Error("Google Drive não conectado");
  }

  // @ts-ignore
  const res = await gapi.client.drive.files.get({
    fileId,
    alt: "media",
  });

  return res.result;
}
