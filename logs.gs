function registrarLogMensagem(tipo, numero, mensagem, sucesso = true) {
  try {
    const planilha = SpreadsheetApp.openById(PLANILHA_ID);
    
    // Verifica se a aba de logs existe, se não, cria
    let abaLogs = planilha.getSheetByName('Logs de Mensagens');
    if (!abaLogs) {
      abaLogs = planilha.insertSheet('Logs de Mensagens');
      abaLogs.appendRow(['Data/Hora', 'Tipo', 'Número', 'Mensagem', 'Status']);
      abaLogs.getRange('A1:E1').setFontWeight('bold');
    }
    
    // Registra o log
    abaLogs.appendRow([
      new Date(), 
      tipo, 
      numero, 
      mensagem, 
      sucesso ? 'Sucesso' : 'Falha'
    ]);
    
    Logger.log('📝 Log de mensagem registrado: %s para %s', tipo, numero);
    return true;
  } catch (e) {
    Logger.log('❌ Erro ao registrar log de mensagem: %s', e);
    return false;
  }
}

// =================================================================
// GPT-4 para interpretar comandos
// =================================================================
