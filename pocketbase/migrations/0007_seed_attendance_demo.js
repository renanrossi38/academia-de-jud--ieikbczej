// Seed idempotente de presenças de demonstração: para cada aluno ativo existente,
// cria marcações dos últimos ~21 dias (treinos seg/ter/qui), se ainda não houver
// registro para aquele aluno naquele dia.
migrate(
  (app) => {
    let students
    try {
      students = app.findRecordsByFilter('users', "role = 'aluno'", '-created', 100, 0)
    } catch (_) {
      return
    }

    const attendance = app.findCollectionByNameOrId('attendance')

    // Alunos de demonstração: apenas os que já existirem (seed 0003 criou 1).
    const activeStudents = students.filter((s) => s.getBool('active'))

    // Últimos 21 dias; treinos em seg(1), ter(2) e qui(4).
    const now = new Date()
    const trainingDays = []
    for (let i = 0; i < 21; i++) {
      const d = new Date(now)
      d.setDate(d.getDate() - i)
      if ([1, 2, 4].includes(d.getDay())) {
        trainingDays.push(d)
      }
    }

    // Padrão de presença por índice do aluno (varia entre alunos, determinístico).
    const statusPattern = ['presente', 'presente', 'ausente', 'presente', 'presente', 'justificado']

    activeStudents.forEach((student, studentIndex) => {
      trainingDays.forEach((day, dayIndex) => {
        const dateStr = day.toISOString().slice(0, 10)

        // Idempotência: já existe marcação para este aluno neste dia?
        const existing = app.findRecordsByFilter(
          'attendance',
          `user = '${student.id}' && date >= '${dateStr} 00:00:00.000Z' && date <= '${dateStr} 23:59:59.999Z'`,
          '',
          1,
          0,
        )
        if (existing.length > 0) return

        const offset = (studentIndex * 2 + dayIndex) % statusPattern.length
        const status = statusPattern[offset]

        const record = new Record(attendance)
        record.set('user', student.id)
        record.set('date', `${dateStr} 12:00:00.000Z`)
        record.set('status', status)
        record.set('notes', '')
        app.save(record)
      })
    })

    console.log(`Seed de presenças concluído para ${activeStudents.length} aluno(s).`)
  },
  (app) => {},
)
