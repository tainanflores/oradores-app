import { useState, useEffect, useCallback } from "react";
import { db, type Tema } from "../database";
import { dbSaveWithBackup } from "../utils/dbWithBackup";
import { useConfig } from "../contexts/ConfigContext";
import { useGoogleDriveAuth } from "../contexts/GoogleDriveAuthContext";

interface ModalSelecionarDiscursosProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (discursosSelecionados: Tema[]) => void;
  discursosJaVinculados: Tema[];
  persistOnConfirm?: boolean;
  oradorId?: number;
}

function ModalSelecionarDiscursos({
  isOpen,
  onClose,
  onConfirm,
  discursosJaVinculados,
  persistOnConfirm = false,
  oradorId,
}: ModalSelecionarDiscursosProps) {
  const [discursosDisponiveis, setDiscursosDisponiveis] = useState<Tema[]>([]);
  const [discursosSelecionados, setDiscursosSelecionados] = useState<
    Set<number>
  >(new Set());
  const [busca, setBusca] = useState("");
  const { congregacao } = useConfig();
  const { isSignedIn, uploadBackup } = useGoogleDriveAuth();

  const carregarDiscursosDisponiveis = useCallback(async () => {
    try {
      const todosDiscursos = await db.temas.toArray();
      const discursosAtivos = todosDiscursos.filter((d) => d.ativo);

      // Separar discursos já vinculados e não vinculados
      const idsJaVinculados = new Set(discursosJaVinculados.map((d) => d.id));
      const discursosVinculados = discursosAtivos.filter((d) =>
        idsJaVinculados.has(d.id!)
      );
      const discursosNaoVinculados = discursosAtivos.filter(
        (d) => !idsJaVinculados.has(d.id!)
      );

      // Ordenar: vinculados primeiro, depois não vinculados
      const discursosOrdenados = [
        ...discursosVinculados,
        ...discursosNaoVinculados,
      ];

      setDiscursosDisponiveis(discursosOrdenados);
    } catch (error) {
      console.error("Erro ao carregar discursos disponíveis:", error);
    }
  }, [discursosJaVinculados]);

  useEffect(() => {
    if (isOpen) {
      carregarDiscursosDisponiveis();
      setBusca("");
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect
  }, [isOpen, carregarDiscursosDisponiveis]);

  useEffect(() => {
    if (isOpen) {
      // Inicializar com discursos já vinculados selecionados
      const idsJaVinculados = new Set(discursosJaVinculados.map((d) => d.id!));
      setDiscursosSelecionados(idsJaVinculados);
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect
  }, [isOpen, discursosJaVinculados]);

  const idsJaVinculados = new Set(discursosJaVinculados.map((d) => d.id));

  const discursosFiltrados = discursosDisponiveis.filter(
    (discursos) =>
      discursos.titulo.toLowerCase().includes(busca.toLowerCase()) ||
      discursos.numero.toString().includes(busca)
  );

  const handleToggleSelecao = (discursosId: number) => {
    const novoSelecionado = new Set(discursosSelecionados);
    if (novoSelecionado.has(discursosId)) {
      novoSelecionado.delete(discursosId);
    } else {
      novoSelecionado.add(discursosId);
    }
    setDiscursosSelecionados(novoSelecionado);
    //limpar busca ao selecionar/deselecionar

    setBusca("");
    //muda cursor para o campo busca usando react

    const inputBusca = document.querySelector(
      'input[placeholder="Buscar por número ou título do discurso..."]'
    ) as HTMLInputElement | null;
    if (inputBusca) {
      inputBusca.focus();
    }
  };

  const handleConfirmar = async () => {
    const discursosSelecionadosList = discursosDisponiveis.filter((d) =>
      discursosSelecionados.has(d.id!)
    );
    if (persistOnConfirm && oradorId) {
      // Persistir vínculos de forma otimizada
      try {
        console.log("Persistindo vínculos de temas para oradorId:", oradorId);

        // Deletar todos os vínculos existentes SEM backup (operação intermediária)
        await db.oradorTemas.where("oradorId").equals(oradorId).delete();

        // Adicionar novos vínculos usando dbSaveWithBackup (apenas esta operação faz backup)
        const vinculosParaAdicionar = discursosSelecionadosList
          .filter((tema) => tema.id)
          .map((tema) => ({
            oradorId,
            temaId: tema.id!,
          }));

        if (vinculosParaAdicionar.length > 0) {
          await dbSaveWithBackup(
            "oradorTemas",
            vinculosParaAdicionar,
            Boolean(congregacao?.autoBackup),
            isSignedIn,
            uploadBackup
          );
        }
      } catch (error) {
        console.error("Erro ao persistir vínculos de temas:", error);
        throw error; // Re-throw para que o erro seja tratado pelo componente pai
      }
    }
    onConfirm(discursosSelecionadosList);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
        {/* Cabeçalho */}
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-gray-800">
              📚 Gerenciar Discursos Vinculados
            </h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors text-xl font-bold"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Campo de busca */}
        <div className="p-4 border-b border-gray-200">
          <input
            type="text"
            placeholder="Buscar por número ou título do discurso..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && discursosFiltrados.length > 0) {
                const primeiroDiscurso = discursosFiltrados[0];
                handleToggleSelecao(primeiroDiscurso.id!);
              }
            }}
            className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          />
        </div>

        {/* Lista de discursos */}
        <div className="flex-1 overflow-y-auto p-4">
          {discursosFiltrados.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-500">
                {busca
                  ? "Nenhum discurso encontrado para a busca."
                  : "Nenhum discurso disponível."}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {discursosFiltrados.map((discursos) => (
                <div
                  key={discursos.id}
                  className={`flex items-center space-x-3 p-3 rounded-md border cursor-pointer transition-colors ${
                    discursosSelecionados.has(discursos.id!)
                      ? "bg-purple-50 border-purple-300"
                      : "bg-gray-50 border-gray-200 hover:bg-gray-100"
                  }`}
                  onClick={() => handleToggleSelecao(discursos.id!)}
                >
                  <input
                    type="checkbox"
                    checked={discursosSelecionados.has(discursos.id!)}
                    onChange={() => handleToggleSelecao(discursos.id!)}
                    className="w-4 h-4 text-purple-600 bg-gray-100 border-gray-300 rounded focus:ring-purple-500"
                  />
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-gray-900 text-left">
                        {discursos.numero}. {discursos.titulo}
                      </p>
                      {idsJaVinculados.has(discursos.id!) && (
                        <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full font-medium">
                          Vinculado
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Rodapé */}
        <div className="p-4 border-t border-gray-200 flex justify-between items-center">
          <div className="text-sm text-gray-600">
            {discursosSelecionados.size} discurso(s) selecionado(s) para
            vincular
          </div>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={handleConfirmar}
              disabled={discursosSelecionados.size === 0}
              className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
            >
              Confirmar ({discursosSelecionados.size})
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ModalSelecionarDiscursos;
