import { useState, useEffect } from "react";
import { db, type Tema } from "../database";
import { dbSaveWithBackup } from "../utils/dbWithBackup";
import { useConfig } from "../contexts/ConfigContext";
import { useGoogleDriveAuth } from "../contexts/GoogleDriveAuthContext";

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
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg w-full max-w-2xl mx-4 max-h-[90vh] overflow-hidden flex flex-col">
        {/* Cabeçalho */}
        <div className="p-2 border-b border-gray-200">
          <div className="flex gap-2 mb-1">
            {editando ? (
              <>
                <button
                  onClick={handleSalvar}
                  className="bg-green-600 text-white px-3 py-1 rounded-md hover:bg-green-700 transition-colors text-sm"
                >
                  💾 Salvar
                </button>
                <button
                  onClick={handleCancelar}
                  className="bg-gray-500 text-white px-3 py-1 rounded-md hover:bg-gray-600 transition-colors text-sm"
                >
                  ❌ Cancelar
                </button>
              </>
            ) : (
              <button
                onClick={handleEditar}
                className="bg-purple-600 text-white px-3 py-1 rounded-md hover:bg-purple-700 transition-colors text-sm"
              >
                ✏️ Editar
              </button>
            )}
          </div>
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <h2 className="text-lg font-bold text-gray-800">
                Esboço {temaSelecionadoLocal.numero}
              </h2>
              {editando ? (
                <input
                  type="text"
                  value={tituloEditado}
                  onChange={(e) => setTituloEditado(e.target.value)}
                  className="mt-2 w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  autoFocus
                />
              ) : (
                <p className="text-gray-600 mt-1">
                  {temaSelecionadoLocal.titulo}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Histórico */}
        <div className="flex-1 overflow-y-auto p-6">
          <h3 className="text-lg font-semibold mb-4 text-gray-800">
            📅 Histórico ({historico.length})
          </h3>

          {loading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto"></div>
              <p className="mt-2 text-gray-600">Carregando histórico...</p>
            </div>
          ) : historico.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-600">
                Este esboço ainda não foi apresentado.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {historico.map((item, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-md border border-gray-200"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-purple-600 font-medium">
                      👤 {item.oradorNome}
                    </span>
                  </div>
                  <div className="text-gray-600">
                    {new Date(item.data).toLocaleDateString("pt-BR")}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Rodapé */}
        <div className="p-6 border-t border-gray-200 bg-gray-50">
          <button
            onClick={onClose}
            className="w-full bg-gray-500 text-white py-2 px-4 rounded-md hover:bg-gray-600 transition-colors"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}

export default ModalHistoricoTema;
