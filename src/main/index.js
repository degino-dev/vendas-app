// src/main/index.js
import { app, shell, BrowserWindow, ipcMain, nativeTheme } from 'electron'
import { join } from 'path'
import bcrypt from 'bcryptjs'
import { randomUUID } from 'crypto'
import {
  carregarVendedores, salvarVendedores,
  carregarDadosVendedor, salvarDadosVendedor,
  carregarVisaoGerente, migrarDadosAntigos, fazerBackup,
  caminhoArquivo, alterarCaminho,
  carregarEstadoInsights, salvarEstadoInsights,
  carregarConfigBackup, salvarConfigBackup,
  listarBackups, listarBackupsVendedor, listarBackupsGerais,
  restaurarBackupVendedor, restaurarBackupGeral,
  carregarChaveIA, salvarChaveIA
} from './storage'
import { gerarInsights, atualizarEstado, gerarEstatisticasCliente } from './insights'
import { autoUpdater } from 'electron-updater'
import { CHAVE_GEMINI } from './chave.js'

// --- Impede registrar o mesmo canal de IPC duas vezes (evita crash) ---
const canaisRegistrados = new Set()
function handleUnico(canal, fn) {
  if (canaisRegistrados.has(canal)) return
  canaisRegistrados.add(canal)
  ipcMain.handle(canal, fn)
}

// --- Utilitários ---
function capitalizarTexto(texto) {
  if (!texto) return ''
  const excecoes = ['da', 'de', 'do', 'das', 'dos', 'e', 'em', 'com', 'ltda', 'sa', 'me', 'epp']
  return String(texto)
    .toLowerCase()
    .trim()
    .split(/\s+/)
    .map((p) => {
      if (excecoes.includes(p)) return p
      return p.charAt(0).toUpperCase() + p.slice(1)
    })
    .join(' ')
    .replace(/\b(ltda|sa|me|epp)\b/gi, (m) => m.toUpperCase())
}

// Dados do vendedor logado (em memória durante a sessão)
let sessao = null // { id, nome, usuario, admin }
let mainWindow = null

// --- Login ---
handleUnico('auth:login', (_e, { usuario, senha }) => {
  const vendedores = carregarVendedores()
  const vendedor = vendedores.find((v) => v.usuario.toLowerCase() === usuario.toLowerCase())
  if (!vendedor) return { ok: false, erro: 'Usuário não encontrado' }
  if (!bcrypt.compareSync(senha, vendedor.senhaHash)) return { ok: false, erro: 'Senha incorreta' }
  sessao = { id: vendedor.id, nome: vendedor.nome, usuario: vendedor.usuario, admin: !!vendedor.admin }
  const { senhaHash, ...seguro } = vendedor
  return { ok: true, vendedor: seguro }
})

// --- Vendedores (admin) ---
handleUnico('vendedores:criar', (_e, { nome, usuario, senha, admin, metaMensal, metaSemanal }) => {
  const vendedores = carregarVendedores()
  if (vendedores.some((v) => v.usuario.toLowerCase() === usuario.toLowerCase())) {
    return { ok: false, erro: 'Usuário já existe' }
  }
  const novo = {
    id: randomUUID(),
    nome: capitalizarTexto(nome),
    usuario,
    senhaHash: bcrypt.hashSync(senha, 10),
    admin: !!admin,
    metaMensal: Number(metaMensal) || 100000,
    metaSemanal: Number(metaSemanal) || 25000
  }
  vendedores.push(novo)
  salvarVendedores(vendedores)
  const { senhaHash, ...seguro } = novo
  return { ok: true, vendedor: seguro }
})
handleUnico('vendedores:atualizar', (_e, vendedor) => {
  const vendedores = carregarVendedores()
  const idx = vendedores.findIndex((v) => v.id === vendedor.id)
  if (idx === -1) return { ok: false, erro: 'Vendedor não encontrado' }
  if (vendedores.some((v) => v.id !== vendedor.id && v.usuario.toLowerCase() === vendedor.usuario.toLowerCase())) {
    return { ok: false, erro: 'Usuário já existe' }
  }
  const atual = vendedores[idx]
  const senhaHash = vendedor.senha ? bcrypt.hashSync(vendedor.senha, 10) : atual.senhaHash
  vendedores[idx] = {
    ...atual,
    nome: capitalizarTexto(vendedor.nome),
    usuario: vendedor.usuario,
    admin: !!vendedor.admin,
    metaMensal: Number(vendedor.metaMensal) || 100000,
    metaSemanal: Number(vendedor.metaSemanal) || 25000,
    senhaHash
  }
  salvarVendedores(vendedores)
  const { senhaHash: sh, ...seguro } = vendedores[idx]
  return { ok: true, vendedor: seguro }
})
handleUnico('vendedores:listar', () => {
  return carregarVendedores().map(({ senhaHash, ...v }) => v)
})
handleUnico('vendedores:deletar', (_e, id) => {
  if (id === 'admin') return { ok: false, erro: 'Não é possível excluir o admin principal' }
  let vendedores = carregarVendedores()
  vendedores = vendedores.filter((v) => v.id !== id)
  salvarVendedores(vendedores)
  return { ok: true }
})

