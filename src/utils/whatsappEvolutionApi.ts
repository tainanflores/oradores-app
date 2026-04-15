// src/utils/whatsappEvolutionApi.ts

import { db } from "../database";

// 1. Constantes
const EVOLUTION_API = "https://dev.teadigital.com.br";

// 2. Tipos
export interface StatusResponse {
  instance: {
    instanceName: string;
    state: "connected" | "connecting" | "closed";
  };
  qrcode?: {
    pairingCode: string;
    base64?: string;
  };
}

export interface ConnectResponse {
  pairingCode: string;
  code: string;
  base64: string;
  count: number;
}

// 2. Helper: conseguir o token
function getAdminToken(): string {
  const token = import.meta.env.VITE_EVOLUTION_ADMIN_TOKEN || "";
  if (!token) throw new Error("Token não configurado");
  return token;
}

// 3. Função 1: Criar Instância
async function createInstancia(numero: string) {
  try {
    const token = getAdminToken();
    const response = await fetch(`${EVOLUTION_API}/instance/create`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: token,
      },
      body: JSON.stringify({
        instanceName: numero,
        number: numero,
        qrcode: true,
        integration: "WHATSAPP-BAILEYS",
      }),
    });

    if (!response.ok) {
      throw new Error(`Erro ao criar instância: ${response.status}`);
    }

    const data = await response.json();

    // Salvar no IndexedDB (sempre com id: 1)
    await db.whatsappInstancias.put({
      id: 1,
      instanciaId: data.instance.instanceId,
      nome: numero,
      numero: numero,
      status: "aguardando_conexao",
      dataCriacao: new Date(),
    });

    return {
      instanceId: data.instance.instanceId,
      instanceName: data.instance.instanceName,
      pairingCode: data.qrcode.pairingCode,
      hash: data.hash,
    };
  } catch (erro) {
    console.error("Erro ao criar instância:", erro);
    throw erro;
  }
}

// 4. Função 2: Verificar Status
async function getInstanciaStatus(instanceName: string) {
  try {
    const token = getAdminToken();
    const response = await fetch(
      `${EVOLUTION_API}/instance/connectionState/${instanceName}`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          apikey: token,
        },
      },
    );

    if (!response.ok) {
      throw new Error(`Erro ao verificar status: ${response.status}`);
    }

    return response.json();
  } catch (erro) {
    console.error("Erro ao verificar status:", erro);
    throw erro;
  }
}

// 5. Função 3: Conectar Instância
async function connectInstancia(instanceName: string, numero: string) {
  try {
    const token = getAdminToken();
    const response = await fetch(
      `${EVOLUTION_API}/instance/connect/${instanceName}?number=${numero}`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          apikey: token,
        },
      },
    );

    if (!response.ok) {
      throw new Error(`Erro ao conectar instância: ${response.status}`);
    }

    return response.json();
  } catch (erro) {
    console.error("Erro ao conectar instância:", erro);
    throw erro;
  }
}

// 6. Funcao 4: Deletar Instância
async function deleteInstancia(instanceName: string) {
  try {
    const token = getAdminToken();
    const response = await fetch(
      `${EVOLUTION_API}/instance/delete/${instanceName}`,
      {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          apikey: token,
        },
      },
    );

    if (!response.ok) {
      throw new Error(`Erro ao deletar instância: ${response.status}`);
    }

    // Remover do IndexedDB (sempre id: 1)
    await db.whatsappInstancias.delete(1);

    return response.json();
  } catch (erro) {
    console.error("Erro ao deletar instância:", erro);
    throw erro;
  }
}

// 7. Função 5: Verificar Status com Tratamento de Erros
// Retorna: "open", "connecting", "closed"
async function verificarStatusComTimeout(
  instanceName: string,
  timeoutMs: number = 10000,
): Promise<"open" | "connecting" | "closed"> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    const token = getAdminToken();
    const response = await fetch(
      `${EVOLUTION_API}/instance/connectionState/${instanceName}`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          apikey: token,
        },
        signal: controller.signal,
      },
    );

    clearTimeout(timeout);

    if (response.status === 500) {
      // Status 500 significa conexão fechada
      return "closed";
    }

    if (!response.ok) {
      throw new Error(`Erro ao verificar status: ${response.status}`);
    }

    const data = await response.json();
    return data.instance?.state || "closed";
  } catch (erro) {
    if (erro instanceof Error && erro.name === "AbortError") {
      // Timeout significa que está connecting/carregando
      return "open";
    }
    console.error("Erro ao verificar status:", erro);
    // Se der qualquer erro, considerar como closed
    return "closed";
  }
}

// 8. Função 6: Verificar e Atualizar Status no BD (para usar quando há erro)
async function verificarEAtualizarStatusBD(): Promise<
  "desconectado" | "conectado" | "aguardando_conexao"
> {
  try {
    const instancia = await db.whatsappInstancias.get(1);
    if (!instancia) {
      return "desconectado";
    }

    const estadoReal = await verificarStatusComTimeout(instancia.numero, 10000);

    let novoStatus: "desconectado" | "conectado" | "aguardando_conexao" =
      "desconectado";
    if (estadoReal === "open") {
      novoStatus = "conectado";
    } else if (estadoReal === "connecting") {
      novoStatus = "aguardando_conexao";
    }

    // Atualizar BD
    await db.whatsappInstancias
      .where("numero")
      .equals(instancia.numero)
      .modify({
        status: novoStatus,
      });

    return novoStatus;
  } catch (erro) {
    console.error("Erro ao verificar status:", erro);
    return "desconectado";
  }
}

// . Exports
export {
  createInstancia,
  getInstanciaStatus,
  connectInstancia,
  deleteInstancia,
  verificarStatusComTimeout,
  verificarEAtualizarStatusBD,
};
