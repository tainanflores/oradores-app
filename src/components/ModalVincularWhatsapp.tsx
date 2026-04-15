import { useState, useEffect } from "react";
import {
  createInstancia,
  connectInstancia,
  getInstanciaStatus,
  deleteInstancia,
} from "../utils/whatsappEvolutionApi";
import { db } from "../database";
import { dbSaveWithBackup, dbDeleteWithBackup } from "../utils/dbWithBackup";
import { useConfig } from "../contexts/ConfigContext";
import { useGoogleDriveAuth } from "../contexts/GoogleDriveAuthContext";

interface Props {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export default function ModalVincularWhatsapp({
  open,
  onClose,
  onSuccess,
}: Props) {
  // Hooks
  const { congregacao } = useConfig();
  const { isSignedIn, uploadBackup } = useGoogleDriveAuth();

  const [numero, setNumero] = useState("");
  const [numeroConfirmado, setNumeroConfirmado] = useState("");
  const [instanceName, setInstanceName] = useState("");
  const [status, setStatus] = useState<
    | "inicial"
    | "confirmando"
    | "criando"
    | "conectando"
    | "pollingCodigo"
    | "conectado"
    | "erro"
    | "instanciaExistente"
  >("inicial");
  const [error, setError] = useState("");
  const [linkCopiado, setLinkCopiado] = useState(false);
  const [carregando, setCarregando] = useState(true);

  // Validar formato do número
  const validarNumero = (num: string): boolean => {
    // Remove espaços e caracteres especiais
    const cleaned = num.replace(/\D/g, "");
    // Deve ter: 55 (código Brasil) + 2 dígitos (DDD) + 8 ou 9 dígitos (número)
    // Total: 13 dígitos (com 8 dígitos) ou 14 dígitos (com 9 dígitos)
    return /^55\d{2}9?\d{8}$/.test(cleaned);
  };

  const formatarNumero = (num: string): string => {
    const cleaned = num.replace(/\D/g, "");
    if (cleaned.length > 14) return cleaned.slice(0, 14);
    return cleaned;
  };

  // Ao abrir o modal, verificar se já existe instância no BD
  useEffect(() => {
    if (!open) return;

    const carregarInstancia = async () => {
      try {
        const instancia = await db.whatsappInstancias.get(1);

        if (instancia) {
          // Instância já existe
          setInstanceName(instancia.numero);
          setNumeroConfirmado(instancia.numero);
          setNumero(instancia.numero);
          setStatus("instanciaExistente");
        } else {
          // Nenhuma instância, começar do zero
          setNumero("");
          setNumeroConfirmado("");
          setInstanceName("");
          setStatus("inicial");
        }

        setCarregando(false);
      } catch (err) {
        console.error("Erro ao carregar instância:", err);
        setCarregando(false);
        setStatus("inicial");
      }
    };

    carregarInstancia();
  }, [open]);

  // Conectar (para instâncias já existentes ou novas)
  const handleConectarInstancia = async () => {
    try {
      setError("");

      // Se é instância nova, criar antes
      if (!instanceName) {
        setStatus("criando");
        const resultado = await createInstancia(numeroConfirmado);
        setInstanceName(resultado.instanceName);

        // Salvar instância no BD com backup automático
        await dbSaveWithBackup(
          "whatsappInstancias",
          resultado.whatsappInstancia,
          Boolean(congregacao?.autoBackup),
          isSignedIn,
          uploadBackup,
          false, // Não mostrar toast pois vamos mostrar nosso próprio
        );
      }

      // Preparar conexão
      setStatus("conectando");
      await connectInstancia(
        instanceName || numeroConfirmado,
        numeroConfirmado,
      );

      // Começar polling
      setStatus("pollingCodigo");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Erro ao conectar WhatsApp",
      );
      setStatus("erro");
    }
  };

  // Trocar número (deleta instância anterior)
  const handleTrocarNumero = async () => {
    if (!window.confirm("Descartar este número e voltar?")) return;

    try {
      // Deletar instância do BD com backup automático
      await dbDeleteWithBackup(
        "whatsappInstancias",
        1,
        Boolean(congregacao?.autoBackup),
        isSignedIn,
        uploadBackup,
      );

      // Deletar instância anterior da API
      if (instanceName) {
        await deleteInstancia(instanceName);
      }
    } catch (err) {
      console.error("Erro ao deletar instância:", err);
    }

    setNumero("");
    setNumeroConfirmado("");
    setInstanceName("");
    setStatus("inicial");
    setError("");
  };

  // Confirmar número antes de conectar (para novas instâncias)
  const handleConfirmarNumero = () => {
    const numFormatado = formatarNumero(numero);

    if (!validarNumero(numFormatado)) {
      setError("Número inválido. Digite no formato: 55 + DDD + 8 ou 9 dígitos");
      return;
    }

    setNumero(numFormatado);
    setNumeroConfirmado(numFormatado);
    setStatus("confirmando");
    setError("");
  };

