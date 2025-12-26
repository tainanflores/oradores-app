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

  useEffect(() => {
    const loadData = async () => {
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
      } catch (error) {
        console.error("Erro ao carregar dados:", error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

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

    setDataSelecionada(data);
    setDiscursoSelecionado(discurso || null);
    setModalOpen(true);
  };

  const handleAdicionarDataEspecial = () => {
    setModalDatasEspeciaisOpen(true);
  };

  const handleReloadData = useCallback(async () => {
    const discursosData = await db.discursos.toArray();
    const datasEspeciaisData = await db.datasEspeciais.toArray();
    setDiscursos(discursosData);
    setDatasEspeciais(datasEspeciaisData);
    // Também recarregar oradores e temas para garantir que temos os dados atualizados
    const oradoresData = await db.oradores.toArray();
    const temasData = await db.temas.toArray();
    setOradores(oradoresData);
    setTemas(temasData);
  }, []);

  // Função para verificar se um final de semana de reunião (sábado ou domingo) deve ser ocupado por data especial

  const verificarDataEspecialNoDia = (
    diaReuniao: Date
  ): DataEspecial | null => {
    // Define o início e fim da semana do dia de reunião (segunda a domingo)
    const inicioSemana = startOfWeek(diaReuniao, { weekStartsOn: 1 });
    const fimSemana = endOfWeek(diaReuniao, { weekStartsOn: 1 });

    // Procura por datas especiais do tipo assembleia, congresso ou evento_transmitido na semana
    const dataEspecialSemana = datasEspeciais.find((de) => {
      const dataEspecial = parseISO(de.data);
      return (
        isWithinInterval(dataEspecial, {
          start: inicioSemana,
          end: fimSemana,
        }) &&
        (de.tipo === "assembleia" ||
          de.tipo === "congresso" ||
          de.tipo === "evento_transmitido")
      );
    });
    if (dataEspecialSemana) return dataEspecialSemana;

    // Procura por celebração apenas se estiver no sábado ou domingo da semana
    const dataEspecialCelebracao = datasEspeciais.find((de) => {
      const dataEspecial = parseISO(de.data);
      const diaSemana = dataEspecial.getDay(); // 0 = domingo, 6 = sábado
      return (
        isWithinInterval(dataEspecial, {
          start: inicioSemana,
          end: fimSemana,
        }) &&
        de.tipo === "celebracao" &&
        (diaSemana === 0 || diaSemana === 6)
      );
    });
    if (dataEspecialCelebracao) return dataEspecialCelebracao;

    return null;
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
      <div className="fixed top-0 left-0 right-0 bg-white p-4 shadow-md z-10 max-w-7xl mx-auto flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-800">📅 Agenda</h1>
        <button
          onClick={handleAdicionarDataEspecial}
          className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors"
        >
          🎯 Datas Especiais
        </button>
      </div>
      {/* Espaço para compensar header fixo (aprox. altura do header) */}
      <div className="h-20" />
      <p className="text-gray-600 mb-6">
        Calendário de reuniões da congregação. Clique em um dia para agendar ou
        ver discursos.
      </p>

      {loading ? (
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto"></div>
          <p className="mt-2 text-gray-600">Carregando agenda...</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow p-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Gerar meses dos próximos 6 meses */}
            {Array.from({ length: 6 }, (_, i) => {
              const mesAtual = new Date();
              mesAtual.setMonth(mesAtual.getMonth() + i);

              const ano = mesAtual.getFullYear();
              const mes = mesAtual.getMonth();

              // Encontrar todos os dias de reunião do mês
              const diasDeReuniao: Date[] = [];
              const primeiroDia = new Date(ano, mes, 1);
              const ultimoDia = new Date(ano, mes + 1, 0);

              const diaReuniaoNumero = configuracao
                ? getDiaSemanaNumero(configuracao.diaReuniao)
                : 0;

              for (
                let d = new Date(primeiroDia);
                d <= ultimoDia;
                d.setDate(d.getDate() + 1)
              ) {
                if (d.getDay() === diaReuniaoNumero) {
                  diasDeReuniao.push(new Date(d));
                }
              }

              // Adicionar datas de celebração do mês (sem duplicar dias de reunião)
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
                    !diasDeReuniao.some(
                      (d) =>
                        d.toISOString().split("T")[0] ===
                        dataEspecial.toISOString().split("T")[0]
                    )
                );

              // Combinar dias de reunião e celebrações
              const diasParaExibir = [...diasDeReuniao, ...celebracoesDoMes];
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

                      // Verificar se há data especial do tipo celebração neste dia
                      const celebracao = datasEspeciais.find(
                        (de) => de.tipo === "celebracao" && de.data === chave
                      );

                      // Se for celebração, renderizar como discurso agendado
                      if (celebracao) {
                        // Buscar discurso criado automaticamente para celebração
                        const discursoCelebracao = discursos.find(
                          (d) => d.data === chave && d.temaId === 1
                        );
                        let oradorCelebracao = null;
                        if (discursoCelebracao) {
                          oradorCelebracao = oradores.find(
                            (o) => o.id === discursoCelebracao.oradorId
                          );
                        }
                        // Buscar tema 1
                        const temaCelebracao = temas.find((t) => t.id === 1);

                        return (
                          <div
                            key={dia.toISOString()}
                            className={`p-2 rounded text-sm transition-colors ${
                              isCurrentWeek && !isPast
                                ? "bg-green-100 text-green-800 hover:bg-green-200 cursor-pointer"
                                : isPast
                                ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                                : "bg-orange-100 text-orange-800 hover:bg-orange-200 cursor-pointer"
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
                              {oradorCelebracao ? (
                                <>
                                  <span className="font-medium text-sm truncate flex-1 text-center">
                                    {oradorCelebracao.nome}
                                  </span>
                                  <span className="text-xs">✏️</span>
                                </>
                              ) : (
                                <span className="text-xs">🎉</span>
                              )}
                            </div>
                            {oradorCelebracao && temaCelebracao ? (
                              <div className="mt-1 text-xs text-gray-700">
                                <div className="truncate">📖 CELEBRAÇÃO</div>
                                <div className="truncate">
                                  🏛️ {oradorCelebracao.congregacao} -{" "}
                                  {oradorCelebracao.cidade}
                                </div>
                              </div>
                            ) : null}
                          </div>
                        );
                      }

                      // Renderização padrão para discursos agendados e dias livres
                      return (
                        <div
                          key={dia.toISOString()}
                          onClick={() => !isPast && handleDiaClick(dia)}
                          className={`p-2 rounded text-sm transition-colors ${
                            discurso
                              ? isCurrentWeek && !isPast
                                ? "bg-green-100 text-green-800 hover:bg-green-200 cursor-pointer"
                                : "bg-orange-100 text-orange-800 hover:bg-orange-200 cursor-pointer"
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
                                <span className="text-xs">✏️</span>
                              </>
                            ) : (
                              <span className="text-xs">
                                {isPast ? "⏰" : "➕"}
                              </span>
                            )}
                          </div>
                          {discurso && oradorInfo && temaInfo ? (
                            <div className="mt-1 text-xs text-gray-700">
                              <div className="truncate">
                                📖 {temaInfo.numero}. {temaInfo.titulo}
                              </div>
                              <div className="truncate">
                                🏛️ {oradorInfo.congregacao} -{" "}
                                {oradorInfo.cidade}
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
        onSave={handleReloadData}
        discursoExistente={discursoSelecionado}
      />

      <ModalDatasEspeciais
        isOpen={modalDatasEspeciaisOpen}
        onClose={() => setModalDatasEspeciaisOpen(false)}
        onSave={handleReloadData}
      />
    </div>
  );
}

export default AgendaPage;
