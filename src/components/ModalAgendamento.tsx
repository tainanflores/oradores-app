import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
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
import { dbSaveWithBackup, dbDeleteWithBackup } from "../utils/dbWithBackup";
import { useConfig } from "../contexts/ConfigContext";
import { useGoogleDriveAuth } from "../contexts/GoogleDriveAuthContext";
import { formatDateBR } from "../utils/dateUtils";
import {
  Calendar,
  UserPlus,
  Link,
  Clock,
  BookOpen,
  MapPin,
  User,
  Loader2,
} from "lucide-react";
import { sendWhatsappEvolution } from "../utils/sendWhatsappEvolution";
import { verificarEAtualizarStatusBD } from "../utils/whatsappEvolutionApi";
import {
  formatarMensagemTemplate,
  obterTemplate,
  type TemplateVars,
} from "../utils/whatsappTemplate";

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
  const [temasDoOrador, setTemasDoOrador] = useState<Tema[]>([]);
  const [ultimoDiscurso, setUltimoDiscurso] = useState<{
    data: string;
    tema: string;
  } | null>(null);
  const [proximoDiscurso, setProximoDiscurso] = useState<{
    data: string;
    tema: string;
  } | null>(null);
  const [isEditing, setIsEditing] = useState(false);

  const [temas, setTemas] = useState<Tema[]>([]);
  const [oradorTemas, setOradorTemas] = useState<OradorTema[]>([]);
  const [dataReloadTrigger, setDataReloadTrigger] = useState(0);

  const { congregacao } = useConfig();
  const { isSignedIn, uploadBackup } = useGoogleDriveAuth();
  const navigate = useNavigate();

  // Carregar dados quando o modal abre ou quando há trigger de reload
  useEffect(() => {
    if (!isOpen) return;

    const loadData = async () => {
      const [oradoresData, temasData, oradorTemasData] = await Promise.all([
        db.oradores.filter((o) => o.ativo).toArray(),
        db.temas.filter((t) => t.ativo).toArray(),
        db.oradorTemas.toArray(),
      ]);

      setTemas(temasData);
      setOradorTemas(oradorTemasData);

      // Atualizar refs para consistência
      oradoresRef.current = oradoresData;
      temasRef.current = temasData;
      oradorTemasRef.current = oradorTemasData;

      // Atualizar refs para consistência
      oradoresRef.current = oradoresData;
      temasRef.current = temasData;
      oradorTemasRef.current = oradorTemasData;
    };

    loadData();
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
      setProximoDiscurso(null);
      setIsEditing(false);
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && discursoExistente && oradoresRef.current.length > 0) {
      const orador =
        oradoresRef.current.find((o) => o.id === discursoExistente.oradorId) ||
        null;
      setSelectedOrador(orador);
      setBuscaOrador(orador ? orador.nome : "");
      setSelectedTema(discursoExistente.temaId);
      setIsEditing(false);
    } else if (isOpen && !discursoExistente) {
      setSelectedOrador(null);
      setBuscaOrador("");
      setSelectedTema("");
      setIsEditing(true);
    }
  }, [isOpen, discursoExistente, temas, oradorTemas]);

  // Handler para mostrar ou não o bloco de último/próximo discurso
  const shouldShowDiscursoInfo = (tipo: "ultimo" | "proximo") => {
    if (!isEditing) return false;
    const dataAtual = discursoExistente?.data;
    if (
      tipo === "ultimo" &&
      ultimoDiscurso &&
      dataAtual &&
      ultimoDiscurso.data === dataAtual
    )
      return false;
    if (
      tipo === "proximo" &&
      proximoDiscurso &&
      dataAtual &&
      proximoDiscurso.data === dataAtual
    )
      return false;
    return true;
  };

  // Buscar último e próximo discursos sempre que o orador for selecionado
  useEffect(() => {
    if (selectedOrador && selectedOrador.id) {
      const buscarDiscursos = async () => {
        try {
          const discursosOrador = await db.discursos
            .where("oradorId")
            .equals(selectedOrador.id!)
            .sortBy("data");

          const hoje = new Date().toISOString().split("T")[0];

          // Último discurso (datas anteriores a hoje)
          const discursosAnteriores = discursosOrador.filter(
            (d) => d.data < hoje,
          );

          if (discursosAnteriores.length > 0) {
            // Ordenar por data decrescente e pegar o primeiro (mais recente)
            const ultimo = discursosAnteriores.sort((a, b) =>
              b.data.localeCompare(a.data),
            )[0];
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

          // Próximo discurso (primeira data futura)
          const discursosFuturos = discursosOrador.filter((d) => d.data > hoje);
          if (discursosFuturos.length > 0) {
            const proximo = discursosFuturos[0];
            const tema = await db.temas.get(proximo.temaId);
            setProximoDiscurso({
              data: proximo.data,
              tema: tema
                ? `${tema.numero}. ${tema.titulo}`
                : "Tema não encontrado",
            });
          } else {
            setProximoDiscurso(null);
          }
        } catch (error) {
          console.error("Erro ao buscar discursos:", error);
          setUltimoDiscurso(null);
          setProximoDiscurso(null);
        }
      };

      buscarDiscursos();
    }
  }, [selectedOrador]);

  // Handler para WhatsApp
  const handleWhatsapp = async () => {
    if (!selectedOrador || !selectedOrador.telefone) {
      toast.error(
        "Cadastre o número de telefone do orador para usar o WhatsApp.",
      );
      return;
    }

    // Verificar se tem instância conectada no BD
    toast.loading("Verificando conexão do WhatsApp...");
    try {
      const statusAtual = await verificarEAtualizarStatusBD();

      toast.dismiss();

      if (statusAtual !== "conectado") {
        toast.error(
          "WhatsApp não está conectado. Conecte primeiro na configuração.",
        );
        // Redirecionar para Config e scroll para a seção de WhatsApp
        navigate("/config");
        // Scroll após navegação
        setTimeout(() => {
          const whatsappSection = document.getElementById("whatsapp-config");
          if (whatsappSection) {
            whatsappSection.scrollIntoView({ behavior: "smooth" });
          }
        }, 100);
        return;
      }
    } catch (err) {
      toast.dismiss();
      console.error("Erro ao verificar WhatsApp:", err);
      toast.error("Erro ao verificar status do WhatsApp");
      return;
    }

    // Confirmação antes de enviar
    if (
      !window.confirm("Deseja enviar a mensagem de confirmação para o orador?")
    ) {
      return;
    }

    const numero = selectedOrador.telefone.replace(/\D/g, "");
    const temaObj = temas.find((t) => t.id === Number(selectedTema)) || null;
    const horario = congregacao?.horarioReuniao || "";
    const dataFormatada =
      dataSelecionada?.toLocaleDateString("pt-BR", {
        weekday: "long",
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      }) || "";
    const nomeCongregacao = congregacao?.nomeCongregacao || "";
    const cidadeCongregacao = congregacao?.cidade || "";
    const temaFormatado = temaObj
      ? `${temaObj.numero}. ${temaObj.titulo}`
      : "(tema não definido)";

    // Usar template customizado ou padrão
    const template = obterTemplate(congregacao?.templateMensagemWhatsapp);
    const templateVars: TemplateVars = {
      nome: selectedOrador.nome,
      data: dataFormatada,
      hora: horario,
      tema: temaFormatado,
      temaNro: temaObj?.numero.toString() || "",
      temaTitulo: temaObj?.titulo || "",
      congregacao: nomeCongregacao,
      cidade: cidadeCongregacao,
      local: `${nomeCongregacao} - ${cidadeCongregacao}`,
    };
    const mensagem = formatarMensagemTemplate(template, templateVars);

    toast.loading("Enviando mensagem...");

    // Buscar nome da instância do BD
    const instancia = await db.whatsappInstancias.get(1);
    if (!instancia || !instancia.nome) {
      toast.dismiss();
      toast.error("Instância do WhatsApp não configurada");
      return;
    }

    const result = await sendWhatsappEvolution({
      numero,
      texto: mensagem,
      nomeInstancia: instancia.nome,
    });
    toast.dismiss();
    if (result.success && result.response?.status) {
      toast.success("Mensagem enviada com sucesso!");
    } else {
      toast.error(
        "Erro ao enviar mensagem: " +
          (result.response?.message || result.error || ""),
      );
    }
  };

  const handleToggleEdit = () => {
    setIsEditing(!isEditing);
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
        lembrete: false,
      };

      if (discursoExistente && discursoExistente.id) {
        // Atualizar discurso existente
        await dbSaveWithBackup(
          "discursos",
          { ...novoDiscurso, id: discursoExistente.id },
          Boolean(congregacao?.autoBackup),
          isSignedIn,
          uploadBackup,
        );
      } else {
        // Criar novo discurso
        await dbSaveWithBackup(
          "discursos",
          novoDiscurso,
          Boolean(congregacao?.autoBackup),
          isSignedIn,
          uploadBackup,
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

  useEffect(() => {
    if (!selectedOrador) {
      setTemasDoOrador([]);
      return;
    }

    const temasVinculados = oradorTemas
      .filter((ot) => ot.oradorId === selectedOrador.id)
      .map((ot) => temas.find((t) => t.id === ot.temaId))
      .filter(Boolean) as Tema[];

    setTemasDoOrador(temasVinculados.sort((a, b) => a.numero - b.numero));
  }, [selectedOrador, oradorTemas, temas, dataReloadTrigger]);

  const handleAdicionarOrador = () => {
    setShowModalOrador(true);
  };

  const handleReloadData = () => {
    // Trigger reload dos dados incrementando o contador
    setDataReloadTrigger((prev) => prev + 1);
  };

  const handleSelectOrador = (orador: Orador) => {
    setSelectedOrador(orador);
    setBuscaOrador(orador.nome);
    setShowOradorDropdown(false);
    setSelectedTema(""); // limpa o tema ao trocar de orador
  };

  const handleOradorCreated = async (oradorId: number) => {
    // 1. Recarregar tudo do banco
    const [oradoresData, temasData, oradorTemasData] = await Promise.all([
      db.oradores.filter((orador) => orador.ativo).toArray(),
      db.temas.filter((tema) => tema.ativo).toArray(),
      db.oradorTemas.toArray(),
    ]);

    // 2. Atualizar refs e states
    oradoresRef.current = oradoresData;
    temasRef.current = temasData;
    oradorTemasRef.current = oradorTemasData;

    setTemas(temasData);
    setOradorTemas(oradorTemasData);

    // 3. 🔥 FORÇA RELOAD COMPLETO - Trigger que faz tudo re-executar
    setDataReloadTrigger((prev) => prev + 1);

    // 4. Selecionar o novo orador
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

  const handleDelete = async () => {
    if (!discursoExistente || !discursoExistente.id) {
      toast.error("Nenhum discurso para excluir.");
      return;
    }

    const confirmacao = window.confirm(
      "Tem certeza que deseja excluir este discurso? Esta ação não pode ser desfeita.",
    );

    if (!confirmacao) return;

    setLoading(true);
    try {
      await dbDeleteWithBackup(
        "discursos",
        discursoExistente.id,
        Boolean(congregacao?.autoBackup),
        isSignedIn,
        uploadBackup,
      );
      toast.success("Discurso excluído com sucesso!");

      // Limpar campos
      setSelectedOrador(null);
      setSelectedTema("");
      setBuscaOrador("");
      setShowOradorDropdown(false);
      setUltimoDiscurso(null);
      setProximoDiscurso(null);

      await onSave(); // Aguardar o reload dos dados
      onClose();
    } catch (error) {
      console.error("Erro ao excluir discurso:", error);
      toast.error("Erro ao excluir discurso. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-2">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm max-h-[95vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <div className="p-1.5 bg-purple-100 rounded-lg flex-shrink-0">
              <Calendar className="w-5 h-5 text-purple-600" />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-lg font-bold text-gray-900 truncate">
                Agendar Discurso
              </h2>
              <p className="text-xs text-gray-600 truncate">
                {dataSelecionada?.toLocaleDateString("pt-BR", {
                  weekday: "short",
                  month: "short",
                  day: "numeric",
                })}
              </p>
            </div>
          </div>
          {/* Botão WhatsApp: só aparece se não está editando, há discursoExistente e orador com telefone */}
          {!isEditing && discursoExistente && selectedOrador && (
            <button
              onClick={handleWhatsapp}
              className="p-2 rounded-lg bg-green-500 hover:bg-green-600 text-white transition-colors flex-shrink-0 ml-2"
              title="Enviar mensagem pelo WhatsApp"
              aria-label="WhatsApp do orador"
            >
              {/* Ícone WhatsApp SVG */}
              <svg
                viewBox="0 0 24 24"
                fill="currentColor"
                className="w-5 h-5"
                aria-hidden="true"
              >
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.472-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.149-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.151-.174.2-.298.3-.497.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.5-.669-.51-.173-.007-.372-.009-.571-.009-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.099 3.2 5.077 4.363.71.306 1.263.489 1.694.626.712.227 1.36.195 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.413-.074-.124-.272-.198-.57-.347zm-5.421 6.403h-.001a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.999-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.455 4.436-9.89 9.893-9.89 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.896 6.994c-.003 5.456-4.438 9.891-9.893 9.891zm8.413-18.306A11.815 11.815 0 0012.05 0C5.495 0 .16 5.336.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.304-1.654a11.876 11.876 0 005.683 1.448h.005c6.554 0 11.89-5.336 11.893-11.892a11.82 11.82 0 00-3.473-8.429z" />
              </svg>
            </button>
          )}
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded-lg transition-colors flex-shrink-0 ml-2"
            aria-label="Fechar modal"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          {/* Content */}
          <div className="p-4 space-y-4">
            {/* Seção Orador */}
            <div className="space-y-3">
              <div className="flex gap-2">
                <div className="flex items-center gap-2">
                  <User className="w-4 h-4 text-gray-600" />
                </div>
                <div className="flex-1 relative">
                  <input
                    type="text"
                    value={buscaOrador}
                    onChange={(e) => {
                      setBuscaOrador(e.target.value);
                      setShowOradorDropdown(true);
                    }}
                    onFocus={() => setShowOradorDropdown(true)}
                    placeholder="Buscar orador..."
                    disabled={!isEditing}
                    className={`w-full pl-3 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-colors ${
                      !isEditing ? "bg-gray-100 cursor-not-allowed" : ""
                    }`}
                  />
                  {showOradorDropdown && buscaOrador && (
                    <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-40 overflow-y-auto">
                      {oradoresFiltrados.length > 0 ? (
                        oradoresFiltrados.map((orador) => (
                          <div
                            key={orador.id}
                            onClick={() => handleSelectOrador(orador)}
                            className="p-2 hover:bg-purple-50 cursor-pointer border-b border-gray-100 last:border-b-0 transition-colors"
                          >
                            <div className="font-medium text-sm text-gray-900 truncate">
                              {orador.nome}
                            </div>
                            <div className="flex items-center gap-1 text-xs text-gray-600 mt-1">
                              <MapPin className="w-3 h-3 flex-shrink-0" />
                              <span className="truncate">
                                {orador.congregacao} - {orador.cidade}
                              </span>
                              <span className="text-xs bg-gray-100 px-1.5 py-0.5 rounded-full flex-shrink-0 ml-1">
                                {orador.tipo}
                              </span>
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="p-2 text-gray-500 text-sm text-center">
                          Nenhum orador encontrado
                        </div>
                      )}
                    </div>
                  )}
                </div>
                <button
                  onClick={handleAdicionarOrador}
                  disabled={!isEditing}
                  className={`p-2 rounded-lg transition-colors shadow-sm flex-shrink-0 ${
                    isEditing
                      ? "bg-green-600 text-white hover:bg-green-700"
                      : "bg-gray-300 text-gray-500 cursor-not-allowed"
                  }`}
                  title="Adicionar novo orador"
                >
                  <UserPlus className="w-4 h-4" />
                </button>
              </div>

              {selectedOrador &&
                ultimoDiscurso &&
                shouldShowDiscursoInfo("ultimo") && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-blue-600 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <h4 className="text-sm font-medium text-blue-900 mb-1">
                          Último Discurso
                        </h4>
                        <div className="flex items-center gap-3 text-xs text-blue-800">
                          <div className="flex items-center gap-1">
                            <Calendar className="w-3 h-3 flex-shrink-0" />
                            <span className="truncate">
                              {formatDateBR(ultimoDiscurso.data)}
                            </span>
                          </div>
                          <div className="flex items-center gap-1 flex-1 min-w-0">
                            <BookOpen className="w-3 h-3 flex-shrink-0" />
                            <span className="truncate">
                              {ultimoDiscurso.tema}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

              {selectedOrador &&
                proximoDiscurso &&
                shouldShowDiscursoInfo("proximo") && (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-green-600 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <h4 className="text-sm font-medium text-green-900 mb-1">
                          Próximo Discurso
                        </h4>
                        <div className="flex items-center gap-3 text-xs text-green-800">
                          <div className="flex items-center gap-1">
                            <Calendar className="w-3 h-3 flex-shrink-0" />
                            <span className="truncate">
                              {formatDateBR(proximoDiscurso.data)}
                            </span>
                          </div>
                          <div className="flex items-center gap-1 flex-1 min-w-0">
                            <BookOpen className="w-3 h-3 flex-shrink-0" />
                            <span className="truncate">
                              {proximoDiscurso.tema}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
            </div>

            {/* Seção Tema */}
            {selectedOrador && (
              <div className="space-y-3">
                <div className="flex items-center gap-2 justify-between">
                  <BookOpen className="w-4 h-4 text-gray-600" />
                  <label className="text-sm font-semibold text-gray-700">
                    Tema do Discurso
                  </label>
                  <button
                    onClick={handleVincularTema}
                    disabled={!isEditing}
                    className={`self-start p-2 rounded-lg transition-colors shadow-sm ${
                      isEditing
                        ? "bg-blue-600 text-white hover:bg-blue-700"
                        : "bg-gray-300 text-gray-500 cursor-not-allowed"
                    }`}
                    title="Vincular novo tema"
                  >
                    <Link className="w-4 h-4" />
                  </button>
                </div>

                <div className="flex flex-col gap-2">
                  <select
                    value={selectedTema}
                    onChange={(e) =>
                      setSelectedTema(
                        e.target.value ? Number(e.target.value) : "",
                      )
                    }
                    disabled={!isEditing}
                    className={`w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-colors ${
                      !isEditing ? "bg-gray-100 cursor-not-allowed" : ""
                    }`}
                  >
                    <option value="">Selecione um tema</option>
                    {temasDoOrador.map((tema) => (
                      <option key={tema.id} value={tema.id}>
                        {tema.numero}. {tema.titulo}
                      </option>
                    ))}
                  </select>
                </div>

                {temasDoOrador.length === 0 && (
                  <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
                    <p className="text-sm text-orange-800 flex items-center gap-2">
                      <BookOpen className="w-4 h-4" />
                      Este orador não tem temas vinculados. Clique no ícone de
                      link para vincular novos temas.
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex gap-3 p-4 border-t border-gray-200 bg-gray-50 rounded-b-xl">
            <button
              onClick={
                isEditing ? onClose : discursoExistente ? handleDelete : onClose
              }
              className={`flex-1 py-2 px-3 rounded-lg border transition-colors font-medium text-sm ${
                isEditing
                  ? "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
                  : discursoExistente
                    ? "bg-red-600 text-white border-red-600 hover:bg-red-700 disabled:bg-gray-400 disabled:border-gray-400"
                    : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
              }`}
              disabled={loading}
            >
              {loading && discursoExistente && !isEditing ? (
                <div className="flex items-center justify-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Excluindo...
                </div>
              ) : isEditing ? (
                "Cancelar"
              ) : discursoExistente ? (
                "Excluir"
              ) : (
                "Cancelar"
              )}
            </button>
            <button
              onClick={isEditing ? handleSave : handleToggleEdit}
              className="flex-1 bg-purple-600 text-white py-2 px-3 rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium text-sm shadow-sm"
              disabled={loading}
            >
              {loading ? (
                <div className="flex items-center justify-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Salvando...
                </div>
              ) : isEditing ? (
                discursoExistente ? (
                  "Atualizar Discurso"
                ) : (
                  "Agendar Discurso"
                )
              ) : (
                "Editar"
              )}
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
    </div>
  );
}

export default ModalAgendamento;
