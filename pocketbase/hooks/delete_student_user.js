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
