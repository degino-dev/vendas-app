import { useEffect, useMemo, useState } from 'react'
import { fmtValor, fmtPct, MESES_NOME as MESES, parseData, semanaAtualRange } from '../utils/format'
import { valorFreteDe, valorPedido } from '../utils/financeiro'
const MULT = { mes: 1, trimestre: 3, ano: 12 }
// ===== Calcula o período anterior equivalente (para variação) =====
function periodoAnterior(tipoPeriodo, mes, trimestre, ano) {
  if (tipoPeriodo === 'mes') {
    if (mes === 1) return { tipoPeriodo, mes: 12, trimestre, ano: ano - 1 }
    return { tipoPeriodo, mes: mes - 1, trimestre, ano }
  }
  if (tipoPeriodo === 'trimestre') {
    if (trimestre === 1) return { tipoPeriodo, mes, trimestre: 4, ano: ano - 1 }
    return { tipoPeriodo, mes, trimestre: trimestre - 1, ano }
  }
  return { tipoPeriodo, mes, trimestre, ano: ano - 1 }
}
// ===== NOVO: limite de comparação justa =====
// Quando o período selecionado é o ATUAL (ainda em andamento, ex.: ano de 2026 em agosto),
// corta as vendas de HOJE para trás nos DOIS períodos, comparando o mesmo recorte.
// Ex.: jan–ago/2026 vs jan–ago/2025 (em vez de 8 meses vs 12 meses).
function limiteComparacao(tipoPeriodo, mes, trimestre, ano) {
  const hoje = new Date()
  const anoAtual = hoje.getFullYear()
  const mesAtual = hoje.getMonth() + 1
  const trimAtual = Math.floor((mesAtual - 1) / 3) + 1
  let ehAtual = false
  if (tipoPeriodo === 'mes') ehAtual = ano === anoAtual && mes === mesAtual
  else if (tipoPeriodo === 'trimestre') ehAtual = ano === anoAtual && trimestre === trimAtual
  else ehAtual = ano === anoAtual
  if (!ehAtual) return null
  return new Date(anoAtual, mesAtual - 1, hoje.getDate(), 23, 59, 59)
}
// ===== ALTERADO: aceita o parâmetro "limite" (corte da data de hoje) =====
function vendaNoPeriodo(v, tipoPeriodo, mes, trimestre, ano, limite) {
  const m = parseData(v.data)
  if (!m) return false
  if (limite && m > limite) return false
  const vAno = m.getFullYear()
  const vMes = m.getMonth() + 1
  if (tipoPeriodo === 'mes') return vAno === ano && vMes === mes
  if (tipoPeriodo === 'trimestre') {
    const vTri = Math.floor((vMes - 1) / 3) + 1
    return vAno === ano && vTri === trimestre
  }
  return vAno === ano
}
function Dashboard({ usuario }) {
  const [vendas, setVendas] = useState([])
  const [clientes, setClientes] = useState([])
  const [orcamentos, setOrcamentos] = useState([])
  const [carregando, setCarregando] = useState(true)
  const [tipoPeriodo, setTipoPeriodo] = useState('mes')
  const [mes, setMes] = useState(() => new Date().getMonth() + 1)
  const [trimestre, setTrimestre] = useState(() => Math.floor(new Date().getMonth() / 3) + 1)
  const [ano, setAno] = useState(() => new Date().getFullYear())
  const [tipoMeta, setTipoMeta] = useState('semanal')
  const META_MENSAL = Number(usuario.metaMensal) || 100000
  const META_SEMANAL = Number(usuario.metaSemanal) || 25000
  useEffect(() => {
    const vendedorId = usuario.admin ? null : usuario.id
    let ativo = true
    setCarregando(true)
    Promise.all([
      window.api.listarVendas(vendedorId),
      window.api.listarClientes(vendedorId),
      window.api.listarOrcamentos(vendedorId)
    ])
      .then(([v, c, o]) => {
        if (!ativo) return
        setVendas(v)
        setClientes(c)
        setOrcamentos(o)
      })
      .catch(() => {})
      .finally(() => {
        if (ativo) setCarregando(false)
      })
    return () => { ativo = false }
  }, [usuario])
  const clientePorId = (id) => clientes.find((c) => c.id === id)
  const limite = limiteComparacao(tipoPeriodo, mes, trimestre, ano)
  const vendasFiltradas = useMemo(() => {
    return vendas.filter((v) => vendaNoPeriodo(v, tipoPeriodo, mes, trimestre, ano, limite))
  }, [vendas, tipoPeriodo, mes, trimestre, ano, limite])
  const vendasAnteriores = useMemo(() => {
    const ant = periodoAnterior(tipoPeriodo, mes, trimestre, ano)
    return vendas.filter((v) => vendaNoPeriodo(v, ant.tipoPeriodo, ant.mes, ant.trimestre, ant.ano, limite))
  }, [vendas, tipoPeriodo, mes, trimestre, ano, limite])
  const vendasSemana = useMemo(() => {
    const { inicio, fim } = semanaAtualRange()
    return vendas.filter((v) => {
      const data = parseData(v.data)
      return data && data >= inicio && data <= fim
    })
  }, [vendas])
  // ===== ALTERADO: frete NÃO entra em insumos/equipamentos/total =====
  // O frete é somado apenas no campo "freteTotal". Total = insumos + equipamentos (sem frete).
  const totais = useMemo(() => {
    let insumos = 0, equipamentos = 0, pedInsumos = 0, pedEquipamentos = 0, freteTotal = 0
    for (const v of vendasFiltradas) {
      const vi = Number(v.valorInsumos || 0)
      const ve = Number(v.valorEquipamento || 0)
      insumos += vi
      equipamentos += ve
      freteTotal += valorFreteDe(v)
      if (vi > 0) pedInsumos++
      if (ve > 0) pedEquipamentos++
    }
    return { insumos, equipamentos, total: insumos + equipamentos, pedInsumos, pedEquipamentos, freteTotal, numVendas: vendasFiltradas.length }
  }, [vendasFiltradas])
  const totalAnterior = useMemo(() => {
    return vendasAnteriores.reduce((soma, v) => soma + valorPedido(v), 0)
  }, [vendasAnteriores])
  const totalSemana = useMemo(() => {
    return vendasSemana.reduce((soma, v) => soma + valorPedido(v), 0)
  }, [vendasSemana])
  // ===== ALTERADO: ranking sem frete (insumos + equipamentos) =====
  const ranking = useMemo(() => {
    const mapa = {}
    for (const v of vendasFiltradas) {
      if (!mapa[v.clienteId]) {
        mapa[v.clienteId] = { clienteId: v.clienteId, insumos: 0, equipamentos: 0, total: 0 }
      }
      const vi = Number(v.valorInsumos || 0)
      const ve = Number(v.valorEquipamento || 0)
      mapa[v.clienteId].insumos += vi
      mapa[v.clienteId].equipamentos += ve
      mapa[v.clienteId].total += vi + ve
    }
    return Object.values(mapa).sort((a, b) => b.total - a.total).slice(0, 20)
  }, [vendasFiltradas])
  const orcamentosAguardando = useMemo(() => {
    const lista = (orcamentos || []).filter((o) => o.status === 'aguardando')
    const valor = lista.reduce((soma, o) => soma + valorPedido(o), 0)
    return { qtd: lista.length, valor }
  }, [orcamentos])
  const vendasPorMes = useMemo(() => {
    const arr = Array(12).fill(0)
    for (const v of vendas) {
      const m = parseData(v.data)
      if (m && m.getFullYear() === ano) {
        arr[m.getMonth()] += valorPedido(v)
      }
    }
    const max = Math.max(...arr, 1)
    return arr.map((val, i) => ({ mes: MESES[i], valor: val, pct: (val / max) * 100 }))
  }, [vendas, ano])
  const metaAtual = tipoMeta === 'semanal' ? META_SEMANAL : META_MENSAL
  const valorAtual = tipoMeta === 'semanal' ? totalSemana : totais.total
  const metaAlvo =
    tipoMeta === 'semanal'
      ? META_SEMANAL
      : META_MENSAL * (tipoPeriodo === 'mes' ? 1 : tipoPeriodo === 'trimestre' ? 3 : 12)
  const pctMeta = metaAlvo > 0 ? Math.min(100, (valorAtual / metaAlvo) * 100) : 0
  const pctMetaReal = metaAlvo > 0 ? (valorAtual / metaAlvo) * 100 : 0
  const ticketMedio = totais.numVendas > 0 ? totais.total / totais.numVendas : 0
  const variacao = totalAnterior > 0 ? ((totais.total - totalAnterior) / totalAnterior) * 100 : null
  const rotuloPeriodo = () => {
    if (tipoPeriodo === 'mes') return `${MESES[mes - 1]} de ${ano}`
    if (tipoPeriodo === 'trimestre') return `${ano} — ${['Q1', 'Q2', 'Q3', 'Q4'][trimestre - 1]}`
    return `Ano de ${ano}`
  }
  const rotuloMeta = () => {
    if (tipoMeta === 'semanal') {
      const { inicio, fim } = semanaAtualRange()
      return `Semana de ${inicio.getDate()}/${inicio.getMonth() + 1} a ${fim.getDate()}/${fim.getMonth() + 1}`
    }
    return rotuloPeriodo()
  }
  if (carregando) {
    return (
      <div className="dashboard">
        <div className="section-head"><h2>Análise</h2></div>
        <p className="empty">Carregando dados...</p>
      </div>
    )
  }
  return (
    <div className="dashboard">
      <div className="section-head">
        <h2>Análise</h2>
      </div>
      <div className="filtros">
        <label>
          Período
          <select value={tipoPeriodo} onChange={(e) => setTipoPeriodo(e.target.value)}>
            <option value="mes">Mês</option>
            <option value="trimestre">Trimestre</option>
            <option value="ano">Anual</option>
          </select>
        </label>
        {tipoPeriodo === 'mes' && (
          <label>
            Mês
            <select value={mes} onChange={(e) => setMes(Number(e.target.value))}>
              {MESES.map((m, i) => (
                <option key={i} value={i + 1}>{m}</option>
              ))}
            </select>
          </label>
        )}
        {tipoPeriodo === 'trimestre' && (
          <label>
            Trimestre
            <select value={trimestre} onChange={(e) => setTrimestre(Number(e.target.value))}>
              <option value={1}>Q1 (Jan–Mar)</option>
              <option value={2}>Q2 (Abr–Jun)</option>
              <option value={3}>Q3 (Jul–Set)</option>
              <option value={4}>Q4 (Out–Dez)</option>
            </select>
          </label>
        )}
        <label>
          Ano
          <select value={ano} onChange={(e) => setAno(Number(e.target.value))}>
            {Array.from({ length: 6 }, (_, i) => new Date().getFullYear() - 4 + i).map((a) => (
              <option key={a} value={a}>{a}</option>
            ))}
          </select>
        </label>
        <div className="meta-box" title="Meta de vendas: Semanal usa a meta da semana atual; Mensal usa a meta do período selecionado (mês, trimestre ou ano). O frete NÃO entra no cálculo da meta.">
          <div className="meta-top">
            <span className="meta-label">Meta</span>
            <div className="meta-toggle">
              <button
                type="button"
                className={'meta-toggle-btn ' + (tipoMeta === 'semanal' ? 'ativo' : '')}
                onClick={() => setTipoMeta('semanal')}
              >
                Semanal
              </button>
              <button
                type="button"
                className={'meta-toggle-btn ' + (tipoMeta === 'mensal' ? 'ativo' : '')}
                onClick={() => setTipoMeta('mensal')}
              >
                Mensal
              </button>
            </div>
          </div>
          <div className="meta-valor-linha">
            <span className="meta-valor">{fmtValor(metaAtual)}</span>
            <span className="meta-periodo">{rotuloMeta()}</span>
          </div>
          <div className="meta-bar">
            <div className={`meta-fill ${pctMeta >= 100 ? 'ok' : pctMeta >= 50 ? 'meio' : 'baixo'}`} style={{ width: `${pctMeta}%` }}></div>
          </div>
          <div className="meta-info">
            <span>{fmtValor(valorAtual)} de {fmtValor(metaAlvo)}</span>
            <strong>{fmtPct(pctMetaReal)}</strong>
          </div>
        </div>
      </div>
      {variacao !== null && (
        <div className={`variacao-linha ${variacao >= 0 ? 'variacao-ok' : 'variacao-ruim'}`} title="Comparação com o período anterior equivalente (mesmo recorte de dias quando o período atual ainda está em andamento). Sem considerar o frete.">
          {variacao >= 0 ? '▲' : '▼'} {fmtPct(Math.abs(variacao))} vs. período anterior
        </div>
      )}
      <div className="kpi-secao">
        <h3 className="kpi-secao-titulo">📊 Vendas</h3>
        <div className="resumo">
          <div className="resumo-card resumo-destaque" title="Soma de insumos + equipamentos das vendas do período (valor do pedido, SEM o frete). É a base da meta.">
            <span className="resumo-label">Vendas Totais (Ped.)</span>
            <strong>{fmtValor(totais.total)}</strong>
          </div>
          <div className="resumo-card" title="Soma dos valores de insumos das vendas do período (SEM o frete).">
            <span className="resumo-label">Vendas Insumos</span>
            <strong>{fmtValor(totais.insumos)}</strong>
          </div>
          <div className="resumo-card" title="Soma dos valores de equipamentos das vendas do período (SEM o frete).">
            <span className="resumo-label">Vendas Equipamentos</span>
            <strong>{fmtValor(totais.equipamentos)}</strong>
          </div>
          <div className="resumo-card" title="Quantidade de vendas registradas no período selecionado.">
            <span className="resumo-label">Nº de Vendas</span>
            <strong>{totais.numVendas}</strong>
          </div>
          <div className="resumo-card" title="Total vendido ÷ nº de vendas. Valor médio por venda no período (sem frete).">
            <span className="resumo-label">Ticket Médio</span>
            <strong>{fmtValor(ticketMedio)}</strong>
          </div>
          <div className="resumo-card" title="Soma de todo o frete cobrado nas vendas do período. O frete NÃO entra na meta nem nas vendas de insumos/equipamentos.">
            <span className="resumo-label">Frete Total</span>
            <strong>{fmtValor(totais.freteTotal)}</strong>
          </div>
        </div>
      </div>
      <div className="kpi-secao">
        <h3 className="kpi-secao-titulo">📁 Carteira & Pipeline</h3>
        <div className="resumo">
          <div className="resumo-card" title="Total de clientes na sua carteira (não depende do período selecionado).">
            <span className="resumo-label">Clientes na Carteira</span>
            <strong>{clientes.length}</strong>
          </div>
          <div className="resumo-card" title="Orçamentos com status 'aguardando' e o valor total deles (soma dos pedidos).">
            <span className="resumo-label">Orç. Aguardando</span>
            <strong>{orcamentosAguardando.qtd}</strong>
            <span className="resumo-data">{fmtValor(orcamentosAguardando.valor)}</span>
          </div>
        </div>
      </div>
      <h3 className="top-titulo">📈 Vendas por Mês — {ano}</h3>
      <div className="grafico-mensal">
        {vendasPorMes.map((item, i) => (
          <div className="grafico-coluna" key={i} title={`${item.mes}: ${fmtValor(item.valor)}`}>
            <span className="grafico-valor">{item.valor > 0 ? fmtValor(item.valor) : ''}</span>
            <div className="grafico-barra" style={{ height: `${Math.max(item.pct, 2)}%` }}></div>
            <span className="grafico-mes">{item.mes.slice(0, 3)}</span>
          </div>
        ))}
      </div>
      <h3 className="top-titulo">🏆 Top 20 Clientes — {rotuloPeriodo()}</h3>
      {ranking.length === 0 ? (
        <p className="empty">Nenhuma venda neste período.</p>
      ) : (
        <div className="tabela-wrap">
          <table className="tabela">
            <thead>
              <tr>
                <th>#</th>
                <th>Nome</th>
                <th title="Total vendido pelo cliente no período (insumos + equipamentos, sem frete).">Total (Ped.)</th>
                <th title="Participação do cliente no total vendido do período (Total do cliente ÷ Total geral).">% Venda</th>
                <th>Cidade</th>
              </tr>
            </thead>
            <tbody>
              {ranking.map((r, i) => {
                const cli = clientePorId(r.clienteId)
                const pct = totais.total > 0 ? (r.total / totais.total) * 100 : 0
                return (
                  <tr key={r.clienteId || 'sem-cliente-' + i}>
                    <td className="rank">{i + 1}</td>
                    <td>{cli ? cli.nome : '(cliente removido)'}</td>
                    <td className="valor-meta">{fmtValor(r.total)}</td>
                    <td className="rank-valor">{fmtPct(pct)}</td>
                    <td>{cli ? cli.cidade : '—'}</td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot>
              <tr className="tfoot">
                <td colSpan={2}><strong>Total Geral</strong></td>
                <td><strong>{fmtValor(totais.total)}</strong></td>
                <td><strong>{fmtPct(100)}</strong></td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  )
}
export default Dashboard