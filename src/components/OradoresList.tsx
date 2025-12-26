import { useState, useEffect } from "react"; // Hooks para estado e efeitos
import { db, type Orador, type Discurso } from "../database"; // Importa banco e tipos
import OradorCard from "./OradorCard"; // Componente do card
import ModalOrador from "./ModalOrador"; // Modal de detalhes do orador
import { Users, Plus, Search } from "lucide-react";

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
      <div className="fixed top-0 left-0 right-0 bg-gradient-to-r from-purple-50 to-blue-50 p-4 shadow-md z-10 max-w-7xl mx-auto flex justify-between items-center">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-purple-100 rounded-lg">
            <Users className="w-6 h-6 text-purple-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-800">Oradores</h1>
        </div>
      </div>
      {/* Espaço para compensar header fixo */}
      <div className="h-15" />

      {/* Controles */}
      <div className="p-4 space-y-4">
        {/* Checkbox para mostrar inativos */}
        <div className="flex items-center">
          <label className="flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={showInativos}
              onChange={(e) => setShowInativos(e.target.checked)}
              className="mr-3 w-4 h-4 text-purple-600 bg-gray-100 border-gray-300 rounded focus:ring-purple-500 focus:ring-2"
            />
            <span className="text-sm font-medium text-gray-700">
              Mostrar oradores inativos
            </span>
          </label>
        </div>

        {/* Busca e botão adicionar */}
        <div className="flex gap-3">
          <div className="relative flex-1 max-w-md">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="w-4 h-4 text-gray-400" />
            </div>
            <input
              type="text"
              placeholder="Buscar por nome"
              value={searchNome}
              onChange={(e) => setSearchNome(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-colors"
            />
          </div>
          <button
            onClick={() => openModal(null)}
            className="flex items-center justify-center w-11 h-11 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors shadow-sm"
            title="Adicionar orador"
          >
            <Plus className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Lista scrollável */}
      <div className="flex-1 overflow-y-auto">
        {filteredOradores.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 px-4">
            <Users className="w-12 h-12 text-gray-400 mb-4" />
            <p className="text-gray-500 text-center">
              {searchNome
                ? "Nenhum orador encontrado com este nome."
                : "Nenhum orador cadastrado."}
            </p>
          </div>
        ) : (
          <div className="p-4 space-y-3">
            {filteredOradores.map((orador) => (
              <OradorCard
                key={orador.id}
                orador={orador}
                ultimaData={getUltimaDataLocal(orador.id!)}
                onClick={() => openModal(orador)}
                isAtivo={orador.ativo}
              />
            ))}
          </div>
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
