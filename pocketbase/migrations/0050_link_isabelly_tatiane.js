/// <reference path="../pb_data/types.d.ts" />
/**
 * 0050 — Vincula a Isabelly (students/af1w4gyx0iyyqo7) à conta da Tatiane
 * (users/m8kcnx3bi4h0tt3, tatizinha40@gmail.com) — o caso real que motivou as
 * rotas /backend/v1/students/link e /lookup-user (v0.0.177).
 *
 * Idempotente: só grava quando a ficha existe, ainda não tem user e a conta
 * de destino existe — rodar de novo (ou em outra cópia do projeto) é no-op.
 */
// UP: primeiro derruba o índice UNIQUE de students.user (mesma 0050 acima),
// depois grava o vínculo — nesta ORDEM, senão o próprio link falha com
// "user: Value must be unique" enquanto o índice único existir.
migrate(
  (app) => {
    // --- passo 1: índice non-unique (padrão 0048, reconstrução incondicional)
    //
    // Diagnóstico do "Value must be unique" desta migration: remover a entrada
    // do índice de collection.indexes NÃO garante que o índice físico sumiu do
    // SQLite (sobrou um UNIQUE em students.user fora dos metadados). Por isso:
    // primeiro logamos o que existe de verdade em sqlite_master, derrubamos
    // QUALQUER índice UNIQUE que envolva a coluna user e só então recriamos o
    // índice comum via metadados.
    var rows = app
      .db()
      .newQuery(
        "SELECT name, sql FROM sqlite_master WHERE type = 'index' AND tbl_name = 'students'",
      )
      .all()
    for (var r = 0; r < rows.length; r++) {
      console.log(
        '[0050_link_isabelly] índice físico: ' + rows[r].get('name') + ' :: ' + rows[r].get('sql'),
      )
      var sql = String(rows[r].get('sql') || '')
      var name = String(rows[r].get('name') || '')
      if (sql.indexOf('UNIQUE') !== -1 && sql.indexOf('user') !== -1 && name !== '') {
        try {
          app
            .db()
            .newQuery('DROP INDEX IF EXISTS `' + name + '`')
            .execute()
          console.log('[0050_link_isabelly] índice UNIQUE físico derrubado: ' + name)
        } catch (dropErr) {
          console.log('[0050_link_isabelly] falha ao derrubar ' + name + ': ' + String(dropErr))
        }
      }
    }

    const students = app.findCollectionByNameOrId('students')
    var kept = []
    var existing = students.indexes || []
    for (var i = 0; i < existing.length; i++) {
      if (String(existing[i]).indexOf('user') === -1) {
        kept.push(String(existing[i]))
      }
    }
    students.indexes = kept
    students.addIndex('idx_students_user_lookup', false, 'user', '')
    app.save(students)
    console.log('[0050_link_isabelly] índice students.user recriado como non-unique')

    // --- passo 2: vincula Isabelly → Tatiane (idempotente)
    const userId = 'm8kcnx3bi4h0tt3'
    var student = null
    try {
      student = app.findRecordById('students', 'af1w4gyx0iyyqo7')
    } catch (_) {
      student = null
    }
    if (!student) {
      console.log('[0050_link_isabelly] ficha não encontrada — nada a fazer')
      return
    }
    if (student.getString('user') !== '') {
      console.log('[0050_link_isabelly] ficha já vinculada — nada a fazer')
      return
    }
    var account = null
    try {
      account = app.findRecordById('users', userId)
    } catch (_) {
      account = null
    }
    if (!account) {
      console.log('[0050_link_isabelly] conta de destino não encontrada — nada a fazer')
      return
    }
    student.set('user', userId)
    app.save(student)
    console.log('[0050_link_isabelly] Isabelly vinculada à conta da Tatiane')
  },
  (app) => {
    // Down: limpa o vínculo e volta o índice único (válido só sem duplicados).
    try {
      var s2 = app.findRecordById('students', 'af1w4gyx0iyyqo7')
      if (s2.getString('user') === 'm8kcnx3bi4h0tt3') {
        s2.set('user', '')
        app.save(s2)
      }
    } catch (_) {
      // ficha ausente: nada a desfazer
    }
    try {
      const st = app.findCollectionByNameOrId('students')
      var kept2 = []
      var ex2 = st.indexes || []
      for (var j = 0; j < ex2.length; j++) {
        if (String(ex2[j]).indexOf('user') === -1) {
          kept2.push(String(ex2[j]))
        }
      }
      st.indexes = kept2
      st.addIndex('idx_students_user', true, 'user', '')
      app.save(st)
    } catch (_) {
      // collection ausente: nada a desfazer
    }
  },
)
