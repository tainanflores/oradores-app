import { useState, useEffect } from "react";
import toast from "react-hot-toast";
import { dbSaveWithBackup } from "../utils/dbWithBackup";
import { useGoogleDriveAuth } from "../contexts/GoogleDriveAuthContext";
import {
  WHATSAPP_TEMPLATE_TAGS,
  TEMPLATE_PADRAO,
} from "../utils/whatsappTemplate";
import { X, Save, Code } from "lucide-react";
import { type Configuracao } from "../database";

interface ModalEditarTemplateWhatsappProps {
  isOpen: boolean;
  onClose: () => void;
  congregacao: Configuracao;
  onSave: (congregacao: Configuracao) => void;
}

function ModalEditarTemplateWhatsapp({
  isOpen,
  onClose,
  congregacao,
  onSave,
}: ModalEditarTemplateWhatsappProps) {
  const [template, setTemplate] = useState(
    congregacao.templateMensagemWhatsapp || TEMPLATE_PADRAO,
  );
  const [loading, setLoading] = useState(false);
  const { isSignedIn, uploadBackup } = useGoogleDriveAuth();

  // Sincronizar template sempre que a modal abre - para sempre mostrar o que está no banco
  useEffect(() => {
    if (isOpen) {
      // Recarregar do banco pra garantir que sempre mostra a versão atual
      setTemplate(congregacao.templateMensagemWhatsapp || TEMPLATE_PADRAO);
    }
  }, [isOpen, congregacao.templateMensagemWhatsapp]);

  const handleSalvar = async () => {
    setLoading(true);
    try {
      const congregacaoAtualizada = {
        ...congregacao,
        templateMensagemWhatsapp: template,
      };
      await dbSaveWithBackup(
        "configuracoes",
        congregacaoAtualizada,
        Boolean(congregacao?.autoBackup),
        isSignedIn,
        uploadBackup,
      );
      toast.success("Template salvo com sucesso!");
      onSave(congregacaoAtualizada);
      onClose();
    } catch (error) {
      console.error("Erro ao salvar template:", error);
      toast.error("Erro ao salvar template");
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-500 to-blue-600 text-white p-4 shadow-lg flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Code className="w-6 h-6" />
            <div>
              <h2 className="text-xl font-bold">Editar Template de Mensagem</h2>
              <p className="text-sm text-blue-100">
                Customize a mensagem de confirmação do discurso
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-blue-400 rounded transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Conteúdo */}
        <div className="overflow-y-auto flex-1 p-6">
          {/* Tags disponíveis */}
          <div className="mb-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
            <p className="text-sm font-medium text-blue-900 mb-2">
              Tags disponíveis:
            </p>
            <div className="flex flex-wrap gap-2">
              {WHATSAPP_TEMPLATE_TAGS.map((item) => (
                <button
                  key={item.tag}
                  type="button"
                  onClick={() => {
                    setTemplate((prev) => prev + item.tag);
                    const textarea = document.getElementById(
                      "template-textarea",
                    ) as HTMLTextAreaElement;
                    if (textarea) {
                      textarea.focus();
                    }
                  }}
                  title={item.label}
                  className="px-2 py-1 bg-blue-500 text-white text-xs rounded hover:bg-blue-600 transition-colors"
                >
                  {item.icon} {item.tag}
                </button>
              ))}
            </div>
          </div>

          {/* Textarea */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Template da Mensagem
            </label>
            <textarea
              id="template-textarea"
              value={template}
              onChange={(e) => setTemplate(e.target.value)}
              rows={6}
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              placeholder="Digite a mensagem com as tags..."
            />
          </div>

          {/* Preview */}
          <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
            <p className="text-sm font-medium text-gray-700 mb-2">Preview:</p>
            <p className="text-sm text-gray-600 whitespace-pre-wrap font-mono max-h-32 overflow-y-auto">
              {template
                .replace(/{nome}/g, "João Silva")
                .replace(/{data}/g, "domingo, 20 de abril de 2026")
                .replace(/{hora}/g, "14:00")
                .replace(/{tema}/g, "15. Como ser um bom cristão")
                .replace(/{temaNro}/g, "15")
                .replace(/{temaTitulo}/g, "Como ser um bom cristão")
                .replace(/{congregacao}/g, "Congregação Central")
                .replace(/{cidade}/g, "São Paulo")
                .replace(/{local}/g, "Congregação Central - São Paulo")}
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-gray-50 p-4 border-t border-gray-200 flex gap-2 justify-end">
          <button
            onClick={() => {
              setTemplate(TEMPLATE_PADRAO);
            }}
            className="px-4 py-2 text-gray-700 bg-gray-200 rounded-lg hover:bg-gray-300 transition-colors"
          >
            Restaurar Padrão
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 bg-gray-200 rounded-lg hover:bg-gray-300 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleSalvar}
            disabled={loading}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:bg-gray-400 flex items-center gap-2"
          >
            <Save className="w-4 h-4" />
            {loading ? "Salvando..." : "Salvar"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default ModalEditarTemplateWhatsapp;
