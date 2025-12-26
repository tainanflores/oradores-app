import { useState, useEffect } from "react";
import { db, type Tema } from "../database";
import { dbSaveWithBackup } from "../utils/dbWithBackup";
import { useConfig } from "../contexts/ConfigContext";
import { useGoogleDriveAuth } from "../contexts/GoogleDriveAuthContext";

interface ModalEditarTemaProps {
  isOpen: boolean;
  onClose: () => void;
  tema?: Tema | null;
  onSave: () => void;
}

function ModalEditarTema({
  isOpen,
  onClose,
  tema,
  onSave,
}: ModalEditarTemaProps) {
  const [numero, setNumero] = useState("");
  const [titulo, setTitulo] = useState("");
  const [loading, setLoading] = useState(false);
  const { congregacao } = useConfig();
  const { isSignedIn, uploadBackup } = useGoogleDriveAuth();

  // Preencher campos quando o modal abre com um tema existente
  useEffect(() => {
    if (isOpen) {
      if (tema) {
        setNumero(tema.numero.toString());
        setTitulo(tema.titulo);
      } else {
        setNumero("");
        setTitulo("");
      }
    }
  }, [isOpen, tema]);

  const handleSave = async () => {
    if (!numero || !titulo) {
      alert("Por favor, preencha todos os campos.");
      return;
    }

    const numeroInt = parseInt(numero);
    if (isNaN(numeroInt) || numeroInt <= 0) {
      alert("O número do tema deve ser um número positivo.");
      return;
    }

    setLoading(true);
    try {
      if (tema) {
        // Editar esboço existente
        await dbSaveWithBackup(
          "temas",
          { ...tema, numero: numeroInt, titulo: titulo.trim() },
          Boolean(congregacao?.autoBackup),
          isSignedIn,
          uploadBackup
        );
      } else {
        // Criar novo esboço
        await dbSaveWithBackup(
          "temas",
          { numero: numeroInt, titulo: titulo.trim(), ativo: true },
          Boolean(congregacao?.autoBackup),
          isSignedIn,
          uploadBackup
        );
      }

      onSave(); // Recarregar dados
      onClose();
    } catch (error) {
      console.error("Erro ao salvar esboço:", error);
      alert("Erro ao salvar esboço. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
        <h2 className="text-xl font-bold mb-4 text-gray-800">
          {tema ? "✏️ Editar Esboço" : "➕ Criar Esboço"}
        </h2>

        <div className="space-y-4">
          {/* Número do Tema */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Número
            </label>
            <input
              type="number"
              value={numero}
              onChange={(e) => setNumero(e.target.value)}
              placeholder="Ex: 1"
              className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              min="1"
            />
          </div>

          {/* Título do Tema */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Título
            </label>
            <input
              type="text"
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              placeholder="Ex: A Bíblia, Palavra de Deus"
              className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            />
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <button
            onClick={onClose}
            className="flex-1 bg-gray-500 text-white py-2 px-4 rounded-md hover:bg-gray-600 transition-colors"
            disabled={loading}
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            className="flex-1 bg-purple-600 text-white py-2 px-4 rounded-md hover:bg-purple-700 transition-colors disabled:opacity-50"
            disabled={loading}
          >
            {loading ? "Salvando..." : tema ? "Atualizar" : "Criar"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default ModalEditarTema;
