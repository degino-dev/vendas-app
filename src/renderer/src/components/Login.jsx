import { useState } from 'react'

export default function Login({ onLogin }) {
  const [usuario, setUsuario] = useState('')
  const [senha, setSenha] = useState('')
  const [mostrarSenha, setMostrarSenha] = useState(false)
  const [erro, setErro] = useState('')
  const [carregando, setCarregando] = useState(false)
  // ===== NOVO: fluxo de troca obrigatória de senha =====
  const [trocaPendente, setTrocaPendente] = useState(null) // vendedor que precisa trocar
  const [novaSenha, setNovaSenha] = useState('')
  const [confirmarSenha, setConfirmarSenha] = useState('')
  const [mostrarNovaSenha, setMostrarNovaSenha] = useState(false)
  const [salvandoTroca, setSalvandoTroca] = useState(false)

  async function entrar(e) {
    e.preventDefault()
    setErro('')
    setCarregando(true)
    const res = await window.api.login({ usuario, senha })
    setCarregando(false)
    if (res.ok) {
      // ===== NOVO: se o backend indicar troca obrigatória, abre a tela de troca =====
      if (res.vendedor && res.vendedor.trocarSenhaNoProximoLogin) {
        setTrocaPendente(res.vendedor)
        setNovaSenha('')
        setConfirmarSenha('')
        setErro('')
        return
      }
      onLogin(res.vendedor)
    } else {
      setErro(res.erro || 'Erro ao entrar.')
    }
  }

  // ===== NOVO: confirma a troca de senha (bloqueada até salvar) =====
  async function confirmarTroca(e) {
    e.preventDefault()
    setErro('')
    const nova = novaSenha.trim()
    if (nova.length < 6) {
      setErro('A nova senha deve ter ao menos 6 caracteres.')
      return
    }
    if (nova === senha) {
      setErro('A nova senha não pode ser igual à senha atual.')
      return
    }
    if (nova !== confirmarSenha) {
      setErro('As senhas não coincidem.')
      return
    }
    setSalvandoTroca(true)
    const res = await window.api.trocarSenha({
      vendedorId: trocaPendente.id,
      senhaAtual: senha,
      novaSenha: nova
    })
    setSalvandoTroca(false)
    if (res.ok) {
      // Entra no app com os dados atualizados
      onLogin(res.vendedor || trocaPendente)
    } else {
      setErro(res.erro || 'Erro ao trocar a senha.')
    }
  }

  // ===== NOVO: cancela a troca e volta para o login =====
  function sairTroca() {
    setTrocaPendente(null)
    setUsuario('')
    setSenha('')
    setErro('')
  }

  // ===== NOVO: tela de troca obrigatória de senha =====
  if (trocaPendente) {
    return (
      <div className="login-wrap">
        <div className="login-card">
          <img src="/logo.png" alt="Décio Camargo" className="login-logo" />
          <h2>🔑 Defina sua nova senha</h2>
          <p className="login-sub">
            Esta é a primeira vez que você acessa com esta senha.
            Por segurança, crie uma senha nova para continuar.
          </p>
          <form onSubmit={confirmarTroca}>
            <label>
              Nova senha
              <div className="login-campo">
                <span className="login-icone">🔒</span>
                <input
                  type={mostrarNovaSenha ? 'text' : 'password'}
                  value={novaSenha}
                  onChange={(e) => setNovaSenha(e.target.value)}
                  placeholder="Mínimo de 6 caracteres"
                  autoFocus
                  required
                />
                <button
                  type="button"
                  className="login-ver-senha"
                  onClick={() => setMostrarNovaSenha((v) => !v)}
                  title={mostrarNovaSenha ? 'Ocultar senha' : 'Mostrar senha'}
                >
                  {mostrarNovaSenha ? '🙈' : '👁'}
                </button>
              </div>
            </label>
            <label>
              Confirmar nova senha
              <div className="login-campo">
                <span className="login-icone">🔒</span>
                <input
                  type={mostrarNovaSenha ? 'text' : 'password'}
                  value={confirmarSenha}
                  onChange={(e) => setConfirmarSenha(e.target.value)}
                  placeholder="Repita a nova senha"
                  required
                />
              </div>
            </label>
            {erro && <p className="login-erro">{erro}</p>}
            <div className="login-acoes">
              <button type="submit" disabled={salvandoTroca} className="login-entrar">
                {salvandoTroca ? 'Salvando...' : 'Salvar e Entrar'}
              </button>
            </div>
          </form>
          <button type="button" className="login-sair-troca" onClick={sairTroca}>
            ← Voltar para o login
          </button>
        </div>
      </div>
    )
  }

  // ===== Tela de login normal =====
  return (
    <div className="login-wrap">
      <div className="login-card">
        <img src="./logo.png" alt="Décio Camargo" className="login-logo" />
        <h2>Controle de Vendas</h2>
        <p className="login-sub">Faça login para continuar</p>
        <form onSubmit={entrar}>
          <label>
            Usuário
            <div className="login-campo">
              <span className="login-icone">👤</span>
              <input
                value={usuario}
                onChange={(e) => setUsuario(e.target.value)}
                placeholder="Digite seu usuário"
                autoFocus
                required
              />
            </div>
          </label>
          <label>
            Senha
            <div className="login-campo">
              <span className="login-icone">🔒</span>
              <input
                type={mostrarSenha ? 'text' : 'password'}
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                placeholder="Digite sua senha"
                required
              />
              <button
                type="button"
                className="login-ver-senha"
                onClick={() => setMostrarSenha((v) => !v)}
                title={mostrarSenha ? 'Ocultar senha' : 'Mostrar senha'}
              >
                {mostrarSenha ? '🙈' : '👁'}
              </button>
            </div>
          </label>
          {erro && <p className="login-erro">{erro}</p>}
          <div className="login-acoes">
            <button type="submit" disabled={carregando} className="login-entrar">
              {carregando ? 'Entrando...' : 'Entrar'}
            </button>
          </div>
        </form>
        <p className="login-hint">Use suas credenciais fornecidas pelo administrador.</p>
      </div>
    </div>
  )
}