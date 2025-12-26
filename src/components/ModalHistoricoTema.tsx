import { useState, useEffect } from "react";
import { db, type Tema } from "../database";
import { dbSaveWithBackup } from "../utils/dbWithBackup";
import { useConfig } from "../contexts/ConfigContext";
import { useGoogleDriveAuth } from "../contexts/GoogleDriveAuthContext";
import { formatDateBR } from "../utils/dateUtils";
import {
  History,
  Edit,
  Save,
  X,
  User,
  Calendar,
  BookOpen,
  Loader2,
} from "lucide-react";

interface ModalHistoricoTemaProps {
  isOpen: boolean;
  onClose: () => void;
  tema: Tema | null;
  onSave: () => void;
}

function ModalHistoricoTema({
  isOpen,
  onClose,
  tema,
  onSave,
}: ModalHistoricoTemaProps) {
  const [historico, setHistorico] = useState<
    Array<{ data: string; oradorNome: string }>
  >([]);
  const [loading, setLoading] = useState(false);
  const [editando, setEditando] = useState(false);
  const [tituloEditado, setTituloEditado] = useState("");
  const [temaSelecionadoLocal, setTemaSelecionadoLocal] = useState<Tema | null>(
    null
  );
  const { congregacao } = useConfig();
  const { isSignedIn, uploadBackup } = useGoogleDriveAuth();

  useEffect(() => {
    if (isOpen && tema) {
      setTemaSelecionadoLocal(tema);
      setTituloEditado(tema.titulo);
      setEditando(false);
    }
  }, [isOpen, tema]);

  useEffect(() => {
    if (temaSelecionadoLocal) {
      carregarHistorico();
    }
  }, [temaSelecionadoLocal]);

  const carregarHistorico = async () => {
    if (!temaSelecionadoLocal) return;

    setLoading(true);
    try {
      // Buscar discursos do esboço
      const discursos = await db.discursos
        .where("temaId")
        .equals(temaSelecionadoLocal.id!)
        .sortBy("data");

      // Buscar nomes dos oradores
      const historicoData = await Promise.all(
        discursos.map(async (discurso) => {
          const orador = await db.oradores.get(discurso.oradorId);
          return {
            data: discurso.data,
            oradorNome: orador?.nome || "Orador não encontrado",
          };
        })
      );

      // Ordenar por data decrescente (mais recente primeiro)
      historicoData.sort(
        (a, b) => new Date(b.data).getTime() - new Date(a.data).getTime()
      );

      setHistorico(historicoData);
    } catch (error) {
      console.error("Erro ao carregar histórico:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleEditar = () => {
    setEditando(true);
  };

  const handleSalvar = async () => {
    if (!temaSelecionadoLocal || !tituloEditado.trim()) return;

    try {
      await dbSaveWithBackup(
        "temas",
        { ...temaSelecionadoLocal, titulo: tituloEditado.trim() },
        Boolean(congregacao?.autoBackup),
        isSignedIn,
        uploadBackup
      );
      // Atualizar o tema local com o novo título
      setTemaSelecionadoLocal({
        ...temaSelecionadoLocal,
        titulo: tituloEditado.trim(),
      });
      setEditando(false);
      onSave(); // Recarregar dados
    } catch (error) {
      console.error("Erro ao salvar esboço:", error);
      alert("Erro ao salvar esboço. Tente novamente.");
    }
  };

  const handleCancelar = () => {
    setEditando(false);
    setTituloEditado(temaSelecionadoLocal?.titulo || "");
  };

  if (!isOpen || !temaSelecionadoLocal) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-gray-200 bg-gradient-to-r from-purple-50 to-blue-50">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 rounded-lg">
                <BookOpen className="w-5 h-5 text-purple-600" />
              </div>
            </div>

            {/* Botões de ação */}
            <div className="flex gap-2">
              {editando ? (
                <>
                  <button
                    onClick={handleSalvar}
                    className="flex items-center gap-2 bg-green-600 text-white px-3 py-2 rounded-lg hover:bg-green-700 transition-all duration-200 font-medium"
                    disabled={loading}
                  >
                    <Save className="w-4 h-4" />
                    Salvar
                  </button>
                  <button
                    onClick={handleCancelar}
                    className="flex items-center gap-2 bg-gray-500 text-white px-3 py-2 rounded-lg hover:bg-gray-600 transition-all duration-200 font-medium"
                    disabled={loading}
                  >
                    <X className="w-4 h-4" />
                    Cancelar
                  </button>
                </>
              ) : (
                <button
                  onClick={handleEditar}
                  className="flex items-center gap-2 bg-purple-600 text-white px-3 py-2 rounded-lg hover:bg-purple-700 transition-all duration-200 font-medium"
                >
                  <Edit className="w-4 h-4" />
                  Editar
                </button>
              )}
            </div>
          </div>

          {/* Título editável */}
          <div className="bg-white rounded-lg p-4 border border-gray-200">
            {editando ? (
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <BookOpen className="w-4 h-4 text-gray-400" />
                </div>
                <input
                  type="text"
                  value={tituloEditado}
                  onChange={(e) => setTituloEditado(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all duration-200 bg-white"
                  placeholder="Digite o título do esboço"
                  autoFocus
                  disabled={loading}
                />
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <BookOpen className="w-5 h-5 text-purple-600" />
                <p className="text-gray-800 font-medium">
                  {temaSelecionadoLocal.titulo}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Histórico */}
        <div className="flex-1 overflow-y-auto p-4">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-blue-100 rounded-lg">
              <History className="w-5 h-5 text-blue-600" />
            </div>
            <h3 className="text-xl font-bold text-gray-800">Histórico</h3>
          </div>

          {loading ? (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="relative">
                <Loader2 className="w-12 h-12 text-purple-600 animate-spin" />
              </div>
              <p className="mt-4 text-gray-600 font-medium">
                Carregando histórico...
              </p>
            </div>
          ) : historico.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-4 px-4">
              <div className="p-4 bg-gray-100 rounded-full mb-4">
                <History className="w-6 h-6 text-gray-400" />
              </div>
              <h4 className="text-lg font-semibold text-gray-700 mb-2">
                Nenhuma apresentação registrada
              </h4>
            </div>
          ) : (
            <div className="space-y-3">
              {historico.map((item, index) => (
                <div
                  key={index}
                  className="group flex items-center justify-between p-2 bg-gradient-to-r from-white to-gray-50 rounded-xl border border-gray-200 hover:border-purple-300 hover:shadow-md transition-all duration-200"
                >
                  <div className="flex items-center gap-4">
                    <div className="p-2 bg-purple-100 rounded-lg">
                      <User className="w-4 h-4 text-purple-600" />
                    </div>
                    <div>
                      <p className="font-semibold text-gray-800 group-hover:text-purple-800 transition-colors">
                        {item.oradorNome}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 text-gray-600">
                    <Calendar className="w-4 h-4" />
                    <span className="font-medium">
                      {formatDateBR(item.data)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-200 bg-gray-50 rounded-b-xl">
          <button
            onClick={onClose}
            className="w-full flex items-center justify-center gap-2 bg-gray-600 text-white py-3 px-4 rounded-lg hover:bg-gray-700 transition-all duration-200 font-medium shadow-md hover:shadow-lg"
          >
            <X className="w-4 h-4" />
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}

export default ModalHistoricoTema;
