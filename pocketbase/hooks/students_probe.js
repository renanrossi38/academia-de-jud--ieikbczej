//
// students_probe.js — PROVA DE REGISTRO (temporário) — Judô Tatsu
//
// Cron de execução ÚNICA (app_settings key students_probe_done): cria na
// coleção students dois casos com superuser interno (mesmo bypass de regras
// que o painel do dono tem na prática, e a MESMA validação de campo do PB):
//   1) adulto (35 anos) SEM responsável e SEM faixa — simula o payload que o
//      painel agora envia para aluno maior de idade, sem guardian_*/belt;
//   2) menor (10 anos) COM responsável (nome/telefone/e-mail).
// O resultado vai para o log de hooks; os registros de teste são APAGADOS
// sempre (mesmo em falha) — o banco volta ao estado anterior.
//
// Prova feita uma única vez pelo agente; nada do app usa esta rota/hook.
//

cronAdd('students_probe_unico', '*/10 * * * *', () => {
  var flag = null
  try {
    var flags = $app.findRecordsByFilter('app_settings', "key = 'students_probe_done'", '', 1, 0)
    flag = flags.length > 0 ? flags[0] : null
  } catch (errFlag) {
    console.log('[students-probe] app_settings indisponível: ' + errFlag)
    return
  }
  if (flag) return // já rodou uma vez — nunca repete

  var TOKEN = 'PROBE-20261126'
  var criado = []

  try {
    // ---- Caso 1: adulto, SEM guardian_*, SEM belt (payload novo do painel) ----
    var adulto = new Record($app.findCollectionByNameOrId('students'))
    adulto.set('name', 'Aluno Probe Adulto ' + TOKEN)
    adulto.set('active', true)
    adulto.set('email', 'probe.adulto.' + TOKEN.toLowerCase() + '@exemplo.com')
    adulto.set('birth_date', '1991-05-10 12:00:00.000Z')
    // guardian_* NÃO são enviados — é o ponto do bug
    $app.save(adulto)
    criado.push(adulto)
    console.log(
      '[students-probe] ADULTO criado OK id=' +
        adulto.id +
        ' guardian_name="' +
        adulto.getString('guardian_name') +
        '"',
    )

    // ---- Caso 2: menor, COM responsável --------------------------------------
    var menor = new Record($app.findCollectionByNameOrId('students'))
    menor.set('name', 'Aluno Probe Menor ' + TOKEN)
    menor.set('active', true)
    menor.set('email', 'probe.menor.' + TOKEN.toLowerCase() + '@exemplo.com')
    menor.set('birth_date', '2016-03-20 12:00:00.000Z')
    menor.set('guardian_name', 'Responsável Probe')
    menor.set('guardian_phone', '(11) 90000-0000')
    menor.set('guardian_email', 'responsavel.probe@exemplo.com')
    $app.save(menor)
    criado.push(menor)
    console.log(
      '[students-probe] MENOR criado OK id=' +
        menor.id +
        ' guardian="' +
        menor.getString('guardian_name') +
        '" tel="' +
        menor.getString('guardian_phone') +
        '" email="' +
        menor.getString('guardian_email') +
        '"',
    )

    console.log('[students-probe] PROVA COMPLETA: ambos os casos salvaram sem erro.')
  } catch (err) {
    console.log('[students-probe] FALHA: ' + err)
  } finally {
    for (var i = 0; i < criado.length; i++) {
      try {
        $app.delete(criado[i])
      } catch (cleanupErr) {
        console.log('[students-probe] falha ao limpar ' + criado[i].id + ': ' + cleanupErr)
      }
    }
    // Marca como executado (uma única vez) para o cron nunca repetir.
    try {
      var col = $app.findCollectionByNameOrId('app_settings')
      var mark = new Record(col)
      mark.set('key', 'students_probe_done')
      mark.set('value', new Date().toISOString())
      $app.save(mark)
    } catch (markErr) {
      console.log('[students-probe] falha ao gravar flag: ' + markErr)
    }
  }
})
