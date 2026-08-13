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
// Retorna até 3 produtos cujo mês de pico é o mês atual e que vendem
// bem acima da média (índice >= 1.8), com histórico em 2+ anos.
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
    if (Object.keys(prod.anos).length < 2) return       // precisa de 2+ anos de histórico
    if (prod.total <= 0) return
    const mesesComVenda = Object.keys(prod.porMes).length
    if (mesesComVenda < 4) return                        // precisa aparecer em 4+ meses
    const media = prod.total / mesesComVenda
    if (media <= 0) return
    let picoMes = null, picoQtd = 0
    Object.keys(prod.porMes).forEach(function (m) {
      if (prod.porMes[m] > picoQtd) { picoQtd = prod.porMes[m]; picoMes = Number(m) }
    })
    if (picoMes !== mesAtualNum) return                  // só interessa o mês de pico = mês atual
    const indice = picoQtd / media
    if (indice < 1.8) return                             // vende pelo menos 80% acima da média
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
    // Pega a data MAIS RECENTE (ordena decrescente)
    var ultima = datas.length ? datas.slice().sort(function (a, b) { return b - a })[0] : null
    var diasDesde = ultima ? diasEntre(ultima, hoje) : null
    var intervalo = intervaloMedio(datas)
    var temEquipamento = lista.some(function (v) { return v.pedidoEquipamento })
    var temInsumo = lista.some(function (v) { return v.pedidoInsumos })
    if (datas.length > 1) resumo.clientesComMaisDeUmaCompra++
    // 1) Cliente em risco (prioridade maxima)
    if (intervalo && diasDesde !== null && diasDesde > Math.round(intervalo * 1.5) && diasDesde > 15) {
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
    if (intervalo && diasDesde !== null && diasDesde >= intervalo) {
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
  // ===== Dicas de ranking Top 20 =====
  var rankings = rankingPorMes(vendas)
  var mesAtual = hoje.getFullYear() + '-' + String(hoje.getMonth() + 1).padStart(2, '0')
  var rankingAtual = rankings[mesAtual] || []
  var posAtual = {}
  rankingAtual.forEach(function (r, i) { posAtual[r.clienteId] = i + 1 })
  // Posição histórica média (meses anteriores, apenas quem esteve no Top 20)
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
  // 1) Clientes que costumavam estar no Top 20 e NÃO apareceram este mês
  Object.keys(mediaPos).forEach(function (cid) {
    if (posAtual[cid] !== undefined) return
    var cliente = mapaClientes[cid]
    if (!cliente) return
    dicas.push({
      prioridade: 2,
      tipo: 'ranking',
      clienteId: cid,
      titulo: 'Saiu do Top 20: ' + cliente.nome,
      texto: 'Esteve no Top 20 (posição média ' + mediaPos[cid] + ') nos meses anteriores, mas ainda não apareceu no ranking deste mês.',
      detalhe: 'Cliente que costuma estar entre os maiores compradores. Vale um contato para retomar o volume.'
    })
  })
  // 2) Clientes que CAÍRAM de posição no ranking atual vs. histórico
  Object.keys(posAtual).forEach(function (cid) {
    if (mediaPos[cid] === undefined) return
    var queda = posAtual[cid] - mediaPos[cid]
    if (queda < 3) return  // só alerta se caiu 3+ posições
    var cliente = mapaClientes[cid]
    if (!cliente) return
    dicas.push({
      prioridade: 1,
      tipo: 'ranking',
      clienteId: cid,
      titulo: 'Caiu no ranking: ' + cliente.nome,
      texto: 'Costumava ficar na posição ' + mediaPos[cid] + ' e este mês está na ' + posAtual[cid] + ' (caiu ' + queda + ' posições).',
      detalhe: 'Queda no Top 20. Verifique se o cliente reduziu o volume de compras ou migrou para outro fornecedor.'
    })
  })
  // ===== Dicas de produtos sazonais (notas fiscais históricas) =====
  var sazonais = calcularSazonais(notas, hoje)
  sazonais.forEach(function (s) {
    dicas.push({
      prioridade: 1,
      tipo: 'sazonal',
      clienteId: 'saz-' + s.codigo,
      titulo: 'Produto sazonal: ' + s.descricao,
      texto: 'No mês de ' + s.mes + ', este produto costuma vender ' + s.indice + 'x acima da média (' + s.picoQtd + ' unidades vs média de ' + s.media + '). Aproveite a época para ofertar.',
      detalhe: 'Produto com alta sazonalidade neste mês. Vale antecipar o estoque e oferecer aos clientes que compram itens relacionados.'
    })
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
  // ===== Rodízio automático das dicas =====
  // As de prioridade 3 (risco) SEMPRE aparecem. As demais rotacionam por dia,
  // para o painel variar mesmo sem o vendedor clicar em Tratar/Adiar.
  var prioritarias = resultado.filter(function (d) { return d.prioridade === 3 })
  var demais = resultado.filter(function (d) { return d.prioridade < 3 })
  var diaRot = hoje.getDate()
  // Rotaciona as "demais" de forma estável (hash do cliente + dia do mês)
  demais.sort(function (a, b) {
    var ha = (a.clienteId || '') + ':' + diaRot
    var hb = (b.clienteId || '') + ':' + diaRot
    return ha < hb ? -1 : ha > hb ? 1 : 0
  })
  // Mostra: todas as prioritárias + as primeiras "demais" até completar 12
  var selecionadas = prioritarias.concat(demais).slice(0, 12)
  return { dicas: selecionadas, resumo: resumo }
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
  // Comparação justa (mesmo período do ano)
  var mesAtual = hoje.getMonth() + 1  // 1-12
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
      // Só conta vendas do ano anterior ATÉ o mesmo dia de hoje
      // (ex.: hoje é 13/08 → compara com 01/01/2025 até 13/08/2025)
      var mes = d.getMonth() + 1
      var dia = d.getDate()
      if (mes < mesAtual || (mes === mesAtual && dia <= diaAtual)) {
        totalAnoAnterior += vi + ve
      }
    }
  })
  var ticketMedio = totalVendas ? totalGasto / totalVendas : 0
  var intervalo = intervaloMedio(datas)
  // datas está ordenado do mais recente para o mais antigo, então datas[0] é a compra MAIS RECENTE
  var ultima = datas.length ? datas[0] : null
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