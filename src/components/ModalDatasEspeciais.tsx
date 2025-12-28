import { useState, useEffect } from "react";
import { db, type DataEspecial, type Orador } from "../database";

import toast from "react-hot-toast";
import { dbSaveWithBackup, dbDeleteWithBackup } from "../utils/dbWithBackup";
import { useConfig } from "../contexts/ConfigContext";
import { useGoogleDriveAuth } from "../contexts/GoogleDriveAuthContext";
import { formatDateBR } from "../utils/dateUtils";
import {
  Calendar,
  Building,
  Globe,
  Monitor,
  Trash2,
  Plus,
  Check,
  Heart,
  Mic,
  Plane,
} from "lucide-react";

interface ModalDatasEspeciaisProps {
  isOpen: boolean;
  onClose: () => void;
  onSave?: () => void;
}

function ModalDatasEspeciais({
  isOpen,
  onClose,
  onSave,
}: ModalDatasEspeciaisProps) {
  const [tipoSelecionado, setTipoSelecionado] = useState<string>("");
  const [dataSelecionada, setDataSelecionada] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [datasEspeciais, setDatasEspeciais] = useState<DataEspecial[]>([]);
  const { congregacao } = useConfig();
  const { isSignedIn, uploadBackup } = useGoogleDriveAuth();
  // Busca de orador para celebração
  const [oradores, setOradores] = useState<Orador[]>([]);
  const [buscaOrador, setBuscaOrador] = useState("");
  const [oradorSelecionado, setOradorSelecionado] = useState<Orador | null>(
    null
  );
  const [showOradorDropdown, setShowOradorDropdown] = useState(false);
  // Carregar oradores ativos e temas ativos ao abrir modal
  useEffect(() => {
    if (
      isOpen &&
      (tipoSelecionado === "celebracao" ||
        tipoSelecionado === "discurso_especial")
    ) {
      db.oradores
        .filter((orador) => orador.ativo)
        .toArray()
        .then(setOradores);
    }
    if (!isOpen) {
      setBuscaOrador("");
      setOradorSelecionado(null);
      setShowOradorDropdown(false);
    }
  }, [isOpen, tipoSelecionado]);
  useEffect(() => {
    if (isOpen) {
      carregarDatasEspeciais();
    }
  }, [isOpen]);

  const carregarDatasEspeciais = async () => {
    try {
      const datas = await db.datasEspeciais.toArray();
      // Filtra para mostrar apenas datas futuras (>= hoje)
      const hoje = new Date();
      hoje.setHours(0, 0, 0, 0);
      const futuras = datas.filter((d) => {
        const data = new Date(d.data);
        data.setHours(0, 0, 0, 0);
        return data >= hoje;
      });
      setDatasEspeciais(futuras);
    } catch (error) {
      console.error("Erro ao carregar datas especiais:", error);
      toast.error("Erro ao carregar datas especiais");
    }
  };

  const getIconTipo = (tipo: string) => {
    switch (tipo) {
      case "assembleia":
        return <Building className="w-5 h-5 text-blue-600" />;
      case "congresso":
        return <Globe className="w-5 h-5 text-green-600" />;
      case "celebracao":
        return <Heart className="w-5 h-5 text-purple-600" />;
      case "discurso_especial":
        return <Mic className="w-5 h-5 text-indigo-600" />;
      case "evento_transmitido":
        return <Monitor className="w-5 h-5 text-orange-600" />;
      case "visita_viajante":
        return <Plane className="w-5 h-5 text-teal-600" />;
      default:
        return <Calendar className="w-5 h-5 text-gray-600" />;
    }
  };

  const [removendoId, setRemovendoId] = useState<number | null>(null);

  const handleRemoverData = async (id: number) => {
    if (confirm("Tem certeza que deseja remover esta data especial?")) {
      setRemovendoId(id);
      try {
        // Buscar a data especial antes de remover
        const dataEspecial = await db.datasEspeciais.get(id);
        await dbDeleteWithBackup(
          "datasEspeciais",
          id,
          congregacao!.autoBackup,
          isSignedIn,
          uploadBackup
        );

        // Se for celebração ou discurso especial, remover discurso correspondente
        if (
          dataEspecial?.tipo === "celebracao" ||
          dataEspecial?.tipo === "discurso_especial"
        ) {
          // Discurso tem data igual e temaId 1
          const discurso = await db.discursos
            .where({ data: dataEspecial.data, temaId: 1 })
            .first();
          if (discurso) {
            await dbDeleteWithBackup(
              "discursos",
              discurso.id!,
              congregacao!.autoBackup,
              isSignedIn,
              uploadBackup
            );
          }
        }

        // Após remover, buscar lista atualizada e disparar backup
        const datasRestantes = await db.datasEspeciais.toArray();
        await dbSaveWithBackup(
          "datasEspeciais",
          datasRestantes,
          congregacao!.autoBackup,
          isSignedIn,
          uploadBackup
        );
        toast.success("Data especial removida!");
        await carregarDatasEspeciais();
        // Notificar a página pai para recarregar os dados
        onSave?.();
      } catch (error) {
        console.error("Erro ao remover data especial:", error);
        toast.error("Erro ao remover data especial");
      } finally {
        setRemovendoId(null);
      }
    }
  };

  if (!isOpen) return null;

  const handleSalvar = async () => {
    if (!tipoSelecionado || !dataSelecionada) {
      toast.error("Selecione o tipo e a data!");
      return;
    }
    if (
      (tipoSelecionado === "celebracao" ||
        tipoSelecionado === "discurso_especial") &&
      !oradorSelecionado
    ) {
      toast.error(
        `Selecione o orador para ${
          tipoSelecionado === "celebracao"
            ? "a celebração"
            : "o discurso especial"
        }!`
      );
      return;
    }
    setLoading(true);
    try {
      const novaDataEspecial: Omit<DataEspecial, "id"> = {
        tipo: tipoSelecionado as
          | "assembleia"
          | "congresso"
          | "celebracao"
          | "discurso_especial"
          | "evento_transmitido"
          | "visita_viajante",
        data: dataSelecionada,
      };
      await dbSaveWithBackup(
        "datasEspeciais",
        novaDataEspecial,
        congregacao!.autoBackup,
        isSignedIn,
        uploadBackup,
        false
      );
      // Se for celebração ou discurso especial, salva também na agenda (discursos) com temaId 1
      if (
        (tipoSelecionado === "celebracao" ||
          tipoSelecionado === "discurso_especial") &&
        oradorSelecionado
      ) {
        await dbSaveWithBackup(
          "discursos",
          {
            data: dataSelecionada,
            oradorId: oradorSelecionado.id!,
            temaId: 1,
            tipo: oradorSelecionado.tipo,
          },
          congregacao!.autoBackup,
          isSignedIn,
          uploadBackup
        );
      }
      // Modal permanece aberto após adicionar
      setTipoSelecionado("");
      setDataSelecionada("");
      setOradorSelecionado(null);
      setBuscaOrador("");
      // Recarregar as datas especiais após adicionar
      await carregarDatasEspeciais();
      onSave?.();
      toast.success("Data especial adicionada com sucesso!");
    } catch (error) {
      console.error("Erro ao salvar data especial:", error);
      toast.error("Erro ao salvar data especial. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

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
                Adicionar Data Especial
              </h2>
            </div>
          </div>
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
          {/* Tipo de data especial */}
          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-2">
              {[
                { value: "assembleia", label: "Assembleia" },
                { value: "congresso", label: "Congresso" },
                { value: "celebracao", label: "Celebração" },
                { value: "discurso_especial", label: "Discurso Especial" },
                { value: "evento_transmitido", label: "Evento Transmitido" },
                { value: "visita_viajante", label: "Visita Viajante" },
              ].map((tipo) => (
                <button
                  key={tipo.value}
                  type="button"
                  onClick={() => setTipoSelecionado(tipo.value)}
                  className={`flex items-center justify-center gap-2 p-2 rounded-lg border-2 transition-all w-full ${
                    tipoSelecionado === tipo.value
                      ? "border-purple-500 bg-purple-50 text-purple-700"
                      : "border-gray-200 bg-white text-gray-700 hover:border-gray-300"
                  }`}
                >
                  {getIconTipo(tipo.value)}
                  <span className="text-sm font-medium">{tipo.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Seleção de data */}
          <div className="space-y-2">
            <input
              type="date"
              value={dataSelecionada}
              onChange={(e) => setDataSelecionada(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-colors"
              required
            />
          </div>

          {/* Se for celebração ou discurso especial, campo de busca de orador e seleção de tema */}
          {(tipoSelecionado === "celebracao" ||
            tipoSelecionado === "discurso_especial") && (
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">
                Orador{" "}
                {tipoSelecionado === "celebracao"
                  ? "da Celebração"
                  : "do Discurso Especial"}
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={buscaOrador}
                  onChange={(e) => {
                    setBuscaOrador(e.target.value);
                    setShowOradorDropdown(true);
                  }}
                  onFocus={() => setShowOradorDropdown(true)}
                  placeholder="Digite o nome do orador..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-colors"
                />
                {showOradorDropdown && buscaOrador && (
                  <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-40 overflow-y-auto">
                    {oradores.filter(
                      (o) =>
                        o.ativo &&
                        o.nome.toLowerCase().includes(buscaOrador.toLowerCase())
                    ).length > 0 ? (
                      oradores
                        .filter(
                          (o) =>
                            o.ativo &&
                            o.nome
                              .toLowerCase()
                              .includes(buscaOrador.toLowerCase())
                        )
                        .map((orador) => (
                          <div
                            key={orador.id}
                            onClick={() => {
                              setOradorSelecionado(orador);
                              setBuscaOrador(orador.nome);
                              setShowOradorDropdown(false);
                            }}
                            className="p-3 hover:bg-gray-50 cursor-pointer border-b border-gray-100 last:border-b-0"
                          >
                            <div className="font-medium">{orador.nome}</div>
                            <div className="text-sm text-gray-500">
                              {orador.congregacao} - {orador.cidade}
                            </div>
                          </div>
                        ))
                    ) : (
                      <div className="p-3 text-gray-500 text-sm">
                        Nenhum orador encontrado
                      </div>
                    )}
                  </div>
                )}
              </div>
              {oradorSelecionado && (
                <div className="mt-2 text-sm text-green-700 flex items-center gap-1">
                  <Check className="w-4 h-4" />
                  Selecionado: {oradorSelecionado.nome}
                </div>
              )}
            </div>
          )}
          {/* Datas especiais existentes */}
          {datasEspeciais.length > 0 && (
            <div className="space-y-2 overflow-y-auto max-h-60">
              <label className="block text-sm font-medium text-gray-700">
                Datas Especiais Definidas
              </label>
              <div className="max-h-80 overflow-y-auto space-y-2">
                {datasEspeciais
                  .sort(
                    (a, b) =>
                      new Date(a.data).getTime() - new Date(b.data).getTime()
                  )
                  .map((dataEspecial) => (
                    <div
                      key={dataEspecial.id}
                      className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div className="flex-shrink-0">
                          {getIconTipo(dataEspecial.tipo)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="font-medium capitalize text-gray-900">
                            {dataEspecial.tipo.replace("_", " ")}
                          </div>
                          <div className="text-sm text-gray-600">
                            {formatDateBR(dataEspecial.data)}
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={() => handleRemoverData(dataEspecial.id!)}
                        className={`p-1.5 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors flex-shrink-0 ${
                          removendoId === dataEspecial.id
                            ? "opacity-60 cursor-not-allowed"
                            : ""
                        }`}
                        title="Remover data especial"
                        disabled={removendoId === dataEspecial.id || loading}
                        aria-label="Remover data especial"
                      >
                        {removendoId === dataEspecial.id ? (
                          <div className="animate-spin inline-block w-4 h-4 border-2 border-red-500 border-t-transparent rounded-full"></div>
                        ) : (
                          <Trash2 className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-1 border-t border-gray-200 flex gap-3">
          {dataSelecionada && tipoSelecionado && (
            <button
              onClick={handleSalvar}
              className="flex-1 bg-purple-600 text-white py-2.5 px-4 rounded-lg hover:bg-purple-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              disabled={loading}
            >
              {loading ? (
                <>
                  <div className="animate-spin inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full"></div>
                  Salvando...
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4" />
                  Adicionar
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default ModalDatasEspeciais;
