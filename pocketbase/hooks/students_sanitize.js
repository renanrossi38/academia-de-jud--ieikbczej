/**
 * students_sanitize.js — blindagem server-side do CREATE de alunos (v0.0.124).
 *
 * Por quê: o PocketBase devolve 400 "Failed to create record." quando o payload
 * traz string vazia em campo tipado (select belt, date birth_date, relation
 * user, bool active). O front ATUAL já omite esses campos, mas bundles antigos
 * em cache (aparelho do dono) ainda enviam belt: '', birth_date: '' etc. — e a
 * recusa genérica não diz qual campo falhou.
 *
 * O que faz:
 *   • onRecordCreateRequest('students'): reconstrói o registro com SOMENTE os
 *     valores válidos e não vazios do payload — qualquer cliente (novo ou
 *     antigo) passa a conseguir cadastrar; strings vazias em campos tipados
 *     são descartadas em vez de recusadas. Campos de texto vazios também são
 *     omitidos (menos lixo). `active` é sempre true no create (comportamento
 *     do painel).
 *   • onRecordUpdateRequest('students'): se um campo tipado chega vazio e o
 *     valor gravado era preenchido, restaura o gravado (o front nunca limpa
 *     faixa/data nesses campos — envia vazio só por bundle antigo).
 *   • Nos dois, se a validação do PocketBase ainda recusar, o erro REAL é
 *     logado no stream de hooks (antes o painel só via o 400 genérico).
 *
 * Segurança de falha: se qualquer passo da reconstrução lançar (JSVM sem
 * `new Record`, campo inesperado), cai no comportamento padrão (e.next()) —
 * o hook NUNCA pode bloquear um cadastro que hoje passaria.
 *
 * RESTRIÇÃO DA JSVM: callbacks não enxergam declarações de nível superior —
 * toda a lógica fica inline em cada callback.
 */

onRecordCreateRequest((e) => {
  try {
    var col = $app.findCollectionByNameOrId('students')
    var src = e.record
    var rec = new Record(col)

    // Campos de texto e tipados: só copia quando preenchidos.
    var fields = [
      'name',
      'phone',
      'email',
      'address',
      'guardian_name',
      'guardian_phone',
      'guardian_email',
      'belt',
      'birth_date',
      'user',
      'photo',
    ]
    for (var i = 0; i < fields.length; i++) {
      var f = fields[i]
      var v = ''
      try {
        v = src.getString(f)
      } catch (_) {
        v = ''
      }
      if (v !== '') {
        try {
          rec.set(f, v)
        } catch (setErr) {
          console.log('[students_sanitize] set ' + f + ' falhou: ' + String(setErr))
        }
      }
    }
    rec.set('active', true)
    e.record = rec
  } catch (buildErr) {
    // Reconstrução impossível (ex.: `new Record` indisponível): segue padrão.
    console.log('[students_sanitize] rebuild ignorado: ' + String(buildErr))
  }

  try {
    e.next()
  } catch (err) {
    console.log('[students_sanitize] 400 create students: ' + String(err))
    throw err
  }
}, 'students')

onRecordUpdateRequest((e) => {
  try {
    var rec = e.record
    var orig = rec.original()
    var typed = ['belt', 'birth_date', 'user']
    for (var i = 0; i < typed.length; i++) {
      var f = typed[i]
      if (rec.getString(f) === '' && orig.getString(f) !== '') {
        rec.set(f, orig.getString(f))
      }
    }
  } catch (_) {
    // Sem original ou campo inesperado: segue padrão.
  }

  try {
    e.next()
  } catch (err) {
    console.log('[students_sanitize] 400 update students: ' + String(err))
    throw err
  }
}, 'students')
