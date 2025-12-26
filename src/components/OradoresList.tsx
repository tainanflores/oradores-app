import { useState, useEffect } from "react"; // Hooks para estado e efeitos
import { db, type Orador, type Discurso } from "../database"; // Importa banco e tipos
import OradorCard from "./OradorCard"; // Componente do card
import ModalOrador from "./ModalOrador"; // Modal de detalhes do orador

function OradoresList() {
  const [oradores, setOradores] = useState<Orador[]>([]);
  const [discursos, setDiscursos] = useState<Discurso[]>([]);
  const [searchNome, setSearchNome] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [selectedOrador, setSelectedOrador] = useState<Orador | null>(null);
  const [showInativos, setShowInativos] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      // Sempre carregar todos os oradores
      const oradoresData = await db.oradores.toArray();
      const discursosData = await db.discursos.toArray();
      setOradores(oradoresData);
      setDiscursos(discursosData);
    };
    loadData();
  }, [showInativos]);

  // Filtrar oradores por status ativo e nome
  const filteredOradores = oradores
    .filter((orador) => showInativos || orador.ativo)
    .filter((orador) =>
      orador.nome.toLowerCase().includes(searchNome.toLowerCase())
    );

  // Última data de discurso local para um orador
  const getUltimaDataLocal = (oradorId: number) => {
    const discursosLocais = discursos.filter(
      (d) => d.oradorId === oradorId && d.tipo === "local"
    );
    if (discursosLocais.length === 0) return "Nunca";
    const datas = discursosLocais.map((d) => new Date(d.data));
    const ultima = new Date(Math.max(...datas.map((d) => d.getTime())));
    return ultima.toLocaleDateString("pt-BR");
  };

  const openModal = (orador: Orador | null) => {
    setSelectedOrador(orador);
    setShowModal(true);
  };

  return (
    <div className="flex flex-col">
      {/* Cabeçalho fixo */}
      <div className="sticky top-0 bg-white z-10 pb-4 border-b border-gray-200 p-4">
        <h1 className="text-2xl font-bold mb-4 text-gray-800">👥 Oradores</h1>

        {/* Checkbox para mostrar inativos */}
        <div className="mb-4">
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={showInativos}
              onChange={(e) => setShowInativos(e.target.checked)}
              className="mr-2"
            />
            Mostrar oradores inativos
          </label>
        </div>

        {/* Busca por nome */}
        <div className="mb-4">
          <input
            type="text"
            placeholder="Buscar por nome"
            value={searchNome}
            onChange={(e) => setSearchNome(e.target.value)}
            className="p-2 border border-gray-300 rounded w-full max-w-md"
          />
        </div>

        <div className="flex gap-2 justify-around md:justify-start">
          <button
            onClick={() => openModal(null)}
            className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition-colors"
          >
            ➕ Adicionar
          </button>
        </div>
      </div>

      {/* Lista scrollável */}
      <div className="overflow-y-auto max-h-96">
        {filteredOradores.length === 0 ? (
          <p className="text-gray-500 p-4">Nenhum orador encontrado.</p>
        ) : (
          <ul className="list-none p-0">
            {filteredOradores.map((orador) => (
              <OradorCard
                key={orador.id}
                orador={orador}
                ultimaData={getUltimaDataLocal(orador.id!)}
                onClick={() => openModal(orador)}
                isAtivo={orador.ativo}
              />
            ))}
          </ul>
        )}
      </div>

      {/* Modal de detalhes */}
      <ModalOrador
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        orador={selectedOrador}
        onSave={() => {
          // Recarregar dados
          const loadData = async () => {
            const oradoresData = await db.oradores.toArray();
            const discursosData = await db.discursos.toArray();
            setOradores(oradoresData);
            setDiscursos(discursosData);
          };
          loadData();
        }}
      />
    </div>
  );
}

export default OradoresList;
