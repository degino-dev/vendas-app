// src/main/storage.js - Dados em arquivos separados por vendedor
import { app } from 'electron'
import { join, dirname } from 'path'
import { existsSync, mkdirSync, readFileSync, writeFileSync, copyFileSync, readdirSync, statSync, unlinkSync } from 'fs'
import bcrypt from 'bcryptjs'

// ============================================================
// CAMINHO FIXO DOS DADOS (rede)
// ============================================================
// Trave o caminho aqui. Todos os computadores usarão esta pasta.
// Para trocar, edite apenas esta linha.
var CAMINHO_FIXO = 'U:\\DADOS DO APP\\dados.json'

var CONFIG_DIR = join(app.getPath('userData'), 'config')
var CONFIG_FILE = join(CONFIG_DIR, 'config.json')
var PADRAO_DIR = join(app.getPath('userData'), 'dados')
var PADRAO_FILE = PADRAO_DIR + '\dados.json'

// Retenção de backups (fixa conforme pedido)
var RETER_VENDEDOR = 2
var RETER_GERAIS = 2

function lerCaminhoConfig() {
  // SEMPRE usa o caminho fixo da rede — ignora config.json
  return CAMINHO_FIXO
}
function salvarCaminhoConfig(dataFile) {
  // Caminho é fixo — não faz nada
  return
}
function garantirPastas(dir) {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
}
export function pastaDados() {
  return dirname(lerCaminhoConfig())
}
export function caminhoArquivo() {
  return lerCaminhoConfig()
}
export function alterarCaminho(novoArquivo) {
  // Caminho é fixo — não permite alterar
  return { ok: false, erro: 'O caminho de dados é fixo e não pode ser alterado.' }
}
function estruturaInicial() {
  var senhaHash = bcrypt.hashSync('admin123', 10)
  return {
    vendedores: [{ id: 'admin', nome: 'Administrador', usuario: 'admin', senhaHash: senhaHash, admin: true }],
    clientes: [],
    vendas: [],
    orcamentos: [],
    orcamentosPerdidos: [],
    metaMensal: 100000
  }
}
function arquivoVendedores() {
  return join(pastaDados(), 'vendedores.json')
}
// Retorna true se existe um caminho de dados personalizado configurado (ex.: pasta de rede)
function temCaminhoPersonalizado() {
  try {
    if (existsSync(CONFIG_FILE)) {
      var cfg = JSON.parse(readFileSync(CONFIG_FILE, 'utf-8'))
      return !!cfg.dataFile && cfg.dataFile !== PADRAO_FILE
    }
  } catch (err) {}
  return false
}
export function carregarVendedores() {
  var arquivo = arquivoVendedores()
  try {
    if (!existsSync(arquivo)) {
      // Caminho é FIXO — se o arquivo não existe, é a primeira execução.
      // Cria o admin padrão (admin / admin123) do zero, já na pasta de rede.
      // Se a rede estiver fora do ar, o writeFileSync lança erro e retorna [].
      var inicial = estruturaInicial()
      var res = salvarVendedores(inicial.vendedores)
      if (res.ok) {
        console.log('Sistema inicializado do zero com o usuário admin padrão.')
        return inicial.vendedores
      }
      console.warn('Não foi possível criar o arquivo de vendedores. Verifique se a pasta de rede está acessível.')
      return []
    }
    var dados = JSON.parse(readFileSync(arquivo, 'utf-8'))
    if (Array.isArray(dados)) return dados
    return []
  } catch (err) {
    console.error('Erro ao ler vendedores:', err)
    return []
  }
}
export function salvarVendedores(vendedores) {
  var arquivo = arquivoVendedores()
  try {
    garantirPastas(dirname(arquivo))
    writeFileSync(arquivo, JSON.stringify(vendedores, null, 2), 'utf-8')
    return { ok: true }
  } catch (err) {
    console.error('Erro ao salvar vendedores:', err)
    return { ok: false, erro: 'Sem permissao para gravar vendedores: ' + String(err) }
  }
}
function arquivoVendedor(id) {
  if (!id) return null
  // Admin também tem arquivo próprio (vendedor_admin.json) para persistir seus dados
  return join(pastaDados(), 'vendedor_' + id + '.json')
}
function estruturaVendedor() {
  return { clientes: [], vendas: [], orcamentos: [], orcamentosPerdidos: [] }
}
export function carregarDadosVendedor(id) {
  var arquivo = arquivoVendedor(id)
  if (!arquivo) return estruturaVendedor()
  try {
    if (!existsSync(arquivo)) return estruturaVendedor()
    var dados = JSON.parse(readFileSync(arquivo, 'utf-8'))
    return {
      clientes: dados.clientes || [],
      vendas: dados.vendas || [],
      orcamentos: dados.orcamentos || [],
      orcamentosPerdidos: dados.orcamentosPerdidos || []
    }
  } catch (err) {
    console.error('Erro ao ler dados do vendedor', id, ':', err)
    return estruturaVendedor()
  }
}
export function salvarDadosVendedor(id, dados) {
  var arquivo = arquivoVendedor(id)
  if (!arquivo) return { ok: true }
  try {
    garantirPastas(dirname(arquivo))
    writeFileSync(arquivo, JSON.stringify(dados, null, 2), 'utf-8')
    return { ok: true }
  } catch (err) {
    console.error('Erro ao salvar dados do vendedor', id, ':', err)
    return { ok: false, erro: 'Sem permissao para gravar: ' + String(err) }
  }
}
export function migrarDadosAntigos() {
  var antigo = lerCaminhoConfig()
  if (!existsSync(antigo)) return
  try {
    var dados = JSON.parse(readFileSync(antigo, 'utf-8'))
    if (!dados || !Array.isArray(dados.vendedores)) return
    var vendedores = dados.vendedores.map(function (v) {
      return {
        id: v.id,
        nome: v.nome,
        usuario: v.usuario,
        senhaHash: v.senhaHash,
        admin: !!v.admin,
        metaMensal: Number(v.metaMensal) || 100000,
        metaSemanal: Number(v.metaSemanal) || 25000
      }
    })
    salvarVendedores(vendedores)
    var porVendedor = {}
    ;(dados.clientes || []).forEach(function (c) {
      var vid = c.vendedorId || 'admin'
      if (!porVendedor[vid]) porVendedor[vid] = estruturaVendedor()
      porVendedor[vid].clientes.push(c)
    })
    ;(dados.vendas || []).forEach(function (v) {
      var vid = v.vendedorId || 'admin'
      if (!porVendedor[vid]) porVendedor[vid] = estruturaVendedor()
      porVendedor[vid].vendas.push(v)
    })
    ;(dados.orcamentos || []).forEach(function (o) {
      var vid = o.vendedorId || 'admin'
      if (!porVendedor[vid]) porVendedor[vid] = estruturaVendedor()
      porVendedor[vid].orcamentos.push(o)
    })
    ;(dados.orcamentosPerdidos || []).forEach(function (o) {
      var vid = o.vendedorId || 'admin'
      if (!porVendedor[vid]) porVendedor[vid] = estruturaVendedor()
      porVendedor[vid].orcamentosPerdidos.push(o)
    })
    Object.keys(porVendedor).forEach(function (vid) {
      salvarDadosVendedor(vid, porVendedor[vid])
    })
    var backup = antigo + '.migrado'
    copyFileSync(antigo, backup)
    console.log('Migracao por vendedor concluida. Backup em:', backup)
  } catch (err) {
    console.error('Falha na migracao (ignorada):', err)
  }
}
export function carregarVisaoGerente() {
  var vendedores = carregarVendedores()
  var clientes = []
  var vendas = []
  var orcamentos = []
  var orcamentosPerdidos = []
  vendedores.forEach(function (v) {
    var d = carregarDadosVendedor(v.id)
    clientes = clientes.concat(d.clientes)
    vendas = vendas.concat(d.vendas)
    orcamentos = orcamentos.concat(d.orcamentos)
    orcamentosPerdidos = orcamentosPerdidos.concat(d.orcamentosPerdidos)
  })
  return { vendedores: vendedores, clientes: clientes, vendas: vendas, orcamentos: orcamentos, orcamentosPerdidos: orcamentosPerdidos, metaMensal: 100000 }
}
// ============================================================
// BACKUP — por vendedor (últimos 2) + geral (sempre 2)
// ============================================================
function stampData() {
  var agora = new Date()
  var p = function (n) { return String(n).padStart(2, '0') }
  return String(agora.getFullYear()) + '-' + p(agora.getMonth() + 1) + '-' + p(agora.getDate()) +
    '_' + p(agora.getHours()) + '-' + p(agora.getMinutes()) + '-' + p(agora.getSeconds())
}
function pastaBackups() {
  return join(pastaDados(), 'backups')
}
export function carregarConfigBackup() {
  try {
    if (existsSync(CONFIG_FILE)) {
      var cfg = JSON.parse(readFileSync(CONFIG_FILE, 'utf-8'))
      return { horario: cfg.backupHorario || '19:00' }
    }
  } catch (err) {
    console.error('Erro ao ler config de backup:', err)
  }
  return { horario: '19:00' }
}
export function salvarConfigBackup(config) {
  try {
    if (!existsSync(CONFIG_DIR)) mkdirSync(CONFIG_DIR, { recursive: true })
    var cfg = {}
    if (existsSync(CONFIG_FILE)) {
      try { cfg = JSON.parse(readFileSync(CONFIG_FILE, 'utf-8')) } catch (e) { cfg = {} }
    }
    cfg.backupHorario = config.horario || '19:00'
    writeFileSync(CONFIG_FILE, JSON.stringify(cfg, null, 2), 'utf-8')
    return { ok: true }
  } catch (err) {
    console.error('Erro ao salvar config de backup:', err)
    return { ok: false, erro: 'Erro ao salvar configuração de backup: ' + String(err) }
  }
}
// Mantém só os N arquivos mais recentes de um prefixo
function limparBackupsPorPrefixo(prefixo, manter) {
  try {
    var backupDir = pastaBackups()
    if (!existsSync(backupDir)) return
    var arquivos = readdirSync(backupDir)
      .filter(function (f) { return f.endsWith('.json') && f.indexOf(prefixo) === 0 })
      .map(function (f) {
        return { nome: f, mtime: statSync(join(backupDir, f)).mtime.getTime() }
      })
      .sort(function (a, b) { return b.mtime - a.mtime })
    arquivos.slice(manter).forEach(function (f) {
      try { unlinkSync(join(backupDir, f.nome)) } catch (e) {}
    })
  } catch (err) {
    console.error('Erro ao limpar backups antigos:', err)
  }
}
// Lista arquivos de um prefixo (mais recente primeiro)
function listarPorPrefixo(prefixo) {
  try {
    var backupDir = pastaBackups()
    if (!existsSync(backupDir)) return []
    return readdirSync(backupDir)
      .filter(function (f) { return f.endsWith('.json') && f.indexOf(prefixo) === 0 })
      .map(function (f) {
        var caminho = join(backupDir, f)
        var stats = statSync(caminho)
        return { nome: f, data: stats.mtime.toISOString(), tamanho: stats.size }
      })
      .sort(function (a, b) { return b.data.localeCompare(a.data) })
  } catch (err) {
    console.error('Erro ao listar backups:', err)
    return []
  }
}
// Cria: 1 backup por vendedor + 1 backup geral, e aplica a retenção (2 + 2)
export function fazerBackup() {
  try {
    var dir = pastaDados()
    var backupDir = pastaBackups()
    garantirPastas(backupDir)
    var stamp = stampData()
    // 1) Backup individual de cada vendedor
    var vendedores = carregarVendedores()
    vendedores.forEach(function (v) {
      var dados = carregarDadosVendedor(v.id)
      var insights = carregarEstadoInsights(v.id)
      var nome = 'backup_vendedor_' + v.id + '_' + stamp + '.json'
      writeFileSync(join(backupDir, nome), JSON.stringify(Object.assign({}, dados, { insights: insights }), null, 2), 'utf-8')
    })
    // 2) Backup geral (tudo junto)
    var conteudo = {}
    readdirSync(dir).filter(function (f) { return f.endsWith('.json') && f !== 'backups' }).forEach(function (f) {
      try {
        conteudo[f] = JSON.parse(readFileSync(join(dir, f), 'utf-8'))
      } catch (e) {}
    })
    writeFileSync(join(backupDir, 'geral_' + stamp + '.json'), JSON.stringify(conteudo, null, 2), 'utf-8')
    // 3) Retenção: últimos 2 por vendedor e 2 gerais
    vendedores.forEach(function (v) {
      limparBackupsPorPrefixo('backup_vendedor_' + v.id + '_', RETER_VENDEDOR)
    })
    limparBackupsPorPrefixo('geral_', RETER_GERAIS)
    console.log('Backup criado: ' + vendedores.length + ' por vendedor + 1 geral (' + stamp + ')')
    return { ok: true }
  } catch (err) {
    console.error('Falha no backup:', err)
    return { ok: false, erro: 'Falha ao criar backup: ' + String(err) }
  }
}
// Lista os backups de um vendedor específico
export function listarBackupsVendedor(id) {
  return listarPorPrefixo('backup_vendedor_' + id + '_')
}
// Lista os backups gerais
export function listarBackupsGerais() {
  return listarPorPrefixo('geral_')
}
// Restaura o backup de um vendedor específico (só os dados dele)
export function restaurarBackupVendedor(id, nome) {
  try {
    var backupDir = pastaBackups()
    var caminho = join(backupDir, nome)
    if (!existsSync(caminho)) return { ok: false, erro: 'Backup não encontrado' }
    if (nome.indexOf('backup_vendedor_' + id + '_') !== 0) {
      return { ok: false, erro: 'Este backup não pertence a este vendedor' }
    }
    var dados = JSON.parse(readFileSync(caminho, 'utf-8'))
    salvarDadosVendedor(id, {
      clientes: dados.clientes || [],
      vendas: dados.vendas || [],
      orcamentos: dados.orcamentos || [],
      orcamentosPerdidos: dados.orcamentosPerdidos || []
    })
    if (dados.insights) salvarEstadoInsights(id, dados.insights)
    console.log('Backup restaurado (vendedor ' + id + '):', nome)
    return { ok: true }
  } catch (err) {
    console.error('Erro ao restaurar backup do vendedor:', err)
    return { ok: false, erro: 'Falha ao restaurar backup: ' + String(err) }
  }
}
// Restaura o backup geral (todos os arquivos de dados)
export function restaurarBackupGeral(nome) {
  try {
    var dir = pastaDados()
    var backupDir = pastaBackups()
    var caminho = join(backupDir, nome)
    if (!existsSync(caminho)) return { ok: false, erro: 'Backup não encontrado' }
    if (nome.indexOf('geral_') !== 0) return { ok: false, erro: 'Arquivo inválido' }
    var conteudo = JSON.parse(readFileSync(caminho, 'utf-8'))
    Object.keys(conteudo).forEach(function (f) {
      if (f === 'backups' || f.startsWith('.')) return
      var destino = join(dir, f)
      garantirPastas(dirname(destino))
      writeFileSync(destino, JSON.stringify(conteudo[f], null, 2), 'utf-8')
    })
    console.log('Backup geral restaurado:', nome)
    return { ok: true }
  } catch (err) {
    console.error('Erro ao restaurar backup geral:', err)
    return { ok: false, erro: 'Falha ao restaurar backup: ' + String(err) }
  }
}
// (Compatibilidade) Lista todos os backups existentes
export function listarBackups() {
  try {
    var backupDir = pastaBackups()
    if (!existsSync(backupDir)) return []
    return readdirSync(backupDir)
      .filter(function (f) { return f.endsWith('.json') })
      .map(function (f) {
        var caminho = join(backupDir, f)
        var stats = statSync(caminho)
        return { nome: f, data: stats.mtime.toISOString(), tamanho: stats.size }
      })
      .sort(function (a, b) { return b.data.localeCompare(a.data) })
  } catch (err) {
    console.error('Erro ao listar backups:', err)
    return []
  }
}
// ============================================================
// CHAVE DA API DO GEMINI (salva no config.json, por máquina)
// ============================================================
export function carregarChaveIA() {
  try {
    if (existsSync(CONFIG_FILE)) {
      var cfg = JSON.parse(readFileSync(CONFIG_FILE, 'utf-8'))
      return cfg.geminiApiKey || ''
    }
  } catch (err) {
    console.error('Erro ao ler chave da IA:', err)
  }
  return ''
}
export function salvarChaveIA(chave) {
  try {
    if (!existsSync(CONFIG_DIR)) mkdirSync(CONFIG_DIR, { recursive: true })
    var cfg = {}
    if (existsSync(CONFIG_FILE)) {
      try { cfg = JSON.parse(readFileSync(CONFIG_FILE, 'utf-8')) } catch (e) { cfg = {} }
    }
    cfg.geminiApiKey = String(chave || '').trim()
    writeFileSync(CONFIG_FILE, JSON.stringify(cfg, null, 2), 'utf-8')
    return { ok: true }
  } catch (err) {
    console.error('Erro ao salvar chave da IA:', err)
    return { ok: false, erro: 'Erro ao salvar a chave: ' + String(err) }
  }
}
// Estado de insights (visto/tratado/adiado) - salvo no arquivo de cada vendedor
export function carregarEstadoInsights(id) {
  var arquivo = arquivoVendedor(id)
  if (!arquivo) return { vistos: [], tratados: [], adiados: {} }
  try {
    if (!existsSync(arquivo)) return { vistos: [], tratados: [], adiados: {} }
    var dados = JSON.parse(readFileSync(arquivo, 'utf-8'))
    return dados.insights || { vistos: [], tratados: [], adiados: {} }
  } catch (err) {
    return { vistos: [], tratados: [], adiados: {} }
  }
}
export function salvarEstadoInsights(id, estado) {
  var arquivo = arquivoVendedor(id)
  if (!arquivo) return { ok: true }
  try {
    garantirPastas(dirname(arquivo))
    var dados = {}
    if (existsSync(arquivo)) {
      try { dados = JSON.parse(readFileSync(arquivo, 'utf-8')) } catch (e) { dados = {} }
    }
    dados.insights = estado
    writeFileSync(arquivo, JSON.stringify(dados, null, 2), 'utf-8')
    return { ok: true }
  } catch (err) {
    return { ok: false, erro: 'Sem permissao para gravar: ' + String(err) }
  }
}