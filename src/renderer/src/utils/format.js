// ============================================================
// utils/format.js
// Utilitários de formatação centralizados
// Importe nas telas para evitar duplicação de código.
// ============================================================

export const MESES_NOME = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
]

// Formata valor como moeda brasileira: 1200 -> "R$ 1.200,00"
export function fmtValor(v) {
  return Number(v || 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })
}

// Alias compatível (nome usado no ClienteDetalhe)
export const fmtMoeda = fmtValor

// Formata porcentagem: 12.345 -> "12,3%"
export function fmtPct(p) {
  return `${p.toFixed(1).replace('.', ',')}%`
}

// Converte "YYYY-MM-DD" em "DD/MM/AAAA"
export function fmtData(d) {
  if (!d) return ''
  const m = String(d).match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (!m) return d
  return `${m[3]}/${m[2]}/${m[1]}`
}

// Formata data + hora a partir de ISO
export function fmtDataHora(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  return d.toLocaleDateString('pt-BR') + ' ' +
    d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

// Data local no formato YYYY-MM-DD (evita bug de fuso do toISOString)
export function dataLocalISO(d = new Date()) {
  const mes = String(d.getMonth() + 1).padStart(2, '0')
  const dia = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${mes}-${dia}`
}

// Converte "YYYY-MM-DD" em Date local (evita erro de fuso)
export function parseData(d) {
  if (!d) return null
  const m = String(d).match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (!m) return null
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
}

// Início (segunda) e fim (domingo) da semana atual
export function semanaAtualRange() {
  const d = new Date()
  const dia = d.getDay()
  const diff = dia === 0 ? -6 : 1 - dia
  const inicio = new Date(d)
  inicio.setDate(d.getDate() + diff)
  inicio.setHours(0, 0, 0, 0)
  const fim = new Date(inicio)
  fim.setDate(inicio.getDate() + 6)
  fim.setHours(23, 59, 59, 999)
  return { inicio, fim }
}

// ===== Máscaras de moeda para inputs =====

// Máscara COM centavos (campos de valor): "1234" -> "12,34"
// Converte para número com parseMoeda()
export function mascaraMoeda(v) {
  const s = String(v || '').replace(/\D/g, '')
  if (!s) return ''
  const n = Number(s) / 100
  return n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

// Formata número existente para a máscara (usado ao abrir edição)
export function moedaParaMascara(num) {
  return Number(num || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

// Converte a máscara de volta para número: "1.200,00" -> 1200
export function parseMoeda(v) {
  const n = Number(String(v || '').replace(/\D/g, '')) / 100
  return isNaN(n) ? 0 : n
}

// Máscara SEM centavos (metas): 100000 -> "100.000"
// Converte para número com moedaInteiraParaNumero()
export function mascaraMoedaInteira(v) {
  const s = String(v || '').replace(/\D/g, '')
  if (!s) return ''
  return Number(s).toLocaleString('pt-BR')
}

// Converte a máscara inteira de volta para número: "100.000" -> 100000
export function moedaInteiraParaNumero(v) {
  return Number(String(v || '').replace(/\D/g, '')) || 0
}

// ===== Formatações específicas =====

// CNPJ: 12345678000199 -> "12.345.678/0001-99"
export function fmtCnpj(v) {
  const s = String(v || '').replace(/\D/g, '')
  if (s.length !== 14) return v || ''
  return `${s.slice(0, 2)}.${s.slice(2, 5)}.${s.slice(5, 8)}/${s.slice(8, 12)}-${s.slice(12)}`
}

// Telefone: 11987654321 -> "(11) 98765-4321" | 1134567890 -> "(11) 3456-7890"
export function fmtFone(v) {
  const s = String(v || '').replace(/\D/g, '')
  if (s.length === 11) return `(${s.slice(0, 2)}) ${s.slice(2, 7)}-${s.slice(7)}`
  if (s.length === 10) return `(${s.slice(0, 2)}) ${s.slice(2, 6)}-${s.slice(6)}`
  return v || ''
}

// Tamanho de arquivo: 1536 -> "1,50 KB"
export function fmtTamanho(bytes) {
  if (!bytes) return ''
  const kb = bytes / 1024
  return kb >= 1024 ? (kb / 1024).toFixed(2) + ' MB' : Math.round(kb) + ' KB'
}