// Bug v0.0.127 — aula experimental não agendava deslogado ("only superusers
// can perform this action"). A migration 0041 teve DOIS problemas:
//
//   1. createRule: null — no PocketBase null = SOMENTE superusuários; público
//      de verdade é "" (string vazia). Era a mensagem que o visitante via.
//   2. O array `fields` foi passado com construtores tipados (new TextField…)
//      dentro de new Collection({...}), que espera objetos simples — o
//      PocketBase descartou TODOS os campos silenciosamente: a collection
//      ficou sem student_name/birth_date/class/date/contact/notes/status e
//      até sem created/updated (sort "-created" do painel quebraria).
//
// Esta migration conserta as duas coisas: cria os campos que faltam (com
// guard, idempotente) e troca a createRule para público. A validação continua
// server-side no hook trial_bookings.js (turma ativa, vaga, dia da semana,
// faixa de idade, data não passada). Leitura/edição/exclusão seguem restritas
// a admin com permissão da área 'experimentais' (padrão da 0031); o update
// aceita apenas mudar `status`.

migrate(
  (app) => {
    const col = app.findCollectionByNameOrId('trial_bookings')

    // ---- 1. Campos (a 0041 os perdeu por sintaxe errada) -------------------
    if (!col.fields.getByName('student_name')) {
      col.fields.add(new TextField({ name: 'student_name', required: true, min: 3, max: 120 }))
    }
    if (!col.fields.getByName('birth_date')) {
      col.fields.add(new DateField({ name: 'birth_date', required: true }))
    }
    if (!col.fields.getByName('class')) {
      col.fields.add(
        new RelationField({
          name: 'class',
          required: true,
          collectionId: app.findCollectionByNameOrId('classes').id,
          maxSelect: 1,
        }),
      )
    }
    if (!col.fields.getByName('date')) {
      col.fields.add(new DateField({ name: 'date', required: true }))
    }
    if (!col.fields.getByName('contact')) {
      col.fields.add(new TextField({ name: 'contact', required: true, min: 5, max: 160 }))
    }
    if (!col.fields.getByName('notes')) {
      col.fields.add(new TextField({ name: 'notes', required: false, max: 500 }))
    }
    if (!col.fields.getByName('status')) {
      col.fields.add(
        new SelectField({
          name: 'status',
          required: true,
          maxSelect: 1,
          values: ['novo', 'confirmado', 'realizado', 'cancelado'],
        }),
      )
    }
    // Base collections PRECISAM de created/updated autodate (sort/filter 400 sem eles).
    if (!col.fields.getByName('created')) {
      col.fields.add(new AutodateField({ name: 'created', onCreate: true, onUpdate: false }))
    }
    if (!col.fields.getByName('updated')) {
      col.fields.add(new AutodateField({ name: 'updated', onCreate: true, onUpdate: true }))
    }

    // ---- 2. Regras ----------------------------------------------------------
    // Público de verdade (anyone) — validação no hook onRecordCreateRequest.
    col.createRule = ''
    const AREA =
      "@request.auth.id != '' && @request.auth.role = 'admin' && " +
      "(@request.auth.is_owner = true || @request.auth.admin_permissions:length = 0 || @request.auth.admin_permissions ?= 'experimentais')"
    col.updateRule =
      AREA +
      " && (@request.body.status = 'novo' || @request.body.status = 'confirmado' || @request.body.status = 'realizado' || @request.body.status = 'cancelado')"

    app.save(col)
  },
  (app) => {
    // Rollback: volta a createRule "superusers only" e a updateRule da 0041.
    // Os campos ficam (removê-los apagaria dados reais de agendamentos).
    const col = app.findCollectionByNameOrId('trial_bookings')
    col.createRule = null
    col.updateRule =
      "@request.auth.id != '' && @request.auth.role = 'admin' && " +
      "(@request.auth.is_owner = true || @request.auth.admin_permissions:length = 0 || @request.auth.admin_permissions ?= 'experimentais')"
    app.save(col)
  },
)
