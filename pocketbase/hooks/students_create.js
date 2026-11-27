/**
 * students_create.js — rotas próprias de CRIAÇÃO, LISTAGEM e EXCLUSÃO de alunos.
 *
 * Por quê: o POST padrão /api/collections/students/records recusava o cadastro
 * do dono com 400 genérico "Failed to create record." em <1ms, sem fieldErrors
 * e sem passar pelo hook students_sanitize (que logaria o motivo) — assinatura
 * de falha de API rule (sessão fantasma: token de auth morto no servidor).
 * (v0.0.174) O DELETE padrão /api/collections/students/records/:id recusa o
 * DONO com 404 "The requested resource wasn't found." — com o registro
 * EXISTINDO no banco — mesma classe de falha de API rule. A rota própria de
 * exclusão abaixo valida o admin explicitamente e apaga via $app.
 *
 * SEGURANÇA (rodada v0.0.175 — revisão da superfície /backend/v1/students/*):
 *   • Cada rota valida o papel DO REGISTRO users resolvido do token
 *     (requireAuth + role 'admin' ou is_owner) — token de aluno comum,
 *     responsável ou desconhecido recebe 401/403, sem dados nem confirmação
 *     de existência de registros.
 *   • O corpo é lido UMA vez, com limite de tamanho e validação de tipo: cada
 *     campo só é aceito como string, truncado em um limite seguro e validado
 *     em formato — payload malformado (tipo errado, string enorme, campos
 *     desconhecidos) é descartado, nunca repassado ao banco.
 *   • O id do DELETE é validado contra o formato dos ids do PocketBase
 *     (15+ caracteres alfanuméricos) antes de qualquer busca.
 *   • As mensagens de erro são sempre em português e genéricas — o erro real
 *     do banco vai para o stream de hooks (console), nunca para a resposta.
 *   • $app.delete dispara os hooks da collection: a conta de usuário vinculada
 *     só é apagada pelo delete_student_user, que preserva dono/admin e contas
 *     compartilhadas com outro aluno.
 *
 * PERMISSÃO GRANULAR (v0.0.176): as três rotas espelham a regra de API da
 * collection students — dono (is_owner) sempre passa; admin secundário com
 * admin_permissions VAZIA tem acesso total (compatibilidade); com a lista
 * preenchida, só quem tem 'alunos' nela. Sem isso, um admin restrito a outras
 * áreas (ex.: só produtos) conseguiria criar/listar/excluir alunos por aqui,
 * contornando a regra da API padrão.
 *
 * RESTRIÇÃO DA JSVM (limitação conhecida deste backend, v. admin_roles.js):
 * callbacks de rota NÃO enxergam declarações de nível superior do arquivo —
 * o servidor recusa o carregamento do hook. CAP, ID_RE, pickStr e
 * hasAlunosAccess são repetidos INLINE dentro de cada callback abaixo.
 *
 * O hook students_sanitize (v0.0.167) continua ativo como segunda camada para
 * o fluxo padrão da collection; estas rotas são o caminho do painel.
 */

