// Ao excluir uma ficha de aluno (Judô Tatsu), apaga também a conta de usuário
// vinculada (students.user → users), se existir — sem isso sobra uma conta
// órfã que continua logando no app e aparece como candidata a administrador
// na página /painel/admins.
//
// PROTEÇÕES (nunca apagar):
//   • is_owner = true  (administrador principal);
//   • role = "admin"   (administrador, principal ou secundário);
//   • usuários sem role (contas criadas pelo cadastro público, /registrar).
//
// A conta só é apagada quando role = "aluno". Se o aluno não tiver conta
// vinculada (acesso nunca gerado), nada acontece.
//
// VÁRIOS FILHOS NA MESMA CONTA: um responsável pode ter mais de uma ficha de
// student apontando para o MESMO users.id. A conta só é apagada quando NENHUM
// outro aluno continua vinculado a ela — excluir a ficha de um filho não pode
// derrubar o acesso do outro.
//
// onRecordAfterDeleteSuccess: roda DEPOIS da ficha ser excluída de verdade —
// se algo falhar aqui, a exclusão da ficha já ficou feita e um erro não
// desfaz nada; por isso o catch é tolerante (loga e segue).

onRecordAfterDeleteSuccess((e) => {
  e.next()

  const student = e.record

  const userId = student.getString('user')
  if (userId === '') {
    return
  }

  try {
    const user = $app.findRecordById('users', userId)

    // Nunca apagar o dono nem administradores
    const isOwner = user.getBool('is_owner')
    const role = user.getString('role')
    if (isOwner || role === 'admin' || role === '') {
      console.log(
        '[delete-student-user] Conta de usuário ' +
          userId +
          ' (role=' +
          role +
          ', is_owner=' +
          isOwner +
          ') NÃO foi apagada junto do aluno ' +
          student.id,
      )
      return
    }

    // Vários filhos podem compartilhar a mesma conta (responsável com 2+ filhos):
    // só apaga quando NENHUM outro student segue vinculado a ela. Sem essa
    // guarda, excluir a ficha de um filho derrubaria o acesso do outro.
    const siblings = $app.findRecordsByFilter('students', 'user = {:uid}', '', 1, 0, {
      uid: userId,
    })
    if (siblings.length > 0) {
      console.log(
        '[delete-student-user] Conta de usuário ' +
          userId +
          ' ainda tem ' +
          siblings.length +
          ' outro(s) aluno(s) vinculado(s) — NÃO apagada junto do aluno ' +
          student.id,
      )
      return
    }

    $app.delete(user)
    console.log(
      '[delete-student-user] Conta de usuário ' + userId + ' apagada junto do aluno ' + student.id,
    )
  } catch (err) {
    console.log(
      '[delete-student-user] Falha ao apagar conta de usuário ' +
        userId +
        ' do aluno ' +
        student.id +
        ': ' +
        err,
    )
  }
}, 'students')
