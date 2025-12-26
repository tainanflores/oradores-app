import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import { useSyncWithDriveOnStart } from "./hooks/useSyncWithDriveOnStart";
import { useGoogleDriveAuth } from "./contexts/GoogleDriveAuthContext";
import { ConfigProvider, useConfig } from "./contexts/ConfigContext";
import OradoresPage from "./pages/OradoresPage";
import TemasPage from "./pages/TemasPage";
import AgendaPage from "./pages/AgendaPage";
import SaidasPage from "./pages/SaidasPage";
import DatasEspeciaisPage from "./pages/DatasEspeciaisPage";
import ConfigPage from "./pages/ConfigPage";
import BottomNavigation from "./components/navigation/BottomNavigation";
import GoogleDriveStatusBar from "./components/GoogleDriveStatusBar";

import "./App.css";

function AppContent() {
  const { showConfigModal, congregacao, saveCongregacao, setCongregacao } =
    useConfig();
  const { loading: gdriveLoading } = useGoogleDriveAuth();
  const { checking: syncChecking } = useSyncWithDriveOnStart();

  // Aguarda login do GoogleDrive antes de rodar o app
  if (gdriveLoading || syncChecking) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg text-gray-700 animate-pulse">
          Carregando dados e sincronizando...
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Modal global de configuração obrigatória */}
      {showConfigModal && (
        <div className="fixed inset-0 bg-gradient-to-br from-purple-900 to-indigo-900 bg-opacity-75 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-2xl p-6 w-full max-w-md mx-4 border-4 border-gradient-to-r from-pink-500 to-purple-500 max-h-[80vh] overflow-y-auto">
            <h3 className="text-2xl font-bold mb-4 text-gray-800">
              Configuração Inicial
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nome da Congregação *
                </label>
                <input
                  type="text"
                  className="w-full border rounded px-2 py-1"
                  value={congregacao?.nomeCongregacao || ""}
                  placeholder="Central"
                  onChange={(e) =>
                    setCongregacao({
                      ...congregacao!,
                      nomeCongregacao: e.target.value,
                    })
                  }
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Dia da Reunião de Fim de semana*
                </label>
                <select
                  className="w-full border rounded px-2 py-1"
                  value={congregacao?.diaReuniao || ""}
                  onChange={(e) =>
                    setCongregacao({
                      ...congregacao!,
                      diaReuniao: e.target.value,
                    })
                  }
                >
                  <option value="">Selecione o dia</option>
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
                  Horário da Reunião *
                </label>
                <input
                  type="time"
                  className="w-full border rounded px-2 py-1"
                  value={congregacao?.horarioReuniao || ""}
                  onChange={(e) =>
                    setCongregacao({
                      ...congregacao!,
                      horarioReuniao: e.target.value,
                    })
                  }
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Cidade - Estado *
                </label>
                <input
                  type="text"
                  className="w-full border rounded px-2 py-1"
                  value={congregacao?.cidade || ""}
                  placeholder="São Paulo - SP"
                  onChange={(e) =>
                    setCongregacao({
                      ...congregacao!,
                      cidade: e.target.value,
                    })
                  }
                />
              </div>
              {/* Adicione outros campos se quiser */}
              <button
                className="w-full bg-purple-600 text-white px-4 py-2 rounded hover:bg-purple-700 transition-colors mt-4"
                onClick={() => saveCongregacao(congregacao!)}
              >
                Salvar
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Conteúdo normal do app */}
      <Router>
        <div className="app-container max-w-md md:max-w-7xl mx-auto px-4 py-4 pb-20">
          <Routes>
            <Route path="/" element={<AgendaPage />} />
            <Route path="/oradores" element={<OradoresPage />} />
            <Route path="/temas" element={<TemasPage />} />
            <Route path="/saidas" element={<SaidasPage />} />
            <Route path="/datas-especiais" element={<DatasEspeciaisPage />} />
            <Route path="/config" element={<ConfigPage />} />
          </Routes>
          <BottomNavigation />
        </div>
        <GoogleDriveStatusBar autoBackup={!!congregacao?.autoBackup} />
        <Toaster
          position="top-center"
          toastOptions={{
            duration: 3000,
            style: {
              background: "#363636",
              color: "#fff",
            },
            success: {
              duration: 3000,
              iconTheme: {
                primary: "#10B981",
                secondary: "#fff",
              },
            },
            error: {
              duration: 4000,
              iconTheme: {
                primary: "#EF4444",
                secondary: "#fff",
              },
            },
          }}
        />
      </Router>
    </>
  );
}

function App() {
  return (
    <ConfigProvider>
      <AppContent />
    </ConfigProvider>
  );
}

export default App;
