//
// trial_bookings.js — Aula experimental (Judô Tatsu)
//
// Valida no SERVIDOR a criação de agendamentos de aula experimental:
//   - turma existe e está ativa;
//   - turma tem vaga (vagas - matrículas ativas > 0);
//   - data da aula é um dos dias da semana da turma (ex.: ter/qui recusa seg/qua);
//   - data da aula não está no passado;
//   - data de nascimento encaixa na faixa de idade da turma (min_age/max_age
//     calculados NA data da aula escolhida).
//
// Notas da JSVM deste projeto: callbacks não enxergam declarações de nível
// superior (lógica inline no callback) e não existe $app.countRecordsByFilter
// (usar findRecordsByFilter e contar em objeto).
//
// onRecordCreateRequest roda ANTES da criação, com a regra createRule=null
// (público) já passada — aqui podemos bloquear com $app.throwError.
//

onRecordCreateRequest((e) => {
  const collection = e.record.collection().name
  if (collection !== 'trial_bookings') {
    e.next()
    return
  }

  const dataDe = (value) => {
    // DateField chega como string "YYYY-MM-DD HH:mm:ss.SSSZ" ou Date.
    if (value instanceof Date) {
      return value.toISOString().slice(0, 10)
    }
    const m = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})/)
    return m ? m[1] + '-' + m[2] + '-' + m[3] : ''
  }

  // Status nunca vem do público: sempre nasce 'novo' (campo agora opcional —
  // migration 0043 — para o create anônimo não bater na validação de campo).
  if (!e.record.getString('status')) {
    e.record.set('status', 'novo')
  }

  const classId = e.record.getString('class')
  const dateStr = dataDe(e.record.get('date'))
  const birthStr = dataDe(e.record.get('birth_date'))

  if (!classId) {
    throw new BadRequestError('Escolha uma turma para agendar a aula.')
  }
  if (!dateStr) {
    throw new BadRequestError('Escolha a data da aula.')
  }
  if (!birthStr) {
    throw new BadRequestError('Informe a data de nascimento do aluno.')
  }

  // ---- 1. Turma existe e está ativa ---------------------------------------
  let klass
  try {
    klass = $app.findRecordById('classes', classId)
  } catch (err) {
    throw new BadRequestError('Turma não encontrada. Escolha outra turma.')
  }
  if (klass.getBool('active') === false) {
    throw new BadRequestError('Esta turma não está mais ativa. Escolha outra turma.')
  }

  // ---- 2. Vaga disponível (vagas - matrículas ativas) ----------------------
  // class_students não tem campo "active" (schema real: class+student apenas) —
  // a vaga é contada pelo total de matrículas, como no front (classes.ts).
  const vagas = klass.getInt('vagas')
  const alunosAtivos = $app.findRecordsByFilter('class_students', 'class = {:classId}', '', 0, 0, {
    classId: classId,
  })
  if (vagas > 0 && alunosAtivos.length >= vagas) {
    throw new BadRequestError(
      'Esta turma está sem vagas no momento. Fale com a academia para a lista de espera.',
    )
  }

  // ---- 3. Data no passado (comparada com HOJE em Brasília, UTC-3) -----------
  const todayStr = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString().slice(0, 10)
  if (dateStr < todayStr) {
    throw new BadRequestError('A data da aula não pode estar no passado.')
  }

  // ---- 4. Dia da semana é dia de aula da turma ------------------------------
  const weekdayLabels = {
    seg: 'segunda-feira',
    ter: 'terça-feira',
    qua: 'quarta-feira',
    qui: 'quinta-feira',
    sex: 'sexta-feira',
    sab: 'sábado',
    dom: 'domingo',
  }
  const weekdays = klass.get('weekdays') || []
  if (weekdays.length > 0) {
    const dow = new Date(dateStr + 'T12:00:00Z').getUTCDay() // 0=dom..6=sab
    const dowKeys = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sab']
    const diaKey = dowKeys[dow]
    if (weekdays.indexOf(diaKey) === -1) {
      const diasLegiveis = weekdays
        .slice()
        .sort(function (a, b) {
          return dowKeys.indexOf(a) - dowKeys.indexOf(b)
        })
        .map(function (k) {
          return weekdayLabels[k] || k
        })
        .join(', ')
      throw new BadRequestError(
        'Esta turma não funciona ' +
          (weekdayLabels[diaKey] ? 'às ' + weekdayLabels[diaKey] + 's' : 'neste dia') +
          '. Os dias de aula são: ' +
          diasLegiveis +
          '. Escolha uma data nesses dias.',
      )
    }
  }

  // ---- 5. Faixa de idade da turma (na data da aula) -------------------------
  const minAge = klass.getInt('min_age')
  const maxAge = klass.getInt('max_age')
  if (minAge > 0 || maxAge > 0) {
    const b = birthStr.split('-')
    const d = dateStr.split('-')
    const birth = new Date(Date.UTC(+b[0], +b[1] - 1, +b[2]))
    const chosen = new Date(Date.UTC(+d[0], +d[1] - 1, +d[2]))
    let age = chosen.getUTCFullYear() - birth.getUTCFullYear()
    const md = chosen.getUTCMonth() - birth.getUTCMonth()
    if (md < 0 || (md === 0 && chosen.getUTCDate() < birth.getUTCDate())) age--
    if (minAge > 0 && age < minAge) {
      throw new BadRequestError(
        'Pela data de nascimento, o aluno terá ' +
          age +
          ' ano(s) na data da aula — esta turma é a partir de ' +
          minAge +
          ' anos. Escolha outra turma ou fale com a academia.',
      )
    }
    if (maxAge > 0 && age > maxAge) {
      throw new BadRequestError(
        'Pela data de nascimento, o aluno terá ' +
          age +
          ' ano(s) na data da aula — esta turma é até ' +
          maxAge +
          ' anos. Escolha outra turma ou fale com a academia.',
      )
    }
  }

  e.next()
}, 'trial_bookings')
