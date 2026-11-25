// Blindagem da collection `users` (Judô Tatsu) — v0.0.120 (auditoria de segurança).
//
// O cadastro público (/registrar) cria o usuário com role 'aluno' a partir do
// FRONT. As regras de API (updateRule da migration 0030) já travam role,
// is_owner e active no UPDATE — mas o CREATE é público (signup) e nada impede
// um cliente malicioso de ENVIAR role='admin' (ou is_owner/active/verified)
// no payload de criação ou atualização, caso a regra não filtre campo a campo.
//
// Este hook zera esses campos privilegiados ANTES de a escrita chegar ao banco,
// sempre que o autor não for administrador:
//   • onRecordCreateRequest('users') — signup público (e.auth vazio) ou aluno;
//   • onRecordUpdateRequest('users') — aluno editando o próprio perfil.
// Admin (role='admin' ou is_owner) mantém o comportamento de hoje: o painel
// continua podendo criar credencial de aluno e gerenciar cargos via
// /backend/v1/admins (rota própria, que já exige is_owner).
//
// 'verified' é enviado pelo próprio PocketBase via requestVerification — nunca
// pelo cliente (regra v0.0.72: 400 "Failed to create record").
//
// RESTRIÇÕES DA JSVM: callbacks não enxergam declarações de nível superior —
// toda a lógica fica inline em cada callback.

onRecordCreateRequest((e) => {
  e.next()

  var auth = e.auth
  var isAdmin = !!(
    auth &&
    auth.id !== '' &&
    (auth.getString('role') === 'admin' || auth.getBool('is_owner'))
  )
  if (isAdmin) return

  var rec = e.record
  rec.set('role', 'aluno')
  rec.set('is_owner', false)
  rec.set('active', true)
  rec.set('verified', false)
}, 'users')

onRecordUpdateRequest((e) => {
  e.next()

  var auth = e.auth
  var isAdmin = !!(
    auth &&
    auth.id !== '' &&
    (auth.getString('role') === 'admin' || auth.getBool('is_owner'))
  )
  if (isAdmin) return

  var rec = e.record
  var orig = e.record.original()

  // Restaura o valor ORIGINAL de qualquer campo privilegiado enviado no body —
  // o aluno comum edita nome/avatar/senha, nunca cargo, vínculo ou status.
  if (rec.getString('role') !== orig.getString('role')) rec.set('role', orig.getString('role'))
  if (rec.getBool('is_owner') !== orig.getBool('is_owner'))
    rec.set('is_owner', orig.getBool('is_owner'))
  if (rec.getBool('active') !== orig.getBool('active')) rec.set('active', orig.getBool('active'))
  if (rec.getBool('verified') !== orig.getBool('verified'))
    rec.set('verified', orig.getBool('verified'))
}, 'users')
