import { app } from 'electron'
import { join, dirname } from 'path'
import { existsSync, mkdirSync, readFileSync, writeFileSync, copyFileSync } from 'fs'
import bcrypt from 'bcryptjs'

// Arquivo de configuração (guarda o caminho escolhido pelo admin)
const CONFIG_DIR = join(app.getPath('userData'), 'config')
const CONFIG_FILE = join(CONFIG_DIR, 'config.json')

// Caminho padrão (usado até o admin trocar)
const PADRAO_DIR = join(app.getPath('userData'), 'dados')
const PADRAO_FILE = join(PADRAO_DIR, 'dados.json')

// Lê o caminho salvo na config, ou usa o padrão
function lerCaminhoConfig() {
  try {
    if (existsSync(CONFIG_FILE)) {
      const cfg = JSON.parse(readFileSync(CONFIG_FILE, 'utf-8'))
      if (cfg.dataFile) return cfg.dataFile
    }
  } catch (err) {
    console.error('Erro ao ler config:', err)
  }
  return PADRAO_FILE
}

// Salva o caminho na config
function salvarCaminhoConfig(dataFile) {
  if (!existsSync(CONFIG_DIR)) mkdirSync(CONFIG_DIR, { recursive: true })
  writeFileSync(CONFIG_FILE, JSON.stringify({ dataFile }, null, 2), 'utf-8')
}

// Caminho atual (dinâmico)
export function caminhoArquivo() {
  return lerCaminhoConfig()
}

// Altera o caminho do banco de dados (ex.: pasta da rede)
export function alterarCaminho(novoArquivo) {
  if (!novoArquivo || !novoArquivo.trim()) return { ok: false, erro: 'Caminho vazio' }
  const caminho = novoArquivo.trim()

  try {
    const dir = dirname(caminho)
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true })

    if (!existsSync(caminho)) {
      const dados = carregarDados()
      salvarDados(dados)
    }

    salvarCaminhoConfig(caminho)
    return { ok: true, caminho }
  } catch (err) {
    console.error('Erro ao alterar caminho:', err)
    return { ok: false, erro: 'Sem permissão para acessar este caminho: ' + String(err) }
  }
}

// Estrutura inicial + admin padrão (usuario: admin / senha: admin123)
function estruturaInicial() {
  const senhaHash = bcrypt.hashSync('admin123', 10)
  return {
    vendedores: [
      {
        id: 'admin',
        nome: 'Administrador',
        usuario: 'admin',
        senhaHash,
        admin: true
      }
    ],
    clientes: [],
    vendas: [],
    metaMensal: 100000
  }
}

function garantirPastas(dir) {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
}

// Lê o arquivo. Se não existir, cria com a estrutura inicial.
export function carregarDados() {
  const dataFile = lerCaminhoConfig()
  const dir = dirname(dataFile)
  try {
    garantirPastas(dir)
  } catch (err) {
    console.error('Sem permissão na pasta, usando padrão:', err)
    salvarCaminhoConfig(PADRAO_FILE)
    garantirPastas(PADRAO_DIR)
    return estruturaInicial()
  }

  if (!existsSync(dataFile)) {
    const inicial = estruturaInicial()
    try {
      writeFileSync(dataFile, JSON.stringify(inicial, null, 2), 'utf-8')
    } catch (err) {
      console.error('Sem permissão para criar arquivo, usando padrão:', err)
      salvarCaminhoConfig(PADRAO_FILE)
      writeFileSync(PADRAO_FILE, JSON.stringify(inicial, null, 2), 'utf-8')
    }
    return inicial
  }

  try {
    const dados = JSON.parse(readFileSync(dataFile, 'utf-8'))
    if (!dados.vendedores) dados.vendedores = []
    if (!dados.clientes) dados.clientes = []
    if (!dados.vendas) dados.vendas = []
    if (dados.metaMensal === undefined) dados.metaMensal = 100000
    return dados
  } catch (err) {
    console.error('Erro ao ler dados:', err)
    return estruturaInicial()
  }
}

// Grava o arquivo (recebe o objeto completo)
export function salvarDados(dados) {
  const dataFile = lerCaminhoConfig()
  const dir = dirname(dataFile)
  try {
    garantirPastas(dir)
    writeFileSync(dataFile, JSON.stringify(dados, null, 2), 'utf-8')
  } catch (err) {
    console.error('Sem permissão para gravar, tentando padrão:', err)
    salvarCaminhoConfig(PADRAO_FILE)
    garantirPastas(PADRAO_DIR)
    writeFileSync(PADRAO_FILE, JSON.stringify(dados, null, 2), 'utf-8')
  }
}

// Faz backup com data/hora no nome. NUNCA derruba o app — erros são ignorados.
export function fazerBackup() {
  try {
    const dataFile = lerCaminhoConfig()
    if (!existsSync(dataFile)) return

    const dir = dirname(dataFile)
    const backupDir = join(dir, 'backups')

    try {
      garantirPastas(backupDir)
    } catch (err) {
      console.error('Não foi possível criar pasta de backup:', err)
      return // não derruba o app
    }

    const agora = new Date()
    const stamp = `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, '0')}-${String(agora.getDate()).padStart(2, '0')}_${String(agora.getHours()).padStart(2, '0')}-${String(agora.getMinutes()).padStart(2, '0')}`
    const destino = join(backupDir, `dados_${stamp}.json`)
    copyFileSync(dataFile, destino)
    console.log('Backup criado:', destino)
  } catch (err) {
    // NUNCA deixa o erro derrubar o app ao fechar
    console.error('Falha no backup (ignorada):', err)
  }
}