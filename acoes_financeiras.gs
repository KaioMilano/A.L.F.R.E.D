function registrarDespesa(dados) {
  try {
    Logger.log('📊 Abrindo planilha para registrar despesa');
    const planilha = SpreadsheetApp.openById(PLANILHA_ID);
    
    if (!planilha) {
      Logger.log('❌ Planilha não encontrada: %s', PLANILHA_ID);
      throw new Error('Planilha não encontrada');
    }
    
    const sheet = planilha.getSheetByName('Finanças - Despesas');
    
    if (!sheet) {
      Logger.log('❌ Aba "Finanças - Despesas" não encontrada');
      throw new Error('Aba "Finanças - Despesas" não encontrada');
    }
    
    Logger.log('📝 Registrando despesa: %s', JSON.stringify(dados));
    sheet.appendRow([new Date(), dados.descricao, dados.categoria, dados.valor]);
    Logger.log('✅ Despesa registrada com sucesso');
    return true;
  } catch (e) {
    Logger.log('❌ Erro ao registrar despesa: %s', e);
    Logger.log('❌ Stack trace: %s', e.stack);
    throw new Error(`Erro ao registrar despesa: ${e.message}`);
  }
}

function registrarReceita(dados) {
  try {
    Logger.log('📊 Abrindo planilha para registrar receita');
    const planilha = SpreadsheetApp.openById(PLANILHA_ID);
    
    if (!planilha) {
      Logger.log('❌ Planilha não encontrada: %s', PLANILHA_ID);
      throw new Error('Planilha não encontrada');
    }
    
    const sheet = planilha.getSheetByName('Finanças - Receitas');
    
    if (!sheet) {
      Logger.log('❌ Aba "Finanças - Receitas" não encontrada');
      throw new Error('Aba "Finanças - Receitas" não encontrada');
    }
    
    Logger.log('📝 Registrando receita: %s', JSON.stringify(dados));
    sheet.appendRow([new Date(), dados.descricao, dados.categoria, dados.valor]);
    Logger.log('✅ Receita registrada com sucesso');
    return true;
  } catch (e) {
    Logger.log('❌ Erro ao registrar receita: %s', e);
    Logger.log('❌ Stack trace: %s', e.stack);
    throw new Error(`Erro ao registrar receita: ${e.message}`);
  }
}

function consultarSaldo() {
  try {
    Logger.log('📊 Abrindo planilha para consultar saldo');
    const planilha = SpreadsheetApp.openById(PLANILHA_ID);
    
    if (!planilha) {
      Logger.log('❌ Planilha não encontrada: %s', PLANILHA_ID);
      throw new Error('Planilha não encontrada');
    }
    
    const sheet = planilha.getSheetByName('Dashboard');
    
    if (!sheet) {
      Logger.log('❌ Aba "Dashboard" não encontrada');
      throw new Error('Aba "Dashboard" não encontrada');
    }
    
    const valor = sheet.getRange('B3').getValue();
    Logger.log('💰 Saldo consultado: %s', valor);
    return parseFloat(valor).toFixed(2);
  } catch (e) {
    Logger.log('❌ Erro ao consultar saldo: %s', e);
    Logger.log('❌ Stack trace: %s', e.stack);
    throw new Error(`Erro ao consultar saldo: ${e.message}`);
  }
}
