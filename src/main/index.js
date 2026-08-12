// src/main/index.js
require('dotenv').config()

import { app, shell, BrowserWindow, ipcMain, nativeTheme } from 'electron'
import { join } from 'path'
import { readFileSync, existsSync } from 'fs'
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
import { registrarConsulta, registrarAvaliacao, carregarExemplos, carregarConsultasRecentes } from './memoriaIA'
import { buscarFichasPorTermos } from './catalogoProdutos'
import 'dotenv/config'


// ===== DECLARAÇÕES (TEM QUE VIR ANTES DE QUALQUER handleUnico) =====
const canaisRegistrados = new Set()
function handleUnico(canal, fn) {
  if (canaisRegistrados.has(canal)) return
  canaisRegistrados.add(canal)
  ipcMain.handle(canal, fn)
}

// ===== NOTAS FISCAIS (notas.json) =====
let cacheNotas = null
let cacheNotasCarregadoEm = null

// Extrai o PRIMEIRO bloco JSON completo (ignora conteúdo duplicado depois)
// Usa charCodeAt para evitar barras invertidas que quebram ao colar
function extrairPrimeiroJSON(raw) {
  const primeiro = raw.search(/[\[{]/)
  if (primeiro === -1) return null
  let profundidade = 0
  let emString = false
  let escape = false
  for (let i = primeiro; i < raw.length; i++) {
    const c = raw[i]
    const code = raw.charCodeAt(i)
    if (emString) {
      if (escape) escape = false
      else if (code === 92) escape = true
      else if (code === 34) emString = false
      continue
    }
    if (code === 34) { emString = true; continue }
    if (c === '{' || c === '[') profundidade++
    else if (c === '}' || c === ']') {
      profundidade--
      if (profundidade === 0) return raw.slice(primeiro, i + 1)
    }
  }
  return null
}

function carregarNotas() {
  const caminho = 'U:/DADOS DO APP/notas.json'
  if (!existsSync(caminho)) return { ok: false, erro: 'notas.json não encontrado em U:/DADOS DO APP' }
  if (cacheNotas && cacheNotasCarregadoEm && Date.now() - cacheNotasCarregadoEm < 300000) {
    return { ok: true, dados: cacheNotas }
  }
  try {
    let raw = readFileSync(caminho, 'utf-8')
    raw = raw.replace(/\/\*[\s\S]*?\*\//g, '')
    raw = raw.replace(/,\s*([}\]])/g, '$1')
    const trecho = extrairPrimeiroJSON(raw)
    if (!trecho) return { ok: false, erro: 'Nenhum JSON válido encontrado em notas.json' }
    const parseado = JSON.parse(trecho)
    cacheNotas = Array.isArray(parseado) ? { notas: parseado } : parseado
    cacheNotasCarregadoEm = Date.now()
    console.log('notas.json carregado:', (cacheNotas.notas || []).length, 'notas')
    return { ok: true, dados: cacheNotas }
  } catch (err) {
    return { ok: false, erro: 'Erro ao ler notas.json: ' + err.message }
  }
}

handleUnico('notas:topCliente', (_e, codigoCliente) => {
  const res = carregarNotas()
  if (!res.ok) return res
  const notas = res.dados.notas || []
  const chave = String(codigoCliente).trim()
  const notasDoCliente = notas.filter((n) => String(n.cliente && n.cliente.codigo).trim() === chave)
  if (notasDoCliente.length === 0) {
    return { ok: true, cliente: null, maisComprados: [], menosComprados: [] }
  }
  const agregado = {}
  for (const nota of notasDoCliente) {
    for (const p of nota.produtos || []) {
      if (!p || !p.codigo) continue
      if (!agregado[p.codigo]) {
        agregado[p.codigo] = {
          codigo: p.codigo,
          descricao: p.descricao,
          unidade: p.unidade,
          quantidade: 0,
          valor: 0,
          aparicoes: 0
        }
      }
      agregado[p.codigo].quantidade += Number(p.quantidade) || 0
      agregado[p.codigo].valor += Number(p.valor_total) || 0
      agregado[p.codigo].aparicoes += 1
    }
  }
  const lista = Object.values(agregado)
  const maisComprados = [...lista].sort((a, b) => b.quantidade - a.quantidade).slice(0, 20)
  const menosComprados = [...lista].sort((a, b) => a.aparicoes - b.aparicoes).slice(0, 20)
  return { ok: true, cliente: notasDoCliente[0].cliente, maisComprados, menosComprados }
})

// ===== CONSULTAR — Perguntas em linguagem natural =====
function normalizarTexto(t) {
  return String(t || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

const STOPWORDS = new Set([
  'quem', 'qual', 'quais', 'para', 'com', 'por', 'que', 'o', 'a', 'os', 'as',
  'de', 'do', 'da', 'dos', 'das', 'em', 'no', 'na', 'nos', 'nas', 'um', 'uma',
  'uns', 'umas', 'me', 'te', 'se', 'ele', 'ela', 'eles', 'elas', 'meu', 'minha',
  'como', 'vender', 'compra', 'compram', 'comprou', 'comprados', 'preciso',
  'estao', 'esta', 'está', 'tem', 'teve', 'listar', 'liste', 'mostre', 'mostrar',
  'precisando', 'precisa', 'ja', 'já', 'muito', 'pouco', 'tipo', 'produto',
  'produtos', 'cliente', 'clientes', 'nota', 'notas', 'comprar', 'precisam'
])

function extrairTermos(pergunta) {
  return normalizarTexto(pergunta)
    .split(/[^a-z0-9]+/)
    .filter((p) => p.length >= 4 && !STOPWORDS.has(p))
    .map((p) => (p.endsWith('s') ? p.slice(0, -1) : p))
}

function buscarProdutosPorTermos(notas, termos, codigosPermitidos) {
  const mapa = {}
  const lista = []
  for (const nota of notas) {
    const cliente = nota.cliente || {}
    const codCliente = String(cliente.codigo || '').trim()
    if (!codCliente) continue
    // Filtra pelas notas SOMENTE dos clientes da carteira do vendedor logado
    if (codigosPermitidos && !codigosPermitidos.has(codCliente)) continue
    const dataNota = nota.data || nota.emissao || nota.dataEmissao || ''
    for (const p of nota.produtos || []) {
      if (!p || !p.codigo) continue
      const descNorm = normalizarTexto(p.descricao || '')
      const codNorm = normalizarTexto(String(p.codigo))
      const casa = termos.some((t) => descNorm.includes(t) || codNorm.includes(t))
      if (!casa) continue
      const chave = codCliente + '|' + p.codigo
      if (!mapa[chave]) {
        mapa[chave] = {
          clienteCodigo: codCliente,
          clienteNome: cliente.nome || '',
          produtoCodigo: p.codigo,
          produtoDescricao: p.descricao || '',
          unidade: p.unidade || '',
          quantidade: 0,
          valor: 0,
          numNotas: 0,
          ultimaData: ''
        }
        lista.push(mapa[chave])
      }
      const item = mapa[chave]
      item.quantidade += Number(p.quantidade) || 0
      item.valor += Number(p.valor_total) || 0
      item.numNotas += 1
      if (dataNota && dataNota > item.ultimaData) item.ultimaData = dataNota
    }
  }
  return lista
}

// ===== Busca produtos por CLIENTE e PERÍODO (ex.: últimos 6 meses) =====
// Retorna os produtos que um cliente comprou dentro de um período
function buscarProdutosPorCliente(notas, codCliente, meses = 6) {
  const corte = new Date()
  corte.setMonth(corte.getMonth() - meses)
  const corteStr = corte.toISOString().slice(0, 10)
  const mapa = {}
  const lista = []
  for (const nota of notas) {
    const cliente = nota.cliente || {}
    if (String(cliente.codigo || '').trim() !== String(codCliente).trim()) continue
    const dataNota = nota.data || nota.emissao || nota.dataEmissao || ''
    // Filtra pelo período (últimos N meses)
    if (dataNota && dataNota < corteStr) continue
    for (const p of nota.produtos || []) {
      if (!p || !p.codigo) continue
      if (!mapa[p.codigo]) {
        mapa[p.codigo] = {
          codigo: p.codigo,
          descricao: p.descricao || '',
          unidade: p.unidade || '',
          quantidade: 0,
          valor: 0,
          numNotas: 0,
          ultimaData: ''
        }
        lista.push(mapa[p.codigo])
      }
      const item = mapa[p.codigo]
      item.quantidade += Number(p.quantidade) || 0
      item.valor += Number(p.valor_total) || 0
      item.numNotas += 1
      if (dataNota && dataNota > item.ultimaData) item.ultimaData = dataNota
    }
  }
  // Ordena por valor (mais comprados primeiro)
  lista.sort((a, b) => b.valor - a.valor)
  return lista
}

async function responderComGemini(prompt) {
  const disponiveis = await listarModelosDisponiveis()
  if (disponiveis.length === 0) {
    return { ok: false, erro: 'Não foi possível listar os modelos da sua chave. Verifique a chave no Google AI Studio.' }
  }
  const preferidos = disponiveis.filter((m) => /flash/i.test(m))
  const fila = preferidos.length > 0 ? preferidos : disponiveis
  let ultimoErro = ''
  for (const modelo of fila) {
    try {
      const res = await fetch(
        'https://generativelanguage.googleapis.com/v1beta/models/' + modelo + ':generateContent?key=' + encodeURIComponent(CHAVE_GEMINI),
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
          signal: AbortSignal.timeout(45000)
        }
      )
      if (!res.ok) {
        const t = await res.text()
        ultimoErro = 'Erro na API do Gemini (' + res.status + '): ' + t.slice(0, 200)
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

handleUnico('ia:consultar', async (_e, pergunta) => {
  if (!sessao) return { ok: false, erro: 'Não autenticado' }
  const perguntaTexto = String(pergunta || '').trim()
  if (!perguntaTexto) return { ok: false, erro: 'Digite uma pergunta.' }
  const notasRes = carregarNotas()
  const notas = notasRes.ok ? (notasRes.dados.notas || []) : []
  const termos = extrairTermos(perguntaTexto)
  const dados = dadosParaPerfil()
  const codigosPermitidos = new Set(
    dados.clientes.map((c) => String(c.codigo).trim()).filter(Boolean)
  )
  const produtosEncontrados = buscarProdutosPorTermos(notas, termos, codigosPermitidos).slice(0, 60)
    // ===== DETECTA se a pergunta menciona um CLIENTE específico =====
  // Tenta achar o cliente pelo nome mencionado na pergunta
  const perguntaNorm = normalizarTexto(perguntaTexto)
  let clienteAlvo = null
  for (const c of dados.clientes) {
    const nomeNorm = normalizarTexto(c.nome)
    if (nomeNorm && perguntaNorm.includes(nomeNorm)) {
      clienteAlvo = c
      break
    }
  }
  // Se achou um cliente, busca os produtos que ele comprou nos últimos 6 meses
  let produtosDoCliente = []
  if (clienteAlvo) {
    produtosDoCliente = buscarProdutosPorCliente(notas, clienteAlvo.codigo, 6).slice(0, 20)
  }
  const fichasRelevantes = buscarFichasPorTermos(termos, 5)
  const orcamentosAguardando = (dados.orcamentos || [])
    .filter((o) => o.status === 'aguardando')
    .map((o) => {
      const cli = dados.clientes.find((c) => c.id === o.clienteId)
      const valor = (Number(o.valorInsumos) || 0) + (Number(o.valorEquipamento) || 0)
      return {
        data: o.data,
        cliente: cli ? cli.nome : '(cliente removido)',
        pedidoInsumos: o.pedidoInsumos || '',
        pedidoEquipamento: o.pedidoEquipamento || '',
        valor,
        prazoValidade: o.prazoValidade || ''
      }
    })
  const exemplos = carregarExemplos(sessao.id, 5)
  const contexto = {
    pergunta: perguntaTexto,
    termosBusca: termos,
    produtosEncontrados,
    // ===== NOVO: cliente detectado + produtos dele nos últimos 6 meses =====
    clienteDetectado: clienteAlvo ? { codigo: clienteAlvo.codigo, nome: clienteAlvo.nome } : null,
    produtosDoCliente: clienteAlvo ? produtosDoCliente : [],
    orcamentosAguardando,
    totalClientes: dados.clientes.length,
    totalVendas: dados.vendas.length
  }

  // ===== MUDANÇA: const → let (permite os prompt += abaixo) =====
  let prompt =
    'Você é um consultor de vendas sênior, com 20 anos de experiência, que responde perguntas de vendedores.\n' +
    'Pergunta do vendedor:\n' + perguntaTexto + '\n\n' +
    'Dados disponíveis (use APENAS estes dados — NÃO invente clientes, números ou datas):\n' +
    JSON.stringify(contexto, null, 2) + '\n\n' +
    'Regras de resposta:\n' +
    '- Responda em português, direto e prático, como um consultor experiente.\n' +
    '- Responda APENAS sobre os clientes da carteira do vendedor. NUNCA cite clientes que não estejam nos dados fornecidos.\n' +
    '- Se a pergunta pede clientes, liste os NOMES dos clientes com os dados concretos (produto, quantidade, valor, nº de notas, última data se houver).\n' +
    '- Se a pergunta menciona um produto que NÃO aparece nos dados, diga claramente que não encontrou compras desse produto nas notas.\n' +
    '- Se faltar informação (ex.: data das notas), diga o que falta de forma transparente.\n' +
    '- Termine SEMPRE com uma sugestão de ação prática (ligar, visitar, enviar proposta, oferta).\n' +
    // ===== INTELIGÊNCIA BIOMÉDICA E CROSS-SELLING =====
    'INTELIGÊNCIA DE VENDAS (cross-selling):\n' +
    '- Quando a pergunta envolve um produto, analise as notas para identificar OUTROS produtos que os MESMOS clientes costumam comprar juntos (correlação real de compras).\n' +
    '- Sugira esses produtos complementares como oportunidade de venda, com base nos dados reais das notas.\n' +
    '- Use as FICHAS TÉCNICAS fornecidas para explicar a RELAÇÃO TÉCNICA entre os produtos (ex.: quem compra tubo de coleta também precisa de agulha múltipla).\n' +
    '- NUNCA invente produtos que não existam nas notas ou no catálogo. Só sugira produtos que apareçam nos dados ou nas fichas técnicas fornecidas.\n' +
    '- Quando sugerir um produto complementar, diga o CÓDIGO e o NOME exatos do produto, e explique POR QUE ele é complementar (uso conjunto, aplicação clínica).\n' +
    '- Se houver fichas técnicas, use o conhecimento biomédico (aplicações clínicas, compatibilidades) para dar credibilidade técnica à sugestão.\n'

  // ===== CATÁLOGO: injeta fichas técnicas no prompt =====
  if (fichasRelevantes.length > 0) {
    prompt += '\nFICHAS TÉCNICAS DOS PRODUTOS RELACIONADOS (use para explicar o produto com conhecimento técnico):\n' +
      JSON.stringify(fichasRelevantes.map((p) => p.ficha), null, 2) + '\n'
  }

  // ===== MEMÓRIA: injeta exemplos de respostas boas (few-shot) =====
  if (exemplos.length > 0) {
    prompt += '\nExemplos de respostas que este vendedor avaliou como BOAS (use o MESMO estilo, formato e nível de detalhe):\n' +
      JSON.stringify(exemplos, null, 2) + '\n'
  }

  const res = await responderComGemini(prompt)
  if (res.ok) {
    registrarConsulta(sessao.id, perguntaTexto, res.texto)
    return { ok: true, texto: res.texto, consultaId: res.consultaId }
  }
  return res
})
// ===== UTILITÁRIOS =====
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
let sessao = null
let mainWindow = null

// ===== CÁLCULO DO VALOR PARA A META (pedido − frete) =====
// O frete pode ser valor fixo (R$) ou porcentagem (%) do total do pedido.
// O valor que conta para a META = (insumos + equipamentos) − frete.
function calcularValorMeta(orcamentoOuVenda) {
  const insumos = Number(orcamentoOuVenda.valorInsumos) || 0
  const equip = Number(orcamentoOuVenda.valorEquipamento) || 0
  const total = insumos + equip
  const frete = orcamentoOuVenda.frete || 0
  let valorFrete = 0
  if (typeof frete === 'string' && frete.toString().trim().endsWith('%')) {
    const pct = parseFloat(frete) || 0
    valorFrete = (total * pct) / 100
  } else {
    valorFrete = Number(frete) || 0
  }
  const meta = Math.max(0, total - valorFrete)
  return { total, valorFrete, meta }
}

// --- Login ---
handleUnico('auth:login', (_e, { usuario, senha }) => {
  const vendedores = carregarVendedores()
  const vendedor = vendedores.find((v) => v.usuario.toLowerCase() === usuario.toLowerCase())
  if (!vendedor) return { ok: false, erro: 'Usuário não encontrado' }
  if (!bcrypt.compareSync(senha, vendedor.senhaHash)) return { ok: false, erro: 'Senha incorreta' }
  sessao = { id: vendedor.id, nome: vendedor.nome, usuario: vendedor.usuario, admin: !!vendedor.admin }
  const { senhaHash, ...seguro } = vendedor
  // ===== NOVO: expõe o flag para o front saber se deve pedir troca de senha =====
  seguro.trocarSenhaNoProximoLogin = !!vendedor.trocarSenhaNoProximoLogin
  return { ok: true, vendedor: seguro }
})

// ===== NOVO: troca obrigatória de senha no primeiro acesso =====
handleUnico('auth:trocarSenha', (_e, { vendedorId, senhaAtual, novaSenha }) => {
  const vendedores = carregarVendedores()
  const vendedor = vendedores.find((v) => v.id === vendedorId)
  if (!vendedor) return { ok: false, erro: 'Vendedor não encontrado' }
  // Valida a senha atual (segurança: só troca quem sabe a senha vigente)
  if (!bcrypt.compareSync(senhaAtual, vendedor.senhaHash)) {
    return { ok: false, erro: 'A senha atual não confere. Volte ao login e tente novamente.' }
  }
  const nova = String(novaSenha || '')
  if (nova.length < 6) return { ok: false, erro: 'A nova senha deve ter ao menos 6 caracteres.' }
  if (bcrypt.compareSync(nova, vendedor.senhaHash)) {
    return { ok: false, erro: 'A nova senha não pode ser igual à senha atual.' }
  }
  // Salva a nova senha e desliga o flag de troca obrigatória
  vendedor.senhaHash = bcrypt.hashSync(nova, 10)
  vendedor.trocarSenhaNoProximoLogin = false
  salvarVendedores(vendedores)
  // Atualiza a sessão ativa com o mesmo usuário
  sessao = { id: vendedor.id, nome: vendedor.nome, usuario: vendedor.usuario, admin: !!vendedor.admin }
  const { senhaHash, ...seguro } = vendedor
  seguro.trocarSenhaNoProximoLogin = false
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
	trocarSenhaNoProximoLogin: true,
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
  const senhaMudou = !!vendedor.senha
  const senhaHash = senhaMudou ? bcrypt.hashSync(vendedor.senha, 10) : atual.senhaHash
  vendedores[idx] = {
    ...atual,
    nome: capitalizarTexto(vendedor.nome),
    usuario: vendedor.usuario,
    admin: !!vendedor.admin,
    metaMensal: Number(vendedor.metaMensal) || 100000,
    metaSemanal: Number(vendedor.metaSemanal) || 25000,
    senhaHash,
    trocarSenhaNoProximoLogin: senhaMudou ? true : (atual.trocarSenhaNoProximoLogin || false)
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
      orcamentos: d.orcamentos || [],
      orcamentosPerdidos: d.orcamentosPerdidos || [],
      metaMensal: 100000
    }
  }
  return { vendedores: [], clientes: [], vendas: [], orcamentos: [], orcamentosPerdidos: [], metaMensal: 100000 }
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
    return { ok: false, erro: 'Já existe um cliente com o ID ' + codigo }
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
    envio: cliente.envio || '',
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
    return { ok: false, erro: 'Já existe um cliente com o ID ' + codigo }
  }
  dados.clientes[idx] = {
    ...dados.clientes[idx],
    codigo,
    nome: capitalizarTexto(cliente.nome),
    cnpj: cliente.cnpj || '',
    email: cliente.email || '',
    whats: cliente.whats || '',
    cidade: capitalizarTexto(cliente.cidade),
    segmento: capitalizarTexto(cliente.segmento),
    envio: cliente.envio || ''
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
    frete: venda.frete || 0,
    data: venda.data || new Date().toISOString().slice(0, 10),
    observacao: venda.observacao || ''
  }
  dados.vendas.push(nova)
  salvarDadosVendedor(sessao.id, dados)
  const metaCalc = calcularValorMeta(nova)
  return { ok: true, venda: { ...nova, valorMeta: metaCalc.meta, valorFrete: metaCalc.valorFrete } }
})

handleUnico('vendas:atualizar', (_e, venda) => {
  if (!sessao) return { ok: false, erro: 'Não autenticado' }
  const dados = dadosDoVendedor()
  const idx = dados.vendas.findIndex((v) => v.id === venda.id)
  if (idx === -1) return { ok: false, erro: 'Venda não encontrada' }
  const campos = ['clienteId', 'envio', 'pedidoInsumos', 'valorInsumos', 'pedidoEquipamento', 'valorEquipamento', 'frete', 'data', 'observacao']
  const atual = dados.vendas[idx]
  campos.forEach((c) => {
    if (venda[c] !== undefined) {
      atual[c] = c.startsWith('valor') ? Number(venda[c]) || 0 : venda[c]
    }
  })
  salvarDadosVendedor(sessao.id, dados)
  const metaCalc = calcularValorMeta(atual)
  return { ok: true, venda: { ...atual, valorMeta: metaCalc.meta, valorFrete: metaCalc.valorFrete } }
})

handleUnico('vendas:deletar', (_e, id) => {
  if (!sessao) return { ok: false, erro: 'Não autenticado' }
  const dados = dadosDoVendedor()
  dados.vendas = dados.vendas.filter((v) => v.id !== id)
  salvarDadosVendedor(sessao.id, dados)
  return { ok: true }
})

// --- Orçamentos (funil: aguardando / aprovado / recusado) ---
handleUnico('orcamentos:listar', (_e, vendedorId) => {
  const dados = dadosParaPerfil()
  if (sessao && !sessao.admin) return dados.orcamentos || []
  if (vendedorId) return (dados.orcamentos || []).filter((o) => o.vendedorId === vendedorId)
  return dados.orcamentos || []
})

handleUnico('orcamentos:criar', (_e, orcamento) => {
  if (!sessao) return { ok: false, erro: 'Não autenticado' }
  const dados = dadosDoVendedor()
  dados.orcamentos = dados.orcamentos || []
  const novo = {
    id: randomUUID(),
    clienteId: orcamento.clienteId || '',
    vendedorId: sessao.id,
    envio: orcamento.envio || '',
    pedidoInsumos: orcamento.pedidoInsumos || '',
    valorInsumos: Number(orcamento.valorInsumos) || 0,
    pedidoEquipamento: orcamento.pedidoEquipamento || '',
    valorEquipamento: Number(orcamento.valorEquipamento) || 0,
    frete: orcamento.frete || 0,
    data: orcamento.data || new Date().toISOString().slice(0, 10),
    prazoValidade: orcamento.prazoValidade || '',
    observacao: orcamento.observacao || '',
    status: 'aguardando'
  }
  dados.orcamentos.push(novo)
  salvarDadosVendedor(sessao.id, dados)
  const metaCalc = calcularValorMeta(novo)
  return { ok: true, orcamento: { ...novo, valorMeta: metaCalc.meta, valorFrete: metaCalc.valorFrete } }
})

handleUnico('orcamentos:atualizar', (_e, orcamento) => {
  if (!sessao) return { ok: false, erro: 'Não autenticado' }
  const dados = dadosDoVendedor()
  const i = (dados.orcamentos || []).findIndex((o) => o.id === orcamento.id)
  if (i === -1) return { ok: false, erro: 'Orçamento não encontrado' }
  const atual = dados.orcamentos[i]
  dados.orcamentos[i] = {
    ...atual,
    clienteId: orcamento.clienteId ?? atual.clienteId,
    envio: orcamento.envio ?? atual.envio,
    pedidoInsumos: orcamento.pedidoInsumos ?? atual.pedidoInsumos,
    valorInsumos: Number(orcamento.valorInsumos) || 0,
    pedidoEquipamento: orcamento.pedidoEquipamento ?? atual.pedidoEquipamento,
    valorEquipamento: Number(orcamento.valorEquipamento) || 0,
    frete: orcamento.frete ?? atual.frete,
    data: orcamento.data ?? atual.data,
    prazoValidade: orcamento.prazoValidade ?? atual.prazoValidade,
    observacao: orcamento.observacao ?? atual.observacao
  }
  salvarDadosVendedor(sessao.id, dados)
  const metaCalc = calcularValorMeta(dados.orcamentos[i])
  return { ok: true, orcamento: { ...dados.orcamentos[i], valorMeta: metaCalc.meta, valorFrete: metaCalc.valorFrete } }
})

// APROVAR: recebe os NOVOS números de pedido e copia o frete para a venda
handleUnico('orcamentos:aprovar', (_e, id, info) => {
  if (!sessao) return { ok: false, erro: 'Não autenticado' }
  const dados = dadosDoVendedor()
  const orc = (dados.orcamentos || []).find((o) => o.id === id)
  if (!orc) return { ok: false, erro: 'Orçamento não encontrado' }
  if (orc.status === 'aprovado') return { ok: true }
  const pedidoInsumos = (info && info.pedidoInsumos) ? String(info.pedidoInsumos).trim() : ''
  const pedidoEquipamento = (info && info.pedidoEquipamento) ? String(info.pedidoEquipamento).trim() : ''
  if (!pedidoInsumos && !pedidoEquipamento) {
    return { ok: false, erro: 'Informe ao menos o Ped. Insumos ou o Ped. Equip. para aprovar o orçamento.' }
  }
  dados.vendas.push({
    id: randomUUID(),
    clienteId: orc.clienteId || '',
    vendedorId: sessao.id,
    envio: orc.envio || '',
    pedidoInsumos: pedidoInsumos,
    valorInsumos: Number(orc.valorInsumos) || 0,
    pedidoEquipamento: pedidoEquipamento,
    valorEquipamento: Number(orc.valorEquipamento) || 0,
    frete: orc.frete || 0,
    data: orc.data || new Date().toISOString().slice(0, 10),
    observacao: orc.observacao || ''
  })
  orc.status = 'aprovado'
  orc.pedidoFinalInsumos = pedidoInsumos
  orc.pedidoFinalEquipamento = pedidoEquipamento
  salvarDadosVendedor(sessao.id, dados)
  return { ok: true }
})

handleUnico('orcamentos:recusar', (_e, id, info) => {
  if (!sessao) return { ok: false, erro: 'Não autenticado' }
  const dados = dadosDoVendedor()
  const orc = (dados.orcamentos || []).find((o) => o.id === id)
  if (!orc) return { ok: false, erro: 'Orçamento não encontrado' }
  orc.status = 'recusado'
  orc.motivo = (info && info.motivo) || ''
  orc.concorrente = (info && info.concorrente) || ''
  orc.observacaoRecusa = (info && info.observacao) || ''
  salvarDadosVendedor(sessao.id, dados)
  return { ok: true }
})

handleUnico('orcamentos:deletar', (_e, id) => {
  if (!sessao) return { ok: false, erro: 'Não autenticado' }
  const dados = dadosDoVendedor()
  dados.orcamentos = (dados.orcamentos || []).filter((o) => o.id !== id)
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

// ===== INTELIGÊNCIA ARTIFICIAL — Gemini API =====
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

async function analisarComGemini(dados, perfilNome) {
  const padroes = calcularPadroesPorCliente(dados.clientes, dados.vendas)
  padroes.forEach((p) => {
    const cli = dados.clientes.find((c) => c.nome === p.nome)
    p.historico = (cli && cli.historico) || []
  })
  const resumo = {
    perfil: perfilNome,
    totalClientes: dados.clientes.length,
    totalVendas: dados.vendas.length,
    totalFaturado: dados.vendas.reduce((s, v) => s + Number(v.valorInsumos || 0) + Number(v.valorEquipamento || 0), 0),
    orcamentosPerdidos: dados.orcamentosPerdidos.length,
    padroesPorCliente: padroes
  }
  const orcamentosAguardando = (dados.orcamentos || [])
    .filter((o) => o.status === 'aguardando')
    .map((o) => {
      const cli = dados.clientes.find((c) => c.id === o.clienteId)
      const valor = (Number(o.valorInsumos) || 0) + (Number(o.valorEquipamento) || 0)
      return '- ' + o.data + ' | ' + (cli ? cli.nome : '(cliente removido)') + ' | ' + (o.pedidoInsumos || '') + ' ' + (o.pedidoEquipamento || '') + ' | R$ ' + valor + ' | válido até ' + (o.prazoValidade || '—')
    })
    .join('\n')
  resumo.orcamentosAguardando = orcamentosAguardando
  const prompt = 'Você é um consultor de vendas sênior, com 20 anos de experiência, que ajuda vendedores a baterem a meta. Você analisa os dados da carteira e dá DICAS PRÁTICAS E ACIONÁVEIS — sempre dizendo o que o vendedor deve FAZER, com quem, e como.\nAnalise os padrões abaixo e gere 6 dicas de vendas. Para cada dica:\n1. Diga EXATAMENTE qual cliente está envolvido (nome).\n2. Explique o padrão encontrado com o dado concreto (frequência, valor, dias).\n3. Dê a AÇÃO prática: o que fazer (ligar, visitar, enviar proposta, oferta especial, etc.) e quando.\nCRUZAMENTO COM O HISTÓRICO: cada cliente traz o campo "historico" com as interações já feitas (ligação, promoção, visita, proposta, observação). CONFLITE os padrões com esse histórico:\n- Se já foi enviada promoção ou oferta recente para o cliente, NÃO REPITA a mesma oferta — sugira uma ação complementar (follow-up por ligação, proposta diferente, agendamento de visita).\n- Se já foi feita uma ligação sem retorno, sugira abordagem diferente e em outro horário/dia.\n- Use o histórico para priorizar: cliente com interação recente e compra pendente tem mais chance de fechar.\nORÇAMENTOS AGUARDANDO (orçamentos que o vendedor fez e precisa ser lembrado):\n' + (orcamentosAguardando || '(nenhum)') + '\n- LEMBRETE: se algum orçamento pendente está perto do prazo de validade (prazoValidade), inclua uma dica para o vendedor retomar/cobrar esse orçamento com o cliente.\nFoque em:\n- Clientes que PARARAM de comprar (churn): compare o intervalo médio entre compras com os dias desde a última compra. Se o cliente comprava a cada X dias e já passou disso, é URGENTE — dica de como recuperá-lo, considerando o que já foi tentado no histórico.\n- Clientes que compram em dias específicos da semana: dica de contato nesse dia.\n- Clientes com ticket médio alto: dica de como aumentar o valor (upsell/cross-sell).\n- Clientes com alta frequência: dica de como fidelizar ainda mais.\n- Clientes que compraram pouco mas têm potencial: dica de como desenvolver.\n- Padrões por segmento ou cidade.\nNão invente clientes, números ou interações que não estão nos dados. Seja específico e direto, como um consultor experiente falando com um vendedor.\nDados:\n' + JSON.stringify(resumo, null, 2) + '\nFormato de resposta: apenas uma lista numerada de 1 a 6, cada dica em uma linha, sem texto adicional.'
  const disponiveis = await listarModelosDisponiveis()
  if (disponiveis.length === 0) {
    return { ok: false, erro: 'Não foi possível listar os modelos da sua chave. Verifique a chave no Google AI Studio.' }
  }
  const preferidos = disponiveis.filter((m) => /flash/i.test(m))
  const fila = preferidos.length > 0 ? preferidos : disponiveis
  let ultimoErro = ''
  for (const modelo of fila) {
    try {
      const res = await fetch(
        'https://generativelanguage.googleapis.com/v1beta/models/' + modelo + ':generateContent?key=' + encodeURIComponent(CHAVE_GEMINI),
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
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
      return { ok: true, texto: texto || '', consultaId: randomUUID() }
    } catch (err) {
      ultimoErro = 'Falha na conexão com a IA: ' + String(err)
    }
  }
  return { ok: false, erro: ultimoErro }
}

// ===== Retorna a carteira de clientes do vendedor logado (para @menção) =====
handleUnico('ia:carteira', async () => {
  if (!sessao) return { ok: false, erro: 'Não autenticado' }
  const dados = dadosParaPerfil()
  const clientes = (dados.clientes || []).map((c) => ({
    codigo: c.codigo,
    nome: c.nome,
    cidade: c.cidade || ''
  }))
  return { ok: true, clientes }
})

handleUnico('ia:analisar', async () => {
  if (!sessao) return { ok: false, erro: 'Não autenticado' }
  const dados = dadosParaPerfil()
  const perfilNome = sessao.admin ? 'Gerente (todos os vendedores)' : sessao.nome
  return analisarComGemini(dados, perfilNome)
})

// --- Backups ---
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

// --- Consulta CNPJ (com fallback de 3 APIs) ---
handleUnico('cnpj:consultar', async (_e, cnpj) => {
  const limpo = String(cnpj || '').replace(/\D/g, '')
  if (limpo.length !== 14) return { ok: false, erro: 'CNPJ inválido' }
  const apis = [
    {
      nome: 'BrasilAPI',
      url: 'https://brasilapi.com.br/api/cnpj/v1/' + limpo,
      parse: (d) => ({ razaoSocial: d.razao_social, nomeFantasia: d.nome_fantasia || '' })
    },
    {
      nome: 'Minha Receita',
      url: 'https://www.minhareceita.org/' + limpo,
      parse: (d) => ({ razaoSocial: d.razao_social || d.nome || '', nomeFantasia: d.nome_fantasia || '' })
    },
    {
      nome: 'ReceitaWS',
      url: 'https://receitaws.com.br/v1/cnpj/' + limpo,
      parse: (d) => ({ razaoSocial: d.nome || '', nomeFantasia: d.fantasia || '' })
    }
  ]
  for (const api of apis) {
    try {
      const res = await fetch(api.url, { signal: AbortSignal.timeout(10000) })
      if (res.status === 404) continue
      if (!res.ok) continue
      const dados = await res.json()
      if (dados && dados.error) continue
      const parseado = api.parse(dados)
      if (parseado.razaoSocial) return { ok: true, fonte: api.nome, ...parseado }
    } catch (err) {
      console.error('Erro na consulta CNPJ', api.nome, err)
    }
  }
  return { ok: false, erro: 'Não foi possível consultar o CNPJ em nenhuma API. Verifique a conexão ou digite o nome manualmente.' }
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
    orcamentos: novosDados.orcamentos || [],
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

// --- Histórico de interações ---
handleUnico('historico:listar', (_e, clienteId) => {
  const dados = dadosParaPerfil()
  const cliente = dados.clientes.find((c) => c.id === clienteId)
  return (cliente && cliente.historico) || []
})
handleUnico('historico:salvar', (_e, clienteId, item) => {
  if (!sessao) return { ok: false, erro: 'Não autenticado' }
  const dados = dadosDoVendedor()
  const idx = dados.clientes.findIndex((c) => c.id === clienteId)
  if (idx === -1) return { ok: false, erro: 'Cliente não encontrado' }
  dados.clientes[idx].historico = dados.clientes[idx].historico || []
  dados.clientes[idx].historico.push({
    data: new Date().toISOString(),
    tipo: item.tipo || 'obs',
    descricao: String(item.descricao || '').trim(),
    usuario: sessao.nome
  })
  salvarDadosVendedor(sessao.id, dados)
  return { ok: true }
})

handleUnico('app:reiniciarAtualizar', () => {
  autoUpdater.quitAndInstall()
  return { ok: true }
})

// --- Janela ---
function createWindow() {
  const win = new BrowserWindow({
    width: 1366,
    height: 768,
    minWidth: 1024,
    minHeight: 700,
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
  mainWindow = win
  win.webContents.on('did-finish-load', () => {
    win.webContents.setZoomFactor(1)
  })
  win.once('ready-to-show', () => win.show())
  win.maximize()
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })
  if (process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

// ===== Auto-update (electron-updater) =====
function configurarAutoUpdate(win) {
  // Só atualiza em produção (app empacotado), nunca no "npm run dev"
  if (!app.isPackaged) return

  autoUpdater.autoDownload = true
  autoUpdater.autoInstallOnAppQuit = true

  // Avisa o front quando a atualização foi baixada
  autoUpdater.on('update-downloaded', () => {
    win.webContents.send('update:baixado')
  })

  autoUpdater.on('error', (err) => {
    console.error('Erro no auto-update:', err)
  })

  // Verifica atualização ao iniciar
  autoUpdater.checkForUpdatesAndNotify()
}

app.whenReady().then(() => {
  createWindow()
  configurarAutoUpdate(mainWindow)
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