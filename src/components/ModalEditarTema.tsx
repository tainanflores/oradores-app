import { useState, useEffect } from "react";
import { type Tema } from "../database";
import { dbSaveWithBackup } from "../utils/dbWithBackup";
import { useConfig } from "../contexts/ConfigContext";
import { useGoogleDriveAuth } from "../contexts/GoogleDriveAuthContext";
import { Edit, Plus, Hash, FileText, X, Save, Loader2 } from "lucide-react";

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
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 rounded-lg">
              {tema ? (
                <Edit className="w-5 h-5 text-purple-600" />
              ) : (
                <Plus className="w-5 h-5 text-purple-600" />
              )}
            </div>
            <h2 className="text-xl font-bold text-gray-800">
              {tema ? "Editar Esboço" : "Criar Esboço"}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            disabled={loading}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <div className="p-6 space-y-5">
          {/* Número do Tema */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Número do Esboço
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Hash className="w-4 h-4 text-gray-400" />
              </div>
              <input
                type="number"
                value={numero}
                onChange={(e) => setNumero(e.target.value)}
                placeholder="Ex: 1"
                className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all duration-200 bg-white"
                min="1"
                disabled={loading}
              />
            </div>
          </div>

          {/* Título do Tema */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Título do Esboço
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <FileText className="w-4 h-4 text-gray-400" />
              </div>
              <input
                type="text"
                value={titulo}
                onChange={(e) => setTitulo(e.target.value)}
                placeholder="Ex: A Bíblia, Palavra de Deus"
                className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all duration-200 bg-white"
                disabled={loading}
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-3 p-6 border-t border-gray-200 bg-gray-50 rounded-b-xl">
          <button
            onClick={onClose}
            className="flex-1 flex items-center justify-center gap-2 bg-gray-500 text-white py-3 px-4 rounded-lg hover:bg-gray-600 transition-all duration-200 font-medium disabled:opacity-50"
            disabled={loading}
          >
            <X className="w-4 h-4" />
            Cancelar
          </button>
          <button
            onClick={handleSave}
            className="flex-1 flex items-center justify-center gap-2 bg-gradient-to-r from-purple-500 to-purple-600 text-white py-3 px-4 rounded-lg hover:from-purple-600 hover:to-purple-700 transition-all duration-200 font-medium shadow-md hover:shadow-lg disabled:opacity-50"
            disabled={loading}
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Salvando...
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                {tema ? "Atualizar" : "Criar"}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

export default ModalEditarTema;
