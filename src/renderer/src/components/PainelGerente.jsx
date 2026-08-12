import { useEffect, useMemo, useState, useCallback, useRef } from 'react'
import { fmtValor, fmtPct, fmtData, MESES_NOME as MESES, parseData, semanaAtualRange } from '../utils/format'
import { valorFreteDe, valorPedido, valorOrcamento } from '../utils/financeiro'

// Verifica se o prazo de validade venceu ou está perto (<= 3 dias)
function situacaoValidade(prazo) {
  if (!prazo) return 'sem'
  const d = parseData(prazo)
  if (!d) return 'sem'
  const hoje = new Date()
  hoje.setHours(0, 0, 0, 0)
  const diff = Math.round((d.getTime() - hoje.getTime()) / 86400000)
  if (diff < 0) return 'vencido'
  if (diff <= 3) return 'proximo'
  return 'ok'
}

const STATUS_META = {
  aguardando: { label: '⏳ Aguardando', classe: 'status-aguardando' },
  aprovado: { label: '✅ Aprovado', classe: 'status-aprovado' },
  recusado: { label: '❌ Recusado', classe: 'status-recusado' }
}

function PainelGerente() {
  const [vendedores, setVendedores] = useState([])
  const [vendas, setVendas] = useState([])
  const [clientes, setClientes] = useState([])
  const [orcamentos, setOrcamentos] = useState([])
  const [filtroCliente, setFiltroCliente] = useState('')
  const [mes, setMes] = useState(() => new Date().getMonth() + 1)
  const [ano, setAno] = useState(() => new Date().getFullYear())
  const [carregando, setCarregando] = useState(false)
  const [ultimaAtualizacao, setUltimaAtualizacao] = useState(null)
  const [autoRefresh, setAutoRefresh] = useState(true)
  // ===== NOVO: feedback de erro no carregamento =====
  const [erroCarregamento, setErroCarregamento] = useState('')
  // ===== NOVO: toast de sucesso =====
  const [aviso, setAviso] = useState('')
  const avisoTimer = useRef(null)
  const mostrarAviso = (msg) => {
    setAviso(msg)
    if (avisoTimer.current) clearTimeout(avisoTimer.current)
    avisoTimer.current = setTimeout(() => setAviso(''), 3000)
  }
  const carregarDados = useCallback(async () => {
    setCarregando(true)
    setErroCarregamento('')
    try {
      const [v, ve, c, o] = await Promise.all([
        window.api.listarVendedores(),
        window.api.listarVendas(),
        window.api.listarClientes(),
        window.api.listarOrcamentos()
      ])
      setVendedores(v || [])
      setVendas(ve || [])
      setClientes(c || [])
      setOrcamentos(o || [])
      setUltimaAtualizacao(new Date())
    } catch (err) {
      console.error('Erro ao atualizar dados do gerente:', err)
      // ===== NOVO: avisa o gerente que falhou =====
      setErroCarregamento('Falha ao atualizar os dados. Verifique a conexão e tente novamente.')
    } finally {
      setCarregando(false)
    }
  }, [])
  useEffect(() => {
    carregarDados()
  }, [carregarDados])
  const timerRef = useRef(null)
  useEffect(() => {
    if (!autoRefresh) return
    timerRef.current = setInterval(() => {
      carregarDados()
    }, 30000)
    return () => clearInterval(timerRef.current)
  }, [autoRefresh, carregarDados])
  useEffect(() => {
    const aoFocar = () => carregarDados()
    window.addEventListener('focus', aoFocar)
    return () => window.removeEventListener('focus', aoFocar)
  }, [carregarDados])
  const clientePorId = (id) => (clientes || []).find((c) => c.id === id)
  const noMes = (data, alvoAno, alvoMes) => {
    if (!data) return false
    const m = parseData(data)
    if (!m) return false
    return m.getFullYear() === alvoAno && m.getMonth() + 1 === alvoMes
  }
  const dadosVendedores = useMemo(() => {
    const { inicio, fim } = semanaAtualRange()
    const listaClientes = clientes || []
    const listaVendas = vendas || []
    const listaOrcamentos = orcamentos || []
    return vendedores
      .filter((v) => !v.admin)
      .map((v) => {
        const vendasDoVendedor = listaVendas.filter((x) => x.vendedorId === v.id)
        const vendasSemana = vendasDoVendedor.filter((x) => {
          const data = parseData(x.data)
          return data && data >= inicio && data <= fim
        })
        // ===== CORREÇÃO: usa valorPedido (pedido − frete) =====
        const totalSemana = vendasSemana.reduce((s, x) => s + valorPedido(x), 0)
        const vendasMes = vendasDoVendedor.filter((x) => noMes(x.data, ano, mes))
        const totalMes = vendasMes.reduce((s, x) => s + valorPedido(x), 0)
        const qtdVendasMes = vendasMes.length
        const ticketMedioMes = qtdVendasMes > 0 ? totalMes / qtdVendasMes : 0
        const clientesDoVendedor = listaClientes.filter((c) => c.vendedorId === v.id)
        const qtdClientesTotal = clientesDoVendedor.length
        const qtdClientesMes = clientesDoVendedor.filter((c) => noMes(c.dataCadastro, ano, mes)).length
        const orcamentosDoVendedor = listaOrcamentos.filter((o) => o.vendedorId === v.id)
        const orcamentosMes = orcamentosDoVendedor.filter((o) => noMes(o.data, ano, mes))
        const qtdOrcamentosMes = orcamentosMes.length
        const totalOrcamentosMes = orcamentosMes.reduce((s, o) => s + valorOrcamento(o), 0)
        const qtdAguardando = orcamentosMes.filter((o) => o.status === 'aguardando').length
        const qtdAprovados = orcamentosMes.filter((o) => o.status === 'aprovado').length
        const qtdRecusados = orcamentosMes.filter((o) => o.status === 'recusado').length
        const metaSemanal = Number(v.metaSemanal) || 25000
        const metaMensal = Number(v.metaMensal) || 100000
        const bateuSemana = totalSemana >= metaSemanal
        const bateuMes = totalMes >= metaMensal
        // ===== NOVO: taxa de conversão por vendedor =====
        const taxaConversao = qtdOrcamentosMes > 0 ? (qtdAprovados / qtdOrcamentosMes) * 100 : 0
        return {
          ...v,
          totalSemana,
          totalMes,
          qtdVendasMes,
          ticketMedioMes,
          qtdClientesTotal,
          qtdClientesMes,
          qtdOrcamentosMes,
          totalOrcamentosMes,
          qtdAguardando,
          qtdAprovados,
          qtdRecusados,
          taxaConversao,
          metaSemanal,
          metaMensal,
          bateuSemana,
          bateuMes,
          pctSemana: metaSemanal > 0 ? Math.min(100, (totalSemana / metaSemanal) * 100) : 0,
          pctMes: metaMensal > 0 ? Math.min(100, (totalMes / metaMensal) * 100) : 0
        }
      })
      .sort((a, b) => b.totalMes - a.totalMes)
  }, [vendedores, vendas, clientes, orcamentos, mes, ano])
  const totalVendidoMes = dadosVendedores.reduce((s, v) => s + v.totalMes, 0)
  const metaEquipe = dadosVendedores.reduce((s, v) => s + v.metaMensal, 0)
  const pctEquipe = metaEquipe > 0 ? (totalVendidoMes / metaEquipe) * 100 : 0
  // Funil de orçamentos do mês
  const orcamentosMes = (orcamentos || []).filter((o) => noMes(o.data, ano, mes))
  const totalOrcamentosMes = orcamentosMes.reduce((s, o) => s + valorOrcamento(o), 0)
  const qtdOrcamentosMes = orcamentosMes.length
  const qtdAguardando = orcamentosMes.filter((o) => o.status === 'aguardando').length
  const qtdAprovados = orcamentosMes.filter((o) => o.status === 'aprovado').length
  const qtdRecusados = orcamentosMes.filter((o) => o.status === 'recusado').length
  const totalAguardando = orcamentosMes
    .filter((o) => o.status === 'aguardando')
    .reduce((s, o) => s + valorOrcamento(o), 0)
  const taxaConversao = qtdOrcamentosMes > 0 ? (qtdAprovados / qtdOrcamentosMes) * 100 : 0
  const clientesNovosMes = (clientes || []).filter((c) => noMes(c.dataCadastro, ano, mes)).length
  const totalClientes = (clientes || []).length
  // ===== NOVO: comparação com o mês anterior =====
  const mesAnterior = mes === 1 ? 12 : mes - 1
  const anoAnterior = mes === 1 ? ano - 1 : ano
  const totalMesAnterior = (vendas || [])
    .filter((x) => noMes(x.data, anoAnterior, mesAnterior))
    .reduce((s, x) => s + valorPedido(x), 0)
  const variacaoMes = totalMesAnterior > 0 ? ((totalVendidoMes - totalMesAnterior) / totalMesAnterior) * 100 : null
  const rankingClientes = useMemo(() => {
    return [...dadosVendedores].sort(
      (a, b) => b.qtdClientesMes - a.qtdClientesMes || b.qtdClientesTotal - a.qtdClientesTotal
    )
  }, [dadosVendedores])
  const rankingOrcamentos = useMemo(() => {
    return [...dadosVendedores].sort(
      (a, b) => b.qtdAguardando - a.qtdAguardando || b.totalOrcamentosMes - a.totalOrcamentosMes
    )
  }, [dadosVendedores])
  // ===== NOVO: ranking por conversão (quem converte melhor) =====
  const rankingConversao = useMemo(() => {
    return [...dadosVendedores]
      .filter((v) => v.qtdOrcamentosMes > 0)
      .sort((a, b) => b.taxaConversao - a.taxaConversao)
  }, [dadosVendedores])
  // ===== NOVO: orçamentos vencendo/vencidos (ação urgente) =====
  const orcamentosUrgentes = useMemo(() => {
    return (orcamentos || [])
      .filter((o) => o.status === 'aguardando')
      .map((o) => ({ ...o, val: situacaoValidade(o.prazoValidade) }))
      .filter((o) => o.val === 'vencido' || o.val === 'proximo')
      .sort((a, b) => String(a.prazoValidade || '').localeCompare(String(b.prazoValidade || '')))
      .slice(0, 8)
  }, [orcamentos])
  const motivosRecusa = useMemo(() => {
    const contagem = {}
    orcamentosMes
      .filter((o) => o.status === 'recusado' && o.motivo)
      .forEach((o) => {
        const m = String(o.motivo).trim().toLowerCase()
        if (!m) return
        contagem[m] = (contagem[m] || 0) + 1
      })
    return Object.entries(contagem)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
  }, [orcamentosMes])
  const orcamentosFiltrados = useMemo(() => {
    const lista = orcamentos || []
    if (!filtroCliente) return lista
    return lista.filter((o) => o.clienteId === filtroCliente)
  }, [orcamentos, filtroCliente])
  return (
    <div className="painel-gerente">
      {/* ===== NOVO: toast de sucesso ===== */}
      {aviso && <div className="toast-sucesso">{aviso}</div>}
      <div className="section-head">
        <h2>👑 Painel do Gerente</h2>
        <div className="head-direita">
          <div className="refresh-controles">
            <button className="btn-secondary" onClick={carregarDados} disabled={carregando}>
              {carregando ? 'Atualizando...' : '🔄 Atualizar'}
            </button>
            <label className="auto-refresh-label" title="Atualizar automaticamente a cada 30s">
              <input type="checkbox" checked={autoRefresh} onChange={(e) => setAutoRefresh(e.target.checked)} />
              Auto (30s)
            </label>
          </div>
          {ultimaAtualizacao && (
            <span className="ultima-atualizacao">
              Atualizado às {ultimaAtualizacao.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </span>
          )}
          <label className="filtro-mini">
            Mês
            <select value={mes} onChange={(e) => setMes(Number(e.target.value))}>
              {MESES.map((m, i) => (
                <option key={i} value={i + 1}>{m}</option>
              ))}
            </select>
          </label>
          <label className="filtro-mini">
            Ano
            <select value={ano} onChange={(e) => setAno(Number(e.target.value))}>
              {Array.from({ length: 6 }, (_, i) => new Date().getFullYear() - 4 + i).map((a) => (
                <option key={a} value={a}>{a}</option>
              ))}
            </select>
          </label>
        </div>
      </div>
      {/* ===== NOVO: erro de carregamento ===== */}
      {erroCarregamento && (
        <div className="aviso-erro">
          ⚠️ {erroCarregamento}
        </div>
      )}
      {/* Cards de indicadores (KPIs) */}
      <div className="kpi-grid">
        <div className="kpi-card kpi-destaque">
          <span className="kpi-rotulo">Total vendido no mês</span>
          <div className="kpi-valor">{fmtValor(totalVendidoMes)}</div>
          <div className="kpi-sub">Meta da equipe: {fmtValor(metaEquipe)}</div>
          <div className="kpi-bar">
            <div style={{ width: `${Math.min(100, pctEquipe)}%` }}></div>
          </div>
          <div className="kpi-sub"><strong>{fmtPct(pctEquipe)}</strong> da meta no mês</div>
          {/* ===== NOVO: variação vs mês anterior ===== */}
          {variacaoMes !== null && (
            <div className={`kpi-variacao ${variacaoMes >= 0 ? 'variacao-ok' : 'variacao-ruim'}`}>
              {variacaoMes >= 0 ? '▲' : '▼'} {fmtPct(Math.abs(variacaoMes))} vs. mês anterior
            </div>
          )}
        </div>
        <div className="kpi-card">
          <span className="kpi-rotulo">Clientes cadastrados</span>
          <div className="kpi-valor">{clientesNovosMes}</div>
          <div className="kpi-sub">novos em {MESES[mes - 1]} · {totalClientes} no total</div>
        </div>
        <div className="kpi-card">
          <span className="kpi-rotulo">Orçamentos aguardando</span>
          <div className="kpi-valor">{fmtValor(totalAguardando)}</div>
          <div className="kpi-sub">{qtdAguardando} aguardando no mês</div>
        </div>
        <div className="kpi-card">
          <span className="kpi-rotulo">Vendedores na meta</span>
          <div className="kpi-valor">{dadosVendedores.filter((v) => v.bateuMes).length} / {dadosVendedores.length}</div>
          <div className="kpi-sub">batendo a meta no mês selecionado</div>
        </div>
      </div>
      {/* ===== NOVO: orçamentos urgentes (ação) ===== */}
      {orcamentosUrgentes.length > 0 && (
        <div className="painel painel-acao">
          <h3 className="top-titulo">⏰ Orçamentos vencendo ou vencidos (aguardando)</h3>
          <p className="dica-sub">Ações urgentes: cobrar aprovação ou renovar o prazo antes de perder a venda.</p>
          <div className="tabela-wrap">
            <table className="tabela">
              <thead>
                <tr>
                  <th>Cliente</th>
                  <th>Vendedor</th>
                  <th>Valor</th>
                  <th>Válido até</th>
                </tr>
              </thead>
              <tbody>
                {orcamentosUrgentes.map((o) => {
                  const cli = clientePorId(o.clienteId)
                  const vend = vendedores.find((v) => v.id === o.vendedorId)
                  return (
                    <tr key={o.id}>
                      <td>{cli ? `#${cli.codigo} ${cli.nome}` : '(cliente removido)'}</td>
                      <td>{vend ? vend.nome : '-'}</td>
                      <td className="mini-num">{fmtValor(valorOrcamento(o))}</td>
                      <td>
                        <span className={`validade validade-${o.val}`}>
                          {fmtData(o.prazoValidade)}
                          {o.val === 'vencido' && ' (vencido)'}
                          {o.val === 'proximo' && ' (vence em breve)'}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {/* Funil de orçamentos */}
      <div className="orcamento-contadores">
        <span className={'badge ' + STATUS_META.aguardando.classe}>⏳ Aguardando: {qtdAguardando}</span>
        <span className={'badge ' + STATUS_META.aprovado.classe}>✅ Aprovados: {qtdAprovados}</span>
        <span className={'badge ' + STATUS_META.recusado.classe}>❌ Recusados: {qtdRecusados}</span>
        <span className="badge badge-conversao">🎯 Conversão: {fmtPct(taxaConversao)}</span>
      </div>
      {/* Ranking de vendas */}
      <h3 className="top-titulo">📊 Ranking de Vendas — {MESES[mes - 1]} de {ano}</h3>
      {dadosVendedores.length === 0 ? (
        <p className="empty">Nenhum vendedor cadastrado.</p>
      ) : (
        <div className="tabela-wrap">
          <table className="tabela">
            <thead>
              <tr>
                <th>#</th>
                <th>Vendedor</th>
                <th>Vendas Semana</th>
                <th>% Semana</th>
                <th>Vendas Mês</th>
                <th>% Mês</th>
                <th>Nº Vendas</th>
                <th>Ticket Médio</th>
                <th>Medalhas</th>
              </tr>
            </thead>
            <tbody>
              {dadosVendedores.map((v, i) => (
                <tr key={v.id}>
                  <td className={`rank-pos ${i === 0 ? 'top1' : ''} ${i === 1 ? 'top2' : ''} ${i === 2 ? 'top3' : ''}`}>
                    {i + 1}º
                  </td>
                  <td><strong>{v.nome}</strong></td>
                  <td>
                    <div className="mini-progress">
                      <div className="mini-bar">
                        <div className="mini-fill" style={{ width: `${v.pctSemana}%` }}></div>
                      </div>
                      <span>{fmtValor(v.totalSemana)} / {fmtValor(v.metaSemanal)}</span>
                    </div>
                  </td>
                  <td className="rank-valor">{fmtPct(v.pctSemana)}</td>
                  <td>
                    <div className="mini-progress">
                      <div className="mini-bar">
                        <div className="mini-fill" style={{ width: `${v.pctMes}%` }}></div>
                      </div>
                      <span>{fmtValor(v.totalMes)} / {fmtValor(v.metaMensal)}</span>
                    </div>
                  </td>
                  <td className="rank-valor">{fmtPct(v.pctMes)}</td>
                  <td className="mini-num">{v.qtdVendasMes}</td>
                  <td className="mini-num">{fmtValor(v.ticketMedioMes)}</td>
                  <td className="medalhas">
                    {v.bateuSemana && <span title="Bateu a meta semanal">🥈</span>}
                    {v.bateuMes && <span title="Bateu a meta mensal">🥇</span>}
                    {!v.bateuSemana && !v.bateuMes && <span className="sem-medalha">—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {/* ===== NOVO: ranking por taxa de conversão ===== */}
      {rankingConversao.length > 0 && (
        <>
          <h3 className="top-titulo">🎯 Ranking de Conversão (Orçamento → Venda) — {MESES[mes - 1]} de {ano}</h3>
          <div className="tabela-wrap">
            <table className="tabela">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Vendedor</th>
                  <th>Conversão</th>
                  <th>Aprovados</th>
                  <th>Total Orç.</th>
                </tr>
              </thead>
              <tbody>
                {rankingConversao.map((v, i) => (
                  <tr key={v.id}>
                    <td className={`rank-pos ${i === 0 ? 'top1' : ''}`}>{i + 1}º</td>
                    <td><strong>{v.nome}</strong></td>
                    <td className="rank-valor">{fmtPct(v.taxaConversao)}</td>
                    <td className="mini-num">{v.qtdAprovados}</td>
                    <td className="mini-num">{v.qtdOrcamentosMes}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
      {/* Ranking de clientes cadastrados */}
      <h3 className="top-titulo">👥 Clientes Cadastrados por Vendedor — {MESES[mes - 1]} de {ano}</h3>
      {rankingClientes.length === 0 ? (
        <p className="empty">Nenhum vendedor cadastrado.</p>
      ) : (
        <div className="tabela-wrap">
          <table className="tabela">
            <thead>
              <tr>
                <th>#</th>
                <th>Vendedor</th>
                <th>Novos no mês</th>
                <th>Total de clientes</th>
              </tr>
            </thead>
            <tbody>
              {rankingClientes.map((v, i) => (
                <tr key={v.id}>
                  <td className={`rank-pos ${i === 0 ? 'top1' : ''}`}>{i + 1}º</td>
                  <td><strong>{v.nome}</strong></td>
                  <td className="mini-num">{v.qtdClientesMes}</td>
                  <td className="mini-num">{v.qtdClientesTotal}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {/* Ranking de orçamentos por vendedor */}
      <h3 className="top-titulo">📉 Orçamentos por Vendedor — {MESES[mes - 1]} de {ano}</h3>
      {rankingOrcamentos.length === 0 ? (
        <p className="empty">Nenhum vendedor cadastrado.</p>
      ) : (
        <div className="tabela-wrap">
          <table className="tabela">
            <thead>
              <tr>
                <th>#</th>
                <th>Vendedor</th>
                <th>Aguardando</th>
                <th>Aprovados</th>
                <th>Recusados</th>
                <th>Total (R$)</th>
              </tr>
            </thead>
            <tbody>
              {rankingOrcamentos.map((v, i) => (
                <tr key={v.id}>
                  <td className={`rank-pos ${i === 0 ? 'top1' : ''}`}>{i + 1}º</td>
                  <td><strong>{v.nome}</strong></td>
                  <td className="mini-num">{v.qtdAguardando}</td>
                  <td className="mini-num">{v.qtdAprovados}</td>
                  <td className="mini-num">{v.qtdRecusados}</td>
                  <td className="mini-num">{fmtValor(v.totalOrcamentosMes)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {/* Motivos de recusa mais comuns */}
      {motivosRecusa.length > 0 && (
        <>
          <h3 className="top-titulo">🔍 Motivos de Recusa mais comuns</h3>
          <div className="tabela-wrap">
            <table className="tabela">
              <thead>
                <tr><th>Motivo</th><th>Qtd</th></tr>
              </thead>
              <tbody>
                {motivosRecusa.map(([motivo, qtd], i) => (
                  <tr key={i}>
                    <td>{motivo}</td>
                    <td className="mini-num">{qtd}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
      {/* Orçamentos não faturados de todos os vendedores */}
      <h3 className="top-titulo">📋 Todos os Orçamentos (todos os vendedores)</h3>
      <div className="filtro-orcamento">
        <label>
          Filtrar por cliente
          <select value={filtroCliente} onChange={(e) => setFiltroCliente(e.target.value)}>
            <option value="">Todos os clientes</option>
            {[...(clientes || [])].sort((a, b) => Number(a.codigo) - Number(b.codigo)).map((c) => (
              <option key={c.id} value={c.id}>#{c.codigo} — {c.nome}</option>
            ))}
          </select>
        </label>
      </div>
      {orcamentosFiltrados.length === 0 ? (
        <p className="empty">Nenhum orçamento registrado.</p>
      ) : (
        <div className="tabela-wrap">
          <table className="tabela">
            <thead>
              <tr>
                <th>Cliente</th>
                <th>Vendedor</th>
                <th>Orc. Insumos</th>
                <th>Orc. Equip.</th>
                <th>Valor</th>
                <th>Status</th>
                <th>Válido até</th>
                <th>Motivo</th>
                <th>Data</th>
              </tr>
            </thead>
            <tbody>
              {orcamentosFiltrados
                .sort((a, b) => String(b.data || '').localeCompare(String(a.data || '')))
                .map((o) => {
                  const cli = clientePorId(o.clienteId)
                  const vend = vendedores.find((v) => v.id === o.vendedorId)
                  const st = STATUS_META[o.status] || STATUS_META.aguardando
                  const val = situacaoValidade(o.prazoValidade)
                  return (
                    <tr key={o.id}>
                      <td>{cli ? `#${cli.codigo} ${cli.nome}` : '(cliente removido)'}</td>
                      <td>{vend ? vend.nome : '-'}</td>
                      <td>{o.pedidoInsumos || '—'}</td>
                      <td>{o.pedidoEquipamento || '—'}</td>
                      <td>{fmtValor(valorOrcamento(o))}</td>
                      <td>
                        <span className={'badge ' + st.classe}>{st.label}</span>
                        {o.status === 'aprovado' && (o.pedidoFinalInsumos || o.pedidoFinalEquipamento) && (
                          <div className="recusa-info aprovado-info">
                            {o.pedidoFinalInsumos && <div>Ped. Insumos: {o.pedidoFinalInsumos}</div>}
                            {o.pedidoFinalEquipamento && <div>Ped. Equip.: {o.pedidoFinalEquipamento}</div>}
                          </div>
                        )}
                        {o.status === 'recusado' && o.concorrente && (
                          <div className="recusa-info">Concorrente: {o.concorrente}</div>
                        )}
                      </td>
                      <td>
                        {o.prazoValidade ? (
                          <span className={`validade validade-${val}`}>
                            {fmtData(o.prazoValidade)}
                            {val === 'vencido' && ' (vencido)'}
                            {val === 'proximo' && ' (vence em breve)'}
                          </span>
                        ) : '—'}
                      </td>
                      <td>{o.motivo || '—'}</td>
                      <td>{fmtData(o.data)}</td>
                    </tr>
                  )
                })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
export default PainelGerente