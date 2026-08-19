// src/main/insights.js
// MÓDULO DE INSIGHTS — versão aprimorada
// Gera dicas agrupadas por categoria (risco, momento, ranking, cross, padrão, produtos)
// com score de urgência e valor potencial.
// CROSS-SELL: compara os produtos que o cliente compra NOS ÚLTIMOS 3 MESES com a
// ROTINA DE LABORATÓRIO (famílias por palavras-chave) e sugere os materiais que ele
// NÃO comprou nos últimos 3 meses.
// VÍNCULO: venda.clienteId = cliente.id = nota.cliente.codigo (mesmo número).
// NOVO: cada dica carrega 'codigo' (número numérico do cliente, ex.: 475) para o
// frontend exibir [475] Nome em vez do UUID. Cada dica de cross-sell embute
// 'notasDetalhe' (notas + produtos dos últimos 3 meses), e cada produto carrega
// 'segmentoId'/'segmento' (família de laboratório) para o frontend colorir por segmento.
// NOVO: aprendizado automático — o matchProduto também usa as palavras-chave
// aprendidas do mapeamento compartilhado (segmentos.json), com limite de confiança >= 2.
// NOVO: o segmentoDeProduto reconhece PRIMEIRO o mapeamento manual por código
// (recém-classificado aparece na hora), e só depois usa o match por palavras.
function normalizarData(data) {
  if (!data) return null
  var m = String(data).match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
  m = String(data).match(/^(\d{2})\/(\d{2})\/(\d{4})/)
  if (m) return new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]))
  return null
}
function diasEntre(a, b) {
  return Math.round((b - a) / 86400000)
}
function intervaloMedio(datas) {
  if (datas.length < 2) return null
  var ordenadas = datas.slice().sort(function (a, b) { return a - b })
  var intervalos = []
  for (var i = 1; i < ordenadas.length; i++) {
    var d = diasEntre(ordenadas[i - 1], ordenadas[i])
    if (d > 0) intervalos.push(d)
  }
  if (intervalos.length === 0) return null
  var soma = intervalos.reduce(function (s, x) { return s + x }, 0)
  return Math.round(soma / intervalos.length)
}
function maisComum(lista) {
  if (!lista.length) return null
  var contagem = {}
  lista.forEach(function (x) { contagem[x] = (contagem[x] || 0) + 1 })
  var melhor = null
  var melhorQtd = 0
  Object.keys(contagem).forEach(function (k) {
    if (contagem[k] > melhorQtd) { melhorQtd = contagem[k]; melhor = k }
  })
  return melhor
}
function formatarData(d) {
  if (!d) return ''
  var dia = String(d.getDate()).padStart(2, '0')
  var mes = String(d.getMonth() + 1).padStart(2, '0')
  return dia + '/' + mes + '/' + d.getFullYear()
}
function formatarISO(d) {
  if (!d) return ''
  var mes = String(d.getMonth() + 1).padStart(2, '0')
  var dia = String(d.getDate()).padStart(2, '0')
  return d.getFullYear() + '-' + mes + '-' + dia
}
function chaveDica(d) {
  return d.tipo + ':' + d.clienteId
}
// ===== SCORE DE URGÊNCIA (gravidade × valor) =====
function scoreUrgencia(tipo, diasSemComprar, ticketMedio, queda) {
  var fatorValor = Math.min((ticketMedio || 0) / 5000, 1)
  if (tipo === 'risco') {
    var fatorDias = Math.min((diasSemComprar || 0) / 90, 1)
    return Math.round((fatorDias * 0.6 + fatorValor * 0.4) * 100)
  }
  if (tipo === 'momento') {
    return Math.round((0.5 + fatorValor * 0.5) * 100)
  }
  if (tipo === 'ranking') {
    var fatorQueda = Math.min((queda || 0) / 10, 1)
    return Math.round((fatorQueda * 0.5 + fatorValor * 0.5) * 100)
  }
  if (tipo === 'cross') {
    return Math.round((0.4 + fatorValor * 0.6) * 100)
  }
  return 50
}
// ===== NORMALIZAÇÃO DE TEXTO (remove acentos e caixa alta) =====
function normalizarTexto(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/[áàâãä]/g, 'a').replace(/[éèêë]/g, 'e').replace(/[íìîï]/g, 'i')
    .replace(/[óòôõö]/g, 'o').replace(/[úùûü]/g, 'u').replace(/ç/g, 'c')
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}
// ===== EXTRAI o cliente da nota (aceita objeto aninhado OU campo direto) =====
function extrairClienteNota(nota) {
  if (!nota) return { id: null, nome: null }
  var c = nota.cliente
  var id = null
  var nome = null
  if (c && typeof c === 'object') {
    id = c.codigo !== undefined ? c.codigo : (c.id !== undefined ? c.id : null)
    nome = c.nome || null
  } else if (c !== undefined && c !== null) {
    id = c
    nome = c
  }
  if (id === null && nota.clienteId !== undefined) id = nota.clienteId
  if (id === null && nota.idCliente !== undefined) id = nota.idCliente
  if (nome === null) nome = nota.clienteNome || (id !== null ? String(id) : null)
  return { id: id !== null ? String(id) : null, nome: nome }
}
// ===== FAMÍLIAS DE ROTINA DE LABORATÓRIO (palavras-chave AMPLAS) =====
var FAMILIAS = [
  {
    id: 'coleta_sangue', nome: 'Coleta de Sangue Venoso',
    materiais: [
      { nome: 'Tubo de coleta a vácuo', chaves: ['tubo vacuo', 'tubo vacu', 'vacutainer', 'tubo edta', 'tubo citrato', 'tubo heparin', 'tubo fluoreto', 'tubo soro', 'tubo gel', 'tubo roxo', 'tubo roxa', 'tubo azul', 'tubo verde', 'tubo cinza', 'tubo amarelo', 'tubo lilas'] },
      { nome: 'Agulha para coleta', chaves: ['agulha', 'agulha descartavel', 'agulha hipodermica', 'agulha vacutainer'] },
      { nome: 'Adaptador / holder', chaves: ['holder', 'adaptador', 'suporte agulha'] },
      { nome: 'Garrote / torniquete', chaves: ['garrote', 'torniquete'] },
      { nome: 'Álcool 70%', chaves: ['alcool 70', 'alcool etilico 70', 'alcool 70%', 'alcool'] },
      { nome: 'Algodão / gaze', chaves: ['algodao', 'gaze', 'compressa', 'algodao hidrofilo'] },
      { nome: 'Curativo / blood stop', chaves: ['curativo', 'blood stop', 'bloodstop', 'esparadrapo', 'micropore'] },
      { nome: 'Luva descartável', chaves: ['luva', 'luva latex', 'luva procedimento', 'luva nitrilica'] },
      { nome: 'Descartador perfurocortante', chaves: ['descartador', 'perfurocortante', 'perfuro cortante', 'caixa perfuro', 'descarte perfuro'] },
      { nome: 'Etiqueta / identificação', chaves: ['etiqueta', 'identificacao', 'etiqueta adesiva'] },
      { nome: 'Rack para tubos', chaves: ['rack', 'estante tubo', 'suporte tubo'] }
    ]
  },
  {
    id: 'coleta_urina', nome: 'Coleta de Urina',
    materiais: [
      { nome: 'Coletor universal', chaves: ['coletor universal', 'coletor', 'frasco urina'] },
      { nome: 'Tubo transporte urina', chaves: ['tubo urina', 'transporte urina'] },
      { nome: 'Ponteira', chaves: ['ponteira', 'ponteira gilson', 'ponteira descartavel'] },
      { nome: 'Tubo Falcon', chaves: ['falcon', 'tubo conico', 'tubo 15ml', 'tubo 50ml'] },
      { nome: 'Saco plástico', chaves: ['saco plastico', 'saco'] },
      { nome: 'Papel absorvente', chaves: ['papel absorvente'] }
    ]
  },
  {
    id: 'coleta_fezes', nome: 'Coleta de Fezes',
    materiais: [
      { nome: 'Coletor de fezes', chaves: ['coletor fezes', 'coletor de fezes', 'frasco fezes'] },
      { nome: 'Espátula', chaves: ['espatula'] },
      { nome: 'Frasco coletor', chaves: ['frasco coletor'] },
      { nome: 'Meio conservante', chaves: ['conservante', 'meio de transporte'] },
      { nome: 'Frasco parasitológico', chaves: ['parasitologico'] }
    ]
  },
  {
    id: 'coleta_swab', nome: 'Coleta de Secreções / Swab',
    materiais: [
      { nome: 'Swab estéril', chaves: ['swab'] },
      { nome: 'Tubo de transporte', chaves: ['tubo transporte', 'transporte'] },
      { nome: 'Meio de transporte', chaves: ['meio transporte', 'meio de transporte', 'stuart', 'amies'] },
      { nome: 'Máscara', chaves: ['mascara'] },
      { nome: 'Gaze', chaves: ['gaze'] }
    ]
  },
  {
    id: 'hematologia', nome: 'Hematologia',
    materiais: [
      { nome: 'Tubo com EDTA', chaves: ['tubo edta', 'tubo vacuo roxa', 'tubo vacuo roxo', 'edta'] },
      { nome: 'Ponteira', chaves: ['ponteira'] },
      { nome: 'Microtubo / Eppendorf', chaves: ['eppendorf', 'microtubo', 'tubo 2,0', 'tubo 2.0', 'tubo 1,5', 'tubo 1.5'] },
      { nome: 'Lâmina', chaves: ['lamina', 'lamina para microscopia'] },
      { nome: 'Lamínula', chaves: ['laminula'] },
      { nome: 'Corante hematológico', chaves: ['corante', 'coloracao', 'panotico', 'giemsa', 'leishman', 'wright'] },
      { nome: 'Óleo de imersão', chaves: ['oleo imersao', 'oleo de imersao'] }
    ]
  },
  {
    id: 'bioquimica', nome: 'Bioquímica',
    materiais: [
      { nome: 'Tubo de soro/plasma', chaves: ['tubo soro', 'tubo gel', 'tubo plasma'] },
      { nome: 'Ponteira', chaves: ['ponteira'] },
      { nome: 'Reagente', chaves: ['reagente', 'kit bioquimica', 'reagente bioquimica'] },
      { nome: 'Calibrador', chaves: ['calibrador'] },
      { nome: 'Controle', chaves: ['controle'] },
      { nome: 'Água reagente', chaves: ['agua reagente', 'agua destilada', 'agua deionizada'] }
    ]
  },
  {
    id: 'urinalise', nome: 'Urinálise',
    materiais: [
      { nome: 'Tubo Falcon', chaves: ['falcon', 'tubo conico', 'tubo 15ml', 'tubo 50ml'] },
      { nome: 'Tubo para urina', chaves: ['tubo urina'] },
      { nome: 'Ponteira', chaves: ['ponteira'] },
      { nome: 'Tira reagente', chaves: ['tira reagente', 'tiras reagentes', 'papel ph', 'fita reagente', 'tira urina'] },
      { nome: 'Lâmina', chaves: ['lamina'] },
      { nome: 'Lamínula', chaves: ['laminula'] }
    ]
  },
  {
    id: 'imunologia', nome: 'Imunologia / Sorologia',
    materiais: [
      { nome: 'Tubo de soro', chaves: ['tubo soro'] },
      { nome: 'Ponteira', chaves: ['ponteira'] },
      { nome: 'Microplaca', chaves: ['microplaca', 'placa 96', 'placa elisa'] },
      { nome: 'Reagente', chaves: ['reagente', 'kit imunologia', 'kit sorologia'] },
      { nome: 'Diluente', chaves: ['diluente'] }
    ]
  },
  {
    id: 'testes_rapidos', nome: 'Testes Rápidos',
    materiais: [
      { nome: 'Kit diagnóstico', chaves: ['kit', 'teste rapido', 'teste diagnostico'] },
      { nome: 'Lanceta', chaves: ['lanceta'] },
      { nome: 'Tubo capilar', chaves: ['capilar', 'tubo capilar'] },
      { nome: 'Pipeta descartável', chaves: ['pipeta'] },
      { nome: 'Swab', chaves: ['swab'] },
      { nome: 'Solução tampão', chaves: ['tampao', 'buffer', 'solucao tampao'] }
    ]
  },
  {
    id: 'microbiologia', nome: 'Microbiologia',
    materiais: [
      { nome: 'Placa de Petri', chaves: ['placa', 'petri', 'biplaca', 'mac conkey', 'sangue', 'placa de cultura'] },
      { nome: 'Meio de cultura', chaves: ['meio cultura', 'meio de cultura', 'agar'] },
      { nome: 'Alça bacteriológica', chaves: ['alca', 'alca bacterio'] },
      { nome: 'Swab', chaves: ['swab'] },
      { nome: 'Tubo de ensaio', chaves: ['tubo ensaio'] },
      { nome: 'Ponteira', chaves: ['ponteira'] },
      { nome: 'Lâmina', chaves: ['lamina'] },
      { nome: 'Corante', chaves: ['corante', 'coloracao', 'gram'] },
      { nome: 'Disco antibiótico', chaves: ['disco antibi', 'antibiograma'] },
      { nome: 'Indicador biológico', chaves: ['indicador biologico', 'esterilizacao', 'autoclave'] }
    ]
  },
  {
    id: 'parasitologia', nome: 'Parasitologia',
    materiais: [
      { nome: 'Frasco coletor', chaves: ['frasco coletor'] },
      { nome: 'Tubo Falcon', chaves: ['falcon', 'tubo conico'] },
      { nome: 'Lâmina', chaves: ['lamina'] },
      { nome: 'Lamínula', chaves: ['laminula'] },
      { nome: 'Pipeta', chaves: ['pipeta'] },
      { nome: 'Ponteira', chaves: ['ponteira'] },
      { nome: 'Corante', chaves: ['corante'] }
    ]
  },
  {
    id: 'coagulacao', nome: 'Coagulação',
    materiais: [
      { nome: 'Tubo com citrato', chaves: ['tubo citrato', 'citrato'] },
      { nome: 'Ponteira', chaves: ['ponteira'] },
      { nome: 'Reagente', chaves: ['reagente', 'kit coagulacao'] },
      { nome: 'Calibrador', chaves: ['calibrador'] },
      { nome: 'Controle', chaves: ['controle'] }
    ]
  },
  {
    id: 'higienizacao', nome: 'Higienização e Desinfecção',
    materiais: [
      { nome: 'Álcool 70%', chaves: ['alcool 70', 'alcool etilico 70', 'alcool'] },
      { nome: 'Desinfetante hospitalar', chaves: ['desinfetante'] },
      { nome: 'Detergente', chaves: ['detergente', 'deterglass'] },
      { nome: 'Papel toalha', chaves: ['papel toalha'] },
      { nome: 'Pano descartável', chaves: ['pano'] },
      { nome: 'Saco para resíduos', chaves: ['saco residuo', 'saco lixo'] }
    ]
  },
  {
    id: 'residuos', nome: 'Gerenciamento de Resíduos',
    materiais: [
      { nome: 'Descartador perfurocortante', chaves: ['descartador', 'perfurocortante', 'perfuro cortante'] },
      { nome: 'Saco resíduo infectante', chaves: ['saco infectante', 'saco residuo'] },
      { nome: 'Saco resíduo comum', chaves: ['saco comum', 'saco lixo'] },
      { nome: 'Recipiente identificado', chaves: ['recipiente'] }
    ]
  },
  {
    id: 'epis', nome: 'EPIs e Segurança',
    materiais: [
      { nome: 'Luva descartável', chaves: ['luva', 'luva latex', 'luva procedimento', 'luva nitrilica'] },
      { nome: 'Máscara', chaves: ['mascara', 'mascara descartavel', 'mascara tripla'] },
      { nome: 'Óculos de proteção', chaves: ['oculos', 'oculos de protecao'] },
      { nome: 'Avental / jaleco', chaves: ['avental', 'jaleco'] },
      { nome: 'Protetor facial', chaves: ['protetor facial', 'face shield'] },
      { nome: 'Touca', chaves: ['touca'] }
    ]
  }
]
// ===== MATCH: dado um produto (descrição), retorna as famílias e materiais que ele pertence =====
// Usa as palavras-chave manuais (FAMILIAS) + as aprendidas (segmentos.json, confiança >= 2)
function matchProduto(descricao, palavrasAprendidas) {
  var texto = normalizarTexto(descricao)
  var resultado = []
  FAMILIAS.forEach(function (fam) {
    var achouManual = fam.materiais.some(function (mat) {
      return mat.chaves.some(function (ch) { return texto.indexOf(ch) !== -1 })
    })
    var aprendidas = (palavrasAprendidas && palavrasAprendidas[fam.id]) || {}
    var achouAprendida = Object.keys(aprendidas).some(function (ch) {
      return aprendidas[ch] >= 2 && texto.indexOf(ch) !== -1
    })
    if (achouManual || achouAprendida) {
      resultado.push({ familiaId: fam.id, familiaNome: fam.nome, material: 'Produto do segmento' })
    }
  })
  return resultado
}
// ===== NOVO: segmento de um produto — primeiro o mapeamento manual (por código),
// depois o match por palavras-chave (manuais + aprendidas) =====
function segmentoDeProduto(codigo, descricao, palavrasAprendidas, produtosMapeados) {
  var mapeado = produtosMapeados && produtosMapeados[String(codigo)]
  if (mapeado && mapeado.segmentoId) {
    var fam = FAMILIAS.find(function (f) { return f.id === mapeado.segmentoId })
    if (fam) return { familiaId: fam.id, familiaNome: fam.nome }
  }
  var matches = matchProduto(descricao || '', palavrasAprendidas)
  return matches.length > 0 ? matches[0] : null
}
// ===== Ranking de clientes por mês (para comparar Top 20) =====
function rankingPorMes(vendas) {
  const porMes = {}
  for (const v of vendas) {
    const d = normalizarData(v.data)
    if (!d) continue
    const chave = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0')
    if (!porMes[chave]) porMes[chave] = {}
    const valor = Number(v.valorInsumos || 0) + Number(v.valorEquipamento || 0)
    porMes[chave][v.clienteId] = (porMes[chave][v.clienteId] || 0) + valor
  }
  const rankings = {}
  Object.keys(porMes).forEach((chave) => {
    rankings[chave] = Object.keys(porMes[chave])
      .map((cid) => ({ clienteId: cid, total: porMes[chave][cid] }))
      .sort((a, b) => b.total - a.total)
  })
  return rankings
}
// ===== Produtos sazonais (notas fiscais históricas) =====
function calcularSazonais(notas, hoje) {
  const NOMES = ['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro']
  const mesAtualNum = hoje.getMonth() + 1
  const mapa = {}
  ;(notas || []).forEach(function (nota) {
    const d = nota && normalizarData(nota.data)
    if (!d) return
    const ano = d.getFullYear()
    const mes = d.getMonth() + 1
    ;(nota.produtos || []).forEach(function (p) {
      if (!p || !p.codigo) return
      const chave = String(p.codigo)
      if (!mapa[chave]) mapa[chave] = { codigo: chave, descricao: p.descricao || '', anos: {}, porMes: {}, total: 0 }
      const prod = mapa[chave]
      if (!prod.descricao && p.descricao) prod.descricao = p.descricao
      prod.anos[ano] = true
      prod.porMes[mes] = (prod.porMes[mes] || 0) + (Number(p.quantidade) || 0)
      prod.total += Number(p.quantidade) || 0
    })
  })
  const resultado = []
  Object.keys(mapa).forEach(function (chave) {
    const prod = mapa[chave]
    if (Object.keys(prod.anos).length < 2) return
    if (prod.total <= 0) return
    const mesesComVenda = Object.keys(prod.porMes).length
    if (mesesComVenda < 4) return
    const media = prod.total / mesesComVenda
    if (media <= 0) return
    let picoMes = null, picoQtd = 0
    Object.keys(prod.porMes).forEach(function (m) {
      if (prod.porMes[m] > picoQtd) { picoQtd = prod.porMes[m]; picoMes = Number(m) }
    })
    if (picoMes !== mesAtualNum) return
    const indice = picoQtd / media
    if (indice < 1.8) return
    resultado.push({
      codigo: prod.codigo,
      descricao: prod.descricao,
      indice: Math.round(indice * 10) / 10,
      picoQtd: Math.round(picoQtd),
      media: Math.round(media * 10) / 10,
      mes: NOMES[picoMes - 1]
    })
  })
  resultado.sort(function (a, b) { return b.indice - a.indice })
  return resultado.slice(0, 3)
}
export function gerarInsights(opcoes) {
  var clientes = (opcoes.clientes || []).filter(function (c) { return !c.arquivado })
  var vendas = opcoes.vendas || []
  var vendedores = opcoes.vendedores || []
  var notas = opcoes.notas || []
  var estado = opcoes.estado || { vistos: [], tratados: [], adiados: {} }
  var hoje = opcoes.hoje || new Date()
  hoje.setHours(0, 0, 0, 0)
  // ===== NOVO: palavras aprendidas + mapeamentos manuais do segmentos.json =====
  var segmentos = opcoes.segmentos || null
  var palavrasAprendidas = (segmentos && segmentos.aprendidas) || {}
  var produtosMapeados = (segmentos && segmentos.produtos) || {}
  // ===== Janela temporal do cross-sell (3 meses = 90 dias) =====
  var JANELA_DIAS = 90
  var limiteJanela = new Date(hoje)
  limiteJanela.setDate(limiteJanela.getDate() - JANELA_DIAS)
  var mapaVendedores = {}
  vendedores.forEach(function (v) { mapaVendedores[v.id] = v.nome })
  var mapaClientes = {}
  clientes.forEach(function (c) { mapaClientes[c.id] = c })
  // ===== Índice de notas por código de cliente =====
  var notasPorCodigo = {}
  ;(notas || []).forEach(function (nota) {
    var ncid = extrairClienteNota(nota).id
    if (ncid === null) return
    if (!notasPorCodigo[ncid]) notasPorCodigo[ncid] = []
    notasPorCodigo[ncid].push(nota)
  })
  var resumo = {
    totalClientes: clientes.length,
    totalVendas: vendas.length,
    receitaTotal: 0,
    ticketMedio: 0,
    clientesEmRisco: 0,
    novas: 0
  }
  var porCliente = {}
  vendas.forEach(function (v) {
    var cid = v.clienteId || 'sem-cliente'
    if (!porCliente[cid]) porCliente[cid] = []
    porCliente[cid].push(v)
  })
  var grupos = {
    risco: { id: 'risco', titulo: 'Em Risco', icone: '🔴', cor: 'vermelho', total: 0, valorPotencial: 0, itens: [] },
    momento: { id: 'momento', titulo: 'Momento de Contato', icone: '🟡', cor: 'amarelo', total: 0, valorPotencial: 0, itens: [] },
    ranking: { id: 'ranking', titulo: 'Ranking', icone: '🏆', cor: 'azul', total: 0, valorPotencial: 0, itens: [] },
    cross: { id: 'cross', titulo: 'Cross-Sell', icone: '🔄', cor: 'verde', total: 0, valorPotencial: 0, itens: [] },
    padrao: { id: 'padrao', titulo: 'Padrão de Compra', icone: '📅', cor: 'roxo', total: 0, valorPotencial: 0, itens: [] },
    produtos: { id: 'produtos', titulo: 'Análise de Produtos', icone: '📦', cor: 'laranja', total: 0, valorPotencial: 0, itens: [] }
  }
  Object.keys(porCliente).forEach(function (cid) {
    var lista = porCliente[cid]
    var cliente = mapaClientes[cid]
    var nome = cliente ? cliente.nome : 'Cliente sem cadastro'
    var whats = cliente ? cliente.whats : ''
    // ===== Código numérico do cliente (ex.: 475) para exibir [475] Nome =====
    var codigoCliente = cliente
      ? (cliente.codigo !== undefined ? String(cliente.codigo)
        : (cliente.id !== undefined ? String(cliente.id) : null))
      : null
    var datas = lista.map(function (v) { return normalizarData(v.data) }).filter(Boolean)
    var valores = lista.map(function (v) { return Number(v.valorInsumos || 0) + Number(v.valorEquipamento || 0) })
    var receita = valores.reduce(function (s, x) { return s + x }, 0)
    var ticket = receita / (valores.length || 1)
    resumo.receitaTotal += receita
    if (datas.length === 0) return
    var ultima = datas.length ? datas.slice().sort(function (a, b) { return b - a })[0] : null
    var diasDesde = ultima ? diasEntre(ultima, hoje) : null
    var intervalo = intervaloMedio(datas)
    var temEquipamento = lista.some(function (v) { return v.pedidoEquipamento })
    var temInsumo = lista.some(function (v) { return v.pedidoInsumos })
    if (intervalo && diasDesde !== null && diasDesde > Math.round(intervalo * 1.5) && diasDesde > 15) {
      resumo.clientesEmRisco++
      grupos.risco.total++
      grupos.risco.valorPotencial += ticket
      grupos.risco.itens.push({
        tipo: 'risco',
        clienteId: cid,
        codigo: codigoCliente,
        nome: nome,
        whats: whats,
        diasSemComprar: diasDesde,
        intervalo: intervalo,
        ticketMedio: ticket,
        ultimaCompra: formatarData(ultima),
        score: scoreUrgencia('risco', diasDesde, ticket, 0),
        texto: 'Não compra há ' + diasDesde + ' dias (padrão: a cada ' + intervalo + ' dias). Contato urgente para reativar.'
      })
      return
    }
    if (intervalo && diasDesde !== null && diasDesde >= intervalo) {
      grupos.momento.total++
      grupos.momento.valorPotencial += ticket
      grupos.momento.itens.push({
        tipo: 'momento',
        clienteId: cid,
        codigo: codigoCliente,
        nome: nome,
        whats: whats,
        diasSemComprar: diasDesde,
        intervalo: intervalo,
        ticketMedio: ticket,
        ultimaCompra: formatarData(ultima),
        score: scoreUrgencia('momento', diasDesde, ticket, 0),
        texto: 'Costuma comprar a cada ' + intervalo + ' dias. Última foi há ' + diasDesde + ' dias. Momento ideal para contato.'
      })
      return
    }
    // ===== PADRÃO DE COMPRA (regra mais flexível) =====
    var semanas = datas.map(function (d) { return Math.ceil(d.getDate() / 7) })
    var semanaComum = maisComum(semanas)
    var semanaAtual = Math.ceil(hoje.getDate() / 7)
    var naJanela = semanaComum && (semanaComum === semanaAtual || semanaComum === semanaAtual + 1)
    if (semanaComum && datas.length >= 2 && naJanela) {
      var quando = semanaComum === semanaAtual ? 'estamos nela' : 'é a próxima'
      grupos.padrao.total++
      grupos.padrao.valorPotencial += ticket
      grupos.padrao.itens.push({
        tipo: 'padrao',
        clienteId: cid,
        codigo: codigoCliente,
        nome: nome,
        whats: whats,
        ticketMedio: ticket,
        semana: semanaComum,
        score: scoreUrgencia('padrao', 0, ticket, 0),
        texto: 'Costuma comprar na semana ' + semanaComum + ' do mês — ' + quando + '. Boa hora para ligar.'
      })
      return
    }
    // ===== CROSS-SELL CIRÚRGICO (vínculo por CÓDIGO + janela de 3 meses) =====
    var produtosCliente = {}
    var notasDoCliente = codigoCliente !== null ? (notasPorCodigo[codigoCliente] || []) : []
    if (notasDoCliente.length === 0 && notasPorCodigo[cid]) notasDoCliente = notasPorCodigo[cid]
    // ===== Coleta as notas DENTRO da janela com seus produtos (para exibir ao clicar) =====
    var notasDetalhe = []
    notasDoCliente.forEach(function (nota) {
      var dNota = nota && normalizarData(nota.data)
      if (!dNota || dNota < limiteJanela) return // fora da janela de 3 meses
      var produtosNota = (nota.produtos || []).filter(function (p) { return p && p.codigo })
      notasDetalhe.push({
        numero: nota.numero_nota || nota.numero || '',
        data: formatarData(dNota),
        produtos: produtosNota.map(function (p) {
          // ===== NOVO: identifica o SEGMENTO (mapeado por código + palavras aprendidas) =====
          var seg = segmentoDeProduto(p.codigo, p.descricao, palavrasAprendidas, produtosMapeados)
          return {
            codigo: String(p.codigo),
            descricao: p.descricao || '',
            quantidade: Number(p.quantidade) || 0,
            unidade: p.unidade || '',
            segmentoId: seg ? seg.familiaId : null,
            segmento: seg ? seg.familiaNome : 'Outros'
          }
        })
      })
      produtosNota.forEach(function (p) {
        var c = String(p.codigo)
        if (!produtosCliente[c]) produtosCliente[c] = { descricao: p.descricao || '', qtd: 0, ultimaData: dNota }
        produtosCliente[c].qtd += Number(p.quantidade) || 0
        if (!produtosCliente[c].descricao && p.descricao) produtosCliente[c].descricao = p.descricao
        if (dNota > produtosCliente[c].ultimaData) produtosCliente[c].ultimaData = dNota
      })
    })
    notasDetalhe.sort(function (a, b) { return String(b.data).localeCompare(String(a.data)) })
    // 1b. FALLBACK: se não há produtos nas notas da janela, usa as vendas dos últimos 3 meses
    if (Object.keys(produtosCliente).length === 0) {
      lista.forEach(function (v) {
        var dV = normalizarData(v.data)
        if (!dV || dV < limiteJanela) return
        ;[v.pedidoInsumos, v.pedidoEquipamento].forEach(function (desc) {
          if (!desc) return
          var chave = 'venda-' + normalizarTexto(desc)
          if (!produtosCliente[chave]) produtosCliente[chave] = { descricao: desc, qtd: 1, ultimaData: dV }
          else produtosCliente[chave].qtd++
        })
      })
    }
    // 2. Para cada produto comprado na janela, identifica as famílias de rotina ativas
    var familiasAtivas = {}
    Object.keys(produtosCliente).forEach(function (pc) {
      // ===== NOVO: usa segmentoDeProduto (código + palavras) em vez de matchProduto =====
      var matches2 = []
      var seg2 = segmentoDeProduto(pc, produtosCliente[pc].descricao, palavrasAprendidas, produtosMapeados)
      if (seg2) matches2.push(seg2)
      matches2.forEach(function (m) {
        if (!familiasAtivas[m.familiaId]) familiasAtivas[m.familiaId] = { nome: m.familiaNome, materiaisComprados: {} }
        familiasAtivas[m.familiaId].materiaisComprados[m.material] = true
      })
    })
    // 3. Para cada família ativa, acha os materiais que o cliente NÃO comprou na janela
    var faltantes = {}
    Object.keys(familiasAtivas).forEach(function (fid) {
      var fam = FAMILIAS.find(function (f) { return f.id === fid })
      if (!fam) return
      fam.materiais.forEach(function (mat) {
        if (familiasAtivas[fid].materiaisComprados[mat.nome]) return
        if (!faltantes[mat.nome]) faltantes[mat.nome] = { familia: familiasAtivas[fid].nome, qtdFamilias: 0 }
        faltantes[mat.nome].qtdFamilias++
      })
    })
    var faltantesLista = Object.keys(faltantes).map(function (m) {
      return { material: m, familia: faltantes[m].familia, qtdFamilias: faltantes[m].qtdFamilias }
    })
    // 4. Se achou materiais faltando na janela, gera a dica cirúrgica
    if (faltantesLista.length > 0) {
      faltantesLista.sort(function (a, b) { return b.qtdFamilias - a.qtdFamilias })
      var topFaltantes = faltantesLista.slice(0, 3)
      var nomesFaltantes = topFaltantes.map(function (f) { return f.material }).join(', ')
      var familiasNomes = Object.keys(familiasAtivas).map(function (fid) { return familiasAtivas[fid].nome })
      var contexto = familiasNomes.slice(0, 2).join(' e ')
      grupos.cross.total++
      grupos.cross.valorPotencial += ticket
      grupos.cross.itens.push({
        tipo: 'cross',
        clienteId: cid,
        codigo: codigoCliente,
        nome: nome,
        whats: whats,
        ticketMedio: ticket,
        compra: Object.keys(produtosCliente).slice(0, 3).map(function (c) { return produtosCliente[c].descricao || c }).join(', '),
        faltantes: nomesFaltantes,
        contexto: contexto,
        qtdCompras: lista.length,
        score: scoreUrgencia('cross', 0, ticket, 0),
        texto: 'Atua em ' + contexto + ', mas não comprou ' + nomesFaltantes + ' nos últimos 3 meses. Oportunidade de complementar a venda.',
        notasDetalhe: notasDetalhe   // notas + produtos dos últimos 3 meses (com segmento)
      })
    }
  })
  var rankings = rankingPorMes(vendas)
  var mesAtual = hoje.getFullYear() + '-' + String(hoje.getMonth() + 1).padStart(2, '0')
  var rankingAtual = rankings[mesAtual] || []
  var posAtual = {}
  rankingAtual.forEach(function (r, i) { posAtual[r.clienteId] = i + 1 })
  var historicoPos = {}
  Object.keys(rankings).forEach(function (chave) {
    if (chave === mesAtual) return
    rankings[chave].slice(0, 20).forEach(function (r, i) {
      if (!historicoPos[r.clienteId]) historicoPos[r.clienteId] = []
      historicoPos[r.clienteId].push(i + 1)
    })
  })
  var mediaPos = {}
  Object.keys(historicoPos).forEach(function (cid) {
    var arr = historicoPos[cid]
    mediaPos[cid] = Math.round(arr.reduce(function (s, x) { return s + x }, 0) / arr.length)
  })
  Object.keys(mediaPos).forEach(function (cid) {
    if (posAtual[cid] !== undefined) return
    var cliente = mapaClientes[cid]
    if (!cliente) return
    var codigoRank = cliente
      ? (cliente.codigo !== undefined ? String(cliente.codigo)
        : (cliente.id !== undefined ? String(cliente.id) : null))
      : null
    grupos.ranking.total++
    grupos.ranking.itens.push({
      tipo: 'ranking',
      clienteId: cid,
      codigo: codigoRank,
      nome: cliente.nome,
      whats: cliente.whats || '',
      ticketMedio: 0,
      posMedia: mediaPos[cid],
      score: scoreUrgencia('ranking', 0, 0, 10),
      texto: 'Esteve no Top 20 (posição média ' + mediaPos[cid] + ') e não apareceu no ranking deste mês.'
    })
  })
  Object.keys(posAtual).forEach(function (cid) {
    if (mediaPos[cid] === undefined) return
    var queda = posAtual[cid] - mediaPos[cid]
    if (queda < 3) return
    var cliente = mapaClientes[cid]
    if (!cliente) return
    var codigoRank2 = cliente
      ? (cliente.codigo !== undefined ? String(cliente.codigo)
        : (cliente.id !== undefined ? String(cliente.id) : null))
      : null
    grupos.ranking.total++
    grupos.ranking.itens.push({
      tipo: 'ranking',
      clienteId: cid,
      codigo: codigoRank2,
      nome: cliente.nome,
      whats: cliente.whats || '',
      ticketMedio: 0,
      posMedia: mediaPos[cid],
      posAtual: posAtual[cid],
      queda: queda,
      score: scoreUrgencia('ranking', 0, 0, queda),
      texto: 'Costumava ficar na posição ' + mediaPos[cid] + ' e este mês está na ' + posAtual[cid] + ' (caiu ' + queda + ' posições).'
    })
  })
  var sazonais = calcularSazonais(notas, hoje)
  sazonais.forEach(function (s) {
    grupos.produtos.total++
    grupos.produtos.itens.push({
      tipo: 'produtos',
      clienteId: 'saz-' + s.codigo,
      nome: s.descricao,
      whats: '',
      ticketMedio: 0,
      indice: s.indice,
      picoQtd: s.picoQtd,
      media: s.media,
      mes: s.mes,
      score: Math.round(Math.min(s.indice / 3, 1) * 100),
      texto: 'No mês de ' + s.mes + ', este produto vende ' + s.indice + 'x acima da média (' + s.picoQtd + ' unidades vs média de ' + s.media + ').'
    })
  })
  var hojeStr = formatarISO(hoje)
  Object.keys(grupos).forEach(function (gid) {
    var grupo = grupos[gid]
    grupo.itens = grupo.itens.filter(function (d) {
      var k = chaveDica(d)
      if (estado.tratados && estado.tratados.indexOf(k) !== -1) return false
      if (estado.adiados && estado.adiados[k]) {
        if (estado.adiados[k] > hojeStr) return false
      }
      return true
    })
    grupo.itens.forEach(function (d) {
      var k = chaveDica(d)
      var jaVisto = estado.vistos && estado.vistos.indexOf(k) !== -1
      d.novo = !jaVisto
      if (d.novo) resumo.novas++
      if (d.clienteId && mapaClientes[d.clienteId]) {
        var c = mapaClientes[d.clienteId]
        d.vendedorId = c.vendedorId || ''
        d.vendedorNome = c.vendedorId && mapaVendedores[c.vendedorId] ? mapaVendedores[c.vendedorId] : ''
      }
    })
    grupo.total = grupo.itens.length
    grupo.valorPotencial = grupo.itens.reduce(function (s, d) { return s + (d.ticketMedio || 0) }, 0)
    grupo.itens.sort(function (a, b) {
      if (a.score !== b.score) return b.score - a.score
      if (a.novo !== b.novo) return a.novo ? -1 : 1
      return 0
    })
  })
  resumo.ticketMedio = resumo.totalVendas ? Math.round(resumo.receitaTotal / resumo.totalVendas) : 0
  var ordem = ['risco', 'momento', 'ranking', 'cross', 'padrao', 'produtos']
  var gruposOrdenados = ordem.map(function (id) { return grupos[id] })
  return { grupos: gruposOrdenados, resumo: resumo }
}
export function atualizarEstado(estado, acao, chave) {
  var novo = {
    vistos: (estado && estado.vistos) ? estado.vistos.slice() : [],
    tratados: (estado && estado.tratados) ? estado.tratados.slice() : [],
    adiados: (estado && estado.adiados) ? Object.assign({}, estado.adiados) : {}
  }
  if (acao === 'ver') {
    if (novo.vistos.indexOf(chave) === -1) novo.vistos.push(chave)
  } else if (acao === 'tratar') {
    if (novo.tratados.indexOf(chave) === -1) novo.tratados.push(chave)
  } else if (acao === 'adiar') {
    var amanha = new Date()
    amanha.setDate(amanha.getDate() + 1)
    novo.adiados[chave] = formatarISO(amanha)
  }
  return novo
}
// ============================================================
// ESTATISTICAS DO CLIENTE (mantida igual à versão original)
// ============================================================
export function gerarEstatisticasCliente(opcoes) {
  var cliente = opcoes.cliente || null
  var vendas = opcoes.vendas || []
  var hoje = opcoes.hoje || new Date()
  hoje.setHours(0, 0, 0, 0)
  if (!cliente) return { ok: false, erro: 'Cliente não encontrado' }
  var vendasCliente = vendas.filter(function (v) { return v.clienteId === cliente.id })
  var ordenadas = vendasCliente.slice().sort(function (a, b) {
    var da = normalizarData(a.data) || new Date(0)
    var db = normalizarData(b.data) || new Date(0)
    return db - da
  })
  var totalVendas = ordenadas.length
  var totalGasto = 0
  var totalInsumos = 0
  var totalEquipamentos = 0
  var datas = []
  var anoAtual = hoje.getFullYear()
  var totalAnoAtual = 0
  var totalAnoAnterior = 0
  var mesAtual = hoje.getMonth() + 1
  var diaAtual = hoje.getDate()
  ordenadas.forEach(function (v) {
    var vi = Number(v.valorInsumos || 0)
    var ve = Number(v.valorEquipamento || 0)
    totalInsumos += vi
    totalEquipamentos += ve
    totalGasto += vi + ve
    var d = normalizarData(v.data)
    if (d) datas.push(d)
    var ano = d ? d.getFullYear() : null
    if (ano === anoAtual) {
      totalAnoAtual += vi + ve
    } else if (ano === anoAtual - 1) {
      var mes = d.getMonth() + 1
      var dia = d.getDate()
      if (mes < mesAtual || (mes === mesAtual && dia <= diaAtual)) {
        totalAnoAnterior += vi + ve
      }
    }
  })
  var ticketMedio = totalVendas ? totalGasto / totalVendas : 0
  var intervalo = intervaloMedio(datas)
  var ultima = datas.length ? datas[0] : null
  var diasDesdeUltima = ultima ? diasEntre(ultima, hoje) : null
  var frequenciaMensal = 0
  if (datas.length > 0) {
    var limite = new Date(hoje)
    limite.setMonth(limite.getMonth() - 12)
    var ultimos12 = datas.filter(function (d) { return d >= limite })
    frequenciaMensal = Math.round((ultimos12.length / 12) * 10) / 10
  }
  var diasSemana = datas.map(function (d) { return d.getDay() })
  var diaComum = maisComum(diasSemana)
  var nomeDia = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado']
  var contagemProdutos = {}
  ordenadas.forEach(function (v) {
    if (v.pedidoInsumos) contagemProdutos[v.pedidoInsumos] = (contagemProdutos[v.pedidoInsumos] || 0) + 1
    if (v.pedidoEquipamento) contagemProdutos[v.pedidoEquipamento] = (contagemProdutos[v.pedidoEquipamento] || 0) + 1
  })
  var produtos = Object.keys(contagemProdutos)
    .map(function (k) { return { nome: k, vezes: contagemProdutos[k] } })
    .sort(function (a, b) { return b.vezes - a.vezes })
    .slice(0, 5)
  var totalGeral = 0
  var mapaTotalPorCliente = {}
  vendas.forEach(function (v) {
    var cid = v.clienteId || 'sem-cliente'
    var val = Number(v.valorInsumos || 0) + Number(v.valorEquipamento || 0)
    if (!mapaTotalPorCliente[cid]) mapaTotalPorCliente[cid] = 0
    mapaTotalPorCliente[cid] += val
    totalGeral += val
  })
  var rank = Object.keys(mapaTotalPorCliente)
    .map(function (cid) { return { id: cid, total: mapaTotalPorCliente[cid] } })
    .sort(function (a, b) { return b.total - a.total })
  var posicao = rank.findIndex(function (r) { return r.id === cliente.id })
  var percentil = rank.length ? Math.round(((posicao + 1) / rank.length) * 100) : 0
  var classeAbc = 'C'
  if (percentil <= 20) classeAbc = 'A'
  else if (percentil <= 50) classeAbc = 'B'
  var ultimasCompras = ordenadas.slice(0, 10).map(function (v) {
    var d = normalizarData(v.data)
    return {
      data: d ? formatarData(d) : (v.data || ''),
      valor: Number(v.valorInsumos || 0) + Number(v.valorEquipamento || 0),
      insumos: v.pedidoInsumos || '',
      equipamento: v.pedidoEquipamento || '',
      observacao: v.observacao || ''
    }
  })
  var saude = 'novo'
  if (totalVendas >= 3 && intervalo && diasDesdeUltima !== null) {
    if (diasDesdeUltima > Math.round(intervalo * 1.5)) saude = 'risco'
    else if (diasDesdeUltima <= Math.round(intervalo * 1.2)) saude = 'ativo'
    else saude = 'atencao'
  }
  return {
    ok: true,
    cliente: {
      id: cliente.id, nome: cliente.nome, cnpj: cliente.cnpj || '', email: cliente.email || '',
      whats: cliente.whats || '', contato: cliente.contato || '', cidade: cliente.cidade || '',
      segmento: cliente.segmento || '', codigo: cliente.codigo, dataCadastro: cliente.dataCadastro || ''
    },
    estatisticas: {
      totalVendas: totalVendas, totalGasto: totalGasto, totalInsumos: totalInsumos,
      totalEquipamentos: totalEquipamentos, ticketMedio: ticketMedio, intervaloDias: intervalo,
      diasDesdeUltima: diasDesdeUltima, ultimaCompra: ultima ? formatarData(ultima) : null,
      frequenciaMensal: frequenciaMensal, diaComum: diaComum !== null ? nomeDia[diaComum] : null,
      totalAnoAtual: totalAnoAtual, totalAnoAnterior: totalAnoAnterior,
      variacaoAnual: totalAnoAnterior > 0 ? Math.round(((totalAnoAtual - totalAnoAnterior) / totalAnoAnterior) * 100) : null,
      classeAbc: classeAbc, percentil: percentil, saude: saude, produtos: produtos,
      ultimasCompras: ultimasCompras
    }
  }
}