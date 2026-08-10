import { useEffect, useMemo, useState, useCallback, useRef } from 'react'

const MESES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
]

// Converte "YYYY-MM-DD" em Date local (evita erro de fuso)
function parseData(d) {
  if (!d) return null
  const m = String(d).match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (!m) return null
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
}

// Início/fim da semana atual (segunda a domingo)
function semanaAtualRange() {
  const d = new Date()
  const dia = d.getDay()
  const diff = dia === 0 ? -6 : 1 - dia
  const inicio = new Date(d)
  inicio.setDate(d.getDate() + diff)
  inicio.setHours(0, 0, 0, 0)
  const fim = new Date(inicio)
  fim.setDate(inicio.getDate() + 6)
  fim.setHours(23, 59, 59, 999)
  return { inicio, fim }
}

const fmtValor = (v) =>
  Number(v || 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })

const fmtPct = (p) => `${p.toFixed(1).replace('.', ',')}%`

const fmtData = (d) => {
  if (!d) return ''
  const m = String(d).match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (!m) return d
  return `${m[3]}/${m[2]}/${m[1]}`
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

  // --- Carregamento (botão + auto-refresh + foco) ---
  const carregarDados = useCallback(async () => {
    setCarregando(true)
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
    } finally {
      setCarregando(false)
    }
  }, [])

  // Carrega na montagem
  useEffect(() => {
    carregarDados()
  }, [carregarDados])

  // Auto-refresh a cada 30s (quando ativo)
  const timerRef = useRef(null)
  useEffect(() => {
    if (!autoRefresh) return
    timerRef.current = setInterval(() => {
      carregarDados()
    }, 30000)
    return () => clearInterval(timerRef.current)
  }, [autoRefresh, carregarDados])

  // Recarrega sempre que a janela voltar a ter foco
  // (ex.: gerente alternou de tela/aplicativo e voltou ao app)
  useEffect(() => {
    const aoFocar = () => carregarDados()
    window.addEventListener('focus', aoFocar)
    return () => window.removeEventListener('focus', aoFocar)
  }, [carregarDados])

  const clientePorId = (id) => (clientes || []).find((c) => c.id === id)

  // Verifica se uma data AAAA-MM-DD pertence ao mês/ano selecionado
  const noMes = (data, alvoAno, alvoMes) => {
    if (!data) return false
    const m = parseData(data)
    if (!m) return false
    return m.getFullYear() === alvoAno && m.getMonth() + 1 === alvoMes
  }

  // Dados por vendedor (vendedores comuns; admin fica fora do ranking)
  const dadosVendedores = useMemo(() => {
    const { inicio, fim } = semanaAtualRange()
    const listaClientes = clientes || []
    const listaVendas = vendas || []
    return vendedores
      .filter((v) => !v.admin)
      .map((v) => {
        const vendasDoVendedor = listaVendas.filter((x) => x.vendedorId === v.id)
        // Semana atual
        const vendasSemana = vendasDoVendedor.filter((x) => {
          const data = parseData(x.data)
          return data && data >= inicio && data <= fim
        })
        const totalSemana = vendasSemana.reduce(
          (s, x) => s + Number(x.valorInsumos || 0) + Number(x.valorEquipamento || 0),
          0
        )
        // Mês selecionado
        const vendasMes = vendasDoVendedor.filter((x) => noMes(x.data, ano, mes))
        const totalMes = vendasMes.reduce(
          (s, x) => s + Number(x.valorInsumos || 0) + Number(x.valorEquipamento || 0),
          0
        )
        const qtdVendasMes = vendasMes.length
        const ticketMedioMes = qtdVendasMes > 0 ? totalMes / qtdVendasMes : 0
        // Clientes
        const clientesDoVendedor = listaClientes.filter((c) => c.vendedorId === v.id)
        const qtdClientesTotal = clientesDoVendedor.length
        const qtdClientesMes = clientesDoVendedor.filter((c) => noMes(c.dataCadastro, ano, mes)).length
        const metaSemanal = Number(v.metaSemanal) || 25000
        const metaMensal = Number(v.metaMensal) || 100000
        const bateuSemana = totalSemana >= metaSemanal
        const bateuMes = totalMes >= metaMensal
        return {
          ...v,
          totalSemana,
          totalMes,
          qtdVendasMes,
          ticketMedioMes,
          qtdClientesTotal,
          qtdClientesMes,
          metaSemanal,
          metaMensal,
          bateuSemana,
          bateuMes,
          pctSemana: metaSemanal > 0 ? Math.min(100, (totalSemana / metaSemanal) * 100) : 0,
          pctMes: metaMensal > 0 ? Math.min(100, (totalMes / metaMensal) * 100) : 0
        }
      })
      .sort((a, b) => b.totalMes - a.totalMes)
  }, [vendedores, vendas, clientes, mes, ano])

  // --- KPIs do mês selecionado ---
  const totalVendidoMes = dadosVendedores.reduce((s, v) => s + v.totalMes, 0)
  const metaEquipe = dadosVendedores.reduce((s, v) => s + v.metaMensal, 0)
  const pctEquipe = metaEquipe > 0 ? (totalVendidoMes / metaEquipe) * 100 : 0
  const orcamentosMes = (orcamentos || []).filter((o) => noMes(o.data, ano, mes))
  const totalOrcamentosMes = orcamentosMes.reduce((s, o) => s + Number(o.valor || 0), 0)
  const qtdOrcamentosMes = orcamentosMes.length
  const clientesNovosMes = (clientes || []).filter((c) => noMes(c.dataCadastro, ano, mes)).length
  const totalClientes = (clientes || []).length

  // Ranking de clientes cadastrados (novos no mês primeiro, desempate pelo total)
  const rankingClientes = useMemo(() => {
    return [...dadosVendedores].sort(
      (a, b) => b.qtdClientesMes - a.qtdClientesMes || b.qtdClientesTotal - a.qtdClientesTotal
    )
  }, [dadosVendedores])

  // Orçamentos (todos), filtráveis por cliente
  const orcamentosFiltrados = useMemo(() => {
    const lista = orcamentos || []
    if (!filtroCliente) return lista
    return lista.filter((o) => o.clienteId === filtroCliente)
  }, [orcamentos, filtroCliente])

  return (
    <div className="painel-gerente">
      <div className="section-head">
        <h2>👑 Painel do Gerente</h2>
        <div className="head-direita">
          <div className="refresh-controles">
            <button
              className="btn-secondary"
              onClick={carregarDados}
              disabled={carregando}
            >
              {carregando ? 'Atualizando...' : '🔄 Atualizar'}
            </button>
            <label className="auto-refresh-label" title="Atualizar automaticamente a cada 30s">
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
              />
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
        </div>
        <div className="kpi-card">
          <span className="kpi-rotulo">Clientes cadastrados</span>
          <div className="kpi-valor">{clientesNovosMes}</div>
          <div className="kpi-sub">novos em {MESES[mes - 1]} · {totalClientes} no total</div>
        </div>
        <div className="kpi-card">
          <span className="kpi-rotulo">Orçamentos não faturados</span>
          <div className="kpi-valor">{fmtValor(totalOrcamentosMes)}</div>
          <div className="kpi-sub">{qtdOrcamentosMes} orçamento(s) no mês</div>
        </div>
        <div className="kpi-card">
          <span className="kpi-rotulo">Vendedores na meta</span>
          <div className="kpi-valor">{dadosVendedores.filter((v) => v.bateuMes).length} / {dadosVendedores.length}</div>
          <div className="kpi-sub">batendo a meta no mês selecionado</div>
        </div>
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

      {/* Orçamentos não faturados de todos os vendedores */}
      <h3 className="top-titulo">📉 Orçamentos Não Faturados (todos os vendedores)</h3>
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
                <th>Produtos</th>
                <th>Valor</th>
                <th>Concorrente</th>
                <th>Motivo</th>
                <th>Observação</th>
                <th>Data</th>
              </tr>
            </thead>
            <tbody>
              {orcamentosFiltrados
                .sort((a, b) => String(b.data || '').localeCompare(String(a.data || '')))
                .map((o) => {
                  const cli = clientePorId(o.clienteId)
                  const vend = vendedores.find((v) => v.id === o.vendedorId)
                  return (
                    <tr key={o.id}>
                      <td>{cli ? `#${cli.codigo} ${cli.nome}` : '(cliente removido)'}</td>
                      <td>{vend ? vend.nome : '-'}</td>
                      <td>{o.produtos}</td>
                      <td>{fmtValor(o.valor)}</td>
                      <td>{o.concorrente}</td>
                      <td>{o.motivo}</td>
                      <td className="obs-cell">{o.observacao || '-'}</td>
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