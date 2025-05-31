function doPost(e) {
  try {
    validarConfiguracao();
    Logger.log('🔔 Webhook Twilio ativado: %s', JSON.stringify(e.parameter));
    
    // Verificar se os parâmetros necessários existem
    if (!e.parameter) {
      Logger.log('⚠️ Nenhum parâmetro recebido no webhook');
      return ContentService.createTextOutput('<Response></Response>').setMimeType(ContentService.MimeType.XML);
    }
    
    const fromFull = e.parameter.From;
    const body = e.parameter.Body || '';
    
    Logger.log('📝 Dados recebidos - From: %s, Body: %s', fromFull, body);
    
    // Verificar se os parâmetros são válidos
    if (!fromFull) {
      Logger.log('⚠️ Parâmetro From ausente');
      return ContentService.createTextOutput('<Response></Response>').setMimeType(ContentService.MimeType.XML);
    }
    
    const numero = fromFull.replace('whatsapp:', '').replace(/^\+/, '');
    
    if (numero && body) {
      Logger.log('📥 Processando mensagem de %s: %s', numero, body);
      
      // Registrar a mensagem recebida em um log específico
      registrarLogMensagem('recebida', numero, body);
      
      // Processar a mensagem
      processarMensagem(numero, body);
    } else {
      Logger.log('⚠️ Parâmetros inválidos: From=%s, Body=%s', fromFull, body);
    }
    
    return ContentService.createTextOutput('<Response></Response>').setMimeType(ContentService.MimeType.XML);
  } catch (e) {
    Logger.log('❌ Erro no webhook: %s', e);
    Logger.log('❌ Stack trace: %s', e.stack);
    return ContentService.createTextOutput('<Response></Response>').setMimeType(ContentService.MimeType.XML);
  }
}

