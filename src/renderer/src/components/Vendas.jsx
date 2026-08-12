import { useEffect, useMemo, useRef, useState } from 'react'
import { confirmar } from '../utils/confirmar'
import { fmtValor, fmtData, MESES_NOME, dataLocalISO, mascaraMoeda, moedaParaMascara, parseMoeda } from '../utils/format'
import { calcularMeta } from '../utils/financeiro'

const formVazio = () => ({
  clienteId: '',
  buscaCliente: '',
  envio: '',
  pedidoInsumos: '',
  valorInsumos: '',
  pedidoEquipamento: '',
  valorEquipamento: '',
  frete: '',
  data: dataLocalISO(),
  observacao: ''
})

function Vendas({ usuario }) {
  const hoje = new Date()
  const anoAtual = hoje.getFullYear()
  const mesAtual = hoje.getMonth() + 1
  const [vendas, setVendas] = useState([])
  const [clientes, setClientes] = useState([])
  const [vendedores, setVendedores] = useState([])
  const [filtroAno, setFiltroAno] = useState(anoAtual)
  const [filtroMes, setFiltroMes] = useState(mesAtual)
  const [filtroVendedor, setFiltroVendedor] = useState('todos')
  const [form, setForm] = useState(formVazio())
  const [editando, setEditando] = useState(null)
  const [erro, setErro] = useState('')
  const [mostrarSugestoes, setMostrarSugestoes] = useState(false)
  // ===== NOVO: feedback de sucesso (toast) =====
  const [aviso, setAviso] = useState('')
  const avisoTimer = useRef(null)
  const mostrarAviso = (msg) => {
    setAviso(msg)
    if (avisoTimer.current) clearTimeout(avisoTimer.current)
    avisoTimer.current = setTimeout(() => setAviso(''), 3000)
  }
  useEffect(() => {
    const vendedorId = usuario.admin ? null : usuario.id
    window.api.listarVendas(vendedorId).then(setVendas)
    window.api.listarClientes(vendedorId).then(setClientes)
    if (usuario.admin) {
      window.api.listarVendedores().then(setVendedores)
    }
  }, [usuario])
  const clientePorId = (id) => clientes.find((c) => c.id === id)
  const vendedorPorId = (id) => vendedores.find((v) => v.id === id)
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
  const anosDisponiveis = useMemo(() => {
    const set = new Set(vendas.map((v) => (v.data || '').slice(0, 4)))
    set.add(String(anoAtual))
    return [...set].sort().reverse()
  }, [vendas, anoAtual])
  const mesesDisponiveis = useMemo(() => {
    const set = new Set()
    for (const v of vendas) {
      const d = v.data || ''
      if (filtroAno === 'todos' || d.slice(0, 4) === String(filtroAno)) {
        const m = Number(d.slice(5, 7))
        if (m >= 1 && m <= 12) set.add(m)
      }
    }
    if (filtroAno === 'todos' || filtroAno === anoAtual) set.add(mesAtual)
    return [...set].sort((a, b) => a - b)
  }, [vendas, filtroAno, anoAtual, mesAtual])
  const vendasFiltradas = useMemo(() => {
    let lista = vendas
    if (filtroAno !== 'todos') {
      lista = lista.filter((v) => (v.data || '').slice(0, 4) === String(filtroAno))
    }
    if (filtroMes !== 'todos') {
      lista = lista.filter((v) => Number((v.data || '').slice(5, 7)) === filtroMes)
    }
    if (filtroVendedor !== 'todos') {
      lista = lista.filter((v) => v.vendedorId === filtroVendedor)
    }
    return lista
  }, [vendas, filtroAno, filtroMes, filtroVendedor])
  const vendasOrdenadas = useMemo(() => {
    return [...vendasFiltradas].sort((a, b) => {
      const cmp = (b.data || '').localeCompare(a.data || '')
      if (cmp !== 0) return cmp
      return String(b.id || '').localeCompare(String(a.id || ''))
    })
  }, [vendasFiltradas])
  // ===== NOVO: totais para o rodapé =====
  const totais = useMemo(() => {
    let somaInsumos = 0
    let somaEquip = 0
    let somaPed = 0
    for (const v of vendasFiltradas) {
      somaInsumos += Number(v.valorInsumos || 0)
      somaEquip += Number(v.valorEquipamento || 0)
      somaPed += calcularMeta(v)
    }
    return { somaInsumos, somaEquip, somaPed }
  }, [vendasFiltradas])
  function escolherCliente(c) {
    setForm((f) => ({ ...f, clienteId: c.id, buscaCliente: '' }))
    setMostrarSugestoes(false)
  }
  function limparCliente() {
    setForm((f) => ({ ...f, clienteId: '', buscaCliente: '' }))
  }
  function abrirNovo() {
    setEditando(null)
    setErro('')
    setForm(formVazio())
  }
  function abrirEdicao(v) {
    setEditando(v)
    setErro('')
    setForm({
      clienteId: v.clienteId || '',
      buscaCliente: '',
      envio: v.envio || '',
      pedidoInsumos: v.pedidoInsumos || '',
      valorInsumos: v.valorInsumos != null ? moedaParaMascara(v.valorInsumos) : '',
      pedidoEquipamento: v.pedidoEquipamento || '',
      valorEquipamento: v.valorEquipamento != null ? moedaParaMascara(v.valorEquipamento) : '',
      frete: v.frete != null ? String(v.frete) : '',
      data: v.data || dataLocalISO(),
      observacao: v.observacao || ''
    })
  }
  function cancelarEdicao() {
    setEditando(null)
    setForm(formVazio())
  }
  async function salvar(e) {
    e.preventDefault()
    setErro('')
    if (!form.clienteId) {
      setErro('Selecione um cliente para a venda.')
      return
    }
    const payload = {
      clienteId: form.clienteId,
      envio: form.envio,
      pedidoInsumos: form.pedidoInsumos,
      // ===== NOVO: converte a máscara de volta para número =====
      valorInsumos: parseMoeda(form.valorInsumos),
      pedidoEquipamento: form.pedidoEquipamento,
      valorEquipamento: parseMoeda(form.valorEquipamento),
      frete: form.frete,
      data: form.data,
      observacao: form.observacao
    }
    let res
    if (editando) {
      res = await window.api.atualizarVenda({ ...editando, ...payload })
    } else {
      res = await window.api.criarVenda({ ...payload, vendedorId: usuario.id })
    }
    if (res.ok) {
      setVendas((prev) =>
        editando ? prev.map((v) => (v.id === res.venda.id ? res.venda : v)) : [res.venda, ...prev]
      )
      setMostrarSugestoes(false)
      cancelarEdicao()
      // ===== NOVO: feedback de sucesso =====
      mostrarAviso(editando ? '✅ Venda atualizada com sucesso!' : '✅ Venda registrada com sucesso!')
    } else {
      setErro(res.erro || 'Erro ao salvar a venda.')
    }
  }
  async function deletar(venda) {
    const id = typeof venda === 'object' && venda !== null ? venda.id : venda
    const confirmado = confirmar('Excluir esta venda?')
    if (!confirmado) return
    await window.api.deletarVenda(id)
    setVendas((prev) => prev.filter((v) => v.id !== id))
    // ===== NOVO: feedback de sucesso =====
    mostrarAviso('🗑️ Venda excluída.')
  }
  // Total agora soma o VALOR DA META (pedido − frete), não o valor bruto
  const total = vendasFiltradas.reduce((soma, v) => soma + calcularMeta(v), 0)
  return (
    <div className="vendas">
      {/* ===== NOVO: toast de sucesso ===== */}
      {aviso && <div className="toast-sucesso">{aviso}</div>}
      <div className="section-head">
        <h2>Registro de Vendas</h2>
        <span className="total-badge">Total (Valor Ped.): {fmtValor(total)}</span>
      </div>
      {/* Filtros separados: Ano + Mês (com nome) + Vendedor */}
      <div className="filtros">
        <label>
          Ano
          <select
            value={filtroAno}
            onChange={(e) => setFiltroAno(e.target.value === 'todos' ? 'todos' : Number(e.target.value))}
          >
            <option value="todos">Todos</option>
            {anosDisponiveis.map((a) => (
              <option key={a} value={a}>{a}</option>
            ))}
          </select>
        </label>
        <label>
          Mês
          <select
            value={filtroMes}
            onChange={(e) => setFiltroMes(e.target.value === 'todos' ? 'todos' : Number(e.target.value))}
          >
            <option value="todos">Todos os meses</option>
            {mesesDisponiveis.map((m) => (
              <option key={m} value={m}>{MESES_NOME[m - 1]}</option>
            ))}
          </select>
        </label>
        {usuario.admin && (
          <label>
            Vendedor
            <select value={filtroVendedor} onChange={(e) => setFiltroVendedor(e.target.value)}>
              <option value="todos">Todos</option>
              {vendedores.map((v) => (
                <option key={v.id} value={v.id}>{v.nome}</option>
              ))}
            </select>
          </label>
        )}
      </div>
      {/* Formulário — título e erro fora da linha de campos */}
      <form className="venda-form" onSubmit={salvar}>
        <div className="form-titulo-linha">
          <h3>{editando ? 'Editar Venda' : 'Nova Venda'}</h3>
          {erro && <p className="form-erro">{erro}</p>}
        </div>
        <div className="venda-form-grid">
          <label className="campo-cliente">
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
            Envio
            <select
              value={form.envio}
              onChange={(e) => setForm({ ...form, envio: e.target.value })}
              required
            >
              <option value="">Selecione o meio de envio</option>
              <option value="WhatsApp">WhatsApp</option>
              <option value="E-mail">E-mail</option>
              <option value="Teams">Teams</option>
              <option value="Plataforma">Plataforma</option>
            </select>
          </label>
          <label>
            Ped. Insumos
            <input
              value={form.pedidoInsumos}
              onChange={(e) => setForm({ ...form, pedidoInsumos: e.target.value })}
              placeholder="Descrição"
            />
          </label>
          <label>
            Valor Insumos
            {/* ===== NOVO: máscara de moeda ===== */}
            <input
              inputMode="decimal"
              value={form.valorInsumos}
              onChange={(e) => setForm({ ...form, valorInsumos: mascaraMoeda(e.target.value) })}
              placeholder="0,00"
            />
          </label>
          <label>
            Ped. Equip.
            <input
              value={form.pedidoEquipamento}
              onChange={(e) => setForm({ ...form, pedidoEquipamento: e.target.value })}
              placeholder="Descrição"
            />
          </label>
          <label>
            Valor Equip.
            {/* ===== NOVO: máscara de moeda ===== */}
            <input
              inputMode="decimal"
              value={form.valorEquipamento}
              onChange={(e) => setForm({ ...form, valorEquipamento: mascaraMoeda(e.target.value) })}
              placeholder="0,00"
            />
          </label>
          <label>
            Frete
            <input
              value={form.frete}
              onChange={(e) => setForm({ ...form, frete: e.target.value })}
              placeholder="0,00 ou 10%"
              title="Valor fixo (ex: 79,90) ou porcentagem do pedido (ex: 10%)"
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
          <label className="obs-label">
            Observação
            <input
              value={form.observacao}
              onChange={(e) => setForm({ ...form, observacao: e.target.value })}
            />
          </label>
          <div className="venda-form-acoes">
            <button type="submit" className="btn-primary">
              {editando ? 'Salvar Alterações' : 'Registrar Venda'}
            </button>
            {editando && (
              <button type="button" className="btn-secondary" onClick={cancelarEdicao}>
                Cancelar
              </button>
            )}
          </div>
        </div>
      </form>
      {/* Tabela */}
      {vendasOrdenadas.length === 0 ? (
        <p className="empty">Nenhuma venda encontrada.</p>
      ) : (
        <div className="tabela-wrap">
          <table className="tabela">
            <thead>
              <tr>
                <th>ID</th>
                <th>Cliente</th>
                {usuario.admin && <th>Vendedor</th>}
                <th>Envio</th>
                {/* ===== NOVO: colunas agrupadas (13 -> 9) ===== */}
                <th>Insumos</th>
                <th>Equip.</th>
                <th>Frete</th>
                <th>Valor Ped.</th>
                <th>Data</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {vendasOrdenadas.map((v) => {
                const cli = clientePorId(v.clienteId)
                const vend = vendedorPorId(v.vendedorId)
                return (
                  <tr key={v.id}>
                    <td className="rank">{cli ? cli.codigo : '-'}</td>
                    <td>{cli ? cli.nome : '(cliente removido)'}</td>
                    {usuario.admin && <td>{vend ? vend.nome : '-'}</td>}
                    <td>{v.envio || '—'}</td>
                    {/* ===== NOVO: descrição + valor agrupados ===== */}
                    <td className="venda-grupo">
                      {v.pedidoInsumos && <span className="venda-desc">{v.pedidoInsumos}</span>}
                      <span className="venda-valor">{fmtValor(v.valorInsumos)}</span>
                    </td>
                    <td className="venda-grupo">
                      {v.pedidoEquipamento && <span className="venda-desc">{v.pedidoEquipamento}</span>}
                      <span className="venda-valor">{fmtValor(v.valorEquipamento)}</span>
                    </td>
                    <td>{v.frete ? (String(v.frete).includes('%') ? v.frete : fmtValor(String(v.frete).replace(',', '.'))) : '—'}</td>
                    <td className="valor-meta">{fmtValor(calcularMeta(v))}</td>
                    <td>{fmtData(v.data)}</td>
                    <td className="acoes">
  {/* ===== SÓ ÍCONES (economiza espaço em telas pequenas) ===== */}
  <button className="btn-acao" onClick={() => abrirEdicao(v)} title="Editar venda">✏️</button>
  <button className="btn-acao btn-acao-danger" onClick={() => deletar(v)} title="Excluir venda">🗑️</button>
</td>
                  </tr>
                )
              })}
            </tbody>
            {/* ===== NOVO: rodapé com totais ===== */}
            <tfoot>
              <tr>
                <td colSpan={usuario.admin ? 4 : 3}>Totais</td>
                <td className="valor-meta">{fmtValor(totais.somaInsumos)}</td>
                <td className="valor-meta">{fmtValor(totais.somaEquip)}</td>
                <td>—</td>
                <td className="valor-meta">{fmtValor(totais.somaPed)}</td>
                <td>—</td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  )
}
export default Vendas