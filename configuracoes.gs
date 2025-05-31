// =================================================================
// ALFRED: WhatsApp Bot using Twilio + Google Apps Script + GPT-4
// =================================================================

// === CONFIGURAÇÕES ===
// Defina estas Propriedades do Script via Arquivo > Propriedades do projeto > Propriedades do script
// PLANILHA_ID           : ID da sua planilha Google Sheets com abas: "Finanças - Despesas", "Finanças - Receitas", "Dashboard", "Agenda"
// INSTRUCOES_DOC_ID     : ID do Google Doc que contém as instruções do sistema para o ChatGPT
// OPENAI_API_KEY        : Sua chave de API da OpenAI (GPT-4)
// TWILIO_ACCOUNT_SID    : Seu Account SID do Twilio
// TWILIO_AUTH_TOKEN     : Seu Auth Token do Twilio
// TWILIO_WHATSAPP_NUMBER: Número do Twilio Sandbox ou número de produção, no formato 'whatsapp:+<código>'
// TWILIO_TEMPLATE_SID   : SID do modelo de conteúdo (template) para testes de mensagens iniciadas pela empresa

const PLANILHA_ID            = PropertiesService.getScriptProperties().getProperty('PLANILHA_ID');
const INSTRUCOES_DOC_ID      = PropertiesService.getScriptProperties().getProperty('INSTRUCOES_DOC_ID');
const OPENAI_API_KEY         = PropertiesService.getScriptProperties().getProperty('OPENAI_API_KEY');
const TWILIO_ACCOUNT_SID     = PropertiesService.getScriptProperties().getProperty('TWILIO_ACCOUNT_SID');
const TWILIO_AUTH_TOKEN      = PropertiesService.getScriptProperties().getProperty('TWILIO_AUTH_TOKEN');
const TWILIO_WHATSAPP_NUMBER = PropertiesService.getScriptProperties().getProperty('TWILIO_WHATSAPP_NUMBER');
const TWILIO_TEMPLATE_SID    = PropertiesService.getScriptProperties().getProperty('TWILIO_TEMPLATE_SID');

function validarConfiguracao() {
  const props = { PLANILHA_ID, INSTRUCOES_DOC_ID, OPENAI_API_KEY, TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_WHATSAPP_NUMBER };
  for (let key in props) {
    if (!props[key]) {
      throw new Error(`Propriedade do script "${key}" não configurada. Verifique as Propriedades do projeto.`);
    }
  }
}

// =================================================================
// Webhook de entrada do Twilio (mensagens recebidas)
// =================================================================
function enviarMensagemWhatsApp(numeroDestino, mensagem) {
  try {
    validarConfiguracao();
    
    Logger.log('📤 Tentando enviar mensagem para %s: %s', numeroDestino, mensagem);
    
    // Garante que o número de origem (TWILIO_WHATSAPP_NUMBER) tenha o prefixo "whatsapp:"
    const fromNumber = TWILIO_WHATSAPP_NUMBER.startsWith('whatsapp:') 
      ? TWILIO_WHATSAPP_NUMBER 
      : `whatsapp:${TWILIO_WHATSAPP_NUMBER}`;
    
    // Garante que o número de destino tenha o formato internacional com o "+" e o prefixo "whatsapp:"
    let toNumber = numeroDestino.replace(/^\+?/, '+');
    toNumber = toNumber.startsWith('whatsapp:') ? toNumber : `whatsapp:${toNumber}`;
    
    Logger.log('📞 Números formatados - De: %s, Para: %s', fromNumber, toNumber);
    
    const url = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`;
    const payload = { 
      From: fromNumber, 
      To: toNumber, 
      Body: mensagem 
    };
    
    const options = {
      method: 'post',
      payload,
      headers: { Authorization: 'Basic ' + Utilities.base64Encode(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`) },
      muteHttpExceptions: true
    };
    
    const resp = UrlFetchApp.fetch(url, options);
    const code = resp.getResponseCode();
    const txt = resp.getContentText();
    
    Logger.log('📤 Twilio response code: %s', code);
    Logger.log('📤 Twilio response body: %s', txt);
    
    // Registrar a mensagem enviada em um log específico
    registrarLogMensagem('enviada', numeroDestino, mensagem, code === 201);
    
    if (code !== 201) {
      Logger.log('❌ Envio falhou, status: %s', code);
      return { success: false, code, response: txt };
    }
    
    return { success: true, code, response: txt };
  } catch (e) {
    Logger.log('❌ Exceção no envio Twilio: %s', e);
    Logger.log('❌ Stack trace: %s', e.stack);
    return { success: false, error: e.toString() };
  }
}