// =================================================================
// Envio de mensagem via Twilio (com logs de status)
// =================================================================
function personalizarResposta(interpret) {
  let msg = interpret.mensagem || "";
  
  // Lista de emojis para categorias comuns
  const emojisPorCategoria = {
    "transporte": "🚗",
    "alimentação": "🍽️",
    "saúde": "🏥",
    "entretenimento": "🎬",
    "investimento": "📈",
    "freelancer": "💼",
    "default": "💰"
  };

  // Ações específicas com personalização
  if (interpret.acao === "registrar_receita") {
    msg = `${msg} 🎉 Parabéns pelo seu ganho!`;
  } else if (interpret.acao === "registrar_despesa") {
    let emoji = "💸";
    if (interpret.dados && interpret.dados.categoria) {
      const categoria = interpret.dados.categoria.toLowerCase();
      emoji = emojisPorCategoria[categoria] || emoji;
    }
    msg = `${emoji} ${msg}`;
    // Se o valor for um gasto mais alto, adiciona uma dica
    if (interpret.dados && parseFloat(interpret.dados.valor) > 500) {
      msg += " 💡 Dica: analise este gasto para verificar se há alternativas que possam economizar seu orçamento.";
    }
    // Caso a descrição mencione 'freelancer', elogia o esforço
    if (interpret.dados && interpret.dados.descricao &&
        interpret.dados.descricao.toLowerCase().includes("freelancer")) {
      msg += " 🚀 Parabéns pelo trabalho freelance!";
    }
  } else if (interpret.acao === "consultar_saldo") {
    msg = `📊 ${msg}`;
  } else if (interpret.acao === "adicionar_compromisso") {
    msg = `📅 ${msg} Lembre-se de manter sua agenda organizada!`;
  }
  
  return msg;
}
// =================================================================
// Atualização da função processarMensagem para usar a resposta personalizada
// =================================================================
function processarMensagem(numero, mensagem) {
  try {
    Logger.log('🔄 Iniciando processamento para número: %s', numero);
  
    let interpret;
    try {
      interpret = interpretarComGPT4(mensagem);
      Logger.log('📤 Ação identificada: %s, dados: %s', interpret.acao, JSON.stringify(interpret.dados));
    } catch (e) {
      Logger.log('❌ Erro ao interpretar mensagem: %s', e);
      enviarMensagemWhatsApp(numero, `❌ Erro de interpretação: ${e.message}`);
      return;
    }
  
    Logger.log('🔀 Executando ação: %s', interpret.acao);
  
    // Gera a mensagem personalizada, enriquecida com emojis e dicas
    const respostaPersonalizada = personalizarResposta(interpret);
  
    switch (interpret.acao) {
      case 'registrar_despesa':
        if (!interpret.dados.valor) {
          Logger.log('⚠️ Valor ausente para despesa');
          enviarMensagemWhatsApp(numero, '⚠️ Para registrar a despesa, informe um valor válido.');
        } else {
          Logger.log('💾 Registrando despesa: %s', JSON.stringify(interpret.dados));
          try {
            registrarDespesa(interpret.dados);
            Logger.log('✅ Despesa registrada com sucesso');
            enviarMensagemWhatsApp(numero, respostaPersonalizada);
          } catch (e) {
            Logger.log('❌ Erro ao registrar despesa: %s', e);
            enviarMensagemWhatsApp(numero, `❌ Erro ao registrar despesa: ${e.message}`);
          }
        }
        break;
  
      case 'registrar_receita':
        if (!interpret.dados.valor) {
          Logger.log('⚠️ Valor ausente para receita');
          enviarMensagemWhatsApp(numero, '⚠️ Para registrar a receita, informe um valor válido.');
        } else {
          Logger.log('💾 Registrando receita: %s', JSON.stringify(interpret.dados));
          try {
            registrarReceita(interpret.dados);
            Logger.log('✅ Receita registrada com sucesso');
            enviarMensagemWhatsApp(numero, respostaPersonalizada);
          } catch (e) {
            Logger.log('❌ Erro ao registrar receita: %s', e);
            enviarMensagemWhatsApp(numero, `❌ Erro ao registrar receita: ${e.message}`);
          }
        }
        break;
  
      case 'consultar_saldo':
        Logger.log('💰 Consultando saldo...');
        try {
          const saldo = consultarSaldo();
          Logger.log('📊 Saldo consultado: R$ %s', saldo);
          enviarMensagemWhatsApp(numero, `📊 Seu saldo atual é de R$ ${saldo}`);
        } catch (e) {
          Logger.log('❌ Erro ao consultar saldo: %s', e);
          enviarMensagemWhatsApp(numero, `❌ Erro ao consultar saldo: ${e.message}`);
        }
        break;
  
      case 'adicionar_compromisso':
        if (!interpret.dados.data || !interpret.dados.hora) {
          Logger.log('⚠️ Data/hora ausentes para compromisso');
          enviarMensagemWhatsApp(numero, '⚠️ Informe a data e a hora para agendar o compromisso.');
        } else {
          Logger.log('📅 Adicionando compromisso: %s', JSON.stringify(interpret.dados));
          try {
            adicionarCompromisso(interpret.dados);
            Logger.log('✅ Compromisso registrado na planilha');
            try {
              adicionarEventoCalendario(interpret.dados);
              Logger.log('✅ Compromisso registrado no Google Calendar');
              enviarMensagemWhatsApp(numero, '📅 Compromisso agendado com sucesso na planilha e no Google Calendar!');
            } catch (calendarError) {
              Logger.log('⚠️ Erro ao adicionar no Google Calendar: %s', calendarError);
              enviarMensagemWhatsApp(numero, '📅 Compromisso registrado na planilha! (Falha ao sincronizar com o Calendar)');
            }
          } catch (e) {
            Logger.log('❌ Erro ao registrar compromisso: %s', e);
            enviarMensagemWhatsApp(numero, `❌ Erro ao registrar compromisso: ${e.message}`);
          }
        }
        break;
  
      default:
        Logger.log('🤔 Comando não reconhecido. Texto livre retornado: %s', respostaPersonalizada);
        enviarMensagemWhatsApp(numero, respostaPersonalizada || '🤖 Desculpe, não entendi. Tente reformular sua mensagem.');
    }
  
  } catch (e) {
    Logger.log('❌ Erro geral no processamento: %s', e);
    Logger.log('📛 Stack trace:\n%s', e.stack);
    try {
      enviarMensagemWhatsApp(numero, `❌ Erro no processamento da mensagem: ${e.message}`);
    } catch (sendError) {
      Logger.log('❌ Falha ao enviar mensagem de erro: %s', sendError);
    }
  }
}

