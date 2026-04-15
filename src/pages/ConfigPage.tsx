import { useState, useEffect } from "react";
import toast from "react-hot-toast";
import { db, type Configuracao } from "../database";
import {
  downloadBackup,
  carregarArquivoBackup,
  restaurarBackup,
} from "../utils/backup";
import { useGoogleDriveAuth } from "../contexts/GoogleDriveAuthContext";
import { useConfig } from "../contexts/ConfigContext";
import {
  listBackupsFromDrive,
  downloadBackupFromDrive,
} from "../utils/googleDrive";
import { dbSaveWithBackup } from "../utils/dbWithBackup";
import ModalVincularWhatsapp from "../components/ModalVincularWhatsapp";
import ModalEditarTemplateWhatsapp from "../components/ModalEditarTemplateWhatsapp";
import {
  deleteInstancia,
  verificarStatusComTimeout,
} from "../utils/whatsappEvolutionApi";
import {
  Settings,
  Building,
  HardDrive,
  Cloud,
  Save,
  X,
  Upload,
  Download,
  LogOut,
  Link,
  CheckCircle,
  XCircle,
  MessageCircle,
  Code,
} from "lucide-react";
import { TEMPLATE_PADRAO } from "../utils/whatsappTemplate";

function ConfigPage() {
  const [showCongregacaoModal, setShowCongregacaoModal] = useState(false);
  const [showWhatsappModal, setShowWhatsappModal] = useState(false);
  const [showEditarTemplateModal, setShowEditarTemplateModal] = useState(false);
  const [whatsappStatus, setWhatsappStatus] = useState<
    "desconectado" | "conectado" | "aguardando_conexao"
  >("desconectado");
  const [whatsappNumero, setWhatsappNumero] = useState("");
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
    templateMensagemWhatsapp: TEMPLATE_PADRAO,
  });
  // Google Drive Auth Context
  const {
    isSignedIn,
    loading: googleDriveLoading,
    signIn: handleGoogleSignIn,
    signOut: handleGoogleSignOut,
    uploadBackup,
    attemptSilentSignIn,
  } = useGoogleDriveAuth();
  // Config Context - Para atualizar o contexto global
  const { setCongregacao: setContextCongregacao } = useConfig();

  useEffect(() => {
    carregarConfiguracoes();
    carregarStatusWhatsapp();
    // Remover qualquer lógica que abra o modal de congregação automaticamente aqui
    // O modal só deve ser aberto por ação do usuário
  }, []);

  // Backup automático no Google Drive
  useEffect(() => {
    if (autoBackup && isSignedIn) {
      const interval = setInterval(
        async () => {
          try {
            const backupData = await import("../utils/backup").then((m) =>
              m.exportarDados(),
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
        },
        24 * 60 * 60 * 1000,
      ); // 24 horas
      return () => clearInterval(interval);
    }
  }, [autoBackup, isSignedIn, uploadBackup]);

  const carregarStatusWhatsapp = async () => {
    try {
      const instancia = await db.whatsappInstancias.get(1);
      if (instancia) {
        // Verificar status real na Evolution API com timeout
        try {
          const estadoReal = await verificarStatusComTimeout(
            instancia.numero,
            10000, // timeout de 10 segundos
          );

          // Mapear estado da Evolution para nosso status
          let novoStatus: "desconectado" | "conectado" | "aguardando_conexao" =
            "desconectado";
          if (estadoReal === "open") {
            novoStatus = "conectado";
          } else if (estadoReal === "connecting") {
            novoStatus = "aguardando_conexao";
          }

          // Atualizar BD com status real
          await db.whatsappInstancias
            .where("numero")
            .equals(instancia.numero)
            .modify({
              status: novoStatus,
            });

          setWhatsappStatus(novoStatus);
          setWhatsappNumero(instancia.numero);
        } catch (err) {
          // Se falhar ao verificar na API, considerar como desconectado
          console.error("Erro ao verificar status na Evolution:", err);
          await db.whatsappInstancias
            .where("numero")
            .equals(instancia.numero)
            .modify({
              status: "desconectado",
            });
          setWhatsappStatus("desconectado");
          setWhatsappNumero(instancia.numero);
        }
      } else {
        setWhatsappStatus("desconectado");
        setWhatsappNumero("");
      }
    } catch (error) {
      console.error("Erro ao carregar status WhatsApp:", error);
      setWhatsappStatus("desconectado");
      setWhatsappNumero("");
    }
  };

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
          templateMensagemWhatsapp: TEMPLATE_PADRAO,
        };
        await dbSaveWithBackup(
          "configuracoes",
          configPadrao,
          false,
          isSignedIn,
          uploadBackup,
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
        error instanceof Error ? error.message : "Erro ao fazer backup",
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
        error instanceof Error ? error.message : "Erro ao importar backup",
      );
    } finally {
      setImportLoading(false);
      // Limpar o input file
      event.target.value = "";
    }
  };

  // Backup manual no Drive usando o contexto de autenticação do Google Drive
  const handleBackupToDrive = async () => {
    if (!isSignedIn) {
      toast.error("Conecte-se ao Google Drive para fazer backup.");
      return;
    }
    try {
      const backupData = await import("../utils/backup").then((m) =>
        m.exportarDados(),
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
          : "Erro ao fazer backup no Google Drive",
      );
    }
  };

  const handleDesconectarWhatsapp = async () => {
    if (!window.confirm("Deseja desconectar o WhatsApp?")) return;

    try {
      await deleteInstancia(whatsappNumero);
      setWhatsappStatus("desconectado");
      setWhatsappNumero("");
      toast.success("WhatsApp desconectado com sucesso!");
    } catch (error) {
      console.error("Erro ao desconectar WhatsApp:", error);
      toast.error("Erro ao desconectar WhatsApp");
    }
  };

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
      await dbSaveWithBackup(
        "configuracoes",
        configParaSalvar,
        autoBackup,
        isSignedIn,
        uploadBackup,
      );
      toast.success("Configurações da congregação salvas com sucesso!");
      setShowCongregacaoModal(false);
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
      let loginSuccess = isSignedIn; // Flag para rastrear se o login foi bem-sucedido

      if (!isSignedIn) {
        if (
          window.confirm(
            "Para ativar o backup automático, é necessário conectar com sua conta do Google Drive. Deseja conectar agora?",
          )
        ) {
          // ✅ NOVO: Tentar login silencioso PRIMEIRO
          toast.loading("Tentando conexão silenciosa...");
          const silentLoginSuccess = await attemptSilentSignIn();
          toast.dismiss();

          if (!silentLoginSuccess) {
            // Se silent sign-in falhar, abrir login manual
            toast.loading("Abrindo login do Google Drive...");
            try {
              await handleGoogleSignIn();
              loginSuccess = true;
            } catch (error) {
              console.error("Erro ao fazer login:", error);
              loginSuccess = false;
            }
            toast.dismiss();
          } else {
            toast.success("Conectado ao Google Drive!");
            loginSuccess = true;
          }

          if (!loginSuccess) {
            toast.error("Conexão com o Google Drive não realizada.");
            return;
          }
        } else {
          return;
        }
      }

      if (
        window.confirm(
          "O backup automático irá salvar uma cópia dos dados no Google Drive toda vez que você salvar alguma alteração. Deseja ativar?",
        )
      ) {
        setAutoBackup(true);
        try {
          await dbSaveWithBackup(
            "configuracoes",
            { ...congregacao, autoBackup: true },
            false, // Não fazer backup automático aqui para evitar loop
            loginSuccess || isSignedIn,
            uploadBackup,
            false, // Não mostrar toast pois já vamos mostrar um customizado
          );
          // Garante que o valor salvo é booleano
          const configAtualizada = await db.configuracoes.get(1);
          if (configAtualizada) {
            const autoBackupBool = configAtualizada.autoBackup === true;
            setCongregacao({ ...configAtualizada, autoBackup: autoBackupBool });
            setContextCongregacao({
              ...configAtualizada,
              autoBackup: autoBackupBool,
            });
          }
          toast.success("Backup automático ativado!");
        } catch (error) {
          console.error("Erro ao ativar backup automático:", error);
          toast.error("Erro ao ativar backup automático. Tente novamente.");
          setAutoBackup(false);
        }
      }
    } else {
      // Vai desativar
      if (
        window.confirm(
          "Deseja realmente desativar o backup automático no Google Drive?",
        )
      ) {
        setAutoBackup(false);
        try {
          await dbSaveWithBackup(
            "configuracoes",
            { ...congregacao, autoBackup: false },
            false, // Não fazer backup automático aqui
            isSignedIn,
            uploadBackup,
            false, // Não mostrar toast pois já vamos mostrar um customizado
          );
          // Garante que o valor salvo é booleano
          const configAtualizada = await db.configuracoes.get(1);
          if (configAtualizada) {
            setCongregacao({ ...configAtualizada, autoBackup: false });
            setContextCongregacao({ ...configAtualizada, autoBackup: false });
          }
          toast.success("Backup automático desativado.");
        } catch (error) {
          console.error("Erro ao desativar backup automático:", error);
          toast.error("Erro ao desativar backup automático. Tente novamente.");
          setAutoBackup(true);
        }
      }
    }
  };

  // Novo: handler para signOut com aviso se autoBackup estiver ativo
  const handleGoogleSignOutWithWarning = async () => {
    if (
      !window.confirm(
        "Tem certeza que deseja desconectar do Google Drive? Isso irá desativar o backup automático, se estiver ativo.",
      )
    ) {
      return;
    }
    if (autoBackup) {
      setAutoBackup(false);
      await dbSaveWithBackup(
        "configuracoes",
        { ...congregacao, autoBackup: false },
        false, // Não fazer backup automático aqui
        isSignedIn,
        uploadBackup,
        false, // Não mostrar toast pois já vamos mostrar um customizado
      );
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
            file.createdTime,
          ).toLocaleString()}?`,
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
    <div className="p-4 max-w-7xl mx-auto">
      {/* header fixo */}
      <div className="fixed top-0 left-0 right-0 bg-gradient-to-r from-purple-50 to-blue-50 p-4 shadow-md z-10 max-w-7xl mx-auto flex justify-between items-center">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-purple-100 rounded-lg">
            <Settings className="w-6 h-6 text-purple-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-800">Configurações</h1>
        </div>
      </div>
      {/* Espaço para compensar header fixo (aprox. altura do header) */}
      <div className="h-15" />

      <div className="space-y-6">
        {/* Configurações da Congregação */}
        <section className="bg-white p-6 rounded-lg shadow border border-gray-200">
          <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
            <Building className="w-5 h-5 text-purple-600" />
            Congregação
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div className="bg-gray-50 p-3 rounded-lg">
              <p className="text-gray-900 font-medium">
                {congregacao.nomeCongregacao} - {congregacao.cidade}
              </p>
            </div>
            <div className="bg-gray-50 p-3 rounded-lg">
              <p className="text-gray-900 font-medium capitalize">
                {congregacao.diaReuniao} - {congregacao.horarioReuniao}
              </p>
            </div>
          </div>
          <button
            onClick={() => setShowCongregacaoModal(true)}
            className="w-full md:w-auto bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition-colors flex items-center gap-2"
          >
            <Settings className="w-4 h-4" />
            Editar Configurações
          </button>
        </section>

        {/* Backup e Sincronização */}
        <section className="bg-white p-6 rounded-lg shadow border border-gray-200">
          <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
            <HardDrive className="w-5 h-5 text-purple-600" />
            Backup & Sincronização
          </h3>
          <div className="flex flex-col md:flex-row md:items-start gap-6">
            <div className="flex-1">
              <p className="text-sm text-gray-600 mb-3 font-medium">
                Backup Local
              </p>
              <div className="flex flex-wrap justify-center gap-3">
                <button
                  onClick={handleBackup}
                  disabled={backupLoading}
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  <Download className="w-4 h-4" />
                  {backupLoading ? "Backup..." : "Backup"}
                </button>
                <label className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors cursor-pointer flex items-center gap-2">
                  <Upload className="w-4 h-4" />
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
            <div className="flex-1 border-gray-200">
              <p className="text-sm text-gray-600 mb-3 font-medium flex items-center gap-2">
                <Cloud className="w-4 h-4" />
                Google Drive
              </p>
              <div className="flex flex-col gap-3">
                {isSignedIn && (
                  <div className="flex flex-col gap-2">
                    <button
                      onClick={handleBackupToDrive}
                      disabled={googleDriveLoading}
                      className="w-full bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      <HardDrive className="w-4 h-4" />
                      {googleDriveLoading ? "Enviando..." : "Backup no Drive"}
                    </button>
                    <button
                      onClick={handleRestoreFromDrive}
                      disabled={googleDriveLoading}
                      className="w-full bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      <Download className="w-4 h-4" />
                      {googleDriveLoading
                        ? "Restaurando..."
                        : "Restaurar do Drive"}
                    </button>
                  </div>
                )}
                {isSignedIn && (
                  <button
                    onClick={handleGoogleSignOutWithWarning}
                    disabled={googleDriveLoading}
                    className="w-full bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    <LogOut className="w-4 h-4" />
                    {googleDriveLoading ? "Saindo..." : "Desconectar"}
                  </button>
                )}
                {!isSignedIn && (
                  <button
                    onClick={handleGoogleSignIn}
                    disabled={googleDriveLoading}
                    className="w-full bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    <Link className="w-4 h-4" />
                    {googleDriveLoading ? "Conectando..." : "Conectar"}
                  </button>
                )}
                <div className="flex items-center gap-2 text-sm">
                  {isSignedIn ? (
                    <>
                      <CheckCircle className="w-4 h-4 text-green-500" />
                      <span className="text-green-700">
                        Conectado ao Google Drive
                      </span>
                    </>
                  ) : (
                    <>
                      <XCircle className="w-4 h-4 text-red-500" />
                      <span className="text-red-700">
                        Não conectado ao Google Drive
                      </span>
                    </>
                  )}
                </div>
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div>
                    <p className="font-medium text-gray-900">
                      Backup Automático
                    </p>
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
          </div>
        </section>

        {/* WhatsApp */}
        <section
          id="whatsapp-config"
          className="bg-white p-6 rounded-lg shadow border border-gray-200"
        >
          <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
            <MessageCircle className="w-5 h-5 text-green-600" />
            WhatsApp
          </h3>
          <p className="text-gray-600 text-sm mb-4">
            Conecte seu números WhatsApp para enviar mensagens pelo aplicativo.
          </p>

          {/* Status WhatsApp */}
          <div className="mb-4 p-3 rounded-lg bg-gray-50 border border-gray-200">
            {whatsappStatus === "conectado" ? (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></span>
                  <div>
                    <p className="text-sm font-medium text-green-700">
                      ✓ Conectado
                    </p>
                    <p className="text-xs text-gray-600">{whatsappNumero}</p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 bg-gray-400 rounded-full"></span>
                <p className="text-sm font-medium text-gray-600">
                  ✗ Desconectado
                </p>
              </div>
            )}
          </div>

          {/* Botões de Ação */}
          <div className="flex gap-2">
            {whatsappStatus === "conectado" ? (
              <>
                <button
                  onClick={() => setShowEditarTemplateModal(true)}
                  className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
                >
                  <Code className="w-4 h-4" />
                  Editar Mensagem
                </button>
                <button
                  onClick={handleDesconectarWhatsapp}
                  className="flex-1 bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors flex items-center justify-center gap-2"
                >
                  <MessageCircle className="w-4 h-4" />
                  Desconectar
                </button>
              </>
            ) : (
              <button
                onClick={() => setShowWhatsappModal(true)}
                className="flex-1 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors flex items-center justify-center gap-2"
              >
                <MessageCircle className="w-4 h-4" />
                Vincular WhatsApp
              </button>
            )}
          </div>
        </section>
      </div>

      {/* Modal Vincular WhatsApp */}
      <ModalVincularWhatsapp
        open={showWhatsappModal}
        onClose={() => setShowWhatsappModal(false)}
        onSuccess={() => {
          toast.success("WhatsApp conectado com sucesso!");
          carregarStatusWhatsapp();
        }}
      />

      {/* Modal Editar Template de Mensagem */}
      <ModalEditarTemplateWhatsapp
        isOpen={showEditarTemplateModal}
        onClose={() => setShowEditarTemplateModal(false)}
        congregacao={congregacao}
        onSave={(congregacaoAtualizada) => {
          setCongregacao(congregacaoAtualizada);
          // Atualizar também o contexto para refletir nos outros componentes
          setContextCongregacao(congregacaoAtualizada);
        }}
      />

      {/* Modal de Configurações da Congregação */}
      {showCongregacaoModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg w-full max-w-md mx-4 overflow-hidden">
            <div className="bg-gradient-to-r from-purple-500 to-purple-600 text-white p-4 shadow-lg">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Building className="w-6 h-6" />
                  <div>
                    <h2 className="text-xl font-bold">
                      Configurações da Congregação
                    </h2>
                  </div>
                </div>
                <button
                  onClick={() => setShowCongregacaoModal(false)}
                  className="p-2 hover:bg-white/20 rounded-full transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                  <Building className="w-4 h-4" />
                  Nome da Congregação
                </label>
                <div className="relative">
                  <Building className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4 pointer-events-none" />
                  <input
                    type="text"
                    value={congregacao.nomeCongregacao}
                    onChange={(e) =>
                      setCongregacao({
                        ...congregacao,
                        nomeCongregacao: e.target.value,
                      })
                    }
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    placeholder="Digite o nome da congregação"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                  <Settings className="w-4 h-4" />
                  Dia da Reunião
                </label>
                <div className="relative">
                  <Settings className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4 pointer-events-none" />
                  <select
                    value={congregacao.diaReuniao}
                    onChange={(e) =>
                      setCongregacao({
                        ...congregacao,
                        diaReuniao: e.target.value,
                      })
                    }
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent appearance-none"
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
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                  <Settings className="w-4 h-4" />
                  Horário da Reunião
                </label>
                <div className="relative">
                  <Settings className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4 pointer-events-none" />
                  <input
                    type="time"
                    value={congregacao.horarioReuniao}
                    onChange={(e) =>
                      setCongregacao({
                        ...congregacao,
                        horarioReuniao: e.target.value,
                      })
                    }
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                  <Building className="w-4 h-4" />
                  Cidade - Estado
                </label>
                <div className="relative">
                  <Building className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4 pointer-events-none" />
                  <input
                    type="text"
                    value={congregacao.cidade}
                    onChange={(e) =>
                      setCongregacao({ ...congregacao, cidade: e.target.value })
                    }
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    placeholder="Digite a cidade"
                  />
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-gray-200 bg-gray-50">
              <div className="flex gap-3">
                <button
                  onClick={handleSaveCongregacao}
                  className={`flex-1 py-3 px-4 rounded-lg font-medium flex items-center justify-center gap-2 transition-colors ${
                    isSavingCongregacao
                      ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                      : "bg-purple-600 text-white hover:bg-purple-700"
                  }`}
                  disabled={isSavingCongregacao}
                >
                  {isSavingCongregacao ? (
                    <>
                      <div className="w-4 h-4 border-2 border-gray-500 border-t-transparent rounded-full animate-spin" />
                      Salvando...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      Salvar
                    </>
                  )}
                </button>
                <button
                  onClick={() => setShowCongregacaoModal(false)}
                  className="flex-1 bg-gray-500 text-white py-3 px-4 rounded-lg hover:bg-gray-600 transition-colors font-medium flex items-center justify-center gap-2"
                >
                  <X className="w-4 h-4" />
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ConfigPage;