routerAdd(
  'POST',
  '/backend/v1/students/create',
  (e) => {
    // ---- Declarações inline (JSVM não enxerga o escopo do módulo) ----
    // Limites de tamanho por campo (o schema tem max 200; truncamos ANTES,
    // para strings enormes não chegarem ao banco nem ao log).
    var CAP = {
      name: 120,
      phone: 30,
      email: 200,
      address: 300,
      guardian_name: 120,
      guardian_phone: 30,
      guardian_email: 200,
      belt: 32,
      birth_date: 10,
    }
    // Limite bruto do body: um payload legítimo de aluno é minúsculo (< 1 KB).
    var BODY_MAX_CHARS = 4096
    // Formato dos ids do PocketBase (15+ alfanuméricos).
    var ID_RE = /^[A-Za-z0-9]{15,}$/

    // Valida e normaliza uma string do body: só string é aceita (números,
    // objetos e arrays viram inválido), espaços das pontas removidos, tamanho
    // limitado. null quando o campo não veio (undefined/null) — difere de ''
    // (veio vazio).
    var pickStr = function (v, cap) {
      if (v === undefined || v === null) return null
      if (typeof v !== 'string') return ''
      var s = v.trim()
      if (s.length > cap) s = s.slice(0, cap)
      return s
    }

    // Permissão granular: espelha a regra de API da collection students —
    // dono sempre; admin_permissions vazia = acesso total; lista preenchida
    // exige 'alunos'.
    var hasAlunosAccess = function (admin) {
      if (admin.getBool('is_owner')) return true
      var list = []
      try {
        var perms = admin.get('admin_permissions')
        if (Array.isArray(perms)) {
          list = perms
        } else if (typeof perms === 'string' && perms !== '') {
          list = perms.split(',')
        }
      } catch (_) {
        list = []
      }
      if (list.length === 0) return true
      for (var i = 0; i < list.length; i++) {
        if (String(list[i]).trim() === 'alunos') return true
      }
      return false
    }

    // Mensagens de erro por campo — sempre genéricas em português, sem
    // detalhes internos do servidor.
    var errOut = function (status, message, fieldErrors) {
      e.json(status, { status: status, message: message, data: fieldErrors || {} })
    }

    // ---- 1. Autenticação e papel do admin (sem depender da createRule) ----
    // e.auth já é o registro users resolvido do token (middleware requireAuth) —
    // token morto/sessão fantasma nunca chega aqui (401 antes do handler).
    var admin = e.auth
    if (!admin || admin.id === '') {
      throw new UnauthorizedError('Sua sessão expirou, entre novamente.')
    }
    if (admin.getString('role') !== 'admin' && !admin.getBool('is_owner')) {
      throw new ForbiddenError('Sua conta não tem permissão para cadastrar alunos.')
    }
    if (!hasAlunosAccess(admin)) {
      throw new ForbiddenError('Sua conta não tem permissão para cadastrar alunos.')
    }

    // ---- 2. Payload e sanitização ----
    var body = {}
    try {
      var raw = e.requestInfo().body
      if (raw && typeof raw === 'object') body = raw
    } catch (_) {
      body = {}
    }

    // Payload maior que o permitido: recusa sem tentar interpretar (proteção
    // contra strings enormes).
    var rawLen = 0
    try {
      rawLen = String(JSON.stringify(body)).length
    } catch (_) {
      rawLen = BODY_MAX_CHARS + 1
    }
    if (rawLen > BODY_MAX_CHARS) {
      errOut(400, 'Dados enviados são grandes demais. Revise os campos e tente novamente.', {})
      return
    }

    var data = {}
    // Campo OPCIONAL: ausente, null, '' ou vazio após o trim viram null (não
    // gravados) — "só o nome é obrigatório" é a regra do dono. Tipo errado
    // (número, objeto, array) vira '' e é recusado com erro do campo.
    var optStr = function (key) {
      var s = pickStr(body[key], CAP[key] || 200)
      if (s === null || s === '') return null
      return s
    }

    var name = pickStr(body.name, CAP.name)
    if (name === null || name === '') {
      data.name = 'Informe o nome do aluno.'
      name = ''
    }

    var email = optStr('email')
    if (email) email = email.toLowerCase()
    var phone = optStr('phone')
    var address = optStr('address')
    var guardianName = optStr('guardian_name')
    var guardianPhone = optStr('guardian_phone')
    var guardianEmail = optStr('guardian_email')
    if (guardianEmail) guardianEmail = guardianEmail.toLowerCase()

    var belt = optStr('belt')
    var birthDate = optStr('birth_date')

    var emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (email && !emailRe.test(email))
      data.email = 'Informe um e-mail válido — ex.: aluno@email.com.'
    if (guardianEmail && !emailRe.test(guardianEmail))
      data.guardian_email = 'Informe um e-mail válido para o responsável.'

    var phoneErr = function (p) {
      var digits = String(p || '').replace(/\D/g, '')
      if (!digits) return null
      if (digits.length < 10 || digits.length > 11)
        return 'Informe o telefone com DDD — ex.: (11) 90000-0000.'
      return null
    }
    var phoneE = phoneErr(phone)
    if (phoneE) data.phone = phoneE
    var gPhoneE = phoneErr(guardianPhone)
    if (gPhoneE) data.guardian_phone = gPhoneE

    // As 13 faixas do schema (mesma lista do BELT_ORDER do front).
    var belts = [
      'branca',
      'branca_ponta_cinza',
      'cinza',
      'cinza_ponta_azul',
      'azul',
      'azul_ponta_amarela',
      'amarela',
      'amarela_ponta_laranja',
      'laranja',
      'verde',
      'roxa',
      'marrom',
      'preta',
    ]
    var beltValue = ''
    if (belt) {
      var hit = belts.indexOf(belt)
      if (hit === -1) {
        data.belt = 'A faixa informada não é aceita — selecione novamente na lista e tente salvar.'
      } else {
        beltValue = belts[hit]
      }
    }

    if (birthDate) {
      var m = birthDate.match(/^(\d{4})-(\d{2})-(\d{2})$/)
      var valid = m && !isNaN(new Date(birthDate).getTime())
      if (!valid) data.birth_date = 'Informe uma data de nascimento válida.'
    }

    if (Object.keys(data).length > 0) {
      errOut(400, 'Revise os campos destacados antes de salvar.', data)
      return
    }

    // ---- 3. Gravação via $app ----
    try {
      var col = $app.findCollectionByNameOrId('students')
      var rec = new Record(col)
      rec.set('name', name)
      rec.set('active', true)
      if (email) rec.set('email', email)
      if (phone) rec.set('phone', phone)
      if (beltValue) rec.set('belt', beltValue)
      if (address) rec.set('address', address)
      if (birthDate) rec.set('birth_date', birthDate)
      if (guardianName) rec.set('guardian_name', guardianName)
      if (guardianPhone) rec.set('guardian_phone', guardianPhone)
      if (guardianEmail) rec.set('guardian_email', guardianEmail)

      $app.save(rec)
      console.log('[students_create] aluno criado id=' + rec.id + ' nome=' + name)
      return e.json(200, { student: rec })
    } catch (saveErr) {
      // O motivo real fica só no log do servidor; a resposta é genérica.
      console.log('[students_create] save falhou: ' + String(saveErr))
      return errOut(
        400,
        'O servidor não conseguiu salvar o aluno. Verifique os dados e tente novamente.',
        {},
      )
    }
  },
  $apis.requireAuth(),
)

