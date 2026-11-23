// Limpeza de contas de usuário órfãs (Judô Tatsu): usuários com role "aluno"
// cuja ficha vinculada em students (students.user = users.id) não existe mais.
//
// Origem do problema: excluir aluno no painel apagava só a ficha (students) e
// deixava a conta de acesso (users) órfã — ela continuava logando e aparecendo
// como candidata a administrador em /painel/admins (caso real: Takeshi
// Yamada, aluno@dojo.com). A partir do hook delete_student_user.js novas
// exclusões já apagam a conta junto; esta migration remove as que já existem.
//
// PROTEÇÕES (nunca apagar): is_owner = true (administrador principal) e
// role = "admin" (administradores, principal ou secundário). Só contas com
// role "aluno" e ficha inexistente são removidas.
//
// IDEMPOTENTE: em um banco vazio não há coleções/registros e nada acontece;
// sem órfãs, nenhuma linha é apagada. Tudo dentro de uma transação.

migrate(
  (app) => {
    // Banco vazio (cópia recém-criada): nada a limpar
    if (!app.hasTable('users') || !app.hasTable('students')) {
      return
    }

    // Não tocar em tabelas internas do PocketBase: filtra só nas de dados
    app.runInTransaction((tx) => {
      tx.db()
        .newQuery(
          'DELETE FROM users WHERE role = {:aluno} AND is_owner = false AND id NOT IN (SELECT user FROM students WHERE user != "")',
        )
        .bind({ aluno: 'aluno' })
        .execute()
    })
  },
  (app) => {
    // down: não há como restaurar contas apagadas — operação de limpeza sem volta
  },
)
