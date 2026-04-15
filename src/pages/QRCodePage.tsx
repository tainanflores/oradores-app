import { useState, useEffect } from "react";
import {
  connectInstancia,
  getInstanciaStatus,
} from "../utils/whatsappEvolutionApi";
import { db } from "../database";

export default function QRCodePage() {
  const [qrCodeBase64, setQrCodeBase64] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [status, setStatus] = useState<
    "connecting" | "connected" | "closed" | "unknown"
  >("unknown");

  // Pega o instanceName e numero da URL
  const instanceName = new URLSearchParams(window.location.search).get(
    "instance",
  );
  const numero = new URLSearchParams(window.location.search).get("numero");

  useEffect(() => {
    if (!instanceName) {
      setError("Instância não fornecida. Volta na página anterior.");
      return;
    }

    let isMounted = true;

    // Função para preparar e atualizar o QR code (Chamar connectInstancia uma vez)
    const setupQRCode = async () => {
      try {
        // Se não tem numero na URL, buscar do BD
        let numeroParaConectar = numero;

        if (!numeroParaConectar) {
          const instancia = await db.whatsappInstancias.get(1);
          if (instancia) {
            numeroParaConectar = instancia.numero;
          }
        }

        console.log("🔵 QRCodePage - Iniciando setup", {
          instanceName,
          numeroParaConectar,
        });

        // Chamar connectInstancia UMA VEZ para preparar a conexão e gerar QR
        if (numeroParaConectar) {
          console.log("🔵 Chamando connectInstancia...");
          const connectData = await connectInstancia(
            instanceName,
            numeroParaConectar,
          );
          console.log("✅ connectInstancia sucesso:", connectData);

          if (isMounted && connectData.base64) {
            console.log("✅ QR Code recebido, exibindo...");
            setQrCodeBase64(connectData.base64);
            setIsLoading(false);
          } else {
            console.warn(
              "⚠️ QR Code não encontrado em connectData",
              connectData,
            );
          }
        }
      } catch (err) {
        console.error("❌ Erro ao fazer setup:", err);
        if (isMounted) {
          setError(
            `Erro: ${err instanceof Error ? err.message : "Erro ao conectar"}`,
          );
          setIsLoading(false);
        }
      }
    };

    // Setup inicial
    setupQRCode();

    // === POLLING 1: Verificar Status a cada 5 segundos ===
    const statusInterval = setInterval(async () => {
      try {
        console.log("🔵 [5s] Verificando status...");
        const statusData = await getInstanciaStatus(instanceName);
        console.log("✅ Status recebido:", statusData.instance?.state);

        if (!isMounted) return;

        // Verificar se conectou
        if (statusData.instance?.state === "open") {
          console.log("✅ CONECTADO!");
          setStatus("connected");
        } else if (statusData.instance?.state === "closed") {
          console.log("❌ Conexão encerrada");
          setStatus("closed");
        } else if (statusData.instance?.state === "connecting") {
          setStatus("connecting");
        }
      } catch (err) {
        console.error("❌ Erro no polling de status:", err);
      }
    }, 5000);

    // === POLLING 2: Buscar QR Code a cada 10 segundos ===
    const qrInterval = setInterval(async () => {
      try {
        console.log("🔵 [10s] Buscando QR code atualizado...");

        let numeroParaConectar = numero;
        if (!numeroParaConectar) {
          const instancia = await db.whatsappInstancias.get(1);
          if (instancia) {
            numeroParaConectar = instancia.numero;
          }
        }

        if (numeroParaConectar) {
          const connectData = await connectInstancia(
            instanceName,
            numeroParaConectar,
          );
          console.log("✅ QR Code atualizado");

          if (isMounted && connectData.base64) {
            setQrCodeBase64(connectData.base64);
            setIsLoading(false);
          }
        }
      } catch (err) {
        console.error("❌ Erro ao buscar QR code:", err);
      }
    }, 10000);

    return () => {
      isMounted = false;
      clearInterval(statusInterval);
      clearInterval(qrInterval);
    };
  }, [instanceName, numero]);

  if (status === "connected") {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-green-50 to-green-100">
        <div className="text-center py-8 bg-white rounded-2xl shadow-xl p-8">
          <div className="text-6xl mb-4">✓</div>
          <p className="text-green-700 font-bold text-2xl">
            WhatsApp Conectado com Sucesso!
          </p>
          <p className="text-green-600 text-sm mt-4">
            Volta ao aplicativo para continuar
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-white p-4">
      <div className="flex flex-col items-center max-w-md">
        {/* QR Code */}
        <div className="mb-8 p-6 bg-gray-50 rounded-lg border border-gray-200">
          {isLoading ? (
            <div className="w-64 h-64 flex items-center justify-center">
              <div className="text-center">
                <div className="inline-block animate-spin mb-3">
                  <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full"></div>
                </div>
                <p className="text-gray-600 text-sm">Gerando QR code...</p>
              </div>
            </div>
          ) : error ? (
            <div className="w-64 h-64 flex items-center justify-center">
              <p className="text-red-600 text-center">{error}</p>
            </div>
          ) : qrCodeBase64 ? (
            <img src={qrCodeBase64} alt="QR Code" className="w-64 h-64" />
          ) : (
            <div className="w-64 h-64 flex items-center justify-center">
              <p className="text-gray-500">QR code não disponível</p>
            </div>
          )}
        </div>

        {/* Instruções */}
        {!error && (
          <div className="text-center mb-6">
            <h2 className="text-lg font-bold mb-2">Escaneie para conectar</h2>
            <p className="text-gray-700 text-sm mb-4">
              Abra WhatsApp em outro dispositivo, vá em Configurações →
              Aparelhos vinculados e escaneie este QR code.
            </p>
            <p className="text-gray-600 text-sm font-medium">
              Não feche o WhatsApp enquanto escaneia.
            </p>
          </div>
        )}

        {/* Status */}
        {status === "connecting" && (
          <div className="flex items-center justify-center gap-2 mb-4">
            <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
            <p className="text-blue-600 text-sm">Aguardando...</p>
          </div>
        )}

        {/* Botão voltar */}
        <button
          onClick={() => window.history.back()}
          className="text-blue-600 hover:text-blue-700 text-sm font-medium"
        >
          Voltar
        </button>
      </div>
    </div>
  );
}