/**
 * GET /backend/v1/students/list — LISTAGEM completa de alunos (v0.0.172).
 *
 * Por quê: o dono reportou que a aba de alunos só exibia o aluno vinculado à
 * própria conta de admin ("só ficou o aluno com status de admin"), apesar dos
 * registros existirem no banco. A rota devolve TODOS os alunos gravados
 * (ordenados por criação, mais novos primeiro) com a conta de acesso expandida
 * (nome, cargo e dono) — a mesma forma que o painel já consumia.
 *
 * A rota NÃO substitui a regra de listagem da collection (que continua
 * correta); é um caminho estável para o painel, com autenticação e papel do
 * admin validados explicitamente — igual às rotas de criar e excluir.
 */
routerAdd(
  'GET',
  '/backend/v1/students/list',
  (e) => {
    // ---- Declarações inline (JSVM não enxerga o escopo do módulo) ----
    var hasAlunosAccess = function (admin) {
      if (admin.getBool('is_owner')) return true
      var list = []
      try {
        var perms = admin.get('admin_permissions')
        if (Array.isArray(perms)) {
          list = perms
        } else if (typeof perms === 'string' && perms !== '') {
          list = perms.split(',')
        }
      } catch (_) {
        list = []
      }
      if (list.length === 0) return true
      for (var p = 0; p < list.length; p++) {
        if (String(list[p]).trim() === 'alunos') return true
      }
      return false
    }

    var admin = e.auth
    if (!admin || admin.id === '') {
      throw new UnauthorizedError('Sua sessão expirou, entre novamente.')
    }
    if (admin.getString('role') !== 'admin' && !admin.getBool('is_owner')) {
      throw new ForbiddenError('Sua conta não tem permissão para ver a lista de alunos.')
    }
    if (!hasAlunosAccess(admin)) {
      throw new ForbiddenError('Sua conta não tem permissão para ver a lista de alunos.')
    }

    // findRecordsByFilter (countRecordsByFilter não existe na JSVM). Teto de
    // 2000 registros: resposta nunca cresce sem limite.
    var rows = $app.findRecordsByFilter('students', '', '-created', 2000, 0)

    // user_email por users.id: o painel usa para saber quando o e-mail do
    // responsável JÁ TEM conta mas a ficha do aluno ainda não está vinculada
    // (caso Tatiane/Isabelly: a responsável também é aluna) e oferecer
    // "Vincular à conta do responsável" sem N buscas no front.
    var userEmailById = {}
    var userOfId = function (userId) {
      if (!userId) return null
      if (userEmailById[userId] !== undefined) return userEmailById[userId]
      var info = null
      try {
        var ur = $app.findRecordById('users', userId)
        info = {
          email: String(ur.getString('email') || ''),
          role: String(ur.getString('role') || ''),
        }
      } catch (_) {
        info = null // conta apagada: mantém o aluno sem expansão
      }
      userEmailById[userId] = info
      return info
    }

    // Contas de acesso referenciadas: uma busca única em vez de N.
    var usersCache = {}
    var userOf = function (userId) {
      if (!userId) return null
      if (usersCache[userId] !== undefined) return usersCache[userId]
      var u = null
      try {
        var rec = $app.findRecordById('users', userId)
        u = {
          id: rec.id,
          collectionId: rec.collection().id,
          collectionName: 'users',
          name: rec.getString('name'),
          email: rec.getString('email'),
          role: rec.getString('role'),
          is_owner: rec.getBool('is_owner'),
          avatar: rec.getString('avatar'),
        }
      } catch (_) {
        // Conta apagada: mantém o aluno, sem expansão.
        u = null
      }
      usersCache[userId] = u
      return u
    }

    var students = []
    for (var i = 0; i < rows.length; i++) {
      var r = rows[i]
      var userId = r.getString('user')
      var item = {
        id: r.id,
        collectionId: r.collection().id,
        collectionName: 'students',
        name: r.getString('name'),
        phone: r.getString('phone'),
        belt: r.getString('belt'),
        email: r.getString('email'),
        active: r.getBool('active'),
        user: userId,
        address: r.getString('address'),
        birth_date: r.getString('birth_date'),
        guardian_name: r.getString('guardian_name'),
        guardian_phone: r.getString('guardian_phone'),
        guardian_email: r.getString('guardian_email'),
        photo: r.getString('photo'),
        created: r.getString('created'),
        updated: r.getString('updated'),
        expand: {},
      }
      var u = userOf(userId)
      if (u) item.expand = { user: u }
      students.push(item)
    }

    console.log('[students_list] admin=' + admin.id + ' alunos=' + students.length)
    return e.json(200, { students: students })
  },
  $apis.requireAuth(),
)

