import pb from '@/lib/pocketbase/client'
import type { Tenant, TenantMember, OnboardingChecklistState } from '@/types'

export const tenantService = {
  // Criar novo escritório para o usuário logado
  async createEscritorio(
    userId: string,
    data: {
      nome: string
      cnpj?: string
      plano?: 'starter' | 'pro' | 'enterprise'
    },
  ): Promise<{ tenant: Tenant; member: TenantMember }> {
    const newTenant = await pb.collection('tenants').create<Tenant>({
      nome: data.nome.trim(),
      cnpj: data.cnpj?.trim() || '',
      plano: data.plano || 'starter',
      ativo: true,
      onboarding_checklist: {
        escritorio_dados: true,
        primeira_empresa: false,
        plano_contas: false,
        primeiro_usuario: false,
        convite_portal: false,
        ignorado: false,
      },
    })

    const newMember = await pb.collection('tenant_members').create<TenantMember>({
      user_id: userId,
      tenant_id: newTenant.id,
      perfil: 'administrador',
      status: 'ativo',
    })

    return { tenant: newTenant, member: newMember }
  },

  // Atualizar dados do tenant (ex: CNPJ, nome, configurações, modo offline)
  async updateTenant(tenantId: string, data: Partial<Tenant>): Promise<Tenant> {
    return pb.collection('tenants').update<Tenant>(tenantId, data)
  },

  // Atualizar progresso do onboarding
  async updateOnboarding(
    tenantId: string,
    checklist: Partial<OnboardingChecklistState>,
  ): Promise<Tenant> {
    const current = await pb.collection('tenants').getOne<Tenant>(tenantId)
    const updatedChecklist = {
      ...(current.onboarding_checklist || {}),
      ...checklist,
    }
    return pb.collection('tenants').update<Tenant>(tenantId, {
      onboarding_checklist: updatedChecklist,
    })
  },

  // Carregar plano de contas padrão brasileiro para o novo tenant (caso ainda não tenha contas)
  async inicializarPlanoContasPadrao(tenantId: string): Promise<number> {
    const existing = await pb.collection('plano_contas').getFullList({
      filter: `tenant_id = "${tenantId}"`,
      limit: 1,
    })

    if (existing.length > 0) {
      // Já possui contas
      return 0
    }

    const contasPadrao = [
      // 1 ATIVO
      { codigo: '1', nome: 'ATIVO', tipo: 'ativo', nivel: 1, paiCodigo: null },
      { codigo: '1.1', nome: 'Ativo Circulante', tipo: 'ativo', nivel: 2, paiCodigo: '1' },
      {
        codigo: '1.1.1',
        nome: 'Caixa e Equivalentes de Caixa',
        tipo: 'ativo',
        nivel: 3,
        paiCodigo: '1.1',
      },
      { codigo: '1.1.1.01', nome: 'Caixa Geral', tipo: 'ativo', nivel: 4, paiCodigo: '1.1.1' },
      {
        codigo: '1.1.1.02',
        nome: 'Bancos Conta Movimento',
        tipo: 'ativo',
        nivel: 4,
        paiCodigo: '1.1.1',
      },
      {
        codigo: '1.1.1.03',
        nome: 'Aplicações Financeiras de Liquidez Imediata',
        tipo: 'ativo',
        nivel: 4,
        paiCodigo: '1.1.1',
      },
      {
        codigo: '1.1.2',
        nome: 'Créditos e Contas a Receber',
        tipo: 'ativo',
        nivel: 3,
        paiCodigo: '1.1',
      },
      {
        codigo: '1.1.2.01',
        nome: 'Clientes / Duplicatas a Receber',
        tipo: 'ativo',
        nivel: 4,
        paiCodigo: '1.1.2',
      },
      { codigo: '1.1.3', nome: 'Estoques', tipo: 'ativo', nivel: 3, paiCodigo: '1.1' },
      {
        codigo: '1.1.3.01',
        nome: 'Mercadorias para Revenda',
        tipo: 'ativo',
        nivel: 4,
        paiCodigo: '1.1.3',
      },
      { codigo: '1.2', nome: 'Ativo Não Circulante', tipo: 'ativo', nivel: 2, paiCodigo: '1' },
      { codigo: '1.2.1', nome: 'Imobilizado', tipo: 'ativo', nivel: 3, paiCodigo: '1.2' },
      {
        codigo: '1.2.1.01',
        nome: 'Equipamentos e Máquinas',
        tipo: 'ativo',
        nivel: 4,
        paiCodigo: '1.2.1',
      },
      {
        codigo: '1.2.1.02',
        nome: 'Veículos Operacionais',
        tipo: 'ativo',
        nivel: 4,
        paiCodigo: '1.2.1',
      },
      {
        codigo: '1.2.1.09',
        nome: '(-) Depreciação Acumulada',
        tipo: 'ativo',
        nivel: 4,
        paiCodigo: '1.2.1',
      },

      // 2 PASSIVO
      {
        codigo: '2',
        nome: 'PASSIVO E PATRIMÔNIO LÍQUIDO',
        tipo: 'passivo',
        nivel: 1,
        paiCodigo: null,
      },
      { codigo: '2.1', nome: 'Passivo Circulante', tipo: 'passivo', nivel: 2, paiCodigo: '2' },
      { codigo: '2.1.1', nome: 'Fornecedores', tipo: 'passivo', nivel: 3, paiCodigo: '2.1' },
      {
        codigo: '2.1.1.01',
        nome: 'Fornecedores Nacionais',
        tipo: 'passivo',
        nivel: 4,
        paiCodigo: '2.1.1',
      },
      {
        codigo: '2.1.2',
        nome: 'Obrigações Fiscais e Tributárias',
        tipo: 'passivo',
        nivel: 3,
        paiCodigo: '2.1',
      },
      {
        codigo: '2.1.2.01',
        nome: 'Impostos e Contribuições a Recolher (Simples / DCTF)',
        tipo: 'passivo',
        nivel: 4,
        paiCodigo: '2.1.2',
      },
      {
        codigo: '2.1.3',
        nome: 'Obrigações Trabalhistas e Sociais',
        tipo: 'passivo',
        nivel: 3,
        paiCodigo: '2.1',
      },
      {
        codigo: '2.1.3.01',
        nome: 'Salários e Ordenados a Pagar',
        tipo: 'passivo',
        nivel: 4,
        paiCodigo: '2.1.3',
      },
      {
        codigo: '2.1.3.02',
        nome: 'Encargos a Recolher (INSS / FGTS)',
        tipo: 'passivo',
        nivel: 4,
        paiCodigo: '2.1.3',
      },
      { codigo: '2.2', nome: 'Patrimônio Líquido', tipo: 'patrimonio', nivel: 2, paiCodigo: '2' },
      {
        codigo: '2.2.1',
        nome: 'Capital Social Realizado',
        tipo: 'patrimonio',
        nivel: 3,
        paiCodigo: '2.2',
      },
      {
        codigo: '2.2.2',
        nome: 'Reservas e Lucros/Prejuízos Acumulados',
        tipo: 'patrimonio',
        nivel: 3,
        paiCodigo: '2.2',
      },

      // 3 RECEITAS
      { codigo: '3', nome: 'RECEITAS', tipo: 'receita', nivel: 1, paiCodigo: null },
      {
        codigo: '3.1',
        nome: 'Receita Operacional Bruta',
        tipo: 'receita',
        nivel: 2,
        paiCodigo: '3',
      },
      {
        codigo: '3.1.1',
        nome: 'Receita de Venda de Serviços e Licenças',
        tipo: 'receita',
        nivel: 3,
        paiCodigo: '3.1',
      },
      {
        codigo: '3.1.2',
        nome: 'Receita de Venda de Mercadorias',
        tipo: 'receita',
        nivel: 3,
        paiCodigo: '3.1',
      },

      // 4 DESPESAS
      {
        codigo: '4',
        nome: 'DESPESAS E CUSTOS OPERACIONAIS',
        tipo: 'despesa',
        nivel: 1,
        paiCodigo: null,
      },
      { codigo: '4.1', nome: 'Despesas com Pessoal', tipo: 'despesa', nivel: 2, paiCodigo: '4' },
      {
        codigo: '4.1.1',
        nome: 'Salários, Férias e 13º Salário',
        tipo: 'despesa',
        nivel: 3,
        paiCodigo: '4.1',
      },
      {
        codigo: '4.1.2',
        nome: 'Encargos Sociais (FGTS e Previdência)',
        tipo: 'despesa',
        nivel: 3,
        paiCodigo: '4.1',
      },
      {
        codigo: '4.2',
        nome: 'Despesas Gerais e Administrativas',
        tipo: 'despesa',
        nivel: 2,
        paiCodigo: '4',
      },
      {
        codigo: '4.2.1',
        nome: 'Aluguel, Condomínio e IPTU',
        tipo: 'despesa',
        nivel: 3,
        paiCodigo: '4.2',
      },
      {
        codigo: '4.2.2',
        nome: 'Energia Elétrica, Água e Comunicação',
        tipo: 'despesa',
        nivel: 3,
        paiCodigo: '4.2',
      },
      {
        codigo: '4.2.4',
        nome: 'Despesas com Depreciação e Amortização',
        tipo: 'despesa',
        nivel: 3,
        paiCodigo: '4.2',
      },
      {
        codigo: '4.3',
        nome: 'Despesas Tributárias e Impostos sobre Vendas',
        tipo: 'despesa',
        nivel: 2,
        paiCodigo: '4',
      },
      {
        codigo: '4.3.1',
        nome: 'Simples Nacional / DAS sobre Faturamento',
        tipo: 'despesa',
        nivel: 3,
        paiCodigo: '4.3',
      },
    ]

    const mapCodigoToId: Record<string, string> = {}
    let criadas = 0

    for (const c of contasPadrao) {
      const rec = await pb.collection('plano_contas').create({
        tenant_id: tenantId,
        codigo: c.codigo,
        nome: c.nome,
        tipo: c.tipo,
        nivel: c.nivel,
        ativa: true,
        pai: c.paiCodigo && mapCodigoToId[c.paiCodigo] ? mapCodigoToId[c.paiCodigo] : undefined,
      })
      mapCodigoToId[c.codigo] = rec.id
      criadas++
    }

    return criadas
  },
}
