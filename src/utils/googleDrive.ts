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
function setSession(token: string) {
  accessToken = token;
  // @ts-ignore
  gapi.client.setToken({ access_token: token });
}

function clearSession() {
  accessToken = null;
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

  // Só tenta login silencioso se foi autenticado antes
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
        setSession(resp.access_token);
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
        setSession(resp.access_token);
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
