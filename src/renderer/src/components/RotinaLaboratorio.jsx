import { useMemo, useState } from 'react'

const ROTINAS = [
  'Hematologia',
  'Bioquímica',
  'Urinálise',
  'Coagulação',
  'Sorologia / Imunologia',
  'Hormônios',
  'Microbiologia',
  'Parasitologia',
  'Citologia',
  'Biologia Molecular (PCR)'
]

// Sugestões de exames por rotina (o vendedor pode digitar qualquer um)
const EXAMES_SUGERIDOS = {
  'Hematologia': ['Hemograma completo', 'Contagem de plaquetas', 'Reticulócitos', 'VHS', 'Coagulograma'],
  'Bioquímica': ['Glicose', 'Creatinina', 'Ureia', 'Colesterol', 'Triglicerídeos', 'TGO/AST', 'TGP/ALT', 'Ácido úrico'],
  'Urinálise': ['EAS (Urina I)', 'Urocultura', 'Teste de gravidez'],
  'Coagulação': ['TAP/RNI', 'TTPA', 'Fibrinogênio', 'Dímero D'],
  'Sorologia / Imunologia': ['HBsAg', 'Anti-HCV', 'HIV', 'Dengue IgG/IgM', 'PSA', 'Toxoplasmose'],
  'Hormônios': ['TSH', 'T4 livre', 'T3', 'Cortisol', 'Testosterona', 'Estradiol', 'Progesterona'],
  'Microbiologia': ['Hemocultura', 'Urocultura c/ antibiograma', 'Cultura de secreção'],
  'Parasitologia': ['Parasitológico de fezes', 'Pesquisa de ovos e larvas'],
  'Citologia': ['Papanicolau', 'Punção aspirativa'],
  'Biologia Molecular (PCR)': ['PCR SARS-CoV-2', 'PCR Dengue', 'PCR HIV']
}

// Palavras-chave para ESTIMAR o consumo de tubos a partir das notas fiscais.
// É uma estimativa inicial — o próximo passo é vincular exatamente produto ↔ exame.
const TUBOS_POR_ROTINA = {
  'Hematologia': ['ROXA', 'K3'],
  'Coagulação': ['AZUL', 'CITRATO'],
  'Bioquímica': ['AMARELA', 'AMARELO', 'SORO'],
  'Urinálise': ['VERMELHA'],
  'Sorologia / Imunologia': ['VERMELHA'],
  'Hormônios': ['VERMELHA', 'CINZA'],
  'Microbiologia': ['VERMELHA'],
  'Parasitologia': ['VERMELHA'],
  'Citologia': ['ROXA'],
  'Biologia Molecular (PCR)': ['ROXA']
}

function parseDataLocal(s) {
  if (!s) return null
  const [a, m, d] = String(s).split('-').map(Number)
  if (!a || !m || !d) return null
  return new Date(a, m - 1, d)
}
let seq = 0
const novoid = () => 'rl-' + Date.now() + '-' + seq++

const estiloRL = `
  .rl-painel { display: flex; flex-direction: column; gap: 14px; }
  .rl-cabecalho h4 { margin: 0 0 2px; font-size: 16px; }
  .rl-cliente { color: #64748b; font-size: 12px; }
  .rl-bloco { border: 1px solid #e2e8f0; border-radius: 10px; padding: 12px; }
  .rl-bloco-titulo { display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; font-size: 14px; }
  .rl-total { font-size: 12px; color: #2563eb; font-weight: 700; }
  .rl-vazio { color: #94a3b8; font-size: 13px; margin: 0 0 8px; }
  .rl-linha { display: grid; gap: 8px; margin-bottom: 8px; align-items: center; }
  .rl-linha-exame { grid-template-columns: 170px 1fr 100px 34px; }
  .rl-linha-equip { grid-template-columns: 170px 1fr 34px; }
  .rl-linha select, .rl-linha input { width: 100%; padding: 7px 9px; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 13px; }
  .rl-qtd { text-align: right; }
  .rl-add { margin-top: 4px; }
  .rl-acoes { display: flex; align-items: center; gap: 10px; justify-content: flex-end; margin-top: 4px; }
  .rl-salvo { color: #16a34a; font-size: 13px; font-weight: 700; }
  .rl-nota { font-size: 11px; color: #94a3b8; margin: 8px 0 0; }
  .rl-modal { width: min(880px, 94vw); max-height: 86vh; overflow-y: auto; }
  .rl-margem { margin: 14px 0; }
  .rl-badge { font-size: 11px; padding: 3px 10px; border-radius: 999px; font-weight: 700; white-space: nowrap; }
  .rl-badge-ok { background: #dcfce7; color: #166534; }
  .rl-badge-atencao { background: #fef3c7; color: #92400e; }
  .rl-badge-oportunidade { background: #fee2e2; color: #b91c1c; }
  .rl-badge-semcompra { background: #dbeafe; color: #1e40af; }
`

