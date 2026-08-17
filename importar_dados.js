// ============================================================
// IMPORTADOR EXTERNO v13 — lê o .xlsx DIRETO
// - SEMPRE pergunta qual vendedor importar (lista numerada)
// - ZERA os dados do vendedor e importa abas CLIENTES e DADOS
// - Vendas sem cliente → "VENDA SEM CLIENTE" (bate metas)
// - Normalizador de colunas tolerante (aceita variações de nome)
// Uso: node importar_dados.js <planilha.xlsx> [--debug]
// ============================================================
const fs = require('fs')
const path = require('path')
const crypto = require('crypto')
const readline = require('readline')
const XLSX = require('xlsx')

const uuid = () => crypto.randomUUID()

const PASTA_DADOS = 'U:/DADOS DO APP'

// ===== Normaliza chave: maiúsculo, sem acento, sem Nº/NO/NR/NUM isolados =====
function normalizarChave(chave) {
  return String(chave)
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/N[º°]/g, ' ')
    .replace(/\bNO\b/g, ' ')
    .replace(/\bNR\b/g, ' ')
    .replace(/\bNUMERO\b/g, ' ')
    .replace(/\bNUM\b/g, ' ')
    .replace(/[^A-Z0-9]/g, '')
}

// ===== Procura coluna aceitando vários nomes =====
function buscarColuna(linha, aliases) {
  const mapa = {}
  for (const chave of Object.keys(linha)) {
    mapa[normalizarChave(chave)] = chave
  }
  for (const alias of aliases) {
    const chaveNormalizada = normalizarChave(alias)
    if (mapa[chaveNormalizada] != null) {
      return linha[mapa[chaveNormalizada]]
    }
  }
  return ''
}

// ===== Aliases de cada campo (aceita variações do Excel) =====
const C = {
  SKU: ['SKU', 'CODIGO', 'COD', 'ID', 'CODIGOCLIENTE'],
  NOME: ['NOME', 'CLIENTENOME', 'NOMECLIENTE'],
  EMAIL: ['EMAIL', 'E-MAIL', 'MAIL'],
  WHATS: ['WHATS', 'WHATSAPP', 'TELEFONE', 'CELULAR', 'FONE'],
  CIDADE: ['CIDADE', 'MUNICIPIO'],
  SEGMENTO: ['SEGMENTO', 'SEG'],
  CLIENTE: ['CLIENTE', 'CODCLIENTE', 'CODIGOCLIENTE', 'IDCLIENTE'],
  ENVIO: ['ENVIO', 'MEIOENVIO', 'CANAL'],
  PEDIDO_INSUMOS: ['PEDIDO INSUMOS', 'PED INSUMOS', 'NPEDIDO INSUMOS', 'NUMERO PEDIDO INSUMOS', 'NUM PEDIDO INSUMOS'],
  VALOR_INSUMOS: ['VALOR INSUMOS', 'VLR INSUMOS', 'VALOR INSUMO'],
  PEDIDO_EQUIP: ['PEDIDO EQUIPAMENTO', 'PED EQUIPAMENTO', 'PEDIDO EQUIP', 'NPEDIDO EQUIPAMENTO', 'NUMERO PEDIDO EQUIPAMENTO'],
  VALOR_EQUIP: ['VALOR EQUIPAMENTO', 'VLR EQUIPAMENTO', 'VALOR EQUIP', 'VALOR EQUIPAMENTOS'],
  DATA: ['DATA', 'DATAVENDA', 'DATAVENDAS']
}

// ===== Converte valor em reais (ex.: "1.500,50" ou 1500.5) para número =====
function parseValor(v) {
  if (v == null) return 0
  if (typeof v === 'number') return isNaN(v) ? 0 : v
  const s = String(v).replace(/[^\d,.-]/g, '').replace(/\./g, '').replace(',', '.')
  const n = parseFloat(s)
  return isNaN(n) ? 0 : n
}

// ===== Converte data dd/mm/aaaa (ou serial do Excel) para aaaa-mm-dd =====
function parseData(d) {
  if (!d) return ''
  if (typeof d === 'number') {
    const data = XLSX.SSF.parse_date_code(d)
    if (data) {
      const mm = String(data.m).padStart(2, '0')
      const dd = String(data.d).padStart(2, '0')
      return data.y + '-' + mm + '-' + dd
    }
    return ''
  }
  const m = String(d).match(/(\d{2})\/(\d{2})\/(\d{4})/)
  if (m) return m[3] + '-' + m[2] + '-' + m[1]
  return String(d).slice(0, 10)
}

