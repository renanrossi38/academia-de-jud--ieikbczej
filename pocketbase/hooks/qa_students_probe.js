// TEMPORÁRIO (QA): rota única de DELETE de alunos de teste — remove depois.
routerAdd('GET', '/backend/v1/qa-students-probe', (e) => {
  var q = e.request.url.query()
  if (q.get('token') !== 'tatsu-qa-probe-2026') {
    throw new ForbiddenError('Token QA inválido.')
  }

  // ── Modo 1: DELETE (original) ────────────────────────────────────────────
  var deleteParam = q.get('delete')
  if (deleteParam) {
    var deleted = []
    var ids = deleteParam.split(',')
    for (var i = 0; i < ids.length; i++) {
      try {
        var record = $app.findRecordById('students', ids[i])
        $app.delete(record)
        deleted.push(ids[i])
      } catch (err) {
        return e.json(400, { error: String(err), partial_deleted: deleted })
      }
    }
    return e.json(200, { deleted: deleted })
  }

  // ── Modo 3: PROBE DE CRIAÇÃO PELA API REAL (autenticado como o dono) ─────
  // Reproduz EXATAMENTE o caminho do painel: POST /api/collections/students/
  // records autenticado (regras de API + hooks de request rodam), com os
  // payloads do front ATUAL e do bundle ANTIGO em cache. O token do dono é
  // gerado aqui dentro (newAuthToken) — nada de credencial externa.
  var adminToken = q.get('token_admin') || ''
  if (adminToken !== '') {
    var owner = $app.findRecordById('users', '3gkc7u51ahuqk4h')
    adminToken = owner.newAuthToken()
    var base = $app.settings().meta.appUrl.replace(/\/$/, '')
    var resultsHttp = []
    var createdIdsHttp = []
    var cases = [
      {
        name: 'front ATUAL limpo (cinza)',
        body: { name: 'QA HTTP Cinza', active: true, belt: 'cinza' },
      },
      {
        name: 'bundle ANTIGO: strings vazias em date/select',
        body: {
          name: 'QA HTTP Antigo',
          active: true,
          belt: 'branca_ponta_cinza',
          birth_date: '',
          phone: '',
          email: '',
          guardian_name: '',
          guardian_phone: '',
          guardian_email: '',
          address: '',
        },
      },
      {
        name: 'menor 5 anos sem contato do aluno',
        body: {
          name: 'QA HTTP Menor',
          active: true,
          belt: 'branca',
          birth_date: '2021-11-01',
          guardian_name: 'Responsável QA',
          guardian_phone: '15991234567',
          guardian_email: '',
        },
      },
    ]
    for (var c = 0; c < cases.length; c++) {
      var res = $http.send({
        url: base + '/api/collections/students/records',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: adminToken,
        },
        body: cases[c].body,
      })
      var okC = res.status >= 200 && res.status < 300
      if (okC) createdIdsHttp.push(res.json.id)
      resultsHttp.push({
        caso: cases[c].name,
        status: res.status,
        erro: okC ? '' : JSON.stringify(res.json),
      })
    }
    for (var r = 0; r < createdIdsHttp.length; r++) {
      try {
        $app.delete($app.findRecordById('students', createdIdsHttp[r]))
      } catch (_) {}
    }
    return e.json(200, { via_http: true, results: resultsHttp })
  }

  // ── Modo 2: CREATE-PROBE (QA desta rodada) ───────────────────────────────
  // Reproduz, via superuser, os payloads que chegam ao POST de students com os
  // campos que a recusa "Failed to create record." costuma apontar: faixa
  // (inteira e de ponta), data de nascimento e contato — uma vez LIMPO (como o
  // front atual envia) e uma vez COM STRING VAZIA (como bundles antigos em
  // cache enviam). Nenhum registro fica: tudo é apagado ao final.
  var createdIds = []
  var results = []
  var scenarios = [
    { name: 'QA Cinza', belt: 'cinza', birth: '2018-05-10T12:00:00.000Z' },
    {
      name: 'QA Branca ponta cinza',
      belt: 'branca_ponta_cinza',
      birth: '2016-03-03T12:00:00.000Z',
    },
    { name: 'QA Cinza (payload antigo)', belt: 'cinza', birth: '', emptyStrings: true },
  ]
  for (var s = 0; s < scenarios.length; s++) {
    var sc = scenarios[s]
    var payload = {
      name: sc.name,
      active: 'true',
      belt: sc.belt,
      birth_date: sc.birth,
      phone: sc.emptyStrings ? '' : '15991234567',
      email: '',
      guardian_name: '',
      guardian_phone: '',
      guardian_email: '',
    }
    try {
      var col = $app.findCollectionByNameOrId('students')
      var rec = new Record(col)
      rec.set('name', payload.name)
      rec.set('active', true)
      rec.set('belt', payload.belt)
      if (payload.birth_date !== '') rec.set('birth_date', payload.birth_date)
      rec.set('phone', payload.phone)
      $app.save(rec)
      createdIds.push(rec.id)
      results.push({ scenario: sc.name, ok: true, id: rec.id, belt: rec.getString('belt') })
    } catch (err) {
      results.push({
        scenario: sc.name,
        ok: false,
        error: String(err),
        detail: err && err.response ? JSON.stringify(err.response()) : '',
      })
    }
  }

  // Limpeza: remove os registros de teste criados (mesmo que um cenário falhe)
  for (var d = 0; d < createdIds.length; d++) {
    try {
      $app.delete($app.findRecordById('students', createdIds[d]))
    } catch (_) {}
  }

  return e.json(200, {
    ok: results.every(function (r) {
      return r.ok
    }),
    results: results,
  })
})
