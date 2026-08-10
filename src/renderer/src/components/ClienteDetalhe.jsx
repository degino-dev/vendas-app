import { useEffect, useState } from 'react'

const fmtMoeda = (v) =>
  Number(v || 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })

const fmtCnpj = (v) => {
  const s = String(v || '').replace(/\D/g, '')
  if (s.length !== 14) return v || ''
  return `${s.slice(0, 2)}.${s.slice(2, 5)}.${s.slice(5, 8)}/${s.slice(8, 12)}-${s.slice(12)}`
}

const fmtFone = (v) => {
  const s = String(v || '').replace(/\D/g, '')
  if (s.length === 11) return `(${s.slice(0, 2)}) ${s.slice(2, 7)}-${s.slice(7)}`
  if (s.length === 10) return `(${s.slice(0, 2)}) ${s.slice(2, 6)}-${s.slice(6)}`
  return v || ''
}

export default function ClienteDetalhe({ clienteId, onVoltar }) {
  const [dados, setDados] = useState(null)
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')

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
    return () => {
      ativo = false
    }
  }, [clienteId])

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

  return (
    <div className="painel">
      <div className="cliente-detalhe-topo">
        <button className="btn-voltar" onClick={onVoltar}>← Voltar</button>
        <div className="cliente-badges">
          <span className={'badge ' + saude.classe}>{saude.label}</span>
          <span className={'badge badge-abc abc-' + e.classeAbc}>Curva {e.classeAbc}</span>
        </div>
      </div>

      <h2 className="cliente-titulo">{c.nome}</h2>

      {/* Dados cadastrais */}
      <div className="cliente-info-grid">
        {c.codigo && <div className="info-card"><span className="info-label">ID</span><span>{c.codigo}</span></div>}
        {c.cnpj && <div className="info-card"><span className="info-label">CNPJ</span><span>{fmtCnpj(c.cnpj)}</span></div>}
        {c.email && <div className="info-card"><span className="info-label">E-mail</span><span>{c.email}</span></div>}
        {c.whats && <div className="info-card"><span className="info-label">WhatsApp</span><span>{fmtFone(c.whats)}</span></div>}
        {c.cidade && <div className="info-card"><span className="info-label">Cidade</span><span>{c.cidade}</span></div>}
        {c.segmento && <div className="info-card"><span className="info-label">Segmento</span><span>{c.segmento}</span></div>}
      </div>

      {/* Indicadores */}
      <div className="stats-grid">
        <div className="stat-card"><strong>{e.totalVendas}</strong><span>Vendas</span></div>
        <div className="stat-card"><strong>{fmtMoeda(e.totalGasto)}</strong><span>Total gasto</span></div>
        <div className="stat-card"><strong>{fmtMoeda(e.ticketMedio)}</strong><span>Ticket médio</span></div>
        <div className="stat-card"><strong>{e.intervaloDias ? e.intervaloDias + ' dias' : '—'}</strong><span>Frequência média</span></div>
        <div className="stat-card"><strong>{e.frequenciaMensal ? e.frequenciaMensal + '/mês' : '—'}</strong><span>Compras/mês</span></div>
        <div className="stat-card"><strong>{e.diaComum || '—'}</strong><span>Dia mais comum</span></div>
        <div className="stat-card"><strong>{e.diasDesdeUltima != null ? e.diasDesdeUltima + ' dias' : '—'}</strong><span>Desde última compra</span></div>
        <div className="stat-card"><strong>{fmtMoeda(e.totalAnoAtual)}</strong><span>Total no ano ({new Date().getFullYear()})</span></div>
      </div>

      {e.variacaoAnual !== null && (
        <div className={'variacao ' + (e.variacaoAnual >= 0 ? 'variacao-ok' : 'variacao-ruim')}>
          {e.variacaoAnual >= 0 ? '▲' : '▼'} {Math.abs(e.variacaoAnual)}% vs ano anterior
        </div>
      )}

      <div className="cliente-secao">
        <h3>Últimas compras</h3>
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
                    <td>{v.data}</td>
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
    </div>
  )
}