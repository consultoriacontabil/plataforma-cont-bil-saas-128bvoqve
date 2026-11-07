import pb from '@/lib/pocketbase/client'
import { auditService } from './audit'
import { whatsappAtivoService } from './whatsappAtivo'
import type {
  Funcionario,
  FolhaPagamento,
  FeriasPeriodoRecord,
  RescisaoRecord,
  PortalEmpregadoAcessoRecord,
  Empresa,
} from '@/types'

export interface AutenticarPortalEmpregadoParams {
  cpf: string
  tokenOuCodigo: string
}

export interface AutenticarPortalEmpregadoResult {
  sucesso: boolean
  erro?: string
  funcionario?: Funcionario
  acesso?: PortalEmpregadoAcessoRecord
  empresa?: Empresa
  tokenAcesso?: string
}

export interface GerarAcessoEmpregadoParams {
  tenantId: string
  empresaId: string
  funcionarioId: string
  usuarioId: string
  expiraEmDias?: number
  telefoneWhatsapp?: string
}

export interface GerarAcessoEmpregadoResult {
  acesso: PortalEmpregadoAcessoRecord
  token: string
  codigoTemporario: string
  linkAcesso: string
}

export const portalEmpregadoService = {
  /**
   * Gera um token e código temporário seguro para o empregado
   */
  gerarTokens(): { token: string; codigo: string } {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
    let codigo = ''
    for (let i = 0; i < 6; i++) {
      codigo += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    const token =
      Math.random().toString(36).substring(2, 10) +
      Math.random().toString(36).substring(2, 10) +
      Date.now().toString(36)
    return { token, codigo }
  },

  /**
   * Contador emite ou renova token de primeiro acesso do colaborador
   */
  async gerarOuRenovarAcesso(
    params: GerarAcessoEmpregadoParams,
  ): Promise<GerarAcessoEmpregadoResult> {
    const { tenantId, empresaId, funcionarioId, usuarioId, expiraEmDias = 30 } = params

    const func = await pb.collection('funcionarios').getOne<Funcionario>(funcionarioId, {
      expand: 'empresa',
    })

    const cpfLimpo = func.cpf.replace(/\D/g, '')
    const { token, codigo } = this.gerarTokens()
    const expiraData = new Date(Date.now() + expiraEmDias * 24 * 60 * 60 * 1000).toISOString()

    // 1. Atualizar funcionario com token_acesso_publico
    await pb.collection('funcionarios').update(funcionarioId, {
      token_acesso_publico: token,
      primeiro_acesso_realizado: false,
    })

    // 2. Criar ou atualizar portal_empregado_acessos
    let acessoRec: PortalEmpregadoAcessoRecord
    try {
      const existentes = await pb
        .collection('portal_empregado_acessos')
        .getFullList<PortalEmpregadoAcessoRecord>({
          filter: `funcionario_id = "${funcionarioId}"`,
        })

      if (existentes.length > 0) {
        acessoRec = await pb
          .collection('portal_empregado_acessos')
          .update<PortalEmpregadoAcessoRecord>(existentes[0].id, {
            token_acesso: token,
            codigo_temporario: codigo,
            cpf: cpfLimpo,
            nome_colaborador: func.nome_completo,
            telefone_whatsapp: params.telefoneWhatsapp || existentes[0].telefone_whatsapp || '',
            primeiro_acesso_realizado: false,
            ativo: true,
            expira_em: expiraData,
          })
      } else {
        acessoRec = await pb
          .collection('portal_empregado_acessos')
          .create<PortalEmpregadoAcessoRecord>({
            tenant_id: tenantId,
            empresa: empresaId,
            funcionario_id: funcionarioId,
            cpf: cpfLimpo,
            nome_colaborador: func.nome_completo,
            telefone_whatsapp: params.telefoneWhatsapp || '',
            token_acesso: token,
            codigo_temporario: codigo,
            primeiro_acesso_realizado: false,
            ativo: true,
            expira_em: expiraData,
          })
      }
    } catch (err) {
      console.error('Erro ao registrar acesso portal_empregado_acessos:', err)
      throw err
    }

    // 3. Auditoria
    await auditService.log(
      tenantId,
      usuarioId,
      'GEROU_TOKEN_PORTAL_EMPREGADO',
      'portal_empregado_acessos',
      acessoRec.id,
      `Token de acesso gerado para colaborador ${func.nome_completo} (CPF: ${func.cpf}). Expiração em ${expiraEmDias} dias.`,
    )

    const origin = typeof window !== 'undefined' ? window.location.origin : ''
    const linkAcesso = `${origin}/portal-empregado?token=${token}&cpf=${cpfLimpo}`

    return {
      acesso: acessoRec,
      token,
      codigoTemporario: codigo,
      linkAcesso,
    }
  },

  /**
   * Contador revoga o acesso do colaborador ao portal
   */
  async revogarAcesso(tenantId: string, funcionarioId: string, usuarioId: string): Promise<void> {
    try {
      await pb.collection('funcionarios').update(funcionarioId, {
        token_acesso_publico: '',
      })
    } catch {
      /* intentionally ignored */
    }

    try {
      const recs = await pb
        .collection('portal_empregado_acessos')
        .getFullList<PortalEmpregadoAcessoRecord>({
          filter: `funcionario_id = "${funcionarioId}"`,
        })
      for (const r of recs) {
        await pb.collection('portal_empregado_acessos').update(r.id, {
          ativo: false,
          token_acesso: `revogado_${Date.now()}`,
        })
      }
    } catch {
      /* intentionally ignored */
    }

    await auditService.log(
      tenantId,
      usuarioId,
      'REVOGOU_PORTAL_EMPREGADO',
      'funcionarios',
      funcionarioId,
      `Acesso ao Portal do Empregado revogado para o colaborador.`,
    )
  },

  /**
   * Envia o link e código de acesso via WhatsApp ativo da contabilidade
   */
  async enviarAcessoWhatsApp(params: {
    tenantId: string
    empresaId: string
    funcionarioId: string
    destinatarioTelefone: string
    token: string
    codigo: string
    linkAcesso: string
  }): Promise<{ sucesso: boolean; status: string; mensagem: string }> {
    const { tenantId, empresaId, funcionarioId, destinatarioTelefone, token, codigo, linkAcesso } =
      params

    const func = await pb.collection('funcionarios').getOne<Funcionario>(funcionarioId, {
      expand: 'empresa',
    })
    const empresaNome =
      func.expand?.empresa?.nome_fantasia || func.expand?.empresa?.razao_social || 'Sua Empresa'

    const mensagem =
      `👋 *PORTAL DO EMPREGADO - ACESSO EXCLUSIVO*\n\n` +
      `Olá, *${func.nome_completo}*!\n\n` +
      `Seu acesso exclusivo ao Portal do Empregado da empresa *${empresaNome}* foi disponibilizado pela contabilidade.\n\n` +
      `Você pode consultar seus holerites mensais, programações de férias e espelhos de rescisão com total segurança e sigilo.\n\n` +
      `🔑 *Seu código temporário:* \`${codigo}\`\n\n` +
      `🔗 *Acesse diretamente pelo link:* \n${linkAcesso}\n\n` +
      `_Ambiente seguro e protegido de acordo com a LGPD._`

    const res = await whatsappAtivoService.dispararEnvio({
      tenant_id: tenantId,
      empresa_id: empresaId,
      tipo: 'documento',
      referencia: `portal_empregado_${funcionarioId}`,
      destinatario: destinatarioTelefone,
      mensagem,
      origem: 'manual',
    })

    return {
      sucesso: res.sucesso,
      status: res.status,
      mensagem: res.mensagem || 'Disparo registrado.',
    }
  },

  /**
   * Busca registro de acesso existente para um funcionário
   */
  async getAcessoPorFuncionario(
    funcionarioId: string,
  ): Promise<PortalEmpregadoAcessoRecord | null> {
    try {
      const recs = await pb
        .collection('portal_empregado_acessos')
        .getFullList<PortalEmpregadoAcessoRecord>({
          filter: `funcionario_id = "${funcionarioId}"`,
          sort: '-created',
          expand: 'empresa,funcionario_id',
        })
      return recs[0] || null
    } catch (_) {
      return null
    }
  },

  /**
   * Lista todos os acessos do portal do empregado de um tenant em lote
   * Opcionalmente filtrando por empresa
   */
  async listAcessos(
    tenantId: string,
    filters?: { empresaId?: string },
  ): Promise<PortalEmpregadoAcessoRecord[]> {
    try {
      const parts = [`tenant_id = "${tenantId}"`]
      if (filters?.empresaId && filters.empresaId !== 'todas') {
        parts.push(`empresa = "${filters.empresaId}"`)
      }
      return await pb
        .collection('portal_empregado_acessos')
        .getFullList<PortalEmpregadoAcessoRecord>({
          filter: parts.join(' && '),
          sort: '-created',
          expand: 'empresa,funcionario_id',
        })
    } catch (err) {
      console.warn('Erro ao listar portal_empregado_acessos:', err)
      return []
    }
  },

  /**
   * Retorna um mapa de funcionario_id -> PortalEmpregadoAcessoRecord para carregar em lote
   */
  async getMapaAcessosPorTenant(
    tenantId: string,
    empresaId?: string,
  ): Promise<Record<string, PortalEmpregadoAcessoRecord>> {
    const lista = await this.listAcessos(tenantId, { empresaId })
    const mapa: Record<string, PortalEmpregadoAcessoRecord> = {}
    for (const item of lista) {
      if (item.funcionario_id && !mapa[item.funcionario_id]) {
        mapa[item.funcionario_id] = item
      }
    }
    return mapa
  },

  /**
   * Autenticação pública do empregado por CPF + Token / Código Temporário
   */
  async autenticar(
    params: AutenticarPortalEmpregadoParams,
  ): Promise<AutenticarPortalEmpregadoResult> {
    const cpfLimpo = params.cpf.replace(/\D/g, '')
    const credencial = params.tokenOuCodigo.trim()

    if (!cpfLimpo || cpfLimpo.length !== 11) {
      return { sucesso: false, erro: 'Informe um CPF válido com 11 dígitos.' }
    }
    if (!credencial) {
      return { sucesso: false, erro: 'Informe o código de acesso ou token recebido.' }
    }

    try {
      // A validação do CPF + código acontece no SERVIDOR.
      // Antes o navegador consultava `portal_empregado_acessos` e
      // `funcionarios` direto; isso só funcionava porque as coleções estavam
      // abertas — e essa abertura expunha CPF e hash de senha de qualquer
      // empregado. Hoje as coleções são fechadas e a rota pública faz a
      // validação e devolve só os dados do próprio colaborador.
      const res = await pb.send('/backend/v1/portal-empregado/autenticar', {
        method: 'POST',
        body: { cpf: cpfLimpo, credencial },
      })

      if (!res?.sucesso) {
        return {
          sucesso: false,
          erro: res?.erro || 'Credenciais inválidas. Verifique o CPF e o código fornecido.',
        }
      }

      const func = res.funcionario
      if (func && func.id) {
        await this.registrarAuditoriaAcesso(
          res.tenant_id || '',
          func.id,
          func.nome_completo || '',
          'LOGIN',
        )
      }

      return {
        sucesso: true,
        funcionario: func as unknown as Funcionario,
        empresa: (res.empresa || undefined) as Empresa | undefined,
        tokenAcesso: res.token || credencial,
      }
    } catch (err) {
      console.error('Erro na autenticação do portal do empregado:', err)
      return {
        sucesso: false,
        erro: 'Falha ao autenticar colaborador. Tente novamente mais tarde.',
      }
    }
  },

  /**
   * Consulta holerites do colaborador autenticado
   */
  /**
   * Busca os dados do próprio colaborador pelo servidor.
   * O token é a credencial dele; o servidor decide o que aquele token vê.
   * As coleções de DP continuam fechadas para acesso anônimo direto.
   */
  async getDadosPortal(
    token: string,
    recurso: 'holerites' | 'ferias' | 'rescisoes',
  ): Promise<Record<string, unknown>[]> {
    if (!token) return []
    try {
      const res = await pb.send('/backend/v1/portal-empregado/dados', {
        method: 'POST',
        body: { token, recurso },
      })
      return (res?.itens || []) as Record<string, unknown>[]
    } catch (err) {
      console.warn('[portalEmpregado] falha ao consultar ' + recurso, err)
      return []
    }
  },

  async getHolerites(token: string): Promise<FolhaPagamento[]> {
    return (await this.getDadosPortal(token, 'holerites')) as unknown as FolhaPagamento[]
  },

  /**
   * Consulta férias do colaborador autenticado
   */
  async getFerias(token: string): Promise<FeriasPeriodoRecord[]> {
    return (await this.getDadosPortal(token, 'ferias')) as unknown as FeriasPeriodoRecord[]
  },

  /**
   * Consulta rescisões / TRCT do colaborador autenticado
   */
  async getRescisoes(token: string): Promise<RescisaoRecord[]> {
    return (await this.getDadosPortal(token, 'rescisoes')) as unknown as RescisaoRecord[]
  },

  /**
   * Registra auditoria de download ou visualização sensível
   */
  async registrarAuditoriaAcesso(
    tenantId: string,
    funcionarioId: string,
    nomeFuncionario: string,
    tipoAcao:
      | 'LOGIN'
      | 'DOWNLOAD_HOLERITE'
      | 'DOWNLOAD_TRCT'
      | 'DOWNLOAD_AVISO_FERIAS'
      | 'VISUALIZACAO',
    detalheExtra?: string,
  ): Promise<void> {
    try {
      await pb.collection('audit_log').create({
        tenant_id: tenantId,
        acao: `PORTAL_EMPREGADO_${tipoAcao}`,
        entidade_tipo: 'portal_empregado',
        entidade_id: funcionarioId,
        detalhes: JSON.stringify({
          colaborador: nomeFuncionario,
          tipo: tipoAcao,
          detalhe: detalheExtra || '',
          data: new Date().toISOString(),
          ip: typeof window !== 'undefined' ? window.location.hostname : '',
        }),
      })
    } catch (err) {
      console.warn('Erro ao gravar audit_log do portal do empregado:', err)
    }
  },
}
