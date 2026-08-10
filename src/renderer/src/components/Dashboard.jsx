import { useEffect, useMemo, useState } from 'react'

const MESES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
]
const MULT = { mes: 1, trimestre: 3, ano: 12 }

// Converte "YYYY-MM-DD" em Date local (evita erro de fuso do new Date('YYYY-MM-DD'))
function parseData(d) {
  if (!d) return null
  const m = String(d).match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (!m) return null
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
}

// Calcula o início (segunda) e fim (domingo) da semana atual
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

function Dashboard({ usuario }) {
  const [vendas, setVendas] = useState([])
  const [clientes, setClientes] = useState([])
  const [tipoPeriodo, setTipoPeriodo] = useState('mes')
  const [mes, setMes] = useState(() => new Date().getMonth() + 1)
  const [trimestre, setTrimestre] = useState(() => Math.floor(new Date().getMonth() / 3) + 1)
  const [ano, setAno] = useState(() => new Date().getFullYear())
  const [tipoMeta, setTipoMeta] = useState('mensal')

  // Metas do vendedor logado (definidas pelo admin)
  const META_MENSAL = Number(usuario.metaMensal) || 100000
  const META_SEMANAL = Number(usuario.metaSemanal) || 25000

  useEffect(() => {
    const vendedorId = usuario.admin ? null : usuario.id
    window.api.listarVendas(vendedorId).then(setVendas)
    window.api.listarClientes(vendedorId).then(setClientes)
  }, [usuario])

  const clientePorId = (id) => clientes.find((c) => c.id === id)

  // Filtra as vendas pelo período selecionado
  const vendasFiltradas = useMemo(() => {
    return vendas.filter((v) => {
      const m = parseData(v.data)
      if (!m) return false
      const vAno = m.getFullYear()
      const vMes = m.getMonth() + 1
      if (tipoPeriodo === 'mes') return vAno === ano && vMes === mes
      if (tipoPeriodo === 'trimestre') {
        const vTri = Math.floor((vMes - 1) / 3) + 1
        return vAno === ano && vTri === trimestre
      }
      return vAno === ano
    })
  }, [vendas, tipoPeriodo, mes, trimestre, ano])

  // Vendas da semana atual
  const vendasSemana = useMemo(() => {
    const { inicio, fim } = semanaAtualRange()
    return vendas.filter((v) => {
      const data = parseData(v.data)
      return data && data >= inicio && data <= fim
    })
  }, [vendas])

  // Totais do período selecionado
  const totais = useMemo(() => {
    let insumos = 0
    let equipamentos = 0
    let pedInsumos = 0
    let pedEquipamentos = 0
    for (const v of vendasFiltradas) {
      const vi = Number(v.valorInsumos || 0)
      const ve = Number(v.valorEquipamento || 0)
      insumos += vi
      equipamentos += ve
      if (vi > 0) pedInsumos++
      if (ve > 0) pedEquipamentos++
    }
    return { insumos, equipamentos, total: insumos + equipamentos, pedInsumos, pedEquipamentos }
  }, [vendasFiltradas])

  // Total da semana atual
  const totalSemana = useMemo(() => {
    return vendasSemana.reduce(
      (soma, v) => soma + Number(v.valorInsumos || 0) + Number(v.valorEquipamento || 0),
      0
    )
  }, [vendasSemana])

  // Top 20 clientes do período
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
    return Object.values(mapa)
      .sort((a, b) => b.total - a.total)
      .slice(0, 20)
  }, [vendasFiltradas])

  // Define meta e valores conforme o tipo selecionado
  const metaAtual = tipoMeta === 'semanal' ? META_SEMANAL : META_MENSAL
  const valorAtual = tipoMeta === 'semanal' ? totalSemana : totais.total
  const metaAlvo =
    tipoMeta === 'semanal'
      ? META_SEMANAL
      : META_MENSAL * (tipoPeriodo === 'mes' ? 1 : tipoPeriodo === 'trimestre' ? 3 : 12)
  const pctMeta = metaAlvo > 0 ? Math.min(100, (valorAtual / metaAlvo) * 100) : 0
  const pctMetaReal = metaAlvo > 0 ? (valorAtual / metaAlvo) * 100 : 0

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

  return (
    <div className="dashboard">
      <div className="section-head">
        <h2>Dashboard</h2>
      </div>

      {/* Filtros + Meta */}
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

        {/* Meta: alterna entre semanal e mensal */}
        <div className="meta-box">
          <div className="meta-top">
            <span className="meta-label">Meta</span>
            <select
              className="meta-select"
              value={tipoMeta}
              onChange={(e) => setTipoMeta(e.target.value)}
            >
              <option value="semanal">Semanal</option>
              <option value="mensal">Mensal</option>
            </select>
          </div>
          <div className="meta-valor-linha">
            <span className="meta-valor">{fmtValor(metaAtual)}</span>
            <span className="meta-periodo">{rotuloMeta()}</span>
          </div>
          <div className="meta-bar">
            <div
              className={`meta-fill ${pctMeta >= 100 ? 'ok' : pctMeta >= 50 ? 'meio' : 'baixo'}`}
              style={{ width: `${pctMeta}%` }}
            ></div>
          </div>
          <div className="meta-info">
            <span>{fmtValor(valorAtual)} de {fmtValor(metaAlvo)}</span>
            <strong>{fmtPct(pctMetaReal)}</strong>
          </div>
        </div>
      </div>

      {/* KPIs do período */}
      <div className="resumo">
        <div className="resumo-card">
          <span className="resumo-label">Período</span>
          <strong className="resumo-data">{rotuloPeriodo()}</strong>
        </div>
        <div className="resumo-card">
          <span className="resumo-label">Vendas Totais</span>
          <strong>{fmtValor(totais.total)}</strong>
        </div>
        <div className="resumo-card">
          <span className="resumo-label">Vendas Insumos</span>
          <strong>{fmtValor(totais.insumos)}</strong>
        </div>
        <div className="resumo-card">
          <span className="resumo-label">Vendas Equipamentos</span>
          <strong>{fmtValor(totais.equipamentos)}</strong>
        </div>
        <div className="resumo-card">
          <span className="resumo-label">Pedidos Insumos</span>
          <strong>{totais.pedInsumos}</strong>
        </div>
        <div className="resumo-card">
          <span className="resumo-label">Pedidos Equipamentos</span>
          <strong>{totais.pedEquipamentos}</strong>
        </div>
      </div>

      {/* Top 20 */}
      <h3 className="top-titulo">🏆 Top 20 Clientes — {rotuloPeriodo()}</h3>
      {ranking.length === 0 ? (
        <p className="empty">Nenhuma venda neste período.</p>
      ) : (
        <div className="tabela-wrap">
          <table className="tabela">
            <thead>
              <tr>
                <th>SKU</th>
                <th>Nome</th>
                <th>Valores Insumos</th>
                <th>Valores Equipamentos</th>
                <th>% Venda</th>
                <th>Cidade</th>
              </tr>
            </thead>
            <tbody>
              {ranking.map((r, i) => {
                const cli = clientePorId(r.clienteId)
                const pct = totais.total > 0 ? (r.total / totais.total) * 100 : 0
                return (
                  <tr key={r.clienteId || 'sem-cliente-' + i}>
                    <td className="rank">{cli ? cli.codigo : '-'}</td>
                    <td>{cli ? cli.nome : '(cliente removido)'}</td>
                    <td>{fmtValor(r.insumos)}</td>
                    <td>{fmtValor(r.equipamentos)}</td>
                    <td className="rank-valor">{fmtPct(pct)}</td>
                    <td>{cli ? cli.cidade : '—'}</td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot>
              <tr className="tfoot">
                <td colSpan={2}><strong>Total Geral</strong></td>
                <td><strong>{fmtValor(totais.insumos)}</strong></td>
                <td><strong>{fmtValor(totais.equipamentos)}</strong></td>
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