import { useState, useEffect } from "react";
import { Download, X, Smartphone } from "lucide-react";

export default function PWAInstallPrompt() {
  const [showPrompt, setShowPrompt] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

  useEffect(() => {
    // Detectar se já está instalado (standalone mode)
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as any).standalone === true;

    if (isStandalone) return; // Não mostrar se já está instalado

    // Handler para o evento beforeinstallprompt
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener("beforeinstallprompt", handler);

    // Detectar primeira interação do usuário
    const handleInteraction = () => {
      // Mostrar prompt após 15 segundos de interação
      setTimeout(() => {
        if (!localStorage.getItem("pwa-prompt-dismissed")) {
          setShowPrompt(true);
        }
      }, 15000);
    };

    // Adicionar listeners para primeira interação
    window.addEventListener("click", handleInteraction, { once: true });
    window.addEventListener("touchstart", handleInteraction, { once: true });
    window.addEventListener("keydown", handleInteraction, { once: true });

    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
      window.removeEventListener("click", handleInteraction);
      window.removeEventListener("touchstart", handleInteraction);
      window.removeEventListener("keydown", handleInteraction);
    };
  }, []);

  const handleInstall = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      console.log(`PWA install outcome: ${outcome}`);

      setDeferredPrompt(null);
      setShowPrompt(false);

      // Se usuário aceitou, não mostrar novamente
      if (outcome === "accepted") {
        localStorage.setItem("pwa-installed", "true");
      }
    }
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    // Salvar que usuário dispensou (não mostrar por 7 dias)
    const dismissTime = Date.now();
    localStorage.setItem("pwa-prompt-dismissed", dismissTime.toString());
  };

  // Não mostrar se não há suporte ou já foi dispensado recentemente
  if (!showPrompt || !deferredPrompt) {
    return null;
  }

  return (
    <div
      className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-96
                    bg-gradient-to-r from-blue-600 to-purple-600 text-white
                    p-4 rounded-xl shadow-2xl z-50 border border-white/20"
    >
      <div className="flex items-start justify-between">
        <div className="flex-1 pr-3">
          <div className="flex items-center mb-2">
            <Smartphone className="w-5 h-5 mr-2" />
            <h3 className="font-semibold text-lg">Instale o App Oradores</h3>
          </div>

          <p className="text-sm mb-3 opacity-90 leading-relaxed">
            📱 Tenha acesso rápido e funcione <strong>mesmo offline</strong>!
            Instale como aplicativo nativo na sua tela inicial.
          </p>

          <div className="flex gap-2">
            <button
              onClick={handleInstall}
              className="bg-white text-blue-600 px-4 py-2 rounded-lg
                         font-medium hover:bg-gray-100 transition-all
                         transform hover:scale-105 shadow-md"
            >
              <Download className="w-4 h-4 inline mr-2" />
              Instalar Agora
            </button>

            <button
              onClick={handleDismiss}
              className="text-white/70 hover:text-white hover:bg-white/10
                         px-3 py-2 rounded-lg transition-colors"
              title="Dispensar"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Indicador visual de que é um PWA */}
      <div
        className="absolute -top-1 -right-1 w-6 h-6 bg-green-500
                      rounded-full flex items-center justify-center"
      >
        <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
      </div>
    </div>
  );
}
