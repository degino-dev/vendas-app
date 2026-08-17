import { useEffect, useMemo, useState } from 'react'
import { fmtValor, fmtData, parseData, semanaAtualRange } from '../utils/format'
import { valorPedido } from '../utils/financeiro'
import RotinaLaboratorio from './RotinaLaboratorio'
const DIAS_SEMANA = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado']
// ===== Faixa de ciclo de compra "saudável" (clientes com recorrência previsível) =====
const CICLO_REC_MIN = 30
const CICLO_REC_MAX = 50
// ===== NOVO: cliente só é considerado ATIVO se não passou de 1,5x o ciclo sem comprar =====
const ATIVO_LIMITE = 1.5
// ===== NOVO: janela do Foco do dia (próxima compra prevista ±7 dias de hoje) =====
const FOCO_JANELA_DIAS = 7
function saudacao(h) {
  if (h < 12) return 'Bom dia'
  if (h < 18) return 'Boa tarde'
  return 'Boa noite'
}
function dataISO(d) {
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0')
}
function parseISO(s) {
  if (!s) return null
  const [a, m, d] = String(s).split('-').map(Number)
  if (!a || !m || !d) return null
  return new Date(a, m - 1, d)
}
const STATUS_ORC = {
  aguardando: { label: '⏳ Aguardando', classe: 'status-aguardando' },
  aprovado: { label: '✅ Aprovado', classe: 'status-aprovado' },
  recusado: { label: '❌ Recusado', classe: 'status-recusado' }
}
const estiloHome = `
  .home-saudacao { padding: 4px 0 12px; }
  .home-saudacao h2 { margin: 0 0 4px; font-size: 22px; }
  .home-saudacao p { margin: 0; color: #64748b; font-size: 14px; }
  .home-meta-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 12px; margin: 16px 0; }
  .home-meta-card { background: #fff; border: 1px solid #e2e8f0; border-radius: 10px; padding: 14px 16px; box-shadow: 0 1px 2px rgba(0,0,0,0.04); }
  .home-meta-rotulo { font-size: 12px; color: #64748b; font-weight: 600; text-transform: uppercase; letter-spacing: 0.4px; }
  .home-meta-valor { font-size: 20px; font-weight: 700; margin: 4px 0 8px; color: #0f172a; }
  .home-meta-bar { height: 6px; background: #e2e8f0; border-radius: 999px; overflow: hidden; }
  .home-meta-fill { height: 100%; background: #2563eb; border-radius: 999px; transition: width 0.3s; }
  .home-meta-fill.ok { background: #16a34a; }
  .home-meta-sub { font-size: 12px; color: #64748b; margin-top: 6px; }
  /* ===== seções colapsáveis (acordeão) ===== */
  .home-secao { background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; margin-bottom: 14px; overflow: hidden; box-shadow: 0 1px 2px rgba(0,0,0,0.04); }
  .home-secao-cabecalho { display: flex; align-items: center; gap: 10px; width: 100%; background: transparent; border: none; padding: 14px 16px; cursor: pointer; font: inherit; text-align: left; transition: background 0.15s; }
  .home-secao-cabecalho:hover { background: #f8fafc; }
  .home-secao-seta { color: #64748b; font-size: 13px; }
  .home-secao-titulo { font-size: 15px; font-weight: 700; color: #0f172a; flex: 1; }
  .home-secao-contador { background: #e2e8f0; color: #475569; font-size: 12px; font-weight: 600; padding: 2px 10px; border-radius: 999px; }
  .home-secao-botao { font-size: 12px; color: #2563eb; font-weight: 600; white-space: nowrap; }
  .home-secao-conteudo { padding: 0 16px 14px; }
  /* ===== linhas clicáveis ===== */
  .home-clicavel { cursor: pointer; transition: background 0.15s; }
  .home-clicavel:hover { background: #f1f5f9; }
  .home-seta-detalhe { color: #94a3b8; font-size: 11px; margin-left: 6px; }
  /* ===== modal de detalhe do cliente ===== */
  .home-modal { width: min(760px, 94vw); max-height: 86vh; overflow-y: auto; }
  .home-modal-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 10px; }
  .home-modal-head h3 { margin: 0; font-size: 18px; }
  .home-chip { background: #eef2ff; color: #3730a3; font-size: 12px; font-weight: 600; padding: 3px 10px; border-radius: 999px; }
  .home-modal-contato { display: flex; flex-wrap: wrap; gap: 8px; margin: 12px 0; }
  .home-modal-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 10px; margin: 12px 0; }
  .home-detalhe-stat { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 10px 12px; }
  .home-detalhe-rotulo { font-size: 11px; color: #64748b; font-weight: 600; text-transform: uppercase; letter-spacing: 0.3px; }
  .home-detalhe-valor { font-size: 16px; font-weight: 700; color: #0f172a; margin-top: 2px; }
  .home-detalhe-badge { display: inline-block; font-size: 11px; padding: 3px 10px; border-radius: 999px; font-weight: 700; }
  .home-badge-hoje { background: #dcfce7; color: #166534; }
  .home-badge-atraso { background: #fef3c7; color: #92400e; }
  .home-badge-urgente { background: #fee2e2; color: #b91c1c; }
  .home-badge-info { background: #dbeafe; color: #1e40af; }
  .home-vazio { color: #64748b; font-size: 13px; padding: 8px 0; }
  /* ===== margem para o bloco de rotina dentro do modal ===== */
  .rl-margem { margin: 14px 0; }
`
// ===== seção colapsável (mesmo padrão do Painel do Gerente) =====
function SecaoColapsavel({ titulo, aberto, aoAlternar, contador, children }) {
  return (
    <div className="home-secao">
      <button type="button" className="home-secao-cabecalho" onClick={aoAlternar}>
        <span className="home-secao-seta">{aberto ? '▾' : '▸'}</span>
        <span className="home-secao-titulo">{titulo}</span>
        {contador != null && <span className="home-secao-contador">{contador}</span>}
        <span className="home-secao-botao">{aberto ? 'Recolher' : 'Expandir'}</span>
      </button>
      {aberto && <div className="home-secao-conteudo">{children}</div>}
    </div>
  )
}
export default function Home({ usuario }) {
  const [vendas, setVendas] = useState([])
  const [clientes, setClientes] = useState([])
  const [orcamentos, setOrcamentos] = useState([])
  const [carregando, setCarregando] = useState(true)
  // ===== blocos começam minimizados =====
  const [abertoBlocos, setAbertoBlocos] = useState({
    foco: false,
    recorrentes: false,
    diaMes: false,
    diaSemana: false,
    orcamentos: false
  })
  // ===== cliente selecionado para abrir o detalhe na Home =====
  const [clienteDetalhe, setClienteDetalhe] = useState(null)
  // ===== NOVO: itens de notas fiscais do cliente (para o alerta de consumo da rotina) =====
  const [comprasNotas, setComprasNotas] = useState([])
  useEffect(() => {
    const vendedorId = usuario.admin ? null : usuario.id
    Promise.all([
      window.api.listarVendas(vendedorId),
      window.api.listarClientes(vendedorId),
      window.api.listarOrcamentos(vendedorId)
    ])
      .then(([v, c, o]) => {
        setVendas(v || [])
        setClientes(c || [])
        setOrcamentos(o || [])
      })
      .catch((err) => console.error('Erro ao carregar Home:', err))
      .finally(() => setCarregando(false))
  }, [usuario])
  // ===== NOVO: carrega as notas fiscais do cliente quando o detalhe abre =====
  useEffect(() => {
    if (!clienteDetalhe) {
      setComprasNotas([])
      return
    }
    window.api.comprasNotas(clienteDetalhe.id)
      .then((res) => setComprasNotas(res && res.ok ? res.itens : []))
      .catch(() => setComprasNotas([]))
  }, [clienteDetalhe])
  const hoje = new Date()
  const hojeISO = dataISO(hoje)
  const diaMes = hoje.getDate()
  const diaSemana = hoje.getDay()
  const { inicio: inicioSemana, fim: fimSemana } = semanaAtualRange()
  const clientePorId = (id) => (clientes || []).find((c) => c.id === id)
  // ===== Análise de recorrência por cliente (fonte: VENDAS do vendedor) =====
  const analise = useMemo(() => {
    const porCliente = {}
    for (const v of vendas) {
      if (!v.clienteId || !v.data) continue
      if (!porCliente[v.clienteId]) porCliente[v.clienteId] = []
      porCliente[v.clienteId].push(v.data)
    }
    const lista = []
    for (const [clienteId, datas] of Object.entries(porCliente)) {
      const ordenadas = datas
        .map(parseISO)
        .filter(Boolean)
        .map((d) => d.getTime())
        .sort((a, b) => a - b)
      if (ordenadas.length === 0) continue
      const objs = ordenadas.map((t) => new Date(t))
      const mesesComDia = new Set()
      const semanasComDia = new Set()
      for (const d of objs) {
        if (d.getDate() === diaMes) mesesComDia.add(d.getFullYear() + '-' + (d.getMonth() + 1))
        if (d.getDay() === diaSemana) {
          const seg = new Date(d)
          seg.setDate(seg.getDate() - ((d.getDay() + 6) % 7))
          semanasComDia.add(dataISO(seg))
        }
      }
      let intervaloMedio = null
      if (ordenadas.length >= 2) {
        let soma = 0
        for (let i = 1; i < ordenadas.length; i++) soma += (ordenadas[i] - ordenadas[i - 1]) / 86400000
        intervaloMedio = soma / (ordenadas.length - 1)
      }
      const ultima = ordenadas[ordenadas.length - 1]
      const diasDesde = Math.max(0, Math.round((Date.now() - ultima) / 86400000))
      // ===== NOVO: previsão da próxima compra (última + ciclo) e flag de cliente ativo =====
      const proxima = intervaloMedio ? new Date(ultima + intervaloMedio * 86400000) : null
      lista.push({
        clienteId,
        totalCompras: ordenadas.length,
        ultimaCompra: new Date(ultima),
        diasDesde,
        intervaloMedio,
        compraDiaMes: mesesComDia.size >= 2,
        qtdMesesDia: mesesComDia.size,
        compraDiaSemana: semanasComDia.size >= 2,
        qtdSemanasDia: semanasComDia.size,
        score: intervaloMedio && intervaloMedio > 0 ? diasDesde / intervaloMedio : null,
        cicloSaudavel: intervaloMedio && intervaloMedio >= CICLO_REC_MIN && intervaloMedio <= CICLO_REC_MAX,
        proximaCompra: proxima,
        // ===== NOVO: dias até a próxima compra (negativo = já atrasada) e cliente ativo =====
        diasAteProxima: proxima ? Math.round((proxima.getTime() - Date.now()) / 86400000) : null,
        ativo: intervaloMedio ? diasDesde <= intervaloMedio * ATIVO_LIMITE : true
      })
    }
    return lista
  }, [vendas, diaMes, diaSemana])
  const comCliente = (arr) =>
    arr
      .map((x) => ({ ...x, cliente: clientePorId(x.clienteId) }))
      .filter((x) => x.cliente && !x.cliente.arquivado)
  // ===== FOCO DO DIA: próxima compra prevista perto de HOJE (±7 dias) =====
  const focoDia = comCliente(
    analise.filter(
      (x) =>
        x.ativo &&
        x.diasAteProxima != null &&
        x.diasAteProxima >= -FOCO_JANELA_DIAS &&
        x.diasAteProxima <= FOCO_JANELA_DIAS
    )
  )
    .sort((a, b) => a.diasAteProxima - b.diasAteProxima)
    .slice(0, 5)
  // ===== COMPRA RECORRENTE: ciclo de 30 a 50 dias E cliente ainda ativo =====
  const recorrentesLista = comCliente(analise.filter((x) => x.cicloSaudavel && x.ativo))
    .sort((a, b) => (a.diasAteProxima ?? 999) - (b.diasAteProxima ?? 999))
    .slice(0, 8)
  const diaMesLista = comCliente(analise.filter((x) => x.compraDiaMes && x.ativo))
    .sort((a, b) => b.qtdMesesDia - a.qtdMesesDia || b.totalCompras - a.totalCompras)
    .slice(0, 5)
  const diaSemanaLista = comCliente(analise.filter((x) => x.compraDiaSemana && x.ativo))
    .sort((a, b) => b.qtdSemanasDia - a.qtdSemanasDia || b.totalCompras - a.totalCompras)
    .slice(0, 5)
  // ===== Orçamentos aguardando perto do vencimento =====
  const orcamentosPendentes = (orcamentos || [])
    .filter((o) => o.status === 'aguardando' && o.prazoValidade)
    .map((o) => {
      const d = parseISO(o.prazoValidade)
      return {
        ...o,
        cliente: clientePorId(o.clienteId),
        diasParaVencer: d ? Math.round((d.getTime() - Date.now()) / 86400000) : null
      }
    })
    .filter((o) => o.diasParaVencer != null && o.diasParaVencer <= 3 && o.cliente)
    .sort((a, b) => a.diasParaVencer - b.diasParaVencer)
    .slice(0, 5)
  // ===== Metas =====
  const totalHoje = vendas.filter((v) => v.data === hojeISO).reduce((s, v) => s + valorPedido(v), 0)
  const totalSemana = vendas
    .filter((v) => {
      const d = parseData(v.data)
      return d && d >= inicioSemana && d <= fimSemana
    })
    .reduce((s, v) => s + valorPedido(v), 0)
  const totalMes = vendas
    .filter((v) => {
      const d = parseData(v.data)
      return d && d.getFullYear() === hoje.getFullYear() && d.getMonth() === hoje.getMonth()
    })
    .reduce((s, v) => s + valorPedido(v), 0)
  const metaSemanal = Number(usuario.metaSemanal) || 25000
  const metaMensal = Number(usuario.metaMensal) || 100000
  const pctSemana = metaSemanal > 0 ? Math.min(100, (totalSemana / metaSemanal) * 100) : 0
  const pctMes = metaMensal > 0 ? Math.min(100, (totalMes / metaMensal) * 100) : 0
  // ===== dados do detalhe do cliente selecionado =====
  const detalheAnalise = clienteDetalhe ? analise.find((a) => a.clienteId === clienteDetalhe.id) : null
  const vendasDoCliente = clienteDetalhe
    ? (vendas || [])
        .filter((v) => v.clienteId === clienteDetalhe.id)
        .sort((a, b) => String(b.data || '').localeCompare(String(a.data || '')))
        .slice(0, 8)
    : []
  const orcamentosDoCliente = clienteDetalhe
    ? (orcamentos || []).filter((o) => o.clienteId === clienteDetalhe.id)
    : []
  const totalCliente = vendasDoCliente.reduce((s, v) => s + valorPedido(v), 0)
  // ===== situação do cliente com base na data atual =====
  function situacaoCliente(a) {
    if (!a || !a.intervaloMedio || !a.ativo) return { texto: 'sem padrão ativo', classe: 'home-badge-info' }
    if (a.diasAteProxima != null && a.diasAteProxima <= 0) return { texto: '🟠 Compra prevista (atrasada)', classe: 'home-badge-atraso' }
    if (a.diasAteProxima != null && a.diasAteProxima <= FOCO_JANELA_DIAS) return { texto: '🟢 Compra prevista em breve', classe: 'home-badge-hoje' }
    return { texto: '🔵 Recorrente', classe: 'home-badge-info' }
  }
  const rotuloValidade = (d) => {
    if (d === 0) return 'vence hoje'
    if (d < 0) return 'venceu há ' + Math.abs(d) + 'd'
    return 'vence em ' + d + 'd'
  }
  return (
    <div className="home">
      <style>{estiloHome}</style>
      {carregando ? (
        <p className="empty">Carregando sua Home...</p>
      ) : (
        <>
          {/* Saudação */}
          <div className="home-saudacao">
            <h2>{saudacao(hoje.getHours())}, {usuario.nome}! 👋</h2>
            <p>Hoje é {DIAS_SEMANA[diaSemana]}, {fmtData(hojeISO)}.</p>
          </div>
          {/* Metas — SEMPRE visíveis */}
          <div className="home-meta-grid">
            <div className="home-meta-card">
              <div className="home-meta-rotulo">Vendido hoje</div>
              <div className="home-meta-valor">{fmtValor(totalHoje)}</div>
              <div className="home-meta-sub">{totalHoje > 0 ? 'Bom começo! 💪' : 'Nenhuma venda registrada ainda hoje.'}</div>
            </div>
            <div className="home-meta-card">
              <div className="home-meta-rotulo">Meta semanal</div>
              <div className="home-meta-valor">
                {fmtValor(totalSemana)} <span style={{ fontSize: 13, color: '#64748b' }}>/ {fmtValor(metaSemanal)}</span>
              </div>
              <div className="home-meta-bar">
                <div className={'home-meta-fill ' + (pctSemana >= 100 ? 'ok' : '')} style={{ width: pctSemana + '%' }}></div>
              </div>
              <div className="home-meta-sub">{Math.round(pctSemana)}% da meta semanal</div>
            </div>
            <div className="home-meta-card">
              <div className="home-meta-rotulo">Meta mensal</div>
              <div className="home-meta-valor">
                {fmtValor(totalMes)} <span style={{ fontSize: 13, color: '#64748b' }}>/ {fmtValor(metaMensal)}</span>
              </div>
              <div className="home-meta-bar">
                <div className={'home-meta-fill ' + (pctMes >= 100 ? 'ok' : '')} style={{ width: pctMes + '%' }}></div>
              </div>
              <div className="home-meta-sub">{Math.round(pctMes)}% da meta mensal</div>
            </div>
          </div>
          {/* ===== Blocos colapsáveis — todos minimizados por padrão ===== */}
          {/* Foco do dia */}
          <SecaoColapsavel
            titulo={'🎯 Foco do dia — próxima compra prevista para hoje ou nos próximos ' + FOCO_JANELA_DIAS + ' dias'}
            aberto={abertoBlocos.foco}
            aoAlternar={() => setAbertoBlocos((b) => ({ ...b, foco: !b.foco }))}
            contador={focoDia.length + ' clientes'}
          >
            {focoDia.length === 0 ? (
              <p className="home-vazio">Nenhum cliente com próxima compra prevista para hoje ou nos próximos {FOCO_JANELA_DIAS} dias.</p>
            ) : (
              <div className="tabela-wrap">
                <table className="tabela">
                  <thead>
                    <tr><th>Cliente</th><th>Cidade</th><th>Última compra</th><th>Próx. compra</th><th>Situação</th></tr>
                  </thead>
                  <tbody>
                    {focoDia.map((x) => (
                      <tr key={x.clienteId} className="home-clicavel" onClick={() => setClienteDetalhe(x.cliente)} title="Clique para ver o detalhe">
                        <td><strong>#{x.cliente.codigo} {x.cliente.nome}</strong><span className="home-seta-detalhe">👁</span></td>
                        <td>{x.cliente.cidade || '—'}</td>
                        <td>{fmtData(dataISO(x.ultimaCompra))}</td>
                        <td><strong>{x.proximaCompra ? fmtData(dataISO(x.proximaCompra)) : '—'}</strong></td>
                        <td>
                          {x.diasAteProxima < 0 ? (
                            <span className="home-detalhe-badge home-badge-atraso">vencida há {Math.abs(x.diasAteProxima)}d</span>
                          ) : x.diasAteProxima === 0 ? (
                            <span className="home-detalhe-badge home-badge-urgente">prevista para HOJE</span>
                          ) : (
                            <span className="home-detalhe-badge home-badge-hoje">em {x.diasAteProxima}d</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </SecaoColapsavel>
          {/* Compra recorrente (30–50 dias) — só clientes ativos */}
          <SecaoColapsavel
            titulo={'🔄 Compra recorrente (a cada ' + CICLO_REC_MIN + '–' + CICLO_REC_MAX + ' dias) — clientes ativos'}
            aberto={abertoBlocos.recorrentes}
            aoAlternar={() => setAbertoBlocos((b) => ({ ...b, recorrentes: !b.recorrentes }))}
            contador={recorrentesLista.length + ' clientes'}
          >
            {recorrentesLista.length === 0 ? (
              <p className="home-vazio">Nenhum cliente ativo com ciclo de compra entre {CICLO_REC_MIN} e {CICLO_REC_MAX} dias.</p>
            ) : (
              <div className="tabela-wrap">
                <table className="tabela">
                  <thead>
                    <tr><th>Cliente</th><th>Cidade</th><th>Última compra</th><th>Ciclo médio</th><th>Próxima compra prevista</th></tr>
                  </thead>
                  <tbody>
                    {recorrentesLista.map((x) => (
                      <tr key={x.clienteId} className="home-clicavel" onClick={() => setClienteDetalhe(x.cliente)} title="Clique para ver o detalhe">
                        <td><strong>#{x.cliente.codigo} {x.cliente.nome}</strong><span className="home-seta-detalhe">👁</span></td>
                        <td>{x.cliente.cidade || '—'}</td>
                        <td>{fmtData(dataISO(x.ultimaCompra))}</td>
                        <td>a cada ~{Math.round(x.intervaloMedio)} dias</td>
                        <td>
                          {x.proximaCompra ? (
                            <span className={'home-detalhe-badge ' + (x.diasAteProxima <= 0 ? 'home-badge-urgente' : 'home-badge-hoje')}>
                              {fmtData(dataISO(x.proximaCompra))}
                              {x.diasAteProxima === 0 ? ' (HOJE)' : x.diasAteProxima < 0 ? ' (atrasada)' : ''}
                            </span>
                          ) : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </SecaoColapsavel>
          {/* Costumam comprar no dia do mês */}
          <SecaoColapsavel
            titulo={'📅 Costumam comprar no dia ' + diaMes}
            aberto={abertoBlocos.diaMes}
            aoAlternar={() => setAbertoBlocos((b) => ({ ...b, diaMes: !b.diaMes }))}
            contador={diaMesLista.length + ' clientes'}
          >
            {diaMesLista.length === 0 ? (
              <p className="home-vazio">Nenhum cliente ativo com padrão de compra no dia {diaMes}.</p>
            ) : (
              <div className="tabela-wrap">
                <table className="tabela">
                  <thead>
                    <tr><th>Cliente</th><th>Cidade</th><th>Última compra</th><th>Compras</th><th>Padrão</th></tr>
                  </thead>
                  <tbody>
                    {diaMesLista.map((x) => (
                      <tr key={x.clienteId} className="home-clicavel" onClick={() => setClienteDetalhe(x.cliente)} title="Clique para ver o detalhe">
                        <td><strong>#{x.cliente.codigo} {x.cliente.nome}</strong><span className="home-seta-detalhe">👁</span></td>
                        <td>{x.cliente.cidade || '—'}</td>
                        <td>{fmtData(dataISO(x.ultimaCompra))}</td>
                        <td>{x.totalCompras}</td>
                        <td><span className="home-detalhe-badge home-badge-info">dia {diaMes} em {x.qtdMesesDia} meses</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </SecaoColapsavel>
          {/* Costumam comprar no dia da semana */}
          <SecaoColapsavel
            titulo={'📆 Costumam comprar na ' + DIAS_SEMANA[diaSemana]}
            aberto={abertoBlocos.diaSemana}
            aoAlternar={() => setAbertoBlocos((b) => ({ ...b, diaSemana: !b.diaSemana }))}
            contador={diaSemanaLista.length + ' clientes'}
          >
            {diaSemanaLista.length === 0 ? (
              <p className="home-vazio">Nenhum cliente ativo com padrão de compra na {DIAS_SEMANA[diaSemana]}.</p>
            ) : (
              <div className="tabela-wrap">
                <table className="tabela">
                  <thead>
                    <tr><th>Cliente</th><th>Cidade</th><th>Última compra</th><th>Compras</th><th>Padrão</th></tr>
                  </thead>
                  <tbody>
                    {diaSemanaLista.map((x) => (
                      <tr key={x.clienteId} className="home-clicavel" onClick={() => setClienteDetalhe(x.cliente)} title="Clique para ver o detalhe">
                        <td><strong>#{x.cliente.codigo} {x.cliente.nome}</strong><span className="home-seta-detalhe">👁</span></td>
                        <td>{x.cliente.cidade || '—'}</td>
                        <td>{fmtData(dataISO(x.ultimaCompra))}</td>
                        <td>{x.totalCompras}</td>
                        <td><span className="home-detalhe-badge home-badge-info">em {x.qtdSemanasDia} semanas</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </SecaoColapsavel>
          {/* Orçamentos aguardando */}
          <SecaoColapsavel
            titulo="⏳ Orçamentos aguardando"
            aberto={abertoBlocos.orcamentos}
            aoAlternar={() => setAbertoBlocos((b) => ({ ...b, orcamentos: !b.orcamentos }))}
            contador={orcamentosPendentes.length + ' p/ vencimento'}
          >
            {orcamentosPendentes.length === 0 ? (
              <p className="home-vazio">Nenhum orçamento aguardando perto do vencimento.</p>
            ) : (
              <div className="tabela-wrap">
                <table className="tabela">
                  <thead>
                    <tr><th>Cliente</th><th>Valor</th><th>Válido até</th><th>Situação</th></tr>
                  </thead>
                  <tbody>
                    {orcamentosPendentes.map((o) => (
                      <tr key={o.id} className="home-clicavel" onClick={() => setClienteDetalhe(o.cliente)} title="Clique para ver o detalhe do cliente">
                        <td><strong>#{o.cliente.codigo} {o.cliente.nome}</strong><span className="home-seta-detalhe">👁</span></td>
                        <td>{fmtValor((Number(o.valorInsumos) || 0) + (Number(o.valorEquipamento) || 0))}</td>
                        <td>{fmtData(o.prazoValidade)}</td>
                        <td>
                          <span className={'home-detalhe-badge ' + (o.diasParaVencer <= 0 ? 'home-badge-urgente' : 'home-badge-atraso')}>
                            {rotuloValidade(o.diasParaVencer)}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </SecaoColapsavel>
        </>
      )}
      {/* ===== modal de detalhe do cliente (abre na própria Home) ===== */}
      {clienteDetalhe && (
        <div className="modal-overlay" onClick={() => setClienteDetalhe(null)}>
          <div className="modal home-modal" onClick={(e) => e.stopPropagation()}>
            <div className="home-modal-head">
              <h3>#{clienteDetalhe.codigo} {clienteDetalhe.nome}</h3>
              <button type="button" className="btn-secondary" onClick={() => setClienteDetalhe(null)}>✕ Fechar</button>
            </div>
            <div className="home-modal-contato">
              {clienteDetalhe.cidade && <span className="home-chip">📍 {clienteDetalhe.cidade}</span>}
              {clienteDetalhe.segmento && <span className="home-chip">🏷️ {clienteDetalhe.segmento}</span>}
              {clienteDetalhe.whats && <span className="home-chip">📱 {clienteDetalhe.whats}</span>}
              {clienteDetalhe.email && <span className="home-chip">✉️ {clienteDetalhe.email}</span>}
              {clienteDetalhe.envio && <span className="home-chip">🚚 {clienteDetalhe.envio}</span>}
              {!clienteDetalhe.cidade && !clienteDetalhe.segmento && !clienteDetalhe.whats && !clienteDetalhe.email && (
                <span className="home-chip">Sem contatos adicionais cadastrados</span>
              )}
            </div>
            <div className="home-modal-grid">
              <div className="home-detalhe-stat">
                <div className="home-detalhe-rotulo">Total de compras</div>
                <div className="home-detalhe-valor">{detalheAnalise ? detalheAnalise.totalCompras : (vendasDoCliente.length || 0)}</div>
              </div>
              <div className="home-detalhe-stat">
                <div className="home-detalhe-rotulo">Valor total</div>
                <div className="home-detalhe-valor">{fmtValor(totalCliente)}</div>
              </div>
              <div className="home-detalhe-stat">
                <div className="home-detalhe-rotulo">Última compra</div>
                <div className="home-detalhe-valor">{detalheAnalise ? fmtData(dataISO(detalheAnalise.ultimaCompra)) : '—'}</div>
              </div>
              <div className="home-detalhe-stat">
                <div className="home-detalhe-rotulo">Ciclo médio</div>
                <div className="home-detalhe-valor">{detalheAnalise && detalheAnalise.intervaloMedio ? 'compra a cada ~' + Math.round(detalheAnalise.intervaloMedio) + ' dias' : '—'}</div>
              </div>
              {/* ===== NOVO: próxima compra prevista no lugar de "dias sem comprar" ===== */}
              <div className="home-detalhe-stat">
                <div className="home-detalhe-rotulo">Próxima compra prevista</div>
                <div className="home-detalhe-valor">
                  {detalheAnalise && detalheAnalise.proximaCompra ? (
                    fmtData(dataISO(detalheAnalise.proximaCompra)) +
                    (detalheAnalise.diasAteProxima != null && detalheAnalise.diasAteProxima <= 0 ? ' (atrasada)' : '')
                  ) : '—'}
                </div>
              </div>
              <div className="home-detalhe-stat">
                <div className="home-detalhe-rotulo">Situação</div>
                <div className="home-detalhe-valor">
                  <span className={'home-detalhe-badge ' + situacaoCliente(detalheAnalise).classe}>
                    {situacaoCliente(detalheAnalise).texto}
                  </span>
                </div>
              </div>
            </div>
            {/* ===== NOVO: Rotina do Laboratório (componente reutilizável) ===== */}
            <div className="rl-margem">
              <RotinaLaboratorio
                inline
                cliente={clienteDetalhe}
                comprasNotas={comprasNotas}
                onSalvar={async ({ rotinas, equipamentos }) => {
                  const atualizado = { ...clienteDetalhe, rotinas, equipamentos }
                  const res = await window.api.atualizarCliente(atualizado)
                  if (res && res.ok) {
                    setClientes((prev) => prev.map((c) => (c.id === atualizado.id ? atualizado : c)))
                    setClienteDetalhe(atualizado)
                  }
                }}
              />
            </div>
            {/* Últimas vendas */}
            <h4 style={{ margin: '14px 0 8px', fontSize: 14 }}>🧾 Últimas vendas ({vendasDoCliente.length})</h4>
            {vendasDoCliente.length === 0 ? (
              <p className="home-vazio">Nenhuma venda registrada para este cliente.</p>
            ) : (
              <div className="tabela-wrap">
                <table className="tabela">
                  <thead>
                    <tr><th>Data</th><th>Ped. Insumos</th><th>Ped. Equip.</th><th>Valor</th></tr>
                  </thead>
                  <tbody>
                    {vendasDoCliente.map((v) => (
                      <tr key={v.id}>
                        <td>{fmtData(v.data)}</td>
                        <td>{v.pedidoInsumos || '—'}</td>
                        <td>{v.pedidoEquipamento || '—'}</td>
                        <td>{fmtValor(valorPedido(v))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {/* Orçamentos do cliente */}
            <h4 style={{ margin: '14px 0 8px', fontSize: 14 }}>📋 Orçamentos ({orcamentosDoCliente.length})</h4>
            {orcamentosDoCliente.length === 0 ? (
              <p className="home-vazio">Nenhum orçamento para este cliente.</p>
            ) : (
              <div className="tabela-wrap">
                <table className="tabela">
                  <thead>
                    <tr><th>Data</th><th>Valor</th><th>Status</th></tr>
                  </thead>
                  <tbody>
                    {orcamentosDoCliente
                      .sort((a, b) => String(b.data || '').localeCompare(String(a.data || '')))
                      .slice(0, 8)
                      .map((o) => {
                        const st = STATUS_ORC[o.status] || STATUS_ORC.aguardando
                        return (
                          <tr key={o.id}>
                            <td>{fmtData(o.data)}</td>
                            <td>{fmtValor((Number(o.valorInsumos) || 0) + (Number(o.valorEquipamento) || 0))}</td>
                            <td><span className={'badge ' + st.classe}>{st.label}</span></td>
                          </tr>
                        )
                      })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}