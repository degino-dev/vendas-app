// src/main/memoriaIA.js
// Sistema de memória e aprendizado da IA por vendedor
// Guarda consultas + avaliações (👍/👎) para a IA responder cada vez melhor
import { join } from 'path'
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import { app } from 'electron'
import { randomUUID } from 'crypto'

// Caminho base dos dados (mesmo usado pelo storage)
function pastaBase() {
  const caminho = process.env.ADAPTA_DADOS || 'U:/DADOS DO APP'
  return caminho
}

function caminhoMemoria(vendedorId) {
  return join(pastaBase(), 'memoriaIA_' + vendedorId + '.json')
}

function carregarMemoria(vendedorId) {
  const caminho = caminhoMemoria(vendedorId)
  if (!existsSync(caminho)) {
    return { consultas: [], avaliadas: [] }
  }
  try {
    return JSON.parse(readFileSync(caminho, 'utf-8'))
  } catch (err) {
    console.error('Erro ao ler memória IA:', err)
    return { consultas: [], avaliadas: [] }
  }
}

function salvarMemoria(vendedorId, memoria) {
  const caminho = caminhoMemoria(vendedorId)
  try {
    const dir = pastaBase()
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
    writeFileSync(caminho, JSON.stringify(memoria, null, 2), 'utf-8')
  } catch (err) {
    console.error('Erro ao salvar memória IA:', err)
  }
}

// Registra uma consulta feita (pergunta + resposta)
export function registrarConsulta(vendedorId, pergunta, resposta) {
  const memoria = carregarMemoria(vendedorId)
  memoria.consultas.push({
    id: randomUUID(),
    data: new Date().toISOString(),
    pergunta,
    resposta: String(resposta || '').slice(0, 2000)
  })
  // Mantém no máximo 100 consultas recentes
  if (memoria.consultas.length > 100) {
    memoria.consultas = memoria.consultas.slice(-100)
  }
  salvarMemoria(vendedorId, memoria)
}

// Registra uma avaliação do vendedor (👍 = boa, 👎 = ruim)
// Respostas boas viram exemplos de referência para o futuro
export function registrarAvaliacao(vendedorId, consultaId, nota) {
  const memoria = carregarMemoria(vendedorId)
  const consulta = memoria.consultas.find((c) => c.id === consultaId)
  if (!consulta) return { ok: false, erro: 'Consulta não encontrada' }
  consulta.avaliacao = nota === 'bom' ? 'bom' : 'ruim'
  // Se foi boa, guarda como exemplo de referência (few-shot)
  if (consulta.avaliacao === 'bom') {
    memoria.avaliadas.push({
      pergunta: consulta.pergunta,
      resposta: consulta.resposta,
      data: new Date().toISOString()
    })
    // Mantém no máximo 20 exemplos bons
    if (memoria.avaliadas.length > 20) {
      memoria.avaliadas = memoria.avaliadas.slice(-20)
    }
  }
  salvarMemoria(vendedorId, memoria)
  return { ok: true }
}

// Carrega os exemplos de respostas bem avaliadas (para injetar no prompt)
export function carregarExemplos(vendedorId, limite = 5) {
  const memoria = carregarMemoria(vendedorId)
  return (memoria.avaliadas || []).slice(-limite)
}

// Carrega as consultas recentes (para o vendedor ver histórico)
export function carregarConsultasRecentes(vendedorId, limite = 20) {
  const memoria = carregarMemoria(vendedorId)
  return (memoria.consultas || []).slice(-limite).reverse()
}