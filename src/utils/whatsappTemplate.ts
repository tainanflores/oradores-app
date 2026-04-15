// src/utils/whatsappTemplate.ts

export const WHATSAPP_TEMPLATE_TAGS = [
  { tag: "{nome}", label: "Nome do orador", icon: "👤" },
  { tag: "{data}", label: "Data do discurso", icon: "📅" },
  { tag: "{hora}", label: "Horário", icon: "🕒" },
  { tag: "{tema}", label: "Tema (número e título)", icon: "📖" },
  { tag: "{temaNro}", label: "Número do tema", icon: "#" },
  { tag: "{temaTitulo}", label: "Título do tema", icon: "📝" },
  { tag: "{congregacao}", label: "Nome da congregação", icon: "⛪" },
  { tag: "{cidade}", label: "Cidade", icon: "🏘️" },
  { tag: "{local}", label: "Local (congregação + cidade)", icon: "📍" },
];

export const TEMPLATE_PADRAO = `✅ *Confirmação de Discurso*

Olá {nome}!

Seu discurso está agendado para:
📅 *{data}*
🕒 *Horário:* {hora}
*Tema:* {tema}

Local: *{local}*

Por favor, confirme seu comparecimento e as informações abaixo:

• Cântico?
• Usará imagens?
• Vai precisar de hospedagem?
• Precisa de ajuda de custo com combustível?

Qualquer dúvida, estamos à disposição!

Abraço!`;

export interface TemplateVars {
  nome: string;
  data: string;
  hora: string;
  tema: string;
  temaNro: string;
  temaTitulo: string;
  congregacao: string;
  cidade: string;
  local: string;
}

/**
 * Substitui as tags do template pelas variáveis reais
 */
export function formatarMensagemTemplate(
  template: string,
  vars: TemplateVars,
): string {
  let mensagem = template;

  Object.entries(vars).forEach(([key, value]) => {
    const tag = `{${key}}`;
    mensagem = mensagem.replace(new RegExp(tag, "g"), value);
  });

  return mensagem;
}

/**
 * Retorna o template padrão ou um template customizado
 */
export function obterTemplate(templateCustomizado?: string | null): string {
  return templateCustomizado && templateCustomizado.trim()
    ? templateCustomizado
    : TEMPLATE_PADRAO;
}
