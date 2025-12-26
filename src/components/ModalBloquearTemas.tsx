import { useState, useEffect, useRef, useMemo } from "react";
import { db, type Tema, type TemaBloqueado } from "../database";
import { dbSaveWithBackup } from "../utils/dbWithBackup";
import { useConfig } from "../contexts/ConfigContext";
import { useGoogleDriveAuth } from "../contexts/GoogleDriveAuthContext";

interface ModalBloquearTemasProps {
  anoServico: number;
  temasBloqueados: TemaBloqueado[];
  onClose: () => void;
  onSave: () => void;
}

function ModalBloquearTemas({
  anoServico,
  temasBloqueados,
  onClose,
  onSave,
}: ModalBloquearTemasProps) {
  const { congregacao } = useConfig();
  const { isSignedIn, uploadBackup } = useGoogleDriveAuth();
  const temasRef = useRef<Tema[]>([]);
  const [buscaTema, setBuscaTema] = useState("");
  const [selecionados, setSelecionados] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(false);
  // Guarda o estado inicial dos bloqueios para comparação
  const [bloqueadosOriginais, setBloqueadosOriginais] = useState<Set<number>>(
    new Set()
  );

  useEffect(() => {
    const loadTemas = async () => {
      const temasData = await db.temas.toArray();
      temasRef.current = temasData;

      // Inicializar selecionados com temas já bloqueados
      const bloqueadosIds = new Set(temasBloqueados.map((tb) => tb.temaId));
      setSelecionados(bloqueadosIds);
      setBloqueadosOriginais(new Set(bloqueadosIds));
    };

    loadTemas();
  }, [temasBloqueados]);
  // Verifica se houve alteração nos bloqueios
  const houveAlteracao = useMemo(() => {
    if (bloqueadosOriginais.size !== selecionados.size) return true;
    for (const id of selecionados) {
      if (!bloqueadosOriginais.has(id)) return true;
    }
    for (const id of bloqueadosOriginais) {
      if (!selecionados.has(id)) return true;
    }
    return false;
  }, [bloqueadosOriginais, selecionados]);

  // Filtrar e ordenar temas baseado na busca (bloqueados primeiro)
  const temasFiltrados = temasRef.current
    .filter(
      (tema) =>
        tema.numero.toString().includes(buscaTema) ||
        tema.titulo.toLowerCase().includes(buscaTema.toLowerCase())
    )
    .sort((a, b) => {
      const aSelecionado = selecionados.has(a.id!);
      const bSelecionado = selecionados.has(b.id!);

      // Bloqueados primeiro
      if (aSelecionado && !bSelecionado) return -1;
      if (!aSelecionado && bSelecionado) return 1;

      // Se ambos têm o mesmo status, ordenar por número
      return a.numero - b.numero;
    });

  const toggleSelecao = (temaId: number) => {
    const novosSelecionados = new Set(selecionados);
    if (novosSelecionados.has(temaId)) {
      novosSelecionados.delete(temaId);
    } else {
      novosSelecionados.add(temaId);
    }
    setSelecionados(novosSelecionados);
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      // Remover bloqueios existentes para este ano
      await db.temasBloqueados.where("ano").equals(anoServico).delete();

      // Adicionar novos bloqueios
      const bloqueiosParaAdicionar = Array.from(selecionados).map((temaId) => ({
        temaId,
        ano: anoServico,
      }));

      // Sempre chama o utilitário para garantir backup, mesmo com array vazio
      await dbSaveWithBackup(
        "temasBloqueados",
        bloqueiosParaAdicionar,
        Boolean(congregacao?.autoBackup),
        isSignedIn,
        uploadBackup
      );

      onSave();
      onClose();
    } catch (error) {
      console.error("Erro ao salvar bloqueios:", error);
      alert("Erro ao salvar bloqueios. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg w-full h-full max-w-none max-h-none overflow-hidden flex flex-col">
        <div className="p-3 border-b border-gray-200">
          <h2 className="text-xl font-bold text-gray-800">
            🚫 Bloquear Esboços - Ano {anoServico}
          </h2>

          <p className="text-gray-600 mt-1">
            <small>
              Período: Setembro {anoServico} - Agosto {anoServico + 1}
            </small>
          </p>
        </div>

        {/* Campo de busca */}
        <div className="p-3 border-b border-gray-200">
          <input
            type="text"
            value={buscaTema}
            onChange={(e) => setBuscaTema(e.target.value)}
            placeholder="Buscar por número ou título do esboço..."
            className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-orange-500 focus:border-transparent"
          />
        </div>

        {/* Lista de temas */}
        <div className="flex-1 overflow-y-auto p-4">
          {temasFiltrados.map((tema) => {
            const isSelecionado = selecionados.has(tema.id!);

            return (
              <div
                key={tema.id}
                onClick={() => toggleSelecao(tema.id!)}
                className={`p-3 rounded-md cursor-pointer transition-colors mb-2 ${
                  isSelecionado
                    ? "bg-red-100 border border-red-300"
                    : "bg-gray-50 hover:bg-gray-100 border border-gray-200"
                }`}
              >
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={isSelecionado}
                    onChange={() => {}} // Controlado pelo onClick do div
                    className="w-4 h-4 text-red-600"
                  />
                  <div className="flex-1">
                    <div
                      className={`font-medium text-left ${
                        isSelecionado ? "text-red-800" : "text-gray-800"
                      }`}
                    >
                      {tema.numero}. {tema.titulo}
                    </div>
                  </div>
                  {isSelecionado && <span className="text-red-500">🚫</span>}
                </div>
              </div>
            );
          })}
        </div>

        <div className="p-6 border-t border-gray-200 bg-gray-50">
          <div className="text-sm text-gray-600 mb-4">
            {selecionados.size} esboço(s) selecionado(s) para bloqueio
          </div>

          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 bg-gray-500 text-white py-2 px-4 rounded-md hover:bg-gray-600 transition-colors"
              disabled={loading}
            >
              Cancelar
            </button>
            <button
              onClick={handleSave}
              className="flex-1 bg-orange-600 text-white py-2 px-4 rounded-md hover:bg-orange-700 transition-colors disabled:opacity-50"
              disabled={loading || !houveAlteracao}
            >
              {loading ? "Salvando..." : "Salvar Bloqueios"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ModalBloquearTemas;
