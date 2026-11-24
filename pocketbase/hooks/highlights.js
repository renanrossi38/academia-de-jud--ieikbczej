// Destaques públicos da home (Judô Tatsu) — rota única.
//
// ROTA (pública, somente leitura, sem dados sensíveis):
//   GET /backend/v1/highlights
//   → { month: [ { studentId, studentName, photoUrl, className } ],
//       competition: [ { id, studentId, studentName, photoUrl, reason, sort } ] }
//
// month       = fica fica vigente (medalha do mês M vale durante M+1, Brasília),
//               uma entrada por turma infantil — mesma regra de
//               medals_highlights.js, que continua no ar para compatibilidade.
// competition = student_highlights ativos, ordenados por "sort" (menor primeiro)
//               e depois por created. A foto vem de student_highlights.photo
//               quando o admin subiu uma própria; senão, da photo do aluno.
//
// FOTO: students.photo (migration 0039). URL pública canônica do PB:
//   /api/files/{collectionId}/{recordId}/{filename}
//
// RESTRIÇÃO DA JSVM: callbacks não enxergam declarações de nível superior —
// tudo inline dentro da callback.

routerAdd(
  'GET',
  '/backend/v1/highlights',
  (e) => {
    try {
      // Mês vigente em Brasília: relógio deslocado 3h e lido em UTC.
      var nowB = new Date(Date.now() - 3 * 60 * 60 * 1000)
      var mesVigente = nowB.getUTCFullYear() + '-' + ('0' + (nowB.getUTCMonth() + 1)).slice(-2)

      function mesSeguinte(k) {
        var partes = (k || '').split('-')
        var ano = Number(partes[0])
        var mes = Number(partes[1])
        if (!(ano > 0) || !(mes >= 1 && mes <= 12)) return ''
        return mes === 12 ? String(ano + 1) + '-01' : ano + '-' + ('0' + (mes + 1)).slice(-2)
      }

      function baseUrl() {
        var u = e.request ? e.request.URL : null
        var scheme = u && u.Scheme ? u.Scheme : 'http'
        var host = u && u.Host ? u.Host : 'localhost:8090'
        return scheme + '://' + host
      }
      function fileUrl(record, file) {
        if (!file || file === '') return ''
        return baseUrl() + '/api/files/' + record.collectionId + '/' + record.id + '/' + file
      }

      // Foto resolvida de um destaque: photo própria OU photo do aluno.
      function fotoDoAluno(st, propria) {
        if (propria && propria !== '') return fileUrl(st, propria)
        var p = st.getString('photo')
        return p && p !== '' ? fileUrl(st, p) : ''
      }

      // ===== Grupo 1: destaques do mês (fica fica vigente) =====
      var monthOut = []
      var medals = $app.findRecordsByFilter(
        'class_medals',
        'kind = "fica_fica"',
        '-month,-created',
        0,
        0,
      )
      var vistos = {}
      for (var i = 0; i < medals.length; i++) {
        var m = medals[i]
        if (mesSeguinte(m.getString('month')) !== mesVigente) continue
        var classId = m.getString('class')
        if (vistos[classId]) continue

        var klass = null
        try {
          klass = $app.findRecordById('classes', classId)
        } catch (errClass) {
          continue
        }
        if (!klass || klass.getBool('is_kids') !== true) continue

        var st = null
        try {
          st = $app.findRecordById('students', m.getString('student'))
        } catch (errStudent) {
          continue
        }
        if (!st) continue

        vistos[classId] = true
        monthOut.push({
          studentId: st.id,
          studentName: st.getString('name'),
          photoUrl: fotoDoAluno(st, ''),
          classId: classId,
          className: klass.getString('name'),
        })
      }

      // ===== Grupo 2: destaques de competição (student_highlights) =====
      var compOut = []
      var comps = $app.findRecordsByFilter(
        'student_highlights',
        'active = true',
        'sort,-created',
        0,
        0,
      )
      for (var j = 0; j < comps.length; j++) {
        var h = comps[j]
        var stH = null
        try {
          stH = $app.findRecordById('students', h.getString('student'))
        } catch (errStudentH) {
          continue
        }
        if (!stH) continue

        compOut.push({
          id: h.id,
          studentId: stH.id,
          studentName: stH.getString('name'),
          photoUrl: fotoDoAluno(stH, h.getString('photo')),
          reason: h.getString('reason'),
          sort: h.getInt('sort', 0),
        })
      }

      return e.json(200, {
        month: monthOut,
        competition: compOut,
        currentMonth: mesVigente,
      })
    } catch (err) {
      console.log('[highlights] erro: ' + err)
      return e.json(200, { month: [], competition: [], currentMonth: '' })
    }
  },
  // Pública: a home é visitada sem login. Devolve só nome do aluno, turma
  // infantil, motivo do destaque e a foto de destaque — nada de contato ou
  // dados pessoais (telefone/e-mail/address ficam no banco).
)
