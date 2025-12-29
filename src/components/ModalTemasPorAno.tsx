import React from "react";

interface TemasPorAnoModalProps {
  isOpen: boolean;
  onClose: () => void;
  temas: { id: number; numero: number }[];
  anos: number[];
  datasPorAno: { [temaId: number]: { [ano: number]: string | undefined } };
}

const TemasPorAnoModal: React.FC<TemasPorAnoModalProps> = ({
  isOpen,
  onClose,
  temas,
  anos,
  datasPorAno,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
      <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full p-6 relative">
        <button
          className="absolute top-3 right-3 text-gray-400 hover:text-purple-600 text-xl font-bold"
          onClick={onClose}
          aria-label="Fechar"
        >
          ×
        </button>
        <h2 className="text-xl font-bold mb-4 text-gray-800">Temas por Ano</h2>
        <div className="w-full overflow-x-auto">
          <div className="inline-block min-w-full max-h-[86vh] overflow-y-auto">
            <table className="min-w-full border text-sm">
              <thead>
                <tr>
                  <th className="px-1 py-1 border bg-purple-50 text-purple-700 text-center">
                    Nº
                  </th>
                  {anos.map((ano) => (
                    <th
                      key={ano}
                      className="px-1 py-1 border bg-purple-50 text-purple-700 text-center"
                    >
                      {ano}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {temas.map((tema) => (
                  <tr key={tema.id}>
                    <td className="px-1 py-1 border font-semibold text-gray-700 text-center">
                      {tema.numero}
                    </td>
                    {anos.map((ano) => {
                      const data = datasPorAno[tema.id]?.[ano];
                      return (
                        <td
                          key={ano}
                          className="px-1 py-1 border text-center text-gray-600"
                        >
                          {data ? data.slice(0, 5) : ""}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TemasPorAnoModal;
