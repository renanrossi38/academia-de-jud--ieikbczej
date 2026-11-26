///
// qa_http_probe.js — PROBE TEMPORÁRIO de diagnóstico (REMOVER ao final).
//
// Contexto: POST /api/collections/students/records → 400 "Failed to create
// record." em ~0.7ms na produção (judotatsu.com.br), SEM nenhum log do hook
// students_sanitize — assinatura de falha de API RULE, que nunca dispara os
// hooks de record nem devolve fieldErrors. Este probe replica o caminho REAL
// (HTTP, com token de admin autêntico) para provar qual parte da regra
// @request.auth recusa o payload exato da tela do dono.
//
// Como funciona: o painel (dono logado) chama POST /backend/v1/qa/http-probe
// com { key, email_admin }. O hook valida a key contra o env QA_PROBE_KEY,
// autentica como o admin informado via $apis.recordAuth (token REAL, sem
// senha), e faz a chamada HTTP real contra o próprio backend com $http.send,
// repetindo o payload da tela. Cada tentativa é logada com o status e o corpo
// COMPLETO da resposta — inclusive os fieldErrors que o PocketBase omite na
// mensagem genérica do log de requests.
//
// RESTRIÇÕES DA JSVM: callbacks não enxergam declarações de nível superior.
///

routerAdd('POST', '/backend/v1/qa/http-probe', (e) => {
  var KEY = $os.getenv('QA_PROBE_KEY') || ''

  // ---- Parse do body ----
  var body = {}
  try {
    body = e.readBody({
      key: 'string',
      email_admin: 'string',
      phone: 'string',
      belt: 'string',
      address: 'string',
      birth_date: 'string',
      email_aluno: 'string',
    })
  } catch (errBody) {
    return e.json(400, { error: 'body inválido: ' + String(errBody) })
  }

  if (!KEY || body.key !== KEY) {
    return e.json(403, { error: 'chave inválida' })
  }

  var log = function (s) {
    console.log('[qa-http-probe] ' + s)
  }

  var EMAIL_ADMIN = String(body.email_admin || '')
  var EMAIL_ALUNO = String(body.email_aluno || '')
  var PHONE = String(body.phone || '')
  var BELT = String(body.belt || '')
  var ADDRESS = String(body.address || '')
  var BIRTH = String(body.birth_date || '')

  var BASE = $os.getenv('PB_INSTANCE_URL') || ''
  if (!BASE) {
    return e.json(500, { error: 'PB_INSTANCE_URL não definido' })
  }

  // ---- Autentica como o admin informado (token real, sem senha) ----
  var adminRec
  try {
    adminRec = $app.findAuthRecordByEmail('users', EMAIL_ADMIN)
  } catch (errAdmin) {
    return e.json(404, { error: 'admin não encontrado: ' + EMAIL_ADMIN })
  }

  var adminToken = ''
  try {
    var tokenDur = 300
    adminToken = adminRec.newAuthToken()
  } catch (errTok) {
    return e.json(500, { error: 'falha ao gerar token: ' + String(errTok) })
  }

  var logh = { Authorization: adminToken }

  // ---- 1. Reproduz o payload EXATO da tela (todos os campos preenchidos) ----
  var payloadTela = {
    name: 'Carol Probe HTTP',
    email: EMAIL_ALUNO,
    phone: PHONE,
    belt: BELT,
    address: ADDRESS,
    birth_date: BIRTH,
    active: true,
  }

  // ---- 2. Payload mínimo (só nome) ----
  var payloadMinimo = { name: 'Probe Minimo HTTP', active: true }

  // ---- 3. Payload de menor (só responsável) ----
  var payloadMenor = {
    name: 'Probe Menor HTTP',
    active: true,
    guardian_name: 'Responsável Probe HTTP',
    guardian_phone: PHONE,
    guardian_email: 'resp.probe.http@exemplo.com',
  }

  var resultados = []

  var tentar = function (rotulo, payload) {
    var res = $http.send({
      url: BASE + '/api/collections/students/records',
      method: 'POST',
      headers: logh,
      body: JSON.stringify(payload),
    })
    var corpo = ''
    try {
      corpo = JSON.stringify(res.json)
    } catch (_) {
      corpo = String(res)
    }
    log(rotulo + ' → status=' + res.status + ' corpo=' + corpo)
    resultados.push({ rotulo: rotulo, status: res.status, corpo: corpo })

    // Limpeza imediata se criou (superuser via $app direto no banco)
    if (res.status >= 200 && res.status < 300) {
      try {
        var criado = res.json
        if (criado && criado.id) {
          $app.delete($app.findRecordById('students', criado.id))
          log(rotulo + ' → registro de teste removido (id=' + criado.id + ')')
        }
      } catch (errDel) {
        log(rotulo + ' → falha ao remover registro de teste: ' + String(errDel))
      }
    }
    return resultados[resultados.length - 1]
  }

  tentar('PAYLOAD_TELA(adulto_completo)', payloadTela)
  tentar('PAYLOAD_MINIMO(so_nome)', payloadMinimo)
  tentar('PAYLOAD_MENOR(so_responsavel)', payloadMenor)

  // ---- Diagnóstico extra: quem é o admin aos olhos da regra ----
  log(
    'admin=' +
      EMAIL_ADMIN +
      ' role=' +
      adminRec.getString('role') +
      ' is_owner=' +
      adminRec.getBool('is_owner') +
      ' active=' +
      adminRec.getBool('active') +
      ' verified=' +
      adminRec.getBool('verified') +
      ' perms=' +
      JSON.stringify(adminRec.getStringSlice('admin_permissions')),
  )

  return e.json(200, { resultados: resultados })
})
