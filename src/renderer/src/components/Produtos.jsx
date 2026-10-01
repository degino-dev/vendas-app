import { useEffect, useState } from 'react'
import ProdutoDetalhe from './ProdutoDetalhe'
import { fmtMoeda } from '../utils/format'
const estilo = `
  .lista-topo { display: flex; align-items: center; justify-content: space-between; gap: 10px; flex-wrap: wrap; margin-bottom: 12px; }
  .lista-topo h2 { margin: 0; }
  .busca-input { width: 100%; max-width: 360px; padding: 8px 12px; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 13px; margin-bottom: 12px; }
  .linha-clicavel { cursor: pointer; }
  .linha-clicavel:hover { background: #f1f5f9; }
`
// ===== NOVO: aba de produtos (vindos das notas fiscais) =====
export default function Produtos() {
  const [produtos, setProdutos] = useState([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')
  const [anos, setAnos] = useState([])
  const [anoFiltro, setAnoFiltro] = useState('total')
  const [selecionado, setSelecionado] = useState(null)
  const [busca, setBusca] = useState('')
  useEffect(() => {
    if (!window.api || typeof window.api.notasAnos !== 'function') return
    window.api.notasAnos().then((res) => {
      if (res && res.ok) setAnos(res.anos || [])
    }).catch(() => setAnos([]))
  }, [])
  useEffect(() => {
    if (!window.api || typeof window.api.listarProdutos !== 'function') {
      setErro('Função listarProdutos não disponível. Verifique o preload/index.js.')
      setCarregando(false)
      return
    }
    setCarregando(true)
    setErro('')
    window.api.listarProdutos(anoFiltro)
      .then((res) => {
        if (res && res.ok) setProdutos(res.produtos || [])
        else setErro((res && res.erro) || 'Falha ao carregar produtos.')
      })
      .catch(() => setErro('Falha ao carregar produtos.'))
      .finally(() => setCarregando(false))
  }, [anoFiltro])
  if (selecionado) {
    return <ProdutoDetalhe codigo={selecionado} onVoltar={() => setSelecionado(null)} />
  }
  const termo = busca.trim().toLowerCase()
  const lista = termo
    ? produtos.filter((p) =>
        String(p.descricao || '').toLowerCase().includes(termo) ||
        String(p.codigo || '').includes(termo)
      )
    : produtos
  return (
    <div className="painel">
      <style>{estilo}</style>
      <div className="lista-topo">
        <h2>📦 Produtos (notas fiscais)</h2>
        <div className="top-filtro-ano">
          <label>Período:</label>
          <select value={anoFiltro} onChange={(e) => setAnoFiltro(e.target.value)}>
            <option value="total">Total (todos os anos)</option>
            {anos.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>
      </div>
      <input
        className="busca-input"
        placeholder="Buscar por nome ou código..."
        value={busca}
        onChange={(e) => setBusca(e.target.value)}
      />
      {carregando ? (
        <p className="empty">Carregando produtos...</p>
      ) : erro ? (
        <p className="form-erro">{erro}</p>
      ) : lista.length === 0 ? (
        <p className="empty">Nenhum produto encontrado nas notas para este período.</p>
      ) : (
        <div className="tabela-wrap">
          <table className="tabela">
            <thead>
              <tr>
                <th>Código</th><th>Descrição</th><th>Un.</th>
                <th>Qtd vendida</th><th>Preço médio</th><th>Notas</th>
              </tr>
            </thead>
            <tbody>
              {lista.slice(0, 300).map((p) => (
                <tr key={p.codigo} className="linha-clicavel" onClick={() => setSelecionado(p.codigo)} title="Clique para ver detalhes">
                  <td>{p.codigo}</td>
                  <td>{p.descricao}</td>
                  <td>{p.unidade}</td>
                  <td>{p.quantidade}</td>
                  <td>{fmtMoeda(p.precoMedio)}</td>
                  <td>{p.numNotas}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}