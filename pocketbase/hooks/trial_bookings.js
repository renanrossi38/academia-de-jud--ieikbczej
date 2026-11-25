//
// trial_bookings.js — Aula experimental (Judô Tatsu)
//
// Valida no SERVIDOR a criação de agendamentos de aula experimental:
//   - turma existe e está ativa;
//   - turma tem vaga (vagas - matrículas ativas > 0);
//   - data da aula é um dos dias da semana da turma (ex.: ter/qui recusa seg/qua);
//   - data da aula não está no passado;
//   - data de nascimento encaixa na faixa de idade da turma (min_age/max_age
//     calculados NA data da aula escolhida);
//   - UNICIDADE: só um agendamento por turma por dia — se já existe outro
//     agendamento NÃO-cancelado para a mesma turma na mesma data, o create é
//     recusado (cancelado libera o dia).
//
// Notas da JSVM deste projeto: callbacks não enxergam declarações de nível
// superior (lógica inline no callback) e não existe $app.countRecordsByFilter
// (usar findRecordsByFilter e contar em objeto).
//
// onRecordCreateRequest roda ANTES da criação, com a regra createRule=null
// (público) já passada — aqui podemos bloquear com BadRequestError.
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

  // ---- 6. UNICIDADE: um agendamento por turma por dia ----------------------
  // Já existe agendamento NÃO-cancelado nesta turma nesta data? Bloqueia —
  // o dia fica reservado para UMA aula experimental por vez. Status 'cancelado'
  // libera o dia (a aula não vai acontecer). Vale para QUALQUER chamador:
  // o público pelo form e quem burlar e chamar a API direto.
  const dParts = dateStr.split('-')
  const proximoDiaStr = new Date(Date.UTC(+dParts[0], +dParts[1] - 1, +dParts[2] + 1))
    .toISOString()
    .slice(0, 10)
  const existentes = $app.findRecordsByFilter(
    'trial_bookings',
    'class = {:classId} && date >= {:dayStart} && date < {:dayEnd} && status != "cancelado"',
    '',
    1,
    0,
    {
      classId: classId,
      dayStart: dateStr + ' 00:00:00.000Z',
      dayEnd: proximoDiaStr + ' 00:00:00.000Z',
    },
  )
  if (existentes.length > 0) {
    throw new BadRequestError(
      'Já existe uma aula experimental agendada para esta turma neste dia. Escolha outra data.',
    )
  }

  e.next()
}, 'trial_bookings')

// ---- Rota pública de disponibilidade (calendário do formulário) ------------
//
// GET /backend/v1/trial-availability/{classId}
//   → { dates: ["2026-01-15", ...] }
// Devolve as datas (dia, sem hora e SEM nenhum dado pessoal) que já têm
// agendamento NÃO-cancelado para a turma — o mesmo critério do bloqueio acima.
// O front usa para desabilitar/marcar esses dias no calendário.
//
// RESTRIÇÃO DA JSVM: callbacks não enxergam declarações de nível superior —
// tudo inline dentro da callback.

routerAdd(
  'GET',
  '/backend/v1/trial-availability/{classId}',
  (e) => {
    const classId = e.request.pathValue('classId') || ''

    if (classId === '') {
      throw new BadRequestError('Turma não informada.')
    }

    // Turma precisa existir e estar ativa — turma inexistente/inativa devolve
    // a MESMA resposta de datas vazias (não revela quais turmas existem).
    try {
      const klass = $app.findRecordById('classes', classId)
      if (klass.getBool('active') === false) {
        return e.json(200, { dates: [] })
      }
    } catch (errClass) {
      return e.json(200, { dates: [] })
    }

    // Datas ocupadas: agendamentos não-cancelados, a partir de HOJE (Brasília)
    // — datas passadas não interessam ao calendário (nenhum dia passado é
    // agendável de qualquer forma).
    const todayStr = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString().slice(0, 10)
    const recs = $app.findRecordsByFilter(
      'trial_bookings',
      'class = {:classId} && date >= {:today} && status != "cancelado"',
      'date',
      0,
      0,
      { classId: classId, today: todayStr + ' 00:00:00.000Z' },
    )

    const dates = []
    for (let i = 0; i < recs.length; i++) {
      const raw = recs[i].get('date')
      let d = ''
      if (raw instanceof Date) {
        d = raw.toISOString().slice(0, 10)
      } else {
        const m = String(raw || '').match(/^(\d{4})-(\d{2})-(\d{2})/)
        if (m) d = m[1] + '-' + m[2] + '-' + m[3]
      }
      if (d !== '' && dates.indexOf(d) === -1) {
        dates.push(d)
      }
    }

    return e.json(200, { dates: dates })
  },
  // Pública: o calendário do formulário roda sem login e recebe apenas as
  // datas ocupadas — nenhum dado pessoal (nome, contato, observação ficam
  // fora da resposta).
)