export default function RotinaLaboratorio({ cliente, comprasNotas, onSalvar, inline }) {
  const [aberto, setAberto] = useState(false)
  const [rotinas, setRotinas] = useState(() =>
    Array.isArray(cliente.rotinas) && cliente.rotinas.length
      ? cliente.rotinas.map((r) => ({ ...r, id: r.id || novoid() }))
      : []
  )
  const [equipamentos, setEquipamentos] = useState(() =>
    Array.isArray(cliente.equipamentos) && cliente.equipamentos.length
      ? cliente.equipamentos.map((e) => ({ ...e, id: e.id || novoid() }))
      : []
  )
  const [salvo, setSalvo] = useState(false)

  const totalExamesMes = rotinas.reduce((s, r) => s + (Number(r.qtd) || 0), 0)

  // ===== Alerta de consumo: rotina cadastrada vs. compras reais nas notas fiscais =====
  const alertas = useMemo(() => {
    if (!Array.isArray(comprasNotas) || comprasNotas.length === 0 || rotinas.length === 0) return []
    const corte = new Date()
    corte.setDate(corte.getDate() - 90)
    const examesPorRotina = {}
    for (const r of rotinas) {
      const q = Number(r.qtd) || 0
      if (q > 0) examesPorRotina[r.rotina] = (examesPorRotina[r.rotina] || 0) + q
    }
    const compraPorRotina = {}
    for (const it of comprasNotas) {
      const desc = String(it.descricao || '').toUpperCase()
      if (!desc.includes('TUBO')) continue
      const d = parseDataLocal(it.data)
      if (!d || d < corte) continue
      const qtd = Number(it.quantidade) || 0
      const fator = desc.includes('C/100') ? 100 : desc.includes('C/50') ? 50 : desc.includes('C/25') ? 25 : 1
      const tubos = qtd * fator
      for (const [rotina, palavras] of Object.entries(TUBOS_POR_ROTINA)) {
        if (palavras.some((p) => desc.includes(p))) {
          compraPorRotina[rotina] = (compraPorRotina[rotina] || 0) + tubos
        }
      }
    }
    const lista = []
    for (const [rotina, examesMes] of Object.entries(examesPorRotina)) {
      const compradoMes = Math.round((compraPorRotina[rotina] || 0) / 3)
      let status = { classe: 'rl-badge-semcompra', texto: 'sem compra de tubos nas notas' }
      if (compradoMes > 0) {
        const razao = compradoMes / examesMes
        if (razao < 0.5) status = { classe: 'rl-badge-oportunidade', texto: 'compra bem abaixo — provável outro fornecedor' }
        else if (razao < 0.8) status = { classe: 'rl-badge-atencao', texto: 'compra abaixo do consumo estimado' }
        else status = { classe: 'rl-badge-ok', texto: 'dentro do esperado' }
      }
      lista.push({ rotina, examesMes, compradoMes, status })
    }
    return lista
  }, [comprasNotas, rotinas])

  function addRotina() { setRotinas((prev) => [...prev, { id: novoid(), rotina: ROTINAS[0], exame: '', qtd: '' }]) }
  function updRotina(id, campo, valor) { setRotinas((prev) => prev.map((r) => (r.id === id ? { ...r, [campo]: valor } : r))) }
  function rmRotina(id) { setRotinas((prev) => prev.filter((r) => r.id !== id)) }
  function addEquip() { setEquipamentos((prev) => [...prev, { id: novoid(), rotina: ROTINAS[0], nome: '' }]) }
  function updEquip(id, campo, valor) { setEquipamentos((prev) => prev.map((e) => (e.id === id ? { ...e, [campo]: valor } : e))) }
  function rmEquip(id) { setEquipamentos((prev) => prev.filter((e) => e.id !== id)) }

  async function salvar() {
    const dados = {
      rotinas: rotinas.filter((r) => r.exame && r.rotina),
      equipamentos: equipamentos.filter((e) => e.nome && e.rotina)
    }
    if (onSalvar) await onSalvar(dados)
    setSalvo(true)
    setTimeout(() => setSalvo(false), 2500)
    setAberto(false)
  }

  const painel = (
    <div className="rl-painel">
      <style>{estiloRL}</style>
      <div className="rl-cabecalho">
        <h4>🧪 Rotina do Laboratório</h4>
        {inline && <span className="rl-cliente">#{cliente.codigo} {cliente.nome}</span>}
      </div>

      {/* Exames por rotina */}
      <div className="rl-bloco">
        <div className="rl-bloco-titulo">
          <strong>🧪 Exames por Rotina</strong>
          <span className="rl-total">{totalExamesMes} exames/mês</span>
        </div>
        {rotinas.length === 0 && <p className="rl-vazio">Nenhum exame cadastrado. Clique em "+ Adicionar exame".</p>}
        {rotinas.map((r) => (
          <div className="rl-linha rl-linha-exame" key={r.id}>
            <select value={r.rotina} onChange={(e) => updRotina(r.id, 'rotina', e.target.value)}>
              {ROTINAS.map((rot) => <option key={rot} value={rot}>{rot}</option>)}
            </select>
            <input
              list={'rl-exames-' + r.id}
              value={r.exame}
              onChange={(e) => updRotina(r.id, 'exame', e.target.value)}
              placeholder="Nome do exame (ex.: hemograma)"
            />
            <datalist id={'rl-exames-' + r.id}>
              {(EXAMES_SUGERIDOS[r.rotina] || []).map((ex) => <option key={ex} value={ex} />)}
            </datalist>
            <input
              type="number" min="0" className="rl-qtd"
              value={r.qtd}
              onChange={(e) => updRotina(r.id, 'qtd', e.target.value)}
              placeholder="Qtd/mês"
              title="Quantidade de exames por mês"
            />
            <button type="button" className="btn-acao btn-acao-danger" onClick={() => rmRotina(r.id)} title="Remover">🗑️</button>
          </div>
        ))}
        <button type="button" className="btn-secondary rl-add" onClick={addRotina}>+ Adicionar exame</button>
      </div>

      {/* Equipamentos */}
      <div className="rl-bloco">
        <div className="rl-bloco-titulo"><strong>🔬 Equipamentos do laboratório</strong></div>
        {equipamentos.length === 0 && <p className="rl-vazio">Nenhum equipamento cadastrado.</p>}
        {equipamentos.map((e) => (
          <div className="rl-linha rl-linha-equip" key={e.id}>
            <select value={e.rotina} onChange={(ev) => updEquip(e.id, 'rotina', ev.target.value)}>
              {ROTINAS.map((rot) => <option key={rot} value={rot}>{rot}</option>)}
            </select>
            <input value={e.nome} onChange={(ev) => updEquip(e.id, 'nome', ev.target.value)} placeholder="Equipamento (ex.: Sysmex XN-1000)" />
            <button type="button" className="btn-acao btn-acao-danger" onClick={() => rmEquip(e.id)} title="Remover">🗑️</button>
          </div>
        ))}
        <button type="button" className="btn-secondary rl-add" onClick={addEquip}>+ Adicionar equipamento</button>
      </div>

      {/* Alerta de consumo vs. notas fiscais */}
      {alertas.length > 0 && (
        <div className="rl-bloco">
          <div className="rl-bloco-titulo"><strong>📊 Consumo estimado vs. compras (notas fiscais)</strong></div>
          <div className="tabela-wrap">
            <table className="tabela">
              <thead>
                <tr><th>Rotina</th><th>Exames/mês</th><th>Comprado (média/mês)</th><th>Situação</th></tr>
              </thead>
              <tbody>
                {alertas.map((a) => (
                  <tr key={a.rotina}>
                    <td><strong>{a.rotina}</strong></td>
                    <td>{a.examesMes}</td>
                    <td>{a.compradoMes > 0 ? '~' + a.compradoMes + ' tubos' : '0'}</td>
                    <td><span className={'rl-badge ' + a.status.classe}>{a.status.texto}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="rl-nota">Estimativa inicial baseada nas notas fiscais (últimos 90 dias). O próximo passo é vincular exatamente produto ↔ exame para ficar mais preciso.</p>
        </div>
      )}

      {/* Ações */}
      <div className="rl-acoes">
        {salvo && <span className="rl-salvo">✅ Salvo!</span>}
        {!inline && <button type="button" className="btn-secondary" onClick={() => setAberto(false)}>Cancelar</button>}
        <button type="button" className="btn-primary" onClick={salvar}>💾 Salvar Rotina</button>
      </div>
    </div>
  )

  if (inline) return painel
  return (
    <>
      <button type="button" className="btn-secondary" onClick={() => setAberto(true)}>🧪 Rotina do Laboratório</button>
      {aberto && (
        <div className="modal-overlay" onClick={() => setAberto(false)}>
          <div className="modal rl-modal" onClick={(e) => e.stopPropagation()}>
            {painel}
          </div>
        </div>
      )}
    </>
  )
}