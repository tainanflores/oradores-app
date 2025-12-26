import { useState, useEffect, useRef } from "react";
import {
  db,
  type Orador,
  type Tema,
  type OradorTema,
  type SaidaOrador,
} from "../database";
import { format, parseISO, isAfter, isBefore, startOfToday } from "date-fns";
import { ptBR } from "date-fns/locale";
import toast from "react-hot-toast";
import ModalOrador from "../components/ModalOrador";
import ModalSelecionarDiscursos from "../components/ModalSelecionarDiscursos";
import { dbSaveWithBackup } from "../utils/dbWithBackup";
import { useConfig } from "../contexts/ConfigContext";
import { useGoogleDriveAuth } from "../contexts/GoogleDriveAuthContext";

interface ModalSaidaProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: () => void;
  saidaExistente?: SaidaOrador;
}

function ModalSaida({
  isOpen,
  onClose,
  onSave,
  saidaExistente,
}: ModalSaidaProps) {
  const oradoresRef = useRef<Orador[]>([]);
  const temasRef = useRef<Tema[]>([]);
  const oradorTemasRef = useRef<OradorTema[]>([]);
  const [selectedOrador, setSelectedOrador] = useState<Orador | null>(null);
  const [selectedTema, setSelectedTema] = useState<number | "">("");
  const [buscaOrador, setBuscaOrador] = useState("");
  const [dataSelecionada, setDataSelecionada] = useState<string>("");
  const [congregacaoDestino, setCongregacaoDestino] = useState<string>("");
  const [cidade, setCidade] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [showOradorDropdown, setShowOradorDropdown] = useState(false);
  const [showModalOrador, setShowModalOrador] = useState(false);
  const [showModalSelecaoDiscursos, setShowModalSelecaoDiscursos] =
    useState(false);
  const [dataReloadTrigger, setDataReloadTrigger] = useState(0);
  const [temasDoOrador, setTemasDoOrador] = useState<Tema[]>([]);
  const { congregacao } = useConfig();
  const { isSignedIn, uploadBackup } = useGoogleDriveAuth();
  // Estado para armazenar os temas selecionados no modal de discursos
  const temasOriginaisRef = useRef<Tema[]>([]);

  // Carregar dados quando o modal abre ou quando há trigger de reload
  useEffect(() => {
    if (isOpen) {
      const loadData = async () => {
        const [oradoresData, temasData, oradorTemasData] = await Promise.all([
          db.oradores
            .where("tipo")
            .equals("local")
            .filter((orador) => orador.ativo)
            .toArray(),
          db.temas.filter((tema) => tema.ativo).toArray(),
          db.oradorTemas.toArray(),
        ]);
        oradoresRef.current = oradoresData;
        temasRef.current = temasData;
        oradorTemasRef.current = oradorTemasData;
      };
      loadData();
    }
  }, [isOpen, dataReloadTrigger]);

  // Limpar campos quando modal fechar
  useEffect(() => {
    if (!isOpen) {
      setSelectedOrador(null);
      setSelectedTema("");
      setBuscaOrador("");
      setDataSelecionada("");
      setCongregacaoDestino("");
      setCidade("");
      setShowOradorDropdown(false);
      setShowModalOrador(false);
      // setTemasDoOrador(temasOriginaisRef.current); // Restaura os temas originais
    }
  }, [isOpen]);

  // Preencher campos quando há saída existente
  useEffect(() => {
    if (isOpen && saidaExistente) {
      // Aguardar um pouco para garantir que os dados foram carregados
      const timer = setTimeout(() => {
        const orador = oradoresRef.current.find(
          (o) => o.id === saidaExistente.oradorId
        );
        if (orador) {
          setSelectedOrador(orador);
          setBuscaOrador(orador.nome);
          setSelectedTema(saidaExistente.temaId);
          setDataSelecionada(saidaExistente.data);
          setCongregacaoDestino(saidaExistente.congregacaoDestino);
          setCidade(saidaExistente.cidade || "");
        }
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [isOpen, saidaExistente]);

  // Atualizar lista de temas quando o orador ou dados mudam
  useEffect(() => {
    if (selectedOrador) {
      const temas = (
        oradorTemasRef.current
          .filter((ot) => ot.oradorId === selectedOrador.id)
          .map((ot) => temasRef.current.find((t) => t.id === ot.temaId))
          .filter(Boolean) as Tema[]
      ).sort((a, b) => a.numero - b.numero);
      setTemasDoOrador(temas);
      temasOriginaisRef.current = temas; // Salva os temas originais
    } else {
      setTemasDoOrador([]);
      temasOriginaisRef.current = [];
    }
  }, [selectedOrador, dataReloadTrigger]);

  // Fechar dropdown ao clicar fora
  useEffect(() => {
    const handleClickOutside = () => {
      setShowOradorDropdown(false);
    };

    if (showOradorDropdown) {
      document.addEventListener("click", handleClickOutside);
      return () => document.removeEventListener("click", handleClickOutside);
    }
  }, [showOradorDropdown]);

  // Verificar conflitos de data quando a data é alterada
  useEffect(() => {
    if (dataSelecionada && isOpen) {
      verificarConflitoData();
    }
  }, [dataSelecionada, isOpen]);

  const verificarConflitoData = async () => {
    if (!dataSelecionada) return;

    try {
      // Buscar todas as saídas na mesma data
      const saidasNaData = await db.saidasOrador
        .where("data")
        .equals(dataSelecionada)
        .toArray();

      // Excluir a saída atual se estiver editando
      const conflitos = saidasNaData.filter(
        (saida) => !saidaExistente || saida.id !== saidaExistente.id
      );

      if (conflitos.length > 0) {
        // Buscar informações dos oradores em conflito
        const oradoresConflito = await Promise.all(
          conflitos.map(async (saida) => {
            const orador = await db.oradores.get(saida.oradorId);
            const tema = await db.temas.get(saida.temaId);
            return {
              orador: orador?.nome || "Orador não encontrado",
              tema: tema
                ? `${tema.numero}. ${tema.titulo}`
                : "Tema não encontrado",
              destino: saida.congregacaoDestino,
              cidade: saida.cidade,
            };
          })
        );

        const mensagemConflitos = oradoresConflito
          .map(
            (conflito) =>
              `• ${conflito.orador} - ${conflito.tema} (${conflito.destino}${
                conflito.cidade ? ` - ${conflito.cidade}` : ""
              })`
          )
          .join("\n");

        toast.error(
          `⚠️ Atenção! Já existe(m) saída(s) agendada(s) nesta data:\n\n${mensagemConflitos}\n\nConsidere alterar a data ou coordenar com os responsáveis.`,
          {
            duration: 8000, // Mostrar por mais tempo
          }
        );
      }
    } catch (error) {
      console.error("Erro ao verificar conflitos de data:", error);
    }
  };

  const handleReloadData = () => {
    // Trigger reload dos dados incrementando o contador
    setDataReloadTrigger((prev) => prev + 1);
  };

  // Função para normalizar texto (remover acentos)
  const normalizarTexto = (texto: string): string => {
    return texto
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "") // Remove acentos
      .replace(/[^a-z0-9\s]/g, ""); // Remove caracteres especiais, mantendo letras, números e espaços
  };

  // Filtrar oradores baseado na busca inteligente
  const oradoresFiltrados = oradoresRef.current.filter((orador) => {
    if (!buscaOrador.trim()) return true;

    const buscaNormalizada = normalizarTexto(buscaOrador);
    const nomeNormalizado = normalizarTexto(orador.nome);

    // Busca exata primeiro
    if (nomeNormalizado.includes(buscaNormalizada)) return true;

    // Busca por partes do nome (palavras individuais)
    const palavrasBusca = buscaNormalizada.split(/\s+/);
    return palavrasBusca.every((palavra) => nomeNormalizado.includes(palavra));
  });

  const handleSelectOrador = (orador: Orador) => {
    setSelectedOrador(orador);
    setBuscaOrador(orador.nome);
    setShowOradorDropdown(false);
    setSelectedTema(""); // Reset tema quando mudar orador
  };

  const handleAdicionarOrador = () => {
    setShowModalOrador(true);
  };

  const handleOradorCreated = async (oradorId: number) => {
    // Recarregar dados para incluir o novo orador
    const [oradoresData, temasData, oradorTemasData] = await Promise.all([
      db.oradores
        .where("tipo")
        .equals("local")
        .filter((orador) => orador.ativo)
        .toArray(),
      db.temas.filter((tema) => tema.ativo).toArray(),
      db.oradorTemas.toArray(),
    ]);
    oradoresRef.current = oradoresData;
    temasRef.current = temasData;
    oradorTemasRef.current = oradorTemasData;

    // Encontrar e selecionar o orador recém-criado
    const novoOrador = oradoresData.find((o) => o.id === oradorId);
    if (novoOrador) {
      handleSelectOrador(novoOrador);
    }
  };

  const handleVincularTema = () => {
    if (!selectedOrador) {
      toast.error("Selecione um orador primeiro!");
      return;
    }
    setShowModalSelecaoDiscursos(true);
  };

  const handleSelecionarDiscursos = (discursosSelecionados: Tema[]) => {
    // Ordena os discursos selecionados pelo número do tema
    const discursosOrdenados = [...discursosSelecionados].sort(
      (a, b) => a.numero - b.numero
    );
    setTemasDoOrador(discursosOrdenados);
  };

  const handleSalvar = async () => {
    if (
      !selectedOrador ||
      !selectedTema ||
      !dataSelecionada ||
      !congregacaoDestino
    ) {
      toast.error("Por favor, preencha todos os campos.");
      return;
    }

    // Verificar se os IDs existem
    if (!selectedOrador.id) {
      toast.error("Orador selecionado não possui ID válido.");
      return;
    }

    if (!selectedTema || isNaN(Number(selectedTema))) {
      toast.error("Por favor, selecione um tema válido.");
      return;
    }

    // Verificar se a data é futura
    const dataSaida = parseISO(dataSelecionada);
    const hoje = startOfToday();
    if (isBefore(dataSaida, hoje)) {
      toast.error("A data deve ser futura!");
      return;
    }

    setLoading(true);
    try {
      const novaSaida: Omit<SaidaOrador, "id"> = {
        data: dataSelecionada,
        oradorId: selectedOrador.id,
        temaId: Number(selectedTema),
        congregacaoDestino: congregacaoDestino.trim(),
        cidade: cidade.trim() || undefined,
      };

      if (saidaExistente) {
        await dbSaveWithBackup(
          "saidasOrador",
          { ...novaSaida, id: saidaExistente.id },
          Boolean(congregacao?.autoBackup),
          isSignedIn,
          uploadBackup
        );
        toast.success("Saída atualizada!");
      } else {
        await dbSaveWithBackup(
          "saidasOrador",
          novaSaida,
          Boolean(congregacao?.autoBackup),
          isSignedIn,
          uploadBackup
        );
        toast.success("Saída agendada!");
      }

      onSave();
      onClose();
    } catch (error) {
      console.error("Erro ao salvar saída:", error);
      toast.error("Erro ao salvar saída");
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg w-full max-w-md mx-4">
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-gray-800">
              🚗 {saidaExistente ? "Editar" : "Registrar"} Saída
            </h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors text-xl font-bold"
            >
              ✕
            </button>
          </div>
        </div>

        <div className="p-4 space-y-4">
          {/* Buscar Orador */}
          <div className="relative">
            <div className="flex gap-2">
              <div className="flex-1 relative">
                <input
                  type="text"
                  value={buscaOrador}
                  onChange={(e) => {
                    setBuscaOrador(e.target.value);
                    setShowOradorDropdown(true);
                  }}
                  onFocus={() => setShowOradorDropdown(true)}
                  placeholder="Digite o nome do orador..."
                  className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
                {showOradorDropdown && buscaOrador && (
                  <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-40 overflow-y-auto">
                    {oradoresFiltrados.length > 0 ? (
                      oradoresFiltrados.map((orador) => (
                        <div
                          key={orador.id}
                          onClick={() => handleSelectOrador(orador)}
                          className="p-2 hover:bg-gray-100 cursor-pointer border-b border-gray-100 last:border-b-0"
                        >
                          <div className="font-medium">{orador.nome}</div>
                          <div className="text-sm text-gray-500">
                            {orador.congregacao} - {orador.cidade}
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="p-2 text-gray-500 text-sm">
                        Nenhum orador encontrado
                      </div>
                    )}
                  </div>
                )}
              </div>
              <button
                onClick={handleAdicionarOrador}
                className="px-3 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors"
                title="Adicionar novo orador"
              >
                ➕
              </button>
            </div>
          </div>

          {/* Selecionar Tema */}
          {selectedOrador && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Tema
              </label>
              <div className="flex gap-2 items-end">
                <select
                  value={selectedTema}
                  onChange={(e) =>
                    setSelectedTema(
                      e.target.value ? Number(e.target.value) : ""
                    )
                  }
                  className="flex-1 min-w-0 p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                >
                  <option value="">Selecione um tema</option>
                  {temasDoOrador.map((tema) => (
                    <option key={tema.id} value={tema.id}>
                      {tema.numero}. {tema.titulo}
                    </option>
                  ))}
                </select>
                <button
                  onClick={handleVincularTema}
                  className="px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                  title="Vincular novo tema"
                >
                  🔗
                </button>
              </div>
              {temasDoOrador.length === 0 && (
                <p className="text-sm text-orange-600 mt-1">
                  Este orador não tem temas vinculados. Clique em 🔗 para
                  vincular.
                </p>
              )}
            </div>
          )}

          {/* Data */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Data da Saída
            </label>
            <input
              type="date"
              value={dataSelecionada}
              onChange={(e) => setDataSelecionada(e.target.value)}
              min={format(new Date(), "yyyy-MM-dd")}
              className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            />
          </div>

          {/* Congregação Destino */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Congregação de Destino
            </label>
            <input
              type="text"
              value={congregacaoDestino}
              onChange={(e) => setCongregacaoDestino(e.target.value)}
              placeholder="Nome da congregação"
              className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            />
          </div>

          {/* Cidade */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Cidade
            </label>
            <input
              type="text"
              value={cidade}
              onChange={(e) => setCidade(e.target.value)}
              placeholder="Nome da cidade"
              className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            />
          </div>
        </div>

        <div className="p-4 border-t border-gray-200 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 bg-gray-500 text-white py-2 px-4 rounded-md hover:bg-gray-600 transition-colors"
            disabled={loading}
          >
            Cancelar
          </button>
          <button
            onClick={handleSalvar}
            className="flex-1 bg-purple-600 text-white py-2 px-4 rounded-md hover:bg-purple-700 transition-colors disabled:opacity-50"
            disabled={loading}
          >
            {loading ? "Salvando..." : saidaExistente ? "Atualizar" : "Salvar"}
          </button>
        </div>
      </div>

      {/* Modal de Orador */}
      <ModalOrador
        isOpen={showModalOrador}
        onClose={() => setShowModalOrador(false)}
        orador={null} // null para modo de criação
        onSave={handleReloadData}
        onOradorCreated={handleOradorCreated}
      />

      {/* Modal de Seleção de Discursos */}
      <ModalSelecionarDiscursos
        isOpen={showModalSelecaoDiscursos}
        onClose={() => setShowModalSelecaoDiscursos(false)}
        onConfirm={handleSelecionarDiscursos}
        discursosJaVinculados={temasDoOrador}
      />
    </div>
  );
}

interface SaidaComRelacionamentos extends SaidaOrador {
  orador?: Orador;
  tema?: Tema;
}

function SaidasPage() {
  const [saidas, setSaidas] = useState<SaidaComRelacionamentos[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [saidaSelecionada, setSaidaSelecionada] = useState<
    SaidaComRelacionamentos | undefined
  >();

  useEffect(() => {
    carregarDados();
  }, []);

  const carregarDados = async () => {
    try {
      const [saidasData, oradoresData, temasData] = await Promise.all([
        db.saidasOrador.toArray(),
        db.oradores.toArray(),
        db.temas.toArray(),
      ]);

      // Combinar dados
      const saidasCompletas = saidasData.map((saida) => ({
        ...saida,
        orador: oradoresData.find((o) => o.id === saida.oradorId),
        tema: temasData.find((t) => t.id === saida.temaId),
      }));

      // Ordenar por data (mais próximas primeiro)
      saidasCompletas.sort((a, b) => {
        const dataA = parseISO(a.data);
        const dataB = parseISO(b.data);
        return dataA.getTime() - dataB.getTime();
      });

      setSaidas(saidasCompletas);
    } catch (error) {
      console.error("Erro ao carregar dados:", error);
      toast.error("Erro ao carregar dados");
    } finally {
      setLoading(false);
    }
  };

  const handleEditarSaida = (saida: SaidaComRelacionamentos) => {
    setSaidaSelecionada(saida);
    setModalOpen(true);
  };

  const saidasPassadas = saidas.filter((saida) => {
    const dataSaida = parseISO(saida.data);
    return isBefore(dataSaida, startOfToday());
  });

  const saidasFuturas = saidas.filter((saida) => {
    const dataSaida = parseISO(saida.data);
    return (
      isAfter(dataSaida, startOfToday()) ||
      format(dataSaida, "yyyy-MM-dd") === format(new Date(), "yyyy-MM-dd")
    );
  });

  // Função para agrupar saídas por mês
  const agruparSaidasPorMes = (saidas: SaidaComRelacionamentos[]) => {
    const grupos: { [key: string]: SaidaComRelacionamentos[] } = {};

    saidas.forEach((saida) => {
      const data = parseISO(saida.data);
      const chaveMes = format(data, "yyyy-MM");

      if (!grupos[chaveMes]) {
        grupos[chaveMes] = [];
      }
      grupos[chaveMes].push(saida);
    });

    // Ordenar os grupos por data (mais recente primeiro)
    return Object.entries(grupos)
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([chave, saidas]) => ({
        mes: chave,
        nomeMes: format(parseISO(`${chave}-01`), "MMMM yyyy", { locale: ptBR }),
        saidas: saidas.sort((a, b) => a.data.localeCompare(b.data)),
      }));
  };

  const saidasFuturasPorMes = agruparSaidasPorMes(saidasFuturas);
  const saidasPassadasPorMes = agruparSaidasPorMes(saidasPassadas);

  return (
    <div className="p-1 max-w-6xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-800">🚗 Saídas</h1>
        <button
          onClick={() => {
            setSaidaSelecionada(undefined);
            setModalOpen(true);
          }}
          className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition-colors"
        >
          + Registrar Saída
        </button>
      </div>

      {loading ? (
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto"></div>
          <p className="mt-2 text-gray-600">Carregando saídas...</p>
        </div>
      ) : (
        <div className="space-y-3">
          {/* Saídas Futuras */}
          <div className="bg-white p-1 rounded-lg shadow">
            <h3 className="text-lg font-semibold mb-2 text-green-700">
              📅 Próximas Saídas
            </h3>
            {saidasFuturas.length === 0 ? (
              <p className="text-gray-500">Nenhuma saída agendada</p>
            ) : (
              <div className="space-y-4">
                {saidasFuturasPorMes.map(({ mes, nomeMes, saidas }) => (
                  <div key={mes} className="space-y-3">
                    <h4 className="text-md font-semibold text-purple-600 capitalize border-b border-purple-200 pb-2">
                      {nomeMes}
                    </h4>
                    <div className="space-y-2">
                      {saidas.map((saida) => (
                        <div
                          key={saida.id}
                          onClick={() => handleEditarSaida(saida)}
                          className="p-3 bg-purple-50 rounded-lg border border-purple-200 hover:bg-purple-100 transition-colors cursor-pointer"
                        >
                          <div className="flex justify-between items-center">
                            <span className="font-medium text-green-800">
                              {format(parseISO(saida.data), "dd/MM", {
                                locale: ptBR,
                              })}
                            </span>
                            <span className="font-medium text-sm text-green-700 truncate flex-1 text-center">
                              {saida.orador?.nome}
                            </span>
                            <span className="text-xs text-green-600">
                              {saida.congregacaoDestino}
                              {saida.cidade && ` - ${saida.cidade}`}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Saídas Passadas */}
          {saidasPassadas.length > 0 && (
            <div className="bg-white p-6 rounded-lg shadow">
              <h3 className="text-lg font-semibold mb-4 text-gray-700">
                📚 Histórico de Saídas
              </h3>
              <div className="space-y-6">
                {saidasPassadasPorMes.map(({ mes, nomeMes, saidas }) => (
                  <div key={mes} className="space-y-3">
                    <h4 className="text-md font-semibold text-gray-600 capitalize border-b border-gray-200 pb-2">
                      {nomeMes}
                    </h4>
                    <div className="space-y-2">
                      {saidas.map((saida) => (
                        <div
                          key={saida.id}
                          onClick={() => handleEditarSaida(saida)}
                          className="p-3 bg-gray-50 rounded-lg border border-gray-200 hover:bg-gray-100 transition-colors cursor-pointer"
                        >
                          <div className="flex justify-between items-center">
                            <span className="font-medium text-gray-800">
                              {format(parseISO(saida.data), "dd/MM", {
                                locale: ptBR,
                              })}
                            </span>
                            <span className="font-medium text-sm text-gray-700 truncate flex-1 text-center">
                              {saida.orador?.nome}
                            </span>
                            <span className="text-xs text-gray-600">
                              {saida.congregacaoDestino}
                              {saida.cidade && ` - ${saida.cidade}`}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <ModalSaida
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSave={carregarDados}
        saidaExistente={saidaSelecionada}
      />
    </div>
  );
}

export default SaidasPage;
