import { useState, useEffect } from "react";
import toast from "react-hot-toast";
import { db, type Orador, type Tema, type Configuracao } from "../database";
import ModalSelecionarDiscursos from "./ModalSelecionarDiscursos";
import { dbSaveWithBackup } from "../utils/dbWithBackup";
import { useGoogleDriveAuth } from "../contexts/GoogleDriveAuthContext";
import { formatDateBR } from "../utils/dateUtils";
import {
  User,
  Phone,
  MapPin,
  Building,
  CheckCircle,
  XCircle,
  FileText,
  BookOpen,
  Calendar,
  Edit,
  Save,
  X,
  ArrowLeft,
  History,
  Link,
  Loader2,
} from "lucide-react";

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
    new Set(),
  );
  const [mostrandoModalSelecao, setMostrandoModalSelecao] = useState(false);
  const [configuracao, setConfiguracao] = useState<Configuracao | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [erroTelefone, setErroTelefone] = useState<string>("");
  const { isSignedIn, uploadBackup } = useGoogleDriveAuth();

  // Funções para validação e formatação de telefone
  const extrairNumerosTelefone = (telefone: string): string => {
    return telefone.replace(/\D+/g, "");
  };

  const validarTelefone = (telefone: string): boolean => {
    const numeros = extrairNumerosTelefone(telefone);
    // Validar exatamente 10 ou 11 dígitos
    return numeros.length === 10 || numeros.length === 11;
  };

  const formatarInputTelefone = (valor: string): string => {
    // Aceita APENAS números
    return valor.replace(/\D+/g, "");
  };

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
        temasVinculadosIds.map((id) => db.temas.get(id)),
      );
      const temasVinculadosValidos = temasVinculadosData.filter(
        (t) => t !== undefined,
      ) as Tema[];
      setTemasVinculados(
        temasVinculadosValidos.sort((a, b) => a.numero - b.numero),
      );

      // Buscar discursos do orador para o histórico
      const discursos = await db.discursos
        .where("oradorId")
        .equals(orador.id!)
        .sortBy("data");

      // Preparar histórico com temas (ordenar decrescente por data)
      const historico = await Promise.all(
        discursos.map(async (discurso) => {
          let tema: Tema | null = null;
          if (discurso.temaId) {
            tema = (await db.temas.get(discurso.temaId)) || null;
          }
          return {
            data: discurso.data,
            tema,
            tipo: discurso.tipo,
          };
        }),
      );
      setHistoricoDiscursos(
        historico.sort(
          (a, b) => new Date(b.data).getTime() - new Date(a.data).getTime(),
        ),
      );
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
      setErroTelefone("");
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
      setErroTelefone("");
      setTemasVinculados([]);
      setHistoricoDiscursos([]);
      setTemasSelecionados(new Set()); // Resetar seleção
      carregarTemasDisponiveis();
    }
  }, [isOpen, orador]);

  //ussefect para editando
  useEffect(() => {
    if (editando) {
      carregarTemasDisponiveis();
      console.log(temasVinculados);
      // Inicializar temas selecionados com os temas vinculados atuais
      setTemasSelecionados(new Set(temasVinculados.map((tema) => tema.id!)));
    }
  }, [editando, temasVinculados]);

  const handleSalvar = async () => {
    if (!oradorLocal || salvando) return;

    // Validação de campos obrigatórios
    if (!oradorLocal.nome || oradorLocal.nome.trim() === "") {
      toast.error("O nome do orador é obrigatório!");
      return;
    }

    // Validação de telefone se preenchido
    if (oradorLocal.telefone && oradorLocal.telefone.trim() !== "") {
      if (!validarTelefone(oradorLocal.telefone)) {
        setErroTelefone("Telefone deve ter exatamente 10 ou 11 dígitos");
        toast.error("Telefone inválido! Deve ter 10 ou 11 dígitos.");
        return;
      }
    }

    setSalvando(true);
    try {
      let oradorId: number;
      if (orador) {
        // Atualizar orador existente
        await dbSaveWithBackup(
          "oradores",
          { ...oradorLocal, id: orador.id },
          configuracao?.autoBackup ?? false,
          isSignedIn,
          uploadBackup,
        );
        oradorId = orador.id!;
        toast.success("Orador atualizado com sucesso!");
      } else {
        // Adicionar novo orador
        const novoOrador = { ...oradorLocal };
        await dbSaveWithBackup(
          "oradores",
          novoOrador,
          configuracao?.autoBackup ?? false,
          isSignedIn,
          uploadBackup,
        );
        oradorId = (await db.oradores
          .where("nome")
          .equals(oradorLocal.nome)
          .and((o) => o.cidade === oradorLocal.cidade)
          .first())!.id!;
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
          temasVinculadosIds.map((id) => db.temas.get(id)),
        );
        const temasVinculadosValidos = temasVinculadosData.filter(
          (t) => t !== undefined,
        ) as Tema[];
        setTemasVinculados(
          temasVinculadosValidos.sort((a, b) => a.numero - b.numero),
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
    } finally {
      setSalvando(false);
    }
  };

  const sincronizarVinculosTemas = async (oradorId: number) => {
    try {
      // Remover vínculos existentes (sem backup - operação intermediária)
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
        uploadBackup,
      );
    } catch (error) {
      console.error("Erro ao sincronizar vínculos de temas:", error);
    }
  };

  const handleSelecionarDiscursos = (discursosSelecionados: Tema[]) => {
    // Substitui o set de temas selecionados pelo novo array, evitando duplicidade
    setTemasSelecionados(new Set(discursosSelecionados.map((d) => d.id!)));
  };

  if (!isOpen || !oradorLocal) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Cabeçalho */}
        <div className="p-4 border-b border-gray-200 bg-gradient-to-r from-purple-50 to-blue-50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-2 bg-purple-100 rounded-xl">
                <User className="w-6 h-6 text-purple-600" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-800">
                  {mostrandoHistorico
                    ? `Histórico`
                    : orador
                      ? oradorLocal.nome
                      : "Adicionar Orador"}
                </h2>
                {orador && !mostrandoHistorico && (
                  <p className="text-sm text-gray-600 mt-1">
                    {oradorLocal.tipo === "local"
                      ? "Orador Local"
                      : "Orador Visitante"}
                  </p>
                )}
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              title="Fechar"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          {orador && editando && (
            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Nome completo
              </label>
              <input
                type="text"
                value={oradorLocal.nome}
                onChange={(e) =>
                  setOradorLocal({ ...oradorLocal, nome: e.target.value })
                }
                className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-colors"
                placeholder="Digite o nome do orador"
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
              <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
                <h3 className="text-lg font-semibold text-gray-800 mb-3 flex items-center gap-2">
                  <History className="w-5 h-5 text-purple-600" />
                  Histórico
                </h3>

                {historicoDiscursos.length === 0 ? (
                  <div className="text-center py-8 px-4">
                    <Calendar className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                    <p className="text-gray-500 text-base font-medium mb-1">
                      Nenhuma apresentação registrada
                    </p>
                    <p className="text-gray-400 text-sm">
                      Este orador ainda não realizou nenhuma apresentação.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3 max-h-[60vh] overflow-y-auto">
                    {historicoDiscursos.map(
                      (
                        item: { data: string; tema: Tema | null; tipo: string },
                        index: number,
                      ) => (
                        <div
                          key={index}
                          className="bg-gradient-to-r from-gray-50 to-blue-50 p-4 rounded-lg border border-gray-200 hover:shadow-md transition-all duration-200 hover:border-purple-300"
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-3 mb-2">
                                <div className="p-2 bg-purple-100 rounded-lg">
                                  <BookOpen className="w-4 h-4 text-purple-600" />
                                </div>
                                <div>
                                  <div className="flex items-center gap-4 mt-1">
                                    <div className="flex items-center gap-1 text-sm text-gray-600">
                                      <Calendar className="w-4 h-4" />
                                      {formatDateBR(item.data)}
                                    </div>
                                    <span
                                      className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium ${
                                        item.tipo === "local"
                                          ? "bg-blue-100 text-blue-800"
                                          : "bg-orange-100 text-orange-800"
                                      }`}
                                    >
                                      {item.tipo === "local" ? (
                                        <>
                                          <Building className="w-3 h-3" />
                                          Local
                                        </>
                                      ) : (
                                        <>
                                          <MapPin className="w-3 h-3" />
                                          Visitante
                                        </>
                                      )}
                                    </span>
                                  </div>
                                </div>
                              </div>
                              {item.tema && (
                                <p className="text-sm text-gray-600 mt-3 text-left">
                                  {item.tema.numero} - {item.tema.titulo}
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      ),
                    )}
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* Tela de Informações */
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Informações Básicas */}
              <div className="space-y-4">
                <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
                  <h3 className="text-lg font-semibold text-gray-800 mb-3 flex items-center gap-2">
                    <User className="w-5 h-5 text-purple-600" />
                    Informações Pessoais
                  </h3>

                  <div className="space-y-3">
                    {!orador && (
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                          <User className="w-4 h-4 text-gray-400" />
                        </div>
                        <input
                          type="text"
                          value={oradorLocal.nome}
                          onChange={(e) =>
                            setOradorLocal({
                              ...oradorLocal,
                              nome: e.target.value,
                            })
                          }
                          className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-colors"
                          placeholder="Nome completo do orador"
                          autoFocus
                        />
                      </div>
                    )}

                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Phone className="w-4 h-4 text-gray-400" />
                      </div>
                      {editando ? (
                        <div>
                          <input
                            type="tel"
                            value={oradorLocal.telefone}
                            onChange={(e) => {
                              const formatado = formatarInputTelefone(
                                e.target.value,
                              );
                              setOradorLocal({
                                ...oradorLocal,
                                telefone: formatado,
                              });
                              // Limpar erro quando usuário começa a corrigir
                              if (erroTelefone && formatado) {
                                setErroTelefone("");
                              }
                            }}
                            className={`w-full pl-10 pr-3 py-2 border rounded-lg focus:ring-2 focus:border-transparent transition-colors ${
                              erroTelefone
                                ? "border-red-500 focus:ring-red-500"
                                : "border-gray-300 focus:ring-purple-500"
                            }`}
                            placeholder="Telefone (10 ou 11 dígitos, ex: 11999999999)"
                          />
                          {erroTelefone && (
                            <p className="text-red-500 text-sm mt-1">
                              {erroTelefone}
                            </p>
                          )}
                        </div>
                      ) : (
                        <div className="w-full pl-10 pr-3 py-1 text-gray-900 border border-gray-300 rounded-lg">
                          {oradorLocal.telefone || "Não informado"}
                        </div>
                      )}
                    </div>

                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <MapPin className="w-4 h-4 text-gray-400" />
                      </div>
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
                          className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-colors appearance-none bg-white"
                        >
                          <option value="visitante">Visitante</option>
                          <option value="local">Local</option>
                        </select>
                      ) : (
                        <div className="w-full pl-10 pr-3 py-1 text-gray-900 capitalize border border-gray-300 rounded-lg">
                          {oradorLocal.tipo}
                        </div>
                      )}
                    </div>

                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Building className="w-4 h-4 text-gray-400" />
                      </div>
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
                          className={`w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-colors ${
                            oradorLocal.tipo === "local"
                              ? "bg-gray-100 text-gray-500 cursor-not-allowed"
                              : ""
                          }`}
                          placeholder="Nome da congregação"
                        />
                      ) : (
                        <div className="w-full pl-10 pr-3 py-1 text-gray-900 border border-gray-300 rounded-lg">
                          {oradorLocal.congregacao || "Não informado"}
                        </div>
                      )}
                    </div>

                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <MapPin className="w-4 h-4 text-gray-400" />
                      </div>
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
                          className={`w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-colors ${
                            oradorLocal.tipo === "local"
                              ? "bg-gray-100 text-gray-500 cursor-not-allowed"
                              : ""
                          }`}
                          placeholder="Cidade da congregação"
                        />
                      ) : (
                        <div className="w-full pl-10 pr-3 py-1 text-gray-900 border border-gray-300 rounded-lg">
                          {oradorLocal.cidade || "Não informado"}
                        </div>
                      )}
                    </div>

                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <CheckCircle className="w-4 h-4 text-gray-400" />
                      </div>
                      {editando ? (
                        <select
                          value={oradorLocal.ativo ? "ativo" : "inativo"}
                          onChange={(e) =>
                            setOradorLocal({
                              ...oradorLocal,
                              ativo: e.target.value === "ativo",
                            })
                          }
                          className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-colors appearance-none bg-white tex"
                        >
                          <option value="ativo">Ativo</option>
                          <option value="inativo">Inativo</option>
                        </select>
                      ) : (
                        <div className="flex items-center pl-10 pr-3 py-1 border border-gray-300 rounded-lg">
                          {oradorLocal.ativo ? (
                            <CheckCircle className="w-5 h-5 text-green-600 mr-2" />
                          ) : (
                            <XCircle className="w-5 h-5 text-red-600 mr-2" />
                          )}
                          <span
                            className={`font-medium ${
                              oradorLocal.ativo
                                ? "text-green-800"
                                : "text-red-800"
                            }`}
                          >
                            {oradorLocal.ativo ? "Ativo" : "Inativo"}
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="relative">
                      <div className="absolute top-2 left-0 pl-3 pointer-events-none">
                        <FileText className="w-4 h-4 text-gray-400" />
                      </div>
                      {editando ? (
                        <textarea
                          value={oradorLocal.observacoes || ""}
                          onChange={(e) =>
                            setOradorLocal({
                              ...oradorLocal,
                              observacoes: e.target.value,
                            })
                          }
                          className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-colors resize-none"
                          rows={2}
                          placeholder="Observações sobre o orador"
                        />
                      ) : (
                        <div className="w-full pl-10 pr-3 py-1 text-gray-900 text-sm border border-gray-300 rounded-lg ">
                          {oradorLocal.observacoes || "Nenhuma observação"}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Temas Vinculados */}
              <div className="space-y-4">
                <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
                  <h3 className="text-lg font-semibold text-gray-800 mb-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <BookOpen className="w-5 h-5 text-purple-600" />
                      Esboços Vinculados
                      <span className="bg-purple-100 text-purple-800 text-xs px-2 py-1 rounded-full font-medium">
                        {editando
                          ? temasSelecionados.size
                          : temasVinculados.length}
                      </span>
                    </div>
                    {editando && (
                      <button
                        onClick={() => setMostrandoModalSelecao(true)}
                        className="p-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
                        title="Vincular esboços"
                      >
                        <Link className="w-4 h-4" />
                      </button>
                    )}
                  </h3>

                  {editando ? (
                    <>
                      {temasSelecionados.size === 0 ? (
                        <div className="text-center py-8 px-4">
                          <BookOpen className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                          <p className="text-gray-500 text-sm">
                            Nenhum esboço selecionado.
                          </p>
                          <p className="text-gray-400 text-xs mt-1">
                            Clique no ícone de link para vincular esboços a este
                            orador.
                          </p>
                        </div>
                      ) : (
                        <div className="space-y-2 max-h-64 overflow-y-auto">
                          {Array.from(temasSelecionados).map((temaId) => {
                            const tema = temasDisponiveis.find(
                              (t) => t.id === temaId,
                            );
                            return tema ? (
                              <div
                                key={temaId}
                                className="bg-gradient-to-r from-green-50 to-emerald-50 p-3 rounded-lg border border-green-200 hover:shadow-md transition-shadow"
                              >
                                <div className="flex items-start justify-between">
                                  <div className="flex-1">
                                    <p className="text-sm font-semibold text-green-900">
                                      {tema.numero}. {tema.titulo}
                                    </p>
                                  </div>
                                  <button
                                    onClick={() => {
                                      const newSelecionados = new Set(
                                        temasSelecionados,
                                      );
                                      newSelecionados.delete(temaId);
                                      setTemasSelecionados(newSelecionados);
                                    }}
                                    className="ml-3 p-1 text-red-500 hover:text-red-700 hover:bg-red-50 rounded transition-colors"
                                    title="Remover esboço"
                                  >
                                    <X className="w-4 h-4" />
                                  </button>
                                </div>
                              </div>
                            ) : null;
                          })}
                        </div>
                      )}
                    </>
                  ) : (
                    <>
                      {temasVinculados.length === 0 ? (
                        <div className="text-center py-8 px-4">
                          <BookOpen className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                          <p className="text-gray-500 text-sm">
                            Nenhum esboço vinculado a este orador.
                          </p>
                          <p className="text-gray-400 text-xs mt-1">
                            Vincule esboços para controlar quais temas este
                            orador pode apresentar.
                          </p>
                        </div>
                      ) : (
                        <div className="space-y-2 max-h-64 overflow-y-auto">
                          {temasVinculados.map((tema) => (
                            <div
                              key={tema.id}
                              className="bg-gradient-to-r from-purple-50 to-blue-50 p-3 rounded-lg border border-purple-200 hover:shadow-md transition-shadow"
                            >
                              <div className="flex items-start justify-between">
                                <div className="flex-1">
                                  <p className="text-sm font-semibold text-purple-900">
                                    {tema.numero}. {tema.titulo}
                                  </p>
                                </div>
                                <div className="ml-3">
                                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                                    {tema.numero}
                                  </span>
                                </div>
                              </div>
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
        <div className="p-4 border-t border-gray-200 bg-gray-50 flex justify-between items-center">
          <div className="w-full flex gap-3">
            {orador && !editando && !mostrandoHistorico && (
              <button
                onClick={() => setEditando(true)}
                className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium"
              >
                <Edit className="w-4 h-4" />
                Editar
              </button>
            )}
            {editando && (
              <button
                onClick={handleSalvar}
                disabled={salvando}
                className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-lg hover:from-green-600 hover:to-green-700 disabled:from-gray-400 disabled:to-gray-500 disabled:cursor-not-allowed transition-all duration-200 font-semibold shadow-lg hover:shadow-xl transform hover:scale-105 disabled:hover:scale-100 disabled:opacity-70"
              >
                {salvando ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Save className="w-5 h-5" />
                )}
                {salvando ? "Salvando..." : "Salvar"}
              </button>
            )}
            {mostrandoHistorico && (
              <button
                onClick={() => setMostrandoHistorico(false)}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium"
              >
                <ArrowLeft className="w-4 h-4" />
                Voltar
              </button>
            )}
          </div>
          <div>
            {orador && !editando && !mostrandoHistorico && (
              <button
                onClick={() => setMostrandoHistorico(true)}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
              >
                <History className="w-4 h-4" />
                Histórico
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
          temasSelecionados.has(tema.id!),
        )}
        persistOnConfirm={false}
        oradorId={oradorLocal?.id}
      />
    </div>
  );
}

export default ModalOrador;
