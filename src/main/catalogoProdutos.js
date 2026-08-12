// ============================================================
// catalogoProdutos.js — Catálogo de produtos com fichas técnicas
// Base de conhecimento biomédico da IA para a aba Consultar
// Gerado a partir dos produtos das notas fiscais (notas.json)
// ============================================================

export const CATALOGO_PRODUTOS = [
  // ============ TUBOS DE COLETA A VÁCUO ============
  {
    codigo: '2942',
    descricao: 'TUBO VACUO ROXA K3 4,0ML C/100 PREMIUM (454036BR)',
    categoria: 'Tubos de coleta a vácuo',
    termos: ['tubo vacuo roxa', 'tubo roxa', 'k3', 'edta', 'roxo', 'hemograma'],
    ficha: {
      nome: 'Tubo a vácuo Roxo K3EDTA 4,0mL',
      categoria: 'Tubos de coleta a vácuo',
      descricao: 'Tubo a vácuo com anticoagulante K3EDTA (etilenodiaminotetracético), tampa roxa, para coleta de sangue venoso.',
      aplicacoes: ['Hemograma completo', 'Contagem de células sanguíneas', 'Exames hematológicos', 'VHS (em alguns casos)'],
      indicacoes: 'Coleta de sangue para hematologia. O EDTA preserva a morfologia celular.',
      restricoes: 'NÃO usar para dosagem de cálcio, potássio, sódio, ferro e magnésio (interferência do EDTA).',
      compatibilidades: ['Agulha múltipla a vácuo', 'Adaptador para tubo', 'Garra/rack para tubos'],
      cuidados: 'Homogeneizar suavemente 8-10 vezes após coleta. Armazenar em temperatura ambiente.'
    }
  },
  {
    codigo: '2137',
    descricao: 'TUBO VACUO VERMELHO SILICONIZADO 4,0ML C/100 PREMIUM',
    categoria: 'Tubos de coleta a vácuo',
    termos: ['tubo vacuo vermelho', 'tubo vermelho', 'siliconizado', 'sem anticoagulante'],
    ficha: {
      nome: 'Tubo a vácuo Vermelho Siliconizado 4,0mL',
      categoria: 'Tubos de coleta a vácuo',
      descricao: 'Tubo a vácuo com ativador de coágulo e gel separador (ou siliconizado), tampa vermelha, sem anticoagulante.',
      aplicacoes: ['Dosagens bioquímicas', 'Sorologias', 'Hormônios', 'Exames que usam soro'],
      indicacoes: 'Coleta de sangue para obtenção de soro (bioquímica, sorologia, imunologia).',
      restricoes: 'Não usar para exames que exigem plasma ou sangue total.',
      compatibilidades: ['Agulha múltipla a vácuo', 'Adaptador', 'Centrífuga'],
      cuidados: 'Aguardar coagulação completa antes de centrifugar. Não agitar.'
    }
  },
  {
    codigo: '4378',
    descricao: 'TUBO VACUO VERMELHO C/GEL 3,5ML C/100 PREMIUM',
    categoria: 'Tubos de coleta a vácuo',
    termos: ['tubo vacuo vermelho gel', 'tubo gel', 'soro com gel', 'separador'],
    ficha: {
      nome: 'Tubo a vácuo Vermelho com Gel 3,5mL',
      categoria: 'Tubos de coleta a vácuo',
      descricao: 'Tubo a vácuo com gel separador de soro, tampa vermelha, para obtenção de soro de alta qualidade.',
      aplicacoes: ['Bioquímica clínica', 'Sorologia', 'Dosagens hormonais', 'Imunoensaios'],
      indicacoes: 'Coleta de sangue para exames que exigem soro separado do coágulo.',
      restricoes: 'Não usar para exames que exigem plasma ou sangue total.',
      compatibilidades: ['Agulha múltipla', 'Centrífuga', 'Adaptador'],
      cuidados: 'Centrifugar após coagulação. O gel forma barreira entre soro e coágulo.'
    }
  },
  {
    codigo: '4392',
    descricao: 'TUBO VACUO AZUL 3,5 ML C/100 PREMIUM (454327BR) CITRATO',
    categoria: 'Tubos de coleta a vácuo',
    termos: ['tubo vacuo azul', 'tubo azul', 'citrato', 'coagulacao', 'coagulação'],
    ficha: {
      nome: 'Tubo a vácuo Azul com Citrato de Sódio 3,5mL',
      categoria: 'Tubos de coleta a vácuo',
      descricao: 'Tubo a vácuo com citrato de sódio 3,2%, tampa azul, para exames de coagulação.',
      aplicacoes: ['Tempo de Protrombina (TP)', 'Tempo de Tromboplastina Parcial (TTPa)', 'Fibrinogênio', 'Exames de coagulação'],
      indicacoes: 'Coleta de sangue para estudos de coagulação. O citrato quelifica o cálcio.',
      restricoes: 'Volume deve ser preenchido exatamente (proporção sangue/citrato 9:1).',
      compatibilidades: ['Agulha múltipla', 'Centrífuga', 'Analisadores de coagulação'],
      cuidados: 'Homogeneizar suavemente. Preencher até a marca indicada.'
    }
  },
  {
    codigo: '2949',
    descricao: 'TUBO VACUO VERDE HEPARINA SODICA 9,0ML C/100 (455051BR)',
    categoria: 'Tubos de coleta a vácuo',
    termos: ['tubo vacuo verde', 'tubo verde', 'heparina', 'plasma'],
    ficha: {
      nome: 'Tubo a vácuo Verde com Heparina Sódica 9,0mL',
      categoria: 'Tubos de coleta a vácuo',
      descricao: 'Tubo a vácuo com heparina sódica (ou lítio), tampa verde, para obtenção de plasma.',
      aplicacoes: ['Gasometria', 'Dosagens bioquímicas em plasma', 'Exames que exigem plasma', 'Eletrólitos'],
      indicacoes: 'Coleta de sangue para exames que exigem plasma heparinizado.',
      restricoes: 'Não usar para exames que exigem soro ou sangue total com EDTA.',
      compatibilidades: ['Agulha múltipla', 'Centrífuga', 'Analisadores'],
      cuidados: 'Homogeneizar suavemente. Centrifugar para separar plasma.'
    }
  },
  {
    codigo: '2976',
    descricao: 'TUBO VACUO BRANCO SEM ADITIVO 3,0ML C/100 (454241BR)',
    categoria: 'Tubos de coleta a vácuo',
    termos: ['tubo vacuo branco', 'tubo branco', 'sem aditivo', 'sangue total'],
    ficha: {
      nome: 'Tubo a vácuo Branco Sem Aditivo 3,0mL',
      categoria: 'Tubos de coleta a vácuo',
      descricao: 'Tubo a vácuo sem aditivo, tampa branca, para coleta de sangue total sem anticoagulante.',
      aplicacoes: ['Dosagens de elementos traço', 'Exames que exigem sangue sem aditivos', 'Testes específicos'],
      indicacoes: 'Coleta de sangue quando não se deseja anticoagulante ou ativador.',
      restricoes: 'Uso restrito a exames específicos que exigem tubo sem aditivo.',
      compatibilidades: ['Agulha múltipla', 'Adaptador'],
      cuidados: 'Verificar indicação do exame antes do uso.'
    }
  },
  // ============ AGULHAS E COLETA ============
  {
    codigo: '3835',
    descricao: 'AGULHA MULTIPLA VACUO 25X7 C/100 (AGV2507) 22G',
    categoria: 'Agulhas e coleta',
    termos: ['agulha multipla', 'agulha vacuo', '25x7', '22g', 'coleta sangue'],
    ficha: {
      nome: 'Agulha Múltipla a Vácuo 25x7 (22G)',
      categoria: 'Agulhas e coleta',
      descricao: 'Agulha múltipla para sistema de coleta a vácuo, calibre 22G, com dupla extremidade (veia e tubo).',
      aplicacoes: ['Coleta de sangue a vácuo', 'Punção venosa', 'Coleta em múltiplos tubos'],
      indicacoes: 'Uso com tubos a vácuo para coleta de sangue venoso.',
      restricoes: 'Descartável e de uso único. Descarte em perfurocortante.',
      compatibilidades: ['Tubos a vácuo', 'Adaptador/garra', 'Luvas'],
      cuidados: 'Não reutilizar. Descarte em recipiente rígido para perfurocortantes.'
    }
  },
  {
    codigo: '2959',
    descricao: 'AGULHA MULTIPLA VACUO 25X8 C/100 (004730) 21G',
    categoria: 'Agulhas e coleta',
    termos: ['agulha multipla', '25x8', '21g', 'agulha vacuo'],
    ficha: {
      nome: 'Agulha Múltipla a Vácuo 25x8 (21G)',
      categoria: 'Agulhas e coleta',
      descricao: 'Agulha múltipla a vácuo, calibre 21G, para coleta de sangue venoso.',
      aplicacoes: ['Coleta de sangue a vácuo', 'Punção venosa'],
      indicacoes: 'Calibre 21G — adequado para a maioria das coletas de sangue.',
      restricoes: 'Descartável. Descarte em perfurocortante.',
      compatibilidades: ['Tubos a vácuo', 'Adaptador'],
      cuidados: 'Não reutilizar. Descarte adequado.'
    }
  },
  {
    codigo: '3343',
    descricao: 'AGULHA DESCART 25X7 COM 100UN (10660610061)',
    categoria: 'Agulhas e coleta',
    termos: ['agulha descart', 'agulha descartavel', '25x7', 'seringa'],
    ficha: {
      nome: 'Agulha Descartável 25x7',
      categoria: 'Agulhas e coleta',
      descricao: 'Agulha descartável para uso com seringa, calibre 25x7, para injeções e aspirações.',
      aplicacoes: ['Injeções', 'Aspirações', 'Coleta com seringa'],
      indicacoes: 'Uso geral em procedimentos com seringa.',
      restricoes: 'Descartável. Descarte em perfurocortante.',
      compatibilidades: ['Seringas', 'Luvas'],
      cuidados: 'Não reutilizar. Descarte adequado.'
    }
  },
  // ============ REAGENTES E KITS DE DIAGNÓSTICO ============
  {
    codigo: '5053',
    descricao: 'TROPONINA I PACK 25 TESTES (639025 R)',
    categoria: 'Kits de diagnóstico',
    termos: ['troponina', 'troponina i', 'infarto', 'cardiaco', 'cardíaco'],
    ficha: {
      nome: 'Troponina I — Kit 25 Testes',
      categoria: 'Kits de diagnóstico',
      descricao: 'Teste rápido/imunoensaio para detecção de Troponina I, marcador cardíaco de lesão do miocárdio.',
      aplicacoes: ['Diagnóstico de infarto agudo do miocárdio (IAM)', 'Síndromes coronarianas agudas', 'Avaliação de lesão cardíaca'],
      indicacoes: 'Dosagem de troponina I para avaliação de dano ao músculo cardíaco.',
      restricoes: 'Resultado deve ser interpretado com contexto clínico.',
      compatibilidades: ['Soro ou plasma', 'Analisadores de imunoensaio'],
      cuidados: 'Armazenar conforme instruções do fabricante. Não congelar.'
    }
  },
  {
    codigo: '252',
    descricao: 'COVID 19 / INFLUENZA A/B AG 25 TESTES (677025E AG)',
    categoria: 'Kits de diagnóstico',
    termos: ['covid', 'influenza', 'antigeno', 'antígeno', 'teste rapido', 'teste rápido'],
    ficha: {
      nome: 'Teste Rápido COVID-19 / Influenza A/B (Antígeno)',
      categoria: 'Kits de diagnóstico',
      descricao: 'Teste rápido de antígeno para detecção simultânea de COVID-19 e Influenza A/B em amostras respiratórias.',
      aplicacoes: ['Diagnóstico de COVID-19', 'Diagnóstico de Influenza A/B', 'Triagem respiratória'],
      indicacoes: 'Detecção qualitativa de antígenos virais em swab nasal/nasofaríngeo.',
      restricoes: 'Resultado qualitativo. Confirmar com teste molecular se necessário.',
      compatibilidades: ['Swab nasal/nasofaríngeo', 'Solução tampão do kit'],
      cuidados: 'Armazenar em temperatura ambiente. Ler resultado no tempo indicado.'
    }
  },
  {
    codigo: '1728',
    descricao: 'DENGUE RAPIDO (NS1) PACK 25 TESTES (659025AG30ER) PD',
    categoria: 'Kits de diagnóstico',
    termos: ['dengue', 'ns1', 'teste rapido', 'teste rápido', 'arbovirose'],
    ficha: {
      nome: 'Teste Rápido Dengue NS1 — Kit 25 Testes',
      categoria: 'Kits de diagnóstico',
      descricao: 'Teste rápido para detecção do antígeno NS1 do vírus da dengue em fase aguda.',
      aplicacoes: ['Diagnóstico precoce de dengue', 'Triagem de arboviroses', 'Detecção na fase aguda (1-5 dias)'],
      indicacoes: 'Detecção qualitativa do antígeno NS1 do vírus da dengue.',
      restricoes: 'Negativo na fase aguda não exclui dengue (pode exigir sorologia IgM).',
      compatibilidades: ['Soro, plasma ou sangue total', 'Solução tampão do kit'],
      cuidados: 'Usar na fase aguda da doença para melhor sensibilidade.'
    }
  },
  {
    codigo: '2993',
    descricao: 'HIV PACK 1+2 25 TESTES',
    categoria: 'Kits de diagnóstico',
    termos: ['hiv', 'teste rapido', 'teste rápido', 'aids', 'imunodeficiencia'],
    ficha: {
      nome: 'Teste Rápido HIV 1+2 — Kit 25 Testes',
      categoria: 'Kits de diagnóstico',
      descricao: 'Teste rápido para detecção de anticorpos contra HIV-1 e HIV-2.',
      aplicacoes: ['Diagnóstico de HIV', 'Triagem de infecção por HIV', 'Aconselhamento e testagem'],
      indicacoes: 'Detecção qualitativa de anticorpos anti-HIV-1 e anti-HIV-2.',
      restricoes: 'Resultado reagente exige confirmação por teste complementar (Western Blot, molecular).',
      compatibilidades: ['Soro, plasma ou sangue total', 'Solução tampão do kit'],
      cuidados: 'Seguir janela imunológica. Resultados reagentes exigem confirmação.'
    }
  },
  {
    codigo: '5076',
    descricao: 'HEPATITE C PACK 25 TESTES (621025 R I)',
    categoria: 'Kits de diagnóstico',
    termos: ['hepatite c', 'hcv', 'teste rapido', 'teste rápido'],
    ficha: {
      nome: 'Teste Rápido Hepatite C — Kit 25 Testes',
      categoria: 'Kits de diagnóstico',
      descricao: 'Teste rápido para detecção de anticorpos contra o vírus da hepatite C (HCV).',
      aplicacoes: ['Diagnóstico de hepatite C', 'Triagem de HCV', 'Aconselhamento'],
      indicacoes: 'Detecção qualitativa de anticorpos anti-HCV.',
      restricoes: 'Resultado reagente exige confirmação (PCR, Western Blot).',
      compatibilidades: ['Soro, plasma ou sangue total', 'Solução tampão'],
      cuidados: 'Seguir janela imunológica. Resultados reagentes exigem confirmação.'
    }
  },
  {
    codigo: '256',
    descricao: 'HEPATITE B PLUS PACK 25 TESTES (617025P R)',
    categoria: 'Kits de diagnóstico',
    termos: ['hepatite b', 'hbsag', 'teste rapido', 'teste rápido'],
    ficha: {
      nome: 'Teste Rápido Hepatite B — Kit 25 Testes',
      categoria: 'Kits de diagnóstico',
      descricao: 'Teste rápido para detecção do antígeno de superfície da hepatite B (HBsAg).',
      aplicacoes: ['Diagnóstico de hepatite B', 'Triagem de HBsAg', 'Aconselhamento'],
      indicacoes: 'Detecção qualitativa do antígeno HBsAg.',
      restricoes: 'Resultado reagente exige confirmação laboratorial.',
      compatibilidades: ['Soro, plasma ou sangue total', 'Solução tampão'],
      cuidados: 'Seguir janela imunológica.'
    }
  },
  {
    codigo: '4985',
    descricao: 'VDRL 1X4,5ML 200 TESTES COM CONTROLES (1853155)',
    categoria: 'Reagentes de sorologia',
    termos: ['vdrl', 'sifilis', 'sífilis', 'sorologia', 'treponema'],
    ficha: {
      nome: 'VDRL — Reagente para Sífilis (200 Testes)',
      categoria: 'Reagentes de sorologia',
      descricao: 'Reagente VDRL para teste não treponêmico de triagem da sífilis.',
      aplicacoes: ['Triagem de sífilis', 'Monitoramento de tratamento', 'Sorologia'],
      indicacoes: 'Detecção de anticorpos não treponêmicos (reagina) na sífilis.',
      restricoes: 'Teste de triagem — positivos devem ser confirmados com teste treponêmico.',
      compatibilidades: ['Soro inativado', 'Lâmina de vidro', 'Agitador rotatório'],
      cuidados: 'Armazenar refrigerado. Inativar soro antes do teste.'
    }
  },
  {
    codigo: '466',
    descricao: 'VDRL 5,5ML 250 TESTES (1853151) PRONTO PRA USO',
    categoria: 'Reagentes de sorologia',
    termos: ['vdrl', 'sifilis', 'sífilis', 'sorologia'],
    ficha: {
      nome: 'VDRL Pronto para Uso — 250 Testes',
      categoria: 'Reagentes de sorologia',
      descricao: 'Reagente VDRL pronto para uso, para triagem de sífilis.',
      aplicacoes: ['Triagem de sífilis', 'Sorologia'],
      indicacoes: 'Detecção de anticorpos não treponêmicos na sífilis.',
      restricoes: 'Triagem — confirmar positivos.',
      compatibilidades: ['Soro', 'Lâmina', 'Agitador'],
      cuidados: 'Armazenar refrigerado.'
    }
  },
  {
    codigo: '367',
    descricao: 'SORO ANTI A,B 10ML(031032000)',
    categoria: 'Reagentes de tipagem sanguínea',
    termos: ['soro anti a', 'anti a', 'tipagem', 'grupo sanguineo', 'grupo sanguíneo'],
    ficha: {
      nome: 'Soro Anti-A para Tipagem Sanguínea',
      categoria: 'Reagentes de tipagem sanguínea',
      descricao: 'Reagente Anti-A para tipagem do sistema ABO (hemácias com antígeno A).',
      aplicacoes: ['Tipagem sanguínea ABO', 'Banco de sangue', 'Imuno-hematologia'],
      indicacoes: 'Determinação do grupo sanguíneo ABO (aglutinação com hemácias A).',
      restricoes: 'Uso em banco de sangue e imuno-hematologia.',
      compatibilidades: ['Lâmina', 'Sangue total ou hemácias', 'Soro Anti-B, Anti-D'],
      cuidados: 'Armazenar refrigerado. Não congelar.'
    }
  },
  {
    codigo: '368',
    descricao: 'SORO ANTI B 10ML (031022000)',
    categoria: 'Reagentes de tipagem sanguínea',
    termos: ['soro anti b', 'anti b', 'tipagem', 'grupo sanguineo', 'grupo sanguíneo'],
    ficha: {
      nome: 'Soro Anti-B para Tipagem Sanguínea',
      categoria: 'Reagentes de tipagem sanguínea',
      descricao: 'Reagente Anti-B para tipagem do sistema ABO (hemácias com antígeno B).',
      aplicacoes: ['Tipagem sanguínea ABO', 'Banco de sangue', 'Imuno-hematologia'],
      indicacoes: 'Determinação do grupo sanguíneo ABO.',
      restricoes: 'Uso em banco de sangue.',
      compatibilidades: ['Lâmina', 'Sangue total', 'Soro Anti-A, Anti-D'],
      cuidados: 'Armazenar refrigerado.'
    }
  },
  {
    codigo: '369',
    descricao: 'SORO ANTI D 10ML (032042000)',
    categoria: 'Reagentes de tipagem sanguínea',
    termos: ['soro anti d', 'anti d', 'fator rh', 'tipagem', 'rh'],
    ficha: {
      nome: 'Soro Anti-D para Tipagem do Fator Rh',
      categoria: 'Reagentes de tipagem sanguínea',
      descricao: 'Reagente Anti-D para determinação do fator Rh (D).',
      aplicacoes: ['Tipagem do fator Rh', 'Banco de sangue', 'Imuno-hematologia'],
      indicacoes: 'Determinação do fator Rh (positivo/negativo).',
      restricoes: 'Uso em banco de sangue.',
      compatibilidades: ['Lâmina', 'Sangue total', 'Soro Anti-A, Anti-B'],
      cuidados: 'Armazenar refrigerado.'
    }
  },
  {
    codigo: '374',
    descricao: 'SORO COOMBS 10ML',
    categoria: 'Reagentes de tipagem sanguínea',
    termos: ['coombs', 'soro coombs', 'teste antiglobulina', 'antiglobulina'],
    ficha: {
      nome: 'Soro de Coombs (Teste de Antiglobulina)',
      categoria: 'Reagentes de tipagem sanguínea',
      descricao: 'Reagente de Coombs (antiglobulina humana) para teste direto e indireto de antiglobulina.',
      aplicacoes: ['Teste de Coombs direto', 'Teste de Coombs indireto', 'Doença hemolítica do recém-nascido', 'Pesquisa de anticorpos irregulares'],
      indicacoes: 'Detecção de anticorpos ligados a hemácias (direto) ou no soro (indireto).',
      restricoes: 'Uso em banco de sangue e imuno-hematologia.',
      compatibilidades: ['Hemácias', 'Soro', 'Centrífuga'],
      cuidados: 'Armazenar refrigerado.'
    }
  },
  {
    codigo: '4676',
    descricao: 'PCR LATEX AVULSO 2,5ML 100 TESTES (2900 L)',
    categoria: 'Reagentes de sorologia',
    termos: ['pcr latex', 'latex', 'proteina c reativa', 'pcr'],
    ficha: {
      nome: 'PCR Látex — Proteína C Reativa (100 Testes)',
      categoria: 'Reagentes de sorologia',
      descricao: 'Reagente de látex para detecção qualitativa/semiquantitativa da Proteína C Reativa (PCR).',
      aplicacoes: ['Marcador de inflamação', 'Infecções', 'Acompanhamento de processos inflamatórios'],
      indicacoes: 'Detecção de PCR como marcador de fase aguda de inflamação.',
      restricoes: 'Teste qualitativo/semiquantitativo.',
      compatibilidades: ['Soro', 'Lâmina', 'Agitador'],
      cuidados: 'Armazenar refrigerado.'
    }
  },
  // ============ MEIOS DE CULTURA E MICROBIOLOGIA ============
  {
    codigo: '4634',
    descricao: 'PLACA PRONTA SS/MAC CONKEY (90X15) COM 10UN (8404)',
    categoria: 'Meios de cultura',
    termos: ['placa pronta', 'mac conkey', 'ss', 'agar', 'microbiologia'],
    ficha: {
      nome: 'Placa Pronta SS/MacConkey 90x15 (10un)',
      categoria: 'Meios de cultura',
      descricao: 'Placa de Petri com meio seletivo SS (Salmonella-Shigella) e MacConkey para isolamento de enterobactérias.',
      aplicacoes: ['Isolamento de Salmonella', 'Isolamento de Shigella', 'Cultura de fezes', 'Microbiologia clínica'],
      indicacoes: 'Cultivo de bactérias entéricas gram-negativas.',
      restricoes: 'Meio seletivo — não usar para bactérias gram-positivas.',
      compatibilidades: ['Swab retal/fezes', 'Alça de platina', 'Estufa bacteriológica'],
      cuidados: 'Armazenar refrigerado. Não congelar.'
    }
  },
  {
    codigo: '4136',
    descricao: 'PLACA PRONTA SANGUE (90X15) 10UN (540159)',
    categoria: 'Meios de cultura',
    termos: ['placa pronta sangue', 'agar sangue', 'blood agar', 'microbiologia'],
    ficha: {
      nome: 'Placa Pronta Ágar Sangue 90x15 (10un)',
      categoria: 'Meios de cultura',
      descricao: 'Placa de Petri com ágar sangue (ágar base + sangue) para cultivo de bactérias exigentes.',
      aplicacoes: ['Cultivo geral de bactérias', 'Hemólise (alfa, beta, gama)', 'Isolamento de estreptococos, estafilococos', 'Microbiologia clínica'],
      indicacoes: 'Meio enriquecido para cultivo de microrganismos exigentes.',
      restricoes: 'Meio não seletivo — crescimento de muitos microrganismos.',
      compatibilidades: ['Swab', 'Alça', 'Estufa'],
      cuidados: 'Armazenar refrigerado. Não congelar.'
    }
  },
  {
    codigo: '4143',
    descricao: 'PLACA PRONTA MUELLER HINTON (140X15) 10UN (542518)',
    categoria: 'Meios de cultura',
    termos: ['mueller hinton', 'antibiograma', 'placa pronta', 'microbiologia'],
    ficha: {
      nome: 'Placa Pronta Mueller Hinton 140x15 (10un)',
      categoria: 'Meios de cultura',
      descricao: 'Placa de Petri com ágar Mueller Hinton, meio padrão para teste de sensibilidade a antibióticos (antibiograma).',
      aplicacoes: ['Antibiograma (disco-difusão)', 'Teste de sensibilidade a antibióticos', 'Microbiologia clínica'],
      indicacoes: 'Meio padronizado para teste de sensibilidade antimicrobiana.',
      restricoes: 'Uso específico para antibiograma.',
      compatibilidades: ['Discos de antibióticos', 'Inóculo bacteriano', 'Estufa'],
      cuidados: 'Armazenar refrigerado. Espessura do ágar padronizada.'
    }
  },
  {
    codigo: '1142',
    descricao: 'AGAR SAL MANITOL 500GR (K25 1062)',
    categoria: 'Meios de cultura',
    termos: ['agar sal manitol', 'manitol', 'estafilococos', 'microbiologia'],
    ficha: {
      nome: 'Ágar Sal Manitol 500g',
      categoria: 'Meios de cultura',
      descricao: 'Meio seletivo e diferencial para isolamento de estafilococos (fermentação de manitol).',
      aplicacoes: ['Isolamento de Staphylococcus', 'Diferenciação de S. aureus', 'Microbiologia clínica'],
      indicacoes: 'Meio seletivo para estafilococos.',
      restricoes: 'Alta concentração de sal inibe a maioria das outras bactérias.',
      compatibilidades: ['Swab', 'Alça', 'Estufa'],
      cuidados: 'Armazenar em local seco.'
    }
  },
  {
    codigo: '1179',
    descricao: 'AGAR UREIA 3ML CAIXA 10 TUBOS (ST00401/510012)',
    categoria: 'Meios de cultura',
    termos: ['agar ureia', 'ureia', 'proteus', 'microbiologia'],
    ficha: {
      nome: 'Ágar Ureia — Tubos (10 tubos)',
      categoria: 'Meios de cultura',
      descricao: 'Meio para detecção da atividade de urease (identificação de bactérias produtoras de urease, ex: Proteus).',
      aplicacoes: ['Teste de urease', 'Identificação de Proteus', 'Microbiologia'],
      indicacoes: 'Detecção de bactérias urease-positivas.',
      restricoes: 'Uso em identificação bacteriana.',
      compatibilidades: ['Inóculo bacteriano', 'Estufa'],
      cuidados: 'Armazenar refrigerado.'
    }
  },
  // ============ VIDRARIA E EQUIPAMENTOS ============
  {
    codigo: '1997',
    descricao: 'CAMARA NEWBAUER ESPELHADA DUPLA (NEWOPTIK) (7301 1B)',
    categoria: 'Equipamentos de laboratório',
    termos: ['camara newbauer', 'newbauer', 'hemocitometro', 'contagem celular'],
    ficha: {
      nome: 'Câmara de Newbauer Espelhada Dupla',
      categoria: 'Equipamentos de laboratório',
      descricao: 'Câmara de contagem (hemocitômetro) de Newbauer, espelhada dupla, para contagem de células ao microscópio.',
      aplicacoes: ['Contagem de hemácias', 'Contagem de leucócitos', 'Contagem de plaquetas', 'Contagem de células em líquidos biológicos'],
      indicacoes: 'Contagem manual de células em hematologia e líquidos corporais.',
      restricoes: 'Exige microscópio óptico e técnica manual.',
      compatibilidades: ['Microscópio', 'Lâmina de cobertura', 'Diluentes'],
      cuidados: 'Manter limpa. Não riscar a superfície de contagem.'
    }
  },
  {
    codigo: '5602',
    descricao: 'MICROPIPETA VARIAVEL 100 1000 UL (PEGUE1000V)',
    categoria: 'Equipamentos de laboratório',
    termos: ['micropipeta', 'pipeta variavel', '100 1000 ul', 'pipetagem'],
    ficha: {
      nome: 'Micropipeta Variável 100-1000µL',
      categoria: 'Equipamentos de laboratório',
      descricao: 'Micropipeta monocanal de volume variável (100-1000µL) para dispensação precisa de líquidos.',
      aplicacoes: ['Pipetagem de reagentes', 'Preparo de soluções', 'Diluições', 'Dosagens laboratoriais'],
      indicacoes: 'Dispensação precisa de volumes entre 100 e 1000µL.',
      restricoes: 'Usar ponteiras compatíveis. Calibrar periodicamente.',
      compatibilidades: ['Ponteiras', 'Reagentes', 'Tubos'],
      cuidados: 'Calibrar regularmente. Não pipetar líquidos corrosivos sem ponteira adequada.'
    }
  },
  {
    codigo: '404',
    descricao: 'MICROPIPETA VARIAVEL 20 200 UL (PEGUE200V)',
    categoria: 'Equipamentos de laboratório',
    termos: ['micropipeta', 'pipeta variavel', '20 200 ul'],
    ficha: {
      nome: 'Micropipeta Variável 20-200µL',
      categoria: 'Equipamentos de laboratório',
      descricao: 'Micropipeta monocanal de volume variável (20-200µL) para dispensação precisa de líquidos.',
      aplicacoes: ['Pipetagem de reagentes', 'Preparo de soluções', 'Diluições'],
      indicacoes: 'Dispensação precisa de volumes entre 20 e 200µL.',
      restricoes: 'Usar ponteiras compatíveis.',
      compatibilidades: ['Ponteiras', 'Tubos'],
      cuidados: 'Calibrar periodicamente.'
    }
  },
  {
    codigo: '3104',
    descricao: 'PLACA PETRI VIDRO 80X15MM BORO (121208015)',
    categoria: 'Vidraria de laboratório',
    termos: ['placa petri', 'petri', 'vidro', 'cultura', 'microbiologia'],
    ficha: {
      nome: 'Placa de Petri de Vidro 80x15mm (Borosilicato)',
      categoria: 'Vidraria de laboratório',
      descricao: 'Placa de Petri em vidro borossilicato, 80mm, para cultivo de microrganismos.',
      aplicacoes: ['Cultivo de bactérias e fungos', 'Semeadura', 'Microbiologia'],
      indicacoes: 'Laboratórios de microbiologia.',
      restricoes: 'Vidro — manusear com cuidado.',
      compatibilidades: ['Meios de cultura', 'Alça', 'Estufa'],
      cuidados: 'Esterilizar antes do uso.'
    }
  },
  {
    codigo: '5539',
    descricao: 'PLACA PETRI DESCARTAVEL 90X15 LISA C/10 (18248E)',
    categoria: 'Vidraria de laboratório',
    termos: ['placa petri descartavel', 'petri descartavel', '90x15'],
    ficha: {
      nome: 'Placa de Petri Descartável 90x15 (10un)',
      categoria: 'Vidraria de laboratório',
      descricao: 'Placa de Petri descartável em poliestireno, 90x15mm, estéril, para cultivo de microrganismos.',
      aplicacoes: ['Cultivo de microrganismos', 'Microbiologia', 'Descarte após uso'],
      indicacoes: 'Uso único em microbiologia.',
      restricoes: 'Descartável — não reutilizar.',
      compatibilidades: ['Meios de cultura', 'Alça', 'Estufa'],
      cuidados: 'Manter embalagem fechada até o uso.'
    }
  },
  {
    codigo: '5534',
    descricao: 'LAMINA 25,4X76,2 (26X76) FOSCA NAO LAPIDADA COM 50UN',
    categoria: 'Material para microscopia',
    termos: ['lamina', 'lâmina', 'fosca', 'microscopia', '26x76'],
    ficha: {
      nome: 'Lâmina de Microscopia 26x76mm Fosca (50un)',
      categoria: 'Material para microscopia',
      descricao: 'Lâminas de vidro para microscopia, 26x76mm, com borda fosca para identificação.',
      aplicacoes: ['Exames ao microscópio', 'Esfregaços', 'Citologia', 'Hematologia'],
      indicacoes: 'Preparação de amostras para exame microscópico.',
      restricoes: 'Vidro frágil.',
      compatibilidades: ['Lamínula', 'Microscópio', 'Corantes'],
      cuidados: 'Manter em embalagem seca.'
    }
  },
  // ============ CONSUMÍVEIS ============
  {
    codigo: '613',
    descricao: 'COLETOR UNIVERSAL 80ML ESTERIL INDIVIDUAL',
    categoria: 'Consumíveis',
    termos: ['coletor universal', 'coletor', '80ml', 'urina', 'fezes'],
    ficha: {
      nome: 'Coletor Universal 80mL Estéril',
      categoria: 'Consumíveis',
      descricao: 'Frasco coletor universal estéril, 80mL, para coleta de urina, fezes e outras amostras biológicas.',
      aplicacoes: ['Coleta de urina', 'Coleta de fezes', 'Coleta de amostras biológicas'],
      indicacoes: 'Coleta e transporte de amostras para exames laboratoriais.',
      restricoes: 'Uso único. Estéril.',
      compatibilidades: ['Urina', 'Fezes', 'Amostras biológicas'],
      cuidados: 'Manter embalagem fechada até o uso.'
    }
  },
  {
    codigo: '2284',
    descricao: 'TIRA URINA 10 AREAS 100 TESTES URI COLOR CHECK (524100 U)',
    categoria: 'Consumíveis',
    termos: ['tira urina', 'urina', '10 areas', '10 áreas', 'eab', 'urinalise'],
    ficha: {
      nome: 'Tira de Urina 10 Parâmetros (100 Testes)',
      categoria: 'Consumíveis',
      descricao: 'Tiras reagentes para análise de urina com 10 parâmetros (glicose, proteína, sangue, pH, etc.).',
      aplicacoes: ['Análise de urina (EAS)', 'Triagem urinária', 'Monitoramento de doenças'],
      indicacoes: 'Análise qualitativa/semiquantitativa de parâmetros urinários.',
      restricoes: 'Ler no tempo indicado para evitar falsos resultados.',
      compatibilidades: ['Urina', 'Leitor de tiras (opcional)'],
      cuidados: 'Armazenar em frasco fechado, local seco. Não tocar nas áreas reagentes.'
    }
  },
  {
    codigo: '4941',
    descricao: 'ALCA DESCARTAVEL 10UL ESTERIL INDIVIDUAL COM 100UN',
    categoria: 'Consumíveis',
    termos: ['alca descartavel', 'alça descartável', '10ul', 'microbiologia'],
    ficha: {
      nome: 'Alça Descartável 10µL Estéril (100un)',
      categoria: 'Consumíveis',
      descricao: 'Alças descartáveis estéreis de 10µL para semeadura de microrganismos em meios de cultura.',
      aplicacoes: ['Semeadura bacteriana', 'Microbiologia', 'Cultura de microrganismos'],
      indicacoes: 'Inoculação de amostras em meios de cultura.',
      restricoes: 'Descartável. Uso único.',
      compatibilidades: ['Meios de cultura', 'Placas de Petri', 'Estufa'],
      cuidados: 'Manter embalagem fechada até o uso.'
    }
  },
  {
    codigo: '1795',
    descricao: 'PONTEIRA GILSON AMARELA 0 200UL COM 1000UN',
    categoria: 'Consumíveis',
    termos: ['ponteira', 'gilson', 'amarela', '0 200ul', 'pipeta'],
    ficha: {
      nome: 'Ponteira Amarela 0-200µL (1000un)',
      categoria: 'Consumíveis',
      descricao: 'Ponteiras descartáveis amarelas para micropipetas de volume 0-200µL.',
      aplicacoes: ['Pipetagem com micropipetas', 'Preparo de soluções', 'Dosagens'],
      indicacoes: 'Uso com micropipetas de 0-200µL.',
      restricoes: 'Descartável. Usar ponteira compatível com a pipeta.',
      compatibilidades: ['Micropipetas', 'Reagentes'],
      cuidados: 'Manter em embalagem fechada.'
    }
  },
  {
    codigo: '551',
    descricao: 'DESCARTADOR AGULHA 7 LITROS PAPELAO',
    categoria: 'Consumíveis',
    termos: ['descartador', 'perfurocortante', 'agulha', 'descarte'],
    ficha: {
      nome: 'Descartador de Perfurocortantes 7 Litros',
      categoria: 'Consumíveis',
      descricao: 'Recipiente rígido de papelão para descarte de materiais perfurocortantes (agulhas, lâminas).',
      aplicacoes: ['Descarte de agulhas', 'Descarte de perfurocortantes', 'Segurança laboratorial'],
      indicacoes: 'Descarte seguro de materiais perfurocortantes.',
      restricoes: 'Não reutilizar. Descarte conforme normas de resíduos de saúde.',
      compatibilidades: ['Agulhas', 'Lâminas', 'Seringas'],
      cuidados: 'Não encher além do limite indicado.'
    }
  },
  {
    codigo: '2566',
    descricao: 'BANDAGEM ADULTO ANTI SEPTICA BEGE COM 500UN',
    categoria: 'Consumíveis',
    termos: ['bandagem', 'curativo', 'anti septica', 'adulto'],
    ficha: {
      nome: 'Bandagem Adulto Antisséptica (500un)',
      categoria: 'Consumíveis',
      descricao: 'Bandagem/curativo adesivo antisséptico para cobertura de pequenos ferimentos.',
      aplicacoes: ['Cobertura de ferimentos', 'Curativos', 'Primeiros socorros'],
      indicacoes: 'Proteção de pequenos cortes e ferimentos.',
      restricoes: 'Uso único.',
      compatibilidades: ['Ferimentos', 'Pele'],
      cuidados: 'Manter em embalagem fechada.'
    }
  },
  {
    codigo: '3267',
    descricao: 'TOUCA SANFONADA DESCARTAVEL COM 100UN',
    categoria: 'Consumíveis',
    termos: ['touca', 'sanfonada', 'descartavel', 'epi'],
    ficha: {
      nome: 'Touca Sanfonada Descartável (100un)',
      categoria: 'Consumíveis',
      descricao: 'Touca descartável sanfonada para proteção capilar em ambientes laboratoriais e hospitalares.',
      aplicacoes: ['Proteção capilar', 'EPI laboratorial', 'Controle de contaminação'],
      indicacoes: 'Uso em laboratórios, salas de coleta e ambientes assépticos.',
      restricoes: 'Descartável.',
      compatibilidades: ['EPIs', 'Luvas', 'Avental'],
      cuidados: 'Uso único.'
    }
  },
  // ============ REAGENTES BIOQUÍMICOS ============
  {
    codigo: '3045',
    descricao: 'FOSFATASE ALCALINA CINETICA LIQUIDA 2X60ML (1770110)',
    categoria: 'Reagentes bioquímicos',
    termos: ['fosfatase alcalina', 'cinetica', 'bioquimica', 'enzima'],
    ficha: {
      nome: 'Fosfatase Alcalina Cinética Líquida 2x60mL',
      categoria: 'Reagentes bioquímicos',
      descricao: 'Reagente para dosagem cinética da enzima fosfatase alcalina (FA).',
      aplicacoes: ['Dosagem de fosfatase alcalina', 'Avaliação hepática e óssea', 'Bioquímica clínica'],
      indicacoes: 'Dosagem enzimática da fosfatase alcalina.',
      restricoes: 'Uso em analisadores ou método manual.',
      compatibilidades: ['Soro ou plasma', 'Analisadores bioquímicos'],
      cuidados: 'Armazenar refrigerado.'
    }
  },
  {
    codigo: '3426',
    descricao: 'ALT (TGP) UV LIQUIDO 2X60ML (1770150)',
    categoria: 'Reagentes bioquímicos',
    termos: ['alt', 'tgp', 'transaminase', 'bioquimica', 'hepatico'],
    ficha: {
      nome: 'ALT (TGP) UV Líquido 2x60mL',
      categoria: 'Reagentes bioquímicos',
      descricao: 'Reagente para dosagem da enzima alanina aminotransferase (ALT/TGP), marcador hepático.',
      aplicacoes: ['Dosagem de ALT/TGP', 'Avaliação hepática', 'Bioquímica clínica'],
      indicacoes: 'Dosagem enzimática da ALT (TGP).',
      restricoes: 'Uso em analisadores ou método manual.',
      compatibilidades: ['Soro', 'Analisadores bioquímicos'],
      cuidados: 'Armazenar refrigerado.'
    }
  },
  {
    codigo: '3044',
    descricao: 'CREATININA CINETICA LIQUIDA 250ML (2X125ML) + 30ML',
    categoria: 'Reagentes bioquímicos',
    termos: ['creatinina', 'cinetica', 'renal', 'bioquimica'],
    ficha: {
      nome: 'Creatinina Cinética Líquida 250mL',
      categoria: 'Reagentes bioquímicos',
      descricao: 'Reagente para dosagem de creatinina (marcador de função renal).',
      aplicacoes: ['Dosagem de creatinina', 'Avaliação de função renal', 'Bioquímica clínica'],
      indicacoes: 'Dosagem de creatinina sérica/plasmática.',
      restricoes: 'Uso em analisadores ou método manual.',
      compatibilidades: ['Soro ou plasma', 'Analisadores bioquímicos'],
      cuidados: 'Armazenar refrigerado.'
    }
  },
  {
    codigo: '31',
    descricao: 'AMILASE CINETICA LIQUIDA 60ML (1770020)',
    categoria: 'Reagentes bioquímicos',
    termos: ['amilase', 'pancreas', 'pâncreas', 'bioquimica'],
    ficha: {
      nome: 'Amilase Cinética Líquida 60mL',
      categoria: 'Reagentes bioquímicos',
      descricao: 'Reagente para dosagem da enzima amilase, marcador de função pancreática.',
      aplicacoes: ['Dosagem de amilase', 'Avaliação pancreática', 'Pancreatite'],
      indicacoes: 'Dosagem enzimática da amilase.',
      restricoes: 'Uso em analisadores ou método manual.',
      compatibilidades: ['Soro', 'Analisadores bioquímicos'],
      cuidados: 'Armazenar refrigerado.'
    }
  },
  {
    codigo: '3921',
    descricao: 'LAURA XL OPTISOL 1500 (400ML) (1500 TESTES) (REG00055)',
    categoria: 'Reagentes bioquímicos',
    termos: ['laura', 'optisol', 'analisador', 'eletrolitos', 'eletrólitos'],
    ficha: {
      nome: 'Solução Laura XL Optisol 1500 (Eletrólitos)',
      categoria: 'Reagentes bioquímicos',
      descricao: 'Solução para analisador de eletrólitos (sódio, potássio, cloro, lítio), 1500 testes.',
      aplicacoes: ['Dosagem de eletrólitos', 'Analisadores de eletrólitos', 'Gasometria'],
      indicacoes: 'Uso em analisadores de eletrólitos (ex: EasyLyte).',
      restricoes: 'Específico para o equipamento indicado.',
      compatibilidades: ['Analisador de eletrólitos', 'Soro ou plasma'],
      cuidados: 'Armazenar conforme instruções.'
    }
  }
]

// ===== Busca fichas técnicas pelos termos da pergunta =====
// Retorna as fichas cuja descrição, nome ou termos-chave contenham algum termo buscado
export function buscarFichasPorTermos(termos, limite = 5) {
  const t = (termos || []).map((x) => String(x).toLowerCase()).filter(Boolean)
  if (t.length === 0) return []
  const encontradas = CATALOGO_PRODUTOS.filter((p) => {
    const alvo = (
      p.descricao + ' ' +
      p.ficha.nome + ' ' +
      p.ficha.categoria + ' ' +
      (p.termos || []).join(' ')
    ).toLowerCase()
    return t.some((x) => alvo.includes(x))
  })
  return encontradas.slice(0, limite)
}