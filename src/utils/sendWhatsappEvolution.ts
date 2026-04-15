// src/utils/sendWhatsappEvolution.ts
//colocar token aqui separado
// ✅ DEPOIS
const token = import.meta.env.VITE_EVOLUTION_ADMIN_TOKEN || "";
console.log(
  "🔐 Token carregado:",
  token ? `${token.substring(0, 10)}...` : "❌ Não carregado",
);
export interface SendWhatsappEvolutionParams {
  numero: string; // número no formato internacional, ex: 559999999999
  texto: string; // mensagem a ser enviada
  nomeInstancia: string; // nome da instância no BD (ex: "pessoal")
}

export interface SendWhatsappEvolutionResult {
  success: boolean;
  error?: string;
  response?: any;
}

export async function sendWhatsappEvolution({
  numero,
  texto,
  nomeInstancia,
}: SendWhatsappEvolutionParams): Promise<SendWhatsappEvolutionResult> {
  try {
    const res = await fetch(
      `https://dev.teadigital.com.br/message/sendText/${nomeInstancia}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: token,
        },
        body: JSON.stringify({
          number: `55${numero}`,
          text: texto,
        }),
      },
    );
    const data = await res.json().catch(() => undefined);
    if (!res.ok) {
      return {
        success: false,
        error: data?.message || res.statusText,
        response: data,
      };
    }
    return { success: true, response: data };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}