// ===== Lê uma aba da planilha =====
function lerAba(workbook, nomeAba) {
  const sheet = workbook.Sheets[nomeAba]
  if (!sheet) {
    console.log('❌ Aba "' + nomeAba + '" não encontrada na planilha.')
    return []
  }
  return XLSX.utils.sheet_to_json(sheet, { defval: '' })
}

// ===== MODO DEBUG: mostra o que o script lê (para diagnosticar) =====
function debugAba(workbook, nomeAba, campoChave) {
  const linhas = lerAba(workbook, nomeAba)
  console.log('\n===== ABA ' + nomeAba + ' =====')
  if (linhas.length === 0) { console.log('(vazia)'); return }
  console.log('CABEÇALHOS LIDOS (' + Object.keys(linhas[0]).length + '):')
  for (const chave of Object.keys(linhas[0])) {
    console.log('  [' + JSON.stringify(chave) + ']  →  normalizado: ' + normalizarChave(chave))
  }
  console.log('LINHAS COM ' + campoChave + ' PREENCHIDO (até 8):')
  let mostradas = 0
  for (let i = 0; i < linhas.length && mostradas < 8; i++) {
    const linha = linhas[i]
    const sku = String(buscarColuna(linha, C[campoChave]) || '').trim()
    if (!sku) continue
    console.log('  Linha ' + (i + 1) + ' (' + campoChave + '=' + sku + '):')
    for (const campo of Object.keys(C)) {
      if (campo === 'SKU' || campo === campoChave) continue
      console.log('    ' + campo + ' = [' + JSON.stringify(buscarColuna(linha, C[campo])) + ']')
    }
    mostradas++
  }
  if (mostradas === 0) console.log('  (nenhuma linha com ' + campoChave + ' preenchido)')
}

async function perguntar(rl, pergunta) {
  return new Promise((res) => rl.question(pergunta, res))
}

