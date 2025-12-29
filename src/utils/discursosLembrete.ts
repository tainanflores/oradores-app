// src/utils/discursosLembrete.ts
import { db, type Discurso } from "../database";

/**
 * Busca discursos com lembrete pendente (lembrete === false)
 * e data entre hoje e 6 dias à frente (inclusive).
 */
export async function getDiscursosPendentesLembrete(): Promise<Discurso[]> {
  const hoje = new Date();
  const dataHoje = hoje.toISOString().split("T")[0];
  const dataLimite = new Date(hoje);
  dataLimite.setDate(hoje.getDate() + 6);
  const dataLimiteStr = dataLimite.toISOString().split("T")[0];

  // Busca todos os discursos no intervalo e lembrete === false
  return db.discursos
    .where("data")
    .between(dataHoje, dataLimiteStr, true, true)
    .filter((d) => d.lembrete === false)
    .toArray();
}

/**
 * Marca o lembrete como enviado (lembrete: true) para um discurso pelo id
 */
export async function marcarLembreteEnviado(id: number) {
  await db.discursos.update(id, { lembrete: true });
}
