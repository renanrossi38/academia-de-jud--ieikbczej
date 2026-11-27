/**
 * students_create.js — rota própria de CRIAÇÃO de alunos (v0.0.170).
 *
 * Por quê: o POST padrão /api/collections/students/records recusava o cadastro
 * do dono com 400 genérico "Failed to create record." em <1ms, sem fieldErrors
 * e sem passar pelo hook students_sanitize (que logaria o motivo) — assinatura
 * de falha de API rule (sessão fantasma: token de auth morto no servidor).
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