// --- Acesso aos dados conforme o perfil (leitura) ---
function dadosParaPerfil() {
  if (sessao && sessao.admin) return carregarVisaoGerente()
  if (sessao) {
    const d = carregarDadosVendedor(sessao.id)
    return {
      vendedores: carregarVendedores(),
      clientes: d.clientes,
      vendas: d.vendas,
      orcamentosPerdidos: d.orcamentosPerdidos,
      metaMensal: 100000
    }
  }
  return { vendedores: [], clientes: [], vendas: [], orcamentosPerdidos: [], metaMensal: 100000 }
}

// --- Mutação: SEMPRE no arquivo do vendedor logado ---
function dadosDoVendedor() {
  return carregarDadosVendedor(sessao.id)
}

// --- Clientes ---
handleUnico('clientes:listar', (_e, vendedorId) => {
  const dados = dadosParaPerfil()
  if (sessao && !sessao.admin) return dados.clientes
  if (vendedorId) return dados.clientes.filter((c) => c.vendedorId === vendedorId)
  return dados.clientes
})
handleUnico('clientes:criar', (_e, cliente) => {
  if (!sessao) return { ok: false, erro: 'Não autenticado' }
  const dados = dadosDoVendedor()
  const codigo = Number(cliente.codigo)
  if (dados.clientes.some((c) => Number(c.codigo) === codigo)) {
    return { ok: false, erro: `Já existe um cliente com o ID ${codigo}` }
  }
  const novo = {
    id: randomUUID(),
    codigo,
    nome: capitalizarTexto(cliente.nome),
    cnpj: cliente.cnpj || '',
    email: cliente.email || '',
    whats: cliente.whats || '',
    cidade: capitalizarTexto(cliente.cidade),
    segmento: capitalizarTexto(cliente.segmento),
    vendedorId: sessao.id,
    dataCadastro: cliente.dataCadastro || new Date().toISOString().slice(0, 10)
  }
  dados.clientes.push(novo)
  salvarDadosVendedor(sessao.id, dados)
  return { ok: true, cliente: novo }
})
handleUnico('clientes:atualizar', (_e, cliente) => {
  if (!sessao) return { ok: false, erro: 'Não autenticado' }
  const dados = dadosDoVendedor()
  const idx = dados.clientes.findIndex((c) => c.id === cliente.id)
  if (idx === -1) return { ok: false, erro: 'Cliente não encontrado' }
  const codigo = Number(cliente.codigo)
  if (dados.clientes.some((c) => c.id !== cliente.id && Number(c.codigo) === codigo)) {
    return { ok: false, erro: `Já existe um cliente com o ID ${codigo}` }
  }
  dados.clientes[idx] = {
    ...dados.clientes[idx],
    codigo,
    nome: capitalizarTexto(cliente.nome),
    cnpj: cliente.cnpj || '',
    email: cliente.email || '',
    whats: cliente.whats || '',
    cidade: capitalizarTexto(cliente.cidade),
    segmento: capitalizarTexto(cliente.segmento)
  }
  salvarDadosVendedor(sessao.id, dados)
  return { ok: true, cliente: dados.clientes[idx] }
})
handleUnico('clientes:deletar', (_e, id) => {
  if (!sessao) return { ok: false, erro: 'Não autenticado' }
  const dados = dadosDoVendedor()
  dados.clientes = dados.clientes.filter((c) => c.id !== id)
  salvarDadosVendedor(sessao.id, dados)
  return { ok: true }
})

