import type { ReaderLocale, TranslationLocale } from './locales';

// Somente interface: nunca passar narrativa, notas da autora ou comentários a esta função.
const messages: Record<string, Record<TranslationLocale, string>> = {
  "Prévia local de traduções · Rascunhos não publicados.": {
    "en-US": "Local translation preview · Unpublished drafts.",
    "es-419": "Vista previa local de traducciones · Borradores sin publicar."
  },
  "Mudança de cena": { "en-US": "Scene break", "es-419": "Cambio de escena" },
  "Capítulo {number}": {
    "en-US": "Chapter {number}",
    "es-419": "Capítulo {number}"
  },
  "Capítulo não encontrado": {
    "en-US": "Chapter not found",
    "es-419": "Capítulo no encontrado"
  },
  "Voltar ao índice": {
    "en-US": "Back to contents",
    "es-419": "Volver al índice"
  },
  "por": {
    "en-US": "by",
    "es-419": "por"
  },
  "Anterior": {
    "en-US": "Previous",
    "es-419": "Anterior"
  },
  "Próximo": {
    "en-US": "Next",
    "es-419": "Siguiente"
  },
  "Ir para o capítulo": {
    "en-US": "Go to chapter",
    "es-419": "Ir al capítulo"
  },
  "Navegação de capítulos ({placement})": {
    "en-US": "Chapter navigation ({placement})",
    "es-419": "Navegación de capítulos ({placement})"
  },
  "top": {
    "en-US": "top",
    "es-419": "superior"
  },
  "bottom": {
    "en-US": "bottom",
    "es-419": "inferior"
  },
  "Ajustes de leitura": {
    "en-US": "Reading settings",
    "es-419": "Ajustes de lectura"
  },
  "Preferências de leitura": {
    "en-US": "Reading preferences",
    "es-419": "Preferencias de lectura"
  },
  "TEMA": {
    "en-US": "THEME",
    "es-419": "TEMA"
  },
  "FONTE": {
    "en-US": "FONT",
    "es-419": "FUENTE"
  },
  "TAMANHO": {
    "en-US": "SIZE",
    "es-419": "TAMAÑO"
  },
  "ENTRELINHA": {
    "en-US": "LINE SPACING",
    "es-419": "INTERLINEADO"
  },
  "Tema claro": {
    "en-US": "Light theme",
    "es-419": "Tema claro"
  },
  "Tema escuro": {
    "en-US": "Dark theme",
    "es-419": "Tema oscuro"
  },
  "Fonte serifada": {
    "en-US": "Serif font",
    "es-419": "Fuente con serifa"
  },
  "Fonte sem serifa": {
    "en-US": "Sans serif font",
    "es-419": "Fuente sin serifa"
  },
  "Diminuir fonte": {
    "en-US": "Decrease font size",
    "es-419": "Reducir tamaño de fuente"
  },
  "Aumentar fonte": {
    "en-US": "Increase font size",
    "es-419": "Aumentar tamaño de fuente"
  },
  "Tamanho da fonte": {
    "en-US": "Font size",
    "es-419": "Tamaño de fuente"
  },
  "Diminuir entrelinha": {
    "en-US": "Decrease line spacing",
    "es-419": "Reducir interlineado"
  },
  "Aumentar entrelinha": {
    "en-US": "Increase line spacing",
    "es-419": "Aumentar interlineado"
  },
  "Voltar ao topo": {
    "en-US": "Back to top",
    "es-419": "Volver arriba"
  },
  "Idioma": {
    "en-US": "Language",
    "es-419": "Idioma"
  },
  "Indisponível": {
    "en-US": "Unavailable",
    "es-419": "No disponible"
  },
  "Esta versão ainda não está disponível. Você está lendo o original em português.": {
    "en-US": "This version is not available yet. You are reading the Portuguese original.",
    "es-419": "Esta versión aún no está disponible. Estás leyendo el original en portugués."
  },
  "Aviso sobre a tradução": {
    "en-US": "Translation notice",
    "es-419": "Aviso sobre la traducción"
  },
  "Enviar feedback da tradução": {
    "en-US": "Share translation feedback",
    "es-419": "Enviar sugerencias sobre la traducción"
  },
  "Carregando capítulo...": {
    "en-US": "Loading chapter...",
    "es-419": "Cargando capítulo..."
  },
  "Não foi possível carregar este capítulo.": {
    "en-US": "This chapter could not be loaded.",
    "es-419": "No se pudo cargar este capítulo."
  },
  "Nota da autora": {
    "en-US": "Author’s note",
    "es-419": "Nota de la autora"
  },
  "Resumo do capítulo": {
    "en-US": "Chapter summary",
    "es-419": "Resumen del capítulo"
  },
  "Notas da autora": {
    "en-US": "Author’s notes",
    "es-419": "Notas de la autora"
  },
  "Notas finais da autora": {
    "en-US": "Author’s end notes",
    "es-419": "Notas finales de la autora"
  },
  "Texto do capítulo {number}": {
    "en-US": "Chapter {number} text",
    "es-419": "Texto del capítulo {number}"
  },
  "Ver todos os capítulos": {
    "en-US": "View all chapters",
    "es-419": "Ver todos los capítulos"
  },
  "Abrindo a comunidade…": {
    "en-US": "Opening the community…",
    "es-419": "Abriendo la comunidad…"
  },
  "Baixar o capítulo aberto": {
    "en-US": "Download the current chapter",
    "es-419": "Descargar el capítulo actual"
  },
  "Baixar {format}": {
    "en-US": "Download {format}",
    "es-419": "Descargar {format}"
  },
  "Baixar {format} do capítulo {number}": {
    "en-US": "Download chapter {number} as {format}",
    "es-419": "Descargar capítulo {number} en {format}"
  },
  "Gerando {format}…": {
    "en-US": "Generating {format}…",
    "es-419": "Generando {format}…"
  },
  "Preparando {format} do capítulo {number}…": {
    "en-US": "Preparing chapter {number} as {format}…",
    "es-419": "Preparando el capítulo {number} en {format}…"
  },
  "Download de {format} do capítulo {number} iniciado.": {
    "en-US": "Chapter {number} {format} download started.",
    "es-419": "Se inició la descarga del capítulo {number} en {format}."
  },
  "Não foi possível gerar o {format}. {detail}": {
    "en-US": "Could not generate {format}. {detail}",
    "es-419": "No se pudo generar el {format}. {detail}"
  },
  "Tente novamente.": {
    "en-US": "Please try again.",
    "es-419": "Inténtalo de nuevo."
  },
  "Sumário": {
    "en-US": "Contents",
    "es-419": "Índice"
  },
  "Capítulo {number} de {work}.": {
    "en-US": "Chapter {number} of {work}.",
    "es-419": "Capítulo {number} de {work}."
  },
  "O arquivo gerado está vazio. Nenhum download foi iniciado.": {
    "en-US": "The generated file is empty. No download was started.",
    "es-419": "El archivo generado está vacío. No se inició ninguna descarga."
  },
  "O PDF não foi concluído. Tente gerar o arquivo novamente.": {
    "en-US": "The PDF is incomplete. Please generate the file again.",
    "es-419": "El PDF no se completó. Intenta generar el archivo de nuevo."
  },
  "O arquivo gerado está vazio.": {
    "en-US": "The generated file is empty.",
    "es-419": "El archivo generado está vacío."
  },
  "O capítulo contém uma marcação que não pode ser exportada integralmente.": {
    "en-US": "The chapter contains markup that cannot be fully exported.",
    "es-419": "El capítulo contiene marcado que no se puede exportar por completo."
  },
  "O capítulo contém uma formatação ainda não suportada para download.": {
    "en-US": "The chapter contains formatting not yet supported for download.",
    "es-419": "El capítulo contiene un formato que aún no se admite para descarga."
  },
  "Os dados do capítulo estão incompletos. Recarregue a página e tente novamente.": {
    "en-US": "Chapter data is incomplete. Reload the page and try again.",
    "es-419": "Los datos del capítulo están incompletos. Recarga la página e inténtalo de nuevo."
  },
  "Um trecho do capítulo está sem conteúdo. O download foi interrompido.": {
    "en-US": "A section of the chapter is missing content. The download was stopped.",
    "es-419": "Falta contenido en una parte del capítulo. Se detuvo la descarga."
  },
  "Um bloco do capítulo não pôde ser exportado integralmente.": {
    "en-US": "A chapter block could not be fully exported.",
    "es-419": "No se pudo exportar por completo un bloque del capítulo."
  },
  "O capítulo não possui texto disponível para download.": {
    "en-US": "The chapter has no text available for download.",
    "es-419": "El capítulo no tiene texto disponible para descargar."
  },
  "Não foi possível representar todo o conteúdo do capítulo em EPUB. Nenhum arquivo foi baixado.": {
    "en-US": "The complete chapter could not be represented in EPUB. No file was downloaded.",
    "es-419": "No se pudo representar todo el capítulo en EPUB. No se descargó ningún archivo."
  },
  "Comentários": {
    "en-US": "Comments",
    "es-419": "Comentarios"
  },
  "CAP.": {
    "en-US": "CH.",
    "es-419": "CAP."
  },
  "Comentários deste capítulo": {
    "en-US": "Comments on this chapter",
    "es-419": "Comentarios de este capítulo"
  },
  "Ordenar comentários": {
    "en-US": "Sort comments",
    "es-419": "Ordenar comentarios"
  },
  "Mais recentes primeiro": {
    "en-US": "Newest first",
    "es-419": "Más recientes primero"
  },
  "Mais antigos primeiro": {
    "en-US": "Oldest first",
    "es-419": "Más antiguos primero"
  },
  "Abrindo a conversa…": {
    "en-US": "Opening the conversation…",
    "es-419": "Abriendo la conversación…"
  },
  "Ainda não há comentários.": {
    "en-US": "No comments yet.",
    "es-419": "Aún no hay comentarios."
  },
  "Tentar novamente": {
    "en-US": "Try again",
    "es-419": "Intentar de nuevo"
  },
  "Carregando…": {
    "en-US": "Loading…",
    "es-419": "Cargando…"
  },
  "Carregar mais comentários": {
    "en-US": "Load more comments",
    "es-419": "Cargar más comentarios"
  },
  "Comentário publicado.": {
    "en-US": "Comment published.",
    "es-419": "Comentario publicado."
  },
  "Você deixou um trevo.": {
    "en-US": "You left a clover.",
    "es-419": "Dejaste un trébol."
  },
  "Denúncia enviada.": {
    "en-US": "Report sent.",
    "es-419": "Reporte enviado."
  },
  "Comentário de {name}": {
    "en-US": "Comment by {name}",
    "es-419": "Comentario de {name}"
  },
  "Anônimo": {
    "en-US": "Anonymous",
    "es-419": "Anónimo"
  },
  "Denúncia enviada para o comentário de {name}": {
    "en-US": "Report sent for the comment by {name}",
    "es-419": "Se envió un reporte del comentario de {name}"
  },
  "Denunciar comentário de {name}": {
    "en-US": "Report comment by {name}",
    "es-419": "Reportar comentario de {name}"
  },
  "Denúncia enviada": {
    "en-US": "Report sent",
    "es-419": "Reporte enviado"
  },
  "Denunciar": {
    "en-US": "Report",
    "es-419": "Reportar"
  },
  "Participação anônima": {
    "en-US": "Anonymous participation",
    "es-419": "Participación anónima"
  },
  "Pseudônimo": {
    "en-US": "Pseudonym",
    "es-419": "Seudónimo"
  },
  "De 2 a 40 caracteres.": {
    "en-US": "2 to 40 characters.",
    "es-419": "De 2 a 40 caracteres."
  },
  "Seu comentário": {
    "en-US": "Your comment",
    "es-419": "Tu comentario"
  },
  "Escreva seu comentário...": {
    "en-US": "Write your comment...",
    "es-419": "Escribe tu comentario..."
  },
  "Envio não confirmado. Reenvie para conferir.": {
    "en-US": "Submission unconfirmed. Resubmit to check.",
    "es-419": "Envío sin confirmar. Vuelve a enviarlo para verificar."
  },
  "Com gentileza, para a autora e para quem lê.": {
    "en-US": "With kindness, for the author and fellow readers.",
    "es-419": "Con amabilidad, para la autora y quienes leen."
  },
  "Reenviar comentário": {
    "en-US": "Resubmit comment",
    "es-419": "Reenviar comentario"
  },
  "Publicar comentário": {
    "en-US": "Publish comment",
    "es-419": "Publicar comentario"
  },
  "Reenviar": {
    "en-US": "Resubmit",
    "es-419": "Reenviar"
  },
  "Publicar": {
    "en-US": "Publish",
    "es-419": "Publicar"
  },
  "Spam": {
    "en-US": "Spam",
    "es-419": "Spam"
  },
  "Assédio": {
    "en-US": "Harassment",
    "es-419": "Acoso"
  },
  "Ódio ou discriminação": {
    "en-US": "Hate or discrimination",
    "es-419": "Odio o discriminación"
  },
  "Spoiler": {
    "en-US": "Spoiler",
    "es-419": "Spoiler"
  },
  "Conteúdo impróprio": {
    "en-US": "Inappropriate content",
    "es-419": "Contenido inapropiado"
  },
  "Outro": {
    "en-US": "Other",
    "es-419": "Otro"
  },
  "Use até 2.000 caracteres nos detalhes.": {
    "en-US": "Use up to 2,000 characters in the details.",
    "es-419": "Usa hasta 2.000 caracteres en los detalles."
  },
  "Cancelar denúncia": {
    "en-US": "Cancel report",
    "es-419": "Cancelar reporte"
  },
  "Denúncia anônima, encaminhada à moderação.": {
    "en-US": "Anonymous report sent to moderation.",
    "es-419": "Reporte anónimo, enviado a moderación."
  },
  "Motivo da denúncia": {
    "en-US": "Reason for reporting",
    "es-419": "Motivo del reporte"
  },
  "Motivo": {
    "en-US": "Reason",
    "es-419": "Motivo"
  },
  "Detalhes": {
    "en-US": "Details",
    "es-419": "Detalles"
  },
  "(opcional)": {
    "en-US": "(optional)",
    "es-419": "(opcional)"
  },
  "Até 2.000 caracteres.": {
    "en-US": "Up to 2,000 characters.",
    "es-419": "Hasta 2.000 caracteres."
  },
  "Enviar denúncia": {
    "en-US": "Send report",
    "es-419": "Enviar reporte"
  },
  "Trevos do capítulo": {
    "en-US": "Chapter clovers",
    "es-419": "Tréboles del capítulo"
  },
  "trevo recebido": {
    "en-US": "clover received",
    "es-419": "trébol recibido"
  },
  "trevos recebidos": {
    "en-US": "clovers received",
    "es-419": "tréboles recibidos"
  },
  "Um trevo para este capítulo": {
    "en-US": "A clover for this chapter",
    "es-419": "Un trébol para este capítulo"
  },
  "Você deixou um trevo": {
    "en-US": "You left a clover",
    "es-419": "Dejaste un trébol"
  },
  "Deixar um trevo": {
    "en-US": "Leave a clover",
    "es-419": "Dejar un trébol"
  },
  "{count} trevo neste capítulo": {
    "en-US": "{count} clover on this chapter",
    "es-419": "{count} trébol en este capítulo"
  },
  "{count} trevos neste capítulo": {
    "en-US": "{count} clovers on this chapter",
    "es-419": "{count} tréboles en este capítulo"
  },
  "Comunidade": {
    "en-US": "Community",
    "es-419": "Comunidad"
  },
  "A comunidade está indisponível por enquanto.": {
    "en-US": "The community is currently unavailable.",
    "es-419": "La comunidad no está disponible por ahora."
  },
  "Verificação de segurança": {
    "en-US": "Security check",
    "es-419": "Verificación de seguridad"
  },
  "Cancelar": {
    "en-US": "Cancel",
    "es-419": "Cancelar"
  },
  "Confirmando…": {
    "en-US": "Confirming…",
    "es-419": "Confirmando…"
  },
  "O envio não foi concluído.": {
    "en-US": "The submission was not completed.",
    "es-419": "No se completó el envío."
  },
  "Conclua a verificação. O envio continuará automaticamente.": {
    "en-US": "Complete the verification. Submission will continue automatically.",
    "es-419": "Completa la verificación. El envío continuará automáticamente."
  },
  "Tente novamente em {seconds}s.": {
    "en-US": "Try again in {seconds}s.",
    "es-419": "Inténtalo de nuevo en {seconds}s."
  },
  "Carregando verificação de segurança…": {
    "en-US": "Loading security check…",
    "es-419": "Cargando verificación de seguridad…"
  },
  "Conclua a verificação de segurança.": {
    "en-US": "Complete the security check.",
    "es-419": "Completa la verificación de seguridad."
  },
  "Verificação concluída.": {
    "en-US": "Verification complete.",
    "es-419": "Verificación completada."
  },
  "A verificação expirou. Tente novamente.": {
    "en-US": "Verification expired. Try again.",
    "es-419": "La verificación venció. Inténtalo de nuevo."
  },
  "Verificação utilizada.": {
    "en-US": "Verification used.",
    "es-419": "Verificación utilizada."
  },
  "A verificação está indisponível. Tente novamente.": {
    "en-US": "Verification is unavailable. Try again.",
    "es-419": "La verificación no está disponible. Inténtalo de nuevo."
  },
  "Use um pseudônimo de 2 a 40 caracteres.": {
    "en-US": "Use a pseudonym of 2 to 40 characters.",
    "es-419": "Usa un seudónimo de 2 a 40 caracteres."
  },
  "Escreva um comentário de 1 a 5.000 caracteres.": {
    "en-US": "Write a comment of 1 to 5,000 characters.",
    "es-419": "Escribe un comentario de 1 a 5.000 caracteres."
  },
  "Remova os caracteres inválidos do texto.": {
    "en-US": "Remove invalid characters from the text.",
    "es-419": "Elimina los caracteres inválidos del texto."
  },
  "Sua sessão não pôde ser confirmada. Tente novamente.": {
    "en-US": "Your session could not be confirmed. Try again.",
    "es-419": "No se pudo confirmar tu sesión. Inténtalo de nuevo."
  },
  "Confira o pseudônimo, o texto e os campos informados.": {
    "en-US": "Check your pseudonym, text, and form fields.",
    "es-419": "Revisa el seudónimo, el texto y los campos del formulario."
  },
  "Conclua uma nova verificação de segurança.": {
    "en-US": "Complete a new security check.",
    "es-419": "Completa una nueva verificación de seguridad."
  },
  "A comunidade deste capítulo está indisponível.": {
    "en-US": "This chapter’s community is unavailable.",
    "es-419": "La comunidad de este capítulo no está disponible."
  },
  "Este comentário não está disponível para denúncia.": {
    "en-US": "This comment is not available for reporting.",
    "es-419": "Este comentario no está disponible para reportar."
  },
  "Este envio já foi usado com outro conteúdo. Confirme a publicação antes de editar.": {
    "en-US": "This submission was already used with different content. Confirm publication before editing.",
    "es-419": "Este envío ya se usó con otro contenido. Confirma la publicación antes de editar."
  },
  "Você chegou ao limite de participações. Aguarde um pouco.": {
    "en-US": "You have reached the participation limit. Please wait a moment.",
    "es-419": "Alcanzaste el límite de participaciones. Espera un momento."
  },
  "A comunidade está indisponível no momento. Tente novamente.": {
    "en-US": "The community is currently unavailable. Try again.",
    "es-419": "La comunidad no está disponible en este momento. Inténtalo de nuevo."
  },
  "Não foi possível continuar.": {
    "en-US": "Could not continue.",
    "es-419": "No se pudo continuar."
  },
  "Não foi possível confirmar o envio.": {
    "en-US": "Could not confirm the submission.",
    "es-419": "No se pudo confirmar el envío."
  },
  "Não foi possível confirmar o envio. Tente novamente.": {
    "en-US": "Could not confirm the submission. Try again.",
    "es-419": "No se pudo confirmar el envío. Inténtalo de nuevo."
  },
  "Não foi possível confirmar o envio. Tente de novo com uma nova verificação.": {
    "en-US": "Could not confirm the submission. Try again with a new verification.",
    "es-419": "No se pudo confirmar el envío. Inténtalo de nuevo con una nueva verificación."
  },
  "Comunidade indisponível.": {
    "en-US": "Community unavailable.",
    "es-419": "Comunidad no disponible."
  },
  "Inicie a sessão antes de participar.": {
    "en-US": "Start a session before participating.",
    "es-419": "Inicia una sesión antes de participar."
  },
  "Conclua um novo desafio de segurança.": {
    "en-US": "Complete a new security challenge.",
    "es-419": "Completa un nuevo desafío de seguridad."
  },
  "A comunidade está indisponível no momento.": {
    "en-US": "The community is currently unavailable.",
    "es-419": "La comunidad no está disponible en este momento."
  },
  "Não foi possível recuperar sua sessão. Tente novamente.": {
    "en-US": "Could not restore your session. Try again.",
    "es-419": "No se pudo recuperar tu sesión. Inténtalo de nuevo."
  },
  "Não foi possível carregar a conversa. Tente novamente.": {
    "en-US": "Could not load the conversation. Try again.",
    "es-419": "No se pudo cargar la conversación. Inténtalo de nuevo."
  },
  "Não foi possível carregar a conversa.": {
    "en-US": "Could not load the conversation.",
    "es-419": "No se pudo cargar la conversación."
  },
  "Permita o armazenamento desta aba para preservar seu comentário em caso de falha.": {
    "en-US": "Allow storage in this tab to preserve your comment if submission fails.",
    "es-419": "Permite el almacenamiento en esta pestaña para conservar tu comentario en caso de falla."
  },
  "A participação está indisponível no momento.": {
    "en-US": "Participation is currently unavailable.",
    "es-419": "La participación no está disponible en este momento."
  },
  "Não foi possível recuperar ou criar sua sessão. Tente novamente.": {
    "en-US": "Could not restore or create your session. Try again.",
    "es-419": "No se pudo recuperar o crear tu sesión. Inténtalo de nuevo."
  },
  "A sessão atual não é anônima. Ela foi preservada.": {
    "en-US": "The current session is not anonymous. It has been preserved.",
    "es-419": "La sesión actual no es anónima. Se ha conservado."
  }
};

export function readerText(locale: ReaderLocale, message: string, values: Record<string, string | number> = {}): string {
  const text = locale === 'pt-BR' ? message : messages[message]?.[locale] ?? message;
  return text.replace(/\{(\w+)\}/g, (placeholder, key: string) => String(values[key] ?? placeholder));
}
