import { db } from "../database";

export interface BackupData {
  version: string;
  timestamp: string;
  data: {
    oradores: any[];
    temas: any[];
    oradorTemas: any[];
    discursos: any[];
    saidasOrador: any[];
    datasEspeciais: any[];
    temasBloqueados: any[];
    configuracoes: any[];
    whatsappInstancias: any[];
  };
}

/**
 * Exporta todos os dados do banco para um objeto de backup
 */
export async function exportarDados(): Promise<BackupData> {
  try {
    const [
      oradores,
      temas,
      oradorTemas,
      discursos,
      saidasOrador,
      datasEspeciais,
      temasBloqueados,
      configuracoes,
      whatsappInstancias,
    ] = await Promise.all([
      db.oradores.toArray(),
      db.temas.toArray(),
      db.oradorTemas.toArray(),
      db.discursos.toArray(),
      db.saidasOrador.toArray(),
      db.datasEspeciais.toArray(),
      db.temasBloqueados.toArray(),
      db.configuracoes.toArray(),
      db.whatsappInstancias.toArray(),
    ]);

    console.log("[Backup Export] Dados sendo exportados:", {
      oradores: oradores.length,
      temas: temas.length,
      oradorTemas: oradorTemas.length,
      discursos: discursos.length,
      saidasOrador: saidasOrador.length,
      datasEspeciais: datasEspeciais.length,
      temasBloqueados: temasBloqueados.length,
      configuracoes: configuracoes.length,
      whatsappInstancias: whatsappInstancias.length,
      detalhesWhatsapp: whatsappInstancias, // ← Mostra os detalhes completos
    });

    return {
      version: "1.0",
      timestamp: new Date().toISOString(),
      data: {
        oradores,
        temas,
        oradorTemas,
        discursos,
        saidasOrador,
        datasEspeciais,
        temasBloqueados,
        configuracoes,
        whatsappInstancias,
      },
    };
  } catch (error) {
    console.error("Erro ao exportar dados:", error);
    throw new Error("Falha ao exportar dados do backup");
  }
}

/**
 * Importa dados de backup para o banco, sobrescrevendo dados existentes
 */
export async function importarDados(backupData: BackupData): Promise<void> {
  try {
    // Validação básica dos dados
    if (!backupData.data || !backupData.version) {
      throw new Error("Arquivo de backup inválido ou corrompido");
    }

    console.log(
      "[Backup] Importando backup - Instâncias WhatsApp a restaurar:",
      backupData.data.whatsappInstancias?.length || 0,
    );

    // Fazer backup automático dos dados atuais antes de sobrescrever
    const backupAtual = await exportarDados();
    localStorage.setItem(
      "backup_auto_antes_importacao",
      JSON.stringify(backupAtual),
    );

    // Limpar todas as tabelas
    await Promise.all([
      db.oradores.clear(),
      db.temas.clear(),
      db.oradorTemas.clear(),
      db.discursos.clear(),
      db.saidasOrador.clear(),
      db.datasEspeciais.clear(),
      db.temasBloqueados.clear(),
      db.configuracoes.clear(),
      db.whatsappInstancias.clear(),
    ]);

    // Importar dados do backup
    const importPromises = [];

    if (backupData.data.oradores?.length > 0) {
      importPromises.push(db.oradores.bulkAdd(backupData.data.oradores));
    }
    if (backupData.data.temas?.length > 0) {
      importPromises.push(db.temas.bulkAdd(backupData.data.temas));
    }
    if (backupData.data.oradorTemas?.length > 0) {
      importPromises.push(db.oradorTemas.bulkAdd(backupData.data.oradorTemas));
    }
    if (backupData.data.discursos?.length > 0) {
      importPromises.push(db.discursos.bulkAdd(backupData.data.discursos));
    }
    if (backupData.data.saidasOrador?.length > 0) {
      importPromises.push(
        db.saidasOrador.bulkAdd(backupData.data.saidasOrador),
      );
    }
    if (backupData.data.datasEspeciais?.length > 0) {
      importPromises.push(
        db.datasEspeciais.bulkAdd(backupData.data.datasEspeciais),
      );
    }
    if (backupData.data.temasBloqueados?.length > 0) {
      importPromises.push(
        db.temasBloqueados.bulkAdd(backupData.data.temasBloqueados),
      );
    }
    if (backupData.data.configuracoes?.length > 0) {
      importPromises.push(
        db.configuracoes.bulkAdd(backupData.data.configuracoes),
      );
    }
    if (backupData.data.whatsappInstancias?.length > 0) {
      importPromises.push(
        db.whatsappInstancias.bulkAdd(backupData.data.whatsappInstancias),
      );
    }

    await Promise.all(importPromises);
  } catch (error) {
    console.error("Erro ao importar dados:", error);
    throw new Error("Falha ao importar dados do backup");
  }
}

