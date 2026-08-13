// ============================================================
// IMPORTADOR EXTERNO v6 — auto-detecta o id do vendedor
// Uso: node importar_dados.js <clientes.csv> <vendas.csv>
// ============================================================
const fs = require('fs')
const path = require('path')
const crypto = require('crypto')
const readline = require('readline')

const uuid = () => crypto.randomUUID()
const PASTA_DADOS = 'U:\DADOS DO APP'
const NOME_VENDEDOR = 'Keila' // ← troque se o nome for diferente

function parseValor(v) {
  if (v == null) return 0
  const s = String(v).replace(/[^\d,.-]/g, '').replace(/\./g, '').replace(',', '.')
  const n = parseFloat(s)
  return isNaN(n) ? 0 : n
}

function parseData(d) {
  if (!d) return ''
  const m = String(d).match(/(\d{2})\/(\d{2})\/(\d{4})/)
  if (m) return `${m[3]}-${m[2]}-${m[1]}`
  return String(d).slice(0, 10)
}

function lerCsv(caminho) {
  let texto = fs.readFileSync(caminho, 'utf8')
  if (texto.charCodeAt(0) === 0xFEFF) texto = texto.slice(1)
  const linhas = texto.split(/\r?\n/).filter((l) => l.trim())
  if (linhas.length === 0) return []
  const cab = linhas[0].split(';').map((c) => c.trim())
  return linhas.slice(1).map((l) => {
    const vals = l.split(';')
    const obj = {}
    cab.forEach((c, i) => { obj[c] = (vals[i] || '').trim() })
    return obj
  })
}

async function perguntar(rl, pergunta) {
  return new Promise((res) => rl.question(pergunta, res))
}

async function main() {
  const args = process.argv.slice(2)
  if (args.length < 2) {
    console.log('Uso: node importar_dados.js <clientes.csv> <vendas.csv>')
    process.exit(1)
  }
  const caminhoClientes = args[0]
  const caminhoVendas = args[1]

  // 1. Lê vendedores.json e encontra o Keila pelo NOME
  const arquivoVendedores = path.join(PASTA_DADOS, 'vendedores.json')
  let vendedores = []
  try {
    vendedores = JSON.parse(fs.readFileSync(arquivoVendedores, 'utf8'))
    if (!Array.isArray(vendedores)) vendedores = vendedores.vendedores || []
  } catch (e) {
    console.log('❌ Não consegui ler vendedores.json:', e.message)
    process.exit(1)
  }

  console.log('\nVendedores encontrados:')
  vendedores.forEach((v, i) => console.log(`  ${i + 1}. ${v.nome} (${v.id})`))

  // Se não achar pelo nome, deixa escolher pelo número
  let vendedor = vendedores.find((v) => v.nome === NOME_VENDEDOR)
  if (!vendedor) {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
    const escolha = await perguntar(rl, `\nNão achei "${NOME_VENDEDOR}". Digite o NÚMERO do vendedor: `)
    const idx = parseInt(escolha, 10) - 1
    vendedor = vendedores[idx]
    rl.close()
  }
  if (!vendedor) { console.log('❌ Vendedor não encontrado.'); process.exit(1) }

  const vendedorId = vendedor.id
  const arquivoVendedor = path.join(PASTA_DADOS, `vendedor_${vendedorId}.json`)
  console.log(`\n✅ Importando para: ${vendedor.nome} (id ${vendedorId})`)
  console.log(`📁 Arquivo: ${arquivoVendedor}\n`)

  // 2. Lê o arquivo do vendedor (ou cria estrutura vazia)
  let dados = { clientes: [], vendas: [], orcamentos: [], orcamentosPerdidos: [] }
  if (fs.existsSync(arquivoVendedor)) {
    try {
      const lido = JSON.parse(fs.readFileSync(arquivoVendedor, 'utf8'))
      dados.clientes = lido.clientes || []
      dados.vendas = lido.vendas || []
      dados.orcamentos = lido.orcamentos || []
      dados.orcamentosPerdidos = lido.orcamentosPerdidos || []
    } catch (e) {
      console.log('❌ Não consegui ler o arquivo do vendedor:', e.message)
      process.exit(1)
    }
    const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')
    fs.copyFileSync(arquivoVendedor, arquivoVendedor + '.backup-' + stamp)
    console.log(`💾 Backup criado`)
  } else {
    console.log('📄 Arquivo do vendedor não existia — será criado do zero.')
  }

  // 3. Lê os CSVs
  const clientesCsv = lerCsv(caminhoClientes)
  const vendasCsv = lerCsv(caminhoVendas)
  console.log(`📄 ${clientesCsv.length} clientes e ${vendasCsv.length} vendas na planilha`)

  // 4. Importa clientes
  let clientesNovos = 0
  for (const linha of clientesCsv) {
    const sku = String(linha.SKU || '').trim()
    if (!sku) continue
    const codigo = parseInt(sku, 10)
    if (isNaN(codigo)) continue
    const jaExiste = dados.clientes.some((c) => Number(c.codigo) === codigo)
    if (jaExiste) continue
    dados.clientes.push({
      id: uuid(),
      codigo,
      nome: (linha.NOME || '').trim(),
      cnpj: '',
      email: (linha.EMAIL || '').trim(),
      whats: (linha.WHATS || '').trim(),
      cidade: (linha.CIDADE || '').trim(),
      segmento: (linha.SEGMENTO || '').trim(),
      vendedorId,
      dataCadastro: ''
    })
    clientesNovos++
  }
  console.log(`✅ ${clientesNovos} clientes importados`)

  // 5. Importa vendas (liga ao cliente pelo SKU)
  let vendasNovas = 0
  let semCliente = 0
  for (const linha of vendasCsv) {
    const sku = String(linha.CLIENTE || '').trim()
    if (!sku) continue
    const cliente = dados.clientes.find((c) => String(c.codigo) === sku)
    if (!cliente) { semCliente++; continue }
    dados.vendas.push({
      id: uuid(),
      clienteId: cliente.id,
      vendedorId,
      envio: (linha.ENVIO || '').trim(),
      pedidoInsumos: (linha['PEDIDO INSUMOS'] || '').trim(),
      valorInsumos: parseValor(linha['VALOR INSUMOS']),
      pedidoEquipamento: (linha['PEDIDO EQUIPAMENTO'] || '').trim(),
      valorEquipamento: parseValor(linha['VALOR EQUIPAMENTO']),
      frete: 0,
      data: parseData(linha.DATA),
      observacao: ''
    })
    vendasNovas++
  }
  console.log(`✅ ${vendasNovas} vendas importadas`)
  console.log(`⚠️  ${semCliente} vendas sem cliente correspondente (ignoradas)`)

  // 6. Grava
  fs.writeFileSync(arquivoVendedor, JSON.stringify(dados, null, 2), 'utf8')
  console.log('\n🎉 Importação concluída! Arquivo do vendedor salvo.')
}

main()