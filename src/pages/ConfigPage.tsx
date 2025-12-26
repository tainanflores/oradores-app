import { useState, useEffect } from "react";
import toast from "react-hot-toast";
import { db, type Configuracao } from "../database";
import {
  downloadBackup,
  carregarArquivoBackup,
  restaurarBackup,
} from "../utils/backup";
import { useGoogleDriveAuth } from "../contexts/GoogleDriveAuthContext";
import {
  listBackupsFromDrive,
  downloadBackupFromDrive,
} from "../utils/googleDrive";
import { dbSaveWithBackup } from "../utils/dbWithBackup";

function ConfigPage() {
  const [showCongregacaoModal, setShowCongregacaoModal] = useState(false);
  const [autoBackup, setAutoBackup] = useState(false);
  const [backupLoading, setBackupLoading] = useState(false);
  const [importLoading, setImportLoading] = useState(false);
  const [isSavingCongregacao, setIsSavingCongregacao] = useState(false);
  const [congregacao, setCongregacao] = useState<Configuracao>({
    id: 1,
    nomeCongregacao: "",
    diaReuniao: "",
    horarioReuniao: "",
    endereco: "",
    telefone: "",
    email: "",
    cidade: "",
    autoBackup: false,
  });
  // Google Drive Auth Context
  const {
    isSignedIn,
    loading: googleDriveLoading,
    signIn: handleGoogleSignIn,
    signOut: handleGoogleSignOut,
    uploadBackup,
  } = useGoogleDriveAuth();

  useEffect(() => {
    carregarConfiguracoes();
    // Remover qualquer lógica que abra o modal de congregação automaticamente aqui
    // O modal só deve ser aberto por ação do usuário
  }, []);

  // Backup automático no Google Drive
  useEffect(() => {
    if (autoBackup && isSignedIn) {
      const interval = setInterval(async () => {
        try {
          const backupData = await import("../utils/backup").then((m) =>
            m.exportarDados()
          );
          const timestamp = new Date()
            .toISOString()
            .slice(0, 19)
            .replace(/:/g, "-");
          const fileName = `backup-auto-oradores-${timestamp}.json`;
          await uploadBackup(JSON.stringify(backupData), fileName);
          console.log("Backup automático realizado no Google Drive");
        } catch (error) {
          console.error("Erro no backup automático:", error);
        }
      }, 24 * 60 * 60 * 1000); // 24 horas
      return () => clearInterval(interval);
    }
  }, [autoBackup, isSignedIn, uploadBackup]);

  const carregarConfiguracoes = async () => {
    try {
      const config = await db.configuracoes.get(1);
      if (config) {
        // Normaliza autoBackup para booleano
        const autoBackupBool = config.autoBackup === true;
        setCongregacao({ ...config, autoBackup: autoBackupBool });
        setAutoBackup(autoBackupBool);
      } else {
        const configPadrao: Configuracao = {
          id: 1,
          nomeCongregacao: "Congregação Local",
          diaReuniao: "domingo",
          horarioReuniao: "10:00",
          endereco: "",
          telefone: "",
          email: "",
          cidade: "",
          autoBackup: false,
        };
        await dbSaveWithBackup(
          "configuracoes",
          configPadrao,
          false,
          isSignedIn,
          uploadBackup
        );
        setCongregacao(configPadrao);
        setAutoBackup(false);
      }
    } catch (error) {
      console.error("Erro ao carregar configurações:", error);
      toast.error("Erro ao carregar configurações");
    }
  };

  const handleBackup = async () => {
    try {
      setBackupLoading(true);
      await downloadBackup();
      toast.success("Backup realizado com sucesso!");
    } catch (error) {
      console.error("Erro ao fazer backup:", error);
      toast.error(
        error instanceof Error ? error.message : "Erro ao fazer backup"
      );
    } finally {
      setBackupLoading(false);
    }
  };

  const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      setImportLoading(true);
      const backupData = await carregarArquivoBackup(file);
      await restaurarBackup(backupData);
      toast.success("Backup restaurado com sucesso!");

      // Recarregar configurações após importação
      await carregarConfiguracoes();
    } catch (error) {
      console.error("Erro ao importar backup:", error);
      toast.error(
        error instanceof Error ? error.message : "Erro ao importar backup"
      );
    } finally {
      setImportLoading(false);
      // Limpar o input file
      event.target.value = "";
    }
  };

  const handleSync = () => {
    toast("Funcionalidade de sincronização será implementada em breve");
  };

  // Backup manual no Drive
  const handleBackupToDrive = async () => {
    try {
      const backupData = await import("../utils/backup").then((m) =>
        m.exportarDados()
      );
      const timestamp = new Date()
        .toISOString()
        .slice(0, 19)
        .replace(/:/g, "-");
      const fileName = `backup-oradores-${timestamp}.json`;
      await uploadBackup(JSON.stringify(backupData), fileName);
      toast.success("Backup enviado para o Google Drive!");
    } catch (error) {
      console.error("Erro ao fazer backup no Google Drive:", error);
      toast.error(
        error instanceof Error
          ? error.message
          : "Erro ao fazer backup no Google Drive"
      );
    }
  };

  // Ajuste em handleSaveCongregacao para não fechar o modal se faltar campos obrigatórios
  const handleSaveCongregacao = async () => {
    if (
      !congregacao.nomeCongregacao ||
      !congregacao.diaReuniao ||
      !congregacao.horarioReuniao ||
      !congregacao.cidade
    ) {
      toast.error("Preencha todos os campos obrigatórios!");
      return;
    }
    setIsSavingCongregacao(true);
    try {
      const configParaSalvar: Configuracao = {
        ...congregacao,
        autoBackup: autoBackup === true,
      };
      await db.configuracoes.put(configParaSalvar);
      toast.success("Configurações da congregação salvas com sucesso!");
      setShowCongregacaoModal(false);
      // TESTE DE BACKUP APÓS SALVAR
      if (autoBackup === true && isSignedIn) {
        try {
          const backupData = await import("../utils/backup").then((m) =>
            m.exportarDados()
          );
          const timestamp = new Date()
            .toISOString()
            .slice(0, 19)
            .replace(/:/g, "-");
          const fileName = `backup-auto-oradores-${timestamp}.json`;
          await uploadBackup(JSON.stringify(backupData), fileName);
          toast.success("Backup automático realizado após salvar!");
        } catch (err) {
          toast.error("Erro ao fazer backup automático após salvar");
        }
      }
    } catch (error) {
      console.error("Erro ao salvar configurações:", error);
      toast.error("Erro ao salvar configurações");
    } finally {
      setIsSavingCongregacao(false);
    }
  };

  // NOVO: handler para ativar/desativar backup automático com confirmação
  const handleToggleAutoBackup = async () => {
    if (!autoBackup) {
      // Vai ativar
      if (!isSignedIn) {
        if (
          window.confirm(
            "Para ativar o backup automático, é necessário conectar com sua conta do Google Drive. Deseja conectar agora?"
          )
        ) {
          await handleGoogleSignIn();
          if (!isSignedIn) {
            toast.error("Conexão com o Google Drive não realizada.");
            return;
          }
        } else {
          return;
        }
      }
      if (
        window.confirm(
          "O backup automático irá salvar uma cópia dos dados no Google Drive toda vez que você salvar alguma alteração. Deseja ativar?"
        )
      ) {
        setAutoBackup(true);
        await db.configuracoes.put({ ...congregacao, autoBackup: true });
        // Garante que o valor salvo é booleano
        const configAtualizada = await db.configuracoes.get(1);
        if (configAtualizada) {
          const autoBackupBool = configAtualizada.autoBackup === true;
          setCongregacao({ ...configAtualizada, autoBackup: autoBackupBool });
        }
        toast.success("Backup automático ativado!");
      }
    } else {
      // Vai desativar
      if (
        window.confirm(
          "Deseja realmente desativar o backup automático no Google Drive?"
        )
      ) {
        setAutoBackup(false);
        await db.configuracoes.put({ ...congregacao, autoBackup: false });
        // Garante que o valor salvo é booleano
        const configAtualizada = await db.configuracoes.get(1);
        if (configAtualizada) {
          setCongregacao({ ...configAtualizada, autoBackup: false });
        }
        toast.success("Backup automático desativado.");
      }
    }
  };

  // Novo: handler para signOut com aviso se autoBackup estiver ativo
  const handleGoogleSignOutWithWarning = async () => {
    if (
      !window.confirm(
        "Tem certeza que deseja desconectar do Google Drive? Isso irá desativar o backup automático, se estiver ativo."
      )
    ) {
      return;
    }
    if (autoBackup) {
      setAutoBackup(false);
      await db.configuracoes.put({ ...congregacao, autoBackup: false });
      toast("Backup automático desativado.");
    }
    handleGoogleSignOut();
  };

  // Atualiza o handler de restauração do Drive
  const handleRestoreFromDrive = async () => {
    try {
      const files = await listBackupsFromDrive();
      if (!files.length) {
        toast.error("Nenhum backup encontrado no Google Drive.");
        return;
      }
      // Pega o mais recente
      const file = files[0];
      if (
        !window.confirm(
          `Restaurar backup "${file.name}" de ${new Date(
            file.createdTime
          ).toLocaleString()}?`
        )
      )
        return;
      const backupData = await downloadBackupFromDrive(file.id);
      // Importa e restaura
      await restaurarBackup(backupData);
      toast.success("Backup restaurado do Google Drive!");
      // Recarrega configurações após restauração
      await carregarConfiguracoes();
    } catch (error) {
      toast.error("Erro ao restaurar backup do Google Drive");
      console.error(error);
    }
  };

  // UI principal
  return (
    <div className="p-2 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-4 p-2 text-gray-800 flex items-center gap-2">
        <span role="img" aria-label="Configurações">
          ⚙️
        </span>{" "}
        Configurações
      </h1>
      <div className="space-y-1">
        {/* Configurações da Congregação */}
        <section className="bg-white p-3 rounded-xl shadow flex flex-col gap-2 border border-gray-100">
          <h3 className="font-semibold text-lg flex items-center gap-2">
            <span role="img" aria-label="Congregação">
              🏛️
            </span>{" "}
            Congregação
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-1">
            <div>
              <p className="text-gray-900">
                {congregacao.nomeCongregacao} - {congregacao.cidade}
              </p>
            </div>

            <div>
              <p className="text-gray-900 capitalize">
                {congregacao.diaReuniao} - {congregacao.horarioReuniao}
              </p>
            </div>
          </div>
          <button
            onClick={() => setShowCongregacaoModal(true)}
            className="w-full md:w-auto bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition-colors self-end"
          >
            Editar Configurações
          </button>
        </section>

        {/* Backup e Sincronização */}
        <section className="bg-white p-3 rounded-xl shadow flex flex-col gap-2 border border-gray-100">
          <h3 className="font-semibold text-lg flex items-center gap-2 mb-2">
            <span role="img" aria-label="Backup">
              💾
            </span>{" "}
            Backup & Sincronização
          </h3>
          <div className="flex flex-col md:flex-row md:items-center gap-4">
            <div className="flex-1 flex flex-col gap-2">
              <p className="text-sm text-gray-600">Backup Local</p>
              <div className="flex flex-wrap justify-center gap-2">
                <button
                  onClick={handleBackup}
                  disabled={backupLoading}
                  className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {backupLoading ? "Backup..." : "Backup"}
                </button>
                <label className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 transition-colors cursor-pointer">
                  {importLoading ? "Importando..." : "Restaurar"}
                  <input
                    type="file"
                    accept=".json"
                    onChange={handleImport}
                    disabled={importLoading}
                    className="hidden"
                  />
                </label>
              </div>
            </div>
            <div className="flex-1 flex flex-col gap-2 border-gray-200">
              <p className="text-sm text-gray-600 ">Google Drive</p>
              <div className="flex gap-2 flex-wrap w-full">
                {isSignedIn && (
                  <div className="flex flex-row gap-2 w-full">
                    <button
                      onClick={handleBackupToDrive}
                      disabled={googleDriveLoading}
                      className="flex-1 whitespace-normal bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {googleDriveLoading
                        ? "Enviando..."
                        : "💾 Backup no Drive"}
                    </button>
                    <button
                      onClick={handleRestoreFromDrive}
                      disabled={googleDriveLoading}
                      className="flex-1 whitespace-normal bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {googleDriveLoading
                        ? "Restaurando..."
                        : "⭮ Restaurar do Drive"}
                    </button>
                  </div>
                )}
              </div>
              {isSignedIn && (
                <button
                  onClick={handleGoogleSignOutWithWarning}
                  disabled={googleDriveLoading}
                  className="mt-2 bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed w-full md:w-auto"
                >
                  {googleDriveLoading ? "Saindo..." : "🔌 Desconectar"}
                </button>
              )}
              {!isSignedIn && (
                <button
                  onClick={handleGoogleSignIn}
                  disabled={googleDriveLoading}
                  className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {googleDriveLoading ? "Conectando..." : "🔗 Conectar"}
                </button>
              )}
              <p className="text-xs text-gray-500 mt-1">
                {isSignedIn
                  ? "✅ Conectado ao Google Drive"
                  : "❌ Não conectado ao Google Drive"}
              </p>
              <div className="flex items-center justify-between mt-2">
                <div>
                  <p className="font-medium">Backup Automático</p>
                  <p className="text-xs text-gray-500">
                    Salva no Drive a cada alteração
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={autoBackup}
                    onChange={handleToggleAutoBackup}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>
            </div>
          </div>
        </section>
      </div>

      {/* Modal de Configurações da Congregação */}
      {showCongregacaoModal && (
        <div className="fixed inset-0 bg-gradient-to-br from-purple-900 to-indigo-900 bg-opacity-75 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-2xl p-6 w-full max-w-md mx-4 border-4 border-gradient-to-r from-pink-500 to-purple-500 max-h-[80vh] overflow-y-auto">
            <h3 className="text-2xl font-bold mb-4 text-gray-800">
              Configurações da Congregação
            </h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nome da Congregação
                </label>
                <input
                  type="text"
                  value={congregacao.nomeCongregacao}
                  onChange={(e) =>
                    setCongregacao({
                      ...congregacao,
                      nomeCongregacao: e.target.value,
                    })
                  }
                  className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  placeholder="Digite o nome da congregação"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Dia da Reunião
                </label>
                <select
                  value={congregacao.diaReuniao}
                  onChange={(e) =>
                    setCongregacao({
                      ...congregacao,
                      diaReuniao: e.target.value,
                    })
                  }
                  className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                >
                  <option value="domingo">Domingo</option>
                  <option value="segunda">Segunda-feira</option>
                  <option value="terca">Terça-feira</option>
                  <option value="quarta">Quarta-feira</option>
                  <option value="quinta">Quinta-feira</option>
                  <option value="sexta">Sexta-feira</option>
                  <option value="sabado">Sábado</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Horário da Reunião
                </label>
                <input
                  type="time"
                  value={congregacao.horarioReuniao}
                  onChange={(e) =>
                    setCongregacao({
                      ...congregacao,
                      horarioReuniao: e.target.value,
                    })
                  }
                  className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Cidade - Estado
                </label>
                <input
                  type="text"
                  value={congregacao.cidade}
                  onChange={(e) =>
                    setCongregacao({ ...congregacao, cidade: e.target.value })
                  }
                  className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  placeholder="Digite a cidade"
                />
              </div>
            </div>

            <div className="flex flex-col md:flex-row gap-2 mt-6">
              <button
                onClick={handleSaveCongregacao}
                className="flex-1 px-4 py-2 bg-gradient-to-r from-purple-500 to-purple-600 text-white rounded-md hover:from-purple-600 hover:to-purple-700 transition-all transform hover:scale-105 disabled:opacity-50"
                disabled={isSavingCongregacao}
              >
                {isSavingCongregacao ? "Salvando..." : "Salvar"}
              </button>
              <button
                onClick={() => setShowCongregacaoModal(false)}
                className="flex-1 px-4 py-2 bg-gradient-to-r from-gray-500 to-gray-600 text-white rounded-md hover:from-gray-600 hover:to-gray-700 transition-all transform hover:scale-105"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ConfigPage;
