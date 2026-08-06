// src/main/storage.js - Dados em arquivos separados por vendedor
import { app } from 'electron'
import { join, dirname } from 'path'
import { existsSync, mkdirSync, readFileSync, writeFileSync, copyFileSync, readdirSync } from 'fs'
import bcrypt from 'bcryptjs'

var CONFIG_DIR = join(app.getPath('userData'), 'config')
var CONFIG_FILE = join(CONFIG_DIR, 'config.json')
var PADRAO_DIR = join(app.getPath('userData'), 'dados')
var PADRAO_FILE = join(PADRAO_DIR, 'dados.json')

function lerCaminhoConfig() {
  try {
    if (existsSync(CONFIG_FILE)) {
      var cfg = JSON.parse(readFileSync(CONFIG_FILE, 'utf-8'))
      if (cfg.dataFile) return cfg.dataFile
    }
  } catch (err) {
    console.error('Erro ao ler config:', err)
  }
  return PADRAO_FILE
}

function salvarCaminhoConfig(dataFile) {
  if (!existsSync(CONFIG_DIR)) mkdirSync(CONFIG_DIR, { recursive: true })
  writeFileSync(CONFIG_FILE, JSON.stringify({ dataFile: dataFile }, null, 2), 'utf-8')
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
  if (!novoArquivo || !novoArquivo.trim()) return { ok: false, erro: 'Caminho vazio' }
  var caminho = novoArquivo.trim()
  try {
    var dir = dirname(caminho)
    garantirPastas(dir)
    salvarCaminhoConfig(caminho)
    return { ok: true, caminho: caminho }
  } catch (err) {
    console.error('Erro ao alterar caminho:', err)
    return { ok: false, erro: 'Sem permissao para acessar este caminho: ' + String(err) }
  }
}

function estruturaInicial() {
  var senhaHash = bcrypt.hashSync('admin123', 10)
  return {
    vendedores: [{ id: 'admin', nome: 'Administrador', usuario: 'admin', senhaHash: senhaHash, admin: true }],
    clientes: [],
    vendas: [],
    orcamentosPerdidos: [],
    metaMensal: 100000
  }
}

function arquivoVendedores() {
  return join(pastaDados(), 'vendedores.json')
}

export function carregarVendedores() {
  var arquivo = arquivoVendedores()
  try {
    if (!existsSync(arquivo)) return []
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
  if (!id || id === 'admin') return null
  return join(pastaDados(), 'vendedor_' + id + '.json')
}

function estruturaVendedor() {
  return { clientes: [], vendas: [], orcamentosPerdidos: [] }
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
  var orcamentosPerdidos = []
  vendedores.forEach(function (v) {
    var d = carregarDadosVendedor(v.id)
    clientes = clientes.concat(d.clientes)
    vendas = vendas.concat(d.vendas)
    orcamentosPerdidos = orcamentosPerdidos.concat(d.orcamentosPerdidos)
  })
  return { vendedores: vendedores, clientes: clientes, vendas: vendas, orcamentosPerdidos: orcamentosPerdidos, metaMensal: 100000 }
}

export function fazerBackup() {
  try {
    var dir = pastaDados()
    var backupDir = join(dir, 'backups')
    garantirPastas(backupDir)
    var agora = new Date()
    var mes = String(agora.getMonth() + 1).padStart(2, '0')
    var dia = String(agora.getDate()).padStart(2, '0')
    var hora = String(agora.getHours()).padStart(2, '0')
    var min = String(agora.getMinutes()).padStart(2, '0')
    var stamp = String(agora.getFullYear()) + '-' + mes + '-' + dia + '_' + hora + '-' + min
    var destino = join(backupDir, 'dados_' + stamp + '.json')
    var arquivos = readdirSync(dir).filter(function (f) { return f.endsWith('.json') && f !== 'backups' })
    var conteudo = {}
    arquivos.forEach(function (f) {
      try {
        conteudo[f] = JSON.parse(readFileSync(join(dir, f), 'utf-8'))
      } catch (e) {}
    })
    writeFileSync(destino, JSON.stringify(conteudo, null, 2), 'utf-8')
    console.log('Backup criado:', destino)
  } catch (err) {
    console.error('Falha no backup (ignorada):', err)
  }
}