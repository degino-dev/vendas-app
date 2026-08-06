import { app, shell, BrowserWindow, ipcMain } from 'electron'
import { join } from 'path'
import { carregarDados, salvarDados, fazerBackup, caminhoArquivo, alterarCaminho } from './storage'
import bcrypt from 'bcryptjs'
import { randomUUID } from 'crypto'

let dados = carregarDados()

// --- Migração: garante que dados antigos tenham os campos novos ---
function normalizarDados() {
  let proximoCodigo = 1

  dados.clientes = dados.clientes.map((c) => {
    if (!c.codigo) {
      c.codigo = proximoCodigo++
    } else {
      proximoCodigo = Math.max(proximoCodigo, Number(c.codigo) + 1)
    }
    return {
      ...c,
      cnpj: c.cnpj || '',
      whats: c.whats || c.telefone || '',
      segmento: c.segmento || ''
    }
  })

  dados.vendas = dados.vendas.map((v) => ({
    id: v.id,
    clienteId: v.clienteId,
    vendedorId: v.vendedorId,
    envio: v.envio || '',
    pedidoInsumos: v.pedidoInsumos || '',
    valorInsumos: Number(v.valorInsumos ?? v.valor ?? 0),
    pedidoEquipamento: v.pedidoEquipamento || '',
    valorEquipamento: Number(v.valorEquipamento ?? 0),
    data: v.data || new Date().toISOString().slice(0, 10),
    observacao: v.observacao || ''
  }))

  dados.vendedores = dados.vendedores.map((v) => ({
    ...v,
    metaMensal: Number(v.metaMensal) || 100000,
    metaSemanal: Number(v.metaSemanal) || 25000
  }))

  if (!dados.orcamentosPerdidos) dados.orcamentosPerdidos = []
  dados.orcamentosPerdidos = dados.orcamentosPerdidos.map((o) => ({
    ...o,
    observacao: o.observacao || ''
  }))

  if (dados.metaMensal === undefined) dados.metaMensal = 100000
  salvarDados(dados)
}

normalizarDados()

// Formata texto com capitalização correta (ex.: "DOCTOR PRIME" -> "Doctor Prime")
function capitalizarTexto(texto) {
  if (!texto) return ''
  const palavras = String(texto).toLowerCase().trim().split(/\s+/)
  const excecoes = ['da', 'de', 'do', 'das', 'dos', 'e', 'em', 'com', 'ltda', 'sa', 's/a', 'me', 'epp']
  return palavras
    .map((p) => {
      if (excecoes.includes(p)) return p
      return p.charAt(0).toUpperCase() + p.slice(1)
    })
    .join(' ')
    .replace(/\b(ltda|sa|s\/a|me|epp)\b/gi, (m) => m.toUpperCase())
}

// --- Autenticação ---

ipcMain.handle('auth:login', (_e, { usuario, senha }) => {
  try {
    const vendedor = dados.vendedores.find(
      (v) => v.usuario.toLowerCase() === String(usuario).toLowerCase()
    )
    if (!vendedor) return { ok: false, erro: 'Usuário não encontrado' }
    const valido = bcrypt.compareSync(senha, vendedor.senhaHash)
    if (!valido) return { ok: false, erro: 'Senha incorreta' }
    const { senhaHash, ...seguro } = vendedor
    return { ok: true, vendedor: seguro }
  } catch (err) {
    console.error('Erro no login:', err)
    return { ok: false, erro: 'Erro interno no login: ' + String(err) }
  }
})

// --- Vendedores (admin) ---

