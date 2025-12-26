import { useState, useEffect } from "react";
import { db, type Tema, type TemaBloqueado } from "../database";
import ModalBloquearTemas from "../components/ModalBloquearTemas";
import ModalEditarTema from "../components/ModalEditarTema";
import ModalHistoricoTema from "../components/ModalHistoricoTema";

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
            const dataFormatada = new Date(ultimaData).toLocaleDateString(
              "pt-BR"
            );
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
        const dataFormatada = new Date(ultimaData).toLocaleDateString("pt-BR");
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
    <div className="flex flex-col h-full">
      {/* Cabeçalho fixo */}
      <div className="sticky top-0 bg-white z-10 pb-4 border-b border-gray-200 p-4">
        <h1 className="text-2xl font-bold mb-4 text-gray-800">📚 Esboços</h1>

        {/* Campo de busca */}
        <div className="mb-4">
          <input
            type="text"
            value={buscaTema}
            onChange={(e) => setBuscaTema(e.target.value)}
            placeholder="Buscar por número ou título do esboço..."
            className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          />
        </div>

        <div className="flex gap-2 justify-around md:justify-start">
          <button
            onClick={handleBloquearTemas}
            className="bg-orange-600 text-white px-4 py-2 rounded-lg hover:bg-orange-700 transition-colors"
          >
            🚫 Bloquear
          </button>
          <button
            onClick={handleAdicionarTema}
            className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition-colors"
          >
            ➕ Adicionar
          </button>
        </div>
      </div>

      {/* Lista scrollável */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto"></div>
            <p className="mt-2 text-gray-600">Carregando esboços...</p>
          </div>
        ) : temasFiltrados.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-gray-600">
              {buscaTema
                ? `Nenhum esboço encontrado para "${buscaTema}"`
                : "Nenhum esboço cadastrado"}
            </p>
          </div>
        ) : (
          <div className="p-4 space-y-2">
            {temasFiltrados.map((tema) => {
              const bloqueado = isTemaBloqueado(tema.id!);

              return (
                <div
                  key={tema.id}
                  className={`p-2 rounded-lg shadow cursor-pointer hover:shadow-md transition-shadow ${
                    bloqueado
                      ? "bg-gray-100 border-l-4 border-red-400"
                      : "bg-white border-l-4 border-green-400"
                  }`}
                  onClick={() => handleVerHistorico(tema)}
                >
                  <div className="flex justify-between items-center">
                    <div>
                      <h3
                        className={`font-semibold text-left ${
                          bloqueado
                            ? "text-gray-500 line-through"
                            : "text-gray-800"
                        }`}
                      >
                        {tema.numero}. {tema.titulo}
                        {ultimasDatas.has(tema.id!) && (
                          <span className="text-gray-500 text-sm ml-2">
                            ({ultimasDatas.get(tema.id!)})
                          </span>
                        )}
                      </h3>
                    </div>
                    {bloqueado && (
                      <span className="text-red-500 text-lg">🚫</span>
                    )}
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
    </div>
  );
}

export default TemasPage;