// --- Vendas ---
handleUnico('vendas:listar', (_e, vendedorId) => {
  const dados = dadosParaPerfil()
  if (sessao && !sessao.admin) return dados.vendas
  if (vendedorId) return dados.vendas.filter((v) => v.vendedorId === vendedorId)
  return dados.vendas
})
handleUnico('vendas:listarPorMes', (_e, { vendedorId, ano, mes }) => {
  const dados = dadosParaPerfil()
  const alvo = String(ano) + '-' + String(mes).padStart(2, '0')
  let vendas = dados.vendas
  if (sessao && !sessao.admin) {
    // vendedor vê só as dele
  } else if (vendedorId) {
    vendas = vendas.filter((v) => v.vendedorId === vendedorId)
  }
  return vendas.filter((v) => String(v.data || '').slice(0, 7) === alvo)
})
handleUnico('vendas:criar', (_e, venda) => {
  if (!sessao) return { ok: false, erro: 'Não autenticado' }
  const dados = dadosDoVendedor()
  const nova = {
    id: randomUUID(),
    clienteId: venda.clienteId || '',
    vendedorId: sessao.id,
    envio: venda.envio || '',
    pedidoInsumos: venda.pedidoInsumos || '',
    valorInsumos: Number(venda.valorInsumos) || 0,
    pedidoEquipamento: venda.pedidoEquipamento || '',
    valorEquipamento: Number(venda.valorEquipamento) || 0,
    data: venda.data || new Date().toISOString().slice(0, 10),
    observacao: venda.observacao || ''
  }
  dados.vendas.push(nova)
  salvarDadosVendedor(sessao.id, dados)
  return { ok: true, venda: nova }
})
handleUnico('vendas:atualizar', (_e, venda) => {
  if (!sessao) return { ok: false, erro: 'Não autenticado' }
  const dados = dadosDoVendedor()
  const idx = dados.vendas.findIndex((v) => v.id === venda.id)
  if (idx === -1) return { ok: false, erro: 'Venda não encontrada' }
  const campos = ['clienteId', 'envio', 'pedidoInsumos', 'valorInsumos', 'pedidoEquipamento', 'valorEquipamento', 'data', 'observacao']
  const atual = dados.vendas[idx]
  campos.forEach((c) => {
    if (venda[c] !== undefined) {
      atual[c] = c.startsWith('valor') ? Number(venda[c]) || 0 : venda[c]
    }
  })
  salvarDadosVendedor(sessao.id, dados)
  return { ok: true, venda: atual }
})
handleUnico('vendas:deletar', (_e, id) => {
  if (!sessao) return { ok: false, erro: 'Não autenticado' }
  const dados = dadosDoVendedor()
  dados.vendas = dados.vendas.filter((v) => v.id !== id)
  salvarDadosVendedor(sessao.id, dados)
  return { ok: true }
})

