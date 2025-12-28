import { useState, useEffect, useCallback } from "react";
import {
  db,
  type Discurso,
  type Orador,
  type Tema,
  type Configuracao,
  type DataEspecial,
} from "../database";
import {
  format,
  parseISO,
  isWithinInterval,
  startOfWeek,
  endOfWeek,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import ModalAgendamento from "../components/ModalAgendamento";
import ModalDatasEspeciais from "../components/ModalDatasEspeciais";
import {
  Target,
  Edit,
  Clock,
  Plus,
  Building,
  ChevronLeft,
  ChevronRight,
  Home,
  Globe,
  Monitor,
  Heart,
  Mic,
  Plane,
  Calendar,
} from "lucide-react";
import {
  exportDiscursosToCSV,
  importDiscursosFromCSV,
} from "../utils/discursosImportExport";
import { useConfig } from "../contexts/ConfigContext";
import { useGoogleDriveAuth } from "../contexts/GoogleDriveAuthContext";
import toast from "react-hot-toast";
function AgendaPage() {
  const [discursos, setDiscursos] = useState<Discurso[]>([]);
  const [oradores, setOradores] = useState<Orador[]>([]);
  const [temas, setTemas] = useState<Tema[]>([]);
  const [configuracao, setConfiguracao] = useState<Configuracao | null>(null);
  const [datasEspeciais, setDatasEspeciais] = useState<DataEspecial[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalDatasEspeciaisOpen, setModalDatasEspeciaisOpen] = useState(false);
  const [dataSelecionada, setDataSelecionada] = useState<Date | null>(null);
  const [discursoSelecionado, setDiscursoSelecionado] =
    useState<Discurso | null>(null);
  const [periodOffset, setPeriodOffset] = useState(0); // Offset em meses para navegação (0 = atual)
  const [dataReloadTrigger, setDataReloadTrigger] = useState(0);
  const { congregacao } = useConfig();
  const autoBackup = congregacao?.autoBackup ?? false;
  const { isSignedIn, uploadBackup } = useGoogleDriveAuth();

  const loadAllData = useCallback(async () => {
    setLoading(true);
    try {
      const [
        discursosData,
        oradoresData,
        temasData,
        configData,
        datasEspeciaisData,
      ] = await Promise.all([
        db.discursos.toArray(),
        db.oradores.toArray(),
        db.temas.toArray(),
        db.configuracoes.get(1),
        db.datasEspeciais.toArray(),
      ]);

      setDiscursos(discursosData);
      setOradores(oradoresData);
      setTemas(temasData);
      setConfiguracao(configData || null);
      setDatasEspeciais(datasEspeciaisData);
    } catch (e) {
      console.error("Erro ao carregar dados", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAllData();
  }, [loadAllData, dataReloadTrigger]);

  const getIconTipo = (tipo: string) => {
    switch (tipo) {
      case "assembleia":
        return <Building className="w-4 h-4 text-blue-600" />;
      case "congresso":
        return <Globe className="w-4 h-4 text-green-600" />;
      case "celebracao":
        return <Heart className="w-4 h-4 text-purple-600" />;
      case "discurso_especial":
        return <Mic className="w-4 h-4 text-indigo-600" />;
      case "evento_transmitido":
        return <Monitor className="w-4 h-4 text-orange-600" />;
      case "visita_viajante":
        return <Plane className="w-4 h-4 text-teal-600" />;
      default:
        return <Target className="w-4 h-4 text-gray-600" />;
    }
  };

  // Funções para navegação de período
  const handlePrevPeriod = () => {
    setPeriodOffset((prev) => prev - 6);
  };

  const handleNextPeriod = () => {
    setPeriodOffset((prev) => prev + 6);
  };

  const handleCurrentPeriod = () => {
    setPeriodOffset(0);
  };

  const handleExport = () => {
    exportDiscursosToCSV();
  };

  const handleImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      importDiscursosFromCSV(file, autoBackup, isSignedIn, uploadBackup)
        .then(() => {
          toast.success("Discursos importados com sucesso!");
          // 🔥 Trigger reload da página inteira
          setDataReloadTrigger((prev) => prev + 1);
        })
        .catch((err) => {
          console.error("Erro ao importar discursos:", err);
        });
    }
  };

  // Calcular o período atual para exibição
  const getCurrentPeriodDisplay = () => {
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() + periodOffset);
    const endDate = new Date(startDate);
    endDate.setMonth(endDate.getMonth() + 5);
    return `${format(startDate, "MMM", { locale: ptBR })} - ${format(
      endDate,
      "MMM",
      { locale: ptBR }
    )}`;
  };

  // Função para mapear dia da semana string para número (0-6)
  const getDiaSemanaNumero = (diaString: string): number => {
    const mapaDias = {
      domingo: 0,
      segunda: 1,
      terca: 2,
      quarta: 3,
      quinta: 4,
      sexta: 5,
      sabado: 6,
    };
    return mapaDias[diaString as keyof typeof mapaDias] ?? 0; // Default para domingo
  };

  const handleDiaClick = (data: Date) => {
    const chave = data.toISOString().split("T")[0];
    const discurso = discursos.find((d) => d.data === chave);
    const ocupadoPorEspecial = isDiaOcupadoPorDataEspecial(data);

    // Não permitir agendamento se já houver discurso ou estiver ocupado por data especial
    if (ocupadoPorEspecial) {
      return;
    }

    setDataSelecionada(data);
    setDiscursoSelecionado(discurso || null);
    setModalOpen(true);
  };

  const handleAdicionarDataEspecial = () => {
    setModalDatasEspeciaisOpen(true);
  };

  // Função para verificar se um dia deve estar ocupado por data especial
  const isDiaOcupadoPorDataEspecial = (dia: Date): boolean => {
    if (!configuracao) return false;

    // Para cada data especial (exceto celebração e discurso especial)
    for (const dataEspecial of datasEspeciais) {
      if (
        dataEspecial.tipo === "celebracao" ||
        dataEspecial.tipo === "discurso_especial"
      ) {
        continue; // Essas ocupam apenas o dia específico
      }

      // Verificar se a data especial está na mesma semana que o dia atual
      const inicioSemana = startOfWeek(dia, { weekStartsOn: 1 }); // Segunda-feira
      const fimSemana = endOfWeek(dia, { weekStartsOn: 1 }); // Domingo

      if (
        isWithinInterval(dataEspecial.data, {
          start: inicioSemana,
          end: fimSemana,
        })
      ) {
        // Se estiver na mesma semana, verificar se o dia atual é o dia da reunião
        const diaSemanaAtual = dia.getDay(); // 0 = domingo, 1 = segunda, etc.
        const diaReuniaoNumero = getDiaSemanaNumero(configuracao.diaReuniao);

        if (diaSemanaAtual === diaReuniaoNumero) {
          return true; // Este dia da reunião está ocupado pela data especial
        }
      }
    }

    return false;
  };

  // Função para verificar se uma data está na semana atual (segunda a domingo)
  const isDataNaSemanaAtual = (data: Date): boolean => {
    const hoje = new Date();
    const inicioSemana = startOfWeek(hoje, { weekStartsOn: 1 }); // Segunda-feira
    const fimSemana = endOfWeek(hoje, { weekStartsOn: 1 }); // Domingo

    return isWithinInterval(data, { start: inicioSemana, end: fimSemana });
  };

  return (
    <div className="p-4 max-w-7xl mx-auto">
      {/* header fixo */}
      <div className="fixed top-0 left-0 right-0 bg-gradient-to-r from-purple-50 to-blue-50 p-4 shadow-md z-10 max-w-7xl mx-auto flex justify-between items-center">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-purple-100 rounded-lg">
            <Calendar className="w-6 h-6 text-purple-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-800">Agenda</h1>
        </div>
        <button
          onClick={handleAdicionarDataEspecial}
          className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2"
        >
          <Target size={16} />
          Datas Especiais
        </button>
      </div>
      {/* Espaço para compensar header fixo (aprox. altura do header) */}
      <div className="h-15" />

      <div className="flex justify-center">
        {/* Botão para importar discursos */}
        <label
          htmlFor="import-discursos"
          className="bg-blue-600 text-white px-3 py-1 rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-1 mr-2 text-sm cursor-pointer"
        >
          <input
            type="file"
            id="import-discursos"
            accept=".csv"
            onChange={handleImport}
            className="hidden"
          />
          Importar Discursos
        </label>

        {/* Botão Hoje - só aparece quando não está no período atual */}
        {periodOffset !== 0 && (
          <button
            onClick={handleCurrentPeriod}
            className="bg-gray-500 text-white px-3 py-1 rounded-lg hover:bg-gray-600 transition-colors flex items-center gap-1 text-sm"
          >
            <Home size={14} />
            Hoje
          </button>
        )}
      </div>

      {/* Navegação de período */}
      <div className="flex justify-center items-center mb-6 space-x-4">
        <button
          onClick={handlePrevPeriod}
          className="bg-purple-600 text-white px-3 py-2 rounded-lg hover:bg-purple-700 transition-colors flex items-center"
        >
          <ChevronLeft size={20} />
        </button>
        <span className="text-lg font-semibold text-gray-800 px-4">
          {getCurrentPeriodDisplay()}
        </span>
        <button
          onClick={handleNextPeriod}
          className="bg-purple-600 text-white px-3 py-2 rounded-lg hover:bg-purple-700 transition-colors flex items-center"
        >
          <ChevronRight size={20} />
        </button>
      </div>

      {loading ? (
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto"></div>
          <p className="mt-2 text-gray-600">Carregando agenda...</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow p-1">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Gerar meses do período selecionado (6 meses) */}
            {Array.from({ length: 6 }, (_, i) => {
              const mesAtual = new Date();
              mesAtual.setMonth(mesAtual.getMonth() + periodOffset + i);

              const ano = mesAtual.getFullYear();
              const mes = mesAtual.getMonth();

              // Gerar todos os dias do mês
              const primeiroDia = new Date(ano, mes, 1);
              const ultimoDia = new Date(ano, mes + 1, 0);
              const todosDiasDoMes: Date[] = [];
              for (
                let d = new Date(primeiroDia);
                d <= ultimoDia;
                d.setDate(d.getDate() + 1)
              ) {
                todosDiasDoMes.push(new Date(d));
              }

              // Adicionar datas de celebração do mês (sem duplicar dias do mês)
              const celebracoesDoMes = datasEspeciais
                .filter(
                  (de) =>
                    de.tipo === "celebracao" &&
                    (() => {
                      const data = parseISO(de.data);
                      return (
                        data.getFullYear() === ano && data.getMonth() === mes
                      );
                    })()
                )
                .map((de) => parseISO(de.data))
                .filter(
                  (dataEspecial) =>
                    !todosDiasDoMes.some(
                      (d) =>
                        d.toISOString().split("T")[0] ===
                        dataEspecial.toISOString().split("T")[0]
                    )
                );

              // Combinar todos os dias do mês e celebrações
              const diasParaExibir = [...todosDiasDoMes, ...celebracoesDoMes];
              diasParaExibir.sort((a, b) => a.getTime() - b.getTime());

              return (
                <div key={i} className="border rounded-lg p-3">
                  <h3 className="font-semibold text-center mb-3 text-purple-600">
                    {format(mesAtual, "MMMM yyyy", { locale: ptBR })}
                  </h3>

                  <div className="space-y-1">
                    {diasParaExibir.map((dia) => {
                      const chave = dia.toISOString().split("T")[0];
                      const discurso = discursos.find((d) => d.data === chave);
                      const hoje = new Date();
                      const hojeStr = format(hoje, "yyyy-MM-dd");
                      const diaStr = format(dia, "yyyy-MM-dd");
                      const isToday = hojeStr === diaStr;
                      const isPast = dia < hoje;
                      const isCurrentWeek = isDataNaSemanaAtual(dia);

                      // Buscar informações do orador e tema se houver discurso
                      let oradorInfo = null;
                      let temaInfo = null;
                      if (discurso) {
                        const orador = oradores.find(
                          (o) => o.id === discurso.oradorId
                        );
                        const tema = temas.find(
                          (t) => t.id === discurso.temaId
                        );
                        if (orador && tema) {
                          oradorInfo = orador;
                          temaInfo = tema;
                        }
                      }

                      // Verificar se há qualquer data especial neste dia
                      const dataEspecial = datasEspeciais.find(
                        (de) => de.data === chave
                      );

                      // Verificar se o dia está ocupado por data especial da semana
                      const ocupadoPorEspecial =
                        isDiaOcupadoPorDataEspecial(dia);

                      // Se houver data especial, renderizar com destaque especial
                      if (dataEspecial) {
                        let oradorEspecial = null;
                        let temaEspecial = null;

                        // Para celebração e discurso especial, buscar orador e tema
                        if (
                          dataEspecial.tipo === "celebracao" ||
                          dataEspecial.tipo === "discurso_especial"
                        ) {
                          const discursoEspecial = discursos.find(
                            (d) => d.data === chave && d.temaId === 1
                          );
                          if (discursoEspecial) {
                            oradorEspecial = oradores.find(
                              (o) => o.id === discursoEspecial.oradorId
                            );
                            temaEspecial = temas.find((t) => t.id === 1);
                          }
                        }

                        return (
                          <div
                            key={dia.toISOString()}
                            className={`p-2 rounded text-sm transition-colors border-2 ${
                              dataEspecial.tipo === "celebracao" ||
                              dataEspecial.tipo === "discurso_especial"
                                ? "bg-gradient-to-r from-purple-100 to-pink-100 border-purple-300 text-purple-800"
                                : "bg-blue-50 border-blue-300 text-blue-800"
                            } ${isToday ? "ring-2 ring-purple-300" : ""}`}
                          >
                            <div className="flex justify-between items-start">
                              <div className="flex items-center gap-2">
                                {getIconTipo(dataEspecial.tipo)}
                                <span
                                  className={`font-bold ${
                                    isToday ? "text-purple-600" : ""
                                  }`}
                                >
                                  {format(dia, "dd")}
                                  {isToday && " (Hoje)"}
                                </span>
                              </div>
                              {oradorEspecial ? (
                                <span className="text-xs flex items-center justify-center">
                                  <Edit size={12} />
                                </span>
                              ) : (
                                <span className="text-xs flex items-center justify-center">
                                  {getIconTipo(dataEspecial.tipo)}
                                </span>
                              )}
                            </div>

                            {/* Nome do tipo de data especial */}
                            <div
                              className={`font-semibold ${
                                dataEspecial.tipo === "celebracao" ||
                                dataEspecial.tipo === "discurso_especial"
                                  ? "text-lg"
                                  : "text-sm"
                              }`}
                            >
                              {dataEspecial.tipo === "celebracao"
                                ? "CELEBRAÇÃO"
                                : dataEspecial.tipo === "discurso_especial"
                                ? "DISCURSO ESPECIAL"
                                : dataEspecial.tipo
                                    .replace("_", " ")
                                    .toUpperCase()}
                            </div>

                            {/* Mostrar orador para celebração e discurso especial */}
                            {(dataEspecial.tipo === "celebracao" ||
                              dataEspecial.tipo === "discurso_especial") &&
                              oradorEspecial && (
                                <div className=" text-base font-bold text-purple-700">
                                  {oradorEspecial.nome}
                                </div>
                              )}

                            {/* Informações adicionais para celebração e discurso especial */}
                            {(dataEspecial.tipo === "celebracao" ||
                              dataEspecial.tipo === "discurso_especial") &&
                              oradorEspecial &&
                              temaEspecial && (
                                <div className="mt-1 text-xs text-gray-700">
                                  <div className="truncate flex items-center gap-1">
                                    <Building size={10} />
                                    {oradorEspecial.congregacao} -{" "}
                                    {oradorEspecial.cidade}
                                  </div>
                                </div>
                              )}
                          </div>
                        );
                      }

                      // Mostrar card vazio apenas se for dia de reunião e não houver discurso
                      const diaReuniaoNumero = configuracao
                        ? getDiaSemanaNumero(configuracao.diaReuniao)
                        : 0;
                      const isDiaReuniao = dia.getDay() === diaReuniaoNumero;

                      if (!discurso && !isDiaReuniao) {
                        // Não mostrar nada para dias que não são de reunião e não têm discurso
                        return null;
                      }

                      // Renderização padrão para discursos agendados e dias livres
                      return (
                        <div
                          key={dia.toISOString()}
                          onClick={() =>
                            !isPast &&
                            !ocupadoPorEspecial &&
                            handleDiaClick(dia)
                          }
                          className={`p-2 rounded text-sm transition-colors ${
                            discurso
                              ? isCurrentWeek && !isPast
                                ? "bg-green-100 text-green-800 hover:bg-green-200 cursor-pointer"
                                : "bg-orange-100 text-orange-800 hover:bg-orange-200 cursor-pointer"
                              : ocupadoPorEspecial
                              ? "bg-red-100 text-red-800 cursor-not-allowed"
                              : isPast
                              ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                              : "bg-blue-50 text-blue-800 hover:bg-blue-100 cursor-pointer"
                          } ${isToday ? "ring-2 ring-purple-300" : ""}`}
                        >
                          <div className="flex justify-between items-center">
                            <span
                              className={`font-medium ${
                                isToday ? "text-purple-600" : ""
                              }`}
                            >
                              {format(dia, "dd")}
                              {isToday && " (Hoje)"}
                            </span>
                            {discurso && oradorInfo ? (
                              <>
                                <span className="font-medium text-sm truncate flex-1 text-center">
                                  {oradorInfo.nome}
                                </span>
                                <span className="text-xs flex items-center justify-center">
                                  <Edit size={12} />
                                </span>
                              </>
                            ) : ocupadoPorEspecial ? (
                              <>
                                <span className="font-medium text-sm truncate flex-1 text-center text-red-700">
                                  {(() => {
                                    // Encontrar qual data especial está ocupando este dia
                                    for (const de of datasEspeciais) {
                                      if (
                                        de.tipo === "celebracao" ||
                                        de.tipo === "discurso_especial"
                                      )
                                        continue;
                                      const inicioSemana = startOfWeek(dia, {
                                        weekStartsOn: 1,
                                      });
                                      const fimSemana = endOfWeek(dia, {
                                        weekStartsOn: 1,
                                      });
                                      if (
                                        isWithinInterval(de.data, {
                                          start: inicioSemana,
                                          end: fimSemana,
                                        })
                                      ) {
                                        return de.tipo.replace("_", " ");
                                      }
                                    }
                                    return "Ocupado";
                                  })()}
                                </span>
                                <span className="text-xs flex items-center justify-center text-red-600">
                                  <Target size={12} />
                                </span>
                              </>
                            ) : (
                              <span className="text-xs flex items-center justify-center">
                                {isPast ? (
                                  <Clock size={12} />
                                ) : (
                                  <Plus size={12} />
                                )}
                              </span>
                            )}
                          </div>
                          {discurso && oradorInfo && temaInfo ? (
                            <div className="mt-1 text-xs text-gray-700">
                              <div className="truncate">
                                📖 {temaInfo.numero}. {temaInfo.titulo}
                              </div>
                              <div className="truncate flex items-center gap-1">
                                <Building size={10} />
                                {oradorInfo.congregacao} - {oradorInfo.cidade}
                              </div>
                            </div>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <ModalAgendamento
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        dataSelecionada={dataSelecionada}
        discursoExistente={discursoSelecionado}
        onSave={() => {
          // 🔥 Trigger reload da página inteira
          setDataReloadTrigger((prev) => prev + 1);
          setModalOpen(false);
        }}
      />

      <ModalDatasEspeciais
        isOpen={modalDatasEspeciaisOpen}
        onClose={() => setModalDatasEspeciaisOpen(false)}
        onSave={loadAllData}
      />
    </div>
  );
}

export default AgendaPage;