async function main() {
  const args = process.argv.slice(2)
  const modoDebug = args.includes('--debug')
  const caminhoXlsx = args.find((a) => !a.startsWith('--'))
  if (!caminhoXlsx) {
    console.log('Uso: node importar_dados.js <planilha.xlsx> [--debug]')
    process.exit(1)
  }

  // ===== Se --debug, mostra o que o script lê e termina =====
  if (modoDebug) {
    const wb = XLSX.readFile(caminhoXlsx)
    console.log('📂 Abas encontradas: ' + wb.SheetNames.join(', '))
    debugAba(wb, 'CLIENTES', 'SKU')
    debugAba(wb, 'DADOS', 'CLIENTE')
    console.log('\n👆 Verifique acima o que o script lê da planilha.')
    return
  }

  // 1. Lê vendedores.json e SEMPRE pergunta qual vendedor importar
  const arquivoVendedores = path.join(PASTA_DADOS, 'vendedores.json')
  let vendedores = []
  try {
    vendedores = JSON.parse(fs.readFileSync(arquivoVendedores, 'utf8'))
    if (!Array.isArray(vendedores)) vendedores = vendedores.vendedores || []
  } catch (e) {
    console.log('❌ Não consegui ler vendedores.json:', e.message)
    process.exit(1)
  }
  if (vendedores.length === 0) {
    console.log('❌ Nenhum vendedor encontrado em vendedores.json.')
    process.exit(1)
  }

  // Lista os vendedores e pede para escolher SEMPRE
  console.log('\nVendedores encontrados:')
  vendedores.forEach((v, i) => console.log('  ' + (i + 1) + '. ' + v.nome + ' (' + v.id + ')'))

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
  const escolha = await perguntar(rl, '\nDigite o NÚMERO do vendedor que deseja importar: ')
  const idx = parseInt(escolha, 10) - 1
  const vendedor = vendedores[idx]
  rl.close()

  if (!vendedor) {
    console.log('❌ Vendedor não encontrado. Execute novamente e digite um número válido.')
    process.exit(1)
  }
  const vendedorId = vendedor.id
  const arquivoVendedor = path.join(PASTA_DADOS, 'vendedor_' + vendedorId + '.json')
  console.log('\n✅ Importando para: ' + vendedor.nome + ' (id ' + vendedorId + ')')
  console.log('📁 Arquivo: ' + arquivoVendedor + '\n')

  // 2. ZERA TODOS OS DADOS DO VENDEDOR (importação única)
  let dados = { clientes: [], vendas: [], orcamentos: [], orcamentosPerdidos: [] }
  if (fs.existsSync(arquivoVendedor)) {
    const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')
    fs.copyFileSync(arquivoVendedor, arquivoVendedor + '.backup-' + stamp)
    console.log('💾 Backup do estado atual criado antes de zerar')
  }
  console.log('🧹 Dados atuais do vendedor serão ZERADOS e substituídos pela planilha\n')

  // 3. Lê o .xlsx direto
  console.log('📂 Lendo planilha: ' + caminhoXlsx)
  const workbook = XLSX.readFile(caminhoXlsx)
  const clientesXlsx = lerAba(workbook, 'CLIENTES')
  const vendasXlsx = lerAba(workbook, 'DADOS')
  console.log('📄 ' + clientesXlsx.length + ' clientes e ' + vendasXlsx.length + ' vendas na planilha\n')

  // 4. Importa clientes (aba CLIENTES)
  let clientesNovos = 0
  for (const linha of clientesXlsx) {
    const sku = String(buscarColuna(linha, C.SKU) || '').trim()
    if (!sku) continue
    const codigo = parseInt(sku, 10)
    if (isNaN(codigo)) continue
    dados.clientes.push({
      id: uuid(),
      codigo,
      nome: String(buscarColuna(linha, C.NOME) || '').trim(),
      cnpj: '',
      email: String(buscarColuna(linha, C.EMAIL) || '').trim(),
      whats: String(buscarColuna(linha, C.WHATS) || '').trim(),
      cidade: String(buscarColuna(linha, C.CIDADE) || '').trim(),
      segmento: String(buscarColuna(linha, C.SEGMENTO) || '').trim(),
      vendedorId,
      dataCadastro: ''
    })
    clientesNovos++
  }
  console.log('✅ ' + clientesNovos + ' clientes importados')

  // 5. Importa vendas (aba DADOS) — liga ao cliente pelo código
  //    Vendas SEM cliente na planilha → "VENDA SEM CLIENTE"
  let vendasNovas = 0
  let semCliente = 0
  let clienteSemCadastro = null

  for (const linha of vendasXlsx) {
    const sku = String(buscarColuna(linha, C.CLIENTE) || '').trim()
    if (!sku) continue

    let cliente = dados.clientes.find((c) => String(c.codigo) === sku)

    if (!cliente) {
      // Não achou o cliente na carteira → usa (ou cria) o "VENDA SEM CLIENTE"
      if (!clienteSemCadastro) {
        clienteSemCadastro = {
          id: uuid(),
          codigo: 999999,
          nome: 'VENDA SEM CLIENTE',
          cnpj: '',
          email: '',
          whats: '',
          cidade: '',
          segmento: '',
          vendedorId,
          dataCadastro: ''
        }
        dados.clientes.push(clienteSemCadastro)
        console.log('👤 Cliente "VENDA SEM CLIENTE" criado automaticamente')
      }
      cliente = clienteSemCadastro
      semCliente++
    }

    dados.vendas.push({
      id: uuid(),
      clienteId: cliente.id,          // ligação com o cliente (nome vem da carteira)
      codigoCliente: cliente.codigo,  // SKU/ID da planilha gravado na venda
      vendedorId,
      envio: String(buscarColuna(linha, C.ENVIO) || '').trim(),
      pedidoInsumos: String(buscarColuna(linha, C.PEDIDO_INSUMOS) || '').trim(),
      valorInsumos: parseValor(buscarColuna(linha, C.VALOR_INSUMOS)),
      pedidoEquipamento: String(buscarColuna(linha, C.PEDIDO_EQUIP) || '').trim(),
      valorEquipamento: parseValor(buscarColuna(linha, C.VALOR_EQUIP)),
      frete: 0,
      data: parseData(buscarColuna(linha, C.DATA)),
      observacao: ''
    })
    vendasNovas++
  }
  console.log('✅ ' + vendasNovas + ' vendas importadas')
  console.log('ℹ️  ' + semCliente + ' vendas sem cliente na planilha → associadas a "VENDA SEM CLIENTE"')

  // 6. Grava
  fs.writeFileSync(arquivoVendedor, JSON.stringify(dados, null, 2), 'utf8')
  console.log('\n🎉 Importação concluída! Arquivo do vendedor salvo.')
}

main()