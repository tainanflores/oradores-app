import { useState, useEffect } from "react";
import { db, type Tema, type TemaBloqueado } from "../database";
import ModalBloquearTemas from "../components/ModalBloquearTemas";
import ModalEditarTema from "../components/ModalEditarTema";
import ModalHistoricoTema from "../components/ModalHistoricoTema";
import { formatDateBR } from "../utils/dateUtils";
import {
  BookOpen,
  Search,
  Ban,
  Plus,
  Loader2,
  FileText,
  History,
} from "lucide-react";
import TemasPorAnoModal from "../components/ModalTemasPorAno";

function TemasPage() {
  const [temas, setTemas] = useState<Tema[]>([]);
  const [temasBloqueados, setTemasBloqueados] = useState<TemaBloqueado[]>([]);
  const [ultimasDatas, setUltimasDatas] = useState<Map<number, string>>(
    new Map()
  );
  const [loading, setLoading] = useState(true);
  const [showBloquearModal, setShowBloquearModal] = useState(false);
  const [showEditarModal, setShowEditarModal] = useState(false);
  const [showHistoricoModal, setShowHistoricoModal] = useState(false);
  const [showTemasPorAnoModal, setShowTemasPorAnoModal] = useState(false);
  const [discursos, setDiscursos] = useState<any[]>([]);
  const [temaSelecionado, setTemaSelecionado] = useState<Tema | null>(null);
  const [buscaTema, setBuscaTema] = useState("");

  // Calcular ano de serviço atual (setembro-agosto)
  const getAnoServicoAtual = () => {
    const hoje = new Date();
    const mes = hoje.getMonth() + 1; // Janeiro = 1
    const ano = hoje.getFullYear();

    // O ano de serviço é sempre o ano seguinte quando estamos entre setembro e dezembro
    // Por exemplo: dezembro 2025 = ano de serviço 2026 (que começou em setembro 2025)
    return mes >= 9 ? ano + 1 : ano;
  };

  const anoServicoAtual = getAnoServicoAtual();

  useEffect(() => {
    const loadData = async () => {
      try {
        const [temasData, bloqueadosData, discursosData] = await Promise.all([
          db.temas.toArray(),
          db.temasBloqueados.where("ano").equals(anoServicoAtual).toArray(),
          db.discursos.toArray(),
        ]);

        setTemas(temasData);
        setTemasBloqueados(bloqueadosData);
        setDiscursos(discursosData);

        // Calcular últimas datas para cada tema
        const ultimasDatasMap = new Map<number, string>();
        temasData.forEach((tema) => {
          const discursosTema = discursosData
            .filter((discurso) => discurso.temaId === tema.id)
            .sort(
              (a, b) => new Date(b.data).getTime() - new Date(a.data).getTime()
            );

          if (discursosTema.length > 0) {
            const ultimaData = discursosTema[0].data;
            const dataFormatada = formatDateBR(ultimaData);
            ultimasDatasMap.set(tema.id!, dataFormatada);
          }
        });

        setUltimasDatas(ultimasDatasMap);
      } catch (error) {
        console.error("Erro ao carregar temas:", error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [anoServicoAtual]);

  const isTemaBloqueado = (temaId: number) => {
    return temasBloqueados.some((tb) => tb.temaId === temaId);
  };

  // Filtrar temas baseado na busca
  const temasFiltrados = temas.filter(
    (tema) =>
      tema.numero.toString().includes(buscaTema) ||
      tema.titulo.toLowerCase().includes(buscaTema.toLowerCase())
  );

  const handleAdicionarTema = () => {
    setTemaSelecionado(null);
    setShowEditarModal(true);
  };

  const handleVerHistorico = (tema: Tema) => {
    setTemaSelecionado(tema);
    setShowHistoricoModal(true);
  };

  const handleReloadTemas = async () => {
    const temasData = await db.temas.toArray();
    setTemas(temasData);

    // Recalcular últimas datas
    const discursosData = await db.discursos.toArray();
    const ultimasDatasMap = new Map<number, string>();
    temasData.forEach((tema) => {
      const discursosTema = discursosData
        .filter((discurso) => discurso.temaId === tema.id)
        .sort(
          (a, b) => new Date(b.data).getTime() - new Date(a.data).getTime()
        );

      if (discursosTema.length > 0) {
        const ultimaData = discursosTema[0].data;
        const dataFormatada = formatDateBR(ultimaData);
        ultimasDatasMap.set(tema.id!, dataFormatada);
      }
    });

    setUltimasDatas(ultimasDatasMap);
  };

  const handleBloquearTemas = () => {
    setShowBloquearModal(true);
  };

  const handleReloadData = async () => {
    const bloqueadosData = await db.temasBloqueados
      .where("ano")
      .equals(anoServicoAtual)
      .toArray();
    setTemasBloqueados(bloqueadosData);
  };

  return (
    <div className="flex flex-col">
      {/* Cabeçalho fixo */}
      <div className="sticky top-0 left-0 right-0 w-full bg-gradient-to-r from-purple-50 to-blue-50 shadow-md z-20">
        <div className="max-w-7xl mx-auto p-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 rounded-lg">
              <BookOpen className="w-6 h-6 text-purple-600" />
            </div>
            <h1 className="text-2xl font-bold text-gray-800">Esboços</h1>
          </div>
          <button
            type="button"
            className="p-2 rounded-lg bg-purple-100 hover:bg-purple-200 transition-colors ml-2"
            title="Histórico de temas por ano"
            onClick={() => setShowTemasPorAnoModal(true)}
          >
            <History className="w-6 h-6 text-purple-600" />
          </button>
        </div>
      </div>

      {/* Controles */}
      <div className="sticky top-[64px] bg-white from-purple-50 to-blue-50 z-10 pb-4 border-b border-purple-200 p-4 shadow-sm">
        {/* Campo de busca */}
        <div className="mb-4">
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="w-4 h-4 text-gray-400" />
            </div>
            <input
              type="text"
              value={buscaTema}
              onChange={(e) => setBuscaTema(e.target.value)}
              placeholder="Buscar por número ou título do esboço..."
              className="w-full pl-10 pr-4 py-3 border border-purple-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all duration-200 bg-white shadow-sm"
            />
          </div>
        </div>

        <div className="flex gap-3 justify-around md:justify-start">
          <button
            onClick={handleBloquearTemas}
            className="flex items-center gap-2 bg-gradient-to-r from-orange-500 to-red-500 text-white px-4 py-2 rounded-lg hover:from-orange-600 hover:to-red-600 transition-all duration-200 font-medium shadow-md hover:shadow-lg transform hover:scale-105"
          >
            <Ban className="w-4 h-4" />
            Bloquear
          </button>
          <button
            onClick={handleAdicionarTema}
            className="flex items-center gap-2 bg-gradient-to-r from-purple-500 to-purple-600 text-white px-4 py-2 rounded-lg hover:from-purple-600 hover:to-purple-700 transition-all duration-200 font-medium shadow-md hover:shadow-lg transform hover:scale-105"
          >
            <Plus className="w-4 h-4" />
            Adicionar
          </button>
        </div>
      </div>

      {/* Lista scrollável */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-12">
            <div className="relative">
              <Loader2 className="w-12 h-12 text-purple-600 animate-spin" />
            </div>
            <p className="mt-4 text-gray-600 font-medium">
              Carregando esboços...
            </p>
          </div>
        ) : temasFiltrados.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 px-4">
            <div className="p-4 bg-gray-100 rounded-full mb-4">
              <FileText className="w-8 h-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-semibold text-gray-700 mb-2">
              {buscaTema
                ? "Nenhum resultado encontrado"
                : "Nenhum esboço cadastrado"}
            </h3>
            <p className="text-gray-500 text-center max-w-sm">
              {buscaTema
                ? `Não encontramos esboços que correspondam à sua busca por "${buscaTema}"`
                : "Comece adicionando seu primeiro esboço para organizar as apresentações da congregação"}
            </p>
          </div>
        ) : (
          <div className="p-4 space-y-3">
            {temasFiltrados.map((tema) => {
              const bloqueado = isTemaBloqueado(tema.id!);

              return (
                <div
                  key={tema.id}
                  className={`group relative overflow-hidden rounded-xl shadow-sm hover:shadow-lg transition-all duration-300 cursor-pointer transform hover:scale-[1.02] ${
                    bloqueado
                      ? "bg-gradient-to-r from-red-50 to-orange-50 border border-red-200"
                      : "bg-gradient-to-r from-white to-purple-50 border border-purple-200 hover:border-purple-300"
                  }`}
                  onClick={() => handleVerHistorico(tema)}
                >
                  {/* Efeito de brilho no hover */}
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 transform -skew-x-12 translate-x-[-100%] group-hover:translate-x-[200%]"></div>

                  <div className="relative p-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        {/* Ícone do tema */}
                        <div
                          className={`p-2 rounded-lg ${
                            bloqueado
                              ? "bg-red-100 text-red-600"
                              : "bg-purple-100 text-purple-600"
                          }`}
                        >
                          <BookOpen className="w-4 h-4" />
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h3
                              className={`font-semibold text-base leading-tight truncate ${
                                bloqueado
                                  ? "text-red-700"
                                  : "text-gray-800 group-hover:text-purple-800"
                              } transition-colors duration-200`}
                            >
                              {tema.numero}. {tema.titulo}
                            </h3>
                          </div>

                          <div className="flex items-center justify-between">
                            {ultimasDatas.has(tema.id!) && (
                              <div className="flex items-center gap-1 text-xs text-gray-500">
                                <span className="w-1 h-1 bg-gray-400 rounded-full"></span>
                                <span>
                                  Última apresentação:{" "}
                                  {ultimasDatas.get(tema.id!)}
                                </span>
                              </div>
                            )}

                            {bloqueado && (
                              <div className="flex items-center gap-1 px-2 py-1 bg-red-100 text-red-700 text-xs font-medium rounded-full ml-3">
                                <Ban className="w-3 h-3" />
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {showBloquearModal && (
        <ModalBloquearTemas
          anoServico={anoServicoAtual}
          temasBloqueados={temasBloqueados}
          onClose={() => setShowBloquearModal(false)}
          onSave={handleReloadData}
        />
      )}

      {showEditarModal && (
        <ModalEditarTema
          isOpen={showEditarModal}
          onClose={() => setShowEditarModal(false)}
          tema={temaSelecionado}
          onSave={handleReloadTemas}
        />
      )}

      {showHistoricoModal && (
        <ModalHistoricoTema
          isOpen={showHistoricoModal}
          onClose={() => setShowHistoricoModal(false)}
          tema={temaSelecionado}
          onSave={handleReloadTemas}
        />
      )}

      {showTemasPorAnoModal &&
        (() => {
          const anosSet = new Set<number>();
          const datasPorAno: {
            [temaId: number]: { [ano: number]: string };
          } = {};
          // Construir o conjunto de anos e o mapeamento de datas por ano somente dos ultimos 3 anos

          temas.forEach((tema) => {
            datasPorAno[tema.id!] = {};
          });
          discursos.forEach((discurso) => {
            const data = new Date(discurso.data);
            let ano = data.getFullYear();
            anosSet.add(ano);
            if (datasPorAno[discurso.temaId]) {
              // Armazenar a data no formato DD/MM/AAAA
              const dataFormatada = `${String(data.getDate()).padStart(
                2,
                "0"
              )}/${String(data.getMonth() + 1).padStart(
                2,
                "0"
              )}/${data.getFullYear()}`;
              datasPorAno[discurso.temaId][ano] = dataFormatada;
            }
          });
          return (
            <TemasPorAnoModal
              isOpen={showTemasPorAnoModal}
              onClose={() => setShowTemasPorAnoModal(false)}
              temas={temas.map((t) => ({ id: t.id!, numero: t.numero }))}
              anos={
                //pega somente os ultimos 3 anos
                Array.from(anosSet)
                  .sort((a, b) => a - b)
                  .slice(-3)
              }
              datasPorAno={datasPorAno}
            />
          );
        })()}
    </div>
  );
}

export default TemasPage;
