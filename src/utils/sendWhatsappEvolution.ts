// src/utils/sendWhatsappEvolution.ts
//colocar token aqui separado
const token = "429683C4C977415CAAFCCE10F7D57E11";

export interface SendWhatsappEvolutionParams {
  numero: string; // número no formato internacional, ex: 559999999999
  texto: string; // mensagem a ser enviada
}

export interface SendWhatsappEvolutionResult {
  success: boolean;
  error?: string;
  response?: any;
}

export async function sendWhatsappEvolution({
  numero,
  texto,
}: SendWhatsappEvolutionParams): Promise<SendWhatsappEvolutionResult> {
  try {
    const res = await fetch(
      "https://dev.teadigital.com.br/message/sendText/pessoal",
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
      }
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
