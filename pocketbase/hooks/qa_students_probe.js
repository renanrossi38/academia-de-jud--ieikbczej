// TEMPORÁRIO (QA): rota única de DELETE de alunos de teste — remove depois.
routerAdd('GET', '/backend/v1/qa-students-probe', (e) => {
  var q = e.request.url.query()
  if (q.get('token') !== 'tatsu-qa-probe-2026') {
    throw new ForbiddenError('Token QA inválido.')
  }
  var deleted = []
  var ids = q.get('delete').split(',')
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
})
