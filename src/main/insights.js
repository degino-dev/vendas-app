// src/main/insights.js
// FASE 1 - Modulo de Insights (regras, offline, sem custo)
// Gera dicas acionaveis e controla o estado "visto/tratado" de cada uma,
// para o painel nunca parecer estatico.
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
    if (contagem[k] > melhorQtd) {
      melhorQtd = contagem[k]
      melhor = k
    }
  })
  return melhor
}
function formatarData(d) {
  if (!d) return ''
  var dia = String(d.getDate()).padStart(2, '0')
  var mes = String(d.getMonth() + 1).padStart(2, '0')
  return dia + '/' + mes + '/' + d.getFullYear()
}
// Formata data como YYYY-MM-DD local (corrige bug de fuso do toISOString)
function formatarISO(d) {
  if (!d) return ''
  var mes = String(d.getMonth() + 1).padStart(2, '0')
  var dia = String(d.getDate()).padStart(2, '0')
  return d.getFullYear() + '-' + mes + '-' + dia
}
function formatarMoeda(v) {
  return 'R$ ' + Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}
function chaveDica(d) {
  return d.tipo + ':' + d.clienteId
}
export function gerarInsights(opcoes) {
  var clientes = opcoes.clientes || []
  var vendas = opcoes.vendas || []
  var vendedores = opcoes.vendedores || []
  var estado = opcoes.estado || { vistos: [], tratados: [], adiados: {} }
  var hoje = opcoes.hoje || new Date()
  hoje.setHours(0, 0, 0, 0)
  var mapaVendedores = {}
  vendedores.forEach(function (v) { mapaVendedores[v.id] = v.nome })
  var dicas = []
  var resumo = {
    totalClientes: clientes.length,
    totalVendas: vendas.length,
    receitaTotal: 0,
    ticketMedio: 0,
    clientesEmRisco: 0,
    clientesComMaisDeUmaCompra: 0,
    novas: 0
  }
  var porCliente = {}
  vendas.forEach(function (v) {
    var cid = v.clienteId || 'sem-cliente'
    if (!porCliente[cid]) porCliente[cid] = []
    porCliente[cid].push(v)
  })
  var mapaClientes = {}
  clientes.forEach(function (c) { mapaClientes[c.id] = c })
  Object.keys(porCliente).forEach(function (cid) {
    var lista = porCliente[cid]
    var cliente = mapaClientes[cid]
    var nome = cliente ? cliente.nome : 'Cliente sem cadastro'
    var whats = cliente ? cliente.whats : ''
    var datas = lista.map(function (v) { return normalizarData(v.data) }).filter(Boolean)
    var valores = lista.map(function (v) { return Number(v.valorInsumos || 0) + Number(v.valorEquipamento || 0) })
    var receita = valores.reduce(function (s, x) { return s + x }, 0)
    var ticket = receita / (valores.length || 1)
    resumo.receitaTotal += receita
    if (datas.length === 0) return
    var ultima = datas[datas.length - 1]
    var diasDesde = diasEntre(ultima, hoje)
    var intervalo = intervaloMedio(datas)
    var temEquipamento = lista.some(function (v) { return v.pedidoEquipamento })
    var temInsumo = lista.some(function (v) { return v.pedidoInsumos })
    if (datas.length > 1) resumo.clientesComMaisDeUmaCompra++
    // 1) Cliente em risco (prioridade maxima)
    if (intervalo && diasDesde > Math.round(intervalo * 1.5) && diasDesde > 15) {
      resumo.clientesEmRisco++
      dicas.push({
        prioridade: 3,
        tipo: 'risco',
        clienteId: cid,
        titulo: 'Cliente em risco: ' + nome,
        texto: 'Não compra há ' + diasDesde + ' dias (padrão dele: a cada ' + intervalo + ' dias). Vale contato urgente para reativar.',
        detalhe: 'Última compra: ' + formatarData(ultima) + ' | Ticket médio: ' + formatarMoeda(ticket) + (whats ? ' | ' + whats : '')
      })
      return
    }
    // 2) Momento ideal de contato
    if (intervalo && diasDesde >= intervalo) {
      dicas.push({
        prioridade: 2,
        tipo: 'momento',
        clienteId: cid,
        titulo: 'Momento ideal: ' + nome,
        texto: 'Costuma comprar a cada ' + intervalo + ' dias. Última compra foi há ' + diasDesde + ' dias. Esta semana é o momento ideal para contato.',
        detalhe: 'Última compra: ' + formatarData(ultima) + ' | Ticket médio: ' + formatarMoeda(ticket) + (whats ? ' | ' + whats : '')
      })
      return
    }
    // 3) Padrao de semana do mes
    var semanas = datas.map(function (d) { return Math.ceil(d.getDate() / 7) })
    var semanaComum = maisComum(semanas)
    var semanaAtual = Math.ceil(hoje.getDate() / 7)
    if (semanaComum && datas.length >= 2 && semanaComum === semanaAtual) {
      dicas.push({
        prioridade: 1,
        tipo: 'padrao',
        clienteId: cid,
        titulo: 'Padrão de compra: ' + nome,
        texto: 'Costuma comprar na semana ' + semanaComum + ' do mês. Estamos nela — boa hora para ligar.',
        detalhe: 'Ticket médio: ' + formatarMoeda(ticket) + (whats ? ' | ' + whats : '')
      })
      return
    }
    // 4) Cross-sell
    if (temInsumo && !temEquipamento && lista.length >= 2) {
      dicas.push({
        prioridade: 1,
        tipo: 'cross',
        clienteId: cid,
        titulo: 'Oportunidade de equipamento: ' + nome,
        texto: 'Só compra insumos (' + lista.length + ' compras). Talvez seja hora de oferecer equipamento.',
        detalhe: 'Ticket médio: ' + formatarMoeda(ticket) + (whats ? ' | ' + whats : '')
      })
    }
  })
  // Aplica estado: marca "novo", remove tratados, respeita adiados
  var hojeStr = formatarISO(hoje)
  var resultado = []
  dicas.forEach(function (d) {
    var k = chaveDica(d)
    if (estado.tratados && estado.tratados.indexOf(k) !== -1) return
    if (estado.adiados && estado.adiados[k]) {
      if (estado.adiados[k] > hojeStr) return
    }
    var jaVisto = estado.vistos && estado.vistos.indexOf(k) !== -1
    d.novo = !jaVisto
    if (d.novo) resumo.novas++
    resultado.push(d)
  })
  // Enriquecimento: nome do vendedor dono do cliente (para o admin)
  resultado.forEach(function (d) {
    if (d.clienteId && mapaClientes[d.clienteId]) {
      var c = mapaClientes[d.clienteId]
      d.vendedorNome = c.vendedorId && mapaVendedores[c.vendedorId] ? mapaVendedores[c.vendedorId] : ''
    }
  })
  // Ordena por prioridade (maior primeiro), novos no topo entre mesma prioridade
  resultado.sort(function (a, b) {
    if (a.prioridade !== b.prioridade) return b.prioridade - a.prioridade
    if (a.novo !== b.novo) return a.novo ? -1 : 1
    return 0
  })
  resumo.ticketMedio = resumo.totalVendas ? Math.round(resumo.receitaTotal / resumo.totalVendas) : 0
  return { dicas: resultado.slice(0, 8), resumo: resumo }
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
// ESTATISTICAS DO CLIENTE (pagina ao clicar no nome)
// ============================================================
export function gerarEstatisticasCliente(opcoes) {
  var cliente = opcoes.cliente || null
  var vendas = opcoes.vendas || []
  var hoje = opcoes.hoje || new Date()
  hoje.setHours(0, 0, 0, 0)
  if (!cliente) return { ok: false, erro: 'Cliente não encontrado' }
  // Filtra vendas do cliente
  var vendasCliente = vendas.filter(function (v) { return v.clienteId === cliente.id })
  // Ordena por data (mais recente primeiro)
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
  ordenadas.forEach(function (v) {
    var vi = Number(v.valorInsumos || 0)
    var ve = Number(v.valorEquipamento || 0)
    totalInsumos += vi
    totalEquipamentos += ve
    totalGasto += vi + ve
    var d = normalizarData(v.data)
    if (d) datas.push(d)
    var ano = d ? d.getFullYear() : null
    if (ano === anoAtual) totalAnoAtual += vi + ve
    if (ano === anoAtual - 1) totalAnoAnterior += vi + ve
  })
  var ticketMedio = totalVendas ? totalGasto / totalVendas : 0
  var intervalo = intervaloMedio(datas)
  var ultima = datas.length ? datas[datas.length - 1] : null
  var diasDesdeUltima = ultima ? diasEntre(ultima, hoje) : null
  // Frequencia: media de compras por mes (ultimos 12 meses)
  var frequenciaMensal = 0
  if (datas.length > 0) {
    var limite = new Date(hoje)
    limite.setMonth(limite.getMonth() - 12)
    var ultimos12 = datas.filter(function (d) { return d >= limite })
    frequenciaMensal = Math.round((ultimos12.length / 12) * 10) / 10
  }
  // Dia da semana mais comum
  var diasSemana = datas.map(function (d) { return d.getDay() })
  var diaComum = maisComum(diasSemana)
  var nomeDia = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado']
  // Produtos mais comprados (insumos e equipamentos)
  var contagemProdutos = {}
  ordenadas.forEach(function (v) {
    if (v.pedidoInsumos) {
      var p = v.pedidoInsumos
      contagemProdutos[p] = (contagemProdutos[p] || 0) + 1
    }
    if (v.pedidoEquipamento) {
      var eq = v.pedidoEquipamento
      contagemProdutos[eq] = (contagemProdutos[eq] || 0) + 1
    }
  })
  var produtos = Object.keys(contagemProdutos)
    .map(function (k) { return { nome: k, vezes: contagemProdutos[k] } })
    .sort(function (a, b) { return b.vezes - a.vezes })
    .slice(0, 5)
  // Curva ABC: usa o total gasto do cliente comparado ao total geral
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
  // Ultimas 10 compras (resumo)
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
  // Saude do cliente
  var saude = 'novo'
  if (totalVendas >= 3 && intervalo && diasDesdeUltima !== null) {
    if (diasDesdeUltima > Math.round(intervalo * 1.5)) saude = 'risco'
    else if (diasDesdeUltima <= Math.round(intervalo * 1.2)) saude = 'ativo'
    else saude = 'atencao'
  }
  return {
    ok: true,
    cliente: {
      id: cliente.id,
      nome: cliente.nome,
      cnpj: cliente.cnpj || '',
      email: cliente.email || '',
      whats: cliente.whats || '',
      cidade: cliente.cidade || '',
      segmento: cliente.segmento || '',
      codigo: cliente.codigo,
      dataCadastro: cliente.dataCadastro || ''
    },
    estatisticas: {
      totalVendas: totalVendas,
      totalGasto: totalGasto,
      totalInsumos: totalInsumos,
      totalEquipamentos: totalEquipamentos,
      ticketMedio: ticketMedio,
      intervaloDias: intervalo,
      diasDesdeUltima: diasDesdeUltima,
      ultimaCompra: ultima ? formatarData(ultima) : null,
      frequenciaMensal: frequenciaMensal,
      diaComum: diaComum !== null ? nomeDia[diaComum] : null,
      totalAnoAtual: totalAnoAtual,
      totalAnoAnterior: totalAnoAnterior,
      variacaoAnual: totalAnoAnterior > 0 ? Math.round(((totalAnoAtual - totalAnoAnterior) / totalAnoAnterior) * 100) : null,
      classeAbc: classeAbc,
      percentil: percentil,
      saude: saude,
      produtos: produtos,
      ultimasCompras: ultimasCompras
    }
  }
}