import { app, shell, BrowserWindow, ipcMain } from 'electron'
import { join } from 'path'
import bcrypt from 'bcryptjs'
import { randomUUID } from 'crypto'
import {
  carregarVendedores, salvarVendedores,
  carregarDadosVendedor, salvarDadosVendedor,
  carregarVisaoGerente, migrarDadosAntigos, fazerBackup,
  caminhoArquivo, alterarCaminho,
  carregarEstadoInsights, salvarEstadoInsights
} from './storage'
import { gerarInsights, atualizarEstado, gerarEstatisticasCliente } from './insights'

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

// --- Acesso aos dados conforme o perfil ---
function dadosParaPerfil() {
  if (sessao && sessao.admin) return carregarVisaoGerente()
  if (sessao) {
    const d = carregarDadosVendedor(sessao.id)
    return { vendedores: carregarVendedores(), clientes: d.clientes, vendas: d.vendas, orcamentosPerdidos: d.orcamentosPerdidos, metaMensal: 100000 }
  }
  return { vendedores: [], clientes: [], vendas: [], orcamentosPerdidos: [], metaMensal: 100000 }
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
  const dados = dadosParaPerfil()
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
  salvarDadosVendedor(sessao.id, { clientes: dados.clientes, vendas: dados.vendas, orcamentosPerdidos: dados.orcamentosPerdidos })
  return { ok: true, cliente: novo }
})

handleUnico('clientes:atualizar', (_e, cliente) => {
  if (!sessao) return { ok: false, erro: 'Não autenticado' }
  const dados = dadosParaPerfil()
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
  salvarDadosVendedor(sessao.id, { clientes: dados.clientes, vendas: dados.vendas, orcamentosPerdidos: dados.orcamentosPerdidos })
  return { ok: true, cliente: dados.clientes[idx] }
})

handleUnico('clientes:deletar', (_e, id) => {
  if (!sessao) return { ok: false, erro: 'Não autenticado' }
  const dados = dadosParaPerfil()
  dados.clientes = dados.clientes.filter((c) => c.id !== id)
  salvarDadosVendedor(sessao.id, { clientes: dados.clientes, vendas: dados.vendas, orcamentosPerdidos: dados.orcamentosPerdidos })
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
  const dados = dadosParaPerfil()
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
  salvarDadosVendedor(sessao.id, { clientes: dados.clientes, vendas: dados.vendas, orcamentosPerdidos: dados.orcamentosPerdidos })
  return { ok: true, venda: nova }
})

handleUnico('vendas:atualizar', (_e, venda) => {
  if (!sessao) return { ok: false, erro: 'Não autenticado' }
  const dados = dadosParaPerfil()
  const idx = dados.vendas.findIndex((v) => v.id === venda.id)
  if (idx === -1) return { ok: false, erro: 'Venda não encontrada' }
  dados.vendas[idx] = { ...dados.vendas[idx], ...venda }
  salvarDadosVendedor(sessao.id, { clientes: dados.clientes, vendas: dados.vendas, orcamentosPerdidos: dados.orcamentosPerdidos })
  return { ok: true, venda: dados.vendas[idx] }
})

handleUnico('vendas:deletar', (_e, id) => {
  if (!sessao) return { ok: false, erro: 'Não autenticado' }
  const dados = dadosParaPerfil()
  dados.vendas = dados.vendas.filter((v) => v.id !== id)
  salvarDadosVendedor(sessao.id, { clientes: dados.clientes, vendas: dados.vendas, orcamentosPerdidos: dados.orcamentosPerdidos })
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
  const dados = dadosParaPerfil()
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
  salvarDadosVendedor(sessao.id, { clientes: dados.clientes, vendas: dados.vendas, orcamentosPerdidos: dados.orcamentosPerdidos })
  return { ok: true, orcamento: novo }
})

handleUnico('orcamentos:deletar', (_e, id) => {
  if (!sessao) return { ok: false, erro: 'Não autenticado' }
  const dados = dadosParaPerfil()
  dados.orcamentosPerdidos = dados.orcamentosPerdidos.filter((o) => o.id !== id)
  salvarDadosVendedor(sessao.id, { clientes: dados.clientes, vendas: dados.vendas, orcamentosPerdidos: dados.orcamentosPerdidos })
  return { ok: true }
})

// --- Insights (Dicas) ---
handleUnico('insights:gerar', () => {
  const dados = dadosParaPerfil()
  const estado = sessao ? carregarEstadoInsights(sessao.id) : { vistos: [], tratados: [], adiados: {} }
  return gerarInsights({ clientes: dados.clientes, vendas: dados.vendas, orcamentosPerdidos: dados.orcamentosPerdidos, vendedores: dados.vendedores || [], estado })
})

handleUnico('insights:marcar', (_e, { acao, chave }) => {
  if (!sessao) return { ok: false, erro: 'Não autenticado' }
  const atual = carregarEstadoInsights(sessao.id)
  const novo = atualizarEstado(atual, acao, chave)
  salvarEstadoInsights(sessao.id, novo)
  return { ok: true, estado: novo }
})

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
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    show: false,
    autoHideMenuBar: true,
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
  createWindow()
  try {
    migrarDadosAntigos()
    console.log('Dados prontos em:', caminhoArquivo())
  } catch (err) {
    console.error('Erro ao preparar dados:', err)
  }
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