// --- Orçamentos Perdidos ---
handleUnico('orcamentos:listar', (_e, vendedorId) => {
  const dados = dadosParaPerfil()
  if (sessao && !sessao.admin) return dados.orcamentosPerdidos
  if (vendedorId) return dados.orcamentosPerdidos.filter((o) => o.vendedorId === vendedorId)
  return dados.orcamentosPerdidos
})
handleUnico('orcamentos:criar', (_e, orcamento) => {
  if (!sessao) return { ok: false, erro: 'Não autenticado' }
  const dados = dadosDoVendedor()
  const novo = {
    id: randomUUID(),
    clienteId: orcamento.clienteId || '',
    vendedorId: sessao.id,
    produtos: orcamento.produtos || '',
    valor: Number(orcamento.valor) || 0,
    concorrente: orcamento.concorrente || '',
    motivo: orcamento.motivo || '',
    observacao: orcamento.observacao || '',
    data: orcamento.data || new Date().toISOString().slice(0, 10)
  }
  dados.orcamentosPerdidos.push(novo)
  salvarDadosVendedor(sessao.id, dados)
  return { ok: true, orcamento: novo }
})
handleUnico('orcamentos:deletar', (_e, id) => {
  if (!sessao) return { ok: false, erro: 'Não autenticado' }
  const dados = dadosDoVendedor()
  dados.orcamentosPerdidos = dados.orcamentosPerdidos.filter((o) => o.id !== id)
  salvarDadosVendedor(sessao.id, dados)
  return { ok: true }
})

// --- Insights (Dicas) ---
handleUnico('insights:gerar', () => {
  const dados = dadosParaPerfil()
  const estado = sessao ? carregarEstadoInsights(sessao.id) : { vistos: [], tratados: [], adiados: {} }
  return gerarInsights({
    clientes: dados.clientes,
    vendas: dados.vendas,
    orcamentosPerdidos: dados.orcamentosPerdidos,
    vendedores: dados.vendedores || [],
    estado
  })
})
handleUnico('insights:marcar', (_e, { acao, chave }) => {
  if (!sessao) return { ok: false, erro: 'Não autenticado' }
  const atual = carregarEstadoInsights(sessao.id)
  const novo = atualizarEstado(atual, acao, chave)
  salvarEstadoInsights(sessao.id, novo)
  return { ok: true, estado: novo }
})

// 
// INTELIGÊNCIA ARTIFICIAL — Gemini API (consultora de vendas)
// 

// Busca na API a lista REAL de modelos disponíveis para esta chave
async function listarModelosDisponiveis() {
  try {
    const res = await fetch(
      'https://generativelanguage.googleapis.com/v1beta/models?key=' + encodeURIComponent(CHAVE_GEMINI),
      { signal: AbortSignal.timeout(15000) }
    )
    if (!res.ok) return []
    const data = await res.json()
    const modelos = data.models || []
    return modelos
      .filter((m) => m.supportedGenerationMethods && m.supportedGenerationMethods.includes('generateContent'))
      .map((m) => m.name.replace('models/', ''))
  } catch (err) {
    console.error('Erro ao listar modelos:', err)
    return []
  }
}

// Calcula métricas de comportamento por cliente a partir das vendas
function calcularPadroesPorCliente(clientes, vendas) {
  const hoje = new Date()
  const porCliente = {}

  clientes.forEach((c) => {
    porCliente[c.id] = {
      nome: c.nome,
      cidade: c.cidade || '',
      segmento: c.segmento || '',
      vendas: [],
      valores: [],
      diasSemana: [],
      datas: []
    }
  })

  vendas.forEach((v) => {
    const cli = porCliente[v.clienteId]
    if (!cli) return
    const valor = Number(v.valorInsumos || 0) + Number(v.valorEquipamento || 0)
    cli.vendas.push(valor)
    cli.valores.push(valor)
    if (v.data) {
      cli.datas.push(v.data)
      const d = new Date(v.data + 'T00:00:00')
      if (!isNaN(d.getTime())) {
        const dias = ['domingo', 'segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado']
        cli.diasSemana.push(dias[d.getDay()])
      }
    }
  })

  const resultado = []
  Object.keys(porCliente).forEach((id) => {
    const c = porCliente[id]
    if (c.vendas.length === 0) return

    const total = c.valores.reduce((s, x) => s + x, 0)
    const ticketMedio = total / c.vendas.length

    const contagem = {}
    c.diasSemana.forEach((d) => { contagem[d] = (contagem[d] || 0) + 1 })
    let diaTop = ''
    let diaTopN = 0
    Object.keys(contagem).forEach((d) => {
      if (contagem[d] > diaTopN) { diaTopN = contagem[d]; diaTop = d }
    })

    let diasDesdeUltima = null
    if (c.datas.length > 0) {
      const ultima = new Date(c.datas[c.datas.length - 1] + 'T00:00:00')
      if (!isNaN(ultima.getTime())) {
        diasDesdeUltima = Math.round((hoje - ultima) / 86400000)
      }
    }

    let intervaloMedio = null
    if (c.datas.length >= 2) {
      const ordenadas = c.datas.map((d) => new Date(d + 'T00:00:00').getTime()).sort((a, b) => a - b)
      let soma = 0
      for (let i = 1; i < ordenadas.length; i++) soma += (ordenadas[i] - ordenadas[i - 1]) / 86400000
      intervaloMedio = Math.round(soma / (ordenadas.length - 1))
    }

    resultado.push({
      nome: c.nome,
      cidade: c.cidade,
      segmento: c.segmento,
      totalVendas: c.vendas.length,
      valorTotal: Math.round(total),
      ticketMedio: Math.round(ticketMedio),
      diaSemanaFrequente: diaTop || 'variado',
      intervaloDias: intervaloMedio,
      diasDesdeUltima: diasDesdeUltima
    })
  })

  resultado.sort((a, b) => b.valorTotal - a.valorTotal)
  return resultado
}

