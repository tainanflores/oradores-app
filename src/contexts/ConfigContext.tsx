import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { db, type Configuracao } from "../database";
import { dbSaveWithBackup } from "../utils/dbWithBackup";
import toast from "react-hot-toast";

interface ConfigContextType {
  congregacao: Configuracao | null;
  setCongregacao: (c: Configuracao) => void;
  configLoading: boolean;
  showConfigModal: boolean;
  setShowConfigModal: (show: boolean) => void;
  saveCongregacao: (c: Configuracao) => Promise<void>;
}

const ConfigContext = createContext<ConfigContextType | undefined>(undefined);

export function ConfigProvider({ children }: { children: ReactNode }) {
  const [congregacao, setCongregacao] = useState<Configuracao | null>(null);
  const [configLoading, setConfigLoading] = useState(true);
  const [showConfigModal, setShowConfigModal] = useState(false);

  useEffect(() => {
    async function checkConfig() {
      setConfigLoading(true);
      const config = await db.configuracoes.get(1);
      if (
        !config ||
        !config.nomeCongregacao ||
        !config.diaReuniao ||
        !config.horarioReuniao
      ) {
        setShowConfigModal(true);
        setCongregacao(
          config || {
            id: 1,
            nomeCongregacao: "",
            diaReuniao: "",
            horarioReuniao: "",
            endereco: "",
            telefone: "",
            email: "",
            cidade: "",
            autoBackup: false,
          }
        );
      } else {
        setShowConfigModal(false);
        setCongregacao(config);
      }
      setConfigLoading(false);
    }
    checkConfig();
  }, []);

  async function saveCongregacao(c: Configuracao) {
    if (!c.nomeCongregacao || !c.diaReuniao || !c.horarioReuniao || !c.cidade) {
      toast.error("Preencha todos os campos obrigatórios!");
      return;
    }
    await dbSaveWithBackup(
      "configuracoes",
      c,
      c.autoBackup,
      // Aqui você pode obter isSignedIn e uploadBackup do contexto GoogleDriveAuth
      false, // ajuste para pegar do contexto
      async () => "" // ajuste para pegar do contexto
    );
    setCongregacao(c);
    setShowConfigModal(false);
    toast.success("Configuração salva com sucesso!");
  }

  return (
    <ConfigContext.Provider
      value={{
        congregacao,
        setCongregacao,
        configLoading,
        showConfigModal,
        setShowConfigModal,
        saveCongregacao,
      }}
    >
      {children}
    </ConfigContext.Provider>
  );
}

export function useConfig() {
  const ctx = useContext(ConfigContext);
  if (!ctx)
    throw new Error("useConfig deve ser usado dentro do ConfigProvider");
  return ctx;
}
