import { useEffect, useState } from 'react'

export default function ClienteDetalhe({ clienteId, onVoltar }) {
  const [dados, setDados] = useState(null)
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')

  useEffect(() => {
    setCarregando(true)
    setErro('')
    if (!window.api || typeof window.api.estatisticasCliente !== 'function') {
      setErro('Função de estatísticas não disponível. Verifique o preload/index.js.')
      setCarregando(false)
      return
    }
    window.api.estatisticasCliente(clienteId)
      .then((res) => {
        setDados(res)
        setCarregando(false)
      })
      .catch((err) => {
        console.error('Erro ao carregar estatísticas:', err)
        setErro('Falha ao carregar as estatísticas do cliente.')
        setCarregando(false)
      })
  }, [clienteId])

  if (carregando) return <div className="painel"><p>Carregando estatísticas...</p></div>

  if (erro) {
    return (
      <div className="painel">
        <button className="btn-acao" onClick={onVoltar}>← Voltar</button>
        <h2>Estatísticas do cliente</h2>
        <p className="form-erro">{erro}</p>
      </div>
    )
  }

  if (!dados || !dados.ok) {
    return (
      <div className="painel">
        <button className="btn-acao" onClick={onVoltar}>← Voltar</button>
        <h2>Estatísticas do cliente</h2>
        <p>Cliente não encontrado.</p>
      </div>
    )
  }

  const c = dados.cliente
  const e = dados.estatisticas

  const saudeLabel = { novo: '🆕 Novo', ativo: '✅ Ativo', atencao: '⚠️ Atenção', risco: '🔴 Risco' }
  const saudeClasse = { novo: 'saude-novo', ativo: 'saude-ativo', atencao: 'saude-atencao', risco: 'saude-risco' }

  return (
    <div className="painel">
      <button className="btn-acao" onClick={onVoltar}>← Voltar</button>

      <div className="cliente-detalhe-cabecalho">
        <h2>{c.nome}</h2>
        <span className={'saude ' + (saudeClasse[e.saude] || '')}>{saudeLabel[e.saude] || e.saude}</span>
        <span className={'abc abc-' + e.classeAbc}>Curva {e.classeAbc}</span>
      </div>

      {/* Dados cadastrais completos */}
      <div className="cliente-info-grid">
        {c.codigo && <div className="info-item"><span className="info-label">ID</span><span>{c.codigo}</span></div>}
        {c.cnpj && <div className="info-item"><span className="info-label">CNPJ</span><span>{c.cnpj}</span></div>}
        {c.email && <div className="info-item"><span className="info-label">E-mail</span><span>{c.email}</span></div>}
        {c.whats && <div className="info-item"><span className="info-label">WhatsApp</span><span>{c.whats}</span></div>}
        {c.cidade && <div className="info-item"><span className="info-label">Cidade</span><span>{c.cidade}</span></div>}
        {c.segmento && <div className="info-item"><span className="info-label">Segmento</span><span>{c.segmento}</span></div>}
      </div>

      <div className="stats-grid">
        <div className="stat-card"><strong>{e.totalVendas}</strong><span>Vendas</span></div>
        <div className="stat-card"><strong>R$ {Number(e.totalGasto).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong><span>Total gasto</span></div>
        <div className="stat-card"><strong>R$ {Number(e.ticketMedio).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong><span>Ticket médio</span></div>
        <div className="stat-card"><strong>{e.intervaloDias ? e.intervaloDias + ' dias' : '—'}</strong><span>Frequência média</span></div>
        <div className="stat-card"><strong>{e.frequenciaMensal ? e.frequenciaMensal + '/mês' : '—'}</strong><span>Compras/mês</span></div>
        <div className="stat-card"><strong>{e.diaComum || '—'}</strong><span>Dia mais comum</span></div>
        <div className="stat-card"><strong>{e.diasDesdeUltima !== null ? e.diasDesdeUltima + ' dias' : '—'}</strong><span>Desde última compra</span></div>
        <div className="stat-card"><strong>R$ {Number(e.totalAnoAtual).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong><span>Total no ano ({new Date().getFullYear()})</span></div>
      </div>

      {e.variacaoAnual !== null && (
        <div className={'variacao ' + (e.variacaoAnual >= 0 ? 'variacao-ok' : 'variacao-ruim')}>
          {e.variacaoAnual >= 0 ? '▲' : '▼'} {Math.abs(e.variacaoAnual)}% vs ano anterior
        </div>
      )}

      <div className="cliente-secao">
        <h3>Últimas compras</h3>
        {e.ultimasCompras.length === 0 ? (
          <p>Nenhuma venda registrada para este cliente.</p>
        ) : (
          <table className="tabela">
            <thead>
              <tr><th>Data</th><th>Insumos</th><th>Equipamento</th><th>Valor</th></tr>
            </thead>
            <tbody>
              {e.ultimasCompras.map((v, i) => (
                <tr key={i}>
                  <td>{v.data}</td>
                  <td>{v.insumos}</td>
                  <td>{v.equipamento}</td>
                  <td>R$ {Number(v.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}