/**
 * DELETE /backend/v1/students/delete?id=... — EXCLUSÃO de aluno (v0.0.174).
 *
 * Por quê: o DELETE padrão /api/collections/students/records/:id recusa o dono
 * com 404 "The requested resource wasn't found." MESMO COM O REGISTRO
 * EXISTINDO no banco (logs de 2026-11-27 00:40, 5 tentativas seguidas). O
 * PocketBase responde 404 quando a deleteRule não bate — mesma classe de
 * falha de API rule já documentada na criação e na listagem. Para o dono isso
 * aparecia como "cliquei em excluir e o aluno continua lá", sem erro.
 *
 * O que faz:
 *   1. Valida o admin EXPLICITAMENTE (requireAuth + role/is_owner + permissão
 *      granular 'alunos') — não depende da deleteRule da collection.
 *   2. Recebe o id via query (?id=) — DELETE não costuma carregar body — e o
 *      valida contra o formato de ids do PocketBase antes de buscar.
 *   3. Apaga a ficha via $app (dispara os hooks onRecordDelete da collection,
 *      incluindo o delete_student_user que apaga a conta de usuário vinculada,
 *      sem nunca apagar conta de dono/admin e sem apagar a conta quando
 *      outro aluno continua vinculado a ela).
 *   4. Idempotente: id que não existe mais devolve 200 (já excluído) — NUNCA
 *      404, que o front trata como sessão expirada.
 */
