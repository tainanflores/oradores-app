//util para importar e exportar discursos em formato CSV
import { db } from "../database";
import Papa from "papaparse";
import { dbSaveWithBackup } from "./dbWithBackup";

//FUNÇÃO DE EXPORTAR
export async function exportDiscursosToCSV() {
  // 1. Buscar todos os discursos
  const discursos = await db.discursos.toArray();

  // 2. Para cada discurso, buscar orador e tema
  const exportData = await Promise.all(
    discursos.map(async (discurso) => {
      const orador = await db.oradores.get(discurso.oradorId);
      const tema = await db.temas.get(discurso.temaId);
      return {
        data: discurso.data,
        orador: orador?.nome || "",
        numero: tema?.numero || "",
        tema: tema?.titulo || "",
        telefone: orador?.telefone || "",
        congregacao: orador?.congregacao || "",
        cidade_uf: orador?.cidade || "",
      };
    })
  );

  // 3. Converter para CSV
  const csv = Papa.unparse(exportData, {
    columns: [
      "data",
      "orador",
      "numero",
      "tema",
      "telefone",
      "congregacao",
      "cidade_uf",
    ],
    delimiter: ",",
    header: true,
  });

  // 4. Baixar arquivo
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.setAttribute("download", "discursos.csv");
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// Importa discursos de um arquivo CSV, usando dbWithBackup para inserir discursos
export async function importDiscursosFromCSV(
  file: File,
  autoBackup: boolean,
  isSignedIn: boolean,
  uploadBackup: (json: string, fileName?: string) => Promise<string>
) {
  return new Promise<void>((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        try {
          const rows = results.data as Array<any>;
          for (const row of rows) {
            // Validação básica
            if (!row.data || !row.orador || !row.numero) continue;

            // Converter data para formato ISO (aaaa-mm-dd)
            let dataISO = row.data;
            // Aceita formatos dd-mm-aaaa ou dd/mm/aaaa
            const match = row.data.match(/^(\d{2})[\/-](\d{2})[\/-](\d{4})$/);
            if (match) {
              // dd-mm-aaaa ou dd/mm/aaaa => aaaa-mm-dd
              const [, dd, mm, aaaa] = match;
              dataISO = `${aaaa}-${mm}-${dd}`;
            }

            // Buscar ou criar orador
            let orador = await db.oradores
              .where("nome")
              .equals(row.orador)
              .first();
            if (!orador) {
              // Sanitize phone number: remove all non-numeric characters
              const telefoneLimpo = (row.telefone || "").replace(/\D+/g, "");
              // Usar congregacao e cidade_uf se presentes, senão vazio
              const congregacao = row.congregacao || "";
              const cidade = row.cidade_uf || "";
              orador = {
                nome: row.orador,
                telefone: telefoneLimpo,
                congregacao,
                cidade,
                tipo: "visitante",
                ativo: true,
              };
              orador.id = await db.oradores.add(orador);
            }

            // Buscar tema apenas pelo número
            const tema = await db.temas
              .where("numero")
              .equals(Number(row.numero))
              .first();
            if (!tema) continue; // Se não encontrar o tema, ignora a linha

            // Criar vínculo OradorTema se não existir
            const oradorTemaExiste = await db.oradorTemas
              .where({ oradorId: orador.id!, temaId: tema.id! })
              .first();
            if (!oradorTemaExiste) {
              await db.oradorTemas.add({
                oradorId: orador.id!,
                temaId: tema.id!,
              });
            }

            // Inserir discurso usando dbWithBackup
            await dbSaveWithBackup(
              "discursos",
              {
                data: dataISO,
                oradorId: orador.id!,
                temaId: tema.id!,
                tipo: orador.tipo,
              },
              autoBackup,
              isSignedIn,
              uploadBackup,
              false // não mostrar toast individual
            );
          }
          resolve();
        } catch (err) {
          reject(err);
        }
      },
      error: (err) => reject(err),
    });
  });
}
