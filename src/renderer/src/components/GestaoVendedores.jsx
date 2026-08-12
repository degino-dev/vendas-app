import { useEffect, useRef, useState } from 'react'
import { confirmar } from '../utils/confirmar'
import { fmtValor, fmtDataHora, fmtTamanho, mascaraMoedaInteira as mascaraMoeda, moedaInteiraParaNumero as moedaParaNumero } from '../utils/format'

const formVazio = () => ({
  nome: '',
  usuario: '',
  senha: '',
  confirmarSenha: '',
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
  // ===== NOVO: toast de sucesso =====
  const [aviso, setAviso] = useState('')
  const avisoTimer = useRef(null)
  const mostrarAviso = (msg) => {
    setAviso(msg)
    if (avisoTimer.current) clearTimeout(avisoTimer.current)
    avisoTimer.current = setTimeout(() => setAviso(''), 3000)
  }
  // --- Backups ---
  const [configBackup, setConfigBackup] = useState({ horario: '19:00' })
  const [backupMsg, setBackupMsg] = useState('')
  const [backupMsgTipo, setBackupMsgTipo] = useState('')
  const [criandoBackup, setCriandoBackup] = useState(false)
  const [backupsVendedor, setBackupsVendedor] = useState(null)
  const [backupsGerais, setBackupsGerais] = useState([])
  const [carregandoBackups, setCarregandoBackups] = useState(false)
  useEffect(() => {
    window.api.listarVendedores().then(setVendedores)
    window.api.carregarConfigBackup().then((cfg) => {
      if (cfg && cfg.horario) setConfigBackup({ horario: cfg.horario })
    })
    window.api.listarBackupsGerais().then(setBackupsGerais)
  }, [])
  async function criarBackup() {
    setCriandoBackup(true)
    setBackupMsg('')
    const res = await window.api.criarBackup()
    setCriandoBackup(false)
    if (res && res.ok) {
      setBackupMsg('Backup criado com sucesso (1 por vendedor + 1 geral).')
      setBackupMsgTipo('ok')
      window.api.listarBackupsGerais().then(setBackupsGerais)
    } else {
      setBackupMsg((res && res.erro) || 'Erro ao criar backup.')
      setBackupMsgTipo('erro')
    }
  }
  async function abrirBackupsVendedor(v) {
    setBackupMsg('')
    setBackupsVendedor({ vendedorId: v.id, nome: v.nome, lista: [] })
    setCarregandoBackups(true)
    const lista = await window.api.listarBackupsVendedor(v.id)
    setBackupsVendedor({ vendedorId: v.id, nome: v.nome, lista })
    setCarregandoBackups(false)
  }
  async function restaurarVendedor(id, nome) {
    const confirmado = confirmar(
      'Restaurar o backup de ' + nome + '?\n\nOs dados ATUAIS deste vendedor serão SUBSTITUÍDOS por este backup. Os demais vendedores não são afetados.'
    )
    if (!confirmado) return
    setBackupMsg('')
    const res = await window.api.restaurarBackupVendedor(id, nome)
    if (res && res.ok) {
      setBackupMsg('Backup restaurado com sucesso!')
      setBackupMsgTipo('ok')
      setBackupsVendedor(null)
    } else {
      setBackupMsg((res && res.erro) || 'Erro ao restaurar backup.')
      setBackupMsgTipo('erro')
    }
  }
  async function restaurarGeral(nome) {
    const confirmado = confirmar(
      'Restaurar o backup geral ' + nome + '?\n\nTODOS os dados atuais serão SUBSTITUÍDOS por este backup.'
    )
    if (!confirmado) return
    setBackupMsg('')
    const res = await window.api.restaurarBackupGeral(nome)
    if (res && res.ok) {
      setBackupMsg('Backup geral restaurado com sucesso!')
      setBackupMsgTipo('ok')
      window.api.listarBackupsGerais().then(setBackupsGerais)
    } else {
      setBackupMsg((res && res.erro) || 'Erro ao restaurar backup geral.')
      setBackupMsgTipo('erro')
    }
  }
  async function salvarConfig(e) {
    e.preventDefault()
    setBackupMsg('')
    const res = await window.api.salvarConfigBackup(configBackup)
    if (res && res.ok) {
      setBackupMsg('Configuração salva. Próximo backup automático às ' + configBackup.horario + '.')
      setBackupMsgTipo('ok')
    } else {
      setBackupMsg((res && res.erro) || 'Erro ao salvar configuração.')
      setBackupMsgTipo('erro')
    }
  }
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
      confirmarSenha: '',
      admin: !!v.admin,
      metaMensal: mascaraMoeda(v.metaMensal || 100000),
      metaSemanal: mascaraMoeda(v.metaSemanal || 25000)
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
    // ===== NOVO: validação de confirmação de senha =====
    if (form.senha && form.senha !== form.confirmarSenha) {
      setErro('As senhas não coincidem.')
      return
    }
    const payload = {
      nome: form.nome,
      usuario: form.usuario,
      admin: form.admin,
      // ===== NOVO: converte a máscara de volta para número =====
      metaMensal: moedaParaNumero(form.metaMensal) || 100000,
      metaSemanal: moedaParaNumero(form.metaSemanal) || 25000
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
      // ===== NOVO: feedback de sucesso =====
      mostrarAviso(editando ? '✅ Vendedor atualizado com sucesso!' : '✅ Vendedor cadastrado com sucesso!')
    } else {
      setErro(res.erro || 'Erro ao salvar vendedor.')
    }
  }
  async function deletar(id) {
    const confirmado = confirmar('Excluir este vendedor?')
    if (!confirmado) return
    await window.api.deletarVendedor(id)
    setVendedores((prev) => prev.filter((v) => v.id !== id))
    // ===== NOVO: feedback de sucesso =====
    mostrarAviso('🗑️ Vendedor excluído.')
  }
  return (
    <div className="gestao">
      {/* ===== NOVO: toast de sucesso ===== */}
      {aviso && <div className="toast-sucesso">{aviso}</div>}
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
              <input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} required />
            </label>
            <label>
              Usuário (login) *
              <input value={form.usuario} onChange={(e) => setForm({ ...form, usuario: e.target.value })} required />
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
            {/* ===== NOVO: confirmação de senha ===== */}
            <label>
              Confirmar senha
              <input
                type="password"
                value={form.confirmarSenha}
                onChange={(e) => setForm({ ...form, confirmarSenha: e.target.value })}
                placeholder={editando ? 'Confirme a nova senha' : 'Repita a senha'}
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
              {/* ===== NOVO: máscara de moeda ===== */}
              <input
                type="text"
                inputMode="numeric"
                value={form.metaMensal}
                onChange={(e) => setForm({ ...form, metaMensal: mascaraMoeda(e.target.value) })}
                placeholder="100.000"
              />
            </label>
            <label>
              Meta Semanal (R$)
              {/* ===== NOVO: máscara de moeda ===== */}
              <input
                type="text"
                inputMode="numeric"
                value={form.metaSemanal}
                onChange={(e) => setForm({ ...form, metaSemanal: mascaraMoeda(e.target.value) })}
                placeholder="25.000"
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
                <th>Backup</th>
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
                  <td>
                    {v.id !== 'admin' && (
                      <button className="btn-link" onClick={() => abrirBackupsVendedor(v)}>
                        💾 Restaurar
                      </button>
                    )}
                  </td>
                  <td className="acoes">
                    <button className="btn-link" onClick={() => abrirEdicao(v)}>✏️ Editar</button>
                    {v.id !== 'admin' && (
                      <button className="btn-link danger" onClick={() => deletar(v.id)}>🗑️ Excluir</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {/* ===== Painel de backup de um vendedor ===== */}
      {backupsVendedor && (
        <div className="painel" style={{ marginTop: 20 }}>
          <div className="section-head" style={{ marginBottom: 12 }}>
            <h3>💾 Backups de {backupsVendedor.nome}</h3>
            <button className="btn-secondary" onClick={() => setBackupsVendedor(null)}>Fechar</button>
          </div>
          {carregandoBackups ? (
            <p className="empty">Carregando backups...</p>
          ) : backupsVendedor.lista.length === 0 ? (
            <p className="empty">Nenhum backup deste vendedor ainda. Os backups são criados automaticamente no horário configurado.</p>
          ) : (
            <div className="tabela-wrap">
              <table className="tabela">
                <thead>
                  <tr>
                    <th>Data</th>
                    <th>Tamanho</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {backupsVendedor.lista.map((b) => (
                    <tr key={b.nome}>
                      <td>{fmtDataHora(b.data)}</td>
                      <td>{fmtTamanho(b.tamanho)}</td>
                      <td className="acoes">
                        <button
                          className="btn-link"
                          onClick={() => restaurarVendedor(backupsVendedor.vendedorId, b.nome)}
                        >
                          ↩️ Restaurar
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
      {/* ===== Backups gerais ===== */}
      <div className="painel" style={{ marginTop: 24 }}>
        <div className="section-head" style={{ marginBottom: 12 }}>
          <h3>💾 Backups Gerais</h3>
          <button className="btn-primary" onClick={criarBackup} disabled={criandoBackup}>
            {criandoBackup ? 'Criando...' : '+ Criar Backup Agora'}
          </button>
        </div>
        {backupMsg && <p className={'backup-msg ' + backupMsgTipo}>{backupMsg}</p>}
        <div className="backup-config">
          <form onSubmit={salvarConfig} className="backup-config-form">
            <label>
              Horário do backup diário
              <input
                type="time"
                value={configBackup.horario}
                onChange={(e) => setConfigBackup({ ...configBackup, horario: e.target.value })}
              />
            </label>
            <button type="submit" className="btn-secondary">Salvar Configuração</button>
          </form>
          <p className="backup-dica">
            Todo dia no horário definido (e ao fechar o app) é criado 1 backup por vendedor + 1 geral.
            Ficam guardados apenas os últimos 2 backups de cada vendedor e os 2 backups gerais mais recentes.
          </p>
        </div>
        {backupsGerais.length === 0 ? (
          <p className="empty">Nenhum backup geral encontrado ainda.</p>
        ) : (
          <div className="tabela-wrap">
            <table className="tabela">
              <thead>
                <tr>
                  <th>Arquivo</th>
                  <th>Data</th>
                  <th>Tamanho</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {backupsGerais.map((b) => (
                  <tr key={b.nome}>
                    <td>{b.nome}</td>
                    <td>{fmtDataHora(b.data)}</td>
                    <td>{fmtTamanho(b.tamanho)}</td>
                    <td className="acoes">
                      <button className="btn-link" onClick={() => restaurarGeral(b.nome)}>
                        ↩️ Restaurar
                      </button>
                    </td>
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
export default GestaoVendedores