// =================================================================
// Função para registrar logs de mensagens
// =================================================================
function obterOrientacoesComportamento() {
  try {
    validarConfiguracao();
    const doc = DocumentApp.openById(INSTRUCOES_DOC_ID);
    if (!doc) {
      Logger.log('⚠️ Documento de instruções não encontrado: %s', INSTRUCOES_DOC_ID);
      throw new Error('Documento de instruções não encontrado');
    }
    
    const texto = doc.getBody().getText();
    Logger.log('📑 Instruções carregadas: %s caracteres', texto.length);
    return texto;
  } catch (e) {
    Logger.log('❌ Erro ao obter instruções: %s', e);
    Logger.log('❌ Stack trace: %s', e.stack);
    throw new Error(`Erro ao obter instruções: ${e.message}`);
  }
}

// =================================================================
// Correção para uso das instruções do Google Docs no comportamento do assistente
// =================================================================

function interpretarComGPT4(mensagem) {
  try {
    if (!mensagem || mensagem.trim() === '') {
      Logger.log('⚠️ Mensagem vazia para interpretação');
      throw new Error('Mensagem vazia.');
    }

    Logger.log('🧠 Enviando mensagem para GPT-4: %s', mensagem);

    // Obter instruções do documento configurado
    const instrucoes = obterOrientacoesComportamento();
    Logger.log('📑 Instruções carregadas do documento: %s caracteres', instrucoes.length);

    // Adicionar contexto de personalização às instruções do documento
    const instrucoesCompletas = `
      ${instrucoes}
      
      DIRETRIZES ADICIONAIS DE PERSONALIZAÇÃO:
      - Adicione emojis relevantes ao contexto (2-3 por mensagem)
      - Adapte o tom conforme o período do dia (bom dia/boa tarde/boa noite)
      - Para RECEITAS: Celebre a conquista com emojis ✨💰🎉 e frases motivadoras
      - Para DESPESAS: Use emojis da categoria e ofereça uma dica útil relacionada
      - Para CONSULTAS: Apresente o saldo com clareza e adicione um comentário sobre a situação financeira
      - Para COMPROMISSOS: Confirme o agendamento e adicione uma nota sobre organização
      
      Responda sempre com o formato JSON, com os campos "acao", "dados" e "mensagem".
    `;

    const response = UrlFetchApp.fetch('https://api.openai.com/v1/chat/completions', {
      method: 'post',
      contentType: 'application/json',
      headers: { Authorization: `Bearer ${OPENAI_API_KEY}` },
      payload: JSON.stringify({
        model: 'gpt-4',
        messages: [
          { role: 'system', content: instrucoesCompletas },
          { role: 'user', content: mensagem }
        ],
        temperature: 0.3
      }),
      muteHttpExceptions: true
    });
    
    const responseCode = response.getResponseCode();
    const responseText = response.getContentText();
    Logger.log('📡 Código de resposta GPT-4: %s', responseCode);

    if (responseCode !== 200) {
      Logger.log('❌ Erro na API do OpenAI: %s', responseText);
      throw new Error(`Erro na API do OpenAI: ${responseCode}`);
    }

    const data = JSON.parse(responseText);
    const conteudoResposta = data.choices?.[0]?.message?.content?.trim();

    if (!conteudoResposta) {
      Logger.log('❌ Resposta da OpenAI sem conteúdo útil: %s', responseText);
      throw new Error('Resposta vazia da OpenAI.');
    }

    Logger.log('🧠 Conteúdo retornado pelo GPT-4:\n%s', conteudoResposta);

    try {
      const parsed = JSON.parse(conteudoResposta);
      if (!parsed.acao) {
        Logger.log('⚠️ JSON válido, mas campo "acao" ausente: %s', conteudoResposta);
        throw new Error('Campo "acao" ausente.');
      }
      Logger.log('✅ Interpretação JSON bem-sucedida: %s', JSON.stringify(parsed));
      return parsed;
    } catch (jsonError) {
      Logger.log('⚠️ Conteúdo não é JSON válido. Tratando como texto livre.');
      return {
        acao: 'texto_livre',
        dados: { texto: conteudoResposta },
        mensagem: conteudoResposta
      };
    }
  } catch (e) {
    Logger.log('🚨 Erro ao interpretar com GPT-4: %s', e.message);
    Logger.log('📛 Stack trace:\n%s', e.stack);
    throw new Error(`Erro ao interpretar com GPT-4: ${e.message}`);
  }
}

// =================================================================
// Nova função para personalizar a resposta com emojis e dicas contextuais
// =================================================================
function testarComunicacaoTwilio() {
  try {
    validarConfiguracao();
    Logger.log('🔄 Iniciando teste de comunicação Twilio');
    
    // Usando seu número para teste
    const resultado = enviarMensagemWhatsApp('+5519999198966', 'Teste Twilio OK ✅');
    Logger.log('📊 Resultado do teste: %s', JSON.stringify(resultado));
    return resultado;
  } catch (e) {
    Logger.log('❌ Erro no teste de comunicação Twilio: %s', e);
    Logger.log('❌ Stack trace: %s', e.stack);
    return { success: false, error: e.toString() };
  }
}

