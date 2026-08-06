// importar-vendas.js
// Importa vendas do CSV para o banco do app, vinculando cada venda ao cliente
// pelo SKU (código) já importado na tabela de clientes. Atribui à Fabiana.
// SKUs não encontrados viram clientes marcadores "Cliente não identificado N".
//
// COMO USAR:
// 1. Salve a aba de vendas como CSV UTF-8 com o nome: vendasfabiana.csv (na pasta do projeto)
// 2. Rode: node importar-vendas.js   (modo teste: mostra amostra, NÃO salva)
// 3. Confira. Se estiver bom, mude MODO_TESTE para false e rode de novo.

const fs = require('fs')
const path = require('path')
const crypto = require('crypto')

// ===== CONFIGURAÇÃO =====
const MODO_TESTE = false              // true = mostra amostra sem salvar | false = importa e salva
const QUANTIDADE_TESTE = 15          // quantas vendas mostrar no modo teste
const NOME_VENDEDORA = 'fabiana'     // vendedora responsável pelas vendas
const ARQUIVO_CSV = 'vendasfabiana.csv'
const CAMINHO_DADOS = '//192.168.1.201/vendas/dados.json'
// ==========================

// --- Descobrir o caminho do banco (se CAMINHO_DADOS estiver vazio) ---
function descobrirCaminhoDados() {
  if (CAMINHO_DADOS) return CAMINHO_DADOS
  const candidatos = [path.join(__dirname, 'dados.json')]
  const appdata = process.env.APPDATA
  if (appdata) {
    const pastaApp = path.join(appdata, 'vendas-app')
    candidatos.push(path.join(pastaApp, 'dados.json'))
    if (fs.existsSync(pastaApp)) {
      try {
        for (const f of fs.readdirSync(pastaApp)) {
          if (f.endsWith('.json')) candidatos.push(path.join(pastaApp, f))
        }
      } catch (e) {}
    }
  }
  return candidatos.find((c) => fs.existsSync(c)) || null
}

// --- Ler CSV ---
function lerCsv(caminho) {
  let texto = fs.readFileSync(caminho, 'utf8')
  texto = texto.replace(/^\uFEFF/, '')
  const primeiraLinha = texto.split(/\r?\n/)[0]
  const sep = (primeiraLinha.match(/;/g) || []).length >= (primeiraLinha.match(/,/g) || []).length ? ';' : ','
  const linhas = texto.split(/\r?\n/).filter((l) => l.trim() !== '')
  const temCabecalho = /(sku|codigo|nome|envio|pedido|valor|data)/i.test(linhas[0])
  const inicio = temCabecalho ? 1 : 0
  const cabecalho = temCabecalho
    ? linhas[0].split(sep).map((h) => h.replace(/^"|"$/g, '').trim().toUpperCase())
    : []
  const dados = []
  for (let i = inicio; i < linhas.length; i++) {
    const cols = linhas[i].split(sep).map((c) => c.replace(/^"|"$/g, '').trim())
    if (cols.filter((c) => c !== '').length === 0) continue
    dados.push({ cols, cabecalho })
  }
  return dados
}

// --- Converter data DD/MM/AAAA -> AAAA-MM-DD ---
function parseData(valor) {
  const m = String(valor).match(/(\d{2})\/(\d{2})\/(\d{4})/)
  if (m) return m[3] + '-' + m[2] + '-' + m[1]
  return ''
}

// --- Converter valor "R$ 1.988,00" -> 1988.00 ---
function parseValor(valor) {
  if (valor === undefined || valor === null) return 0
  let s = String(valor).replace(/R\$/gi, '').replace(/\s/g, '')
  if (!s) return 0
  if (s.includes(',')) {
    s = s.replace(/\./g, '').replace(',', '.')
  }
  const n = Number(s)
  return isNaN(n) ? 0 : n
}