ipcMain.handle('vendedores:criar', (_e, { nome, usuario, senha, admin, metaMensal, metaSemanal }) => {
  if (dados.vendedores.some((v) => v.usuario.toLowerCase() === usuario.toLowerCase())) {
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
  dados.vendedores.push(novo)
  salvarDados(dados)
  const { senhaHash, ...seguro } = novo
  return { ok: true, vendedor: seguro }
})

ipcMain.handle('vendedores:atualizar', (_e, vendedor) => {
  const idx = dados.vendedores.findIndex((v) => v.id === vendedor.id)
  if (idx === -1) return { ok: false, erro: 'Vendedor não encontrado' }

  const duplicado = dados.vendedores.some(
    (v) => v.usuario.toLowerCase() === vendedor.usuario.toLowerCase() && v.id !== vendedor.id
  )
  if (duplicado) return { ok: false, erro: 'Usuário já existe' }

  const atual = dados.vendedores[idx]
  dados.vendedores[idx] = {
    ...atual,
    nome: capitalizarTexto(vendedor.nome),
    usuario: vendedor.usuario,
    admin: !!vendedor.admin,
    metaMensal: Number(vendedor.metaMensal) || 100000,
    metaSemanal: Number(vendedor.metaSemanal) || 25000,
    senhaHash: vendedor.senha ? bcrypt.hashSync(vendedor.senha, 10) : atual.senhaHash
  }
  salvarDados(dados)
  const { senhaHash, ...seguro } = dados.vendedores[idx]
  return { ok: true, vendedor: seguro }
})

ipcMain.handle('vendedores:listar', () => {
  return dados.vendedores.map(({ senhaHash, ...v }) => v)
})

ipcMain.handle('vendedores:deletar', (_e, id) => {
  if (id === 'admin') return { ok: false, erro: 'Não é possível excluir o admin principal' }
  dados.vendedores = dados.vendedores.filter((v) => v.id !== id)
  salvarDados(dados)
  return { ok: true }
})

// --- Clientes ---

ipcMain.handle('clientes:listar', (_e, vendedorId) => {
  if (vendedorId) {
    return dados.clientes.filter((c) => c.vendedorId === vendedorId)
  }
  return dados.clientes
})

ipcMain.handle('clientes:criar', (_e, cliente) => {
  const codigo = Number(cliente.codigo)
  if (!codigo || !Number.isInteger(codigo) || codigo <= 0) {
    return { ok: false, erro: 'ID do cliente inválido' }
  }
  const duplicado = dados.clientes.some((c) => Number(c.codigo) === codigo)
  if (duplicado) return { ok: false, erro: `Já existe um cliente com o ID ${codigo}` }

  const novo = {
    id: randomUUID(),
    codigo,
    nome: capitalizarTexto(cliente.nome),
    cnpj: cliente.cnpj || '',
    email: cliente.email || '',
    whats: cliente.whats || '',
    cidade: capitalizarTexto(cliente.cidade),
    segmento: capitalizarTexto(cliente.segmento),
    vendedorId: cliente.vendedorId
  }
  dados.clientes.push(novo)
  salvarDados(dados)
  return { ok: true, cliente: novo }
})

ipcMain.handle('clientes:atualizar', (_e, cliente) => {
  const idx = dados.clientes.findIndex((c) => c.id === cliente.id)
  if (idx === -1) return { ok: false, erro: 'Cliente não encontrado' }

  const codigo = Number(cliente.codigo)
  if (!codigo || !Number.isInteger(codigo) || codigo <= 0) {
    return { ok: false, erro: 'ID do cliente inválido' }
  }
  const duplicado = dados.clientes.some(
    (c) => Number(c.codigo) === codigo && c.id !== cliente.id
  )
  if (duplicado) return { ok: false, erro: `Já existe um cliente com o ID ${codigo}` }

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
  salvarDados(dados)
  return { ok: true, cliente: dados.clientes[idx] }
})

ipcMain.handle('clientes:deletar', (_e, id) => {
  dados.clientes = dados.clientes.filter((c) => c.id !== id)
  salvarDados(dados)
  return { ok: true }
})

// --- Vendas ---

ipcMain.handle('vendas:listar', (_e, vendedorId) => {
  if (vendedorId) {
    return dados.vendas.filter((v) => v.vendedorId === vendedorId)
  }
  return dados.vendas
})

ipcMain.handle('vendas:criar', (_e, venda) => {
  const nova = {
    id: randomUUID(),
    clienteId: venda.clienteId,
    vendedorId: venda.vendedorId,
    envio: venda.envio || '',
    pedidoInsumos: venda.pedidoInsumos || '',
    valorInsumos: Number(venda.valorInsumos) || 0,
    pedidoEquipamento: venda.pedidoEquipamento || '',
    valorEquipamento: Number(venda.valorEquipamento) || 0,
    data: venda.data || new Date().toISOString().slice(0, 10),
    observacao: venda.observacao || ''
  }
  dados.vendas.push(nova)
  salvarDados(dados)
  return { ok: true, venda: nova }
})

ipcMain.handle('vendas:atualizar', (_e, venda) => {
  const idx = dados.vendas.findIndex((v) => v.id === venda.id)
  if (idx === -1) return { ok: false, erro: 'Venda não encontrada' }

  dados.vendas[idx] = {
    ...dados.vendas[idx],
    clienteId: venda.clienteId,
    envio: venda.envio || '',
    pedidoInsumos: venda.pedidoInsumos || '',
    valorInsumos: Number(venda.valorInsumos) || 0,
    pedidoEquipamento: venda.pedidoEquipamento || '',
    valorEquipamento: Number(venda.valorEquipamento) || 0,
    data: venda.data || dados.vendas[idx].data,
    observacao: venda.observacao || ''
  }
  salvarDados(dados)
  return { ok: true, venda: dados.vendas[idx] }
})

ipcMain.handle('vendas:deletar', (_e, id) => {
  dados.vendas = dados.vendas.filter((v) => v.id !== id)
  salvarDados(dados)
  return { ok: true }
})

// === NOVO: listar vendas por mês ===
function chaveMes(data) {
  if (!data) return ''
  // formato AAAA-MM-DD
  let m = String(data).match(/^(\d{4})-(\d{2})/)
  if (m) return m[1] + '-' + m[2]
  // formato DD/MM/AAAA
  m = String(data).match(/^(\d{2})\/(\d{2})\/(\d{4})/)
  if (m) return m[3] + '-' + m[2]
  return ''
}

ipcMain.handle('vendas:listarPorMes', (event, { vendedorId, ano, mes }) => {
  const dados = carregarDados()
  const alvo = String(ano) + '-' + String(mes).padStart(2, '0')
  let vendas = (dados.vendas || []).filter((v) => chaveMes(v.data) === alvo)
  if (vendedorId) {
    vendas = vendas.filter((v) => v.vendedorId === vendedorId)
  }
  return vendas
})

// --- Orçamentos Perdidos ---

ipcMain.handle('orcamentos:listar', (_e, vendedorId) => {
  if (vendedorId) {
    return dados.orcamentosPerdidos.filter((o) => o.vendedorId === vendedorId)
  }
  return dados.orcamentosPerdidos
})

ipcMain.handle('orcamentos:criar', (_e, orcamento) => {
  const novo = {
    id: randomUUID(),
    clienteId: orcamento.clienteId,
    vendedorId: orcamento.vendedorId,
    produtos: orcamento.produtos || '',
    valor: Number(orcamento.valor) || 0,
    concorrente: orcamento.concorrente || '',
    motivo: orcamento.motivo || '',
    observacao: orcamento.observacao || '',
    data: orcamento.data || new Date().toISOString().slice(0, 10)
  }
  dados.orcamentosPerdidos.push(novo)   // ✅ array correto
  salvarDados(dados)
  return { ok: true, orcamento: novo }
})

ipcMain.handle('orcamentos:deletar', (_e, id) => {
  dados.orcamentosPerdidos = dados.orcamentosPerdidos.filter((o) => o.id !== id)
  salvarDados(dados)
  return { ok: true }
})

// Devolve o foco à janela nativa (corrige o bug de foco após diálogos nativos no Windows)
ipcMain.handle('janela:focar', (evento) => {
  const janela = BrowserWindow.fromWebContents(evento.sender)
  if (janela) {
    if (janela.isMinimized()) janela.restore()
    janela.show()
    janela.focus()
  }
  return { ok: true }
})

// --- Cidades IBGE (lista oficial de municípios) ---

let cacheCidades = null

ipcMain.handle('cidades:listar', async () => {
  if (cacheCidades) return cacheCidades
  try {
    const res = await fetch('https://servicodados.ibge.gov.br/api/v1/localidades/municipios')
    if (!res.ok) throw new Error('IBGE indisponível')
    const lista = await res.json()
    cacheCidades = lista
      .map((m) => ({
        nome: m.nome,
        uf: (m.microrregiao && m.microrregiao.mesorregiao && m.microrregiao.mesorregiao.UF && m.microrregiao.mesorregiao.UF.sigla) || ''
      }))
      .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
    return cacheCidades
  } catch (err) {
    console.error('Erro ao buscar cidades IBGE:', err)
    return []
  }
})

// --- Consulta CNPJ (com fallback entre APIs gratuitas) ---

ipcMain.handle('cnpj:consultar', async (_e, cnpj) => {
  const limpo = String(cnpj || '').replace(/\D/g, '')
  if (limpo.length !== 14) return { ok: false, erro: 'CNPJ deve ter 14 dígitos' }

  // Tenta em ordem: BrasilAPI -> Minha Receita -> ReceitaWS
  const apis = [
    {
      nome: 'BrasilAPI',
      url: `https://brasilapi.com.br/api/cnpj/v1/${limpo}`,
      parse: (d) => ({
        razaoSocial: capitalizarTexto(d.razao_social || ''),
        nomeFantasia: capitalizarTexto(d.nome_fantasia || ''),
        municipio: capitalizarTexto(d.municipio || ''),
        uf: (d.uf || '').toUpperCase()
      })
    },
    {
      nome: 'Minha Receita',
      url: `https://minhareceita.org/${limpo}`,
      parse: (d) => ({
        razaoSocial: capitalizarTexto(d.razao_social || d.nome || ''),
        nomeFantasia: capitalizarTexto(d.nome_fantasia || ''),
        municipio: capitalizarTexto(d.municipio || ''),
        uf: (d.uf || '').toUpperCase()
      })
    },
    {
      nome: 'ReceitaWS',
      url: `https://www.receitaws.com.br/v1/cnpj/${limpo}`,
      parse: (d) => ({
        razaoSocial: capitalizarTexto(d.nome || ''),
        nomeFantasia: capitalizarTexto(d.fantasia || ''),
        municipio: capitalizarTexto(d.municipio || ''),
        uf: (d.uf || '').toUpperCase()
      })
    }
  ]

  for (const api of apis) {
    try {
      const res = await fetch(api.url, { signal: AbortSignal.timeout(8000) })
      if (res.status === 404) continue
      if (!res.ok) continue
      const dados = await res.json()
      const parseado = api.parse(dados)
      if (parseado.razaoSocial) {
        return { ok: true, fonte: api.nome, ...parseado }
      }
    } catch (err) {
      console.error(`Erro na API ${api.nome}:`, err)
    }
  }

  return {
    ok: false,
    erro: 'Não foi possível consultar o CNPJ em nenhuma API disponível. Verifique a conexão ou digite o nome manualmente.'
  }
})

// --- Banco de dados (admin) ---

ipcMain.handle('config:alterarCaminho', (_e, novoCaminho) => {
  return alterarCaminho(novoCaminho)
})

// --- Dados ---

ipcMain.handle('dados:carregar', () => dados)
ipcMain.handle('dados:salvar', (_e, novosDados) => {
  dados = novosDados
  salvarDados(dados)
  return { ok: true }
})
ipcMain.handle('dados:caminho', () => caminhoArquivo())
ipcMain.handle('app:ping', () => 'pong')

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

  // Abre maximizado (com barra de título e botões de minimizar/maximizar/fechar)
  mainWindow.maximize()

  mainWindow.on('ready-to-show', () => mainWindow.show())

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
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
  app.on('before-quit', () => fazerBackup())
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})