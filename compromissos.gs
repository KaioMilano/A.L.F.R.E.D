function adicionarCompromisso(dados) {
  try {
    Logger.log('📊 Abrindo planilha para adicionar compromisso');
    const planilha = SpreadsheetApp.openById(PLANILHA_ID);
    
    if (!planilha) {
      Logger.log('❌ Planilha não encontrada: %s', PLANILHA_ID);
      throw new Error('Planilha não encontrada');
    }
    
    const sheet = planilha.getSheetByName('Agenda');
    
    if (!sheet) {
      Logger.log('❌ Aba "Agenda" não encontrada');
      throw new Error('Aba "Agenda" não encontrada');
    }
    
    Logger.log('📝 Adicionando compromisso: %s', JSON.stringify(dados));
    sheet.appendRow([dados.data, dados.hora, dados.titulo || '', dados.descricao || '']);
    Logger.log('✅ Compromisso adicionado com sucesso');
    return true;
  } catch (e) {
    Logger.log('❌ Erro ao adicionar compromisso: %s', e);
    Logger.log('❌ Stack trace: %s', e.stack);
    throw new Error(`Erro ao adicionar compromisso: ${e.message}`);
  }
}

// =================================================================
// Funções de Google Calendar
// =================================================================
function adicionarEventoCalendario(dados) {
  try {
    Logger.log('📅 Adicionando evento ao Google Calendar');
    
    // Formatar a data e hora
    const dataHora = formatarDataHoraEvento(dados.data, dados.hora);
    
    // Criar o evento
    const evento = CalendarApp.getDefaultCalendar().createEvent(
      dados.titulo || 'Compromisso',
      dataHora.inicio,
      dataHora.fim,
      {
        description: dados.descricao || '',
        location: dados.local || ''
      }
    );
    
    Logger.log('✅ Evento adicionado ao Calendar com ID: %s', evento.getId());
    return {
      success: true,
      eventoId: evento.getId(),
      titulo: evento.getTitle(),
      inicio: evento.getStartTime(),
      fim: evento.getEndTime()
    };
  } catch (e) {
    Logger.log('❌ Erro ao adicionar evento ao Calendar: %s', e);
    Logger.log('❌ Stack trace: %s', e.stack);
    throw new Error(`Erro ao adicionar evento ao Calendar: ${e.message}`);
  }
}

// Função auxiliar para formatar data e hora
function testarIntegracaoCalendar() {
  try {
    Logger.log('🔄 Iniciando teste de integração com Google Calendar');
    
    const dadosTeste = {
      data: '01/06/2025',
      hora: '10:00',
      titulo: '[TESTE] Evento de teste via Alfred',
      descricao: 'Este é um evento de teste criado pelo Alfred',
      local: 'Online'
    };
    
    Logger.log('📅 Tentando adicionar evento de teste ao Calendar');
    const resultado = adicionarEventoCalendario(dadosTeste);
    Logger.log('✅ Teste de integração com Calendar bem-sucedido: %s', JSON.stringify(resultado));
    
    return { 
      success: true, 
      resultado,
      mensagem: 'Evento de teste adicionado com sucesso ao Google Calendar'
    };
  } catch (e) {
    Logger.log('❌ Erro no teste de integração com Calendar: %s', e);
    Logger.log('❌ Stack trace: %s', e.stack);
    return { 
      success: false, 
      error: e.toString(),
      mensagem: `Erro ao adicionar evento ao Calendar: ${e.message}`
    };
  }
}

// =================================================================
// Simulação de recebimento de mensagem (para testes)
// =================================================================