// =================================================================
// Teste de resposta do ChatGPT e leitura do Doc de instruções
// =================================================================
function testarInteracaoGPT() {
  try {
    validarConfiguracao();
    Logger.log('🔄 Iniciando teste de interação com GPT');
    
    const instrucoes = obterOrientacoesComportamento();
    Logger.log('📑 Instruções do Doc: %s caracteres', instrucoes.length);
    
    const teste = interpretarComGPT4('Por favor, retorne um JSON com {"acao":"teste","dados":{}}');
    Logger.log('🧠 Resposta de teste do GPT: %s', JSON.stringify(teste));
    return teste;
  } catch (e) {
    Logger.log('❌ Erro no teste de interação GPT: %s', e);
    Logger.log('❌ Stack trace: %s', e.stack);
    return { success: false, error: e.toString() };
  }
}

// =================================================================
// Teste de envio de template no Twilio Sandbox/Produção
// =================================================================
function testarTemplateTwilio() {
  try {
    validarConfiguracao();
    Logger.log('🔄 Iniciando teste de template Twilio');
    
    if (!TWILIO_TEMPLATE_SID) {
      Logger.log('❌ Propriedade TWILIO_TEMPLATE_SID não configurada');
      throw new Error('Propriedade TWILIO_TEMPLATE_SID não configurada.');
    }
    
    // Usando seu número para teste
    const to = '+5519999198966';
    
    // Garante que o número de origem tenha o prefixo "whatsapp:"
    const fromNumber = TWILIO_WHATSAPP_NUMBER.startsWith('whatsapp:') 
      ? TWILIO_WHATSAPP_NUMBER 
      : `whatsapp:${TWILIO_WHATSAPP_NUMBER}`;
    
    // Garante que o número de destino tenha o prefixo "whatsapp:"
    const toNumber = `whatsapp:${to}`;
    
    Logger.log('📞 Números formatados - De: %s, Para: %s', fromNumber, toNumber);
    
    const vars = JSON.stringify({"1":"12/05","2":"15:00"});
    const url = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`;
    const payload = {
      From: fromNumber,
      To: toNumber,
      ContentSid: TWILIO_TEMPLATE_SID,
      ContentVariables: vars
    };
    
    const options = { 
      method: 'post', 
      payload, 
      headers: { Authorization: 'Basic ' + Utilities.base64Encode(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`) }, 
      muteHttpExceptions: true 
    };
    
    const resp = UrlFetchApp.fetch(url, options);
    const code = resp.getResponseCode();
    const txt = resp.getContentText();
    Logger.log('📤 Template send code: %s', code);
    Logger.log('📤 Template send body: %s', txt);
    return { success: code === 201, code, response: txt };
  } catch (e) {
    Logger.log('❌ Erro no teste de template Twilio: %s', e);
    Logger.log('❌ Stack trace: %s', e.stack);
    return { success: false, error: e.toString() };
  }
}

// =================================================================
// Verificação de configuração do Twilio
// =================================================================
function verificarConfiguracaoTwilio() {
  try {
    validarConfiguracao();
    Logger.log('🔄 Iniciando verificação de configuração Twilio');
    
    // Verifica se o número do Twilio está no formato correto
    const twilioNumber = TWILIO_WHATSAPP_NUMBER;
    const formatoCorreto = twilioNumber.startsWith('whatsapp:+');
    
    Logger.log('🔍 Verificação de configuração Twilio:');
    Logger.log('- Número Twilio: %s', twilioNumber);
    Logger.log('- Formato correto: %s', formatoCorreto ? 'Sim ✅' : 'Não ❌');
    
    if (!formatoCorreto) {
      Logger.log('⚠️ ATENÇÃO: O número do Twilio deve estar no formato "whatsapp:+14155238886"');
      Logger.log('⚠️ Formato atual: %s', twilioNumber);
      Logger.log('⚠️ Formato correto seria: whatsapp:+%s', twilioNumber.replace(/^whatsapp:|\+/g, ''));
    }
    
    return {
      twilioNumber,
      formatoCorreto,
      formatoRecomendado: `whatsapp:+${twilioNumber.replace(/^whatsapp:|\+/g, '')}`
    };
  } catch (e) {
    Logger.log('❌ Erro na verificação de configuração Twilio: %s', e);
    Logger.log('❌ Stack trace: %s', e.stack);
    return { success: false, error: e.toString() };
  }
}

