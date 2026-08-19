import { useEffect, useRef, useState } from 'react'
import { fmtMoeda, fmtCnpj, fmtFone, fmtDataHora, fmtData } from '../utils/format'
import RotinaLaboratorio from './RotinaLaboratorio'
// ===== NOVO: normaliza o meio de envio (corrige variações dos dados importados) =====
const normalizarEnvio = (envio) => {
  if (!envio) return ''
  const e = String(envio).trim()
  const mapa = {
    whats: 'WhatsApp',
    whatsapp: 'WhatsApp',
    'whats app': 'WhatsApp',
    'whats-app': 'WhatsApp',
    zap: 'WhatsApp',
    'e-mail': 'E-mail',
    email: 'E-mail',
    mail: 'E-mail',
    telefone: 'Telefone',
    tel: 'Telefone',
    plataforma: 'Plataforma',
    teams: 'Teams'
  }
  const chave = e.toLowerCase()
  return mapa[chave] || e
}
const ROTULOS_TIPO = {
  ligacao: '📞 Liguei',
  promocao: '🎁 Promoção',
  visita: '📅 Visita agendada',
  proposta: '📄 Proposta',
  obs: '📝 Observação'
}
const STATUS_ORC = {
  aprovado: { label: '✅ Aprovado', classe: 'status-aprovado' },
  recusado: { label: '❌ Recusado', classe: 'status-recusado' }
}
const ABAS_CLIENTE = [
  { id: 'compras', rotulo: '🛒 Últimas Compras' },
  { id: 'orcamentos', rotulo: '📋 Orçamentos' },
  { id: 'produtos', rotulo: '📊 Produtos' },
  { id: 'padrao', rotulo: '📈 Padrão de Compra' },
  { id: 'rotina', rotulo: '🧪 Rotina' },
  { id: 'historico', rotulo: '📞 Interações' }
]
const estiloAbas = `
  .cliente-abas { display: flex; gap: 4px; flex-wrap: wrap; margin: 18px 0 14px; border-bottom: 2px solid #e2e8f0; }
  .cliente-aba { padding: 9px 16px; font-size: 13px; font-weight: 600; border: 1px solid transparent; border-bottom: none; border-radius: 8px 8px 0 0; background: transparent; color: #64748b; cursor: pointer; transition: all .15s; }
  .cliente-aba:hover { background: #f1f5f9; color: #0f172a; }
  .cliente-aba.ativa { background: #fff; border-color: #e2e8f0; color: #2563eb; box-shadow: inset 0 -2px 0 #2563eb; }
`
// ===== NOVO: estilo da aba Padrão de Compra =====
const estiloPadrao = `
  .padrao-topo { display: flex; align-items: center; gap: 10px; margin: 0 0 14px; flex-wrap: wrap; }
  .padrao-topo label { font-size: 13px; color: #475569; font-weight: 600; }
  .padrao-topo select { padding: 6px 10px; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 13px; background: #fff; color: #0f172a; }
  .padrao-bloco { margin-bottom: 18px; }
  .padrao-bloco h4 { font-size: 14px; margin: 0 0 4px; display: flex; align-items: center; gap: 6px; }
  .padrao-resumo { font-size: 12px; color: #64748b; margin: 0 0 8px; }
  .padrao-lista { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 6px; }
  .padrao-item { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 8px 12px; border: 1px solid #e2e8f0; border-radius: 8px; background: #fff; font-size: 13px; }
  .padrao-item .p-desc { font-weight: 600; color: #0f172a; }
  .padrao-item .p-cod { color: #94a3b8; font-size: 11px; }
  .padrao-item .p-meta { text-align: right; font-size: 12px; color: #64748b; white-space: nowrap; }
  .padrao-item .p-valor { font-weight: 700; }
  .padrao-bloco.sempre .padrao-item { border-left: 3px solid #22c55e; }
  .padrao-bloco.parou .padrao-item { border-left: 3px solid #ef4444; }
  .padrao-bloco.comecou .padrao-item { border-left: 3px solid #3b82f6; }
  .padrao-bloco.esporadico .padrao-item { border-left: 3px solid #cbd5e1; opacity: .85; }
  .badge-padrao { display: inline-block; padding: 2px 8px; border-radius: 999px; font-size: 11px; font-weight: 700; margin-left: 6px; }
  .badge-parou { background: #fee2e2; color: #b91c1c; }
  .badge-comecou { background: #dbeafe; color: #1d4ed8; }
  .badge-sempre { background: #dcfce7; color: #15803d; }
`
const fmtMesAno = (ym) => {
  if (!ym) return ''
  const [ano, mes] = String(ym).split('-')
  return mes + '/' + ano
}
export default function ClienteDetalhe({ clienteId, onVoltar }) {
  const [dados, setDados] = useState(null)
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')
  const [historico, setHistorico] = useState([])
  const [novoTipo, setNovoTipo] = useState('obs')
  const [novaDesc, setNovaDesc] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [aviso, setAviso] = useState('')
  const avisoTimer = useRef(null)
  const mostrarAviso = (msg) => {
    setAviso(msg)
    if (avisoTimer.current) clearTimeout(avisoTimer.current)
    avisoTimer.current = setTimeout(() => setAviso(''), 3000)
  }
  const [maisComprados, setMaisComprados] = useState([])
  const [menosComprados, setMenosComprados] = useState([])
  const [carregandoProdutos, setCarregandoProdutos] = useState(false)
  const [erroProdutos, setErroProdutos] = useState('')
  const [anoFiltro, setAnoFiltro] = useState('total')
  const [anosDisponiveis, setAnosDisponiveis] = useState([])
  const [orcamentos, setOrcamentos] = useState([])
  const [carregandoOrc, setCarregandoOrc] = useState(false)
  const [rotinaCliente, setRotinaCliente] = useState(null)
  const [comprasNotas, setComprasNotas] = useState([])
  const [aba, setAba] = useState('compras')
  // ===== NOVO: padrão de compra =====
  const [padrao, setPadrao] = useState(null)
  const [padraoMeses, setPadraoMeses] = useState(6)
  const [carregandoPadrao, setCarregandoPadrao] = useState(false)
  const [erroPadrao, setErroPadrao] = useState('')
  // ===== NOVO: principal meio de comunicação (envio mais frequente nas vendas) =====
  const [meioComunicacao, setMeioComunicacao] = useState(null)
  useEffect(() => {
    let ativo = true
    setCarregando(true)
    setErro('')
    if (!window.api || typeof window.api.estatisticasCliente !== 'function') {
      setErro('Função de estatísticas não disponível. Verifique o preload/index.js.')
      setCarregando(false)
      return
    }
    window.api
      .estatisticasCliente(clienteId)
      .then((res) => {
        if (!ativo) return
        setDados(res)
        setCarregando(false)
      })
      .catch((err) => {
        if (!ativo) return
        console.error('Erro ao carregar estatísticas:', err)
        setErro('Falha ao carregar as estatísticas do cliente.')
        setCarregando(false)
      })
    return () => { ativo = false }
  }, [clienteId])
  useEffect(() => {
    if (dados && dados.ok && dados.cliente) {
      setRotinaCliente(dados.cliente)
    }
  }, [dados])
  useEffect(() => {
    if (!rotinaCliente || !rotinaCliente.id) {
      setComprasNotas([])
      return
    }
    if (!window.api || typeof window.api.comprasNotas !== 'function') {
      setComprasNotas([])
      return
    }
    window.api.comprasNotas(rotinaCliente.id)
      .then((res) => setComprasNotas(res && res.ok ? res.itens : []))
      .catch(() => setComprasNotas([]))
  }, [rotinaCliente])
  useEffect(() => {
    if (!window.api || typeof window.api.historicoCliente !== 'function') {
      setHistorico([])
      return
    }
    window.api
      .historicoCliente(clienteId)
      .then((res) => setHistorico(Array.isArray(res) ? res : []))
      .catch((err) => { console.error('Erro ao carregar histórico:', err); setHistorico([]) })
  }, [clienteId])
  // ===== NOVO: calcula o principal meio de comunicação a partir das vendas =====
  useEffect(() => {
    if (!window.api || typeof window.api.listarVendas !== 'function') return
    window.api
      .listarVendas()
      .then((lista) => {
        const arr = Array.isArray(lista) ? lista : []
        const contagem = {}
        for (const v of arr) {
          if (v.clienteId !== clienteId) continue
          const envio = normalizarEnvio(v.envio)
          if (!envio) continue
          contagem[envio] = (contagem[envio] || 0) + 1
        }
        let top = null
        let topN = 0
        for (const [envio, n] of Object.entries(contagem)) {
          if (n > topN) { topN = n; top = envio }
        }
        setMeioComunicacao(top ? { envio: top, total: topN } : null)
      })
      .catch(() => setMeioComunicacao(null))
  }, [clienteId])
  useEffect(() => {
    if (!dados || !dados.ok || !dados.cliente || !dados.cliente.codigo) return
    const codigo = String(dados.cliente.codigo)
    if (!window.api || typeof window.api.notasTopCliente !== 'function') {
      setErroProdutos('Função de notas não disponível. Verifique o preload/index.js.')
      return
    }
    setCarregandoProdutos(true)
    setErroProdutos('')
    window.api
      .notasTopCliente(codigo, anoFiltro)
      .then((res) => {
        if (res && res.ok) {
          setMaisComprados(res.maisComprados || [])
          setMenosComprados(res.menosComprados || [])
        } else {
          setErroProdutos((res && res.erro) || 'Sem dados de notas para este cliente.')
        }
      })
      .catch((err) => {
        console.error('Erro ao carregar top produtos:', err)
        setErroProdutos('Falha ao carregar os produtos do notas.json.')
      })
      .finally(() => setCarregandoProdutos(false))
  }, [dados, anoFiltro])
  useEffect(() => {
    if (!window.api || typeof window.api.notasAnos !== 'function') return
    window.api
      .notasAnos()
      .then((res) => {
        if (res && res.ok) setAnosDisponiveis(res.anos || [])
      })
      .catch((err) => console.error('Erro ao carregar anos das notas:', err))
  }, [])
  useEffect(() => {
    if (!window.api || typeof window.api.listarOrcamentos !== 'function') return
    setCarregandoOrc(true)
    window.api
      .listarOrcamentos()
      .then((lista) => {
        const arr = Array.isArray(lista) ? lista : []
        const doCliente = arr.filter(
          (o) => o.clienteId === clienteId && (o.status === 'aprovado' || o.status === 'recusado')
        )
        setOrcamentos(doCliente)
      })
      .catch((err) => { console.error('Erro ao carregar orçamentos:', err); setOrcamentos([]) })
      .finally(() => setCarregandoOrc(false))
  }, [clienteId])
  // ===== NOVO: carrega o padrão de compra (3/6/9/12 meses) =====
  useEffect(() => {
    if (!dados || !dados.ok || !dados.cliente || !dados.cliente.codigo) return
    if (!window.api || typeof window.api.padraoCliente !== 'function') {
      setErroPadrao('Função de padrão não disponível. Verifique o preload/index.js.')
      return
    }
    setCarregandoPadrao(true)
    setErroPadrao('')
    window.api
      .padraoCliente(String(dados.cliente.codigo), padraoMeses)
      .then((res) => {
        if (res && res.ok) setPadrao(res)
        else setErroPadrao((res && res.erro) || 'Sem dados de notas para este cliente.')
      })
      .catch((err) => {
        console.error('Erro ao carregar padrão de compra:', err)
        setErroPadrao('Falha ao carregar o padrão de compra.')
      })
      .finally(() => setCarregandoPadrao(false))
  }, [dados, padraoMeses])
  const adicionarHistorico = () => {
    const desc = novaDesc.trim()
    if (!desc) return
    if (!window.api || typeof window.api.salvarHistorico !== 'function') {
      setErro('Função de histórico não disponível. Verifique o preload/index.js.')
      return
    }
    setSalvando(true)
    window.api
      .salvarHistorico(clienteId, { tipo: novoTipo, descricao: desc })
      .then(() => {
        setNovaDesc('')
        mostrarAviso('✅ Interação registrada!')
        return window.api.historicoCliente(clienteId)
      })
      .then((res) => setHistorico(Array.isArray(res) ? res : []))
      .catch((err) => { console.error('Erro ao salvar histórico:', err); setErro('Falha ao salvar a interação.') })
      .finally(() => setSalvando(false))
  }
  if (carregando) {
    return (
      <div className="painel">
        <div className="cliente-detalhe-topo">
          <button className="btn-voltar" onClick={onVoltar}>← Voltar</button>
        </div>
        <p className="empty">Carregando estatísticas...</p>
      </div>
    )
  }
  if (erro) {
    return (
      <div className="painel">
        <div className="cliente-detalhe-topo">
          <button className="btn-voltar" onClick={onVoltar}>← Voltar</button>
        </div>
        <h2>Estatísticas do cliente</h2>
        <p className="form-erro">{erro}</p>
      </div>
    )
  }
  if (!dados || !dados.ok) {
    return (
      <div className="painel">
        <div className="cliente-detalhe-topo">
          <button className="btn-voltar" onClick={onVoltar}>← Voltar</button>
        </div>
        <h2>Estatísticas do cliente</h2>
        <p className="empty">Cliente não encontrado.</p>
      </div>
    )
  }
  const c = dados.cliente
  const e = dados.estatisticas
  const saudeMeta = {
    novo: { label: '🆕 Novo', classe: 'saude-novo' },
    ativo: { label: '✅ Ativo', classe: 'saude-ativo' },
    atencao: { label: '⚠️ Atenção', classe: 'saude-atencao' },
    risco: { label: '🔴 Risco', classe: 'saude-risco' }
  }
  const saude = saudeMeta[e.saude] || { label: e.saude || '—', classe: '' }
  const proximaAcao = () => {
    if (e.saude === 'risco') {
      return { texto: `Cliente em risco há ${e.diasDesdeUltima ?? '?'} dias sem comprar. Ligue hoje para reativar.`, classe: 'acao-risco' }
    }
    if (e.saude === 'atencao') {
      return { texto: 'Cliente com atenção: faça um contato de acompanhamento esta semana.', classe: 'acao-atencao' }
    }
    if (e.saude === 'novo') {
      return { texto: 'Cliente novo: agende um follow-up para apresentar mais produtos.', classe: 'acao-novo' }
    }
    return { texto: 'Cliente ativo: aproveite para oferecer cross-sell dos produtos menos recorrentes.', classe: 'acao-ativo' }
  }
  const acao = proximaAcao()
  return (
    <div className="painel">
      <style>{estiloAbas}</style>
      {aviso && <div className="toast-sucesso">{aviso}</div>}
      <div className="cliente-detalhe-topo">
        <button className="btn-voltar" onClick={onVoltar}>← Voltar</button>
        <div className="cliente-badges">
          <span className={'badge ' + saude.classe} title="Classificação automática: Novo (sem histórico), Ativo (compra com frequência), Atenção (demorando a voltar) ou Risco (muito tempo sem comprar).">
            {saude.label}
          </span>
          <span className={'badge badge-abc abc-' + e.classeAbc} title="Curva ABC do gasto: A = clientes que mais geram receita, B = intermediários, C = menor participação.">
            Curva {e.classeAbc}
          </span>
        </div>
      </div>
      <h2 className="cliente-titulo">{c.nome}</h2>
      <div className={'proxima-acao ' + acao.classe} title="Sugestão automática baseada na saúde e no histórico de compras do cliente.">
        🎯 <strong>Próxima ação:</strong> {acao.texto}
      </div>
      <div className="cliente-info-grid">
        {c.codigo && <div className="info-card"><span className="info-label">ID</span><span>{c.codigo}</span></div>}
        {c.cnpj && <div className="info-card"><span className="info-label">CNPJ</span><span>{fmtCnpj(c.cnpj)}</span></div>}
        {c.contato && <div className="info-card"><span className="info-label">Contato</span><span>{c.contato}</span></div>}
        {c.email && (
          <div className="info-card">
            <span className="info-label">E-mail</span>
            <a href={`mailto:${c.email}`} className="info-link">{c.email}</a>
          </div>
        )}
        {c.whats && <div className="info-card"><span className="info-label">WhatsApp</span><span>{fmtFone(c.whats)}</span></div>}
        {c.cidade && <div className="info-card"><span className="info-label">Cidade</span><span>{c.cidade}</span></div>}
        {c.segmento && <div className="info-card"><span className="info-label">Segmento</span><span>{c.segmento}</span></div>}
        {/* ===== NOVO: principal meio de comunicação (normalizado) ===== */}
        <div className="info-card info-destaque" title="Meio de envio que mais aparece nas vendas deste cliente (ex.: se a maioria das vendas foi por WhatsApp, mostra WhatsApp).">
          <span className="info-label">📞 Principal meio de comunicação</span>
          <span>{meioComunicacao ? meioComunicacao.envio + (meioComunicacao.total > 1 ? ` (${meioComunicacao.total}×)` : '') : '—'}</span>
        </div>
      </div>
      <div className="stats-grid">
        <div className="stat-card" title="Quantidade de vendas registradas para este cliente.">
          <strong>{e.totalVendas}</strong><span>Vendas</span>
        </div>
        <div className="stat-card stat-destaque" title="Soma de todos os valores das vendas deste cliente (toda a tabela de vendas dele).">
          <strong>{fmtMoeda(e.totalGasto)}</strong><span>Total gasto</span>
        </div>
        <div className="stat-card" title="Total gasto ÷ número de vendas. Valor médio gasto por compra.">
          <strong>{fmtMoeda(e.ticketMedio)}</strong><span>Ticket médio</span>
        </div>
        <div className="stat-card" title="Média de dias entre uma compra e outra. Quanto menor, mais frequente o cliente compra.">
          <strong>{e.intervaloDias ? e.intervaloDias + ' dias' : '—'}</strong><span>Frequência média</span>
        </div>
        <div className="stat-card" title="Quantas vezes o cliente compra por mês, em média.">
          <strong>{e.frequenciaMensal ? e.frequenciaMensal + '/mês' : '—'}</strong><span>Compras/mês</span>
        </div>
        <div className="stat-card" title="Dia da semana em que o cliente mais costuma comprar.">
          <strong>{e.diaComum || '—'}</strong><span>Dia mais comum</span>
        </div>
        <div className="stat-card stat-destaque" title="Há quantos dias o cliente fez a última compra. Base para a saúde do cliente.">
          <strong>{e.diasDesdeUltima != null ? e.diasDesdeUltima + ' dias' : '—'}</strong><span>Desde última compra</span>
        </div>
        <div className="stat-card" title="Soma das vendas deste cliente apenas no ano atual.">
          <strong>{fmtMoeda(e.totalAnoAtual)}</strong><span>Total no ano ({new Date().getFullYear()})</span>
        </div>
      </div>
      {e.variacaoAnual !== null && (
        <div className={'variacao ' + (e.variacaoAnual >= 0 ? 'variacao-ok' : 'variacao-ruim')} title="Comparação entre o total gasto no ano atual e no ano anterior.">
          {e.variacaoAnual >= 0 ? '▲' : '▼'} {Math.abs(e.variacaoAnual)}% vs ano anterior
        </div>
      )}
      <div className="cliente-abas">
        {ABAS_CLIENTE.map((a) => (
          <button
            key={a.id}
            type="button"
            className={`cliente-aba ${aba === a.id ? 'ativa' : ''}`}
            onClick={() => setAba(a.id)}
          >
            {a.rotulo}
          </button>
        ))}
      </div>
      {aba === 'compras' && (
        <div className="cliente-secao">
          <h3>🛒 Últimas compras</h3>
          {e.ultimasCompras.length === 0 ? (
            <p className="empty">Nenhuma venda registrada para este cliente.</p>
          ) : (
            <div className="tabela-wrap">
              <table className="tabela">
                <thead>
                  <tr><th>Data</th><th>Insumos</th><th>Equipamento</th><th>Valor</th></tr>
                </thead>
                <tbody>
                  {e.ultimasCompras.map((v, i) => (
                    <tr key={i}>
                      <td>{fmtData(v.data)}</td>
                      <td>{v.insumos || '—'}</td>
                      <td>{v.equipamento || '—'}</td>
                      <td>{fmtMoeda(v.valor)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
      {aba === 'orcamentos' && (
        <div className="cliente-secao">
          <h3>📋 Orçamentos aprovados e recusados</h3>
          {carregandoOrc ? (
            <p className="empty">Carregando orçamentos...</p>
          ) : orcamentos.length === 0 ? (
            <p className="empty">Nenhum orçamento aprovado ou recusado para este cliente.</p>
          ) : (
            <div className="tabela-wrap">
              <table className="tabela">
                <thead>
                  <tr>
                    <th>Data</th>
                    <th>Envio</th>
                    <th>Insumos</th>
                    <th>Valor Insumos</th>
                    <th>Equip.</th>
                    <th>Valor Equip.</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {orcamentos
                    .slice()
                    .sort((a, b) => String(b.data || '').localeCompare(String(a.data || '')))
                    .map((o) => {
                      const st = STATUS_ORC[o.status] || { label: o.status, classe: '' }
                      return (
                        <tr key={o.id} className={'orc-status-' + o.status}>
                          <td>{fmtData(o.data)}</td>
                          {/* ===== ALTERADO: envio normalizado (WHATS -> WhatsApp) ===== */}
                          <td>{normalizarEnvio(o.envio) || '—'}</td>
                          <td>{o.pedidoInsumos || '—'}</td>
                          <td>{fmtMoeda(o.valorInsumos)}</td>
                          <td>{o.pedidoEquipamento || '—'}</td>
                          <td>{fmtMoeda(o.valorEquipamento)}</td>
                          <td>
                            <span className={'badge ' + st.classe}>{st.label}</span>
                            {o.status === 'recusado' && o.motivo && (
                              <div className="recusa-info">Motivo: {o.motivo}</div>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
      {aba === 'produtos' && (
        <>
          <div className="cliente-secao">
            <div className="top-filtro-ano">
              <label>Período das notas:</label>
              <select value={anoFiltro} onChange={(e) => setAnoFiltro(e.target.value)}>
                <option value="total">Total (todos os anos)</option>
                {anosDisponiveis.map((ano) => (
                  <option key={ano} value={ano}>{ano}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="cliente-secao">
            <h3>📊 Produtos mais comprados</h3>
            {carregandoProdutos ? (
              <p className="empty">Carregando produtos...</p>
            ) : erroProdutos ? (
              <p className="form-erro">{erroProdutos}</p>
            ) : maisComprados.length === 0 ? (
              <p className="empty">Nenhum produto encontrado no notas.json para este cliente.</p>
            ) : (
              <ol className="top-lista">
                {maisComprados.map((p, i) => (
                  <li key={p.codigo}>
                    <span className="top-pos">{i + 1}</span>
                    <span className="top-desc">{p.descricao}</span>
                    <span className="top-qtd">{p.quantidade} {p.unidade}</span>
                    <span className="top-valor">{fmtMoeda(p.valor)}</span>
                  </li>
                ))}
              </ol>
            )}
          </div>
          <div className="cliente-secao">
            <h3>📉 Produtos menos recorrentes</h3>
            {carregandoProdutos ? (
              <p className="empty">Carregando produtos...</p>
            ) : erroProdutos ? (
              <p className="form-erro">{erroProdutos}</p>
            ) : menosComprados.length === 0 ? (
              <p className="empty">Nenhum produto encontrado no notas.json para este cliente.</p>
            ) : (
              <ol className="top-lista">
                {menosComprados.map((p, i) => (
                  <li key={p.codigo}>
                    <span className="top-pos">{i + 1}</span>
                    <span className="top-desc">{p.descricao}</span>
                    <span className="top-qtd">{p.aparicoes} aparições · {p.quantidade} {p.unidade}</span>
                    <span className="top-valor">{fmtMoeda(p.valor)}</span>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </>
      )}
      {/* ===== NOVO: aba Padrão de Compra ===== */}
      {aba === 'padrao' && (
        <div className="cliente-secao">
          <style>{estiloPadrao}</style>
          <div className="padrao-topo">
            <label>Período de análise:</label>
            <select value={padraoMeses} onChange={(e) => setPadraoMeses(Number(e.target.value))}>
              <option value={3}>Últimos 3 meses</option>
              <option value={6}>Últimos 6 meses</option>
              <option value={9}>Últimos 9 meses</option>
              <option value={12}>Últimos 12 meses</option>
            </select>
          </div>
          {carregandoPadrao ? (
            <p className="empty">Analisando padrão de compra...</p>
          ) : erroPadrao ? (
            <p className="form-erro">{erroPadrao}</p>
          ) : !padrao || (padrao.sempre.length + padrao.parou.length + padrao.comecou.length + padrao.esporadico.length) === 0 ? (
            <p className="empty">Nenhuma compra encontrada nas notas fiscais nos últimos {padraoMeses} meses.</p>
          ) : (
            <>
              {padrao.sempre.length > 0 && (
                <div className="padrao-bloco sempre">
                  <h4>✅ Sempre compra (recorrente)</h4>
                  <p className="padrao-resumo">Presente em metade ou mais dos {padrao.meses.length} meses analisados — faz parte da rotina do cliente.</p>
                  <ul className="padrao-lista">
                    {padrao.sempre.map((p, i) => (
                      <li key={i} className="padrao-item">
                        <div>
                          <span className="p-desc">{p.descricao}</span> <span className="p-cod">({p.codigo})</span>
                        </div>
                        <div className="p-meta">
                          {p.qtdMeses}/{padrao.meses.length} meses · {p.mediaMensal} {p.unidade}/mês · <span className="p-valor">{fmtMoeda(p.valorTotal)}</span>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {padrao.parou.length > 0 && (
                <div className="padrao-bloco parou">
                  <h4>⚠️ Parou de comprar</h4>
                  <p className="padrao-resumo">Comprava com frequência e não compra nos últimos 2 meses — oportunidade de reativação.</p>
                  <ul className="padrao-lista">
                    {padrao.parou.map((p, i) => (
                      <li key={i} className="padrao-item">
                        <div>
                          <span className="p-desc">{p.descricao}</span> <span className="p-cod">({p.codigo})</span>
                        </div>
                        <div className="p-meta">
                          <span className="badge-padrao badge-parou">há {p.mesesSemComprar} {p.mesesSemComprar === 1 ? 'mês' : 'meses'}</span>
                          <div><span className="p-valor">{fmtMoeda(p.valorTotal)}</span> · última {fmtMesAno(p.ultimaCompra)}</div>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {padrao.comecou.length > 0 && (
                <div className="padrao-bloco comecou">
                  <h4>🆕 Começou a comprar</h4>
                  <p className="padrao-resumo">Não comprava antes e passou a comprar nos últimos 2 meses — novo hábito para reforçar (upsell).</p>
                  <ul className="padrao-lista">
                    {padrao.comecou.map((p, i) => (
                      <li key={i} className="padrao-item">
                        <div>
                          <span className="p-desc">{p.descricao}</span> <span className="p-cod">({p.codigo})</span>
                        </div>
                        <div className="p-meta">
                          <span className="badge-padrao badge-comecou">desde {fmtMesAno(p.primeiraCompra)}</span>
                          <div><span className="p-valor">{fmtMoeda(p.valorTotal)}</span></div>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {padrao.esporadico.length > 0 && (
                <div className="padrao-bloco esporadico">
                  <h4>💤 Compras esporádicas</h4>
                  <p className="padrao-resumo">Aparecem sem frequência definida nos {padrao.meses.length} meses analisados.</p>
                  <ul className="padrao-lista">
                    {padrao.esporadico.map((p, i) => (
                      <li key={i} className="padrao-item">
                        <div>
                          <span className="p-desc">{p.descricao}</span> <span className="p-cod">({p.codigo})</span>
                        </div>
                        <div className="p-meta"><span className="p-valor">{fmtMoeda(p.valorTotal)}</span></div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}
        </div>
      )}
      {aba === 'rotina' && (
        <div className="cliente-secao">
          <RotinaLaboratorio
            inline
            cliente={rotinaCliente || c}
            comprasNotas={comprasNotas}
            onSalvar={async ({ rotinas, equipamentos }) => {
              const atualizado = { ...(rotinaCliente || c), rotinas, equipamentos }
              const res = await window.api.atualizarCliente(atualizado)
              if (res && res.ok) {
                setDados((prev) => (prev && prev.ok ? { ...prev, cliente: atualizado } : prev))
                setRotinaCliente(atualizado)
                mostrarAviso('🧪 Rotina do laboratório salva!')
              } else {
                mostrarAviso('⚠️ Erro ao salvar a rotina.')
              }
            }}
          />
        </div>
      )}
      {aba === 'historico' && (
        <div className="cliente-secao historico-secao">
          <h3>📞 Histórico de Interações</h3>
          <div className="historico-form">
            <select value={novoTipo} onChange={(e) => setNovoTipo(e.target.value)}>
              <option value="ligacao">📞 Liguei</option>
              <option value="promocao">🎁 Enviei promoção</option>
              <option value="visita">📅 Agendei visita</option>
              <option value="proposta">📄 Enviei proposta</option>
              <option value="obs">📝 Observação</option>
            </select>
            <input
              value={novaDesc}
              onChange={(e) => setNovaDesc(e.target.value)}
              placeholder="O que aconteceu com o cliente?"
              onKeyDown={(e) => e.key === 'Enter' && adicionarHistorico()}
            />
            <button onClick={adicionarHistorico} disabled={salvando}>
              {salvando ? 'Salvando...' : 'Adicionar'}
            </button>
          </div>
          {historico.length === 0 ? (
            <p className="empty">Nenhuma interação registrada ainda.</p>
          ) : (
            <ul className="historico-lista">
              {historico.slice().reverse().map((item, i) => (
                <li key={i}>
                  <strong>{fmtDataHora(item.data)}</strong> · {ROTULOS_TIPO[item.tipo] || item.tipo} — {item.descricao}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}