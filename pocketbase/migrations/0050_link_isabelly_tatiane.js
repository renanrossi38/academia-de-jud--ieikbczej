/// <reference path="../pb_data/types.d.ts" />
/**
 * 0050 — Vincula a Isabelly (students/af1w4gyx0iyyqo7) à conta da Tatiane
 * (users/m8kcnx3bi4h0tt3, tatizinha40@gmail.com) — o caso real que motivou as
 * rotas /backend/v1/students/link e /lookup-user (v0.0.177).
 *
 * Por que esta migration travava o deploy duas vezes:
 *   1ª) "Invalid variable type: must be a pointer" — a versão anterior chamava
 *       app.db().newQuery(...).all() para ler sqlite_master; na JSVM All()
 *       exige um ponteiro de destino. A leitura de linhas cruas foi removida.
 *   2ª) "user: Value must be unique" — o índice UNIQUE físico idx_students_user
 *       (criado na 0008) continuava no SQLite apesar de fora dos metadados da
 *       collection (a 0049 só reescreveu col.indexes, que NÃO derruba o índice
 *       físico). DROP INDEX pelo NOME conhecido resolve, sem leitura de linhas.
 *
 * Consolidação da numeração: só existe UM arquivo 0050 nesta pasta — o passo
 * de recriar o índice não-unique (que havia sido duplicado em 0050 e 0051)
 * já está garantido pela 0049, aplicada, e confirmado no banco live
 * (idx_students_user_lookup). Esta migration é só o link, idempotente.
 *
 * Idempotente: só grava quando a ficha existe, ainda não tem user e a conta
 * de destino existe — rodar de novo (ou em outra cópia do projeto, que começa
 * sem registros) é no-op silencioso.
 */
migrate(
  (app) => {
    // --- passo 1: derruba o índice UNIQUE FÍSICO de students.user pelo nome
    // conhecido (0008). DROP INDEX é aceito pela JSVM (não lê linhas). IF
    // EXISTS: em uma cópia do projeto onde ele já não exista, é no-op.
    try {
      app.db().newQuery('DROP INDEX IF EXISTS `idx_students_user`').execute()
      console.log('[0050_link_isabelly] índice físico idx_students_user derrubado (se existia)')
    } catch (dropErr) {
      console.log('[0050_link_isabelly] falha ao derrubar idx_students_user: ' + String(dropErr))
    }

    // --- passo 2: vincula Isabelly → Tatiane (idempotente)
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
      account = app.findRecordById('users', 'm8kcnx3bi4h0tt3')
    } catch (_) {
      account = null
    }
    if (!account) {
      console.log('[0050_link_isabelly] conta de destino não encontrada — nada a fazer')
      return
    }
    student.set('user', 'm8kcnx3bi4h0tt3')
    app.save(student)
    console.log('[0050_link_isabelly] Isabelly vinculada à conta da Tatiane')
  },
  (app) => {
    // Down: limpa o vínculo. Não recria o índice único: em copies com vários
    // alunos por conta (o propósito da 0049) ele não pode voltar.
    try {
      var s2 = app.findRecordById('students', 'af1w4gyx0iyyqo7')
      if (s2.getString('user') === 'm8kcnx3bi4h0tt3') {
        s2.set('user', '')
        app.save(s2)
      }
    } catch (_) {
      // ficha ausente: nada a desfazer
    }
  },
)