// =================================================================
// Teste de comunicação com a planilha
// =================================================================
function testarComunicacaoPlanilha() {
  try {
    validarConfiguracao();
    Logger.log('🔄 Iniciando teste de comunicação com a planilha');
    
    const resultados = {
      planilhaEncontrada: false,
      abasDespesas: false,
      abasReceitas: false,
      abaDashboard: false,
      abaAgenda: false,
      testeDespesa: false,
      testeReceita: false,
      testeSaldo: false,
      testeCompromisso: false
    };
    
    // Verifica se a planilha existe
    const planilha = SpreadsheetApp.openById(PLANILHA_ID);
    if (!planilha) {
      Logger.log('❌ Planilha não encontrada: %s', PLANILHA_ID);
      return { success: false, resultados, error: 'Planilha não encontrada' };
    }
    
    resultados.planilhaEncontrada = true;
    Logger.log('✅ Planilha encontrada: %s', planilha.getName());
    
    // Verifica se as abas existem
    const abaDespesas = planilha.getSheetByName('Finanças - Despesas');
    resultados.abasDespesas = !!abaDespesas;
    Logger.log('- Aba Finanças - Despesas: %s', resultados.abasDespesas ? 'Encontrada ✅' : 'Não encontrada ❌');
    
    const abaReceitas = planilha.getSheetByName('Finanças - Receitas');
    resultados.abasReceitas = !!abaReceitas;
    Logger.log('- Aba Finanças - Receitas: %s', resultados.abasReceitas ? 'Encontrada ✅' : 'Não encontrada ❌');
    
    const abaDashboard = planilha.getSheetByName('Dashboard');
    resultados.abaDashboard = !!abaDashboard;
    Logger.log('- Aba Dashboard: %s', resultados.abaDashboard ? 'Encontrada ✅' : 'Não encontrada ❌');
    
    const abaAgenda = planilha.getSheetByName('Agenda');
    resultados.abaAgenda = !!abaAgenda;
    Logger.log('- Aba Agenda: %s', resultados.abaAgenda ? 'Encontrada ✅' : 'Não encontrada ❌');
    
    // Testa o registro de despesa
    if (resultados.abasDespesas) {
      try {
        const dadosTeste = {
          descricao: '[TESTE] Despesa de teste',
          categoria: 'Teste',
          valor: 10.00
        };
        
        registrarDespesa(dadosTeste);
        resultados.testeDespesa = true;
        Logger.log('✅ Teste de registro de despesa bem-sucedido');
      } catch (e) {
        Logger.log('❌ Erro no teste de registro de despesa: %s', e);
        resultados.testeDespesa = false;
      }
    }
    
    // Testa o registro de receita
    if (resultados.abasReceitas) {
      try {
        const dadosTeste = {
          descricao: '[TESTE] Receita de teste',
          categoria: 'Teste',
          valor: 20.00
        };
        
        registrarReceita(dadosTeste);
        resultados.testeReceita = true;
        Logger.log('✅ Teste de registro de receita bem-sucedido');
      } catch (e) {
        Logger.log('❌ Erro no teste de registro de receita: %s', e);
        resultados.testeReceita = false;
      }
    }
    
    // Testa a consulta de saldo
    if (resultados.abaDashboard) {
      try {
        const saldo = consultarSaldo();
        resultados.testeSaldo = true;
        Logger.log('✅ Teste de consulta de saldo bem-sucedido: %s', saldo);
      } catch (e) {
        Logger.log('❌ Erro no teste de consulta de saldo: %s', e);
        resultados.testeSaldo = false;
      }
    }
    
    // Testa o registro de compromisso
    if (resultados.abaAgenda) {
      try {
        const dadosTeste = {
          data: '01/06/2025',
          hora: '10:00',
          titulo: '[TESTE] Compromisso de teste',
          descricao: 'Descrição de teste'
        };
        
        adicionarCompromisso(dadosTeste);
        resultados.testeCompromisso = true;
        Logger.log('✅ Teste de registro de compromisso bem-sucedido');
      } catch (e) {
        Logger.log('❌ Erro no teste de registro de compromisso: %s', e);
        resultados.testeCompromisso = false;
      }
    }
    
    // Resultado final
    const sucessoTotal = resultados.planilhaEncontrada && 
                         resultados.abasDespesas && 
                         resultados.abasReceitas && 
                         resultados.abaDashboard && 
                         resultados.abaAgenda && 
                         resultados.testeDespesa && 
                         resultados.testeReceita && 
                         resultados.testeSaldo && 
                         resultados.testeCompromisso;
    
    Logger.log('📊 Resultado final do teste de comunicação com a planilha: %s', sucessoTotal ? 'SUCESSO ✅' : 'FALHA ❌');
    
    return {
      success: sucessoTotal,
      resultados
    };
  } catch (e) {
    Logger.log('❌ Erro no teste de comunicação com a planilha: %s', e);
    Logger.log('❌ Stack trace: %s', e.stack);
    return { success: false, error: e.toString() };
  }
}

// =================================================================
// Teste de integração com Google Calendar
// =================================================================
