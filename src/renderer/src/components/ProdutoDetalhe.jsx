import { useEffect, useState } from 'react'
import { fmtMoeda, fmtData } from '../utils/format'
import ClienteDetalhe from './ClienteDetalhe'
const MESES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
const ABAS_PRODUTO = [
  { id: 'preco', rotulo: '📈 Variação de Preço' },
  { id: 'concorrentes', rotulo: '🏷️ Concorrentes' },
  { id: 'notas', rotulo: '🧾 Ocorrências nas notas' }
]
const estilo = `
  .cliente-abas { display: flex; gap: 4px; flex-wrap: wrap; margin: 18px 0 14px; border-bottom: 2px solid #e2e8f0; }
  .cliente-aba { padding: 9px 16px; font-size: 13px; font-weight: 600; border: 1px solid transparent; border-bottom: none; border-radius: 8px 8px 0 0; background: transparent; color: #64748b; cursor: pointer; transition: all .15s; }
  .cliente-aba:hover { background: #f1f5f9; color: #0f172a; }
  .cliente-aba.ativa { background: #fff; border-color: #e2e8f0; color: #2563eb; box-shadow: inset 0 -2px 0 #2563eb; }
  .graf { display: flex; align-items: flex-end; gap: 6px; height: 220px; padding: 10px 6px 0; border: 1px solid #e2e8f0; border-radius: 10px; background: #fff; }
  .graf-col { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: flex-end; height: 100%; position: relative; min-width: 24px; }
  .graf-faixa { position: absolute; bottom: 22px; width: 100%; background: #dbeafe; opacity: .35; border-radius: 3px 3px 0 0; }
  .graf-bar { width: 60%; background: #2563eb; border-radius: 4px 4px 0 0; min-height: 2px; position: relative; z-index: 1; }
  .graf-valor { position: relative; z-index: 2; font-size: 10px; font-weight: 700; color: #1e3a8a; white-space: nowrap; margin-bottom: 2px; }
  .graf-rotulo { font-size: 10px; color: #64748b; margin-top: 4px; }
  .graf-vazio { font-size: 11px; color: #94a3b8; margin-top: 4px; }
  .conc-form { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 14px; }
  .conc-form input, .conc-form select { padding: 8px 10px; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 13px; }
  .conc-busca { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin: 12px 0 8px; }
  .conc-busca-dica { font-size: 12px; color: #64748b; }
  .cota-resultados { margin: 6px 0 16px; padding: 12px; border: 1px dashed #cbd5e1; border-radius: 10px; background: #f8fafc; }
  .cota-resultados h4 { margin: 0 0 4px; font-size: 13px; }
  .cota-site-titulo { font-size: 12px; font-weight: 700; color: #334155; margin: 8px 0 6px; }
  .conc-list { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 8px; }
  .conc-item { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 10px 12px; border: 1px solid #e2e8f0; border-radius: 8px; background: #fff; font-size: 13px; flex-wrap: wrap; }
  .conc-meta { text-align: right; font-size: 12px; color: #64748b; }
  .badge-dif { display: inline-block; padding: 2px 8px; border-radius: 999px; font-size: 11px; font-weight: 700; }
  .dif-abaixo { background: #dcfce7; color: #15803d; }
  .dif-acima { background: #fee2e2; color: #b91c1c; }
  .badge-emb { display: inline-block; padding: 2px 8px; border-radius: 999px; font-size: 11px; font-weight: 700; background: #e0e7ff; color: #4338ca; }
  .btn-remover { background: none; border: 1px solid #fecaca; color: #b91c1c; border-radius: 6px; padding: 3px 8px; font-size: 11px; cursor: pointer; }
  .btn-remover:hover { background: #fef2f2; }
  .btn-use { background: #2563eb; color: #fff; border: none; border-radius: 6px; padding: 4px 10px; font-size: 12px; font-weight: 600; cursor: pointer; margin-top: 6px; }
  .btn-use:hover { background: #1d4ed8; }
  .btn-use:disabled { opacity: .5; cursor: not-allowed; }
  .link-cliente { background: none; border: none; color: #2563eb; cursor: pointer; font-size: 13px; padding: 0; text-align: left; font-weight: 600; }
  .link-cliente:hover { text-decoration: underline; }
  .link-externo { background: none; border: none; color: #2563eb; cursor: pointer; font-size: 12px; padding: 0; text-decoration: underline; }
  .link-externo:hover { color: #1e40af; }
  .marca-bloco { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
  .marca-bloco input { padding: 6px 10px; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 13px; min-width: 200px; }
  .marca-salva { font-size: 12px; font-weight: 600; color: #15803d; }
  .toast-sucesso { background: #dcfce7; color: #15803d; padding: 8px 14px; border-radius: 8px; margin-bottom: 12px; font-size: 13px; font-weight: 600; }
  .produto-marca-badge { display: inline-block; margin-left: 10px; padding: 3px 12px; border-radius: 999px; background: #e0e7ff; color: #4338ca; font-size: 13px; font-weight: 700; vertical-align: middle; }
  .busca-manual { display: flex; gap: 8px; align-items: center; margin: 10px 0; flex-wrap: wrap; }
  .busca-manual input { flex: 1; min-width: 200px; padding: 8px 12px; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 13px; }
  .busca-manual button { white-space: nowrap; }
`
export default function ProdutoDetalhe({ codigo, onVoltar }) {
  const [dados, setDados] = useState(null)
  const [clienteAberto, setClienteAberto] = useState(null)
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')
  const [aba, setAba] = useState('preco')
  const [anos, setAnos] = useState([])
  const [anoFiltro, setAnoFiltro] = useState('total')
  const [site, setSite] = useState('')
  const [valor, setValor] = useState('')
  const [data, setData] = useState(new Date().toISOString().slice(0, 10))
  const [link, setLink] = useState('')
  const [obs, setObs] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [aviso, setAviso] = useState('')
  const [cotando, setCotando] = useState(false)
  const [resultadosCota, setResultadosCota] = useState([])
  const [msgCota, setMsgCota] = useState('')
  const [marca, setMarca] = useState('')
  // ===== NOVO: busca manual =====
  const [buscaManual, setBuscaManual] = useState('')
  const [cotandoManual, setCotandoManual] = useState(false)

  useEffect(() => {
    if (!window.api || typeof window.api.produtoDetalhe !== 'function') {
      setErro('Função produtoDetalhe não disponível. Verifique o preload/index.js.')
      setCarregando(false)
      return
    }
    setCarregando(true)
    setErro('')
    window.api.produtoDetalhe(codigo, anoFiltro)
      .then((res) => {
        if (res && res.ok) {
          setDados(res)
          if (res.produto && res.produto.marca != null) setMarca(res.produto.marca)
        } else {
          setErro((res && res.erro) || 'Produto não encontrado.')
        }
      })
      .catch(() => setErro('Falha ao carregar o produto.'))
      .finally(() => setCarregando(false))
  }, [codigo, anoFiltro])

  useEffect(() => {
    if (!window.api || typeof window.api.notasAnos !== 'function') return
    window.api.notasAnos().then((res) => {
      if (res && res.ok) setAnos(res.anos || [])
    }).catch(() => setAnos([]))
  }, [])

  const recarregar = () => {
    if (!window.api || typeof window.api.produtoDetalhe !== 'function') return
    window.api.produtoDetalhe(codigo, anoFiltro).then((res) => {
      if (res && res.ok) {
        setDados(res)
        if (res.produto && res.produto.marca != null) setMarca(res.produto.marca)
      }
    }).catch(() => {})
  }

  const salvar = () => {
    const v = parseFloat(String(valor).replace(',', '.'))
    if (!site.trim() || !v || v <= 0) return
    setSalvando(true)
    window.api.salvarConcorrente({
      codigo, site: site.trim(), valor: v, data, link: link.trim(), observacao: obs.trim()
    })
      .then((res) => {
        if (res && res.ok) {
          setSite(''); setValor(''); setLink(''); setObs('')
          setAviso('✅ Preço do concorrente salvo!')
          setTimeout(() => setAviso(''), 3000)
          recarregar()
        }
      })
      .catch(() => setAviso('⚠️ Erro ao salvar.'))
      .finally(() => setSalvando(false))
  }

  const remover = (id) => {
    if (!window.confirm('Remover este preço de concorrente?')) return
    window.api.deletarConcorrente(codigo, id)
      .then((res) => { if (res && res.ok) recarregar() })
      .catch(() => {})
  }

  const abrirLink = (u) => {
    if (u && window.api && typeof window.api.abrirExterno === 'function') {
      window.api.abrirExterno(u)
    }
  }

  // ===== NOVO: cotar automático com termo (produto + marca) =====
const cotar = (termoPersonalizado) => {
  if (!dados || !dados.produto) return
  if (!window.api || typeof window.api.cotarProduto !== 'function') {
    setMsgCota('Função cotarProduto não disponível. Verifique o preload/index.js.')
    return
  }
  const desc = dados.produto.descricao || dados.produto.nome || ''
  const termo = termoPersonalizado || (desc + (marca.trim() ? ' ' + marca.trim() : '')).trim()
  if (!termo) {
    setMsgCota('Digite um termo na busca manual para pesquisar.')
    return
  }
  if (termoPersonalizado) setCotandoManual(true)
  else setCotando(true)
  setMsgCota('')
  setResultadosCota([])
  window.api.cotarProduto(termo)
    .then((res) => {
      if (res && res.ok) {
        setResultadosCota(res.porSite || [])
        if (res.avisos && res.avisos.length > 0) setMsgCota(res.avisos.join(' '))
        if (!res.porSite || res.porSite.length === 0) {
          setMsgCota((res.avisos && res.avisos.length > 0 ? res.avisos.join(' ') + ' ' : '') + 'Nenhum resultado encontrado. Use a busca manual abaixo para tentar outro termo.')
        }
      } else {
        setMsgCota((res && res.erro) || 'Falha na cotação.')
      }
    })
    .catch(() => setMsgCota('Falha na cotação (rede ou bloqueio).'))
    .finally(() => { setCotando(false); setCotandoManual(false) })
}

  const usarResultadoCota = (r, nomeSite) => {
    if (!r || r.preco == null || r.preco <= 0) return
    const unid = String((dados && dados.produto && dados.produto.unidade) || '').trim().toUpperCase()
    const ehUnidade = !unid || ['UN', 'UND', 'UNID', 'PC', 'PEC', 'PECA', 'PÇ'].includes(unid)
    const valorBase = (ehUnidade && r.precoUnitario != null) ? r.precoUnitario : r.preco
    setSite(r.loja || nomeSite || '')
    setValor(String(valorBase != null ? valorBase : ''))
    setLink(r.link || '')
    setObs((r.titulo ? r.titulo : '') + (r.embalagem ? ' — ' + r.embalagem : ''))
    setAviso('✅ Preço preenchido para conferência. Ajuste se preciso e clique em Salvar.')
    setTimeout(() => setAviso(''), 4000)
  }

  if (clienteAberto) {
    return <ClienteDetalhe clienteId={clienteAberto} onVoltar={() => setClienteAberto(null)} />
  }

  if (carregando) {
    return (
      <div className="painel">
        <div className="cliente-detalhe-topo">
          <button className="btn-voltar" onClick={onVoltar}>← Voltar</button>
        </div>
        <p className="empty">Carregando produto...</p>
      </div>
    )
  }

  if (erro) {
    return (
      <div className="painel">
        <div className="cliente-detalhe-topo">
          <button className="btn-voltar" onClick={onVoltar}>← Voltar</button>
        </div>
        <h2>Produto</h2>
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
        <h2>Produto</h2>
        <p className="empty">Produto não encontrado.</p>
      </div>
    )
  }

  const p = dados.produto
  const serie = p.serie || []
  const maxVal = Math.max.apply(null, serie.map((s) => Math.max(s.max || 0, s.media || 0)).concat([1]))
  const comMin = serie.filter((s) => s.min != null)
  const comMax = serie.filter((s) => s.max != null)
  const menorPeriodo = comMin.length ? Math.min.apply(null, comMin.map((s) => s.min)) : 0
  const maiorPeriodo = comMax.length ? Math.max.apply(null, comMax.map((s) => s.max)) : 0
  const destaqueValor = (p.precoMedioMes != null) ? p.precoMedioMes : p.precoMedioAno
  const destaqueRotulo = (p.precoMedioMes != null && p.mesPrecoMedioRotulo)
    ? ('último mês: ' + p.mesPrecoMedioRotulo)
    : (anoFiltro === 'total' ? 'período' : anoFiltro)

  return (
    <div className="painel">
      <style>{estilo}</style>
      {aviso && <div className="toast-sucesso">{aviso}</div>}
      <div className="cliente-detalhe-topo">
        <button className="btn-voltar" onClick={onVoltar}>← Voltar</button>
        <div className="top-filtro-ano">
          <label>Período:</label>
          <select value={anoFiltro} onChange={(e) => setAnoFiltro(e.target.value)}>
            <option value="total">Total (todos os anos)</option>
            {anos.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>
      </div>
      <h2 className="cliente-titulo">
        {p.descricao}
        {marca.trim() && <span className="produto-marca-badge">{marca}</span>}
      </h2>
      <div className="cliente-info-grid">
        <div className="info-card"><span className="info-label">Código</span><span>{p.codigo}</span></div>
        <div className="info-card"><span className="info-label">Unidade</span><span>{p.unidade || '—'}</span></div>
        <div className="info-card"><span className="info-label">Ocorrências nas notas</span><span>{p.ocorrencias ? p.ocorrencias.length : 0}</span></div>
      </div>
      {marca.trim() && (
        <div className="cliente-secao" style={{ padding: '10px 0' }}>
          <div className="marca-bloco">
            <span className="info-label" style={{ fontWeight: 600 }}>🏷️ Marca (nota):</span>
            <span style={{ fontWeight: 700, fontSize: 15, color: '#1e293b' }}>{marca}</span>
          </div>
          <p style={{ fontSize: 12, color: '#64748b', margin: '6px 0 0' }}>
            Marca lida automaticamente da nota fiscal mais recente. Usada nas cotações.
          </p>
        </div>
      )}
      <div className="stats-grid">
        <div className="stat-card stat-destaque" title="Média do preço unitário no último mês em que o produto apareceu nas notas.">
          <strong>{fmtMoeda(destaqueValor)}</strong><span>Preço médio ({destaqueRotulo})</span>
        </div>
        <div className="stat-card" title="Média do preço unitário em todo o período do filtro.">
          <strong>{fmtMoeda(p.precoMedioAno)}</strong><span>Média do períod.</span>
        </div>
        <div className="stat-card" title="Menor valor unitário encontrado nas notas do período.">
          <strong>{fmtMoeda(menorPeriodo)}</strong><span>Menor do período</span>
        </div>
        <div className="stat-card" title="Maior valor unitário encontrado nas notas do período.">
          <strong>{fmtMoeda(maiorPeriodo)}</strong><span>Maior do período</span>
        </div>
      </div>
      {p.variacaoAno !== null && (
        <div className={'variacao ' + (p.variacaoAno >= 0 ? 'variacao-ruim' : 'variacao-ok')} title="Variação entre a primeira e a última média mensal do período (preço subiu ou caiu).">
          {p.variacaoAno >= 0 ? '▲' : '▼'} {Math.abs(p.variacaoAno)}% de variação no período
        </div>
      )}
      <div className="cliente-abas">
        {ABAS_PRODUTO.map((a) => (
          <button
            key={a.id}
            type="button"
            className={'cliente-aba ' + (aba === a.id ? 'ativa' : '')}
            onClick={() => setAba(a.id)}
          >
            {a.rotulo}
          </button>
        ))}
      </div>
      {aba === 'preco' && (
        <div className="cliente-secao">
          <h3>📈 Variação do preço unitário ({anoFiltro === 'total' ? 'todos os anos' : anoFiltro})</h3>
          <div className="graf">
            {serie.map((s) => (
              <div
                key={s.mes}
                className="graf-col"
                title={'Mês ' + MESES[s.mes - 1] + ': média ' + fmtMoeda(s.media) + (s.min != null ? ' · faixa ' + fmtMoeda(s.min) + ' a ' + fmtMoeda(s.max) : '')}
              >
                {s.max != null && (
                  <div className="graf-faixa" style={{ height: ((s.max / maxVal) * 100) + '%' }} />
                )}
                {s.media != null && (
                  <span className="graf-valor">{fmtMoeda(s.media)}</span>
                )}
                <div className="graf-bar" style={{ height: (s.media != null ? (s.media / maxVal) * 100 : 2) + '%' }} />
                <span className="graf-rotulo">{MESES[s.mes - 1]}</span>
                {s.media == null && <span className="graf-vazio">—</span>}
              </div>
            ))}
          </div>
          <p className="moda-sub" style={{ fontSize: 12, color: '#64748b' }}>
            Cada barra é a média mensal (valor em R$ acima); a faixa clara mostra o menor e o maior valor do mês. Meses sem nota ficam vazios.
          </p>
        </div>
      )}
      {aba === 'concorrentes' && (
        <div className="cliente-secao">
          <h3>🏷️ Preços dos concorrentes</h3>
          <div className="conc-busca">
            <button className="btn-primary" onClick={() => cotar()} disabled={cotando}>
              {cotando ? 'Cotando...' : '📋 Cotar na Centerlab'}
            </button>
            <span className="conc-busca-dica">
              Busca automática no site (produto + marca) e traz o valor real com a embalagem detectada.
            </span>
          </div>
          {msgCota && <p className="form-erro">{msgCota}</p>}
          {resultadosCota.length > 0 && (
            <div className="cota-resultados">
              <h4>Resultados da cotação</h4>
              {resultadosCota.map((bloco, bi) => (
                <div key={bi}>
                  <div className="cota-site-titulo">🛒 {bloco.site}</div>
                  <ul className="conc-list">
                    {bloco.resultados.map((r, ri) => (
                      <li key={ri} className="conc-item">
                        <div>
                          <strong>{r.titulo}</strong>
                          {r.marca && <div className="conc-meta">Marca: {r.marca}</div>}
                          {r.embalagem && <span className="badge-emb">embalagem: {r.embalagem}</span>}
                          {r.link && (
                            <div><button className="link-externo" onClick={() => abrirLink(r.link)}>ver no site ↗</button></div>
                          )}
                        </div>
                        <div className="conc-meta">
                          <div style={{ fontWeight: 700, fontSize: 14 }}>{fmtMoeda(r.preco)}</div>
                          {r.precoUnitario != null && (
                            <div>≈ {fmtMoeda(r.precoUnitario)} por un</div>
                          )}
                          <button className="btn-use" onClick={() => usarResultadoCota(r, bloco.site)}>
                            Usar este preço
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
          {/* ===== NOVO: barra de busca manual ===== */}
          <div className="busca-manual">
            <input
              placeholder="Buscar outro termo (ex.: nome do produto + marca)..."
              value={buscaManual}
              onChange={(e) => setBuscaManual(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && buscaManual.trim()) cotar(buscaManual.trim()) }}
            />
            <button className="btn-primary" onClick={() => { if (buscaManual.trim()) cotar(buscaManual.trim()) }} disabled={cotandoManual}>
              {cotandoManual ? 'Buscando...' : '🔍 Buscar'}
            </button>
          </div>
          <div className="conc-form">
            <input placeholder="Site / concorrente" value={site} onChange={(e) => setSite(e.target.value)} style={{ flex: 1, minWidth: 160 }} />
            <input placeholder="Valor (R$)" value={valor} onChange={(e) => setValor(e.target.value)} style={{ width: 110 }} />
            <input type="date" value={data} onChange={(e) => setData(e.target.value)} style={{ width: 140 }} />
            <input placeholder="Link (opcional)" value={link} onChange={(e) => setLink(e.target.value)} style={{ flex: 1, minWidth: 140 }} />
            <input placeholder="Obs. (opcional)" value={obs} onChange={(e) => setObs(e.target.value)} style={{ flex: 1, minWidth: 140 }} />
            <button className="btn-primary" onClick={salvar} disabled={salvando}>
              {salvando ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
          {p.concorrentes.length === 0 ? (
            <p className="empty">Nenhum preço de concorrente cadastrado para este produto ainda.</p>
          ) : (
            <ul className="conc-list">
              {p.concorrentes.map((c) => (
                <li key={c.id} className="conc-item">
                  <div>
                    <strong>{c.site}</strong>
                    {c.link && <div><button className="link-externo" onClick={() => abrirLink(c.link)}>ver anúncio ↗</button></div>}
                    {c.observacao && <div className="conc-meta">{c.observacao}</div>}
                  </div>
                  <div className="conc-meta">
                    <div style={{ fontWeight: 700, fontSize: 14 }}>{fmtMoeda(c.valor)}</div>
                    {c.diferenca !== null && (
                      <span className={'badge-dif ' + (c.diferenca >= 0 ? 'dif-acima' : 'dif-abaixo')}>
                        {c.diferenca >= 0 ? 'seu preço maior +' : 'seu preço menor '}{Math.abs(c.diferenca)}%
                      </span>
                    )}
                    <div>{fmtData(c.data)}</div>
                    <button className="btn-remover" onClick={() => remover(c.id)}>Remover</button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      {aba === 'notas' && (
        <div className="cliente-secao">
          <h3>🧾 Ocorrências nas notas ({p.ocorrencias.length})</h3>
          {p.ocorrencias.length === 0 ? (
            <p className="empty">Nenhuma ocorrência no período.</p>
          ) : (
            <div className="tabela-wrap">
              <table className="tabela">
                <thead>
                  <tr>
                    <th>Data</th><th>Cliente</th><th>Nº Nota</th>
                    <th>Un.</th><th>Qtd</th><th>Vlr unitário</th><th>Vlr total</th>
                  </tr>
                </thead>
                <tbody>
                  {p.ocorrencias.slice(0, 100).map((o, i) => (
                    <tr key={i}>
                      <td>{fmtData(o.data)}</td>
                      <td>
                        {o.clienteId ? (
                          <button
                            className="link-cliente"
                            onClick={() => setClienteAberto(o.clienteId)}
                            title={'Abrir ficha do cliente ' + (o.clienteCarteira || o.cliente || '')}
                          >
                            {o.clienteCarteira || o.cliente || '—'}
                          </button>
                        ) : (
                          <span>{o.cliente || '—'}</span>
                        )}
                      </td>
                      <td>
							{o.numeroNota ? (
							<button
							className="link-cliente"
							style={{ fontWeight: 600 }}
							onClick={() => window.api && window.api.abrirPdfNota && window.api.abrirPdfNota(o.numeroNota)}
							title="Abrir PDF da nota"
						>
							📄 {o.numeroNota}
						</button>
						) : (
						<span>—</span>
						)}
					</td>
                      <td>{o.unidade}</td>
                      <td>{o.quantidade}</td>
                      <td>{fmtMoeda(o.valorUnitario)}</td>
                      <td>{fmtMoeda(o.valorTotal)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  )
}