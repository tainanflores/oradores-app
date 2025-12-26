/* =====================================================
   Google Drive Backup Service (OAuth Correto)
   React + Vite | Google Identity Services
   ===================================================== */

const CLIENT_ID =
  "83029076698-4tug5d3mki41pd8vcri6bltk2s0p04up.apps.googleusercontent.com";

const SCOPES = "https://www.googleapis.com/auth/drive.appdata";

let tokenClient: any = null;
let gapiInited = false;
let gisInited = false;
let accessToken: string | null = null;

/* =====================================================
   LOAD APIs
   ===================================================== */
export function loadGoogleAPI(): Promise<void> {
  return new Promise((resolve, reject) => {
    // @ts-ignore
    gapi.load("client", async () => {
      try {
        // @ts-ignore
        await gapi.client.init({
          discoveryDocs: [
            "https://www.googleapis.com/discovery/v1/apis/drive/v3/rest",
          ],
        });
        gapiInited = true;
        maybeResolve();
      } catch (e) {
        reject(e);
      }
    });

    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;

    script.onload = () => {
      // @ts-ignore
      tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: CLIENT_ID,
        scope: SCOPES,
        callback: () => {},
      });
      gisInited = true;
      maybeResolve();
    };

    script.onerror = () =>
      reject(new Error("Erro ao carregar Google Identity"));

    document.head.appendChild(script);

    function maybeResolve() {
      if (gapiInited && gisInited) resolve();
    }
  });
}

/* =====================================================
   LOGIN SILENCIOSO (CHAVE DO PROBLEMA)
   ===================================================== */
export async function silentSignIn(): Promise<boolean> {
  if (!tokenClient) await loadGoogleAPI();

  return new Promise((resolve) => {
    tokenClient.callback = (resp: any) => {
      if (resp?.access_token) {
        accessToken = resp.access_token;
        // @ts-ignore
        gapi.client.setToken({ access_token: accessToken });
        resolve(true);
      } else {
        resolve(false);
      }
    };

    try {
      tokenClient.requestAccessToken({ prompt: "" });
    } catch {
      resolve(false);
    }
  });
}

/* =====================================================
   LOGIN MANUAL
   ===================================================== */
export async function signInGoogleDrive(): Promise<void> {
  if (!tokenClient) await loadGoogleAPI();

  return new Promise((resolve, reject) => {
    let timeout = setTimeout(() => {
      reject(
        new Error(
          "O login do Google não foi concluído. Verifique se o navegador está bloqueando pop-ups e permita pop-ups para este site."
        )
      );
    }, 15000); // 15 segundos

    tokenClient.callback = (resp: any) => {
      clearTimeout(timeout);
      if (resp?.access_token) {
        accessToken = resp.access_token;
        // @ts-ignore
        gapi.client.setToken({ access_token: accessToken });
        resolve();
      } else {
        reject(resp);
      }
    };

    tokenClient.requestAccessToken({ prompt: "consent" });
  });
}

/* =====================================================
   STATUS
   ===================================================== */
export function isGoogleDriveSignedIn(): boolean {
  return (
    accessToken !== null &&
    // @ts-ignore
    gapi.client.getToken() !== null
  );
}

/* =====================================================
   LOGOUT
   ===================================================== */
export function signOutGoogleDrive(): void {
  if (!accessToken) return;

  // @ts-ignore
  google.accounts.oauth2.revoke(accessToken);
  accessToken = null;
  // @ts-ignore
  gapi.client.setToken(null);
}

/* =====================================================
   UPLOAD BACKUP
   ===================================================== */
export async function uploadBackupToDrive(
  json: string,
  fileName = "backup-oradores.json"
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
   LISTAR E BAIXAR BACKUPS DO DRIVE
   ===================================================== */
export async function listBackupsFromDrive(): Promise<
  Array<{ id: string; name: string; createdTime: string }>
> {
  if (!isGoogleDriveSignedIn()) throw new Error("Google Drive não conectado");
  // @ts-ignore
  const res = await gapi.client.drive.files.list({
    spaces: "appDataFolder",
    fields: "files(id, name, createdTime)",
    orderBy: "createdTime desc",
    q: "mimeType='application/json' and name contains 'backup'",
  });
  return res.result.files || [];
}

export async function downloadBackupFromDrive(fileId: string): Promise<any> {
  if (!isGoogleDriveSignedIn()) throw new Error("Google Drive não conectado");
  // @ts-ignore
  const res = await gapi.client.drive.files.get({
    fileId,
    alt: "media",
  });
  return res.result;
}