  // DELETADO: handleConectar antigo
  // As funções agora usam handleConectarInstancia que funciona para ambos os casos

  // DELETADO: handleTrocarNumero antigo (substituído acima)

  // Polling: somente verificar status (sem mostrar QR no modal)
  useEffect(() => {
    if (status !== "pollingCodigo" || !instanceName) return;

    const statusInterval = setInterval(async () => {
      try {
        const statusData = await getInstanciaStatus(instanceName);

        if (statusData.instance?.state === "open") {
          setStatus("conectado");
          clearInterval(statusInterval);

          // Salvar status atualizado no BD com backup automático
          await dbSaveWithBackup(
            "whatsappInstancias",
            {
              id: 1,
              instanciaId: "",
              nome: numeroConfirmado,
              numero: numeroConfirmado,
              status: "conectado",
              dataCriacao: new Date(),
            },
            Boolean(congregacao?.autoBackup),
            isSignedIn,
            uploadBackup,
            false,
          );

          setTimeout(() => {
            onSuccess?.();
            handleFechar(true); // skipConfirmation = true (fechamento automático por sucesso)
          }, 2000);
        } else if (statusData.instance?.state === "closed") {
          setError("Conexão encerrada");
          setStatus("erro");
          clearInterval(statusInterval);
        }
      } catch (err) {
        console.error("Erro no polling de status:", err);
      }
    }, 5000);

    return () => clearInterval(statusInterval);
  }, [status, instanceName, numeroConfirmado, onSuccess]);