// --- Encontrar um campo por nome no cabeçalho OU por posição ---
function campo(linha, nomesPossiveis, posicoesPossiveis) {
  if (linha.cabecalho && linha.cabecalho.length > 0) {
    for (let i = 0; i < linha.cabecalho.length; i++) {
      const h = linha.cabecalho[i]
      for (const n of nomesPossiveis) {
        if (h === n || h.includes(n)) {
          return (linha.cols[i] || '').trim()
        }
      }
    }
  }
  for (const p of posicoesPossiveis) {
    if (linha.cols[p] !== undefined && linha.cols[p] !== '') return linha.cols[p].trim()
  }
  return ''
}

// --- Main ---
function main() {
  const caminhoCsv = path.join(__dirname, ARQUIVO_CSV)
  if (!fs.existsSync(caminhoCsv)) {
    console.error('Arquivo nao encontrado: ' + caminhoCsv)
    console.error('Salve a aba de vendas como CSV UTF-8 com o nome ' + ARQUIVO_CSV + ' na pasta do projeto.')
    process.exit(1)
  }

  const linhas = lerCsv(caminhoCsv)
  console.log('Linhas lidas do CSV de vendas:', linhas.length)

  const caminhoDados = descobrirCaminhoDados()
  if (!caminhoDados) {
    console.error('Nao encontrei o arquivo de dados do app. Defina CAMINHO_DADOS no topo.')
    process.exit(1)
  }
  console.log('Banco de dados encontrado:', caminhoDados)

  const dados = JSON.parse(fs.readFileSync(caminhoDados, 'utf8'))

  const fabiana = (dados.vendedores || []).find(
    (v) =>
      (v.nome || '').toLowerCase().includes(NOME_VENDEDORA) ||
      (v.usuario || '').toLowerCase().includes(NOME_VENDEDORA)
  )
  if (!fabiana) {
    console.error('Vendedora "' + NOME_VENDEDORA + '" nao encontrada.')
    process.exit(1)
  }
  console.log('Atribuindo vendas a: ' + fabiana.nome + ' (id: ' + fabiana.id + ')')

  // Índice de clientes por código
  const clientesPorSku = new Map()
  for (const c of dados.clientes || []) {
    clientesPorSku.set(Number(c.codigo), c)
  }

  // Contador para clientes não identificados
  let contadorNaoIdentificado = 0
  const naoIdentificados = new Map() // sku -> cliente marcador

  function obterClienteNaoIdentificado(sku) {
    if (naoIdentificados.has(sku)) return naoIdentificados.get(sku)
    contadorNaoIdentificado++
    const marcador = {
      id: crypto.randomUUID(),
      codigo: sku,
      nome: 'Cliente nao identificado ' + contadorNaoIdentificado,
      cnpj: '',
      email: '',
      whats: '',
      cidade: '',
      segmento: '',
      vendedorId: fabiana.id
    }
    naoIdentificados.set(sku, marcador)
    return marcador
  }

  // Chaves já existentes (cliente + pedido + data) para não duplicar
  const chavesExistentes = new Set(
    (dados.vendas || []).map((v) => v.clienteId + '|' + (v.pedidoInsumos || '') + '|' + (v.data || ''))
  )

  const linhasParaImportar = MODO_TESTE ? linhas.slice(0, QUANTIDADE_TESTE) : linhas
  let importadas = 0
  let duplicadas = 0
  let semCliente = 0
  const novasVendas = []
  const novosClientes = []

  for (const linha of linhasParaImportar) {
    const sku = Number(campo(linha, ['SKU', 'CODIGO', 'ID'], [0]))
    const envio = (campo(linha, ['ENVIO'], [1]) || 'WHATS').toUpperCase()
    const pedidoInsumos = campo(linha, ['PEDIDO INSUMOS', 'PEDIDO_INSUMOS'], [2])
    const valorInsumos = parseValor(campo(linha, ['VALOR INSUMOS', 'VALOR_INSUMOS'], [3]))
    const pedidoEquip = campo(linha, ['PEDIDO EQUIPAMENTO', 'PEDIDO_EQUIPAMENTO'], [4])
    const valorEquip = parseValor(campo(linha, ['VALOR EQUIPAMENTO', 'VALOR_EQUIPAMENTO'], [5]))
    const data = parseData(campo(linha, ['DATA'], [6]))
    const observacao = campo(linha, ['OBSERVACAO', 'OBSERVAÇAO'], [7])

    let cliente = clientesPorSku.get(sku)
    if (!cliente) {
      // Cria marcador "Cliente não identificado N"
      cliente = obterClienteNaoIdentificado(sku)
      if (!novosClientes.some((c) => c.id === cliente.id)) {
        novosClientes.push(cliente)
      }
      semCliente++
    }

    const chave = cliente.id + '|' + pedidoInsumos + '|' + data
    if (chavesExistentes.has(chave)) {
      duplicadas++
      continue
    }

    novasVendas.push({
      id: crypto.randomUUID(),
      clienteId: cliente.id,
      vendedorId: fabiana.id,
      envio: envio,
      pedidoInsumos: pedidoInsumos,
      valorInsumos: valorInsumos,
      pedidoEquipamento: pedidoEquip,
      valorEquipamento: valorEquip,
      data: data,
      observacao: observacao
    })
    chavesExistentes.add(chave)
    importadas++
  }

  if (MODO_TESTE) {
    console.log('')
    console.log('===== MODO TESTE (nao salvou nada) =====')
    console.log('Mostrando as ' + novasVendas.length + ' primeiras vendas como ficariam:')
    console.log('')
    novasVendas.forEach((v) => {
      const cli = dados.clientes.find((c) => c.id === v.clienteId) ||
        novosClientes.find((c) => c.id === v.clienteId)
      console.log(
        'SKU ' + (cli ? cli.codigo : '?') + ' | ' + (cli ? cli.nome : '?') +
        ' | ' + v.envio + ' | Ped.Insumos: ' + v.pedidoInsumos +
        ' | R$ ' + v.valorInsumos.toFixed(2) +
        ' | Ped.Equip: ' + v.pedidoEquipamento +
        ' | R$ ' + v.valorEquipamento.toFixed(2) +
        ' | ' + v.data
      )
    })
    console.log('')
    console.log('Clientes nao identificados nesta amostra:')
    if (novosClientes.length === 0) {
      console.log('  (nenhum)')
    } else {
      novosClientes.forEach((c) => console.log('  - SKU ' + c.codigo + ' -> ' + c.nome))
    }
    console.log('')
    console.log('Tudo certo? Entao abra o importar-vendas.js, mude MODO_TESTE para false e rode de novo.')
  } else {
    const backupPath = caminhoDados + '.backup_' + new Date().toISOString().replace(/[:.]/g, '-')
    fs.copyFileSync(caminhoDados, backupPath)
    console.log('Backup criado:', backupPath)

    // adiciona clientes marcadores (se houver) e as vendas
    if (novosClientes.length > 0) {
      dados.clientes = (dados.clientes || []).concat(novosClientes)
    }
    dados.vendas = (dados.vendas || []).concat(novasVendas)
    fs.writeFileSync(caminhoDados, JSON.stringify(dados, null, 2), 'utf8')
    console.log('')
    console.log('Importacao concluida!')
    console.log('Vendas importadas:', importadas)
    console.log('Duplicadas (puladas):', duplicadas)
    console.log('Clientes nao identificados criados:', novosClientes.length)
    if (novosClientes.length > 0) {
      console.log('')
      console.log('SKUs sem cliente correspondente (viram "Cliente nao identificado N"):')
      novosClientes.forEach((c) => console.log('  - SKU ' + c.codigo + ' -> ' + c.nome))
    }
    console.log('Total de vendas no sistema agora:', (dados.vendas || []).length)
    console.log('Total de clientes no sistema agora:', (dados.clientes || []).length)
  }
}

main()