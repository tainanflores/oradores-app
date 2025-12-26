import { useState, useEffect, useRef, useMemo } from "react";
import { Ban, Search, X, Save, Loader2 } from "lucide-react";
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
      // Remover bloqueios existentes para este ano (sem backup - operação intermediária)
      await db.temasBloqueados.where("ano").equals(anoServico).delete();

      // Adicionar novos bloqueios com backup
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
        <div className="bg-gradient-to-r from-orange-500 to-red-500 text-white p-4 shadow-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Ban className="w-6 h-6" />
              <div>
                <h2 className="text-xl font-bold">
                  Bloquear Esboços - Ano {anoServico}
                </h2>
                <p className="text-red-100 text-sm">
                  Setembro {anoServico} - Agosto {anoServico + 1}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/20 rounded-full transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Campo de busca */}
        <div className="p-4 border-b border-gray-200 bg-gray-50">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="text"
              value={buscaTema}
              onChange={(e) => setBuscaTema(e.target.value)}
              placeholder="Buscar por número ou título do esboço..."
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
            />
          </div>
        </div>

        {/* Lista de temas */}
        <div className="flex-1 overflow-y-auto p-4">
          {temasFiltrados.map((tema) => {
            const isSelecionado = selecionados.has(tema.id!);

            return (
              <div
                key={tema.id}
                onClick={() => toggleSelecao(tema.id!)}
                className={`p-4 rounded-lg cursor-pointer transition-all duration-200 mb-3 border-2 ${
                  isSelecionado
                    ? "bg-gradient-to-r from-red-50 to-red-100 border-red-300 shadow-md"
                    : "bg-white hover:bg-gray-50 border-gray-200 hover:border-gray-300 hover:shadow-sm"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                      isSelecionado
                        ? "bg-red-500 border-red-500"
                        : "border-gray-300 hover:border-red-400"
                    }`}
                  >
                    {isSelecionado && (
                      <svg
                        className="w-3 h-3 text-white"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path
                          fillRule="evenodd"
                          d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                          clipRule="evenodd"
                        />
                      </svg>
                    )}
                  </div>
                  <div className="flex-1">
                    <div
                      className={`font-medium text-left ${
                        isSelecionado ? "text-red-800" : "text-gray-800"
                      }`}
                    >
                      {tema.numero}. {tema.titulo}
                    </div>
                  </div>
                  {isSelecionado && <Ban className="w-5 h-5 text-red-500" />}
                </div>
              </div>
            );
          })}
        </div>

        <div className="p-6 border-t border-gray-200 bg-gray-50">
          <div className="flex items-center justify-between mb-4">
            <div className="text-sm text-gray-600">
              {selecionados.size} esboço(s) selecionado(s) para bloqueio
            </div>
            {selecionados.size > 0 && <Ban className="w-4 h-4 text-red-500" />}
          </div>

          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 bg-gray-500 text-white py-3 px-4 rounded-lg hover:bg-gray-600 transition-colors font-medium flex items-center justify-center gap-2"
              disabled={loading}
            >
              <X className="w-4 h-4" />
              Cancelar
            </button>
            <button
              onClick={handleSave}
              className={`flex-1 py-3 px-4 rounded-lg font-medium flex items-center justify-center gap-2 transition-colors ${
                houveAlteracao
                  ? "bg-red-600 text-white hover:bg-red-700"
                  : "bg-gray-300 text-gray-500 cursor-not-allowed"
              }`}
              disabled={loading || !houveAlteracao}
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Salvando...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  Salvar Bloqueios
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ModalBloquearTemas;
