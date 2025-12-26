/**
 * Converte uma data no formato ISO "YYYY-MM-DD" para o formato brasileiro "DD/MM/YYYY"
 * sem usar objetos Date para evitar problemas de fuso horário.
 */
export function formatDateBR(dateISO: string): string {
  const [year, month, day] = dateISO.split("-");
  return `${day}/${month}/${year}`;
}
