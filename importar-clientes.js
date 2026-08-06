// importar-clientes.js
// Importa clientes do CSV para o banco do app, atribuindo à vendedora Fabiana.
//
// COMO USAR:
// 1. Salve a planilha como CSV UTF-8 com o nome: clientesfabiana.csv (na pasta do projeto)
// 2. Rode: node importar-clientes.js   (modo teste: mostra os 10 primeiros, NÃO salva)
// 3. Confira o resultado. Se estiver bom, mude MODO_TESTE para false e rode de novo.

const fs = require('fs')
const path = require('path')
const crypto = require('crypto')

// ===== CONFIGURAÇÃO =====
const MODO_TESTE = false         // true = mostra 10 primeiros sem salvar | false = importa tudo e salva
const QUANTIDADE_TESTE = 10      // quantos clientes mostrar no modo teste
const NOME_VENDEDORA = 'fabiana' // nome (ou usuário) da vendedora no sistema
const ARQUIVO_CSV = 'clientesfabiana.csv'
// Caminho do arquivo de dados do app. Se deixar vazio, o script tenta descobrir sozinho.
const CAMINHO_DADOS = '//192.168.1.201/vendas/dados.json'

// ==========================

// --- Capitalização (mesma regra do app) ---
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

// --- Descobrir o caminho do banco ---
function descobrirCaminhoDados() {
  if (CAMINHO_DADOS) return CAMINHO_DADOS
  const candidatos = []
  candidatos.push(path.join(__dirname, 'dados.json'))
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
  for (const c of candidatos) {
    if (fs.existsSync(c)) return c
  }
  return null
}

// --- Ler CSV ---
function lerCsv(caminho) {
  let texto = fs.readFileSync(caminho, 'utf8')
  texto = texto.replace(/^\uFEFF/, '') // remove BOM
  const primeiraLinha = texto.split(/\r?\n/)[0]
  const sep = (primeiraLinha.match(/;/g) || []).length >= (primeiraLinha.match(/,/g) || []).length ? ';' : ','
  const linhas = texto.split(/\r?\n/).filter((l) => l.trim() !== '')
  const cabecalho = linhas[0].split(sep).map((h) => h.replace(/^"|"$/g, '').trim().toUpperCase())
  const dados = []
  for (let i = 1; i < linhas.length; i++) {
    const cols = linhas[i].split(sep).map((c) => c.replace(/^"|"$/g, '').trim())
    const obj = {}
    cabecalho.forEach((h, idx) => { obj[h] = cols[idx] !== undefined ? cols[idx] : '' })
    dados.push(obj)
  }
  return dados
}

// --- Main ---
function main() {
  const caminhoCsv = path.join(__dirname, ARQUIVO_CSV)
  if (!fs.existsSync(caminhoCsv)) {
    console.error('Arquivo nao encontrado: ' + caminhoCsv)
    console.error('Salve a planilha como CSV UTF-8 com o nome ' + ARQUIVO_CSV + ' na pasta do projeto.')
    process.exit(1)
  }

  const linhas = lerCsv(caminhoCsv)
  console.log('Linhas lidas do CSV:', linhas.length)

  const caminhoDados = descobrirCaminhoDados()
  if (!caminhoDados) {
    console.error('Nao encontrei o arquivo de dados do app.')
    console.error('Defina CAMINHO_DADOS no topo do script com o caminho do arquivo.')
    process.exit(1)
  }
  console.log('Banco de dados encontrado:', caminhoDados)

  const dados = JSON.parse(fs.readFileSync(caminhoDados, 'utf8'))

  // encontra a Fabiana
  const fabiana = (dados.vendedores || []).find(
    (v) =>
      (v.nome || '').toLowerCase().includes(NOME_VENDEDORA) ||
      (v.usuario || '').toLowerCase().includes(NOME_VENDEDORA)
  )
  if (!fabiana) {
    console.error('Vendedora "' + NOME_VENDEDORA + '" nao encontrada no sistema.')
    console.error('Vendedores existentes:', (dados.vendedores || []).map((v) => v.nome).join(', '))
    process.exit(1)
  }
  console.log('Atribuindo clientes a: ' + fabiana.nome + ' (id: ' + fabiana.id + ')')

  // SKUs já existentes no sistema
  const skusExistentes = new Set((dados.clientes || []).map((c) => Number(c.codigo)))

  const linhasParaImportar = MODO_TESTE ? linhas.slice(0, QUANTIDADE_TESTE) : linhas
  let importados = 0
  let pulados = 0

  const novos = []
  for (const linha of linhasParaImportar) {
    const sku = Number(linha['SKU'] || linha['CODIGO'] || linha['ID'])
    if (!sku) { pulados++; continue }
    if (skusExistentes.has(sku)) {
      console.log('SKU ' + sku + ' ja existe no sistema - pulando')
      pulados++
      continue
    }
    const cliente = {
      id: crypto.randomUUID(),
      codigo: sku,
      nome: capitalizarTexto(linha['NOME'] || ''),
      cnpj: '',
      email: (linha['EMAIL'] || '').toLowerCase(),
      whats: linha['WHATS'] || linha['WHATSAPP'] || '',
      cidade: capitalizarTexto(linha['CIDADE'] || ''),
      segmento: capitalizarTexto(linha['SEGMENTO'] || ''),
      vendedorId: fabiana.id
    }
    novos.push(cliente)
    skusExistentes.add(sku)
    importados++
  }

  if (MODO_TESTE) {
    console.log('')
    console.log('===== MODO TESTE (nao salvou nada) =====')
    console.log('Mostrando os ' + importados + ' primeiros clientes como ficariam:')
    console.log('')
    novos.forEach((c) => {
      console.log('#' + c.codigo + ' | ' + c.nome + ' | ' + c.email + ' | ' + c.cidade + ' | ' + c.segmento)
    })
    console.log('')
    console.log('Tudo certo? Entao abra o importar-clientes.js, mude MODO_TESTE para false e rode de novo para importar de verdade.')
  } else {
    // backup antes de salvar
    const backupPath = caminhoDados + '.backup_' + new Date().toISOString().replace(/[:.]/g, '-')
    fs.copyFileSync(caminhoDados, backupPath)
    console.log('Backup criado:', backupPath)

    dados.clientes = dados.clientes.concat(novos)
    fs.writeFileSync(caminhoDados, JSON.stringify(dados, null, 2), 'utf8')
    console.log('')
    console.log('Importacao concluida!')
    console.log('Importados:', importados)
    console.log('Pulados:', pulados)
    console.log('Total de clientes no sistema agora:', dados.clientes.length)
  }
}

main()