import { useEffect, useMemo, useState } from 'react'

const formVazio = () => ({
  clienteId: '',
  buscaCliente: '',
  produtos: '',
  valor: '',
  concorrente: '',
  motivo: '',
  observacao: '',
  data: new Date().toISOString().slice(0, 10)
})

function Orcamentos({ usuario }) {
  const [orcamentos, setOrcamentos] = useState([])
  const [clientes, setClientes] = useState([])
  const [vendedores, setVendedores] = useState([])
  const [filtroVendedor, setFiltroVendedor] = useState('todos')
  const [form, setForm] = useState(formVazio())
  const [mostrarSugestoes, setMostrarSugestoes] = useState(false)

  useEffect(() => {
    const vendedorId = usuario.admin ? null : usuario.id
    window.api.listarOrcamentos(vendedorId).then(setOrcamentos)
    window.api.listarClientes(vendedorId).then(setClientes)
    if (usuario.admin) {
      window.api.listarVendedores().then(setVendedores)
    }
  }, [usuario])

  const clientePorId = (id) => clientes.find((c) => c.id === id)
  const vendedorPorId = (id) => vendedores.find((v) => v.id === id)

  // Autocomplete de cliente
  const sugestoes = useMemo(() => {
    const busca = form.buscaCliente.trim().toLowerCase()
    if (!busca || form.clienteId) return []
    return [...clientes]
      .sort((a, b) => String(a.nome || '').localeCompare(String(b.nome || ''), 'pt-BR'))
      .filter((c) => {
        const nome = c.nome.toLowerCase()
        const cod = String(c.codigo)
        return nome.includes(busca) || cod === busca || cod.startsWith(busca)
      })
      .slice(0, 8)
  }, [clientes, form.buscaCliente, form.clienteId])

  // Filtra por vendedor
  const orcamentosFiltrados = useMemo(() => {
    if (filtroVendedor === 'todos') return orcamentos
    return orcamentos.filter((o) => o.vendedorId === filtroVendedor)
  }, [orcamentos, filtroVendedor])

  // NOVO SEMPRE NO TOPO: ordena por data desc; empates mantêm o mais recente primeiro
  const ordenados = useMemo(() => {
    return [...orcamentosFiltrados].sort((a, b) => {
      const cmp = (b.data || '').localeCompare(a.data || '')
      if (cmp !== 0) return cmp
      return String(b.id || '').localeCompare(String(a.id || ''))
    })
  }, [orcamentosFiltrados])

  function escolherCliente(c) {
    setForm((f) => ({ ...f, clienteId: c.id, buscaCliente: '' }))
    setMostrarSugestoes(false)
  }

  function limparCliente() {
    setForm((f) => ({ ...f, clienteId: '', buscaCliente: '' }))
  }

  async function salvar(e) {
    e.preventDefault()
    if (!form.clienteId) return
    const res = await window.api.criarOrcamento({
      clienteId: form.clienteId,
      vendedorId: usuario.id,
      produtos: form.produtos,
      valor: form.valor || 0,
      concorrente: form.concorrente,
      motivo: form.motivo,
      observacao: form.observacao,
      data: form.data
    })
    if (res.ok) {
      // NOVO NO TOPO da lista
      setOrcamentos((prev) => [res.orcamento, ...prev])
      setForm(formVazio())
      setMostrarSugestoes(false)
    }
  }

  async function deletar(id) {
    const confirmado = confirm('Excluir este orçamento?')
    window.api.focarJanela()
    if (!confirmado) return
    await window.api.deletarOrcamento(id)
    setOrcamentos((prev) => prev.filter((o) => o.id !== id))
  }

  // Formatação de valor SEMPRE completa (com 2 casas decimais)
  const fmtValor = (v) =>
    Number(v || 0).toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })

  const fmtData = (d) => {
    if (!d) return ''
    const [ano, mes, dia] = d.split('-')
    return `${dia}/${mes}/${ano}`
  }

  const totalPerdido = orcamentosFiltrados.reduce((soma, o) => soma + Number(o.valor || 0), 0)

  return (
    <div className="orcamentos">
      <div className="section-head">
        <h2>Orçamentos Perdidos</h2>
        <span className="total-badge">Total perdido: {fmtValor(totalPerdido)}</span>
      </div>

      {usuario.admin && (
        <div className="filtro-vendedor">
          <label>
            Filtrar por vendedor
            <select value={filtroVendedor} onChange={(e) => setFiltroVendedor(e.target.value)}>
              <option value="todos">Todos os vendedores</option>
              {vendedores.map((v) => (
                <option key={v.id} value={v.id}>{v.nome}</option>
              ))}
            </select>
          </label>
        </div>
      )}

      {/* Formulário */}
      <form className="orcamento-form" onSubmit={salvar}>
        <h3>Novo Orçamento Perdido</h3>

        <label>
          Cliente *
          <div className="cliente-busca">
            <input
              value={form.clienteId ? (clientePorId(form.clienteId)?.nome || '') : form.buscaCliente}
              onChange={(e) => {
                setForm((f) => ({ ...f, buscaCliente: e.target.value, clienteId: '' }))
                setMostrarSugestoes(true)
              }}
              onFocus={() => setMostrarSugestoes(true)}
              onBlur={() => setTimeout(() => setMostrarSugestoes(false), 150)}
              placeholder="Digite o nome ou ID do cliente..."
            />
            {form.clienteId && (
              <button type="button" className="btn-limpar" onClick={limparCliente}>✕</button>
            )}
            {mostrarSugestoes && sugestoes.length > 0 && (
              <div className="sugestoes">
                {sugestoes.map((c) => (
                  <button
                    type="button"
                    key={c.id}
                    onMouseDown={(e) => {
                      e.preventDefault()
                      escolherCliente(c)
                    }}
                  >
                    <span>#{c.codigo} {c.nome}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </label>

        <label>
          Produtos
          <input
            value={form.produtos}
            onChange={(e) => setForm({ ...form, produtos: e.target.value })}
            placeholder="Descrição dos produtos"
          />
        </label>

        <label>
          Valor
          <input
            type="number"
            step="0.01"
            min="0"
            value={form.valor}
            onChange={(e) => setForm({ ...form, valor: e.target.value })}
            placeholder="0,00"
          />
        </label>

        <label>
          Concorrente
          <input
            value={form.concorrente}
            onChange={(e) => setForm({ ...form, concorrente: e.target.value })}
            placeholder="Concorrente que ganhou"
          />
        </label>

        <label>
          Motivo
          <input
            value={form.motivo}
            onChange={(e) => setForm({ ...form, motivo: e.target.value })}
            placeholder="Motivo da perda"
          />
        </label>

        <label>
          Observação
          <input
            value={form.observacao}
            onChange={(e) => setForm({ ...form, observacao: e.target.value })}
          />
        </label>

        <label>
          Data
          <input
            type="date"
            value={form.data}
            onChange={(e) => setForm({ ...form, data: e.target.value })}
          />
        </label>

        <div className="orcamento-form-acoes">
          <button type="submit" className="btn-primary">Registrar Orçamento</button>
        </div>
      </form>

      {/* Tabela */}
      {ordenados.length === 0 ? (
        <p className="empty">Nenhum orçamento perdido registrado.</p>
      ) : (
        <div className="tabela-wrap">
          <table className="tabela">
            <thead>
              <tr>
                <th>ID</th>
                <th>Cliente</th>
                {usuario.admin && <th>Vendedor</th>}
                <th>Produtos</th>
                <th>Valor</th>
                <th>Concorrente</th>
                <th>Motivo</th>
                <th>Observação</th>
                <th>Data</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {ordenados.map((o) => {
                const cli = clientePorId(o.clienteId)
                const vend = vendedorPorId(o.vendedorId)
                return (
                  <tr key={o.id}>
                    <td className="rank">{cli ? cli.codigo : '-'}</td>
                    <td>{cli ? cli.nome : '(cliente removido)'}</td>
                    {usuario.admin && <td>{vend ? vend.nome : '-'}</td>}
                    <td>{o.produtos}</td>
                    <td>{fmtValor(o.valor)}</td>
                    <td>{o.concorrente}</td>
                    <td>{o.motivo}</td>
                    <td className="obs-cell">{o.observacao}</td>
                    <td>{fmtData(o.data)}</td>
                    <td className="acoes">
                        <button className="btn-link danger" onClick={() => deletar(o.id)} title="Excluir">🗑️</button>
                    </td>
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

export default Orcamentos