// =================================================================
// Funções de planilha
// =================================================================
function formatarDataHoraEvento(dataStr, horaStr) {
  try {
    Logger.log('🔄 Formatando data e hora: %s %s', dataStr, horaStr);
    
    // Converter formato DD/MM/YYYY para Date
    const partesData = dataStr.split('/');
    if (partesData.length !== 3) {
      throw new Error(`Formato de data inválido: ${dataStr}. Use DD/MM/YYYY.`);
    }
    
    const dia = parseInt(partesData[0], 10);
    const mes = parseInt(partesData[1], 10) - 1; // Mês em JS começa em 0
    const ano = parseInt(partesData[2], 10);
    
    // Verificar se os valores são válidos
    if (isNaN(dia) || isNaN(mes) || isNaN(ano) || dia < 1 || dia > 31 || mes < 0 || mes > 11) {
      throw new Error(`Valores de data inválidos: ${dataStr}`);
    }
    
    // Converter formato HH:MM para horas e minutos
    const partesHora = horaStr.split(':');
    if (partesHora.length !== 2) {
      throw new Error(`Formato de hora inválido: ${horaStr}. Use HH:MM.`);
    }
    
    const hora = parseInt(partesHora[0], 10);
    const minuto = parseInt(partesHora[1], 10);
    
    // Verificar se os valores são válidos
    if (isNaN(hora) || isNaN(minuto) || hora < 0 || hora > 23 || minuto < 0 || minuto > 59) {
      throw new Error(`Valores de hora inválidos: ${horaStr}`);
    }
    
    // Criar objeto de data para início
    const dataInicio = new Date(ano, mes, dia, hora, minuto);
    
    // Criar objeto de data para fim (padrão: 1 hora depois)
    const dataFim = new Date(dataInicio.getTime() + 60 * 60 * 1000);
    
    Logger.log('✅ Data e hora formatadas: Início=%s, Fim=%s', dataInicio, dataFim);
    
    return {
      inicio: dataInicio,
      fim: dataFim
    };
  } catch (e) {
    Logger.log('❌ Erro ao formatar data e hora: %s', e);
    Logger.log('❌ Stack trace: %s', e.stack);
    throw new Error(`Formato de data ou hora inválido: ${dataStr} ${horaStr}. Erro: ${e.message}`);
  }
}

// =================================================================
// Teste de comunicação Twilio
// =================================================================
function simularRecebimentoMensagem(numero, mensagem) {
  try {
    Logger.log('🔄 Simulando recebimento de mensagem');
    Logger.log('📱 Número: %s', numero);
    Logger.log('💬 Mensagem: %s', mensagem);
    
    // Formata o número para o formato esperado pelo webhook
    const numeroFormatado = numero.startsWith('+') ? numero : `+${numero}`;
    const fromFull = `whatsapp:${numeroFormatado}`;
    
    // Simula o objeto de parâmetros do webhook
    const e = {
      parameter: {
        From: fromFull,
        Body: mensagem
      }
    };
    
    // Chama a função doPost como se fosse um webhook real
    Logger.log('📤 Chamando doPost com parâmetros simulados');
    const response = doPost(e);
    
    Logger.log('✅ Simulação concluída');
    return { success: true, response };
  } catch (e) {
    Logger.log('❌ Erro na simulação de recebimento de mensagem: %s', e);
    Logger.log('❌ Stack trace: %s', e.stack);
    return { success: false, error: e.toString() };
  }
}