// Chama a API do Gemini como consultora de vendas
async function analisarComGemini(dados, perfilNome) {
  const padroes = calcularPadroesPorCliente(dados.clientes, dados.vendas)

  const resumo = {
    perfil: perfilNome,
    totalClientes: dados.clientes.length,
    totalVendas: dados.vendas.length,
    totalFaturado: dados.vendas.reduce((s, v) => s + Number(v.valorInsumos || 0) + Number(v.valorEquipamento || 0), 0),
    orcamentosPerdidos: dados.orcamentosPerdidos.length,
    padroesPorCliente: padroes
  }

  const prompt = `Você é um consultor de vendas sênior, com 20 anos de experiência, que ajuda vendedores a baterem a meta. Você analisa os dados da carteira e dá DICAS PRÁTICAS E ACIONÁVEIS — sempre dizendo o que o vendedor deve FAZER, com quem, e como.

Analise os padrões abaixo e gere 6 dicas de vendas. Para cada dica:
1. Diga EXATAMENTE qual cliente está envolvido (nome).
2. Explique o padrão encontrado com o dado concreto (frequência, valor, dias).
3. Dê a AÇÃO prática: o que fazer (ligar, visitar, enviar proposta, oferta especial, etc.) e quando.

Foque em:
- Clientes que PARARAM de comprar (churn): compare o intervalo médio entre compras com os dias desde a última compra. Se o cliente comprava a cada X dias e já passou disso, é URGENTE — dica de como recuperá-lo.
- Clientes que compram em dias específicos da semana: dica de contato nesse dia.
- Clientes com ticket médio alto: dica de como aumentar o valor (upsell/cross-sell).
- Clientes com alta frequência: dica de como fidelizar ainda mais.
- Clientes que compraram pouco mas têm potencial: dica de como desenvolver.
- Padrões por segmento ou cidade.

Não invente clientes ou números que não estão nos dados. Seja específico e direto, como um consultor experiente falando com um vendedor.

Dados:
${JSON.stringify(resumo, null, 2)}

Formato de resposta: apenas uma lista numerada de 1 a 6, cada dica em uma linha, sem texto adicional.`

  // 1) Pega a lista REAL de modelos que a chave pode usar
  const disponiveis = await listarModelosDisponiveis()
  if (disponiveis.length === 0) {
    return { ok: false, erro: 'Não foi possível listar os modelos da sua chave. Verifique a chave no Google AI Studio.' }
  }

  // 2) Prefere os modelos "flash" mais recentes, mas só os que existem na conta
  const preferidos = disponiveis.filter((m) => /flash/i.test(m))
  const fila = preferidos.length > 0 ? preferidos : disponiveis

  // 3) Tenta cada modelo até um funcionar
  let ultimoErro = ''
  for (const modelo of fila) {
    try {
      const res = await fetch(
        'https://generativelanguage.googleapis.com/v1beta/models/' + modelo + ':generateContent?key=' + encodeURIComponent(CHAVE_GEMINI),
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }]
          }),
          signal: AbortSignal.timeout(30000)
        }
      )
      if (!res.ok) {
        const texto = await res.text()
        ultimoErro = 'Erro na API do Gemini (' + res.status + '): ' + texto.slice(0, 200)
        continue
      }
      const data = await res.json()
      const texto = data.candidates && data.candidates[0] && data.candidates[0].content &&
        data.candidates[0].content.parts && data.candidates[0].content.parts[0].text
      return { ok: true, texto: texto || '' }
    } catch (err) {
      ultimoErro = 'Falha na conexão com a IA: ' + String(err)
    }
  }
  return { ok: false, erro: ultimoErro }
}

