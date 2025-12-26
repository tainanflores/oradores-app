import { useState, useEffect, useRef } from "react";
import {
  db,
  type Orador,
  type Tema,
  type OradorTema,
  type Discurso,
} from "../database";
import ModalOrador from "./ModalOrador";
import ModalSelecionarDiscursos from "./ModalSelecionarDiscursos";
import toast from "react-hot-toast";
import { dbSaveWithBackup } from "../utils/dbWithBackup";
import { useConfig } from "../contexts/ConfigContext";
import { useGoogleDriveAuth } from "../contexts/GoogleDriveAuthContext";

interface ModalAgendamentoProps {
  isOpen: boolean;
  onClose: () => void;
  dataSelecionada: Date | null;
  onSave: () => void;
  discursoExistente?: Discurso | null;
}

function ModalAgendamento({
  isOpen,
  onClose,
  dataSelecionada,
  onSave,
  discursoExistente,
}: ModalAgendamentoProps) {
  const oradoresRef = useRef<Orador[]>([]);
  const temasRef = useRef<Tema[]>([]);
  const oradorTemasRef = useRef<OradorTema[]>([]);
  const [selectedOrador, setSelectedOrador] = useState<Orador | null>(null);
  const [selectedTema, setSelectedTema] = useState<number | "">("");
  const [buscaOrador, setBuscaOrador] = useState("");
  const [loading, setLoading] = useState(false);
  const [showOradorDropdown, setShowOradorDropdown] = useState(false);
  const [showModalOrador, setShowModalOrador] = useState(false);
  const [showModalSelecaoDiscursos, setShowModalSelecaoDiscursos] =
    useState(false);
  const [dataReloadTrigger, setDataReloadTrigger] = useState(0);
  const [temasDoOrador, setTemasDoOrador] = useState<Tema[]>([]);
  const [ultimoDiscurso, setUltimoDiscurso] = useState<{
    data: string;
    tema: string;
  } | null>(null);

  const { congregacao } = useConfig();
  const { isSignedIn, uploadBackup } = useGoogleDriveAuth();
  // Carregar dados quando o modal abre ou quando há trigger de reload
  useEffect(() => {
    if (isOpen) {
      const loadData = async () => {
        const [oradoresData, temasData, oradorTemasData] = await Promise.all([
          db.oradores.filter((orador) => orador.ativo).toArray(),
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
      setShowOradorDropdown(false);
      setShowModalOrador(false);
      setUltimoDiscurso(null);
    }
  }, [isOpen]);

  // Preencher campos quando há discurso existente
  useEffect(() => {
    if (isOpen && discursoExistente) {
      // Aguardar um pouco para garantir que os dados foram carregados
      const timer = setTimeout(() => {
        const orador = oradoresRef.current.find(
          (o) => o.id === discursoExistente.oradorId
        );
        if (orador) {
          setSelectedOrador(orador);
          setBuscaOrador(orador.nome);
          setSelectedTema(discursoExistente.temaId);
        }
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [isOpen, discursoExistente]);

  // Buscar último discurso sempre que o orador for selecionado
  useEffect(() => {
    if (selectedOrador && selectedOrador.id) {
      const buscarUltimoDiscurso = async () => {
        try {
          const discursosOrador = await db.discursos
            .where("oradorId")
            .equals(selectedOrador.id!)
            .sortBy("data");

          if (discursosOrador.length > 0) {
            const ultimo = discursosOrador[discursosOrador.length - 1];
            const tema = await db.temas.get(ultimo.temaId);
            setUltimoDiscurso({
              data: ultimo.data,
              tema: tema
                ? `${tema.numero}. ${tema.titulo}`
                : "Tema não encontrado",
            });
          } else {
            setUltimoDiscurso(null);
          }
        } catch (error) {
          console.error("Erro ao buscar último discurso:", error);
          setUltimoDiscurso(null);
        }
      };

      buscarUltimoDiscurso();
    }
  }, [selectedOrador]);

  const handleReloadData = () => {
    // Trigger reload dos dados incrementando o contador
    setDataReloadTrigger((prev) => prev + 1);
  };

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

  const handleSave = async () => {
    if (!dataSelecionada || !selectedOrador || !selectedTema) {
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

    setLoading(true);
    try {
      const chave = dataSelecionada.toISOString().split("T")[0];

      const novoDiscurso = {
        data: chave,
        oradorId: selectedOrador.id,
        temaId: Number(selectedTema),
        tipo: selectedOrador.tipo,
      };

      if (discursoExistente && discursoExistente.id) {
        // Atualizar discurso existente
        await dbSaveWithBackup(
          "discursos",
          { ...novoDiscurso, id: discursoExistente.id },
          Boolean(congregacao?.autoBackup),
          isSignedIn,
          uploadBackup
        );
      } else {
        // Criar novo discurso
        await dbSaveWithBackup(
          "discursos",
          novoDiscurso,
          Boolean(congregacao?.autoBackup),
          isSignedIn,
          uploadBackup
        );
      }

      await onSave(); // Aguardar o reload dos dados
      onClose();
    } catch (error) {
      console.error("Erro ao agendar discurso:", error);
      toast.error("Erro ao agendar discurso. Tente novamente.");
    } finally {
      setLoading(false);
    }
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
    } else {
      setTemasDoOrador([]);
    }
  }, [selectedOrador, dataReloadTrigger]);

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
      db.oradores.filter((orador) => orador.ativo).toArray(),
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
    // No fluxo de agendamento, persistOnConfirm já salva no banco, só atualizar estado local
    setTemasDoOrador(discursosSelecionados);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-2 w-full max-w-md mx-4">
        <h2 className="text-xl font-bold mb-2 text-gray-800">
          📅 Agendar Discurso
        </h2>

        <p className="text-gray-600 mb-4">
          Data: {dataSelecionada?.toLocaleDateString("pt-BR")}
        </p>

        <div className="space-y-4">
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
                            {orador.congregacao} - {orador.cidade} (
                            {orador.tipo})
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
            {selectedOrador && (
              <div className="mt-2 p-2 bg-blue-50 rounded-md">
                <div className="text-xs text-gray-600 text-left">
                  {ultimoDiscurso ? (
                    <>
                      <strong>📅 Último discurso:</strong>{" "}
                      {new Date(ultimoDiscurso.data).toLocaleDateString(
                        "pt-BR"
                      )}
                      <br />
                      <strong>📖 Tema:</strong> {ultimoDiscurso.tema}
                    </>
                  ) : (
                    "Nenhum discurso anterior registrado"
                  )}
                </div>
              </div>
            )}
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
            {loading ? "Salvando..." : "Agendar"}
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
        persistOnConfirm={true}
        oradorId={selectedOrador?.id}
      />
    </div>
  );
}

export default ModalAgendamento;
