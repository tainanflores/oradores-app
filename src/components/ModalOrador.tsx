import { useState, useEffect } from "react";
import toast from "react-hot-toast";
import { db, type Orador, type Tema, type Configuracao } from "../database";
import ModalSelecionarDiscursos from "./ModalSelecionarDiscursos";
import { dbSaveWithBackup } from "../utils/dbWithBackup";
import { useGoogleDriveAuth } from "../contexts/GoogleDriveAuthContext";

interface ModalOradorProps {
  isOpen: boolean;
  onClose: () => void;
  orador: Orador | null;
  onSave: () => void;
  onOradorCreated?: (oradorId: number) => void;
}

function ModalOrador({
  isOpen,
  onClose,
  orador,
  onSave,
  onOradorCreated,
}: ModalOradorProps) {
  const [editando, setEditando] = useState(false);
  const [oradorLocal, setOradorLocal] = useState<Orador | null>(null);
  const [temasVinculados, setTemasVinculados] = useState<Tema[]>([]);
  const [historicoDiscursos, setHistoricoDiscursos] = useState<
    Array<{ data: string; tema: Tema | null; tipo: string }>
  >([]);
  const [mostrandoHistorico, setMostrandoHistorico] = useState(false);
  const [temasDisponiveis, setTemasDisponiveis] = useState<Tema[]>([]);
  const [temasSelecionados, setTemasSelecionados] = useState<Set<number>>(
    new Set()
  );
  const [mostrandoModalSelecao, setMostrandoModalSelecao] = useState(false);
  const [configuracao, setConfiguracao] = useState<Configuracao | null>(null);
  const { isSignedIn, uploadBackup } = useGoogleDriveAuth();

  useEffect(() => {
    if (!isOpen) {
      // Resetar estados quando modal fecha
      setOradorLocal(null);
      setTemasVinculados([]);
      setHistoricoDiscursos([]);
      setTemasSelecionados(new Set());
      setMostrandoHistorico(false);
      setMostrandoModalSelecao(false);
      setConfiguracao(null);
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) {
      // Carregar configurações da congregação
      const carregarConfiguracao = async () => {
        try {
          const config = await db.configuracoes.get(1);
          setConfiguracao(config || null);
        } catch (error) {
          console.error("Erro ao carregar configurações:", error);
        }
      };
      carregarConfiguracao();
    }
  }, [isOpen]);

  // Efeito para atualizar automaticamente congregação e cidade quando configuração carrega e tipo é local
  useEffect(() => {
    if (
      configuracao &&
      oradorLocal &&
      oradorLocal.tipo === "local" &&
      editando
    ) {
      // Se estamos editando e o tipo é local, garantir que congregação e cidade estejam preenchidas
      if (!oradorLocal.congregacao || !oradorLocal.cidade) {
        setOradorLocal({
          ...oradorLocal,
          congregacao: configuracao.nomeCongregacao,
          cidade: configuracao.cidade,
        });
      }
    }
  }, [configuracao, oradorLocal?.tipo, editando]);

  useEffect(() => {
    if (isOpen && orador) {
      setOradorLocal(orador);
      setEditando(false);
      setMostrandoHistorico(false);
      carregarDadosOrador();
    } else if (isOpen && !orador) {
      // Modo adicionar novo orador
      setOradorLocal({
        nome: "",
        telefone: "",
        congregacao: "",
        cidade: "",
        tipo: "visitante",
        ativo: true,
        observacoes: "",
      } as Orador);
      setEditando(true);
      setMostrandoHistorico(false);
      setTemasVinculados([]);
      setHistoricoDiscursos([]);
      setTemasSelecionados(new Set()); // Resetar seleção
      carregarTemasDisponiveis();
    }
  }, [isOpen, orador]);

  const carregarDadosOrador = async () => {
    if (!orador) {
      console.log("Orador não definido, pulando carregamento");
      return;
    }

    console.log("Carregando dados do orador:", orador.id);
    try {
      // Carregar temas vinculados manualmente (da tabela oradorTemas)
      const vinculos = await db.oradorTemas
        .where("oradorId")
        .equals(orador.id!)
        .toArray();
      const temasVinculadosIds = vinculos.map((v) => v.temaId);
      const temasVinculadosData = await Promise.all(
        temasVinculadosIds.map((id) => db.temas.get(id))
      );
      const temasVinculadosValidos = temasVinculadosData.filter(
        (t) => t !== undefined
      ) as Tema[];
      setTemasVinculados(
        temasVinculadosValidos.sort((a, b) => a.numero - b.numero)
      );

      // Buscar discursos do orador para o histórico
      const discursos = await db.discursos
        .where("oradorId")
        .equals(orador.id!)
        .sortBy("data");

      // Preparar histórico com temas
      const historico = await Promise.all(
        discursos.map(async (discurso) => {
          const tema = await db.temas.get(discurso.temaId);
          return {
            data: discurso.data,
            tema: tema || null,
            tipo: discurso.tipo,
          };
        })
      );
      setHistoricoDiscursos(historico);

      // Carregar temas disponíveis para edição
      await carregarTemasDisponiveis();

      // Inicializar temasSelecionados com os temas já vinculados
      const vinculadosIds = new Set(temasVinculadosValidos.map((t) => t.id!));
      setTemasSelecionados(vinculadosIds);
    } catch (error) {
      console.error("Erro ao carregar dados do orador:", error);
    }
  };

  const carregarTemasDisponiveis = async () => {
    try {
      const todosTemas = await db.temas.toArray();
      const temasAtivos = todosTemas.filter((tema) => tema.ativo);
      setTemasDisponiveis(temasAtivos);
    } catch (error) {
      console.error("Erro ao carregar temas disponíveis:", error);
    }
  };

  const handleSalvar = async () => {
    if (!oradorLocal) return;

    // Validação de campos obrigatórios
    if (!oradorLocal.nome || oradorLocal.nome.trim() === "") {
      toast.error("O nome do orador é obrigatório!");
      return;
    }

    try {
      let oradorId: number;
      if (orador) {
        // Atualizar orador existente
        await db.oradores.update(orador.id!, oradorLocal);
        await dbSaveWithBackup(
          "oradores",
          { ...oradorLocal, id: orador.id },
          configuracao?.autoBackup ?? false,
          isSignedIn,
          uploadBackup,
          false
        );
        oradorId = orador.id!;
        toast.success("Orador atualizado com sucesso!");
      } else {
        // Adicionar novo orador
        oradorId = (await db.oradores.add(oradorLocal)) as number;
        await dbSaveWithBackup(
          "oradores",
          { ...oradorLocal, id: oradorId },
          configuracao?.autoBackup ?? false,
          isSignedIn,
          uploadBackup,
          false
        );
        toast.success("Orador adicionado com sucesso!");
        if (onOradorCreated) {
          onOradorCreated(oradorId);
        }
      }
      await sincronizarVinculosTemas(oradorId);

      // Recarregar dados do orador para refletir mudanças nos vínculos
      if (orador) {
        console.log("Recarregando dados do orador após salvar...");
        // Recarregar temas vinculados
        const vinculos = await db.oradorTemas
          .where("oradorId")
          .equals(orador.id!)
          .toArray();
        const temasVinculadosIds = vinculos.map((v) => v.temaId);
        const temasVinculadosData = await Promise.all(
          temasVinculadosIds.map((id) => db.temas.get(id))
        );
        const temasVinculadosValidos = temasVinculadosData.filter(
          (t) => t !== undefined
        ) as Tema[];
        setTemasVinculados(
          temasVinculadosValidos.sort((a, b) => a.numero - b.numero)
        );
        console.log("Temas vinculados atualizados:", temasVinculadosValidos);
      }

      setEditando(false);
      onSave();
      if (!orador) {
        onClose(); // Fechar modal após adicionar
      }
    } catch (error) {
      console.error("Erro ao salvar orador:", error);
      toast.error("Erro ao salvar orador. Tente novamente.");
    }
  };

  const sincronizarVinculosTemas = async (oradorId: number) => {
    try {
      // Remover vínculos existentes
      await db.oradorTemas.where("oradorId").equals(oradorId).delete();

      // Adicionar e fazer backup dos novos vínculos de uma vez só
      const novosVinculos = Array.from(temasSelecionados).map((temaId) => ({
        oradorId,
        temaId,
      }));
      await dbSaveWithBackup(
        "oradorTemas",
        novosVinculos,
        configuracao?.autoBackup ?? false,
        isSignedIn,
        uploadBackup
      );
    } catch (error) {
      console.error("Erro ao sincronizar vínculos de temas:", error);
    }
  };

  const handleSelecionarDiscursos = (discursosSelecionados: Tema[]) => {
    // Substitui o set de temas selecionados pelo novo array, evitando duplicidade
    setTemasSelecionados(new Set(discursosSelecionados.map((d) => d.id!)));
  };

  const handleCancelar = () => {
    if (orador) {
      setOradorLocal(orador);
      setEditando(false);
      // Recarregar dados originais
      carregarDadosOrador();
    } else {
      onClose();
    }
  };

  if (!isOpen || !oradorLocal) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Cabeçalho */}
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <h2 className="text-xl font-bold text-gray-800">
                {mostrandoHistorico
                  ? `Histórico - ${oradorLocal.nome}`
                  : orador
                  ? `👤 ${oradorLocal.nome}`
                  : "➕ Adicionar Orador"}
              </h2>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors text-xl font-bold"
            >
              ✕
            </button>
          </div>
          {orador && editando && (
            <div className="mt-3">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Nome
              </label>
              <input
                type="text"
                value={oradorLocal.nome}
                onChange={(e) =>
                  setOradorLocal({ ...oradorLocal, nome: e.target.value })
                }
                className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                placeholder="Nome do orador"
                autoFocus
              />
            </div>
          )}
        </div>

        {/* Conteúdo */}
        <div className="flex-1 overflow-y-auto p-4">
          {mostrandoHistorico ? (
            /* Tela de Histórico */
            <div className="space-y-4">
              <div>
                {historicoDiscursos.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-gray-500">
                      Nenhuma apresentação registrada para este orador.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3 max-h-[60vh] overflow-y-auto">
                    {historicoDiscursos.map(
                      (
                        item: { data: string; tema: Tema | null; tipo: string },
                        index: number
                      ) => (
                        <div
                          key={index}
                          className="bg-gray-50 p-4 rounded-lg border-l-4 border-purple-400"
                        >
                          <div className="flex justify-between items-start">
                            <div className="flex-1">
                              <p className="text-sm font-medium text-gray-900">
                                {item.tema
                                  ? `${item.tema.numero}. ${item.tema.titulo}`
                                  : "Esboço não encontrado"}
                              </p>
                              <p className="text-sm text-gray-600 mt-1">
                                📅{" "}
                                {new Date(item.data).toLocaleDateString(
                                  "pt-BR"
                                )}
                              </p>
                            </div>
                            <span
                              className={`text-xs px-3 py-1 rounded-full font-medium ${
                                item.tipo === "local"
                                  ? "bg-blue-100 text-blue-800"
                                  : "bg-orange-100 text-orange-800"
                              }`}
                            >
                              {item.tipo === "local"
                                ? "🏠 Local"
                                : "✈️ Visitante"}
                            </span>
                          </div>
                        </div>
                      )
                    )}
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* Tela de Informações */
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Informações Básicas */}
              <div className="space-y-3">
                <div className="grid grid-cols-1 gap-3">
                  {!orador && (
                    <div className="flex items-center">
                      <label className="w-24 text-sm font-medium text-gray-700 flex-shrink-0">
                        Nome:
                      </label>
                      <input
                        type="text"
                        value={oradorLocal.nome}
                        onChange={(e) =>
                          setOradorLocal({
                            ...oradorLocal,
                            nome: e.target.value,
                          })
                        }
                        className="flex-1 ml-2 p-1 border border-gray-300 rounded focus:ring-1 focus:ring-purple-500 focus:border-transparent text-sm"
                        placeholder="Nome do orador"
                        autoFocus
                      />
                    </div>
                  )}

                  <div className="flex items-center">
                    <label className="w-24 text-sm font-medium text-gray-700 flex-shrink-0">
                      Telefone:
                    </label>
                    {editando ? (
                      <input
                        type="text"
                        value={oradorLocal.telefone}
                        onChange={(e) =>
                          setOradorLocal({
                            ...oradorLocal,
                            telefone: e.target.value,
                          })
                        }
                        className="flex-1 ml-2 p-1 border border-gray-300 rounded focus:ring-1 focus:ring-purple-500 focus:border-transparent text-sm"
                      />
                    ) : (
                      <span className="flex-1 ml-2 text-gray-900">
                        {oradorLocal.telefone}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center">
                    <label className="w-24 text-sm font-medium text-gray-700 flex-shrink-0">
                      Tipo:
                    </label>
                    {editando ? (
                      <select
                        value={oradorLocal.tipo}
                        onChange={(e) => {
                          const novoTipo = e.target.value as
                            | "visitante"
                            | "local";
                          if (novoTipo === "local") {
                            // Para oradores locais, sempre tentar preencher com configuração
                            // Se configuração não estiver disponível, usar valores vazios por enquanto
                            setOradorLocal({
                              ...oradorLocal,
                              tipo: novoTipo,
                              congregacao:
                                configuracao?.nomeCongregacao ||
                                oradorLocal.congregacao ||
                                "",
                              cidade:
                                configuracao?.cidade ||
                                oradorLocal.cidade ||
                                "",
                            });
                          } else {
                            setOradorLocal({
                              ...oradorLocal,
                              tipo: novoTipo,
                            });
                          }
                        }}
                        className="flex-1 ml-2 p-1 border border-gray-300 rounded focus:ring-1 focus:ring-purple-500 focus:border-transparent text-sm"
                      >
                        <option value="visitante">Visitante</option>
                        <option value="local">Local</option>
                      </select>
                    ) : (
                      <span className="flex-1 ml-2 text-gray-900 capitalize">
                        {oradorLocal.tipo}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center">
                    <label className="w-24 text-sm font-medium text-gray-700 flex-shrink-0">
                      Congregação:
                    </label>
                    {editando ? (
                      <input
                        type="text"
                        value={oradorLocal.congregacao}
                        onChange={(e) =>
                          setOradorLocal({
                            ...oradorLocal,
                            congregacao: e.target.value,
                          })
                        }
                        disabled={oradorLocal.tipo === "local"}
                        className={`flex-1 ml-2 p-1 border border-gray-300 rounded focus:ring-1 focus:ring-purple-500 focus:border-transparent text-sm ${
                          oradorLocal.tipo === "local"
                            ? "bg-gray-100 text-gray-500"
                            : ""
                        }`}
                      />
                    ) : (
                      <span className="flex-1 ml-2 text-gray-900">
                        {oradorLocal.congregacao}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center">
                    <label className="w-24 text-sm font-medium text-gray-700 flex-shrink-0">
                      Cidade:
                    </label>
                    {editando ? (
                      <input
                        type="text"
                        value={oradorLocal.cidade}
                        onChange={(e) =>
                          setOradorLocal({
                            ...oradorLocal,
                            cidade: e.target.value,
                          })
                        }
                        disabled={oradorLocal.tipo === "local"}
                        className={`flex-1 ml-2 p-1 border border-gray-300 rounded focus:ring-1 focus:ring-purple-500 focus:border-transparent text-sm ${
                          oradorLocal.tipo === "local"
                            ? "bg-gray-100 text-gray-500"
                            : ""
                        }`}
                      />
                    ) : (
                      <span className="flex-1 ml-2 text-gray-900">
                        {oradorLocal.cidade}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center">
                    <label className="w-24 text-sm font-medium text-gray-700 flex-shrink-0">
                      Status:
                    </label>
                    {editando ? (
                      <select
                        value={oradorLocal.ativo ? "ativo" : "inativo"}
                        onChange={(e) =>
                          setOradorLocal({
                            ...oradorLocal,
                            ativo: e.target.value === "ativo",
                          })
                        }
                        className="flex-1 ml-2 p-1 border border-gray-300 rounded focus:ring-1 focus:ring-purple-500 focus:border-transparent text-sm"
                      >
                        <option value="ativo">Ativo</option>
                        <option value="inativo">Inativo</option>
                      </select>
                    ) : (
                      <span
                        className={`flex-1 ml-2 px-2 py-1 rounded text-xs font-medium ${
                          oradorLocal.ativo
                            ? "bg-green-100 text-green-800"
                            : "bg-red-100 text-red-800"
                        }`}
                      >
                        {oradorLocal.ativo ? "Ativo" : "Inativo"}
                      </span>
                    )}
                  </div>

                  <div className="flex items-start">
                    <label className="w-24 text-sm font-medium text-gray-700 flex-shrink-0 pt-1">
                      Observações:
                    </label>
                    {editando ? (
                      <textarea
                        value={oradorLocal.observacoes || ""}
                        onChange={(e) =>
                          setOradorLocal({
                            ...oradorLocal,
                            observacoes: e.target.value,
                          })
                        }
                        className="flex-1 ml-2 p-1 border border-gray-300 rounded focus:ring-1 focus:ring-purple-500 focus:border-transparent text-sm"
                        rows={2}
                      />
                    ) : (
                      <span className="flex-1 ml-2 text-gray-900 text-sm">
                        {oradorLocal.observacoes || "Nenhuma observação"}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Temas Vinculados */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-800 border-b pb-2 flex items-center justify-between">
                  📚 Esboços (
                  {editando ? temasSelecionados.size : temasVinculados.length})
                  {editando && (
                    <button
                      onClick={() => setMostrandoModalSelecao(true)}
                      className="px-2 py-1 bg-purple-600 text-white rounded-md hover:bg-purple-700 transition-colors"
                    >
                      🔗{" "}
                    </button>
                  )}
                </h3>
                <div>
                  {editando ? (
                    <div className="space-y-3">
                      {temasSelecionados.size > 0 && (
                        <div className="space-y-2 max-h-60 overflow-y-auto">
                          {Array.from(temasSelecionados).map((temaId) => {
                            const tema = temasDisponiveis.find(
                              (t) => t.id === temaId
                            );
                            return tema ? (
                              <div
                                key={tema.id}
                                className="flex items-center justify-between bg-purple-50 p-2 rounded-md border-l-4 border-purple-400"
                              >
                                <p className="text-sm font-medium text-purple-900 flex-1">
                                  {tema.numero}. {tema.titulo}
                                </p>
                                <button
                                  onClick={() => {
                                    const newSelecionados = new Set(
                                      temasSelecionados
                                    );
                                    newSelecionados.delete(temaId);
                                    setTemasSelecionados(newSelecionados);
                                  }}
                                  className="text-red-500 hover:text-red-700 ml-2"
                                  title="Desvincular"
                                >
                                  ✕
                                </button>
                              </div>
                            ) : null;
                          })}
                        </div>
                      )}
                    </div>
                  ) : (
                    <>
                      {temasVinculados.length === 0 ? (
                        <p className="text-gray-500 text-sm">
                          Nenhum esboço vinculado.
                        </p>
                      ) : (
                        <div className="space-y-2 max-h-60 overflow-y-auto">
                          {temasVinculados.map((tema: Tema) => (
                            <div
                              key={tema.id}
                              className="bg-purple-50 p-1 rounded-md border-l-4 border-purple-400"
                            >
                              <p className="text-sm font-medium text-purple-900">
                                {tema.numero}. {tema.titulo}
                              </p>
                            </div>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Rodapé */}
        <div className="p-4 border-t border-gray-200 flex justify-between">
          <div className="flex gap-2">
            {orador && !editando && !mostrandoHistorico && (
              <button
                onClick={() => setEditando(true)}
                className="bg-purple-600 text-white px-4 py-2 rounded-md hover:bg-purple-700 transition-colors"
              >
                ✏️ Editar
              </button>
            )}
            {editando && (
              <>
                <button
                  onClick={handleSalvar}
                  className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 transition-colors"
                >
                  💾 Salvar
                </button>
                <button
                  onClick={handleCancelar}
                  className="bg-gray-500 text-white px-4 py-2 rounded-md hover:bg-gray-600 transition-colors"
                >
                  ❌ Cancelar
                </button>
              </>
            )}
            {mostrandoHistorico && (
              <button
                onClick={() => setMostrandoHistorico(false)}
                className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 transition-colors"
              >
                ← Voltar
              </button>
            )}
          </div>
          <div>
            {orador && !editando && !mostrandoHistorico && (
              <button
                onClick={() => setMostrandoHistorico(true)}
                className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors"
              >
                📅 Histórico
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Modal de Seleção de Discursos */}
      <ModalSelecionarDiscursos
        isOpen={mostrandoModalSelecao}
        onClose={() => setMostrandoModalSelecao(false)}
        onConfirm={handleSelecionarDiscursos}
        discursosJaVinculados={temasDisponiveis.filter((tema) =>
          temasSelecionados.has(tema.id!)
        )}
        persistOnConfirm={false}
        oradorId={oradorLocal?.id}
      />
    </div>
  );
}

export default ModalOrador;