routerAdd(
  'DELETE',
  '/backend/v1/students/delete',
  (e) => {
    // ---- Declarações inline (JSVM não enxerga o escopo do módulo) ----
    var ID_RE = /^[A-Za-z0-9]{15,}$/
    var hasAlunosAccess = function (admin) {
      if (admin.getBool('is_owner')) return true
      var list = []
      try {
        var perms = admin.get('admin_permissions')
        if (Array.isArray(perms)) {
          list = perms
        } else if (typeof perms === 'string' && perms !== '') {
          list = perms.split(',')
        }
      } catch (_) {
        list = []
      }
      if (list.length === 0) return true
      for (var p = 0; p < list.length; p++) {
        if (String(list[p]).trim() === 'alunos') return true
      }
      return false
    }

    var admin = e.auth
    if (!admin || admin.id === '') {
      throw new UnauthorizedError('Sua sessão expirou, entre novamente.')
    }
    if (admin.getString('role') !== 'admin' && !admin.getBool('is_owner')) {
      throw new ForbiddenError('Sua conta não tem permissão para excluir alunos.')
    }
    if (!hasAlunosAccess(admin)) {
      throw new ForbiddenError('Sua conta não tem permissão para excluir alunos.')
    }

    var qid = ''
    try {
      var q = e.requestInfo().query
      if (q && typeof q === 'object' && q.id !== undefined && q.id !== null) {
        qid = String(q.id).trim()
      }
    } catch (_) {
      qid = ''
    }
    if (qid === '') {
      throw new BadRequestError('Aluno não informado para exclusão.')
    }
    if (!ID_RE.test(qid)) {
      // Id malformado: sem busca no banco, sem detalhe interno na resposta.
      throw new BadRequestError('Identificador do aluno inválido.')
    }

    var student
    try {
      student = $app.findRecordById('students', qid)
    } catch (_) {
      // Já não existe (clique duplo / aba aberta em duas máquinas): sucesso.
      console.log('[students_delete] aluno=' + qid + ' já não existia (idempotente)')
      return e.json(200, { ok: true, id: qid, already: true })
    }

    var name = student.getString('name')
    var linkedUser = student.getString('user')
    if (linkedUser && !ID_RE.test(linkedUser)) linkedUser = ''

    // $app.delete dispara os hooks da collection, incluindo o
    // delete_student_user (conta de usuário vinculada), com as proteções dele.
    $app.delete(student)
    console.log(
      '[students_delete] admin=' +
        admin.id +
        ' aluno=' +
        qid +
        ' nome=' +
        name +
        ' conta_vinculada=' +
        (linkedUser || 'nenhuma'),
    )
    return e.json(200, { ok: true, id: qid })
  },
  $apis.requireAuth(),
)
