import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('api', {
  ping: () => ipcRenderer.invoke('app:ping'),
  login: (credenciais) => ipcRenderer.invoke('auth:login', credenciais),
  criarVendedor: (dados) => ipcRenderer.invoke('vendedores:criar', dados),
  atualizarVendedor: (vendedor) => ipcRenderer.invoke('vendedores:atualizar', vendedor),
  listarVendedores: () => ipcRenderer.invoke('vendedores:listar'),
  deletarVendedor: (id) => ipcRenderer.invoke('vendedores:deletar', id),
  listarClientes: (vendedorId) => ipcRenderer.invoke('clientes:listar', vendedorId),
  criarCliente: (cliente) => ipcRenderer.invoke('clientes:criar', cliente),
  atualizarCliente: (cliente) => ipcRenderer.invoke('clientes:atualizar', cliente),
  deletarCliente: (id) => ipcRenderer.invoke('clientes:deletar', id),
  listarVendas: (vendedorId) => ipcRenderer.invoke('vendas:listar', vendedorId),
  listarVendasPorMes: ({ vendedorId, ano, mes }) => ipcRenderer.invoke('vendas:listarPorMes', { vendedorId, ano, mes }),
  criarVenda: (venda) => ipcRenderer.invoke('vendas:criar', venda),
  atualizarVenda: (venda) => ipcRenderer.invoke('vendas:atualizar', venda),
  deletarVenda: (id) => ipcRenderer.invoke('vendas:deletar', id),
  listarOrcamentos: (vendedorId) => ipcRenderer.invoke('orcamentos:listar', vendedorId),
  criarOrcamento: (orcamento) => ipcRenderer.invoke('orcamentos:criar', orcamento),
  deletarOrcamento: (id) => ipcRenderer.invoke('orcamentos:deletar', id),
  listarCidades: () => ipcRenderer.invoke('cidades:listar'),
  consultarCnpj: (cnpj) => ipcRenderer.invoke('cnpj:consultar', cnpj),
  alterarCaminho: (novoCaminho) => ipcRenderer.invoke('config:alterarCaminho', novoCaminho),
  carregarDados: () => ipcRenderer.invoke('dados:carregar'),
  salvarDados: (dados) => ipcRenderer.invoke('dados:salvar', dados),
  caminhoArquivo: () => ipcRenderer.invoke('dados:caminho'),
  focarJanela: () => ipcRenderer.invoke('janela:focar')
})