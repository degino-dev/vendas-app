import { useEffect, useState } from 'react'

export default function Insights({ usuario }) {
  const [dados, setDados] = useState(null)
  const [carregando, setCarregando] = useState(true)

  function carregar() {
    setCarregando(true)
    window.api.gerarInsights().then((res) => {
      setDados(res)
      setCarregando(false)
    })
  }

  useEffect(() => {
    carregar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [usuario])

  async function marcar(acao, chave) {
    await window.api.marcarInsight({ acao, chave })
    carregar() // recarrega para refletir o novo estado
  }

  if (carregando) return <div className="painel"><p>Calculando dicas...</p></div>

  if (!dados || !dados.dicas || dados.dicas.length === 0) {
    return (
      <div className="painel">
        <h2>💡 Dicas do dia</h2>
        <p>Nenhuma dica pendente no momento. Novas sugestões aparecem aqui conforme os padrões de compra dos seus clientes se formam.</p>
      </div>
    )
  }

  const tipoClasse = { risco: 'dica-risco', momento: 'dica-momento', padrao: 'dica-padrao', cross: 'dica-cross' }

  return (
    <div className="painel">
      <h2>💡 Dicas do dia</h2>
      <div className="insights-resumo">
        <span>Vendas: {dados.resumo.totalVendas}</span>
        <span>Receita: R$ {Number(dados.resumo.receitaTotal).toLocaleString('pt-BR')}</span>
        <span>Ticket médio: R$ {Number(dados.resumo.ticketMedio).toLocaleString('pt-BR')}</span>
        <span>Clientes em risco: {dados.resumo.clientesEmRisco}</span>
        {dados.resumo.novas > 0 && <span className="insights-novas">{dados.resumo.novas} novas</span>}
      </div>
      <div className="insights-lista">
        {dados.dicas.map((d, i) => (
          <div key={i} className={'dica ' + (tipoClasse[d.tipo] || '') + (d.novo ? ' dica-nova' : '')}>
            <div className="dica-cabecalho">
			{usuario.admin && d.vendedorNome && <span className="dica-vendedor">👤 {d.vendedorNome}</span>}
              <strong>{d.titulo}</strong>
              {d.novo && <span className="selo-novo">NOVO</span>}
            </div>
            <p>{d.texto}</p>
            <small>{d.detalhe}</small>
            <div className="dica-acoes">
              <button className="btn-acao" onClick={() => marcar('tratar', d.tipo + ':' + d.clienteId)}>✅ Tratar</button>
              <button className="btn-acao" onClick={() => marcar('adiar', d.tipo + ':' + d.clienteId)}>⏸️ Adiar</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}