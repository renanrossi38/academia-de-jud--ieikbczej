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
 * O que faz — POST /backend/v1/students/create:
 *   1. Valida o admin EXPLICITAMENTE (token no header Authorization + checagem
 *      do registro users: role 'admin' ou is_owner) — NÃO depende da createRule
 *      da collection, que é onde a sessão fantasma recusava sem explicar.
 *   2. Sanitiza o payload: descarta opcionais vazios (string vazia em campo
 *      tipado = 400 do PocketBase), valida tipos, valida a faixa contra as 13
 *      do schema (BELT_ORDER), e-mail e telefone em formato válido.
 *   3. Grava o aluno via $app (findCollectionByNameOrId + new Record + save) e
 *      devolve o aluno criado.
 *   4. Em caso de recusa devolve SEMPRE erros reais por campo, em português —
 *      nunca um 400 opaco.
 *
 * O hook students_sanitize (v0.0.167) continua ativo como segunda camada para
 * o fluxo padrão da collection; esta rota é o caminho novo do painel.
 */

routerAdd(
  'POST',
  '/backend/v1/students/create',
  (e) => {
    const errOut = (status, message, fieldErrors) => {
      e.json(status, { status, message, data: fieldErrors || {} })
    }

    // ---- 1. Autenticação e papel do admin (sem depender da createRule) ----
    // e.auth já é o registro users resolvido do token (middleware requireAuth) —
    // token morto/sessão fantasma nunca chega aqui (401 antes do handler).
    const admin = e.auth
    if (!admin || admin.id === '') {
      throw new UnauthorizedError('Sua sessão expirou, entre novamente.')
    }
    if (admin.getString('role') !== 'admin' && !admin.getBool('is_owner')) {
      throw new ForbiddenError('Sua conta não tem permissão para cadastrar alunos.')
    }

    // ---- 2. Payload e sanitização ----
    let body = {}
    try {
      body = e.requestInfo().body || {}
    } catch (_) {
      body = {}
    }
    const str = (v) => (typeof v === 'string' ? v.trim() : '')

    const name = str(body.name)
    const email = str(body.email).toLowerCase()
    const phone = str(body.phone)
    const belt = str(body.belt)
    const address = str(body.address)
    const birthDate = str(body.birth_date)
    const guardianName = str(body.guardian_name)
    const guardianPhone = str(body.guardian_phone)
    const guardianEmail = str(body.guardian_email).toLowerCase()

    const data = {}
    if (!name) data.name = 'Informe o nome do aluno.'

    const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (email && !emailRe.test(email))
      data.email = 'Informe um e-mail válido — ex.: aluno@email.com.'
    const guardianEmailErr =
      guardianEmail && !emailRe.test(guardianEmail)
        ? 'Informe um e-mail válido para o responsável.'
        : null
    if (guardianEmailErr) data.guardian_email = guardianEmailErr

    const phoneErr = (p) => {
      const digits = String(p || '').replace(/\D/g, '')
      if (!digits) return null
      if (digits.length < 10 || digits.length > 11)
        return 'Informe o telefone com DDD — ex.: (11) 90000-0000.'
      return null
    }
    const phoneE = phoneErr(phone)
    if (phoneE) data.phone = phoneE
    const gPhoneE = phoneErr(guardianPhone)
    if (gPhoneE) data.guardian_phone = gPhoneE

    // As 13 faixas do schema (mesma lista do BELT_ORDER do front).
    const belts = [
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
    let beltValue = ''
    if (belt) {
      const hit = belts.indexOf(belt)
      if (hit === -1) {
        data.belt = 'A faixa informada não é aceita — selecione novamente na lista e tente salvar.'
      } else {
        beltValue = belts[hit]
      }
    }

    if (birthDate) {
      const m = birthDate.match(/^(\d{4})-(\d{2})-(\d{2})$/)
      const valid = m && !isNaN(new Date(birthDate).getTime())
      if (!valid) data.birth_date = 'Informe uma data de nascimento válida.'
    }

    if (Object.keys(data).length > 0) {
      errOut(400, 'Revise os campos destacados antes de salvar.', data)
      return
    }

    // ---- 3. Gravação via $app ----
    try {
      const col = $app.findCollectionByNameOrId('students')
      const rec = new Record(col)
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
      console.log('[students_create] save falhou: ' + String(saveErr))
      return errOut(400, 'O servidor recusou o cadastro do aluno: ' + String(saveErr), {})
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
 * admin validados explicitamente — igual à rota de criação acima.
 */
routerAdd(
  'GET',
  '/backend/v1/students/list',
  (e) => {
    const admin = e.auth
    if (!admin || admin.id === '') {
      throw new UnauthorizedError('Sua sessão expirou, entre novamente.')
    }
    if (admin.getString('role') !== 'admin' && !admin.getBool('is_owner')) {
      throw new ForbiddenError('Sua conta não tem permissão para ver a lista de alunos.')
    }

    // findRecordsByFilter (countRecordsByFilter não existe na JSVM).
    const rows = $app.findRecordsByFilter('students', '', '-created', 0, 0)

    // Contas de acesso referenciadas: uma busca única em vez de N.
    const usersCache = {}
    const userOf = (userId) => {
      if (!userId) return null
      if (usersCache[userId] !== undefined) return usersCache[userId]
      let u = null
      try {
        const rec = $app.findRecordById('users', userId)
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

    const students = []
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i]
      const userId = r.getString('user')
      const item = {
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
      const u = userOf(userId)
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
 *   1. Valida o admin EXPLICITAMENTE (requireAuth + role/is_owner) — não
 *      depende da deleteRule da collection.
 *   2. Recebe o id via query (?id=) — DELETE não costuma carregar body.
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
    const admin = e.auth
    if (!admin || admin.id === '') {
      throw new UnauthorizedError('Sua sessão expirou, entre novamente.')
    }
    if (admin.getString('role') !== 'admin' && !admin.getBool('is_owner')) {
      throw new ForbiddenError('Sua conta não tem permissão para excluir alunos.')
    }

    const id = (e.requestInfo().query.id || '') + ''
    if (id === '') {
      throw new BadRequestError('Aluno não informado para exclusão.')
    }

    let student
    try {
      student = $app.findRecordById('students', id)
    } catch (_) {
      // Já não existe (clique duplo / aba aberta em duas máquinas): sucesso.
      console.log('[students_delete] aluno=' + id + ' já não existia (idempotente)')
      return e.json(200, { ok: true, id: id, already: true })
    }

    const name = student.getString('name')
    const linkedUser = student.getString('user')

    // $app.delete dispara os hooks da collection, incluindo o
    // delete_student_user (conta de usuário vinculada), com as proteções dele.
    $app.delete(student)
    console.log(
      '[students_delete] admin=' +
        admin.id +
        ' aluno=' +
        id +
        ' nome=' +
        name +
        ' conta_vinculada=' +
        (linkedUser || 'nenhuma'),
    )
    return e.json(200, { ok: true, id: id })
  },
  $apis.requireAuth(),
)