handleUnico('ia:analisar', async () => {
  if (!sessao) return { ok: false, erro: 'Não autenticado' }
  const dados = dadosParaPerfil()
  const perfilNome = sessao.admin ? 'Gerente (todos os vendedores)' : sessao.nome
  return analisarComGemini(dados, perfilNome)
})
// --- Backups (por vendedor + geral) ---
handleUnico('backup:listar', () => listarBackups())
handleUnico('backup:criar', () => {
  if (!sessao || !sessao.admin) return { ok: false, erro: 'Apenas o administrador pode criar backups' }
  return fazerBackup()
})
handleUnico('backup:listarVendedor', (_e, id) => {
  if (!sessao || !sessao.admin) return { ok: false, erro: 'Apenas o administrador pode listar backups' }
  return listarBackupsVendedor(id)
})
handleUnico('backup:listarGerais', () => {
  if (!sessao || !sessao.admin) return { ok: false, erro: 'Apenas o administrador pode listar backups' }
  return listarBackupsGerais()
})
handleUnico('backup:restaurarVendedor', (_e, { id, nome }) => {
  if (!sessao || !sessao.admin) return { ok: false, erro: 'Apenas o administrador pode restaurar backups' }
  return restaurarBackupVendedor(id, nome)
})
handleUnico('backup:restaurarGeral', (_e, nome) => {
  if (!sessao || !sessao.admin) return { ok: false, erro: 'Apenas o administrador pode restaurar backups' }
  return restaurarBackupGeral(nome)
})
handleUnico('backup:configCarregar', () => carregarConfigBackup())
handleUnico('backup:configSalvar', (_e, config) => {
  if (!sessao || !sessao.admin) return { ok: false, erro: 'Apenas o administrador pode alterar a configuração' }
  return salvarConfigBackup(config)
})

// --- Agendador do backup diário ---
function temBackupHoje() {
  const agora = new Date()
  const hojeStr =
    String(agora.getFullYear()) + '-' +
    String(agora.getMonth() + 1).padStart(2, '0') + '-' +
    String(agora.getDate()).padStart(2, '0')
  return listarBackups().some((b) => b.nome.indexOf('geral_' + hojeStr + '_') === 0)
}
function verificarBackupDiario() {
  try {
    const config = carregarConfigBackup()
    const agora = new Date()
    const hhmm =
      String(agora.getHours()).padStart(2, '0') + ':' +
      String(agora.getMinutes()).padStart(2, '0')
    if (hhmm >= config.horario && !temBackupHoje()) {
      fazerBackup()
    }
  } catch (err) {
    console.error('Erro no backup diário:', err)
  }
}

// --- Janela ---
handleUnico('janela:focar', (evento) => {
  const janela = BrowserWindow.fromWebContents(evento.sender)
  if (janela) {
    if (janela.isMinimized()) janela.restore()
    janela.show()
    janela.focus()
  }
  return { ok: true }
})

// --- Cidades (IBGE) ---
let cacheCidades = null
handleUnico('cidades:listar', async () => {
  if (cacheCidades) return cacheCidades
  try {
    const res = await fetch('https://servicodados.ibge.gov.br/api/v1/localidades/municipios')
    if (!res.ok) throw new Error('IBGE indisponível')
    const lista = await res.json()
    cacheCidades = lista.map((m) => ({
      nome: m.nome,
      uf: (m.microrregiao && m.microrregiao.mesorregiao && m.microrregiao.mesorregiao.UF && m.microrregiao.mesorregiao.UF.sigla) || ''
    }))
    return cacheCidades
  } catch (err) {
    console.error('Erro ao buscar cidades:', err)
    return []
  }
})

