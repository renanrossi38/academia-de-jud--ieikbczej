// Nota do exame nas promoções de faixa + turmas infantis + medalhas mensais.
//
// 1) belt_promotions.exam_score: nota opcional (0 a 10) do exame de faixa.
// 2) classes.is_kids: turma marcada como infantil (medalhas só aparecem nela).
// 3) class_medals: registro mensal das medalhas da turma infantil.
//    kind = 'dorme_dorme' (pode haver mais de um aluno no mês) ou
//    'fica_fica' (destaque do mês; a service troca o registro anterior).
//    month = "AAAA-MM" (mês de Brasília). O ícone de dorme dorme só vale no
//    mês vigente — a regra de tempo fica no front; o registro permanece.
//
// REGRAS de class_medals: leitura, criação e remoção só para o admin com a
// área "presencas" (mesma fórmula de classes). Atualização: nenhuma (remove e
// recria). A collection é salva primeiro SEM regras e as regras são aplicadas
// depois por atribuição, como na migration 0034.
//
// IDEMPOTENTE: roda vazio em banco recém-criado.
migrate(
  (app) => {
    var promos = app.findCollectionByNameOrId('belt_promotions')
    if (!promos.fields.getByName('exam_score')) {
      promos.fields.add(new NumberField({ name: 'exam_score', min: 0, max: 10, required: false }))
      app.save(promos)
    }

    var classes = app.findCollectionByNameOrId('classes')
    if (!classes.fields.getByName('is_kids')) {
      classes.fields.add(new BoolField({ name: 'is_kids', required: false }))
      app.save(classes)
      classes = app.findCollectionByNameOrId('classes')
    }

    var exists = null
    try {
      exists = app.findCollectionByNameOrId('class_medals')
    } catch (_) {
      exists = null
    }

    if (!exists) {
      exists = new Collection({
        name: 'class_medals',
        type: 'base',
        listRule: null,
        viewRule: null,
        createRule: null,
        updateRule: null,
        deleteRule: null,
        fields: [
          {
            name: 'class',
            type: 'relation',
            collectionId: classes.id,
            required: true,
            cascadeDelete: true,
            maxSelect: 1,
          },
          {
            name: 'student',
            type: 'relation',
            collectionId: app.findCollectionByNameOrId('students').id,
            required: true,
            cascadeDelete: true,
            maxSelect: 1,
          },
          { name: 'month', type: 'text', required: true, min: 7, max: 7 },
          {
            name: 'kind',
            type: 'select',
            required: true,
            values: ['dorme_dorme', 'fica_fica'],
            maxSelect: 1,
          },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
        indexes: [
          'CREATE UNIQUE INDEX idx_class_medals_unique ON class_medals (class, student, month, kind)',
          'CREATE INDEX idx_class_medals_class_month ON class_medals (class, month)',
        ],
      })
      app.save(exists)

      exists = app.findCollectionByNameOrId('class_medals')
    }

    // Regras finais: admin da área "presencas" lê, cria e remove.
    var AREA_PRESENCAS =
      "@request.auth.id != '' && @request.auth.role = 'admin' && " +
      '(@request.auth.is_owner = true || @request.auth.admin_permissions:length = 0 || ' +
      "@request.auth.admin_permissions ?= 'presencas')"

    exists.listRule = '(' + AREA_PRESENCAS + ')'
    exists.viewRule = '(' + AREA_PRESENCAS + ')'
    exists.createRule = '(' + AREA_PRESENCAS + ')'
    exists.updateRule = null
    exists.deleteRule = '(' + AREA_PRESENCAS + ')'
    app.save(exists)
  },
  (app) => {
    var col = null
    try {
      col = app.findCollectionByNameOrId('class_medals')
    } catch (_) {
      col = null
    }
    if (col) app.delete(col)
  },
)