/**
 * Faz download do backup como arquivo JSON
 */
export async function downloadBackup(): Promise<void> {
  try {
    const backupData = await exportarDados();
    const dataStr = JSON.stringify(backupData, null, 2);
    const dataBlob = new Blob([dataStr], { type: "application/json" });

    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement("a");
    link.href = url;

    // Nome do arquivo com timestamp
    const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, "-");
    link.download = `backup-oradores-${timestamp}.json`;

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  } catch (error) {
    console.error("Erro ao fazer download do backup:", error);
    throw new Error("Falha ao fazer download do backup");
  }
}

/**
 * Carrega arquivo JSON e retorna os dados de backup
 */
export function carregarArquivoBackup(file: File): Promise<BackupData> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (event) => {
      try {
        const backupData = JSON.parse(
          event.target?.result as string,
        ) as BackupData;

        // Validação básica
        if (!backupData.version || !backupData.data) {
          throw new Error("Arquivo não é um backup válido");
        }

        resolve(backupData);
      } catch (error) {
        reject(new Error("Arquivo de backup inválido ou corrompido"));
      }
    };

    reader.onerror = () => {
      reject(new Error("Erro ao ler o arquivo"));
    };

    reader.readAsText(file);
  });
}

/**
 * Restaura backup a partir de dados carregados
 */
export async function restaurarBackup(backupData: BackupData): Promise<void> {
  // Confirmação adicional antes de restaurar
  const confirmacao = confirm(
    `⚠️ ATENÇÃO: Isso irá sobrescrever TODOS os dados atuais!\n\n` +
      `Backup criado em: ${new Date(backupData.timestamp).toLocaleString(
        "pt-BR",
      )}\n` +
      `Versão: ${backupData.version}\n\n` +
      `Um backup automático dos dados atuais será salvo.\n\n` +
      `Deseja continuar?`,
  );

  if (!confirmacao) {
    throw new Error("Operação cancelada pelo usuário");
  }

  await importarDados(backupData);
}

/**
 * Lista backups automáticos salvos no localStorage
 */
export function listarBackupsAutomaticos(): Array<{
  chave: string;
  data: Date;
  tamanho: number;
}> {
  const backups = [];

  for (let i = 0; i < localStorage.length; i++) {
    const chave = localStorage.key(i);
    if (chave && chave.startsWith("backup_auto_")) {
      try {
        const valor = localStorage.getItem(chave);
        if (valor) {
          const backup = JSON.parse(valor);
          backups.push({
            chave,
            data: new Date(backup.timestamp),
            tamanho: valor.length,
          });
        }
      } catch (error) {
        // Ignora entradas inválidas
      }
    }
  }

  return backups.sort((a, b) => b.data.getTime() - a.data.getTime());
}

/**
 * Remove backup automático específico
 */
export function removerBackupAutomatico(chave: string): void {
  localStorage.removeItem(chave);
}

/**
 * Limpa todos os backups automáticos
 */
export function limparBackupsAutomaticos(): void {
  const chavesParaRemover = [];

  for (let i = 0; i < localStorage.length; i++) {
    const chave = localStorage.key(i);
    if (chave && chave.startsWith("backup_auto_")) {
      chavesParaRemover.push(chave);
    }
  }

  chavesParaRemover.forEach((chave) => localStorage.removeItem(chave));
}
