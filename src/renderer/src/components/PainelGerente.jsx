import { useEffect, useMemo, useState } from 'react'

const MESES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
]

function PainelGerente() {
  const [vendedores, setVendedores] = useState([])
  const [vendas, setVendas] = useState([])
  const [clientes, setClientes] = useState([])
  const [orcamentos, setOrcamentos] = useState([])
  const [filtroCliente, setFiltroCliente] = useState('')

  const hoje = new Date()
  const [mes, setMes] = useState(hoje.getMonth() + 1)
  const [ano, setAno] = useState(hoje.getFullYear())

  useEffect(() => {
    window.api.listarVendedores().then(setVendedores)
    window.api.listarVendas().then(setVendas)
    window.api.listarClientes().then(setClientes)
    window.api.listarOrcamentos().then(setOrcamentos)
  }, [])

  const clientePorId = (id) => clientes.find((c) => c.id === id)

  // Calcula início/fim da semana atual (segunda a domingo)
  const semanaAtual = useMemo(() => {
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
  }, [])

  // Dados por vendedor
  const dadosVendedores = useMemo(() => {
    return vendedores.map((v) => {
      const vendasDoVendedor = vendas.filter((x) => x.vendedorId === v.id)

      // Semana atual
      const vendasSemana = vendasDoVendedor.filter((x) => {
        const data = new Date(x.data)
        return data >= semanaAtual.inicio && data <= semanaAtual.fim
      })
      const totalSemana = vendasSemana.reduce(
        (s, x) => s + Number(x.valorInsumos || 0) + Number(x.valorEquipamento || 0),
        0
      )

      // Mês selecionado
      const vendasMes = vendasDoVendedor.filter((x) => {
        const [xA, xM] = x.data.split('-').map(Number)
        return xA === ano && xM === mes
      })
      const totalMes = vendasMes.reduce(
        (s, x) => s + Number(x.valorInsumos || 0) + Number(x.valorEquipamento || 0),
        0
      )

      const metaSemanal = Number(v.metaSemanal) || 25000
      const metaMensal = Number(v.metaMensal) || 100000

      const bateuSemana = totalSemana >= metaSemanal
      const bateuMes = totalMes >= metaMensal

      return {
        ...v,
        totalSemana,
        totalMes,
        metaSemanal,
        metaMensal,
        bateuSemana,
        bateuMes,
        pctSemana: metaSemanal > 0 ? Math.min(100, (totalSemana / metaSemanal) * 100) : 0,
        pctMes: metaMensal > 0 ? Math.min(100, (totalMes / metaMensal) * 100) : 0
      }
    })
  }, [vendedores, vendas, semanaAtual, mes, ano])

  // Orçamentos perdidos (todos), filtráveis por cliente
  const orcamentosFiltrados = useMemo(() => {
    if (!filtroCliente) return orcamentos
    return orcamentos.filter((o) => o.clienteId === filtroCliente)
  }, [orcamentos, filtroCliente])

  const fmtValor = (v) =>
    Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

  const fmtPct = (p) => `${p.toFixed(1).replace('.', ',')}%`

  const fmtData = (d) => {
    if (!d) return ''
    const [a, m, dia] = d.split('-')
    return `${dia}/${m}/${a}`
  }

  return (
    <div className="painel-gerente">
      <div className="section-head">
        <h2>👑 Painel do Gerente</h2>
        <div className="head-direita">
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
              {Array.from({ length: 6 }, (_, i) => hoje.getFullYear() - 4 + i).map((a) => (
                <option key={a} value={a}>{a}</option>
              ))}
            </select>
          </label>
        </div>
      </div>

      {/* Ranking de vendedores */}
      <h3 className="top-titulo">📊 Desempenho dos Vendedores — {MESES[mes - 1]} de {ano}</h3>

      {dadosVendedores.length === 0 ? (
        <p className="empty">Nenhum vendedor cadastrado.</p>
      ) : (
        <div className="tabela-wrap">
          <table className="tabela">
            <thead>
              <tr>
                <th>Vendedor</th>
                <th>Vendas Semana</th>
                <th>% Semana</th>
                <th>Vendas Mês</th>
                <th>% Mês</th>
                <th>Medalhas</th>
              </tr>
            </thead>
            <tbody>
              {dadosVendedores.map((v) => (
                <tr key={v.id}>
                  <td><strong>{v.nome}</strong> {v.admin ? '👑' : ''}</td>
                  <td>
                    <div className="mini-progress">
                      <div className="mini-bar">
                        <div
                          className="mini-fill"
                          style={{ width: `${v.pctSemana}%` }}
                        ></div>
                      </div>
                      <span>{fmtValor(v.totalSemana)} / {fmtValor(v.metaSemanal)}</span>
                    </div>
                  </td>
                  <td className="rank-valor">{fmtPct(v.pctSemana)}</td>
                  <td>
                    <div className="mini-progress">
                      <div className="mini-bar">
                        <div
                          className="mini-fill"
                          style={{ width: `${v.pctMes}%` }}
                        ></div>
                      </div>
                      <span>{fmtValor(v.totalMes)} / {fmtValor(v.metaMensal)}</span>
                    </div>
                  </td>
                  <td className="rank-valor">{fmtPct(v.pctMes)}</td>
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

      {/* Orçamentos perdidos de todos os vendedores */}
      <h3 className="top-titulo">📉 Orçamentos Perdidos (todos os vendedores)</h3>

      <div className="filtro-orcamento">
        <label>
          Filtrar por cliente
          <select value={filtroCliente} onChange={(e) => setFiltroCliente(e.target.value)}>
            <option value="">Todos os clientes</option>
            {[...clientes].sort((a, b) => a.codigo - b.codigo).map((c) => (
              <option key={c.id} value={c.id}>#{c.codigo} — {c.nome}</option>
            ))}
          </select>
        </label>
      </div>

      {orcamentosFiltrados.length === 0 ? (
        <p className="empty">Nenhum orçamento perdido registrado.</p>
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
                <th>Data</th>
              </tr>
            </thead>
            <tbody>
              {orcamentosFiltrados
                .sort((a, b) => b.data.localeCompare(a.data))
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