// --- Consulta CNPJ ---
handleUnico('cnpj:consultar', async (_e, cnpj) => {
  const limpo = String(cnpj || '').replace(/\D/g, '')
  if (limpo.length !== 14) return { ok: false, erro: 'CNPJ inválido' }
  const apis = [
    {
      nome: 'BrasilAPI',
      url: `https://brasilapi.com.br/api/cnpj/v1/${limpo}`,
      parse: (d) => ({ razaoSocial: d.razao_social, nomeFantasia: d.nome_fantasia || '' })
    }
  ]
  for (const api of apis) {
    try {
      const res = await fetch(api.url, { signal: AbortSignal.timeout(8000) })
      if (res.status === 404) continue
      if (!res.ok) continue
      const dados = await res.json()
      const parseado = api.parse(dados)
      if (parseado.razaoSocial) return { ok: true, fonte: api.nome, ...parseado }
    } catch (err) {
      console.error('Erro na consulta CNPJ', api.nome, err)
    }
  }
  return { ok: false, erro: 'Não foi possível consultar o CNPJ em nenhuma API disponível. Verifique a conexão ou digite o nome manualmente.' }
})

// --- Banco de dados (admin) ---
handleUnico('config:alterarCaminho', (_e, novoCaminho) => {
  const res = alterarCaminho(novoCaminho)
  if (res.ok) migrarDadosAntigos()
  return res
})

// --- Dados (compatibilidade) ---
handleUnico('dados:carregar', () => dadosParaPerfil())
handleUnico('dados:salvar', (_e, novosDados) => {
  if (!sessao) return { ok: false, erro: 'Não autenticado' }
  salvarDadosVendedor(sessao.id, {
    clientes: novosDados.clientes || [],
    vendas: novosDados.vendas || [],
    orcamentosPerdidos: novosDados.orcamentosPerdidos || []
  })
  return { ok: true }
})
handleUnico('dados:caminho', () => caminhoArquivo())
handleUnico('app:ping', () => 'pong')
handleUnico('clientes:estatisticas', (_e, clienteId) => {
  const dados = dadosParaPerfil()
  const cliente = dados.clientes.find((c) => c.id === clienteId)
  return gerarEstatisticasCliente({ cliente, vendas: dados.vendas })
})

// --- Janela ---
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 640,
    show: false,
    autoHideMenuBar: true,
    title: 'Controle de Vendas',
    backgroundColor: nativeTheme.shouldUseDarkColors ? '#0f172a' : '#f1f5f9',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  })
  mainWindow.once('ready-to-show', () => mainWindow.show())
  mainWindow.maximize()
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })
  if (process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}
app.whenReady().then(() => {
  // --- Atualização automática ---
  const enviarStatus = (status) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('update-status', status)
    }
  }
  autoUpdater.autoDownload = true
  autoUpdater.autoInstallOnAppQuit = true
  autoUpdater.on('checking-for-update', () => enviarStatus('checking'))
  autoUpdater.on('update-available', () => enviarStatus('available'))
  autoUpdater.on('update-not-available', () => enviarStatus('up-to-date'))
  autoUpdater.on('download-progress', (p) => enviarStatus('downloading:' + Math.round(p.percent)))
  autoUpdater.on('error', (e) => enviarStatus('error:' + String(e)))
  autoUpdater.on('update-downloaded', () => {
    autoUpdater.quitAndInstall()
  })
  autoUpdater.checkForUpdatesAndNotify()

  createWindow()
  try {
    migrarDadosAntigos()
    console.log('Dados prontos em:', caminhoArquivo())
  } catch (err) {
    console.error('Erro ao preparar dados:', err)
  }
  verificarBackupDiario()
  setInterval(verificarBackupDiario, 30000)
  app.on('before-quit', () => {
    try { fazerBackup() } catch (e) {}
  })
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})