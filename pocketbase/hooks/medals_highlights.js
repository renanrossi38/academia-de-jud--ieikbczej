// Destaques do mês na home pública (Judô Tatsu) — medalhas "fica fica".
//
// ROTA (pública, somente leitura, sem dados sensíveis — nome do aluno e da
// turma infantil já aparecem publicamente no site):
//   GET /backend/v1/medals-highlights
//   → { highlights: [ { studentId, studentName, avatarUrl, classId, className,
//                       medalMonth, highlightMonth } ] }
//
// REGRA (idêntica ao painel e à área do aluno): o aluno que ganhou "fica_fica"
// no mês M fica em destaque durante TODO o mês M+1, calculado em horário de
// Brasília (UTC-3). Uma entrada por turma (a mais recente vence) e só entram
// turmas infantis (classes.is_kids = true). Sem destaques vigentes (ou em
// qualquer erro) → 200 com lista vazia: o front omite a seção e a home nunca
// quebra.
//
// POR QUE A ROTA EXISTE: class_medals é admin-only (migration 0035) — a home é
// visitada sem login e não conseguiria ler a collection direto.
//
// FOTO DO ALUNO: students não tem campo de imagem; o avatar vive em
// users.avatar via students.user. A URL pública usa a base URL do request
// (e.request.URL.Scheme/Host), no formato /api/files/{collection}/{id}/{file}.
//
// RESTRIÇÃO DA JSVM: callbacks não enxergam declarações de nível superior —
// tudo inline dentro da callback (mesmo padrão de instagram_posts.js).

routerAdd(
  'GET',
  '/backend/v1/medals-highlights',
  (e) => {
    try {
      // Mês vigente em Brasília: relógio deslocado 3h e lido em UTC.
      var nowB = new Date(Date.now() - 3 * 60 * 60 * 1000)
      var mesVigente = nowB.getUTCFullYear() + '-' + ('0' + (nowB.getUTCMonth() + 1)).slice(-2)

      // "YYYY-MM" seguinte ao concedido (M+1) — mesma fórmula do front.
      function mesSeguinte(k) {
        var partes = (k || '').split('-')
        var ano = Number(partes[0])
        var mes = Number(partes[1])
        if (!(ano > 0) || !(mes >= 1 && mes <= 12)) return ''
        return mes === 12 ? String(ano + 1) + '-01' : ano + '-' + ('0' + (mes + 1)).slice(-2)
      }

      // URL pública de um arquivo (users.avatar), na forma canônica do PB.
      function baseUrl() {
        var u = e.request ? e.request.URL : null
        var scheme = u && u.Scheme ? u.Scheme : 'http'
        var host = u && u.Host ? u.Host : 'localhost:8090'
        return scheme + '://' + host
      }
      function avatarUrl(record, file) {
        if (!file || file === '') return ''
        return baseUrl() + '/api/files/' + record.collectionId + '/' + record.id + '/' + file
      }

      var rows = $app.findRecordsByFilter(
        'class_medals',
        'kind = "fica_fica"',
        '-month,-created',
        0,
        0,
      )
      var vistos = {}
      var out = []
      for (var i = 0; i < rows.length; i++) {
        var m = rows[i]
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

        // Foto do aluno: users.avatar (students não tem campo de imagem).
        var foto = ''
        var uid = st.getString('user')
        if (uid && uid !== '') {
          try {
            var userRec = $app.findRecordById('users', uid)
            foto = avatarUrl(userRec, userRec.getString('avatar'))
          } catch (errUser) {
            // Sem conta de usuário (ou sem avatar): o front mostra as iniciais.
          }
        }

        vistos[classId] = true
        out.push({
          studentId: st.id,
          studentName: st.getString('name'),
          avatarUrl: foto,
          classId: classId,
          className: klass.getString('name'),
          medalMonth: m.getString('month'),
          highlightMonth: mesVigente,
        })
      }

      return e.json(200, { highlights: out, currentMonth: mesVigente })
    } catch (err) {
      console.log('[medals-highlights] erro: ' + err)
      return e.json(200, { highlights: [], currentMonth: '' })
    }
  },
  // Pública: a home é visitada sem login. Só lê medalhas e devolve nome do
  // aluno, nome da turma infantil e foto do perfil — nada de contato ou dados
  // pessoais (telefone/e-mail/address ficam no banco).
)
