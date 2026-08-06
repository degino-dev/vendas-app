import { useEffect, useState } from 'react'
import { confirmar } from '../utils/confirmar'

const formVazio = () => ({
  nome: '',
  usuario: '',
  senha: '',
  admin: false,
  metaMensal: '100000',
  metaSemanal: '25000'
})

function GestaoVendedores() {
  const [vendedores, setVendedores] = useState([])
  const [mostrarForm, setMostrarForm] = useState(false)
  const [editando, setEditando] = useState(null)
  const [erro, setErro] = useState('')
  const [form, setForm] = useState(formVazio())

  useEffect(() => {
    window.api.listarVendedores().then(setVendedores)
  }, [])

  function abrirNovo() {
    setEditando(null)
    setErro('')
    setForm(formVazio())
    setMostrarForm(true)
  }

  function abrirEdicao(v) {
    setEditando(v)
    setErro('')
    setForm({
      nome: v.nome,
      usuario: v.usuario,
      senha: '',
      admin: !!v.admin,
      metaMensal: String(v.metaMensal || 100000),
      metaSemanal: String(v.metaSemanal || 25000)
    })
    setMostrarForm(true)
  }

  async function salvar(e) {
    e.preventDefault()
    setErro('')

    if (!form.nome || !form.usuario) {
      setErro('Preencha nome e usuário.')
      return
    }

    if (!editando && !form.senha) {
      setErro('Defina uma senha para o novo vendedor.')
      return
    }

    const payload = {
      nome: form.nome,
      usuario: form.usuario,
      admin: form.admin,
      metaMensal: Number(form.metaMensal) || 100000,
      metaSemanal: Number(form.metaSemanal) || 25000
    }

    let res
    if (editando) {
      res = await window.api.atualizarVendedor({ ...editando, ...payload, senha: form.senha })
    } else {
      res = await window.api.criarVendedor({ ...payload, senha: form.senha })
    }

    if (res.ok) {
      setVendedores((prev) =>
        editando ? prev.map((v) => (v.id === res.vendedor.id ? res.vendedor : v)) : [...prev, res.vendedor]
      )
      setMostrarForm(false)
    } else {
      setErro(res.erro || 'Erro ao salvar vendedor.')
    }
  }

// Vendedores.jsx
async function deletar(id) {
  const confirmado = confirm('Excluir este vendedor?')
  window.api.focarJanela()
  if (!confirmado) return
  await window.api.deletarVendedor(id)
  setVendedores((prev) => prev.filter((v) => v.id !== id))
}

  const fmtValor = (v) =>
    Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

  return (
    <div className="gestao">
      <div className="section-head">
        <h2>Gestão de Vendedores</h2>
        <button className="btn-primary" onClick={abrirNovo}>+ Novo Vendedor</button>
      </div>

      {mostrarForm && (
        <form className="cliente-form" onSubmit={salvar}>
          <h3>{editando ? 'Editar Vendedor' : 'Novo Vendedor'}</h3>
          {erro && <p className="form-erro">{erro}</p>}
          <div className="form-grid">
            <label>
              Nome *
              <input
                value={form.nome}
                onChange={(e) => setForm({ ...form, nome: e.target.value })}
                required
              />
            </label>
            <label>
              Usuário (login) *
              <input
                value={form.usuario}
                onChange={(e) => setForm({ ...form, usuario: e.target.value })}
                required
              />
            </label>
            <label>
              {editando ? 'Nova senha (deixe vazio p/ manter)' : 'Senha *'}
              <input
                type="password"
                value={form.senha}
                onChange={(e) => setForm({ ...form, senha: e.target.value })}
                required={!editando}
              />
            </label>
            <label className="check-label">
              <input
                type="checkbox"
                checked={form.admin}
                onChange={(e) => setForm({ ...form, admin: e.target.checked })}
              />
              É gerente (admin)?
            </label>
            <label>
              Meta Mensal (R$)
              <input
                type="text"
                inputMode="numeric"
                value={form.metaMensal}
                onChange={(e) => setForm({ ...form, metaMensal: e.target.value.replace(/\D/g, '') })}
              />
            </label>
            <label>
              Meta Semanal (R$)
              <input
                type="text"
                inputMode="numeric"
                value={form.metaSemanal}
                onChange={(e) => setForm({ ...form, metaSemanal: e.target.value.replace(/\D/g, '') })}
              />
            </label>
          </div>
          <div className="form-actions">
            <button type="submit" className="btn-primary">Salvar</button>
            <button type="button" className="btn-secondary" onClick={() => setMostrarForm(false)}>
              Cancelar
            </button>
          </div>
        </form>
      )}

      {vendedores.length === 0 ? (
        <p className="empty">Nenhum vendedor cadastrado.</p>
      ) : (
        <div className="tabela-wrap">
          <table className="tabela">
            <thead>
              <tr>
                <th>Nome</th>
                <th>Usuário</th>
                <th>Tipo</th>
                <th>Meta Mensal</th>
                <th>Meta Semanal</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {vendedores.map((v) => (
                <tr key={v.id}>
                  <td>{v.nome}</td>
                  <td>{v.usuario}</td>
                  <td>{v.admin ? '👑 Gerente' : 'Vendedor'}</td>
                  <td>{fmtValor(v.metaMensal)}</td>
                  <td>{fmtValor(v.metaSemanal)}</td>
                  <td className="acoes">
                    <button className="btn-link" onClick={() => abrirEdicao(v)}>Editar</button>
                    {v.id !== 'admin' && (
                      <button className="btn-link danger" onClick={() => deletar(v.id)}>Excluir</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

export default GestaoVendedores