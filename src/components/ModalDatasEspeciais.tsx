import { useState, useEffect } from "react";
import { db, type DataEspecial, type Orador, type Tema } from "../database";

import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import toast from "react-hot-toast";
import { dbSaveWithBackup } from "../utils/dbWithBackup";
import { useConfig } from "../contexts/ConfigContext";
import { useGoogleDriveAuth } from "../contexts/GoogleDriveAuthContext";

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
  const [temaSelecionado, setTemaSelecionado] = useState<Tema | null>(null);
  // Carregar oradores ativos e temas ativos ao abrir modal
  useEffect(() => {
    if (isOpen && tipoSelecionado === "celebracao") {
      db.oradores
        .filter((orador) => orador.ativo)
        .toArray()
        .then(setOradores);
    }
    if (!isOpen) {
      setBuscaOrador("");
      setOradorSelecionado(null);
      setShowOradorDropdown(false);
      setTemaSelecionado(null);
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

  const getEmojiTipo = (tipo: string) => {
    switch (tipo) {
      case "assembleia":
        return "🏛️";
      case "congresso":
        return "🌍";
      case "celebracao":
        return "🎉";
      case "evento_transmitido":
        return "📺";
      default:
        return "📅";
    }
  };

  const formatarData = (dataString: string) => {
    try {
      const data = parseISO(dataString);
      return format(data, "dd/MM/yyyy", { locale: ptBR });
    } catch (error) {
      console.error("Erro ao formatar data:", error);
      return dataString; // Fallback
    }
  };

  const [removendoId, setRemovendoId] = useState<number | null>(null);

  const handleRemoverData = async (id: number) => {
    if (confirm("Tem certeza que deseja remover esta data especial?")) {
      setRemovendoId(id);
      try {
        // Buscar a data especial antes de remover
        const dataEspecial = await db.datasEspeciais.get(id);
        await db.datasEspeciais.delete(id);

        // Se for celebração, remover discurso correspondente
        if (dataEspecial?.tipo === "celebracao") {
          // Discurso tem data igual e temaId 1
          const discurso = await db.discursos
            .where({ data: dataEspecial.data, temaId: 1 })
            .first();
          if (discurso) {
            await db.discursos.delete(discurso.id!);
            // Backup dos discursos após remoção
            const discursosRestantes = await db.discursos.toArray();
            await dbSaveWithBackup(
              "discursos",
              discursosRestantes,
              congregacao!.autoBackup,
              isSignedIn,
              uploadBackup,
              false
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
    if (tipoSelecionado === "celebracao" && !oradorSelecionado) {
      toast.error("Selecione o orador para a celebração!");
      return;
    }
    setLoading(true);
    try {
      const novaDataEspecial: Omit<DataEspecial, "id"> = {
        tipo: tipoSelecionado as
          | "assembleia"
          | "congresso"
          | "celebracao"
          | "evento_transmitido",
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
      // Se for celebração, salva também na agenda (discursos) com temaId 1
      if (tipoSelecionado === "celebracao" && oradorSelecionado) {
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
      onClose();
      setTipoSelecionado("");
      setDataSelecionada("");
      // Recarregar as datas especiais após adicionar
      await carregarDatasEspeciais();
      onSave?.();
    } catch (error) {
      console.error("Erro ao salvar data especial:", error);
      toast.error("Erro ao salvar data especial. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg w-full max-w-md mx-4">
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-gray-800">
              🎯 Adicionar Data Especial
            </h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors text-xl font-bold"
            >
              ✕
            </button>
          </div>
        </div>

        <div className="p-4 space-y-4">
          {/* Tipo de data especial */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Tipo de Data Especial
            </label>
            <select
              value={tipoSelecionado}
              onChange={(e) => setTipoSelecionado(e.target.value)}
              className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            >
              <option value="">Selecione o tipo</option>
              <option value="assembleia">🏛️ Assembleia</option>
              <option value="congresso">🌍 Congresso</option>
              <option value="celebracao">🎉 Celebração</option>
              <option value="evento_transmitido">📺 Evento Transmitido</option>
            </select>
          </div>

          {/* Seleção de data */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Data
            </label>
            <input
              type="date"
              value={dataSelecionada}
              onChange={(e) => setDataSelecionada(e.target.value)}
              className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            />
          </div>

          {/* Se for celebração, campo de busca de orador e seleção de tema */}
          {tipoSelecionado === "celebracao" && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Orador da Celebração
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
                  className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
                {showOradorDropdown && buscaOrador && (
                  <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-40 overflow-y-auto">
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
                            className="p-2 hover:bg-gray-100 cursor-pointer border-b border-gray-100 last:border-b-0"
                          >
                            <div className="font-medium">{orador.nome}</div>
                            <div className="text-sm text-gray-500">
                              {orador.congregacao} - {orador.cidade}
                            </div>
                          </div>
                        ))
                    ) : (
                      <div className="p-2 text-gray-500 text-sm">
                        Nenhum orador encontrado
                      </div>
                    )}
                  </div>
                )}
              </div>
              {oradorSelecionado && (
                <div className="mt-2 text-sm text-green-700">
                  Selecionado: {oradorSelecionado.nome}
                </div>
              )}
            </div>
          )}
          {/* Datas especiais existentes */}
          {datasEspeciais.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Datas Especiais Definidas
              </label>
              <div className="max-h-40 overflow-y-auto space-y-2">
                {datasEspeciais
                  .sort(
                    (a, b) =>
                      new Date(a.data).getTime() - new Date(b.data).getTime()
                  )
                  .map((dataEspecial) => (
                    <div
                      key={dataEspecial.id}
                      className="flex items-center justify-between p-2 bg-gray-50 rounded-md"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-lg">
                          {getEmojiTipo(dataEspecial.tipo)}
                        </span>
                        <div>
                          <div className="font-medium capitalize">
                            {dataEspecial.tipo}
                          </div>
                          <div className="text-sm text-gray-600">
                            {formatarData(dataEspecial.data)}
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={() => handleRemoverData(dataEspecial.id!)}
                        className={`text-red-500 hover:text-red-700 transition-colors flex items-center gap-1 ${
                          removendoId === dataEspecial.id
                            ? "opacity-60 cursor-not-allowed"
                            : ""
                        }`}
                        title="Remover data especial"
                        disabled={removendoId === dataEspecial.id || loading}
                      >
                        {removendoId === dataEspecial.id ? (
                          <span className="animate-spin inline-block w-4 h-4 border-2 border-red-500 border-t-transparent rounded-full"></span>
                        ) : (
                          "🗑️"
                        )}
                      </button>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>

        <div className="p-4 border-t border-gray-200 flex gap-3">
          {dataSelecionada && tipoSelecionado && (
            <button
              onClick={handleSalvar}
              className="flex-1 bg-purple-600 text-white py-2 px-4 rounded-md hover:bg-purple-700 transition-colors disabled:opacity-50"
              disabled={loading}
            >
              {loading ? "Salvando..." : "Adicionar"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default ModalDatasEspeciais;