  const handleFechar = async (skipConfirmation = false) => {
    // Se for fechamento automático por sucesso (skipConfirmation = true), NUNCA deletar
    // Só deletar se o usuário cancelar manualmente antes de conectar com sucesso
    if (
      !skipConfirmation &&
      instanceName &&
      status !== "inicial" &&
      status !== "conectado" &&
      status !== "instanciaExistente"
    ) {
      if (!window.confirm("Cancelar e deletar a instância criada?")) {
        return; // Cancela o fechamento
      }

      // Deletar instância que foi criada nesta sessão
      try {
        await deleteInstancia(instanceName);
        // Também deletar do BD com backup automático
        await dbDeleteWithBackup(
          "whatsappInstancias",
          1,
          Boolean(congregacao?.autoBackup),
          isSignedIn,
          uploadBackup,
        );
      } catch (err) {
        console.error("Erro ao deletar instância ao fechar:", err);
      }
    }

    setNumero("");
    setNumeroConfirmado("");
    setInstanceName("");
    setStatus("inicial");
    setCarregando(true);
    setError("");
    onClose();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-96 shadow-lg">
        {/* Header */}
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">Vincular WhatsApp</h2>
          <button
            onClick={() => handleFechar()}
            className="text-gray-500 hover:text-gray-700 text-2xl"
          >
            ×
          </button>
        </div>

        {/* Body */}
        <div className="space-y-4">
          {/* Loading inicial */}
          {carregando && (
            <div className="text-center py-8">
              <div className="inline-block animate-spin mb-2">
                <div className="w-6 h-6 border-3 border-blue-500 border-t-transparent rounded-full"></div>
              </div>
              <p className="text-gray-600 text-sm">Verificando instância...</p>
            </div>
          )}

          {/* Estado: Instância Existente - Desconectada */}
          {status === "instanciaExistente" && (
            <>
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <p className="text-yellow-800 font-medium mb-2">
                  Instância encontrada:
                </p>
                <p className="text-2xl font-bold text-yellow-900">
                  {numeroConfirmado}
                </p>
                <p className="text-yellow-700 text-xs mt-2">
                  Status: <span className="font-medium">Desconectado</span>
                </p>
              </div>
              <p className="text-gray-600 text-sm text-center">
                Clique em "Conectar" para gerar um novo código QR
              </p>
              {error && <p className="text-red-500 text-sm">{error}</p>}
              <button
                onClick={handleConectarInstancia}
                className="w-full bg-blue-500 hover:bg-blue-600 text-white py-2 rounded-lg font-medium"
              >
                Conectar
              </button>
              <button
                onClick={handleTrocarNumero}
                className="w-full bg-gray-200 hover:bg-gray-300 text-gray-700 py-2 rounded-lg font-medium text-sm"
              >
                Trocar Número
              </button>
            </>
          )}

          {/* Estado: Inicial - Digitar número */}
          {status === "inicial" && (
            <>
              <p className="text-gray-600 text-sm">
                Digite o número do celular com WhatsApp ativo
              </p>
              <p className="text-gray-500 text-xs">
                Formato: 55 + DDD + 8 ou 9 dígitos
              </p>
              <input
                type="tel"
                placeholder="5511999999999"
                value={numero}
                onChange={(e) => setNumero(e.target.value)}
                maxLength={14}
                className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {error && <p className="text-red-500 text-sm">{error}</p>}
              <button
                onClick={handleConfirmarNumero}
                disabled={!numero.trim()}
                className="w-full bg-blue-500 hover:bg-blue-600 disabled:bg-gray-300 text-white py-2 rounded-lg font-medium"
              >
                Confirmar Número
              </button>
            </>
          )}

          {/* Estado: Confirmando - Aguardando confirmação */}
          {status === "confirmando" && (
            <>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-blue-800 font-medium mb-2">
                  Número confirmado:
                </p>
                <p className="text-2xl font-bold text-blue-900">
                  {numeroConfirmado}
                </p>
              </div>
              <p className="text-gray-600 text-sm text-center">
                Clique em "Conectar" para gerar o código QR
              </p>
              {error && <p className="text-red-500 text-sm">{error}</p>}
              <button
                onClick={handleConectarInstancia}
                className="w-full bg-blue-500 hover:bg-blue-600 text-white py-2 rounded-lg font-medium"
              >
                Conectar
              </button>
              <button
                onClick={handleTrocarNumero}
                className="w-full bg-gray-200 hover:bg-gray-300 text-gray-700 py-2 rounded-lg font-medium text-sm"
              >
                Trocar Número
              </button>
            </>
          )}

          {/* Estado: Criando */}
          {status === "criando" && (
            <>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-blue-800 font-medium text-sm">
                  Número: {numeroConfirmado}
                </p>
              </div>
              <div className="text-center py-4">
                <div className="inline-block animate-spin mb-2">
                  <div className="w-6 h-6 border-3 border-blue-500 border-t-transparent rounded-full"></div>
                </div>
                <p className="text-gray-600">Criando instância...</p>
              </div>
            </>
          )}

          {/* Estado: Conectando */}
          {status === "conectando" && (
            <>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-blue-800 font-medium text-sm">
                  Número: {numeroConfirmado}
                </p>
              </div>
              <div className="text-center py-4">
                <div className="inline-block animate-spin mb-2">
                  <div className="w-6 h-6 border-3 border-blue-500 border-t-transparent rounded-full"></div>
                </div>
                <p className="text-gray-600">Preparando conexão...</p>
              </div>
            </>
          )}

          {/* Estado: Polling / Aguardando Escanear */}
          {status === "pollingCodigo" && (
            <>
              <p className="text-gray-600 text-sm mb-4">
                ✓ Instância criada com sucesso.
              </p>
              <p className="text-gray-700 font-medium mb-2">
                {numeroConfirmado}
              </p>

              {/* Link para abrir QR code */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                <p className="text-blue-800 font-medium text-sm mb-3">
                  Próximo passo:
                </p>
                <button
                  onClick={() => {
                    const qrLink = `${window.location.origin}/qrcode?instance=${instanceName}&numero=${numeroConfirmado}`;
                    navigator.clipboard.writeText(qrLink);
                    setLinkCopiado(true);
                    setTimeout(() => setLinkCopiado(false), 2000);
                  }}
                  className="w-full bg-blue-500 hover:bg-blue-600 text-white py-2 rounded font-medium text-sm transition mb-2"
                >
                  {linkCopiado ? "✓ Link Copiado!" : "Copiar Link do QR Code"}
                </button>
                <p className="text-blue-700 text-xs">
                  Cole este link em outro navegador ou dispositivo, abra e
                  escaneie com WhatsApp.
                </p>
              </div>

              <p className="text-gray-500 text-xs text-center mb-2">
                ⏳ Aguardando confirmação...
              </p>

              <button
                onClick={() => handleFechar()}
                className="w-full bg-gray-200 hover:bg-gray-300 text-gray-700 py-2 rounded-lg font-medium text-sm"
              >
                Cancelar
              </button>
            </>
          )}

          {/* Estado: Conectado */}
          {status === "conectado" && (
            <div className="text-center py-4 bg-green-50 rounded-lg">
              <div className="inline-block mb-2 text-2xl">✓</div>
              <p className="text-green-700 font-medium">
                WhatsApp conectado com sucesso!
              </p>
              <p className="text-green-600 text-sm mt-1">Número: {numero}</p>
            </div>
          )}

          {/* Estado: Erro */}
          {status === "erro" && (
            <>
              <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                <p className="text-red-700 text-sm font-medium">Erro</p>
                <p className="text-red-600 text-sm mt-1">{error}</p>
              </div>
              <button
                onClick={() => {
                  setStatus("confirmando");
                  setError("");
                }}
                className="w-full bg-blue-500 hover:bg-blue-600 text-white py-2 rounded-lg font-medium"
              >
                Tentar Novamente
              </button>
              <button
                onClick={handleTrocarNumero}
                className="w-full bg-gray-200 hover:bg-gray-300 text-gray-700 py-2 rounded-lg font-medium text-sm"
              >
                Trocar Número
              </button>
            </>
          )}
        </div>

        {/* Footer */}
        {status !== "conectado" && (
          <button
            onClick={() => handleFechar()}
            className="w-full mt-4 text-gray-600 hover:text-gray-800 py-2"
          >
            Fechar
          </button>
        )}
      </div>
    </div>
  );
}
