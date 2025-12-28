import toast from "react-hot-toast";
import { db } from "../database";
import { exportarDados } from "./backup";

/**
 * Salva dados em uma tabela do banco e dispara backup automático se ativado.
 * @param table Nome da tabela (ex: "oradores")
 * @param data Objeto a ser salvo
 * @param autoBackup Se backup automático está ativo
 * @param isSignedIn Se está conectado ao Google Drive
 * @param uploadBackup Função para enviar backup ao Drive
 * @param showToast (opcional) Se deve exibir toast de sucesso/erro (padrão: true)
 */
export async function dbSaveWithBackup<T>(
  table: keyof typeof db,
  data: T | T[],
  autoBackup: boolean,
  isSignedIn: boolean,
  uploadBackup: (json: string, fileName?: string) => Promise<string>,
  showToast: boolean = true
) {
  try {
    // Se for array, use bulkPut; se não, use put
    if (Array.isArray(data)) {
      // @ts-expect-error
      await db[table].bulkPut(data);
    } else {
      // @ts-expect-error
      await db[table].put(data);
    }
  } catch (err) {
    throw err;
  }

  if (autoBackup && isSignedIn) {
    try {
      const backupData = await exportarDados();
      const timestamp = new Date()
        .toISOString()
        .slice(0, 19)
        .replace(/:/g, "-");
      const fileName = `backup-auto-oradores-${timestamp}.json`;
      await uploadBackup(JSON.stringify(backupData), fileName);
      // Salva localmente o timestamp do backup para evitar conflito de versão
      localStorage.setItem("oradores_last_sync", String(Date.now()));
    } catch (err) {
      if (showToast) toast.error("Falha ao enviar backup automático!");
    }
  }
}

/**
 * Remove dados de uma tabela do banco e dispara backup automático se ativado.
 * @param table Nome da tabela (ex: "oradores")
 * @param id ID do registro a ser removido
 * @param autoBackup Se backup automático está ativo
 * @param isSignedIn Se está conectado ao Google Drive
 * @param uploadBackup Função para enviar backup ao Drive
 * @param showToast (opcional) Se deve exibir toast de sucesso/erro (padrão: true)
 */
export async function dbDeleteWithBackup(
  table: keyof typeof db,
  id: number | string,
  autoBackup: boolean,
  isSignedIn: boolean,
  uploadBackup: (json: string, fileName?: string) => Promise<string>,
  showToast: boolean = true
) {
  try {
    // @ts-expect-error
    await db[table].delete(id);
    if (showToast) toast.success("Registro removido com sucesso!");
  } catch (err) {
    if (showToast) toast.error("Erro ao remover registro!");
    throw err;
  }

  if (autoBackup && isSignedIn) {
    try {
      const backupData = await exportarDados();
      const timestamp = new Date()
        .toISOString()
        .slice(0, 19)
        .replace(/:/g, "-");
      const fileName = `backup-auto-oradores-${timestamp}.json`;
      await uploadBackup(JSON.stringify(backupData), fileName);
      // Salva localmente o timestamp do backup para evitar conflito de versão
      localStorage.setItem("oradores_last_sync", String(Date.now()));
    } catch (err) {
      if (showToast) toast.error("Falha ao enviar backup automático!");
    }
  }
}
