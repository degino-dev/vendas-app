import { useEffect, useRef, useState } from 'react'
const EXEMPLOS = [
  'Quem compra tubo de coleta a vácuo e o que mais posso oferecer?',
  'Quais clientes estão com orçamento aguardando há mais tempo?',
  'Quem comprava com frequência e parou nos últimos 6 meses?',
  'Chegou uma micropipeta nova, quem compra equipamentos similares?',
  'Qual produto tem maior giro na minha carteira e quem ainda não compra?',
  'Quais clientes mais compram reagentes de bioquímica e qual o ticket médio?'
]

// ===== Mini-renderizador de Markdown (sem dependências) =====
function escaparHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}
function renderizarLinha(linha) {
  let t = escaparHtml(linha)
  t = t.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
  t = t.replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>')
  t = t.replace(/`([^`]+)`/g, '<code>$1</code>')
  return t
}
// ===== detecta se uma linha é uma tabela markdown =====
function ehLinhaTabela(linha) {
  return /^\s*\|/.test(linha) || /^\s*\|?[^|]+\|/.test(linha)
}
// ===== converte um bloco de linhas de tabela em JSX <table> =====
function renderizarTabela(linhas) {
  const dados = []
  for (const linha of linhas) {
    const celulas = linha
      .trim()
      .replace(/^\|/, '')
      .replace(/\|$/, '')
      .split('|')
      .map((c) => c.trim())
    dados.push(celulas)
  }
  // Remove a linha de separação (ex.: | --- | --- |)
  const semSeparador = dados.filter(
    (cel) => !(cel.length > 0 && cel.every((c) => /^:?-{2,}:?$/.test(c)))
  )
  if (semSeparador.length === 0) return null
  const cabecalho = semSeparador[0]
  const corpo = semSeparador.slice(1)
  return (
    <div className="tabela-wrap" key={'tbl' + Math.random()}>
      <table className="tabela ia-tabela">
        <thead>
          <tr>
            {cabecalho.map((c, i) => (
              <th key={i} dangerouslySetInnerHTML={{ __html: renderizarLinha(c) }} />
            ))}
          </tr>
        </thead>
        <tbody>
          {corpo.map((cel, i) => (
            <tr key={i}>
              {cel.map((c, j) => (
                <td key={j} dangerouslySetInnerHTML={{ __html: renderizarLinha(c) }} />
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
function renderizarMarkdown(texto) {
  if (!texto) return null
  const linhas = String(texto).split('\n')
  const blocos = []
  let listaAtual = null
  let citacaoAtual = null
  let tabelaAtual = null
  const fecharLista = () => {
    if (listaAtual) { blocos.push(<ul key={'ul' + blocos.length}>{listaAtual}</ul>); listaAtual = null }
  }
  const fecharCitacao = () => {
    if (citacaoAtual) { blocos.push(<blockquote key={'bq' + blocos.length}>{citacaoAtual}</blockquote>); citacaoAtual = null }
  }
  const fecharTabela = () => {
    if (tabelaAtual) {
      const tbl = renderizarTabela(tabelaAtual)
      if (tbl) blocos.push(tbl)
      tabelaAtual = null
    }
  }
  for (const linha of linhas) {
    const l = linha.trim()
    // ===== acumula linhas de tabela =====
    if (ehLinhaTabela(l)) {
      fecharLista()
      fecharCitacao()
      tabelaAtual = tabelaAtual || []
      tabelaAtual.push(l)
      continue
    }
    fecharTabela()
    if (l.startsWith('>')) {
      fecharLista()
      citacaoAtual = citacaoAtual || []
      citacaoAtual.push(<p key={citacaoAtual.length} dangerouslySetInnerHTML={{ __html: renderizarLinha(l.replace(/^>\s*/, '')) }} />)
      continue
    }
    fecharCitacao()
    const titulo = l.match(/^(#{1,4})\s+(.*)$/)
    if (titulo) {
      fecharLista()
      const Tag = 'h' + Math.min(titulo[1].length + 1, 4)
      blocos.push(<Tag key={'h' + blocos.length} dangerouslySetInnerHTML={{ __html: renderizarLinha(titulo[2]) }} />)
      continue
    }
    const item = l.match(/^[-*]\s+(.*)$/)
    if (item) {
      listaAtual = listaAtual || []
      listaAtual.push(<li key={listaAtual.length} dangerouslySetInnerHTML={{ __html: renderizarLinha(item[1]) }} />)
      continue
    }
    fecharLista()
    if (!l) continue
    blocos.push(<p key={'p' + blocos.length} dangerouslySetInnerHTML={{ __html: renderizarLinha(l) }} />)
  }
  fecharLista()
  fecharCitacao()
  fecharTabela()
  return blocos
}
// ===== Separa a "Sugestão de Ação Prática" do restante da resposta =====
function separarSugestao(texto) {
  const t = String(texto || '')
  const linhas = t.split('\n')
  let idx = -1
  for (let i = 0; i < linhas.length; i++) {
    if (/^\s*[*_-]*\s*sugest[ãa]o de a[çc][ãa]o pr[áa]tica\s*:?/i.test(linhas[i].trim())) {
      idx = i
      break
    }
  }
  if (idx === -1) return { principal: t, sugestao: '' }
  const sugestao = linhas.slice(idx).join('\n').replace(/^\s*[*_-]*\s*Sugest[ãa]o de A[çc][ãa]o Pr[áa]tica\s*:?\s*/i, '').replace(/\*\*/g, '').trim()
  const principal = linhas.slice(0, idx).join('\n').trim()
  return { principal, sugestao }
}
export default function Consultar({ usuario }) {
  const [pergunta, setPergunta] = useState('')
  const [resposta, setResposta] = useState('')
  const [consultaId, setConsultaId] = useState(null)
  const [carregando, setCarregando] = useState(false)
  const [erro, setErro] = useState('')
  const [avaliacao, setAvaliacao] = useState(null)
  const [feedbackMsg, setFeedbackMsg] = useState('')
  // ===== controle do modal centralizado =====
  const [modalAberto, setModalAberto] = useState(false)
  // ===== NOVO: chat de acompanhamento (follow-up) =====
  const [historico, setHistorico] = useState([])
  const [seguimento, setSeguimento] = useState('')
  const [enviandoSeguimento, setEnviandoSeguimento] = useState(false)
  const historicoRef = useRef(null)
  // ===== NOVO: rola o chat para o fim quando chega mensagem nova =====
  useEffect(() => {
    if (historicoRef.current) {
      historicoRef.current.scrollTop = historicoRef.current.scrollHeight
    }
  }, [historico])
  // ===== feedback de sucesso (toast) =====
  const [aviso, setAviso] = useState('')
  const avisoTimer = useRef(null)
  const mostrarAviso = (msg) => {
    setAviso(msg)
    if (avisoTimer.current) clearTimeout(avisoTimer.current)
    avisoTimer.current = setTimeout(() => setAviso(''), 3000)
  }
  // ===== Análise de carteira =====
  const [analisando, setAnalisando] = useState(false)
  const [analiseIA, setAnaliseIA] = useState('')
  const [msgAnalise, setMsgAnalise] = useState('')
  // ===== @-menção de clientes =====
  const [clientes, setClientes] = useState([])
  const [mostrarMencao, setMostrarMencao] = useState(false)
  const [filtroMencao, setFiltroMencao] = useState('')
  const [indiceMencao, setIndiceMencao] = useState(0)
  const [posCursor, setPosCursor] = useState(0)
  const textareaRef = useRef(null)
  // Carrega a carteira ao montar
  useEffect(() => {
    window.api.carteiraIA().then((res) => {
      if (res && res.ok) setClientes(res.clientes || [])
    })
  }, [])
  const clientesFiltrados = mostrarMencao
    ? clientes.filter((c) => {
        const busca = filtroMencao.toLowerCase()
        return !busca || String(c.nome).toLowerCase().includes(busca) || String(c.codigo).toLowerCase().includes(busca)
      }).slice(0, 8)
    : []
  function aoMudarPergunta(e) {
    const valor = e.target.value
    const cursor = e.target.selectionStart
    setPergunta(valor)
    setPosCursor(cursor)
    // ===== limpa a resposta anterior ao digitar nova pergunta =====
    if (resposta) {
      setResposta('')
      setConsultaId(null)
      setAvaliacao(null)
      setFeedbackMsg('')
    }
    const antes = valor.slice(0, cursor)
    const ultimoArroba = antes.lastIndexOf('@')
    const ultimoEspaco = Math.max(antes.lastIndexOf(' '), antes.lastIndexOf('\n'))
    if (ultimoArroba > ultimoEspaco) {
      setMostrarMencao(true)
      setFiltroMencao(antes.slice(ultimoArroba + 1))
      setIndiceMencao(0)
    } else {
      setMostrarMencao(false)
    }
  }
  function inserirCliente(cliente) {
    const antes = pergunta.slice(0, posCursor)
    const ultimoArroba = antes.lastIndexOf('@')
    const novoTexto = antes.slice(0, ultimoArroba) + cliente.nome + ' ' + pergunta.slice(posCursor)
    setPergunta(novoTexto)
    setMostrarMencao(false)
    setFiltroMencao('')
    requestAnimationFrame(() => {
      if (textareaRef.current) {
        const novaPos = ultimoArroba + cliente.nome.length + 1
        textareaRef.current.setSelectionRange(novaPos, novaPos)
        textareaRef.current.focus()
      }
    })
  }
  function aoTeclar(e) {
    if (mostrarMencao && clientesFiltrados.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setIndiceMencao((i) => (i + 1) % clientesFiltrados.length)
        return
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setIndiceMencao((i) => (i - 1 + clientesFiltrados.length) % clientesFiltrados.length)
        return
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault()
        inserirCliente(clientesFiltrados[indiceMencao])
        return
      }
      if (e.key === 'Escape') {
        setMostrarMencao(false)
        return
      }
    }
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      consultar()
    }
  }
  async function consultar(texto) {
    const p = (texto ?? pergunta).trim()
    if (!p) return
    setCarregando(true)
    setErro('')
    setResposta('')
    setAvaliacao(null)
    setFeedbackMsg('')
    // ===== abre o modal imediatamente (mostra "gerando...") =====
    setModalAberto(true)
    try {
      // ===== ALTERADO: envia { pergunta, historico } para o backend =====
      const res = await window.api.consultarIA({ pergunta: p, historico: [] })
      if (res && res.ok) {
        setResposta(res.texto || '')
        setConsultaId(res.consultaId || null)
        // ===== NOVO: inicia o histórico com a primeira troca =====
        setHistorico([{ pergunta: p, resposta: res.texto || '' }])
        if (!res.texto) setErro('A IA não retornou resposta. Tente reformular.')
      } else {
        setErro((res && res.erro) || 'Erro ao consultar.')
      }
    } catch (e) {
      setErro('Falha na consulta: ' + String(e))
    } finally {
      setCarregando(false)
    }
  }
  // ===== NOVO: pergunta de acompanhamento (mantém o contexto da conversa) =====
  async function perguntarSeguimento() {
    const p = seguimento.trim()
    if (!p || carregando || enviandoSeguimento) return
    setEnviandoSeguimento(true)
    // adiciona a pergunta do usuário (resposta vazia = "gerando...")
    setHistorico((h) => [...h, { pergunta: p, resposta: '' }])
    setSeguimento('')
    try {
      // limita o histórico às últimas 10 trocas para não estourar o contexto
      const res = await window.api.consultarIA({ pergunta: p, historico: historico.slice(-10) })
      setHistorico((h) => {
        const novo = [...h]
        const ultima = novo[novo.length - 1]
        ultima.resposta = res && res.ok
          ? (res.texto || '(resposta vazia)')
          : ((res && res.erro) || 'Erro ao consultar.')
        return novo
      })
    } catch (e) {
      setHistorico((h) => {
        const novo = [...h]
        novo[novo.length - 1].resposta = 'Falha na consulta: ' + String(e)
        return novo
      })
    } finally {
      setEnviandoSeguimento(false)
    }
  }
  // ===== fechar o modal =====
  function fecharModal() {
    setModalAberto(false)
    setCarregando(false)
    setResposta('')
    setErro('')
    setAvaliacao(null)
    setFeedbackMsg('')
    // ===== NOVO: limpa a conversa ao fechar =====
    setHistorico([])
    setSeguimento('')
    setEnviandoSeguimento(false)
  }
  // ===== permite trocar a avaliação (não trava) =====
  async function avaliar(nota) {
    if (!consultaId) return
    // Se clicar no mesmo botão já avaliado, desfaz
    if (avaliacao === nota) {
      setAvaliacao(null)
      setFeedbackMsg('')
      return
    }
    setAvaliacao(nota)
    setFeedbackMsg('')
    try {
      const res = await window.api.avaliarIA({ consultaId, nota })
      if (res && res.ok) {
        setFeedbackMsg(nota === 'bom'
          ? '✅ Obrigado! Sua resposta foi salva como exemplo para melhorar as próximas consultas.'
          : 'Obrigado pelo retorno. Vou considerar isso nas próximas respostas.')
      } else {
        setFeedbackMsg('Não foi possível salvar sua avaliação.')
      }
    } catch (e) {
      setFeedbackMsg('Falha ao salvar avaliação: ' + String(e))
    }
  }
  // ===== ALTERADO: copiar a última resposta da conversa =====
  async function copiarResposta() {
    const ultima = historico[historico.length - 1]
    const texto = ultima ? ultima.resposta : (resposta || '')
    try {
      await navigator.clipboard.writeText(texto)
      mostrarAviso('📋 Resposta copiada!')
    } catch {
      mostrarAviso('Não foi possível copiar automaticamente.')
    }
  }
  // ===== Análise de carteira =====
  async function analisarCarteira() {
    setMsgAnalise('')
    setAnaliseIA('')
    setAnalisando(true)
    try {
      const res = await window.api.analisarComIA()
      if (res && res.ok) {
        setAnaliseIA(res.texto || '')
        if (!res.texto) setMsgAnalise('A IA não retornou insights. Tente novamente.')
      } else {
        setMsgAnalise((res && res.erro) || 'Erro ao analisar com a IA.')
      }
    } catch (e) {
      setMsgAnalise('Falha na análise: ' + String(e))
    } finally {
      setAnalisando(false)
    }
  }
  return (
    <div className="consultar">
      {/* ===== toast de sucesso ===== */}
      {aviso && <div className="toast-sucesso">{aviso}</div>}
      <div className="section-head">
        <h2>🔎 Consultar</h2>
        <span className="total-badge">Pergunte em linguagem natural — use @ para citar um cliente</span>
      </div>
      {/* Botão de análise de carteira */}
      <div className="analise-carteira">
        <button
          type="button"
          className="btn-primary analise-btn"
          onClick={analisarCarteira}
          disabled={analisando}
        >
          {analisando ? '🤖 Analisando...' : '📊 Análise de carteira'}
        </button>
        <span className="analise-dica">
          A IA analisa {usuario && usuario.admin ? 'todos os vendedores' : 'sua carteira'} e gera insights acionáveis.
        </span>
      </div>
      {msgAnalise && <p className="form-erro">{msgAnalise}</p>}
      {analiseIA && (
        // ===== limite de altura com scroll =====
        <div className="ia-resultado">
          <h4>💡 Insights gerados</h4>
          <div className="markdown">{renderizarMarkdown(analiseIA)}</div>
        </div>
      )}
      <div className="consultar-pergunta">
        <div className="pergunta-wrapper">
          <textarea
            ref={textareaRef}
            value={pergunta}
            onChange={aoMudarPergunta}
            onKeyDown={aoTeclar}
            placeholder={'Ex.: Quais clientes compram o produto X?\nEx.: @Cliente — o que oferecer nos últimos 6 meses?'}
          />
          {mostrarMencao && clientesFiltrados.length > 0 && (
            <div className="mencao-dropdown">
              {clientesFiltrados.map((c, i) => (
                <button
                  key={c.codigo}
                  type="button"
                  className={'mencao-item ' + (i === indiceMencao ? 'mencao-item-ativo' : '')}
                  onMouseDown={(e) => { e.preventDefault(); inserirCliente(c) }}
                  onMouseEnter={() => setIndiceMencao(i)}
                >
                  <span className="mencao-nome">{c.nome}</span>
                  {c.cidade && <span className="mencao-cidade">{c.cidade}</span>}
                </button>
              ))}
            </div>
          )}
        </div>
        <button
          type="button"
          className="btn-primary"
          onClick={() => consultar()}
          disabled={carregando || !pergunta.trim()}
        >
          {carregando ? '🤖 Consultando...' : '🔎 Consultar'}
        </button>
      </div>
      <div className="consultar-exemplos">
        {EXEMPLOS.map((ex) => (
          <button key={ex} type="button" className="chip" onClick={() => { setPergunta(ex); consultar(ex) }} disabled={carregando}>
            {ex}
          </button>
        ))}
      </div>
      {erro && !modalAberto && <p className="form-erro">{erro}</p>}
      {/* ===== MODAL CENTRALIZADO com CHAT ===== */}
      {modalAberto && (
        <div className="modal-overlay" onClick={fecharModal}>
          <div className="modal modal-consulta" onClick={(e) => e.stopPropagation()}>
            <div className="modal-consulta-topo">
              <h3>💡 Resposta</h3>
              <button type="button" className="btn-acao modal-fechar" onClick={fecharModal} title="Fechar">✕</button>
            </div>
            {carregando && historico.length === 0 ? (
              // ===== primeira consulta: animação de "gerando resposta" =====
              <div className="modal-gerando">
                <span className="spinner"></span>
                <p>🤖 Gerando sua resposta...</p>
              </div>
            ) : erro && historico.length === 0 ? (
              <div>
                <p className="form-erro">{erro}</p>
                <div className="modal-acoes">
                  <button className="btn-secondary" onClick={fecharModal}>Fechar</button>
                </div>
              </div>
            ) : (
              <div className="modal-consulta-corpo">
                {/* ===== NOVO: histórico da conversa (chat) ===== */}
                <div className="chat-historico" ref={historicoRef}>
                  {historico.map((item, i) => (
                    <div key={i} className="chat-bloco">
                      <div className="chat-pergunta">
                        <strong>👤 Você:</strong> {item.pergunta}
                      </div>
                      {item.resposta === '' ? (
                        <div className="chat-resposta chat-gerando">
                          <span className="spinner"></span> Gerando resposta...
                        </div>
                      ) : (
                        <div className="chat-resposta">
                          {(() => {
                            const { principal, sugestao } = separarSugestao(item.resposta)
                            return (
                              <>
                                {sugestao && (
                                  <div className="sugestao-card">
                                    <strong className="sugestao-titulo">🎯 Sugestão de Ação Prática</strong>
                                    <div className="markdown">{renderizarMarkdown(sugestao)}</div>
                                  </div>
                                )}
                                {principal && <div className="markdown resposta-principal">{renderizarMarkdown(principal)}</div>}
                              </>
                            )
                          })()}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                {/* Avaliação + copiar (na última resposta concluída) */}
                {!carregando && historico.length > 0 && historico[historico.length - 1].resposta !== '' && (
                  <>
                    <div className="consultar-feedback">
                      <span className="feedback-rotulo">Essa resposta foi útil?</span>
                      <button type="button" className={'btn-feedback ' + (avaliacao === 'bom' ? 'ativo-bom' : '')} onClick={() => avaliar('bom')} title="Resposta boa — salvar como exemplo">👍 Útil</button>
                      <button type="button" className={'btn-feedback ' + (avaliacao === 'ruim' ? 'ativo-ruim' : '')} onClick={() => avaliar('ruim')} title="Resposta não foi útil">👎 Não útil</button>
                      <button type="button" className="btn-feedback btn-copiar" onClick={copiarResposta} title="Copiar resposta">📋 Copiar</button>
                    </div>
                    {feedbackMsg && <p className="feedback-msg">{feedbackMsg}</p>}
                  </>
                )}
                {/* ===== NOVO: campo de pergunta de acompanhamento ===== */}
                <div className="chat-input">
                  <input
                    type="text"
                    value={seguimento}
                    onChange={(e) => setSeguimento(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                        e.preventDefault()
                        perguntarSeguimento()
                      }
                    }}
                    placeholder="💬 Pergunte sobre esta resposta (ex.: o que posso oferecer junto?) — Ctrl+Enter para enviar"
                    disabled={carregando || enviandoSeguimento}
                  />
                  <button
                    type="button"
                    className="btn-primary"
                    onClick={perguntarSeguimento}
                    disabled={carregando || enviandoSeguimento || !seguimento.trim()}
                  >
                    {enviandoSeguimento ? '🤖...' : 'Enviar'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}