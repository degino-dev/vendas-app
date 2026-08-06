import { useEffect, useMemo, useState } from 'react'
import { confirmar } from '../utils/confirmar'

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
  const [indiceSugestao, setIndiceSugestao] = useState(0)

  useEffect(() => {
    const vendedorId = usuario.admin ? null : usuario.id
    window.api.listarOrcamentos(vendedorId).then(setOrcamentos)
    window.api.listarClientes(vendedorId).then(setClientes)
    if (usuario.admin) {
      window.api.listarVendedores().then(setVendedores)
    }
  }, [usuario])

  const clienteSelecionado = clientes.find((c) => c.id === form.clienteId)
  const clientePorId = (id) => clientes.find((c) => c.id === id)
  const vendedorPorId = (id) => vendedores.find((v) => v.id === id)

  const sugestoes = useMemo(() => {
    const busca = form.buscaCliente.trim().toLowerCase()
    if (!busca || form.clienteId) return []
    return [...clientes]
      .sort((a, b) => a.codigo - b.codigo)
      .filter((c) => {
        const nome = c.nome.toLowerCase()
        const cod = String(c.codigo)
        return nome.includes(busca) || cod === busca || cod.startsWith(busca)
      })
      .slice(0, 8)
  }, [clientes, form.buscaCliente, form.clienteId])

  const orcamentosFiltrados = useMemo(() => {
    if (!usuario.admin || filtroVendedor === 'todos') return orcamentos
    return orcamentos.filter((o) => o.vendedorId === filtroVendedor)
  }, [orcamentos, filtroVendedor, usuario.admin])

  function escolherCliente(c) {
    setForm((f) => ({ ...f, clienteId: c.id, buscaCliente: '' }))
    setMostrarSugestoes(false)
  }

  function limparCliente() {
    setForm((f) => ({ ...f, clienteId: '', buscaCliente: '' }))
  }

  function onBuscaKey(e) {
    if (e.key === 'Escape') {
      setMostrarSugestoes(false)
      return
    }
    if (!mostrarSugestoes || sugestoes.length === 0) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setIndiceSugestao((i) => (i + 1) % sugestoes.length)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setIndiceSugestao((i) => (i - 1 + sugestoes.length) % sugestoes.length)
    } else if (e.key === 'Enter') {
      e.preventDefault()
      escolherCliente(sugestoes[indiceSugestao])
    }
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
      setOrcamentos((prev) => [...prev, res.orcamento])
      setForm(formVazio())
    }
  }

async function deletar(id) {
  const confirmado = confirm('Excluir este orçamento?')
  window.api.focarJanela()          // ← devolve o foco SEMPRE
  if (!confirmado) return
  await window.api.deletarOrcamento(id)
  setOrcamentos((prev) => prev.filter((o) => o.id !== id))
}

  const fmtValor = (v) =>
    Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

  const fmtData = (d) => {
    if (!d) return ''
    const [ano, mes, dia] = d.split('-')
    return `${dia}/${mes}/${ano}`   // ← CORRIGIDO: crases no lugar certo
  }

  const totalPerdido = orcamentosFiltrados.reduce((soma, o) => soma + Number(o.valor || 0), 0)
  const ordenados = [...orcamentosFiltrados].sort((a, b) => b.data.localeCompare(a.data))

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

      <form className="venda-form" onSubmit={salvar}>
        <div className="cliente-busca">
          <span className="campo-label">Cliente (ID ou Nome) *</span>
          {clienteSelecionado ? (
            <div className="cliente-selecionado">
              <span>
                <strong>#{clienteSelecionado.codigo}</strong> — {clienteSelecionado.nome}
              </span>
              <button type="button" onClick={limparCliente}>Trocar</button>
            </div>
          ) : (
            <input
              value={form.buscaCliente}
              onChange={(e) => {
                setForm({ ...form, buscaCliente: e.target.value })
                setMostrarSugestoes(true)
                setIndiceSugestao(0)
              }}
              onFocus={() => setMostrarSugestoes(true)}
              onBlur={() => setTimeout(() => setMostrarSugestoes(false), 150)}
              onKeyDown={onBuscaKey}
              placeholder="Digite o ID ou o nome..."
              required
            />
          )}
          {mostrarSugestoes && !clienteSelecionado && sugestoes.length > 0 && (
            <div className="sugestoes">
              {sugestoes.map((c, i) => (
                <button
                  type="button"
                  key={c.id}
                  className={i === indiceSugestao ? 'selecionado' : ''}
                  onMouseDown={(e) => {
                    e.preventDefault()
                    escolherCliente(c)
                  }}
                >
                  <span className="sug-id">#{c.codigo}</span>
                  <span>{c.nome}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <label>
          Produtos
          <input
            value={form.produtos}
            onChange={(e) => setForm({ ...form, produtos: e.target.value })}
            placeholder="Ex.: Insumos, equipamento..."
          />
        </label>

        <label>
          Valor (R$)
          <input
            type="number"
            step="0.01"
            min="0"
            value={form.valor}
            onChange={(e) => setForm({ ...form, valor: e.target.value })}
          />
        </label>

        <label>
          Concorrente
          <input
            value={form.concorrente}
            onChange={(e) => setForm({ ...form, concorrente: e.target.value })}
            placeholder="Nome do concorrente"
          />
        </label>

        <label>
          Motivo de não fechar
          <input
            value={form.motivo}
            onChange={(e) => setForm({ ...form, motivo: e.target.value })}
            placeholder="Ex.: Preço, prazo..."
          />
        </label>

        <label className="obs-field">
          Observação (o que houve?)
          <textarea
            value={form.observacao}
            onChange={(e) => setForm({ ...form, observacao: e.target.value })}
            placeholder="Explique o que aconteceu com este orçamento..."
            rows="3"
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

        <button type="submit" className="btn-primary">Registrar</button>
      </form>

      {ordenados.length === 0 ? (
        <p className="empty">Nenhum orçamento perdido registrado ainda.</p>
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
                      <button className="btn-link danger" onClick={() => deletar(o.id)}>Excluir</button>
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